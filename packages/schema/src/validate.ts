// validate.ts — WorldProject validation

import type { WorldProject } from './project.js';

export type ValidationError = {
  path: string;
  message: string;
};

export type ValidationResult = {
  valid: boolean;
  errors: ValidationError[];
};

export function validateProject(project: WorldProject): ValidationResult {
  const errors: ValidationError[] = [];

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
  for (const z of project.zones) {
    for (const nid of z.neighbors) {
      const neighbor = project.zones.find((n) => n.id === nid);
      if (neighbor && !neighbor.neighbors.includes(z.id)) {
        errors.push({
          path: `zones.${z.id}.neighbors`,
          message: `Zone "${z.id}" lists "${nid}" as neighbor, but "${nid}" does not list "${z.id}" back`,
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

  // 11. Connections must reference valid zones
  const VALID_CONNECTION_KINDS = new Set(['passage', 'door', 'stairs', 'road', 'portal', 'secret', 'hazard']);
  for (const c of project.connections) {
    if (!zoneIds.has(c.fromZoneId)) {
      errors.push({ path: 'connections', message: `Connection references nonexistent zone "${c.fromZoneId}"` });
    }
    if (!zoneIds.has(c.toZoneId)) {
      errors.push({ path: 'connections', message: `Connection references nonexistent zone "${c.toZoneId}"` });
    }
    // 49. Connection kind must be valid
    if (c.kind && !VALID_CONNECTION_KINDS.has(c.kind)) {
      errors.push({ path: 'connections', message: `Connection has unsupported kind "${c.kind}"` });
    }
  }

  // 12. Landmark zoneIds must exist
  for (const lm of project.landmarks) {
    if (!zoneIds.has(lm.zoneId)) {
      errors.push({ path: `landmarks.${lm.id}`, message: `Landmark "${lm.id}" in nonexistent zone "${lm.zoneId}"` });
    }
  }

  // --- Dialogue validation ---

  const dialogueIds = new Set<string>();

  for (const dlg of project.dialogues) {
    // 13. Dialogue ID uniqueness
    if (dialogueIds.has(dlg.id)) {
      errors.push({ path: `dialogues.${dlg.id}`, message: `Duplicate dialogue ID: ${dlg.id}` });
    }
    dialogueIds.add(dlg.id);

    // 14. Entry node must exist
    if (!dlg.nodes[dlg.entryNodeId]) {
      errors.push({
        path: `dialogues.${dlg.id}.entryNodeId`,
        message: `Dialogue "${dlg.id}" entry node "${dlg.entryNodeId}" does not exist in nodes`,
      });
    }

    // 15. All nextNodeId references must point to existing nodes
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

    // 16. Unreachable nodes (not reachable from entry)
    if (dlg.nodes[dlg.entryNodeId]) {
      const reachable = new Set<string>();
      const queue = [dlg.entryNodeId];
      while (queue.length > 0) {
        const current = queue.pop()!;
        if (reachable.has(current)) continue;
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
            message: `Node "${nid}" in dialogue "${dlg.id}" is unreachable from entry node`,
          });
        }
      }
    }
  }

  // 17. Entity dialogueId must reference existing dialogue
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

    // 18. Spawn point must exist
    if (!spawnPointIds.has(pt.spawnPointId)) {
      errors.push({
        path: 'playerTemplate.spawnPointId',
        message: `Player template spawn point "${pt.spawnPointId}" does not exist`,
      });
    }

    // 19. Starting inventory items should exist in item placements
    const itemIds = new Set(project.itemPlacements.map((ip) => ip.itemId));
    for (const itemId of pt.startingInventory) {
      if (!itemIds.has(itemId)) {
        errors.push({
          path: `playerTemplate.startingInventory`,
          message: `Player template starting item "${itemId}" not found in item placements`,
        });
      }
    }

    // 20. Starting equipment items should exist
    for (const [slot, itemId] of Object.entries(pt.startingEquipment)) {
      if (!itemIds.has(itemId)) {
        errors.push({
          path: `playerTemplate.startingEquipment.${slot}`,
          message: `Player template equipment "${itemId}" in slot "${slot}" not found in item placements`,
        });
      }
    }

    // 21. Default archetype must exist in build catalog
    if (pt.defaultArchetypeId && project.buildCatalog) {
      if (!project.buildCatalog.archetypes.some((a) => a.id === pt.defaultArchetypeId)) {
        errors.push({
          path: 'playerTemplate.defaultArchetypeId',
          message: `Player template default archetype "${pt.defaultArchetypeId}" not found in build catalog`,
        });
      }
    }

    // 22. Default background must exist in build catalog
    if (pt.defaultBackgroundId && project.buildCatalog) {
      if (!project.buildCatalog.backgrounds.some((b) => b.id === pt.defaultBackgroundId)) {
        errors.push({
          path: 'playerTemplate.defaultBackgroundId',
          message: `Player template default background "${pt.defaultBackgroundId}" not found in build catalog`,
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

    // 23. Archetype ID uniqueness + progression tree refs
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

    // 24. Background ID uniqueness
    const backgroundIds = new Set<string>();
    for (const bg of bc.backgrounds) {
      if (backgroundIds.has(bg.id)) {
        errors.push({ path: `buildCatalog.backgrounds.${bg.id}`, message: `Duplicate background ID: ${bg.id}` });
      }
      backgroundIds.add(bg.id);
    }

    // 25. Trait ID uniqueness + incompatibility refs
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

    // 26. Discipline ID uniqueness
    for (const disc of bc.disciplines) {
      if (disciplineIds.has(disc.id)) {
        errors.push({ path: `buildCatalog.disciplines.${disc.id}`, message: `Duplicate discipline ID: ${disc.id}` });
      }
      disciplineIds.add(disc.id);
    }

    // 27. Cross-title refs must point to existing archetypes + disciplines
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

    // 28. Entanglement refs must point to existing archetypes + disciplines
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
    // 29. Tree ID uniqueness
    if (treeIds.has(tree.id)) {
      errors.push({ path: `progressionTrees.${tree.id}`, message: `Duplicate progression tree ID: ${tree.id}` });
    }
    treeIds.add(tree.id);

    const nodeIds = new Set(tree.nodes.map((n) => n.id));
    const nodeIdDupes = new Set<string>();

    for (const node of tree.nodes) {
      // 30. Node ID uniqueness within tree
      if (nodeIdDupes.has(node.id)) {
        errors.push({
          path: `progressionTrees.${tree.id}.nodes.${node.id}`,
          message: `Duplicate node ID "${node.id}" in tree "${tree.id}"`,
        });
      }
      nodeIdDupes.add(node.id);

      // 31. Required node refs must exist
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

    // 32. Unreachable nodes (no requires = root, all others must be reachable)
    const roots = tree.nodes.filter((n) => !n.requires || n.requires.length === 0);
    if (roots.length === 0 && tree.nodes.length > 0) {
      errors.push({
        path: `progressionTrees.${tree.id}`,
        message: `Progression tree "${tree.id}" has no root nodes (all nodes have requirements)`,
      });
    }
  }

  // --- Asset validation ---

  const VALID_ASSET_KINDS = new Set(['portrait', 'sprite', 'background', 'icon', 'tileset']);
  const assetIds = new Set<string>();
  const assetMap = new Map<string, { kind: string }>();

  // 33. Asset ID uniqueness
  for (const a of project.assets) {
    if (assetIds.has(a.id)) {
      errors.push({ path: `assets.${a.id}`, message: `Duplicate asset ID: ${a.id}` });
    }
    assetIds.add(a.id);
    assetMap.set(a.id, { kind: a.kind });
  }

  // 34. Asset path must be non-empty
  for (const a of project.assets) {
    if (!a.path || a.path.trim().length === 0) {
      errors.push({ path: `assets.${a.id}.path`, message: `Asset "${a.id}" has empty path` });
    }
  }

  // 35. Asset kind must be valid
  for (const a of project.assets) {
    if (!VALID_ASSET_KINDS.has(a.kind)) {
      errors.push({ path: `assets.${a.id}.kind`, message: `Asset "${a.id}" has unsupported kind "${a.kind}"` });
    }
  }

  // Helper: check asset ref exists and has correct kind
  function checkAssetRef(refId: string | undefined, expectedKind: string, path: string, label: string) {
    if (!refId) return;
    if (!assetIds.has(refId)) {
      errors.push({ path, message: `${label} references nonexistent asset "${refId}"` });
      return;
    }
    const asset = assetMap.get(refId);
    if (asset && asset.kind !== expectedKind) {
      errors.push({ path, message: `${label} references asset "${refId}" of kind "${asset.kind}", expected "${expectedKind}"` });
    }
  }

  // 36-37. Zone asset refs
  for (const z of project.zones) {
    checkAssetRef(z.backgroundId, 'background', `zones.${z.id}.backgroundId`, `Zone "${z.id}"`);
    checkAssetRef(z.tilesetId, 'tileset', `zones.${z.id}.tilesetId`, `Zone "${z.id}"`);
  }

  // 38-39. Entity asset refs
  for (const ep of project.entityPlacements) {
    checkAssetRef(ep.portraitId, 'portrait', `entityPlacements.${ep.entityId}.portraitId`, `Entity "${ep.entityId}"`);
    checkAssetRef(ep.spriteId, 'sprite', `entityPlacements.${ep.entityId}.spriteId`, `Entity "${ep.entityId}"`);
  }

  // 40. Item asset refs
  for (const ip of project.itemPlacements) {
    checkAssetRef(ip.iconId, 'icon', `itemPlacements.${ip.itemId}.iconId`, `Item "${ip.itemId}"`);
  }

  // 41. Landmark asset refs
  for (const lm of project.landmarks) {
    checkAssetRef(lm.iconId, 'icon', `landmarks.${lm.id}.iconId`, `Landmark "${lm.id}"`);
  }

  // 42. Orphaned assets (in manifest but unreferenced)
  const referencedAssetIds = new Set<string>();
  for (const z of project.zones) {
    if (z.backgroundId) referencedAssetIds.add(z.backgroundId);
    if (z.tilesetId) referencedAssetIds.add(z.tilesetId);
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

  // 43. Pack ID uniqueness
  for (const pack of project.assetPacks) {
    if (packIds.has(pack.id)) {
      errors.push({ path: `assetPacks.${pack.id}`, message: `Duplicate asset pack ID: ${pack.id}` });
    }
    packIds.add(pack.id);
  }

  // 44. Pack label must be non-empty
  for (const pack of project.assetPacks) {
    if (!pack.label || pack.label.trim().length === 0) {
      errors.push({ path: `assetPacks.${pack.id}.label`, message: `Asset pack "${pack.id}" has empty label` });
    }
  }

  // 45. Pack version must be non-empty
  for (const pack of project.assetPacks) {
    if (!pack.version || pack.version.trim().length === 0) {
      errors.push({ path: `assetPacks.${pack.id}.version`, message: `Asset pack "${pack.id}" has empty version` });
    }
  }

  // 46. Asset packId must reference existing pack
  for (const a of project.assets) {
    if (a.packId && !packIds.has(a.packId)) {
      errors.push({ path: `assets.${a.id}.packId`, message: `Asset "${a.id}" references nonexistent pack "${a.packId}"` });
    }
  }

  // 47. Orphaned packs (no assets use this packId)
  const usedPackIds = new Set<string>();
  for (const a of project.assets) {
    if (a.packId) usedPackIds.add(a.packId);
  }
  for (const pack of project.assetPacks) {
    if (!usedPackIds.has(pack.id)) {
      errors.push({ path: `assetPacks.${pack.id}`, message: `Asset pack "${pack.id}" has no assets assigned to it` });
    }
  }

  // 48. Pack version must be valid semver format (x.y.z)
  const semverPattern = /^\d+\.\d+\.\d+$/;
  for (const pack of project.assetPacks) {
    if (pack.version && pack.version.trim().length > 0 && !semverPattern.test(pack.version)) {
      errors.push({ path: `assetPacks.${pack.id}.version`, message: `Asset pack "${pack.id}" version "${pack.version}" is not valid semver (expected x.y.z)` });
    }
  }

  return { valid: errors.length === 0, errors };
}
