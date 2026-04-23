---
title: Unreal Export Pipeline
description: How WorldProject becomes a versioned, signed UnrealContentPack for a UE5 project
sidebar:
  order: 6
---

The `@world-forge/export-unreal` package converts a `WorldProject` into a directory of JSON files — an **UnrealContentPack** — that a UE5 project can load at runtime. Unlike the AI RPG exporter, which targets a single consumer's schema, the Unreal exporter targets a neutral 2.5D content contract that any UE5 project can implement against.

## Pipeline Overview

1. **Validate** — `validateProject()` runs structural checks. Invalid projects fail loudly, with zone / entity / asset ids named in the error.
2. **Convert zones** — Every `Zone` becomes an `UnrealZoneDataAsset` with elevation, sky / lighting metadata, collision channel, physics overrides, and parallax layer references.
3. **Convert entities** — `EntityPlacement[]` becomes the actor spawn manifest. Placements in missing zones are NOT silently dropped — they land in `UnrealDroppedEntity[]` with zone-id context so the loader can surface the loss.
4. **Convert districts, transitions, landmarks, encounters** — each becomes its own flat JSON file.
5. **Compose Meta** — `buildMeta` runs a chain of `MetaStep` functions. The last step optionally signs the result.
6. **Write files** — zones, districts, and actor manifests write in parallel via `Promise.allSettled`. Any file that fails to write aggregates its reason; the CLI exits non-zero with a per-file breakdown.

## CLI

### Export

```bash
# Export a pack
npx world-forge-export-unreal project.json --out ./my-pack

# Include an integrity hash in the pack metadata
npx world-forge-export-unreal project.json --out ./my-pack --sign

# Validate only
npx world-forge-export-unreal project.json --validate-only

# Verbose output — fidelity breakdown per domain
npx world-forge-export-unreal project.json --out ./my-pack --verbose
```

### Review a pack without re-exporting (v4.4.0)

```bash
# Human-readable summary: zone + entity counts, FormatVersion, signature state, size
npx world-forge-export-unreal --summary ./my-pack

# Diff two packs structurally (e.g., "what changed since the last export?")
npx world-forge-export-unreal --diff ./my-pack-v1 ./my-pack-v2

# Diff with specific zone / entity ids that changed
npx world-forge-export-unreal --diff ./my-pack-v1 ./my-pack-v2 --detailed
```

`--summary` and `--diff` short-circuit before the export pipeline, so they don't need a `project.json` argument.

## Pack Format Version (UE-FT-008)

Every pack records its format version in `pack.Meta.FormatVersion`. As of v4.4.0 the current version is **`1.1.0`**.

**Versioning rules:**
- **Major bump** — a required field was added, an existing field's semantics changed, or a field was removed. Old loaders cannot read the new pack.
- **Minor bump** — an optional field was added. Old loaders can read the new pack and will ignore the unknown field.
- **Patch bump** — docs, formatting, or non-structural changes.

**Import behavior** — `importFromUnreal(dir)` runs `migratePack` before the major-keyed dispatcher:
- **Unknown major** — hard error, names the version. The loader in your UE5 project should handle this error by refusing to load the pack and surfacing a message to the operator.
- **Older minor** — the migration chain runs pure per-version steps to bring `Meta` up to the current version. Today the chain is `v1.0.0 → v1.1.0` (no-op, because the only change is an optional additive field). Future versions extend the chain.
- **Newer minor** — the pack loads; a forward-compat warning lands in the fidelity report naming the version, so the UE5 loader can tell the operator "this pack is newer than your loader supports, some fields may be ignored."

## Pack Signing (UE-FT-007)

As of v4.4.0, packs can carry an optional SHA-256 integrity hash. This is **not** a MAC — there's no shared key. It's a "did this pack change between export and load?" check, useful when shipping an UnrealContentPack as a release asset.

### Signed shape

```typescript
type UnrealPackMeta = {
  FormatVersion: string;
  // ...standard meta fields...
  Signature?: {
    algorithm: 'sha256';
    value: string;           // hex-encoded digest
    signedFields: string[];  // ordered list of covered Meta fields
  };
};
```

`signedFields` is explicit so verifiers re-canonicalize using the list recorded in the signature. `FormatVersion` is always included in the signed set — this blocks a downgrade-attack style tampering where someone rewrites FormatVersion to confuse a newer loader.

### Verification

