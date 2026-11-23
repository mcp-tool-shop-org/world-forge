import { describe, it, expect, beforeEach, vi } from 'vitest';

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

import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import type { AuthoringMode } from '@world-forge/schema';
import {
  COMMAND_REGISTRY,
  CONTEXT_DECKS,
  CATALOGUE_GROUPS,
  getCommandById,
  getContextDeckCommands,
  getContextDeckKey,
  getCommandBadge,
  getCommandShortcutLabel,
  getHotkeyBindingsFromRegistry,
  type ContextDeckKey,
  type CommandContext,
} from '../command-registry.js';
import {
  ADAPTIVE_DAILY_DECAY,
  FRECENCY_HALF_LIFE_DAYS,
  MS_PER_DAY,
  bumpAdaptiveHistory,
  bumpFrecency,
  computeDecayedAdaptiveScore,
  computeDecayedFrecency,
  damerauLevenshteinAtMostOne,
  matchCommand,
  searchCommands,
} from '../speed-panel-search.js';
import {
  MAX_BAND3_RECENTS,
  buildSpeedPanelView,
  buildUnsearchedSpeedPanel,
} from '../speed-panel-layout.js';
import {
  MAX_ADAPTIVE_HISTORY,
  SPEED_PANEL_STATE_V2_KEY,
  loadSpeedPanelStateV2,
  pruneAdaptiveHistory,
  useSpeedPanelPins,
} from '../store/speed-panel-store.js';
import { executeRegistryCommand, buildExecuteStores } from '../speed-panel-execute.js';
import { productionHotkeyContext } from '../panels/speed-panel-stores.js';
import { CommandBadgeLabel, HighlightedText, SpeedPanel } from '../panels/SpeedPanel.js';
import { OptionsModal } from '../panels/OptionsModal.js';
import { useEditorStore, emptySelection } from '../store/editor-store.js';
import { useProjectStore } from '../store/project-store.js';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import type { HitResult } from '../hit-testing.js';

const DECK_HIT_SAMPLES: Record<ContextDeckKey, HitResult | null> = {
  zone: { type: 'zone', id: 'zone-entrance' },
  entity: { type: 'entity', id: 'npc-keeper' },
  connection: { type: 'connection', id: 'zone-entrance::zone-cellar' },
  landmark: { type: 'landmark', id: 'lm-altar' },
  spawn: { type: 'spawn', id: 'sp-default' },
  encounter: { type: 'encounter', id: 'enc-cellar' },
  item: { type: 'item', id: 'item-key' },
  empty: null,
};

function resetAllStores() {
  storage.clear();
  useProjectStore.getState().loadProject(structuredClone(minimalProject));
  useEditorStore.getState().clearSelection();
  useEditorStore.getState().closeSpeedPanel();
  useSpeedPanelPins.setState({
    pinnedIds: [],
    recentIds: [],
    frecency: {},
    adaptiveHistory: {},
    groups: [],
    macros: [],
    showRecents: true,
  });
}

