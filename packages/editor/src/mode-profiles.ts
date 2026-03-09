// mode-profiles.ts — per-mode defaults for grid, connections, guide text, etc.

import type { AuthoringMode, ConnectionKind } from '@world-forge/schema';
import { DEFAULT_MODE } from '@world-forge/schema';

/** Static configuration profile for an authoring mode. */
export interface ModeProfile {
  mode: AuthoringMode;
  label: string;
  icon: string;
  description: string;
  grid: { width: number; height: number; tileSize: number };
  /** Connection kinds ordered by relevance for this mode. */
  connectionKinds: ConnectionKind[];
  /** Suggested zone tags when creating zones. */
  suggestedZoneTags: string[];
  /** Override labels/descriptions for guide checklist steps. */
  guideOverrides: Partial<Record<string, { label: string; description: string }>>;
  /** Context-setting tip shown at the top of the guide checklist. */
  modeTip: string;
  /** Suggested encounter types for this mode (first = default). */
  encounterTypes: string[];
  /** Default entity role when placing entities on the canvas. */
  defaultEntityRole: string;
  /** Name pattern for new zones (e.g. "Chamber" → "Chamber 1"). */
  zoneNamePattern: string;
}

export const MODE_PROFILES: Record<AuthoringMode, ModeProfile> = {
  dungeon: {
    mode: 'dungeon',
    label: 'Dungeon',
    icon: '\uD83D\uDDDD\uFE0F',
    description: 'Rooms, corridors, and underground complexes.',
    grid: { width: 30, height: 25, tileSize: 32 },
    connectionKinds: ['door', 'stairs', 'passage', 'secret', 'hazard'],
    suggestedZoneTags: ['chamber', 'corridor', 'vault', 'shrine', 'lair'],
    guideOverrides: {
      district: { label: 'Create a dungeon level', description: 'Group rooms into a named dungeon section.' },
      zone: { label: 'Add a chamber', description: 'Use the Zone tool to create a room or corridor.' },
      spawn: { label: 'Place an entry point', description: 'Set where adventurers enter the dungeon.' },
      player: { label: 'Create an adventurer', description: 'Set up the player\'s starting stats and gear.' },
      npc: { label: 'Add a speaking creature', description: 'Add a creature or character the player can talk to.' },
    },
    modeTip: 'Design rooms and corridors, then connect them with doors and passages.',
    encounterTypes: ['patrol', 'ambush', 'boss', 'trap'],
    defaultEntityRole: 'enemy',
    zoneNamePattern: 'Chamber',
  },
  district: {
    mode: 'district',
    label: 'District / City',
    icon: '\uD83C\uDFD9\uFE0F',
    description: 'Urban wards, neighborhoods, and city blocks.',
    grid: { width: 50, height: 40, tileSize: 32 },
    connectionKinds: ['road', 'door', 'passage', 'portal'],
    suggestedZoneTags: ['market', 'slum', 'chapel', 'guild-ward', 'plaza'],
    guideOverrides: {
      district: { label: 'Create a ward', description: 'Group zones into a named city ward.' },
      zone: { label: 'Add a city block', description: 'Use the Zone tool to create a named area.' },
      spawn: { label: 'Place a starting location', description: 'Set where the player begins in the city.' },
      player: { label: 'Create a citizen', description: 'Set up the player\'s starting stats and gear.' },
      npc: { label: 'Add a speaking NPC', description: 'Add a merchant, guard, or citizen the player can talk to.' },
    },
    modeTip: 'Define city blocks and connect them with roads and alleys.',
    encounterTypes: ['patrol', 'pickpocket', 'brawl', 'riot'],
    defaultEntityRole: 'npc',
    zoneNamePattern: 'Block',
  },
  world: {
    mode: 'world',
    label: 'Region / World',
    icon: '\uD83C\uDF0D',
    description: 'Kingdoms, frontiers, and continental maps.',
    grid: { width: 80, height: 60, tileSize: 48 },
    connectionKinds: ['road', 'portal', 'passage'],
    suggestedZoneTags: ['kingdom', 'frontier', 'wasteland', 'sacred-region', 'forest'],
    guideOverrides: {
      district: { label: 'Create a region', description: 'Group zones into a named territory.' },
      zone: { label: 'Add a territory', description: 'Use the Zone tool to create a region or landmark area.' },
      spawn: { label: 'Place a starting territory', description: 'Set where the player enters the world.' },
      player: { label: 'Create a wanderer', description: 'Set up the player\'s starting stats and gear.' },
      npc: { label: 'Add a speaking NPC', description: 'Add a leader, scout, or diplomat the player can talk to.' },
    },
    modeTip: 'Map territories and connect them with roads and portals.',
    encounterTypes: ['patrol', 'siege', 'invasion', 'caravan-raid'],
    defaultEntityRole: 'npc',
    zoneNamePattern: 'Territory',
  },
  ocean: {
    mode: 'ocean',
    label: 'Ocean / Sea',
    icon: '\uD83C\uDF0A',
    description: 'Trade lanes, reefs, and open water.',
    grid: { width: 60, height: 50, tileSize: 48 },
    connectionKinds: ['channel', 'route', 'portal', 'hazard'],
    suggestedZoneTags: ['harbor', 'reef', 'deep-trench', 'trade-lane', 'pirate-water'],
    guideOverrides: {
      district: { label: 'Create a sea region', description: 'Group zones into a named body of water.' },
      zone: { label: 'Add a sea zone', description: 'Use the Zone tool to create a named stretch of ocean.' },
      spawn: { label: 'Place a port of origin', description: 'Set where players begin their voyage.' },
      player: { label: 'Create a captain', description: 'Set up the player\'s starting stats and gear.' },
      npc: { label: 'Add a speaking NPC', description: 'Add a harbor master, sailor, or merchant the player can talk to.' },
    },
    modeTip: 'Chart sea zones and connect them with channels and routes.',
    encounterTypes: ['pirate', 'kraken', 'storm', 'boarding'],
    defaultEntityRole: 'enemy',
    zoneNamePattern: 'Waters',
  },
  space: {
    mode: 'space',
    label: 'Space',
    icon: '\uD83D\uDE80',
    description: 'Orbits, stations, debris fields, and jump routes.',
    grid: { width: 100, height: 80, tileSize: 64 },
    connectionKinds: ['docking', 'warp', 'passage', 'portal'],
    suggestedZoneTags: ['orbit', 'station', 'debris-field', 'nebula', 'asteroid-belt'],
    guideOverrides: {
      district: { label: 'Create a sector', description: 'Group zones into a named star sector.' },
      zone: { label: 'Add a sector', description: 'Use the Zone tool to define a region of space.' },
      spawn: { label: 'Place an entry point', description: 'Set where players arrive in this sector.' },
      player: { label: 'Create a spacer', description: 'Set up the player\'s starting stats and gear.' },
      npc: { label: 'Add a speaking contact', description: 'Add a commander, engineer, or contact the player can talk to.' },
    },
    modeTip: 'Define sectors and connect them with docking ports and warp routes.',
    encounterTypes: ['pirate', 'asteroid', 'boarding', 'anomaly'],
    defaultEntityRole: 'npc',
    zoneNamePattern: 'Sector',
  },
  interior: {
    mode: 'interior',
    label: 'Interior',
    icon: '\uD83C\uDFE0',
    description: 'Rooms, floors, and indoor layouts.',
    grid: { width: 20, height: 15, tileSize: 24 },
    connectionKinds: ['door', 'stairs', 'passage', 'secret'],
    suggestedZoneTags: ['room', 'hallway', 'cellar', 'attic', 'balcony'],
    guideOverrides: {
      district: { label: 'Create a floor', description: 'Group rooms into a named floor or wing.' },
      zone: { label: 'Add a room', description: 'Use the Zone tool to create a room or hallway.' },
      spawn: { label: 'Place an entry point', description: 'Set where the player enters the building.' },
      player: { label: 'Create an investigator', description: 'Set up the player\'s starting stats and gear.' },
      npc: { label: 'Add a speaking NPC', description: 'Add a resident or caretaker the player can talk to.' },
    },
    modeTip: 'Layout rooms and connect them with doors and stairs.',
    encounterTypes: ['patrol', 'ambush', 'haunt', 'trap'],
    defaultEntityRole: 'npc',
    zoneNamePattern: 'Room',
  },
  wilderness: {
    mode: 'wilderness',
    label: 'Wilderness',
    icon: '\uD83C\uDF32',
    description: 'Trails, camps, and untamed terrain.',
    grid: { width: 60, height: 50, tileSize: 48 },
    connectionKinds: ['trail', 'road', 'passage', 'hazard'],
    suggestedZoneTags: ['camp', 'ravine', 'clearing', 'ridge', 'swamp'],
    guideOverrides: {
      district: { label: 'Create a biome', description: 'Group zones into a named wilderness area.' },
      zone: { label: 'Add terrain', description: 'Use the Zone tool to define a stretch of wilderness.' },
      spawn: { label: 'Place a camp spawn', description: 'Set where the player begins in the wilderness.' },
      player: { label: 'Create a survivalist', description: 'Set up the player\'s starting stats and gear.' },
      npc: { label: 'Add a speaking guide', description: 'Add a ranger, hermit, or guide the player can talk to.' },
    },
    modeTip: 'Map terrain and connect it with trails and passages.',
    encounterTypes: ['patrol', 'ambush', 'beast', 'hunt'],
    defaultEntityRole: 'enemy',
    zoneNamePattern: 'Area',
  },
};

/** Get the profile for a mode, defaulting to dungeon for undefined/legacy projects. */
export function getModeProfile(mode: AuthoringMode | undefined): ModeProfile {
  return MODE_PROFILES[mode ?? DEFAULT_MODE];
}

/** Get the default connection kind for a mode (first in the profile's connectionKinds list). */
export function getDefaultConnectionKind(mode: AuthoringMode | undefined): ConnectionKind {
  return getModeProfile(mode).connectionKinds[0];
}
