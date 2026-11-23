// speed-panel-search.ts — zero-dependency tiered search matcher, frecency, and adaptive history

import type { AuthoringMode } from '@world-forge/schema';
import {
  getCommandCatalogueGroup,
  type CommandContext,
  type EditorCommand,
} from './command-registry.js';

/** Firefox exponential-decay half-life: 30 days. */
export const FRECENCY_HALF_LIFE_DAYS = 30;
export const MS_PER_DAY = 24 * 60 * 60 * 1000;
export const FRECENCY_HALF_LIFE_MS = FRECENCY_HALF_LIFE_DAYS * MS_PER_DAY;
export const FRECENCY_LAMBDA = Math.LN2 / FRECENCY_HALF_LIFE_DAYS;

/** Adaptive input-history daily decay factor (report §4 / Firefox Adaptive History). */
export const ADAPTIVE_DAILY_DECAY = 0.975;

export interface FrecencyEntry {
  score: number;
  lastUsedAt: number;
  count: number;
}

export interface AdaptiveHistoryEntry {
  commandId: string;
  score: number;
  lastUsedAt: number;
}

/** Strict lexicographic ranking tiers (§4): smaller value always beats larger value. */
export type MatchTier = 0 | 1 | 2 | 3 | 4;

export interface MatchedText {
  text: string;
  ranges: Array<[number, number]>;
}

export interface SearchMatch {
  command: EditorCommand;
  tier: MatchTier;
  subRank: number;
  frecency: number;
  modeMatch: boolean;
  matchRanges: Array<[number, number]>;
  matchedKeyword?: MatchedText;
}

export interface UnavailableSearchMatch extends SearchMatch {
  disabledReason: string;
}

export interface SearchResults {
  enabled: SearchMatch[];
  unavailable: UnavailableSearchMatch[];
}

export interface SearchOptions {
  mode?: AuthoringMode;
  frecency?: Readonly<Record<string, FrecencyEntry>>;
  adaptiveHistory?: Readonly<Record<string, AdaptiveHistoryEntry>>;
  nowMs?: number;
}

/** Normalize user query for tier matching and adaptive-history keys. */
export function normalizeSearchQuery(query: string): string {
  return query.trim().toLowerCase().replace(/\s+/g, ' ');
}

/** Compute continuous exponential-decay frecency score at `nowMs`. */
export function computeDecayedFrecency(entry: FrecencyEntry | undefined, nowMs = Date.now()): number {
  if (!entry || !Number.isFinite(entry.score) || entry.score <= 0) return 0;
  const elapsedDays = Math.max(0, (nowMs - entry.lastUsedAt) / MS_PER_DAY);
  return entry.score * Math.exp(-FRECENCY_LAMBDA * elapsedDays);
}

/** Decay existing frecency to `nowMs` and record one new invocation. */
export function bumpFrecency(entry: FrecencyEntry | undefined, nowMs = Date.now()): FrecencyEntry {
  const decayed = computeDecayedFrecency(entry, nowMs);
  return {
    score: decayed + 1,
    lastUsedAt: nowMs,
    count: (entry?.count ?? 0) + 1,
  };
}

/** Compute decayed adaptive-history score (`0.975`/day) at `nowMs`. */
export function computeDecayedAdaptiveScore(
  entry: AdaptiveHistoryEntry | undefined,
  nowMs = Date.now(),
): number {
  if (!entry || !Number.isFinite(entry.score) || entry.score <= 0) return 0;
  const elapsedDays = Math.max(0, (nowMs - entry.lastUsedAt) / MS_PER_DAY);
  return entry.score * Math.pow(ADAPTIVE_DAILY_DECAY, elapsedDays);
}

