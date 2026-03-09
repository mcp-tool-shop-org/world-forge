import { describe, it, expect } from 'vitest';
import { getSelectionBounds, alignSelected, distributeSelected } from '../layout.js';
import { SAMPLE_WORLDS } from '../templates/samples.js';

const chapel = SAMPLE_WORLDS[2].project;
const empty = { zones: [] as string[], entities: [] as string[], landmarks: [] as string[], spawns: [] as string[] };

// Chapel zone positions (from fixture):
// chapel-entrance: gridX=10, gridY=10, gridWidth=8, gridHeight=6  → right=18, bottom=16
// chapel-nave:     gridX=10, gridY=20, gridWidth=10, gridHeight=8 → right=20, bottom=28
// chapel-alcove:   gridX=22, gridY=22, gridWidth=5,  gridHeight=4 → right=27, bottom=26
// vestry-door:     gridX=4,  gridY=22, gridWidth=4,  gridHeight=4 → right=8,  bottom=26
// crypt-chamber:   gridX=30, gridY=25, gridWidth=10, gridHeight=8 → right=40, bottom=33
//
// altar-of-passage landmark: gridX=14, gridY=13
// chapel-spawn:              gridX=12, gridY=12
// Entities: all lack gridX/gridY → fallback = zone.gridX + 2, zone.gridY + 2

describe('getSelectionBounds', () => {
  it('zones produce rect bounds (right = gridX + gridWidth, bottom = gridY + gridHeight)', () => {
    const sel = { ...empty, zones: ['chapel-entrance', 'crypt-chamber'] };
    const bounds = getSelectionBounds(chapel, sel);

    expect(bounds).toHaveLength(2);

    const entrance = bounds.find(b => b.id === 'chapel-entrance')!;
    expect(entrance.type).toBe('zone');
    expect(entrance.left).toBe(10);
    expect(entrance.top).toBe(10);
    expect(entrance.right).toBe(18);
    expect(entrance.bottom).toBe(16);

    const crypt = bounds.find(b => b.id === 'crypt-chamber')!;
    expect(crypt.type).toBe('zone');
    expect(crypt.left).toBe(30);
    expect(crypt.top).toBe(25);
    expect(crypt.right).toBe(40);
    expect(crypt.bottom).toBe(33);
  });

  it('point objects (spawns) produce zero-size bounds (right = left, bottom = top)', () => {
    const sel = { ...empty, spawns: ['chapel-spawn'] };
    const bounds = getSelectionBounds(chapel, sel);

    expect(bounds).toHaveLength(1);
    const sp = bounds[0];
    expect(sp.type).toBe('spawn');
    expect(sp.left).toBe(12);
    expect(sp.top).toBe(12);
    expect(sp.right).toBe(12);
    expect(sp.bottom).toBe(12);
  });

  it('mixed types return all bounds', () => {
    const sel = {
      zones: ['chapel-entrance'],
      entities: ['suspicious-pilgrim'],
      landmarks: ['altar-of-passage'],
      spawns: ['chapel-spawn'],
    };
    const bounds = getSelectionBounds(chapel, sel);

    expect(bounds).toHaveLength(4);
    const types = bounds.map(b => b.type).sort();
    expect(types).toEqual(['entity', 'landmark', 'spawn', 'zone']);
  });

  it('entity without gridX/gridY uses zone fallback (+2 offset)', () => {
    // suspicious-pilgrim is in chapel-entrance (gridX=10, gridY=10)
    const sel = { ...empty, entities: ['suspicious-pilgrim'] };
    const bounds = getSelectionBounds(chapel, sel);

    expect(bounds).toHaveLength(1);
    const pilgrim = bounds[0];
    expect(pilgrim.type).toBe('entity');
    expect(pilgrim.left).toBe(12);   // 10 + 2
    expect(pilgrim.top).toBe(12);    // 10 + 2
    expect(pilgrim.right).toBe(12);  // point object
    expect(pilgrim.bottom).toBe(12);
  });

  it('non-existent IDs are skipped (empty result for bogus IDs)', () => {
    const sel = {
      zones: ['nonexistent-zone'],
      entities: ['nonexistent-entity'],
      landmarks: ['nonexistent-landmark'],
      spawns: ['nonexistent-spawn'],
    };
    const bounds = getSelectionBounds(chapel, sel);
    expect(bounds).toHaveLength(0);
  });
});

