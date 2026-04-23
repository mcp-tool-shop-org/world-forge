// orphans.ts — ED-B-002: detect and repair orphaned objects whose parent
// reference (zone) has been deleted. Keeps the logic pure + testable so the
// Object List panel can render an "Orphaned" group and offer repair without
// knowing about the rules.
//
// Design note: we do NOT silently clean up orphans on zone delete. That would
// erase the user's work. Instead we surface them as first-class, selectable,
// repairable rows so the user decides whether to move them to a new zone or
// delete them with an undoable action.

import type { WorldProject, EncounterAnchor } from '@world-forge/schema';

/** An encounter whose `zoneId` no longer points to an existing zone. */
export interface OrphanedEncounter {
  encounter: EncounterAnchor;
  /** The missing zone id the encounter still references — shown in the UI hint. */
  missingZoneId: string;
}

/** Pure scan. Returns the orphans in the order they appear in the project. */
export function findOrphanedEncounters(project: WorldProject): OrphanedEncounter[] {
  const zoneIds = new Set(project.zones.map((z) => z.id));
  const out: OrphanedEncounter[] = [];
  for (const enc of project.encounterAnchors) {
    if (!zoneIds.has(enc.zoneId)) {
      out.push({ encounter: enc, missingZoneId: enc.zoneId });
    }
  }
  return out;
}

/** Reassign an orphaned encounter to a new, existing zone. No-op if target is missing. */
export function reassignEncounterZone(
  project: WorldProject,
  encounterId: string,
  newZoneId: string,
): WorldProject {
  const zoneExists = project.zones.some((z) => z.id === newZoneId);
  if (!zoneExists) return project;
  return {
    ...project,
    encounterAnchors: project.encounterAnchors.map((e) =>
      e.id === encounterId ? { ...e, zoneId: newZoneId } : e,
    ),
  };
}

/** Delete an orphaned encounter by id. Single-encounter variant for per-row repair. */
export function deleteEncounter(project: WorldProject, encounterId: string): WorldProject {
  return {
    ...project,
    encounterAnchors: project.encounterAnchors.filter((e) => e.id !== encounterId),
  };
}