/** Decay adaptive-history entry to `nowMs` and apply `use_count = use_count * 0.9 + 1`. */
export function bumpAdaptiveHistory(
  entry: AdaptiveHistoryEntry | undefined,
  commandId: string,
  nowMs = Date.now(),
): AdaptiveHistoryEntry {
  if (entry && entry.commandId === commandId) {
    const decayed = computeDecayedAdaptiveScore(entry, nowMs);
    return {
      commandId,
      score: decayed * 0.9 + 1,
      lastUsedAt: nowMs,
    };
  }
  return {
    commandId,
    score: 1,
    lastUsedAt: nowMs,
  };
}

/**
 * Restricted Damerau-Levenshtein (Optimal String Alignment) <= 1 check:
 * accepts equality or a single substitution, insertion, deletion, or adjacent transposition.
 */
export function damerauLevenshteinAtMostOne(a: string, b: string): boolean {
  if (a === b) return true;
  const lenA = a.length;
  const lenB = b.length;
  if (Math.abs(lenA - lenB) > 1) return false;

  if (lenA === lenB) {
    let firstDiff = -1;
    let secondDiff = -1;
    for (let i = 0; i < lenA; i++) {
      if (a[i] !== b[i]) {
        if (firstDiff === -1) firstDiff = i;
        else if (secondDiff === -1) secondDiff = i;
        else return false;
      }
    }
    if (secondDiff === -1) return true; // 1 substitution
    // 1 adjacent transposition
    return (
      secondDiff === firstDiff + 1 &&
      a[firstDiff] === b[secondDiff] &&
      a[secondDiff] === b[firstDiff]
    );
  }

  // Length differs by 1: check single insertion/deletion
  const shorter = lenA < lenB ? a : b;
  const longer = lenA < lenB ? b : a;
  let si = 0;
  let li = 0;
  let skipped = false;
  while (si < shorter.length && li < longer.length) {
    if (shorter[si] === longer[li]) {
      si++;
      li++;
    } else if (!skipped) {
      skipped = true;
      li++;
    } else {
      return false;
    }
  }
  return true;
}

interface TitleWord {
  lower: string;
  start: number;
  end: number;
}

function extractWords(text: string): TitleWord[] {
  const words: TitleWord[] = [];
  const re = /[A-Za-z0-9]+/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    // Also split internal CamelCase boundaries if present
    const token = m[0];
    const base = m.index;
    const camelRe = /[A-Z]?[a-z0-9]+|[A-Z]+(?=[A-Z][a-z]|$)/g;
    let cm: RegExpExecArray | null;
    let matchedCamel = false;
    while ((cm = camelRe.exec(token)) !== null) {
      matchedCamel = true;
      words.push({
        lower: cm[0].toLowerCase(),
        start: base + cm.index,
        end: base + cm.index + cm[0].length,
      });
    }
    if (!matchedCamel) {
      words.push({
        lower: token.toLowerCase(),
        start: base,
        end: base + token.length,
      });
    }
  }
  return words;
}

function mergeRanges(ranges: Array<[number, number]>): Array<[number, number]> {
  if (ranges.length <= 1) return ranges;
  const sorted = [...ranges].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const merged: Array<[number, number]> = [sorted[0]];
  for (let i = 1; i < sorted.length; i++) {
    const prev = merged[merged.length - 1];
    const cur = sorted[i];
    if (cur[0] <= prev[1]) {
      prev[1] = Math.max(prev[1], cur[1]);
    } else {
      merged.push([cur[0], cur[1]]);
    }
  }
  return merged;
}

function matchInitialsSubsequence(
  words: readonly TitleWord[],
  q: string,
  startWordIndex: number,
  requireContiguous: boolean,
): Array<[number, number]> | null {
  if (q.length === 0 || words.length - startWordIndex < q.length) return null;
  if (requireContiguous) {
    const ranges: Array<[number, number]> = [];
    for (let qi = 0; qi < q.length; qi++) {
      const w = words[startWordIndex + qi];
      if (!w || w.lower[0] !== q[qi]) return null;
      ranges.push([w.start, w.start + 1]);
    }
    return ranges;
  }

  let qi = 0;
  const ranges: Array<[number, number]> = [];
  for (let wi = startWordIndex; wi < words.length && qi < q.length; wi++) {
    if (words[wi].lower[0] === q[qi]) {
      ranges.push([words[wi].start, words[wi].start + 1]);
      qi++;
    }
  }
  return qi === q.length ? ranges : null;
}

