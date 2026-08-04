// town-validation.test.ts — rules 87-89 (F-4b9345d3).
//
// The v4.5 town layer (Building / Hub / Stronghold) shipped with zero
// validation and zero test coverage: every id collision, every dangling
// zone reference, and every garbage defenseLevel passed validateProject
// clean. The headline case is Building.interiorZoneId — town.ts's own header
// calls it the link "from the town map to the interiors layer", and it is
// functionally the same field as TransitionEntity.targetZoneId, which rule 61
// has always checked. A typo there meant the player entered a building and
// arrived nowhere, with the project reported valid.
//
// Every reject-case below fails against pre-fix validate.ts (it returned
// valid:true with zero errors); every control case pins the behaviour that
// must NOT change — absent arrays, unset optional fields, and the boundary
// values the new checks could plausibly misflag.

import { describe, it, expect } from 'vitest';
import { validateProject } from '../validate.js';
import { minimalProject } from './fixtures/minimal.js';
import type { WorldProject } from '../project.js';
import type { Building, Hub, Stronghold } from '../town.js';

const building = (id: string, over: Partial<Building> = {}): Building => ({
  id, name: id, buildingType: 'house', gridX: 1, gridY: 1, width: 2, height: 2, tags: [], ...over,
});

const hub = (id: string, over: Partial<Hub> = {}): Hub => ({
  id, name: id, zoneId: 'zone-entrance', hubType: 'market-square',
  serviceTypes: ['market'], connectedZoneIds: [], tags: [], ...over,
});

const stronghold = (id: string, over: Partial<Stronghold> = {}): Stronghold => ({
  id, name: id, zoneId: 'zone-entrance', defenseLevel: 3, garrisonEntityIds: [], tags: [], ...over,
});

const withTown = (patch: Partial<WorldProject>): WorldProject => ({ ...minimalProject, ...patch });

const townErrors = (p: WorldProject) =>
  validateProject(p).errors.filter(
    (e) => e.path.startsWith('buildings') || e.path.startsWith('hubs') || e.path.startsWith('strongholds'),
  );

