// wave-9-amend.test.ts — Stage B coverage for editor-core findings in swarm-1787820671-c76a wave 9.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { useTemplateStore } from '../store/template-store.js';
import { useSpeedPanelPins, loadJson } from '../store/speed-panel-store.js';
import { findOrphanedByZone, findOrphanedEncounters } from '../orphans.js';
import { nextId, generateZoneId } from '../ids.js';
import { resetFileInput } from '../file-load.js';
import { saveProjectFile } from '../save-project.js';
import { duplicateSelected } from '../duplicate.js';
import type { WorldProject, Zone, MarketNode, PropPlacement } from '@world-forge/schema';

function makeZone(id: string, x = 0, y = 0, w = 4, h = 4): Zone {
  return {
    id, name: id, description: '', tags: [],
    gridX: x, gridY: y, gridWidth: w, gridHeight: h,
    neighbors: [], exits: [], light: 5, noise: 0, hazards: [], interactables: [],
  };
}

describe('F-95295187: saveProjectFile does not markClean on failure', () => {
  it('calls markClean only after a successful picker write', async () => {
    const markClean = vi.fn();
    const toast = vi.fn();
    const project = createEmptyProject();
    project.id = 'world-1';
    const close = vi.fn();
    const write = vi.fn(async () => {});
    await saveProjectFile(project, {
      markClean,
      toast,
      showSaveFilePicker: async () => ({
        name: 'world-1.json',
        createWritable: async () => ({ write, close }),
      }),
    });
    expect(write).toHaveBeenCalled();
    expect(close).toHaveBeenCalled();
    expect(markClean).toHaveBeenCalledTimes(1);
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('world-1.json'), 'success', expect.any(Number));
  });

  it('does not markClean when the user cancels the picker (AbortError)', async () => {
    const markClean = vi.fn();
    const toast = vi.fn();
    const err = Object.assign(new Error('cancel'), { name: 'AbortError' });
    const ok = await saveProjectFile(createEmptyProject(), {
      markClean,
      toast,
      showSaveFilePicker: async () => { throw err; },
    });
    expect(ok).toBe(false);
    expect(markClean).not.toHaveBeenCalled();
    expect(toast).not.toHaveBeenCalled();
  });

  it('toasts an error and leaves dirty when downloadViaAnchor reports failure', async () => {
    const markClean = vi.fn();
    const toast = vi.fn();
    const ok = await saveProjectFile(createEmptyProject(), {
      markClean,
      toast,
      showSaveFilePicker: undefined,
      downloadViaAnchor: async () => false,
    });
    expect(ok).toBe(false);
    expect(markClean).not.toHaveBeenCalled();
    expect(toast).toHaveBeenCalledWith(expect.stringContaining('blocked or aborted'), 'error', expect.any(Number));
  });

  it('markClean runs after a successful fallback download', async () => {
    const markClean = vi.fn();
    const toast = vi.fn();
    const ok = await saveProjectFile(createEmptyProject(), {
      markClean,
      toast,
      downloadViaAnchor: async () => true,
    });
    expect(ok).toBe(true);
    expect(markClean).toHaveBeenCalledTimes(1);
  });
});

describe('F-5c713675: resetFileInput always clears the value', () => {
  it('sets value to empty string on success, error, and empty-file paths', () => {
    const input = { value: 'C:\\Users\\me\\world.json' };
    resetFileInput(input);
    expect(input.value).toBe('');
    resetFileInput(null);
    resetFileInput(undefined);
  });
});

describe('F-ddfcddfb: nextId is unique within a millisecond', () => {
  it('two successive calls never collide', () => {
    const a = nextId('entity');
    const b = nextId('entity');
    expect(a).not.toBe(b);
    expect(generateZoneId()).not.toBe(generateZoneId());
  });
});

