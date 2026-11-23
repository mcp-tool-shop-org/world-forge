import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

const hookSlots: unknown[] = [];
let hookIdx = 0;
let pendingEffects: Array<() => void | (() => void)> = [];
const effectCleanups: Array<() => void> = [];
const windowListeners = new Map<string, Set<(e: unknown) => void>>();

const mockCanvasElement = {
  parentElement: { clientWidth: 800, clientHeight: 600 },
  width: 800,
  height: 600,
  offsetWidth: 800,
  offsetHeight: 600,
  getContext: () => null,
  getBoundingClientRect: () => ({ left: 0, top: 0, width: 800, height: 600, right: 800, bottom: 600 }),
  addEventListener: () => {},
  removeEventListener: () => {},
};

function cleanupEffects() {
  for (const cleanup of effectCleanups.splice(0)) {
    try {
      cleanup();
    } catch {
      /* ignore teardown errors */
    }
  }
  pendingEffects = [];
}

function flushEffects() {
  const toRun = pendingEffects.splice(0);
  for (const effect of toRun) {
    const cleanup = effect();
    if (typeof cleanup === 'function') {
      effectCleanups.push(cleanup);
    }
  }
}

function resetHooks() {
  cleanupEffects();
  hookSlots.length = 0;
  hookIdx = 0;
}

vi.mock('react', async () => {
  const actual = await vi.importActual<typeof import('react')>('react');
  return {
    ...actual,
    useState: <T,>(initial: T | (() => T)) => {
      const i = hookIdx++;
      if (!(i in hookSlots)) {
        hookSlots[i] = typeof initial === 'function' ? (initial as () => T)() : initial;
      }
      const setState = (next: T | ((prev: T) => T)) => {
        hookSlots[i] = typeof next === 'function' ? (next as (prev: T) => T)(hookSlots[i] as T) : next;
      };
      return [hookSlots[i] as T, setState] as const;
    },
    useRef: <T,>(initial: T) => {
      const i = hookIdx++;
      if (!(i in hookSlots)) {
        hookSlots[i] = { current: initial };
      }
      return hookSlots[i] as { current: T };
    },
    useMemo: <T,>(factory: () => T) => {
      hookIdx++;
      return factory();
    },
    useCallback: <T extends (...args: never[]) => unknown>(fn: T) => {
      hookIdx++;
      return fn;
    },
    useEffect: (effect: () => void | (() => void)) => {
      hookIdx++;
      pendingEffects.push(effect);
    },
  };
});

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

import { createElement, Fragment, type ReactNode } from 'react';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import {
  Canvas,
  recordCanvasEncounterSessionAction,
  recordCanvasHotkeySessionAction,
} from '../Canvas.js';
import { DependencyPanel } from '../panels/DependencyPanel.js';
import { TemplateManager } from '../panels/TemplateManager.js';
import { SaveKitModal } from '../panels/SaveKitModal.js';
import { ImportKitModal } from '../panels/ImportKitModal.js';
import { SpeedPanel } from '../panels/SpeedPanel.js';
import { productionStepStores } from '../panels/speed-panel-stores.js';
import { getProblemsForObject, openQuickFixFlow } from '../speed-panel-quick-fix.js';
import { validateMacroExecution } from '../speed-panel-macros.js';
import { openCommandStepFlow } from '../speed-panel-steps.js';
import { openCreateMacroState, type MacroReplaceFlowState } from '../speed-panel-ui.js';
import { BUILTIN_ENCOUNTER_PRESETS, BUILTIN_REGION_PRESETS } from '../presets/built-ins.js';
import { prepareKitImport } from '../kits/bundle.js';
import { StoragePersistError, useKitStore } from '../kits/index.js';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { loadSpeedPanelStateV2, useSpeedPanelPins } from '../store/speed-panel-store.js';
import { _getToastsForTest, _resetToastsForTest } from '../ui/Toast.js';

interface ElementNode {
  type: unknown;
  props: Record<string, unknown>;
}

function isElementNode(node: unknown): node is ElementNode {
  return Boolean(node && typeof node === 'object' && 'type' in node && 'props' in node);
}

function expandElement(node: ReactNode): unknown[] {
  if (node == null || typeof node === 'boolean' || typeof node === 'string' || typeof node === 'number') {
    return [node];
  }
  if (Array.isArray(node)) {
    return node.flatMap(expandElement);
  }
  if (!isElementNode(node)) return [];
  if (node.type === Fragment) {
    return expandElement(node.props.children as ReactNode);
  }
  if (typeof node.type === 'function') {
    const rendered = (node.type as (p: Record<string, unknown>) => ReactNode)(node.props);
    return expandElement(rendered);
  }
  if (node.type === 'canvas' && node.props.ref && typeof node.props.ref === 'object' && 'current' in (node.props.ref as object)) {
    (node.props.ref as { current: unknown }).current = mockCanvasElement;
  }
  const expandedChildren = expandElement(node.props.children as ReactNode);
  const nextProps = { ...node.props, children: expandedChildren };
  return [{ type: node.type, props: nextProps }];
}

