import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { findHitAt, encodeTileHitId } from '../hit-testing.js';
import { createEmptyProject } from '../store/project-store.js';
import type { ViewportState } from '../viewport.js';
import type { WorldProject } from '@world-forge/schema';

const src = (rel: string) => readFileSync(join(dirname(fileURLToPath(import.meta.url)), rel), 'utf8');

describe('F-420be5bb / F-68fed5fc inspector bindings', () => {
  it('ZoneProperties authors noise and exits', () => {
    const text = src('../panels/ZoneProperties.tsx');
    expect(text).toContain('wf-zone-noise');
    expect(text).toContain('wf-zone-add-exit');
  });

  it('HazardLibraryPanel authors tags/weather/immune and damage extras', () => {
    const text = src('../panels/HazardLibraryPanel.tsx');
    expect(text).toContain('wf-hazard-tags');
    expect(text).toContain('durationTicks');
    expect(text).toContain('amountIsPercentMaxHp');
    expect(text).toContain('weatherConditions');
  });

  it('StrataPanel authors tags, visibleStrata, and link zone anchors', () => {
    const text = src('../panels/StrataPanel.tsx');
    expect(text).toContain('visibleStrata');
    expect(text).toContain('fromZoneId');
    expect(text).toContain('toZoneId');
  });

  it('DialogueNodeEditor authors conditions and effects', () => {
    const text = src('../panels/DialoguePanel.tsx');
    expect(text).toContain('wf-choice-condition');
    expect(text).toContain('wf-add-dialogue-effect');
  });

  it('BuildCatalog authors archetype/background/discipline extras', () => {
    const text = src('../panels/BuildCatalogPanel.tsx');
    expect(text).toContain('wf-arch-stat-priorities');
    expect(text).toContain('wf-arch-starting-inventory');
    expect(text).toContain('wf-bg-stat-modifiers');
    expect(text).toContain('wf-bg-faction-modifiers');
    expect(text).toContain('wf-disc-passive');
    expect(text).toContain('wf-disc-drawback');
  });

  it('PropPalette expands definition fields', () => {
    const text = src('../panels/PropPalette.tsx');
    expect(text).toContain('wf-prop-width');
    expect(text).toContain('wf-prop-walkable');
    expect(text).toContain('updateProp');
  });

  it('AssetPanel authors provenance source/author/license', () => {
    const text = src('../panels/AssetPanel.tsx');
    expect(text).toContain('wf-asset-provenance-source');
    expect(text).toContain('wf-asset-provenance-author');
    expect(text).toContain('wf-asset-provenance-license');
  });
});

describe('F-8801ff28 prop hit-test', () => {
  it('hits a prop placement independently of its zone', () => {
    const project: WorldProject = {
      ...createEmptyProject(),
      zones: [{
        id: 'z1', name: 'z1', description: '', tags: [],
        gridX: 0, gridY: 0, gridWidth: 8, gridHeight: 8,
        neighbors: [], exits: [], light: 5, noise: 0, hazards: [], interactables: [],
      }],
      props: [{ id: 'crate', name: 'Crate', width: 1, height: 1, tags: [], walkable: false, interactable: false }],
      propPlacements: [{ id: 'p1', propId: 'crate', gridX: 2, gridY: 2, zoneId: 'z1' }],
    };
    const vp: ViewportState = { panX: 0, panY: 0, zoom: 1 };
    const vis = { showEntities: true, showLandmarks: true, showSpawns: true, showConnections: false, showTown: false, showItems: false, showProps: true };
    const hit = findHitAt(2 * 32 + 8, 2 * 32 + 8, vp, project, 32, vis);
    expect(hit).toEqual({ type: 'prop', id: 'p1' });
  });

  it('hits a painted tile cell independently of its zone', () => {
    const project: WorldProject = {
      ...createEmptyProject(),
      zones: [{
        id: 'z1', name: 'z1', description: '', tags: [],
        gridX: 0, gridY: 0, gridWidth: 8, gridHeight: 8,
        neighbors: [], exits: [], light: 5, noise: 0, hazards: [], interactables: [],
      }],
      tileLayers: [{
        id: 'layer-1', name: 'Ground', zIndex: 0,
        tiles: [{ tileId: 'floor', gridX: 3, gridY: 1 }],
      }],
    };
    const vp: ViewportState = { panX: 0, panY: 0, zoom: 1 };
    const vis = { showEntities: true, showLandmarks: true, showSpawns: true, showConnections: false, showTown: false, showItems: false, showProps: true, showTiles: true };
    const hit = findHitAt(3 * 32 + 8, 1 * 32 + 8, vp, project, 32, vis);
    expect(hit).toEqual({ type: 'tile', id: encodeTileHitId('layer-1', 3, 1) });
  });
});
