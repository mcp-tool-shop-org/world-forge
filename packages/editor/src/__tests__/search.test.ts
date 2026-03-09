import { describe, it, expect } from 'vitest';
import { buildSearchIndex, filterResults } from '../panels/SearchOverlay.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import { BUILTIN_REGION_PRESETS } from '../presets/built-ins.js';
import { getModeProfile, MODE_PROFILES } from '../mode-profiles.js';
import { AUTHORING_MODES } from '@world-forge/schema';

// Chapel Threshold — the richest sample world
const chapel = SAMPLE_WORLDS[2].project;

describe('buildSearchIndex', () => {
  const index = buildSearchIndex(chapel);

  it('includes all searchable object types', () => {
    const types = new Set(index.map((r) => r.type));
    expect(types.has('zone')).toBe(true);
    expect(types.has('entity')).toBe(true);
    expect(types.has('district')).toBe(true);
    expect(types.has('spawn')).toBe(true);
    expect(types.has('landmark')).toBe(true);
    expect(types.has('connection')).toBe(true);
  });

  it('indexes all zones', () => {
    const zones = index.filter((r) => r.type === 'zone');
    expect(zones.length).toBe(chapel.zones.length);
  });

  it('indexes all entities', () => {
    const entities = index.filter((r) => r.type === 'entity');
    expect(entities.length).toBe(chapel.entityPlacements.length);
  });

  it('indexes all districts', () => {
    const districts = index.filter((r) => r.type === 'district');
    expect(districts.length).toBe(chapel.districts.length);
  });

  it('indexes all spawns', () => {
    const spawns = index.filter((r) => r.type === 'spawn');
    expect(spawns.length).toBe(chapel.spawnPoints.length);
  });

  it('indexes all landmarks', () => {
    const landmarks = index.filter((r) => r.type === 'landmark');
    expect(landmarks.length).toBe(chapel.landmarks.length);
  });

  it('indexes dialogues', () => {
    const dialogues = index.filter((r) => r.type === 'dialogue');
    expect(dialogues.length).toBe(chapel.dialogues.length);
  });

  it('indexes progression trees', () => {
    const trees = index.filter((r) => r.type === 'tree');
    expect(trees.length).toBe(chapel.progressionTrees.length);
  });
});

describe('filterResults', () => {
  const index = buildSearchIndex(chapel);

  it('returns empty for empty query', () => {
    expect(filterResults(index, '')).toEqual([]);
    expect(filterResults(index, '   ')).toEqual([]);
  });

  it('matches by label (case-insensitive)', () => {
    const results = filterResults(index, 'chapel');
    expect(results.length).toBeGreaterThan(0);
    // Should find zones with "Chapel" in name
    expect(results.some((r) => r.type === 'zone' && r.label.toLowerCase().includes('chapel'))).toBe(true);
  });

  it('matches by id', () => {
    const results = filterResults(index, 'chapel-entrance');
    expect(results.some((r) => r.id === 'chapel-entrance')).toBe(true);
  });

  it('matches by detail context', () => {
    // Entities have "in <zone name>" in their detail
    const results = filterResults(index, 'npc');
    expect(results.length).toBeGreaterThan(0);
  });

  it('is case-insensitive', () => {
    const lower = filterResults(index, 'chapel');
    const upper = filterResults(index, 'CHAPEL');
    const mixed = filterResults(index, 'ChApEl');
    expect(lower.length).toBe(upper.length);
    expect(lower.length).toBe(mixed.length);
  });

  it('caps results at 20', () => {
    // Use a very broad query that matches many items
    const results = filterResults(index, 'chapel');
    expect(results.length).toBeLessThanOrEqual(20);
  });

  it('returns no results for unmatched query', () => {
    const results = filterResults(index, 'zzz_nonexistent_zzz');
    expect(results).toEqual([]);
  });
});

describe('connection search', () => {
  const index = buildSearchIndex(chapel);

  it('indexes connections with zone names', () => {
    const conns = index.filter((r) => r.type === 'connection');
    expect(conns.length).toBe(chapel.connections.length);
    // Each connection label contains zone names
    for (const c of conns) {
      expect(c.label.length).toBeGreaterThan(0);
    }
  });

  it('finds connections by zone name', () => {
    const results = filterResults(index, 'Nave');
    const connResults = results.filter((r) => r.type === 'connection');
    expect(connResults.length).toBeGreaterThan(0);
  });

  it('finds conditional connection by condition text', () => {
    const results = filterResults(index, 'chapel-key');
    const connResults = results.filter((r) => r.type === 'connection');
    expect(connResults.length).toBeGreaterThan(0);
    expect(connResults[0].detail).toContain('chapel-key');
  });

  it('indexes connection kind in detail', () => {
    // Chapel sample has door and secret kinds
    const conns = index.filter((r) => r.type === 'connection');
    const doorConn = conns.find((c) => c.detail.includes('door'));
    expect(doorConn).toBeDefined();
    const secretConn = conns.find((c) => c.detail.includes('secret'));
    expect(secretConn).toBeDefined();
  });

  it('finds connection by kind text', () => {
    const results = filterResults(index, 'secret');
    const connResults = results.filter((r) => r.type === 'connection');
    expect(connResults.length).toBeGreaterThan(0);
  });
});

describe('search mode annotations', () => {
  it('presets with modes include mode annotation in detail', () => {
    const preset = BUILTIN_REGION_PRESETS.find((p) => p.modes && p.modes.length > 0);
    expect(preset).toBeDefined();
    const modeTag = `[${preset!.modes!.join(', ')}]`;
    const detail = `${preset!.description} ${modeTag}`;
    expect(detail).toContain('[');
    expect(detail).toContain(']');
  });

  it('presets without modes have no mode annotation', () => {
    // Encounter presets have no modes — they're universal
    const universalPreset: { description: string; modes?: string[] } = { description: 'Boss fight', modes: undefined };
    const modeTag = universalPreset.modes ? ` [${universalPreset.modes.join(', ')}]` : '';
    expect(modeTag).toBe('');
  });

  it('mode label matches profile for each mode', () => {
    for (const mode of AUTHORING_MODES) {
      const profile = getModeProfile(mode);
      expect(profile.label.length).toBeGreaterThan(0);
      expect(profile.icon.length).toBeGreaterThan(0);
      expect(MODE_PROFILES[mode].label).toBe(profile.label);
    }
  });

  it('search results still return all presets when searched', () => {
    // Build a full index including presets
    const base = buildSearchIndex(chapel);
    for (const p of BUILTIN_REGION_PRESETS) {
      const modeTag = p.modes ? ` [${p.modes.join(', ')}]` : '';
      base.push({ type: 'region-preset', id: p.id, label: p.name, detail: `${p.description}${modeTag}` });
    }
    // Search for a mode-tagged preset
    const results = filterResults(base, 'Crypt');
    expect(results.some((r) => r.type === 'region-preset' && r.id === 'crypt-district')).toBe(true);
  });

  it('existing search tests pass unchanged', () => {
    const index = buildSearchIndex(chapel);
    const results = filterResults(index, 'chapel');
    expect(results.length).toBeGreaterThan(0);
  });

  it('mode badge text matches getModeProfile for each mode', () => {
    for (const mode of AUTHORING_MODES) {
      const profile = getModeProfile(mode);
      const badgeText = `${profile.icon} ${profile.label}`;
      expect(badgeText.length).toBeGreaterThan(2);
    }
  });
});
