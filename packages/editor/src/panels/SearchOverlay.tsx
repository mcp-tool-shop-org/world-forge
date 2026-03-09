// SearchOverlay.tsx — Ctrl+K command-jump modal

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { computeFrameViewport, getCanvasSize } from '../frame-helpers.js';
import { frameBounds } from '../viewport.js';
import type { WorldProject } from '@world-forge/schema';
import { connectionLabel } from '../connection-lines.js';

export interface SearchResult {
  type: 'zone' | 'entity' | 'landmark' | 'spawn' | 'district' | 'dialogue' | 'tree' | 'connection';
  id: string;
  label: string;
  detail: string;
}

const TYPE_ICONS: Record<SearchResult['type'], string> = {
  zone: 'Z', entity: 'E', landmark: 'L', spawn: 'S', district: 'D', dialogue: 'DL', tree: 'T', connection: 'C',
};

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  zone: '#58a6ff', entity: '#3fb950', landmark: '#d2a8ff', spawn: '#f0883e',
  district: '#79c0ff', dialogue: '#e3b341', tree: '#a5d6ff', connection: '#8b949e',
};

export function buildSearchIndex(project: WorldProject): SearchResult[] {
  const results: SearchResult[] = [];

  // Districts
  for (const d of project.districts) {
    results.push({ type: 'district', id: d.id, label: d.name, detail: `${d.zoneIds.length} zones` });
  }

  // Zones
  for (const z of project.zones) {
    const district = project.districts.find((d) => d.zoneIds.includes(z.id));
    results.push({ type: 'zone', id: z.id, label: z.name, detail: district ? `in ${district.name}` : 'unassigned' });
  }

  // Entities
  for (const ep of project.entityPlacements) {
    const zone = project.zones.find((z) => z.id === ep.zoneId);
    results.push({ type: 'entity', id: ep.entityId, label: ep.name ?? ep.entityId, detail: `${ep.role} in ${zone?.name ?? 'unknown'}` });
  }

  // Landmarks
  for (const lm of project.landmarks) {
    const zone = project.zones.find((z) => z.id === lm.zoneId);
    results.push({ type: 'landmark', id: lm.id, label: lm.name, detail: `in ${zone?.name ?? 'unknown'}` });
  }

  // Spawns
  for (const sp of project.spawnPoints) {
    const zone = project.zones.find((z) => z.id === sp.zoneId);
    results.push({ type: 'spawn', id: sp.id, label: sp.id, detail: `in ${zone?.name ?? 'unknown'}${sp.isDefault ? ' (default)' : ''}` });
  }

  // Connections
  for (const c of project.connections) {
    const label = connectionLabel(c, project.zones);
    const kindPart = c.kind && c.kind !== 'passage' ? c.kind : '';
    const condPart = c.condition ? `condition: ${c.condition}` : '';
    const dirPart = c.bidirectional ? 'bidirectional' : 'one-way';
    const detail = [kindPart, condPart || dirPart].filter(Boolean).join(', ');
    results.push({ type: 'connection', id: `${c.fromZoneId}::${c.toZoneId}`, label, detail });
  }

  // Dialogues
  for (const dl of project.dialogues) {
    const detail = dl.speakers.length > 0 ? `speakers: ${dl.speakers.join(', ')}` : '';
    results.push({ type: 'dialogue', id: dl.id, label: dl.id, detail });
  }

  // Progression trees
  for (const tree of project.progressionTrees) {
    results.push({ type: 'tree', id: tree.id, label: tree.id, detail: `${tree.nodes.length} nodes` });
  }

  return results;
}

export function filterResults(index: SearchResult[], query: string): SearchResult[] {
  if (!query.trim()) return [];
  const q = query.toLowerCase();
  return index.filter((r) =>
    r.label.toLowerCase().includes(q) ||
    r.id.toLowerCase().includes(q) ||
    r.detail.toLowerCase().includes(q),
  ).slice(0, 20);
}

