import { describe, it, expect } from 'vitest';
import {
  pickDefaultSpawnPointId,
  isMissingSpawnPoint,
  createDefaultPlayerTemplate,
  inventoryWithItem,
  missingInventoryIds,
} from '../player-template-helpers.js';

describe('F-2430a6b2: player template spawn default', () => {
  it('picks the default spawn when one is marked', () => {
    expect(pickDefaultSpawnPointId([
      { id: 'a' },
      { id: 'b', isDefault: true },
      { id: 'c' },
    ])).toBe('b');
  });

  it('falls back to the first spawn when none is default', () => {
    expect(pickDefaultSpawnPointId([{ id: 'a' }, { id: 'b' }])).toBe('a');
  });

  it('returns undefined when there are no spawns', () => {
    expect(pickDefaultSpawnPointId([])).toBeUndefined();
  });

  it('treats empty spawnPointId as missing', () => {
    expect(isMissingSpawnPoint('', [{ id: 'a' }])).toBe(true);
    expect(isMissingSpawnPoint(undefined, [{ id: 'a' }])).toBe(true);
    expect(isMissingSpawnPoint('a', [{ id: 'a' }])).toBe(false);
    expect(isMissingSpawnPoint('missing', [{ id: 'a' }])).toBe(true);
  });

  it('createDefaultPlayerTemplate never uses an empty spawnPointId', () => {
    const pt = createDefaultPlayerTemplate('sp-default');
    expect(pt.spawnPointId).toBe('sp-default');
    expect(pt.spawnPointId).not.toBe('');
  });
});

describe('F-a3e545f9: player template item picker helpers', () => {
  it('toggles inventory ids without duplicating', () => {
    expect(inventoryWithItem([], 'torch', true)).toEqual(['torch']);
    expect(inventoryWithItem(['torch'], 'torch', true)).toEqual(['torch']);
    expect(inventoryWithItem(['torch', 'key'], 'torch', false)).toEqual(['key']);
  });

  it('reports inventory ids that have no placement', () => {
    expect(missingInventoryIds(['torch', 'ghost'], [{ itemId: 'torch' }])).toEqual(['ghost']);
    expect(missingInventoryIds(['torch'], [{ itemId: 'torch' }])).toEqual([]);
  });
});
