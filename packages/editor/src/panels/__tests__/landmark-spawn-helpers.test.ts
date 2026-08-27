import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { SpawnPoint } from '@world-forge/schema';
import { LANDMARK_INTERACTIONS, applySpawnDefault, parseLandmarkTags } from '../landmark-spawn-helpers.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('landmark-spawn-helpers (F-efeb8b00)', () => {
  it('covers every Landmark interactionType', () => {
    expect(LANDMARK_INTERACTIONS).toEqual(['inspect', 'use', 'enter', 'talk', 'none']);
  });

  it('setting isDefault clears it on every other spawn', () => {
    const spawns: SpawnPoint[] = [
      { id: 'a', zoneId: 'z', gridX: 0, gridY: 0, isDefault: true },
      { id: 'b', zoneId: 'z', gridX: 1, gridY: 0, isDefault: false },
    ];
    const next = applySpawnDefault(spawns, 'b', true);
    expect(next.find((s) => s.id === 'a')?.isDefault).toBe(false);
    expect(next.find((s) => s.id === 'b')?.isDefault).toBe(true);
  });

  it('clearing isDefault only touches that spawn', () => {
    const spawns: SpawnPoint[] = [
      { id: 'a', zoneId: 'z', gridX: 0, gridY: 0, isDefault: true },
      { id: 'b', zoneId: 'z', gridX: 1, gridY: 0, isDefault: false },
    ];
    const next = applySpawnDefault(spawns, 'a', false);
    expect(next.find((s) => s.id === 'a')?.isDefault).toBe(false);
    expect(next.find((s) => s.id === 'b')?.isDefault).toBe(false);
  });

  it('parses landmark tags', () => {
    expect(parseLandmarkTags(' shrine, relic, ')).toEqual(['shrine', 'relic']);
  });
});

describe('LandmarkProperties / SpawnProperties export (F-efeb8b00)', () => {
  it('LandmarkProperties calls updateLandmark and covers interactionType + iconId', () => {
    const src = readFileSync(join(here, '../LandmarkProperties.tsx'), 'utf8');
    expect(src).toContain('export function LandmarkProperties');
    expect(src).toContain('updateLandmark');
    expect(src).toContain('interactionType');
    expect(src).toContain('iconId');
    expect(src).toContain('selection.landmarks.length === 1');
  });

  it('SpawnProperties uses applySpawnDefault via updateProject', () => {
    const src = readFileSync(join(here, '../SpawnProperties.tsx'), 'utf8');
    expect(src).toContain('export function SpawnProperties');
    expect(src).toContain('applySpawnDefault');
    expect(src).toContain('updateProject');
    expect(src).toContain('isDefault');
    expect(src).toContain('selection.spawns.length === 1');
  });
});
