import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import type { ItemPlacement, TransitionEntity, WorldProject } from '@world-forge/schema';
import { buildSearchIndex } from '../SearchOverlay.js';
import { SAMPLE_WORLDS } from '../../templates/samples.js';
import {
  ITEM_SLOTS, ITEM_RARITIES, TRANSITION_TYPES,
  defaultItemPlacement, withAddedItem, withUpdatedItem, withRemovedItem, parseModifiers,
  defaultLootTable, defaultLootEntry, withAddedLootTable, withUpdatedLootTable, withRemovedLootTable,
  withLootEntry, withAddedLootEntry, withRemovedLootEntry, parseQuantity,
  defaultTransition, withAddedTransition, withUpdatedTransition, withRemovedTransition,
  pickDefaultTargetZoneId,
} from '../item-loot-transition-helpers.js';

const here = dirname(fileURLToPath(import.meta.url));

function proj(overrides: Partial<WorldProject> = {}): WorldProject {
  return { itemPlacements: [], lootTables: [], transitions: [], ...overrides } as WorldProject;
}

describe('item transformers (F-a3e545f9)', () => {
  it('exposes slot and rarity unions', () => {
    expect(ITEM_SLOTS).toContain('weapon');
    expect(ITEM_RARITIES).toEqual(['common', 'uncommon', 'rare', 'legendary']);
  });

  it('adds, updates, and removes item placements', () => {
    const item: ItemPlacement = defaultItemPlacement('item-1', 'zone-a');
    const added = withAddedItem(proj(), item);
    expect(added.itemPlacements).toHaveLength(1);
    expect(added.itemPlacements[0].hidden).toBe(false);

    const updated = withUpdatedItem(added, 'item-1', { rarity: 'rare', lootTableId: 'loot-1' });
    expect(updated.itemPlacements[0].rarity).toBe('rare');
    expect(updated.itemPlacements[0].lootTableId).toBe('loot-1');

    expect(withRemovedItem(updated, 'item-1').itemPlacements).toEqual([]);
  });

  it('parses modifiers and treats empty as undefined', () => {
    expect(parseModifiers('vigor:2, hp:5')).toEqual({ vigor: 2, hp: 5 });
    expect(parseModifiers('  ')).toBeUndefined();
  });
});

describe('loot table transformers (F-b483eb22)', () => {
  it('starts with one entry and refuses to drop the last', () => {
    const table = defaultLootTable('loot-1');
    expect(table.entries).toHaveLength(1);
    expect(table.rolls).toBe(1);
    expect(withRemovedLootEntry(table, 0)).toBe(table);

    const two = withAddedLootEntry(table);
    expect(two.entries).toHaveLength(2);
    expect(withRemovedLootEntry(two, 0).entries).toHaveLength(1);
  });

  it('patches a single entry and rolls on the project', () => {
    const table = defaultLootTable('loot-1');
    const patched = withLootEntry(table, 0, { itemId: 'torch', weight: 3, rarity: 'uncommon' });
    expect(patched.entries[0]).toMatchObject({ itemId: 'torch', weight: 3, rarity: 'uncommon' });

    const added = withAddedLootTable(proj(), table);
    expect(withUpdatedLootTable(added, 'loot-1', { rolls: 2 }).lootTables?.[0].rolls).toBe(2);
    expect(withRemovedLootTable(added, 'loot-1').lootTables).toEqual([]);
  });

  it('parses quantity ranges and defaultLootEntry has weight 1', () => {
    expect(parseQuantity('1', '3')).toEqual({ min: 1, max: 3 });
    expect(parseQuantity('', '')).toBeUndefined();
    expect(defaultLootEntry()).toEqual({ itemId: 'item', weight: 1 });
  });
});

describe('transition transformers (F-2ed2bc78)', () => {
  it('covers every TransitionEntityType', () => {
    expect(TRANSITION_TYPES).toEqual(['elevator', 'warp', 'transporter', 'cargo-lift', 'stairwell']);
  });

  it('adds, updates, and removes transitions', () => {
    const t: TransitionEntity = defaultTransition('tr-1', 'zone-a', 'zone-b');
    expect(t.type).toBe('elevator');
    const added = withAddedTransition(proj(), t);
    expect(added.transitions).toHaveLength(1);
    expect(withUpdatedTransition(added, 'tr-1', { type: 'warp', durationSeconds: 2 }).transitions?.[0]).toMatchObject({
      type: 'warp', durationSeconds: 2,
    });
    expect(withRemovedTransition(added, 'tr-1').transitions).toEqual([]);
  });

  it('picks another zone as the default target when one exists', () => {
    expect(pickDefaultTargetZoneId('a', ['a', 'b'])).toBe('b');
    expect(pickDefaultTargetZoneId('a', ['a'])).toBe('a');
  });
});

describe('panel wiring source (F-a3e545f9 / F-b483eb22 / F-2ed2bc78)', () => {
  it('ItemProperties mutates via updateProject + lootTableId', () => {
    const src = readFileSync(join(here, '../ItemProperties.tsx'), 'utf8');
    expect(src).toContain('updateProject');
    expect(src).toContain('withAddedItem');
    expect(src).toContain('lootTableId');
    expect(src).toContain('wf-item-properties');
  });

  it('LootTablePanel mutates via updateProject', () => {
    const src = readFileSync(join(here, '../LootTablePanel.tsx'), 'utf8');
    expect(src).toContain('updateProject');
    expect(src).toContain('withAddedLootTable');
    expect(src).toContain('wf-loot-table-panel');
  });

  it('TransitionProperties mutates via updateProject and exposes type + target zone', () => {
    const src = readFileSync(join(here, '../TransitionProperties.tsx'), 'utf8');
    expect(src).toContain('updateProject');
    expect(src).toContain('targetZoneId');
    expect(src).toContain('TRANSITION_TYPES');
    expect(src).toContain('wf-transition-properties');
  });

  it('EconomyPanel composes ItemProperties and TransitionProperties', () => {
    const src = readFileSync(join(here, '../EconomyPanel.tsx'), 'utf8');
    expect(src).toContain('<ItemProperties />');
    expect(src).toContain('<TransitionProperties />');
  });

  it('HazardLibraryPanel composes LootTablePanel', () => {
    const src = readFileSync(join(here, '../HazardLibraryPanel.tsx'), 'utf8');
    expect(src).toContain('<LootTablePanel />');
  });

  it('ObjectList and SearchOverlay index item placements', () => {
    const objects = readFileSync(join(here, '../ObjectListPanel.tsx'), 'utf8');
    expect(objects).toContain('handleSelectItem');
    expect(objects).toContain('itemPlacements');
    const search = readFileSync(join(here, '../SearchOverlay.tsx'), 'utf8');
    expect(search).toContain("type: 'item'");
    expect(search).toContain("type: 'loot'");
    expect(search).toContain("type: 'transition'");
  });

  it('PlayerTemplatePanel picks existing itemIds', () => {
    const src = readFileSync(join(here, '../PlayerTemplatePanel.tsx'), 'utf8');
    expect(src).toContain('InventoryPicker');
    expect(src).toContain('inventoryWithItem');
    expect(src).toContain('wf-player-inventory-picker');
  });

  it('buildSearchIndex includes chapel items', () => {
    const chapel = SAMPLE_WORLDS[2].project;
    const index = buildSearchIndex(chapel);
    expect(index.filter((r) => r.type === 'item')).toHaveLength(chapel.itemPlacements.length);
    expect(chapel.itemPlacements.length).toBeGreaterThan(0);
  });
});
