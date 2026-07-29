// leaf-paths.ts — the C0 audit's field-path walker.
//
// Turns a nested object into a set of stable FIELD paths (not per-element
// paths), so "does the export carry `Zone.entryGate.mode`?" is one row in the
// truth table rather than one row per authored zone.
//
// Notation:
//   `zones[].entryGate.mode`          — array element fields collapse to `[]`
//   `playerTemplate.baseStats{}`      — a Record<string, scalar> collapses to `{}`
//   `dialogues[].nodes{}.speaker`     — a Record<string, object> keeps walking
//
// The `{}` collapse is DECLARED, not inferred: a runtime walker cannot tell a
// statically-keyed interface from a `Record<string, T>`, and guessing would
// silently merge real fields. Every dynamic-key path in the WorldProject schema
// is listed in DYNAMIC_KEY_PATHS below; a schema that grows another one and
// forgets to list it shows up as content-specific keys in the table diff.

/** Paths whose CHILD KEYS are author-chosen (Record<string, T>), not schema fields. */
export const DYNAMIC_KEY_PATHS: ReadonlySet<string> = new Set([
  // dialogue
  'dialogues[].nodes',
  'dialogues[].nodes{}.choices[].condition.params',
  'dialogues[].nodes{}.choices[].effects[].params',
  'dialogues[].nodes{}.effects[].params',
  // districts
  'districts[].economyProfile.scarcityDefaults',
  // player template
  'playerTemplate.baseStats',
  'playerTemplate.baseResources',
  'playerTemplate.startingEquipment',
  'playerTemplate.custom',
  // build catalog
  'buildCatalog.archetypes[].statPriorities',
  'buildCatalog.archetypes[].resourceOverrides',
  'buildCatalog.backgrounds[].statModifiers',
  'buildCatalog.backgrounds[].factionModifiers',
  // progression
  'progressionTrees[].nodes[].effects[].params',
  // entities
  'entityPlacements[].stats',
  'entityPlacements[].resources',
  'entityPlacements[].custom',
  // items
  'itemPlacements[].statModifiers',
  'itemPlacements[].resourceModifiers',
]);

export function isPlainObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Collect every leaf FIELD path reachable in `root`.
 *
 * A leaf is a scalar (string / number / boolean / null). Empty arrays and empty
 * objects also count as leaves — a domain the fixture left empty would
 * otherwise silently vanish from the table, which is the failure mode the
 * fixture's own coverage guard exists to prevent.
 */
export function collectLeafPaths(
  root: unknown,
  dynamicKeyPaths: ReadonlySet<string> = DYNAMIC_KEY_PATHS,
): Set<string> {
  const out = new Set<string>();

  const walk = (value: unknown, path: string): void => {
    if (Array.isArray(value)) {
      if (value.length === 0) {
        out.add(`${path}[]`);
        return;
      }
      for (const el of value) walk(el, `${path}[]`);
      return;
    }

    if (isPlainObject(value)) {
      const keys = Object.keys(value);
      if (keys.length === 0) {
        out.add(`${path}{}`);
        return;
      }
      const dynamic = dynamicKeyPaths.has(path);
      for (const k of keys) {
        walk(value[k], dynamic ? `${path}{}` : path ? `${path}.${k}` : k);
      }
      return;
    }

    out.add(path);
  };

  if (!isPlainObject(root)) throw new TypeError('collectLeafPaths expects a plain object root');
  for (const k of Object.keys(root)) walk((root as Record<string, unknown>)[k], k);
  return out;
}

/** Every distinct KEY NAME appearing anywhere in a nested structure. */
export function collectKeyNames(root: unknown): Set<string> {
  const out = new Set<string>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const el of v) walk(el);
      return;
    }
    if (isPlainObject(v)) {
      for (const [k, child] of Object.entries(v)) {
        out.add(k);
        walk(child);
      }
    }
  };
  walk(root);
  return out;
}

/** Every scalar VALUE appearing at any leaf of a nested structure. */
export function collectLeafValues(root: unknown): Set<unknown> {
  const out = new Set<unknown>();
  const walk = (v: unknown): void => {
    if (Array.isArray(v)) {
      for (const el of v) walk(el);
      return;
    }
    if (isPlainObject(v)) {
      for (const child of Object.values(v)) walk(child);
      return;
    }
    out.add(v);
  };
  walk(root);
  return out;
}

/**
 * Resolve every value found at a `[]` / `{}` field path. Returns one entry per
 * concrete occurrence (three zones ⇒ three values for `zones[].name`).
 */
export function resolvePath(root: unknown, path: string): unknown[] {
  const segments = path.split('.');
  let frontier: unknown[] = [root];

  for (const raw of segments) {
    const next: unknown[] = [];
    let key = raw;
    // Trailing `[]` / `{}` markers may repeat (e.g. `a[][]`); strip them in order.
    const suffixes: string[] = [];
    while (key.endsWith('[]') || key.endsWith('{}')) {
      suffixes.unshift(key.slice(-2));
      key = key.slice(0, -2);
    }

    for (const node of frontier) {
      if (!isPlainObject(node)) continue;
      const v = (node as Record<string, unknown>)[key];
      if (v === undefined) continue;
      next.push(v);
    }

    let expanded = next;
    for (const s of suffixes) {
      const step: unknown[] = [];
      for (const node of expanded) {
        if (s === '[]' && Array.isArray(node)) step.push(...node);
        else if (s === '{}' && isPlainObject(node)) step.push(...Object.values(node));
      }
      expanded = step;
    }
    frontier = expanded;
  }

  return frontier;
}
