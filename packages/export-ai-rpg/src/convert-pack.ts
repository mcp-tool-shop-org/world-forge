// convert-pack.ts — WorldProject metadata → engine GameManifest + PackMetadata

import type { WorldProject } from '@world-forge/schema';
import type { GameManifest } from '@ai-rpg-engine/core';
import type { PackMetadata, PackGenre, PackDifficulty, PackTone, VALID_GENRES, VALID_TONES, VALID_DIFFICULTIES } from '@ai-rpg-engine/pack-registry';
import { safeLookup } from './safe-lookup.js';

/** @internal Exported for drift-guard tests only (AIR-A-005/006). */
export const GENRE_MAP: Record<string, PackGenre> = {
  fantasy: 'fantasy',
  'sci-fi': 'sci-fi',
  cyberpunk: 'cyberpunk',
  horror: 'horror',
  mystery: 'mystery',
  detective: 'mystery',
  western: 'western',
  pirate: 'pirate',
  zombie: 'post-apocalyptic',
  'post-apocalyptic': 'post-apocalyptic',
  historical: 'historical',
};

/** @internal Exported for drift-guard tests only (AIR-A-005/006). */
export const TONE_MAP: Record<string, PackTone> = {
  dark: 'dark',
  gritty: 'gritty',
  heroic: 'heroic',
  noir: 'noir',
  comedic: 'comedic',
  eerie: 'eerie',
  tense: 'tense',
  atmospheric: 'atmospheric',
};

/** @internal Exported for drift-guard tests only (AIR-A-005/006). */
export const DIFFICULTY_MAP: Record<string, PackDifficulty> = {
  beginner: 'beginner',
  easy: 'beginner',
  intermediate: 'intermediate',
  medium: 'intermediate',
  advanced: 'advanced',
  hard: 'advanced',
};

// EB-011 said "DEFAULT_MODULES must stay in sync with the engine module
// registry. When the engine adds or removes core modules, update this list to
// match." A comment asking a human to remember is not a synchronisation
// mechanism, and C0 measured what it cost: NINE of the eighteen ids below did
// not exist in the engine, and rode along in every manifest this exporter ever
// wrote, because manifest validation checked that `modules` was an array of
// strings and never resolved an id (ai-rpg-engine/docs/c0-alignment/REPORT.md §5).
//
// C1/P2 repairs the list and replaces the comment with a TEST
// (`c1-manifest-truth.test.ts`) that resolves every id against the engine.
//
// The repair, itemised:
//   - six phantoms DROPPED — faction-core, leverage-core, pressure-core,
//     relationship-core, arc-core, endgame-core. None exists under any name;
//     `pressure` in particular has no module id at all (pressure-system.ts
//     registers none).
//   - three NEAR-MISSES remapped to their real counterparts:
//       movement-core → traversal-core
//       npc-ai-core   → cognition-core
//       rumor-core    → rumor-propagation
//     These are why the old list read plausible: each named a real capability
//     under a name the engine does not use.
//   - nine were already correct and are unchanged.
/** @internal Exported for drift-guard tests only (AIR-A-005/006, C1-MANIFEST-1). */
export const DEFAULT_MODULES = [
  'combat-core',
  'traversal-core',
  'cognition-core',
  'dialogue-core',
  'perception-filter',
  'district-core',
  'rumor-propagation',
  'companion-core',
  'equipment-core',
  'economy-core',
  'opportunity-core',
  'crafting-core',
];

/**
 * Module ids this exporter used to emit that do not exist in the engine.
 *
 * Kept as data, not deleted, for two reasons: the drift test asserts none of
 * them is back in {@link DEFAULT_MODULES}, and an importer reading an old
 * manifest can recognise them and say something useful instead of failing
 * mysteriously.
 */
export const RETIRED_PHANTOM_MODULES: Readonly<Record<string, string | null>> = {
  'movement-core': 'traversal-core',
  'npc-ai-core': 'cognition-core',
  'rumor-core': 'rumor-propagation',
  'faction-core': null,
  'leverage-core': null,
  'pressure-core': null,
  'relationship-core': null,
  'arc-core': null,
  'endgame-core': null,
};

