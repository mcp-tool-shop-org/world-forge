// convert-dialogues.ts — WorldProject dialogues → engine DialogueDefinition[]

import type { WorldProject } from '@world-forge/schema';
import type { DialogueDefinition } from '@ai-rpg-engine/content-schema';

export interface AiRpgDialogueSpeakerBlocker {
  dialogueId: string;
  nodeId?: string;
  speaker: string;
  carrierEntityId?: string;
  message: string;
}

function collectDialoguePlacements(
  placements: WorldProject['entityPlacements'] | undefined,
): { exportedEntityIds: Set<string>; carriersByDialogueId: Map<string, string[]> } {
  const exportedEntityIds = new Set<string>();
  const carriersByDialogueId = new Map<string, string[]>();
  const list = Array.isArray(placements) ? placements : [];
  for (const ep of list) {
    const hasEntityId = typeof ep?.entityId === 'string' && ep.entityId.length > 0;
    if (hasEntityId) {
      exportedEntityIds.add(ep.entityId);
    }
    if (typeof ep?.dialogueId === 'string' && ep.dialogueId.length > 0) {
      const carrierId = hasEntityId ? ep.entityId : '(unknown)';
      const existing = carriersByDialogueId.get(ep.dialogueId);
      if (existing) {
        if (!existing.includes(carrierId)) existing.push(carrierId);
      } else {
        carriersByDialogueId.set(ep.dialogueId, [carrierId]);
      }
    }
  }
  return { exportedEntityIds, carriersByDialogueId };
}

/**
 * List unresolved `dialogues[].speakers` entries and empty node speakers (`speaker: ''`)
 * when a dialogue cannot safely inherit a single listed speaker on export (zero or multiple
 * listed speakers, or any entity carrying the dialogue whose `entityId` differs from it).
 * Refuse only — never guess, resolve by display name, or default.
 */
export function listAiRpgDialogueSpeakerBlockers(
  project: Pick<WorldProject, 'dialogues' | 'entityPlacements'>,
): AiRpgDialogueSpeakerBlocker[] {
  const { exportedEntityIds, carriersByDialogueId } = collectDialoguePlacements(project.entityPlacements);

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

    if (dlg?.nodes && typeof dlg.nodes === 'object') {
      if (speakers.length !== 1) {
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
      } else {
        const listedSpeaker = speakers[0];
        const carriers = carriersByDialogueId.get(dialogueId) ?? [];
        const mismatchedCarriers = carriers.filter((entityId) => entityId !== listedSpeaker);
        if (mismatchedCarriers.length > 0) {
          for (const [nodeId, node] of Object.entries(dlg.nodes)) {
            if (node?.speaker === '') {
              for (const carrierEntityId of mismatchedCarriers) {
                blockers.push({
                  dialogueId,
                  nodeId,
                  speaker: '',
                  carrierEntityId,
                  message: `Dialogue "${dialogueId}" node "${nodeId}" has an empty speaker, but entity "${carrierEntityId}" carries it instead of listed speaker "${listedSpeaker}".`,
                });
              }
            }
          }
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
  const { carriersByDialogueId } = collectDialoguePlacements(project.entityPlacements);
  return project.dialogues.map((dlg) => {
    const carriers = carriersByDialogueId.get(dlg.id) ?? [];
    const fallbackSpeaker =
      dlg.speakers.length === 1 && carriers.every((entityId) => entityId === dlg.speakers[0])
        ? dlg.speakers[0]
        : undefined;
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
