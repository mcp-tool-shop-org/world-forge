// convert-dialogues.ts — WorldProject dialogues → engine DialogueDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { DialogueDefinition } from '@ai-rpg-engine/content-schema';

export interface AiRpgDialogueSpeakerBlocker {
  dialogueId: string;
  nodeId?: string;
  speaker: string;
  message: string;
}

/**
 * List unresolved `dialogues[].speakers` entries and empty node speakers (`speaker: ''`)
 * when a dialogue does not have a single listed speaker to inherit on export.
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

    if (speakers.length !== 1 && dlg?.nodes && typeof dlg.nodes === 'object') {
      const reason =
        speakers.length === 0
          ? 'no speaker is listed on dialogues[].speakers'
          : `${speakers.length} speakers are listed on dialogues[].speakers`;
      for (const [nodeId, node] of Object.entries(dlg.nodes)) {
        if (node?.speaker === '') {
          blockers.push({
            dialogueId,
            nodeId,
            speaker: '',
            message: `Dialogue "${dialogueId}" node "${nodeId}" has an empty speaker and ${reason}.`,
          });
        }
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
    const fallbackSpeaker = dlg.speakers.length === 1 ? dlg.speakers[0] : undefined;
    const nodes: Record<string, DialogueDefinition['nodes'][string]> = {};

    for (const [nodeId, node] of Object.entries(dlg.nodes)) {
      nodes[nodeId] = {
        id: node.id,
        speaker: node.speaker === '' && fallbackSpeaker !== undefined ? fallbackSpeaker : node.speaker,
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
