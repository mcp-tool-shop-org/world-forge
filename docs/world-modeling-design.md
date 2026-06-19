# World-Modeling Layer — Research-Grounded Design

> Status: in progress (dogfood swarm, 2026-06-19). Three additive world-modeling
> features: **Strata** (vertical layers), **typed Hazards**, **zone entry gates**.
> world-forge is a world-*authoring* tool: we author static data and export it to
> the engine (Godot 4 is the verified target). Runtime simulation stays in the
> engine. The design below is grounded in a 5-agent research pass; each decision
> cites the evidence that drove it.

## Why these three

The authoring→Godot loop already covers zones, tiles, props, walls, town economy,
and town structures. The remaining gaps are the "world" layer hesperia (the
north-star tactical RPG) needs: vertical stratification, real environmental
hazards (today `Zone.hazards` is a free `string[]`), and party-gated zone entry.

## Scope boundaries (deliberate)

- **Per-tile combat height + jump tolerance** (FFT-style height-delta reachability)
  is a *complementary, finer* layer that belongs on tiles, not the macro Stratum —
  **deferred** to a later tile-height slice.
- **Runtime dynamic tile-state** (Triangle Strategy wet→lightning chaining) is
  engine simulation, not authoring data — **out of scope** (the engine drives it).
- **Full boolean AST for gates** (JsonLogic-style and/or/not tree) is **deferred**
  in favor of an AND-array of condition leaves, which covers the attested cases
  and reuses the existing flat grammar without a risky rewrite.

---

## 1. Strata (vertical layers)

**Gap:** zones carry continuous `elevation` (meters) + `elevationRange`, but there
is no first-class discrete vertical layer grouping zones into levels (surface /
underground / sky, or building floors over cellars).

