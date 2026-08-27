/**
 * field-coverage.ts — compile-time-locked classification of every WorldProject
 * field as either "covered" by the Godot export pipeline or "known dropped"
 * with a documented reason.
 *
 * Mirrors `@world-forge/export-unreal/src/field-coverage.ts` so a new schema
 * key fails `tsc --build` until it is classified covered or dropped with a
 * fidelity reason. `collectDroppedFieldFidelity` then emits a dropped-level
 * entry for every authored KNOWN_DROPPED field, so a landmark-only (or
 * progression-only) project cannot report losslessPercent 100 / incomplete
 * false while those domains silently vanish.
 */

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export type FieldStatus =
    | { readonly kind: 'covered' }
    | { readonly kind: 'dropped'; readonly reason: string };

/**
 * Canonical classification of every WorldProject field. Mapped type over
 * `keyof WorldProject` with `-?` so optional keys are required here too.
 */
const FIELD_COVERAGE: { readonly [K in keyof WorldProject]-?: FieldStatus } = {
    id: { kind: 'covered' },
    name: { kind: 'covered' },
    description: { kind: 'covered' },
    version: { kind: 'covered' },
    schemaVersion: { kind: 'dropped', reason: 'Authoring stamp — Godot pack carries GODOT_PACK_FORMAT_VERSION, not WorldProject.schemaVersion.' },

    genre: { kind: 'dropped', reason: 'Flavor metadata — not required for Godot runtime.' },
    tones: { kind: 'dropped', reason: 'Flavor metadata — not required for Godot runtime.' },
    difficulty: { kind: 'dropped', reason: 'Flavor metadata — not required for Godot runtime.' },
    narratorTone: { kind: 'dropped', reason: 'Flavor metadata — not required for Godot runtime.' },
    mode: { kind: 'dropped', reason: 'Authoring-mode flavor; the Godot pack does not branch on it.' },

    author: { kind: 'covered' },
    license: { kind: 'covered' },
    category: { kind: 'dropped', reason: 'Discovery metadata — not carried on GodotPackMeta.' },
    projectTags: { kind: 'dropped', reason: 'Discovery metadata — not carried on GodotPackMeta.' },

    map: { kind: 'covered' },
    zones: { kind: 'covered' },
    connections: { kind: 'covered' },
    districts: { kind: 'covered' },
    landmarks: { kind: 'dropped', reason: 'No Godot converter — landmarks are not emitted as nodes or resources.' },

    factionPresences: { kind: 'dropped', reason: 'Runtime faction state; not a first-class Godot pack field.' },
    pressureHotspots: { kind: 'dropped', reason: 'Runtime behavior; not part of the static Godot pack.' },

    dialogues: { kind: 'covered' },

    playerTemplate: { kind: 'covered' },
    buildCatalog: { kind: 'dropped', reason: 'Gameplay-only data; archetype/background/trait system is engine-specific.' },
    progressionTrees: { kind: 'dropped', reason: 'Gameplay-only data; drives character advancement outside world layout.' },

    entityPlacements: { kind: 'covered' },
    itemPlacements: { kind: 'covered' },
    encounterAnchors: { kind: 'dropped', reason: 'No Godot converter — encounters are not emitted as nodes or resources.' },
    spawnPoints: { kind: 'covered' },
    craftingStations: { kind: 'covered' },
    marketNodes: { kind: 'covered' },

    buildings: { kind: 'covered' },
    hubs: { kind: 'covered' },
    strongholds: { kind: 'covered' },
    strata: { kind: 'covered' },
    stratumLinks: { kind: 'covered' },
    hazardDefinitions: { kind: 'covered' },

    tilesets: { kind: 'covered' },
    tileLayers: { kind: 'covered' },
    props: { kind: 'covered' },
    propPlacements: { kind: 'covered' },
    ambientLayers: { kind: 'dropped', reason: 'Ambient effects are not emitted; Godot has no AmbientLayer converter.' },
    assets: { kind: 'covered' },
    assetPacks: { kind: 'dropped', reason: 'Pack registry is a Godot project concern, not this exporter.' },

    lootTables: { kind: 'covered' },
    transitions: { kind: 'covered' },
};

const _typeLock: { readonly [K in keyof WorldProject]-?: FieldStatus } = FIELD_COVERAGE;
void _typeLock;

const ALL_FIELD_KEYS = Object.keys(FIELD_COVERAGE) as ReadonlyArray<keyof WorldProject & string>;

/** Every WorldProject field name — DERIVED from FIELD_COVERAGE, never hand-maintained. */
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

/** Fields carried by the Godot pipeline (losslessly or with a documented approximation). */
export const COVERED_FIELDS: ReadonlySet<string> = _covered;

/** Fields intentionally not carried by the Godot pack, keyed to why. */
export const KNOWN_DROPPED: Readonly<Record<string, string>> = _dropped;

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
 */
export function collectDroppedFieldFidelity(project: WorldProject): FidelityEntry[] {
    const entries: FidelityEntry[] = [];
    const record = project as unknown as Record<string, unknown>;
    for (const field of ALL_FIELD_KEYS) {
        const reason = KNOWN_DROPPED[field];
        if (reason === undefined) continue;
        if (!isFieldAuthored(record[field])) continue;
        entries.push({
            level: 'dropped',
            domain: 'world',
            severity: 'warning',
            fieldPath: field,
            message: `WorldProject.${field} is authored but not carried into the Godot pack.`,
            reason,
        });
    }
    return entries;
}
