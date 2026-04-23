// SearchOverlay.tsx — Ctrl+K command-jump modal

import { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { usePresetStore } from '../presets/preset-store.js';
import { computeFrameViewport, getCanvasSize } from '../frame-helpers.js';
import { frameBounds } from '../viewport.js';
import { type WorldProject, scanDependencies } from '@world-forge/schema';
import { connectionLabel } from '../connection-lines.js';
import type { RegionPreset, EncounterPreset } from '../presets/types.js';
import { useKitStore } from '../kits/index.js';
import { pushToast } from '../ui/Toast.js';

export interface SearchResult {
  type: 'zone' | 'entity' | 'landmark' | 'spawn' | 'district' | 'dialogue' | 'tree' | 'connection' | 'encounter' | 'region-preset' | 'encounter-preset' | 'starter-kit' | 'dependency' | 'review';
  id: string;
  label: string;
  detail: string;
}

const TYPE_ICONS: Record<SearchResult['type'], string> = {
  zone: 'Z', entity: 'E', landmark: 'L', spawn: 'S', district: 'D', dialogue: 'DL', tree: 'T', connection: 'C', encounter: 'Enc',
  'region-preset': 'Rgn', 'encounter-preset': 'Enc', 'starter-kit': 'Kit', dependency: 'Dep', review: 'Rev',
};

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  zone: '#58a6ff', entity: '#3fb950', landmark: '#d2a8ff', spawn: '#f0883e',
  district: '#79c0ff', dialogue: '#e3b341', tree: '#a5d6ff', connection: '#8b949e', encounter: '#da3633',
  'region-preset': '#8b5cf6', 'encounter-preset': '#da3633', 'starter-kit': '#f0883e', dependency: '#d29922', review: '#bc8cff',
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
    // EUB-008: warn when parent zone is missing for entity
    if (!zone) console.warn(`[SearchOverlay] Entity "${ep.entityId}" references missing zone "${ep.zoneId}"`);
    results.push({ type: 'entity', id: ep.entityId, label: ep.name ?? ep.entityId, detail: `${ep.role} in ${zone?.name ?? 'unknown'}` });
  }

  // Landmarks
  for (const lm of project.landmarks) {
    const zone = project.zones.find((z) => z.id === lm.zoneId);
    // EUB-008: warn when parent zone is missing for landmark
    if (!zone) console.warn(`[SearchOverlay] Landmark "${lm.id}" references missing zone "${lm.zoneId}"`);
    results.push({ type: 'landmark', id: lm.id, label: lm.name, detail: `in ${zone?.name ?? 'unknown'}` });
  }

  // Spawns
  for (const sp of project.spawnPoints) {
    const zone = project.zones.find((z) => z.id === sp.zoneId);
    // EUB-008: warn when parent zone is missing for spawn
    if (!zone) console.warn(`[SearchOverlay] Spawn "${sp.id}" references missing zone "${sp.zoneId}"`);
    results.push({ type: 'spawn', id: sp.id, label: sp.id, detail: `in ${zone?.name ?? 'unknown'}${sp.isDefault ? ' (default)' : ''}` });
  }

  // Encounters
  for (const enc of project.encounterAnchors) {
    const zone = project.zones.find((z) => z.id === enc.zoneId);
    results.push({ type: 'encounter', id: enc.id, label: enc.id, detail: `${enc.encounterType} in ${zone?.name ?? 'unknown'}, prob ${enc.probability}` });
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

  // Dependency issues
  const depReport = scanDependencies(project);
  for (const edge of depReport.edges) {
    if (edge.status === 'ok') continue;
    results.push({ type: 'dependency', id: `dep-${edge.sourceId}-${edge.fieldName}`, label: edge.message, detail: edge.domain });
  }

  // Review actions
  results.push({ type: 'review', id: 'open-review', label: 'Project Review', detail: 'Open review panel' });
  results.push({ type: 'review', id: 'export-summary', label: 'Export Summary', detail: 'Export review summary' });

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

const RECENT_SEARCHES_KEY = 'wf-recent-searches';
const MAX_RECENT = 5;

function loadRecentSearches(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw);
    return Array.isArray(arr) ? arr.filter((s: unknown) => typeof s === 'string').slice(0, MAX_RECENT) : [];
  } catch { return []; }
}