describe('F-9ed42a51: removeConnection is the inverse of addConnection', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('addConnection then removeConnection leaves neighbors []', () => {
    const z1 = makeZone('z1');
    const z2 = makeZone('z2');
    useProjectStore.getState().loadProject({ ...createEmptyProject(), zones: [z1, z2] });
    useProjectStore.getState().addConnection({ fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true, kind: 'door' });
    const afterAdd = useProjectStore.getState().project;
    expect(afterAdd.zones.find((z) => z.id === 'z1')!.neighbors).toEqual(['z2']);
    expect(afterAdd.zones.find((z) => z.id === 'z2')!.neighbors).toEqual(['z1']);

    useProjectStore.getState().removeConnection('z1', 'z2');
    const after = useProjectStore.getState().project;
    expect(after.connections).toEqual([]);
    expect(after.zones.find((z) => z.id === 'z1')!.neighbors).toEqual([]);
    expect(after.zones.find((z) => z.id === 'z2')!.neighbors).toEqual([]);
  });

  it('removeZone strips remaining neighbors/exits pointing at the deleted id', () => {
    const z1: Zone = { ...makeZone('z1'), neighbors: ['z2'], exits: [{ targetZoneId: 'z2', label: 'door' }] };
    const z2: Zone = { ...makeZone('z2'), neighbors: ['z1'], exits: [{ targetZoneId: 'z1', label: 'back' }] };
    useProjectStore.getState().loadProject({
      ...createEmptyProject(),
      zones: [z1, z2],
      connections: [{ fromZoneId: 'z1', toZoneId: 'z2', bidirectional: true, kind: 'door' }],
    });
    useProjectStore.getState().removeZone('z2');
    const leftover = useProjectStore.getState().project.zones.find((z) => z.id === 'z1')!;
    expect(leftover.neighbors).toEqual([]);
    expect(leftover.exits).toEqual([]);
  });
});

describe('F-c8fa9fb6: swapConnection is a single undo entry', () => {
  beforeEach(() => {
    useProjectStore.getState().newProject();
  });

  it('swap then one undo restores the original from/to', () => {
    useProjectStore.getState().loadProject({
      ...createEmptyProject(),
      zones: [makeZone('z1'), makeZone('z2')],
      connections: [{ fromZoneId: 'z1', toZoneId: 'z2', bidirectional: false, kind: 'door' }],
    });
    useProjectStore.getState().swapConnection('z1', 'z2');
    expect(useProjectStore.getState().getUndoLabel()).toBe('Swap connection direction');
    expect(useProjectStore.getState().getUndoCount()).toBe(1);
    const swapped = useProjectStore.getState().project.connections[0];
    expect(swapped.fromZoneId).toBe('z2');
    expect(swapped.toZoneId).toBe('z1');

    useProjectStore.getState().undo();
    const restored = useProjectStore.getState().project.connections[0];
    expect(restored.fromZoneId).toBe('z1');
    expect(restored.toZoneId).toBe('z2');
  });
});

describe('F-2864fdb3: mergeZones reassigns town/interior content', () => {
  it('repoints a market node + prop placement onto the merged id', () => {
    const market: MarketNode = { id: 'm1', zoneId: 'z2', supplyCategories: ['food'], priceModifier: 1, contrabandAvailable: false };
    const prop: PropPlacement = { id: 'p1', propId: 'crate', gridX: 7, gridY: 3, zoneId: 'z2' };
    useProjectStore.getState().loadProject({
      ...createEmptyProject(),
      zones: [makeZone('z1', 0, 0, 4, 4), makeZone('z2', 6, 2, 4, 4)],
      marketNodes: [market],
      propPlacements: [prop],
    });
    const mergedId = useProjectStore.getState().mergeZones(['z1', 'z2']);
    expect(mergedId).toBeTruthy();
    const p = useProjectStore.getState().project;
    expect(p.marketNodes[0].zoneId).toBe(mergedId);
    expect(p.propPlacements[0].zoneId).toBe(mergedId);
  });
});

describe('F-e900da8a: moveSelected translates zone children', () => {
  it('place a prop in z1, moveSelected({zones:["z1"]}, 2, 0) shifts the prop', () => {
    useProjectStore.getState().loadProject({
      ...createEmptyProject(),
      zones: [makeZone('z1', 0, 0, 4, 4)],
      propPlacements: [{ id: 'p1', propId: 'crate', gridX: 1, gridY: 1, zoneId: 'z1' }],
    });
    useProjectStore.getState().moveSelected(
      { zones: ['z1'], entities: [], landmarks: [], spawns: [], encounters: [] },
      2, 0,
    );
    const p = useProjectStore.getState().project;
    expect(p.zones[0].gridX).toBe(2);
    expect(p.propPlacements[0].gridX).toBe(3);
    expect(p.propPlacements[0].gridY).toBe(1);
  });
});

describe('F-1f67a7ce: updateProject no-ops on same reference', () => {
  it('alignSelected with too-small selection does not push undo or set dirty', () => {
    useProjectStore.getState().loadProject(createEmptyProject());
    expect(useProjectStore.getState().dirty).toBe(false);
    useProjectStore.getState().alignSelected(
      { zones: ['missing'], entities: [], landmarks: [], spawns: [], encounters: [] },
      'left',
    );
    expect(useProjectStore.getState().dirty).toBe(false);
    expect(useProjectStore.getState().getUndoCount()).toBe(0);
  });
});

