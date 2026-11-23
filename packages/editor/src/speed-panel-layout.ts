// speed-panel-layout.ts — Four-Band layout and two-state view builder

import type { AuthoringMode } from '@world-forge/schema';
import {
  CATALOGUE_GROUPS,
  getCommandBadge,
  getCommandCatalogueGroup,
  getContextDeckKey,
  CONTEXT_DECKS,
  getHotkeyBindingsFromRegistry,
  type CatalogueGroup,
  type CommandBadge,
  type CommandContext,
  type ContextDeckKey,
  type EditorCommand,
  type HotkeyBinding,
} from './command-registry.js';
import type { SpeedPanelGroup, SpeedPanelMacro } from './speed-panel-actions.js';
import { fuzzyMatch, getMacroStepCommandId } from './speed-panel-actions.js';
import {
  computeDecayedFrecency,
  searchCommands,
  type AdaptiveHistoryEntry,
  type FrecencyEntry,
  type MatchedText,
  type MatchTier,
} from './speed-panel-search.js';

/** Maximum non-pinned commands shown in Band 3. */
export const MAX_BAND3_RECENTS = 3;

export interface PaletteRow {
  command: EditorCommand;
  badge: CommandBadge | null;
  disabledReason: string | null;
  /** Original index in `pinnedIds` when this row is a Band 2 pin copy. */
  pinIndex?: number;
  /** Ordinal quick-select hint (`Alt+1`..`Alt+5`) for Band 1 deck slots. */
  deckShortcut?: string;
}

export interface SearchedPaletteRow extends PaletteRow {
  tier: MatchTier;
  matchRanges: Array<[number, number]>;
  matchedKeyword?: MatchedText;
}

export interface UnavailablePaletteRow extends SearchedPaletteRow {
  disabledReason: string;
}

export interface CatalogueGroupSection {
  group: CatalogueGroup;
  rows: PaletteRow[];
}

export interface CustomGroupSection {
  group: SpeedPanelGroup;
  rows: PaletteRow[];
}

export interface UnsearchedSpeedPanelView {
  kind: 'unsearched';
  deckKey: ContextDeckKey;
  repeatLastRow?: PaletteRow;
  band1Deck: PaletteRow[];
  band2Pinned: PaletteRow[];
  band2Macros: SpeedPanelMacro[];
  band3Recents: PaletteRow[];
  band4Macros?: SpeedPanelMacro[];
  band4ModeSuggested: PaletteRow[];
  band4CustomGroups: CustomGroupSection[];
  band4Catalogue: CatalogueGroupSection[];
}

export interface SearchedSpeedPanelView {
  kind: 'searched';
  query: string;
  enabled: SearchedPaletteRow[];
  macros: SpeedPanelMacro[];
  unavailable: UnavailablePaletteRow[];
}

export type SpeedPanelView = UnsearchedSpeedPanelView | SearchedSpeedPanelView;

export interface SpeedPanelLayoutOptions {
  pinnedIds?: readonly string[];
  frecency?: Readonly<Record<string, FrecencyEntry>>;
  recentIds?: readonly string[];
  groups?: readonly SpeedPanelGroup[];
  macros?: readonly SpeedPanelMacro[];
  mode?: AuthoringMode;
  showRecents?: boolean;
  hotkeyBindings?: readonly HotkeyBinding[];
  adaptiveHistory?: Readonly<Record<string, AdaptiveHistoryEntry>>;
  nowMs?: number;
  repeatCommand?: EditorCommand | null;
}

function toRow(
  cmd: EditorCommand,
  ctx: CommandContext,
  bindings: readonly HotkeyBinding[],
  extra?: Pick<PaletteRow, 'pinIndex' | 'deckShortcut'>,
): PaletteRow {
  const allowed = cmd.when(ctx);
  const reason = allowed ? cmd.disabledReason(ctx) : (cmd.disabledReason(ctx) ?? 'Not available in this context');
  return {
    command: cmd,
    badge: getCommandBadge(cmd, bindings),
    disabledReason: reason,
    ...(extra?.pinIndex !== undefined ? { pinIndex: extra.pinIndex } : {}),
    ...(extra?.deckShortcut !== undefined ? { deckShortcut: extra.deckShortcut } : {}),
  };
}

