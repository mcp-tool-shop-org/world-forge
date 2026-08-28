// convert-landmarks.ts — F-3c90bcc5: landmarks as a ContentPack channel.

import type { Landmark, WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export type ExportedLandmark = {
  id: string;
  name: string;
  zoneId: string;
  gridX: number;
  gridY: number;
  tags: string[];
  interactionType: Landmark['interactionType'];
  description?: string;
};

export function convertLandmarks(project: WorldProject, fidelity?: FidelityEntry[]): ExportedLandmark[] {
  const zoneIds = new Set(project.zones.map((z) => z.id));
  const out: ExportedLandmark[] = [];
  for (const l of project.landmarks) {
    if (!zoneIds.has(l.zoneId)) {
      fidelity?.push({
        level: 'dropped',
        domain: 'world',
        severity: 'warning',
        entityId: l.id,
        fieldPath: `landmarks.${l.id}.zoneId`,
        message: `Landmark "${l.id}" dropped — zone "${l.zoneId}" not found.`,
        reason: 'landmark-orphan-zone',
      });
      continue;
    }
    out.push({
      id: l.id,
      name: l.name,
      zoneId: l.zoneId,
      gridX: l.gridX,
      gridY: l.gridY,
      tags: [...l.tags],
      interactionType: l.interactionType,
      ...(l.description !== undefined ? { description: l.description } : {}),
    });
  }
  return out;
}