function saveRecentSearch(query: string): void {
  const q = query.trim();
  if (!q) return;
  const recent = loadRecentSearches().filter((s) => s !== q);
  recent.unshift(q);
  localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
}

/**
 * ED-B-006: remove any recent-search term whose query would now find nothing
 * in the live search index (e.g. the referenced zone/entity was deleted).
 * Returns the new list; persists to localStorage when anything changed.
 */
export function pruneRecentSearches(index: SearchResult[], recent: string[]): string[] {
  const pruned = recent.filter((term) => filterResults(index, term).length > 0);
  if (pruned.length !== recent.length) {
    try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(pruned)); } catch { /* ignore */ }
  }
  return pruned;
}

export { loadRecentSearches, saveRecentSearch, RECENT_SEARCHES_KEY };

export function SearchOverlay() {
  const { project } = useProjectStore();
  const {
    setShowSearch, selectZone, selectEntity, selectLandmark, selectSpawn, selectEncounter, selectConnection,
    setSelection, setViewport, setRightTab, setFocusTarget,
  } = useEditorStore();

  const [query, setQuery] = useState('');
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const [recentSearches, setRecentSearches] = useState<string[]>(loadRecentSearches);

  const { regionPresets, encounterPresets } = usePresetStore();
  const { kits } = useKitStore();

  // ED-B-006: on project change, drop recent searches that no longer match
  // anything. We also re-derive recent on every overlay open (the effect below
  // runs whenever `project` is replaced).
  useEffect(() => {
    const idx = buildSearchIndex(project);
    setRecentSearches((prev) => pruneRecentSearches(idx, prev));
  }, [project]);

  const searchIndex = useMemo(() => {
    const base = buildSearchIndex(project);
    // Add presets to search index (with mode annotations)
    for (const p of regionPresets) {
      const modeTag = p.modes ? ` [${p.modes.join(', ')}]` : '';
      base.push({ type: 'region-preset', id: p.id, label: p.name, detail: `${p.description}${modeTag}` });
    }
    for (const p of encounterPresets) {
      const modeTag = p.modes ? ` [${p.modes.join(', ')}]` : '';
      base.push({ type: 'encounter-preset', id: p.id, label: p.name, detail: `${p.encounterType} — ${p.description}${modeTag}` });
    }
    // Add starter kits to search index
    for (const kit of kits) {
      const status = kit.builtIn ? 'built-in' : kit.source === 'imported' ? 'imported' : 'custom';
      const modeTag = kit.modes.join(', ');
      base.push({ type: 'starter-kit', id: kit.id, label: kit.name, detail: `${status} kit [${modeTag}]` });
    }
    return base;
  }, [project, regionPresets, encounterPresets, kits]);
  const results = useMemo(() => filterResults(searchIndex, query), [searchIndex, query]);

  // Reset active index when results change
  useEffect(() => { setActiveIdx(0); }, [results.length]);

  // Auto-focus input
  useEffect(() => { inputRef.current?.focus(); }, []);

  const dismiss = useCallback(() => { setShowSearch(false); }, [setShowSearch]);

  const handleSelect = useCallback((result: SearchResult) => {
    // FT-006: save recent search
    if (query.trim()) {
      saveRecentSearch(query.trim());
      setRecentSearches(loadRecentSearches());
    }
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
    } else if (result.type === 'encounter') {
      selectEncounter(result.id, false);
      const enc = project.encounterAnchors.find((e) => e.id === result.id);
      if (enc && size) {
        const vp = computeFrameViewport({ type: 'zone', id: enc.zoneId }, project, size.cw, size.ch);
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
        setSelection({ zones: district.zoneIds, entities: [], landmarks: [], spawns: [], encounters: [] });
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
    } else if (result.type === 'region-preset' || result.type === 'encounter-preset') {
      setRightTab('presets');
    } else if (result.type === 'starter-kit') {
      // No specific navigation — kit is informational in search
    } else if (result.type === 'dependency') {
      setRightTab('deps');
    } else if (result.type === 'review') {
      setRightTab('review');
    }
  }, [project, dismiss, selectZone, selectEntity, selectLandmark, selectSpawn, selectEncounter, selectConnection, setSelection, setViewport, setRightTab, setFocusTarget]);

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
        position: 'fixed', inset: 0, background: 'var(--wf-bg-overlay)',
        zIndex: 9999, display: 'flex', justifyContent: 'center', paddingTop: 80,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: 480, maxHeight: 420, background: 'var(--wf-bg-panel)', border: '1px solid var(--wf-border-default)',
          borderRadius: 8, display: 'flex', flexDirection: 'column', overflow: 'hidden',
        }}
      >
        <div style={{ padding: '12px 12px 8px', borderBottom: '1px solid var(--wf-border-default)' }}>
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search zones, entities, districts..."
            style={{
              width: '100%', background: 'var(--wf-bg-app)', border: '1px solid var(--wf-border-default)',
              borderRadius: 4, padding: '8px 10px', color: 'var(--wf-text-primary)', fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <div ref={listRef} style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          {/* FT-006: Recent searches when query is empty */}
          {!query.trim() && recentSearches.length > 0 && (
            <div>
              <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--wf-text-hint)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                Recent
              </div>
              {recentSearches.map((term) => (
                <div
                  key={term}
                  onClick={() => {
                    // ED-B-006: if the stored term no longer matches anything
                    // (target was deleted since the search was saved), warn
                    // the user with a toast rather than silently showing an
                    // empty result list.
                    const hits = filterResults(searchIndex, term);
                    if (hits.length === 0) {
                      pushToast(`'${term}' no longer matches any object.`, 'warning', 3000);
                      const pruned = recentSearches.filter((s) => s !== term);
                      try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(pruned)); } catch { /* ignore */ }
                      setRecentSearches(pruned);
                      return;
                    }
                    setQuery(term);
                  }}
                  style={{
                    padding: '5px 12px', cursor: 'pointer', fontSize: 12,
                    color: 'var(--wf-text-muted)', display: 'flex', alignItems: 'center', gap: 6,
                  }}
                >
                  <span style={{ fontSize: 11, color: 'var(--wf-text-hint)' }}>{'\u23F0'}</span>
                  {term}
                </div>
              ))}
            </div>
          )}
          {results.length === 0 && query.trim() && (
            <div style={{ padding: '16px 12px', color: 'var(--wf-text-muted)', fontSize: 12, textAlign: 'center' }}>
              No results for "{query}"
            </div>
          )}
          {results.map((r, i) => (
            <div
              key={`${r.type}-${r.id}`}
              onClick={() => handleSelect(r)}
              style={{
                padding: '6px 12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                background: i === activeIdx ? 'var(--wf-bg-elevated)' : 'transparent',
              }}
            >
              <span style={{
                fontSize: 9, fontWeight: 'bold', color: TYPE_COLORS[r.type],
                background: 'var(--wf-bg-app)', borderRadius: 3, padding: '1px 4px', minWidth: 18, textAlign: 'center',
              }}>
                {TYPE_ICONS[r.type]}
              </span>
              <span style={{ color: 'var(--wf-text-primary)', fontSize: 12 }}>{r.label}</span>
              <span style={{ color: 'var(--wf-text-muted)', fontSize: 11, marginLeft: 'auto' }}>{r.detail}</span>
            </div>
          ))}
        </div>
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--wf-border-default)', fontSize: 10, color: 'var(--wf-text-hint)' }}>
          <kbd style={{ background: 'var(--wf-bg-control)', padding: '1px 4px', borderRadius: 2 }}>↑↓</kbd> navigate
          {' '}<kbd style={{ background: 'var(--wf-bg-control)', padding: '1px 4px', borderRadius: 2 }}>Enter</kbd> select
          {' '}<kbd style={{ background: 'var(--wf-bg-control)', padding: '1px 4px', borderRadius: 2 }}>Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
