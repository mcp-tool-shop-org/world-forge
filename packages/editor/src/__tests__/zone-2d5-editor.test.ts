// zone-2d5-editor.test.ts — coverage for ED-FT-001 / ED-FT-003 / ED-FT-004 / ED-FT-005
//
// These tests exercise the pure helpers (zone-2d5-helpers.ts), the zustand
// store wiring (parallax layer CRUD, elevation round-trip, batch set, speed
// panel set-elevation action), and the toggleElevation layer persistence.
// We deliberately avoid JSDOM to keep the swarm's test matrix fast — the
// rendering concerns are deferred to the renderer agent.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { Zone, ParallaxLayer, AssetEntry } from '@world-forge/schema';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import {
  validateElevationRange,
  parseElevation,
  nextLayerId,
  nextLayerDepth,
  createDefaultLayer,
  filterParallaxAssets,
  filterSkylineAssets,
  sortLayersForPreview,
  isLayerIdUnique,
} from '../panels/zone-2d5-helpers.js';
import { executeAction, type ExecuteStores } from '../speed-panel-execute.js';
import type { HitResult } from '../hit-testing.js';

function makeZone(id: string): Zone {
  return {
    id, name: id, description: '', tags: [],
    gridX: 0, gridY: 0, gridWidth: 4, gridHeight: 4,
    neighbors: [], exits: [],
    light: 1, noise: 0, hazards: [], interactables: [],
  };
}

function makeAsset(id: string, kind: AssetEntry['kind']): AssetEntry {
  return { id, kind, label: id, path: `/assets/${id}.png`, tags: [] };
}

// ── Pure helpers ────────────────────────────────────────────────

describe('ED-FT-001: validateElevationRange', () => {
  it('returns null when both sides unset', () => {
    expect(validateElevationRange(undefined, undefined)).toBeNull();
  });

  it('returns null during partial edits (one side set)', () => {
    expect(validateElevationRange(5, undefined)).toBeNull();
    expect(validateElevationRange(undefined, 10)).toBeNull();
  });

  it('returns null when floor < ceiling', () => {
    expect(validateElevationRange(0, 10)).toBeNull();
    expect(validateElevationRange(-5, 0)).toBeNull();
  });

  it('rejects floor >= ceiling', () => {
    const err = validateElevationRange(10, 5);
    expect(err).not.toBeNull();
    expect(err!.kind).toBe('floor-not-less-than-ceiling');
    expect(err!.message).toMatch(/floor must be less than ceiling/);
  });

  it('rejects equal floor and ceiling', () => {
    const err = validateElevationRange(3, 3);
    expect(err).not.toBeNull();
    expect(err!.kind).toBe('floor-not-less-than-ceiling');
  });

  it('rejects non-finite values', () => {
    const err = validateElevationRange(NaN, 10);
    expect(err).not.toBeNull();
    expect(err!.kind).toBe('not-finite');
  });
});

describe('ED-FT-001: parseElevation', () => {
  it('returns undefined for empty input', () => {
    expect(parseElevation('')).toBeUndefined();
    expect(parseElevation('   ')).toBeUndefined();
  });

  it('returns undefined for non-finite', () => {
    expect(parseElevation('foo')).toBeUndefined();
    expect(parseElevation('Infinity')).toBeUndefined();
  });

  it('parses valid numbers', () => {
    expect(parseElevation('5')).toBe(5);
    expect(parseElevation('-12.5')).toBe(-12.5);
    expect(parseElevation(' 8 ')).toBe(8);
  });
});