/**
 * Build the unsearched Speed Panel following the Four-Band ordering:
 * 1. Fixed Context Deck (4–5 slots per hit type, never reordered)
 * 2. Pinned Favorites & applicable Macros (user-ordered copies; originals stay below)
 * 3. Recents (0–3 non-pinned, non-deck items ranked by exponential-decay frecency; toggleable)
 * 4. Catalogue (Mode Suggested + user Custom Groups + fixed `Author..Export` groups).
 */
export function buildUnsearchedSpeedPanel(
  commands: readonly EditorCommand[],
  ctx: CommandContext,
  options: SpeedPanelLayoutOptions = {},
): UnsearchedSpeedPanelView {
  const nowMs = options.nowMs ?? Date.now();
  const bindings = options.hotkeyBindings ?? getHotkeyBindingsFromRegistry();
  const byId = new Map<string, EditorCommand>();
  commands.forEach((cmd) => byId.set(cmd.id, cmd));

  // Band 1: fixed context deck in canonical slot order
  const deckKey = getContextDeckKey(ctx.hit);
  const deckIds = CONTEXT_DECKS[deckKey];
  const band1Deck: PaletteRow[] = [];
  deckIds.forEach((id, slotIdx) => {
    const cmd = byId.get(id);
    if (!cmd) return;
    band1Deck.push(toRow(cmd, ctx, bindings, { deckShortcut: `Alt+${slotIdx + 1}` }));
  });
  const band1Ids = new Set(band1Deck.map((r) => r.command.id));

  // Band 2: pinned copies (stay in Band 1 / Band 4 too) + applicable macros
  const pinnedIds = options.pinnedIds ?? [];
  const band2Pinned: PaletteRow[] = [];
  for (let i = 0; i < pinnedIds.length; i++) {
    const cmd = byId.get(pinnedIds[i]);
    if (!cmd || !cmd.when(ctx)) continue;
    band2Pinned.push(toRow(cmd, ctx, bindings, { pinIndex: i }));
  }
  const band2PinnedIds = new Set(band2Pinned.map((r) => r.command.id));

  const applicableMacros = (options.macros ?? []).filter((macro) => {
    if (macro.steps.length === 0) return true;
    return macro.steps.every((step) => {
      const cmd = byId.get(getMacroStepCommandId(step));
      return cmd ? cmd.when(ctx) : true;
    });
  });
  const band2Macros = applicableMacros.filter((macro) => macro.pinned !== false);
  const band4Macros = applicableMacros.filter((macro) => macro.pinned === false);

  // Band 3: up to 3 recent commands not shown in Band 1 or Band 2, ranked by continuous frecency
  const showRecents = options.showRecents ?? true;
  const band3Recents: PaletteRow[] = [];
  if (showRecents) {
    const hasExplicitFrecency = options.frecency !== undefined;
    const frecencyMap = options.frecency ?? {};
    const indexById = new Map<string, number>();
    commands.forEach((c, idx) => indexById.set(c.id, idx));

    const candidates: Array<{ cmd: EditorCommand; score: number; lastUsedAt: number; regIdx: number }> = [];
    for (const cmd of commands) {
      if (!cmd.when(ctx)) continue;
      if (band1Ids.has(cmd.id) || band2PinnedIds.has(cmd.id)) continue;

      if (hasExplicitFrecency) {
        const entry = frecencyMap[cmd.id];
        const score = computeDecayedFrecency(entry, nowMs);
        if (score > 0 && entry) {
          candidates.push({
            cmd,
            score,
            lastUsedAt: entry.lastUsedAt,
            regIdx: indexById.get(cmd.id) ?? 0,
          });
        }
      } else if (options.recentIds && options.recentIds.length > 0) {
        const recentIdx = options.recentIds.indexOf(cmd.id);
        if (recentIdx !== -1) {
          candidates.push({
            cmd,
            score: options.recentIds.length - recentIdx,
            lastUsedAt: nowMs - recentIdx,
            regIdx: indexById.get(cmd.id) ?? 0,
          });
        }
      }
    }

    candidates.sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      if (b.lastUsedAt !== a.lastUsedAt) return b.lastUsedAt - a.lastUsedAt;
      return a.regIdx - b.regIdx;
    });

    for (const c of candidates.slice(0, MAX_BAND3_RECENTS)) {
      band3Recents.push(toRow(c.cmd, ctx, bindings));
    }
  }
  const band3Ids = new Set(band3Recents.map((r) => r.command.id));

  // Items already placed in non-copy top bands (Band 1 and Band 3)
  const excludedFromBand4Base = new Set<string>([...band1Ids, ...band3Ids]);

  // Band 4.1: Mode-suggested commands (in Band 4 so Band 1 slots never shift)
  const band4ModeSuggested: PaletteRow[] = [];
  if (options.mode) {
    for (const cmd of commands) {
      if (!cmd.when(ctx)) continue;
      if (excludedFromBand4Base.has(cmd.id)) continue;
      if (cmd.modeSuggested?.includes(options.mode)) {
        band4ModeSuggested.push(toRow(cmd, ctx, bindings));
      }
    }
  }
  const modeSuggestedIds = new Set(band4ModeSuggested.map((r) => r.command.id));

  // Band 4.2: User custom groups filtered to applicable commands (also rendered inside Band 4)
  const band4CustomGroups: CustomGroupSection[] = [];
  for (const g of options.groups ?? []) {
    const rows: PaletteRow[] = [];
    for (const id of g.actionIds) {
      const cmd = byId.get(id);
      if (cmd && cmd.when(ctx)) {
        rows.push(toRow(cmd, ctx, bindings));
      }
    }
    if (rows.length > 0) {
      band4CustomGroups.push({ group: g, rows });
    }
  }

  // Band 4.3: Canonical fixed groups (`Author`, `Connect`, `Populate`, `Inspect`, `View`, `Export`)
  const rowsByGroup = new Map<CatalogueGroup, PaletteRow[]>(
    CATALOGUE_GROUPS.map((g) => [g, []]),
  );
  for (const cmd of commands) {
    if (!cmd.when(ctx)) continue;
    if (excludedFromBand4Base.has(cmd.id) || modeSuggestedIds.has(cmd.id)) continue;
    const grp = getCommandCatalogueGroup(cmd);
    rowsByGroup.get(grp)!.push(toRow(cmd, ctx, bindings));
  }

  const band4Catalogue: CatalogueGroupSection[] = [];
  for (const grp of CATALOGUE_GROUPS) {
    const rows = rowsByGroup.get(grp) ?? [];
    if (rows.length > 0) {
      band4Catalogue.push({ group: grp, rows });
    }
  }

  const repeatLastRow =
    options.repeatCommand && options.repeatCommand.when(ctx)
      ? toRow(options.repeatCommand, ctx, bindings)
      : undefined;

  return {
    kind: 'unsearched',
    deckKey,
    ...(repeatLastRow ? { repeatLastRow } : {}),
    band1Deck,
    band2Pinned,
    band2Macros,
    band3Recents,
    ...(band4Macros.length > 0 ? { band4Macros } : {}),
    band4ModeSuggested,
    band4CustomGroups,
    band4Catalogue,
  };
}

