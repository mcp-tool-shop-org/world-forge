/**
 * field-coverage.ts — compile-time-locked classification of every WorldProject
 * field as either "covered" by the Unreal export pipeline or "known dropped"
 * with a documented reason.
 *
 * ## Why this file exists (F-e2908aac)
 *
 * This used to be a hand-maintained `string[]` living inside
 * `__tests__/parity.test.ts` — not derived from the real `WorldProject` type
 * in `packages/schema/src/project.ts`. It drifted: six v4.5 fields
 * (`buildings`, `hubs`, `strongholds`, `strata`, `stratumLinks`,
 * `hazardDefinitions`) were invisible to the parity test AND never produced a
 * fidelity entry on export, so a pack could report 100% lossless while those
 * fields silently vanished. `parity.test.ts` stayed green throughout — a
 * completeness gate whose own completeness was never checked against the type
 * it claims to track.
 *
 * `FIELD_COVERAGE` below is typed as `{ [K in keyof WorldProject]-?: FieldStatus }`
 * — a mapped type over EVERY key of `WorldProject`, with `-?` forcing optional
 * keys to be present too. Adding, removing, or renaming a `WorldProject` field
 * now fails `tsc --build` (part of `npm run verify`) right here, at this
 * object literal, until it is classified — not silently, and not only inside
 * a hand-maintained test array. This mirrors the existing
 * `VALID_CONNECTION_KINDS_LOOKUP` / `VALID_ASSET_KINDS_LOOKUP` pattern already
 * used in `packages/schema/src/validate.ts` (`Record<X, true>` derived via
 * `Object.keys()`, locked by a compile-time assignment).
 *
 * `ALL_WORLD_PROJECT_FIELDS`, `COVERED_FIELDS`, and `KNOWN_DROPPED` are all
 * DERIVED from `FIELD_COVERAGE` via `Object.keys()` — there is exactly one
 * place a human edits field classification, and both `parity.test.ts` (the
 * completeness check) and `export.ts` (the fidelity report, via
 * `collectDroppedFieldFidelity`) read from it.
 */

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export type FieldStatus =
  | { readonly kind: 'covered' }
  | { readonly kind: 'dropped'; readonly reason: string };

/**
 * The canonical classification of every WorldProject field. See the file
 * header for why this is a mapped type over `keyof WorldProject` rather than
 * a hand-maintained list.
 */
const FIELD_COVERAGE: { readonly [K in keyof WorldProject]-?: FieldStatus } = {
  id: { kind: 'covered' },
  name: { kind: 'covered' },
  description: { kind: 'covered' },
  version: { kind: 'covered' },

  genre: { kind: 'dropped', reason: 'Flavor metadata — not required for UE5 runtime.' },
  tones: { kind: 'dropped', reason: 'Flavor metadata — not required for UE5 runtime.' },
  difficulty: { kind: 'dropped', reason: 'Flavor metadata — not required for UE5 runtime.' },
  narratorTone: { kind: 'dropped', reason: 'Flavor metadata — not required for UE5 runtime.' },
  mode: { kind: 'covered' },

  author: { kind: 'covered' },
  license: { kind: 'covered' },
  category: { kind: 'covered' },
  projectTags: { kind: 'covered' },

  map: { kind: 'covered' },
  zones: { kind: 'covered' },
  connections: { kind: 'covered' },
  districts: { kind: 'covered' },
  landmarks: { kind: 'dropped', reason: 'Landmarks collapse into zone actor metadata — not a first-class pack field.' },

  factionPresences: { kind: 'dropped', reason: 'Runtime faction state; derived from district.controllingFaction at load.' },
  pressureHotspots: { kind: 'dropped', reason: 'Runtime behavior; not part of the static pack.' },

  dialogues: { kind: 'dropped', reason: 'Gameplay-only data; UE5 loader uses its own dialogue system.' },

  playerTemplate: { kind: 'dropped', reason: 'Gameplay-only data; driven by UE5 Blueprint defaults.' },
  buildCatalog: { kind: 'dropped', reason: 'Gameplay-only data; archetype/background/trait system is engine-specific.' },
  progressionTrees: { kind: 'dropped', reason: 'Gameplay-only data; drives character advancement outside world layout.' },

  entityPlacements: { kind: 'covered' },
  itemPlacements: { kind: 'dropped', reason: 'Item spawning handled by UE5 loot tables in this export profile.' },
  encounterAnchors: { kind: 'dropped', reason: 'Encounters covered by Blueprint spawners in this export profile.' },
  spawnPoints: { kind: 'dropped', reason: 'Player spawn handled separately by UE5 PlayerStart actors.' },
  craftingStations: { kind: 'dropped', reason: 'Gameplay-only data; driven by UE5 subsystem.' },
  marketNodes: { kind: 'dropped', reason: 'Gameplay-only data; driven by UE5 subsystem.' },

  // ── v4.5 world-modeling layer (F-5a78be0b) ──────────────────────────────
  // Confirmed by grep across packages/export-unreal/src: zero references to
  // any of these six fields anywhere in the converter pipeline. Godot has a
  // dedicated converter for each (convert-hazards.ts / convert-strata.ts /
  // convert-gates.ts / convert-structures.ts); Unreal does not yet. Honest
  // classification per F-e2908aac's fix order: no code path exists, so these
  // are KNOWN_DROPPED, not COVERED — and collectDroppedFieldFidelity() below
  // makes sure an export that actually authors this data reports it as
  // dropped rather than staying silent about it.
  buildings: { kind: 'dropped', reason: 'No Unreal converter yet — placed town structures are not emitted into the pack (v4.5 field; Godot has convert-structures.ts, Unreal does not).' },
  hubs: { kind: 'dropped', reason: 'No Unreal converter yet — connectivity hubs are not emitted into the pack (v4.5 field; Godot has convert-structures.ts, Unreal does not).' },
  strongholds: { kind: 'dropped', reason: 'No Unreal converter yet — faction strongholds are not emitted into the pack (v4.5 field; Godot has convert-structures.ts, Unreal does not).' },
  strata: { kind: 'dropped', reason: 'No Unreal converter yet — discrete vertical layers are not emitted into the pack (v4.5 field; Godot has convert-strata.ts, Unreal does not).' },
  stratumLinks: { kind: 'dropped', reason: 'No Unreal converter yet — stratum connectors are not emitted into the pack (v4.5 field; Godot has convert-strata.ts, Unreal does not).' },
  hazardDefinitions: { kind: 'dropped', reason: 'No Unreal converter yet — typed hazard definitions are not emitted; convert-zones.ts still only reads the legacy Zone.hazards string[] tags (v4.5 field; Godot has convert-hazards.ts, Unreal does not).' },

  tilesets: { kind: 'dropped', reason: 'Tiles are baked into zone assets on the UE5 side.' },
  tileLayers: { kind: 'dropped', reason: 'Tile layers are baked into zone assets on the UE5 side.' },
  props: { kind: 'dropped', reason: 'Props spawn via UE5 Blueprint catalogs, not from the pack.' },
  propPlacements: { kind: 'dropped', reason: 'Prop placements handled via UE5 Blueprint spawners.' },
  ambientLayers: { kind: 'dropped', reason: 'Ambient effects rebuilt from zone tags on the UE5 side.' },
  assets: { kind: 'dropped', reason: 'Asset manifest is the UE5 project responsibility, not this pack.' },
  assetPacks: { kind: 'dropped', reason: 'Pack registry is handled by UE5 project plugins, not this exporter.' },

  lootTables: { kind: 'dropped', reason: 'Drop tables are resolved server-side in the UE5 gameplay layer.' },
  transitions: { kind: 'covered' },
};

