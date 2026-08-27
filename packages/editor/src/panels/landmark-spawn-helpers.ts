// landmark-spawn-helpers.ts — pure helpers for LandmarkProperties / SpawnProperties.

import type { Landmark, SpawnPoint } from '@world-forge/schema';

export const LANDMARK_INTERACTIONS: Landmark['interactionType'][] = ['inspect', 'use', 'enter', 'talk', 'none'];

/** Mark `id` as the sole default spawn, or clear isDefault on that spawn only. */
export function applySpawnDefault(spawns: SpawnPoint[], id: string, isDefault: boolean): SpawnPoint[] {
  if (!isDefault) {
    return spawns.map((s) => s.id === id ? { ...s, isDefault: false } : s);
  }
  return spawns.map((s) => ({ ...s, isDefault: s.id === id }));
}

export function parseLandmarkTags(s: string): string[] {
  return s.split(',').map((t) => t.trim()).filter(Boolean);
}
