import type { WorldProject } from '@world-forge/schema';
import { minimalProject } from '../../../../schema/src/__tests__/fixtures/minimal.js';
import { chapelExportableProject } from '../../../../schema/src/__tests__/fixtures/chapel-exportable.js';

/** Minimal fixture clone whose encounter types and dialogue speakers satisfy the AI RPG Engine contract. */
export const engineMinimalProject: WorldProject = {
  ...minimalProject,
  encounterAnchors: minimalProject.encounterAnchors.map((a) => ({
    ...a,
    encounterType: a.encounterType === 'undead' ? 'ambush' : a.encounterType,
  })),
  dialogues: minimalProject.dialogues.map((d) => ({
    ...d,
    speakers: d.speakers.map((s) => (s === 'keeper' ? 'npc-keeper' : s)),
  })),
};

/** Shared exportable chapel fixture whose encounter types and dialogue speakers satisfy the AI RPG Engine contract. */
export const engineChapelProject: WorldProject = chapelExportableProject;