function parseBracketGroups(rawQuery: string): { groups: string[]; textQuery: string } {
  const groups: string[] = [];
  const textQuery = rawQuery
    .replace(/\[([^\]]+)\]/g, (_full, inner: string) => {
      const norm = inner.trim().toLowerCase();
      if (norm) groups.push(norm);
      return ' ';
    })
    .trim();
  return { groups, textQuery };
}

function matchesBaseTiers(
  cmd: EditorCommand,
  rawTextQuery: string,
  hasGroupFilter: boolean,
): { tier: MatchTier; subRank: number; matchRanges: Array<[number, number]>; matchedKeyword?: MatchedText } | null {
  const q = normalizeSearchQuery(rawTextQuery);
  if (!q) {
    return hasGroupFilter ? { tier: 3, subRank: 1, matchRanges: [] } : null;
  }

  const title = cmd.title;
  const lowerTitle = title.toLowerCase();
  const words = extractWords(title);

  // Tier 1: Exact or contiguous title prefix
  if (lowerTitle === q) {
    return { tier: 1, subRank: 0, matchRanges: [[0, title.length]] };
  }
  if (lowerTitle.startsWith(q)) {
    return { tier: 1, subRank: 1, matchRanges: [[0, q.length]] };
  }

  const hasSpace = q.includes(' ');

  // Tier 2: Initials / CamelCase / word-starts
  if (!hasSpace) {
    // 2.0 Contiguous initials from word 0 (e.g., `pe`, `dsc`, `nz`, `od`)
    if (q.length >= 2) {
      const exactInitials = matchInitialsSubsequence(words, q, 0, true);
      if (exactInitials) {
        return { tier: 2, subRank: 0, matchRanges: mergeRanges(exactInitials) };
      }
    }

    // 2.1 Single-token prefix on a non-first word (e.g., `warp` -> Draw [Warp] Connection)
    if (q.length >= 2) {
      for (let i = 1; i < words.length; i++) {
        if (words[i].lower.startsWith(q)) {
          return {
            tier: 2,
            subRank: 1,
            matchRanges: [[words[i].start, words[i].start + q.length]],
          };
        }
      }
    }

    // 2.2 Word-start subsequence from word 0 (allows skipping connector words like `ssp` -> Save Selection as Preset)
    if (q.length >= 2) {
      const subFromStart = matchInitialsSubsequence(words, q, 0, false);
      if (subFromStart) {
        return { tier: 2, subRank: 2, matchRanges: mergeRanges(subFromStart) };
      }
    }

    // 2.3 Contiguous initials starting at a later word (e.g., `sc` -> Draw [S]ecret [C]onnection)
    if (q.length >= 2) {
      for (let wi = 1; wi < words.length; wi++) {
        const tailInitials = matchInitialsSubsequence(words, q, wi, true);
        if (tailInitials) {
          return { tier: 2, subRank: 3, matchRanges: mergeRanges(tailInitials) };
        }
      }
    }
  }

  // Tier 3: Multi-term words in any order (e.g., `conn warp`, `zone new`)
  const tokens = q.split(/\s+/).filter(Boolean);
  if (tokens.length >= 2) {
    const usedWords = new Set<number>();
    const tokenRanges: Array<[number, number]> = [];
    let allMatched = true;
    for (const tok of tokens) {
      let foundIdx = -1;
      for (let wi = 0; wi < words.length; wi++) {
        if (!usedWords.has(wi) && words[wi].lower.startsWith(tok)) {
          foundIdx = wi;
          break;
        }
      }
      if (foundIdx === -1) {
        allMatched = false;
        break;
      }
      usedWords.add(foundIdx);
      const w = words[foundIdx];
      tokenRanges.push([w.start, w.start + tok.length]);
    }
    if (allMatched) {
      return {
        tier: 3,
        subRank: hasGroupFilter ? 0 : 1,
        matchRanges: mergeRanges(tokenRanges),
      };
    }
  }

  // Tier 4: Curated RPG synonyms and 1-edit typo tolerance on words >= 4 letters
  // 4.0 Exact keyword match
  for (const kw of cmd.keywords) {
    if (kw.toLowerCase() === q) {
      return {
        tier: 4,
        subRank: 0,
        matchRanges: [],
        matchedKeyword: { text: kw, ranges: [[0, kw.length]] },
      };
    }
  }

  // 4.1 Keyword / keyword-word prefix match (for query length >= 2 or multi-word keyword match)
  if (!hasSpace && q.length >= 2) {
    for (const kw of cmd.keywords) {
      const kwLower = kw.toLowerCase();
      if (kwLower.startsWith(q)) {
        return {
          tier: 4,
          subRank: 1,
          matchRanges: [],
          matchedKeyword: { text: kw, ranges: [[0, q.length]] },
        };
      }
      const kwWords = extractWords(kw);
      for (const kwWord of kwWords) {
        if (kwWord.lower.startsWith(q)) {
          return {
            tier: 4,
            subRank: 1,
            matchRanges: [],
            matchedKeyword: { text: kw, ranges: [[kwWord.start, kwWord.start + q.length]] },
          };
        }
      }
    }
  } else if (tokens.length >= 2) {
    // Multi-word tokens matching across title + keyword words in any order
    const kwWordPool = cmd.keywords.flatMap((kw) => extractWords(kw).map((w) => ({ kw, w })));
    const usedTitle = new Set<number>();
    const usedKw = new Set<number>();
    const titleRanges: Array<[number, number]> = [];
    let firstKwMatch: MatchedText | undefined;
    let allTokensMatched = true;
    for (const tok of tokens) {
      const tIdx = words.findIndex((w, i) => !usedTitle.has(i) && w.lower.startsWith(tok));
      if (tIdx !== -1) {
        usedTitle.add(tIdx);
        titleRanges.push([words[tIdx].start, words[tIdx].start + tok.length]);
        continue;
      }
      const kIdx = kwWordPool.findIndex((entry, i) => !usedKw.has(i) && entry.w.lower.startsWith(tok));
      if (kIdx !== -1) {
        usedKw.add(kIdx);
        if (!firstKwMatch) {
          const entry = kwWordPool[kIdx];
          firstKwMatch = {
            text: entry.kw,
            ranges: [[entry.w.start, entry.w.start + tok.length]],
          };
        }
        continue;
      }
      allTokensMatched = false;
      break;
    }
    if (allTokensMatched) {
      return {
        tier: 4,
        subRank: 1,
        matchRanges: mergeRanges(titleRanges),
        ...(firstKwMatch ? { matchedKeyword: firstKwMatch } : {}),
      };
    }
  }

  // 4.2 Bounded 1-typo tolerance on title words >= 4 letters
  if (!hasSpace && q.length >= 4) {
    for (const w of words) {
      if (w.lower.length >= 4 && damerauLevenshteinAtMostOne(q, w.lower)) {
        return {
          tier: 4,
          subRank: 2,
          matchRanges: [[w.start, w.end]],
        };
      }
    }

    // 4.3 Bounded 1-typo tolerance on keyword words >= 4 letters
    for (const kw of cmd.keywords) {
      for (const kwWord of extractWords(kw)) {
        if (kwWord.lower.length >= 4 && damerauLevenshteinAtMostOne(q, kwWord.lower)) {
          return {
            tier: 4,
            subRank: 3,
            matchRanges: [],
            matchedKeyword: { text: kw, ranges: [[kwWord.start, kwWord.end]] },
          };
        }
      }
    }
  }

  return null;
}