**Research grounding:**
- Discrete, integer-ordered layers are the shipped consensus, not continuous
  meters. Dwarf Fortress indexes vertical space by signed integer z-levels (0 = sea
  level) — https://www.dwarffortresswiki.org/index.php/Z-level . FFT/Tactics Ogre
  store discrete per-tile integer height + two stacked terrain levels
  (FFHacktics "Maps/Mesh"; https://gomtuu.org/fft/Ganesha/instructions.html).
- Cross-level connectivity is an explicit edge, not implied by height. Godot's
  NavigationLink2D connects positions on separate navmeshes with cost +
  bidirectional flags — https://docs.godotengine.org/en/stable/tutorials/navigation/navigation_using_navigationlinks.html .
- Visibility between layers is a per-layer set (cell-and-portal / PVS). Thief's
  Dark Engine used convex cells + portals, handling overlapping spaces at different
  heights — https://nothings.org/gamedev/thief_rendering.html ; Quake precomputes a
  potentially-visible-set per cell — https://30fps.net/pages/pvs-portals-and-quake/ .
- **Godot mapping (engine cross-check corrected the abstract design):** a
  CanvasLayer-per-stratum is *explicitly discouraged* — CanvasLayer ignores the 2D
  camera transform, so it would not scroll with the world
  (https://docs.godotengine.org/en/stable/tutorials/2d/canvas_layers.html). And
  `z_index` is ignored for ordering once y-sort is on
  (https://github.com/godotengine/godot/issues/62715). Correct shape: one sibling
  subtree per stratum with a coarse `z_index` **band** (`order*N`,
  `z_as_relative=false`, within ±4096), plus one `NavigationRegion2D` per stratum
  isolated by a unique `navigation_layers` bit
  (https://docs.godotengine.org/en/4.4/classes/class_navigationregion2d.html).

**Schema:**
```ts
interface Stratum {
  id; name;
  order: number;              // signed int: surface=0, underground=-1, sky=+1
  zRange?: { floor; ceiling }; // optional metric span (floor < ceiling)
  visibleStrata?: string[];   // strata visible from here (PVS); empty = engine default
  tags: string[];
}
interface StratumLink {
  id; fromStratumId; toStratumId;
  fromZoneId?; toZoneId?;     // optional anchor zones (stairwell ↔ cellar)
  bidirectional: boolean;
  linkType: string;           // 'stairs' | 'ladder' | 'elevator' | 'shaft' | 'ramp'
}
// Zone gains: stratumId?: string
// WorldProject gains: strata?: Stratum[]; stratumLinks?: StratumLink[]
```
Per-zone/tile `elevation` stays as the intra-stratum fine offset (the FFT "3.5h"
role); Stratum handles discrete grouping, draw order, navigation, and visibility.

**Godot export:** a `Strata` container (one Node2D per stratum, metadata =
order/z-band/zRange/visible) + a `StratumLinks` container (per-link metadata, →
NavigationLink2D shape later) + `metadata/stratum_id` and a stratum-derived
`z_index` band on each zone node.

---

## 2. Typed Hazards

**Gap:** `Zone.hazards` is `string[]` — untyped tags, not authorable as structured
data.

**Research grounding:**
- Effects belong in a discriminated union, not booleans. Brogue's `tileCatalog`
  separates a damage/status/ignite flags field from an occupancy field
  (https://github.com/tmewett/BrogueCE/blob/master/src/brogue/Globals.c).
- Damage-over-time is `(amount, tick-timing, duration)` and references a shared
  status, not a re-inlined one — FFT poison is ⅛ max-HP at end of turn for a fixed
  duration, identical whether from a tile or a spell
  (https://finalfantasy.fandom.com/wiki/Poison_(Tactics_status)).
- Terrain penalty + weather gating are real axes — Tactics Ogre marsh costs +1/+2
  move in rain/thunder (https://gamefaqs.gamespot.com/ps/198881-tactics-ogre/faqs/32399).
- Passability, vision-occlusion, and cloud-emission are orthogonal (DCSS lava:
  impassable-unless-flying, emits vision-blocking smoke, lethal —
  http://crawl.chaosforge.org/Dungeon_features).
- **Godot mapping:** hazard = `Area2D` + inline `CollisionShape2D` +
  `set_meta("hazard", {...})`, read on `body_entered`; faction immunity via
  `collision_layer`/`collision_mask`; force hazards (wind/low-grav) use native
  `space_override`/gravity, no script
  (https://docs.godotengine.org/en/stable/tutorials/physics/using_area_2d.html).

**Schema (static authoring data; runtime drives dynamic state):**
```ts
type HazardEffect =
  | { kind: 'damage'; amount: number; amountIsPercentMaxHp?: boolean; tickOn: 'turn-start'|'turn-end'; durationTicks?: number }
  | { kind: 'status'; statusId: string; chance: number; stacking: 'refresh'|'stack'|'ignore' }
  | { kind: 'instakill' }
  | { kind: 'ignite'; igniteChance: number };
interface HazardDefinition {
  id; name;
  effects: HazardEffect[];
  trigger: 'on-enter' | 'per-turn' | 'on-exit' | 'timed';
  moveCostDelta?: number;
  passable?: 'yes' | 'flying-only' | 'never';
  blocksVision?: boolean;
  weatherConditions?: string[];   // only active under these weathers (empty = always)
  immuneTags?: string[];          // e.g. 'poison-immune', 'fire-resist'
  tags: string[];
}
// WorldProject gains: hazardDefinitions?: HazardDefinition[]
// Zone gains: hazardRefs?: string[]  (ids into hazardDefinitions; legacy hazards:string[] kept)
```

**Godot export:** a `Hazards` container; each referenced hazard → `Area2D` +
inline shape (zone-sized) + `set_meta("hazard", {...})`.

---

## 3. Zone Entry Party-Gates

**Gap:** there is no way to gate *entering a zone* on party state. The existing
`SpawnCondition` grammar is **flat** (one leaf — `level:>=5`, `quest:id:stage`) and
already validated/reused by loot tables.

**Research grounding:**
- Real RPG gates are composite (multi-condition AND) and roster-aware — Suikoden's
  Pirates' Fortress needs HQ castle-level 3 **and** specific recruits
  (https://www.rpgsite.net/guide/16986-suikoden-ii-recruitment-guide); Unicorn
  Overlord gates per-zone "liberation" + deployment resource
  (https://gamewith.net/unicorn-overlord/66750).
- Gate decisions should return structured *reasons*, not a bare bool — OPA returns
  `{allow, reason}` (https://www.openpolicyagent.org/docs/faq); evaluate all failing
  leaves so the message composes ("you need a level-10 party **and** the Iron Key").
- Show the lock before the key, and support hard vs soft (advisory) gates —
  Metroidvania lock-and-key design
  (https://allthings.how/metroidvania-explained-design-pillars-history-scope/).
- **Godot mapping:** no dedicated gate node exists; the idiom is `Area2D` +
  `set_meta("gate", {requires, reason})`, evaluated on `body_entered`.

**Schema (reuse + extend the grammar; AND-array, not a new AST):**
```ts
interface ZoneEntryGate {
  conditions: string[];   // each a SpawnCondition-grammar string; ALL must pass (AND)
  mode: 'hard' | 'soft';  // hard = block entry; soft = advisory only
  reason?: string;        // authored "show the lock" message
}
// Zone gains: entryGate?: ZoneEntryGate
// New SpawnCondition leaf types (party operands):
//   party-level:<op><n>  item:<id>  flag:<id>  member:<id>  party-size:<op><n>  class:<id>
```
Each condition validates through the existing `validateSpawnCondition`; the editor
and runtime collect all unmet conditions for the failure message.

**Godot export:** gated zones carry `metadata/entry_gate` (the conditions),
`metadata/entry_gate_mode`, and `metadata/entry_gate_reason`.

---

## Slice plan (smallest-first, PR each, CI green on (22)+(24)+site-build)

1. **Strata data** — schema + store CRUD + validation + tests (+ this doc).
2. **Strata editor** — project-level Strata panel + zone→stratum assignment.
3. **Strata Godot export** — containers + stratum_id + z-band + smoke.
4. **Hazards data** → **Hazards editor** → **Hazards Godot export**.
5. **Entry-gates data** (grammar extension) → **editor** → **Godot export**.