describe('ED-FT-001: layer helpers', () => {
  it('nextLayerId starts at layer-1 when empty', () => {
    expect(nextLayerId([])).toBe('layer-1');
  });

  it('nextLayerId skips taken ids', () => {
    const layers: ParallaxLayer[] = [
      { id: 'layer-1', depth: 0, assetRef: '', scrollFactor: 0.5 },
      { id: 'layer-3', depth: 10, assetRef: '', scrollFactor: 0.5 },
    ];
    expect(nextLayerId(layers)).toBe('layer-2');
  });

  it('nextLayerDepth returns max + 10', () => {
    expect(nextLayerDepth([])).toBe(0);
    expect(nextLayerDepth([
      { id: 'a', depth: 0, assetRef: '', scrollFactor: 0.5 },
      { id: 'b', depth: 25, assetRef: '', scrollFactor: 0.5 },
    ])).toBe(35);
  });

  it('createDefaultLayer uses sensible defaults', () => {
    const layer = createDefaultLayer([]);
    expect(layer.id).toBe('layer-1');
    expect(layer.depth).toBe(0);
    expect(layer.assetRef).toBe('');
    expect(layer.scrollFactor).toBe(0.5);
  });

  it('isLayerIdUnique ignores the row being edited', () => {
    const layers: ParallaxLayer[] = [
      { id: 'a', depth: 0, assetRef: '', scrollFactor: 0.5 },
      { id: 'b', depth: 10, assetRef: '', scrollFactor: 0.5 },
    ];
    expect(isLayerIdUnique(layers, 'a', 0)).toBe(true);
    expect(isLayerIdUnique(layers, 'b', 0)).toBe(false);
    expect(isLayerIdUnique(layers, '', 0)).toBe(false);
  });
});

describe('ED-FT-001: asset filters', () => {
  const assets: AssetEntry[] = [
    makeAsset('bg-1', 'background'),
    makeAsset('bg-2', 'background'),
    makeAsset('sprite-1', 'sprite'),
    makeAsset('portrait-1', 'portrait'),
    makeAsset('tileset-1', 'tileset'),
    makeAsset('icon-1', 'icon'),
  ];

  it('filterParallaxAssets keeps background and sprite only', () => {
    const filtered = filterParallaxAssets(assets);
    expect(filtered.map((a) => a.id).sort()).toEqual(['bg-1', 'bg-2', 'sprite-1']);
  });

  it('filterSkylineAssets keeps background only', () => {
    const filtered = filterSkylineAssets(assets);
    expect(filtered.map((a) => a.id).sort()).toEqual(['bg-1', 'bg-2']);
  });
});

describe('ED-FT-004: sortLayersForPreview (depth desc)', () => {
  it('sorts furthest first', () => {
    const layers: ParallaxLayer[] = [
      { id: 'near', depth: 10, assetRef: '', scrollFactor: 0.5 },
      { id: 'far',  depth: 100, assetRef: '', scrollFactor: 0.5 },
      { id: 'mid',  depth: 50, assetRef: '', scrollFactor: 0.5 },
    ];
    const sorted = sortLayersForPreview(layers);
    expect(sorted.map((l) => l.id)).toEqual(['far', 'mid', 'near']);
  });

  it('does not mutate the input', () => {
    const layers: ParallaxLayer[] = [
      { id: 'a', depth: 10, assetRef: '', scrollFactor: 0.5 },
      { id: 'b', depth: 5, assetRef: '', scrollFactor: 0.5 },
    ];
    const copy = [...layers];
    sortLayersForPreview(layers);
    expect(layers).toEqual(copy);
  });

  it('editing a layer depth re-sorts the preview', () => {
    const layers: ParallaxLayer[] = [
      { id: 'x', depth: 10, assetRef: '', scrollFactor: 0.5 },
      { id: 'y', depth: 20, assetRef: '', scrollFactor: 0.5 },
    ];
    // Furthest first → y (depth 20) comes before x (depth 10).
    expect(sortLayersForPreview(layers).map((l) => l.id)).toEqual(['y', 'x']);
    // After raising x's depth above y, x should come first.
    layers[0] = { ...layers[0], depth: 50 };
    expect(sortLayersForPreview(layers).map((l) => l.id)).toEqual(['x', 'y']);
  });
});