describe('town-structure validation (rules 87-89)', () => {
  it('treats absent town arrays as backward-compatible (valid)', () => {
    // minimalProject omits all three fields entirely — the v4.5 additive contract.
    expect(minimalProject.buildings).toBeUndefined();
    expect(townErrors(minimalProject)).toEqual([]);
  });

  describe('Building (rule 87)', () => {
    it('accepts a well-formed building with both zone links resolved', () => {
      const p = withTown({ buildings: [building('b-inn', { zoneId: 'zone-entrance', interiorZoneId: 'zone-cellar' })] });
      expect(townErrors(p)).toEqual([]);
      expect(validateProject(p).valid).toBe(true);
    });

    it('accepts a building with neither optional zone field set (control — optionality must not misflag)', () => {
      expect(townErrors(withTown({ buildings: [building('b-shed')] }))).toEqual([]);
    });

    it('rejects duplicate building IDs', () => {
      const r = validateProject(withTown({ buildings: [building('b-inn'), building('b-inn')] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.message.includes('Duplicate building ID'))).toBe(true);
    });

    it('rejects a building in a nonexistent zone', () => {
      const r = validateProject(withTown({ buildings: [building('b-inn', { zoneId: 'zone-ghost' })] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === 'buildings.b-inn.zoneId' && e.message.includes('zone-ghost'))).toBe(true);
    });

    it('rejects a building whose interiorZoneId points nowhere (the headline case)', () => {
      const r = validateProject(withTown({ buildings: [building('b-inn', { interiorZoneId: 'zone-typo' })] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === 'buildings.b-inn.interiorZoneId' && e.message.includes('zone-typo'))).toBe(true);
    });
  });

  describe('Hub (rule 88)', () => {
    it('accepts a well-formed hub serving real zones', () => {
      const p = withTown({ hubs: [hub('h-square', { connectedZoneIds: ['zone-entrance', 'zone-cellar'] })] });
      expect(townErrors(p)).toEqual([]);
      expect(validateProject(p).valid).toBe(true);
    });

    it('rejects duplicate hub IDs', () => {
      const r = validateProject(withTown({ hubs: [hub('h-square'), hub('h-square')] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.message.includes('Duplicate hub ID'))).toBe(true);
    });

    it('rejects a hub anchored to a nonexistent zone', () => {
      const r = validateProject(withTown({ hubs: [hub('h-square', { zoneId: 'zone-ghost' })] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === 'hubs.h-square.zoneId' && e.message.includes('zone-ghost'))).toBe(true);
    });

    it('rejects a hub serving a nonexistent zone', () => {
      const r = validateProject(withTown({ hubs: [hub('h-square', { connectedZoneIds: ['zone-entrance', 'zone-ghost'] })] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === 'hubs.h-square.connectedZoneIds' && e.message.includes('zone-ghost'))).toBe(true);
    });
  });

  describe('Stronghold (rule 89)', () => {
    it('accepts a well-formed stronghold with a real garrison', () => {
      const p = withTown({ strongholds: [stronghold('s-keep', { garrisonEntityIds: ['npc-keeper'] })] });
      expect(townErrors(p)).toEqual([]);
      expect(validateProject(p).valid).toBe(true);
    });

    it('rejects duplicate stronghold IDs', () => {
      const r = validateProject(withTown({ strongholds: [stronghold('s-keep'), stronghold('s-keep')] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.message.includes('Duplicate stronghold ID'))).toBe(true);
    });

    it('rejects a stronghold in a nonexistent zone', () => {
      const r = validateProject(withTown({ strongholds: [stronghold('s-keep', { zoneId: 'zone-ghost' })] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === 'strongholds.s-keep.zoneId')).toBe(true);
    });

    it('rejects a garrison entity that is not placed anywhere', () => {
      const r = validateProject(withTown({ strongholds: [stronghold('s-keep', { garrisonEntityIds: ['npc-phantom'] })] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === 'strongholds.s-keep.garrisonEntityIds' && e.message.includes('npc-phantom'))).toBe(true);
    });

    it.each([
      ['NaN', NaN],
      ['Infinity', Infinity],
      ['negative', -1],
    ])('rejects a %s defenseLevel', (_label, defenseLevel) => {
      const r = validateProject(withTown({ strongholds: [stronghold('s-keep', { defenseLevel })] }));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === 'strongholds.s-keep.defenseLevel')).toBe(true);
    });

    it('accepts defenseLevel 0 (control — the boundary must not be misflagged as falsy)', () => {
      expect(townErrors(withTown({ strongholds: [stronghold('s-ruin', { defenseLevel: 0 })] }))).toEqual([]);
    });

    it('does NOT flag a factionId with no district presence (control — deliberate non-check)', () => {
      // There is no faction registry in the schema; factions exist only as
      // FactionPresence.factionId scoped to districts. A stronghold held by a
      // faction with no district presence is legitimately authorable.
      expect(townErrors(withTown({ strongholds: [stronghold('s-keep', { factionId: 'faction-with-no-presence' })] }))).toEqual([]);
    });
  });

  describe('structural guards (present-but-not-an-array)', () => {
    it.each(['buildings', 'hubs', 'strongholds'] as const)('rejects %s corrupted to a non-array', (field) => {
      const r = validateProject(withTown({ [field]: 'not-an-array' } as unknown as Partial<WorldProject>));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === field && e.message.includes('to be an array'))).toBe(true);
    });

    it('rejects a town array corrupted to null', () => {
      const r = validateProject(withTown({ hubs: null } as unknown as Partial<WorldProject>));
      expect(r.valid).toBe(false);
      expect(r.errors.some((e) => e.path === 'hubs' && e.message.includes('null'))).toBe(true);
    });
  });
});
