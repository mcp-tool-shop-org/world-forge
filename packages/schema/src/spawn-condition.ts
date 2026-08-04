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
    // F-005: Number('') === 0 and Number('   ') === 0 in JS — without this
    // guard an empty or whitespace-only operand silently parsed as p=0
    // instead of being rejected as malformed.
    if (raw.trim().length === 0) return null;
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
    // F-005: reject an empty/whitespace-only remainder before Number() coerces
    // it to 0 (e.g. "faction:foo:>" has split.rest === "").
    if (split.rest.trim().length === 0) return null;
    const value = Number(split.rest);
    if (!Number.isFinite(value)) return null;
    if (!COMPARATORS.has(split.op)) return null;
    return { type: 'faction-rep', params: { id, op: split.op, value } };
  }

  if (trimmed.startsWith('level:')) {
    const cmp = trimmed.slice('level:'.length);
    const split = splitComparator(cmp);
    if (!split) return null;
    if (split.rest.trim().length === 0) return null;
    const value = Number(split.rest);
    if (!Number.isFinite(value)) return null;
    if (!COMPARATORS.has(split.op)) return null;
    return { type: 'player-level', params: { op: split.op, value } };
  }

  // --- Party-state operands (zone entry gates) ---

  if (trimmed.startsWith('party-level:')) {
    const split = splitComparator(trimmed.slice('party-level:'.length));
    if (!split) return null;
    if (split.rest.trim().length === 0) return null;
    const value = Number(split.rest);
    if (!Number.isFinite(value)) return null;
    if (!COMPARATORS.has(split.op)) return null;
    return { type: 'party-level', params: { op: split.op, value } };
  }

  if (trimmed.startsWith('party-size:')) {
    const split = splitComparator(trimmed.slice('party-size:'.length));
    if (!split) return null;
    if (split.rest.trim().length === 0) return null;
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
 * The INVERSE of {@link parseSpawnCondition}: a structured node → its grammar
 * string. Returns null for a node this grammar cannot express.
 *
 * ⚠ WHY THIS EXISTS — a measured regression, not a nicety.
 *
 * `parseSpawnCondition` compiles; nothing decompiled. Before the C1 cycle that
 * was invisible, because the exporter stuffed the WHOLE grammar string into
 * `ConditionSpec.type` and `import-zones.ts` read `condition.type` straight back
 * out — a garbled export and a lossy import cancelled out, and the round-trip
 * appeared to work. C1 correctly fixed the export to compile, which broke the
 * import: `item:rope` now exports as `{ type: 'has-item', params: { id: 'rope' } }`
 * and imported back as the bare string `"has-item"`, which `parseSpawnCondition`
 * rejects. Measured on the built packages at C3/P0 — only the operand-free forms
 * (`always`, `never`) survived a round-trip, and nothing caught it because C1's
 * proof was one-directional.
 *
 * So: compiling is half a codec. Every consumer that reads a ConditionSpec back
 * into authored form uses THIS function — zone exits, zone entry gates, entity
 * spawn conditions — rather than three importers each guessing at the inverse.
 * `__tests__/spawn-condition-codec.test.ts` asserts
 * `parse(format(parse(s))) === parse(s)` over every one of the thirteen operand
 * families, so a family added to the parser and forgotten here fails loudly.
 */
export function formatSpawnCondition(node: SpawnConditionNode | null | undefined): string | null {
  if (node === null || node === undefined) return null;
  const p = node.params ?? {};

  /** A required string operand. Returns null (⇒ unformattable) when absent. */
  const str = (key: string): string | null => {
    const v = p[key];
    return typeof v === 'string' && v.length > 0 ? v : null;
  };
  /** A comparator + numeric value pair, e.g. `>=10`. */
  const cmp = (): string | null => {
    const op = p.op;
    const value = p.value;
    if (typeof op !== 'string' || !COMPARATORS.has(op)) return null;
    if (typeof value !== 'number' || !Number.isFinite(value)) return null;
    return `${op}${value}`;
  };

  switch (node.type) {
    case 'always':
      return 'always';
    case 'never':
      return 'never';
    case 'random-probability': {
      const v = p.p;
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) return null;
      return `random:${v}`;
    }
    case 'time-of-day': {
      const when = str('when');
      // Re-check the closed key set: a node carrying `when: 'teatime'` would
      // format to a string the parser then rejects, which is worse than
      // refusing here — a decompiler that emits invalid grammar is the bug
      // this function was written to fix.
      return when !== null && TIME_OF_DAY_KEYS.has(when) ? `time:${when}` : null;
    }
    case 'quest-progress': {
      const id = str('id');
      const stage = str('stage');
      return id !== null && stage !== null ? `quest:${id}:${stage}` : null;
    }
    case 'faction-rep': {
      const id = str('id');
      const c = cmp();
      return id !== null && c !== null ? `faction:${id}:${c}` : null;
    }
    case 'player-level': {
      const c = cmp();
      return c !== null ? `level:${c}` : null;
    }
    case 'party-level': {
      const c = cmp();
      return c !== null ? `party-level:${c}` : null;
    }
    case 'party-size': {
      const c = cmp();
      return c !== null ? `party-size:${c}` : null;
    }
    case 'has-item': {
      const id = str('id');
      return id !== null ? `item:${id}` : null;
    }
    case 'has-flag': {
      const id = str('id');
      return id !== null ? `flag:${id}` : null;
    }
    case 'party-member': {
      const id = str('id');
      return id !== null ? `member:${id}` : null;
    }
    case 'party-class': {
      const id = str('id');
      return id !== null ? `class:${id}` : null;
    }
    default:
      // An unknown type is UNFORMATTABLE, never guessed at. Exhaustive over
      // SpawnConditionType today; this arm catches a family added to the union
      // without a case here (and the codec test proves the arm is reachable).
      return null;
  }
}

/**
 * Decompile a wire `ConditionSpec`-shaped value into its grammar string.
 *
 * The importers' entry point: they hold `{ type, params }` read off a pack, not
 * a `SpawnConditionNode`. Structurally typed so this module does not depend on
 * the engine's content-schema package.
 */
export function formatConditionSpec(
  spec: { type?: unknown; params?: unknown } | null | undefined,
): string | null {
  if (spec === null || spec === undefined || typeof spec !== 'object') return null;
  if (typeof spec.type !== 'string') return null;
  const params =
    spec.params !== null && typeof spec.params === 'object' && !Array.isArray(spec.params)
      ? (spec.params as Record<string, string | number | boolean>)
      : undefined;
  return formatSpawnCondition({ type: spec.type as SpawnConditionType, params });
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