export function SearchOverlay() {
  const { project } = useProjectStore();
  const {
    setShowSearch, selectZone, selectEntity, selectLandmark, selectSpawn, selectConnection,
    setSelection, setViewport, setRightTab, setFocusTarget,
  } = useEditorStore();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const searchIndex = useMemo(() => buildSearchIndex(project), [project]);
  const results = useMemo(() => filterResults(searchIndex, query), [searchIndex, query]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [results.length]);

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus(); }, []);

  const dismiss = useCallback(() => { setShowSearch(false); }, [setShowSearch]);

  const handleSelect = useCallback((result: SearchResult) => {
    dismiss();
    const size = getCanvasSize();

    if (result.type === 'zone') {
      selectZone(result.id, false);
      if (size) {
        const vp = computeFrameViewport({ type: 'zone', id: result.id }, project, size.cw, size.ch);
        if (vp) setViewport(vp);
      }
      setRightTab('map');
    } else if (result.type === 'entity') {
      selectEntity(result.id, false);
      if (size) {
        const vp = computeFrameViewport({ type: 'entity', id: result.id }, project, size.cw, size.ch);
        if (vp) setViewport(vp);
      }
      setRightTab('map');
    } else if (result.type === 'landmark') {
      selectLandmark(result.id, false);
      if (size) {
        const vp = computeFrameViewport({ type: 'landmark', id: result.id }, project, size.cw, size.ch);
        if (vp) setViewport(vp);
      }
      setRightTab('map');
    } else if (result.type === 'spawn') {
      selectSpawn(result.id, false);
      if (size) {
        const vp = computeFrameViewport({ type: 'spawn', id: result.id }, project, size.cw, size.ch);
        if (vp) setViewport(vp);
      }
      setRightTab('map');
    } else if (result.type === 'connection') {
      const [from, to] = result.id.split('::');
      selectConnection(from, to);
      if (size) {
        const tileSize = project.map.tileSize;
        const fromZone = project.zones.find((z) => z.id === from);
        const toZone = project.zones.find((z) => z.id === to);
        const items = [fromZone, toZone].filter(Boolean) as Array<{ gridX: number; gridY: number; gridWidth: number; gridHeight: number }>;
        const vp = frameBounds(items, tileSize, size.cw, size.ch);
        if (vp) setViewport(vp);
      }
      setRightTab('map');
    } else if (result.type === 'district') {
      const district = project.districts.find((d) => d.id === result.id);
      if (district && district.zoneIds.length > 0) {
        setSelection({ zones: district.zoneIds, entities: [], landmarks: [], spawns: [] });
        if (size) {
          const tileSize = project.map.tileSize;
          const items = district.zoneIds
            .map((zid) => project.zones.find((z) => z.id === zid))
            .filter(Boolean) as Array<{ gridX: number; gridY: number; gridWidth: number; gridHeight: number }>;
          const vp = frameBounds(items, tileSize, size.cw, size.ch);
          if (vp) setViewport(vp);
        }
      }
      setRightTab('map');
    } else if (result.type === 'dialogue') {
      setRightTab('dialogue');
      setFocusTarget({ domain: 'dialogue', subPath: result.id, timestamp: Date.now() });
    } else if (result.type === 'tree') {
      setRightTab('trees');
      setFocusTarget({ domain: 'trees', subPath: result.id, timestamp: Date.now() });
    }
  }, [project, dismiss, selectZone, selectEntity, selectLandmark, selectSpawn, selectConnection, setSelection, setViewport, setRightTab, setFocusTarget]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { dismiss(); return; }
    if (e.key === 'ArrowDown') { e.preventDefault(); setActiveIdx((i) => Math.min(i + 1, results.length - 1)); return; }
    if (e.key === 'ArrowUp') { e.preventDefault(); setActiveIdx((i) => Math.max(i - 1, 0)); return; }
    if (e.key === 'Enter' && results[activeIdx]) { handleSelect(results[activeIdx]); return; }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = listRef.current?.children[activeIdx] as HTMLElement | undefined;
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)',
        zIndex: 200, display: 'flex', justifyContent: 'center', paddingTop: 80,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480, maxHeight: 420, background: '#161b22', border: '1px solid #30363d',
          borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid #30363d' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search zones, entities, districts..."
            style={{
              width: '100%', background: '#0d1117', border: '1px solid #30363d',
              borderRadius: 4, padding: '8px 10px', color: '#c9d1d9', fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          {results.length === 0 && query.trim() && (
            <div style={{ padding: '16px 12px', color: '#8b949e', fontSize: 12, textAlign: 'center' }}>
              No results for "{query}"
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              style={{
                padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: i === activeIdx ? '#1c2128' : 'transparent',
              }}
            >
              <span style={{
                fontSize: 9, fontWeight: 'bold', color: TYPE_COLORS[r.type],
                background: '#0d1117', borderRadius: 3, padding: '1px 4px', minWidth: 18, textAlign: 'center',
              }}>
                {TYPE_ICONS[r.type]}
              </span>
              <span style={{ color: '#c9d1d9', fontSize: 12 }}>{r.label}</span>
              <span style={{ color: '#8b949e', fontSize: 11, marginLeft: 'auto' }}>{r.detail}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '6px 12px', borderTop: '1px solid #30363d', fontSize: 10, color: '#484f58' }}>
          <kbd style={{ background: '#21262d', padding: '1px 4px', borderRadius: 2 }}>↑↓</kbd> navigate
          {' '}<kbd style={{ background: '#21262d', padding: '1px 4px', borderRadius: 2 }}>Enter</kbd> select
          {' '}<kbd style={{ background: '#21262d', padding: '1px 4px', borderRadius: 2 }}>Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
