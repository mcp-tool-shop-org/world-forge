import type { WorldProject } from '@world-forge/schema';
import { minimalProject } from '../../../../schema/src/__tests__/fixtures/minimal.js';
import { chapelProject } from '../../../../schema/src/__tests__/fixtures/chapel-authored.js';

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

/** Chapel fixture clone whose encounter types and dialogue speakers satisfy the AI RPG Engine contract. */
export const engineChapelProject: WorldProject = {
  ...chapelProject,
  encounterAnchors: chapelProject.encounterAnchors.map((a) => ({
    ...a,
    encounterType: a.encounterType === 'combat' ? 'boss' : a.encounterType,
  })),
};
