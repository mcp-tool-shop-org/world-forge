// validate-kit.ts — StarterKit validation with errors + warnings

import type { StarterKit } from './types.js';
import { isValidMode, validateProject } from '@world-forge/schema';
import { BUILTIN_REGION_PRESETS, BUILTIN_ENCOUNTER_PRESETS } from '../presets/built-ins.js';

export interface KitValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

const regionPresetIds = new Set(BUILTIN_REGION_PRESETS.map((p) => p.id));
const encounterPresetIds = new Set(BUILTIN_ENCOUNTER_PRESETS.map((p) => p.id));

export function validateKit(kit: StarterKit): KitValidationResult {
  const errors: string[] = [];
  const warnings: string[] = [];

  // --- Errors (block) ---

  if (!kit.name.trim()) {
    errors.push('Kit name is required');
  }

  if (!kit.modes || kit.modes.length === 0) {
    errors.push('At least one mode is required');
  } else {
    for (const m of kit.modes) {
      if (!isValidMode(m)) {
        errors.push(`Invalid mode: ${m}`);
      }
    }
  }

  // Validate the embedded project
  const projectResult = validateProject(kit.project);
  if (!projectResult.valid) {
    for (const err of projectResult.errors) {
      errors.push(`Project: ${err.message}`);
    }
  }

  // --- Warnings (non-blocking) ---

  for (const refId of kit.presetRefs.region) {
    if (!regionPresetIds.has(refId)) {
      warnings.push(`Region preset ref not found: ${refId}`);
    }
  }

  for (const refId of kit.presetRefs.encounter) {
    if (!encounterPresetIds.has(refId)) {
      warnings.push(`Encounter preset ref not found: ${refId}`);
    }
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
  };
}
