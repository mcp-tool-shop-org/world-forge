// export-table-data.ts — the C0 EXPORT truth table (WorldProject → export artifacts).
//
// Every authored field path in the vocabulary-coverage fixture gets exactly one
// classification here. The classification is DECLARED; `export-differ.ts`
// VERIFIES it mechanically against a live export. A row that lies fails the
// suite — the table cannot drift away from the code it describes.
//
// The four export classes (C0 §3):
//   carried-lossless      — the value survives with identical semantics
//   carried-approximated  — survives, but remapped / collapsed / re-encoded
//   carried-garbled       — survives structurally, but into a slot that means
//                           something else than the authored value meant
//   no-channel            — the export has no field for it at all
//
// `channel` names WHICH export artifact carries it. This matters more than it
// looks: only `contentPack` is what `ai-rpg-engine validate` and the loader
// ever read. `manifest` / `packMeta` go to the pack registry; `assets` /
// `assetBindings` / `assetPacks` are round-trip preservation for World Forge's
// own importer and have no engine reader at all.

export type ExportClass =
  | 'carried-lossless'
  | 'carried-approximated'
  | 'carried-garbled'
  | 'no-channel';

export type ExportChannel =
  | 'contentPack'
  | 'manifest'
  | 'packMeta'
  | 'assets'
  | 'assetBindings'
  | 'assetPacks'
  | 'none';

/**
 * A subtree of one export artifact. Used to SCOPE an absence proof to the only
 * place the field's image could legitimately live.
 *
 * Scoping is not a weakening — it is what makes the proof mean anything. A
 * global "the key `zoneId` appears nowhere" is FALSE (the raw-pass-through
 * `encounterAnchors` carries one) even though `EntityBlueprint` genuinely has
 * no location field. Unscoped, that row is unprovable; scoped to
 * `contentPack:entities[]`, it is exactly the claim being made.
 */
export interface ScopeSpec {
  channel: Exclude<ExportChannel, 'none'>;
  /** Leaf path of the subtree root. Omitted ⇒ the whole artifact. */
  packPath?: string;
}

/**
 * How a `no-channel` row PROVES absence. Neither shape is sound on its own,
 * which is why each row names the one it relies on and the differ rejects a
 * proof that cannot fail:
 *
 *  - `key-absent`   — the named key appears nowhere in `scope` (default: all
 *                     six artifacts). Used for a distinctive field name
 *                     (`elevation`), a whole dropped container (`strata`), or a
 *                     generic name scoped to the container that would hold it.
 *  - `value-absent` — every authored STRING value at this path is absent from
 *                     `scope`. Used where the field name is generic but the
 *                     values are distinctive. Rejected as vacuous when the path
 *                     authors no strings.
 */
export type AbsenceProof =
  | { kind: 'key-absent'; key: string; scope?: ScopeSpec[] }
  | { kind: 'value-absent'; scope?: ScopeSpec[] };

/**
 * Project-level metadata has exactly two possible images: the GameManifest and
 * the PackMetadata. An identical string turning up inside an asset record is a
 * different field about a different thing, not evidence of carriage.
 */
const PROJECT_METADATA_SCOPE: ScopeSpec[] = [{ channel: 'manifest' }, { channel: 'packMeta' }];

export interface CarriedRow {
  path: string;
  class: Exclude<ExportClass, 'no-channel'>;
  channel: Exclude<ExportChannel, 'none'>;
  /** Leaf path of the image inside `channel`. */
  packPath: string;
  /**
   * Named transform. Omitted ⇒ the exported values must equal the authored
   * values exactly (multiset comparison), which the differ enforces.
   */
  transform?: string;
  note: string;
}

export interface DroppedRow {
  path: string;
  class: 'no-channel';
  absence: AbsenceProof;
  note: string;
}

export type ExportRow = CarriedRow | DroppedRow;

/**
 * Domains the export lane has NO channel for, at any field. Expanded to one row
 * per authored leaf path by `expandTable()`. The container key itself is the
 * absence proof — if `strata` appeared anywhere in any artifact, every row this
 * rule generates would fail at once.
 */
export const DROPPED_CONTAINERS: Record<string, string> = {
  map: 'The authored grid (dimensions, tile size) has no pack field. The engine\'s space model is a graph; it has no coordinates to receive.',
  connections: 'Typed inter-zone connections (kind / bidirectional / condition) have no pack field. Only the untyped `Zone.neighbors` id list crosses.',
  spawnPoints: 'Spawn points are dropped as records; only `playerTemplate.spawnPointId` crosses, as a dangling id string.',
  craftingStations: 'World-placed crafting stations have no pack field, although the engine ships a `crafting-core` module.',
  marketNodes: 'Market nodes have no pack field, although the engine ships live per-district economies — the moat the 2.5D charter names.',
  buildings: 'Placed enterable buildings have no pack field.',
  hubs: 'Service/connectivity hubs have no pack field.',
  strongholds: 'Fortified faction seats have no pack field.',
  strata: 'The v4.5 vertical-layer model has no pack field. Zero hits for `stratum`/`strata` anywhere in the engine repo.',
  stratumLinks: 'Cross-stratum connectors have no pack field.',
  hazardDefinitions: 'Typed hazard definitions have no pack field. Only the LEGACY free-text `Zone.hazards: string[]` crosses.',
  tilesets: 'Tilesets and their tiles have no pack field (visual layer; client-owned by the charter, but also unreachable by World Forge\'s own importer).',
  tileLayers: 'Tile layers have no pack field.',
  props: 'Prop definitions have no pack field.',
  propPlacements: 'Prop placements have no pack field.',
  ambientLayers: 'Ambient layers (fog / rain / dust) have no pack field.',
  lootTables: 'Weighted loot tables have no pack field, although `itemPlacements[].lootTableId` can reference one.',
  transitions: 'Elevator / warp / lift transitions have no pack field.',
};

