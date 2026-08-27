// SearchOverlay.tsx — Ctrl+K command-jump modal

import { useState, useRef, useEffect, useMemo, useCallback, Fragment } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { usePresetStore } from '../presets/preset-store.js';
import { computeFrameViewport, getCanvasSize } from '../frame-helpers.js';
import { frameBounds } from '../viewport.js';
import { type WorldProject, scanDependencies, buildReviewSnapshot } from '@world-forge/schema';
import { connectionLabel } from '../connection-lines.js';
import { useKitStore } from '../kits/index.js';
import { pushToast } from '../ui/Toast.js';
import { useModalStore } from '../store/modal-store.js';
import { requestTemplateManagerTab } from './TemplateManager.js';
import { reviewSnapshotToMarkdown, summaryFilename } from '../review/export-summary.js';

export interface SearchResult {
  type: 'zone' | 'entity' | 'landmark' | 'spawn' | 'district' | 'dialogue' | 'tree' | 'connection' | 'encounter' | 'item' | 'loot' | 'transition' | 'region-preset' | 'encounter-preset' | 'starter-kit' | 'dependency' | 'review';
  id: string;
  label: string;
  detail: string;
}

const TYPE_CATEGORY: Record<SearchResult['type'], string> = {
  zone: 'Places', entity: 'People', landmark: 'Places', spawn: 'Places',
  district: 'Places', dialogue: 'People', tree: 'Review', connection: 'Places',
  encounter: 'People', item: 'Places', loot: 'Places', transition: 'Places',
  'region-preset': 'Kits', 'encounter-preset': 'Kits',
  'starter-kit': 'Kits', dependency: 'Review', review: 'Review',
};

const TYPE_ICONS: Record<SearchResult['type'], string> = {
  zone: '\u25A6',
  entity: '\u25C9',
  landmark: '\u25B2',
  spawn: '\u2605',
  district: '\u25A3',
  dialogue: '\u201C',
  tree: '\u22A4',
  connection: '\u2194',
  encounter: '\u2694',
  item: '\u25CE',
  loot: '\u25C8',
  transition: '\u2195',
  'region-preset': '\u25EB',
  'encounter-preset': '\u25CE',
  'starter-kit': '\u25A8',
  dependency: '\u26A0',
  review: '\u2630',
};

