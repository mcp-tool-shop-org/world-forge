// swarm-wave18-amends.test.ts — Stage-C HUMANIZATION amend (wave 18) for export-ai-rpg.
//
// One describe block per approved finding. See
// E:\AI\testing-os\swarms\swarm-1787820671-c76a\wave-18\export-engine.md for
// the full finding text this wave fixes. CLI-side assertions live in cli.test.ts.

import { describe, it, expect, vi, afterEach } from 'vitest';
import { exportToEngine } from '../export.js';
import { convertZones } from '../convert-zones.js';
import { convertEntities } from '../convert-entities.js';
import type { FidelityEntry } from '../fidelity.js';
import type { WorldProject } from '@world-forge/schema';
import { minimalProject } from '../../../schema/src/__tests__/fixtures/minimal.js';

// --- F-b372b7e0: zone interactables name-only collapse reports type/description drops ---

describe('F-b372b7e0: convertZones reports interactable type/description collapse', () => {
  it('type: use + description populate warnings and fidelity while keeping name-only wire', () => {
    const project: WorldProject = {
      ...minimalProject,
      zones: [
        {
          ...minimalProject.zones[0],
          interactables: [
            { name: 'rusty lever', type: 'use', description: 'A rusted iron lever.' },
          ],
        },
        minimalProject.zones[1],
      ],
    };
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    const zones = convertZones(project, warnings, fidelity);

    expect(zones[0].interactables).toEqual(['rusty lever']);
    const msg = warnings.find((w) => w.includes('rusty lever'));
    expect(msg).toBeDefined();
    expect(msg!).toContain('zone-entrance');
    expect(msg!).toMatch(/type 'use'/);
    expect(msg!).toContain('description');
    const entry = fidelity.find((f) => f.reason === 'interactable-collapsed-to-name');
    expect(entry).toBeDefined();
    expect(entry!.domain).toBe('zones');
    expect(entry!.level).toBe('approximated');
    expect(entry!.entityId).toBe('zone-entrance');
    expect(entry!.fieldPath).toBe('interactables.rusty lever');
  });

  it('inspect-only interactables (import-recoverable) do not warn', () => {
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    convertZones(minimalProject, warnings, fidelity);
    expect(warnings.some((w) => w.includes('interactable-collapsed') || w.includes('collapsed to a name'))).toBe(false);
    expect(fidelity.some((f) => f.reason === 'interactable-collapsed-to-name')).toBe(false);
  });

  it('exportToEngine surfaces the collapse on result.warnings + fidelity', () => {
    const project: WorldProject = {
      ...minimalProject,
      zones: [
        {
          ...minimalProject.zones[0],
          interactables: [
            { name: 'iron-gate', type: 'use', description: 'Wrought iron, stuck.' },
          ],
        },
        minimalProject.zones[1],
      ],
    };
    const result = exportToEngine(project);
    if (!result.success) throw new Error('export failed');
    expect(result.contentPack.zones[0].interactables).toEqual(['iron-gate']);
    expect(result.warnings.some((w) => w.includes('iron-gate') && w.includes("type 'use'"))).toBe(true);
    expect(result.fidelity.entries.some((f) => f.reason === 'interactable-collapsed-to-name')).toBe(true);
  });
});

// --- F-cd05e76f: custom-field drops go on warnings, not only console.warn ---

describe('F-cd05e76f: convertEntities circular custom field is on warnings', () => {
  afterEach(() => { vi.restoreAllMocks(); });

  function projectWithCircularCustom(): WorldProject {
    const circular: Record<string, unknown> = {};
    circular.self = circular;
    return {
      ...minimalProject,
      entityPlacements: [{
        entityId: 'npc-keeper',
        zoneId: 'zone-entrance',
        role: 'npc',
        name: 'Keeper',
        custom: { ok: 'value', broken: circular } as unknown as Record<string, string>,
      }],
    };
  }

  it('pushes the drop onto warnings AND fidelity (not only console.warn)', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const warnings: string[] = [];
    const fidelity: FidelityEntry[] = [];
    convertEntities(projectWithCircularCustom(), fidelity, warnings);
    expect(warnings.some((w) => w.includes('custom field') && w.includes('non-JSON-serializable'))).toBe(true);
    expect(fidelity.some((f) => f.reason === 'custom-field-not-json-serializable')).toBe(true);
  });

  it('exportToEngine.warnings (the CLI Warnings: channel) contains the loss', () => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    const result = exportToEngine(projectWithCircularCustom());
    if (!result.success) throw new Error('export failed');
    expect(result.warnings.some((w) => w.includes('custom field') && w.includes('broken'))).toBe(true);
    expect(result.fidelity.entries.some((f) => f.reason === 'custom-field-not-json-serializable')).toBe(true);
  });
});
