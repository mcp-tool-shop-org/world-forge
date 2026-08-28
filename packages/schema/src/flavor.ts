// flavor.ts — optional closed vocabularies for genre / tone / difficulty.
// F-1fbf61d2: these used to live only in export-ai-rpg convert-pack.ts.

/** Engine-legal pack genres (identity set). Editor aliases overlay this. */
export const VALID_GENRES = [
  'fantasy', 'sci-fi', 'cyberpunk', 'horror', 'mystery',
  'western', 'pirate', 'post-apocalyptic', 'historical', 'mercantile', 'pursuit',
] as const;

export type FlavorGenre = typeof VALID_GENRES[number];

export const VALID_TONES = [
  'dark', 'gritty', 'heroic', 'noir', 'comedic', 'eerie', 'tense', 'atmospheric',
] as const;

export type FlavorTone = typeof VALID_TONES[number];

export const VALID_DIFFICULTIES = ['beginner', 'intermediate', 'advanced'] as const;

export type FlavorDifficulty = typeof VALID_DIFFICULTIES[number];

/** Editor aliases that are not engine identity members. */
export const GENRE_ALIASES: Record<string, FlavorGenre> = {
  detective: 'mystery',
  zombie: 'post-apocalyptic',
};

export const DIFFICULTY_ALIASES: Record<string, FlavorDifficulty> = {
  easy: 'beginner',
  medium: 'intermediate',
  hard: 'advanced',
};

export function isValidGenre(value: string): boolean {
  return (VALID_GENRES as readonly string[]).includes(value) || value in GENRE_ALIASES;
}

export function isValidTone(value: string): boolean {
  return (VALID_TONES as readonly string[]).includes(value);
}

export function isValidDifficulty(value: string): boolean {
  return (VALID_DIFFICULTIES as readonly string[]).includes(value) || value in DIFFICULTY_ALIASES;
}
