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

  return { valid: errors.length === 0, errors };
}
