// ProgressionPanel.tsx — progression tree editor

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import type { ProgressionTreeDefinition, ProgressionNode, ProgressionEffect } from '@world-forge/schema';

export function ProgressionPanel() {
  const { project, addProgressionTree, updateProgressionTree, removeProgressionTree,
    addProgressionNode, updateProgressionNode, removeProgressionNode } = useProjectStore();
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  const trees = project.progressionTrees;
  const selectedTree = trees.find((t) => t.id === selectedTreeId);

  const handleAddTree = () => {
    const id = `tree-${Date.now()}`;
    addProgressionTree({ id, name: 'New Tree', currency: 'xp', nodes: [] });
    setSelectedTreeId(id);
  };

  const handleAddNode = () => {
    if (!selectedTreeId) return;
    const id = `node-${Date.now()}`;
    addProgressionNode(selectedTreeId, { id, name: 'New Node', cost: 1, effects: [] });
    setEditingNodeId(id);
  };

  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>Progression Trees</div>

      {/* Tree list */}
      {trees.map((t) => (
        <div key={t.id}
          onClick={() => { setSelectedTreeId(t.id); setEditingNodeId(null); }}
          style={{
            ...itemStyle,
            borderColor: selectedTreeId === t.id ? '#58a6ff' : '#30363d',
            cursor: 'pointer',
          }}>
          <div style={{ fontSize: 12, color: '#c9d1d9' }}>{t.name}</div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>{t.nodes.length} node(s) | currency: {t.currency}</div>
        </div>
      ))}
      <button onClick={handleAddTree} style={addBtnStyle}>+ Add Tree</button>

      {/* Selected tree editor */}
      {selectedTree && (
        <div style={{ marginTop: 12, borderTop: '1px solid #30363d', paddingTop: 8 }}>
          <label style={labelStyle}>Tree Name
            <input style={inputStyle} value={selectedTree.name}
              onChange={(e) => updateProgressionTree(selectedTree.id, { name: e.target.value })} />
          </label>
          <label style={labelStyle}>Currency
            <input style={inputStyle} value={selectedTree.currency}
              onChange={(e) => updateProgressionTree(selectedTree.id, { currency: e.target.value })} />
          </label>
          <button onClick={() => { removeProgressionTree(selectedTree.id); setSelectedTreeId(null); }}
            style={{ ...smallBtnStyle, color: '#f85149', marginBottom: 8 }}>Delete Tree</button>

          {/* Node list */}
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Nodes</div>
          {selectedTree.nodes.map((node) => (
            <div key={node.id} style={itemStyle}>
              {editingNodeId === node.id ? (
                <NodeEditor
                  node={node}
                  treeId={selectedTree.id}
                  allNodes={selectedTree.nodes}
                  onUpdate={updateProgressionNode}
                  onRemove={(nodeId) => { removeProgressionNode(selectedTree.id, nodeId); setEditingNodeId(null); }}
                  onDone={() => setEditingNodeId(null)}
                />
              ) : (
                <div onClick={() => setEditingNodeId(node.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, color: '#c9d1d9' }}>{node.name} <span style={{ fontSize: 10, color: '#d29922' }}>({node.cost} {selectedTree.currency})</span></div>
                  {node.requires && node.requires.length > 0 && (
                    <div style={{ fontSize: 10, color: '#8b949e' }}>requires: {node.requires.join(', ')}</div>
                  )}
                  <div style={{ fontSize: 10, color: '#8b949e' }}>{node.effects.length} effect(s)</div>
                </div>
              )}
            </div>
          ))}
          <button onClick={handleAddNode} style={addBtnStyle}>+ Add Node</button>
        </div>
      )}
    </div>
  );
}

function NodeEditor({ node, treeId, allNodes, onUpdate, onRemove, onDone }: {
  node: ProgressionNode;
  treeId: string;
  allNodes: ProgressionNode[];
  onUpdate: (treeId: string, nodeId: string, updates: Partial<ProgressionNode>) => void;
  onRemove: (nodeId: string) => void;
  onDone: () => void;
}) {
  return (
    <>
      <label style={labelStyle}>Name
        <input style={inputStyle} value={node.name}
          onChange={(e) => onUpdate(treeId, node.id, { name: e.target.value })} />
      </label>
      <label style={labelStyle}>Description
        <textarea style={{ ...inputStyle, height: 40, resize: 'vertical' }} value={node.description ?? ''}
          onChange={(e) => onUpdate(treeId, node.id, { description: e.target.value || undefined })} />
      </label>
      <label style={labelStyle}>Cost
        <input style={inputStyle} type="number" value={node.cost}
          onChange={(e) => onUpdate(treeId, node.id, { cost: Number(e.target.value) })} />
      </label>
      <label style={labelStyle}>Requires (select prerequisites)
        <select style={inputStyle} multiple value={node.requires ?? []}
          onChange={(e) => {
            const selected = Array.from(e.target.selectedOptions, (o) => o.value);
            onUpdate(treeId, node.id, { requires: selected.length > 0 ? selected : undefined });
          }}>
          {allNodes.filter((n) => n.id !== node.id).map((n) => (
            <option key={n.id} value={n.id}>{n.name}</option>
          ))}
        </select>
      </label>

      <ProgressionEffectEditor
        effects={node.effects}
        onChange={(effects) => onUpdate(treeId, node.id, { effects })}
      />

      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <button onClick={onDone} style={smallBtnStyle}>Done</button>
        <button onClick={() => onRemove(node.id)} style={{ ...smallBtnStyle, color: '#f85149' }}>Delete</button>
      </div>
    </>
  );
}

function ProgressionEffectEditor({ effects, onChange }: {
  effects: ProgressionEffect[];
  onChange: (effects: ProgressionEffect[]) => void;
}) {
  const handleAdd = () => {
    onChange([...effects, { type: 'grant-verb', params: {} }]);
  };

  const handleUpdate = (i: number, updates: Partial<ProgressionEffect>) => {
    onChange(effects.map((e, idx) => idx === i ? { ...e, ...updates } : e));
  };

  const handleRemove = (i: number) => {
    onChange(effects.filter((_, idx) => idx !== i));
  };

  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 2 }}>Effects</div>
      {effects.map((eff, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
          <input style={{ ...inputStyle, width: 80, marginTop: 0 }} value={eff.type} placeholder="type"
            onChange={(e) => handleUpdate(i, { type: e.target.value })} />
          <select style={{ ...inputStyle, width: 60, marginTop: 0 }} value={eff.target ?? ''}
            onChange={(e) => handleUpdate(i, { target: (e.target.value || undefined) as ProgressionEffect['target'] })}>
            <option value="">-</option>
            <option value="actor">actor</option>
            <option value="target">target</option>
            <option value="zone">zone</option>
          </select>
          <button onClick={() => handleRemove(i)} style={xBtnStyle}>&times;</button>
        </div>
      ))}
      <button onClick={handleAdd} style={{ ...addBtnStyle, fontSize: 10 }}>+ effect</button>
    </div>
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
