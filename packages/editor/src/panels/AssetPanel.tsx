// AssetPanel.tsx — asset library management panel with asset pack support

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

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 11, color: '#8b949e', marginBottom: 4 };

export function AssetPanel() {
  const { project, addAsset, updateAsset, removeAsset, addAssetPack, updateAssetPack, removeAssetPack } = useProjectStore();
  const [filterKind, setFilterKind] = useState<AssetKind | ''>('');
  const [search, setSearch] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [expandedPackId, setExpandedPackId] = useState<string | null>(null);
  const [groupByPack, setGroupByPack] = useState(false);

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

  // Orphaned packs (no assets reference them)
  const usedPackIds = new Set(project.assets.map((a) => a.packId).filter(Boolean));
  const orphanedPackCount = project.assetPacks.filter((p) => !usedPackIds.has(p.id)).length;
  const unassignedCount = project.assets.filter((a) => !a.packId).length;

  const handleAddAsset = () => {
    const id = `asset-${Date.now()}`;
    addAsset({ id, kind: 'background', label: 'New Asset', path: '', tags: [] });
    setExpandedId(id);
  };

  const handleAddPack = () => {
    const id = `pack-${Date.now()}`;
    addAssetPack({ id, label: 'New Pack', version: '1.0.0', tags: [] });
    setExpandedPackId(id);
  };

  const renderAssetCard = (a: typeof assets[0]) => {
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
            <label style={labelStyle}>
              Label
              <input style={inputStyle} value={a.label}
                onChange={(e) => updateAsset(a.id, { label: e.target.value })} />
            </label>
            <label style={labelStyle}>
              Kind
              <select style={inputStyle} value={a.kind}
                onChange={(e) => updateAsset(a.id, { kind: e.target.value as AssetKind })}>
                {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
              </select>
            </label>
            <label style={labelStyle}>
              Path
              <input style={inputStyle} value={a.path}
                onChange={(e) => updateAsset(a.id, { path: e.target.value })} />
            </label>
            <label style={labelStyle}>
              Version
              <input style={inputStyle} value={a.version ?? ''}
                onChange={(e) => updateAsset(a.id, { version: e.target.value || undefined })} />
            </label>
            <label style={labelStyle}>
              Tags (comma-separated)
              <input style={inputStyle} value={a.tags.join(', ')}
                onChange={(e) => updateAsset(a.id, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
            </label>
            <label style={labelStyle}>
              Pack
              <select style={inputStyle} value={a.packId ?? ''}
                onChange={(e) => updateAsset(a.id, { packId: e.target.value || undefined })}>
                <option value="">None</option>
                {project.assetPacks.map((p) => <option key={p.id} value={p.id}>{p.label}</option>)}
              </select>
            </label>
          </div>
        )}
      </div>
    );
  };

  return (
    <div>
      <div style={sectionTitle}>Asset Library ({project.assets.length})</div>

      <div style={{ display: 'flex', gap: 4 }}>
        <button onClick={handleAddPack} style={addBtnStyle}>+ Add Pack</button>
        <button onClick={handleAddAsset} style={addBtnStyle}>+ Add Asset</button>
      </div>

      {/* Packs section */}
      {project.assetPacks.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>
            Packs ({project.assetPacks.length})
          </div>
          {project.assetPacks.map((pack) => {
            const packAssetCount = project.assets.filter((a) => a.packId === pack.id).length;
            const isExpanded = expandedPackId === pack.id;
            return (
              <div
                key={pack.id}
                style={{
                  border: '1px solid #30363d', borderRadius: 4, padding: 8, marginBottom: 4,
                  background: isExpanded ? '#161b22' : '#0d1117', cursor: 'pointer',
                }}
                onClick={() => setExpandedPackId(isExpanded ? null : pack.id)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: 10, fontWeight: 600, color: '#fff', padding: '1px 6px', borderRadius: 3, background: '#6e7681' }}>pack</span>
                  <span style={{ fontSize: 12, color: '#c9d1d9', flex: 1 }}>{pack.label}</span>
                  <span style={{ fontSize: 10, color: '#8b949e' }}>v{pack.version} ({packAssetCount})</span>
                  <button
                    onClick={(e) => { e.stopPropagation(); removeAssetPack(pack.id); }}
                    style={{ ...smallBtnStyle, background: '#da3633', color: '#fff', border: 'none' }}
                  >
                    x
                  </button>
                </div>
                {isExpanded && (
                  <div style={{ marginTop: 8 }} onClick={(e) => e.stopPropagation()}>
                    <label style={labelStyle}>
                      Label
                      <input style={inputStyle} value={pack.label}
                        onChange={(e) => updateAssetPack(pack.id, { label: e.target.value })} />
                    </label>
                    <label style={labelStyle}>
                      Version
                      <input style={inputStyle} value={pack.version}
                        onChange={(e) => updateAssetPack(pack.id, { version: e.target.value })} />
                    </label>
                    <label style={labelStyle}>
                      Description
                      <input style={inputStyle} value={pack.description ?? ''}
                        onChange={(e) => updateAssetPack(pack.id, { description: e.target.value || undefined })} />
                    </label>
                    <label style={labelStyle}>
                      Tags (comma-separated)
                      <input style={inputStyle} value={pack.tags.join(', ')}
                        onChange={(e) => updateAssetPack(pack.id, { tags: e.target.value.split(',').map((t) => t.trim()).filter(Boolean) })} />
                    </label>
                    <label style={labelStyle}>
                      Theme
                      <input style={inputStyle} value={pack.theme ?? ''}
                        onChange={(e) => updateAssetPack(pack.id, { theme: e.target.value || undefined })} />
                    </label>
                    <label style={labelStyle}>
                      Source
                      <input style={inputStyle} value={pack.source ?? ''}
                        onChange={(e) => updateAssetPack(pack.id, { source: e.target.value || undefined })} />
                    </label>
                    <label style={labelStyle}>
                      License
                      <input style={inputStyle} value={pack.license ?? ''}
                        onChange={(e) => updateAssetPack(pack.id, { license: e.target.value || undefined })} />
                    </label>
                    <label style={labelStyle}>
                      Author
                      <input style={inputStyle} value={pack.author ?? ''}
                        onChange={(e) => updateAssetPack(pack.id, { author: e.target.value || undefined })} />
                    </label>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Filters and group-by */}
      <div style={{ display: 'flex', gap: 4, marginTop: 8, alignItems: 'center' }}>
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
        {project.assetPacks.length > 0 && (
          <label style={{ fontSize: 10, color: '#8b949e', whiteSpace: 'nowrap', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 2 }}>
            <input type="checkbox" checked={groupByPack} onChange={(e) => setGroupByPack(e.target.checked)} />
            Group
          </label>
        )}
      </div>

      {/* Assets list */}
      <div style={{ marginTop: 8 }}>
        {assets.length === 0 && (
          <div style={{ fontSize: 12, color: '#8b949e', padding: '8px 0' }}>
            {project.assets.length === 0 ? 'No assets yet. Add one to get started.' : 'No assets match the filter.'}
          </div>
        )}
        {groupByPack ? (
          <>
            {project.assetPacks.map((pack) => {
              const packAssets = assets.filter((a) => a.packId === pack.id);
              if (packAssets.length === 0) return null;
              return (
                <div key={pack.id}>
                  <div style={{ fontSize: 11, color: '#58a6ff', fontWeight: 600, margin: '8px 0 4px' }}>
                    {pack.label} ({packAssets.length})
                  </div>
                  {packAssets.map(renderAssetCard)}
                </div>
              );
            })}
            {(() => {
              const unassigned = assets.filter((a) => !a.packId);
              if (unassigned.length === 0) return null;
              return (
                <div>
                  <div style={{ fontSize: 11, color: '#8b949e', fontWeight: 600, margin: '8px 0 4px' }}>
                    Unassigned ({unassigned.length})
                  </div>
                  {unassigned.map(renderAssetCard)}
                </div>
              );
            })()}
          </>
        ) : (
          assets.map(renderAssetCard)
        )}
      </div>

      {/* Diagnostics */}
      {(orphanCount > 0 || orphanedPackCount > 0 || unassignedCount > 0) && (
        <div style={{ fontSize: 11, color: '#d29922', marginTop: 8 }}>
          {orphanCount > 0 && <div>{orphanCount} asset{orphanCount !== 1 ? 's' : ''} unreferenced</div>}
          {orphanedPackCount > 0 && <div>{orphanedPackCount} pack{orphanedPackCount !== 1 ? 's' : ''} with no assets</div>}
          {unassignedCount > 0 && project.assetPacks.length > 0 && (
            <div>{unassignedCount} asset{unassignedCount !== 1 ? 's' : ''} not assigned to a pack</div>
          )}
        </div>
      )}
    </div>
  );
}