// ── Store round-trip ────────────────────────────────────────────

describe('ED-FT-001: zustand round-trip via updateZone', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: { ...createEmptyProject(), zones: [makeZone('z1')] },
      dirty: false, undoStack: [], redoStack: [],
    });
  });

  it('clearing elevation yields undefined on the zone', () => {
    useProjectStore.getState().updateZone('z1', { elevation: 5 });
    expect(useProjectStore.getState().project.zones[0].elevation).toBe(5);
    useProjectStore.getState().updateZone('z1', { elevation: undefined });
    expect(useProjectStore.getState().project.zones[0].elevation).toBeUndefined();
  });

  it('valid elevation round-trips exactly', () => {
    useProjectStore.getState().updateZone('z1', { elevation: -12.5 });
    expect(useProjectStore.getState().project.zones[0].elevation).toBe(-12.5);
  });

  it('parallax add + update + remove', () => {
    const first = createDefaultLayer([]);
    useProjectStore.getState().updateZone('z1', { parallaxLayers: [first] });
    expect(useProjectStore.getState().project.zones[0].parallaxLayers).toHaveLength(1);

    // Edit depth
    useProjectStore.getState().updateZone('z1', {
      parallaxLayers: [{ ...first, depth: 42 }],
    });
    expect(useProjectStore.getState().project.zones[0].parallaxLayers![0].depth).toBe(42);

    // Add a second — auto id/depth should not collide with the existing row.
    const existing = useProjectStore.getState().project.zones[0].parallaxLayers!;
    const second = createDefaultLayer(existing);
    expect(second.id).toBe('layer-2');
    expect(second.depth).toBe(52); // 42 + 10
    useProjectStore.getState().updateZone('z1', {
      parallaxLayers: [...existing, second],
    });
    expect(useProjectStore.getState().project.zones[0].parallaxLayers).toHaveLength(2);

    // Remove the first — only the new one survives.
    const surviving = useProjectStore.getState().project.zones[0].parallaxLayers!.filter((l) => l.id !== 'layer-1');
    useProjectStore.getState().updateZone('z1', { parallaxLayers: surviving });
    expect(useProjectStore.getState().project.zones[0].parallaxLayers).toHaveLength(1);
    expect(useProjectStore.getState().project.zones[0].parallaxLayers![0].id).toBe('layer-2');
  });

  it('elevationRange floor>=ceiling is still written to schema but flagged by validator', () => {
    // The editor allows writing an invalid range so the user can keep typing;
    // the inline error comes from validateElevationRange, not the store.
    useProjectStore.getState().updateZone('z1', {
      elevationRange: { floor: 10, ceiling: 5 },
    });
    const range = useProjectStore.getState().project.zones[0].elevationRange;
    expect(range).toEqual({ floor: 10, ceiling: 5 });
    const err = validateElevationRange(range!.floor, range!.ceiling);
    expect(err).not.toBeNull();
  });
});

// ── ED-FT-005: batch + speed panel ────────────────────────────────

describe('ED-FT-005: multi-zone batch elevation', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: {
        ...createEmptyProject(),
        zones: [makeZone('z1'), makeZone('z2'), makeZone('z3')],
      },
      dirty: false, undoStack: [], redoStack: [],
    });
  });

  it('atomic patch across selected zones produces a single undo entry', () => {
    const selected = ['z1', 'z3'];
    useProjectStore.getState().updateProject((p) => ({
      ...p,
      zones: p.zones.map((z) =>
        selected.includes(z.id) ? { ...z, elevation: 7 } : z,
      ),
    }), 'Set elevation on 2 zones');

    const { project, undoStack } = useProjectStore.getState();
    expect(project.zones.find((z) => z.id === 'z1')!.elevation).toBe(7);
    expect(project.zones.find((z) => z.id === 'z2')!.elevation).toBeUndefined();
    expect(project.zones.find((z) => z.id === 'z3')!.elevation).toBe(7);
    expect(undoStack[undoStack.length - 1].label).toBe('Set elevation on 2 zones');

    // Single undo reverts the whole batch.
    useProjectStore.getState().undo();
    const post = useProjectStore.getState().project;
    expect(post.zones.every((z) => z.elevation == null)).toBe(true);
  });
});

