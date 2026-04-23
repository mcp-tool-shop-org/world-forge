// convert-pack.ts — WorldProject metadata → engine GameManifest + PackMetadata

import type { WorldProject } from '@world-forge/schema';
import type { GameManifest } from '@ai-rpg-engine/core';
import type { PackMetadata, PackGenre, PackDifficulty, PackTone, VALID_GENRES, VALID_TONES, VALID_DIFFICULTIES } from '@ai-rpg-engine/pack-registry';

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

// EB-011: DEFAULT_MODULES must stay in sync with @ai-rpg-engine/core module registry.
// When the engine adds or removes core modules, update this list to match.
// Current baseline: engine v2.0.0 standard module set.
/** @internal Exported for drift-guard tests only (AIR-A-005/006). */
export const DEFAULT_MODULES = [
  'combat-core',
  'movement-core',
  'npc-ai-core',
  'dialogue-core',
  'perception-filter',
  'district-core',
  'faction-core',
  'leverage-core',
  'rumor-core',
  'pressure-core',
  'companion-core',
  'equipment-core',
  'relationship-core',
  'economy-core',
  'opportunity-core',
  'crafting-core',
  'arc-core',
  'endgame-core',
];

/**
 * Convert project metadata → engine `GameManifest`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 */
export function convertManifest(project: WorldProject): GameManifest {
  return {
    id: project.id,
    title: project.name,
    version: project.version,
    engineVersion: '2.0.0',
    ruleset: 'standard-v1',
    modules: DEFAULT_MODULES,
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
  const genre = GENRE_MAP[project.genre] ?? 'fantasy';
  const invalidTones: string[] = [];
  const tones = project.tones
    .map((t) => {
      const mapped = TONE_MAP[t];
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
  const difficulty = DIFFICULTY_MAP[project.difficulty] ?? 'intermediate';

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
    engineVersion: '2.0.0',
    version: project.version,
    description: project.description,
    narratorTone: project.narratorTone,
  };
}