/**
 * The engine versions a pack this exporter writes is compatible with.
 *
 * A RANGE, not a point. C0 found `engineVersion: '2.0.0'` hardcoded here and
 * read by nothing, so eight minor releases of drift went unnoticed; Minecraft
 * learned the same lesson the same way and replaced its single dismissible
 * `pack_format` int with a supported range. The engine's load gate now enforces
 * this, so it is a checked claim rather than a comment.
 */
export const ENGINE_VERSION_RANGE = '>=3.8.0 <4.0.0';

/**
 * Convert project metadata → engine `GameManifest`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 *
 * **F-f216da1a (swarm wave-4):** `modules` used to be `DEFAULT_MODULES`
 * verbatim, unconditionally — so a project with ZERO authored crafting
 * stations still shipped a manifest claiming `'crafting-core'` was active,
 * while `ContentPack.craftingStations` carried nothing for that module to
 * act on. "Silently claiming a module that isn't there is the worse half of
 * that bug" (the finding's own words) — this closes it by gating the ONE
 * module id with a direct, checkable 1:1 content correspondence
 * (`craftingStations` ↔ `'crafting-core'`, per the C0 audit's own
 * DROPPED_CONTAINERS note: "the engine ships a `crafting-core` module").
 * The other ids in `DEFAULT_MODULES` (notably `'economy-core'`,
 * `'opportunity-core'`) have no such single-field correspondence — economy
 * systems plausibly matter even with zero placed market NODES specifically
 * (e.g. item pricing) — so they are deliberately left unconditional here;
 * narrowing them is out of this finding's scope.
 */
export function convertManifest(project: WorldProject): GameManifest {
  const modules = project.craftingStations.length > 0
    ? DEFAULT_MODULES
    : DEFAULT_MODULES.filter((m) => m !== 'crafting-core');
  return {
    id: project.id,
    title: project.name,
    version: project.version,
    engineVersion: ENGINE_VERSION_RANGE,
    ruleset: 'standard-v1',
    modules,
    contentPacks: [project.id],
  };
}

/**
 * Convert project metadata → engine `PackMetadata`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 *
 * **AIR-B-008:** Pass a `warnings` array to surface invalid-tone and
 * tone-fallback messages in the top-level {@link ExportResult.warnings} list
 * (the CLI prints those in its `Warnings:` block). Without it, warnings are
 * still written to `console.warn` but will be invisible to programmatic
 * consumers.
 */
export function convertPackMeta(project: WorldProject, warnings?: string[]): PackMetadata {
  // F-3dab95a4 (swarm wave-2): safeLookup only resolves OWN keys, so a
  // prototype-name value ('__proto__', 'constructor', 'toString', ...) misses
  // exactly like any other unrecognized string, instead of silently resolving
  // to an inherited Object.prototype member and defeating the `?? 'fantasy'`
  // fallback below. See safe-lookup.ts for the full reproduction.
  const genre = safeLookup(GENRE_MAP, project.genre) ?? 'fantasy';
  const invalidTones: string[] = [];
  const tones = project.tones
    .map((t) => {
      const mapped = safeLookup(TONE_MAP, t);
      if (!mapped) invalidTones.push(t);
      return mapped;
    })
    .filter((t): t is PackTone => t !== undefined);
  if (invalidTones.length > 0) {
    const msg = `Unrecognized tone values skipped: ${invalidTones.map((t) => `'${t}'`).join(', ')}. Valid tones: ${Object.keys(TONE_MAP).join(', ')}`;
    console.warn(`[convert-pack] ${msg}`);
    warnings?.push(msg);
  }
  if (tones.length === 0) {
    const msg = `No valid tones mapped from project tones [${project.tones.join(', ')}] — falling back to 'atmospheric'`;
    console.warn(`[convert-pack] ${msg}`);
    warnings?.push(msg);
  }
  const difficulty = safeLookup(DIFFICULTY_MAP, project.difficulty) ?? 'intermediate';

  const tags: string[] = [];
  if (project.mode) tags.push(`mode:${project.mode}`);

  return {
    id: project.id,
    name: project.name,
    tagline: project.description.slice(0, 100),
    genres: [genre],
    difficulty,
    tones: tones.length > 0 ? tones : ['atmospheric'],
    tags,
    // Same repair as the manifest's: the pack metadata carried the identical
    // stale literal, in a second place, read by nothing.
    engineVersion: ENGINE_VERSION_RANGE,
    version: project.version,
    description: project.description,
    narratorTone: project.narratorTone,
  };
}
