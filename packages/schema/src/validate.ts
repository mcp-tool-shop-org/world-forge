// validate.ts — WorldProject validation

import type { WorldProject } from './project.js';
import type { ConnectionKind } from './spatial.js';
import type { AssetKind } from './assets.js';
import { validateSpawnCondition } from './spawn-condition.js';
import { AUTHORING_MODES, isValidMode } from './authoring-mode.js';

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
  /** Number of validation errors found. Present when using validateProject(). */
  warningCount?: number;
  /**
   * Schema version that produced this result. Populated by validateProject().
   *
   * SCH-B-001 (v4.4): downstream tooling (export-ai-rpg, export-unreal, editor
   * migration helpers) needs to know which schema generation validated a given
   * project so that cross-version imports can fall back to migration paths.
   * Missing this field would force callers to guess, so it is always emitted.
   */
  schemaVersion?: string;
};

/**
 * The stable schema major+minor+patch this package ships. Update in lockstep
 * with the workspace root package.json when cutting a release.
 *
 * SCH-B-001: Exposed as a public export so downstream tools (editor, exporters,
 * future migration CLI) can read it programmatically instead of parsing the
 * package.json. `validateProject()` also stamps this value into every
 * ValidationResult so error logs carry the producing schema version.
 */
export const SCHEMA_VERSION = '4.5.0';

/** Options for validateProject. */
export interface ValidateOptions {
  /** When true, emit extra detail in warnings array. Defaults to false. */
  verbose?: boolean;
}

/**
 * All valid connection kinds — the array is DERIVED from a Record<ConnectionKind, true>
 * lookup so it can never drift from the ConnectionKind union in spatial.ts.
 *
 * SCH-A-002: Adding a new ConnectionKind now produces a compile-time error on the
 * lookup object (missing key) rather than silently allowing invalid kinds through.
 * The array is computed from Object.keys() so it automatically gains the new kind
 * once the lookup is updated — no second manual edit needed.
 */
const VALID_CONNECTION_KINDS_LOOKUP: Record<ConnectionKind, true> = {
  passage: true, door: true, stairs: true, road: true, portal: true,
  secret: true, hazard: true, channel: true, route: true, docking: true,
  warp: true, trail: true,
};
const VALID_CONNECTION_KINDS_ARRAY: ReadonlyArray<ConnectionKind> =
  Object.keys(VALID_CONNECTION_KINDS_LOOKUP) as ConnectionKind[];
export const VALID_CONNECTION_KINDS = new Set<string>(VALID_CONNECTION_KINDS_ARRAY);

// Bidirectional compile-time exhaustiveness: this assignment fails to type-check
// if VALID_CONNECTION_KINDS_ARRAY ever loses coverage of a ConnectionKind, so the
// derived array + lookup stay strictly locked to the union.
const _assertConnectionKindCoverage: ConnectionKind =
  VALID_CONNECTION_KINDS_ARRAY[0] as ConnectionKind;
void _assertConnectionKindCoverage;

/**
 * All valid asset kinds — derived from a Record<AssetKind, true> lookup.
 *
 * SCH-A-001: Same pattern as VALID_CONNECTION_KINDS above. Adding a new AssetKind
 * in assets.ts forces a compile-time error on this lookup (missing key). The
 * array is derived via Object.keys() so it cannot silently drift from the union.
 */
const VALID_ASSET_KINDS_LOOKUP: Record<AssetKind, true> = {
  portrait: true, sprite: true, background: true, icon: true, tileset: true,
};
const VALID_ASSET_KINDS_ARRAY: ReadonlyArray<AssetKind> =
  Object.keys(VALID_ASSET_KINDS_LOOKUP) as AssetKind[];
export const VALID_ASSET_KINDS = new Set<string>(VALID_ASSET_KINDS_ARRAY);

const _assertAssetKindCoverage: AssetKind = VALID_ASSET_KINDS_ARRAY[0] as AssetKind;
void _assertAssetKindCoverage;

/** Semver pattern for pack version validation (x.y.z). */
const SEMVER_PATTERN = /^\d+\.\d+\.\d+$/;

