// convert-parallax.ts — UE-FT-004: Parallax actor spawn manifest.
//
// Emits one UnrealParallaxActor per ParallaxLayer across every zone so the
// UE5 loader can spawn a parallax actor per layer with zone-aware anchoring,
// depth ordering, scroll factor, and scale derived from the zone extent.

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import {
  gridToUnrealAxis,
  DEFAULT_TILE_SIZE_CM,
  type UnrealVec3,
} from './coordinate-transform.js';

export interface UnrealParallaxActor {
  ZoneId: string;
  /** Layer id from the authoring tool — useful for diffing incremental exports. */
  LayerId: string;
  Depth: number;
  AssetRef: string;
  ScrollFactor: number;
  /** Suggested scale (X,Y) derived from the parent zone's extent in cm. */
  SuggestedScale: { X: number; Y: number };
  /** Origin of the parent zone in Unreal cm — pin parallax actors here. */
  ParentZoneOriginCm: UnrealVec3;
}

export interface UnrealParallaxManifest {
  Actors: UnrealParallaxActor[];
}

export interface ConvertParallaxResult {
  manifest: UnrealParallaxManifest;
  fidelity: FidelityEntry[];
}

export function convertParallax(
  project: WorldProject,
  tileSizeCm: number = DEFAULT_TILE_SIZE_CM,
): ConvertParallaxResult {
  const actors: UnrealParallaxActor[] = [];
  const fidelity: FidelityEntry[] = [];

  for (const z of project.zones) {
    if (!z.parallaxLayers || z.parallaxLayers.length === 0) continue;

    const elevationMeters = z.elevation ?? 0;
    const origin = gridToUnrealAxis(z.gridX, z.gridY, tileSizeCm, elevationMeters);
    const widthCm = z.gridWidth * tileSizeCm;
    const depthCm = z.gridHeight * tileSizeCm;

    for (const p of z.parallaxLayers) {
      actors.push({
        ZoneId: z.id,
        LayerId: p.id,
        Depth: p.depth,
        AssetRef: p.assetRef,
        ScrollFactor: p.scrollFactor,
        SuggestedScale: { X: widthCm, Y: depthCm },
        ParentZoneOriginCm: origin,
      });
    }

    fidelity.push({
      level: 'lossless',
      domain: 'parallax',
      severity: 'info',
      entityId: z.id,
      fieldPath: `zones.${z.id}.parallaxLayers[manifest]`,
      message: `Zone "${z.id}" emitted ${z.parallaxLayers.length} parallax actor(s) into manifest.`,
      reason: 'Each ParallaxLayer → one UnrealParallaxActor anchored at zone origin.',
    });
  }

  return { manifest: { Actors: actors }, fidelity };
}
