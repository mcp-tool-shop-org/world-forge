// safe-lookup.ts — a prototype-pollution-safe lookup for plain-object maps.
//
// F-3dab95a4 (swarm wave-2). `GENRE_MAP[project.genre]`, `TONE_MAP[t]`,
// `DIFFICULTY_MAP[project.difficulty]` (convert-pack.ts) and
// `ROLE_TO_TYPE[ep.role]` / `ROLE_TAGS[ep.role]` / `ROLE_AI_PROFILE[ep.role]`
// (convert-entities.ts) are all direct bracket-lookups on plain object
// literals keyed by UNVALIDATED, free-string authored input ('genre',
// 'difficulty', 'tones' and 'role' all have zero validation rules in
// packages/schema/src/validate.ts). Plain JS objects inherit
// `Object.prototype`, so a key equal to a built-in property name
// ('__proto__', 'constructor', 'toString', 'hasOwnProperty', ...) resolves to
// that INHERITED member instead of `undefined` — silently bypassing whatever
// `?? fallback` the caller wrote, because the lookup did not actually miss.
//
// Reproduced directly: `GENRE_MAP['__proto__']` returns `Object.prototype` (a
// truthy object, not undefined), so the `?? 'fantasy'` fallback never fires
// and `Object.prototype` flows into the pack, serializing to `{}`.
// `GENRE_MAP['constructor']` returns the `Object` constructor function, which
// serializes to `null`. And `ROLE_TAGS[key]` being `undefined` for a
// non-prototype unrecognized key (e.g. `'villager'`) throws on
// `[...ROLE_TAGS[key]]` — spreading `undefined` is a TypeError, not a miss.
//
// `Object.hasOwn` (ES2022; this package targets ES2022) checks OWN
// enumerable properties only, so it correctly reports a miss for both
// inherited-prototype keys and genuinely-absent keys alike.
export function safeLookup<T>(map: Readonly<Record<string, T>>, key: string): T | undefined {
  return Object.hasOwn(map, key) ? map[key] : undefined;
}
