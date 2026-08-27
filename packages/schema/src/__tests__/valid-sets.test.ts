// valid-sets.test.ts — F-0ab7bbb4: barrel re-exports of closed-union VALID_* sets
import { describe, it, expect } from 'vitest';
import {
  VALID_CONNECTION_KINDS,
  VALID_ASSET_KINDS,
  VALID_TRANSITION_TYPES,
  VALID_ENTITY_ROLES,
  VALID_ITEM_SLOTS,
  VALID_ITEM_RARITIES,
  VALID_INTERACTABLE_TYPES,
  VALID_LANDMARK_INTERACTION_TYPES,
  VALID_AMBIENT_LAYER_TYPES,
  VALID_PHYSICS_MODES,
  VALID_GRAVITY_DIRECTIONS,
  type ClosedUnionSet,
} from '../index.js';

function expectClosed<T extends string>(set: ClosedUnionSet<T>, expected: readonly T[]): void {
  expect(set.size).toBe(expected.length);
  for (const value of expected) {
    expect(set.has(value)).toBe(true);
  }
  expect(set.has('not-a-real-member')).toBe(false);
  expect(set.has('')).toBe(false);
}

describe('F-0ab7bbb4: VALID_* sets are on the public barrel', () => {
  it('VALID_CONNECTION_KINDS covers ConnectionKind', () => {
    expectClosed(VALID_CONNECTION_KINDS, [
      'passage', 'door', 'stairs', 'road', 'portal', 'secret', 'hazard',
      'channel', 'route', 'docking', 'warp', 'trail',
    ]);
  });

  it('VALID_ASSET_KINDS covers AssetKind', () => {
    expectClosed(VALID_ASSET_KINDS, ['portrait', 'sprite', 'background', 'icon', 'tileset']);
  });

  it('VALID_TRANSITION_TYPES covers TransitionEntityType', () => {
    expectClosed(VALID_TRANSITION_TYPES, [
      'elevator', 'warp', 'transporter', 'cargo-lift', 'stairwell',
    ]);
  });

  it('VALID_ENTITY_ROLES covers EntityRole', () => {
    expectClosed(VALID_ENTITY_ROLES, [
      'npc', 'enemy', 'merchant', 'quest-giver', 'companion', 'boss',
    ]);
  });

  it('VALID_ITEM_SLOTS covers ItemSlot', () => {
    expectClosed(VALID_ITEM_SLOTS, [
      'weapon', 'armor', 'trinket', 'tool', 'accessory', 'consumable',
    ]);
  });

  it('VALID_ITEM_RARITIES covers ItemRarity', () => {
    expectClosed(VALID_ITEM_RARITIES, ['common', 'uncommon', 'rare', 'legendary']);
  });

  it('VALID_INTERACTABLE_TYPES covers Interactable.type', () => {
    expectClosed(VALID_INTERACTABLE_TYPES, ['inspect', 'use', 'enter', 'talk', 'none']);
  });

  it('VALID_LANDMARK_INTERACTION_TYPES covers Landmark.interactionType', () => {
    expectClosed(VALID_LANDMARK_INTERACTION_TYPES, ['inspect', 'use', 'enter', 'talk', 'none']);
  });

  it('VALID_AMBIENT_LAYER_TYPES covers AmbientLayer.type', () => {
    expectClosed(VALID_AMBIENT_LAYER_TYPES, ['fog', 'rain', 'dust', 'glow', 'shadow', 'custom']);
  });

  it('VALID_PHYSICS_MODES covers PhysicsMode', () => {
    expectClosed(VALID_PHYSICS_MODES, ['normal', 'platformer', 'zero-g', 'aquatic']);
  });

  it('VALID_GRAVITY_DIRECTIONS covers GravityDirection', () => {
    expectClosed(VALID_GRAVITY_DIRECTIONS, ['down', 'up', 'none']);
  });
});