const TYPE_COLORS: Record<SearchResult['type'], string> = {
  zone: 'var(--wf-accent)', entity: 'var(--wf-success-text)', landmark: 'var(--wf-accent)', spawn: 'var(--wf-warning)',
  district: 'var(--wf-accent)', dialogue: 'var(--wf-warning)', tree: 'var(--wf-accent)', connection: 'var(--wf-text-muted)', encounter: 'var(--wf-danger)',
  item: 'var(--wf-warning)', loot: 'var(--wf-accent)', transition: 'var(--wf-text-muted)',
  'region-preset': 'var(--wf-accent)', 'encounter-preset': 'var(--wf-danger)', 'starter-kit': 'var(--wf-warning)', dependency: 'var(--wf-warning)', review: 'var(--wf-accent)',
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

  // Items
  for (const it of project.itemPlacements) {
    const zone = project.zones.find((z) => z.id === it.zoneId);
    if (!zone) console.warn(`[SearchOverlay] Item "${it.itemId}" references missing zone "${it.zoneId}"`);
    results.push({ type: 'item', id: it.itemId, label: it.name ?? it.itemId, detail: `${it.slot ?? 'item'} in ${zone?.name ?? 'unknown'}` });
  }

  // Loot tables
  for (const lt of project.lootTables ?? []) {
    results.push({ type: 'loot', id: lt.id, label: lt.id, detail: `${lt.entries.length} entries, ${lt.rolls ?? 1} rolls` });
  }

  // Transitions
  for (const tr of project.transitions ?? []) {
    const zone = project.zones.find((z) => z.id === tr.zoneId);
    const target = project.zones.find((z) => z.id === tr.targetZoneId);
    results.push({ type: 'transition', id: tr.id, label: tr.label ?? tr.id, detail: `${tr.type} ${zone?.name ?? tr.zoneId} → ${target?.name ?? tr.targetZoneId}` });
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
  results.push({ type: 'review', id: 'export-summary', label: 'Export Summary', detail: 'Download review summary (Markdown)' });

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
  // F-5c35446e: ED-B-006 quota guard was on prune/click but not this write.
  // QuotaExceededError here used to abort handleSelect before navigation.
  try {
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(recent.slice(0, MAX_RECENT)));
  } catch { /* ignore quota / private-mode — caller still navigates */ }
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

const SEARCH_LISTBOX_ID = 'wf-search-listbox';
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type NavItem =
  | { kind: 'recent'; term: string }
  | { kind: 'result'; result: SearchResult };

function navCategory(item: NavItem): string {
  return item.kind === 'recent' ? 'Recent' : TYPE_CATEGORY[item.result.type];
}

function downloadReviewMarkdown(project: WorldProject): string {
  const snapshot = { ...buildReviewSnapshot(project), hasExported: false };
  const markdown = reviewSnapshotToMarkdown(snapshot);
  const filename = summaryFilename(project.name, 'md');
  const blob = new Blob([markdown], { type: 'text/markdown' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
  return filename;
}

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
  const dialogRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
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

  const navItems: NavItem[] = useMemo(() => {
    if (query.trim()) return results.map((result) => ({ kind: 'result' as const, result }));
    const recents: NavItem[] = recentSearches.map((term) => ({ kind: 'recent' as const, term }));
    const catalog: NavItem[] = searchIndex
      .filter((r) => r.type === 'review' || r.type === 'starter-kit')
      .slice(0, 10)
      .map((result) => ({ kind: 'result' as const, result }));
    return [...recents, ...catalog];
  }, [query, results, recentSearches, searchIndex]);

  // Reset active index when the navigable list changes
  useEffect(() => { setActiveIdx(0); }, [navItems.length, query]);

  // Auto-focus input; restore opener on unmount
  useEffect(() => {
    openerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    inputRef.current?.focus();
    return () => { openerRef.current?.focus(); };
  }, []);

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
    } else if (result.type === 'item') {
      const item = project.itemPlacements.find((i) => i.itemId === result.id);
      if (item) selectZone(item.zoneId, false);
      setFocusTarget({ domain: 'items', subPath: `itemPlacements.${result.id}`, timestamp: Date.now() });
      setRightTab('map');
    } else if (result.type === 'loot') {
      setSelection({ zones: [], entities: [], landmarks: [], spawns: [], encounters: [] });
      setFocusTarget({ domain: 'loot', subPath: `lootTables.${result.id}`, timestamp: Date.now() });
      setRightTab('map');
    } else if (result.type === 'transition') {
      const tr = (project.transitions ?? []).find((t) => t.id === result.id);
      if (tr) selectZone(tr.zoneId, false);
      setFocusTarget({ domain: 'transitions', subPath: `transitions.${result.id}`, timestamp: Date.now() });
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
      requestTemplateManagerTab('starters');
      useModalStore.getState().openModal('template-manager');
    } else if (result.type === 'dependency') {
      setRightTab('deps');
    } else if (result.type === 'review') {
      if (result.id === 'export-summary') {
        const filename = downloadReviewMarkdown(project);
        pushToast(`Downloading ${filename}`, 'success', 3000);
      } else {
        setRightTab('review');
      }
    }
  }, [query, project, dismiss, selectZone, selectEntity, selectLandmark, selectSpawn, selectEncounter, selectConnection, setSelection, setViewport, setRightTab, setFocusTarget]);

  const activateNavItem = useCallback((item: NavItem) => {
    if (item.kind === 'recent') {
      const hits = filterResults(searchIndex, item.term);
      if (hits.length === 0) {
        pushToast(`'${item.term}' no longer matches any object.`, 'warning', 3000);
        const pruned = recentSearches.filter((s) => s !== item.term);
        try { localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(pruned)); } catch { /* ignore */ }
        setRecentSearches(pruned);
        return;
      }
      setQuery(item.term);
      return;
    }
    handleSelect(item.result);
  }, [searchIndex, recentSearches, handleSelect]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); dismiss(); return; }
    if (e.key === 'Tab') {
      // Trap Tab inside the dialog so it cannot walk into the editor behind the dimmer.
      e.preventDefault();
      e.stopPropagation();
      const card = dialogRef.current;
      if (!card) return;
      const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusable.length === 0) { inputRef.current?.focus(); return; }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (e.shiftKey) {
        if (document.activeElement === first) last.focus();
        else {
          const i = focusable.indexOf(document.activeElement as HTMLElement);
          (focusable[i > 0 ? i - 1 : focusable.length - 1] ?? first).focus();
        }
      } else {
        if (document.activeElement === last) first.focus();
        else {
          const i = focusable.indexOf(document.activeElement as HTMLElement);
          (focusable[i >= 0 && i < focusable.length - 1 ? i + 1 : 0] ?? first).focus();
        }
      }
      return;
    }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((i) => Math.min(i + 1, Math.max(navItems.length - 1, 0)));
      return;
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      e.stopPropagation();
      setActiveIdx((i) => Math.max(i - 1, 0));
      return;
    }
    if (e.key === 'Enter' && navItems[activeIdx]) {
      e.preventDefault();
      e.stopPropagation();
      activateNavItem(navItems[activeIdx]);
      return;
    }
  };

  // Scroll active item into view
  useEffect(() => {
    const el = document.getElementById(`wf-search-option-${activeIdx}`);
    el?.scrollIntoView({ block: 'nearest' });
  }, [activeIdx]);

  const activeOptionId = navItems.length > 0 ? `wf-search-option-${activeIdx}` : undefined;

  return (
    <div
      onClick={dismiss}
      style={{
        position: 'fixed', inset: 0, background: 'var(--wf-bg-overlay)',
        zIndex: 'var(--wf-z-overlay)' as unknown as number,
        display: 'flex', justifyContent: 'center',
        paddingTop: 'calc(var(--wf-topbar-height) * 2 + var(--wf-space-2))',
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-label="Search"
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        style={{
          width: 'min(90vw, calc(var(--wf-inspector-width) + var(--wf-sidebar-width)))',
          maxHeight: 'min(70vh, calc(100vh - var(--wf-topbar-height) * 4))',
          background: 'var(--wf-bg-panel)', border: '1px solid var(--wf-border-default)',
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
            aria-label="Search"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={true}
            aria-controls={SEARCH_LISTBOX_ID}
            aria-activedescendant={activeOptionId}
            style={{
              width: '100%', background: 'var(--wf-bg-app)', border: '1px solid var(--wf-border-default)',
              borderRadius: 4, padding: '8px 10px', color: 'var(--wf-text-primary)', fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <div ref={listRef} id={SEARCH_LISTBOX_ID} role="listbox" style={{ flex: 1, overflow: 'auto', padding: '4px 0' }}>
          {results.length === 0 && query.trim() && (
            <div style={{ padding: '16px 12px', color: 'var(--wf-text-muted)', fontSize: 12, textAlign: 'center' }}>
              No results for "{query}"
            </div>
          )}
          {navItems.map((item, i) => {
            const cat = navCategory(item);
            const prev = i > 0 ? navCategory(navItems[i - 1]) : null;
            const header = cat !== prev ? (
              <div style={{ padding: '6px 12px', fontSize: 10, color: 'var(--wf-text-muted)', fontWeight: 'bold', textTransform: 'uppercase' }}>
                {cat}
              </div>
            ) : null;
            if (item.kind === 'recent') {
              return (
                <Fragment key={`recent-${item.term}`}>
                  {header}
                  <div
                    id={`wf-search-option-${i}`}
                    role="option"
                    aria-selected={i === activeIdx}
                    onClick={() => activateNavItem(item)}
                    style={{
                      padding: 'var(--wf-space-1) var(--wf-space-3)', cursor: 'pointer', fontSize: 12,
                      color: 'var(--wf-text-muted)', display: 'flex', alignItems: 'center', gap: 6,
                      background: i === activeIdx ? 'var(--wf-bg-elevated)' : 'transparent',
                    }}
                  >
                    <span style={{ fontSize: 14, width: 16, textAlign: 'center', color: 'var(--wf-text-muted)' }}>{'\u23F0'}</span>
                    {item.term}
                  </div>
                </Fragment>
              );
            }
            const r = item.result;
            return (
              <Fragment key={`${r.type}-${r.id}`}>
                {header}
                <div
                  id={`wf-search-option-${i}`}
                  role="option"
                  aria-selected={i === activeIdx}
                  onClick={() => handleSelect(r)}
                  style={{
                    padding: 'var(--wf-space-2) var(--wf-space-3)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                    background: i === activeIdx ? 'var(--wf-bg-elevated)' : 'transparent',
                  }}
                >
                  <span style={{
                    fontSize: 14, color: TYPE_COLORS[r.type],
                    width: 16, textAlign: 'center', flexShrink: 0, lineHeight: 1,
                  }} title={r.type}>
                    {TYPE_ICONS[r.type]}
                  </span>
                  <span style={{ color: 'var(--wf-text-primary)', fontSize: 12 }}>{r.label}</span>
                  <span style={{ color: 'var(--wf-text-muted)', fontSize: 11, marginLeft: 'auto' }}>{r.detail}</span>
                </div>
              </Fragment>
            );
          })}
        </div>
        <div style={{ padding: '6px 12px', borderTop: '1px solid var(--wf-border-default)', fontSize: 10, color: 'var(--wf-text-muted)' }}>
          <kbd style={{ background: 'var(--wf-bg-control)', padding: '1px 4px', borderRadius: 2 }}>↑↓</kbd> navigate
          {' '}<kbd style={{ background: 'var(--wf-bg-control)', padding: '1px 4px', borderRadius: 2 }}>Enter</kbd> select
          {' '}<kbd style={{ background: 'var(--wf-bg-control)', padding: '1px 4px', borderRadius: 2 }}>Esc</kbd> close
        </div>
      </div>
    </div>
  );
}
