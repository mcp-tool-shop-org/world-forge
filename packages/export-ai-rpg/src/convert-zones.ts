// convert-zones.ts — WorldProject zones → engine ZoneDefinition[]

import type { WorldProject } from '@world-forge/schema';
import { parseSpawnCondition } from '@world-forge/schema';
import type { ZoneDefinition } from '@ai-rpg-engine/content-schema';

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
 */
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

export function convertZones(project: WorldProject, warnings?: string[]): ZoneDefinition[] {
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
    };
  });
}
