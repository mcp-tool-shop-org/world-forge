// registry.ts — template registry and project factory

import type { WorldProject, AuthoringMode } from '@world-forge/schema';
import { DEFAULT_MODE } from '@world-forge/schema';
import { createEmptyProject } from '../store/project-store.js';
import { getModeProfile } from '../mode-profiles.js';
import { fantasyTemplate } from './genre-fantasy.js';
import { cyberpunkTemplate } from './genre-cyberpunk.js';
import { detectiveTemplate } from './genre-detective.js';
import { pirateTemplate } from './genre-pirate.js';
import { zombieTemplate } from './genre-zombie.js';
import { BUILTIN_KITS } from '../kits/index.js';
import { SAMPLE_WORLDS } from './samples.js';

export interface GenreTemplate {
  id: string;
  name: string;
  description: string;
  icon: string;
  genre: string;
  tones: string[];
  mode?: AuthoringMode;
  project: WorldProject;
}

export interface SampleWorld {
  id: string;
  name: string;
  description: string;
  complexity: 'minimal' | 'intermediate' | 'rich';
  mode?: AuthoringMode;
  project: WorldProject;
}

export interface ModeStarter {
  id: string;
  name: string;
  description: string;
  icon: string;
  mode: AuthoringMode;
  project: WorldProject;
}

export interface WizardOptions {
  name: string;
  genre: string; // 'blank' | genre template id
  mode: AuthoringMode;
  includePlayer: boolean;
  includeBuildCatalog: boolean;
  includeProgressionTree: boolean;
  includeDialogue: boolean;
  includeSampleNPCs: boolean;
}

export const GENRE_TEMPLATES: GenreTemplate[] = [
  { id: 'fantasy', name: 'Fantasy', description: 'Villages, dungeons, and ancient magic.', icon: '\u2694\uFE0F', genre: 'fantasy', tones: ['atmospheric', 'dark'], mode: 'district', project: fantasyTemplate },
  { id: 'cyberpunk', name: 'Cyberpunk', description: 'Neon streets, hackers, and corporate shadows.', icon: '\uD83D\uDD76\uFE0F', genre: 'cyberpunk', tones: ['gritty', 'neon'], mode: 'district', project: cyberpunkTemplate },
  { id: 'detective', name: 'Detective', description: 'Crime scenes, clues, and shadowy suspects.', icon: '\uD83D\uDD0D', genre: 'detective', tones: ['noir', 'suspenseful'], mode: 'district', project: detectiveTemplate },
  { id: 'pirate', name: 'Pirate', description: 'Ports, taverns, and hidden treasure.', icon: '\u2693', genre: 'pirate', tones: ['adventurous', 'seafaring'], mode: 'district', project: pirateTemplate },
  { id: 'zombie', name: 'Zombie', description: 'Barricades, scavenging, and survival.', icon: '\uD83E\uDDDF', genre: 'zombie', tones: ['tense', 'survival'], mode: 'district', project: zombieTemplate },
];

// MODE_STARTERS derived from BUILTIN_KITS for backward compatibility
export const MODE_STARTERS: ModeStarter[] = BUILTIN_KITS.map((kit) => ({
  id: kit.id,
  name: kit.name,
  description: kit.description,
  icon: kit.icon,
  mode: kit.modes[0],
  project: kit.project,
}));

export function createProjectFromModeStarter(name: string, starter: ModeStarter): WorldProject {
  const copy: WorldProject = JSON.parse(JSON.stringify(starter.project));
  copy.id = `project-${Date.now()}`;
  copy.name = name || starter.name;
  return copy;
}

export { SAMPLE_WORLDS };
export type { SampleWorld as SampleWorldType };

export function createProjectFromWizard(options: WizardOptions): WorldProject {
  const template = GENRE_TEMPLATES.find((t) => t.id === options.genre);
  const base: WorldProject = template
    ? JSON.parse(JSON.stringify(template.project))
    : createEmptyProject(options.mode);

  base.id = `project-${Date.now()}`;
  base.name = options.name || 'Untitled World';

  // Apply mode and mode-aware grid defaults
  const mode = options.mode ?? DEFAULT_MODE;
  base.mode = mode;
  const profile = getModeProfile(mode);
  base.map.gridWidth = profile.grid.width;
  base.map.gridHeight = profile.grid.height;
  base.map.tileSize = profile.grid.tileSize;

  if (template) {
    base.genre = template.genre;
    base.tones = [...template.tones];
  }

  // Strip unchecked systems
  if (!options.includePlayer) base.playerTemplate = undefined;
  if (!options.includeBuildCatalog) base.buildCatalog = undefined;
  if (!options.includeProgressionTree) base.progressionTrees = [];
  if (!options.includeDialogue) {
    base.dialogues = [];
    // Clear dialogue refs from entities
    for (const e of base.entityPlacements) e.dialogueId = undefined;
  }
  if (!options.includeSampleNPCs) {
    base.entityPlacements = [];
    base.itemPlacements = [];
  }

  return base;
}
