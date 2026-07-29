// convert-placements.ts — WorldProject entity placements → engine `placements[]`
//
// C0's sharpest single drop, closed (C3/P1). `EntityBlueprint` has no location
// field, so `convertEntities` emitted every NPC and no NPC's whereabouts: "an
// exported pack cannot say where any NPC stands — the single most consequential
// drop in the lane" (ai-rpg-engine/docs/c0-alignment/REPORT.md §2). C1's intake
// seam could only report it, on every single ingestion.
//
// Placement is its own record rather than a field on the blueprint, and that is
// deliberate: a blueprint is a TEMPLATE. `encounter-spawn` clones templates and
// overrides `zoneId` per instance, so a location ON the template would be a lie
// for every cloned participant. One template, N placements.
//
// `spawnCondition` COMPILES here, the same way exit conditions do — RG-C1 Lane
// 2's ink pattern, a rich authoring grammar compiling to a closed engine-owned
// instruction format. The engine never parses author syntax. Note the asymmetry
// this closes: the grammar's ORIGINAL home field was
// `EntityPlacement.spawnCondition` and it was dropped on export, while zone
// exits (a later borrower of the same grammar) were carried garbled. C1 fixed
// the borrower; this fixes the original.

import type { WorldProject } from '@world-forge/schema';
import { parseSpawnCondition } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

/** One entity, placed in one zone, optionally gated. Mirrors the engine's `EntityPlacementRecord`. */
export interface ExportedPlacement {
  entityId: string;
  zoneId: string;
  spawnCondition?: { type: string; params: Record<string, string | number | boolean> };
}

/**
 * Convert project entity placements → the engine's `placements[]` channel.
 *
 * **Precondition:** `validateProject(project).valid === true`.
 *
 * One record per `EntityPlacement`, in authored order, so the output is
 * byte-stable across runs for a fixed project.
 *
 * An unparseable `spawnCondition` is WARNED about and the placement is exported
 * WITHOUT the condition — the same discipline `compileExitCondition` uses, and
 * for the same reason: a malformed spec that reaches the engine is worse than an
 * absent one, because it looks like a rule. The placement itself survives,
 * because "this NPC stands here" is a separate claim from "…under condition X",
 * and dropping the first because the second is malformed would lose more than
 * the author got wrong.
 */
export function convertPlacements(
  project: WorldProject,
  fidelity?: FidelityEntry[],
  warnings?: string[],
): ExportedPlacement[] {
  return project.entityPlacements.map((ep) => {
    const record: ExportedPlacement = {
      entityId: ep.entityId,
      zoneId: ep.zoneId,
    };

    if (ep.spawnCondition) {
      const parsed = parseSpawnCondition(ep.spawnCondition);
      if (parsed === null) {
        const label = ep.name || ep.entityId;
        warnings?.push(
          `Entity "${ep.entityId}" (${label}) has a spawnCondition "${ep.spawnCondition}" that is not ` +
            `valid SpawnCondition grammar — the placement is exported WITHOUT a condition, so the entity ` +
            `will be placed unconditionally. Valid forms include "always", "never", "item:<id>", ` +
            `"flag:<id>", "level:>=5", "party-size:>=3", "time:day".`,
        );
        fidelity?.push({
          domain: 'entities',
          level: 'approximated',
          severity: 'warning',
          entityId: ep.entityId,
          fieldPath: 'spawnCondition',
          message:
            `Entity '${label}' spawnCondition '${ep.spawnCondition}' is not valid SpawnCondition ` +
            `grammar and was dropped; the placement itself was kept.`,
          reason: 'spawn-condition-unparseable',
        });
      } else {
        record.spawnCondition = { type: parsed.type, params: parsed.params ?? {} };
      }
    }

    return record;
  });
}
