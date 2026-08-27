// validation-navigation.test.ts — F-001: the "jump to error" navigation from
// Validation/Export is a dead end for strata and hazard errors. classifyError
// only recognized a fixed prefix list and fell back to 'world' for everything
// else — including strata.*, stratumLinks.*, and hazardDefinitions.* — and the
// exact same prefix list (with the exact same gap) was independently
// duplicated in ValidationPanel.tsx's handleClick and ExportModal.tsx's
// handleGoToFirstIssue. This tests the single shared classifier +
// navigation helper that replaces all three copies.

import { describe, it, expect } from 'vitest';
import type { ValidationError } from '@world-forge/schema';
import { classifyError, navigationForError } from '../validation-helpers.js';

function err(path: string): ValidationError {
  return { path, message: `bad path ${path}` } as ValidationError;
}

describe('classifyError — strata/hazard domains (F-001)', () => {
  it('classifies strata.* paths as the strata domain, not the generic world fallback', () => {
    expect(classifyError(err('strata.0.order'))).toBe('strata');
  });

  it('classifies stratumLinks.* paths as the strata domain', () => {
    expect(classifyError(err('stratumLinks.0.fromStratumId'))).toBe('strata');
  });

  it('classifies hazardDefinitions.* paths as the hazards domain', () => {
    expect(classifyError(err('hazardDefinitions.0.effects.0.chance'))).toBe('hazards');
  });

  it('leaves previously-classified domains unchanged', () => {
    expect(classifyError(err('assets.0.id'))).toBe('assets');
    expect(classifyError(err('dialogues.0.entryNodeId'))).toBe('dialogue');
    expect(classifyError(err('zones.z1.name'))).toBe('world'); // zones has no dedicated Domain bucket
  });
});

describe('navigationForError (F-001)', () => {
  it('routes strata errors to the map tab and clears any selected zone', () => {
    const nav = navigationForError(err('strata.0.order'));
    expect(nav.tab).toBe('map');
    expect(nav.clearZone).toBe(true);
    expect(nav.selectZoneId).toBeUndefined();
  });

  it('routes hazardDefinitions errors to the map tab and clears any selected zone', () => {
    const nav = navigationForError(err('hazardDefinitions.0.name'));
    expect(nav.tab).toBe('map');
    expect(nav.clearZone).toBe(true);
  });

  it('routes zone-scoped errors to the map tab and selects the zone (does not clear)', () => {
    const nav = navigationForError(err('zones.chapel-1.name'));
    expect(nav.tab).toBe('map');
    expect(nav.selectZoneId).toBe('chapel-1');
    expect(nav.clearZone).toBeUndefined();
  });

  it('routes buildCatalog errors to the builds tab with the right sub-tab', () => {
    const nav = navigationForError(err('buildCatalog.archetypes.0.name'));
    expect(nav.tab).toBe('builds');
    expect(nav.buildsSubTab).toBe('archetypes');
  });

  it('the generic fallback also clears any selected zone (this was the other half of F-001: the fallback never cleared it, so a selected zone hid the project-level panel entirely)', () => {
    const nav = navigationForError(err('someTotallyUnknownField.0.x'));
    expect(nav.tab).toBe('map');
    expect(nav.clearZone).toBe(true);
  });

  it('routes landmarks errors to the map tab (parity fix: ExportModal previously omitted landmarks from its own copy of this list)', () => {
    const nav = navigationForError(err('landmarks.lm1.assetRef'));
    expect(nav.tab).toBe('map');
  });
});

describe('F-ac5cee50: town structures / loot / transitions', () => {
  it('classifies buildings/hubs/strongholds as town, not world', () => {
    expect(classifyError(err('buildings.b1.zoneId'))).toBe('town');
    expect(classifyError(err('hubs.h1.zoneId'))).toBe('town');
    expect(classifyError(err('strongholds.s1.defenseLevel'))).toBe('town');
  });

  it('classifies lootTables and transitions as their own domains', () => {
    expect(classifyError(err('lootTables.lt1.entries'))).toBe('loot');
    expect(classifyError(err('transitions.t1.zoneId'))).toBe('transitions');
  });

  it('does not clearZone for town-structure errors and selects the owning zone', () => {
    const lookup = {
      buildings: [{ id: 'b1', zoneId: 'town-square' }],
      hubs: [{ id: 'h1', zoneId: 'market' }],
      strongholds: [{ id: 's1', zoneId: 'keep' }],
    };
    const buildingNav = navigationForError(err('buildings.b1.interiorZoneId'), lookup);
    expect(buildingNav.tab).toBe('map');
    expect(buildingNav.clearZone).toBeUndefined();
    expect(buildingNav.selectZoneId).toBe('town-square');

    const hubNav = navigationForError(err('hubs.h1.zoneId'), lookup);
    expect(hubNav.selectZoneId).toBe('market');
    expect(hubNav.clearZone).toBeUndefined();
  });

  it('stays on map without clearZone when the lookup has no zone', () => {
    const nav = navigationForError(err('buildings.unknown.zoneId'));
    expect(nav.tab).toBe('map');
    expect(nav.clearZone).toBeUndefined();
    expect(nav.selectZoneId).toBeUndefined();
  });
});
