// advisory.ts — mode-specific advisory validation (suggestions, never hard errors)

import type { WorldProject } from './project.js';
import type { AuthoringMode } from './authoring-mode.js';
import type { PressureHotspot } from './districts.js';
import { AUTHORING_MODES, DEFAULT_MODE } from './authoring-mode.js';

export interface AdvisoryItem {
  path: string;
  message: string;
  severity: 'info' | 'suggestion';
}

export interface AdvisoryResult {
  items: AdvisoryItem[];
}

/**
 * Returns true if the hotspot represents a trap, either via an explicit 'trap' tag
 * or via a pressureType string that contains 'trap'. Extracted for readability so
 * the dungeon advisory check stays a one-liner.
 */
function isTrapHotspot(h: PressureHotspot): boolean {
  if (h.tags?.includes('trap')) return true;
  if (typeof h.pressureType === 'string' && h.pressureType.length > 0 && h.pressureType.includes('trap')) {
    return true;
  }
  return false;
}

/** Mode-specific advisory rules that return suggestions — never hard errors, never block export. */
export function advisoryValidation(project: WorldProject): AdvisoryResult {
  const mode: AuthoringMode = project.mode ?? DEFAULT_MODE;
  const items: AdvisoryItem[] = [];

  // ── Project metadata advisories ────────────────────────────
  // Type guards: defensively handle callers that hand us `{ author: null }` or
  // `{ license: 123 }` without crashing on .trim(). We treat non-string values
  // the same as missing (suggest specifying), but never throw.
  const authorStr = typeof project.author === 'string' ? project.author : '';
  if (authorStr.trim().length === 0) {
    items.push({ path: 'author', message: 'Consider specifying an author for attribution and discoverability.', severity: 'suggestion' });
  }
  const licenseStr = typeof project.license === 'string' ? project.license : '';
  if (licenseStr.trim().length === 0) {
    items.push({ path: 'license', message: 'Consider specifying a license (e.g. CC-BY-4.0, MIT, custom) so consumers know usage rights.', severity: 'suggestion' });
  }
  if (project.category !== undefined && (typeof project.category !== 'string' || project.category.trim().length === 0)) {
    items.push({ path: 'category', message: 'Category is present but empty — provide a value like "fantasy", "sci-fi", or "horror".', severity: 'suggestion' });
  }

  // ── Universal suggestions ──────────────────────────────────
  if (project.zones.length < 2) {
    items.push({ path: 'zones', message: 'Consider adding at least 2 zones for a richer world.', severity: 'suggestion' });
  }
  if (project.connections.length === 0 && project.zones.length > 1) {
    items.push({ path: 'connections', message: 'Zones exist but none are connected. Consider linking them.', severity: 'suggestion' });
  }

  // ── Asset naming advisories ────────────────────────────────
  for (const asset of project.assets) {
    const label = asset.label;
    const lower = label.toLowerCase();
    const isGeneric =
      lower.includes('untitled') ||
      lower.includes('image') ||
      lower.includes('sprite_copy') ||
      /^\d+$/.test(label) ||
      label.trim().length < 3;

    if (isGeneric) {
      items.push({
        path: `assets[${asset.id}].label`,
        message: `Asset '${label}' has a generic name — consider something descriptive like 'npc-merchant-portrait'`,
        severity: 'suggestion',
      });
    }
  }

  // ── Mode-specific suggestions ──────────────────────────────
  // MAINTENANCE: When adding a new AuthoringMode in authoring-mode.ts,
  // add a corresponding case below. Otherwise the new mode will silently
  // produce no mode-specific suggestions.
  //
  // The switch is typed against `string` (not AuthoringMode) so the default
  // case can surface runtime values that slip past the type guard — e.g.
  // `'custom'` from a user-authored JSON, or a future-but-unimplemented mode.
  const kinds = project.connections.map((c) => c.kind);
  const modeKey: string = mode;

  switch (modeKey) {
    case 'dungeon':
      if (!kinds.includes('secret')) {
        items.push({ path: 'connections', message: 'Dungeon tip: add a secret passage for hidden exploration.', severity: 'suggestion' });
      }
      if (!project.pressureHotspots.some(isTrapHotspot)) {
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
      if (!project.zones.some((z) => z.elevation !== undefined || z.elevationRange !== undefined)) {
        items.push({ path: 'zones', message: 'Space tip: set elevation on at least one zone — 2.5D engines like UE5 need a Z-plane to stack sectors or docking arms.', severity: 'suggestion' });
      }
      // Any zone tagged 'station' should declare a physicsMode so exporters
      // know whether to run station-interior (normal), EVA (zero-g), etc.
      for (const z of project.zones) {
        if (z.tags?.includes('station') && z.physicsMode === undefined) {
          items.push({
            path: `zones.${z.id}.physicsMode`,
            message: `Space tip: station zone "${z.id}" has no physicsMode — set one (normal, platformer, zero-g, aquatic) so the exporter knows which physics runtime to apply.`,
            severity: 'info',
          });
        }
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
      if (!project.zones.some((z) => z.elevation !== undefined || z.elevationRange !== undefined)) {
        items.push({ path: 'zones', message: 'Wilderness tip: set elevation on zones for hills, cliffs, and valleys — 2.5D engines use this for terrain.', severity: 'suggestion' });
      }
      break;

    default: {
      // Unknown mode — emit a single observable advisory so unknown/future modes
      // don't silently skip mode-specific tips. Lists the supported set so the
      // user can see what to pick from.
      const supported = AUTHORING_MODES.join(', ');
      items.push({
        path: 'mode',
        message: `Mode '${String(mode)}' is not recognized — no mode-specific tips available. Supported modes: ${supported}.`,
        severity: 'info',
      });
      break;
    }
  }

  return { items };
}