describe('alignSelected', () => {
  it('align-left: all left edges become minimum left (4)', () => {
    const sel = { ...empty, zones: ['vestry-door', 'chapel-entrance', 'chapel-alcove'] };
    const result = alignSelected(chapel, sel, 'left');

    const vestry = result.zones.find(z => z.id === 'vestry-door')!;
    const entrance = result.zones.find(z => z.id === 'chapel-entrance')!;
    const alcove = result.zones.find(z => z.id === 'chapel-alcove')!;

    expect(vestry.gridX).toBe(4);    // already at min, unchanged
    expect(entrance.gridX).toBe(4);  // was 10, now 4
    expect(alcove.gridX).toBe(4);    // was 22, now 4
  });

  it('align-right: all right edges become maximum right (40)', () => {
    const sel = { ...empty, zones: ['vestry-door', 'chapel-entrance', 'crypt-chamber'] };
    const result = alignSelected(chapel, sel, 'right');

    // vestry-door: right was 8, width=4, new gridX = 40 - 4 = 36
    const vestry = result.zones.find(z => z.id === 'vestry-door')!;
    expect(vestry.gridX).toBe(36);
    expect(vestry.gridX + vestry.gridWidth).toBe(40);

    // chapel-entrance: right was 18, width=8, new gridX = 40 - 8 = 32
    const entrance = result.zones.find(z => z.id === 'chapel-entrance')!;
    expect(entrance.gridX).toBe(32);
    expect(entrance.gridX + entrance.gridWidth).toBe(40);

    // crypt-chamber: right was already 40, unchanged
    const crypt = result.zones.find(z => z.id === 'crypt-chamber')!;
    expect(crypt.gridX).toBe(30);
    expect(crypt.gridX + crypt.gridWidth).toBe(40);
  });

  it('align-top: all top edges become minimum top (10)', () => {
    const sel = { ...empty, zones: ['chapel-entrance', 'chapel-nave'] };
    const result = alignSelected(chapel, sel, 'top');

    const entrance = result.zones.find(z => z.id === 'chapel-entrance')!;
    const nave = result.zones.find(z => z.id === 'chapel-nave')!;

    expect(entrance.gridY).toBe(10); // already at min
    expect(nave.gridY).toBe(10);     // was 20, now 10
  });

  it('align-bottom: all bottom edges become maximum bottom (33)', () => {
    const sel = { ...empty, zones: ['chapel-entrance', 'crypt-chamber'] };
    const result = alignSelected(chapel, sel, 'bottom');

    // chapel-entrance: bottom was 16, height=6, new gridY = 33 - 6 = 27
    const entrance = result.zones.find(z => z.id === 'chapel-entrance')!;
    expect(entrance.gridY).toBe(27);
    expect(entrance.gridY + entrance.gridHeight).toBe(33);

    // crypt-chamber: bottom was already 33, unchanged
    const crypt = result.zones.find(z => z.id === 'crypt-chamber')!;
    expect(crypt.gridY).toBe(25);
    expect(crypt.gridY + crypt.gridHeight).toBe(33);
  });

  it('center-h: both horizontal centers align to selection bbox center', () => {
    // vestry-door: left=4, right=8, centerX=6
    // crypt-chamber: left=30, right=40, centerX=35
    // bbox: left=4, right=40, anchor = (4+40)/2 = 22
    const sel = { ...empty, zones: ['vestry-door', 'crypt-chamber'] };
    const result = alignSelected(chapel, sel, 'center-h');

    // vestry-door: dx = 22 - 6 = 16, new gridX = 4 + 16 = 20
    const vestry = result.zones.find(z => z.id === 'vestry-door')!;
    expect(vestry.gridX).toBe(20);

    // crypt-chamber: dx = 22 - 35 = -13, new gridX = 30 - 13 = 17
    const crypt = result.zones.find(z => z.id === 'crypt-chamber')!;
    expect(crypt.gridX).toBe(17);
  });

  it('center-v: both vertical centers align to selection bbox center', () => {
    // chapel-entrance: top=10, bottom=16, centerY=13
    // crypt-chamber: top=25, bottom=33, centerY=29
    // bbox: top=10, bottom=33, anchor = (10+33)/2 = 21.5
    const sel = { ...empty, zones: ['chapel-entrance', 'crypt-chamber'] };
    const result = alignSelected(chapel, sel, 'center-v');

    // chapel-entrance: dy = 21.5 - 13 = 8.5, new gridY = round(10 + 8.5) = round(18.5) = 19
    const entrance = result.zones.find(z => z.id === 'chapel-entrance')!;
    expect(entrance.gridY).toBe(19);

    // crypt-chamber: dy = 21.5 - 29 = -7.5, new gridY = round(25 - 7.5) = round(17.5) = 18
    const crypt = result.zones.find(z => z.id === 'crypt-chamber')!;
    expect(crypt.gridY).toBe(18);
  });

  it('single object (< 2): returns project unchanged (=== reference equality)', () => {
    const sel = { ...empty, zones: ['chapel-entrance'] };
    const result = alignSelected(chapel, sel, 'left');
    expect(result).toBe(chapel);
  });

  it('mixed types: zone + landmark, align-left → both left edges match minimum', () => {
    // chapel-entrance zone: left=10
    // altar-of-passage landmark: left=14
    // anchor = min(10, 14) = 10
    const sel = {
      zones: ['chapel-entrance'],
      entities: [],
      landmarks: ['altar-of-passage'],
      spawns: [],
    };
    const result = alignSelected(chapel, sel, 'left');

    // chapel-entrance: already at left=10, no dx
    const entrance = result.zones.find(z => z.id === 'chapel-entrance')!;
    expect(entrance.gridX).toBe(10);

    // altar-of-passage: dx = 10 - 14 = -4, new gridX = round(14 - 4) = 10
    const altar = result.landmarks.find(l => l.id === 'altar-of-passage')!;
    expect(altar.gridX).toBe(10);
  });
});

