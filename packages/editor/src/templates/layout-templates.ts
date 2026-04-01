// layout-templates.ts — FT-020: Layout Templates for dungeon and district modes

import type { WorldProject, Zone, ZoneConnection, District } from '@world-forge/schema';
import { createEmptyProject } from '../store/project-store.js';

export interface LayoutTemplate {
  id: string;
  label: string;
  category: 'dungeon' | 'district';
  description: string;
  generate: () => Partial<WorldProject>;
}

// ── Helpers ──────────────────────────────────────────────────────

function zone(id: string, name: string, x: number, y: number, w: number, h: number, tags: string[] = [], districtId?: string): Zone {
  return {
    id, name, description: '', tags,
    gridX: x, gridY: y, gridWidth: w, gridHeight: h,
    neighbors: [], exits: [],
    light: 5, noise: 2, hazards: [], interactables: [],
    parentDistrictId: districtId,
  };
}

function conn(from: string, to: string, kind: ZoneConnection['kind'] = 'passage'): ZoneConnection {
  return { fromZoneId: from, toZoneId: to, bidirectional: true, kind };
}

function district(id: string, name: string, zoneIds: string[], tags: string[] = []): District {
  return {
    id, name, zoneIds, tags,
    baseMetrics: { commerce: 50, morale: 50, safety: 50, stability: 50 },
    economyProfile: { supplyCategories: [], scarcityDefaults: {} },
  };
}

// ── Dungeon Templates ────────────────────────────────────────────

function smallRoomSet(): Partial<WorldProject> {
  const base = createEmptyProject('dungeon');
  const d = 'sr-district';
  return {
    ...base,
    zones: [
      zone('sr-entry', 'Entry Chamber', 0, 4, 4, 4, ['entry', 'safe'], d),
      zone('sr-storage', 'Storage Room', 6, 0, 4, 3, ['storage'], d),
      zone('sr-guard', 'Guard Post', 6, 5, 4, 3, ['guard', 'danger'], d),
      zone('sr-shrine', 'Hidden Shrine', 12, 3, 5, 4, ['shrine', 'secret'], d),
    ],
    connections: [
      conn('sr-entry', 'sr-storage', 'door'),
      conn('sr-entry', 'sr-guard', 'passage'),
      conn('sr-guard', 'sr-shrine', 'secret'),
      conn('sr-storage', 'sr-shrine', 'door'),
    ],
    districts: [district(d, 'Small Room Set', ['sr-entry', 'sr-storage', 'sr-guard', 'sr-shrine'], ['dungeon'])],
    spawnPoints: [{ id: 'sr-spawn', zoneId: 'sr-entry', gridX: 1, gridY: 5, isDefault: true }],
  };
}

function corridorComplex(): Partial<WorldProject> {
  const base = createEmptyProject('dungeon');
  const d = 'cc-district';
  return {
    ...base,
    zones: [
      zone('cc-hall', 'Main Hall', 0, 4, 6, 3, ['hall'], d),
      zone('cc-north', 'North Corridor', 8, 0, 3, 6, ['corridor'], d),
      zone('cc-south', 'South Corridor', 8, 8, 3, 6, ['corridor'], d),
      zone('cc-east', 'East Chamber', 14, 3, 5, 5, ['chamber'], d),
      zone('cc-vault', 'Vault', 22, 4, 4, 3, ['vault', 'locked'], d),
    ],
    connections: [
      conn('cc-hall', 'cc-north', 'passage'),
      conn('cc-hall', 'cc-south', 'passage'),
      conn('cc-north', 'cc-east', 'door'),
      conn('cc-south', 'cc-east', 'door'),
      conn('cc-east', 'cc-vault', 'stairs'),
    ],
    districts: [district(d, 'Corridor Complex', ['cc-hall', 'cc-north', 'cc-south', 'cc-east', 'cc-vault'], ['dungeon', 'corridors'])],
    spawnPoints: [{ id: 'cc-spawn', zoneId: 'cc-hall', gridX: 2, gridY: 5, isDefault: true }],
  };
}

function bossArena(): Partial<WorldProject> {
  const base = createEmptyProject('dungeon');
  const d = 'ba-district';
  return {
    ...base,
    zones: [
      zone('ba-approach', 'Approach', 0, 6, 5, 3, ['corridor'], d),
      zone('ba-antechamber', 'Antechamber', 7, 5, 4, 5, ['chamber', 'safe'], d),
      zone('ba-arena', 'Boss Arena', 14, 3, 8, 8, ['arena', 'boss', 'danger'], d),
    ],
    connections: [
      conn('ba-approach', 'ba-antechamber', 'passage'),
      conn('ba-antechamber', 'ba-arena', 'door'),
    ],
    districts: [district(d, 'Boss Arena', ['ba-approach', 'ba-antechamber', 'ba-arena'], ['dungeon', 'boss'])],
    spawnPoints: [{ id: 'ba-spawn', zoneId: 'ba-approach', gridX: 1, gridY: 7, isDefault: true }],
  };
}

