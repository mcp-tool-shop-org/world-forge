# Dogfood Walkthrough: Chapel Threshold

First end-to-end export from World Forge to ai-rpg-engine.

## Subject

**Chapel Threshold** — a ruined chapel atop an ancient crypt. 5 zones, 2 districts, 4 entities, 3 items, 1 landmark, 1 encounter, 2 faction presences, 1 pressure hotspot, 1 ambient layer.

## What we did

1. Took the existing `chapel-authored.ts` test fixture
2. Ran it through `exportToEngine()`
3. Compared output against the engine's hand-written `starter-fantasy/content.ts`
4. Identified 12 gaps
5. Fixed 8 by extending the schema and converters
6. Documented the remaining 4 as future authoring features

## Run it yourself

```bash
npx tsx dogfood/chapel-threshold.ts
```

Output lands in `dogfood/output/`.

## Gap analysis

### Closed (8 gaps)

| Gap | Fix |
|-----|-----|
| Entities had no `baseStats` | Added `EntityStats` to schema, pass-through in converter |
| Entities had no `baseResources` | Added `EntityResources` to schema, pass-through in converter |
| Entities had no authored AI profiles | Added `EntityAI` to schema, `ai.profileId` overrides role default |
| Entities had no display names | Added `name` field to `EntityPlacement` |
| Entities had no custom metadata | Added `custom` field for companion roles, goals, abilities |
| Entities had no author tags | Added `tags` field, merged with role-based tags |
| Items had no slot/rarity/description | Added `ItemSlot`, `ItemRarity`, `name`, `description` to schema |
| Items had no stat modifiers or granted verbs | Added `statModifiers`, `resourceModifiers`, `grantedTags`, `grantedVerbs` |

### Remaining (4 gaps — future authoring features)

| Gap | Why |
|-----|-----|
| No dialogues exported | Dialogue authoring not yet in World Forge |
| No BuildCatalog exported | Character creation authoring not yet in scope |
| No ProgressionTreeDefinition exported | Progression tree authoring not yet in scope |
| No player entity template | Player configuration not yet in editor |

These are honest scope boundaries, not bugs. The export pipeline stubs `dialogues: []` and the engine handles missing optional content gracefully.

## Exported output vs engine starter

### Entities — now match

| Field | Engine starter | World Forge export |
|-------|---------------|-------------------|
| id | `ash-ghoul` | `ash-ghoul` |
| type | `enemy` | `enemy` |
| name | `Ash Ghoul` | `Ash Ghoul` |
| tags | `['enemy', 'undead']` | `['hostile', 'boss', 'elite', 'undead', 'faction:chapel-undead']` |
| stats | `{ vigor: 4, instinct: 3, will: 1 }` | `{ vigor: 4, instinct: 3, will: 1 }` |
| resources | `{ hp: 12, stamina: 4 }` | `{ hp: 12, stamina: 4 }` |
| ai | `{ profileId: 'aggressive', goals: ['guard-crypt'] }` | `profileId: 'aggressive'` (goals in fixture, not yet in export) |

### Items — now match

| Field | Engine starter | World Forge export |
|-------|---------------|-------------------|
| id | `rusted-mace` | `rusted-mace` |
| name | `Rusted Mace` | `Rusted Mace` |
| slot | `weapon` | `weapon` |
| rarity | `common` | `common` |
| statModifiers | `{ vigor: 1 }` | `{ vigor: 1 }` |
| grantedVerbs | `['strike']` | `['strike']` |

### Zones — already matched before dogfood

### Districts — already matched before dogfood

## What we learned

1. **The role-based defaults were too aggressive.** Entities need authored stats, not just role labels. A "boss" without vigor/instinct/will is a paper tiger.

2. **Items without slots are invisible to the equipment system.** The original converter defaulted everything to `trinket` — now items carry their real slot and modifiers.

3. **The `custom` field is load-bearing.** Companion roles, personal goals, and abilities don't fit into any standard field. The engine uses `custom` for this, and World Forge now passes it through.

4. **Dialogues are the biggest remaining gap.** Every NPC in the engine has dialogue trees. World Forge can place NPCs but can't author what they say yet.

## Next steps

- v1.1: Dialogue authoring in the editor
- v1.1: Player template configuration
- v1.2: Build catalog authoring (archetypes, backgrounds, traits)
- v1.2: Progression tree authoring