// Compile-time exhaustiveness lock. If WorldProject gains, loses, or renames
// a field, this assignment fails `tsc --build` right here — the object
// literal above either misses a required key (mapped type's `-?` makes every
// key required) or carries an excess one (object-literal excess-property
// checking). Kept as a real assignment (not just a type annotation on the
// const above) so the failure mode is unambiguous.
const _typeLock: { readonly [K in keyof WorldProject]-?: FieldStatus } = FIELD_COVERAGE;
void _typeLock;

const ALL_FIELD_KEYS = Object.keys(FIELD_COVERAGE) as ReadonlyArray<keyof WorldProject & string>;

/** Every WorldProject field name — DERIVED from FIELD_COVERAGE's real keys, never hand-maintained. */
export const ALL_WORLD_PROJECT_FIELDS: ReadonlyArray<string> = ALL_FIELD_KEYS;

const _covered = new Set<string>();
const _dropped: Record<string, string> = {};
for (const f of ALL_FIELD_KEYS) {
  const status = FIELD_COVERAGE[f];
  if (status.kind === 'covered') {
    _covered.add(f);
  } else {
    _dropped[f] = status.reason;
  }
}

/** Fields carried by the Unreal pipeline (losslessly or with a documented approximation). */
export const COVERED_FIELDS: ReadonlySet<string> = _covered;

/** Fields intentionally not carried by the Unreal pack, keyed to why. */
export const KNOWN_DROPPED: Readonly<Record<string, string>> = _dropped;

/**
 * Returns true when `value` represents authored content worth reporting as
 * lost — a non-empty array, a non-blank string, or a non-empty object.
 * `undefined`/`null`/`[]`/`''`/`{}` are treated as "never authored," so a
 * project that never touched a KNOWN_DROPPED field doesn't get a spurious
 * fidelity entry for content that never existed.
 */
function isFieldAuthored(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (Array.isArray(value)) return value.length > 0;
  if (typeof value === 'string') return value.trim().length > 0;
  if (typeof value === 'object') return Object.keys(value as Record<string, unknown>).length > 0;
  return true;
}

/**
 * Emits a `dropped` fidelity entry for every KNOWN_DROPPED field the source
 * project actually authored content in.
 *
 * Before this function existed, NONE of the (now 30) KNOWN_DROPPED fields
 * ever produced a fidelity entry on export — they simply had no code path
 * that touched `fidelityEntries` at all. That let `FidelitySummary.losslessPercent`
 * report 100% on a project with dozens of authored dialogue nodes, faction
 * presences, typed hazards, etc., none of which survived the export. This is
 * the fix for F-e2908aac step 3 ("make the fidelity report incapable of
 * claiming lossless while fields are unmapped").
 */
export function collectDroppedFieldFidelity(project: WorldProject): FidelityEntry[] {
  const entries: FidelityEntry[] = [];
  const record = project as unknown as Record<string, unknown>;
  for (const field of ALL_FIELD_KEYS) {
    const reason = KNOWN_DROPPED[field];
    if (reason === undefined) continue; // covered field — nothing to report here
    if (!isFieldAuthored(record[field])) continue; // nothing authored — nothing lost
    entries.push({
      level: 'dropped',
      domain: 'world',
      severity: 'warning',
      fieldPath: field,
      message: `WorldProject.${field} is authored but not carried into the Unreal pack.`,
      reason,
    });
  }
  return entries;
}
