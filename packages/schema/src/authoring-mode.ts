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