describe('distributeSelected', () => {
  it('horizontal: middle zone center moves to evenly spaced position', () => {
    // vestry-door: centerX = (4+8)/2 = 6
    // chapel-entrance: centerX = (10+18)/2 = 14
    // crypt-chamber: centerX = (30+40)/2 = 35
    // sorted by centerX: vestry(6), entrance(14), crypt(35)
    // gap = (35-6)/2 = 14.5
    // target centers: 6, 20.5, 35
    // entrance dx = 20.5 - 14 = 6.5, new gridX = round(10 + 6.5) = round(16.5) = 17
    const sel = { ...empty, zones: ['vestry-door', 'chapel-entrance', 'crypt-chamber'] };
    const result = distributeSelected(chapel, sel, 'horizontal');

    // First and last stay put
    const vestry = result.zones.find(z => z.id === 'vestry-door')!;
    expect(vestry.gridX).toBe(4);

    const crypt = result.zones.find(z => z.id === 'crypt-chamber')!;
    expect(crypt.gridX).toBe(30);

    // Middle zone moved
    const entrance = result.zones.find(z => z.id === 'chapel-entrance')!;
    expect(entrance.gridX).not.toBe(10);
    expect(entrance.gridX).toBe(17); // round(10 + 6.5) = 17
  });

  it('vertical: middle zone center moves to evenly spaced position', () => {
    // chapel-entrance: centerY = (10+16)/2 = 13
    // chapel-nave: centerY = (20+28)/2 = 24
    // crypt-chamber: centerY = (25+33)/2 = 29
    // sorted by centerY: entrance(13), nave(24), crypt(29)
    // gap = (29-13)/2 = 8
    // target centers: 13, 21, 29
    // nave dy = 21 - 24 = -3, new gridY = round(20 - 3) = 17
    const sel = { ...empty, zones: ['chapel-entrance', 'chapel-nave', 'crypt-chamber'] };
    const result = distributeSelected(chapel, sel, 'vertical');

    // First and last stay put
    const entrance = result.zones.find(z => z.id === 'chapel-entrance')!;
    expect(entrance.gridY).toBe(10);

    const crypt = result.zones.find(z => z.id === 'crypt-chamber')!;
    expect(crypt.gridY).toBe(25);

    // Middle zone moved
    const nave = result.zones.find(z => z.id === 'chapel-nave')!;
    expect(nave.gridY).toBe(17); // round(20 - 3) = 17
  });

  it('< 3 objects: returns project unchanged (=== reference equality)', () => {
    const sel = { ...empty, zones: ['chapel-entrance', 'crypt-chamber'] };
    const result = distributeSelected(chapel, sel, 'horizontal');
    expect(result).toBe(chapel);
  });

  it('exactly 3 objects: middle object at exact midpoint', () => {
    // vestry-door centerX=6, chapel-entrance centerX=14, crypt-chamber centerX=35
    // gap = (35-6)/2 = 14.5, target mid center = 6 + 14.5 = 20.5
    // entrance: dx = 20.5 - 14 = 6.5, new gridX = round(10 + 6.5) = 17
    // new entrance centerX = 17 + 8/2 = 21 (rounded from 20.5)
    const sel = { ...empty, zones: ['vestry-door', 'chapel-entrance', 'crypt-chamber'] };
    const result = distributeSelected(chapel, sel, 'horizontal');

    const entrance = result.zones.find(z => z.id === 'chapel-entrance')!;
    // gridX is the rounded result: round(10 + 6.5) = 17
    expect(entrance.gridX).toBe(17);
    // The resulting center (21) is within 1 of the ideal midpoint (20.5) due to rounding
    const resultCenter = entrance.gridX + entrance.gridWidth / 2;
    const idealMidpoint = 20.5;
    expect(Math.abs(resultCenter - idealMidpoint)).toBeLessThanOrEqual(1);
  });

  it('results are integers (Math.round applied)', () => {
    // The horizontal distribute produces fractional deltas (6.5)
    // Verify all positions are integers after distribution
    const sel = { ...empty, zones: ['vestry-door', 'chapel-entrance', 'crypt-chamber'] };
    const result = distributeSelected(chapel, sel, 'horizontal');

    for (const zone of result.zones) {
      expect(Number.isInteger(zone.gridX)).toBe(true);
      expect(Number.isInteger(zone.gridY)).toBe(true);
    }
  });
});

