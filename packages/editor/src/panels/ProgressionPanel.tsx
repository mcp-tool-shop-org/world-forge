// ProgressionPanel.tsx — progression tree editor

import { useState, useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { EmptyState, useFocusHighlight } from './shared.js';
import { sectionHeader as sectionTitle, labelText as labelStyle, inputBase as inputStyle, buttonFullWidth as addBtnStyle, buttonCompact as smallBtnStyle, buttonRemove as xBtnStyle, cardItem as itemStyle, hintText as hintStyle } from '../ui/styles.js';
import type { ProgressionNode, ProgressionEffect } from '@world-forge/schema';

const STARTER_TREE = {
  id: 'combat-basics',
  name: 'Combat Basics',
  currency: 'xp',
  nodes: [
    { id: 'power-strike', name: 'Power Strike', cost: 2, effects: [{ type: 'grant-verb', params: { verb: 'power-strike' } }] },
    { id: 'shield-bash', name: 'Shield Bash', cost: 3, requires: ['power-strike'] as string[], effects: [{ type: 'grant-verb', params: { verb: 'shield-bash' } }] },
  ],
};

export function ProgressionPanel() {
  const { project, addProgressionTree, updateProgressionTree, removeProgressionTree,
    addProgressionNode, updateProgressionNode, removeProgressionNode } = useProjectStore();
  const { selectEntity, setRightTab } = useEditorStore();
  const focusRef = useFocusHighlight('progression');
  const [selectedTreeId, setSelectedTreeId] = useState<string | null>(null);
  const [editingNodeId, setEditingNodeId] = useState<string | null>(null);

  // FT-025: Cross-reference progression nodes with entities that reference them.
  // Scans dialogue effects for grant-verb/grant-ability that match node IDs,
  // then links back to the dialogue's speaker entities.
  const nodeEntityRefs = useMemo(() => {
    const refs = new Map<string, { entityId: string; name: string }[]>();

    // Collect all node IDs across all trees for quick lookup
    const allNodeIds = new Set<string>();
    for (const tree of project.progressionTrees) {
      for (const node of tree.nodes) allNodeIds.add(node.id);
    }
    if (allNodeIds.size === 0) return refs;

    // Scan dialogues for effects that grant abilities matching node IDs
    for (const dialogue of project.dialogues) {
      // Collect which node IDs this dialogue grants
      const grantedNodeIds = new Set<string>();
      for (const dn of Object.values(dialogue.nodes)) {
        for (const eff of (dn.effects ?? [])) {
          if (eff.type === 'grant-ability' || eff.type === 'grant-verb') {
            const val = String(eff.params?.ability ?? eff.params?.verb ?? '');
            if (val && allNodeIds.has(val)) grantedNodeIds.add(val);
          }
        }
      }
      if (grantedNodeIds.size === 0) continue;

      // Find entities that are speakers in this dialogue
      const speakerEntityIds = new Set<string>();
      for (const speaker of dialogue.speakers) {
        const ep = project.entityPlacements.find((e) => e.entityId === speaker || e.name === speaker);
        if (ep) speakerEntityIds.add(ep.entityId);
      }

      // Link granted nodes to speaker entities
      for (const nodeId of grantedNodeIds) {
        const existing = refs.get(nodeId) ?? [];
        for (const eid of speakerEntityIds) {
          if (!existing.some((r) => r.entityId === eid)) {
            const ep = project.entityPlacements.find((e) => e.entityId === eid);
            existing.push({ entityId: eid, name: ep?.name ?? eid });
          }
        }
        refs.set(nodeId, existing);
      }
    }
    return refs;
  }, [project.entityPlacements, project.progressionTrees, project.dialogues]);

  const trees = project.progressionTrees;
  const selectedTree = trees.find((t) => t.id === selectedTreeId);

  const handleAddTree = () => {
    const id = `tree-${Date.now()}`;
    addProgressionTree({ id, name: 'New Tree', currency: 'xp', nodes: [] });
    setSelectedTreeId(id);
  };

  const handleAddStarter = () => {
    addProgressionTree(STARTER_TREE);
    setSelectedTreeId(STARTER_TREE.id);
  };

  const handleAddNode = () => {
    if (!selectedTreeId) return;
    const id = `node-${Date.now()}`;
    addProgressionNode(selectedTreeId, { id, name: 'New Node', cost: 1, effects: [] });
    setEditingNodeId(id);
  };

  if (trees.length === 0) {
    return (
      <EmptyState
        title="Progression Trees"
        description="Skill and ability trees that players unlock with XP or other currencies. Each tree has nodes with costs, prerequisites, and effects."
        actions={[
          { label: '+ Starter Tree (Combat Basics)', onClick: handleAddStarter },
          { label: '+ Empty Tree', onClick: handleAddTree },
        ]}
      />
    );
  }

  return (
    <div ref={focusRef}>
      <div style={sectionTitle}>Trees</div>
      {trees.map((t) => (
        <div key={t.id}
          onClick={() => { setSelectedTreeId(t.id); setEditingNodeId(null); }}
          style={{ ...itemStyle, borderColor: selectedTreeId === t.id ? '#58a6ff' : '#30363d', cursor: 'pointer' }}>
          <div style={{ fontSize: 12, color: '#c9d1d9' }}>{t.name}</div>
          <div style={{ fontSize: 10, color: '#8b949e' }}>{t.nodes.length} node(s) | currency: {t.currency}</div>
        </div>
      ))}
      <button onClick={handleAddTree} style={addBtnStyle}>+ Add Tree</button>

      {selectedTree && (
        <div style={{ marginTop: 12, borderTop: '1px solid #21262d', paddingTop: 8 }}>
          <div style={sectionTitle}>Tree Settings</div>
          <label style={labelStyle}>Name
            <input style={inputStyle} value={selectedTree.name}
              onChange={(e) => updateProgressionTree(selectedTree.id, { name: e.target.value })} />
          </label>
          <label style={labelStyle}>Currency
            <input style={inputStyle} value={selectedTree.currency} placeholder="e.g. xp, skill-points"
              onChange={(e) => updateProgressionTree(selectedTree.id, { currency: e.target.value })} />
          </label>
          <button onClick={() => { removeProgressionTree(selectedTree.id); setSelectedTreeId(null); }}
            style={{ ...smallBtnStyle, color: '#f85149', marginBottom: 8 }}>Delete Tree</button>

          <div style={sectionTitle}>Nodes ({selectedTree.nodes.length})</div>
          {selectedTree.nodes.length === 0 && <div style={hintStyle}>No nodes yet. Add one below.</div>}
          {selectedTree.nodes.map((node) => (
            <div key={node.id} style={itemStyle}>
              {editingNodeId === node.id ? (
                <NodeEditor node={node} treeId={selectedTree.id} allNodes={selectedTree.nodes}
                  onUpdate={updateProgressionNode}
                  onRemove={(nodeId) => { removeProgressionNode(selectedTree.id, nodeId); setEditingNodeId(null); }}
                  onDone={() => setEditingNodeId(null)} />
              ) : (
                <div onClick={() => setEditingNodeId(node.id)} style={{ cursor: 'pointer' }}>
                  <div style={{ fontSize: 12, color: '#c9d1d9', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {node.name} <span style={{ fontSize: 10, color: '#d29922' }}>({node.cost} {selectedTree.currency})</span>
                    {/* FT-025: cross-link hint */}
                    {(nodeEntityRefs.get(node.id)?.length ?? 0) > 0 && (
                      <span
                        data-testid={`cross-link-${node.id}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          const first = nodeEntityRefs.get(node.id)?.[0];
                          if (first) { selectEntity(first.entityId, false); setRightTab('map'); }
                        }}
                        style={{ fontSize: 10, color: '#58a6ff', cursor: 'pointer' }}
                        title={`Referenced by: ${nodeEntityRefs.get(node.id)!.map((r) => r.name).join(', ')}`}
                      >
                        (used by {nodeEntityRefs.get(node.id)!.length} entit{nodeEntityRefs.get(node.id)!.length === 1 ? 'y' : 'ies'})
                      </span>
                    )}
                  </div>
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
  node: ProgressionNode; treeId: string; allNodes: ProgressionNode[];
  onUpdate: (treeId: string, nodeId: string, updates: Partial<ProgressionNode>) => void;
  onRemove: (nodeId: string) => void; onDone: () => void;
}) {
  return (
    <>
      <label style={labelStyle}>Name
        <input style={inputStyle} value={node.name} onChange={(e) => onUpdate(treeId, node.id, { name: e.target.value })} />
      </label>
      <label style={labelStyle}>Description
        <textarea style={{ ...inputStyle, height: 40, resize: 'vertical' }} value={node.description ?? ''} placeholder="Optional flavor text"
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
        <div style={hintStyle}>Ctrl+click to select multiple.</div>
      </label>
      <ProgressionEffectEditor effects={node.effects}
        onChange={(effects) => onUpdate(treeId, node.id, { effects })} />
      <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
        <button onClick={onDone} style={smallBtnStyle}>Done</button>
        <button onClick={() => onRemove(node.id)} style={{ ...smallBtnStyle, color: '#f85149' }}>Delete</button>
      </div>
    </>
  );
}

function ProgressionEffectEditor({ effects, onChange }: {
  effects: ProgressionEffect[]; onChange: (effects: ProgressionEffect[]) => void;
}) {
  return (
    <div style={{ marginBottom: 6 }}>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Effects</div>
      {effects.length === 0 && <div style={hintStyle}>No effects. Add one below.</div>}
      {effects.map((eff, i) => (
        <div key={i} style={{ display: 'flex', gap: 4, marginBottom: 3, alignItems: 'center' }}>
          <input style={{ ...inputStyle, width: 80, marginTop: 0 }} value={eff.type} placeholder="type"
            onChange={(e) => onChange(effects.map((ef, idx) => idx === i ? { ...ef, type: e.target.value } : ef))} />
          <select style={{ ...inputStyle, width: 60, marginTop: 0 }} value={eff.target ?? ''}
            onChange={(e) => onChange(effects.map((ef, idx) => idx === i ? { ...ef, target: (e.target.value || undefined) as ProgressionEffect['target'] } : ef))}>
            <option value="">-</option>
            <option value="actor">actor</option>
            <option value="target">target</option>
            <option value="zone">zone</option>
          </select>
          <button onClick={() => onChange(effects.filter((_, idx) => idx !== i))} style={xBtnStyle} aria-label="Remove effect">&times;</button>
        </div>
      ))}
      <button onClick={() => onChange([...effects, { type: 'grant-verb', params: {} }])}
        style={{ ...addBtnStyle, fontSize: 10 }}>+ effect</button>
    </div>
  );
}
