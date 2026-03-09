// diff-model.ts — semantic project diff engine

import type { WorldProject, Zone, District, EntityPlacement, ItemPlacement, DialogueDefinition, ProgressionTreeDefinition, BuildCatalogDefinition, PlayerTemplate, AssetEntry, AssetPack } from '@world-forge/schema';
import type { FidelityDomain } from '@world-forge/export-ai-rpg';

export type ChangeStatus = 'unchanged' | 'modified' | 'added' | 'removed';

export interface FieldDiff {
  field: string;
  before: unknown;
  after: unknown;
}

export interface ObjectDiff {
  id: string;
  name?: string;
  domain: FidelityDomain;
  status: ChangeStatus;
  fieldDiffs: FieldDiff[];
}

export interface DomainDiff {
  domain: FidelityDomain;
  unchanged: number;
  modified: number;
  added: number;
  removed: number;
  objects: ObjectDiff[];
}

export interface ProjectDiff {
  domains: DomainDiff[];
  totalUnchanged: number;
  totalModified: number;
  totalAdded: number;
  totalRemoved: number;
}

function deepEqual(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function fieldDiff(field: string, a: unknown, b: unknown): FieldDiff | null {
  if (deepEqual(a, b)) return null;
  return { field, before: a, after: b };
}

function diffDomain<T>(
  domain: FidelityDomain,
  beforeArr: T[],
  afterArr: T[],
  keyFn: (item: T) => string,
  nameFn: (item: T) => string | undefined,
  compareFn: (a: T, b: T) => FieldDiff[],
): DomainDiff {
  const beforeMap = new Map(beforeArr.map((item) => [keyFn(item), item]));
  const afterMap = new Map(afterArr.map((item) => [keyFn(item), item]));
  const allKeys = new Set([...beforeMap.keys(), ...afterMap.keys()]);

  const objects: ObjectDiff[] = [];
  let unchanged = 0, modified = 0, added = 0, removed = 0;

  for (const key of allKeys) {
    const before = beforeMap.get(key);
    const after = afterMap.get(key);

    if (before && after) {
      const diffs = compareFn(before, after);
      if (diffs.length === 0) {
        unchanged++;
        objects.push({ id: key, name: nameFn(after), domain, status: 'unchanged', fieldDiffs: [] });
      } else {
        modified++;
        objects.push({ id: key, name: nameFn(after), domain, status: 'modified', fieldDiffs: diffs });
      }
    } else if (after) {
      added++;
      objects.push({ id: key, name: nameFn(after), domain, status: 'added', fieldDiffs: [] });
    } else {
      removed++;
      objects.push({ id: key, name: nameFn(before!), domain, status: 'removed', fieldDiffs: [] });
    }
  }

  return { domain, unchanged, modified, added, removed, objects };
}

// --- Domain comparators ---

function diffZone(a: Zone, b: Zone): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const f of ['name', 'description', 'gridX', 'gridY', 'gridWidth', 'gridHeight', 'light', 'noise', 'parentDistrictId', 'backgroundId', 'tilesetId'] as const) {
    const d = fieldDiff(f, a[f], b[f]);
    if (d) diffs.push(d);
  }
  if (!deepEqual(a.tags, b.tags)) diffs.push({ field: 'tags', before: a.tags, after: b.tags });
  if (!deepEqual(a.neighbors, b.neighbors)) diffs.push({ field: 'neighbors', before: a.neighbors, after: b.neighbors });
  if (!deepEqual(a.hazards, b.hazards)) diffs.push({ field: 'hazards', before: a.hazards, after: b.hazards });
  if (!deepEqual(a.interactables, b.interactables)) diffs.push({ field: 'interactables', before: a.interactables, after: b.interactables });
  if (!deepEqual(a.exits, b.exits)) diffs.push({ field: 'exits', before: a.exits, after: b.exits });
  return diffs;
}

function diffDistrict(a: District, b: District): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const d1 = fieldDiff('name', a.name, b.name); if (d1) diffs.push(d1);
  if (!deepEqual(a.zoneIds, b.zoneIds)) diffs.push({ field: 'zoneIds', before: a.zoneIds, after: b.zoneIds });
  if (!deepEqual(a.baseMetrics, b.baseMetrics)) diffs.push({ field: 'baseMetrics', before: a.baseMetrics, after: b.baseMetrics });
  if (!deepEqual(a.economyProfile, b.economyProfile)) diffs.push({ field: 'economyProfile', before: a.economyProfile, after: b.economyProfile });
  return diffs;
}

