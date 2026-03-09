import { describe, it, expect } from 'vitest';
import { validateKit } from '../kits/index.js';
import { BUILTIN_KITS } from '../kits/index.js';
import type { StarterKit } from '../kits/index.js';

const validCustomKit: StarterKit = {
  ...BUILTIN_KITS[0],
  id: 'custom-valid',
  name: 'Valid Kit',
  builtIn: false,
};

describe('validateKit', () => {
  it('all 7 BUILTIN_KITS pass validation', () => {
    for (const kit of BUILTIN_KITS) {
      const result = validateKit(kit);
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    }
  });

  it('empty name → error', () => {
    const kit: StarterKit = { ...validCustomKit, name: '' };
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Kit name is required');
  });

  it('whitespace-only name → error', () => {
    const kit: StarterKit = { ...validCustomKit, name: '   ' };
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Kit name is required');
  });

  it('empty modes → error', () => {
    const kit: StarterKit = { ...validCustomKit, modes: [] };
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('At least one mode is required');
  });

  it('invalid mode → error', () => {
    const kit: StarterKit = { ...validCustomKit, modes: ['invalid-mode' as any] };
    const result = validateKit(kit);
    expect(result.valid).toBe(false);
    expect(result.errors.some((e) => e.includes('Invalid mode'))).toBe(true);
  });

  it('valid kit with empty preset refs → passes', () => {
    const kit: StarterKit = {
      ...validCustomKit,
      presetRefs: { region: [], encounter: [] },
    };
    const result = validateKit(kit);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('missing region preset ref → warning', () => {
    const kit: StarterKit = {
      ...validCustomKit,
      presetRefs: { region: ['nonexistent-region'], encounter: [] },
    };
    const result = validateKit(kit);
    expect(result.valid).toBe(true); // warnings don't block
    expect(result.warnings.some((w) => w.includes('Region preset ref not found'))).toBe(true);
  });

  it('missing encounter preset ref → warning', () => {
    const kit: StarterKit = {
      ...validCustomKit,
      presetRefs: { region: [], encounter: ['nonexistent-encounter'] },
    };
    const result = validateKit(kit);
    expect(result.valid).toBe(true);
    expect(result.warnings.some((w) => w.includes('Encounter preset ref not found'))).toBe(true);
  });

  it('present preset ref → no warning', () => {
    const kit: StarterKit = {
      ...validCustomKit,
      presetRefs: { region: ['crypt-district'], encounter: ['dungeon-ambush'] },
    };
    const result = validateKit(kit);
    expect(result.valid).toBe(true);
    expect(result.warnings).toEqual([]);
  });

  it('valid kit with all refs present → no warnings', () => {
    // Use the dungeon starter which has real preset refs
    const result = validateKit(BUILTIN_KITS[0]);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
    expect(result.warnings).toEqual([]);
  });
});
