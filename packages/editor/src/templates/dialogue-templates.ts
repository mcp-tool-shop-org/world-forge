// dialogue-templates.ts — FT-023: Dialogue Templates

import type { DialogueDefinition, DialogueNode, DialogueChoice } from '@world-forge/schema';

export interface DialogueTemplate {
  id: string;
  label: string;
  category: 'social' | 'quest' | 'commerce' | 'warning';
  generate: () => DialogueDefinition;
}

// ── Helpers ──────────────────────────────────────────────────────

let _counter = 0;
function uid(prefix: string): string {
  return `${prefix}-${Date.now()}-${++_counter}`;
}

function node(id: string, speaker: string, text: string, choices?: DialogueChoice[], nextNodeId?: string): DialogueNode {
  return { id, speaker, text, choices, nextNodeId };
}

function choice(id: string, text: string, nextNodeId: string): DialogueChoice {
  return { id, text, nextNodeId };
}

// ── Template generators ──────────────────────────────────────────

function greetingDialogue(): DialogueDefinition {
  const id = uid('dlg-greeting');
  return {
    id,
    speakers: ['npc', 'player'],
    entryNodeId: 'greet-1',
    nodes: {
      'greet-1': node('greet-1', 'npc', 'Well met, traveler! What brings you to these parts?', [
        choice('c1', 'Just passing through.', 'greet-pass'),
        choice('c2', 'I have questions.', 'greet-questions'),
        choice('c3', 'Goodbye.', 'greet-end'),
      ]),
      'greet-pass': node('greet-pass', 'npc', 'Safe travels, then. The roads can be unkind.', undefined, 'greet-end'),
      'greet-questions': node('greet-questions', 'npc', 'Ask away. I know a thing or two about this place.', [
        choice('c4', 'Tell me about this area.', 'greet-pass'),
        choice('c5', 'Nevermind.', 'greet-end'),
      ]),
      'greet-end': node('greet-end', 'npc', 'Farewell.'),
    },
  };
}

function questGiverDialogue(): DialogueDefinition {
  const id = uid('dlg-quest');
  return {
    id,
    speakers: ['quest-giver', 'player'],
    entryNodeId: 'quest-1',
    nodes: {
      'quest-1': node('quest-1', 'quest-giver', 'I need someone capable. Are you interested in a job?', [
        choice('c1', 'What kind of job?', 'quest-details'),
        choice('c2', 'Not right now.', 'quest-decline'),
      ]),
      'quest-details': node('quest-details', 'quest-giver', 'There is something dangerous in the ruins nearby. Clear it out and I will pay well.', [
        choice('c3', 'I accept.', 'quest-accept'),
        choice('c4', 'Too dangerous for me.', 'quest-decline'),
      ]),
      'quest-accept': node('quest-accept', 'quest-giver', 'Excellent. Return when the deed is done.'),
      'quest-decline': node('quest-decline', 'quest-giver', 'Suit yourself. The offer stands if you change your mind.'),
    },
  };
}

function merchantDialogue(): DialogueDefinition {
  const id = uid('dlg-merchant');
  return {
    id,
    speakers: ['merchant', 'player'],
    entryNodeId: 'merch-1',
    nodes: {
      'merch-1': node('merch-1', 'merchant', 'Welcome to my shop! Care to browse my wares?', [
        choice('c1', 'Show me what you have.', 'merch-browse'),
        choice('c2', 'Any rare items today?', 'merch-rare'),
        choice('c3', 'Just looking.', 'merch-end'),
      ]),
      'merch-browse': node('merch-browse', 'merchant', 'Take your time. Everything is fairly priced.', undefined, 'merch-end'),
      'merch-rare': node('merch-rare', 'merchant', 'I might have something special in the back... for the right price.', [
        choice('c4', 'Name your price.', 'merch-browse'),
        choice('c5', 'Maybe next time.', 'merch-end'),
      ]),
      'merch-end': node('merch-end', 'merchant', 'Come back anytime!'),
    },
  };
}

function warningDialogue(): DialogueDefinition {
  const id = uid('dlg-warning');
  return {
    id,
    speakers: ['guard', 'player'],
    entryNodeId: 'warn-1',
    nodes: {
      'warn-1': node('warn-1', 'guard', 'Halt! The area ahead is restricted. Turn back.', [
        choice('c1', 'I have authorization.', 'warn-auth'),
        choice('c2', 'What is the danger?', 'warn-explain'),
        choice('c3', 'Understood. I will leave.', 'warn-end'),
      ]),
      'warn-auth': node('warn-auth', 'guard', 'Very well, proceed with caution.'),
      'warn-explain': node('warn-explain', 'guard', 'Strange creatures have been spotted. We lost two patrols already.', undefined, 'warn-end'),
      'warn-end': node('warn-end', 'guard', 'Stay safe out there.'),
    },
  };
}

function farewellDialogue(): DialogueDefinition {
  const id = uid('dlg-farewell');
  return {
    id,
    speakers: ['companion', 'player'],
    entryNodeId: 'fare-1',
    nodes: {
      'fare-1': node('fare-1', 'companion', 'This is where our paths part. It has been an honor.', [
        choice('c1', 'The honor was mine.', 'fare-honor'),
        choice('c2', 'Will we meet again?', 'fare-again'),
      ]),
      'fare-honor': node('fare-honor', 'companion', 'May fortune favor you, friend.', undefined, 'fare-end'),
      'fare-again': node('fare-again', 'companion', 'If fate wills it. Until then, carry this token.', undefined, 'fare-end'),
      'fare-end': node('fare-end', 'companion', 'Farewell.'),
    },
  };
}

// ── Exported array ───────────────────────────────────────────────

export const DIALOGUE_TEMPLATES: DialogueTemplate[] = [
  { id: 'greeting', label: 'Greeting', category: 'social', generate: greetingDialogue },
  { id: 'quest-giver', label: 'Quest Giver', category: 'quest', generate: questGiverDialogue },
  { id: 'merchant', label: 'Merchant', category: 'commerce', generate: merchantDialogue },
  { id: 'warning', label: 'Warning', category: 'warning', generate: warningDialogue },
  { id: 'farewell', label: 'Farewell', category: 'social', generate: farewellDialogue },
];
