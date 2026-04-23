// convert-dialogues.ts — WorldProject dialogues → engine DialogueDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { DialogueDefinition } from '@ai-rpg-engine/content-schema';

/**
 * Convert project dialogues → engine `DialogueDefinition[]`.
 *
 * **Precondition:** `validateProject(project).valid === true`. Converters do
 * not guard against missing nested properties and will throw if input is
 * malformed. (AIR-B-006)
 */
export function convertDialogues(project: WorldProject): DialogueDefinition[] {
  return project.dialogues.map((dlg) => {
    const nodes: Record<string, DialogueDefinition['nodes'][string]> = {};

    for (const [nodeId, node] of Object.entries(dlg.nodes)) {
      nodes[nodeId] = {
        id: node.id,
        speaker: node.speaker,
        text: node.text,
        nextNodeId: node.nextNodeId,
        choices: node.choices?.map((ch) => ({
          id: ch.id,
          text: ch.text,
          nextNodeId: ch.nextNodeId,
          condition: ch.condition ? { type: ch.condition.type, params: ch.condition.params } : undefined,
          effects: ch.effects?.map((e) => ({ type: e.type, target: e.target, params: e.params })),
        })),
        effects: node.effects?.map((e) => ({ type: e.type, target: e.target, params: e.params })),
      };
    }

    return {
      id: dlg.id,
      speakers: dlg.speakers,
      entryNodeId: dlg.entryNodeId,
      nodes,
    };
  });
}
