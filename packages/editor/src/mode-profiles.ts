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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
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
    },
  },
};

/** Get the profile for a mode, defaulting to dungeon for undefined/legacy projects. */
export function getModeProfile(mode: AuthoringMode | undefined): ModeProfile {
  return MODE_PROFILES[mode ?? DEFAULT_MODE];
}
