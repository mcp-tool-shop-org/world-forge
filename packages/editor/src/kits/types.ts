// types.ts — StarterKit type for reusable mode-native starter kits

import type { WorldProject, AuthoringMode } from '@world-forge/schema';
import type { SpeedPanelMacro } from '../speed-panel-actions.js';

export interface KitSpeedPanelPresets {
  pins: string[];
  macros: SpeedPanelMacro[];
}

export interface StarterKit {
  id: string;
  name: string;
  description: string;
  icon: string;
  modes: AuthoringMode[];
  tags: string[];
  builtIn: boolean;
  project: WorldProject;
  presetRefs: {
    region: string[];
    encounter: string[];
  };
  guideHints: Partial<Record<string, { label: string; description: string }>>;
  speedPanelPresets?: KitSpeedPanelPresets;
  createdAt?: string;
  updatedAt?: string;
  version?: string;
  source?: 'local' | 'imported';
}
