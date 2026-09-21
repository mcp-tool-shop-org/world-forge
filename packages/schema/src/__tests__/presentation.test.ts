// presentation.test.ts — the `WorldProject.presentation` block: its structural
// gate (validateProject) and its eight advisory rules (presentationAdvisories).
//
// A small synthetic world, not Salt Road. Two zones, one sim placement. The
// point of the fixture is that every rule can be violated ONE AT A TIME, which
// a real authored world cannot do without being edited into nonsense.

import { describe, it, expect } from 'vitest';
import {
  presentationAdvisories,
  PRESENTATION_ADVISORY_PREFIX,
  validateProject,
  createEmptyProject,
  type WorldPresentation,
  type WorldProject,
} from '../index.js';

/** Zones + placements, exactly what presentationAdvisories reads. */
const zones = [{ id: 'zone-quay' }, { id: 'zone-shed' }] as const;
const entityPlacements = [{ entityId: 'npc-drell', zoneId: 'zone-shed' }] as const;

/** Anchors at (2,2) and (8,5) with span 3 => boxes 2..4 and 8..10 on both axes. */
function validPresentation(): WorldPresentation {
  return {
    view: 'dimetric-2:1',
    tile: [256, 128],
    span: 3,
    zoneCells: {
      'zone-quay': [2, 2],
      'zone-shed': [8, 5],
    },
    floor: { 'zone-quay': 'stone_wet' },
    occupancy: [
      { id: 'player', character: 'merchant', zone: 'zone-quay', cell: [4, 4], facing: 'front' },
      {
        id: 'npc-drell',
        character: 'guard',
        zone: 'zone-shed',
        cell: [9, 7],
        facing: 'front',
        y_sort_proof: 'front',
        why: 'stands between the counting table and the door',
      },
    ],
  };
}

/** The advisory input, with `presentation` swapped for whatever a test needs. */
function input(presentation?: WorldPresentation) {
  return { presentation, zones, entityPlacements };
}

/** A minimal VALID WorldProject carrying `presentation`, for validateProject. */
function projectWith(presentation?: unknown): WorldProject {
  const base = createEmptyProject();
  const project: WorldProject = {
    ...base,
    zones: [
      {
        id: 'zone-quay',
        name: 'Quay',
        description: 'A quay.',
        tags: [],
        gridX: 0,
        gridY: 0,
        gridWidth: 8,
        gridHeight: 8,
        light: 0.5,
        noise: 0.2,
        neighbors: [],
        exits: [],
        interactables: [],
        hazards: [],
      },
    ],
    spawnPoints: [
      { id: 'spawn-1', zoneId: 'zone-quay', gridX: 0, gridY: 0, isDefault: true },
    ],
  };
  (project as unknown as Record<string, unknown>).presentation = presentation;
  return project;
}

/** Only the presentation-scoped errors, so an unrelated fixture slip cannot hide. */
function presentationErrors(project: WorldProject) {
  return validateProject(project).errors.filter((e) => e.path.startsWith('presentation'));
}

const p = PRESENTATION_ADVISORY_PREFIX;

describe('presentationAdvisories — the quiet cases', () => {
  it('returns [] when the block is absent (most worlds have none)', () => {
    expect(presentationAdvisories(input(undefined))).toEqual([]);
  });

  it('returns [] for a fully valid block', () => {
    expect(presentationAdvisories(input(validPresentation()))).toEqual([]);
  });

  it('validateProject reports nothing when the block is absent', () => {
    expect(presentationErrors(projectWith(undefined))).toEqual([]);
  });
});

describe('presentationAdvisories — rule 1: zoneCells names a zone the world lacks', () => {
  it('flags the unknown key', () => {
    const pres = validPresentation();
    pres.zoneCells['zone-ghost'] = [20, 20];
    const out = presentationAdvisories(input(pres));
    expect(out).toContain(`${p}unknown zone id 'zone-ghost' in zoneCells`);
  });
});

describe('presentationAdvisories — rule 2: an actor in a zone with no anchor', () => {
  it('flags the actor, by id and zone', () => {
    const pres = validPresentation();
    pres.occupancy[0] = { ...pres.occupancy[0], zone: 'zone-shed-annexe' };
    const out = presentationAdvisories(input(pres));
    expect(out).toContain(`${p}actor 'player' stands in zone 'zone-shed-annexe' with no anchor`);
  });
});