// ── District Templates ───────────────────────────────────────────

function cityBlock(): Partial<WorldProject> {
  const base = createEmptyProject('district');
  const d = 'cb-district';
  return {
    ...base,
    zones: [
      zone('cb-main-st', 'Main Street', 4, 8, 10, 3, ['street', 'public'], d),
      zone('cb-shop', 'Shop Row', 0, 2, 6, 4, ['commerce', 'shop'], d),
      zone('cb-housing', 'Housing Block', 8, 2, 6, 4, ['residential'], d),
      zone('cb-park', 'City Park', 16, 4, 5, 5, ['park', 'safe'], d),
    ],
    connections: [
      conn('cb-main-st', 'cb-shop', 'road'),
      conn('cb-main-st', 'cb-housing', 'road'),
      conn('cb-main-st', 'cb-park', 'road'),
      conn('cb-shop', 'cb-housing', 'road'),
    ],
    districts: [district(d, 'City Block', ['cb-main-st', 'cb-shop', 'cb-housing', 'cb-park'], ['urban'])],
    spawnPoints: [{ id: 'cb-spawn', zoneId: 'cb-main-st', gridX: 8, gridY: 9, isDefault: true }],
  };
}

function marketSquare(): Partial<WorldProject> {
  const base = createEmptyProject('district');
  const d = 'ms-district';
  return {
    ...base,
    zones: [
      zone('ms-plaza', 'Market Plaza', 6, 6, 8, 6, ['market', 'public'], d),
      zone('ms-stalls-n', 'North Stalls', 7, 0, 6, 4, ['stalls', 'commerce'], d),
      zone('ms-stalls-s', 'South Stalls', 7, 14, 6, 4, ['stalls', 'commerce'], d),
      zone('ms-warehouse', 'Warehouse', 18, 7, 5, 4, ['storage'], d),
      zone('ms-fountain', 'Fountain Court', 0, 7, 4, 4, ['landmark', 'safe'], d),
    ],
    connections: [
      conn('ms-plaza', 'ms-stalls-n', 'road'),
      conn('ms-plaza', 'ms-stalls-s', 'road'),
      conn('ms-plaza', 'ms-warehouse', 'road'),
      conn('ms-plaza', 'ms-fountain', 'road'),
    ],
    districts: [district(d, 'Market Square', ['ms-plaza', 'ms-stalls-n', 'ms-stalls-s', 'ms-warehouse', 'ms-fountain'], ['commerce', 'urban'])],
    spawnPoints: [{ id: 'ms-spawn', zoneId: 'ms-plaza', gridX: 9, gridY: 8, isDefault: true }],
  };
}

function harborFront(): Partial<WorldProject> {
  const base = createEmptyProject('district');
  const d = 'hf-district';
  return {
    ...base,
    zones: [
      zone('hf-docks', 'Docks', 0, 10, 12, 3, ['docks', 'water'], d),
      zone('hf-customs', 'Customs House', 2, 6, 5, 3, ['official'], d),
      zone('hf-tavern', 'Harborside Tavern', 9, 5, 5, 4, ['tavern', 'social'], d),
      zone('hf-warehouse', 'Dockside Warehouse', 16, 6, 6, 4, ['storage', 'commerce'], d),
    ],
    connections: [
      conn('hf-docks', 'hf-customs', 'road'),
      conn('hf-docks', 'hf-tavern', 'road'),
      conn('hf-docks', 'hf-warehouse', 'road'),
      conn('hf-customs', 'hf-tavern', 'road'),
    ],
    districts: [district(d, 'Harbor Front', ['hf-docks', 'hf-customs', 'hf-tavern', 'hf-warehouse'], ['harbor', 'urban'])],
    spawnPoints: [{ id: 'hf-spawn', zoneId: 'hf-docks', gridX: 5, gridY: 11, isDefault: true }],
  };
}

// ── Exported array ───────────────────────────────────────────────

export const LAYOUT_TEMPLATES: LayoutTemplate[] = [
  // Dungeon
  { id: 'dungeon-small-room-set', label: 'Small Room Set', category: 'dungeon', description: 'A compact set of 4 interconnected chambers.', generate: smallRoomSet },
  { id: 'dungeon-corridor-complex', label: 'Corridor Complex', category: 'dungeon', description: 'A hall with branching corridors leading to a vault.', generate: corridorComplex },
  { id: 'dungeon-boss-arena', label: 'Boss Arena', category: 'dungeon', description: 'An approach, antechamber, and large boss arena.', generate: bossArena },

  // District
  { id: 'district-city-block', label: 'City Block', category: 'district', description: 'A main street with shops, housing, and a park.', generate: cityBlock },
  { id: 'district-market-square', label: 'Market Square', category: 'district', description: 'A central plaza with stalls, warehouse, and fountain court.', generate: marketSquare },
  { id: 'district-harbor-front', label: 'Harbor Front', category: 'district', description: 'Docks, customs, tavern, and warehouse along the waterfront.', generate: harborFront },
];
