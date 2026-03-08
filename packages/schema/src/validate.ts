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
  for (const c of project.connections) {
    if (!zoneIds.has(c.fromZoneId)) {
      errors.push({ path: 'connections', message: `Connection references nonexistent zone "${c.fromZoneId}"` });
    }
    if (!zoneIds.has(c.toZoneId)) {
      errors.push({ path: 'connections', message: `Connection references nonexistent zone "${c.toZoneId}"` });
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

  return { valid: errors.length === 0, errors };
}