describe('presentationAdvisories — rule 3: a cell outside its zone span', () => {
  it('flags a cell past the far edge, naming the anchor and span', () => {
    const pres = validPresentation();
    pres.occupancy[0] = { ...pres.occupancy[0], cell: [5, 4] };
    const out = presentationAdvisories(input(pres));
    expect(out).toContain(
      `${p}actor 'player' cell [5,4] is outside zone 'zone-quay' span (anchor [2,2], span 3)`,
    );
  });

  it('flags a cell before the anchor on the y axis', () => {
    const pres = validPresentation();
    pres.occupancy[1] = { ...pres.occupancy[1], cell: [9, 4] };
    const out = presentationAdvisories(input(pres));
    expect(out).toContain(
      `${p}actor 'npc-drell' cell [9,4] is outside zone 'zone-shed' span (anchor [8,5], span 3)`,
    );
  });

  it('boundary: anchor+span-1 is INSIDE on both axes', () => {
    const pres = validPresentation();
    pres.occupancy[0] = { ...pres.occupancy[0], cell: [4, 4] };
    pres.occupancy[1] = { ...pres.occupancy[1], cell: [10, 7] };
    expect(presentationAdvisories(input(pres))).toEqual([]);
  });

  it('boundary: anchor+span is OUTSIDE on each axis separately', () => {
    const onX = validPresentation();
    onX.occupancy[0] = { ...onX.occupancy[0], cell: [5, 2] };
    expect(presentationAdvisories(input(onX))).toEqual([
      `${p}actor 'player' cell [5,2] is outside zone 'zone-quay' span (anchor [2,2], span 3)`,
    ]);

    const onY = validPresentation();
    onY.occupancy[0] = { ...onY.occupancy[0], cell: [2, 5] };
    expect(presentationAdvisories(input(onY))).toEqual([
      `${p}actor 'player' cell [2,5] is outside zone 'zone-quay' span (anchor [2,2], span 3)`,
    ]);
  });

  it('boundary: the anchor cell itself is INSIDE', () => {
    const pres = validPresentation();
    pres.occupancy[0] = { ...pres.occupancy[0], cell: [2, 2] };
    pres.occupancy[1] = { ...pres.occupancy[1], cell: [8, 5] };
    expect(presentationAdvisories(input(pres))).toEqual([]);
  });

  it('does not fire when the zone has no anchor at all (rule 2 owns that)', () => {
    const pres = validPresentation();
    pres.occupancy[0] = { ...pres.occupancy[0], zone: 'zone-nowhere', cell: [99, 99] };
    const out = presentationAdvisories(input(pres));
    expect(out.filter((m) => m.includes('is outside zone'))).toEqual([]);
  });
});

describe('presentationAdvisories — rule 4: nobody to play as', () => {
  it('flags an occupancy list with no player row', () => {
    const pres = validPresentation();
    pres.occupancy = pres.occupancy.filter((a) => a.id !== 'player');
    expect(presentationAdvisories(input(pres))).toContain(`${p}no player row in occupancy`);
  });

  it('an empty occupancy list is still missing its player', () => {
    const pres = validPresentation();
    pres.occupancy = [];
    expect(presentationAdvisories(input(pres))).toEqual([`${p}no player row in occupancy`]);
  });
});

describe('presentationAdvisories — rule 5: drawn, but the sim has never heard of them', () => {
  it('flags a non-player row with no matching entityPlacement', () => {
    const pres = validPresentation();
    pres.occupancy[1] = { ...pres.occupancy[1], id: 'npc-phantom' };
    expect(presentationAdvisories(input(pres)))
      .toContain(`${p}actor 'npc-phantom' has no sim placement`);
  });

  it('the player row is exempt — `player` is never an entityPlacement id', () => {
    const out = presentationAdvisories(input(validPresentation()));
    expect(out.filter((m) => m.includes("'player' has no sim placement"))).toEqual([]);
  });
});

describe('presentationAdvisories — rule 6: drawn in a room the sim says they are not in', () => {
  it('flags the disagreement, naming BOTH zones', () => {
    const pres = validPresentation();
    pres.occupancy[1] = { ...pres.occupancy[1], zone: 'zone-quay', cell: [3, 3] };
    expect(presentationAdvisories(input(pres))).toContain(
      `${p}actor 'npc-drell' is drawn in 'zone-quay' but the sim places it in 'zone-shed'`,
    );
  });
});

describe('presentationAdvisories — rule 7: floor names a zone the world lacks', () => {
  it('flags the unknown floor key', () => {
    const pres = validPresentation();
    pres.floor = { ...pres.floor, 'zone-ghost': 'stone_wet' };
    expect(presentationAdvisories(input(pres)))
      .toContain(`${p}unknown zone id 'zone-ghost' in floor`);
  });

  it('an omitted floor map is not a finding', () => {
    const pres = validPresentation();
    delete pres.floor;
    expect(presentationAdvisories(input(pres))).toEqual([]);
  });
});

