// import-progression-trees.ts — engine ProgressionTreeDefinition[] → schema format

import type { ProgressionTreeDefinition } from '@world-forge/schema';
import type { ProgressionTreeDefinition as EngineTree } from '@ai-rpg-engine/content-schema';

export function importProgressionTrees(
  engineTrees: EngineTree[],
): ProgressionTreeDefinition[] {
  return engineTrees.map((tree) => ({
    id: tree.id,
    name: tree.name,
    currency: tree.currency,
    nodes: tree.nodes.map((node) => ({
      id: node.id,
      name: node.name,
      description: node.description,
      cost: node.cost,
      requires: node.requires ? [...node.requires] : [],
      effects: node.effects.map((e) => ({ type: e.type, target: e.target, params: { ...e.params } })),
    })),
  }));
}
