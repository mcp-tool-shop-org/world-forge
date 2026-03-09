// built-ins.ts — 7 built-in starter kits (one per authoring mode)

import type { StarterKit } from './types.js';
import { dungeonStarter } from '../templates/mode-dungeon.js';
import { districtStarter } from '../templates/mode-district.js';
import { worldStarter } from '../templates/mode-world.js';
import { oceanStarter } from '../templates/mode-ocean.js';
import { spaceStarter } from '../templates/mode-space.js';
import { interiorStarter } from '../templates/mode-interior.js';
import { wildernessStarter } from '../templates/mode-wilderness.js';

export const BUILTIN_KITS: StarterKit[] = [
  {
    id: 'dungeon-starter',
    name: 'Forgotten Vault',
    description: 'Sealed vault with traps and secret passages.',
    icon: '\uD83D\uDDDD\uFE0F',
    modes: ['dungeon'],
    tags: ['dungeon', 'fantasy', 'underground'],
    builtIn: true,
    project: dungeonStarter,
    presetRefs: {
      region: ['crypt-district', 'dungeon-vault'],
      encounter: ['dungeon-ambush', 'boss-encounter'],
    },
    guideHints: {},
  },
  {
    id: 'district-starter',
    name: 'Market Quarter',
    description: 'Bustling city ward with trade and factional tension.',
    icon: '\uD83C\uDFD9\uFE0F',
    modes: ['district'],
    tags: ['urban', 'trade', 'social'],
    builtIn: true,
    project: districtStarter,
    presetRefs: {
      region: ['market-ward', 'city-slum'],
      encounter: ['district-brawl', 'hazard-encounter'],
    },
    guideHints: {},
  },
  {
    id: 'world-starter',
    name: 'Contested Frontier',
    description: 'Border territory between rival kingdoms.',
    icon: '\uD83C\uDF0D',
    modes: ['world'],
    tags: ['overland', 'military', 'frontier'],
    builtIn: true,
    project: worldStarter,
    presetRefs: {
      region: ['market-ward', 'city-slum'],
      encounter: ['world-caravan-raid', 'discovery-encounter'],
    },
    guideHints: {},
  },
  {
    id: 'ocean-starter',
    name: 'Corsair Strait',
    description: 'Trade lane between harbor and pirate waters.',
    icon: '\uD83C\uDF0A',
    modes: ['ocean'],
    tags: ['maritime', 'pirate', 'trade'],
    builtIn: true,
    project: oceanStarter,
    presetRefs: {
      region: ['ocean-port', 'smuggler-dock'],
      encounter: ['ocean-pirate-attack', 'hazard-encounter'],
    },
    guideHints: {},
  },
  {
    id: 'space-starter',
    name: 'Relay Station',
    description: 'Orbital station at the edge of charted space.',
    icon: '\uD83D\uDE80',
    modes: ['space'],
    tags: ['station', 'sci-fi', 'corporate'],
    builtIn: true,
    project: spaceStarter,
    presetRefs: {
      region: ['space-station-hub'],
      encounter: ['space-boarding-action', 'boss-encounter'],
    },
    guideHints: {},
  },
  {
    id: 'interior-starter',
    name: 'Clockwork Manor',
    description: 'Multi-floor manor hiding mechanical secrets.',
    icon: '\uD83C\uDFE0',
    modes: ['interior'],
    tags: ['indoor', 'mystery', 'mechanical'],
    builtIn: true,
    project: interiorStarter,
    presetRefs: {
      region: ['crypt-district', 'dungeon-vault'],
      encounter: ['interior-haunt', 'hazard-encounter'],
    },
    guideHints: {},
  },
  {
    id: 'wilderness-starter',
    name: 'Wolf Ridge',
    description: 'Mountain trail through camp, cave, and ridge.',
    icon: '\uD83C\uDF32',
    modes: ['wilderness'],
    tags: ['wild', 'survival', 'mountainous'],
    builtIn: true,
    project: wildernessStarter,
    presetRefs: {
      region: ['wilderness-camp'],
      encounter: ['wilderness-beast-hunt', 'discovery-encounter'],
    },
    guideHints: {},
  },
];
