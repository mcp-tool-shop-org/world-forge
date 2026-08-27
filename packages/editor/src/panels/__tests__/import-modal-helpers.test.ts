// import-modal-helpers.test.ts — F-f6081e61 / class-fix F-024cb3eb
//
// ImportModal is a React component (no jsdom). The production gate lives in
// applyBundleImport / canConfirmImport, which ImportModal.tsx actually calls.

import { describe, it, expect, vi } from 'vitest';
import { createEmptyProject } from '../../store/project-store.js';
import type { ImportProjectResult } from '../../projects/index.js';
import { applyBundleImport, canConfirmImport, distinctBundleWarnings, jsonFileParseError, safeExtractDependencies } from '../import-modal-helpers.js';

function bundle(overrides: Partial<ImportProjectResult> = {}): ImportProjectResult {
  const project = createEmptyProject();
  return {
    ok: true,
    project,
    bundle: {
      bundleVersion: 1,
      exportedAt: '2026-01-01T00:00:00.000Z',
      name: 'test',
      description: '',
      version: '0.1.0',
      genre: 'fantasy',
      project,
      summary: {
        zones: 0, entities: 0, items: 0, dialogues: 0, districts: 0,
        spawns: 0, connections: 0, encounters: 0, assets: 0, assetPacks: 0,
      },
      dependencies: { assetPackIds: [] },
    },
    parseWarnings: [],
    validationWarnings: [],
    validationErrors: [],
    isValid: true,
    ...overrides,
  };
}

describe('ImportModal refuses isValid:false (F-f6081e61)', () => {
  it('does not call loadProject when the bundle is schema-invalid', () => {
    const loadProject = vi.fn();
    const applied = applyBundleImport(
      bundle({
        isValid: false,
        validationErrors: ['zones: at least one zone is required'],
        validationWarnings: ['zones: at least one zone is required'],
      }),
      loadProject,
    );
    expect(applied).toBe(false);
    expect(loadProject).not.toHaveBeenCalled();
  });

  it('disables Import when bundleResult.isValid is false', () => {
    expect(canConfirmImport({
      result: null,
      bundleResult: { isValid: false },
    })).toBe(false);
  });

  it('calls loadProject when the bundle is valid', () => {
    const loadProject = vi.fn();
    const valid = bundle({ isValid: true });
    const applied = applyBundleImport(valid, loadProject);
    expect(applied).toBe(true);
    expect(loadProject).toHaveBeenCalledWith(valid.project);
  });

  it('keeps parse warnings separate from validation errors', () => {
    const lists = distinctBundleWarnings(bundle({
      isValid: false,
      parseWarnings: ['Missing genre'],
      validationErrors: ['zones: at least one zone is required'],
      validationWarnings: ['zones: at least one zone is required', 'advisory: unused tag'],
    }));
    expect(lists.parseWarnings).toEqual(['Missing genre']);
    expect(lists.validationWarnings).toEqual(['advisory: unused tag']);
  });
});

describe('F-67ac3bf9: safeExtractDependencies never throws', () => {
  it('returns null when extractDependencies throws (truncated assetPacks)', () => {
    const throwing = () => {
      throw new TypeError("Cannot read properties of undefined (reading 'map')");
    };
    expect(safeExtractDependencies(throwing as never, bundle().bundle)).toBeNull();
  });

  it('returns empty assetPacks when the report is missing the array', () => {
    const deps = safeExtractDependencies(
      () => ({ kitRef: { name: 'Kit' } }) as never,
      bundle().bundle,
    );
    expect(deps).toEqual({ kitRef: { name: 'Kit' }, assetPacks: [] });
  });
});

describe('jsonFileParseError (F-f70ae25c)', () => {
  it('surfaces SyntaxError.message with the file name', () => {
    const err = new SyntaxError('Unexpected token } in JSON at position 12');
    expect(jsonFileParseError(err, 'world.wfproject.json')).toBe(
      'world.wfproject.json: Unexpected token } in JSON at position 12',
    );
  });

  it('falls back to Invalid JSON file for non-SyntaxError', () => {
    expect(jsonFileParseError(new Error('boom'), 'kit.wfkit.json')).toBe(
      'kit.wfkit.json: Invalid JSON file',
    );
  });
});
