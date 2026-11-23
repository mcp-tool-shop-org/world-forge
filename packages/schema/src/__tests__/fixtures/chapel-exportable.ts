// chapel-exportable.ts — AI RPG exportable variant of the authored Chapel Threshold fixture.

import type { WorldProject } from '../../project.js';
import { chapelProject } from './chapel-authored.js';

/** Chapel fixture clone whose encounter types satisfy the AI RPG Engine contract (`combat` -> `boss`). */
export const chapelExportableProject: WorldProject = {
  ...chapelProject,
  encounterAnchors: chapelProject.encounterAnchors.map((a) => ({
    ...a,
    encounterType: a.encounterType === 'combat' ? 'boss' : a.encounterType,
  })),
};
