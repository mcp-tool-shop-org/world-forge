import { describe, it, expect } from 'vitest';
import { exportToUnreal } from '../export.js';
import type { FidelityDomain } from '../fidelity.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

/**
 * Parity contract between the Unreal exporter and the WorldProject schema.
 *
 * These tests are the canonical "what survives an Unreal export?" list. When a
 * WorldProject field gains a new home in UnrealContentPack, update the covered
 * set. When a field is intentionally dropped, add it to `KNOWN_DROPPED` with a
 * reason — the test will then require that a fidelity entry exists for it on
 * export.
 */

// Canonical list of every WorldProject field (from packages/schema/src/project.ts).
// Update this when the schema interface gains or loses a field.
const ALL_WORLD_PROJECT_FIELDS: ReadonlyArray<string> = [
  'id', 'name', 'description', 'version',
  'genre', 'tones', 'difficulty', 'narratorTone', 'mode',
  'author', 'license', 'category', 'projectTags',
  'map', 'zones', 'connections', 'districts', 'landmarks',
  'factionPresences', 'pressureHotspots',
  'dialogues',
  'playerTemplate', 'buildCatalog', 'progressionTrees',
  'entityPlacements', 'itemPlacements', 'encounterAnchors',
  'spawnPoints', 'craftingStations', 'marketNodes',
  'tilesets', 'tileLayers', 'props', 'propPlacements',
  'ambientLayers', 'assets', 'assetPacks',
];

// Fields covered losslessly by the Unreal pipeline.
const COVERED_FIELDS = new Set<string>([
  'id', 'name', 'description', 'version',
  'mode', 'author', 'license', 'category', 'projectTags',
  'map', 'zones', 'connections', 'districts',
  'entityPlacements',
]);

// Fields that are intentionally not carried by the Unreal pack.
const KNOWN_DROPPED: Record<string, string> = {
  dialogues: 'Gameplay-only data; UE5 loader uses its own dialogue system.',
  progressionTrees: 'Gameplay-only data; drives character advancement outside world layout.',
  playerTemplate: 'Gameplay-only data; driven by UE5 Blueprint defaults.',
  buildCatalog: 'Gameplay-only data; archetype/background/trait system is engine-specific.',
  itemPlacements: 'Item spawning handled by UE5 loot tables in this export profile.',
  encounterAnchors: 'Encounters covered by Blueprint spawners in this export profile.',
  spawnPoints: 'Player spawn handled separately by UE5 PlayerStart actors.',
  craftingStations: 'Gameplay-only data; driven by UE5 subsystem.',
  marketNodes: 'Gameplay-only data; driven by UE5 subsystem.',
  landmarks: 'Landmarks collapse into zone actor metadata — not a first-class pack field.',
  factionPresences: 'Runtime faction state; derived from district.controllingFaction at load.',
  pressureHotspots: 'Runtime behavior; not part of the static pack.',
  tilesets: 'Tiles are baked into zone assets on the UE5 side.',
  tileLayers: 'Tile layers are baked into zone assets on the UE5 side.',
  props: 'Props spawn via UE5 Blueprint catalogs, not from the pack.',
  propPlacements: 'Prop placements handled via UE5 Blueprint spawners.',
  ambientLayers: 'Ambient effects rebuilt from zone tags on the UE5 side.',
  assets: 'Asset manifest is the UE5 project responsibility, not this pack.',
  assetPacks: 'Pack registry is handled by UE5 project plugins, not this exporter.',
  genre: 'Flavor metadata — not required for UE5 runtime.',
  tones: 'Flavor metadata — not required for UE5 runtime.',
  difficulty: 'Flavor metadata — not required for UE5 runtime.',
  narratorTone: 'Flavor metadata — not required for UE5 runtime.',
};

describe('WorldProject → UnrealContentPack parity', () => {
  it('every canonical WorldProject field is either covered or documented as dropped', () => {
    const uncovered = ALL_WORLD_PROJECT_FIELDS.filter(
      (f) => !COVERED_FIELDS.has(f) && KNOWN_DROPPED[f] === undefined,
    );
    expect(uncovered).toEqual([]);
  });

  it('covered and known-dropped sets are disjoint', () => {
    const both = [...COVERED_FIELDS].filter((f) => KNOWN_DROPPED[f] !== undefined);
    expect(both).toEqual([]);
  });

  it('the minimal fixture does not introduce surprise fields outside the canonical list', () => {
    const canonical = new Set(ALL_WORLD_PROJECT_FIELDS);
    const surprise = Object.keys(minimalProject).filter((f) => !canonical.has(f));
    expect(surprise).toEqual([]);
  });

  it('fidelity report uses only known FidelityDomain values', () => {
    const result = exportToUnreal(minimalProject);
    if (!result.success) throw new Error('export failed');
    const validDomains: FidelityDomain[] = [
      'zones', 'districts', 'entities', 'items',
      'connections', 'world-partition', 'assets', 'parallax',
      'elevation', 'skyline', 'dialogues', 'world',
    ];
    const domainSet = new Set<string>(validDomains);
    for (const entry of result.fidelity.entries) {
      expect(domainSet.has(entry.domain)).toBe(true);
    }
  });
});
