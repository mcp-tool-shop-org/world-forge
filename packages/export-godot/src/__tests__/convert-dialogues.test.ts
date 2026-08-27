/**
 * convert-dialogues.test.ts — DialogueDefinition → Godot dialogue resource.
 */

import { describe, it, expect } from 'vitest';
import { convertDialogues } from '../convert-dialogues.js';
import type { WorldProject, DialogueDefinition } from '@world-forge/schema';

function proj(dialogues: DialogueDefinition[]): WorldProject {
    return { dialogues } as unknown as WorldProject;
}

describe('convertDialogues', () => {
    it('maps a tree 1:1 including choices and stamps a .tres resourcePath', () => {
        const { dialogues, fidelity } = convertDialogues(proj([{
            id: 'dlg-keeper',
            speakers: ['keeper'],
            entryNodeId: 'greet',
            nodes: {
                greet: {
                    id: 'greet',
                    speaker: 'Keeper',
                    text: 'Welcome.',
                    choices: [{ id: 'bye', text: 'Farewell.', nextNodeId: 'end' }],
                },
                end: { id: 'end', speaker: 'Keeper', text: 'Safe travels.' },
            },
        }]));
        expect(dialogues[0].resourcePath).toBe('res://world_data/dialogues/dlg-keeper.tres');
        expect(dialogues[0].nodeCount).toBe(2);
        expect(dialogues[0].nodes.greet.choices?.[0].nextNodeId).toBe('end');
        expect(fidelity[0].level).toBe('lossless');
    });

    it('reports dropped when the entry node is missing and does not emit the resource (F-16409655)', () => {
        const { dialogues, fidelity } = convertDialogues(proj([{
            id: 'broken',
            speakers: ['x'],
            entryNodeId: 'missing',
            nodes: { greet: { id: 'greet', speaker: 'X', text: 'Hi' } },
        }]));
        expect(dialogues).toHaveLength(0);
        expect(fidelity.some((f) => f.level === 'dropped' && f.fieldPath?.includes('entryNodeId') && f.message.includes('broken'))).toBe(true);
    });
});
