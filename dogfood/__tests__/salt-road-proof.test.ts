// salt-road-proof.test.ts — F-422c6c36: Salt Road is exportable, not just Dustwalk/Chapel.

import { describe, it, expect } from 'vitest';
import { exportToEngine } from '../../packages/export-ai-rpg/src/index.js';
import { exportToUnreal } from '../../packages/export-unreal/src/index.js';
import { exportToGodot } from '../../packages/export-godot/src/index.js';
import { saltRoadProject } from '../worlds/salt-road.js';
import { scaleForSandbox } from '../worlds/sandbox-scale.js';

describe('F-422c6c36: Salt Road stage-lane world is consumable', () => {
  const project = scaleForSandbox(saltRoadProject);

  it('exports to AI RPG Engine', () => {
    const result = exportToEngine(project);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.zones.length).toBeGreaterThan(0);
    const zoneIds = new Set(result.contentPack.zones.map((z) => z.id));
    expect(zoneIds.size).toBe(result.contentPack.zones.length);
  });

  it('exports to Unreal (spawn points survive as Spawns)', () => {
    const result = exportToUnreal(project);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.Zones.length).toBeGreaterThan(0);
    expect(Array.isArray(result.contentPack.Spawns)).toBe(true);
  });

  it('exports to Godot (loadable project files)', () => {
    const result = exportToGodot(project);
    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.contentPack.files['res://scripts/world_runtime.gd']).toContain('body_entered');
    expect(result.contentPack.worldSceneTscn.length).toBeGreaterThan(0);
    expect(result.contentPack.worldSceneTscn).toContain('PointLight2D');
  });
});
