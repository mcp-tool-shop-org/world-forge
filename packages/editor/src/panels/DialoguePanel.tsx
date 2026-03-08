// DialoguePanel.tsx — dialogue tree editor

import { useState, useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import type { DialogueDefinition, DialogueNode, DialogueChoice, DialogueEffect, DialogueCondition } from '@world-forge/schema';

export function DialoguePanel() {
  const { project, addDialogue, updateDialogue, removeDialogue,
    addDialogueNode, updateDialogueNode, removeDialogueNode } = useProjectStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const dialogues = project.dialogues;
  const selected = dialogues.find((d) => d.id === selectedId);

  const handleAdd = () => {
    const id = `dlg-${Date.now()}`;
    const entryId = `node-start`;
    addDialogue({
      id,
      speakers: [],
      entryNodeId: entryId,
      nodes: { [entryId]: { id: entryId, speaker: '', text: 'Hello.', choices: [] } },
    });
    setSelectedId(id);
  };

  // Detect broken references
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

  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>Dialogues</div>

      {/* Dialogue list */}
      {dialogues.map((d) => (
        <div key={d.id}
          onClick={() => { setSelectedId(d.id); setEditingNodeId(null); }}
          style={{
            ...itemStyle,
            borderColor: selectedId === d.id ? '#58a6ff' : '#30363d',
            cursor: 'pointer',
          }}>
          <div style={{ fontSize: 12, color: '#c9d1d9' }}>{d.id}</div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>
            {Object.keys(d.nodes).length} node(s) | entry: {d.entryNodeId}
            {d.speakers.length > 0 && ` | speakers: ${d.speakers.join(', ')}`}
          </div>
        </div>
      ))}
      <button onClick={handleAdd} style={addBtnStyle}>+ Add Dialogue</button>

      {/* Selected dialogue editor */}
      {selected && (
        <div style={{ marginTop: 12, borderTop: '1px solid #30363d', paddingTop: 8 }}>
          <label style={labelStyle}>Dialogue ID
            <input style={inputStyle} value={selected.id} disabled />
          </label>
          <label style={labelStyle}>Speakers (comma-separated entity IDs)
            <input style={inputStyle} value={selected.speakers.join(', ')}
              onChange={(e) => updateDialogue(selected.id, {
                speakers: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
              })} />
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
            <div style={{ fontSize: 11, color: '#f85149', marginBottom: 8 }}>
              Broken refs: {[...brokenRefs].join(', ')}
            </div>
          )}

          <button onClick={() => { removeDialogue(selected.id); setSelectedId(null); }}
            style={{ ...smallBtnStyle, color: '#f85149', marginBottom: 8 }}>Delete Dialogue</button>

          {/* Node list */}
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Nodes</div>
          {Object.values(selected.nodes).map((node) => {
            const isEntry = node.id === selected.entryNodeId;
            return (
              <div key={node.id} style={{ ...itemStyle, borderColor: isEntry ? '#3fb950' : '#30363d' }}>
                {editingNodeId === node.id ? (
                  <DialogueNodeEditor
                    node={node}
                    dialogueId={selected.id}
                    allNodeIds={Object.keys(selected.nodes)}
                    brokenRefs={brokenRefs}
                    onUpdate={updateDialogueNode}
                    onRemove={(nodeId) => { removeDialogueNode(selected.id, nodeId); setEditingNodeId(null); }}
                    onDone={() => setEditingNodeId(null)}
                  />
                ) : (
                  <div onClick={() => setEditingNodeId(node.id)} style={{ cursor: 'pointer' }}>
                    <div style={{ fontSize: 12, color: '#c9d1d9' }}>
                      {isEntry && <span style={{ color: '#3fb950', fontSize: 10, marginRight: 4 }}>[ENTRY]</span>}
                      {node.id}
                    </div>
                    <div style={{ fontSize: 11, color: '#8b949e' }}>
                      {node.speaker && `${node.speaker}: `}{node.text.slice(0, 50)}{node.text.length > 50 ? '...' : ''}
                    </div>
                    {(node.choices?.length ?? 0) > 0 && (
                      <div style={{ fontSize: 10, color: '#58a6ff' }}>{node.choices!.length} choice(s)</div>
                    )}
                    {node.nextNodeId && (
                      <div style={{ fontSize: 10, color: brokenRefs.has(node.nextNodeId) ? '#f85149' : '#8b949e' }}>
                        next: {node.nextNodeId}
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
  node: DialogueNode;
  dialogueId: string;
  allNodeIds: string[];
  brokenRefs: Set<string>;
  onUpdate: (dialogueId: string, nodeId: string, updates: Partial<DialogueNode>) => void;
  onRemove: (nodeId: string) => void;
  onDone: () => void;
}) {
  const update = (updates: Partial<DialogueNode>) => onUpdate(dialogueId, node.id, updates);

  const handleAddChoice = () => {
    const choices = [...(node.choices ?? []), {
      id: `choice-${Date.now()}`, text: 'New choice', nextNodeId: '',
    }];
    update({ choices });
  };

  const handleUpdateChoice = (i: number, updates: Partial<DialogueChoice>) => {
    const choices = (node.choices ?? []).map((c, idx) => idx === i ? { ...c, ...updates } : c);
    update({ choices });
  };

  const handleRemoveChoice = (i: number) => {
    update({ choices: (node.choices ?? []).filter((_, idx) => idx !== i) });
  };

  return (
    <>
      <label style={labelStyle}>Speaker
        <input style={inputStyle} value={node.speaker}
          onChange={(e) => update({ speaker: e.target.value })} />
      </label>
      <label style={labelStyle}>Text
        <textarea style={{ ...inputStyle, height: 60, resize: 'vertical' }} value={node.text}
          onChange={(e) => update({ text: e.target.value })} />
      </label>
      <label style={labelStyle}>Auto-advance to (no choices)
        <select style={inputStyle} value={node.nextNodeId ?? ''}
          onChange={(e) => update({ nextNodeId: e.target.value || undefined })}>
          <option value="">None</option>
          {allNodeIds.filter((id) => id !== node.id).map((id) => (
            <option key={id} value={id} style={{ color: brokenRefs.has(id) ? '#f85149' : undefined }}>{id}</option>
          ))}
        </select>
      </label>

      {/* Choices */}
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 2, marginTop: 8 }}>Choices</div>
      {(node.choices ?? []).map((choice, i) => (
        <div key={i} style={{ padding: 4, background: '#0d1117', borderRadius: 3, marginBottom: 4, border: '1px solid #30363d' }}>
          <input style={{ ...inputStyle, marginTop: 0 }} value={choice.text} placeholder="Choice text"
            onChange={(e) => handleUpdateChoice(i, { text: e.target.value })} />
          <select style={{ ...inputStyle, marginTop: 2 }} value={choice.nextNodeId}
            onChange={(e) => handleUpdateChoice(i, { nextNodeId: e.target.value })}>
            <option value="">None</option>
            {allNodeIds.filter((id) => id !== node.id).map((id) => (
              <option key={id} value={id}>{id}</option>
            ))}
          </select>
          {choice.nextNodeId && brokenRefs.has(choice.nextNodeId) && (
            <div style={{ fontSize: 10, color: '#f85149' }}>Broken reference!</div>
          )}
          <button onClick={() => handleRemoveChoice(i)} style={{ ...xBtnStyle, fontSize: 10 }}>remove choice</button>
        </div>
      ))}
      <button onClick={handleAddChoice} style={{ ...addBtnStyle, fontSize: 10 }}>+ choice</button>

      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        <button onClick={onDone} style={smallBtnStyle}>Done</button>
        <button onClick={() => onRemove(node.id)} style={{ ...smallBtnStyle, color: '#f85149' }}>Delete Node</button>
      </div>
    </>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', background: '#0d1117', color: '#c9d1d9',
  border: '1px solid #30363d', borderRadius: 3, padding: '3px 6px', fontSize: 12, marginTop: 2,
};
const addBtnStyle: React.CSSProperties = {
  fontSize: 11, background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 3, cursor: 'pointer', padding: '4px 10px', width: '100%', marginTop: 4,
};
const smallBtnStyle: React.CSSProperties = {
  fontSize: 10, background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 3, cursor: 'pointer', padding: '2px 8px',
};
const xBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#f85149',
  cursor: 'pointer', fontSize: 14, padding: '0 4px',
};
const itemStyle: React.CSSProperties = {
  padding: 6, background: '#161b22', borderRadius: 3, marginBottom: 4, border: '1px solid #30363d',
};
