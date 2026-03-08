// convert-zones.ts — WorldProject zones → engine ZoneDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { ZoneDefinition } from '@ai-rpg-engine/content-schema';

export function convertZones(project: WorldProject): ZoneDefinition[] {
  return project.zones.map((z) => ({
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
  }));
}
