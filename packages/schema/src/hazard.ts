// hazard.ts — typed environmental hazard definitions.
//
// Replaces the untyped `Zone.hazards: string[]` tags with authorable, structured
// hazard definitions. A HazardDefinition is STATIC authoring data; the runtime
// drives dynamic per-tile state (spreading fire, conducting water, etc.). The
// shape is grounded in shipped games + engines (Brogue's flags/mechflags split,
// FFT poison = fraction+tick+duration referencing a shared status, Tactics Ogre
// terrain move-cost + weather gating, DCSS orthogonal passable/vision/emit axes).
// See docs/world-modeling-design.md for the full research grounding.
//
// All additive — projects without hazardDefinitions / Zone.hazardRefs validate
// normally; the legacy `Zone.hazards: string[]` field is untouched.

/**
 * A single typed effect a hazard applies. Discriminated on `kind` (Brogue's
 * flags model: damage / status / instakill / ignite are distinct, not booleans).
 */
export type HazardEffect =
  | {
      kind: 'damage';
      /** Damage per application. A flat amount, or a fraction of max HP when amountIsPercentMaxHp. */
      amount: number;
      amountIsPercentMaxHp?: boolean;
      /** When the tick lands (FFT poison ticks at end of turn). */
      tickOn: 'turn-start' | 'turn-end';
      /** How many ticks the effect persists (omit for instantaneous on-trigger damage). */
      durationTicks?: number;
    }
  | {
      kind: 'status';
      /** Reference to a shared status effect id (tile-poison === spell-poison). */
      statusId: string;
      /** Proc chance in [0, 1]. */
      chance: number;
      stacking: 'refresh' | 'stack' | 'ignore';
    }
  | { kind: 'instakill' }
  | {
      kind: 'ignite';
      /** Chance the occupant catches fire, in [0, 1]. */
      igniteChance: number;
    };

/** Valid hazard trigger timings. */
export type HazardTrigger = 'on-enter' | 'per-turn' | 'on-exit' | 'timed';

/** Valid passability values (DCSS: impassable / flying-only / open are distinct). */
export type HazardPassability = 'yes' | 'flying-only' | 'never';

/**
 * A typed environmental hazard — authorable static data the runtime applies.
 * Referenced by zones via `Zone.hazardRefs` so one definition (e.g. "poison
 * swamp") is shared across zones rather than re-inlined.
 */
export interface HazardDefinition {
  id: string;
  name: string;
  /** Typed effects applied by this hazard. May be empty for a pure terrain hazard (move cost / passability only). */
  effects: HazardEffect[];
  /** When the hazard fires. */
  trigger: HazardTrigger;
  /** Movement-cost penalty added while in the hazard (Tactics Ogre marsh in rain). */
  moveCostDelta?: number;
  /** Whether the hazard tile can be entered. Default (omitted) = enterable. */
  passable?: HazardPassability;
  /** Whether the hazard occludes line of sight (DCSS smoke). */
  blocksVision?: boolean;
  /** Only active under these weather keys (empty / omitted = always active). */
  weatherConditions?: string[];
  /** Tags that grant immunity (e.g. 'poison-immune', 'fire-resist'). */
  immuneTags?: string[];
  tags: string[];
}
