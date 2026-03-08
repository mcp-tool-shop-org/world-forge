// project.ts — WorldProject container type

import type { WorldMap, Zone, ZoneConnection, Landmark } from './spatial.js';
import type { District, FactionPresence, PressureHotspot } from './districts.js';
import type {
  EntityPlacement, ItemPlacement, EncounterAnchor,
  SpawnPoint, CraftingStation, MarketNode,
} from './entities.js';
import type { DialogueDefinition } from './dialogue.js';
import type {
  Tileset, TileLayer, PropDefinition, PropPlacement, AmbientLayer,
} from './visual.js';

/** Complete authored world — everything needed to export to ai-rpg-engine. */
export interface WorldProject {
  id: string;
  name: string;
  description: string;
  version: string;

  genre: string;
  tones: string[];
  difficulty: string;
  narratorTone: string;

  map: WorldMap;
  zones: Zone[];
  connections: ZoneConnection[];
  districts: District[];
  landmarks: Landmark[];

  factionPresences: FactionPresence[];
  pressureHotspots: PressureHotspot[];

  dialogues: DialogueDefinition[];

  entityPlacements: EntityPlacement[];
  itemPlacements: ItemPlacement[];
  encounterAnchors: EncounterAnchor[];
  spawnPoints: SpawnPoint[];
  craftingStations: CraftingStation[];
  marketNodes: MarketNode[];

  tilesets: Tileset[];
  tileLayers: TileLayer[];
  props: PropDefinition[];
  propPlacements: PropPlacement[];
  ambientLayers: AmbientLayer[];
}
