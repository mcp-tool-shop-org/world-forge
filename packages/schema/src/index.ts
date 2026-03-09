// @world-forge/schema — spatial data types for world authoring

export type {
  WorldMap, Zone, ZoneExit, Interactable,
  ZoneConnection, ConnectionKind, Landmark,
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
  ScalarValue, DialogueCondition, DialogueEffect,
  DialogueChoice, DialogueNode, DialogueDefinition,
} from './dialogue.js';

export type { PlayerTemplate } from './player-template.js';

export type {
  TraitEffectType, TraitEffect,
  ArchetypeDefinition, BackgroundDefinition,
  TraitDefinition, DisciplineDefinition,
  CrossDisciplineTitle, ClassEntanglement,
  BuildCatalogDefinition,
} from './build-catalog.js';

export type {
  ProgressionEffect, ProgressionNode, ProgressionTreeDefinition,
} from './progression-tree.js';

export type {
  Tileset, TileDefinition, TileLayer, TilePlacement,
  PropDefinition, PropPlacement, AmbientLayer,
} from './visual.js';

export type { AssetKind, AssetProvenance, AssetEntry, PackCompatibility, AssetPack } from './assets.js';

export type { WorldProject } from './project.js';

export type { ValidationError, ValidationResult } from './validate.js';
export { validateProject } from './validate.js';