/**
 * Explicit rows for every field NOT covered by `DROPPED_CONTAINERS`. Order is
 * cosmetic; the differ sorts.
 */
export const EXPLICIT_ROWS: ExportRow[] = [
  // ── Project identity ────────────────────────────────────────────────
  { path: 'id', class: 'carried-lossless', channel: 'manifest', packPath: 'id', note: 'Also lands on packMeta.id, buildCatalog.packId, and manifest.contentPacks[].' },
  { path: 'name', class: 'carried-lossless', channel: 'manifest', packPath: 'title', transform: 'renamed-key', note: 'manifest.title and packMeta.name both receive it verbatim.' },
  { path: 'version', class: 'carried-lossless', channel: 'manifest', packPath: 'version', note: 'Also packMeta.version. Distinct from manifest.engineVersion, which is hard-coded.' },
  { path: 'description', class: 'carried-lossless', channel: 'packMeta', packPath: 'description', note: 'Also truncated to 100 chars into packMeta.tagline (convert-pack.ts:129).' },
  { path: 'narratorTone', class: 'carried-lossless', channel: 'packMeta', packPath: 'narratorTone', note: 'Verbatim.' },
  { path: 'genre', class: 'carried-approximated', channel: 'packMeta', packPath: 'genres[]', transform: 'GENRE_MAP-with-silent-fallback', note: 'Mapped through GENRE_MAP (convert-pack.ts:8). `detective`→`mystery`, `zombie`→`post-apocalyptic`; an UNMAPPED genre silently becomes `fantasy` with no warning.' },
  { path: 'tones[]', class: 'carried-approximated', channel: 'packMeta', packPath: 'tones[]', transform: 'TONE_MAP-filtered', note: 'Mapped through TONE_MAP; unrecognised tones are dropped (warned), and an all-invalid list falls back to [\'atmospheric\'].' },
  { path: 'difficulty', class: 'carried-approximated', channel: 'packMeta', packPath: 'difficulty', transform: 'DIFFICULTY_MAP-with-silent-fallback', note: 'Six authored values collapse to three engine tiers; unmapped silently becomes `intermediate`.' },
  { path: 'mode', class: 'carried-approximated', channel: 'packMeta', packPath: 'tags[]', transform: 'encoded-as-tag-prefix', note: 'The authoring MODE becomes the string `mode:<mode>` inside packMeta.tags (convert-pack.ts:124) — recoverable by convention, not by field.' },
  { path: 'author', class: 'no-channel', absence: { kind: 'value-absent', scope: PROJECT_METADATA_SCOPE }, note: 'Project author is not exported. Scoped: asset-level `provenance.author` is a different field that happens to hold the same value here — unscoped, that collision reads as carriage.' },
  { path: 'license', class: 'no-channel', absence: { kind: 'value-absent', scope: PROJECT_METADATA_SCOPE }, note: 'Project license is not exported. (Asset-pack `license` is a different field.)' },
  { path: 'category', class: 'no-channel', absence: { kind: 'value-absent', scope: PROJECT_METADATA_SCOPE }, note: 'Project category is not exported. A trap in both directions: the fixture value collides with `genre` (so a global value proof fails) and the key name collides with the buildCatalog trait `category` (so a key proof fails). Only the scoped proof states the actual claim.' },
  { path: 'projectTags[]', class: 'no-channel', absence: { kind: 'value-absent', scope: PROJECT_METADATA_SCOPE }, note: 'Project discovery tags are not exported; packMeta.tags receives ONLY the `mode:` tag. Scoped because an authored tag also appears in an assetPack tag list.' },

  // ── Zones — carried ─────────────────────────────────────────────────
  { path: 'zones[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].id', note: '' },
  { path: 'zones[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].name', note: '' },
  { path: 'zones[].tags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].tags[]', note: 'The single richest carried zone field — the engine reads tags as spawn, chokepoint, ambush and safe-zone gates.' },
  { path: 'zones[].description', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].description[].text', transform: 'wrapped-in-textblock', note: 'A plain string becomes `[{ text }]`. The conditional TextBlock form the engine schema allows is never produced.' },
  { path: 'zones[].neighbors[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].neighbors[]', note: 'The one zone field that gates movement at runtime (traversal-core.ts:46).' },
  { path: 'zones[].light', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].light', note: '' },
  { path: 'zones[].noise', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].noise', note: '' },
  { path: 'zones[].hazards[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].hazards[]', note: 'The LEGACY free-text hazard list. Carried verbatim; the typed `hazardDefinitions` + `hazardRefs` pair is not.' },
  { path: 'zones[].interactables[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].interactables[]', transform: 'name-only-projection', note: 'The Interactable object collapses to its name string (convert-zones.ts:42).' },
  { path: 'zones[].interactables[].type', class: 'no-channel', absence: { kind: 'key-absent', key: 'type', scope: [{ channel: 'contentPack', packPath: 'zones[].interactables[]' }] }, note: 'Interaction type is lost in the name-only projection: the exported `interactables` is a bare string[], so no `type` key exists beneath it. Scoped because `type` is common elsewhere in the pack (EntityBlueprint.type, effect.type).' },
  { path: 'zones[].interactables[].description', class: 'no-channel', absence: { kind: 'value-absent' }, note: 'Interactable descriptions are lost in the name-only projection.' },
  { path: 'zones[].exits[].targetZoneId', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].exits[].targetZoneId', note: '' },
  { path: 'zones[].exits[].label', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].exits[].label', note: '' },
  { path: 'zones[].exits[].condition', class: 'carried-garbled', channel: 'contentPack', packPath: 'zones[].exits[].condition.type', transform: 'whole-grammar-string-as-ConditionSpec.type', note: 'The SpawnCondition string (`item:rope`) is stuffed WHOLE into `ConditionSpec.type` with `params: {}` (convert-zones.ts:48). `parseSpawnCondition` is never called. `type` is meant to name a condition KIND, not carry its operands — so a valid ConditionSpec is produced that means nothing.' },
  { path: 'zones[].backgroundId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'zones{}.backgroundId', note: 'Survives only in the World-Forge-side asset binding map, which is NOT part of the ContentPack the engine loads.' },
  { path: 'zones[].tilesetId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'zones{}.tilesetId', note: 'Same channel caveat as backgroundId.' },

  // ── Zones — dropped ─────────────────────────────────────────────────
  { path: 'zones[].gridX', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridX' }, note: 'No coordinates cross. Consistent with the charter\'s Pillar 2: fine space is client/authoring-owned.' },
  { path: 'zones[].gridY', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridY' }, note: 'See gridX.' },
  { path: 'zones[].gridWidth', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridWidth' }, note: 'See gridX.' },
  { path: 'zones[].gridHeight', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridHeight' }, note: 'See gridX.' },
  { path: 'zones[].parentDistrictId', class: 'no-channel', absence: { kind: 'key-absent', key: 'parentDistrictId' }, note: 'The zone→district back-reference is dropped; only the district\'s own forward `zoneIds[]` list crosses, so the relation survives one-way by accident of the district converter.' },
  { path: 'zones[].elevation', class: 'no-channel', absence: { kind: 'key-absent', key: 'elevation' }, note: 'The 2.5D vertical field the charter\'s Pillar 2 names first. Zero hits for `elevation` in the engine repo.' },
  { path: 'zones[].elevationRange.floor', class: 'no-channel', absence: { kind: 'key-absent', key: 'elevationRange' }, note: 'Multi-level vertical span: no channel.' },
  { path: 'zones[].elevationRange.ceiling', class: 'no-channel', absence: { kind: 'key-absent', key: 'elevationRange' }, note: 'Multi-level vertical span: no channel.' },
  { path: 'zones[].stratumId', class: 'no-channel', absence: { kind: 'key-absent', key: 'stratumId' }, note: 'The zone→stratum membership link, dropped along with the strata themselves.' },
  { path: 'zones[].hazardRefs[]', class: 'no-channel', absence: { kind: 'key-absent', key: 'hazardRefs' }, note: 'The TYPED hazard references. The legacy free-text `hazards` list crosses instead, so a zone that authored only typed hazards exports as hazard-free.' },
  { path: 'zones[].entryGate.conditions[]', class: 'no-channel', absence: { kind: 'key-absent', key: 'entryGate' }, note: 'The v4.5 party-state entry gate. The Godot lane consumes it; the engine lane has no field for it.' },
  { path: 'zones[].entryGate.mode', class: 'no-channel', absence: { kind: 'key-absent', key: 'entryGate' }, note: 'hard-vs-soft gating: no channel.' },
  { path: 'zones[].entryGate.reason', class: 'no-channel', absence: { kind: 'key-absent', key: 'entryGate' }, note: 'The authored "show the lock" message: no channel.' },
  { path: 'zones[].parallaxLayers[].id', class: 'no-channel', absence: { kind: 'key-absent', key: 'parallaxLayers' }, note: '2.5D parallax: no channel.' },
  { path: 'zones[].parallaxLayers[].depth', class: 'no-channel', absence: { kind: 'key-absent', key: 'parallaxLayers' }, note: '2.5D parallax: no channel.' },
  { path: 'zones[].parallaxLayers[].assetRef', class: 'no-channel', absence: { kind: 'key-absent', key: 'parallaxLayers' }, note: '2.5D parallax: no channel. (The referenced asset itself still appears in the `assets` manifest, which is why value-absence would not prove this.)' },
  { path: 'zones[].parallaxLayers[].scrollFactor', class: 'no-channel', absence: { kind: 'key-absent', key: 'parallaxLayers' }, note: '2.5D parallax: no channel.' },
  { path: 'zones[].skylineRef', class: 'no-channel', absence: { kind: 'key-absent', key: 'skylineRef' }, note: '2.5D vertical framing: no channel.' },
  { path: 'zones[].gravityOverride', class: 'no-channel', absence: { kind: 'key-absent', key: 'gravityOverride' }, note: 'Physics override: no channel.' },
  { path: 'zones[].gravityDirection', class: 'no-channel', absence: { kind: 'key-absent', key: 'gravityDirection' }, note: 'Physics override: no channel.' },
  { path: 'zones[].physicsMode', class: 'no-channel', absence: { kind: 'key-absent', key: 'physicsMode' }, note: 'normal / platformer / zero-g / aquatic: no channel.' },
  { path: 'zones[].skyAtmosphereRef', class: 'no-channel', absence: { kind: 'key-absent', key: 'skyAtmosphereRef' }, note: 'Sky preset: no channel. (Also has no referential validation on the authoring side — see the fixture note.)' },
  { path: 'zones[].directionalLightYaw', class: 'no-channel', absence: { kind: 'key-absent', key: 'directionalLightYaw' }, note: 'Lighting hint: no channel.' },
  { path: 'zones[].directionalLightPitch', class: 'no-channel', absence: { kind: 'key-absent', key: 'directionalLightPitch' }, note: 'Lighting hint: no channel.' },
  { path: 'zones[].skyLightIntensity', class: 'no-channel', absence: { kind: 'key-absent', key: 'skyLightIntensity' }, note: 'Lighting hint: no channel.' },
  { path: 'zones[].timeOfDay', class: 'no-channel', absence: { kind: 'key-absent', key: 'timeOfDay' }, note: 'Time-of-day key: no channel — even though the SpawnCondition grammar has a `time:` operand the engine could gate on.' },
  { path: 'zones[].collisionType', class: 'no-channel', absence: { kind: 'key-absent', key: 'collisionType' }, note: 'Collision channel hint: no channel.' },

  // ── Districts ───────────────────────────────────────────────────────
  { path: 'districts[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].id', note: '' },
  { path: 'districts[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].name', note: '' },
  { path: 'districts[].zoneIds[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].zoneIds[]', note: '' },
  { path: 'districts[].tags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].tags[]', note: '' },
  { path: 'districts[].controllingFaction', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].controllingFaction', note: '' },
  { path: 'districts[].baseMetrics.commerce', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].baseMetrics.commerce', note: '' },
  { path: 'districts[].baseMetrics.morale', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].baseMetrics.morale', note: '' },
  { path: 'districts[].baseMetrics.stability', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].baseMetrics.stability', note: '' },
  { path: 'districts[].baseMetrics.safety', class: 'carried-approximated', channel: 'contentPack', packPath: 'districts[].baseMetrics.surveillance', transform: 'safety-renamed-to-surveillance', note: 'convert-districts.ts:26 assigns authored SAFETY to engine SURVEILLANCE. They are not synonyms — a heavily-surveilled district is not a safe one; in the engine\'s own doctrine high surveillance drives heat and pursuit. The value crosses; the meaning inverts.' },
  { path: 'districts[].economyProfile.supplyCategories[]', class: 'no-channel', absence: { kind: 'key-absent', key: 'economyProfile' }, note: 'Dropped by convert-districts.ts:13-28 while the engine runs live per-district economies — the exact surface the 2.5D charter calls the moat.' },
  { path: 'districts[].economyProfile.scarcityDefaults{}', class: 'no-channel', absence: { kind: 'key-absent', key: 'economyProfile' }, note: 'See supplyCategories.' },

  // ── Landmarks (partially carried, via the binding map only) ─────────
  { path: 'landmarks[].id', class: 'carried-lossless', channel: 'assetBindings', packPath: 'landmarks{}', transform: 'id-as-binding-map-key', note: 'A landmark id survives ONLY as a key in the asset binding map, and only when the landmark has an iconId. A landmark with no icon vanishes entirely.' },
  { path: 'landmarks[].iconId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'landmarks{}.iconId', note: 'Same channel caveat: not part of the ContentPack.' },
  { path: 'landmarks[].name', class: 'no-channel', absence: { kind: 'value-absent' }, note: 'Points of interest do not reach the engine as content.' },
  { path: 'landmarks[].description', class: 'no-channel', absence: { kind: 'value-absent' }, note: 'See name.' },
  { path: 'landmarks[].zoneId', class: 'no-channel', absence: { kind: 'key-absent', key: 'zoneId', scope: [{ channel: 'assetBindings', packPath: 'landmarks{}' }] }, note: 'No landmark→zone link crosses. Scoped to the landmark\'s only surviving image (the binding map): `zoneId` DOES appear globally, on the raw-pass-through encounterAnchors and pressureHotspots, so a global proof would be false here while the claim is true.' },
  { path: 'landmarks[].gridX', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridX' }, note: 'No coordinates cross.' },
  { path: 'landmarks[].gridY', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridY' }, note: 'No coordinates cross.' },
  { path: 'landmarks[].tags[]', class: 'no-channel', absence: { kind: 'value-absent' }, note: 'Landmark tags do not cross.' },
  { path: 'landmarks[].interactionType', class: 'no-channel', absence: { kind: 'key-absent', key: 'interactionType' }, note: 'Landmark interaction type does not cross.' },

  // ── Faction presence + pressure (raw pass-through) ──────────────────
  { path: 'factionPresences[].factionId', class: 'carried-lossless', channel: 'contentPack', packPath: 'factionPresences[].factionId', note: 'Raw pass-through: export.ts:360 copies `project.factionPresences` unchanged into a pack key the ENGINE type does not declare.' },
  { path: 'factionPresences[].districtIds[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'factionPresences[].districtIds[]', note: 'Raw pass-through.' },
  { path: 'factionPresences[].influence', class: 'carried-lossless', channel: 'contentPack', packPath: 'factionPresences[].influence', note: 'Raw pass-through.' },
  { path: 'factionPresences[].alertLevel', class: 'carried-lossless', channel: 'contentPack', packPath: 'factionPresences[].alertLevel', note: 'Raw pass-through.' },
  { path: 'factionPresences[].patrolRoutes[].zoneIds[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'factionPresences[].patrolRoutes[].zoneIds[]', note: 'Raw pass-through.' },
  { path: 'pressureHotspots[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'pressureHotspots[].id', note: 'Raw pass-through.' },
  { path: 'pressureHotspots[].zoneId', class: 'carried-lossless', channel: 'contentPack', packPath: 'pressureHotspots[].zoneId', note: 'Raw pass-through.' },
  { path: 'pressureHotspots[].pressureType', class: 'carried-lossless', channel: 'contentPack', packPath: 'pressureHotspots[].pressureType', note: 'Raw pass-through.' },
  { path: 'pressureHotspots[].baseProbability', class: 'carried-lossless', channel: 'contentPack', packPath: 'pressureHotspots[].baseProbability', note: 'Raw pass-through.' },
  { path: 'pressureHotspots[].tags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'pressureHotspots[].tags[]', note: 'Raw pass-through.' },

  // ── Encounter anchors (raw pass-through) ────────────────────────────
  { path: 'encounterAnchors[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].id', note: 'Raw pass-through.' },
  { path: 'encounterAnchors[].zoneId', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].zoneId', note: 'Raw pass-through — and the ONLY entity-ish record whose zoneId survives export at all.' },
  { path: 'encounterAnchors[].encounterType', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].encounterType', note: 'Raw pass-through.' },
  { path: 'encounterAnchors[].enemyIds[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].enemyIds[]', note: 'Raw pass-through.' },
  { path: 'encounterAnchors[].probability', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].probability', note: 'Raw pass-through.' },
  { path: 'encounterAnchors[].cooldownTurns', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].cooldownTurns', note: 'Raw pass-through.' },
  { path: 'encounterAnchors[].tags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].tags[]', note: 'Raw pass-through.' },

  // ── Dialogues (field-by-field conversion, effectively identity) ─────
  { path: 'dialogues[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].id', note: '' },
  { path: 'dialogues[].speakers[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].speakers[]', note: '' },
  { path: 'dialogues[].entryNodeId', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].entryNodeId', note: '' },
  { path: 'dialogues[].nodes{}.id', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.id', note: '' },
  { path: 'dialogues[].nodes{}.speaker', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.speaker', note: '' },
  { path: 'dialogues[].nodes{}.text', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.text', note: 'Node text stays a plain STRING here — unlike zone description, which is wrapped in a TextBlock array. The two halves of the pack disagree about how text is shaped.' },
  { path: 'dialogues[].nodes{}.nextNodeId', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.nextNodeId', note: '' },
  { path: 'dialogues[].nodes{}.effects[].type', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.effects[].type', note: '' },
  { path: 'dialogues[].nodes{}.effects[].target', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.effects[].target', note: '' },
  { path: 'dialogues[].nodes{}.effects[].params{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.effects[].params{}', note: '' },
  { path: 'dialogues[].nodes{}.choices[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.choices[].id', note: '' },
  { path: 'dialogues[].nodes{}.choices[].text', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.choices[].text', note: '' },
  { path: 'dialogues[].nodes{}.choices[].nextNodeId', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.choices[].nextNodeId', note: '' },
  { path: 'dialogues[].nodes{}.choices[].condition.type', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.choices[].condition.type', note: 'A properly-shaped ConditionSpec — the shape zone exits fail to produce.' },
  { path: 'dialogues[].nodes{}.choices[].condition.params{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.choices[].condition.params{}', note: '' },
  { path: 'dialogues[].nodes{}.choices[].effects[].type', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.choices[].effects[].type', note: '' },
  { path: 'dialogues[].nodes{}.choices[].effects[].target', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.choices[].effects[].target', note: '' },
  { path: 'dialogues[].nodes{}.choices[].effects[].params{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'dialogues[].nodes{}.choices[].effects[].params{}', note: '' },

  // ── Player template (identity copy) ─────────────────────────────────
  { path: 'playerTemplate.name', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.name', note: '' },
  { path: 'playerTemplate.defaultArchetypeId', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.defaultArchetypeId', note: '' },
  { path: 'playerTemplate.defaultBackgroundId', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.defaultBackgroundId', note: '' },
  { path: 'playerTemplate.baseStats{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.baseStats{}', note: '' },
  { path: 'playerTemplate.baseResources{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.baseResources{}', note: '' },
  { path: 'playerTemplate.startingInventory[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.startingInventory[]', note: '' },
  { path: 'playerTemplate.startingEquipment{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.startingEquipment{}', note: '' },
  { path: 'playerTemplate.spawnPointId', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.spawnPointId', note: 'Crosses as a bare id whose referent (the SpawnPoint record) is dropped — a dangling reference by construction.' },
  { path: 'playerTemplate.tags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.tags[]', note: '' },
  { path: 'playerTemplate.custom{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'playerTemplate.custom{}', note: '' },

  // ── Build catalog (spread copy + packId) ────────────────────────────
  { path: 'buildCatalog.statBudget', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.statBudget', note: '' },
  { path: 'buildCatalog.maxTraits', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.maxTraits', note: '' },
  { path: 'buildCatalog.requiredFlaws', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.requiredFlaws', note: '' },
  { path: 'buildCatalog.archetypes[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.archetypes[].id', note: '' },
  { path: 'buildCatalog.archetypes[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.archetypes[].name', note: '' },
  { path: 'buildCatalog.archetypes[].description', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.archetypes[].description', note: '' },
  { path: 'buildCatalog.archetypes[].statPriorities{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.archetypes[].statPriorities{}', note: '' },
  { path: 'buildCatalog.archetypes[].resourceOverrides{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.archetypes[].resourceOverrides{}', note: '' },
  { path: 'buildCatalog.archetypes[].startingTags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.archetypes[].startingTags[]', note: '' },
  { path: 'buildCatalog.archetypes[].startingInventory[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.archetypes[].startingInventory[]', note: '' },
  { path: 'buildCatalog.archetypes[].progressionTreeId', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.archetypes[].progressionTreeId', note: '' },
  { path: 'buildCatalog.archetypes[].grantedVerbs[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.archetypes[].grantedVerbs[]', note: '' },
  { path: 'buildCatalog.backgrounds[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.backgrounds[].id', note: '' },
  { path: 'buildCatalog.backgrounds[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.backgrounds[].name', note: '' },
  { path: 'buildCatalog.backgrounds[].description', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.backgrounds[].description', note: '' },
  { path: 'buildCatalog.backgrounds[].statModifiers{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.backgrounds[].statModifiers{}', note: '' },
  { path: 'buildCatalog.backgrounds[].startingTags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.backgrounds[].startingTags[]', note: '' },
  { path: 'buildCatalog.backgrounds[].startingInventory[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.backgrounds[].startingInventory[]', note: '' },
  { path: 'buildCatalog.backgrounds[].factionModifiers{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.backgrounds[].factionModifiers{}', note: '' },
  { path: 'buildCatalog.traits[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.traits[].id', note: '' },
  { path: 'buildCatalog.traits[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.traits[].name', note: '' },
  { path: 'buildCatalog.traits[].description', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.traits[].description', note: '' },
  { path: 'buildCatalog.traits[].category', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.traits[].category', note: '' },
  { path: 'buildCatalog.traits[].effects[].type', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.traits[].effects[].type', note: '' },
  { path: 'buildCatalog.traits[].effects[].stat', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.traits[].effects[].stat', note: '' },
  { path: 'buildCatalog.traits[].effects[].amount', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.traits[].effects[].amount', note: '' },
  { path: 'buildCatalog.traits[].incompatibleWith[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.traits[].incompatibleWith[]', note: '' },
  { path: 'buildCatalog.disciplines[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].id', note: '' },
  { path: 'buildCatalog.disciplines[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].name', note: '' },
  { path: 'buildCatalog.disciplines[].description', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].description', note: '' },
  { path: 'buildCatalog.disciplines[].grantedVerb', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].grantedVerb', note: '' },
  { path: 'buildCatalog.disciplines[].passive.type', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].passive.type', note: '' },
  { path: 'buildCatalog.disciplines[].passive.resource', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].passive.resource', note: '' },
  { path: 'buildCatalog.disciplines[].passive.amount', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].passive.amount', note: '' },
  { path: 'buildCatalog.disciplines[].drawback.type', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].drawback.type', note: '' },
  { path: 'buildCatalog.disciplines[].drawback.stat', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].drawback.stat', note: '' },
  { path: 'buildCatalog.disciplines[].drawback.amount', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].drawback.amount', note: '' },
  { path: 'buildCatalog.disciplines[].requiredTags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.disciplines[].requiredTags[]', note: '' },
  { path: 'buildCatalog.crossTitles[].archetypeId', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.crossTitles[].archetypeId', note: '' },
  { path: 'buildCatalog.crossTitles[].disciplineId', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.crossTitles[].disciplineId', note: '' },
  { path: 'buildCatalog.crossTitles[].title', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.crossTitles[].title', note: '' },
  { path: 'buildCatalog.crossTitles[].tags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.crossTitles[].tags[]', note: '' },
  { path: 'buildCatalog.entanglements[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.entanglements[].id', note: '' },
  { path: 'buildCatalog.entanglements[].archetypeId', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.entanglements[].archetypeId', note: '' },
  { path: 'buildCatalog.entanglements[].disciplineId', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.entanglements[].disciplineId', note: '' },
  { path: 'buildCatalog.entanglements[].description', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.entanglements[].description', note: '' },
  { path: 'buildCatalog.entanglements[].effects[].type', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.entanglements[].effects[].type', note: '' },
  { path: 'buildCatalog.entanglements[].effects[].tag', class: 'carried-lossless', channel: 'contentPack', packPath: 'buildCatalog.entanglements[].effects[].tag', note: '' },

  // ── Progression trees (field-by-field copy) ─────────────────────────
  { path: 'progressionTrees[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].id', note: '' },
  { path: 'progressionTrees[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].name', note: '' },
  { path: 'progressionTrees[].currency', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].currency', note: '' },
  { path: 'progressionTrees[].nodes[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].nodes[].id', note: '' },
  { path: 'progressionTrees[].nodes[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].nodes[].name', note: '' },
  { path: 'progressionTrees[].nodes[].description', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].nodes[].description', note: '' },
  { path: 'progressionTrees[].nodes[].cost', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].nodes[].cost', note: '' },
  { path: 'progressionTrees[].nodes[].requires[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].nodes[].requires[]', note: '' },
  { path: 'progressionTrees[].nodes[].effects[].type', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].nodes[].effects[].type', note: '' },
  { path: 'progressionTrees[].nodes[].effects[].target', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].nodes[].effects[].target', note: '' },
  { path: 'progressionTrees[].nodes[].effects[].params{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'progressionTrees[].nodes[].effects[].params{}', note: '' },

  // ── Entity placements ───────────────────────────────────────────────
  { path: 'entityPlacements[].entityId', class: 'carried-lossless', channel: 'contentPack', packPath: 'entities[].id', transform: 'renamed-key', note: '' },
  { path: 'entityPlacements[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'entities[].name', note: 'Falls back to entityId when unset.' },
  { path: 'entityPlacements[].role', class: 'carried-approximated', channel: 'contentPack', packPath: 'entities[].type', transform: 'ROLE_TO_TYPE-collapse', note: 'Six authored roles collapse to two engine types (convert-entities.ts:6): merchant / quest-giver / companion all become `npc`, boss becomes `enemy`. The distinction survives only indirectly, via the tags ROLE_TAGS adds.' },
  { path: 'entityPlacements[].tags[]', class: 'carried-approximated', channel: 'contentPack', packPath: 'entities[].tags[]', transform: 'merged-with-ROLE_TAGS-and-faction-tag', note: 'The exported tag list is authored tags UNION ROLE_TAGS[role] UNION `faction:<id>` — so it is a superset, and an importer cannot tell an authored `boss` tag from a role-derived one.' },
  { path: 'entityPlacements[].factionId', class: 'carried-approximated', channel: 'contentPack', packPath: 'entities[].tags[]', transform: 'encoded-as-faction-tag', note: 'A typed faction reference becomes the string `faction:<id>` inside a flat tag list. If the id is not declared in factionPresences it becomes the literal `faction:UNKNOWN` (with a warning) — the reference is destroyed, not just retyped.' },
  { path: 'entityPlacements[].ai.profileId', class: 'carried-approximated', channel: 'contentPack', packPath: 'entities[].aiProfile', transform: 'renamed-with-role-default-fallback', note: 'Carried when authored; otherwise SUBSTITUTED from ROLE_AI_PROFILE, so an unset field and an authored one are indistinguishable downstream.' },
  { path: 'entityPlacements[].stats{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'entities[].baseStats{}', transform: 'renamed-key', note: 'Omitted entirely when empty.' },
  { path: 'entityPlacements[].resources{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'entities[].baseResources{}', transform: 'renamed-key', note: 'Omitted entirely when empty.' },
  { path: 'entityPlacements[].custom{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'entities[].custom{}', note: 'Copied onto the blueprint under a key `EntityBlueprint` does not declare (cast through Record<string, unknown> at convert-entities.ts).' },
  { path: 'entityPlacements[].zoneId', class: 'no-channel', absence: { kind: 'key-absent', key: 'zoneId', scope: [{ channel: 'contentPack', packPath: 'entities[]' }] }, note: 'THE placement itself is dropped. `EntityBlueprint` has no location field, so an exported pack cannot say where any NPC stands — the single most consequential drop in the lane. Scoped to entities[] because `zoneId` DOES survive on the two raw pass-through domains.' },
  { path: 'entityPlacements[].gridX', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridX' }, note: 'No coordinates cross.' },
  { path: 'entityPlacements[].gridY', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridY' }, note: 'No coordinates cross.' },
  { path: 'entityPlacements[].spawnCondition', class: 'no-channel', absence: { kind: 'value-absent' }, note: 'The SpawnCondition grammar\'s ORIGINAL home field is dropped on export, while zone-exit conditions (a later borrower of the same grammar) are carried garbled. The grammar has no intact channel anywhere.' },
  { path: 'entityPlacements[].dialogueId', class: 'no-channel', absence: { kind: 'key-absent', key: 'dialogueId' }, note: 'The entity→dialogue binding is dropped even though BOTH sides cross: entities are exported and dialogues are exported, but nothing links them.' },
  { path: 'entityPlacements[].ai.goals[]', class: 'no-channel', absence: { kind: 'value-absent', scope: [{ channel: 'contentPack', packPath: 'entities[]' }] }, note: 'Authored AI goals do not cross.' },
  { path: 'entityPlacements[].ai.fears[]', class: 'no-channel', absence: { kind: 'value-absent', scope: [{ channel: 'contentPack', packPath: 'entities[]' }] }, note: 'Authored AI fears do not cross. Scoped: an authored fear ("flooding") collides with an unrelated `pressureHotspots[].pressureType` value, which an unscoped proof reads as carriage.' },
  { path: 'entityPlacements[].portraitId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'entities{}.portraitId', note: 'Binding-map channel only; not in the ContentPack.' },
  { path: 'entityPlacements[].spriteId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'entities{}.spriteId', note: 'Binding-map channel only; not in the ContentPack.' },

  // ── Item placements ─────────────────────────────────────────────────
  { path: 'itemPlacements[].itemId', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].id', transform: 'renamed-key', note: '' },
  { path: 'itemPlacements[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].name', note: 'Falls back to itemId when unset.' },
  { path: 'itemPlacements[].description', class: 'carried-approximated', channel: 'contentPack', packPath: 'items[].description', transform: 'synthesised-when-absent', note: 'When authored it crosses verbatim. When absent the exporter SYNTHESISES `Found in <container>` (or the literal `An item.`), so an unauthored description is indistinguishable from an authored one downstream.' },
  { path: 'itemPlacements[].container', class: 'carried-approximated', channel: 'contentPack', packPath: 'items[].description', transform: 'folded-into-synthesised-description', note: 'Container survives ONLY as prose inside a synthesised description, and ONLY when `description` is unset (convert-items.ts). Authoring both silently drops the container. The fixture exercises both branches.' },
  { path: 'itemPlacements[].slot', class: 'carried-approximated', channel: 'contentPack', packPath: 'items[].slot', transform: 'narrowSlot-silent-fallback', note: 'The schema declares SIX slots; convert-items accepts five. `consumable` — a legal authored slot — silently becomes `trinket`, with no warning and no fidelity entry. The fixture authors a consumable to prove it.' },
  { path: 'itemPlacements[].rarity', class: 'carried-approximated', channel: 'contentPack', packPath: 'items[].rarity', transform: 'narrowRarity-silent-fallback', note: 'Same silent-fallback shape as slot; the four schema rarities happen to match the engine set today, so nothing is lost YET.' },
  { path: 'itemPlacements[].statModifiers{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].statModifiers{}', note: 'Omitted entirely when empty.' },
  { path: 'itemPlacements[].resourceModifiers{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].resourceModifiers{}', note: 'Omitted entirely when empty.' },
  { path: 'itemPlacements[].grantedTags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].grantedTags[]', note: 'Omitted entirely when empty.' },
  { path: 'itemPlacements[].grantedVerbs[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].grantedVerbs[]', note: 'Omitted entirely when empty.' },
  { path: 'itemPlacements[].hidden', class: 'carried-approximated', channel: 'contentPack', packPath: 'items[].provenance.flags[]', transform: 'boolean-reencoded-as-contraband-flag', note: 'A boolean "hidden on the map" becomes the ECONOMIC flag `contraband` on item provenance. Only the true case is encoded; `hidden: false` writes nothing, so the field is not recoverable, and the meaning shifts from placement to legality.' },
  { path: 'itemPlacements[].iconId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'items{}.iconId', note: 'Binding-map channel only; not in the ContentPack.' },
  { path: 'itemPlacements[].zoneId', class: 'no-channel', absence: { kind: 'key-absent', key: 'zoneId', scope: [{ channel: 'contentPack', packPath: 'items[]' }] }, note: 'Item PLACEMENT is dropped: `ItemDefinition` is a catalog record with no location. An exported pack knows every item and where none of them are.' },
  { path: 'itemPlacements[].gridX', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridX' }, note: 'No coordinates cross.' },
  { path: 'itemPlacements[].gridY', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridY' }, note: 'No coordinates cross.' },
  { path: 'itemPlacements[].lootTableId', class: 'no-channel', absence: { kind: 'value-absent' }, note: 'The loot-table reference is dropped along with the loot tables themselves.' },

  // ── Assets / asset packs (World-Forge-side round-trip channels) ─────
  { path: 'assets[].id', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].id', note: 'The whole `assets` array is passed through untouched into ExportResult.assets — a World Forge re-import channel with no engine reader.' },
  { path: 'assets[].kind', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].kind', note: '' },
  { path: 'assets[].label', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].label', note: '' },
  { path: 'assets[].path', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].path', note: '' },
  { path: 'assets[].version', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].version', note: '' },
  { path: 'assets[].tags[]', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].tags[]', note: '' },
  { path: 'assets[].packId', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].packId', note: '' },
  { path: 'assets[].provenance.source', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].provenance.source', note: '' },
  { path: 'assets[].provenance.author', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].provenance.author', note: '' },
  { path: 'assets[].provenance.license', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].provenance.license', note: '' },
  { path: 'assets[].provenance.createdAt', class: 'carried-lossless', channel: 'assets', packPath: 'assets[].provenance.createdAt', note: '' },
  { path: 'assetPacks[].id', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].id', note: 'Same pass-through channel as assets.' },
  { path: 'assetPacks[].label', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].label', note: '' },
  { path: 'assetPacks[].version', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].version', note: '' },
  { path: 'assetPacks[].description', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].description', note: '' },
  { path: 'assetPacks[].tags[]', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].tags[]', note: '' },
  { path: 'assetPacks[].theme', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].theme', note: '' },
  { path: 'assetPacks[].source', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].source', note: '' },
  { path: 'assetPacks[].license', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].license', note: '' },
  { path: 'assetPacks[].author', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].author', note: '' },
  { path: 'assetPacks[].compatibility.minSchemaVersion', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].compatibility.minSchemaVersion', note: '' },
  { path: 'assetPacks[].compatibility.engineVersion', class: 'carried-lossless', channel: 'assetPacks', packPath: 'assetPacks[].compatibility.engineVersion', note: 'The AUTHOR-declared engine version, distinct from the hard-coded `2.0.0` the exporter writes into the manifest.' },
];
