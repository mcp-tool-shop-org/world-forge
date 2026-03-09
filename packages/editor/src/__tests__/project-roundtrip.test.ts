import { describe, it, expect } from 'vitest';
import { SAMPLE_WORLDS } from '../templates/samples.js';
import {
  serializeProject,
  prepareProjectImport,
  extractDependencies,
} from '../projects/index.js';

describe('project bundle round-trip', () => {
  describe.each(SAMPLE_WORLDS.map((s) => [s.name, s.project] as const))(
    '%s',
    (_name, project) => {
      it('serialize → prepareProjectImport → isValid: true', () => {
        const bundle = serializeProject(project);
        const result = prepareProjectImport(bundle);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.isValid).toBe(true);
      });

      it('preserves zone count and names', () => {
        const bundle = serializeProject(project);
        const result = prepareProjectImport(bundle);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.project.zones.length).toBe(project.zones.length);
        expect(result.project.zones.map((z) => z.name).sort()).toEqual(
          project.zones.map((z) => z.name).sort(),
        );
      });

      it('preserves connection count', () => {
        const bundle = serializeProject(project);
        const result = prepareProjectImport(bundle);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.project.connections.length).toBe(project.connections.length);
      });

      it('preserves entity and item placement counts', () => {
        const bundle = serializeProject(project);
        const result = prepareProjectImport(bundle);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.project.entityPlacements.length).toBe(project.entityPlacements.length);
        expect(result.project.itemPlacements.length).toBe(project.itemPlacements.length);
      });

      it('preserves assets and asset packs', () => {
        const bundle = serializeProject(project);
        const result = prepareProjectImport(bundle);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.project.assets.length).toBe(project.assets.length);
        expect(result.project.assetPacks.length).toBe(project.assetPacks.length);
      });

      it('preserves mode field', () => {
        const bundle = serializeProject(project);
        const result = prepareProjectImport(bundle);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        expect(result.project.mode).toBe(project.mode);
      });

      it('preserves optional systems', () => {
        const bundle = serializeProject(project);
        const result = prepareProjectImport(bundle);
        expect(result.ok).toBe(true);
        if (!result.ok) return;
        // playerTemplate presence
        if (project.playerTemplate) {
          expect(result.project.playerTemplate).toBeDefined();
        } else {
          expect(result.project.playerTemplate).toBeUndefined();
        }
        // buildCatalog presence
        if (project.buildCatalog) {
          expect(result.project.buildCatalog).toBeDefined();
        } else {
          expect(result.project.buildCatalog).toBeUndefined();
        }
        // progressionTrees count
        expect(result.project.progressionTrees.length).toBe(project.progressionTrees.length);
        // dialogues count
        expect(result.project.dialogues.length).toBe(project.dialogues.length);
      });
    },
  );

  it('serialize with activeKit → dependencies.kitName matches', () => {
    const project = SAMPLE_WORLDS[0].project;
    const bundle = serializeProject(project, { name: 'Forgotten Vault', source: 'built-in' });
    const result = prepareProjectImport(bundle);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    const deps = extractDependencies(result.bundle);
    expect(deps.kitRef).toBeDefined();
    expect(deps.kitRef!.name).toBe('Forgotten Vault');
    expect(deps.kitRef!.source).toBe('built-in');
  });

  it('JSON serialization round-trip preserves all data', () => {
    const project = SAMPLE_WORLDS[2].project; // Chapel Threshold (richest)
    const bundle = serializeProject(project);
    const json = JSON.parse(JSON.stringify(bundle));
    const result = prepareProjectImport(json);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.project.zones.length).toBe(project.zones.length);
    expect(result.project.entityPlacements.length).toBe(project.entityPlacements.length);
    expect(result.project.dialogues.length).toBe(project.dialogues.length);
    expect(result.project.connections.length).toBe(project.connections.length);
  });
});
