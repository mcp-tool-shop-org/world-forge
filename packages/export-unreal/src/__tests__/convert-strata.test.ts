/**
 * convert-strata.test.ts — F-a05c69b8 vertical strata + links → Unreal pack.
 */

import { describe, it, expect } from 'vitest';
import { convertStrata, STRATUM_Z_BAND } from '../convert-strata.js';
import type { WorldProject, Stratum, StratumLink, Zone } from '@world-forge/schema';

function zone(id: string, gridX: number, gridY: number, w: number, h: number, stratumId?: string): Zone {
  return { id, gridX, gridY, gridWidth: w, gridHeight: h, stratumId } as unknown as Zone;
}
function proj(zones: Zone[], strata: Stratum[] = [], stratumLinks: StratumLink[] = []): WorldProject {
  return { map: { tileSize: 32 }, zones, strata, stratumLinks } as unknown as WorldProject;
}
const stratum = (id: string, over: Partial<Stratum> = {}): Stratum =>
  ({ id, name: id, order: 0, tags: [], ...over });
const link = (id: string, over: Partial<StratumLink> = {}): StratumLink =>
  ({ id, fromStratumId: 'surface', toStratumId: 'under', bidirectional: true, linkType: 'stairs', ...over });

describe('convertStrata — strata', () => {
  it('exports a stratum with its order and z band (order * STRATUM_Z_BAND)', () => {
    const { manifest } = convertStrata(proj([], [
      stratum('under', { order: -1, zRange: { floor: -10, ceiling: 0 }, visibleStrata: ['surface'] }),
    ]));
    expect(manifest.Strata).toHaveLength(1);
    expect(manifest.Strata[0]).toMatchObject({
      Id: 'under', Order: -1, ZBand: -1 * STRATUM_Z_BAND,
      ZRangeCm: { FloorCm: -1000, CeilingCm: 0 }, VisibleStrata: ['surface'],
    });
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
    const dropped = fidelity.find((f) => f.level === 'dropped' && f.fieldPath === 'zones.stratumId');
    expect(dropped).toBeDefined();
    expect(dropped!.message).toContain('ghost');
    expect(dropped!.message).toContain('z1');
  });
});

describe('convertStrata — links', () => {
  it('positions a link at the midpoint of its anchor zones (Unreal cm)', () => {
    const { manifest } = convertStrata(proj(
      [zone('za', 0, 0, 4, 4), zone('zb', 8, 8, 4, 4)],
      [stratum('surface'), stratum('under', { order: -1 })],
      [link('l1', { fromZoneId: 'za', toZoneId: 'zb' })],
    ), 100);
    // za center=(2,2); zb center=(10,10); mid=(6,6) tiles × 100 cm, Y flipped
    expect(manifest.Links[0].LocationCm).toEqual({ X: 600, Y: -600, Z: 0 });
  });

  it('falls back to the single anchor zone center, else origin with approximated fidelity', () => {
    const single = convertStrata(proj(
      [zone('za', 0, 0, 4, 4)],
      [stratum('surface'), stratum('under', { order: -1 })],
      [link('l1', { fromZoneId: 'za' })],
    ), 100);
    expect(single.manifest.Links[0].LocationCm).toEqual({ X: 200, Y: -200, Z: 0 });
    const none = convertStrata(proj([], [stratum('surface'), stratum('under', { order: -1 })], [link('l2')]));
    expect(none.manifest.Links[0].LocationCm).toEqual({ X: 0, Y: 0, Z: 0 });
    expect(none.fidelity.some((f) => f.level === 'approximated' && f.entityId === 'l2' && f.message.includes('origin'))).toBe(true);
  });

  it('drops a link whose authored fromZoneId does not resolve', () => {
    const { manifest, fidelity } = convertStrata(proj(
      [zone('za', 0, 0, 4, 4)],
      [stratum('surface'), stratum('under', { order: -1 })],
      [link('l1', { fromZoneId: 'ghost' })],
    ));
    expect(manifest.Links).toHaveLength(0);
    expect(fidelity.some((f) => f.level === 'dropped' && f.message.includes('ghost'))).toBe(true);
  });
});

describe('convertStrata — empty', () => {
  it('returns nothing for a strata-free project', () => {
    const { manifest, zoneStrata, fidelity } = convertStrata(proj([zone('z1', 0, 0, 1, 1)]));
    expect(manifest.Strata).toHaveLength(0);
    expect(manifest.Links).toHaveLength(0);
    expect(Object.keys(zoneStrata)).toHaveLength(0);
    expect(fidelity).toHaveLength(0);
  });

  it('tolerates a legacy project missing the strata arrays', () => {
    const legacy = { map: { tileSize: 32 }, zones: [] } as unknown as WorldProject;
    expect(() => convertStrata(legacy)).not.toThrow();
  });
});
