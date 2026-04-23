# ai-rpg-engine — Engine API Contract

This exporter depends on the **ai-rpg-engine 2.x** API. If the engine ships a
3.x major, work through the checklist below *before* bumping the dep ranges.

## The 2.x surface we rely on

Types imported by this package:

- `@ai-rpg-engine/content-schema` — `ZoneDefinition`, `EntityBlueprint`,
  `DialogueDefinition`, `ProgressionTreeDefinition`. Shape: `{ id, name, tags, ... }`
  with no required `version` field on each record.
- `@ai-rpg-engine/core` — `GameManifest`. Fields: `id`, `title`, `version`,
  `engineVersion` (string, currently `"2.0.0"`), `ruleset`, `modules[]`,
  `contentPacks[]`.
- `@ai-rpg-engine/modules` — `DistrictDefinition`. Fields include `baseMetrics`
  with keys `commerce` / `morale` / `stability` / `surveillance`.
- `@ai-rpg-engine/pack-registry` — `PackMetadata`, `PackGenre`, `PackTone`,
  `PackDifficulty`. Tone/genre/difficulty are string enums mapped in
  `convert-pack.ts` via `TONE_MAP` / `GENRE_MAP` / `DIFFICULTY_MAP`.
- `@ai-rpg-engine/equipment` — `ItemDefinition`. Slots: `weapon | armor |
  accessory | tool | trinket`. Rarities: `common | uncommon | rare | legendary`.

Runtime assumptions:

- Engine version string embedded in `GameManifest.engineVersion` is hard-coded
  to `"2.0.0"` in `convert-pack.ts` (`convertManifest`, `convertPackMeta`).
- `DEFAULT_MODULES` in `convert-pack.ts` must match the engine's standard
  module registry for v2.x.
- Dialogue node `text` is an array of `{ text: string }` blocks on 2.x.

## 3.x bump checklist

When the engine majors, open each item and update only what the engine
actually changed:

1. [ ] Bump the six `@ai-rpg-engine/*` dep ranges in `package.json`.
2. [ ] Update hard-coded `engineVersion: '2.0.0'` in `convert-pack.ts`.
3. [ ] Re-verify `DEFAULT_MODULES` against the 3.x module registry — add,
       remove, or rename entries to match.
4. [ ] Re-verify `TONE_MAP`, `GENRE_MAP`, `DIFFICULTY_MAP` against 3.x enums.
5. [ ] Re-verify `VALID_ITEM_SLOTS` / `VALID_ITEM_RARITIES` in `convert-items.ts`.
6. [ ] Re-verify `ROLE_TO_TYPE`, `ROLE_TAGS`, `ROLE_AI_PROFILE` in `convert-entities.ts`.
7. [ ] Run the full test suite; update fixtures if engine record shapes changed.
8. [ ] Bump this package's major version (breaking change for consumers).
