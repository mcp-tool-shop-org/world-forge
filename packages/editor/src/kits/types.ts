// types.ts — StarterKit type for reusable mode-native starter kits

import type { WorldProject, AuthoringMode } from '@world-forge/schema';

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
  createdAt?: string;
  updatedAt?: string;
  version?: string;
}