describe('Speed Panel C3 Four-Band layout, frecency, and pins (changed)', () => {
  beforeEach(resetAllStores);

  it('changed: Band 1 defines a fixed 4–5 slot deck per hit type matching the zone spec and never shifts across 100 simulated runs', () => {
    expect(CONTEXT_DECKS.zone).toEqual([
      'edit-props',
      'connect-from',
      'place-entity',
      'place-encounter',
      'duplicate',
    ]);

    // Extra hit types resolve cleanly
    expect(getContextDeckKey({ type: 'prop', id: 'p1' })).toBe('item');
    expect(getContextDeckKey({ type: 'market', id: 'm1' })).toBe('item');

    const modes: AuthoringMode[] = ['dungeon', 'district', 'world', 'ocean', 'space', 'interior', 'wilderness'];
    const now = 1_700_000_000_000;

    for (const [key, hit] of Object.entries(DECK_HIT_SAMPLES) as Array<[ContextDeckKey, HitResult | null]>) {
      const baseline = getContextDeckCommands(hit).map((c) => c.id);
      expect(baseline.length).toBeGreaterThanOrEqual(4);
      expect(baseline.length).toBeLessThanOrEqual(5);
      expect(baseline).toEqual([...CONTEXT_DECKS[key]]);

      // Simulate 100 runs of other commands (and varying modes + pins)
      let frecency: Record<string, { score: number; lastUsedAt: number; count: number }> = {};
      for (let i = 0; i < 100; i++) {
        const other = COMMAND_REGISTRY[(i * 7 + 3) % COMMAND_REGISTRY.length];
        frecency[other.id] = bumpFrecency(frecency[other.id], now + i * 1000);
        const mode = modes[i % modes.length];
        const pins = ['merge-zones', 'export-summary', 'duplicate'];
        const view = buildUnsearchedSpeedPanel(
          COMMAND_REGISTRY,
          { hit, selection: emptySelection() },
          { pinnedIds: pins, frecency, mode, nowMs: now + i * 1000 },
        );
        expect(view.band1Deck.map((r) => r.command.id)).toEqual(baseline);
      }
    }
  });

  it('changed: pinning copies commands into Band 2 while keeping originals in Band 1 / Band 4, and reorderPin persists under wf.speedPanel.v2', () => {
    const store = useSpeedPanelPins.getState();
    store.togglePin('edit-props'); // Band 1 slot 1 on zone
    store.togglePin('delete');     // Band 4 Author on zone
    store.togglePin('merge-zones'); // Band 4 Author (blocked on 1 zone)

    const view = buildUnsearchedSpeedPanel(
      COMMAND_REGISTRY,
      { hit: DECK_HIT_SAMPLES.zone, selection: emptySelection() },
      { pinnedIds: useSpeedPanelPins.getState().pinnedIds },
    );

    // Copied into Band 2 in exact user order
    expect(view.band2Pinned.map((r) => r.command.id)).toEqual(['edit-props', 'delete', 'merge-zones']);
    // Originals stay in Band 1 and Band 4 Catalogue
    expect(view.band1Deck.map((r) => r.command.id)).toContain('edit-props');
    const band4AuthorIds = view.band4Catalogue
      .find((g) => g.group === 'Author')!
      .rows.map((r) => r.command.id);
    expect(band4AuthorIds).toContain('delete');
    expect(band4AuthorIds).toContain('merge-zones');

    // Reorder persists into wf.speedPanel.v2 and survives fresh load
    useSpeedPanelPins.getState().reorderPin(2, 0);
    expect(useSpeedPanelPins.getState().pinnedIds).toEqual(['merge-zones', 'edit-props', 'delete']);
    const savedRaw = storage.get(SPEED_PANEL_STATE_V2_KEY);
    expect(savedRaw).toBeTruthy();
    expect(JSON.parse(savedRaw!).pinnedIds).toEqual(['merge-zones', 'edit-props', 'delete']);
    expect(loadSpeedPanelStateV2().pinnedIds).toEqual(['merge-zones', 'edit-props', 'delete']);
  });

  it('changed: Band 3 shows up to 3 frecency-ranked commands excluding Band 1 & Band 2, uses 30-day half-life decay, and obeys showRecents toggle', () => {
    const day0 = 1_700_000_000_000;
    const day30 = day0 + FRECENCY_HALF_LIFE_DAYS * MS_PER_DAY;
    const entry = bumpFrecency(undefined, day0);
    expect(computeDecayedFrecency(entry, day0)).toBeCloseTo(1, 6);
    expect(computeDecayedFrecency(entry, day30)).toBeCloseTo(0.5, 6);
    expect(computeDecayedFrecency(entry, day0 + 60 * MS_PER_DAY)).toBeCloseTo(0.25, 6);

    // 5 candidates on zone hit: 1 in Band 1 (`edit-props`), 1 pinned (`delete`), 4 others (`assign-district`, `set-elevation`, `merge-zones`, `tool-zone`)
    const frecency = {
      'edit-props': { score: 50, lastUsedAt: day30, count: 50 }, // excluded: in Band 1
      delete: { score: 40, lastUsedAt: day30, count: 40 },       // excluded: in Band 2 (pinned)
      'assign-district': { score: 4, lastUsedAt: day0, count: 4 }, // decayed over 30d -> 2.0
      'set-elevation': { score: 3, lastUsedAt: day30, count: 3 },  // fresh -> 3.0 (wins #1!)
      'merge-zones': { score: 2.5, lastUsedAt: day30, count: 2 },  // fresh -> 2.5 (#2)
      'tool-zone': { score: 1, lastUsedAt: day30, count: 1 },      // 4th eligible -> trimmed by cap 3
    };

    const view = buildUnsearchedSpeedPanel(
      COMMAND_REGISTRY,
      { hit: DECK_HIT_SAMPLES.zone, selection: emptySelection() },
      { pinnedIds: ['delete'], frecency, showRecents: true, nowMs: day30 },
    );
    expect(view.band3Recents).toHaveLength(MAX_BAND3_RECENTS);
    expect(view.band3Recents.map((r) => r.command.id)).toEqual([
      'set-elevation',
      'merge-zones',
      'assign-district',
    ]);

    // Toggling showRecents off hides Band 3 cleanly and persists in wf.speedPanel.v2
    useSpeedPanelPins.getState().setShowRecents(false);
    expect(loadSpeedPanelStateV2().showRecents).toBe(false);
    const hiddenView = buildUnsearchedSpeedPanel(
      COMMAND_REGISTRY,
      { hit: DECK_HIT_SAMPLES.zone, selection: emptySelection() },
      { pinnedIds: ['delete'], frecency, showRecents: useSpeedPanelPins.getState().showRecents, nowMs: day30 },
    );
    expect(hiddenView.band3Recents).toEqual([]);
  });

  it('changed: Band 4 places mode suggestions and custom groups in fixed order after Band 3 without disturbing Band 1', () => {
    const view = buildUnsearchedSpeedPanel(
      COMMAND_REGISTRY,
      { hit: DECK_HIT_SAMPLES.zone, selection: emptySelection() },
      {
        mode: 'dungeon',
        groups: [{ id: 'g1', name: 'Zone Quick', actionIds: ['set-elevation', 'swap-direction'] }],
      },
    );
    expect(view.band4ModeSuggested.map((r) => r.command.id)).toEqual(['add-secret-conn']);
    expect(view.band4CustomGroups).toHaveLength(1);
    expect(view.band4CustomGroups[0].rows.map((r) => r.command.id)).toEqual(['set-elevation']);
    expect(view.band4Catalogue.map((s) => s.group)).toEqual([
      'Author',
      'Connect',
      'Inspect',
      'View',
      'Export',
    ]);
    // Every group name comes from canonical CATALOGUE_GROUPS
    for (const s of view.band4Catalogue) {
      expect(CATALOGUE_GROUPS).toContain(s.group);
    }
  });
});