Import does **not** auto-verify (backward-compat: old packs have no signature and must still load). Verification is opt-in:

```typescript
import { verifyPackSignature } from '@world-forge/export-unreal';

const { valid, reason } = verifyPackSignature(pack.Meta);
if (!valid) {
  throw new Error(`UnrealContentPack signature invalid: ${reason}`);
}
```

Your UE5 loader can call `verifyPackSignature` at load time and refuse the pack on failure. CI can call it against a release asset to catch corruption before shipping.

## Expected Loader Contract (in your UE5 project)

The **loader plugin lives in your UE5 project, not in world-forge.** `star-freight-ue5` will be the first consumer. The expected contract:

1. **Read `pack.json`** — parse `Meta`, check `FormatVersion` against what the loader supports.
2. **Optional: verify signature** — if `Signature` is present and verification is enabled for the build, fail fast on mismatch.
3. **Scan zones/** — one `UnrealZoneDataAsset` per file, apply elevation / sky / collision / physics.
4. **Scan entities/** — spawn actors per the manifest. If `Incomplete: true` or `UnrealDroppedEntity[]` is non-empty, log which actors the loader chose not to spawn (zone missing, etc.).
5. **Scan transitions/** — wire elevators, warps, cargo lifts.
6. **Apply meta** — source tile size, parallax layer hints, sky atmosphere asset ids.

## 2.5D Fields (from v4.3.0)

- **Sky & lighting** — `SkyAtmosphereAssetId`, `DirectionalLightYaw` / `Pitch`, `SkyLightIntensity`, `TimeOfDayKey`.
- **Collision channel** — `CollisionChannel` (`walkable | water | hazard | void | custom`), with hazard inference when hazards are authored but no channel set.
- **Parallax manifest** — `actors/parallax-manifest.json` lists one `UnrealParallaxActor` per layer per zone with `SuggestedScale` and `ParentZoneOriginCm`.
- **Gravity / physics mode** — `GravityCmPerSec2`, `GravityDirection`, `PhysicsMode` for platformer / zero-g / aquatic zones.
- **Transitions** — `UnrealContentPack.Transitions` array. Elevators, warps, transporters, cargo lifts, stairwells.

## Fidelity Reporting

Every export produces a `FidelityReport` with per-domain entries. Common reason keys for the Unreal lane:

| Reason Key                        | Level        | Description                                                      |
|-----------------------------------|--------------|------------------------------------------------------------------|
| `elevation-exported`              | lossless     | Zone elevation fields written to `UnrealZoneDataAsset`           |
| `sky-metadata-exported`           | lossless     | Sky / lighting hints written; loader may apply or ignore         |
| `collision-channel-approximated`  | approximated | `collisionType: 'hazard'` inferred from hazard array             |
| `parallax-layer-exported`         | lossless     | Parallax layers written to actor manifest                        |
| `entity-dropped-missing-zone`     | dropped      | `EntityPlacement.zoneId` references a zone that doesn't exist    |
| `format-version-forward-compat`   | approximated | Pack FormatVersion is newer than loader supports; some fields may be unknown |
| `signature-absent`                | lossless     | Pack was exported without `--sign` (intentional, not a defect)   |

## Programmatic Usage

```typescript
import {
  exportToUnreal,
  importFromUnreal,
  verifyPackSignature,
  summarizePack,
  diffPacks,
  UNREAL_PACK_FORMAT_VERSION,
} from '@world-forge/export-unreal';

// Export
const result = await exportToUnreal(project, {
  outDir: './my-pack',
  signing: { algorithm: 'sha256' }, // optional
});

// Review
console.log(await summarizePack('./my-pack'));
console.log(await diffPacks('./my-pack-v1', './my-pack-v2'));

// Import (loader side)
const imported = await importFromUnreal('./my-pack');
if (imported.fidelity.some((e) => e.reason === 'format-version-forward-compat')) {
  console.warn('Pack is newer than our loader.');
}
```

## Dogfood: Chapel Threshold (Unreal)

`dogfood/chapel-threshold-unreal.ts` runs the full Unreal pipeline end-to-end against the Chapel Threshold fixture — 5 zones, 2 districts, 4 entities, 3 items, 1 dialogue, spawn + progression trees. It writes to a temp directory, verifies the manifest, round-trips back through `importFromUnreal`, and checks the fidelity report has zero unexpected entries. Running it is the fastest way to confirm a schema change hasn't silently corrupted exports.
