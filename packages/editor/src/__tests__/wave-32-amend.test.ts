// wave-32-amend.test.ts — editor-core HIGH findings in swarm-1787820671-c76a wave 32.

import { describe, it, expect, beforeEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { useProjectStore, createEmptyProject } from '../store/project-store.js';
import { useEditorStore, getSelectionCount, isSelected, emptySelection } from '../store/editor-store.js';
import { applyPlacementClick } from '../canvas-placement.js';
import { collectTownMarkers, TOWN_MARKER_COLORS } from '../town-markers.js';
import { findHitAt, findAllInRect } from '../hit-testing.js';
import { dispatchHotkey, getHotkeyList, type HotkeyContext } from '../hotkeys.js';
import { executeAction } from '../speed-panel-execute.js';
import { SPEED_PANEL_ACTIONS } from '../speed-panel-actions.js';
import type { Zone, ItemPlacement, Landmark, SpawnPoint } from '@world-forge/schema';
import type { ViewportState } from '../viewport.js';

const here = dirname(fileURLToPath(import.meta.url));
function src(rel: string): string {
  return readFileSync(join(here, rel), 'utf8');
}

function makeZone(id: string, x = 0, y = 0, w = 8, h = 8): Zone {
  return {
    id, name: `Zone ${id}`, description: '',
    gridX: x, gridY: y, gridWidth: w, gridHeight: h,
    tags: [], neighbors: [], exits: [],
    light: 1, noise: 0, hazards: [], interactables: [],
  };
}

const TILE = 32;
const vp: ViewportState = { panX: 0, panY: 0, zoom: 1 };
const vis = { showEntities: true, showLandmarks: true, showSpawns: true, showConnections: true, showTown: true, showItems: true };

beforeEach(() => {
  useProjectStore.setState({ project: createEmptyProject(), undoStack: [], redoStack: [], dirty: false });
  useEditorStore.setState({
    activeTool: 'select',
    selection: emptySelection(),
    showTown: true,
  });
});

describe('F-d5a6aae5: Landmark tool click places a landmark', () => {
  it('setTool(landmark) + click inside a zone mutates project.landmarks', () => {
    useProjectStore.getState().addZone(makeZone('z1', 0, 0, 8, 8));
    useEditorStore.getState().setTool('landmark');
    const tool = useEditorStore.getState().activeTool;
    expect(tool).toBe('landmark');
    const result = applyPlacementClick(tool, 2, 3, useProjectStore.getState().project, {
      addLandmark: useProjectStore.getState().addLandmark,
      addItemPlacement: useProjectStore.getState().addItemPlacement,
    });
    expect(result).toBe('placed');
    const lms = useProjectStore.getState().project.landmarks;
    expect(lms).toHaveLength(1);
    expect(lms[0]).toMatchObject({ zoneId: 'z1', gridX: 2, gridY: 3, interactionType: 'inspect' });
    expect(lms[0].id.startsWith('lm-')).toBe(true);
  });

  it('click outside a zone returns need-zone and does not mutate', () => {
    useProjectStore.getState().addZone(makeZone('z1', 0, 0, 4, 4));
    useEditorStore.getState().setTool('landmark');
    const result = applyPlacementClick('landmark', 40, 40, useProjectStore.getState().project, {
      addLandmark: useProjectStore.getState().addLandmark,
      addItemPlacement: useProjectStore.getState().addItemPlacement,
    });
    expect(result).toBe('need-zone');
    expect(useProjectStore.getState().project.landmarks).toHaveLength(0);
  });

  it('Canvas handleMouseDown wires the landmark tool through applyPlacementClick', () => {
    const canvas = src('../Canvas.tsx');
    expect(canvas).toContain("activeTool === 'landmark'");
    expect(canvas).toContain('applyPlacementClick');
    expect(canvas).toContain('addLandmark');
  });
});

describe('F-df71e70a: ItemPlacement CRUD + canvas place/draw/hit', () => {
  it('add/update/remove ItemPlacement on the project store', () => {
    const item: ItemPlacement = { itemId: 'item-1', zoneId: 'z1', gridX: 1, gridY: 2, hidden: false };
    useProjectStore.getState().addItemPlacement(item);
    expect(useProjectStore.getState().project.itemPlacements).toHaveLength(1);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Add item');
    useProjectStore.getState().updateItemPlacement('item-1', { name: 'Sword', rarity: 'rare' });
    expect(useProjectStore.getState().project.itemPlacements[0]).toMatchObject({ name: 'Sword', rarity: 'rare' });
    expect(useProjectStore.getState().getUndoLabel()).toBe('Update item');
    useProjectStore.getState().removeItemPlacement('item-1');
    expect(useProjectStore.getState().project.itemPlacements).toHaveLength(0);
    expect(useProjectStore.getState().getUndoLabel()).toBe('Delete item');
  });

  it('item-place click inside a zone mutates project.itemPlacements', () => {
    useProjectStore.getState().addZone(makeZone('z1'));
    useEditorStore.getState().setTool('item-place');
    const result = applyPlacementClick('item-place', 1, 1, useProjectStore.getState().project, {
      addLandmark: useProjectStore.getState().addLandmark,
      addItemPlacement: useProjectStore.getState().addItemPlacement,
    });
    expect(result).toBe('placed');
    const items = useProjectStore.getState().project.itemPlacements;
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({ zoneId: 'z1', gridX: 1, gridY: 1, hidden: false });
  });

  it('items are hit-testable, selectable, nudgeable, and deletable', () => {
    useProjectStore.getState().addZone(makeZone('z1', 0, 0, 8, 8));
    useProjectStore.getState().addItemPlacement({ itemId: 'item-hit', zoneId: 'z1', gridX: 2, gridY: 2, hidden: false });
    const project = useProjectStore.getState().project;
    const hit = findHitAt(2 * TILE, 2 * TILE, vp, project, TILE, vis);
    expect(hit).toEqual({ type: 'item', id: 'item-hit' });
    useEditorStore.getState().selectKind('item', 'item-hit', false);
    const sel = useEditorStore.getState().selection;
    expect(isSelected(sel, 'item', 'item-hit')).toBe(true);
    expect(getSelectionCount(sel)).toBe(1);
    useProjectStore.getState().moveSelected(sel, 1, 0);
    expect(useProjectStore.getState().project.itemPlacements[0].gridX).toBe(3);
    useProjectStore.getState().removeSelected(sel);
    expect(useProjectStore.getState().project.itemPlacements).toHaveLength(0);
  });

  it('I hotkey switches to item-place', () => {
    const ctx = {
      selection: emptySelection(),
      selectedConnection: null,
      project: createEmptyProject(),
      showEntities: true, showLandmarks: true, showSpawns: true,
      activeModal: null, showSearch: false,
      clearSelection: () => {}, selectAll: () => {}, moveSelected: () => {},
      removeSelected: () => {}, removeConnection: () => {},
      duplicateSelected: () => emptySelection(),
      setShowSearch: () => {}, setRightTab: () => {},
      setTool: (tool: string) => { useEditorStore.getState().setTool(tool as 'item-place'); },
      showSpeedPanel: false, closeSpeedPanel: () => {},
    } as unknown as HotkeyContext;
    const e = { code: 'KeyI', ctrlKey: false, metaKey: false, shiftKey: false, target: { tagName: 'DIV' }, preventDefault() {} } as unknown as KeyboardEvent;
    const result = dispatchHotkey(e, ctx);
    expect(result).toEqual({ handled: true, action: 'tool-item' });
    expect(useEditorStore.getState().activeTool).toBe('item-place');
  });
});

describe('F-5515c044: Town markers draw/hit/select', () => {
  it('collectTownMarkers emits a distinct color per kind', () => {
    useProjectStore.getState().addZone(makeZone('z1', 0, 0, 8, 8));
    useProjectStore.getState().addMarketNode({ id: 'm1', zoneId: 'z1', supplyCategories: [], priceModifier: 1, contrabandAvailable: false });
    useProjectStore.getState().addCraftingStation({ id: 'c1', zoneId: 'z1', stationType: 'forge', availableRecipes: [] });
    useProjectStore.getState().addBuilding({ id: 'b1', name: 'Hall', buildingType: 'hall', gridX: 1, gridY: 1, width: 2, height: 2, zoneId: 'z1', tags: [] });
    useProjectStore.getState().addHub({ id: 'h1', name: 'Square', zoneId: 'z1', hubType: 'market-square', serviceTypes: [], connectedZoneIds: [], tags: [] });
    useProjectStore.getState().addStronghold({ id: 's1', name: 'Keep', zoneId: 'z1', defenseLevel: 2, garrisonEntityIds: [], tags: [] });
    const markers = collectTownMarkers(useProjectStore.getState().project, TILE);
    const types = markers.map((m) => m.type).sort();
    expect(types).toEqual(['building', 'hub', 'market', 'station', 'stronghold']);
    expect(new Set(markers.map((m) => m.color)).size).toBe(5);
    expect(markers.find((m) => m.type === 'market')!.color).toBe(TOWN_MARKER_COLORS.market);
  });

  it('findHitAt returns town types and click-to-select works', () => {
    useProjectStore.getState().addZone(makeZone('z1', 0, 0, 8, 8));
    useProjectStore.getState().addBuilding({ id: 'b1', name: 'Hall', buildingType: 'hall', gridX: 1, gridY: 1, width: 2, height: 2, zoneId: 'z1', tags: [] });
    const project = useProjectStore.getState().project;
    const hit = findHitAt(1 * TILE + 8, 1 * TILE + 8, vp, project, TILE, vis);
    expect(hit).toEqual({ type: 'building', id: 'b1' });
    useEditorStore.getState().selectKind('building', 'b1', false);
    expect(isSelected(useEditorStore.getState().selection, 'building', 'b1')).toBe(true);
  });

  it('showTown=false hides town markers from hit-testing and box-select', () => {
    useProjectStore.getState().addZone(makeZone('z1', 0, 0, 8, 8));
    useProjectStore.getState().addMarketNode({ id: 'm1', zoneId: 'z1', supplyCategories: [], priceModifier: 1, contrabandAvailable: false });
    const project = useProjectStore.getState().project;
    const hidden = { ...vis, showTown: false };
    const hit = findHitAt(4 * TILE - 10, 4 * TILE - 10, vp, project, TILE, hidden);
    expect(hit?.type).not.toBe('market');
    const boxed = findAllInRect({ x1: 0, y1: 0, x2: 400, y2: 400 }, vp, project, TILE, hidden);
    expect(boxed.markets ?? []).toHaveLength(0);
  });

  it('Canvas draws town markers under the props layer, gated by showTown', () => {
    const canvas = src('../Canvas.tsx');
    const townIdx = canvas.indexOf('collectTownMarkers');
    const propsIdx = canvas.indexOf('showProps && (project.propPlacements');
    expect(townIdx).toBeGreaterThan(0);
    expect(propsIdx).toBeGreaterThan(townIdx);
    expect(canvas).toContain('if (showTown)');
  });

  it('toggleTown flips the visibility flag (default on)', () => {
    expect(useEditorStore.getState().showTown).toBe(true);
    useEditorStore.getState().toggleTown();
    expect(useEditorStore.getState().showTown).toBe(false);
  });
});

describe('F-e4e8c7c1: encounter-place is activatable', () => {
  it('N hotkey is listed and switches to encounter-place', () => {
    expect(getHotkeyList().some((h) => h.label === 'N' && /encounter/i.test(h.description))).toBe(true);
    const ctx = {
      selection: emptySelection(),
      selectedConnection: null,
      project: createEmptyProject(),
      showEntities: true, showLandmarks: true, showSpawns: true,
      activeModal: null, showSearch: false,
      clearSelection: () => {}, selectAll: () => {}, moveSelected: () => {},
      removeSelected: () => {}, removeConnection: () => {},
      duplicateSelected: () => emptySelection(),
      setShowSearch: () => {}, setRightTab: () => {},
      setTool: (tool: string) => { useEditorStore.getState().setTool(tool as 'encounter-place'); },
      showSpeedPanel: false, closeSpeedPanel: () => {},
    } as unknown as HotkeyContext;
    const e = { code: 'KeyN', ctrlKey: false, metaKey: false, shiftKey: false, target: { tagName: 'DIV' }, preventDefault() {} } as unknown as KeyboardEvent;
    expect(dispatchHotkey(e, ctx)).toEqual({ handled: true, action: 'tool-encounter' });
    expect(useEditorStore.getState().activeTool).toBe('encounter-place');
  });

  it('Speed Panel Place Encounter Here sets encounter-place', () => {
    const action = SPEED_PANEL_ACTIONS.find((a) => a.id === 'place-encounter');
    expect(action?.label).toBe('Place Encounter Here');
    expect(action?.contextFilter({ type: 'zone', id: 'z1' })).toBe(true);
    const stores = {
      setTool: (t: string) => { useEditorStore.getState().setTool(t as 'encounter-place'); },
    };
    const result = executeAction('place-encounter', { type: 'zone', id: 'z1' }, stores as never);
    expect(result.executed).toBe(true);
    expect(useEditorStore.getState().activeTool).toBe('encounter-place');
  });
});

describe('F-efeb8b00: Landmark and Spawn inspectors mount on selection', () => {
  it('App.tsx mounts LandmarkProperties and SpawnProperties for a single selection', () => {
    const app = src('../App.tsx');
    expect(app).toContain('LandmarkProperties');
    expect(app).toContain('SpawnProperties');
    expect(app).toContain('selection.landmarks.length === 1 && <LandmarkProperties');
    expect(app).toContain('selection.spawns.length === 1 && <SpawnProperties');
  });

  it('Landmark inspector covers interactionType and iconId', () => {
    const body = src('../LandmarkProperties.tsx');
    expect(body).toContain('interactionType');
    expect(body).toContain('iconId');
    expect(body).toContain("a.kind === 'icon'");
  });

  it('setDefaultSpawnPoint clears isDefault on other spawns', () => {
    const a: SpawnPoint = { id: 'sp-a', zoneId: 'z1', gridX: 0, gridY: 0, isDefault: true };
    const b: SpawnPoint = { id: 'sp-b', zoneId: 'z1', gridX: 1, gridY: 1, isDefault: false };
    useProjectStore.getState().addSpawnPoint(a);
    useProjectStore.getState().addSpawnPoint(b);
    useProjectStore.getState().setDefaultSpawnPoint('sp-b');
    const sps = useProjectStore.getState().project.spawnPoints;
    expect(sps.find((s) => s.id === 'sp-a')!.isDefault).toBe(false);
    expect(sps.find((s) => s.id === 'sp-b')!.isDefault).toBe(true);
  });

  it('updateLandmark writes interactionType and iconId', () => {
    const lm: Landmark = {
      id: 'lm-1', name: 'Altar', zoneId: 'z1', gridX: 1, gridY: 1, tags: [], interactionType: 'inspect',
    };
    useProjectStore.getState().addLandmark(lm);
    useProjectStore.getState().updateLandmark('lm-1', { interactionType: 'use', iconId: 'icon-altar' });
    expect(useProjectStore.getState().project.landmarks[0]).toMatchObject({
      interactionType: 'use', iconId: 'icon-altar',
    });
  });
});