describe('entity materialization', () => {
  it('align entity (no gridX) with a zone → entity gets explicit gridX/gridY', () => {
    // suspicious-pilgrim has no gridX/gridY, in chapel-entrance (10, 10)
    // fallback: gridX = 10 + 2 = 12, gridY = 10 + 2 = 12
    // Align left with chapel-nave (left=10) — both already at left=10/12
    // Use crypt-chamber (left=30) to force a visible alignment
    const sel = {
      zones: ['crypt-chamber'],
      entities: ['suspicious-pilgrim'],
      landmarks: [],
      spawns: [],
    };
    const result = alignSelected(chapel, sel, 'left');

    // Original entity has no gridX
    const originalEntity = chapel.entityPlacements.find(e => e.entityId === 'suspicious-pilgrim')!;
    expect(originalEntity.gridX).toBeUndefined();

    // After alignment, entity should have explicit gridX/gridY
    const movedEntity = result.entityPlacements.find(e => e.entityId === 'suspicious-pilgrim')!;
    expect(movedEntity.gridX).toBeDefined();
    expect(movedEntity.gridY).toBeDefined();
  });

  it('materialized position includes zone fallback + alignment delta', () => {
    // suspicious-pilgrim fallback: gridX=12, gridY=12 (chapel-entrance 10+2, 10+2)
    // crypt-chamber: left=30
    // align-left anchor = min(30, 12) = 12
    // entity already at left=12, dx=0; crypt dx = 12 - 30 = -18
    // But entity needs materialization since gridX is undefined, and dx=0
    // Actually the code checks: if (d.dx === 0 && d.dy === 0 && e.gridX != null) return e;
    // Since gridX is null, it still materializes!
    const sel = {
      zones: ['crypt-chamber'],
      entities: ['suspicious-pilgrim'],
      landmarks: [],
      spawns: [],
    };
    const result = alignSelected(chapel, sel, 'left');

    // anchor = min(30, 12) = 12
    // entity fallback left=12, dx = 12 - 12 = 0
    // materialized at fallback position (12, 12)
    const entity = result.entityPlacements.find(e => e.entityId === 'suspicious-pilgrim')!;
    expect(entity.gridX).toBe(12); // zone.gridX(10) + 2 + dx(0)
    expect(entity.gridY).toBe(12); // zone.gridY(10) + 2 + dy(0)

    // Now test with actual delta — align-top should move vertically
    const sel2 = {
      zones: [],
      entities: ['suspicious-pilgrim', 'ash-ghoul'],
      landmarks: [],
      spawns: [],
    };
    const result2 = alignSelected(chapel, sel2, 'top');

    // suspicious-pilgrim fallback: (12, 12)
    // ash-ghoul fallback: crypt-chamber (30+2, 25+2) = (32, 27)
    // anchor = min(12, 27) = 12
    // pilgrim dy = 12 - 12 = 0, materialized at (12, 12)
    // ghoul dy = 12 - 27 = -15, materialized at (32, round(27 - 15)) = (32, 12)
    const pilgrim = result2.entityPlacements.find(e => e.entityId === 'suspicious-pilgrim')!;
    expect(pilgrim.gridX).toBe(12);
    expect(pilgrim.gridY).toBe(12);

    const ghoul = result2.entityPlacements.find(e => e.entityId === 'ash-ghoul')!;
    expect(ghoul.gridX).toBe(32); // 30 + 2 + dx(0)
    expect(ghoul.gridY).toBe(12); // round(27 - 15) = 12
  });
});