function diffEntity(a: EntityPlacement, b: EntityPlacement): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const f of ['name', 'zoneId', 'role', 'factionId', 'dialogueId', 'portraitId', 'spriteId'] as const) {
    const d = fieldDiff(f, a[f], b[f]);
    if (d) diffs.push(d);
  }
  if (!deepEqual(a.stats, b.stats)) diffs.push({ field: 'stats', before: a.stats, after: b.stats });
  if (!deepEqual(a.resources, b.resources)) diffs.push({ field: 'resources', before: a.resources, after: b.resources });
  if (!deepEqual(a.tags, b.tags)) diffs.push({ field: 'tags', before: a.tags, after: b.tags });
  if (!deepEqual(a.ai, b.ai)) diffs.push({ field: 'ai', before: a.ai, after: b.ai });
  if (!deepEqual(a.custom, b.custom)) diffs.push({ field: 'custom', before: a.custom, after: b.custom });
  return diffs;
}

function diffItem(a: ItemPlacement, b: ItemPlacement): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const f of ['name', 'description', 'zoneId', 'hidden', 'slot', 'rarity', 'iconId'] as const) {
    const d = fieldDiff(f, a[f], b[f]);
    if (d) diffs.push(d);
  }
  if (!deepEqual(a.statModifiers, b.statModifiers)) diffs.push({ field: 'statModifiers', before: a.statModifiers, after: b.statModifiers });
  if (!deepEqual(a.resourceModifiers, b.resourceModifiers)) diffs.push({ field: 'resourceModifiers', before: a.resourceModifiers, after: b.resourceModifiers });
  if (!deepEqual(a.grantedTags, b.grantedTags)) diffs.push({ field: 'grantedTags', before: a.grantedTags, after: b.grantedTags });
  if (!deepEqual(a.grantedVerbs, b.grantedVerbs)) diffs.push({ field: 'grantedVerbs', before: a.grantedVerbs, after: b.grantedVerbs });
  return diffs;
}

function diffDialogue(a: DialogueDefinition, b: DialogueDefinition): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  if (!deepEqual(a.speakers, b.speakers)) diffs.push({ field: 'speakers', before: a.speakers, after: b.speakers });
  const d1 = fieldDiff('entryNodeId', a.entryNodeId, b.entryNodeId); if (d1) diffs.push(d1);
  if (!deepEqual(a.nodes, b.nodes)) diffs.push({ field: 'nodes', before: `${Object.keys(a.nodes).length} nodes`, after: `${Object.keys(b.nodes).length} nodes` });
  return diffs;
}

function diffTree(a: ProgressionTreeDefinition, b: ProgressionTreeDefinition): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  const d1 = fieldDiff('name', a.name, b.name); if (d1) diffs.push(d1);
  const d2 = fieldDiff('currency', a.currency, b.currency); if (d2) diffs.push(d2);
  if (!deepEqual(a.nodes, b.nodes)) diffs.push({ field: 'nodes', before: `${a.nodes.length} nodes`, after: `${b.nodes.length} nodes` });
  return diffs;
}

function diffPlayerTemplate(a: PlayerTemplate | undefined, b: PlayerTemplate | undefined): DomainDiff {
  if (!a && !b) return { domain: 'player', unchanged: 0, modified: 0, added: 0, removed: 0, objects: [] };
  if (!a && b) return { domain: 'player', unchanged: 0, modified: 0, added: 1, removed: 0, objects: [{ id: 'player-template', name: b.name, domain: 'player', status: 'added', fieldDiffs: [] }] };
  if (a && !b) return { domain: 'player', unchanged: 0, modified: 0, added: 0, removed: 1, objects: [{ id: 'player-template', name: a.name, domain: 'player', status: 'removed', fieldDiffs: [] }] };

  const diffs: FieldDiff[] = [];
  for (const f of ['name', 'defaultArchetypeId', 'defaultBackgroundId', 'spawnPointId'] as const) {
    const d = fieldDiff(f, a![f], b![f]);
    if (d) diffs.push(d);
  }
  if (!deepEqual(a!.baseStats, b!.baseStats)) diffs.push({ field: 'baseStats', before: a!.baseStats, after: b!.baseStats });
  if (!deepEqual(a!.baseResources, b!.baseResources)) diffs.push({ field: 'baseResources', before: a!.baseResources, after: b!.baseResources });
  if (!deepEqual(a!.startingInventory, b!.startingInventory)) diffs.push({ field: 'startingInventory', before: a!.startingInventory, after: b!.startingInventory });
  if (!deepEqual(a!.startingEquipment, b!.startingEquipment)) diffs.push({ field: 'startingEquipment', before: a!.startingEquipment, after: b!.startingEquipment });

  const status: ChangeStatus = diffs.length === 0 ? 'unchanged' : 'modified';
  return {
    domain: 'player',
    unchanged: status === 'unchanged' ? 1 : 0,
    modified: status === 'modified' ? 1 : 0,
    added: 0, removed: 0,
    objects: [{ id: 'player-template', name: b!.name, domain: 'player', status, fieldDiffs: diffs }],
  };
}

