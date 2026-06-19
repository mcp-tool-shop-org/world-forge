/**
 * convert-props.test.ts — Wave B-3 (interiors) prop → Godot node conversion.
 */

import { describe, it, expect } from 'vitest';
import { convertProps } from '../convert-props.js';
import type { WorldProject, PropDefinition, PropPlacement } from '@world-forge/schema';

function proj(props: PropDefinition[], propPlacements: PropPlacement[], tileSize = 32): WorldProject {
  return { map: { tileSize }, props, propPlacements } as unknown as WorldProject;
}
const barrel: PropDefinition = { id: 'barrel', name: 'Barrel', width: 1, height: 1, tags: ['container'], walkable: false, interactable: true };
const rug: PropDefinition = { id: 'rug', name: 'Rug', width: 2, height: 1, tags: ['decor'], walkable: true, interactable: false };

describe('convertProps', () => {
  it('resolves placements to nodes with pixel positions + definition data', () => {
    const { props } = convertProps(proj([barrel], [
      { id: 'p1', propId: 'barrel', gridX: 3, gridY: 4, zoneId: 'z1' },
    ]));
    expect(props).toHaveLength(1);
    expect(props[0]).toMatchObject({
      id: 'p1', propId: 'barrel', displayName: 'Barrel',
      position: { x: 96, y: 128 }, // grid * tileSize (32)
      width: 1, height: 1, walkable: false, interactable: true, zoneId: 'z1',
    });
  });

  it('drops placements with no matching definition and warns', () => {
    const { props, fidelity } = convertProps(proj([barrel], [
      { id: 'p1', propId: 'barrel', gridX: 0, gridY: 0 },
      { id: 'p2', propId: 'ghost', gridX: 1, gridY: 0 },
    ]));
    expect(props.map((p) => p.id)).toEqual(['p1']);
    expect(fidelity.some((f) => f.domain === 'props' && f.level === 'dropped')).toBe(true);
  });

  it('reports an approximated fidelity entry when props export', () => {
    const { fidelity } = convertProps(proj([barrel], [{ id: 'p1', propId: 'barrel', gridX: 0, gridY: 0 }]));
    expect(fidelity.some((f) => f.domain === 'props' && f.level === 'approximated')).toBe(true);
  });

  it('dedupes node names for same-named props', () => {
    const { props } = convertProps(proj([barrel], [
      { id: 'p1', propId: 'barrel', gridX: 0, gridY: 0 },
      { id: 'p2', propId: 'barrel', gridX: 1, gridY: 0 },
    ]));
    expect(props.map((p) => p.nodeName)).toEqual(['Barrel', 'Barrel_2']);
  });

  it('carries multi-tile footprint + imagePath through', () => {
    const withImg: PropDefinition = { ...rug, imagePath: 'props/rug.png' };
    const { props } = convertProps(proj([withImg], [{ id: 'p1', propId: 'rug', gridX: 0, gridY: 0 }]));
    expect(props[0]).toMatchObject({ width: 2, height: 1, imagePath: 'props/rug.png' });
  });

  it('returns nothing for a propless project', () => {
    const { props, fidelity } = convertProps(proj([], []));
    expect(props).toHaveLength(0);
    expect(fidelity).toHaveLength(0);
  });
});
