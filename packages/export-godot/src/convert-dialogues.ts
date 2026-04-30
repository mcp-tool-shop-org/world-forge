/**
 * convert-dialogues.ts — DialogueDefinition → Godot dialogue resources.
 *
 * Exports dialogues as structured JSON resources compatible with Godot dialogue
 * systems (e.g. Dialogic 2, custom GDScript dialogue managers). Each dialogue
 * tree becomes a `.tres`-style resource with nodes, choices, and effects.
 */

import type { WorldProject, DialogueDefinition, DialogueNode, DialogueChoice } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export interface GodotDialogueChoice {
  id: string;
  text: string;
  nextNodeId: string;
  condition?: { type: string; params: Record<string, unknown> };
  effects?: Array<{ type: string; target?: string; params: Record<string, unknown> }>;
}

export interface GodotDialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices?: GodotDialogueChoice[];
  effects?: Array<{ type: string; target?: string; params: Record<string, unknown> }>;
  nextNodeId?: string;
}

export interface GodotDialogueResource {
  /** Resource path: res://world_data/dialogues/<id>.tres */
  resourcePath: string;
  id: string;
  speakers: string[];
  entryNodeId: string;
  nodes: Record<string, GodotDialogueNode>;
  /** Total node count for validation. */
  nodeCount: number;
}

export interface ConvertDialoguesResult {
  dialogues: GodotDialogueResource[];
  fidelity: FidelityEntry[];
}

export function convertDialogues(project: WorldProject): ConvertDialoguesResult {
  const fidelity: FidelityEntry[] = [];
  const dialogues: GodotDialogueResource[] = [];

  for (const dlg of project.dialogues) {
    const converted = convertDialogue(dlg, fidelity);
    dialogues.push(converted);
  }

  return { dialogues, fidelity };
}

function convertDialogue(dlg: DialogueDefinition, fidelity: FidelityEntry[]): GodotDialogueResource {
  const nodes: Record<string, GodotDialogueNode> = {};

  for (const [nodeId, node] of Object.entries(dlg.nodes)) {
    nodes[nodeId] = convertNode(node);
  }

  // Validate entry node exists.
  if (!nodes[dlg.entryNodeId]) {
    fidelity.push({
      level: 'dropped',
      domain: 'dialogues',
      severity: 'error',
      entityId: dlg.id,
      fieldPath: `dialogues.${dlg.id}.entryNodeId`,
      message: `Dialogue "${dlg.id}" entry node "${dlg.entryNodeId}" not found in nodes.`,
      reason: 'Broken entry reference — dialogue tree is unreachable.',
    });
  } else {
    fidelity.push({
      level: 'lossless',
      domain: 'dialogues',
      severity: 'info',
      entityId: dlg.id,
      fieldPath: `dialogues.${dlg.id}`,
      message: `Dialogue "${dlg.id}" (${Object.keys(nodes).length} nodes) preserved.`,
      reason: 'Full dialogue tree mapped 1:1 to Godot resource.',
    });
  }

  return {
    resourcePath: `res://world_data/dialogues/${dlg.id}.tres`,
    id: dlg.id,
    speakers: dlg.speakers.slice(),
    entryNodeId: dlg.entryNodeId,
    nodes,
    nodeCount: Object.keys(nodes).length,
  };
}

function convertNode(node: DialogueNode): GodotDialogueNode {
  const out: GodotDialogueNode = {
    id: node.id,
    speaker: node.speaker,
    text: node.text,
  };

  if (node.choices && node.choices.length > 0) {
    out.choices = node.choices.map(convertChoice);
  }
  if (node.effects && node.effects.length > 0) {
    out.effects = node.effects.map((e) => ({
      type: e.type,
      target: e.target,
      params: { ...e.params } as Record<string, unknown>,
    }));
  }
  if (node.nextNodeId) {
    out.nextNodeId = node.nextNodeId;
  }
  return out;
}

function convertChoice(c: DialogueChoice): GodotDialogueChoice {
  const out: GodotDialogueChoice = {
    id: c.id,
    text: c.text,
    nextNodeId: c.nextNodeId,
  };
  if (c.condition) {
    out.condition = { type: c.condition.type, params: { ...c.condition.params } as Record<string, unknown> };
  }
  if (c.effects && c.effects.length > 0) {
    out.effects = c.effects.map((e) => ({
      type: e.type,
      target: e.target,
      params: { ...e.params } as Record<string, unknown>,
    }));
  }
  return out;
}