describe('Speed Panel C3 search tiers, synonyms, highlighting, unavailable rules, live badges, and v2 migration (changed)', () => {
  beforeEach(resetAllStores);

  it('changed: search follows fixed query->top-result table across tiers, initials, synonyms, and 1-typo 4+ words', () => {
    const zoneCtx: CommandContext = { hit: DECK_HIT_SAMPLES.zone, selection: emptySelection() };
    const twoZoneCtx: CommandContext = {
      hit: DECK_HIT_SAMPLES.zone,
      selection: { ...emptySelection(), zones: ['zone-entrance', 'zone-cellar'] },
    };
    const emptyCtx: CommandContext = { hit: null, selection: emptySelection() };
    const connCtx: CommandContext = { hit: DECK_HIT_SAMPLES.connection, selection: emptySelection() };

    const cases: Array<{ query: string; ctx: CommandContext; expectedTop: string; mode?: AuthoringMode }> = [
      { query: 'dup', ctx: zoneCtx, expectedTop: 'duplicate' },
      { query: 'mer', ctx: twoZoneCtx, expectedTop: 'merge-zones' },
      { query: 'pe', ctx: zoneCtx, expectedTop: 'place-entity' },
      { query: 'dsc', ctx: zoneCtx, expectedTop: 'add-secret-conn' },
      { query: 'sc', ctx: zoneCtx, expectedTop: 'add-secret-conn' },
      { query: 'conn warp', ctx: zoneCtx, expectedTop: 'add-warp-conn', mode: 'space' },
      { query: '[Connect] warp', ctx: zoneCtx, expectedTop: 'add-warp-conn' },
      { query: 'npc', ctx: zoneCtx, expectedTop: 'place-entity' },
      { query: 'merchant', ctx: zoneCtx, expectedTop: 'place-entity' },
      { query: 'boss', ctx: zoneCtx, expectedTop: 'place-encounter' },
      { query: 'fight', ctx: zoneCtx, expectedTop: 'place-encounter' },
      { query: 'room', ctx: emptyCtx, expectedTop: 'new-zone' },
      { query: 'basement', ctx: zoneCtx, expectedTop: 'set-elevation' },
      { query: 'cliff', ctx: zoneCtx, expectedTop: 'set-elevation' },
      { query: 'duplciate', ctx: zoneCtx, expectedTop: 'duplicate' },
      { query: 'mrchant', ctx: zoneCtx, expectedTop: 'place-entity' },
      { query: 'mrege', ctx: twoZoneCtx, expectedTop: 'merge-zones' },
      { query: 'enocunter', ctx: zoneCtx, expectedTop: 'place-encounter' },
      { query: 'swap', ctx: connCtx, expectedTop: 'swap-direction' },
    ];

    for (const c of cases) {
      const res = searchCommands(COMMAND_REGISTRY, c.ctx, c.query, { mode: c.mode });
      expect(res.enabled.length, `query "${c.query}" produced no enabled results`).toBeGreaterThan(0);
      expect(res.enabled[0].command.id, `query "${c.query}"`).toBe(c.expectedTop);
    }

    // 1-typo tolerance covers substitution, insertion/deletion, transposition, and rejects distance > 1 or < 4 chars
    expect(damerauLevenshteinAtMostOne('duplciate', 'duplicate')).toBe(true);
    expect(damerauLevenshteinAtMostOne('duplacate', 'duplicate')).toBe(true);
    expect(damerauLevenshteinAtMostOne('duplcate', 'duplicate')).toBe(true);
    expect(damerauLevenshteinAtMostOne('duplicatte', 'duplicate')).toBe(true);
    expect(damerauLevenshteinAtMostOne('dxxxxxxx', 'duplicate')).toBe(false);
    expect(damerauLevenshteinAtMostOne('duplxxate', 'duplicate')).toBe(false);
    expect(matchCommand(getCommandById('duplicate')!, 'duz')).toBeNull();
  });

  it('changed: high frecency never outranks a better match tier, and adaptive history promotes within query validity', () => {
    const now = 1_700_000_000_000;
    const zoneCtx: CommandContext = { hit: DECK_HIT_SAMPLES.zone, selection: emptySelection() };

    // Huge frecency on `place-entity` (matches `pe` at Tier 2; `New Zone` doesn't, `Set Elevation`? Pick `Duplicate` vs `Delete`:
    // query `zon` -> `Zone Tool` (Tier 1 prefix) vs `New Zone` (Tier 2 word-start) / `Merge Zones` (Tier 2 word-start))
    const skewedFrecency = {
      'new-zone': { score: 9999, lastUsedAt: now, count: 9999 },
      'merge-zones': { score: 9999, lastUsedAt: now, count: 9999 },
    };
    const res = searchCommands(
      COMMAND_REGISTRY,
      { hit: null, selection: emptySelection() },
      'zon',
      { frecency: skewedFrecency, nowMs: now },
    );
    expect(res.enabled[0].command.id).toBe('tool-zone');
    expect(res.enabled[0].tier).toBe(1);

    // Same-tier frecency breaks ties (`pe` hits both `place-entity` and `place-encounter` at Tier 2)
    const tieFrecency = {
      'place-encounter': { score: 50, lastUsedAt: now, count: 50 },
    };
    const tieRes = searchCommands(COMMAND_REGISTRY, zoneCtx, 'pe', { frecency: tieFrecency, nowMs: now });
    expect(tieRes.enabled[0].command.id).toBe('place-encounter');

    // Tier 0 Adaptive History (`0.975`/day decay) promotes prior choice for that query only when it still matches
    let ah = bumpAdaptiveHistory(undefined, 'place-encounter', now);
    expect(computeDecayedAdaptiveScore(ah, now + 10 * MS_PER_DAY)).toBeCloseTo(
      Math.pow(ADAPTIVE_DAILY_DECAY, 10),
      5,
    );
    const adaptiveRes = searchCommands(COMMAND_REGISTRY, zoneCtx, 'pe', {
      adaptiveHistory: { pe: ah },
      nowMs: now,
    });
    expect(adaptiveRes.enabled[0].command.id).toBe('place-encounter');
    expect(adaptiveRes.enabled[0].tier).toBe(0);

    // Unrelated query does not falsely promote `place-encounter` via `pe` history
    const unrelatedRes = searchCommands(COMMAND_REGISTRY, zoneCtx, 'dup', {
      adaptiveHistory: { pe: ah },
      nowMs: now,
    });
    expect(unrelatedRes.enabled[0].command.id).toBe('duplicate');
    expect(unrelatedRes.enabled[0].tier).toBe(1);
  });

  it('changed: every one of the 43 registry commands reaches Rank #1 within 3 keystrokes and returns matchRanges for highlighting', () => {
    const shortestQueryForCommand: Record<string, string> = {
      'new-zone': 'nz',
      'fit-content': 'fit',
      'edit-props': 'ep',
      delete: 'del',
      duplicate: 'dup',
      'assign-district': 'ad',
      'place-entity': 'npc',
      'place-encounter': 'foe',
      'connect-from': 'cfh',
      'swap-direction': 'swa',
      'add-secret-conn': 'dsc',
      'add-channel-conn': 'dcc',
      'add-warp-conn': 'dwc',
      'add-trail-conn': 'dtc',
      'merge-zones': 'mz',
      'set-elevation': 'set',
      'open-review': 'or',
      'export-summary': 'exp',
      search: 'oso',
      save: 'sav',
      copy: 'cop',
      paste: 'pas',
      undo: 'und',
      redo: 'red',
      'select-all': 'all',
      escape: 'cle',
      'nudge-up': 'nsu',
      'nudge-down': 'nsd',
      'nudge-left': 'nsl',
      'nudge-right': 'nsr',
      'open-details': 'od',
      'apply-preset': 'app',
      'save-preset': 'kit',
      'tool-select': 'sel',
      'tool-zone': 'zon',
      'tool-connection': 'ct',
      'tool-entity': 'ent',
      'tool-landmark': 'lan',
      'tool-spawn': 'spa',
      'tool-tile': 'til',
      'tool-prop': 'pro',
      'tool-encounter': 'enc',
      'tool-item': 'ite',
    };

    expect(Object.keys(shortestQueryForCommand).sort()).toEqual(COMMAND_REGISTRY.map((c) => c.id).sort());

    const emptyCtx: CommandContext = { hit: null, selection: emptySelection() };
    for (const cmd of COMMAND_REGISTRY) {
      const q = shortestQueryForCommand[cmd.id];
      expect(q.length, `query "${q}" for "${cmd.id}" exceeds 3 keystrokes`).toBeLessThanOrEqual(3);
      // Verify across matching context OR full-pool ranking (combining enabled + unavailable at equal context)
      const fullRes = searchCommands(COMMAND_REGISTRY, {
        hit: null,
        selection: { ...emptySelection(), zones: ['zone-entrance', 'zone-cellar'] },
      }, q);
      const combined = [...fullRes.enabled, ...fullRes.unavailable];
      expect(combined.length, `query "${q}" returned nothing`).toBeGreaterThan(0);

      // Find appropriate context where `cmd` is enabled or check global combined pool
      const m = matchCommand(cmd, q)!;
      expect(m, `command "${cmd.id}" did not match "${q}"`).toBeTruthy();
      expect(
        m.matchRanges.length > 0 || (m.matchedKeyword && m.matchedKeyword.ranges.length > 0),
        `command "${cmd.id}" missing highlight ranges for "${q}"`,
      ).toBe(true);

      // Rank #1 check when tested with enabled context (null, zone, or connection)
      const bestCtx: CommandContext =
        cmd.id === 'swap-direction'
          ? { hit: DECK_HIT_SAMPLES.connection, selection: emptySelection() }
          : cmd.id === 'new-zone' || cmd.id === 'fit-content' || cmd.id === 'open-review' || cmd.id === 'export-summary'
            ? emptyCtx
            : { hit: DECK_HIT_SAMPLES.zone, selection: { ...emptySelection(), zones: ['zone-entrance', 'zone-cellar'] } };
      const ranked = searchCommands(COMMAND_REGISTRY, bestCtx, q);
      expect(ranked.enabled[0]?.command.id, `command "${cmd.id}" with query "${q}"`).toBe(cmd.id);
    }
  });

  it('changed: two-state unavailable rule hides cross-type commands on empty search, keeps same-type blocked inline, and never hides on search', () => {
    const singleZoneCtx: CommandContext = {
      hit: { type: 'zone', id: 'zone-entrance' },
      selection: { ...emptySelection(), zones: ['zone-entrance'] },
    };

    // Empty search on single zone: `swap-direction` (connection) hidden; `merge-zones` (same-type blocked) kept with reason
    const unsearched = buildUnsearchedSpeedPanel(COMMAND_REGISTRY, singleZoneCtx);
    const authorIds = unsearched.band4Catalogue.find((g) => g.group === 'Author')!.rows;
    expect(authorIds.some((r) => r.command.id === 'swap-direction')).toBe(false);
    const mergeRow = authorIds.find((r) => r.command.id === 'merge-zones');
    expect(mergeRow).toBeDefined();
    expect(mergeRow!.disabledReason).toBe('Select at least 2 zones to merge');

    // Search `swap` on empty canvas: never hidden -> goes to Unavailable here with exact disabledReason
    const searchedSwap = searchCommands(
      COMMAND_REGISTRY,
      { hit: null, selection: emptySelection() },
      'swap',
    );
    expect(searchedSwap.enabled).toEqual([]);
    expect(searchedSwap.unavailable).toHaveLength(1);
    expect(searchedSwap.unavailable[0].command.id).toBe('swap-direction');
    expect(searchedSwap.unavailable[0].disabledReason).toBe(
      getCommandById('swap-direction')!.disabledReason({ hit: null }),
    );
  });

  it('changed: row badges read live from the active hotkey binding table and show uiPath when unbound', () => {
    const dupCmd = getCommandById('duplicate')!;
    const assignCmd = getCommandById('assign-district')!;
    expect(getCommandShortcutLabel(dupCmd)).toBe('Ctrl+D');
    expect(getCommandBadge(dupCmd)).toEqual({ kind: 'shortcut', text: 'Ctrl+D' });
    expect(getCommandBadge(assignCmd)).toEqual({
      kind: 'location',
      text: 'Right Sidebar \u2192 Map \u2192 District',
    });

    // Mutated / live hotkey table updates row badge without any hardcoded strings
    const customBindings = getHotkeyBindingsFromRegistry().map((b) =>
      b.action === 'duplicate' ? { ...b, label: 'Alt+Shift+D' } : b,
    );
    expect(getCommandBadge(dupCmd, customBindings)).toEqual({
      kind: 'shortcut',
      text: 'Alt+Shift+D',
    });

    const view = buildUnsearchedSpeedPanel(
      COMMAND_REGISTRY,
      { hit: DECK_HIT_SAMPLES.zone, selection: emptySelection() },
      { hotkeyBindings: customBindings },
    );
    expect(view.band1Deck.find((r) => r.command.id === 'duplicate')!.badge).toEqual({
      kind: 'shortcut',
      text: 'Alt+Shift+D',
    });
  });

  it('changed: executeRegistryCommand and productionHotkeyContext execute tool/global commands and render SpeedPanel & OptionsModal cleanly', () => {
    const stores = buildExecuteStores();
    const hctx = productionHotkeyContext();
    expect(executeRegistryCommand('tool-encounter', null, stores, hctx)).toEqual({
      executed: true,
    });
    expect(useEditorStore.getState().activeTool).toBe('encounter-place');

    // Blocked command fails closed with disabledReason
    const blocked = executeRegistryCommand('swap-direction', null, buildExecuteStores(), productionHotkeyContext());
    expect(blocked).toEqual({
      executed: false,
      reason: 'Target a connection to reverse it',
    });

    // Unknown command fails closed
    expect(executeRegistryCommand('non-existent-id', null, buildExecuteStores())).toEqual({
      executed: false,
      reason: 'unknown action',
    });

    // Exercise productionHotkeyContext callbacks cleanly
    expect(() => hctx.undo?.()).not.toThrow();
    expect(() => hctx.redo?.()).not.toThrow();
    expect(() => hctx.pasteClipboard?.()).not.toThrow();
    expect(() => hctx.applyPreset?.()).not.toThrow();
    expect(() => hctx.savePreset?.()).not.toThrow();
    const saveMock = vi.fn();
    productionHotkeyContext(saveMock).save?.();
    expect(saveMock).toHaveBeenCalledTimes(1);

    // Record usage updates recentIds, frecency, and adaptiveHistory
    useSpeedPanelPins.getState().recordCommandUsage('assign-district', 'ad', 1_700_000_000_000);
    useSpeedPanelPins.getState().recordCommandUsage('fit-content', 'fit', 1_700_000_000_100);
    const st = useSpeedPanelPins.getState();
    expect(st.recentIds[0]).toBe('fit-content');
    expect(st.frecency['fit-content'].count).toBe(1);
    expect(st.adaptiveHistory['fit'].commandId).toBe('fit-content');

    // Render SpeedPanel (unsearched all 4 bands + editMode + macros + groups) and OptionsModal markup
    useEditorStore.getState().openSpeedPanel(100, 120, { type: 'zone', id: 'zone-entrance' });
    useSpeedPanelPins.getState().togglePin('delete');
    useSpeedPanelPins.getState().addGroup({ id: 'g-ssr', name: 'SSR Group', actionIds: ['set-elevation'] });
    useSpeedPanelPins.getState().addMacro({ id: 'm-ssr', name: 'SSR Macro', steps: [{ actionId: 'duplicate' }] });
    useEditorStore.getState().toggleSpeedPanelEditMode();
    const spHtml = renderToStaticMarkup(createElement(SpeedPanel));
    expect(spHtml).toContain('data-testid="wf-sp-band-1"');
    expect(spHtml).toContain('data-testid="wf-sp-band-2"');
    expect(spHtml).toContain('data-testid="wf-sp-band-3"');
    expect(spHtml).toContain('data-testid="wf-sp-band-4"');
    // When only 1 zone exists in the world, merge-zones cannot start picking and renders disabled inline
    useProjectStore.getState().loadProject({
      ...structuredClone(minimalProject),
      zones: minimalProject.zones.slice(0, 1),
    });
    const oneZoneHtml = renderToStaticMarkup(createElement(SpeedPanel));
    expect(oneZoneHtml).toContain('aria-disabled="true"');
    expect(oneZoneHtml).toContain('Select at least 2 zones to merge');
    useProjectStore.getState().loadProject(structuredClone(minimalProject));
    useEditorStore.getState().toggleSpeedPanelEditMode();

    // Render HighlightedText & CommandBadgeLabel variants directly
    const hlHtml = renderToStaticMarkup(createElement(HighlightedText, { text: 'Draw Secret Connection', ranges: [[5, 11]] }));
    expect(hlHtml).toContain('<mark data-testid="wf-sp-highlight"');
    expect(hlHtml).toContain('>Secret</mark>');
    expect(renderToStaticMarkup(createElement(CommandBadgeLabel, { badge: { kind: 'shortcut', text: 'Ctrl+D' } }))).toContain('<kbd');
    expect(renderToStaticMarkup(createElement(CommandBadgeLabel, { badge: { kind: 'location', text: 'Right Sidebar' } }))).toContain('<span');
    expect(renderToStaticMarkup(createElement(CommandBadgeLabel, { badge: null }))).toBe('');

    const optHtml = renderToStaticMarkup(createElement(OptionsModal, { onClose: () => {} }));
    expect(optHtml).toContain('data-testid="wf-opt-show-recents"');

    // Malformed v2 localStorage payloads sanitize safely without crashing
    storage.set(SPEED_PANEL_STATE_V2_KEY, JSON.stringify({
      version: 2,
      pinnedIds: [123, 'edit-props'],
      recentIds: 'bad',
      frecency: { ok: { score: 2, lastUsedAt: 1000, count: 1 }, bad: { score: -1, lastUsedAt: 0, count: 0 } },
      adaptiveHistory: { fit: { commandId: 'fit-content', score: 1.5, lastUsedAt: 1000 }, bad: null },
      groups: [{ id: 'g', name: 'Ok', actionIds: ['delete'] }, 'bad'],
      macros: [{ id: 'm', name: 'M', steps: [{ actionId: 'duplicate' }, { actionId: 'does-not-exist' }] }],
      showRecents: 'bad',
    }));
    const sanitized = loadSpeedPanelStateV2();
    expect(sanitized.pinnedIds).toEqual(['delete']);
    expect(sanitized.recentIds).toEqual(['fit-content', 'assign-district']);
    expect(sanitized.showRecents).toBe(true);
    expect(sanitized.frecency).toEqual({ ok: { score: 2, lastUsedAt: 1000, count: 1 } });
    expect(sanitized.adaptiveHistory.fit?.commandId).toBe('fit-content');
    expect(sanitized.macros[0].steps).toEqual([{ actionId: 'duplicate' }]);

    // Search view builder attaches highlight ranges and unavailable matches
    const searchedView = buildSpeedPanelView(
      COMMAND_REGISTRY,
      { hit: null, selection: emptySelection() },
      'swap',
    );
    expect(searchedView.kind).toBe('searched');
    if (searchedView.kind === 'searched') {
      expect(searchedView.enabled).toEqual([]);
      expect(searchedView.unavailable[0].matchRanges).toEqual([[0, 4]]);
    }
  });

  it('changed: adaptiveHistory caps at MAX_ADAPTIVE_HISTORY (200) evicting lowest decayed score', () => {
    const now = 1_700_000_000_000;
    const many: Record<string, { commandId: string; score: number; lastUsedAt: number }> = {};
    for (let i = 0; i < MAX_ADAPTIVE_HISTORY + 15; i++) {
      many[`q-${i}`] = {
        commandId: 'fit-content',
        score: i === 5 ? 99 : 1,
        lastUsedAt: i < 20 && i !== 5 ? now - (20 - i) * 30 * MS_PER_DAY : now - i,
      };
    }
    const pruned = pruneAdaptiveHistory(many, now);
    expect(Object.keys(pruned)).toHaveLength(MAX_ADAPTIVE_HISTORY);
    expect(pruned['q-5']).toBeDefined();
    expect(pruned['q-0']).toBeUndefined();

    expect(MAX_ADAPTIVE_HISTORY).toBe(200);
    for (let i = 0; i < MAX_ADAPTIVE_HISTORY + 5; i++) {
      useSpeedPanelPins.getState().recordCommandUsage('fit-content', `hist-${i}`, now + i * 100);
    }
    expect(Object.keys(useSpeedPanelPins.getState().adaptiveHistory).length).toBeLessThanOrEqual(MAX_ADAPTIVE_HISTORY);
  });

  it('changed: loadSpeedPanelStateV2 falls back per-field to legacy keys on partial v2 corruption without losing data', () => {
    const now = 1_700_000_000_000;
    storage.set('world-forge-speed-panel-pins', JSON.stringify(['edit-props', 'duplicate']));
    storage.set('world-forge-speed-panel-recents', JSON.stringify(['fit-content', 'open-review']));
    storage.set('world-forge-speed-panel-groups', JSON.stringify([
      { id: 'g-legacy', name: 'Legacy Group', actionIds: ['assign-district'] },
    ]));
    storage.set('world-forge-speed-panel-macros', JSON.stringify([
      { id: 'm-legacy', name: 'Legacy Macro', steps: [{ actionId: 'duplicate' }] },
    ]));
    storage.set(SPEED_PANEL_STATE_V2_KEY, JSON.stringify({
      version: 2,
      pinnedIds: 'corrupt',
      recentIds: [42],
      frecency: 'corrupt',
      adaptiveHistory: { fit: { commandId: 'fit-content', score: 2, lastUsedAt: now } },
      groups: 'corrupt',
      macros: null,
      showRecents: false,
    }));

    const recovered = loadSpeedPanelStateV2(now);
    expect(recovered.pinnedIds).toEqual(['edit-props', 'duplicate']);
    expect(recovered.recentIds).toEqual(['fit-content', 'open-review']);
    expect(recovered.groups).toEqual([{ id: 'g-legacy', name: 'Legacy Group', actionIds: ['assign-district'] }]);
    expect(recovered.macros).toEqual([{ id: 'm-legacy', name: 'Legacy Macro', steps: [{ actionId: 'duplicate' }] }]);
    expect(recovered.frecency['fit-content']?.score).toBe(2);
    expect(recovered.adaptiveHistory.fit?.commandId).toBe('fit-content');
    expect(recovered.showRecents).toBe(false);
  });

  it('changed: assign-district and open-review do not force right sidebar open, and uiPaths match real UI controls', () => {
    const setRightCollapsed = vi.fn();
    const setRightTab = vi.fn();
    const selectZone = vi.fn();
    const stores = { ...buildExecuteStores(), setRightCollapsed, setRightTab, selectZone };

    expect(executeRegistryCommand('assign-district', DECK_HIT_SAMPLES.zone, stores)).toEqual({ executed: true });
    expect(selectZone).toHaveBeenCalledWith('zone-entrance', false);
    expect(setRightTab).toHaveBeenCalledWith('map');
    expect(setRightCollapsed).not.toHaveBeenCalled();

    expect(executeRegistryCommand('open-review', null, stores)).toEqual({ executed: true });
    expect(setRightTab).toHaveBeenCalledWith('review');
    expect(setRightCollapsed).not.toHaveBeenCalled();

    expect(getCommandById('swap-direction')?.uiPath).toBe('Right Sidebar \u2192 Map \u2192 Swap Direction');
    expect(getCommandById('export-summary')?.uiPath).toBe('Right Sidebar \u2192 Review \u2192 Export MD');
    expect(getCommandById('merge-zones')?.uiPath).toBeUndefined();
    expect(getCommandById('add-secret-conn')?.uiPath).toBeUndefined();
    expect(getCommandById('add-channel-conn')?.uiPath).toBeUndefined();
    expect(getCommandById('add-warp-conn')?.uiPath).toBeUndefined();
    expect(getCommandById('add-trail-conn')?.uiPath).toBeUndefined();
    expect(getCommandById('add-warp-conn')?.keywords).toContain('ftl');
    expect(getCommandById('add-warp-conn')?.keywords).not.toContain('ftL');
  });

  it('changed: covers exact title, group-only search, cross-keyword tokens, late initials, swapConnection, and frecency/mode tie-breaks', () => {
    const now = 1_700_000_000_000;
    const zoneCtx: CommandContext = { hit: DECK_HIT_SAMPLES.zone, selection: emptySelection() };

    // Exact title match => Tier 1 subRank 0
    const exactMatch = matchCommand(getCommandById('duplicate')!, 'duplicate', { nowMs: now });
    expect(exactMatch).toMatchObject({ tier: 1, subRank: 0 });

    // Bracket group only without text query => Tier 3 subRank 1 across that group
    const groupOnly = searchCommands(COMMAND_REGISTRY, zoneCtx, '[connect]', { nowMs: now });
    expect(groupOnly.enabled.some((m) => m.command.id === 'connect-from')).toBe(true);

    // Late-word contiguous initials (`sc` -> Draw [S]ecret [C]onnection) => Tier 2 subRank 2
    const scMatch = matchCommand(getCommandById('add-secret-conn')!, 'sc', { nowMs: now });
    expect(scMatch).toMatchObject({ tier: 2, subRank: 2 });

    // Word-start subsequence (`ssp` -> Save Selection as Preset) => Tier 2 subRank 3
    const sspMatch = matchCommand(getCommandById('save-preset')!, 'ssp', { nowMs: now });
    expect(sspMatch).toMatchObject({ tier: 2, subRank: 3 });

    // Multi-word across title + keyword (`npc place` -> Place Entity Here with keyword `npc`) => Tier 4 subRank 1
    const multiKw = searchCommands(COMMAND_REGISTRY, zoneCtx, 'npc place', { nowMs: now });
    expect(multiKw.enabled[0]?.command.id).toBe('place-entity');
    expect(multiKw.enabled[0]?.matchedKeyword?.text).toBe('npc');

    // Same-command adaptive history bump decays and adds 1
    const firstBump = bumpAdaptiveHistory(undefined, 'fit-content', now);
    const secondBump = bumpAdaptiveHistory(firstBump, 'fit-content', now + MS_PER_DAY);
    expect(secondBump.score).toBeGreaterThan(1);
    expect(computeDecayedAdaptiveScore({ commandId: 'x', score: -1, lastUsedAt: now }, now)).toBe(0);

    // Damerau-Levenshtein exact equality returns true
    expect(damerauLevenshteinAtMostOne('warp', 'warp')).toBe(true);

    // Unsearched recentIds fallback when frecency is omitted + empty-step macro visibility + searched macro filter
    const fallbackView = buildUnsearchedSpeedPanel(COMMAND_REGISTRY, zoneCtx, {
      recentIds: ['export-summary', 'set-elevation'],
      macros: [{ id: 'm-empty', name: 'Quick Macro', steps: [] }],
      nowMs: now,
    });
    expect(fallbackView.band2Macros.map((m) => m.id)).toEqual(['m-empty']);
    expect(fallbackView.band3Recents.some((r) => r.command.id === 'set-elevation')).toBe(true);

    const macroSearch = buildSpeedPanelView(COMMAND_REGISTRY, zoneCtx, 'quick', {
      macros: [{ id: 'm-empty', name: 'Quick Macro', steps: [] }],
      nowMs: now,
    });
    expect(macroSearch.kind).toBe('searched');
    if (macroSearch.kind === 'searched') {
      expect(macroSearch.macros.map((m) => m.id)).toEqual(['m-empty']);
    }

    // swap-direction uses stores.swapConnection when supplied
    const swapConnection = vi.fn();
    expect(
      executeRegistryCommand('swap-direction', DECK_HIT_SAMPLES.connection, {
        ...buildExecuteStores(),
        swapConnection,
      }),
    ).toEqual({ executed: true });
    expect(swapConnection).toHaveBeenCalledWith('zone-entrance', 'zone-cellar');

    // modeMatch tie-breaker inside searchCommands
    const modeRanked = searchCommands(COMMAND_REGISTRY, zoneCtx, 'conn', { mode: 'space', nowMs: now });
    expect(modeRanked.enabled.some((m) => m.modeMatch)).toBe(true);

    // Band 3 tie-break by lastUsedAt & regIdx when scores are equal
    const band3Tie = buildUnsearchedSpeedPanel(COMMAND_REGISTRY, { hit: null, selection: emptySelection() }, {
      frecency: {
        'tool-spawn': { score: 2, lastUsedAt: now, count: 1 },
        'tool-tile': { score: 2, lastUsedAt: now, count: 1 },
        'tool-prop': { score: 2, lastUsedAt: now - 10, count: 1 },
      },
      nowMs: now,
    });
    expect(band3Tie.band3Recents.map((r) => r.command.id)).toEqual(['tool-spawn', 'tool-tile', 'tool-prop']);

    // Default save() callback + open-details fallback + pruneAdaptiveHistory(..., 0)
    expect(pruneAdaptiveHistory({ q: { commandId: 'x', score: 1, lastUsedAt: now } }, now, 0)).toEqual({});
    expect(() => productionHotkeyContext().save?.()).not.toThrow();
    expect(
      executeRegistryCommand('open-details', DECK_HIT_SAMPLES.zone, buildExecuteStores(), productionHotkeyContext()),
    ).toEqual({ executed: true });
  });
});