describe('presentationAdvisories — rule 8: the same id drawn twice', () => {
  it('flags the duplicate', () => {
    const pres = validPresentation();
    pres.occupancy = [...pres.occupancy, { ...pres.occupancy[1] }];
    expect(presentationAdvisories(input(pres)))
      .toContain(`${p}duplicate actor id 'npc-drell'`);
  });
});

describe('presentationAdvisories — every message carries the prefix', () => {
  it('so an exporter can filter its warnings[] by origin', () => {
    const pres = validPresentation();
    pres.zoneCells['zone-ghost'] = [20, 20];
    pres.floor = { 'zone-ghost': 'stone_wet' };
    pres.occupancy = [
      { id: 'npc-phantom', character: 'scribe', zone: 'zone-nowhere', cell: [1, 1], facing: 'left' },
      { id: 'npc-phantom', character: 'scribe', zone: 'zone-nowhere', cell: [1, 1], facing: 'left' },
    ];
    const out = presentationAdvisories(input(pres));
    expect(out.length).toBeGreaterThan(0);
    expect(out.every((m) => m.startsWith(p))).toBe(true);
  });
});

describe('validateProject — presentation STRUCTURAL errors only', () => {
  it('accepts a well-formed block', () => {
    expect(presentationErrors(projectWith(validPresentation()))).toEqual([]);
  });

  it('rejects a non-object presentation', () => {
    const errors = presentationErrors(projectWith('dimetric'));
    expect(errors.map((e) => e.path)).toEqual(['presentation']);
  });

  it('rejects an unsupported view', () => {
    const pres = { ...validPresentation(), view: 'isometric' as unknown as never };
    expect(presentationErrors(projectWith(pres)).map((e) => e.path)).toContain('presentation.view');
  });

  it('rejects a tile of length 3', () => {
    const pres = { ...validPresentation(), tile: [256, 128, 64] as unknown as never };
    expect(presentationErrors(projectWith(pres)).map((e) => e.path)).toContain('presentation.tile');
  });

  it('rejects span 0', () => {
    const pres = { ...validPresentation(), span: 0 };
    expect(presentationErrors(projectWith(pres)).map((e) => e.path)).toContain('presentation.span');
  });

  it('rejects a non-integer span', () => {
    const pres = { ...validPresentation(), span: 2.5 };
    expect(presentationErrors(projectWith(pres)).map((e) => e.path)).toContain('presentation.span');
  });

  it('rejects zoneCells that is not an object of 2-tuples', () => {
    const bad = { ...validPresentation(), zoneCells: { 'zone-quay': [2] } as unknown as never };
    expect(presentationErrors(projectWith(bad)).map((e) => e.path))
      .toContain('presentation.zoneCells.zone-quay');

    const notAnObject = { ...validPresentation(), zoneCells: [] as unknown as never };
    expect(presentationErrors(projectWith(notAnObject)).map((e) => e.path))
      .toContain('presentation.zoneCells');
  });

  it('rejects occupancy that is not an array', () => {
    const pres = { ...validPresentation(), occupancy: {} as unknown as never };
    expect(presentationErrors(projectWith(pres)).map((e) => e.path))
      .toContain('presentation.occupancy');
  });

  it('rejects a row missing each of id / character / zone / cell / facing', () => {
    for (const field of ['id', 'character', 'zone', 'cell', 'facing'] as const) {
      const pres = validPresentation();
      const row = { ...pres.occupancy[0] } as Record<string, unknown>;
      delete row[field];
      pres.occupancy = [row as unknown as (typeof pres.occupancy)[number]];
      expect(
        presentationErrors(projectWith(pres)).map((e) => e.path),
        `missing ${field} must be reported`,
      ).toContain(`presentation.occupancy[0].${field}`);
    }
  });

  it('rejects a facing outside the stage vocabulary', () => {
    const pres = validPresentation();
    pres.occupancy[0] = { ...pres.occupancy[0], facing: 'north' as unknown as never };
    expect(presentationErrors(projectWith(pres)).map((e) => e.path))
      .toContain('presentation.occupancy[0].facing');
  });

  it('the semantic rules are NOT errors — a span violation still validates', () => {
    const pres = validPresentation();
    pres.occupancy[0] = { ...pres.occupancy[0], cell: [99, 99] };
    expect(presentationErrors(projectWith(pres))).toEqual([]);
  });
});
