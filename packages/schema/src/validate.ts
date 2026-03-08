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

  return { valid: errors.length === 0, errors };
}
