// convert-zones.ts — WorldProject zones → engine ZoneDefinition[]

import type { WorldProject } from '@world-forge/schema';
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
            condition: e.condition ? { type: e.condition, params: {} } : undefined,
          }))
        : undefined,
    };
  });
}
