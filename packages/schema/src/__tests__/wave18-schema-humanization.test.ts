// wave18-schema-humanization.test.ts — Stage C HUMANIZATION (swarm wave 18).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { validateProject, VALID_CONNECTION_KINDS, VALID_ASSET_KINDS } from '../validate.js';
import { buildReviewSnapshot } from '../review.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';

function clone(overrides: Partial<WorldProject> = {}): WorldProject {
  return { ...structuredClone(minimalProject), ...overrides };
}

describe('F-3013724d: connection errors name index, pair, and expected kinds', () => {
  it('emits connections[<i>] and names from/to/label for a missing toZoneId', () => {
    const proj = clone({
      connections: [
        { fromZoneId: 'zone-entrance', toZoneId: 'zone-ghost', label: 'trapdoor', bidirectional: true },
      ],
    });
    const result = validateProject(proj);
    const err = result.errors.find((e) => e.message.includes('zone-ghost'));
    expect(err).toBeDefined();
    expect(err!.path).toBe('connections[0]');
    expect(err!.message).toContain('Connection from "zone-entrance" to "zone-ghost"');
    expect(err!.message).toContain('label "trapdoor"');
    expect(err!.message).toContain('toZoneId');
  });

  it('lists VALID_CONNECTION_KINDS on unsupported kind', () => {
    const proj = clone({
      connections: [
        { fromZoneId: 'zone-entrance', toZoneId: 'zone-cellar', bidirectional: true, kind: 'teleporter' as never },
      ],
    });
    const result = validateProject(proj);
    const err = result.errors.find((e) => e.message.includes('teleporter'));
    expect(err).toBeDefined();
    expect(err!.path).toBe('connections[0]');
    expect(err!.message).toContain('expected one of:');
    for (const kind of VALID_CONNECTION_KINDS) {
      expect(err!.message).toContain(kind);
    }
  });

  it('wraps spawn-condition failures as Connection from "a" to "b"', () => {
    const proj = clone({
      connections: [
        { fromZoneId: 'zone-entrance', toZoneId: 'zone-cellar', label: 'trapdoor', bidirectional: true, condition: 'nonsense:foo' },
      ],
    });
    const result = validateProject(proj);
    const err = result.errors.find((e) => e.message.includes('nonsense:foo'));
    expect(err).toBeDefined();
    expect(err!.path).toBe('connections[0]');
    expect(err!.message).toMatch(/^Connection from "zone-entrance" to "zone-cellar"/);
  });
});

