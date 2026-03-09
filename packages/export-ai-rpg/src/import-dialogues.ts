// import-dialogues.ts — engine DialogueDefinition[] → schema DialogueDefinition[]

import type { DialogueDefinition } from '@world-forge/schema';
import type { DialogueDefinition as EngineDialogue } from '@ai-rpg-engine/content-schema';
import type { FidelityEntry } from './fidelity.js';

export function importDialogues(engineDialogues: EngineDialogue[]): { dialogues: DialogueDefinition[]; fidelity: FidelityEntry[] } {
  const fidelity: FidelityEntry[] = [];

  const dialogues = engineDialogues.map((dlg) => {
    const nodes: DialogueDefinition['nodes'] = {};
    let hasTextBlock = false;

    for (const [nodeId, node] of Object.entries(dlg.nodes)) {
      // Engine text may be string or TextBlock[] — normalize to string
      const isTextBlock = Array.isArray(node.text);
      if (isTextBlock) hasTextBlock = true;

      const text = isTextBlock
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

    if (hasTextBlock) {
      fidelity.push({
        level: 'approximated', domain: 'dialogues', severity: 'info',
        entityId: dlg.id, fieldPath: 'nodes.*.text',
        message: `Dialogue '${dlg.id}' TextBlock arrays normalized to plain strings`,
        reason: 'textblock-to-string',
      });
    }

    return {
      id: dlg.id,
      speakers: [...dlg.speakers],
      entryNodeId: dlg.entryNodeId,
      nodes,
    };
  });

  return { dialogues, fidelity };
}
