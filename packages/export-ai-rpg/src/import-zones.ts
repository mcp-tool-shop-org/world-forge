// import-zones.ts — engine ZoneDefinition[] → schema Zone[] with auto-layout

import type { Zone } from '@world-forge/schema';
import type { ZoneDefinition } from '@ai-rpg-engine/content-schema';

export interface ZoneLayoutOptions {
  defaultWidth?: number;
  defaultHeight?: number;
  spacing?: number;
}

export function importZones(
  engineZones: ZoneDefinition[],
  options?: ZoneLayoutOptions,
): Zone[] {
  const w = options?.defaultWidth ?? 6;
  const h = options?.defaultHeight ?? 5;
  const sp = options?.spacing ?? 4;

  const cols = Math.max(1, Math.ceil(Math.sqrt(engineZones.length)));

  return engineZones.map((ez, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Reconstruct description from TextBlock[] or string
    let description = '';
    if (ez.description) {
      if (Array.isArray(ez.description)) {
        description = ez.description.map((b: { text: string }) => b.text).join(' ');
      } else {
        description = ez.description as string;
      }
    }

    // Reconstruct interactables — engine only preserves names
    const interactables = (ez.interactables ?? []).map((name: string) => ({
      name,
      type: 'inspect' as const,
    }));

    // Reconstruct exits
    const exits = (ez.exits ?? []).map((e) => ({
      targetZoneId: e.targetZoneId,
      label: e.label ?? '',
      condition: e.condition?.type,
    }));

    return {
      id: ez.id,
      name: ez.name,
      tags: [...(ez.tags ?? [])],
      description,
      gridX: col * (w + sp),
      gridY: row * (h + sp),
      gridWidth: w,
      gridHeight: h,
      neighbors: [...(ez.neighbors ?? [])],
      exits,
      light: ez.light ?? 5,
      noise: ez.noise ?? 3,
      hazards: [...(ez.hazards ?? [])],
      interactables,
    };
  });
}
