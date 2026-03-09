// advisory.ts — mode-specific advisory validation (suggestions, never hard errors)

import type { WorldProject } from './project.js';
import type { AuthoringMode } from './authoring-mode.js';
import { DEFAULT_MODE } from './authoring-mode.js';

export interface AdvisoryItem {
  path: string;
  message: string;
  severity: 'info' | 'suggestion';
}

export interface AdvisoryResult {
  items: AdvisoryItem[];
}

/** Mode-specific advisory rules that return suggestions — never hard errors, never block export. */
export function advisoryValidation(project: WorldProject): AdvisoryResult {
  const mode: AuthoringMode = project.mode ?? DEFAULT_MODE;
  const items: AdvisoryItem[] = [];

  // ── Universal suggestions ──────────────────────────────────
  if (project.zones.length < 2) {
    items.push({ path: 'zones', message: 'Consider adding at least 2 zones for a richer world.', severity: 'suggestion' });
  }
  if (project.connections.length === 0 && project.zones.length > 1) {
    items.push({ path: 'connections', message: 'Zones exist but none are connected. Consider linking them.', severity: 'suggestion' });
  }

  // ── Mode-specific suggestions ──────────────────────────────
  const kinds = project.connections.map((c) => c.kind);

  switch (mode) {
    case 'dungeon':
      if (!kinds.includes('secret')) {
        items.push({ path: 'connections', message: 'Dungeon tip: add a secret passage for hidden exploration.', severity: 'suggestion' });
      }
      if (!project.pressureHotspots.some((h) => h.tags?.includes('trap') || h.pressureType.includes('trap'))) {
        items.push({ path: 'pressureHotspots', message: 'Dungeon tip: consider adding hazard zones with traps.', severity: 'suggestion' });
      }
      break;

    case 'world':
      if (project.districts.length < 2) {
        items.push({ path: 'districts', message: 'World tip: add multiple districts to represent distinct regions.', severity: 'suggestion' });
      }
      if (!kinds.includes('road')) {
        items.push({ path: 'connections', message: 'World tip: roads make overland travel more immersive.', severity: 'suggestion' });
      }
      break;

    case 'ocean':
      if (!kinds.includes('channel') && !kinds.includes('route')) {
        items.push({ path: 'connections', message: 'Ocean tip: use channel or route connections for sea lanes.', severity: 'suggestion' });
      }
      if (!project.districts.some((d) => d.tags?.includes('port') || d.tags?.includes('harbor'))) {
        items.push({ path: 'districts', message: 'Ocean tip: add a port or harbor district for docking.', severity: 'suggestion' });
      }
      break;

    case 'space':
      if (!kinds.includes('warp') && !kinds.includes('docking')) {
        items.push({ path: 'connections', message: 'Space tip: use warp or docking connections between sectors.', severity: 'suggestion' });
      }
      if (!project.zones.some((z) => z.tags?.includes('station'))) {
        items.push({ path: 'zones', message: 'Space tip: add a station zone as a home base.', severity: 'suggestion' });
      }
      break;

    case 'interior':
      if (!kinds.includes('door')) {
        items.push({ path: 'connections', message: 'Interior tip: doors are the most natural connection for rooms.', severity: 'suggestion' });
      }
      if (project.map.gridWidth * project.map.gridHeight > 1600) {
        items.push({ path: 'map', message: 'Interior tip: interiors are typically compact. Consider a smaller grid.', severity: 'info' });
      }
      break;

    case 'district':
      if (project.factionPresences.length === 0) {
        items.push({ path: 'factionPresences', message: 'District tip: faction presences add political depth to wards.', severity: 'suggestion' });
      }
      if (project.districts.length > 0 && project.districts.every((d) => (d.baseMetrics?.commerce ?? 0) === 0)) {
        items.push({ path: 'districts', message: 'District tip: set commerce metrics to enable market dynamics.', severity: 'suggestion' });
      }
      break;

    case 'wilderness':
      if (!kinds.includes('trail')) {
        items.push({ path: 'connections', message: 'Wilderness tip: trail connections suit rugged terrain.', severity: 'suggestion' });
      }
      if (project.encounterAnchors.length === 0) {
        items.push({ path: 'encounterAnchors', message: 'Wilderness tip: encounters with wildlife or hazards add realism.', severity: 'suggestion' });
      }
      break;
  }

  return { items };
}
