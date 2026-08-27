// convert-zones.ts — WorldProject zones → engine ZoneDefinition[]

import type { WorldProject } from '@world-forge/schema';
import { parseSpawnCondition } from '@world-forge/schema';
import type { ZoneDefinition } from '@ai-rpg-engine/content-schema';
import type { FidelityEntry } from './fidelity.js';

/**
 * A compiled entry gate, as the engine's `EntryGateDefinition` shape.
 *
 * ⚠ DECLARED LOCALLY, AND FOR THE DOCUMENTED REASON — `main` and `latest` are
 * different engines. `ZoneDefinition.entryGate` was added to the engine's
 * `content-schema` on `main` by C3/P2 and has NEVER BEEN PUBLISHED; npm `latest`
 * is 3.8.0 (published 2026-07-28T23:12Z), whose `ZoneDefinition` ends at `exits`.
 * The dep ranges are current — all six resolve 3.8.0 — so this is not a range
 * problem, it is the same RELEASE problem the engine-deps errand measured for
 * `computeContentHash` and `GameManifest.contentHash`.
 *
 * So this is the third instance of one pattern, and it is now a pattern rather
 * than an incident: a cross-repo field the engine has on `main` must be
 * intersected locally in this repo until a release carries it. Delete this type
 * and import `EntryGateDefinition` when that happens —
 * `__tests__/engine-deps-3x.test.ts` fails the moment it becomes possible, so
 * nothing has to be remembered.
 */
export type ExportedEntryGate = {
  conditions: Array<{ type: string; params: Record<string, string | number | boolean> }>;
  mode: 'hard' | 'soft';
  reason?: string;
};

/** The scene descriptor the client's diorama binds to (C3/P4). Stable keys only. */
export type ExportedScene = {
  biome?: string;
  timeOfDay?: string;
  dressingDensity?: 'sparse' | 'normal' | 'dense';
  variantTags?: string[];
};

/** The engine's `ZoneDefinition` plus the unpublished C3 fields. See {@link ExportedEntryGate}. */
export type ExportedZone = ZoneDefinition & {
  entryGate?: ExportedEntryGate;
  /** C3/P3 — ids into the pack's `hazardDefinitions`. */
  hazardRefs?: string[];
  /** C3/P4 — the scene descriptor. */
  scene?: ExportedScene;
};

/**
 * Build a zone's scene descriptor from the keys the schema ALREADY authors
 * (C3/P4).
 *
 * ⚠ NOTHING NEW IS INVENTED HERE, which is the point. The forge has carried
 * `timeOfDay` and `tags` since before this cycle; C0 filed `zones[].timeOfDay` as
 * `no-channel` with the note "no channel — even though the SpawnCondition grammar
 * has a `time:` operand the engine could gate on." This closes both at once: the
 * descriptor gives `timeOfDay` its channel, and that channel is the missing input
 * the `time-of-day` gate operand needed (C3/P2 measured it unevaluable for exactly
 * this reason).
 *
 * ⚠ AND WHAT IS DELIBERATELY EXCLUDED. `parallaxLayers`, `skylineRef`,
 * `collisionType`, the physics fields and the sky/light hints are NOT here. They
 * are client-owned per the charter and stay `no-channel` in the recount. A
 * descriptor that carried them would be a renderer config crossing a simulation
 * boundary — the exact thing Triangle Strategy's "swap dressing, never layout"
 * rule forbids.
 *
 * `biome` is derived from the zone's authored tags rather than invented: the first
 * `biome:`-prefixed tag, if any. Tag conventions are how this schema already
 * expresses `mode:` and `faction:`, so this adds no new authoring surface.
 */
function buildScene(z: {
  tags: string[];
  timeOfDay?: string;
  interactables: unknown[];
  propPlacements?: unknown[];
}): ExportedScene | undefined {
  const biomeTag = z.tags.find((t) => t.startsWith('biome:'));
  // Coarse and ORDINAL — three buckets, because the client decides what density
  // means and a continuous number would imply a precision the author never had.
  const propCount = z.interactables.length;
  const dressingDensity: ExportedScene['dressingDensity'] =
    propCount === 0 ? 'sparse' : propCount >= 3 ? 'dense' : 'normal';

  const scene: ExportedScene = {
    ...(biomeTag ? { biome: biomeTag.slice('biome:'.length) } : {}),
    ...(z.timeOfDay !== undefined ? { timeOfDay: z.timeOfDay } : {}),
    dressingDensity,
  };
  return Object.keys(scene).length > 0 ? scene : undefined;
}

