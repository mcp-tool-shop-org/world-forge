// convert-dialogues.ts — WorldProject dialogues → engine DialogueDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { DialogueDefinition } from '@ai-rpg-engine/content-schema';

export interface AiRpgDialogueSpeakerBlocker {
  dialogueId: string;
  speaker: string;
  message: string;
}

/**
 * List `dialogues[].speakers` entries that do not match any exported entity's `entityId`.
 * Refuse only — never guess, resolve by display name, or default.
 */
export function listAiRpgDialogueSpeakerBlockers(
  project: Pick<WorldProject, 'dialogues' | 'entityPlacements'>,
): AiRpgDialogueSpeakerBlocker[] {
  const exportedEntityIds = new Set<string>();
  const placements = Array.isArray(project.entityPlacements) ? project.entityPlacements : [];
  for (const ep of placements) {
    if (typeof ep?.entityId === 'string' && ep.entityId.length > 0) {
      exportedEntityIds.add(ep.entityId);
    }
  }

  const dialogues = Array.isArray(project.dialogues) ? project.dialogues : [];
  const blockers: AiRpgDialogueSpeakerBlocker[] = [];
  for (const dlg of dialogues) {
    const dialogueId = typeof dlg?.id === 'string' && dlg.id.length > 0 ? dlg.id : '(unknown)';
    const speakers = Array.isArray(dlg?.speakers) ? dlg.speakers : [];
    for (const speaker of speakers) {
      if (typeof speaker !== 'string' || !exportedEntityIds.has(speaker)) {
        const speakerLabel = typeof speaker === 'string' ? speaker : String(speaker);
        blockers.push({
          dialogueId,
          speaker: speakerLabel,
          message: `Dialogue "${dialogueId}" references unresolved speaker "${speakerLabel}" — not found in exported entity IDs.`,
        });
      }
    }
  }
  return blockers;
}

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
