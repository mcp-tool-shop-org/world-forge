// convert-progression-trees.ts — WorldProject progression trees → engine format

import type { WorldProject } from '@world-forge/schema';
import type { ProgressionTreeDefinition } from '@ai-rpg-engine/content-schema';

/**
 * Convert project progression trees → engine `ProgressionTreeDefinition[]`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 */
export function convertProgressionTrees(project: WorldProject): ProgressionTreeDefinition[] {
  return project.progressionTrees.map((tree) => ({
    id: tree.id,
    name: tree.name,
    currency: tree.currency,
    nodes: tree.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      cost: node.cost,
      requires: node.requires,
      effects: node.effects.map((e) => ({
        type: e.type,
        target: e.target,
        params: e.params,
      })),
    })),
  }));
}
