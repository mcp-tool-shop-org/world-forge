/**
 * convert-props.test.ts — F-9615478f prop payload + walkable collision.
 */

import { describe, it, expect } from 'vitest';
import { convertProps } from '../convert-props.js';
import type { WorldProject, PropDefinition, PropPlacement } from '@world-forge/schema';

function proj(props: PropDefinition[], propPlacements: PropPlacement[]): WorldProject {
  return { map: { tileSize: 32 }, props, propPlacements, zones: [] } as unknown as WorldProject;
}
const barrel: PropDefinition = {
  id: 'barrel', name: 'Barrel', width: 1, height: 1, tags: ['container'], walkable: false, interactable: true,
};
const rug: PropDefinition = {
  id: 'rug', name: 'Rug', width: 2, height: 1, tags: ['decor'], walkable: true, interactable: false,
};

describe('convertProps', () => {
  it('resolves placements to actors with LocationCm + definition data', () => {
    const { manifest } = convertProps(proj([barrel], [
      { id: 'p1', propId: 'barrel', gridX: 3, gridY: 4, zoneId: 'z1' },
    ]), 100);
    expect(manifest.Actors).toHaveLength(1);
    expect(manifest.Actors[0]).toMatchObject({
      Id: 'p1', PropId: 'barrel', DisplayName: 'Barrel',
      LocationCm: { X: 300, Y: -400, Z: 0 },
      WidthTiles: 1, HeightTiles: 1, Walkable: false, Interactable: true, ZoneId: 'z1',
    });
  });

  it('emits a CollisionBox for !walkable props', () => {
    const { manifest } = convertProps(proj([barrel], [
      { id: 'p1', propId: 'barrel', gridX: 1, gridY: 2 },
    ]), 100);
    expect(manifest.CollisionBoxes).toHaveLength(1);
    expect(manifest.CollisionBoxes[0]).toMatchObject({
      Source: 'prop', PropId: 'barrel',
      ExtentCm: { WidthCm: 100, DepthCm: 100, HeightCm: 100 },
    });
    expect(manifest.Actors[0].CollisionBox).toBeDefined();
  });

  it('omits collision for walkable props', () => {
    const { manifest } = convertProps(proj([rug], [
      { id: 'p1', propId: 'rug', gridX: 0, gridY: 0 },
    ]));
    expect(manifest.CollisionBoxes).toEqual([]);
    expect(manifest.Actors[0].CollisionBox).toBeUndefined();
    expect(manifest.Actors[0].Walkable).toBe(true);
  });

  it('drops placements with no matching definition and warns', () => {
    const { manifest, fidelity } = convertProps(proj([barrel], [
      { id: 'p1', propId: 'barrel', gridX: 0, gridY: 0 },
      { id: 'p2', propId: 'ghost', gridX: 1, gridY: 0 },
    ]));
    expect(manifest.Actors.map((p) => p.Id)).toEqual(['p1']);
    expect(fidelity.some((f) => f.domain === 'props' && f.level === 'dropped' && f.message.includes('ghost'))).toBe(true);
  });
});
