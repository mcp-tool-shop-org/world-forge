// project.ts — WorldProject container type

import type { WorldMap, Zone, ZoneConnection, Landmark, TransitionEntity } from './spatial.js';
import type { District, FactionPresence, PressureHotspot } from './districts.js';
import type {
  EntityPlacement, ItemPlacement, EncounterAnchor,
  SpawnPoint, CraftingStation, MarketNode, LootTable,
} from './entities.js';
import type { Building, Hub, Stronghold } from './town.js';
import type { Stratum, StratumLink } from './stratum.js';
import type { DialogueDefinition } from './dialogue.js';
import type { PlayerTemplate } from './player-template.js';
import type { BuildCatalogDefinition } from './build-catalog.js';
import type { ProgressionTreeDefinition } from './progression-tree.js';
import type {
  Tileset, TileLayer, PropDefinition, PropPlacement, AmbientLayer,
} from './visual.js';
import type { AssetEntry, AssetPack } from './assets.js';
import type { AuthoringMode } from './authoring-mode.js';

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
  /** Scale/scope of the world (dungeon, ocean, space, etc.). Optional for backward compat. */
  mode?: AuthoringMode;

  /** Who created this project. */
  author?: string;
  /** License governing the project content (e.g. 'CC-BY-4.0', 'MIT', 'custom'). */
  license?: string;
  /** High-level category for the project (e.g. 'fantasy', 'sci-fi', 'horror'). */
  category?: string;
  /** Freeform tags for discovery and filtering. */
  projectTags?: string[];

  map: WorldMap;
  zones: Zone[];
  connections: ZoneConnection[];
  districts: District[];
  landmarks: Landmark[];

  factionPresences: FactionPresence[];
  pressureHotspots: PressureHotspot[];

  dialogues: DialogueDefinition[];

  playerTemplate?: PlayerTemplate;
  buildCatalog?: BuildCatalogDefinition;
  progressionTrees: ProgressionTreeDefinition[];

  entityPlacements: EntityPlacement[];
  itemPlacements: ItemPlacement[];
  encounterAnchors: EncounterAnchor[];
  spawnPoints: SpawnPoint[];
  craftingStations: CraftingStation[];
  marketNodes: MarketNode[];

  /**
   * Placed town structures — enterable buildings, service/connectivity hubs,
   * and fortified faction strongholds. Additive since v4.5 — existing projects
   * without these fields validate normally (they default to undefined / []).
   */
  buildings?: Building[];
  hubs?: Hub[];
  strongholds?: Stronghold[];

  /**
   * World-modeling layer — discrete vertical strata and the connectors between
   * them. Additive since v4.5 — existing projects without these fields validate
   * normally. See docs/world-modeling-design.md.
   */
  strata?: Stratum[];
  stratumLinks?: StratumLink[];

  tilesets: Tileset[];
  tileLayers: TileLayer[];
  props: PropDefinition[];
  propPlacements: PropPlacement[];
  ambientLayers: AmbientLayer[];
  assets: AssetEntry[];
  assetPacks: AssetPack[];

  /**
   * Weighted loot pools for containers, kills, and chests. Additive since v4.3 —
   * existing projects without this field validate normally.
   */
  lootTables?: LootTable[];
  /**
   * Placed elevator / warp / transporter / cargo-lift / stairwell transitions.
   * Additive since v4.3 — existing projects without this field validate normally.
   */
  transitions?: TransitionEntity[];
}