/**
 * Match `cmd` against `rawQuery` using the strict 5-tier hierarchy (§4):
 * Tier 0 (Adaptive history, gated on still matching Tiers 1–4)
 * -> Tier 1 (Exact & Prefix)
 * -> Tier 2 (Initials & Word-Starts)
 * -> Tier 3 (Multi-Term & `[Group]`)
 * -> Tier 4 (Synonyms & 1-Edit Typo on >=4 chars).
 */
export function matchCommand(
  cmd: EditorCommand,
  rawQuery: string,
  options: SearchOptions = {},
): SearchMatch | null {
  const { groups, textQuery } = parseBracketGroups(rawQuery);
  if (groups.length > 0) {
    const catalogueGroup = getCommandCatalogueGroup(cmd).toLowerCase();
    const cat = cmd.category.toLowerCase();
    const groupOk = groups.every((g) => catalogueGroup.startsWith(g) || cat.startsWith(g));
    if (!groupOk) return null;
  }

  const base = matchesBaseTiers(cmd, textQuery, groups.length > 0);
  if (!base) return null;

  const nowMs = options.nowMs ?? Date.now();
  const frecency = computeDecayedFrecency(options.frecency?.[cmd.id], nowMs);
  const modeMatch = Boolean(options.mode && cmd.modeSuggested?.includes(options.mode));

  const fullNorm = normalizeSearchQuery(rawQuery);
  const adaptive = options.adaptiveHistory?.[fullNorm];
  const adaptiveActive =
    adaptive &&
    adaptive.commandId === cmd.id &&
    computeDecayedAdaptiveScore(adaptive, nowMs) > 0;

  return {
    command: cmd,
    tier: adaptiveActive ? 0 : base.tier,
    subRank: adaptiveActive ? 0 : base.subRank,
    frecency,
    modeMatch,
    matchRanges: base.matchRanges,
    ...(base.matchedKeyword ? { matchedKeyword: base.matchedKeyword } : {}),
  };
}

