// validation-helpers.ts — shared classification for ValidationPanel and ExportModal

import type { ValidationError } from '@world-forge/schema';
import type { BuildsSubTab } from '../store/editor-store.js';

export type Domain = 'world' | 'entities' | 'items' | 'dialogue' | 'player' | 'builds' | 'progression' | 'assets' | 'packs';

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
