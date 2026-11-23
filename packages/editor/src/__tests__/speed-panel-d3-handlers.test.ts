import { describe, it, expect, beforeEach, vi } from 'vitest';

const hookSlots: unknown[] = [];
let hookIdx = 0;

function resetHooks() {
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
    useEffect: () => {
      hookIdx++;
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
  recordCanvasEncounterSessionAction,
  recordCanvasHotkeySessionAction,
} from '../Canvas.js';
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
import { useSpeedPanelPins } from '../store/speed-panel-store.js';

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

describe('Speed Panel UI Handlers & Canvas Session Helpers', () => {
  beforeEach(() => {
    storage.clear();
    resetHooks();
    vi.restoreAllMocks();
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.getState().clearSelection();
    useEditorStore.getState().closeSpeedPanel();
    useEditorStore.getState().setRightTab('issues');
    useEditorStore.getState().setRightCollapsed(false);
    useSpeedPanelPins.setState({ pinnedIds: [], macros: [], groups: [] });
    useKitStore.getState().loadKits();
    (globalThis as Record<string, unknown>).window = (globalThis as Record<string, unknown>).window ?? globalThis;
    if (!globalThis.URL.createObjectURL) {
      globalThis.URL.createObjectURL = () => 'blob:mock-kit';
    }
    if (!globalThis.URL.revokeObjectURL) {
      globalThis.URL.revokeObjectURL = () => {};
    }
    (globalThis as Record<string, unknown>).document = (globalThis as Record<string, unknown>).document ?? {
      createElement: () => ({ href: '', download: '', click: () => {}, remove: () => {} }),
      body: { appendChild: () => {}, removeChild: () => {} },
    };
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

    // Click mode filter, All filter, and Start Project on the custom kit
    const allFilterBtn = findButtonByText(tree, 'All');
    if (allFilterBtn) (allFilterBtn.props.onClick as () => void)();
    const startButtons = collectAll(tree, (el) => el.type === 'button' && textContent(el).trim() === 'Start Project');
    expect(startButtons.length).toBeGreaterThan(0);
    (startButtons[startButtons.length - 1].props.onClick as () => void)();
    expect(closeSpy).toHaveBeenCalled();

    // Open Import Kit modal trigger branch cleanly on fresh render
    resetHooks();
    let freshTree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });
    const importBtn = findButtonByText(freshTree, 'Import Kit');
    expect(importBtn).toBeDefined();
    (importBtn!.props.onClick as () => void)();
    const dupButtons = collectAll(freshTree, (el) => el.type === 'button' && textContent(el).trim() === 'Duplicate');
    if (dupButtons[0]) (dupButtons[0].props.onClick as () => void)();
    const samplesTab = findButtonByText(freshTree, 'Sample Worlds');
    if (samplesTab) (samplesTab.props.onClick as () => void)();
    freshTree = renderRoot(TemplateManager, { onClose: closeSpy, initialTab: 'starters' });
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

    (nameInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Harbor Starter' } });
    (descInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Harbor desc' } });
    (iconInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'H' } });
    (tagsInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'harbor, docks' } });
    (presetCheck!.props.onChange as (e: { target: { checked: boolean } }) => void)({ target: { checked: true } });

    const modeButtons = collectAll(tree, (el) => el.type === 'button' && 'aria-pressed' in el.props);
    if (modeButtons[1]) (modeButtons[1].props.onClick as () => void)();

    tree = renderRoot(SaveKitModal, { onClose: closeSpy });
    const saveBtn = findButtonByText(tree, 'Save Kit')!;
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
    expect('error' in prepared).toBe(false);
    if (!('error' in prepared)) {
      const importTree = renderRoot(ImportKitModal, {
        onClose: importClose,
        initialResult: prepared,
      });
      const importActionBtn = findButtonByText(importTree, 'Import');
      if (importActionBtn) (importActionBtn.props.onClick as () => void)();
      const cancelBtn = findButtonByText(importTree, 'Cancel');
      if (cancelBtn) (cancelBtn.props.onClick as () => void)();
      expect(importClose).toHaveBeenCalled();
    }
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

    // 1) Root SpeedPanel -> click Quick Fix row -> Step 1 -> select problem -> Step 2 -> apply repair
    let tree = renderRoot(SpeedPanel, {});
    const qfRow = findByTestId(tree, 'wf-sp-quick-fix-row');
    expect(qfRow).toBeDefined();
    (qfRow!.props.onClick as () => void)();

    tree = renderRoot(SpeedPanel, {});
    const problems = getProblemsForObject(proj, { type: 'zone', id: zId });
    const depProb = problems.find((p) => p.source === 'dependencies')!;
    const step1Opt = findByTestId(tree, `wf-sp-step-opt-${depProb.id}`);
    expect(step1Opt).toBeDefined();
    (step1Opt!.props.onClick as () => void)();

    tree = renderRoot(SpeedPanel, {});
    const filterInput = findByTestId(tree, 'wf-sp-step-filter');
    if (filterInput) (filterInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Clear' } });
    tree = renderRoot(SpeedPanel, {});
    const repairOpt = findByTestId(tree, 'wf-sp-step-opt-repair:0');
    expect(repairOpt).toBeDefined();
    (repairOpt!.props.onClick as () => void)();
    expect(useProjectStore.getState().project.zones[0].backgroundId).toBeUndefined();
    expect(useProjectStore.getState().undoStack.at(-1)?.label).toMatch(/^Repair: /);

    // 2) Step Back & Cancel from initialQuickFixFlow
    resetHooks();
    useProjectStore.getState().loadProject(structuredClone(proj));
    useEditorStore.setState({ speedPanelPosition: { x: 100, y: 100 }, speedPanelContext: { type: 'zone', id: zId } });
    const qfInitial = { ...openQuickFixFlow({ type: 'zone', id: zId }, problems, proj), selectedProblemId: depProb.id };
    let qfTree = renderRoot(SpeedPanel, { initialQuickFixFlow: qfInitial });
    const backBtn = findByTestId(qfTree, 'wf-sp-step-back')!;
    (backBtn.props.onClick as () => void)();
    qfTree = renderRoot(SpeedPanel, { initialQuickFixFlow: qfInitial });
    const closeBtn = findByAriaLabel(qfTree, 'Cancel step flow')!;
    (closeBtn.props.onClick as () => void)();
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
    // Trigger form submit with blank name first to cover error alert rendering, then populate inputs across renders
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
    const cmBack = findByAriaLabel(cmTree2, 'Back to Speed Panel')!;
    const cmCancel = findByAriaLabel(cmTree2, 'Cancel create macro')!;
    (cmBack.props.onClick as () => void)();
    (cmCancel.props.onClick as () => void)();

    // 4) Replace Macro Missing Reference JSX handlers
    resetHooks();
    const pMissing = structuredClone(minimalProject);
    const firstDistId = pMissing.districts[0]?.id ?? 'd-fallback';
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
    expect(valRes.ok).toBe(false);
    if (!valRes.ok) {
      const replaceFlow: MacroReplaceFlowState = {
        macro: macroMissing,
        context: { type: 'zone', id: zId },
        missingRefs: valRes.missingRefs,
        currentIndex: 0,
        replacements: {},
        filter: '',
        activeIdx: 0,
      };
      let repTree = renderRoot(SpeedPanel, { initialMacroReplaceFlow: replaceFlow });
      const repFilter = findByTestId(repTree, 'wf-sp-step-filter');
      if (repFilter) (repFilter.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: firstDistId } });
      repTree = renderRoot(SpeedPanel, { initialMacroReplaceFlow: replaceFlow });
      const repOpt = collectAll(repTree, (el) => typeof el.props['data-testid'] === 'string' && (el.props['data-testid'] as string).startsWith('wf-sp-step-opt-'))[0];
      if (repOpt) (repOpt.props.onClick as () => void)();
      const repBack = findByTestId(repTree, 'wf-sp-step-back');
      if (repBack) (repBack.props.onClick as () => void)();
      const repClose = findByAriaLabel(repTree, 'Cancel step flow');
      if (repClose) (repClose.props.onClick as () => void)();
    }

    // 5) Edit mode buttons + macro edits + group edits + Band 4 macro + search + Escape keyDown + step input flow
    resetHooks();
    useEditorStore.setState({
      speedPanelPosition: { x: 100, y: 100 },
      speedPanelContext: { type: 'zone', id: zId },
      speedPanelEditMode: true,
    });
    useSpeedPanelPins.setState({
      pinnedIds: ['edit-props'],
      macros: [
        { id: 'm-edit', name: 'Pinned Macro', pinned: true, steps: [{ actionId: 'fit-content' }, { actionId: 'toggle-grid' }] },
        { id: 'm-band4', name: 'Unpinned Macro', pinned: false, steps: [{ actionId: 'fit-content' }] },
      ],
      groups: [{ id: 'g-custom', name: 'Custom Set', actionIds: ['fit-content'] }],
    });

    let editTree = renderRoot(SpeedPanel, {});
    const macroInput = findByAriaLabel(editTree, 'Macro name for Pinned Macro');
    if (macroInput) {
      (macroInput.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });
      (macroInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Pinned Renamed' } });
    }
    const expandBtn = findByAriaLabel(editTree, 'Edit steps for Pinned Macro');
    if (expandBtn) (expandBtn.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });
    editTree = renderRoot(SpeedPanel, {});
    const moveDownBtn = findByAriaLabel(editTree, 'Move step 1 down');
    if (moveDownBtn) (moveDownBtn.props.onClick as () => void)();
    const moveUpBtn = findByAriaLabel(editTree, 'Move step 2 up');
    if (moveUpBtn) (moveUpBtn.props.onClick as () => void)();
    const addStepSelect = collectAll(editTree, (el) => el.type === 'select')[0];
    if (addStepSelect) (addStepSelect.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'toggle-snap' } });
    const removeStepBtn = findByAriaLabel(editTree, 'Remove step 1');
    if (removeStepBtn) (removeStepBtn.props.onClick as () => void)();
    const newMacroBtn = findButtonByText(editTree, '+ New Macro');
    if (newMacroBtn) (newMacroBtn.props.onClick as () => void)();
    const delMacroBtn = findByAriaLabel(editTree, 'Delete macro Pinned Macro');
    if (delMacroBtn) (delMacroBtn.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });

    const grpInput = findByAriaLabel(editTree, 'Group name for Custom Set');
    if (grpInput) {
      (grpInput.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });
      (grpInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'Renamed Set' } });
    }
    const delGrpBtn = findByAriaLabel(editTree, 'Delete group Custom Set');
    if (delGrpBtn) (delGrpBtn.props.onClick as (e: { stopPropagation: () => void }) => void)({ stopPropagation: () => {} });
    const newGrpBtn = findButtonByText(editTree, '+ New Group');
    if (newGrpBtn) (newGrpBtn.props.onClick as () => void)();

    // Band 4 unpinned macro click & search input & backdrop
    useEditorStore.setState({ speedPanelEditMode: false });
    editTree = renderRoot(SpeedPanel, {});
    const b4MacroRow = collectAll(editTree, (el) => el.props.id === 'wf-sp-opt-b4-macro-m-band4')[0];
    if (b4MacroRow) (b4MacroRow.props.onClick as () => void)();
    const searchBox = findByTestId(editTree, 'wf-speed-panel-search');
    if (searchBox) (searchBox.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: 'zoom' } });

    // Input step flow form submission & Escape keyDown
    resetHooks();
    const stepRes = openCommandStepFlow('set-elevation', { type: 'zone', id: zId }, productionStepStores());
    if (stepRes.kind === 'steps') {
      let stepTree = renderRoot(SpeedPanel, { initialStepFlow: stepRes.flow });
      const stepInput = findByTestId(stepTree, 'wf-sp-step-input');
      if (stepInput) (stepInput.props.onChange as (e: { target: { value: string } }) => void)({ target: { value: '4' } });
      stepTree = renderRoot(SpeedPanel, { initialStepFlow: stepRes.flow });
      const stepForm = collectAll(stepTree, (el) => el.type === 'form')[0];
      if (stepForm) (stepForm.props.onSubmit as (e: { preventDefault: () => void }) => void)({ preventDefault: () => {} });
      const panelEl = findByTestId(stepTree, 'wf-speed-panel');
      if (panelEl) {
        (panelEl.props.onKeyDown as (e: {
          key: string; code: string; altKey: boolean; ctrlKey: boolean; metaKey: boolean; shiftKey: boolean; target: unknown; preventDefault: () => void; stopPropagation: () => void;
        }) => void)({
          key: 'Escape', code: 'Escape', altKey: false, ctrlKey: false, metaKey: false, shiftKey: false, target: null, preventDefault: () => {}, stopPropagation: () => {},
        });
      }
    }
  });
});