describe('F-9ab6c3d5: closed-union expected lists and non-empty-string copy', () => {
  it('lists VALID_ASSET_KINDS on unsupported asset kind', () => {
    const proj = clone({
      assets: [{ id: 'a1', kind: 'foo' as never, label: 'Bad', path: 'a.png', tags: [] }],
    });
    const result = validateProject(proj);
    const err = result.errors.find((e) => e.path === 'assets.a1.kind');
    expect(err).toBeDefined();
    expect(err!.message).toContain('unsupported kind "foo"');
    expect(err!.message).toContain('expected one of:');
    for (const kind of VALID_ASSET_KINDS) {
      expect(err!.message).toContain(kind);
    }
  });

  it('lists hazard effect kinds on unsupported effect kind', () => {
    const proj = clone({
      hazardDefinitions: [
        { id: 'lava', name: 'Lava', effects: [{ kind: 'explode' as never, amount: 1 }], trigger: 'on-enter', tags: [] },
      ],
    });
    const result = validateProject(proj);
    const err = result.errors.find((e) => e.message.includes('explode'));
    expect(err).toBeDefined();
    expect(err!.message).toContain('expected one of:');
    expect(err!.message).toContain('damage');
    expect(err!.message).toContain('status');
    expect(err!.message).toContain('ignite');
    expect(err!.message).toContain('instakill');
  });

  it('keeps empty-string copy for blank asset.path / pack label / pack version', () => {
    const proj = clone({
      assets: [{ id: 'empty-path', kind: 'icon', label: 'Bad', path: '', tags: [], packId: 'pack-1' }],
      assetPacks: [{ id: 'pack-1', label: '', version: '', tags: [] }],
      itemPlacements: minimalProject.itemPlacements.map((i) => ({ ...i, iconId: 'empty-path' })),
    });
    const result = validateProject(proj);
    expect(result.errors.some((e) => e.message.includes('has empty path'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('has empty label'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('has empty version'))).toBe(true);
  });

  it('says must be a non-empty string (got typeof) for non-string path/label/version', () => {
    const proj = clone({
      assets: [{ id: 'num-path', kind: 'icon', label: 'Bad', path: 123 as unknown as string, tags: [], packId: 'pack-1' }],
      assetPacks: [{ id: 'pack-1', label: { x: 1 } as unknown as string, version: 1 as unknown as string, tags: [] }],
      itemPlacements: minimalProject.itemPlacements.map((i) => ({ ...i, iconId: 'num-path' })),
    });
    const result = validateProject(proj);
    expect(result.errors.some((e) => e.message.includes('path must be a non-empty string (got number)'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('label must be a non-empty string (got object)'))).toBe(true);
    expect(result.errors.some((e) => e.message.includes('version must be a non-empty string (got number)'))).toBe(true);
  });
});

describe('F-a2497560: advisory firstSuggestions keep path', () => {
  it('maps AdvisoryItem.path onto firstSuggestions (capped at 5)', () => {
    const snap = buildReviewSnapshot(minimalProject);
    expect(snap.advisory.firstSuggestions.length).toBeGreaterThan(0);
    expect(snap.advisory.firstSuggestions.length).toBeLessThanOrEqual(5);
    for (const s of snap.advisory.firstSuggestions) {
      expect(typeof s.path).toBe('string');
      expect(s.path.length).toBeGreaterThan(0);
      expect(typeof s.message).toBe('string');
      expect(s.message.length).toBeGreaterThan(0);
    }
  });
});

describe('F-b3e85e15: player-template inventory and spawn copy', () => {
  it('indexes startingInventory and names the allowed source plus alternatives', () => {
    const proj = clone({
      playerTemplate: { ...minimalProject.playerTemplate!, startingInventory: ['ghost-item'] },
    });
    const result = validateProject(proj);
    const err = result.errors.find((e) => e.message.includes('ghost-item'));
    expect(err).toBeDefined();
    expect(err!.path).toBe('playerTemplate.startingInventory[0]');
    expect(err!.message).toContain('itemPlacements[]');
    expect(err!.message).toMatch(/Add a placement|pick an existing/i);
  });

  it('says spawnPointId is empty — pick an id from spawnPoints[]', () => {
    const proj = clone({
      playerTemplate: { ...minimalProject.playerTemplate!, spawnPointId: '' },
    });
    const result = validateProject(proj);
    const err = result.errors.find((e) => e.path === 'playerTemplate.spawnPointId');
    expect(err).toBeDefined();
    expect(err!.message).toContain('spawnPointId is empty');
    expect(err!.message).toContain('spawnPoints[]');
  });
});

describe('F-78ad82a9: translated READMEs match English type map', () => {
  const dir = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
  const files = [
    'README.ja.md',
    'README.zh.md',
    'README.es.md',
    'README.fr.md',
    'README.hi.md',
    'README.it.md',
    'README.pt-BR.md',
  ];

  it.each(files)('%s drops frozen 54/78/89 counts and lists Town + World modeling types', (file) => {
    const body = readFileSync(join(dir, file), 'utf8');
    expect(body).not.toMatch(/54\s*(structural|structure|構造|结构性|estructural|structurelles|संरचनात्मक|strutturali|estruturais)/i);
    expect(body).toContain('src/validate.ts');
    expect(body).toContain('Building');
    expect(body).toContain('Hub');
    expect(body).toContain('Stronghold');
    expect(body).toContain('Stratum');
    expect(body).toContain('StratumLink');
    expect(body).toContain('HazardDefinition');
    expect(body).toContain('ZoneEntryGate');
  });
});