/**
 * Compile a zone exit's SpawnCondition-grammar string into a structured
 * `ConditionSpec`.
 *
 * ⚠ THIS FIXES THE AUDIT'S SINGLE `carried-garbled` ROW. The previous line was
 * `condition: e.condition ? { type: e.condition, params: {} } : undefined` —
 * it put the WHOLE grammar string into `type`, a field that is meant to name a
 * condition KIND, and left `params` empty. So `"item:rope"` exported as
 * `{ type: "item:rope", params: {} }`: structurally valid, and meaning nothing.
 * The repo's own `parseSpawnCondition` has returned
 * `{ type: 'has-item', params: { id: 'rope' } }` the whole time and was never
 * called (ai-rpg-engine/docs/c0-alignment/REPORT.md §2).
 *
 * This is a COMPILE of an existing closed grammar into an existing wire shape —
 * RG-C1 Lane 2's ink pattern, where a rich authoring grammar compiles to a
 * closed, engine-owned instruction format. It is not vocabulary growth: no new
 * condition kinds, no eval, no user-defined predicates. Entry gates, typed
 * hazards and economyProfile remain C3.
 *
 * An unparseable condition is WARNED about and dropped rather than passed
 * through malformed. A malformed spec that reaches the engine is worse than an
 * absent one: it looks like a rule.
 */
function compileExitCondition(
  zoneId: string,
  exit: { targetZoneId: string; label?: string; condition?: string },
  warnings?: string[],
): { type: string; params: Record<string, string | number | boolean> } | undefined {
  if (!exit.condition) return undefined;
  const parsed = parseSpawnCondition(exit.condition);
  if (!parsed) {
    const label = exit.label ? ` (label "${exit.label}")` : '';
    warnings?.push(
      `Zone "${zoneId}" has an exit${label} whose condition "${exit.condition}" is not valid ` +
        `SpawnCondition grammar — the exit is exported without a condition. Valid forms include ` +
        `"always", "never", "item:<id>", "flag:<id>", "level:>=5", "party-size:>=3", "time:day".`,
    );
    return undefined;
  }
  return { type: parsed.type, params: parsed.params ?? {} };
}

/**
 * Compile a `ZoneEntryGate`'s authored condition strings into the engine's
 * `EntryGateDefinition` (C3/P2).
 *
 * The same ink pattern as `compileExitCondition`, applied to the grammar's other
 * borrower: each element of `conditions[]` is a SpawnCondition-grammar string,
 * and the engine receives compiled `ConditionSpec`s only.
 *
 * ⚠ THE EMPTY-GATE HAZARD, and why an all-unparseable gate exports as NO GATE.
 * The engine evaluates `conditions` as an AND-array, and an AND over zero members
 * is vacuously TRUE. So a gate whose every condition failed to compile would, if
 * emitted with `conditions: []`, SILENTLY UNLOCK the zone it was authored to
 * lock — worse than dropping it, because the pack would still look gated. It is
 * dropped loudly instead, and the engine's validator refuses an empty
 * `conditions` array as a second line of defence.
 *
 * A PARTIAL failure is different and is treated differently: the parseable
 * conditions are kept and the unparseable ones warned about, because dropping a
 * whole gate over one typo loses more than the author got wrong. That does make
 * the gate WEAKER than authored, so the warning says so explicitly.
 */
function compileEntryGate(
  zoneId: string,
  gate: { conditions: string[]; mode: 'hard' | 'soft'; reason?: string },
  warnings?: string[],
): ExportedEntryGate | undefined {
  const compiled: Array<{ type: string; params: Record<string, string | number | boolean> }> = [];
  const failed: string[] = [];

  for (const raw of gate.conditions ?? []) {
    const parsed = parseSpawnCondition(raw);
    if (!parsed) {
      failed.push(raw);
      continue;
    }
    compiled.push({ type: parsed.type, params: parsed.params ?? {} });
  }

  if (compiled.length === 0) {
    warnings?.push(
      `Zone "${zoneId}" has an entryGate whose condition${gate.conditions.length === 1 ? '' : 's'} ` +
        `(${gate.conditions.map((c) => `"${c}"`).join(', ')}) could not be compiled — the gate is NOT exported, ` +
        `so the zone is UNGATED. An empty condition list would read as "no requirements" and silently unlock it. ` +
        `Valid forms include "item:<id>", "flag:<id>", "party-size:>=3", "member:<id>", "class:<id>".`,
    );
    return undefined;
  }

  if (failed.length > 0) {
    warnings?.push(
      `Zone "${zoneId}" entryGate: ${failed.length} of ${gate.conditions.length} conditions ` +
        `(${failed.map((c) => `"${c}"`).join(', ')}) are not valid SpawnCondition grammar and were dropped. ` +
        `The gate is exported with the remaining ${compiled.length}, so it is WEAKER than authored.`,
    );
  }

  return {
    conditions: compiled,
    mode: gate.mode,
    ...(gate.reason !== undefined ? { reason: gate.reason } : {}),
  };
}

