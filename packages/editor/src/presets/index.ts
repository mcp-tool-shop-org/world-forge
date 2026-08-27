// presets/index.ts — barrel export

export type { RegionPreset, EncounterPreset } from './types.js';
export { BUILTIN_REGION_PRESETS, BUILTIN_ENCOUNTER_PRESETS } from './built-ins.js';
export { usePresetStore, StoragePersistError } from './preset-store.js';
