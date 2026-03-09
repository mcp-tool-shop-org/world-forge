import { describe, it, expect } from 'vitest';
import { detectImportFormat } from '@world-forge/export-ai-rpg';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import { serializeProject, prepareProjectImport } from '../projects/index.js';
import { useEditorStore } from '../store/editor-store.js';

const helloWorld = SAMPLE_WORLDS[0].project;
const chapel = SAMPLE_WORLDS[2].project;

describe('detectImportFormat', () => {
  it('returns "project-bundle" for valid ProjectBundle', () => {
    const bundle = serializeProject(helloWorld);
    expect(detectImportFormat(bundle)).toBe('project-bundle');
  });

  it('returns "world-project" for raw WorldProject', () => {
    expect(detectImportFormat(helloWorld)).toBe('world-project');
  });

  it('returns "export-result" for ExportResult shape', () => {
    const exportResult = {
      contentPack: { entities: [], zones: [] },
      manifest: { id: 'test' },
      packMeta: {},
    };
    expect(detectImportFormat(exportResult)).toBe('export-result');
  });

  it('does not confuse bundle with WorldProject', () => {
    const bundle = serializeProject(chapel);
    // Bundle has a project field that contains map/entityPlacements/zones
    // but should still be detected as project-bundle, not world-project
    expect(detectImportFormat(bundle)).toBe('project-bundle');
  });
});

describe('prepareProjectImport', () => {
  it('returns isValid: true for Hello World bundle', () => {
    const bundle = serializeProject(helloWorld);
    const result = prepareProjectImport(bundle);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isValid).toBe(true);
  });

  it('returns isValid: true for Chapel Threshold bundle', () => {
    const bundle = serializeProject(chapel);
    const result = prepareProjectImport(bundle);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.isValid).toBe(true);
  });

  it('returns parse error for wrong bundleVersion', () => {
    const result = prepareProjectImport({ bundleVersion: 999, name: 'test', project: helloWorld });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('999');
  });
});

describe('editor store projectBundleSource', () => {
  it('defaults to null', () => {
    useEditorStore.setState({ projectBundleSource: null });
    expect(useEditorStore.getState().projectBundleSource).toBeNull();
  });

  it('setProjectBundleSource updates state', () => {
    useEditorStore.getState().setProjectBundleSource('imported');
    expect(useEditorStore.getState().projectBundleSource).toBe('imported');
  });

  it('setProjectBundleSource(null) clears state', () => {
    useEditorStore.getState().setProjectBundleSource('imported');
    useEditorStore.getState().setProjectBundleSource(null);
    expect(useEditorStore.getState().projectBundleSource).toBeNull();
  });

  it('resetChecklist clears projectBundleSource', () => {
    useEditorStore.getState().setProjectBundleSource('imported');
    useEditorStore.getState().resetChecklist();
    expect(useEditorStore.getState().projectBundleSource).toBeNull();
  });
});