/**
 * Convert project zones → engine `ZoneDefinition[]`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 *
 * **AIR-B-002:** When `warnings` is provided, every `exit.targetZoneId` that
 * does not resolve to a zone in `project.zones` is reported. The exit is
 * preserved in the output so the engine still sees the raw reference, but the
 * user gets a clear, actionable message identifying the exact zone + exit that
 * is broken.
 *
 * **F-b372b7e0:** Interactables stay a name-only `string[]` on the wire. When
 * an interactable has a `type` that a name-only projection cannot recover
 * (anything other than the import default `'inspect'`) or a `description`,
 * that drop is reported on `warnings` + `fidelity` (`interactable-collapsed-to-name`).
 */
export function convertZones(
  project: WorldProject,
  warnings?: string[],
  fidelity?: FidelityEntry[],
): ExportedZone[] {
  const zoneIds = new Set(project.zones.map((z) => z.id));
  return project.zones.map((z) => {
    if (warnings && z.exits.length > 0) {
      for (const e of z.exits) {
        if (!zoneIds.has(e.targetZoneId)) {
          const label = e.label ? ` (label "${e.label}")` : '';
          warnings.push(
            `Zone "${z.id}" has an exit${label} whose targetZoneId "${e.targetZoneId}" does not exist — the engine will fail to traverse this exit. Remove the exit or restore the missing zone.`,
          );
        }
      }
    }
    // F-b372b7e0: name-only projection drops type + description. Import
    // reconstructs `{ name, type: 'inspect' }`, so 'inspect' is recoverable;
    // any other authored type, or a description, is not.
    for (const i of z.interactables) {
      const dropped: string[] = [];
      if (i.type && i.type !== 'inspect') {
        dropped.push(`type '${i.type}'`);
      }
      if (i.description) {
        dropped.push('description');
      }
      if (dropped.length > 0) {
        const msg =
          `Zone "${z.id}" interactable "${i.name}" collapsed to a name string — dropped ${dropped.join(' and ')} ` +
          `(engine wire is name-only; import will default type to 'inspect').`;
        warnings?.push(msg);
        fidelity?.push({
          domain: 'zones',
          level: 'approximated',
          severity: 'warning',
          entityId: z.id,
          fieldPath: `interactables.${i.name}`,
          message: msg,
          reason: 'interactable-collapsed-to-name',
        });
      }
    }
    return {
      id: z.id,
      name: z.name,
      tags: z.tags,
      description: z.description ? [{ text: z.description }] : undefined,
      neighbors: z.neighbors,
      light: z.light,
      noise: z.noise,
      hazards: z.hazards.length > 0 ? z.hazards : undefined,
      interactables: z.interactables.length > 0
        ? z.interactables.map((i) => i.name)
        : undefined,
      exits: z.exits.length > 0
        ? z.exits.map((e) => ({
            targetZoneId: e.targetZoneId,
            label: e.label,
            condition: compileExitCondition(z.id, e, warnings),
          }))
        : undefined,
      // C3/P2 — the v4.5 party-state entry gate, compiled. C0: "The Godot lane
      // consumes it; the engine lane has no field for it."
      entryGate: z.entryGate ? compileEntryGate(z.id, z.entryGate, warnings) : undefined,
      // C3/P3 — the TYPED hazard refs. The legacy free-text `hazards` list above
      // is carried UNCHANGED alongside them: both cross, and only the typed ones
      // mean anything without pack code. C0 measured that difference across twelve
      // worlds and the contrast is preserved deliberately.
      hazardRefs: z.hazardRefs && z.hazardRefs.length > 0 ? [...z.hazardRefs] : undefined,
      // C3/P4 — the scene descriptor, built from keys already authored.
      scene: buildScene(z),
    };
  });
}
