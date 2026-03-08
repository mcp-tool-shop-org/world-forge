// DialoguePanel.tsx — dialogue tree editor

import { useState, useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { EmptyState, useFocusHighlight, sectionTitle, labelStyle, inputStyle, addBtnStyle, smallBtnStyle, xBtnStyle, itemStyle, hintStyle } from './shared.js';
import type { DialogueNode, DialogueChoice } from '@world-forge/schema';

const STARTER_DIALOGUE = {
  id: 'keeper-greeting',
  speakers: ['keeper'],
  entryNodeId: 'greeting',
  nodes: {
    greeting: { id: 'greeting', speaker: 'keeper', text: 'Welcome, traveler. What brings you here?', choices: [
      { id: 'c1', text: 'I seek knowledge.', nextNodeId: 'knowledge' },
      { id: 'c2', text: 'Just passing through.', nextNodeId: 'farewell' },
    ] },
    knowledge: { id: 'knowledge', speaker: 'keeper', text: 'Knowledge has a price. Are you prepared?', choices: [
      { id: 'c3', text: 'I am ready.', nextNodeId: 'farewell' },
      { id: 'c4', text: 'Not yet.', nextNodeId: 'farewell' },
    ] },
    farewell: { id: 'farewell', speaker: 'keeper', text: 'Safe travels.', choices: [] },
  },
};

export function DialoguePanel() {
  const { project, addDialogue, updateDialogue, removeDialogue,
    addDialogueNode, updateDialogueNode, removeDialogueNode } = useProjectStore();
  const focusRef = useFocusHighlight('dialogue');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const dialogues = project.dialogues;
  const selected = dialogues.find((d) => d.id === selectedId);

  const handleAdd = () => {
    const id = `dlg-${Date.now()}`;
    const entryId = 'node-start';
    addDialogue({
      id, speakers: [], entryNodeId: entryId,
      nodes: { [entryId]: { id: entryId, speaker: '', text: 'Hello.', choices: [] } },
    });
    setSelectedId(id);
  };

  const handleAddStarter = () => {
    addDialogue(STARTER_DIALOGUE);
    setSelectedId(STARTER_DIALOGUE.id);
  };

  const brokenRefs = useMemo(() => {
    if (!selected) return new Set<string>();
    const broken = new Set<string>();
    const nodeIds = new Set(Object.keys(selected.nodes));
    if (!nodeIds.has(selected.entryNodeId)) broken.add(selected.entryNodeId);
    for (const node of Object.values(selected.nodes)) {
      if (node.nextNodeId && !nodeIds.has(node.nextNodeId)) broken.add(node.nextNodeId);
      for (const choice of node.choices ?? []) {
        if (!nodeIds.has(choice.nextNodeId)) broken.add(choice.nextNodeId);
      }
    }
    return broken;
  }, [selected]);

  if (dialogues.length === 0) {
    return (
      <EmptyState
        title="Dialogues"
        description="Branching conversation trees for NPCs. Each dialogue has nodes with speaker text, player choices, conditions, and effects."
        actions={[
          { label: '+ Starter Dialogue (Keeper)', onClick: handleAddStarter },
          { label: '+ Empty Dialogue', onClick: handleAdd },
        ]}
      />
    );
  }

  return (
    <div ref={focusRef}>
      <div style={sectionTitle}>Dialogues</div>
      {dialogues.map((d) => {
        const nodeCount = Object.keys(d.nodes).length;
        return (
          <div key={d.id}
            onClick={() => { setSelectedId(d.id); setEditingNodeId(null); }}
            style={{ ...itemStyle, borderColor: selectedId === d.id ? '#58a6ff' : '#30363d', cursor: 'pointer' }}>
            <div style={{ fontSize: 12, color: '#c9d1d9' }}>{d.id}</div>
            <div style={{ fontSize: 10, color: '#8b949e' }}>
              {nodeCount} node(s) | entry: {d.entryNodeId}
              {d.speakers.length > 0 && ` | ${d.speakers.join(', ')}`}
            </div>
          </div>
        );
      })}
      <button onClick={handleAdd} style={addBtnStyle}>+ Add Dialogue</button>

      {selected && (
        <div style={{ marginTop: 12, borderTop: '1px solid #21262d', paddingTop: 8 }}>
          <div style={sectionTitle}>Settings</div>
          <label style={labelStyle}>Dialogue ID
            <input style={{ ...inputStyle, color: '#484f58' }} value={selected.id} disabled />
          </label>
          <label style={labelStyle}>Speakers
            <input style={inputStyle} value={selected.speakers.join(', ')} placeholder="e.g. keeper, merchant"
              onChange={(e) => updateDialogue(selected.id, {
                speakers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })} />
            <div style={hintStyle}>Comma-separated entity IDs.</div>
          </label>
          <label style={labelStyle}>Entry Node
            <select style={inputStyle} value={selected.entryNodeId}
              onChange={(e) => updateDialogue(selected.id, { entryNodeId: e.target.value })}>
              {Object.keys(selected.nodes).map((nid) => (
                <option key={nid} value={nid}>{nid}</option>
              ))}
            </select>
          </label>

          {brokenRefs.size > 0 && (
            <div style={{ fontSize: 11, color: '#f85149', padding: '4px 8px', background: '#1c1410', borderRadius: 3, marginBottom: 8 }}>
              Broken references: {[...brokenRefs].join(', ')}
            </div>
          )}

          <button onClick={() => { removeDialogue(selected.id); setSelectedId(null); }}
            style={{ ...smallBtnStyle, color: '#f85149', marginBottom: 8 }}>Delete Dialogue</button>

          <div style={sectionTitle}>Nodes ({Object.keys(selected.nodes).length})</div>
          {Object.values(selected.nodes).map((node) => {
            const isEntry = node.id === selected.entryNodeId;
            return (
              <div key={node.id} style={{ ...itemStyle, borderColor: isEntry ? '#3fb950' : '#30363d' }}>
                {editingNodeId === node.id ? (
                  <DialogueNodeEditor node={node} dialogueId={selected.id}
                    allNodeIds={Object.keys(selected.nodes)} brokenRefs={brokenRefs}
                    onUpdate={updateDialogueNode}
                    onRemove={(nodeId) => { removeDialogueNode(selected.id, nodeId); setEditingNodeId(null); }}
                    onDone={() => setEditingNodeId(null)} />
                ) : (
                  <div onClick={() => setEditingNodeId(node.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 12, color: '#c9d1d9' }}>
                      {isEntry && <span style={{ color: '#3fb950', fontSize: 9, marginRight: 4, fontWeight: 700 }}>ENTRY</span>}
                      {node.id}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b949e' }}>
                      {node.speaker && <span style={{ color: '#58a6ff' }}>{node.speaker}:</span>}{' '}
                      {node.text.slice(0, 50)}{node.text.length > 50 ? '...' : ''}
                    </div>
                    {(node.choices?.length ?? 0) > 0 && (
                      <div style={{ fontSize: 10, color: '#58a6ff' }}>{node.choices!.length} choice(s)</div>
                    )}
                    {node.nextNodeId && (
                      <div style={{ fontSize: 10, color: brokenRefs.has(node.nextNodeId) ? '#f85149' : '#484f58' }}>
                        auto: {node.nextNodeId} {brokenRefs.has(node.nextNodeId) && '(broken!)'}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
          <button onClick={() => {
            const id = `node-${Date.now()}`;
            addDialogueNode(selected.id, { id, speaker: '', text: '', choices: [] });
            setEditingNodeId(id);
          }} style={addBtnStyle}>+ Add Node</button>
        </div>
      )}
    </div>
  );
}

function DialogueNodeEditor({ node, dialogueId, allNodeIds, brokenRefs, onUpdate, onRemove, onDone }: {
  node: DialogueNode; dialogueId: string; allNodeIds: string[]; brokenRefs: Set<string>;
  onUpdate: (dialogueId: string, nodeId: string, updates: Partial<DialogueNode>) => void;
  onRemove: (nodeId: string) => void; onDone: () => void;
}) {
  const update = (updates: Partial<DialogueNode>) => onUpdate(dialogueId, node.id, updates);

  return (
    <>
      <label style={labelStyle}>Speaker
        <input style={inputStyle} value={node.speaker} placeholder="e.g. keeper"
          onChange={(e) => update({ speaker: e.target.value })} />
      </label>
      <label style={labelStyle}>Text
        <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={node.text}
          placeholder="What the speaker says..."
          onChange={(e) => update({ text: e.target.value })} />
      </label>
      <label style={labelStyle}>Auto-advance to
        <select style={inputStyle} value={node.nextNodeId ?? ''}
          onChange={(e) => update({ nextNodeId: e.target.value || undefined })}>
          <option value="">None (use choices instead)</option>
          {allNodeIds.filter((id) => id !== node.id).map((id) => (
            <option key={id} value={id}>{id}</option>
          ))}
        </select>
        <div style={hintStyle}>Used when there are no player choices.</div>
      </label>

      <div style={{ ...sectionTitle, marginTop: 10 }}>Choices</div>
      {(node.choices ?? []).length === 0 && <div style={hintStyle}>No choices. Add one, or set auto-advance above.</div>}
      {(node.choices ?? []).map((choice, i) => (
        <div key={i} style={{ padding: 6, background: '#0d1117', borderRadius: 3, marginBottom: 4, border: '1px solid #21262d' }}>
          <input style={{ ...inputStyle, marginTop: 0 }} value={choice.text} placeholder="Choice text"
            onChange={(e) => {
              const choices = (node.choices ?? []).map((c, idx) => idx === i ? { ...c, text: e.target.value } : c);
              update({ choices });
            }} />
          <select style={{ ...inputStyle, marginTop: 3 }} value={choice.nextNodeId}
            onChange={(e) => {
              const choices = (node.choices ?? []).map((c, idx) => idx === i ? { ...c, nextNodeId: e.target.value } : c);
              update({ choices });
            }}>
            <option value="">None</option>
            {allNodeIds.filter((id) => id !== node.id).map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          {choice.nextNodeId && brokenRefs.has(choice.nextNodeId) && (
            <div style={{ fontSize: 10, color: '#f85149', marginTop: 2 }}>Broken reference!</div>
          )}
          <button onClick={() => update({ choices: (node.choices ?? []).filter((_, idx) => idx !== i) })}
            style={{ ...xBtnStyle, fontSize: 10, marginTop: 2 }}>remove</button>
        </div>
      ))}
      <button onClick={() => {
        const choices = [...(node.choices ?? []), { id: `choice-${Date.now()}`, text: '', nextNodeId: '' }];
        update({ choices });
      }} style={{ ...addBtnStyle, fontSize: 10 }}>+ choice</button>

      <div style={{ display: 'flex', gap: 6, marginTop: 10 }}>
        <button onClick={onDone} style={smallBtnStyle}>Done</button>
        <button onClick={() => onRemove(node.id)} style={{ ...smallBtnStyle, color: '#f85149' }}>Delete Node</button>
      </div>
    </>
  );
}
