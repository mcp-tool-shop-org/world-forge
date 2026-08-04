// validation-helpers.ts — shared classification for ValidationPanel and ExportModal

import type { ValidationError } from '@world-forge/schema';
import type { DepDomain } from '@world-forge/schema';
import type { BuildsSubTab, RightTab } from '../store/editor-store.js';

// EUB-006: domainOrder in ValidationPanel.tsx must stay exhaustive — when
// adding a new Domain variant here, add a corresponding entry there too
// (domainLabels and domainOrder) and to the `grouped` initializer.
export type Domain = 'world' | 'entities' | 'items' | 'dialogue' | 'player' | 'builds' | 'progression' | 'assets' | 'packs' | 'deps' | 'strata' | 'hazards';

// F-001: classifyError only recognized a fixed prefix list and fell back to
// 'world' for everything else — including the schema's own strata.*,
// stratumLinks.*, and hazardDefinitions.* error paths. Clicking a strata or
// hazard error always fell through to the generic fallback, which (see
// navigationForError below) didn't clear a selected zone either, so
// StrataPanel/HazardLibraryPanel (which only render when no zone is
// selected) stayed hidden and the click did nothing visible.
export function classifyError(err: ValidationError): Domain {
  const p = err.path;
  if (p.startsWith('assetPacks')) return 'packs';
  if (p.startsWith('assets')) return 'assets';
  if (p.startsWith('entityPlacements')) return 'entities';
  if (p.startsWith('itemPlacements')) return 'items';
  if (p.startsWith('dialogues')) return 'dialogue';
  if (p.startsWith('playerTemplate')) return 'player';
  if (p.startsWith('buildCatalog')) return 'builds';
  if (p.startsWith('progressionTrees')) return 'progression';
  if (p.startsWith('strata') || p.startsWith('stratumLinks')) return 'strata';
  if (p.startsWith('hazardDefinitions')) return 'hazards';
  return 'world';
}

export interface ErrorNavigation {
  tab: RightTab;
  buildsSubTab?: BuildsSubTab;
  /** Zone id to select, when this error is scoped to a single zone. */
  selectZoneId?: string;
  /** True when the target is a project-level (not per-zone) panel — the
   *  caller must clear any currently-selected zone, otherwise ZoneProperties
   *  (which renders instead of the project-level panels whenever a zone is
   *  selected) stays on screen and the navigation does nothing visible. */
  clearZone?: boolean;
}

/** Single source of truth for "where should the UI navigate to focus this
 *  validation error" — previously duplicated independently in
 *  ValidationPanel.tsx's handleClick and ExportModal.tsx's
 *  handleGoToFirstIssue (three copies total, counting this one), all with
 *  the same strata/hazard gap (F-001). Both call sites now call this
 *  directly instead of maintaining their own copy of the prefix cascade. */
export function navigationForError(err: ValidationError): ErrorNavigation {
  const p = err.path;

  const zoneMatch = p.match(/^zones\.([^.]+)/);
  if (zoneMatch) return { tab: 'map', selectZoneId: zoneMatch[1] };

  if (
    p.startsWith('entityPlacements') || p.startsWith('itemPlacements') ||
    p.startsWith('spawnPoints') || p.startsWith('connections') || p.startsWith('landmarks')
  ) {
    return { tab: 'map' };
  }
  if (p.startsWith('playerTemplate')) return { tab: 'player' };
  if (p.startsWith('buildCatalog')) return { tab: 'builds', buildsSubTab: buildsSubTabFor(p) };
  if (p.startsWith('progressionTrees')) return { tab: 'trees' };
  if (p.startsWith('dialogues')) return { tab: 'dialogue' };
  if (p.startsWith('assetPacks') || p.startsWith('assets')) return { tab: 'assets' };

  // strata / stratumLinks / hazardDefinitions errors, and the generic
  // fallback, both target project-level panels in the map tab that only
  // render when no single zone is selected — clearing the zone selection is
  // what makes the navigation actually visible (this was the other half of
  // F-001: the old fallback branch never cleared it).
  return { tab: 'map', clearZone: true };
}

export function buildsSubTabFor(path: string): BuildsSubTab {
  if (path.includes('.archetypes')) return 'archetypes';
  if (path.includes('.backgrounds')) return 'backgrounds';
  if (path.includes('.traits')) return 'traits';
  if (path.includes('.disciplines')) return 'disciplines';
  if (path.includes('.crossTitles') || path.includes('.entanglements')) return 'combos';
  return 'config';
}

/** Fields that represent cross-entity references scannable by the dependency manager. */
const REF_FIELDS = [
  'backgroundId', 'tilesetId', 'portraitId', 'spriteId', 'iconId',
  'packId', 'fromZoneId', 'toZoneId', 'zoneId', 'dialogueId',
];

/** Returns true if the validation error is about a broken or mismatched reference
 *  that the Dependency Manager can repair. */
export function isRefError(err: ValidationError): boolean {
  return REF_FIELDS.some((f) => err.path.endsWith(f));
}

/** Maps a DepDomain to the closest validation Domain. */
export function classifyDependencyDomain(depDomain: DepDomain): Domain {
  switch (depDomain) {
    case 'zone-asset': return 'world';
    case 'entity-asset': return 'entities';
    case 'item-asset': return 'items';
    case 'landmark-asset': return 'world';
    case 'asset-pack': return 'packs';
    case 'zone-ref': return 'world';
    case 'dialogue-ref': return 'dialogue';
    case 'orphan-asset': return 'assets';
    case 'orphan-pack': return 'packs';
    case 'kit-provenance': return 'deps';
    default: return 'world';
  }
}
