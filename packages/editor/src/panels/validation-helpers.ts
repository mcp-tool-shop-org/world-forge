// validation-helpers.ts — shared classification for ValidationPanel and ExportModal

import type { ValidationError } from '@world-forge/schema';
import type { DepDomain } from '@world-forge/schema';
import type { BuildsSubTab } from '../store/editor-store.js';

export type Domain = 'world' | 'entities' | 'items' | 'dialogue' | 'player' | 'builds' | 'progression' | 'assets' | 'packs' | 'deps';

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
  return 'world';
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