/**
 * Search `commands` with strict lexicographic tier comparison (frecency only breaks ties within a tier)
 * and partition matches into enabled vs `"Unavailable here"` without hiding blocked matches.
 */
export function searchCommands(
  commands: readonly EditorCommand[],
  ctx: CommandContext,
  rawQuery: string,
  options: SearchOptions = {},
): SearchResults {
  const indexById = new Map<string, number>();
  commands.forEach((c, i) => indexById.set(c.id, i));

  const enabled: SearchMatch[] = [];
  const unavailable: UnavailableSearchMatch[] = [];

  for (const cmd of commands) {
    const m = matchCommand(cmd, rawQuery, options);
    if (!m) continue;
    const allowed = cmd.when(ctx);
    const reason = cmd.disabledReason(ctx);
    if (allowed && reason === null) {
      enabled.push(m);
    } else {
      unavailable.push({
        ...m,
        disabledReason: reason ?? 'Not available in this context',
      });
    }
  }

  const compare = (a: SearchMatch, b: SearchMatch): number => {
    if (a.tier !== b.tier) return a.tier - b.tier;
    if (a.subRank !== b.subRank) return a.subRank - b.subRank;
    if (a.modeMatch !== b.modeMatch) return a.modeMatch ? -1 : 1;
    if (a.frecency !== b.frecency) return b.frecency - a.frecency;
    if (a.command.title.length !== b.command.title.length) {
      return a.command.title.length - b.command.title.length;
    }
    return (indexById.get(a.command.id) ?? 0) - (indexById.get(b.command.id) ?? 0);
  };

  enabled.sort(compare);
  unavailable.sort(compare);

  return { enabled, unavailable };
}
