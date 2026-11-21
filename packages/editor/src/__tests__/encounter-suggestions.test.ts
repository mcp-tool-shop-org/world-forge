import { describe, it, expect } from 'vitest';
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { getModeProfile } from '../mode-profiles.js';
import { AUTHORING_MODES } from '@world-forge/schema';
import { AI_RPG_ENCOUNTER_ANCHOR_TYPES } from '@world-forge/export-ai-rpg';
import { EncounterTypeInput } from '../panels/EncounterProperties.js';

describe('encounter type suggestions', () => {
  it('dungeon suggestions include ambush', () => {
    expect(getModeProfile('dungeon').encounterTypes).toContain('ambush');
  });

  it('ocean suggestions include pirate', () => {
    expect(getModeProfile('ocean').encounterTypes).toContain('pirate');
  });

  it('space suggestions include anomaly', () => {
    expect(getModeProfile('space').encounterTypes).toContain('anomaly');
  });

  it('all modes have non-empty encounter type arrays', () => {
    for (const mode of AUTHORING_MODES) {
      expect(getModeProfile(mode).encounterTypes.length).toBeGreaterThan(0);
    }
  });

  it('E2: every mode lists AI RPG Engine types (patrol first, then remaining engine types) before mode-specific types', () => {
    const engineSet = new Set<string>(AI_RPG_ENCOUNTER_ANCHOR_TYPES);
    for (const mode of AUTHORING_MODES) {
      const types = getModeProfile(mode).encounterTypes;
      expect(types[0]).toBe('patrol');
      expect(new Set(types.slice(0, 4))).toEqual(engineSet);
      for (const extra of types.slice(4)) {
        expect(engineSet.has(extra)).toBe(false);
      }
    }
  });
});

describe('E2: EncounterProperties free-text compatibility label', () => {
  it('marks types outside the four engine types as "not loadable by AI RPG Engine"', () => {
    const html = renderToStaticMarkup(
      createElement(EncounterTypeInput, {
        encounterType: 'pirate',
        suggestions: getModeProfile('ocean').encounterTypes,
        onChange: () => {},
      }),
    );
    expect(html).toContain('value="pirate"');
    expect(html).toContain('>not loadable by AI RPG Engine</span>');
    expect(html).toContain('label="not loadable by AI RPG Engine"');
  });

  it('does not show the warning span when an engine-loadable encounterType is selected', () => {
    const html = renderToStaticMarkup(
      createElement(EncounterTypeInput, {
        encounterType: 'patrol',
        suggestions: getModeProfile('dungeon').encounterTypes,
        onChange: () => {},
      }),
    );
    expect(html).toContain('value="patrol"');
    expect(html).not.toContain('>not loadable by AI RPG Engine</span>');
  });
});
