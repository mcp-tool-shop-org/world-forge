// @world-forge/schema — spatial data types for world authoring

export type {
  WorldMap, Zone, ZoneExit, Interactable,
  ZoneConnection, Landmark,
} from './spatial.js';

export type {
  District, DistrictMetrics, EconomyProfile,
  FactionPresence, PatrolRoute, PressureHotspot,
} from './districts.js';

export type {
  EntityRole, EntityStats, EntityResources, EntityAI,
  EntityPlacement, ItemSlot, ItemRarity, ItemPlacement,
  EncounterAnchor, SpawnPoint, CraftingStation, MarketNode,
} from './entities.js';

export type {
  Tileset, TileDefinition, TileLayer, TilePlacement,
  PropDefinition, PropPlacement, AmbientLayer,
} from './visual.js';

export type { WorldProject } from './project.js';

export type { ValidationError, ValidationResult } from './validate.js';
export { validateProject } from './validate.js';
