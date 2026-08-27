// convert-transitions.ts — Passthrough of SCH-FT-004 TransitionEntity into
// the Unreal content pack. Richer than a ZoneConnection because it carries
// presentation metadata (animation key, travel duration, grid anchor).

import type { WorldProject, TransitionEntity, TransitionEntityType, Zone } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import {
  gridToUnrealAxis,
  DEFAULT_TILE_SIZE_CM,
  type UnrealVec3,
} from './coordinate-transform.js';

export interface UnrealTransitionEntity {
  Id: string;
  ZoneId: string;
  TargetZoneId: string;
  Type: TransitionEntityType;
  /** Placed grid position promoted to Unreal cm (defaults to zone origin when unset). */
  LocationCm: UnrealVec3;
  Label?: string;
  Animation?: string;
  DurationSeconds?: number;
  Tags?: string[];
}

/**
 * F-221939a1: record of a transition dropped because its parent zone was
 * missing. Mirrors UnrealDroppedEntity so a loader / test can detect an
 * incomplete transitions list without walking fidelity entries.
 */
export interface UnrealDroppedTransition {
  Id: string;
  ZoneId: string;
  Reason: string;
}

export interface ConvertTransitionsResult {
  transitions: UnrealTransitionEntity[];
  dropped: UnrealDroppedTransition[];
  incomplete: boolean;
  fidelity: FidelityEntry[];
}

export function convertTransitions(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): ConvertTransitionsResult {
  const transitions: UnrealTransitionEntity[] = [];
  const dropped: UnrealDroppedTransition[] = [];
  const fidelity: FidelityEntry[] = [];
  const zonesById = new Map<string, Zone>(project.zones.map((z) => [z.id, z]));

  const src = project.transitions ?? [];
  for (const t of src) {
    const parent = zonesById.get(t.zoneId);
    if (!parent) {
      // F-221939a1: a missing parent used to fall back to grid (0,0) and
      // still claim lossless — an unknown zone became a lift at world origin.
      const reason = `Zone "${t.zoneId}" not found in project.zones.`;
      fidelity.push({
        level: 'dropped',
        domain: 'transitions',
        severity: 'error',
        entityId: t.id,
        fieldPath: `transitions.${t.id}.zoneId`,
        message: `Transition "${t.id}" dropped — zone "${t.zoneId}" not found.`,
        reason: 'Orphan zone reference.',
      });
      dropped.push({ Id: t.id, ZoneId: t.zoneId, Reason: reason });
      continue;
    }

    transitions.push(convertTransition(t, parent, tileSizeCm));
    fidelity.push({
      level: 'lossless',
      domain: 'transitions',
      severity: 'info',
      entityId: t.id,
      fieldPath: `transitions.${t.id}`,
      message: `Transition "${t.id}" (${t.type}) preserved.`,
      reason: 'Mapped TransitionEntity 1:1 to UnrealTransitionEntity.',
    });
  }

  return { transitions, dropped, incomplete: dropped.length > 0, fidelity };
}

function convertTransition(
  t: TransitionEntity,
  parent: Zone,
  tileSizeCm: number,
): UnrealTransitionEntity {
  // Resolve an origin: prefer the placed (gridX, gridY) if authored, otherwise
  // fall back to the parent zone's origin. Parent is guaranteed present.
  const gridX = t.gridX ?? parent.gridX;
  const gridY = t.gridY ?? parent.gridY;
  const elevationMeters = parent.elevation ?? 0;

  const locationCm = gridToUnrealAxis(gridX, gridY, tileSizeCm, elevationMeters);

  const out: UnrealTransitionEntity = {
    Id: t.id,
    ZoneId: t.zoneId,
    TargetZoneId: t.targetZoneId,
    Type: t.type,
    LocationCm: locationCm,
  };
  if (t.label !== undefined) out.Label = t.label;
  if (t.animation !== undefined) out.Animation = t.animation;
  if (t.durationSeconds !== undefined) out.DurationSeconds = t.durationSeconds;
  if (t.tags !== undefined) out.Tags = t.tags.slice();
  return out;
}