function renderRoot<P extends object>(Component: (props: P) => ReactNode, props: P): unknown[] {
  hookIdx = 0;
  return expandElement(createElement(Component, props));
}

function collectAll(nodes: unknown[], pred: (el: ElementNode) => boolean, out: ElementNode[] = []): ElementNode[] {
  for (const n of nodes) {
    if (Array.isArray(n)) {
      collectAll(n, pred, out);
      continue;
    }
    if (!isElementNode(n)) continue;
    if (pred(n)) out.push(n);
    if (n.props.children !== undefined) {
      collectAll(Array.isArray(n.props.children) ? n.props.children : [n.props.children], pred, out);
    }
  }
  return out;
}

function textContent(node: unknown): string {
  if (node == null || typeof node === 'boolean') return '';
  if (typeof node === 'string' || typeof node === 'number') return String(node);
  if (Array.isArray(node)) return node.map(textContent).join('');
  if (isElementNode(node)) return textContent(node.props.children);
  return '';
}

function findByTestId(tree: unknown[], id: string): ElementNode | undefined {
  return collectAll(tree, (el) => el.props['data-testid'] === id)[0];
}

function findByAriaLabel(tree: unknown[], label: string): ElementNode | undefined {
  return collectAll(tree, (el) => el.props['aria-label'] === label)[0];
}

function findButtonByText(tree: unknown[], text: string): ElementNode | undefined {
  return collectAll(tree, (el) => el.type === 'button' && textContent(el).trim() === text)[0];
}

function dispatchWindowEvent(type: string, event: unknown): void {
  for (const listener of windowListeners.get(type) ?? []) {
    listener(event);
  }
}

