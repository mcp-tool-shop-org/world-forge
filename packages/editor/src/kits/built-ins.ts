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
    guideHints: {
      zone: { label: 'Add a vault chamber', description: 'Create rooms, corridors, and trap chambers.' },
      spawn: { label: 'Set the vault entrance', description: 'Where the party enters the dungeon.' },
      district: { label: 'Define a dungeon level', description: 'Group chambers into dungeon levels.' },
      player: { label: 'Create the delver', description: 'Build the character entering the vault.' },
      npc: { label: 'Place a guard or creature', description: 'Add enemies and NPCs to chambers.' },
    },
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
    guideHints: {
      zone: { label: 'Add a market stall', description: 'Create shops, alleys, and gathering spots.' },
      spawn: { label: 'Set the entry gate', description: 'Where visitors arrive in the ward.' },
      district: { label: 'Define a ward', description: 'Group zones into city wards.' },
      player: { label: 'Create the citizen', description: 'Build the character exploring the quarter.' },
      npc: { label: 'Place a merchant', description: 'Add shopkeepers, guards, and residents.' },
    },
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
    guideHints: {
      zone: { label: 'Map a territory', description: 'Create regions, settlements, and landmarks.' },
      spawn: { label: 'Set the expedition start', description: 'Where the party begins their journey.' },
      district: { label: 'Define a region', description: 'Group territories into larger regions.' },
      player: { label: 'Create the explorer', description: 'Build the character charting the frontier.' },
      npc: { label: 'Place a guide', description: 'Add scouts, traders, and frontier folk.' },
    },
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
    guideHints: {
      zone: { label: 'Chart new waters', description: 'Create sea zones, harbors, and open water.' },
      spawn: { label: 'Set the embarkation point', description: 'Where ships depart from port.' },
      district: { label: 'Define a port', description: 'Group docks, warehouses, and markets.' },
      player: { label: 'Create the navigator', description: 'Build the character sailing the strait.' },
      npc: { label: 'Place a harbormaster', description: 'Add captains, traders, and pirates.' },
    },
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
    guideHints: {
      zone: { label: 'Map a sector', description: 'Create station bays, corridors, and cargo holds.' },
      spawn: { label: 'Set the docking bay', description: 'Where ships dock at the station.' },
      district: { label: 'Define a station wing', description: 'Group sectors into station wings.' },
      player: { label: 'Create the pilot', description: 'Build the character operating the relay.' },
      npc: { label: 'Place a dispatcher', description: 'Add crew, operators, and visitors.' },
    },
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
    guideHints: {
      zone: { label: 'Add a room', description: 'Create rooms, hallways, and hidden spaces.' },
      spawn: { label: 'Set the entrance', description: 'Where the occupant enters the manor.' },
      district: { label: 'Define a floor', description: 'Group rooms into floors or wings.' },
      player: { label: 'Create the occupant', description: 'Build the character exploring the manor.' },
      npc: { label: 'Place a resident', description: 'Add servants, automatons, and visitors.' },
    },
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
    guideHints: {
      zone: { label: 'Scout a clearing', description: 'Create trails, camps, and natural sites.' },
      spawn: { label: 'Set the trailhead', description: 'Where the ranger begins the hike.' },
      district: { label: 'Define a territory', description: 'Group clearings into wilderness areas.' },
      player: { label: 'Create the ranger', description: 'Build the character traversing the ridge.' },
      npc: { label: 'Place a forester', description: 'Add wildlife, hermits, and trackers.' },
    },
  },
];
