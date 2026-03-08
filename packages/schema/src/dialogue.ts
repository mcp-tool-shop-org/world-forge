// dialogue.ts — dialogue tree types for NPC conversations

/** Scalar value for conditions and effects. */
export type ScalarValue = string | number | boolean;

/** A condition that gates a choice or triggers an effect. */
export interface DialogueCondition {
  type: string;
  params: Record<string, ScalarValue>;
}

/** An effect that fires when a choice is selected or a node is entered. */
export interface DialogueEffect {
  type: string;
  target?: 'actor' | 'target' | 'zone';
  params: Record<string, ScalarValue>;
}

/** A choice the player can make in a dialogue node. */
export interface DialogueChoice {
  id: string;
  text: string;
  nextNodeId: string;
  condition?: DialogueCondition;
  effects?: DialogueEffect[];
}

/** A single node in a dialogue tree. */
export interface DialogueNode {
  id: string;
  speaker: string;
  text: string;
  choices?: DialogueChoice[];
  effects?: DialogueEffect[];
  /** Auto-advance to this node if no choices are present. */
  nextNodeId?: string;
}

/** A complete dialogue tree attached to an NPC. */
export interface DialogueDefinition {
  id: string;
  speakers: string[];
  entryNodeId: string;
  nodes: Record<string, DialogueNode>;
}
