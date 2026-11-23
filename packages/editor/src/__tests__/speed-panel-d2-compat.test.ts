import { describe, it, expect, beforeEach } from 'vitest';

vi.mock('zustand', async () => {
  const { createStore } = await import('zustand/vanilla');
  type AnyStateCreator = import('zustand/vanilla').StateCreator<unknown>;
  const identity = <T,>(x: T) => x;
  const createImpl = (createState: AnyStateCreator) => {
    const api = createStore<unknown>(createState);
    const useBoundStore = (selector: (s: unknown) => unknown = identity) => selector(api.getState());
    return Object.assign(useBoundStore, api);
  };
  const create = (createState?: AnyStateCreator) =>
    createState ? createImpl(createState) : createImpl;
  return { create };
});

import { vi } from 'vitest';

const storage = new Map<string, string>();
Object.defineProperty(globalThis, 'localStorage', {
  value: {
    getItem: (k: string) => storage.get(k) ?? null,
    setItem: (k: string, v: string) => { storage.set(k, String(v)); },
    removeItem: (k: string) => { storage.delete(k); },
    clear: () => { storage.clear(); },
    key: (i: number) => [...storage.keys()][i] ?? null,
    get length() { return storage.size; },
  },
  configurable: true,
});

import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { getCommandById } from '../command-registry.js';
import { BUILTIN_KITS } from '../kits/built-ins.js';
import { BUNDLE_VERSION, parseKitBundle, type KitBundle } from '../kits/bundle.js';
import { validateKit } from '../kits/validate-kit.js';
import { productionExecuteStores } from '../panels/speed-panel-stores.js';
import type { SpeedPanelMacro } from '../speed-panel-actions.js';
import { executeMacro } from '../speed-panel-execute.js';
import { useEditorStore } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { SPEED_PANEL_STATE_V2_KEY, loadSpeedPanelStateV2, useSpeedPanelPins } from '../store/speed-panel-store.js';

describe('Speed Panel Macro and Starter Kit Base Compatibility Contracts', () => {
  beforeEach(() => {
    storage.clear();
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.getState().clearSelection();
    useSpeedPanelPins.setState({ pinnedIds: ['edit-props', 'duplicate'], macros: [] });
  });

  it('loads legacy { actionId } macros from v2 and legacy storage and matches hand execution', () => {
    const legacyMacros: SpeedPanelMacro[] = [
      {
        id: 'legacy-1',
        name: 'Quick Inspect',
        steps: [{ actionId: 'edit-props' }, { actionId: 'open-review' }],
      },
    ];
    storage.set(
      SPEED_PANEL_STATE_V2_KEY,
      JSON.stringify({ version: 2, pinnedIds: ['edit-props'], macros: legacyMacros }),
    );
    const v2Loaded = loadSpeedPanelStateV2();
    expect(v2Loaded.macros).toEqual(legacyMacros);
    expect(v2Loaded.macros[0].steps[0].actionId).toBe('edit-props');

    storage.clear();
    storage.set('world-forge-speed-panel-macros', JSON.stringify(legacyMacros));
    const fallbackLoaded = loadSpeedPanelStateV2();
    expect(fallbackLoaded.macros).toEqual(legacyMacros);

    const res = executeMacro(
      legacyMacros[0],
      { type: 'zone', id: useProjectStore.getState().project.zones[0].id },
      { ...productionExecuteStores(), updateProject: undefined },
    );
    expect(res.completed).toBe(2);
    expect(res.abortedAt).toBeUndefined();

    // Production atomic path (with updateProject present): base-format macro commits in 1 undo and equals hand execution
    const firstZoneId = useProjectStore.getState().project.zones[0].id;
    const baseDupMacro: SpeedPanelMacro = {
      id: 'legacy-atomic-1',
      name: 'Inspect And Dup',
      steps: [{ actionId: 'edit-props' }, { actionId: 'duplicate' }],
    };
    const undoBefore = useProjectStore.getState().getUndoCount();
    const atomicRes = executeMacro(
      baseDupMacro,
      { type: 'zone', id: firstZoneId },
      productionExecuteStores(),
    );
    expect(atomicRes.completed).toBe(2);
    expect(atomicRes.abortedAt).toBeUndefined();
    expect(useProjectStore.getState().getUndoCount()).toBe(undoBefore + 1);
    const macroProj = structuredClone(useProjectStore.getState().project);

    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    const dupCmd = getCommandById('duplicate')!;
    const handRes = dupCmd.run({
      hit: { type: 'zone', id: firstZoneId },
      stores: productionExecuteStores(),
      selection: useEditorStore.getState().selection,
      project: useProjectStore.getState().project,
    });
    expect(handRes.executed).toBe(true);
    const handProj = structuredClone(useProjectStore.getState().project);

    const normalizeFullProject = (proj: typeof macroProj) => {
      const baseIds = new Set(minimalProject.zones.map((z) => z.id));
      const idMap = new Map<string, string>();
      let copyIdx = 0;
      for (const z of proj.zones) {
        if (!baseIds.has(z.id)) idMap.set(z.id, `copied-zone-${++copyIdx}`);
      }
      const remap = (id: string) => idMap.get(id) ?? id;
      return {
        ...proj,
        zones: proj.zones.map((z) => ({ ...z, id: remap(z.id), neighbors: z.neighbors.map(remap) })),
        districts: proj.districts.map((d) => ({ ...d, zoneIds: d.zoneIds.map(remap) })),
      };
    };
    expect(normalizeFullProject(macroProj)).toEqual(normalizeFullProject(handProj));
  });

  it('keeps BUNDLE_VERSION at 1 and round-trips v1 kits without speedPanelPresets', () => {
    expect(BUNDLE_VERSION).toBe(1);
    const bareKit = structuredClone(BUILTIN_KITS[0]);
    const baseV1Literal: KitBundle = {
      bundleVersion: 1,
      name: 'Base Horizon Kit',
      description: 'Authored before speedPanelPresets existed',
      icon: 'H',
      modes: ['dungeon'],
      tags: ['classic'],
      project: structuredClone(bareKit.project),
      presetRefs: {
        region: [...bareKit.presetRefs.region],
        encounter: [...bareKit.presetRefs.encounter],
      },
      guideHints: {},
      version: '1.0.0',
      exportedAt: '2026-11-01T00:00:00.000Z',
    };
    const parsed = parseKitBundle(baseV1Literal);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) {
      expect(parsed.warnings).toEqual([]);
      expect('speedPanelPresets' in parsed.bundle).toBe(false);
      expect(parsed.bundle).toEqual(baseV1Literal);
    }
    expect(validateKit(bareKit).warnings).toEqual([]);
  });
});
