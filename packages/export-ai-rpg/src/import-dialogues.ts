// import-dialogues.ts — engine DialogueDefinition[] → schema DialogueDefinition[]

import type { DialogueDefinition } from '@world-forge/schema';
import type { DialogueDefinition as EngineDialogue } from '@ai-rpg-engine/content-schema';

export function importDialogues(engineDialogues: EngineDialogue[]): DialogueDefinition[] {
  return engineDialogues.map((dlg) => {
    const nodes: DialogueDefinition['nodes'] = {};

    for (const [nodeId, node] of Object.entries(dlg.nodes)) {
      // Engine text may be string or TextBlock[] — normalize to string
      const text = Array.isArray(node.text)
        ? (node.text as Array<{ text: string }>).map((b) => b.text).join(' ')
        : String(node.text ?? '');

      nodes[nodeId] = {
        id: node.id,
        speaker: node.speaker,
        text,
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
      speakers: [...dlg.speakers],
      entryNodeId: dlg.entryNodeId,
      nodes,
    };
  });
}
