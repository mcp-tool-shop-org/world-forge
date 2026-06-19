// spawn-condition.ts — structured grammar for EntityPlacement.spawnCondition strings.
//
// The EntityPlacement schema keeps spawnCondition as a free-form string so
// authoring tools and engine runtimes can stay loose. This module provides a
// shared parser + validator so exporters, editors, and validators agree on
// what strings are legal.
//
// Supported forms:
//   "always"                    — always spawn (null condition)
//   "never"                     — never spawn
//   "random:0.3"                — roll uniform [0,1); spawn if < 0.3
//   "time:day" | "time:night"   — time-of-day gate
//   "quest:<id>:<stage>"        — quest at or past a given stage
//   "faction:<id>:>50"          — faction reputation comparison (>, <, >=, <=, ==)
//   "level:>=5"                 — player level comparison
//   "party-level:>=10"          — party (average/min) level comparison
//   "party-size:>=3"            — party member count comparison
//   "item:<id>"                 — party holds an item / key
//   "flag:<id>"                 — story flag is set
//   "member:<id>"               — a specific party member is present
//   "class:<id>"                — a party member of the given class/role is present
//
// The party-* / item / flag / member / class forms were added for zone entry
// gates (see ZoneEntryGate in spatial.ts) and are reusable anywhere a
// SpawnCondition is accepted (entity spawns, loot table entries).
//
// Returns null for unrecognized strings (callers treat as opaque or warn).

/** Types of spawn conditions the engine recognises. Extensible. */
export type SpawnConditionType =
  | 'time-of-day' | 'quest-progress' | 'faction-rep'
  | 'player-level' | 'random-probability' | 'always' | 'never'
  // Party-state operands (added for zone entry gates — see ZoneEntryGate).
  | 'party-level' | 'party-size' | 'has-item' | 'has-flag'
  | 'party-member' | 'party-class';

export interface SpawnConditionNode {
  type: SpawnConditionType;
  /** Arbitrary parameters (e.g. `{ min: 0.3 }` for random-probability). */
  params?: Record<string, string | number | boolean>;
}

const COMPARATORS = new Set(['>', '<', '>=', '<=', '==']);
const TIME_OF_DAY_KEYS = new Set(['day', 'night', 'dawn', 'dusk']);

/**
 * Extract a leading comparator (`>=`, `<=`, `==`, `>`, `<`) from a string
 * and return `{ op, rest }`. Two-char operators are tested first so `>=` is
 * not mistaken for `>` with a stray `=`. Returns null if nothing matches.
 */
function splitComparator(s: string): { op: string; rest: string } | null {
  for (const op of ['>=', '<=', '==']) {
    if (s.startsWith(op)) return { op, rest: s.slice(op.length) };
  }
  for (const op of ['>', '<']) {
    if (s.startsWith(op)) return { op, rest: s.slice(op.length) };
  }
  return null;
}

/**
 * Parse EntityPlacement.spawnCondition (free-form string) into a structured
 * SpawnConditionNode. See module docstring for supported forms.
 * Returns null for unrecognized strings (callers treat as opaque or warn).
 */
export function parseSpawnCondition(s: string | undefined): SpawnConditionNode | null {
  if (s === undefined || s === null) return null;
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;

  if (trimmed === 'always') return { type: 'always' };
  if (trimmed === 'never') return { type: 'never' };

  if (trimmed.startsWith('random:')) {
    const raw = trimmed.slice('random:'.length);
    const p = Number(raw);
    if (!Number.isFinite(p) || p < 0 || p > 1) return null;
    return { type: 'random-probability', params: { p } };
  }

  if (trimmed.startsWith('time:')) {
    const key = trimmed.slice('time:'.length);
    if (key.length === 0) return null;
    if (!TIME_OF_DAY_KEYS.has(key)) return null;
    return { type: 'time-of-day', params: { when: key } };
  }

  if (trimmed.startsWith('quest:')) {
    // quest:<id>:<stage>
    const rest = trimmed.slice('quest:'.length);
    const colon = rest.indexOf(':');
    if (colon <= 0 || colon === rest.length - 1) return null;
    const id = rest.slice(0, colon);
    const stage = rest.slice(colon + 1);
    if (id.length === 0 || stage.length === 0) return null;
    return { type: 'quest-progress', params: { id, stage } };
  }

  if (trimmed.startsWith('faction:')) {
    // faction:<id>:<op><value>
    const rest = trimmed.slice('faction:'.length);
    const colon = rest.indexOf(':');
    if (colon <= 0 || colon === rest.length - 1) return null;
    const id = rest.slice(0, colon);
    const cmp = rest.slice(colon + 1);
    const split = splitComparator(cmp);
    if (!split) return null;
    const value = Number(split.rest);
    if (!Number.isFinite(value)) return null;
    if (!COMPARATORS.has(split.op)) return null;
    return { type: 'faction-rep', params: { id, op: split.op, value } };
  }

  if (trimmed.startsWith('level:')) {
    const cmp = trimmed.slice('level:'.length);
    const split = splitComparator(cmp);
    if (!split) return null;
    const value = Number(split.rest);
    if (!Number.isFinite(value)) return null;
    if (!COMPARATORS.has(split.op)) return null;
    return { type: 'player-level', params: { op: split.op, value } };
  }

  // --- Party-state operands (zone entry gates) ---

  if (trimmed.startsWith('party-level:')) {
    const split = splitComparator(trimmed.slice('party-level:'.length));
    if (!split) return null;
    const value = Number(split.rest);
    if (!Number.isFinite(value)) return null;
    if (!COMPARATORS.has(split.op)) return null;
    return { type: 'party-level', params: { op: split.op, value } };
  }

  if (trimmed.startsWith('party-size:')) {
    const split = splitComparator(trimmed.slice('party-size:'.length));
    if (!split) return null;
    const value = Number(split.rest);
    if (!Number.isFinite(value)) return null;
    if (!COMPARATORS.has(split.op)) return null;
    return { type: 'party-size', params: { op: split.op, value } };
  }

  if (trimmed.startsWith('item:')) {
    const id = trimmed.slice('item:'.length);
    if (id.length === 0) return null;
    return { type: 'has-item', params: { id } };
  }

  if (trimmed.startsWith('flag:')) {
    const id = trimmed.slice('flag:'.length);
    if (id.length === 0) return null;
    return { type: 'has-flag', params: { id } };
  }

  if (trimmed.startsWith('member:')) {
    const id = trimmed.slice('member:'.length);
    if (id.length === 0) return null;
    return { type: 'party-member', params: { id } };
  }

  if (trimmed.startsWith('class:')) {
    const id = trimmed.slice('class:'.length);
    if (id.length === 0) return null;
    return { type: 'party-class', params: { id } };
  }

  return null;
}

/**
 * Validation helper used by validateProject. Returns an error string or
 * null if valid. Undefined / empty strings are treated as valid (the field
 * is optional).
 */
export function validateSpawnCondition(s: string | undefined): string | null {
  if (s === undefined || s === null) return null;
  const trimmed = s.trim();
  if (trimmed.length === 0) return null;
  const parsed = parseSpawnCondition(trimmed);
  if (parsed === null) {
    return `Unrecognized spawn condition "${s}". Supported forms: "always", "never", "random:<0..1>", "time:day|night|dawn|dusk", "quest:<id>:<stage>", "faction:<id>:<op><value>", "level:<op><value>", "party-level:<op><value>", "party-size:<op><value>", "item:<id>", "flag:<id>", "member:<id>", "class:<id>".`;
  }
  return null;
}
