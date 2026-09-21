// presentation.ts — how a client DRAWS an authored world. Never simulated, never hashed.
//
// THE THREE GRIDS (load-bearing; mixing them is how quality fell apart last time):
//
//   Sim occupancy     zone id only                     engine WorldState: hashed, authoritative
//   Dimetric cells    256x128 diamonds, span 3          stage IsoHarbour: presentation, never hashed
//   Forge cartesian   gridX/gridY, tile 32 then x3 @ 48  editor / Godot .tscn: scaleForSandbox touches ONLY this one
//
// A cell in this block is COPIED from a measured placement (ai-rpg-stage
// fixtures/harbour-occupancy.json @ 839ad31). It is never derived from
// EntityPlacement.gridX/gridY and never multiplied by a sandbox scale.

export const PRESENTATION_VIEWS = ['dimetric-2:1'] as const;
export type PresentationView = typeof PRESENTATION_VIEWS[number];

/** ai-rpg-stage sprite_binder.gd facings, transcribed. */
export const PRESENTATION_FACINGS = [
  'front', 'front_left', 'left', 'back_left', 'back', 'back_right', 'right', 'front_right',
] as const;
export type PresentationFacing = typeof PRESENTATION_FACINGS[number];

export type PresentationCell = readonly [number, number];

export interface PresentationActor {
  /** `player`, or an EntityPlacement.entityId. */
  id: string;
  /** Character PACK id the client binds (elder, scribe, guard, child, fisherman, merchant). Not a display name. */
  character: string;
  /** Zone id. Must match the sim placement's zoneId for a non-player row. */
  zone: string;
  /** Absolute dimetric cell. Must sit in zoneCells[zone] .. + span-1 on both axes. */
  cell: PresentationCell;
  facing: PresentationFacing;
  /** Sidecar field name kept verbatim. Only 'front' is ever asserted; no fake 'behind'. */
  y_sort_proof?: 'front';
  /** Measured rationale from the sidecar. Optional; not player-facing. */
  why?: string;
}

export interface WorldPresentation {
  view: PresentationView;
  /** Diamond footprint in pixels, e.g. [256, 128]. */
  tile: readonly [number, number];
  /** Cells per zone on each axis; 3 means a 3x3 diamond per zone anchor. */
  span: number;
  /** Zone id -> anchor cell (the stage's ZONE_CELLS). */
  zoneCells: Record<string, PresentationCell>;
  /** Zone id -> dimetric floor plate id (e.g. 'stone_wet'). A plate id, not a cartesian tileset cell. */
  floor?: Record<string, string>;
  occupancy: PresentationActor[];
}

/** The player's reserved occupancy id. Not an EntityPlacement.entityId. */
export const PRESENTATION_PLAYER_ID = 'player';

export const PRESENTATION_ADVISORY_PREFIX = 'presentation: ';

/** Shape the advisory pass needs from a project. Kept structural so callers need no cast. */
export interface PresentationAdvisoryInput {
  presentation?: WorldPresentation;
  zones: ReadonlyArray<{ id: string }>;
  entityPlacements: ReadonlyArray<{ entityId: string; zoneId: string }>;
}

/**
 * Advisory findings on project.presentation. Returns [] when the block is absent
 * (most worlds have none and must not be penalised). Exporters push these onto
 * their warnings[]; a --strict lane may promote them to errors. Not part of
 * validateProject's errors because ValidationResult has no warnings channel.
 *
 * Rules, in emission order:
 *   1. zoneCells key that is not a zones[].id
 *   2. occupancy[].zone with no zoneCells anchor
 *   3. occupancy[].cell outside its zone's span x span box
 *   4. no row with id === 'player'
 *   5. non-player row with no matching entityPlacements[].entityId
 *   6. non-player row drawn in a zone the sim does not place it in
 *   7. floor key that is not a zones[].id
 *   8. duplicate occupancy[].id
 */
export function presentationAdvisories(project: PresentationAdvisoryInput): string[] {
  const presentation = project.presentation;
  if (presentation === undefined) return [];

  const out: string[] = [];
  const say = (message: string) => out.push(`${PRESENTATION_ADVISORY_PREFIX}${message}`);

  const zoneIds = new Set(project.zones.map((z) => z.id));
  const zoneCells = presentation.zoneCells ?? {};
  const occupancy = Array.isArray(presentation.occupancy) ? presentation.occupancy : [];

  // Rule 1 — an anchor for a zone the world does not have.
  for (const key of Object.keys(zoneCells)) {
    if (!zoneIds.has(key)) say(`unknown zone id '${key}' in zoneCells`);
  }

  // Sim placements, by entity id. The sidecar never wins a dispute about WHICH
  // zone someone is in — the sim does (rule 6).
  const placementZone = new Map<string, string>();
  for (const p of project.entityPlacements) {
    if (!placementZone.has(p.entityId)) placementZone.set(p.entityId, p.zoneId);
  }

  const seenIds = new Set<string>();
  let sawPlayer = false;

  for (const actor of occupancy) {
    if (actor.id === PRESENTATION_PLAYER_ID) sawPlayer = true;

    // Rule 8 — two rows drawing the same id; the client would bind one twice.
    if (seenIds.has(actor.id)) say(`duplicate actor id '${actor.id}'`);
    seenIds.add(actor.id);

    const anchor = Object.prototype.hasOwnProperty.call(zoneCells, actor.zone)
      ? zoneCells[actor.zone]
      : undefined;

    // Rule 2 — drawn in a zone with no anchor cell, so there is nowhere to put them.
    if (anchor === undefined) {
      say(`actor '${actor.id}' stands in zone '${actor.zone}' with no anchor`);
    } else if (Array.isArray(actor.cell)) {
      // Rule 3 — the cell must sit inside the zone's span x span box, measured
      // from the anchor INCLUSIVE: anchor..anchor+span-1 on both axes. The cell
      // is copied from the sidecar, so a violation means the two records
      // disagree about the geometry, not that the maths drifted.
      const [ax, ay] = anchor;
      const [cx, cy] = actor.cell;
      const span = presentation.span;
      const inside = (c: number, a: number) => c >= a && c <= a + span - 1;
      if (!inside(cx, ax) || !inside(cy, ay)) {
        say(
          `actor '${actor.id}' cell [${cx},${cy}] is outside zone '${actor.zone}' `
          + `span (anchor [${ax},${ay}], span ${span})`,
        );
      }
    }

    if (actor.id !== PRESENTATION_PLAYER_ID) {
      const simZone = placementZone.get(actor.id);
      if (simZone === undefined) {
        // Rule 5 — a drawn person the simulation has never heard of.
        say(`actor '${actor.id}' has no sim placement`);
      } else if (simZone !== actor.zone) {
        // Rule 6 — THE drift this whole exercise exists to prevent: a person
        // drawn in a room the sim says they are not in.
        say(`actor '${actor.id}' is drawn in '${actor.zone}' but the sim places it in '${simZone}'`);
      }
    }
  }

  // Rule 4 — a harbour with no one to play as.
  if (!sawPlayer) say('no player row in occupancy');

  // Rule 7 — a floor plate for a zone the world does not have.
  for (const key of Object.keys(presentation.floor ?? {})) {
    if (!zoneIds.has(key)) say(`unknown zone id '${key}' in floor`);
  }

  return out;
}