export function validateProject(project: WorldProject, options?: ValidateOptions): ValidationResult {
  const errors: ValidationError[] = [];
  let warningCount = 0;
  const verbose = options?.verbose ?? false;

  // Structural guards: ensure top-level array fields exist and are arrays.
  // Corrupted/truncated JSON imports may have undefined or wrong types here.
  const requiredArrays: [unknown, string][] = [
    [project.zones, 'zones'],
    [project.connections, 'connections'],
    [project.districts, 'districts'],
    [project.entityPlacements, 'entityPlacements'],
    [project.itemPlacements, 'itemPlacements'],
    [project.spawnPoints, 'spawnPoints'],
    [project.landmarks, 'landmarks'],
    [project.dialogues, 'dialogues'],
    [project.progressionTrees, 'progressionTrees'],
    [project.encounterAnchors, 'encounterAnchors'],
    [project.factionPresences, 'factionPresences'],
    [project.pressureHotspots, 'pressureHotspots'],
    [project.assets, 'assets'],
    [project.assetPacks, 'assetPacks'],
    // F-001 (CRITICAL): these seven required array fields (project.ts) were
    // entirely absent from this guard — a project with any of them corrupted
    // to the wrong type entirely still validated as fully valid. Added here
    // using the exact same Array.isArray + message pattern as every sibling
    // above; see the id-uniqueness/cross-reference rules further down for the
    // deeper checks these fields also lacked.
    [project.craftingStations, 'craftingStations'],
    [project.marketNodes, 'marketNodes'],
    [project.tilesets, 'tilesets'],
    [project.tileLayers, 'tileLayers'],
    [project.props, 'props'],
    [project.propPlacements, 'propPlacements'],
    [project.ambientLayers, 'ambientLayers'],
  ];
  for (const [value, field] of requiredArrays) {
    if (!Array.isArray(value)) {
      errors.push({
        path: field,
        message: `Expected "${field}" to be an array but got ${value === null ? 'null' : typeof value}. The project file may be corrupted or truncated.`,
      });
    }
  }

  // F-4b9345d3: the town layer's three arrays are OPTIONAL (project.ts:72-74),
  // so they cannot join requiredArrays — a legacy project that omits them is
  // valid and must stay valid. But "absent" and "corrupted to a non-array" are
  // different facts, and rules 87-89 below iterate these fields. Guard the
  // second case only: present-but-wrong-type is reported here, absent passes
  // through untouched.
  const optionalArrays: [unknown, string][] = [
    [project.buildings, 'buildings'],
    [project.hubs, 'hubs'],
    [project.strongholds, 'strongholds'],
  ];
  for (const [value, field] of optionalArrays) {
    if (value !== undefined && !Array.isArray(value)) {
      errors.push({
        path: field,
        message: `Expected "${field}" to be an array but got ${value === null ? 'null' : typeof value}. The project file may be corrupted or truncated.`,
      });
    }
  }

  if (errors.length > 0) {
    return { valid: false, errors, warningCount: 0 };
  }

  // SCH-A-004: Project metadata type guards — author/license/category are optional
  // strings in the schema, but external JSON imports can corrupt them to non-strings
  // (null, number, object). Advisory used to silently coerce these to empty strings,
  // masking import bugs. Validate loudly here so data corruption surfaces early.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const projAny = project as any;
  if (projAny.author !== undefined && typeof projAny.author !== 'string') {
    errors.push({
      path: 'author',
      message: `Project author must be a string when present (got ${typeof projAny.author}).`,
    });
  }
  if (projAny.license !== undefined && typeof projAny.license !== 'string') {
    errors.push({
      path: 'license',
      message: `Project license must be a string when present (got ${typeof projAny.license}).`,
    });
  }
  if (projAny.category !== undefined && typeof projAny.category !== 'string') {
    errors.push({
      path: 'category',
      message: `Project category must be a string when present (got ${typeof projAny.category}).`,
    });
  }

  // F-004: isValidMode() was exported specifically to guard this field but was
  // never called from here, so a garbage `mode` value passed validateProject
  // silently and only surfaced later as a soft, non-blocking advisory.
  if (project.mode !== undefined && !isValidMode(project.mode)) {
    errors.push({
      path: 'mode',
      message: `Project mode "${project.mode}" is not a supported authoring mode (expected one of: ${AUTHORING_MODES.join(', ')}).`,
    });
  }

  // 1. At least one spawn point
  if (project.spawnPoints.length === 0) {
    errors.push({ path: 'spawnPoints', message: 'At least one spawn point is required' });
  }

  // 2. At least one default spawn point
  if (project.spawnPoints.length > 0 && !project.spawnPoints.some((sp) => sp.isDefault)) {
    errors.push({ path: 'spawnPoints', message: 'At least one spawn point must be marked as default' });
  }

  // 3. ID uniqueness — zones
  const zoneIds = new Set<string>();
  for (const z of project.zones) {
    if (zoneIds.has(z.id)) {
      errors.push({ path: `zones.${z.id}`, message: `Duplicate zone ID: ${z.id}` });
    }
    zoneIds.add(z.id);
  }

  // 4. ID uniqueness — districts
  const districtIds = new Set<string>();
  for (const d of project.districts) {
    if (districtIds.has(d.id)) {
      errors.push({ path: `districts.${d.id}`, message: `Duplicate district ID: ${d.id}` });
    }
    districtIds.add(d.id);
  }

  // 5. Zone neighbors must reference existing zones
  for (const z of project.zones) {
    for (const nid of z.neighbors) {
      if (!zoneIds.has(nid)) {
        errors.push({ path: `zones.${z.id}.neighbors`, message: `Zone "${z.id}" references nonexistent neighbor "${nid}"` });
      }
    }
  }

  // 6. Symmetrical neighbors — if A lists B, B should list A
  // Build zone map and neighbor Sets for O(1) lookups (avoids O(n²) find + O(n³) includes)
  const zoneMap = new Map(project.zones.map((z) => [z.id, z]));
  const neighborSets = new Map(project.zones.map((z) => [z.id, new Set(z.neighbors)]));
  for (const z of project.zones) {
    for (const nid of z.neighbors) {
      // Skip symmetry check for nonexistent neighbors — already reported in step 5.
      // Without this guard, we'd silently skip instead of making intent clear.
      if (!neighborSets.has(nid)) continue;
      const neighborSet = neighborSets.get(nid)!;
      if (!neighborSet.has(z.id)) {
        errors.push({
          path: `zones.${z.id}.neighbors`,
          message: `Zone "${z.id}" lists "${nid}" as neighbor, but "${nid}" does not list "${z.id}" back`,
        });
      }
    }
  }

  // 6b. Zone exits must reference existing zones, and each exit's condition
  // (when set) must be a legal SpawnCondition (F-007). ZoneExit.targetZoneId
  // is the same kind of zone-to-zone reference as neighbors[] (rule 5) and
  // ZoneConnection.toZoneId (rule 11) — checked the same way for consistency.
  for (const z of project.zones) {
    for (const exit of z.exits) {
      if (!zoneIds.has(exit.targetZoneId)) {
        errors.push({
          path: `zones.${z.id}.exits`,
          message: `Zone "${z.id}" has an exit to nonexistent zone "${exit.targetZoneId}"`,
        });
      }
      const exitCondErr = validateSpawnCondition(exit.condition);
      if (exitCondErr) {
        errors.push({
          path: `zones.${z.id}.exits`,
          message: `Zone "${z.id}" exit to "${exit.targetZoneId}": ${exitCondErr}`,
        });
      }
    }
  }

  // 7. District zoneIds must reference existing zones
  for (const d of project.districts) {
    for (const zid of d.zoneIds) {
      if (!zoneIds.has(zid)) {
        errors.push({ path: `districts.${d.id}.zoneIds`, message: `District "${d.id}" references nonexistent zone "${zid}"` });
      }
    }
  }

  // 8. Entity placements must reference valid zones
  for (const ep of project.entityPlacements) {
    if (!zoneIds.has(ep.zoneId)) {
      errors.push({ path: `entityPlacements.${ep.entityId}`, message: `Entity "${ep.entityId}" placed in nonexistent zone "${ep.zoneId}"` });
    }
  }

  // 9. Item placements must reference valid zones
  for (const ip of project.itemPlacements) {
    if (!zoneIds.has(ip.zoneId)) {
      errors.push({ path: `itemPlacements.${ip.itemId}`, message: `Item "${ip.itemId}" placed in nonexistent zone "${ip.zoneId}"` });
    }
  }

  // 10. Spawn points must reference valid zones
  for (const sp of project.spawnPoints) {
    if (!zoneIds.has(sp.zoneId)) {
      errors.push({ path: `spawnPoints.${sp.id}`, message: `Spawn point "${sp.id}" in nonexistent zone "${sp.zoneId}"` });
    }
  }

  // 11. Connections must reference valid zones (kinds validated against VALID_CONNECTION_KINDS — module-level constant)
  for (const c of project.connections) {
    if (!zoneIds.has(c.fromZoneId)) {
      errors.push({ path: 'connections', message: `Connection references nonexistent zone "${c.fromZoneId}"` });
    }
    if (!zoneIds.has(c.toZoneId)) {
      errors.push({ path: 'connections', message: `Connection references nonexistent zone "${c.toZoneId}"` });
    }
    // 11b. Connection kind must be valid
    if (c.kind && !VALID_CONNECTION_KINDS.has(c.kind)) {
      errors.push({ path: 'connections', message: `Connection has unsupported kind "${c.kind}"` });
    }
    // 11c. Connection condition must be a legal SpawnCondition (F-007) —
    // mirrors rule 59/78's use of the shared validator.
    const connCondErr = validateSpawnCondition(c.condition);
    if (connCondErr) {
      errors.push({ path: 'connections', message: `Connection: ${connCondErr}` });
    }
  }

  // 12. Landmark zoneIds must exist
  for (const lm of project.landmarks) {
    if (!zoneIds.has(lm.zoneId)) {
      errors.push({ path: `landmarks.${lm.id}`, message: `Landmark "${lm.id}" in nonexistent zone "${lm.zoneId}"` });
    }
  }

  // 13a. Encounter anchor ID uniqueness
  const encounterIds = new Set<string>();
  for (const ea of project.encounterAnchors) {
    if (encounterIds.has(ea.id)) {
      errors.push({ path: `encounterAnchors.${ea.id}`, message: `Duplicate encounter anchor ID: ${ea.id}` });
    }
    encounterIds.add(ea.id);
  }

  // 13b. Encounter anchor zoneId must exist
  for (const ea of project.encounterAnchors) {
    if (!zoneIds.has(ea.zoneId)) {
      errors.push({ path: `encounterAnchors.${ea.id}`, message: `Encounter anchor "${ea.id}" in nonexistent zone "${ea.zoneId}"` });
    }
  }

  // 13c. Encounter anchor encounterType must be non-empty and not whitespace-only
  for (const ea of project.encounterAnchors) {
    if (!ea.encounterType || ea.encounterType.trim().length === 0) {
      errors.push({
        path: `encounterAnchors.${ea.id}`,
        message: `Encounter anchor "${ea.id}" has ${!ea.encounterType ? 'missing' : 'whitespace-only'} encounterType — provide a type like "combat", "ambush", or "random"`,
      });
    }
  }

  // 14. Faction districtIds must reference valid districts
  for (const fp of project.factionPresences) {
    for (const did of fp.districtIds) {
      if (!districtIds.has(did)) {
        errors.push({ path: `factionPresences.${fp.factionId}`, message: `Faction "${fp.factionId}" references nonexistent district "${did}"` });
      }
    }
  }

  // 15a. Pressure hotspot ID uniqueness
  const hotspotIds = new Set<string>();
  for (const ph of project.pressureHotspots) {
    if (hotspotIds.has(ph.id)) {
      errors.push({ path: `pressureHotspots.${ph.id}`, message: `Duplicate pressure hotspot ID: ${ph.id}` });
    }
    hotspotIds.add(ph.id);
  }

  // 15b. Pressure hotspot zoneId must exist
  for (const ph of project.pressureHotspots) {
    if (!zoneIds.has(ph.zoneId)) {
      errors.push({ path: `pressureHotspots.${ph.id}`, message: `Pressure hotspot "${ph.id}" in nonexistent zone "${ph.zoneId}"` });
    }
  }

  // --- Dialogue validation ---

  const dialogueIds = new Set<string>();

  for (const dlg of project.dialogues) {
    // 16. Dialogue ID uniqueness
    if (dialogueIds.has(dlg.id)) {
      errors.push({ path: `dialogues.${dlg.id}`, message: `Duplicate dialogue ID: ${dlg.id}` });
    }
    dialogueIds.add(dlg.id);

    // 17. Entry node must exist
    if (!dlg.nodes[dlg.entryNodeId]) {
      errors.push({
        path: `dialogues.${dlg.id}.entryNodeId`,
        message: `Dialogue "${dlg.id}" entry node "${dlg.entryNodeId}" does not exist in nodes`,
      });
    }

    // 18. All nextNodeId references must point to existing nodes
    const nodeIds = new Set(Object.keys(dlg.nodes));
    for (const [nodeId, node] of Object.entries(dlg.nodes)) {
      if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) {
        errors.push({
          path: `dialogues.${dlg.id}.nodes.${nodeId}.nextNodeId`,
          message: `Node "${nodeId}" auto-advances to nonexistent node "${node.nextNodeId}"`,
        });
      }
      if (node.choices) {
        for (const choice of node.choices) {
          if (!nodeIds.has(choice.nextNodeId)) {
            errors.push({
              path: `dialogues.${dlg.id}.nodes.${nodeId}.choices.${choice.id}`,
              message: `Choice "${choice.id}" in node "${nodeId}" points to nonexistent node "${choice.nextNodeId}"`,
            });
          }
        }
      }
    }

    // 19. Unreachable nodes (not reachable from entry)
    //
    // SCH-B-002 (v4.4): Previously this entire check was silently skipped when
    // `dlg.entryNodeId` was missing or pointed at a nonexistent node. That hid
    // orphaned nodes until the export step crashed. Now:
    //   (a) when the entry is broken, we still report every node as unreachable
    //       so the user sees exactly what is orphaned — with dialogue id context;
    //   (b) we also emit an explicit guidance error naming the broken entry.
    if (dlg.nodes[dlg.entryNodeId]) {
      const reachable = new Set<string>();
      const queue = [dlg.entryNodeId];
      while (queue.length > 0) {
        const current = queue.pop();
        if (!current || reachable.has(current)) continue;
        reachable.add(current);
        const nd = dlg.nodes[current];
        if (!nd) continue;
        if (nd.nextNodeId && nodeIds.has(nd.nextNodeId)) queue.push(nd.nextNodeId);
        if (nd.choices) {
          for (const ch of nd.choices) {
            if (nodeIds.has(ch.nextNodeId)) queue.push(ch.nextNodeId);
          }
        }
      }
      for (const nid of nodeIds) {
        if (!reachable.has(nid)) {
          errors.push({
            path: `dialogues.${dlg.id}.nodes.${nid}`,
            message: `Node "${nid}" in dialogue "${dlg.id}" is unreachable from entry node "${dlg.entryNodeId}". Add a nextNodeId or choice that reaches it, or remove the node.`,
          });
        }
      }
    } else if (nodeIds.size > 0) {
      // Entry is broken AND the dialogue has nodes. Step 17 already flagged the
      // broken entry; surface the reachability gap too so orphans don't hide.
      errors.push({
        path: `dialogues.${dlg.id}`,
        message: `Unreachable dialogue detected: dialogue "${dlg.id}" has ${nodeIds.size} node(s) but the entry "${dlg.entryNodeId}" does not resolve, so reachability cannot be checked. Fix entryNodeId to point at a real node so orphaned nodes can be validated.`,
      });
      for (const nid of nodeIds) {
        errors.push({
          path: `dialogues.${dlg.id}.nodes.${nid}`,
          message: `Node "${nid}" in dialogue "${dlg.id}" is unreachable because entry node "${dlg.entryNodeId}" does not exist. Fix the entryNodeId first, then re-validate.`,
        });
      }
    }
  }

  // 20. Entity dialogueId must reference existing dialogue
  for (const ep of project.entityPlacements) {
    if (ep.dialogueId && !dialogueIds.has(ep.dialogueId)) {
      errors.push({
        path: `entityPlacements.${ep.entityId}.dialogueId`,
        message: `Entity "${ep.entityId}" references nonexistent dialogue "${ep.dialogueId}"`,
      });
    }
  }

  // --- Player template validation ---

  const spawnPointIds = new Set(project.spawnPoints.map((sp) => sp.id));

  if (project.playerTemplate) {
    const pt = project.playerTemplate;

    // 21. Spawn point must exist
    if (!spawnPointIds.has(pt.spawnPointId)) {
      errors.push({
        path: 'playerTemplate.spawnPointId',
        message: `Player template spawn point "${pt.spawnPointId}" does not exist`,
      });
    }

    // 22. Starting inventory items should exist in item placements
    const itemIds = new Set(project.itemPlacements.map((ip) => ip.itemId));
    for (const itemId of pt.startingInventory) {
      if (!itemIds.has(itemId)) {
        errors.push({
          path: `playerTemplate.startingInventory`,
          message: `Player template starting item "${itemId}" not found in item placements`,
        });
      }
    }

    // 23. Starting equipment items should exist
    for (const [slot, itemId] of Object.entries(pt.startingEquipment)) {
      if (!itemIds.has(itemId)) {
        errors.push({
          path: `playerTemplate.startingEquipment.${slot}`,
          message: `Player template equipment "${itemId}" in slot "${slot}" not found in item placements`,
        });
      }
    }

    // 24. Default archetype/background requires buildCatalog to exist
    if (pt.defaultArchetypeId && !project.buildCatalog) {
      errors.push({
        path: 'playerTemplate.defaultArchetypeId',
        message: `Player template references archetype "${pt.defaultArchetypeId}" but no buildCatalog is defined. Add a buildCatalog with archetypes[], or clear playerTemplate.defaultArchetypeId.`,
      });
    }
    if (pt.defaultBackgroundId && !project.buildCatalog) {
      errors.push({
        path: 'playerTemplate.defaultBackgroundId',
        message: `Player template references background "${pt.defaultBackgroundId}" but no buildCatalog is defined. Add a buildCatalog with backgrounds[], or clear playerTemplate.defaultBackgroundId.`,
      });
    }

    // 25. Default archetype must exist in build catalog
    if (pt.defaultArchetypeId && project.buildCatalog) {
      if (!project.buildCatalog.archetypes.some((a) => a.id === pt.defaultArchetypeId)) {
        errors.push({
          path: 'playerTemplate.defaultArchetypeId',
          message: `Player template references archetype "${pt.defaultArchetypeId}" which is not in buildCatalog.archetypes[]. Add it to the catalog, or pick an existing archetype id.`,
        });
      }
    }

    // 26. Default background must exist in build catalog
    if (pt.defaultBackgroundId && project.buildCatalog) {
      if (!project.buildCatalog.backgrounds.some((b) => b.id === pt.defaultBackgroundId)) {
        errors.push({
          path: 'playerTemplate.defaultBackgroundId',
          message: `Player template references background "${pt.defaultBackgroundId}" which is not in buildCatalog.backgrounds[]. Add it to the catalog, or pick an existing background id.`,
        });
      }
    }
  }

  // --- Build catalog validation ---

  if (project.buildCatalog) {
    const bc = project.buildCatalog;
    const archetypeIds = new Set<string>();
    const traitIds = new Set<string>();
    const disciplineIds = new Set<string>();

    // 27. Archetype ID uniqueness + progression tree refs
    const progressionTreeIds = new Set(project.progressionTrees.map((t) => t.id));
    for (const arch of bc.archetypes) {
      if (archetypeIds.has(arch.id)) {
        errors.push({ path: `buildCatalog.archetypes.${arch.id}`, message: `Duplicate archetype ID: ${arch.id}` });
      }
      archetypeIds.add(arch.id);

      if (!progressionTreeIds.has(arch.progressionTreeId)) {
        errors.push({
          path: `buildCatalog.archetypes.${arch.id}.progressionTreeId`,
          message: `Archetype "${arch.id}" references nonexistent progression tree "${arch.progressionTreeId}"`,
        });
      }
    }

    // 28. Background ID uniqueness
    const backgroundIds = new Set<string>();
    for (const bg of bc.backgrounds) {
      if (backgroundIds.has(bg.id)) {
        errors.push({ path: `buildCatalog.backgrounds.${bg.id}`, message: `Duplicate background ID: ${bg.id}` });
      }
      backgroundIds.add(bg.id);
    }

    // 29. Trait ID uniqueness + incompatibility refs
    for (const trait of bc.traits) {
      if (traitIds.has(trait.id)) {
        errors.push({ path: `buildCatalog.traits.${trait.id}`, message: `Duplicate trait ID: ${trait.id}` });
      }
      traitIds.add(trait.id);
    }
    for (const trait of bc.traits) {
      if (trait.incompatibleWith) {
        for (const incompat of trait.incompatibleWith) {
          if (!traitIds.has(incompat)) {
            errors.push({
              path: `buildCatalog.traits.${trait.id}.incompatibleWith`,
              message: `Trait "${trait.id}" lists incompatible trait "${incompat}" that does not exist`,
            });
          }
        }
      }
    }

    // 30. Discipline ID uniqueness
    for (const disc of bc.disciplines) {
      if (disciplineIds.has(disc.id)) {
        errors.push({ path: `buildCatalog.disciplines.${disc.id}`, message: `Duplicate discipline ID: ${disc.id}` });
      }
      disciplineIds.add(disc.id);
    }

    // 31. Cross-title refs must point to existing archetypes + disciplines
    for (const ct of bc.crossTitles) {
      if (!archetypeIds.has(ct.archetypeId)) {
        errors.push({
          path: `buildCatalog.crossTitles`,
          message: `Cross-title references nonexistent archetype "${ct.archetypeId}"`,
        });
      }
      if (!disciplineIds.has(ct.disciplineId)) {
        errors.push({
          path: `buildCatalog.crossTitles`,
          message: `Cross-title references nonexistent discipline "${ct.disciplineId}"`,
        });
      }
    }

    // 32. Entanglement refs must point to existing archetypes + disciplines
    for (const ent of bc.entanglements) {
      if (!archetypeIds.has(ent.archetypeId)) {
        errors.push({
          path: `buildCatalog.entanglements.${ent.id}`,
          message: `Entanglement "${ent.id}" references nonexistent archetype "${ent.archetypeId}"`,
        });
      }
      if (!disciplineIds.has(ent.disciplineId)) {
        errors.push({
          path: `buildCatalog.entanglements.${ent.id}`,
          message: `Entanglement "${ent.id}" references nonexistent discipline "${ent.disciplineId}"`,
        });
      }
    }
  }

  // --- Progression tree validation ---

  const treeIds = new Set<string>();

  for (const tree of project.progressionTrees) {
    // 33. Tree ID uniqueness
    if (treeIds.has(tree.id)) {
      errors.push({ path: `progressionTrees.${tree.id}`, message: `Duplicate progression tree ID: ${tree.id}` });
    }
    treeIds.add(tree.id);

    const nodeIds = new Set(tree.nodes.map((n) => n.id));
    const nodeIdDupes = new Set<string>();

    for (const node of tree.nodes) {
      // 34. Node ID uniqueness within tree
      if (nodeIdDupes.has(node.id)) {
        errors.push({
          path: `progressionTrees.${tree.id}.nodes.${node.id}`,
          message: `Duplicate node ID "${node.id}" in tree "${tree.id}"`,
        });
      }
      nodeIdDupes.add(node.id);

      // 35. Required node refs must exist
      if (node.requires) {
        for (const reqId of node.requires) {
          if (!nodeIds.has(reqId)) {
            errors.push({
              path: `progressionTrees.${tree.id}.nodes.${node.id}.requires`,
              message: `Node "${node.id}" requires nonexistent node "${reqId}" in tree "${tree.id}"`,
            });
          }
        }
      }
    }

    // 36. Unreachable nodes — a node is reachable/unlockable only when it IS a
    // root (no requires) or when EVERY node in its requires[] list is itself
    // reachable (F-003). This is a Kahn's-algorithm-style fixpoint: seed with
    // roots, then repeatedly unlock any node whose full requires[] is already
    // satisfied, until nothing new unlocks. It mirrors rule 19's dialogue
    // `reachable` Set + queue pattern, but is AND-gated (not OR) because
    // ProgressionNode.requires is a real prerequisite list, not a branch.
    //
    // The OLD check only verified `roots.length > 0` — it never walked the
    // graph, so a real root elsewhere in the tree masked a fully disconnected
    // requires-cycle island (e.g. "x requires y" + "y requires x", neither
    // ever reachable from any root). That island now correctly stays
    // unreached: neither node's prerequisites are ever satisfied.
    const roots = tree.nodes.filter((n) => !n.requires || n.requires.length === 0);
    if (roots.length === 0 && tree.nodes.length > 0) {
      errors.push({
        path: `progressionTrees.${tree.id}`,
        message: `Progression tree "${tree.id}" has no root nodes (all nodes have requirements)`,
      });
    } else {
      const reachable = new Set<string>(roots.map((n) => n.id));
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of tree.nodes) {
          if (reachable.has(node.id)) continue;
          const reqs = node.requires ?? [];
          if (reqs.length > 0 && reqs.every((r) => reachable.has(r))) {
            reachable.add(node.id);
            changed = true;
          }
        }
      }
      for (const node of tree.nodes) {
        if (!reachable.has(node.id)) {
          errors.push({
            path: `progressionTrees.${tree.id}.nodes.${node.id}`,
            message: `Node "${node.id}" in progression tree "${tree.id}" is unreachable — its requirement chain never resolves back to a root node (check for a requires cycle or a dependency on a node that is itself unreachable).`,
          });
        }
      }
    }
  }

  // --- Asset validation ---

  // Asset kinds validated against VALID_ASSET_KINDS — module-level constant derived from AssetKind type
  const assetIds = new Set<string>();
  const assetMap = new Map<string, { kind: string }>();

  // 37. Asset ID uniqueness
  for (const a of project.assets) {
    if (assetIds.has(a.id)) {
      errors.push({ path: `assets.${a.id}`, message: `Duplicate asset ID: ${a.id}` });
    }
    assetIds.add(a.id);
    assetMap.set(a.id, { kind: a.kind });
  }

  // 38. Asset path must be non-empty
  for (const a of project.assets) {
    if (!a.path || a.path.trim().length === 0) {
      errors.push({ path: `assets.${a.id}.path`, message: `Asset "${a.id}" has empty path` });
    }
  }

  // 39. Asset kind must be valid
  for (const a of project.assets) {
    if (!VALID_ASSET_KINDS.has(a.kind)) {
      errors.push({ path: `assets.${a.id}.kind`, message: `Asset "${a.id}" has unsupported kind "${a.kind}"` });
    }
  }

  // Helper: check asset ref exists and has correct kind.
  // Provides full source context (who references what, which field, expected kind)
  // so the user can locate and fix the issue quickly.
  //
  // Null/undefined refs are INTENTIONALLY SKIPPED — they express "field present
  // in schema but intentionally unset" (optional-field semantics). Typical
  // callers: zone.backgroundId, zone.tilesetId, entity.portraitId, entity.spriteId,
  // item.iconId, landmark.iconId. These become user-facing "missing asset"
  // warnings only at export time, not at schema-validation time.
  function checkAssetRef(refId: string | undefined, expectedKind: string, path: string, label: string) {
    // Null/undefined refId means the field is optional and unset — not an error.
    // (e.g. zone.backgroundId, entity.portraitId are optional asset bindings)
    if (!refId) return;
    if (!assetIds.has(refId)) {
      errors.push({
        path,
        message: `${label} references nonexistent asset "${refId}" (expected a "${expectedKind}" asset). Check that the asset ID is correct and exists in the assets array.`,
      });
      return;
    }
    const asset = assetMap.get(refId);
    if (asset && asset.kind !== expectedKind) {
      errors.push({
        path,
        message: `${label} references asset "${refId}" of kind "${asset.kind}", expected "${expectedKind}". Assign a "${expectedKind}" asset instead.`,
      });
    }
  }

  // 40-41. Zone asset refs
  for (const z of project.zones) {
    checkAssetRef(z.backgroundId, 'background', `zones.${z.id}.backgroundId`, `Zone "${z.id}"`);
    checkAssetRef(z.tilesetId, 'tileset', `zones.${z.id}.tilesetId`, `Zone "${z.id}"`);
  }

  // 42-43. Entity asset refs
  for (const ep of project.entityPlacements) {
    checkAssetRef(ep.portraitId, 'portrait', `entityPlacements.${ep.entityId}.portraitId`, `Entity "${ep.entityId}"`);
    checkAssetRef(ep.spriteId, 'sprite', `entityPlacements.${ep.entityId}.spriteId`, `Entity "${ep.entityId}"`);
  }

  // 44. Item asset refs
  for (const ip of project.itemPlacements) {
    checkAssetRef(ip.iconId, 'icon', `itemPlacements.${ip.itemId}.iconId`, `Item "${ip.itemId}"`);
  }

  // 45. Landmark asset refs
  for (const lm of project.landmarks) {
    checkAssetRef(lm.iconId, 'icon', `landmarks.${lm.id}.iconId`, `Landmark "${lm.id}"`);
  }

  // 46. Orphaned assets (in manifest but unreferenced)
  const referencedAssetIds = new Set<string>();
  for (const z of project.zones) {
    if (z.backgroundId) referencedAssetIds.add(z.backgroundId);
    if (z.tilesetId) referencedAssetIds.add(z.tilesetId);
    // 2.5D (v4.2.0): skyline + parallax assetRefs also count as valid references.
    if (z.skylineRef) referencedAssetIds.add(z.skylineRef);
    if (z.parallaxLayers) {
      for (const layer of z.parallaxLayers) {
        if (layer.assetRef) referencedAssetIds.add(layer.assetRef);
      }
    }
  }
  for (const ep of project.entityPlacements) {
    if (ep.portraitId) referencedAssetIds.add(ep.portraitId);
    if (ep.spriteId) referencedAssetIds.add(ep.spriteId);
  }
  for (const ip of project.itemPlacements) {
    if (ip.iconId) referencedAssetIds.add(ip.iconId);
  }
  for (const lm of project.landmarks) {
    if (lm.iconId) referencedAssetIds.add(lm.iconId);
  }
  for (const a of project.assets) {
    if (!referencedAssetIds.has(a.id)) {
      errors.push({ path: `assets.${a.id}`, message: `Asset "${a.id}" (${a.kind}) is not referenced by any zone, entity, item, or landmark` });
    }
  }

  // --- Asset pack validation ---

  const packIds = new Set<string>();

  // 47. Pack ID uniqueness
  for (const pack of project.assetPacks) {
    if (packIds.has(pack.id)) {
      errors.push({ path: `assetPacks.${pack.id}`, message: `Duplicate asset pack ID: ${pack.id}` });
    }
    packIds.add(pack.id);
  }

  // 48. Pack label must be non-empty
  for (const pack of project.assetPacks) {
    if (!pack.label || pack.label.trim().length === 0) {
      errors.push({ path: `assetPacks.${pack.id}.label`, message: `Asset pack "${pack.id}" has empty label` });
    }
  }

  // 49. Pack version must be non-empty
  for (const pack of project.assetPacks) {
    if (!pack.version || pack.version.trim().length === 0) {
      errors.push({ path: `assetPacks.${pack.id}.version`, message: `Asset pack "${pack.id}" has empty version` });
    }
  }

  // 50. Asset packId must reference existing pack
  for (const a of project.assets) {
    if (a.packId && !packIds.has(a.packId)) {
      errors.push({ path: `assets.${a.id}.packId`, message: `Asset "${a.id}" references nonexistent pack "${a.packId}"` });
    }
  }

  // 51. Orphaned packs (no assets use this packId)
  const usedPackIds = new Set<string>();
  for (const a of project.assets) {
    if (a.packId) usedPackIds.add(a.packId);
  }
  for (const pack of project.assetPacks) {
    if (!usedPackIds.has(pack.id)) {
      errors.push({ path: `assetPacks.${pack.id}`, message: `Asset pack "${pack.id}" has no assets assigned to it` });
    }
  }

  // 52. Pack version must be valid semver format (x.y.z) — uses module-level SEMVER_PATTERN
  for (const pack of project.assetPacks) {
    if (pack.version && pack.version.trim().length > 0 && !SEMVER_PATTERN.test(pack.version)) {
      errors.push({ path: `assetPacks.${pack.id}.version`, message: `Asset pack "${pack.id}" version "${pack.version}" is not valid semver (expected x.y.z)` });
    }
  }

  // 53. 2.5D elevation range sanity — floor < ceiling, both must be finite.
  // Without the finite-number guard, NaN/Infinity slip through because
  // `!(NaN < Infinity)` evaluates true and would fail silently elsewhere.
  for (const zone of project.zones) {
    if (zone.elevationRange) {
      const { floor, ceiling } = zone.elevationRange;
      if (!Number.isFinite(floor) || !Number.isFinite(ceiling)) {
        errors.push({
          path: `zones.${zone.id}.elevationRange`,
          message: `Zone "${zone.id}" elevationRange floor and ceiling must be finite numbers (got floor=${floor}, ceiling=${ceiling}).`,
        });
      } else if (!(floor < ceiling)) {
        errors.push({
          path: `zones.${zone.id}.elevationRange`,
          message: `Zone "${zone.id}" elevationRange requires floor (${floor}) < ceiling (${ceiling}).`,
        });
      }
    }
  }

  // 54. 2.5D parallax layer depth must be unique per zone.
  // Also validates assetRef resolves to an asset of kind 'background' or 'sprite'
  // (SCH-A-002) and that scrollFactor is finite in [0.0, 1.0] (SCH-A-003).
  for (const zone of project.zones) {
    if (!zone.parallaxLayers || zone.parallaxLayers.length === 0) continue;
    const seenDepths = new Map<number, string>();
    const seenIds = new Set<string>();
    for (const layer of zone.parallaxLayers) {
      // SCH-A-006: layer.id must be non-empty and not whitespace-only.
      // Checked before dedup so an empty id still errors informatively instead
      // of colliding under the dedup Set on the empty string.
      if (!layer.id || layer.id.trim().length === 0) {
        errors.push({
          path: `zones.${zone.id}.parallaxLayers.${layer.id}`,
          message: `Zone "${zone.id}" has a parallax layer with ${!layer.id ? 'missing' : 'whitespace-only'} id — provide a non-empty id.`,
        });
      }
      if (seenIds.has(layer.id)) {
        errors.push({
          path: `zones.${zone.id}.parallaxLayers.${layer.id}`,
          message: `Zone "${zone.id}" has duplicate parallax layer id "${layer.id}".`,
        });
      } else {
        seenIds.add(layer.id);
      }
      // SCH-A-005: layer.depth must be a finite number. Without this guard
      // NaN/Infinity slip through dedup (NaN !== NaN) and break renderer sort.
      if (!Number.isFinite(layer.depth)) {
        errors.push({
          path: `zones.${zone.id}.parallaxLayers.${layer.id}.depth`,
          message: `Zone "${zone.id}" parallax layer "${layer.id}" depth (${layer.depth}) must be a finite number.`,
        });
      }
      const prior = seenDepths.get(layer.depth);
      if (prior !== undefined) {
        errors.push({
          path: `zones.${zone.id}.parallaxLayers.${layer.id}.depth`,
          message: `Zone "${zone.id}" parallax layers "${prior}" and "${layer.id}" share depth ${layer.depth}. Depth must be unique within a zone.`,
        });
      } else {
        seenDepths.set(layer.depth, layer.id);
      }

      // SCH-A-002: assetRef must resolve to a 'background' or 'sprite' asset.
      // checkAssetRef only supports a single expectedKind, so we inline the
      // two-kind variant here rather than extending the helper signature.
      const refId = layer.assetRef;
      const refPath = `zones.${zone.id}.parallaxLayers.${layer.id}.assetRef`;
      const refLabel = `Zone "${zone.id}" parallax layer "${layer.id}"`;
      if (!refId) {
        errors.push({
          path: refPath,
          message: `${refLabel} is missing assetRef (expected a "background" or "sprite" asset).`,
        });
      } else if (!assetIds.has(refId)) {
        errors.push({
          path: refPath,
          message: `${refLabel} references nonexistent asset "${refId}" (expected a "background" or "sprite" asset). Check that the asset ID is correct and exists in the assets array.`,
        });
      } else {
        const asset = assetMap.get(refId);
        if (asset && asset.kind !== 'background' && asset.kind !== 'sprite') {
          errors.push({
            path: refPath,
            message: `${refLabel} references asset "${refId}" of kind "${asset.kind}", expected "background" or "sprite". Assign a "background" or "sprite" asset instead.`,
          });
        }
      }

      // SCH-A-003: scrollFactor must be finite and within [0.0, 1.0] inclusive.
      // Rejects NaN, Infinity, negatives, and values > 1.
      const sf = layer.scrollFactor;
      if (!Number.isFinite(sf) || sf < 0 || sf > 1) {
        errors.push({
          path: `zones.${zone.id}.parallaxLayers.${layer.id}.scrollFactor`,
          message: `Zone "${zone.id}" parallax layer "${layer.id}" scrollFactor (${sf}) must be a finite number in [0.0, 1.0].`,
        });
      }
    }
  }

  // 55. 2.5D Zone.skylineRef — if set, must resolve to a 'background' asset.
  // (SCH-A-004) Mirrors the zone backgroundId/tilesetId pattern above.
  for (const zone of project.zones) {
    checkAssetRef(zone.skylineRef, 'background', `zones.${zone.id}.skylineRef`, `Zone "${zone.id}"`);
  }

  // --- LootTable validation (SCH-FT-001) ---

  const lootTables = project.lootTables ?? [];
  const lootTableIds = new Set<string>();

  // 56. LootTable ID uniqueness
  for (const lt of lootTables) {
    if (lootTableIds.has(lt.id)) {
      errors.push({ path: `lootTables.${lt.id}`, message: `Duplicate loot table ID: ${lt.id}` });
    }
    lootTableIds.add(lt.id);

    if (!lt.entries || lt.entries.length === 0) {
      errors.push({
        path: `lootTables.${lt.id}.entries`,
        message: `Loot table "${lt.id}" must contain at least one entry`,
      });
    }

    // 58 (rolls half): rolls >= 1 when provided.
    if (lt.rolls !== undefined) {
      if (!Number.isFinite(lt.rolls) || lt.rolls < 1) {
        errors.push({
          path: `lootTables.${lt.id}.rolls`,
          message: `Loot table "${lt.id}" rolls (${lt.rolls}) must be a finite number >= 1`,
        });
      }
    }

    for (let i = 0; i < (lt.entries ?? []).length; i++) {
      const entry = lt.entries[i];
      // 57. Each entry's weight must be > 0 and finite.
      if (!Number.isFinite(entry.weight) || entry.weight <= 0) {
        errors.push({
          path: `lootTables.${lt.id}.entries[${i}]`,
          message: `Loot table "${lt.id}" entry "${entry.itemId}" weight (${entry.weight}) must be a finite number > 0`,
        });
      }

      // 58 (quantity half): quantity.min <= quantity.max, both >= 0 and finite.
      if (entry.quantity) {
        const { min, max } = entry.quantity;
        if (!Number.isFinite(min) || !Number.isFinite(max) || min < 0 || max < 0) {
          errors.push({
            path: `lootTables.${lt.id}.entries[${i}].quantity`,
            message: `Loot table "${lt.id}" entry "${entry.itemId}" quantity min (${min}) and max (${max}) must be finite numbers >= 0`,
          });
        } else if (min > max) {
          errors.push({
            path: `lootTables.${lt.id}.entries[${i}].quantity`,
            message: `Loot table "${lt.id}" entry "${entry.itemId}" quantity.min (${min}) must be <= quantity.max (${max})`,
          });
        }
      }

      // Entry condition reuses SpawnCondition grammar.
      if (entry.condition) {
        const condErr = validateSpawnCondition(entry.condition);
        if (condErr) {
          errors.push({
            path: `lootTables.${lt.id}.entries[${i}].condition`,
            message: `Loot table "${lt.id}" entry "${entry.itemId}": ${condErr}`,
          });
        }
      }
    }
  }

  // ItemPlacement.lootTableId must reference an existing loot table when set.
  for (const ip of project.itemPlacements) {
    if (ip.lootTableId && !lootTableIds.has(ip.lootTableId)) {
      errors.push({
        path: `itemPlacements.${ip.itemId}.lootTableId`,
        message: `Item "${ip.itemId}" references nonexistent loot table "${ip.lootTableId}"`,
      });
    }
  }

  // LootTable entry.itemId must reference an existing item placement.
  const allItemIds = new Set(project.itemPlacements.map((ip) => ip.itemId));
  for (const lt of lootTables) {
    for (let i = 0; i < (lt.entries ?? []).length; i++) {
      const entry = lt.entries[i];
      if (entry.itemId && !allItemIds.has(entry.itemId)) {
        errors.push({
          path: `lootTables.${lt.id}.entries[${i}].itemId`,
          message: `Loot table "${lt.id}" entry references nonexistent item "${entry.itemId}"`,
        });
      }
    }
  }

  // 59. EntityPlacement.spawnCondition grammar (SCH-FT-003).
  for (const ep of project.entityPlacements) {
    const condErr = validateSpawnCondition(ep.spawnCondition);
    if (condErr) {
      errors.push({
        path: `entityPlacements.${ep.entityId}.spawnCondition`,
        message: `Entity "${ep.entityId}": ${condErr}`,
      });
    }
  }

  // --- TransitionEntity validation (SCH-FT-004) ---

  const transitions = project.transitions ?? [];
  const transitionIds = new Set<string>();
  for (const t of transitions) {
    // 60. TransitionEntity id uniqueness.
    if (transitionIds.has(t.id)) {
      errors.push({ path: `transitions.${t.id}`, message: `Duplicate transition ID: ${t.id}` });
    }
    transitionIds.add(t.id);

    // 61. zoneId + targetZoneId must reference existing zones.
    if (!zoneIds.has(t.zoneId)) {
      errors.push({
        path: `transitions.${t.id}.zoneId`,
        message: `Transition "${t.id}" in nonexistent zone "${t.zoneId}"`,
      });
    }
    if (!zoneIds.has(t.targetZoneId)) {
      errors.push({
        path: `transitions.${t.id}.targetZoneId`,
        message: `Transition "${t.id}" targets nonexistent zone "${t.targetZoneId}"`,
      });
    }

    // 62. durationSeconds must be finite and >= 0 when present.
    if (t.durationSeconds !== undefined) {
      if (!Number.isFinite(t.durationSeconds) || t.durationSeconds < 0) {
        errors.push({
          path: `transitions.${t.id}.durationSeconds`,
          message: `Transition "${t.id}" durationSeconds (${t.durationSeconds}) must be a finite number >= 0`,
        });
      }
    }
  }

  // --- Zone physics + sky + collision validation (SCH-FT-006, UE-FT-002, UE-FT-003) ---

  const VALID_COLLISION_TYPES = new Set(['walkable', 'water', 'hazard', 'void', 'custom']);

  for (const zone of project.zones) {
    // 63. gravityOverride must be finite when set (can be 0 for zero-g).
    if (zone.gravityOverride !== undefined && !Number.isFinite(zone.gravityOverride)) {
      errors.push({
        path: `zones.${zone.id}.gravityOverride`,
        message: `Zone "${zone.id}" gravityOverride (${zone.gravityOverride}) must be a finite number`,
      });
    }

    // 64. Sky + lighting metadata sanity (only when set).
    if (zone.directionalLightYaw !== undefined) {
      if (!Number.isFinite(zone.directionalLightYaw) || zone.directionalLightYaw < -360 || zone.directionalLightYaw > 360) {
        errors.push({
          path: `zones.${zone.id}.directionalLightYaw`,
          message: `Zone "${zone.id}" directionalLightYaw (${zone.directionalLightYaw}) must be finite and within [-360, 360]`,
        });
      }
    }
    if (zone.directionalLightPitch !== undefined) {
      if (!Number.isFinite(zone.directionalLightPitch) || zone.directionalLightPitch < -90 || zone.directionalLightPitch > 90) {
        errors.push({
          path: `zones.${zone.id}.directionalLightPitch`,
          message: `Zone "${zone.id}" directionalLightPitch (${zone.directionalLightPitch}) must be finite and within [-90, 90]`,
        });
      }
    }
    if (zone.skyLightIntensity !== undefined) {
      if (!Number.isFinite(zone.skyLightIntensity) || zone.skyLightIntensity < 0) {
        errors.push({
          path: `zones.${zone.id}.skyLightIntensity`,
          message: `Zone "${zone.id}" skyLightIntensity (${zone.skyLightIntensity}) must be finite and >= 0`,
        });
      }
    }

    // 65. collisionType runtime guard (TS enforces at compile time for authored code,
    // but imported JSON can still smuggle in stray strings).
    if (zone.collisionType !== undefined && !VALID_COLLISION_TYPES.has(zone.collisionType)) {
      errors.push({
        path: `zones.${zone.id}.collisionType`,
        message: `Zone "${zone.id}" has unsupported collisionType "${zone.collisionType}" (expected one of: walkable, water, hazard, void, custom)`,
      });
    }
  }

  // --- World-modeling: strata + stratum links (SCH world-modeling slice 1) ---

  const strata = project.strata ?? [];
  const stratumIds = new Set<string>();

  // 66. Stratum ID uniqueness.
  for (const s of strata) {
    if (stratumIds.has(s.id)) {
      errors.push({ path: `strata.${s.id}`, message: `Duplicate stratum ID: ${s.id}` });
    }
    stratumIds.add(s.id);
  }

  // 67. Stratum zRange must be finite with floor < ceiling (mirrors elevationRange).
  for (const s of strata) {
    if (s.zRange) {
      const { floor, ceiling } = s.zRange;
      if (!Number.isFinite(floor) || !Number.isFinite(ceiling)) {
        errors.push({
          path: `strata.${s.id}.zRange`,
          message: `Stratum "${s.id}" zRange floor and ceiling must be finite numbers (got floor=${floor}, ceiling=${ceiling}).`,
        });
      } else if (!(floor < ceiling)) {
        errors.push({
          path: `strata.${s.id}.zRange`,
          message: `Stratum "${s.id}" zRange requires floor (${floor}) < ceiling (${ceiling}).`,
        });
      }
    }
  }

  // 68. Stratum order must be a finite number.
  for (const s of strata) {
    if (!Number.isFinite(s.order)) {
      errors.push({
        path: `strata.${s.id}.order`,
        message: `Stratum "${s.id}" order (${s.order}) must be a finite number.`,
      });
    }
  }

  // 69. Stratum.visibleStrata must reference existing strata.
  for (const s of strata) {
    for (const vid of s.visibleStrata ?? []) {
      if (!stratumIds.has(vid)) {
        errors.push({
          path: `strata.${s.id}.visibleStrata`,
          message: `Stratum "${s.id}" lists visible stratum "${vid}" that does not exist.`,
        });
      }
    }
  }

  // 70. Zone.stratumId must reference an existing stratum when set.
  for (const z of project.zones) {
    if (z.stratumId !== undefined && !stratumIds.has(z.stratumId)) {
      errors.push({
        path: `zones.${z.id}.stratumId`,
        message: `Zone "${z.id}" references nonexistent stratum "${z.stratumId}".`,
      });
    }
  }

  // 71. StratumLink ID uniqueness.
  const stratumLinkIds = new Set<string>();
  for (const l of project.stratumLinks ?? []) {
    if (stratumLinkIds.has(l.id)) {
      errors.push({ path: `stratumLinks.${l.id}`, message: `Duplicate stratum link ID: ${l.id}` });
    }
    stratumLinkIds.add(l.id);
  }

  // 72. StratumLink endpoints must reference existing strata; anchor zones (when set) existing zones.
  for (const l of project.stratumLinks ?? []) {
    if (!stratumIds.has(l.fromStratumId)) {
      errors.push({ path: `stratumLinks.${l.id}.fromStratumId`, message: `Stratum link "${l.id}" references nonexistent stratum "${l.fromStratumId}".` });
    }
    if (!stratumIds.has(l.toStratumId)) {
      errors.push({ path: `stratumLinks.${l.id}.toStratumId`, message: `Stratum link "${l.id}" references nonexistent stratum "${l.toStratumId}".` });
    }
    if (l.fromZoneId !== undefined && !zoneIds.has(l.fromZoneId)) {
      errors.push({ path: `stratumLinks.${l.id}.fromZoneId`, message: `Stratum link "${l.id}" anchors to nonexistent zone "${l.fromZoneId}".` });
    }
    if (l.toZoneId !== undefined && !zoneIds.has(l.toZoneId)) {
      errors.push({ path: `stratumLinks.${l.id}.toZoneId`, message: `Stratum link "${l.id}" anchors to nonexistent zone "${l.toZoneId}".` });
    }
  }

  // --- World-modeling: typed hazard definitions (SCH world-modeling slice 4) ---

  const VALID_HAZARD_TRIGGERS = new Set(['on-enter', 'per-turn', 'on-exit', 'timed']);
  const VALID_HAZARD_PASSABILITY = new Set(['yes', 'flying-only', 'never']);
  const hazardDefs = project.hazardDefinitions ?? [];
  const hazardIds = new Set<string>();

  for (const h of hazardDefs) {
    // 73. HazardDefinition ID uniqueness.
    if (hazardIds.has(h.id)) {
      errors.push({ path: `hazardDefinitions.${h.id}`, message: `Duplicate hazard ID: ${h.id}` });
    }
    hazardIds.add(h.id);

    // 74. Trigger must be a valid kind (TS guards authored code; imported JSON may not).
    if (!VALID_HAZARD_TRIGGERS.has(h.trigger)) {
      errors.push({ path: `hazardDefinitions.${h.id}.trigger`, message: `Hazard "${h.id}" has unsupported trigger "${h.trigger}" (expected on-enter, per-turn, on-exit, or timed).` });
    }

    // 75. Passability + moveCostDelta sanity when set.
    if (h.passable !== undefined && !VALID_HAZARD_PASSABILITY.has(h.passable)) {
      errors.push({ path: `hazardDefinitions.${h.id}.passable`, message: `Hazard "${h.id}" has unsupported passable "${h.passable}" (expected yes, flying-only, or never).` });
    }
    if (h.moveCostDelta !== undefined && !Number.isFinite(h.moveCostDelta)) {
      errors.push({ path: `hazardDefinitions.${h.id}.moveCostDelta`, message: `Hazard "${h.id}" moveCostDelta (${h.moveCostDelta}) must be a finite number.` });
    }

    // 76. Each effect must be well-formed for its kind (F-006). A `switch`
    // with a `default` arm gives compile-time exhaustiveness against future
    // HazardEffect variants AND a runtime catch-all for a `kind` that matches
    // none of the four known arms — the old if/else-if chain had no trailing
    // branch, so a garbled/typo'd/future kind silently produced zero errors.
    // 'instakill' is handled explicitly (no extra fields) so it is never
    // misflagged by that catch-all.
    for (let i = 0; i < h.effects.length; i++) {
      const e = h.effects[i];
      const base = `hazardDefinitions.${h.id}.effects[${i}]`;
      switch (e.kind) {
        case 'damage': {
          if (!Number.isFinite(e.amount)) {
            errors.push({ path: base, message: `Hazard "${h.id}" damage amount (${e.amount}) must be a finite number.` });
          }
          if (e.durationTicks !== undefined && (!Number.isFinite(e.durationTicks) || e.durationTicks < 0)) {
            errors.push({ path: base, message: `Hazard "${h.id}" damage durationTicks (${e.durationTicks}) must be a finite number >= 0.` });
          }
          // F-006: tickOn is REQUIRED on a damage effect but was never checked.
          if (e.tickOn !== 'turn-start' && e.tickOn !== 'turn-end') {
            errors.push({ path: base, message: `Hazard "${h.id}" damage effect has unsupported tickOn "${e.tickOn}" (expected turn-start or turn-end).` });
          }
          break;
        }
        case 'status': {
          if (!e.statusId || e.statusId.trim().length === 0) {
            errors.push({ path: base, message: `Hazard "${h.id}" status effect has a missing statusId.` });
          }
          if (!Number.isFinite(e.chance) || e.chance < 0 || e.chance > 1) {
            errors.push({ path: base, message: `Hazard "${h.id}" status chance (${e.chance}) must be a finite number in [0, 1].` });
          }
          break;
        }
        case 'ignite': {
          if (!Number.isFinite(e.igniteChance) || e.igniteChance < 0 || e.igniteChance > 1) {
            errors.push({ path: base, message: `Hazard "${h.id}" igniteChance (${e.igniteChance}) must be a finite number in [0, 1].` });
          }
          break;
        }
        case 'instakill':
          // No extra fields to validate.
          break;
        default: {
          // Compile-time exhaustiveness: fails to type-check if HazardEffect
          // ever grows a fifth `kind` variant without a case above. `never` has
          // no properties, so read `.kind` back off a widened cast — the
          // runtime value is whatever garbage/future data actually arrived.
          const _exhaustive: never = e;
          const unknownKind = (_exhaustive as { kind?: unknown }).kind;
          errors.push({ path: base, message: `Hazard "${h.id}" has an unsupported effect kind "${String(unknownKind)}".` });
        }
      }
    }
  }

  // 77. Zone.hazardRefs must reference existing hazard definitions.
  for (const z of project.zones) {
    for (const ref of z.hazardRefs ?? []) {
      if (!hazardIds.has(ref)) {
        errors.push({ path: `zones.${z.id}.hazardRefs`, message: `Zone "${z.id}" references nonexistent hazard "${ref}".` });
      }
    }
  }

  // 78. Zone entry gates — valid mode + every condition is a legal SpawnCondition.
  const VALID_GATE_MODES = new Set(['hard', 'soft']);
  for (const z of project.zones) {
    const gate = z.entryGate;
    if (!gate) continue;
    if (!VALID_GATE_MODES.has(gate.mode)) {
      errors.push({ path: `zones.${z.id}.entryGate.mode`, message: `Zone "${z.id}" entry gate has unsupported mode "${gate.mode}" (expected hard or soft).` });
    }
    if (!Array.isArray(gate.conditions) || gate.conditions.length === 0) {
      errors.push({ path: `zones.${z.id}.entryGate.conditions`, message: `Zone "${z.id}" entry gate must have at least one condition.` });
    } else {
      for (let i = 0; i < gate.conditions.length; i++) {
        const condErr = validateSpawnCondition(gate.conditions[i]);
        if (condErr) {
          errors.push({ path: `zones.${z.id}.entryGate.conditions[${i}]`, message: `Zone "${z.id}" entry gate: ${condErr}` });
        }
      }
    }
  }

  // --- World visual + economy layer validation (F-001, CRITICAL) ---
  //
  // craftingStations, marketNodes, tilesets, tileLayers, props, propPlacements,
  // and ambientLayers are required WorldProject fields (the structural guard
  // at the top of this function now enforces their array-ness) but previously
  // received NO further validation at all — no id-uniqueness, no
  // cross-reference checks anywhere in this ~80-rule pipeline. This section
  // brings them up to the same standard every other required-array field
  // already gets.

  // 79. CraftingStation ID uniqueness + zoneId existence.
  const craftingStationIds = new Set<string>();
  for (const cs of project.craftingStations) {
    if (craftingStationIds.has(cs.id)) {
      errors.push({ path: `craftingStations.${cs.id}`, message: `Duplicate crafting station ID: ${cs.id}` });
    }
    craftingStationIds.add(cs.id);
    if (!zoneIds.has(cs.zoneId)) {
      errors.push({ path: `craftingStations.${cs.id}.zoneId`, message: `Crafting station "${cs.id}" in nonexistent zone "${cs.zoneId}"` });
    }
  }

  // 80. MarketNode ID uniqueness + zoneId + merchantEntityId existence.
  const marketNodeIds = new Set<string>();
  const entityPlacementIds = new Set(project.entityPlacements.map((ep) => ep.entityId));
  for (const mn of project.marketNodes) {
    if (marketNodeIds.has(mn.id)) {
      errors.push({ path: `marketNodes.${mn.id}`, message: `Duplicate market node ID: ${mn.id}` });
    }
    marketNodeIds.add(mn.id);
    if (!zoneIds.has(mn.zoneId)) {
      errors.push({ path: `marketNodes.${mn.id}.zoneId`, message: `Market node "${mn.id}" in nonexistent zone "${mn.zoneId}"` });
    }
    if (mn.merchantEntityId && !entityPlacementIds.has(mn.merchantEntityId)) {
      errors.push({ path: `marketNodes.${mn.id}.merchantEntityId`, message: `Market node "${mn.id}" references nonexistent merchant entity "${mn.merchantEntityId}"` });
    }
  }

  // 81. Tileset ID uniqueness.
  const tilesetIds = new Set<string>();
  for (const ts of project.tilesets) {
    if (tilesetIds.has(ts.id)) {
      errors.push({ path: `tilesets.${ts.id}`, message: `Duplicate tileset ID: ${ts.id}` });
    }
    tilesetIds.add(ts.id);
  }

  // 82. TileDefinition ID uniqueness (global across all tilesets — TileLayer's
  // TilePlacement.tileId references tile ids in a single flat namespace with
  // no tileset scoping) and TileDefinition.tilesetId must reference an
  // existing tileset.
  const tileDefinitionIds = new Set<string>();
  for (const ts of project.tilesets) {
    for (const td of ts.tiles) {
      if (tileDefinitionIds.has(td.id)) {
        errors.push({ path: `tilesets.${ts.id}.tiles.${td.id}`, message: `Duplicate tile definition ID: ${td.id}` });
      }
      tileDefinitionIds.add(td.id);
      if (!tilesetIds.has(td.tilesetId)) {
        errors.push({ path: `tilesets.${ts.id}.tiles.${td.id}.tilesetId`, message: `Tile "${td.id}" references nonexistent tileset "${td.tilesetId}"` });
      }
    }
  }

  // 83. TileLayer ID uniqueness + TilePlacement.tileId existence (against the
  // global tile-definition id set built above).
  const tileLayerIds = new Set<string>();
  for (const tl of project.tileLayers) {
    if (tileLayerIds.has(tl.id)) {
      errors.push({ path: `tileLayers.${tl.id}`, message: `Duplicate tile layer ID: ${tl.id}` });
    }
    tileLayerIds.add(tl.id);
    for (const placement of tl.tiles) {
      if (!tileDefinitionIds.has(placement.tileId)) {
        errors.push({ path: `tileLayers.${tl.id}.tiles`, message: `Tile layer "${tl.id}" references nonexistent tile "${placement.tileId}"` });
      }
    }
  }

  // 84. PropDefinition ID uniqueness.
  const propDefinitionIds = new Set<string>();
  for (const pd of project.props) {
    if (propDefinitionIds.has(pd.id)) {
      errors.push({ path: `props.${pd.id}`, message: `Duplicate prop definition ID: ${pd.id}` });
    }
    propDefinitionIds.add(pd.id);
  }

  // 85. PropPlacement ID uniqueness + propId / zoneId (when set) existence.
  const propPlacementIds = new Set<string>();
  for (const pp of project.propPlacements) {
    if (propPlacementIds.has(pp.id)) {
      errors.push({ path: `propPlacements.${pp.id}`, message: `Duplicate prop placement ID: ${pp.id}` });
    }
    propPlacementIds.add(pp.id);
    if (!propDefinitionIds.has(pp.propId)) {
      errors.push({ path: `propPlacements.${pp.id}.propId`, message: `Prop placement "${pp.id}" references nonexistent prop definition "${pp.propId}"` });
    }
    if (pp.zoneId !== undefined && !zoneIds.has(pp.zoneId)) {
      errors.push({ path: `propPlacements.${pp.id}.zoneId`, message: `Prop placement "${pp.id}" in nonexistent zone "${pp.zoneId}"` });
    }
  }

  // 86. AmbientLayer ID uniqueness + zoneIds[] existence.
  const ambientLayerIds = new Set<string>();
  for (const al of project.ambientLayers) {
    if (ambientLayerIds.has(al.id)) {
      errors.push({ path: `ambientLayers.${al.id}`, message: `Duplicate ambient layer ID: ${al.id}` });
    }
    ambientLayerIds.add(al.id);
    for (const zid of al.zoneIds) {
      if (!zoneIds.has(zid)) {
        errors.push({ path: `ambientLayers.${al.id}.zoneIds`, message: `Ambient layer "${al.id}" references nonexistent zone "${zid}"` });
      }
    }
  }

  // 87. Building ID uniqueness + zoneId / interiorZoneId existence.
  // interiorZoneId is the field town.ts's own header calls the link "from the
  // town map to the interiors layer" — functionally the same thing as
  // TransitionEntity.targetZoneId, which rule 61 already checks. Unchecked, a
  // typo'd interiorZoneId means the player enters a building and arrives
  // nowhere, with validateProject reporting the project clean.
  const buildingIds = new Set<string>();
  for (const b of project.buildings ?? []) {
    if (buildingIds.has(b.id)) {
      errors.push({ path: `buildings.${b.id}`, message: `Duplicate building ID: ${b.id}` });
    }
    buildingIds.add(b.id);
    if (b.zoneId !== undefined && !zoneIds.has(b.zoneId)) {
      errors.push({ path: `buildings.${b.id}.zoneId`, message: `Building "${b.id}" in nonexistent zone "${b.zoneId}"` });
    }
    if (b.interiorZoneId !== undefined && !zoneIds.has(b.interiorZoneId)) {
      errors.push({ path: `buildings.${b.id}.interiorZoneId`, message: `Building "${b.id}" enters nonexistent interior zone "${b.interiorZoneId}"` });
    }
  }

  // 88. Hub ID uniqueness + zoneId (required) + connectedZoneIds[] existence.
  const hubIds = new Set<string>();
  for (const h of project.hubs ?? []) {
    if (hubIds.has(h.id)) {
      errors.push({ path: `hubs.${h.id}`, message: `Duplicate hub ID: ${h.id}` });
    }
    hubIds.add(h.id);
    if (!zoneIds.has(h.zoneId)) {
      errors.push({ path: `hubs.${h.id}.zoneId`, message: `Hub "${h.id}" anchored to nonexistent zone "${h.zoneId}"` });
    }
    for (const zid of h.connectedZoneIds) {
      if (!zoneIds.has(zid)) {
        errors.push({ path: `hubs.${h.id}.connectedZoneIds`, message: `Hub "${h.id}" serves nonexistent zone "${zid}"` });
      }
    }
  }

  // 89. Stronghold ID uniqueness + zoneId (required) + garrisonEntityIds[]
  // existence + defenseLevel finiteness. factionId is deliberately NOT checked:
  // there is no faction registry in the schema (factions exist only as
  // FactionPresence.factionId strings scoped to districts), so a stronghold
  // held by a faction with no district presence is legitimately authorable.
  const strongholdIds = new Set<string>();
  for (const s of project.strongholds ?? []) {
    if (strongholdIds.has(s.id)) {
      errors.push({ path: `strongholds.${s.id}`, message: `Duplicate stronghold ID: ${s.id}` });
    }
    strongholdIds.add(s.id);
    if (!zoneIds.has(s.zoneId)) {
      errors.push({ path: `strongholds.${s.id}.zoneId`, message: `Stronghold "${s.id}" in nonexistent zone "${s.zoneId}"` });
    }
    for (const eid of s.garrisonEntityIds) {
      if (!entityPlacementIds.has(eid)) {
        errors.push({ path: `strongholds.${s.id}.garrisonEntityIds`, message: `Stronghold "${s.id}" garrisons nonexistent entity "${eid}"` });
      }
    }
    if (!Number.isFinite(s.defenseLevel) || s.defenseLevel < 0) {
      errors.push({ path: `strongholds.${s.id}.defenseLevel`, message: `Stronghold "${s.id}" has invalid defenseLevel ${String(s.defenseLevel)} — expected a finite number >= 0` });
    }
  }

  // Structured warning counts for callers that want a quick health check
  warningCount = errors.length;
  if (verbose && errors.length > 0) {
    // In verbose mode, callers can inspect the full errors array for detail.
    // This is useful for editor integrations that want to show inline diagnostics.
  }

  return { valid: errors.length === 0, errors, warningCount, schemaVersion: SCHEMA_VERSION };
}
