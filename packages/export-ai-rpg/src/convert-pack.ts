// convert-pack.ts — WorldProject metadata → engine GameManifest + PackMetadata

import type { WorldProject } from '@world-forge/schema';
import type { GameManifest } from '@ai-rpg-engine/core';
import type { PackMetadata, PackGenre, PackDifficulty, PackTone, VALID_GENRES, VALID_TONES, VALID_DIFFICULTIES } from '@ai-rpg-engine/pack-registry';

const GENRE_MAP: Record<string, PackGenre> = {
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

const TONE_MAP: Record<string, PackTone> = {
  dark: 'dark',
  gritty: 'gritty',
  heroic: 'heroic',
  noir: 'noir',
  comedic: 'comedic',
  eerie: 'eerie',
  tense: 'tense',
  atmospheric: 'atmospheric',
};

const DIFFICULTY_MAP: Record<string, PackDifficulty> = {
  beginner: 'beginner',
  easy: 'beginner',
  intermediate: 'intermediate',
  medium: 'intermediate',
  advanced: 'advanced',
  hard: 'advanced',
};

const DEFAULT_MODULES = [
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

export function convertPackMeta(project: WorldProject): PackMetadata {
  const genre = GENRE_MAP[project.genre] ?? 'fantasy';
  const tones = project.tones
    .map((t) => TONE_MAP[t])
    .filter((t): t is PackTone => t !== undefined);
  const difficulty = DIFFICULTY_MAP[project.difficulty] ?? 'intermediate';

  return {
    id: project.id,
    name: project.name,
    tagline: project.description.slice(0, 100),
    genres: [genre],
    difficulty,
    tones: tones.length > 0 ? tones : ['atmospheric'],
    tags: [],
    engineVersion: '2.0.0',
    version: project.version,
    description: project.description,
    narratorTone: project.narratorTone,
  };
}
