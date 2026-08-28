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
  // connections moved OUT of DROPPED_CONTAINERS by swarm wave-32 (F-2d93b8d0)
  // — see CONNECTION_ROWS below.
  // spawnPoints moved OUT of DROPPED_CONTAINERS by swarm wave-32 (F-0e432e10)
  // — see SPAWN_POINT_ROWS below.
  // craftingStations/marketNodes moved OUT of DROPPED_CONTAINERS by swarm
  // wave-4 (F-f216da1a) — see CRAFTING_STATION_ROWS/MARKET_NODE_ROWS below.
  // Kept as a comment rather than deleted, the same reason hazardDefinitions'
  // and lootTables' entries were: the diff should show a domain LEAVING this
  // list, which is the shape of progress here.
  // buildings/hubs/strongholds moved OUT of DROPPED_CONTAINERS by swarm
  // wave-32 (F-5f16cf2e) — see BUILDING_ROWS/HUB_ROWS/STRONGHOLD_ROWS below.
  // strata/stratumLinks/transitions moved OUT of DROPPED_CONTAINERS by
  // leftover F-5dcb8b8a — see STRATA_ROWS / STRATUM_LINK_ROWS / TRANSITION_ROWS.
  // hazardDefinitions moved OUT of DROPPED_CONTAINERS by C3/P3 — see
  // HAZARD_DEFINITION_ROWS below. Kept as a comment rather than deleted so the
  // diff shows a domain LEAVING this list, which is the shape of progress here.
  tilesets: 'Tilesets and their tiles have no pack field (visual layer; client-owned by the charter, but also unreachable by World Forge\'s own importer).',
  tileLayers: 'Tile layers have no pack field.',
  props: 'Prop definitions have no pack field.',
  propPlacements: 'Prop placements have no pack field.',
  ambientLayers: 'Ambient layers (fog / rain / dust) have no pack field.',
  // lootTables moved OUT of DROPPED_CONTAINERS by swarm wave-2 (F-ee46a52c) —
  // see LOOT_TABLE_ROWS below. Kept as a comment for the same reason
  // hazardDefinitions' entry was: the diff should show a domain LEAVING this
  // list, which is the shape of progress here.
};

/**
 * Explicit rows for every field NOT covered by `DROPPED_CONTAINERS`. Order is
 * cosmetic; the differ sorts.
 */
/**
 * C3/P3 — the typed-hazard rows.
 *
 * ⚠ THIS DOMAIN LEFT `DROPPED_CONTAINERS`, which is the whole point. C0 filed it
 * there with "Typed hazard definitions have no pack field. Only the LEGACY
 * free-text `Zone.hazards: string[]` crosses", and C0 §9 called closing it "the
 * highest-value single item, because it closes a structural hole rather than a
 * wire hole: today hazard meaning lives in pack closures, so NO data format can
 * express it."
 *
 * Every field is `carried-lossless` — the spec crosses byte-for-byte, deliberately
 * mirroring world-forge's authored shape so the vocabulary is CO-EVOLVED rather
 * than translated (charter §5 row C3). Three fields are carried and honestly
 * INERT at the runtime (`moveCostDelta`, `blocksVision`, and the weather gate when
 * no weather source exists); the export table cannot see that difference, and the
 * engine-side interpreter reports each one by name instead. Two instruments, two
 * claims — the same split as `encounterAnchors`.
 */