describe('Speed Panel UI Handlers & Canvas Session Helpers', () => {
  beforeEach(() => {
    storage.clear();
    windowListeners.clear();
    _resetToastsForTest();
    resetHooks();
    vi.restoreAllMocks();
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().closeSpeedPanel();
    useEditorStore.getState().setRightTab('issues');
    useEditorStore.getState().setRightCollapsed(false);
    useEditorStore.getState().setTool('select');
    useEditorStore.setState({ recentPanelActions: [] });
    useSpeedPanelPins.setState({ pinnedIds: [], macros: [], groups: [], loadWarnings: [] });
    useKitStore.getState().loadKits();
    const win = ((globalThis as Record<string, unknown>).window ?? globalThis) as Record<string, unknown>;
    (globalThis as Record<string, unknown>).window = win;
    win.addEventListener = (type: string, fn: (e: unknown) => void) => {
      let set = windowListeners.get(type);
      if (!set) {
        set = new Set();
        windowListeners.set(type, set);
      }
      set.add(fn);
    };
    win.removeEventListener = (type: string, fn: (e: unknown) => void) => {
      windowListeners.get(type)?.delete(fn);
    };
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = () => 'blob:mock-kit';
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = () => {};
    }
    const existingDoc = (globalThis as Record<string, unknown>).document as Record<string, unknown> | undefined;
    const doc = existingDoc ?? {
      createElement: () => ({ href: '', download: '', click: () => {}, remove: () => {} }),
      getElementById: () => null,
      body: { appendChild: () => {}, removeChild: () => {} },
      activeElement: null,
    };
    if (!('activeElement' in doc)) {
      doc.activeElement = null;
    }
    if (!('getElementById' in doc)) {
      doc.getElementById = () => null;
    }
    (globalThis as Record<string, unknown>).document = doc;
  });

  afterEach(() => {
    resetHooks();
    windowListeners.clear();
    _resetToastsForTest();
  });

  it('exercises Canvas session action recorders for hotkeys and encounter placement', () => {
    useEditorStore.setState({ recentPanelActions: [] });
    recordCanvasHotkeySessionAction('duplicate');
    recordCanvasHotkeySessionAction('delete');
    recordCanvasHotkeySessionAction('escape'); // filtered out since not in REPLAYABLE_PANEL_COMMANDS
    recordCanvasEncounterSessionAction('ambush');

    const recorded = useEditorStore.getState().recentPanelActions;
    expect(recorded.map((r) => r.commandId)).toEqual(['place-encounter', 'delete', 'duplicate']);
    expect(recorded[0].args).toEqual({ kind: 'place-encounter', encounterType: 'ambush' });
  });

  it('drives TemplateManager kit export opt-in, kit apply preset toggle, and starter kit actions', () => {
    const closeSpy = vi.fn();
    useSpeedPanelPins.setState({
      pinnedIds: ['fit-content'],
      macros: [{ id: 'km-1', name: 'Room Pass', steps: [{ actionId: 'fit-content' }] }],
    });
    const customKit = useKitStore.getState().saveKit({
      name: 'Custom Preset Kit',
      description: 'Has speed panel presets',
      icon: '!',
      modes: ['dungeon'],
      tags: ['test'],
      project: structuredClone(minimalProject),
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
      speedPanelPresets: {
        pins: ['edit-props'],
        macros: [{ id: 'kit-m', name: 'Kit Fit', steps: [{ actionId: 'toggle-grid' }] }],
      },
    });
    expect(customKit).toBeDefined();

    // Render TemplateManager starting on Starters tab
    let tree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });

    // Toggle "Include Speed Panel pins & macros on export"
    const exportToggle = findByTestId(tree, 'wf-kit-export-include-speed-panel');
    expect(exportToggle).toBeDefined();
    (exportToggle!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
    tree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });
    expect(findByTestId(tree, 'wf-kit-export-include-speed-panel')!.props.checked).toBe(true);

    // Click Export on the first kit (sets kitFallback link)
    const exportButtons = collectAll(tree, (el) => el.type === 'button' && textContent(el).trim() === 'Export');
    expect(exportButtons.length).toBeGreaterThan(0);
    (exportButtons[0].props.onClick as () => void)();
    tree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });

    // Toggle "Add Speed Panel pins & macros" off then back on for the custom kit
    const applyToggle = findByTestId(tree, `wf-kit-apply-speed-panel-${customKit!.id}`);
    expect(applyToggle).toBeDefined();
    (applyToggle!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: false } });
    tree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });
    expect(findByTestId(tree, `wf-kit-apply-speed-panel-${customKit!.id}`)!.props.checked).toBe(false);
    (findByTestId(tree, `wf-kit-apply-speed-panel-${customKit!.id}`)!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
    tree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });
    expect(findByTestId(tree, `wf-kit-apply-speed-panel-${customKit!.id}`)!.props.checked).toBe(true);

    // Click All filter and Start Project on the custom kit
    const allFilterBtn = findButtonByText(tree, 'All');
    expect(allFilterBtn).toBeDefined();
    (allFilterBtn!.props.onClick as () => void)();
    tree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });
    const startButtons = collectAll(tree, (el) => el.type === 'button' && textContent(el).trim() === 'Start Project');
    expect(startButtons.length).toBeGreaterThan(0);
    (startButtons[startButtons.length - 1].props.onClick as () => void)();
    expect(closeSpy).toHaveBeenCalled();

    // Open Import Kit, Duplicate, and Samples tab cleanly on fresh render
    resetHooks();
    let freshTree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });
    const importBtn = findButtonByText(freshTree, 'Import Kit');
    expect(importBtn).toBeDefined();
    (importBtn!.props.onClick as () => void)();
    const kitsBeforeDup = useKitStore.getState().kits.length;
    const dupButtons = collectAll(freshTree, (el) => el.type === 'button' && textContent(el).trim() === 'Duplicate');
    expect(dupButtons.length).toBeGreaterThan(0);
    (dupButtons[0].props.onClick as () => void)();
    expect(useKitStore.getState().kits.length).toBe(kitsBeforeDup + 1);
    const samplesTab = findButtonByText(freshTree, 'Samples');
    expect(samplesTab).toBeDefined();
    (samplesTab!.props.onClick as () => void)();
    freshTree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });
    expect(findByTestId(freshTree, 'wf-kit-export-include-speed-panel')).toBeUndefined();
    expect(freshTree.length).toBeGreaterThan(0);
  });

  it('drives SaveKitModal and ImportKitModal JSX form inputs, preset toggle, and save error handling', () => {
    const closeSpy = vi.fn();
    useSpeedPanelPins.setState({
      pinnedIds: ['edit-props'],
      macros: [{ id: 'sm-1', name: 'Save Test Macro', steps: [{ actionId: 'fit-content' }] }],
    });

    let tree = renderRoot(SaveKitModal, { onClose: closeSpy });
    const nameInput = collectAll(tree, (el) => el.props.id === 'wf-save-kit-name')[0];
    const descInput = collectAll(tree, (el) => el.props.id === 'wf-save-kit-desc')[0];
    const iconInput = collectAll(tree, (el) => el.props.id === 'wf-save-kit-icon')[0];
    const tagsInput = collectAll(tree, (el) => el.props.id === 'wf-save-kit-tags')[0];
    const presetCheck = findByTestId(tree, 'wf-save-kit-include-speed-panel');
    expect(presetCheck).toBeDefined();

    (nameInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Harbor Starter' } });
    (descInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Harbor desc' } });
    (iconInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'H' } });
    (tagsInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'harbor, docks' } });
    (presetCheck!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });

    const modeButtons = collectAll(tree, (el) => el.type === 'button' && 'aria-pressed' in el.props);
    expect(modeButtons.length).toBeGreaterThan(1);
    const wasPressed = Boolean(modeButtons[1].props['aria-pressed']);
    (modeButtons[1].props.onClick as () => void)();

    tree = renderRoot(SaveKitModal, { onClose: closeSpy });
    const toggledModeBtn = collectAll(tree, (el) => el.type === 'button' && 'aria-pressed' in el.props)[1];
    expect(Boolean(toggledModeBtn.props['aria-pressed'])).toBe(!wasPressed);

    const saveBtn = findButtonByText(tree, 'Save Kit')!;
    expect(saveBtn).toBeDefined();
    (saveBtn.props.onClick as () => void)();
    expect(closeSpy).toHaveBeenCalledTimes(1);

    const saved = useKitStore.getState().kits.find((k) => k.name === 'Harbor Starter');
    expect(saved?.speedPanelPresets?.pins).toEqual(['edit-props']);
    expect(saved?.speedPanelPresets?.macros[0].name).toBe('Save Test Macro');

    // Save error catch branch
    resetHooks();
    const saveErrSpy = vi.fn(() => { throw new StoragePersistError('quota'); });
    const origSave = useKitStore.getState().saveKit;
    useKitStore.setState({ saveKit: saveErrSpy });
    const errTree = renderRoot(SaveKitModal, { onClose: closeSpy });
    (findButtonByText(errTree, 'Save Kit')!.props.onClick as () => void)();
    expect(saveErrSpy).toHaveBeenCalled();
    useKitStore.setState({ saveKit: origSave });

    // ImportKitModal preview + Import + Cancel
    resetHooks();
    const importClose = vi.fn();
    const prepared = prepareKitImport({
      bundleVersion: 1,
      name: 'Bundled Kit',
      description: 'Bundled',
      icon: '*',
      modes: ['dungeon'],
      tags: ['imported'],
      project: structuredClone(minimalProject),
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
      exportedAt: new Date().toISOString(),
      speedPanelPresets: { pins: ['fit-content'], macros: [] },
    });
    if ('error' in prepared) {
      throw new Error(`Expected valid kit import, got error: ${prepared.error}`);
    }
    const kitsBeforeImport = useKitStore.getState().kits.length;
    const importTree = renderRoot(ImportKitModal, {
      onClose: importClose,
      initialResult: prepared,
    });
    const importActionBtn = findButtonByText(importTree, 'Import');
    expect(importActionBtn).toBeDefined();
    (importActionBtn!.props.onClick as () => void)();
    expect(useKitStore.getState().kits.length).toBe(kitsBeforeImport + 1);
    expect(useKitStore.getState().kits.some((k) => k.name === 'Bundled Kit')).toBe(true);
    expect(importClose).toHaveBeenCalledTimes(1);

    const cancelBtn = findButtonByText(importTree, 'Cancel');
    expect(cancelBtn).toBeDefined();
    (cancelBtn!.props.onClick as () => void)();
    expect(importClose).toHaveBeenCalledTimes(2);
  });

  it('drives SpeedPanel Quick Fix row, step stack, Create Macro, Replace flow, and edit mode JSX handlers', () => {
    const proj = structuredClone(minimalProject);
    const zId = proj.zones[0].id;
    proj.zones[0] = { ...proj.zones[0], backgroundId: 'missing-bg-id' };
    useProjectStore.getState().loadProject(proj);
    useEditorStore.setState({
      speedPanelPosition: { x: 120, y: 120 },
      speedPanelContext: { type: 'zone', id: zId },
      speedPanelEditMode: false,
    });

    // 1) Root SpeedPanel -> click Quick Fix row -> Step 1 -> select problem -> Step 2 -> filter & apply repair
    let tree = renderRoot(SpeedPanel, {});
    const qfRow = findByTestId(tree, 'wf-sp-quick-fix-row');
    expect(qfRow).toBeDefined();
    (qfRow!.props.onClick as () => void)();

    tree = renderRoot(SpeedPanel, {});
    const problems = getProblemsForObject(proj, { type: 'zone', id: zId });
    const depProb = problems.find((p) => p.source === 'dependencies');
    expect(depProb).toBeDefined();
    const step1Opt = findByTestId(tree, `wf-sp-step-opt-${depProb!.id}`);
    expect(step1Opt).toBeDefined();
    (step1Opt!.props.onClick as () => void)();

    tree = renderRoot(SpeedPanel, {});
    const filterInput = findByTestId(tree, 'wf-sp-step-filter');
    expect(filterInput).toBeDefined();
    (filterInput!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Clear' } });
    tree = renderRoot(SpeedPanel, {});
    expect(findByTestId(tree, 'wf-sp-step-filter')!.props.value).toBe('Clear');
    const repairOpt = findByTestId(tree, 'wf-sp-step-opt-repair:0');
    expect(repairOpt).toBeDefined();
    (repairOpt!.props.onClick as () => void)();
    expect(useProjectStore.getState().project.zones[0].backgroundId).toBeUndefined();
    expect(useProjectStore.getState().undoStack.at(-1)?.label).toBe('Repair: Clear backgroundId');

    // 2) Step Back & Cancel from initialQuickFixFlow
    resetHooks();
    useProjectStore.getState().loadProject(structuredClone(proj));
    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    const qfInitial = { ...openQuickFixFlow({ type: 'zone', id: zId }, problems, proj), selectedProblemId: depProb!.id };
    let qfTree = renderRoot(SpeedPanel, { initialQuickFixFlow: qfInitial });
    const backBtn = findByTestId(qfTree, 'wf-sp-step-back');
    expect(backBtn).toBeDefined();
    (backBtn!.props.onClick as () => void)();
    qfTree = renderRoot(SpeedPanel, { initialQuickFixFlow: qfInitial });
    expect(findByTestId(qfTree, `wf-sp-step-opt-${depProb!.id}`)).toBeDefined();
    const closeBtn = findByAriaLabel(qfTree, 'Cancel step flow');
    expect(closeBtn).toBeDefined();
    (closeBtn!.props.onClick as () => void)();
    expect(useEditorStore.getState().speedPanelPosition).toBeNull();

    // 3) Create Macro JSX view handlers (name input, action checkbox, pin checkbox, form submit, back/cancel)
    resetHooks();
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    const createInit = openCreateMacroState([
      { id: 'ra-1', commandId: 'set-elevation', label: 'Set Elevation (3)', timestamp: Date.now(), args: { kind: 'set-elevation', elevation: 3 } },
      { id: 'ra-2', commandId: 'fit-content', label: 'Zoom to Fit', timestamp: Date.now() },
    ]);
    let cmTree = renderRoot(SpeedPanel, { initialCreateMacroState: createInit });
    (collectAll(cmTree, (el) => el.type === 'form')[0].props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: () => {} });
    cmTree = renderRoot(SpeedPanel, { initialCreateMacroState: createInit });
    (findByTestId(cmTree, 'wf-sp-create-macro-name')!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Elevation Macro' } });
    cmTree = renderRoot(SpeedPanel, { initialCreateMacroState: createInit });
    (findByTestId(cmTree, 'wf-sp-recent-action-0')!.props.onChange as () => void)();
    cmTree = renderRoot(SpeedPanel, { initialCreateMacroState: createInit });
    (findByTestId(cmTree, 'wf-sp-recent-action-0')!.props.onChange as () => void)();
    cmTree = renderRoot(SpeedPanel, { initialCreateMacroState: createInit });
    (findByTestId(cmTree, 'wf-sp-create-macro-pin')!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });
    cmTree = renderRoot(SpeedPanel, { initialCreateMacroState: createInit });
    const cmForm = collectAll(cmTree, (el) => el.type === 'form')[0];
    (cmForm.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: () => {} });
    expect(useSpeedPanelPins.getState().macros.some((m) => m.name === 'Elevation Macro')).toBe(true);

    // Back / Cancel on Create Macro
    resetHooks();
    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    const cmTree2 = renderRoot(SpeedPanel, { initialCreateMacroState: createInit });
    const cmBack = findByAriaLabel(cmTree2, 'Back to Speed Panel');
    const cmCancel = findByAriaLabel(cmTree2, 'Cancel create macro');
    expect(cmBack).toBeDefined();
    expect(cmCancel).toBeDefined();
    (cmBack!.props.onClick as () => void)();
    const afterCmBack = renderRoot(SpeedPanel, { initialCreateMacroState: createInit });
    expect(findByTestId(afterCmBack, 'wf-speed-panel-search')).toBeDefined();
    (cmCancel!.props.onClick as () => void)();
    expect(useEditorStore.getState().speedPanelPosition).toBeNull();

    // 4) Replace Macro Missing Reference JSX handlers
    resetHooks();
    const pMissing = structuredClone(minimalProject);
    const firstDistId = pMissing.districts[0]?.id;
    const firstDistName = pMissing.districts[0]?.name;
    expect(firstDistId).toBeDefined();
    expect(firstDistName).toBeDefined();
    pMissing.districts = pMissing.districts.map((d) => ({
      ...d,
      zoneIds: d.zoneIds.filter((id) => id !== zId),
    }));
    useProjectStore.getState().loadProject(pMissing);
    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    const macroMissing = {
      id: 'm-miss',
      name: 'Missing Dist Macro',
      steps: [{ actionId: 'assign-district', args: { kind: 'assign-district' as const, districtId: 'missing-dist-id' } }],
    };
    const valRes = validateMacroExecution(
      macroMissing,
      pMissing,
      BUILTIN_REGION_PRESETS,
      BUILTIN_ENCOUNTER_PRESETS,
      { type: 'zone', id: zId },
      useEditorStore.getState().selection,
    );
    if (valRes.ok) {
      throw new Error('Expected validateMacroExecution to detect missing district reference');
    }
    const replaceFlow: MacroReplaceFlowState = {
      macro: macroMissing,
      context: { type: 'zone', id: zId },
      missingRefs: valRes.missingRefs,
      currentIndex: 0,
      replacements: {},
      filter: '',
      activeIdx: 0,
    };

    // Filter + Back to root panel
    let repTree = renderRoot(SpeedPanel, { initialMacroReplaceFlow: replaceFlow });
    const repFilter = findByTestId(repTree, 'wf-sp-step-filter');
    expect(repFilter).toBeDefined();
    (repFilter!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: firstDistName! } });
    repTree = renderRoot(SpeedPanel, { initialMacroReplaceFlow: replaceFlow });
    expect(findByTestId(repTree, 'wf-sp-step-filter')!.props.value).toBe(firstDistName!);
    const repOptCheck = collectAll(repTree, (el) => typeof el.props['data-testid'] === 'string' && (el.props['data-testid'] as string).startsWith('wf-sp-step-opt-'))[0];
    expect(repOptCheck).toBeDefined();
    const repBack = findByTestId(repTree, 'wf-sp-step-back');
    expect(repBack).toBeDefined();
    (repBack!.props.onClick as () => void)();
    repTree = renderRoot(SpeedPanel, { initialMacroReplaceFlow: replaceFlow });
    expect(findByTestId(repTree, 'wf-speed-panel-search')).toBeDefined();

    // Apply replacement option -> assigns replacement district
    resetHooks();
    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    repTree = renderRoot(SpeedPanel, { initialMacroReplaceFlow: replaceFlow });
    const applyRepOpt = collectAll(repTree, (el) => typeof el.props['data-testid'] === 'string' && (el.props['data-testid'] as string).startsWith('wf-sp-step-opt-'))[0];
    expect(applyRepOpt).toBeDefined();
    (applyRepOpt!.props.onClick as () => void)();
    expect(
      useProjectStore.getState().project.districts.find((d) => d.id === firstDistId)?.zoneIds.includes(zId),
    ).toBe(true);

    // Cancel step flow closes panel
    resetHooks();
    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    const cancelRepTree = renderRoot(SpeedPanel, { initialMacroReplaceFlow: replaceFlow });
    const repClose = findByAriaLabel(cancelRepTree, 'Cancel step flow');
    expect(repClose).toBeDefined();
    (repClose!.props.onClick as () => void)();
    expect(useEditorStore.getState().speedPanelPosition).toBeNull();

    // 5) Edit mode buttons + macro edits + group edits + Band 4 macro + search + Escape keyDown + step input flow
    resetHooks();
    useEditorStore.getState().clearSelection();
    useEditorStore.setState({
      speedPanelPosition: { x: 100, y: 100 },
      speedPanelContext: null,
      speedPanelEditMode: true,
    });
    useSpeedPanelPins.setState({
      pinnedIds: ['fit-content'],
      macros: [
        { id: 'm-edit', name: 'Pinned Macro', pinned: true, steps: [{ actionId: 'fit-content' }, { actionId: 'open-review' }] },
        { id: 'm-band4', name: 'Unpinned Macro', pinned: false, steps: [{ actionId: 'open-review' }] },
      ],
      groups: [{ id: 'g-custom', name: 'Custom Set', actionIds: ['fit-content'] }],
    });

    let editTree = renderRoot(SpeedPanel, {});
    const macroInput = findByAriaLabel(editTree, 'Macro name for Pinned Macro');
    expect(macroInput).toBeDefined();
    (macroInput!.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });
    (macroInput!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Pinned Renamed' } });
    expect(useSpeedPanelPins.getState().macros.find((m) => m.id === 'm-edit')?.name).toBe('Pinned Renamed');

    editTree = renderRoot(SpeedPanel, {});
    const expandBtn = findByAriaLabel(editTree, 'Edit steps for Pinned Renamed');
    expect(expandBtn).toBeDefined();
    (expandBtn!.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });

    editTree = renderRoot(SpeedPanel, {});
    const moveDownBtn = findByAriaLabel(editTree, 'Move step 1 down');
    expect(moveDownBtn).toBeDefined();
    (moveDownBtn!.props.onClick as () => void)();
    expect(useSpeedPanelPins.getState().macros.find((m) => m.id === 'm-edit')!.steps.map((s) => s.actionId)).toEqual([
      'open-review',
      'fit-content',
    ]);

    editTree = renderRoot(SpeedPanel, {});
    const moveUpBtn = findByAriaLabel(editTree, 'Move step 2 up');
    expect(moveUpBtn).toBeDefined();
    (moveUpBtn!.props.onClick as () => void)();
    expect(useSpeedPanelPins.getState().macros.find((m) => m.id === 'm-edit')!.steps.map((s) => s.actionId)).toEqual([
      'fit-content',
      'open-review',
    ]);

    editTree = renderRoot(SpeedPanel, {});
    const addStepSelect = collectAll(editTree, (el) => el.type === 'select')[0];
    expect(addStepSelect).toBeDefined();
    (addStepSelect!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'export-summary' } });
    expect(useSpeedPanelPins.getState().macros.find((m) => m.id === 'm-edit')!.steps.map((s) => s.actionId)).toEqual([
      'fit-content',
      'open-review',
      'export-summary',
    ]);

    editTree = renderRoot(SpeedPanel, {});
    const removeStepBtn = findByAriaLabel(editTree, 'Remove step 1');
    expect(removeStepBtn).toBeDefined();
    (removeStepBtn!.props.onClick as () => void)();
    expect(useSpeedPanelPins.getState().macros.find((m) => m.id === 'm-edit')!.steps.map((s) => s.actionId)).toEqual([
      'open-review',
      'export-summary',
    ]);

    const newMacroBtn = findButtonByText(editTree, '+ New Macro');
    expect(newMacroBtn).toBeDefined();
    (newMacroBtn!.props.onClick as () => void)();
    expect(useSpeedPanelPins.getState().macros.some((m) => m.name === 'New Macro')).toBe(true);

    const delMacroBtn = findByAriaLabel(editTree, 'Delete macro Pinned Renamed');
    expect(delMacroBtn).toBeDefined();
    (delMacroBtn!.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });
    expect(useSpeedPanelPins.getState().macros.some((m) => m.id === 'm-edit')).toBe(false);

    const grpInput = findByAriaLabel(editTree, 'Group name for Custom Set');
    expect(grpInput).toBeDefined();
    (grpInput!.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });
    (grpInput!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Renamed Set' } });
    expect(useSpeedPanelPins.getState().groups.find((g) => g.id === 'g-custom')?.name).toBe('Renamed Set');

    editTree = renderRoot(SpeedPanel, {});
    const delGrpBtn = findByAriaLabel(editTree, 'Delete group Renamed Set');
    expect(delGrpBtn).toBeDefined();
    (delGrpBtn!.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });
    expect(useSpeedPanelPins.getState().groups.some((g) => g.id === 'g-custom')).toBe(false);

    const newGrpBtn = findButtonByText(editTree, '+ New Group');
    expect(newGrpBtn).toBeDefined();
    (newGrpBtn!.props.onClick as () => void)();
    expect(useSpeedPanelPins.getState().groups.some((g) => g.name === 'New Group')).toBe(true);

    // Band 4 unpinned macro click & search input
    useEditorStore.setState({ speedPanelEditMode: false });
    editTree = renderRoot(SpeedPanel, {});
    const b4MacroRow = collectAll(editTree, (el) => el.props.id === 'wf-sp-opt-b4-macro-m-band4')[0];
    expect(b4MacroRow).toBeDefined();
    (b4MacroRow!.props.onClick as () => void)();
    expect(useEditorStore.getState().speedPanelPosition).toBeNull();
    expect(useEditorStore.getState().rightTab).toBe('review');

    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    editTree = renderRoot(SpeedPanel, {});
    const searchBox = findByTestId(editTree, 'wf-speed-panel-search');
    expect(searchBox).toBeDefined();
    (searchBox!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'zoom' } });
    editTree = renderRoot(SpeedPanel, {});
    expect(findByTestId(editTree, 'wf-speed-panel-search')!.props.value).toBe('zoom');

    // Input step flow form submission & Escape keyDown
    resetHooks();
    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    const stepRes = openCommandStepFlow('set-elevation', { type: 'zone', id: zId }, productionStepStores());
    expect(stepRes.kind).toBe('steps');
    if (stepRes.kind !== 'steps') {
      throw new Error('Expected openCommandStepFlow("set-elevation") to return steps');
    }
    let stepTree = renderRoot(SpeedPanel, { initialStepFlow: stepRes.flow });
    const stepInput = findByTestId(stepTree, 'wf-sp-step-input');
    expect(stepInput).toBeDefined();
    (stepInput!.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '4' } });
    stepTree = renderRoot(SpeedPanel, { initialStepFlow: stepRes.flow });
    const stepForm = collectAll(stepTree, (el) => el.type === 'form')[0];
    expect(stepForm).toBeDefined();
    (stepForm!.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: () => {} });
    expect(useProjectStore.getState().project.zones[0].elevation).toBe(4);

    // Escape keyDown on open step flow closes panel without overwriting values
    resetHooks();
    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    const escTree = renderRoot(SpeedPanel, { initialStepFlow: stepRes.flow });
    const panelEl = findByTestId(escTree, 'wf-speed-panel');
    expect(panelEl).toBeDefined();
    (panelEl!.props.onKeyDown as (e: {
      key: string; code: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; target: unknown; preventDefault: () => void; stopPropagation: () => void;
    }) => void)({
      key: 'Escape', code: 'Escape', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null, preventDefault: () => {}, stopPropagation: () => {},
    });
    expect(useEditorStore.getState().speedPanelPosition).toBeNull();
  });

  it('notifies load warnings once on SpeedPanel mount without overwriting localStorage', () => {
    const rawV2 = JSON.stringify({
      version: 2,
      pins: ['fit-content', 'removed-cmd'],
      recentIds: [],
      usageCount: {},
      lastUsedAt: {},
      macros: [
        { id: 'm-gone', name: 'Dead Macro', steps: [{ actionId: 'removed-macro-step' }] },
      ],
      groups: [],
    });
    storage.set('wf.speedPanel.v2', rawV2);
    const warnings: string[] = [];
    const loaded = loadSpeedPanelStateV2(Date.now(), warnings);
    useSpeedPanelPins.setState({
      pinnedIds: loaded.pinnedIds,
      recentIds: loaded.recentIds,
      frecency: loaded.frecency,
      adaptiveHistory: loaded.adaptiveHistory,
      groups: loaded.groups,
      macros: loaded.macros,
      showRecents: loaded.showRecents,
      loadWarnings: warnings,
    });

    useEditorStore.setState({
      speedPanelPosition: { x: 80, y: 80 },
      speedPanelContext: { type: 'zone', id: minimalProject.zones[0].id },
    });
    renderRoot(SpeedPanel, {});
    flushEffects();

    const toasts = _getToastsForTest();
    expect(toasts).toHaveLength(1);
    expect(toasts[0].kind).toBe('warning');
    expect(toasts[0].message).toContain('removed-macro-step');
    expect(toasts[0].message).toContain('Dead Macro');
    expect(toasts[0].message).toContain('removed');
    expect(storage.get('wf.speedPanel.v2')).toBe(rawV2);

    // Second mount must not duplicate the notification
    resetHooks();
    renderRoot(SpeedPanel, {});
    flushEffects();
    expect(_getToastsForTest()).toHaveLength(1);
  });

  it('achieves exact WorldProject and undo-label parity between real DependencyPanel UI and SpeedPanel Quick Fix', () => {
    const brokenBase = structuredClone(minimalProject);
    const zId = brokenBase.zones[0].id;
    brokenBase.zones[0] = { ...brokenBase.zones[0], backgroundId: 'missing-bg-id' };

    // Clone A: drive the real DependencyPanel repair button click
    useProjectStore.getState().loadProject(structuredClone(brokenBase));
    const depTree = renderRoot(DependencyPanel, {});
    const repairButtons = collectAll(
      depTree,
      (el) => el.type === 'button' && textContent(el).trim() === 'Clear backgroundId',
    );
    expect(repairButtons.length).toBeGreaterThanOrEqual(1);
    (repairButtons[0].props.onClick as () => void)();
    const projectAfterDep = structuredClone(useProjectStore.getState().project);
    const undoAfterDep = useProjectStore.getState().undoStack.at(-1)?.label;
    expect(undoAfterDep).toBe('Repair: Clear backgroundId');
    expect(projectAfterDep.zones[0].backgroundId).toBeUndefined();

    // Clone B: drive SpeedPanel Quick Fix row -> dependency problem -> repair option click
    resetHooks();
    useProjectStore.getState().loadProject(structuredClone(brokenBase));
    useEditorStore.setState({
      speedPanelPosition: { x: 100, y: 100 },
      speedPanelContext: { type: 'zone', id: zId },
      speedPanelEditMode: false,
    });
    let spTree = renderRoot(SpeedPanel, {});
    const qfRow = findByTestId(spTree, 'wf-sp-quick-fix-row');
    expect(qfRow).toBeDefined();
    (qfRow!.props.onClick as () => void)();

    spTree = renderRoot(SpeedPanel, {});
    const depOpt = collectAll(
      spTree,
      (el) => typeof el.props['data-testid'] === 'string' && (el.props['data-testid'] as string).startsWith('wf-sp-step-opt-dep:'),
    )[0];
    expect(depOpt).toBeDefined();
    (depOpt!.props.onClick as () => void)();

    spTree = renderRoot(SpeedPanel, {});
    const spRepairOpt = findByTestId(spTree, 'wf-sp-step-opt-repair:0');
    expect(spRepairOpt).toBeDefined();
    (spRepairOpt!.props.onClick as () => void)();

    const projectAfterQuickFix = structuredClone(useProjectStore.getState().project);
    const undoAfterQuickFix = useProjectStore.getState().undoStack.at(-1)?.label;

    expect(undoAfterQuickFix).toBe(undoAfterDep);
    expect(projectAfterQuickFix).toEqual(projectAfterDep);
  });

  it('exercises mounted Canvas keydown hotkey and encounter-placement mousedown bindings', () => {
    const proj = structuredClone(minimalProject);
    const z0 = proj.zones[0];
    useProjectStore.getState().loadProject(proj);
    useEditorStore.getState().selectZone(z0.id, false);

    // Render mounted Canvas and flush effects to attach window/canvas listeners
    let tree = renderRoot(Canvas, {});
    flushEffects();

    // 1) Fire Ctrl+D through window keydown listener -> duplicates selected zone & records session action
    const zoneCountBefore = useProjectStore.getState().project.zones.length;
    dispatchWindowEvent('keydown', {
      key: 'd',
      code: 'KeyD',
      ctrlKey: true,
      metaKey: false,
      shiftKey: false,
      altKey: false,
      target: { tagName: 'BODY' },
      preventDefault: () => {},
      stopPropagation: () => {},
    });
    expect(useProjectStore.getState().project.zones.length).toBe(zoneCountBefore + 1);
    expect(useEditorStore.getState().recentPanelActions[0]?.commandId).toBe('duplicate');

    // 2) Switch to encounter-place tool, click inside zone[0] on <canvas>, and verify encounter + session recording
    useEditorStore.getState().setTool('encounter-place');
    tree = renderRoot(Canvas, {});
    const canvasEl = collectAll(tree, (el) => el.type === 'canvas')[0];
    expect(canvasEl).toBeDefined();

    const vp = useEditorStore.getState().viewport;
    const tileSize = useProjectStore.getState().project.map.tileSize;
    const clientX = ((z0.gridX + 0.5) * tileSize - vp.panX) * vp.zoom;
    const clientY = ((z0.gridY + 0.5) * tileSize - vp.panY) * vp.zoom;
    const encCountBefore = useProjectStore.getState().project.encounterAnchors.length;

    (canvasEl.props.onMouseDown as (e: {
      clientX: number;
      clientY: number;
      button: number;
      shiftKey: boolean;
      ctrlKey: boolean;
      preventDefault: () => void;
    }) => void)({
      clientX,
      clientY,
      button: 0,
      shiftKey: false,
      ctrlKey: false,
      preventDefault: () => {},
    });

    expect(useProjectStore.getState().project.encounterAnchors.length).toBe(encCountBefore + 1);
    expect(useEditorStore.getState().recentPanelActions[0]?.commandId).toBe('place-encounter');
  });
});
