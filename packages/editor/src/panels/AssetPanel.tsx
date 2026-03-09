// AssetPanel.tsx — asset library management panel

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import type { AssetKind } from '@world-forge/schema';
import { sectionTitle, inputStyle, addBtnStyle, smallBtnStyle } from './shared.js';

const KIND_COLORS: Record<AssetKind, string> = {
  portrait: '#58a6ff',
  sprite: '#3fb950',
  background: '#bc8cff',
  icon: '#d29922',
  tileset: '#39d5ff',
};

const KINDS: AssetKind[] = ['portrait', 'sprite', 'background', 'icon', 'tileset'];

export function AssetPanel() {
  const { project, addAsset, updateAsset, removeAsset } = useProjectStore();
  const [filterKind, setFilterKind] = useState<AssetKind | ''>('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const assets = project.assets.filter((a) => {
    if (filterKind && a.kind !== filterKind) return false;
    if (search && !a.label.toLowerCase().includes(search.toLowerCase()) && !a.id.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  // Find orphaned assets (unreferenced)
  const referencedIds = new Set<string>();
  for (const z of project.zones) {
    if (z.backgroundId) referencedIds.add(z.backgroundId);
    if (z.tilesetId) referencedIds.add(z.tilesetId);
  }
  for (const e of project.entityPlacements) {
    if (e.portraitId) referencedIds.add(e.portraitId);
    if (e.spriteId) referencedIds.add(e.spriteId);
  }
  for (const i of project.itemPlacements) {
    if (i.iconId) referencedIds.add(i.iconId);
  }
  for (const l of project.landmarks) {
    if (l.iconId) referencedIds.add(l.iconId);
  }
  const orphanCount = project.assets.filter((a) => !referencedIds.has(a.id)).length;

  const handleAdd = () => {
    const id = `asset-${Date.now()}`;
    addAsset({ id, kind: 'background', label: 'New Asset', path: '', tags: [] });
    setExpandedId(id);
  };

  return (
    <div>
      <div style={sectionTitle}>Asset Library ({project.assets.length})</div>

      <button onClick={handleAdd} style={addBtnStyle}>+ Add Asset</button>

      <div style={{ display: 'flex', gap: 4, marginTop: 8 }}>
        <select
          style={{ ...inputStyle, flex: '0 0 auto', width: 'auto' }}
          value={filterKind}
          onChange={(e) => setFilterKind(e.target.value as AssetKind | '')}
        >
          <option value="">All kinds</option>
          {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
        </select>
        <input
          style={{ ...inputStyle, flex: 1 }}
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <div style={{ marginTop: 8 }}>
        {assets.length === 0 && (
          <div style={{ fontSize: 12, color: '#8b949e', padding: '8px 0' }}>
            {project.assets.length === 0 ? 'No assets yet. Add one to get started.' : 'No assets match the filter.'}
          </div>
        )}
        {assets.map((a) => {
          const isOrphan = !referencedIds.has(a.id);
          const isExpanded = expandedId === a.id;
          return (
            <div
              key={a.id}
              style={{
                border: '1px solid #30363d', borderRadius: 4, padding: 8, marginBottom: 4,
                background: isExpanded ? '#161b22' : '#0d1117', cursor: 'pointer',
              }}
              onClick={() => setExpandedId(isExpanded ? null : a.id)}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{
                  fontSize: 10, fontWeight: 600, color: '#fff', padding: '1px 6px',
                  borderRadius: 3, background: KIND_COLORS[a.kind],
                }}>
                  {a.kind}
                </span>
                <span style={{ fontSize: 12, color: '#c9d1d9', flex: 1 }}>{a.label}</span>
                {isOrphan && <span style={{ fontSize: 10, color: '#d29922' }}>unused</span>}
                <button
                  onClick={(e) => { e.stopPropagation(); removeAsset(a.id); }}
                  style={{ ...smallBtnStyle, background: '#da3633', color: '#fff', border: 'none' }}
                >
                  x
                </button>
              </div>
              <div style={{ fontSize: 11, color: '#8b949e', marginTop: 2 }}>{a.path || '(no path)'}</div>
              {a.tags.length > 0 && (
                <div style={{ fontSize: 10, color: '#8b949e', marginTop: 2 }}>{a.tags.join(', ')}</div>
              )}

              {isExpanded && (
                <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                  <label style={{ display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                    Label
                    <input style={inputStyle} value={a.label}
                      onChange={(e) => updateAsset(a.id, { label: e.target.value })} />
                  </label>
                  <label style={{ display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                    Kind
                    <select style={inputStyle} value={a.kind}
                      onChange={(e) => updateAsset(a.id, { kind: e.target.value as AssetKind })}>
                      {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
                    </select>
                  </label>
                  <label style={{ display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                    Path
                    <input style={inputStyle} value={a.path}
                      onChange={(e) => updateAsset(a.id, { path: e.target.value })} />
                  </label>
                  <label style={{ display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                    Version
                    <input style={inputStyle} value={a.version ?? ''}
                      onChange={(e) => updateAsset(a.id, { version: e.target.value || undefined })} />
                  </label>
                  <label style={{ display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
                    Tags (comma-separated)
                    <input style={inputStyle} value={a.tags.join(', ')}
                      onChange={(e) => updateAsset(a.id, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
                  </label>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {orphanCount > 0 && (
        <div style={{ fontSize: 11, color: '#d29922', marginTop: 8 }}>
          {orphanCount} asset{orphanCount !== 1 ? 's' : ''} unreferenced
        </div>
      )}
    </div>
  );
}