/**
 * Build either the unsearched Four-Band layout (empty query) or the tiered search view.
 * When searching, matching commands blocked by context are placed into `unavailable`
 * with their registry `disabledReason` rather than hidden.
 */
export function buildSpeedPanelView(
  commands: readonly EditorCommand[],
  ctx: CommandContext,
  query: string,
  options: SpeedPanelLayoutOptions = {},
): SpeedPanelView {
  const trimmed = query.trim();
  if (!trimmed) {
    return buildUnsearchedSpeedPanel(commands, ctx, options);
  }

  const effectiveCommands = options.repeatCommand
    ? [options.repeatCommand, ...commands]
    : commands;
  const bindings = options.hotkeyBindings ?? getHotkeyBindingsFromRegistry();
  const { enabled, unavailable } = searchCommands(effectiveCommands, ctx, trimmed, {
    mode: options.mode,
    frecency: options.frecency,
    adaptiveHistory: options.adaptiveHistory,
    nowMs: options.nowMs,
  });

  const macros = (options.macros ?? []).filter((m) => fuzzyMatch(trimmed, m.name).match);

  return {
    kind: 'searched',
    query: trimmed,
    enabled: enabled.map((m) => ({
      command: m.command,
      badge: getCommandBadge(m.command, bindings),
      disabledReason: null,
      tier: m.tier,
      matchRanges: m.matchRanges,
      ...(m.matchedKeyword ? { matchedKeyword: m.matchedKeyword } : {}),
    })),
    macros,
    unavailable: unavailable.map((m) => ({
      command: m.command,
      badge: getCommandBadge(m.command, bindings),
      disabledReason: m.disabledReason,
      tier: m.tier,
      matchRanges: m.matchRanges,
      ...(m.matchedKeyword ? { matchedKeyword: m.matchedKeyword } : {}),
    })),
  };
}