function diffBuildCatalog(a: BuildCatalogDefinition | undefined, b: BuildCatalogDefinition | undefined): DomainDiff {
  if (!a && !b) return { domain: 'builds', unchanged: 0, modified: 0, added: 0, removed: 0, objects: [] };
  if (!a && b) return { domain: 'builds', unchanged: 0, modified: 0, added: 1, removed: 0, objects: [{ id: 'build-catalog', domain: 'builds', status: 'added', fieldDiffs: [] }] };
  if (a && !b) return { domain: 'builds', unchanged: 0, modified: 0, added: 0, removed: 1, objects: [{ id: 'build-catalog', domain: 'builds', status: 'removed', fieldDiffs: [] }] };

  const diffs: FieldDiff[] = [];
  for (const f of ['statBudget', 'maxTraits', 'requiredFlaws'] as const) {
    const d = fieldDiff(f, a![f], b![f]);
    if (d) diffs.push(d);
  }
  if (!deepEqual(a!.archetypes, b!.archetypes)) diffs.push({ field: 'archetypes', before: `${a!.archetypes.length} archetypes`, after: `${b!.archetypes.length} archetypes` });
  if (!deepEqual(a!.backgrounds, b!.backgrounds)) diffs.push({ field: 'backgrounds', before: `${a!.backgrounds.length} backgrounds`, after: `${b!.backgrounds.length} backgrounds` });
  if (!deepEqual(a!.traits, b!.traits)) diffs.push({ field: 'traits', before: `${a!.traits.length} traits`, after: `${b!.traits.length} traits` });

  const status: ChangeStatus = diffs.length === 0 ? 'unchanged' : 'modified';
  return {
    domain: 'builds',
    unchanged: status === 'unchanged' ? 1 : 0,
    modified: status === 'modified' ? 1 : 0,
    added: 0, removed: 0,
    objects: [{ id: 'build-catalog', domain: 'builds', status, fieldDiffs: diffs }],
  };
}

function diffAsset(a: AssetEntry, b: AssetEntry): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const f of ['label', 'kind', 'path', 'version', 'packId'] as const) {
    const d = fieldDiff(f, a[f], b[f]);
    if (d) diffs.push(d);
  }
  if (!deepEqual(a.tags, b.tags)) diffs.push({ field: 'tags', before: a.tags, after: b.tags });
  if (!deepEqual(a.provenance, b.provenance)) diffs.push({ field: 'provenance', before: a.provenance, after: b.provenance });
  return diffs;
}

function diffAssetPack(a: AssetPack, b: AssetPack): FieldDiff[] {
  const diffs: FieldDiff[] = [];
  for (const f of ['label', 'version', 'description', 'theme', 'source', 'license', 'author'] as const) {
    const d = fieldDiff(f, a[f], b[f]);
    if (d) diffs.push(d);
  }
  if (!deepEqual(a.tags, b.tags)) diffs.push({ field: 'tags', before: a.tags, after: b.tags });
  if (!deepEqual(a.compatibility, b.compatibility)) diffs.push({ field: 'compatibility', before: a.compatibility, after: b.compatibility });
  return diffs;
}

// --- Main diff function ---

export function diffProjects(before: WorldProject, after: WorldProject): ProjectDiff {
  const domains: DomainDiff[] = [];

  domains.push(diffDomain<Zone>('zones', before.zones, after.zones, (z) => z.id, (z) => z.name, diffZone));
  domains.push(diffDomain<District>('districts', before.districts, after.districts, (d) => d.id, (d) => d.name, diffDistrict));
  domains.push(diffDomain<EntityPlacement>('entities', before.entityPlacements, after.entityPlacements, (e) => e.entityId, (e) => e.name, diffEntity));
  domains.push(diffDomain<ItemPlacement>('items', before.itemPlacements, after.itemPlacements, (i) => i.itemId, (i) => i.name, diffItem));
  domains.push(diffDomain<DialogueDefinition>('dialogues', before.dialogues, after.dialogues, (d) => d.id, (d) => d.id, diffDialogue));
  domains.push(diffDomain<ProgressionTreeDefinition>('progression', before.progressionTrees, after.progressionTrees, (t) => t.id, (t) => t.name, diffTree));
  domains.push(diffPlayerTemplate(before.playerTemplate, after.playerTemplate));
  domains.push(diffBuildCatalog(before.buildCatalog, after.buildCatalog));
  domains.push(diffDomain<AssetEntry>('assets', before.assets, after.assets, (a) => a.id, (a) => a.label, diffAsset));
  domains.push(diffDomain<AssetPack>('packs', before.assetPacks, after.assetPacks, (p) => p.id, (p) => p.label, diffAssetPack));

  const totalUnchanged = domains.reduce((s, d) => s + d.unchanged, 0);
  const totalModified = domains.reduce((s, d) => s + d.modified, 0);
  const totalAdded = domains.reduce((s, d) => s + d.added, 0);
  const totalRemoved = domains.reduce((s, d) => s + d.removed, 0);

  return { domains, totalUnchanged, totalModified, totalAdded, totalRemoved };
}
