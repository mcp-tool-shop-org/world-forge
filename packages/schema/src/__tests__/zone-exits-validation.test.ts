// zone-exits-validation.test.ts — F-007: Zone.exits[] and ZoneConnection.condition
// received ZERO validation despite being structurally identical to fields that
// ARE checked (ZoneConnection.toZoneId / EntityPlacement.spawnCondition).

import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';

describe('Zone.exits validation (F-007)', () => {
  it('rejects an exit targeting a nonexistent zone', () => {
    const bad: WorldProject = {
      ...minimalProject,
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, exits: [{ targetZoneId: 'zone-does-not-exist', label: 'ghost door' }] } : z,
      ),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) =>
      e.path.includes('exits') && e.message.includes('zone-does-not-exist'),
    )).toBe(true);
  });

  it('rejects an exit with a malformed condition string', () => {
    const bad: WorldProject = {
      ...minimalProject,
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, exits: [{ targetZoneId: 'zone-cellar', label: 'locked door', condition: 'nonsense:foo' }] } : z,
      ),
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) =>
      e.path.includes('exits') && e.message.includes('nonsense:foo'),
    )).toBe(true);
  });

  it('accepts a well-formed exit with a legal condition (control)', () => {
    const good: WorldProject = {
      ...minimalProject,
      zones: minimalProject.zones.map((z, i) =>
        i === 0 ? { ...z, exits: [{ targetZoneId: 'zone-cellar', label: 'locked door', condition: 'item:iron-key' }] } : z,
      ),
    };
    const result = validateProject(good);
    expect(result.errors.filter((e) => e.path.includes('exits'))).toEqual([]);
    expect(result.valid).toBe(true);
  });

  it('accepts the unmodified minimal fixture exits (backward-compat control)', () => {
    const result = validateProject(minimalProject);
    expect(result.errors.filter((e) => e.path.includes('exits'))).toEqual([]);
  });
});

describe('ZoneConnection.condition validation (F-007)', () => {
  it('rejects a connection with a malformed condition string', () => {
    const bad: WorldProject = {
      ...minimalProject,
      connections: [{ ...minimalProject.connections[0], condition: 'nonsense:foo' }],
    };
    const result = validateProject(bad);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) =>
      e.path.startsWith('connections[') && e.message.includes('nonsense:foo'),
    )).toBe(true);
  });

  it('accepts a connection with a legal condition (control)', () => {
    const good: WorldProject = {
      ...minimalProject,
      connections: [{ ...minimalProject.connections[0], condition: 'flag:door-unlocked' }],
    };
    const result = validateProject(good);
    expect(result.valid).toBe(true);
  });
});