describe('ED-FT-005: Speed Panel set-elevation action', () => {
  beforeEach(() => {
    useProjectStore.setState({
      project: { ...createEmptyProject(), zones: [makeZone('z1')] },
      dirty: false, undoStack: [], redoStack: [],
    });
  });

  function buildStores(promptReply: string | null): ExecuteStores {
    const s = useProjectStore.getState();
    return {
      selectZone: () => {}, selectEntity: () => {}, selectLandmark: () => {},
      selectSpawn: () => {}, selectEncounter: () => {}, selectConnection: () => {},
      clearSelection: () => {},
      setRightTab: () => {}, setTool: () => {}, setConnectionStart: () => {},
      setViewport: () => {},
      removeSelected: () => {}, duplicateSelected: () => undefined,
      removeConnection: () => {}, addConnection: () => {},
      project: s.project,
      updateZone: s.updateZone,
      promptFn: () => promptReply,
    };
  }

  it('applies a numeric elevation from prompt', () => {
    const ctx: HitResult = { type: 'zone', id: 'z1' } as HitResult;
    const result = executeAction('set-elevation', ctx, buildStores('12.5'));
    expect(result.executed).toBe(true);
    expect(useProjectStore.getState().project.zones[0].elevation).toBe(12.5);
  });

  it('clears elevation when prompt is blank', () => {
    useProjectStore.getState().updateZone('z1', { elevation: 9 });
    const ctx: HitResult = { type: 'zone', id: 'z1' } as HitResult;
    const result = executeAction('set-elevation', ctx, buildStores(''));
    expect(result.executed).toBe(true);
    expect(useProjectStore.getState().project.zones[0].elevation).toBeUndefined();
  });

  it('aborts cleanly when the user cancels the prompt', () => {
    useProjectStore.getState().updateZone('z1', { elevation: 9 });
    const ctx: HitResult = { type: 'zone', id: 'z1' } as HitResult;
    const result = executeAction('set-elevation', ctx, buildStores(null));
    expect(result.executed).toBe(false);
    expect(useProjectStore.getState().project.zones[0].elevation).toBe(9);
  });

  it('rejects non-finite input', () => {
    const ctx: HitResult = { type: 'zone', id: 'z1' } as HitResult;
    const result = executeAction('set-elevation', ctx, buildStores('not-a-number'));
    expect(result.executed).toBe(false);
    expect(useProjectStore.getState().project.zones[0].elevation).toBeUndefined();
  });

  it('refuses non-zone context', () => {
    const ctx: HitResult = { type: 'entity', id: 'e1' } as HitResult;
    const result = executeAction('set-elevation', ctx, buildStores('5'));
    expect(result.executed).toBe(false);
  });
});

// ── ED-FT-003: layer toggle persistence ────────────────────────────

describe('ED-FT-003: showElevation toggle', () => {
  beforeEach(() => {
    try { localStorage.removeItem('wf-show-elevation'); } catch { /* ignore */ }
  });

  it('toggles in-memory state', () => {
    const initial = useEditorStore.getState().showElevation;
    useEditorStore.getState().toggleElevation();
    expect(useEditorStore.getState().showElevation).toBe(!initial);
    useEditorStore.getState().toggleElevation();
    expect(useEditorStore.getState().showElevation).toBe(initial);
  });

  it('persists to localStorage on toggle', () => {
    const before = useEditorStore.getState().showElevation;
    useEditorStore.getState().toggleElevation();
    const stored = localStorage.getItem('wf-show-elevation');
    expect(stored).toBe(String(!before));
  });
});
