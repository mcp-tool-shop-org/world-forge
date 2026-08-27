// authoring-mode.ts — world-scale authoring mode type

/** All supported authoring modes. Genre is flavor; mode is scale. */
export const AUTHORING_MODES = [
  'dungeon', 'district', 'world', 'ocean', 'space', 'interior', 'wilderness',
] as const;

/** The scale/scope a project is designed for. */
export type AuthoringMode = typeof AUTHORING_MODES[number];

/** Type guard for AuthoringMode. */
export function isValidMode(value: string): value is AuthoringMode {
  return (AUTHORING_MODES as readonly string[]).includes(value);
}

/** Default mode for new or legacy projects without an explicit mode. */
export const DEFAULT_MODE: AuthoringMode = 'dungeon';

/** Per-mode map grid defaults used by createEmptyProject(). */
export const MODE_GRID_DEFAULTS: Record<AuthoringMode, { width: number; height: number; tileSize: number }> = {
  dungeon: { width: 30, height: 25, tileSize: 32 },
  district: { width: 50, height: 40, tileSize: 32 },
  world: { width: 80, height: 60, tileSize: 48 },
  ocean: { width: 60, height: 50, tileSize: 48 },
  space: { width: 100, height: 80, tileSize: 64 },
  interior: { width: 20, height: 15, tileSize: 24 },
  wilderness: { width: 60, height: 50, tileSize: 48 },
};
