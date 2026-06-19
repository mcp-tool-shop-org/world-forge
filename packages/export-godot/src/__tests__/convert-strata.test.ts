/**
 * convert-strata.test.ts — vertical strata + links → Godot scene data.
 */

import { describe, it, expect } from 'vitest';
import { convertStrata, STRATUM_Z_BAND } from '../convert-strata.js';
import type { WorldProject, Stratum, StratumLink, Zone } from '@world-forge/schema';

function zone(id: string, gridX: number, gridY: number, w: number, h: number, stratumId?: string): Zone {
  return { id, gridX, gridY, gridWidth: w, gridHeight: h, stratumId } as unknown as Zone;
}
function proj(zones: Zone[], strata: Stratum[] = [], stratumLinks: StratumLink[] = [], tileSize = 32): WorldProject {
  return { map: { tileSize }, zones, strata, stratumLinks } as unknown as WorldProject;
}
const stratum = (id: string, over: Partial<Stratum> = {}): Stratum =>
  ({ id, name: id, order: 0, tags: [], ...over });
const link = (id: string, over: Partial<StratumLink> = {}): StratumLink =>
  ({ id, fromStratumId: 'surface', toStratumId: 'under', bidirectional: true, linkType: 'stairs', ...over });

describe('convertStrata — strata', () => {
  it('exports a stratum with its order and z band (order * STRATUM_Z_BAND)', () => {
    const { strata } = convertStrata(proj([], [stratum('under', { order: -1, zRange: { floor: -10, ceiling: 0 }, visibleStrata: ['surface'] })]));
    expect(strata).toHaveLength(1);
    expect(strata[0]).toMatchObject({ id: 'under', order: -1, zBand: -1 * STRATUM_Z_BAND, zRange: { floor: -10, ceiling: 0 }, visibleStrata: ['surface'] });
  });

  it('reports an approximated entry when strata export', () => {
    const { fidelity } = convertStrata(proj([], [stratum('surface')]));
    expect(fidelity.some((f) => f.domain === 'structures' && f.level === 'approximated' && f.fieldPath === 'strata/stratumLinks')).toBe(true);
  });
});

describe('convertStrata — zone banding', () => {
  it('bands a zone whose stratumId resolves to a stratum', () => {
    const { zoneStrata } = convertStrata(proj(
      [zone('z1', 0, 0, 2, 2, 'sky')],
      [stratum('sky', { order: 2 })],
    ));
    expect(zoneStrata['z1']).toEqual({ stratumId: 'sky', zBand: 2 * STRATUM_Z_BAND });
  });

  it('does not band a zone with no stratumId', () => {
    const { zoneStrata } = convertStrata(proj([zone('z1', 0, 0, 2, 2)], [stratum('surface')]));
    expect(zoneStrata['z1']).toBeUndefined();
  });

  it('warns + skips a zone referencing a nonexistent stratum', () => {
    const { zoneStrata, fidelity } = convertStrata(proj([zone('z1', 0, 0, 2, 2, 'ghost')], [stratum('surface')]));
    expect(zoneStrata['z1']).toBeUndefined();
    expect(fidelity.some((f) => f.level === 'dropped' && f.fieldPath === 'zones.stratumId')).toBe(true);
  });
});

describe('convertStrata — links', () => {
  it('positions a link at the midpoint of its anchor zones', () => {
    const { links } = convertStrata(proj(
      [zone('za', 0, 0, 4, 4), zone('zb', 8, 8, 4, 4)],
      [stratum('surface'), stratum('under', { order: -1 })],
      [link('l1', { fromZoneId: 'za', toZoneId: 'zb' })],
    ));
    // za center=((0+2)*32,(0+2)*32)=(64,64); zb center=((8+2)*32,(8+2)*32)=(320,320); mid=(192,192)
    expect(links[0].position).toEqual({ x: 192, y: 192 });
  });

  it('falls back to the single anchor zone center, else origin', () => {
    const single = convertStrata(proj(
      [zone('za', 0, 0, 4, 4)],
      [stratum('surface'), stratum('under', { order: -1 })],
      [link('l1', { fromZoneId: 'za' })],
    ));
    expect(single.links[0].position).toEqual({ x: 64, y: 64 });
    const none = convertStrata(proj([], [stratum('surface'), stratum('under', { order: -1 })], [link('l2')]));
    expect(none.links[0].position).toEqual({ x: 0, y: 0 });
  });
});

describe('convertStrata — empty', () => {
  it('returns nothing for a strata-free project', () => {
    const { strata, links, zoneStrata, fidelity } = convertStrata(proj([zone('z1', 0, 0, 1, 1)]));
    expect(strata).toHaveLength(0);
    expect(links).toHaveLength(0);
    expect(Object.keys(zoneStrata)).toHaveLength(0);
    expect(fidelity).toHaveLength(0);
  });

  it('tolerates a legacy project missing the strata arrays', () => {
    const legacy = { map: { tileSize: 32 }, zones: [] } as unknown as WorldProject;
    expect(() => convertStrata(legacy)).not.toThrow();
  });
});