const HAZARD_DEFINITION_ROWS: ExportRow[] = (
  [
    ['id', 'The hazard identity `Zone.hazardRefs` binds to.'],
    ['name', 'Player-facing name, used in the hazard.damage.applied payload.'],
    ['trigger', 'on-enter / per-turn / on-exit / timed. The interpreter refuses an unknown trigger rather than defaulting.'],
    ['effects[].kind', 'The CLOSED effect union — damage / status / instakill / ignite. An unknown kind is REFUSED at intake: content selects a kind, it never defines one (RG-C1 Lane 2, Bethesda CTDA).'],
    ['effects[].amount', 'Flat damage, or a fraction of maxHp when amountIsPercentMaxHp.'],
    ['effects[].amountIsPercentMaxHp', 'FFT poison’s fraction form.'],
    ['effects[].tickOn', 'turn-start / turn-end.'],
    ['effects[].durationTicks', 'Present ⇒ applied through status-core’s EXISTING periodic (DoT) machinery, not a bespoke timer.'],
    ['effects[].statusId', 'Bound to the real status system via applyStatus — FFT’s tile-poison === spell-poison rule, which is the forge’s own docstring.'],
    ['effects[].chance', 'Proc chance, compared against a PURE hash of (seed, tick, hazard, entity) — never Math.random, so byte-identical replay survives.'],
    ['effects[].stacking', 'refresh / stack / ignore. `ignore` has no applyStatus counterpart and is mapped explicitly rather than silently aliased.'],
    ['effects[].igniteChance', 'Ignite proc chance. The burn status id comes from a `burn:<id>` tag; absent that, ignite is REFUSED with what to declare.'],
    ['moveCostDelta', 'Carried and REPORTED INERT: the engine has no movement-cost economy to spend into.'],
    ['passable', 'yes / flying-only / never. Enforced in the move handler beside entry gates — one refusal mechanism, two reasons.'],
    ['blocksVision', 'Carried and REPORTED INERT: no perception reader consumes a per-zone vision block yet.'],
    ['weatherConditions[]', 'Gated on `globals.weather`. No weather source exists, so the hazard is treated ACTIVE and the gate is reported UNEVALUABLE — fail-OPEN here, unlike a gate’s fail-closed, because a hazard that silently stops existing is a floor the player crosses safely by accident.'],
    ['immuneTags[]', 'Checked against EntityState.tags before any effect. `tags` is the richest carried entity field in the lane.'],
    ['tags[]', 'Free tags; also carries the `burn:<statusId>` convention ignite reads.'],
  ] as const
).map(([field, note]) => ({
  path: `hazardDefinitions[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `hazardDefinitions[].${field}`,
  note: `CLOSED BY C3/P3. ${note}`,
}));

/**
 * F-ee46a52c (swarm wave-2) — the loot-table rows.
 *
 * ⚠ THIS DOMAIN LEFT `DROPPED_CONTAINERS`, the same transition
 * HAZARD_DEFINITION_ROWS made for C3/P3. The finding: `WorldProject.lootTables`
 * was read NOWHERE in this package despite the schema validating it
 * extensively (duplicate-id checks, SpawnCondition-grammar entry conditions,
 * two-way referential integrity with `itemPlacements[].lootTableId`) — a
 * complete silent drop of an entire authored subsystem, filed by the
 * coordinator brief as exactly the highest-priority defect class for this
 * audit.
 *
 * Every field is `carried-lossless` as a RAW PASS-THROUGH — the same
 * un-converted shape as `factionPresences[]`/`pressureHotspots[]`/
 * `encounterAnchors[]` above, because the engine has no `LootTable`-shaped
 * type of its own to convert INTO (zero hits across every installed
 * `@ai-rpg-engine/*` package). `entries[].itemId` needs no remapping: items
 * are exported keyed by the same `itemId` the author used.
 *
 * `entries[].condition` is the one field worth flagging even though its class
 * is still `carried-lossless`: it crosses as the RAW authored
 * SpawnCondition-grammar STRING, uncompiled — unlike zone exits / entryGate /
 * entity placements, which all compile through `parseSpawnCondition`. That is
 * a deliberate, narrower scope: the engine has no loot-table reader yet to
 * define what shape it expects, so compiling now would guess at a contract
 * that does not exist.
 */
const LOOT_TABLE_ROWS: ExportRow[] = (
  [
    ['id', 'The loot table identity `itemPlacements[].lootTableId` references.'],
    ['rolls', 'Total rolls per open/kill/chest. Optional on the schema; the engine has no default of its own to disagree with yet.'],
    ['entries[].itemId', 'References an item in the pack\'s own `items[]` catalog — the same id convertItems emits, so the reference resolves with zero remapping.'],
    ['entries[].weight', 'Relative weight for the weighted pick.'],
    ['entries[].quantity.min', 'Quantity range floor.'],
    ['entries[].quantity.max', 'Quantity range ceiling.'],
    ['entries[].rarity', 'Optional per-entry rarity tier for UI display.'],
    ['tags[]', 'Free tags for filtering/discovery.'],
  ] as const
).map(([field, note]) => ({
  path: `lootTables[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `lootTables[].${field}`,
  note: `CLOSED BY swarm wave-2 (F-ee46a52c). ${note}`,
}));

/**
 * F-f216da1a (swarm wave-4) — the crafting-station and market-node rows.
 *
 * ⚠ THIS DOMAIN LEFT `DROPPED_CONTAINERS`, the same transition
 * HAZARD_DEFINITION_ROWS and LOOT_TABLE_ROWS made. The finding:
 * `WorldProject.craftingStations` and `.marketNodes` were read NOWHERE in
 * this package despite BOTH being REQUIRED (not optional) fields, validated
 * extensively (duplicate-id checks, dangling-zone checks, and for
 * marketNodes a dangling-merchant-entity check) — a complete silent drop of
 * an entire authored subsystem, in BOTH round-trip directions (the importer
 * hardcoded `[]` right back), and compounded by the manifest unconditionally
 * claiming the `'crafting-core'` module regardless of whether any crafting
 * content crossed.
 *
 * Every field is `carried-lossless` as a RAW PASS-THROUGH — the same
 * un-converted shape as `lootTables[]` immediately above and
 * `factionPresences[]`/`pressureHotspots[]` further below — because this
 * package's own ContentPack has no dedicated station/market vocabulary of
 * its own to convert INTO.
 */
const CRAFTING_STATION_ROWS: ExportRow[] = (
  [
    ['id', 'The station identity.'],
    ['zoneId', 'Which zone the station stands in.'],
    ['stationType', 'Free-text station kind (e.g. ropewalk, forge).'],
    ['availableRecipes[]', 'Recipe ids the station unlocks. No cross-reference to a recipe catalog exists on either side yet.'],
  ] as const
).map(([field, note]) => ({
  path: `craftingStations[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `craftingStations[].${field}`,
  note: `CLOSED BY swarm wave-4 (F-f216da1a). ${note}`,
}));

const MARKET_NODE_ROWS: ExportRow[] = (
  [
    ['id', 'The market node identity.'],
    ['zoneId', 'Which zone the node stands in.'],
    ['merchantEntityId', 'Optional back-reference to the entity who runs the stall; validated against entityPlacements at authoring time (packages/schema/src/validate.ts:1414) but not re-resolved on export.'],
    ['supplyCategories[]', 'Free-text categories of goods the node stocks.'],
    ['priceModifier', 'Multiplier applied against base item prices.'],
    ['contrabandAvailable', 'Whether illegal goods surface at this node.'],
  ] as const
).map(([field, note]) => ({
  path: `marketNodes[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `marketNodes[].${field}`,
  note: `CLOSED BY swarm wave-4 (F-f216da1a). ${note}`,
}));

const CONNECTION_ROWS: ExportRow[] = [
  ...(
    [
      ['fromZoneId', 'Source zone id.'],
      ['toZoneId', 'Target zone id.'],
      ['kind', 'ConnectionKind (door / warp / secret / …). Missing kind defaults to passage.'],
      ['bidirectional', 'Whether the edge is two-way.'],
      ['label', 'Optional display label.'],
    ] as const
  ).map(([field, note]) => ({
    path: `connections[].${field}`,
    class: 'carried-lossless' as const,
    channel: 'contentPack' as const,
    packPath: `connections[].${field}`,
    note: `CLOSED BY swarm wave-32 (F-2d93b8d0). ${note}`,
  })),
  {
    path: 'connections[].condition',
    class: 'carried-approximated',
    channel: 'contentPack',
    packPath: 'connections[].condition.type',
    transform: 'compiled-through-parseSpawnCondition',
    note: 'CLOSED BY swarm wave-32 (F-2d93b8d0). The grammar string COMPILES into a ConditionSpec ({type, params}) — the same ink pattern as zone exits and entity spawnCondition.',
  },
];

const SPAWN_POINT_ROWS: ExportRow[] = (
  [
    ['id', 'Spawn identity. playerTemplate.spawnPointId is a pointer into this array.'],
    ['zoneId', 'Which zone the player starts in.'],
    ['gridX', 'Tile X. Optional on the wire (charter); schema authors it.'],
    ['gridY', 'Tile Y.'],
    ['isDefault', 'Whether this is the default start.'],
  ] as const
).map(([field, note]) => ({
  path: `spawnPoints[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `spawnPoints[].${field}`,
  note: `CLOSED BY swarm wave-32 (F-0e432e10). ${note}`,
}));

const BUILDING_ROWS: ExportRow[] = (
  [
    ['id', 'Building identity.'],
    ['name', 'Player-facing name.'],
    ['buildingType', 'Free-form kind (house / shop / temple / …).'],
    ['gridX', 'Footprint origin X.'],
    ['gridY', 'Footprint origin Y.'],
    ['width', 'Footprint width in tiles.'],
    ['height', 'Footprint height in tiles.'],
    ['zoneId', 'Town zone the building sits in.'],
    ['interiorZoneId', 'Interior zone entered from this building.'],
    ['tags[]', 'Free tags.'],
  ] as const
).map(([field, note]) => ({
  path: `buildings[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `buildings[].${field}`,
  note: `CLOSED BY swarm wave-32 (F-5f16cf2e). Raw pass-through. ${note}`,
}));

const HUB_ROWS: ExportRow[] = (
  [
    ['id', 'Hub identity.'],
    ['name', 'Player-facing name.'],
    ['zoneId', 'Anchor zone.'],
    ['hubType', 'Free-form kind (market-square / crossroads / …).'],
    ['serviceTypes[]', 'Services offered.'],
    ['connectedZoneIds[]', 'Zones this hub serves.'],
    ['tags[]', 'Free tags.'],
  ] as const
).map(([field, note]) => ({
  path: `hubs[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `hubs[].${field}`,
  note: `CLOSED BY swarm wave-32 (F-5f16cf2e). Raw pass-through. ${note}`,
}));

const STRONGHOLD_ROWS: ExportRow[] = (
  [
    ['id', 'Stronghold identity.'],
    ['name', 'Player-facing name.'],
    ['zoneId', 'Occupied zone.'],
    ['factionId', 'Controlling faction.'],
    ['defenseLevel', 'Fortification strength.'],
    ['garrisonEntityIds[]', 'Garrisoned entity ids.'],
    ['tags[]', 'Free tags.'],
  ] as const
).map(([field, note]) => ({
  path: `strongholds[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `strongholds[].${field}`,
  note: `CLOSED BY swarm wave-32 (F-5f16cf2e). Raw pass-through. ${note}`,
}));

const STRATA_ROWS: ExportRow[] = (
  [
    ['id', 'Stratum identity.'],
    ['name', 'Player-facing layer name.'],
    ['order', 'Signed vertical order (surface = 0).'],
    ['zRange.floor', 'Optional metric span floor.'],
    ['zRange.ceiling', 'Optional metric span ceiling.'],
    ['visibleStrata[]', 'PVS neighbour stratum ids.'],
    ['tags[]', 'Free tags.'],
  ] as const
).map(([field, note]) => ({
  path: `strata[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `strata[].${field}`,
  note: `CLOSED BY leftover F-5dcb8b8a. Raw pass-through. ${note}`,
}));

const STRATUM_LINK_ROWS: ExportRow[] = (
  [
    ['id', 'Link identity.'],
    ['fromStratumId', 'Source stratum.'],
    ['toStratumId', 'Target stratum.'],
    ['fromZoneId', 'Optional source-zone anchor.'],
    ['toZoneId', 'Optional target-zone anchor.'],
    ['bidirectional', 'Whether the link is two-way.'],
    ['linkType', 'stairs / ladder / elevator / shaft / ramp.'],
  ] as const
).map(([field, note]) => ({
  path: `stratumLinks[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `stratumLinks[].${field}`,
  note: `CLOSED BY leftover F-5dcb8b8a. Raw pass-through. ${note}`,
}));

const TRANSITION_ROWS: ExportRow[] = (
  [
    ['id', 'Transition identity.'],
    ['zoneId', 'Source zone.'],
    ['targetZoneId', 'Destination zone.'],
    ['type', 'elevator / warp / transporter / cargo-lift / stairwell.'],
    ['gridX', 'Optional grid anchor X.'],
    ['gridY', 'Optional grid anchor Y.'],
    ['label', 'Display label.'],
    ['animation', 'Optional animation key.'],
    ['durationSeconds', 'Travel duration hint.'],
    ['tags[]', 'Free tags.'],
  ] as const
).map(([field, note]) => ({
  path: `transitions[].${field}`,
  class: 'carried-lossless' as const,
  channel: 'contentPack' as const,
  packPath: `transitions[].${field}`,
  note: `CLOSED BY leftover F-5dcb8b8a. Raw pass-through. ${note}`,
}));

export const EXPLICIT_ROWS: ExportRow[] = [
  ...HAZARD_DEFINITION_ROWS,
  ...LOOT_TABLE_ROWS,
  ...CRAFTING_STATION_ROWS,
  ...MARKET_NODE_ROWS,
  ...CONNECTION_ROWS,
  ...SPAWN_POINT_ROWS,
  ...BUILDING_ROWS,
  ...HUB_ROWS,
  ...STRONGHOLD_ROWS,
  ...STRATA_ROWS,
  ...STRATUM_LINK_ROWS,
  ...TRANSITION_ROWS,
  {
    path: 'lootTables[].entries[].condition',
    class: 'carried-approximated',
    channel: 'contentPack',
    packPath: 'lootTables[].entries[].condition.type',
    transform: 'compiled-through-parseSpawnCondition',
    note: 'CLOSED BY leftover F-ef6779cc. Grammar string compiles through parseSpawnCondition like zone exits / entryGate.',
  },
  // ── Project identity ────────────────────────────────────────────────
  { path: 'id', class: 'carried-lossless', channel: 'manifest', packPath: 'id', note: 'Also lands on packMeta.id, buildCatalog.packId, and manifest.contentPacks[].' },
  { path: 'name', class: 'carried-lossless', channel: 'manifest', packPath: 'title', transform: 'renamed-key', note: 'manifest.title and packMeta.name both receive it verbatim.' },
  { path: 'version', class: 'carried-lossless', channel: 'manifest', packPath: 'version', note: 'Also packMeta.version. Distinct from manifest.engineVersion, which is hard-coded.' },
  { path: 'description', class: 'carried-lossless', channel: 'packMeta', packPath: 'description', note: 'Also truncated to 100 chars into packMeta.tagline (convert-pack.ts:129).' },
  { path: 'narratorTone', class: 'carried-lossless', channel: 'packMeta', packPath: 'narratorTone', note: 'Verbatim.' },
  { path: 'genre', class: 'carried-approximated', channel: 'packMeta', packPath: 'genres[]', transform: 'GENRE_MAP-with-warned-fallback', note: 'Mapped through GENRE_MAP, identity-derived from VALID_GENRES so mercantile/pursuit cannot sit unmapped. `detective`→`mystery`, `zombie`→`post-apocalyptic`; an UNMAPPED genre becomes `fantasy` WITH a warning naming the authored value and the fallback (F-0fdda22c).' },
  { path: 'tones[]', class: 'carried-approximated', channel: 'packMeta', packPath: 'tones[]', transform: 'TONE_MAP-filtered', note: 'Mapped through TONE_MAP; unrecognised tones are dropped (warned), and an all-invalid list falls back to [\'atmospheric\'].' },
  { path: 'difficulty', class: 'carried-approximated', channel: 'packMeta', packPath: 'difficulty', transform: 'DIFFICULTY_MAP-with-warned-fallback', note: 'Six authored values collapse to three engine tiers; unmapped becomes `intermediate` WITH a warning naming the authored value and the fallback (F-0fdda22c).' },
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
  // ⚠ FLIPPED BY C3/P1 — A ROW C1 SHOULD HAVE FLIPPED AND DIDN'T.
  //
  // C0 classified this the audit's single `carried-garbled` row, with the note:
  // "The SpawnCondition string (`item:rope`) is stuffed WHOLE into
  // `ConditionSpec.type` with `params: {}` (convert-zones.ts:48).
  // `parseSpawnCondition` is never called." C1 fixed exactly that — the exporter
  // compiles through `parseSpawnCondition` now — and flipped its own bespoke
  // assertion in `c0-export-table.test.ts` ("CLOSED BY C1/P2: zone exits COMPILE
  // …"). It did NOT flip THIS row, so the committed artifact kept reporting
  // `carried-garbled: 1` and kept publishing a note claiming the parser is never
  // called, for a whole cycle after that stopped being true.
  //
  // ⚠ AND THE DIFFER CANNOT CATCH IT. A named-transform row is verified by
  // confirming values exist at the packPath; both the garbled form
  // (`type: 'item:rope'`) and the compiled form (`type: 'has-item'`) put a
  // string there. The generated evidence line says so out loud — "semantics
  // asserted separately" — which is the honest limit of a shallow check and the
  // reason a row's PROSE is not self-verifying. Worth carrying: a table that
  // mechanically verifies 377 of 377 rows can still be wrong about what a row
  // MEANS, and `verified: true` is not `correct: true`.
  { path: 'zones[].exits[].condition', class: 'carried-approximated', channel: 'contentPack', packPath: 'zones[].exits[].condition.type', transform: 'compiled-through-parseSpawnCondition', note: 'CLOSED BY C1/P2 (row flipped by C3/P1). The grammar string COMPILES into a ConditionSpec — `item:rope` → `{type:"has-item", params:{id:"rope"}}` — so `type` names a condition KIND and the operands live in `params`, which was C0\'s exact complaint. Decompiled back by formatConditionSpec on import (C3/P1); the round-trip is pinned over all thirteen operand families.' },
  { path: 'zones[].backgroundId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'zones{}.backgroundId', note: 'Survives only in the World-Forge-side asset binding map, which is NOT part of the ContentPack the engine loads.' },
  { path: 'zones[].tilesetId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'zones{}.tilesetId', note: 'Same channel caveat as backgroundId.' },

  // ── Zones — dropped ─────────────────────────────────────────────────
  { path: 'zones[].gridX', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridX', scope: [{ channel: 'contentPack', packPath: 'zones[]' }] }, note: 'Zone coordinates do not cross onto the engine zone record. Scoped because spawnPoints / itemPlacements / buildings now carry gridX, and a global key-absent proof would read those as zone carriage.' },
  { path: 'zones[].gridY', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridY', scope: [{ channel: 'contentPack', packPath: 'zones[]' }] }, note: 'See gridX. Scoped because spawnPoints / itemPlacements / buildings now carry gridY.' },
  { path: 'zones[].gridWidth', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridWidth', scope: [{ channel: 'contentPack', packPath: 'zones[]' }] }, note: 'Zone size does not cross onto the engine zone record. Scoped because pack meta carries map-level gridWidth.' },
  { path: 'zones[].gridHeight', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridHeight', scope: [{ channel: 'contentPack', packPath: 'zones[]' }] }, note: 'See gridWidth. Scoped because pack meta carries map-level gridHeight.' },
  { path: 'zones[].parentDistrictId', class: 'no-channel', absence: { kind: 'key-absent', key: 'parentDistrictId' }, note: 'The zone→district back-reference is dropped; only the district\'s own forward `zoneIds[]` list crosses, so the relation survives one-way by accident of the district converter.' },
  { path: 'zones[].elevation', class: 'no-channel', absence: { kind: 'key-absent', key: 'elevation' }, note: 'The 2.5D vertical field the charter\'s Pillar 2 names first. Zero hits for `elevation` in the engine repo.' },
  { path: 'zones[].elevationRange.floor', class: 'no-channel', absence: { kind: 'key-absent', key: 'elevationRange' }, note: 'Multi-level vertical span: no channel.' },
  { path: 'zones[].elevationRange.ceiling', class: 'no-channel', absence: { kind: 'key-absent', key: 'elevationRange' }, note: 'Multi-level vertical span: no channel.' },
  { path: 'zones[].stratumId', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].stratumId', note: 'CLOSED BY leftover F-5dcb8b8a. Zone→stratum membership copies onto ExportedZone.stratumId.' },
  // ⚠ FLIPPED BY C3/P3. C0: "The TYPED hazard references. The legacy free-text
  // `hazards` list crosses instead, so a zone that authored only typed hazards
  // exports as hazard-free." Both cross now, and only the typed ones mean anything
  // without pack code — the contrast C0 measured across twelve worlds is preserved
  // on purpose.
  { path: 'zones[].hazardRefs[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].hazardRefs[]', note: 'CLOSED BY C3/P3. The zone→hazard binding the interpreter reads to know which typed hazards are active where. A ref matching no hazardDefinition is REPORTED at intake, not silently skipped.' },
  // ⚠ FLIPPED BY C3/P2. C0: "The v4.5 party-state entry gate. The Godot lane
  // consumes it; the engine lane has no field for it." It has one now, and the
  // engine EVALUATES it in traversal-core's move handler — a hard gate refuses
  // the move and emits the authored reason, a soft gate warns and permits.
  //
  // `conditions[]` is `carried-approximated` for the same reason the placement
  // and exit conditions are: the authored STRING compiles to a ConditionSpec.
  // `mode` and `reason` cross verbatim.
  { path: 'zones[].entryGate.conditions[]', class: 'carried-approximated', channel: 'contentPack', packPath: 'zones[].entryGate.conditions[].type', transform: 'compiled-through-parseSpawnCondition', note: 'CLOSED BY C3/P2. Each grammar string compiles to a ConditionSpec; the engine evaluates the AND-array at traversal time. An all-unparseable gate exports as NO GATE (an empty AND-array is vacuously TRUE and would silently unlock the zone).' },
  { path: 'zones[].entryGate.mode', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].entryGate.mode', note: 'CLOSED BY C3/P2. hard REFUSES the move (world.zone.gate.refused); soft warns and permits (world.zone.gate.warned). Both render in the terminal.' },
  { path: 'zones[].entryGate.reason', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].entryGate.reason', note: 'CLOSED BY C3/P2. The authored "show the lock" message, carried verbatim and rendered verbatim — charter Pillar 2: access stays rule-bound, and the client has to be TOLD why.' },
  { path: 'zones[].parallaxLayers[].id', class: 'no-channel', absence: { kind: 'key-absent', key: 'parallaxLayers' }, note: '2.5D parallax: no channel.' },
  { path: 'zones[].parallaxLayers[].depth', class: 'no-channel', absence: { kind: 'key-absent', key: 'parallaxLayers' }, note: '2.5D parallax: no channel.' },
  { path: 'zones[].parallaxLayers[].assetRef', class: 'no-channel', absence: { kind: 'key-absent', key: 'parallaxLayers' }, note: '2.5D parallax: no channel. (The referenced asset itself still appears in the `assets` manifest, which is why value-absence would not prove this.)' },
  { path: 'zones[].parallaxLayers[].scrollFactor', class: 'no-channel', absence: { kind: 'key-absent', key: 'parallaxLayers' }, note: '2.5D parallax: no channel.' },
  { path: 'zones[].skylineRef', class: 'no-channel', absence: { kind: 'key-absent', key: 'skylineRef' }, note: '2.5D vertical framing: no channel.' },
  { path: 'zones[].gravityOverride', class: 'no-channel', absence: { kind: 'key-absent', key: 'gravityOverride' }, note: 'Physics override: no channel.' },
  { path: 'zones[].gravityDirection', class: 'no-channel', absence: { kind: 'key-absent', key: 'gravityDirection' }, note: 'Physics override: no channel.' },
  { path: 'zones[].physicsMode', class: 'no-channel', absence: { kind: 'key-absent', key: 'physicsMode' }, note: 'normal / platformer / zero-g / aquatic: no channel.' },
  { path: 'zones[].skyAtmosphereRef', class: 'no-channel', absence: { kind: 'key-absent', key: 'skyAtmosphereRef' }, note: 'Sky preset: no channel. (Referential check is on the authoring side via validateProject.)' },
  { path: 'zones[].directionalLightYaw', class: 'no-channel', absence: { kind: 'key-absent', key: 'directionalLightYaw' }, note: 'Lighting hint: no channel.' },
  { path: 'zones[].directionalLightPitch', class: 'no-channel', absence: { kind: 'key-absent', key: 'directionalLightPitch' }, note: 'Lighting hint: no channel.' },
  { path: 'zones[].skyLightIntensity', class: 'no-channel', absence: { kind: 'key-absent', key: 'skyLightIntensity' }, note: 'Lighting hint: no channel.' },
  // ⚠ FLIPPED BY C3/P4, and this row closed TWO gaps with one field. C0's note —
  // "no channel — even though the SpawnCondition grammar has a `time:` operand the
  // engine could gate on" — named the second one without knowing it: C3/P2
  // measured `time-of-day` as an UNEVALUABLE gate operand precisely because
  // nothing tracked time of day. The scene descriptor gives `timeOfDay` its
  // channel, and that channel is the missing input the operand needed.
  { path: 'zones[].timeOfDay', class: 'carried-lossless', channel: 'contentPack', packPath: 'zones[].scene.timeOfDay', transform: 'moved-into-scene-descriptor', note: 'CLOSED BY C3/P4. Lands on the scene descriptor the client\'s diorama binds to — a STABLE KEY, not prose. Also supplies the input the `time-of-day` gate operand was measured missing.' },
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
  { path: 'districts[].economyProfile.supplyCategories[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].economyProfile.supplyCategories[]', note: 'CLOSED BY swarm wave-32 (F-229409a8). Copied onto the exported district; unrecognized strings warn and are omitted from DistrictEconomy.baseline but kept here for round-trip.' },
  { path: 'districts[].economyProfile.scarcityDefaults{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'districts[].economyProfile.scarcityDefaults{}', note: 'CLOSED BY swarm wave-32 (F-229409a8). Full authored map copies; recognized SupplyCategory keys also land on economyProfile.baseline for economy-core.' },

  // ── Landmarks (partially carried, via the binding map only) ─────────
  { path: 'landmarks[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'landmarks[].id', note: 'CLOSED BY leftover F-3c90bcc5. First-class ContentPack.landmarks channel.' },
  { path: 'landmarks[].iconId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'landmarks{}.iconId', note: 'iconId still lives in the asset binding map when present.' },
  { path: 'landmarks[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'landmarks[].name', note: 'CLOSED BY leftover F-3c90bcc5.' },
  { path: 'landmarks[].description', class: 'carried-lossless', channel: 'contentPack', packPath: 'landmarks[].description', note: 'CLOSED BY leftover F-3c90bcc5.' },
  { path: 'landmarks[].zoneId', class: 'carried-lossless', channel: 'contentPack', packPath: 'landmarks[].zoneId', note: 'CLOSED BY leftover F-3c90bcc5.' },
  { path: 'landmarks[].gridX', class: 'carried-lossless', channel: 'contentPack', packPath: 'landmarks[].gridX', note: 'CLOSED BY leftover F-3c90bcc5.' },
  { path: 'landmarks[].gridY', class: 'carried-lossless', channel: 'contentPack', packPath: 'landmarks[].gridY', note: 'CLOSED BY leftover F-3c90bcc5.' },
  { path: 'landmarks[].tags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'landmarks[].tags[]', note: 'CLOSED BY leftover F-3c90bcc5.' },
  { path: 'landmarks[].interactionType', class: 'carried-lossless', channel: 'contentPack', packPath: 'landmarks[].interactionType', note: 'CLOSED BY leftover F-3c90bcc5.' },

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

  // ── Encounter anchors — REAL VOCABULARY as of C3/P1 ─────────────────
  //
  // The CLASS of these rows does not change: they were already carried lossless,
  // as a raw pass-through. What changed is the thing the class could never
  // express — whether the engine does anything with them. C0 measured
  // `encounterAnchors` as an undeclared key with ZERO engine hits (REPORT §3.1);
  // it is now a declared `ContentPack` key routed by an intake channel that
  // REGISTERS into `encounter-spawn`'s existing content registry, so an anchor
  // produces real spawns with real rolls.
  //
  // Worth stating plainly, because it is the C1 lesson: the export table cannot
  // see this difference. A `carried-lossless` row said the same thing before and
  // after, while the field went from inert to rule-bearing. Carriage is measured
  // here; ALIVENESS is measured on the engine side, by a played session. Two
  // instruments, two claims.
  { path: 'encounterAnchors[].id', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].id', note: 'C3/P1: now a DECLARED key routed into encounter-spawn\'s registry (was an undeclared pass-through with zero engine hits).' },
  { path: 'encounterAnchors[].zoneId', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].zoneId', note: 'Keys the per-zone spawn table. (No longer "the ONLY entity-ish record whose zoneId survives" — placements[] carries one now.)' },
  { path: 'encounterAnchors[].encounterType', class: 'carried-approximated', channel: 'contentPack', packPath: 'encounterAnchors[].encounterType', transform: 'mapped-to-EncounterComposition-with-REFUSAL', note: 'C3/P1: mapped onto the engine\'s closed EncounterComposition set at intake. An unmapped value is REFUSED, not defaulted — deliberately unlike the four silent fallbacks C0 measured (slot, rarity, difficulty, genre).' },
  { path: 'encounterAnchors[].enemyIds[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].enemyIds[]', note: 'C3/P1: resolved against the booted world\'s entities to clone spawn participants; an unresolvable id is refused by name.' },
  { path: 'encounterAnchors[].probability', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].probability', note: 'C3/P1: a per-zone spawn chance the module had no expression for before — it substitutes for the pack-wide base chance, with district safety still modulating on top.' },
  { path: 'encounterAnchors[].cooldownTurns', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].cooldownTurns', note: 'C3/P1: the second new axis — a per-zone cooldown ledger beside the existing one-live-encounter-per-zone ledger, in the same persisted namespace.' },
  { path: 'encounterAnchors[].tags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'encounterAnchors[].tags[]', note: 'Carried; the first tag seeds the encounter\'s narrative tone at intake.' },

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
  // ⚠ FLIPPED BY C3/P1 (the pinned-test rule). C0 classified this `no-channel`
  // with the note "THE placement itself is dropped. `EntityBlueprint` has no
  // location field, so an exported pack cannot say where any NPC stands — the
  // single most consequential drop in the lane." That is now false: the pack
  // carries a `placements[]` channel and the engine's intake seam writes
  // `EntityState.zoneId` from it.
  //
  // The row moves to `carried-lossless` on a DIFFERENT packPath than the
  // blueprint, which is the substance of the fix rather than a detail — a
  // blueprint is a template, and the engine's spawn system clones templates
  // per instance, so a location on the template would be a lie for every clone.
  { path: 'entityPlacements[].zoneId', class: 'carried-lossless', channel: 'contentPack', packPath: 'placements[].zoneId', note: 'CLOSED BY C3/P1. Its own channel, not a blueprint field: one template, N placements. The engine routes it into EntityState.zoneId at intake.' },
  { path: 'entityPlacements[].gridX', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridX', scope: [{ channel: 'contentPack', packPath: 'placements[]' }] }, note: 'No entity coordinates cross on placements[]. Scoped because spawnPoints / itemPlacements / buildings now carry gridX.' },
  { path: 'entityPlacements[].gridY', class: 'no-channel', absence: { kind: 'key-absent', key: 'gridY', scope: [{ channel: 'contentPack', packPath: 'placements[]' }] }, note: 'No entity coordinates cross on placements[]. Scoped because spawnPoints / itemPlacements / buildings now carry gridY.' },
  // ⚠ FLIPPED BY C3/P1. C0's note read: "The SpawnCondition grammar's ORIGINAL
  // home field is dropped on export, while zone-exit conditions (a later
  // borrower of the same grammar) are carried garbled. The grammar has no intact
  // channel anywhere." C1 fixed the borrower; this fixes the original. The
  // grammar now has TWO intact channels and a proven codec in both directions.
  //
  // `carried-approximated`, not lossless, and deliberately so: the authored
  // STRING becomes a compiled ConditionSpec. That is the ink pattern working as
  // intended (a rich authoring grammar compiling to a closed engine-owned
  // format), and the class records the transform honestly rather than claiming
  // the value crossed unchanged.
  { path: 'entityPlacements[].spawnCondition', class: 'carried-approximated', channel: 'contentPack', packPath: 'placements[].spawnCondition.type', transform: 'compiled-through-parseSpawnCondition', note: 'CLOSED BY C3/P1. The grammar string COMPILES into a ConditionSpec ({type, params}) — the engine never parses author syntax. Decompiled back by formatConditionSpec on import; the round-trip is pinned over all thirteen operand families.' },
  { path: 'entityPlacements[].dialogueId', class: 'carried-lossless', channel: 'contentPack', packPath: 'placements[].dialogueId', note: 'CLOSED BY swarm wave-32 (F-c2cdc36d). Carried on ExportedPlacement (same channel as zoneId) and encoded as a dialogue:<id> tag on the blueprint.' },
  { path: 'entityPlacements[].ai.goals[]', class: 'no-channel', absence: { kind: 'value-absent', scope: [{ channel: 'contentPack', packPath: 'entities[]' }] }, note: 'Authored AI goals do not cross.' },
  { path: 'entityPlacements[].ai.fears[]', class: 'no-channel', absence: { kind: 'value-absent', scope: [{ channel: 'contentPack', packPath: 'entities[]' }] }, note: 'Authored AI fears do not cross. Scoped: an authored fear ("flooding") collides with an unrelated `pressureHotspots[].pressureType` value, which an unscoped proof reads as carriage.' },
  { path: 'entityPlacements[].portraitId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'entities{}.portraitId', note: 'Binding-map channel only; not in the ContentPack.' },
  { path: 'entityPlacements[].spriteId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'entities{}.spriteId', note: 'Binding-map channel only; not in the ContentPack.' },

  // ── Item placements ─────────────────────────────────────────────────
  { path: 'itemPlacements[].itemId', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].id', transform: 'renamed-key', note: '' },
  { path: 'itemPlacements[].name', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].name', note: 'Falls back to itemId when unset.' },
  { path: 'itemPlacements[].description', class: 'carried-approximated', channel: 'contentPack', packPath: 'items[].description', transform: 'synthesised-when-absent', note: 'When authored it crosses verbatim. When absent the exporter SYNTHESISES `Found in <container>` (or the literal `An item.`), so an unauthored description is indistinguishable from an authored one downstream.' },
  { path: 'itemPlacements[].container', class: 'carried-lossless', channel: 'contentPack', packPath: 'itemPlacements[].container', note: 'CLOSED BY swarm wave-32 (F-42772fc9). Placement channel. convertItems still folds container into a synthesised description when description is unset, and drops it from the catalog description when both are authored (F-06fd0fb3).' },
  // ⚠ FLIPPED BY swarm wave-2 (F-1c1a6e56, the pinned-test rule). C0 measured
  // this fallback as SILENT — no warnings param, no fidelity param on
  // convertItems at all, unlike every sibling converter. The VALUE still
  // narrows to 'trinket' (the engine's EquipmentSlot set genuinely has no
  // consumable-equivalent slot — confirmed against the published
  // @ai-rpg-engine/equipment type, not assumed), so the class stays
  // carried-approximated. What changed is the word "silently": the loss is
  // now reported through both `warnings` and `fidelity` (reason
  // 'item-slot-no-engine-target'), the same reporting discipline
  // convertEntities/convertPlacements/convertZones/convertPlayerTemplate
  // already had.
  { path: 'itemPlacements[].slot', class: 'carried-approximated', channel: 'contentPack', packPath: 'items[].slot', transform: 'narrowSlot-fallback-with-warning', note: 'CLOSED BY swarm wave-2 (F-1c1a6e56). The schema declares SIX slots; the engine\'s EquipmentSlot set has five, with no consumable-equivalent. `consumable` — a legal authored slot — narrows to `trinket`, now WITH a warning and a fidelity entry (reason `item-slot-no-engine-target`). The fixture authors a consumable to prove it.' },
  { path: 'itemPlacements[].rarity', class: 'carried-approximated', channel: 'contentPack', packPath: 'items[].rarity', transform: 'narrowRarity-fallback-with-warning', note: 'Same reporting fix as slot (F-1c1a6e56): an unrecognized rarity now warns and gets a fidelity entry. The four schema rarities happen to match the engine set today, so this fixture never exercises the fallback — nothing is lost YET, but the channel to report it now exists.' },
  { path: 'itemPlacements[].statModifiers{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].statModifiers{}', note: 'Omitted entirely when empty.' },
  { path: 'itemPlacements[].resourceModifiers{}', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].resourceModifiers{}', note: 'Omitted entirely when empty.' },
  { path: 'itemPlacements[].grantedTags[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].grantedTags[]', note: 'Omitted entirely when empty.' },
  { path: 'itemPlacements[].grantedVerbs[]', class: 'carried-lossless', channel: 'contentPack', packPath: 'items[].grantedVerbs[]', note: 'Omitted entirely when empty.' },
  { path: 'itemPlacements[].hidden', class: 'carried-lossless', channel: 'contentPack', packPath: 'itemPlacements[].hidden', note: 'CLOSED BY swarm wave-32 (F-42772fc9). The boolean now crosses on the placement channel. convertItems still ALSO re-encodes hidden:true as provenance flag contraband (F-06fd0fb3), reported separately.' },
  { path: 'itemPlacements[].iconId', class: 'carried-lossless', channel: 'assetBindings', packPath: 'items{}.iconId', note: 'Binding-map channel only; not in the ContentPack.' },
  { path: 'itemPlacements[].zoneId', class: 'carried-lossless', channel: 'contentPack', packPath: 'itemPlacements[].zoneId', note: 'CLOSED BY swarm wave-32 (F-42772fc9). Placement channel; ItemDefinition remains the catalog.' },
  { path: 'itemPlacements[].gridX', class: 'carried-lossless', channel: 'contentPack', packPath: 'itemPlacements[].gridX', note: 'CLOSED BY swarm wave-32 (F-42772fc9).' },
  { path: 'itemPlacements[].gridY', class: 'carried-lossless', channel: 'contentPack', packPath: 'itemPlacements[].gridY', note: 'CLOSED BY swarm wave-32 (F-42772fc9).' },
  // ⚠ NOTE UPDATED BY swarm wave-2 (F-ee46a52c) — the CLASS is unchanged
  // (still no-channel) but the OLD REASON is now false, AND the proof needed
  // a SCOPE it didn't need before. The loot tables themselves are no longer
  // dropped (see LOOT_TABLE_ROWS below); what has no channel is specifically
  // the REVERSE link — `ItemDefinition` has no field to say which loot table
  // can drop a given catalog item. The forward link
  // (`lootTables[].entries[].itemId`) does cross. Scoped to `items[]`
  // because the fixture's own loot table is now id `loot-vault-silt`, and an
  // UNSCOPED value-absent proof reads that id's appearance in
  // `contentPack.lootTables[].id` as if it were the item's back-reference
  // leaking — the same collision-shape `entityPlacements[].ai.fears[]` above
  // already documents for a different pair of fields.
  { path: 'itemPlacements[].lootTableId', class: 'carried-lossless', channel: 'contentPack', packPath: 'itemPlacements[].lootTableId', note: 'CLOSED BY swarm wave-32 (F-42772fc9). The reverse item→lootTableId link now lives on the placement channel. The forward table→itemId link already crossed via ContentPack.lootTables (F-ee46a52c).' },

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
