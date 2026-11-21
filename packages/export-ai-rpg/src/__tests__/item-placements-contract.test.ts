// item-placements-contract.test.ts — Part B tests for item placements.
//
// Proves card items 4-5:
//   - A placement whose `container` names an exported entity writes to
//     `ContentPack.itemPlacements` with `entityId` set to that entity's id,
//     and the engine's intake counts `applied.itemPlacements` + equips it.
//   - A zone-loose placement (or container naming no exported entity) is omitted
//     from `ContentPack.itemPlacements` and reported in `fidelity` as dropped
//     with reason `engine-has-no-zone-items`, citing `gate.ts:91-110`.

import { describe, it, expect } from 'vitest';
import {
  applyContentPack,
  type ContentPack as EngineContentPack,
} from '@ai-rpg-engine/content-schema';
import { createStandardChannels } from '@ai-rpg-engine/modules';
import { createGame } from '@ai-rpg-engine/starter-fantasy';
import type { WorldProject } from '@world-forge/schema';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';
import { exportToEngine } from '../export.js';

describe('Step 1 Part B — itemPlacements container-entity vs zone-loose filtering', () => {
  it('container-entity placement sets entityId, arrives on that entity, and intake.applied.itemPlacements counts it', () => {
    const project: WorldProject = {
      ...minimalProject,
      encounterAnchors: [],
      itemPlacements: [
        {
          itemId: 'item-torch',
          name: 'Keeper Torch',
          zoneId: 'zone-entrance',
          container: 'npc-keeper',
          hidden: false,
          slot: 'tool',
          rarity: 'common',
        },
      ],
    };

    const exported = exportToEngine(project);
    expect(exported.success).toBe(true);
    if (!exported.success) throw new Error('export failed');

    expect(exported.contentPack.itemPlacements).toHaveLength(1);
    expect(exported.contentPack.itemPlacements[0].entityId).toBe('npc-keeper');
    expect(exported.contentPack.itemPlacements[0].itemId).toBe('item-torch');
    expect(
      exported.fidelity.entries.filter((f) => f.reason === 'engine-has-no-zone-items'),
    ).toEqual([]);

    const engine = createGame(71);
    const intake = applyContentPack(
      engine,
      exported.contentPack as unknown as EngineContentPack,
      { channels: createStandardChannels() },
    );

    expect(intake.ok, JSON.stringify(intake.errors, null, 2)).toBe(true);
    expect(intake.applied.itemPlacements).toBe(1);
    expect(engine.store.state.entities['npc-keeper']?.inventory).toContain('item-torch');
  });

  it('zone-loose and non-entity-container placements are absent from pack and listed in fidelity with engine-has-no-zone-items citing gate.ts:91-110', () => {
    const project: WorldProject = {
      ...minimalProject,
      encounterAnchors: [],
      itemPlacements: [
        {
          itemId: 'item-torch',
          name: 'Floor Torch',
          zoneId: 'zone-cellar',
          hidden: false,
          slot: 'tool',
          rarity: 'common',
        },
        {
          itemId: 'item-rope',
          name: 'Crate Rope',
          zoneId: 'zone-cellar',
          container: 'wooden-crate',
          hidden: false,
          slot: 'tool',
          rarity: 'common',
        },
      ],
    };

    const exported = exportToEngine(project);
    expect(exported.success).toBe(true);
    if (!exported.success) throw new Error('export failed');

    expect(exported.contentPack.itemPlacements).toEqual([]);

    const drops = exported.fidelity.entries.filter(
      (f) => f.reason === 'engine-has-no-zone-items',
    );
    expect(drops).toHaveLength(2);
    for (const drop of drops) {
      expect(drop.level).toBe('dropped');
      expect(drop.domain).toBe('items');
      expect(drop.message).toContain('gate.ts:91-110');
    }
    expect(drops.map((d) => d.entityId)).toEqual(['item-torch', 'item-rope']);
  });
});
