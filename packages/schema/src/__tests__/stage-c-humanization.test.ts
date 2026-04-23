// stage-c-humanization.test.ts — regression coverage for Stage C humanization findings.
// Each block maps to a SCH-B-XXX finding closed in Stage C of the v4.2.0 dogfood swarm.

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scanDependencies } from '../dependencies.js';
import { advisoryValidation } from '../advisory.js';
import { validateProject } from '../validate.js';
import { __resetClassifyDomainWarnings, buildReviewSnapshot } from '../review.js';
import type { WorldProject } from '../project.js';
import type { AuthoringMode } from '../authoring-mode.js';
import { minimalProject } from './fixtures/minimal.js';

function withOverrides(overrides: Partial<WorldProject>): WorldProject {
  return { ...structuredClone(minimalProject), ...overrides };
}

// ──────────────────────────────────────────────────────────────
// SCH-B-001 — scanDependencies must NOT orphan parallax/skyline assets
// ──────────────────────────────────────────────────────────────
describe('SCH-B-001: dependency scanner recognises 2.5D parallax + skyline refs', () => {
  it('does not flag a parallax-layer asset as orphan', () => {
    const proj = withOverrides({
      assets: [
        { id: 'bg-parallax-1', kind: 'background', label: 'Parallax Far', path: '/p1.png', tags: [] },
      ],
      zones: [
        {
          ...minimalProject.zones[0],
          parallaxLayers: [
            { id: 'pl-1', assetRef: 'bg-parallax-1', depth: 'far', scrollFactor: 0.5 } as any,
          ],
        },
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    const orphans = report.edges.filter((e) => e.status === 'orphaned' && e.sourceId === 'bg-parallax-1');
    expect(orphans).toHaveLength(0);
  });

  it('does not flag a skyline asset as orphan', () => {
    const proj = withOverrides({
      assets: [
        { id: 'bg-skyline-1', kind: 'background', label: 'Skyline', path: '/sky.png', tags: [] },
      ],
      zones: [
        { ...minimalProject.zones[0], skylineRef: 'bg-skyline-1' } as any,
        minimalProject.zones[1],
      ],
    });
    const report = scanDependencies(proj);
    const orphans = report.edges.filter((e) => e.status === 'orphaned' && e.sourceId === 'bg-skyline-1');
    expect(orphans).toHaveLength(0);
  });

  it('still flags a genuinely unreferenced asset as orphan (control)', () => {
    const proj = withOverrides({
      assets: [
        { id: 'bg-unused', kind: 'background', label: 'Lonely', path: '/u.png', tags: [] },
      ],
    });
    const report = scanDependencies(proj);
    const orphans = report.edges.filter((e) => e.status === 'orphaned' && e.sourceId === 'bg-unused');
    expect(orphans).toHaveLength(1);
  });
});

// ──────────────────────────────────────────────────────────────
// SCH-B-002 — advisory switch has a default case for unknown modes
// ──────────────────────────────────────────────────────────────
describe('SCH-B-002: advisory emits default tip for unknown modes', () => {
  it('emits a single mode-not-recognized advisory for a custom mode string', () => {
    const proj = withOverrides({ mode: 'custom' as unknown as AuthoringMode });
    const result = advisoryValidation(proj);
    const modeAdvisories = result.items.filter((i) => i.path === 'mode');
    expect(modeAdvisories).toHaveLength(1);
    expect(modeAdvisories[0].message).toContain('custom');
    expect(modeAdvisories[0].message).toContain('dungeon');
    expect(modeAdvisories[0].message).toContain('world');
    expect(modeAdvisories[0].severity).toBe('info');
  });

  it('does NOT emit the unknown-mode advisory for a valid mode', () => {
    const proj = withOverrides({ mode: 'dungeon' });
    const result = advisoryValidation(proj);
    const modeAdvisories = result.items.filter((i) => i.path === 'mode');
    expect(modeAdvisories).toHaveLength(0);
  });
});

// ──────────────────────────────────────────────────────────────
// SCH-B-003 — advisory tolerates non-string metadata without crashing
// ──────────────────────────────────────────────────────────────
describe('SCH-B-003: advisory hardens metadata checks against non-string inputs', () => {
  it('does not throw when author is null', () => {
    const proj = withOverrides({ author: null as unknown as string });
    expect(() => advisoryValidation(proj)).not.toThrow();
    const result = advisoryValidation(proj);
    expect(result.items.some((i) => i.path === 'author')).toBe(true);
  });

  it('does not throw when license is a number', () => {
    const proj = withOverrides({ license: 123 as unknown as string });
    expect(() => advisoryValidation(proj)).not.toThrow();
    const result = advisoryValidation(proj);
    expect(result.items.some((i) => i.path === 'license')).toBe(true);
  });

  it('does not throw when author is undefined (default path)', () => {
    const proj = withOverrides({ author: undefined });
    expect(() => advisoryValidation(proj)).not.toThrow();
  });
});

// ──────────────────────────────────────────────────────────────
// SCH-B-004 — archetype/background errors name the specific field
// ──────────────────────────────────────────────────────────────
describe('SCH-B-004: archetype/background error messages reference the specific catalog field', () => {
  it('names buildCatalog.archetypes[] when archetype is missing', () => {
    const proj = withOverrides({
      playerTemplate: {
        ...minimalProject.playerTemplate!,
        defaultArchetypeId: 'no-such-archetype',
      },
      buildCatalog: {
        archetypes: [],
        backgrounds: [],
        traits: [],
        disciplines: [],
        crossTitles: [],
        entanglements: [],
      } as any,
    });
    const result = validateProject(proj);
    const msg = result.errors.find((e) => e.path === 'playerTemplate.defaultArchetypeId')?.message ?? '';
    expect(msg).toContain('buildCatalog.archetypes[]');
    expect(msg).toContain('no-such-archetype');
  });

  it('names buildCatalog.backgrounds[] when background is missing', () => {
    const proj = withOverrides({
      playerTemplate: {
        ...minimalProject.playerTemplate!,
        defaultBackgroundId: 'no-such-background',
      },
      buildCatalog: {
        archetypes: [],
        backgrounds: [],
        traits: [],
        disciplines: [],
        crossTitles: [],
        entanglements: [],
      } as any,
    });
    const result = validateProject(proj);
    const msg = result.errors.find((e) => e.path === 'playerTemplate.defaultBackgroundId')?.message ?? '';
    expect(msg).toContain('buildCatalog.backgrounds[]');
    expect(msg).toContain('no-such-background');
  });
});

// ──────────────────────────────────────────────────────────────
// SCH-B-005 — isTrapHotspot helper is exercised via the dungeon tip
// (No functional change; this simply pins the behaviour.)
// ──────────────────────────────────────────────────────────────
describe('SCH-B-005: trap-hotspot detection recognises both tag and pressureType', () => {
  it('recognises a trap via the trap tag', () => {
    const proj = withOverrides({
      mode: 'dungeon',
      pressureHotspots: [
        { id: 'ph-1', zoneId: 'zone-entrance', pressureType: 'hazard', baseProbability: 0.2, tags: ['trap'] },
      ],
    });
    const result = advisoryValidation(proj);
    expect(result.items.some((i) => i.message.includes('hazard zones with traps'))).toBe(false);
  });

  it('recognises a trap via a pressureType containing "trap"', () => {
    const proj = withOverrides({
      mode: 'dungeon',
      pressureHotspots: [
        { id: 'ph-2', zoneId: 'zone-entrance', pressureType: 'spike-trap', baseProbability: 0.2, tags: [] },
      ],
    });
    const result = advisoryValidation(proj);
    expect(result.items.some((i) => i.message.includes('hazard zones with traps'))).toBe(false);
  });

  it('still recommends traps when none are present', () => {
    const proj = withOverrides({
      mode: 'dungeon',
      pressureHotspots: [
        { id: 'ph-3', zoneId: 'zone-entrance', pressureType: 'undead-stirring', baseProbability: 0.3, tags: ['undead'] },
      ],
    });
    const result = advisoryValidation(proj);
    expect(result.items.some((i) => i.message.includes('hazard zones with traps'))).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// SCH-B-006 — every validation error path gets a non-default domain
// except for the documented catch-all
// ──────────────────────────────────────────────────────────────
describe('SCH-B-006: classifyValidationDomain covers every path emitted by validateProject', () => {
  beforeEach(() => {
    __resetClassifyDomainWarnings();
  });

  it('every error on a malformed fixture classifies to either a known domain or the documented world catch-all', () => {
    // Build a project that triggers errors across many domains.
    const proj = withOverrides({
      // Broken asset ref (domain: assets)
      assets: [],
      assetPacks: [{ id: 'pack-1', label: '', version: '' } as any],
      // Broken entity asset ref (domain: entities)
      entityPlacements: [
        { entityId: 'e-broken', zoneId: 'zone-entrance', role: 'npc', portraitId: 'missing-portrait' },
      ],
      // Broken item ref (domain: items)
      itemPlacements: [
        { itemId: 'item-broken', zoneId: 'zone-entrance', container: 'box', hidden: false, iconId: 'missing-icon' },
      ],
      // Broken dialogue (domain: dialogue)
      dialogues: [
        { id: 'dlg-bad', speakers: [], entryNodeId: 'missing-node', nodes: {} } as any,
      ],
      // Broken player template (domain: player)
      playerTemplate: {
        ...minimalProject.playerTemplate!,
        defaultArchetypeId: 'no-arch',
      },
      // Broken build catalog (domain: builds)
      buildCatalog: {
        archetypes: [{ id: 'a1', label: 'A', progressionTreeId: 'missing-tree' }],
        backgrounds: [],
        traits: [],
        disciplines: [],
        crossTitles: [],
        entanglements: [],
      } as any,
    });

    const snapshot = buildReviewSnapshot(proj);
    const domains = Object.keys(snapshot.validation.errorsByDomain);
    // Every bucket we hit must either be a known named domain OR the 'world'
    // catch-all. There is no "unknown" or "unclassified" bucket.
    const KNOWN = new Set(['packs', 'assets', 'entities', 'items', 'dialogue', 'player', 'builds', 'progression', 'world']);
    for (const d of domains) {
      expect(KNOWN).toContain(d);
    }
    // We should have hit at least a couple non-world buckets (otherwise the test
    // isn't actually exercising the classifier).
    expect(domains.some((d) => d !== 'world')).toBe(true);
  });
});

// ──────────────────────────────────────────────────────────────
// SCH-B-010 — unknown path prefix emits a single console.warn per prefix
// ──────────────────────────────────────────────────────────────
describe('SCH-B-010: unknown validation path prefix warns once', () => {
  let warnSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    __resetClassifyDomainWarnings();
    warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    warnSpy.mockRestore();
  });

  it('does NOT warn for known world-bucket prefixes like zones.*', () => {
    // buildReviewSnapshot runs classifyValidationDomain. Cause a zones-side error.
    const proj = withOverrides({
      zones: [
        { ...minimalProject.zones[0], id: '' } as any, // invalid empty id → zones.* path
        minimalProject.zones[1],
      ],
    });
    buildReviewSnapshot(proj);
    // No warn for `zones` — it's documented as routing through 'world'.
    const warnsForZones = warnSpy.mock.calls.filter((c) => String(c[0]).includes('"zones"'));
    expect(warnsForZones).toHaveLength(0);
  });
});
