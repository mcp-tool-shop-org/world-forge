// preset-actions.ts — apply/save region + encounter presets from the current selection.
// F-fabda31a: P / Shift+P used to only switch the right tab.

import type { WorldProject, District, EncounterAnchor } from '@world-forge/schema';
import type { SelectionSet } from './store/editor-store.js';
import { getSelectedZoneId } from './store/editor-store.js';
import type { RegionPreset, EncounterPreset } from './presets/types.js';
import type { AuthoringMode } from '@world-forge/schema';
import { StoragePersistError } from './presets/preset-store.js';

/** Keep presets matching the given mode (or with undefined modes). */
export function filterPresetsByMode<T extends { modes?: AuthoringMode[] }>(
  presets: T[],
  mode: AuthoringMode | undefined,
): T[] {
  if (!mode) return presets;
  return presets.filter((p) => !p.modes || p.modes.includes(mode));
}

export interface PresetApplyStores {
  regionPresets: RegionPreset[];
  encounterPresets: EncounterPreset[];
  applyRegionPreset: (districtId: string, preset: RegionPreset, mode: 'merge' | 'overwrite') => void;
  createEncounterFromPreset: (zoneId: string, preset: EncounterPreset) => string;
  selectEncounter?: (id: string, append: boolean) => void;
}

export interface PresetSaveStores {
  saveRegionPreset: (preset: Omit<RegionPreset, 'id' | 'builtIn'>) => void;
  saveEncounterPreset: (preset: Omit<EncounterPreset, 'id' | 'builtIn'>) => void;
}

export type PresetActionResult = { ok: true; message: string } | { ok: false; message: string };

let lastRegionPresetId: string | null = null;
let lastEncounterPresetId: string | null = null;

export function rememberAppliedRegionPreset(id: string): void {
  lastRegionPresetId = id;
}

export function rememberAppliedEncounterPreset(id: string): void {
  lastEncounterPresetId = id;
}

export function resetPresetMemory(): void {
  lastRegionPresetId = null;
  lastEncounterPresetId = null;
}

export function districtForSelection(project: WorldProject, selection: SelectionSet): District | null {
  const zoneId = getSelectedZoneId(selection);
  if (!zoneId) return null;
  return project.districts.find((d) => d.zoneIds.includes(zoneId)) ?? null;
}

export function encounterForSelection(project: WorldProject, selection: SelectionSet): EncounterAnchor | null {
  if (selection.encounters.length !== 1) return null;
  return project.encounterAnchors.find((e) => e.id === selection.encounters[0]) ?? null;
}

function pickPreset<T extends { id: string }>(list: T[], lastId: string | null): T | null {
  if (list.length === 0) return null;
  if (lastId) {
    const remembered = list.find((p) => p.id === lastId);
    if (remembered) return remembered;
  }
  return list[0];
}

export function applyPresetFromSelection(
  project: WorldProject,
  selection: SelectionSet,
  stores: PresetApplyStores,
): PresetActionResult {
  const district = districtForSelection(project, selection);
  const zoneId = getSelectedZoneId(selection);
  const regionList = filterPresetsByMode(stores.regionPresets, project.mode);
  const encounterList = filterPresetsByMode(stores.encounterPresets, project.mode);

  if (district) {
    const preset = pickPreset(regionList, lastRegionPresetId);
    if (!preset) return { ok: false, message: 'No region preset matches this mode — open Presets to create one.' };
    stores.applyRegionPreset(district.id, preset, 'merge');
    rememberAppliedRegionPreset(preset.id);
    return { ok: true, message: `Applied “${preset.name}” to ${district.name}` };
  }

  if (zoneId) {
    const preset = pickPreset(encounterList, lastEncounterPresetId);
    if (!preset) return { ok: false, message: 'No encounter preset matches this mode — open Presets to create one.' };
    const id = stores.createEncounterFromPreset(zoneId, preset);
    stores.selectEncounter?.(id, false);
    rememberAppliedEncounterPreset(preset.id);
    return { ok: true, message: `Placed “${preset.name}” in the selected zone` };
  }

  return { ok: false, message: 'Select a district zone (region) or a zone (encounter) first.' };
}

export function buildRegionPresetFromDistrict(project: WorldProject, d: District): Omit<RegionPreset, 'id' | 'builtIn'> {
  const factions = project.factionPresences
    .filter((f) => f.districtIds.includes(d.id))
    .map(({ districtIds: _, ...rest }) => rest);
  const hotspots = project.pressureHotspots
    .filter((h) => d.zoneIds.includes(h.zoneId))
    .map(({ id: _id, zoneId: _z, ...rest }) => rest);
  return {
    name: `${d.name} Preset`,
    description: `Saved from ${d.name}`,
    tags: [...d.tags],
    regionTags: [...d.tags],
    controllingFaction: d.controllingFaction,
    baseMetrics: { ...d.baseMetrics },
    economyProfile: { ...d.economyProfile },
    factionPresences: factions,
    pressureHotspots: hotspots,
  };
}

export function buildEncounterPresetFromAnchor(enc: EncounterAnchor): Omit<EncounterPreset, 'id' | 'builtIn'> {
  return {
    name: `${enc.encounterType} Preset`,
    description: `Saved from ${enc.id}`,
    tags: [...enc.tags],
    encounterType: enc.encounterType,
    enemyIds: [...enc.enemyIds],
    probability: enc.probability,
    cooldownTurns: enc.cooldownTurns,
    encounterTags: [...enc.tags],
  };
}

export function savePresetFromSelection(
  project: WorldProject,
  selection: SelectionSet,
  stores: PresetSaveStores,
): PresetActionResult {
  const district = districtForSelection(project, selection);
  const enc = encounterForSelection(project, selection);
  try {
    if (district) {
      stores.saveRegionPreset(buildRegionPresetFromDistrict(project, district));
      return { ok: true, message: `Saved “${district.name}” as a region preset` };
    }
    if (enc) {
      stores.saveEncounterPreset(buildEncounterPresetFromAnchor(enc));
      return { ok: true, message: `Saved “${enc.encounterType}” as an encounter preset` };
    }
  } catch (err) {
    const blocked = err instanceof StoragePersistError;
    return {
      ok: false,
      message: blocked
        ? 'Could not save preset — browser storage is full or blocked.'
        : (err instanceof Error ? err.message : 'Could not save preset.'),
    };
  }
  return { ok: false, message: 'Select a district zone or an encounter first.' };
}