describe('F-17014243: loadProject/newProject clear hiddenIds', () => {
  it('hiding then loading a different project unhides reused ids', () => {
    useEditorStore.setState({ hiddenIds: new Set(['chapel-entrance']) });
    try { localStorage.setItem('wf-hidden-ids', JSON.stringify(['chapel-entrance'])); } catch { /* ignore */ }
    useProjectStore.getState().loadProject(createEmptyProject());
    expect(useEditorStore.getState().hiddenIds.size).toBe(0);
    expect(useEditorStore.getState().isHidden('chapel-entrance')).toBe(false);
  });
});

describe('F-7002ff8c: findOrphanedByZone covers every zoneId-bearing collection', () => {
  it('lists a dangling item + prop, and still reports encounter orphans first', () => {
    const project: WorldProject = {
      ...createEmptyProject(),
      zones: [makeZone('alive')],
      encounterAnchors: [{
        id: 'enc-orphan', zoneId: 'gone', encounterType: 'ambush',
        enemyIds: [], probability: 0.5, cooldownTurns: 0, tags: [],
      }],
      itemPlacements: [{ itemId: 'sword', zoneId: 'gone', hidden: false }],
      propPlacements: [{ id: 'pew', propId: 'pew', gridX: 0, gridY: 0, zoneId: 'gone' }],
    };
    const orphans = findOrphanedByZone(project);
    expect(orphans[0].collection).toBe('encounterAnchors');
    expect(orphans.some((o) => o.collection === 'itemPlacements' && o.id === 'sword')).toBe(true);
    expect(orphans.some((o) => o.collection === 'propPlacements' && o.id === 'pew')).toBe(true);
    expect(findOrphanedEncounters(project)).toHaveLength(1);
  });
});

describe('F-9f500bd2 / F-a4323dfa: speed-panel loadJson + saveJson', () => {
  it('loadJson returns fallback for valid JSON of the wrong type', () => {
    const storage = new Map<string, string>();
    const prev = globalThis.localStorage;
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => { storage.set(k, v); },
      removeItem: (k: string) => { storage.delete(k); },
    });
    storage.set('k', JSON.stringify({ not: 'an-array' }));
    const isStringArray = (v: unknown): v is string[] => Array.isArray(v) && v.every((x) => typeof x === 'string');
    expect(loadJson('k', ['fallback'], isStringArray)).toEqual(['fallback']);
    storage.set('k', JSON.stringify(['ok']));
    expect(loadJson('k', ['fallback'], isStringArray)).toEqual(['ok']);
    vi.stubGlobal('localStorage', prev);
  });

  it('togglePin keeps in-memory state when setItem throws', () => {
    const boom = () => { throw new Error('QuotaExceededError'); };
    const prev = globalThis.localStorage;
    vi.stubGlobal('localStorage', {
      getItem: () => null,
      setItem: boom,
      removeItem: () => {},
    });
    useSpeedPanelPins.setState({ pinnedIds: [] });
    expect(() => useSpeedPanelPins.getState().togglePin('edit-props')).not.toThrow();
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['edit-props']);
    vi.stubGlobal('localStorage', prev);
  });
});

describe('F-c27c9e7e: template-store wrong-shape JSON', () => {
  it('loadTemplates resets a non-array payload to []', () => {
    const storage = new Map<string, string>();
    const prev = globalThis.localStorage;
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => storage.get(k) ?? null,
      setItem: (k: string, v: string) => { storage.set(k, v); },
      removeItem: (k: string) => { storage.delete(k); },
    });
    storage.set('world-forge-templates', JSON.stringify({ nope: true }));
    useTemplateStore.getState().loadTemplates();
    expect(useTemplateStore.getState().templates).toEqual([]);
    vi.stubGlobal('localStorage', prev);
  });
});

describe('F-00a578f0: duplicateSelected clones zone-attached items', () => {
  it('duplicating a zone with an item clones the item onto the new zone', () => {
    const project: WorldProject = {
      ...createEmptyProject(),
      zones: [makeZone('nave')],
      itemPlacements: [{ itemId: 'mace', name: 'Mace', zoneId: 'nave', hidden: false }],
    };
    const { project: next, newSelection } = duplicateSelected(project, {
      zones: ['nave'], entities: [], landmarks: [], spawns: [], encounters: [],
    });
    expect(next.itemPlacements.length).toBe(2);
    const clone = next.itemPlacements.find((i) => i.itemId !== 'mace')!;
    expect(clone.zoneId).toBe(newSelection.zones[0]);
    expect(clone.name).toBe('Mace');
  });
});
