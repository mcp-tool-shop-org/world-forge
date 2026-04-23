// convert-transitions.ts — Passthrough of SCH-FT-004 TransitionEntity into
// the Unreal content pack. Richer than a ZoneConnection because it carries
// presentation metadata (animation key, travel duration, grid anchor).

import type { WorldProject, TransitionEntity, TransitionEntityType } from '@world-forge/schema';
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

export interface ConvertTransitionsResult {
  transitions: UnrealTransitionEntity[];
  fidelity: FidelityEntry[];
}

export function convertTransitions(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): ConvertTransitionsResult {
  const transitions: UnrealTransitionEntity[] = [];
  const fidelity: FidelityEntry[] = [];

  const src = project.transitions ?? [];
  for (const t of src) {
    transitions.push(convertTransition(t, project, tileSizeCm));
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

  return { transitions, fidelity };
}

function convertTransition(
  t: TransitionEntity,
  project: WorldProject,
  tileSizeCm: number,
): UnrealTransitionEntity {
  // Resolve an origin: prefer the placed (gridX, gridY) if authored, otherwise
  // fall back to the parent zone's origin. Either way, promote to Unreal cm.
  let gridX = t.gridX;
  let gridY = t.gridY;
  let elevationMeters = 0;
  if (gridX === undefined || gridY === undefined) {
    const parent = project.zones.find((z) => z.id === t.zoneId);
    gridX = parent?.gridX ?? 0;
    gridY = parent?.gridY ?? 0;
    elevationMeters = parent?.elevation ?? 0;
  } else {
    const parent = project.zones.find((z) => z.id === t.zoneId);
    elevationMeters = parent?.elevation ?? 0;
  }

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
