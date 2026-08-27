// ValidationPanel.tsx — grouped validation issues with click-to-focus

import { useMemo, useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { validateProject, advisoryValidation, type ValidationError } from '@world-forge/schema';
import { classifyError, navigationForError, isRefError, type Domain } from './validation-helpers.js';
import { scanDependencies } from '@world-forge/schema';
import { PanelHeader } from './shared.js';
import { activeTabBg as ACTIVE_TAB_BG } from '../ui/styles.js';

const domainLabels: Record<Domain, string> = {
  world: 'World',
  entities: 'Entities',
  items: 'Items',
  dialogue: 'Dialogue',
  player: 'Player Template',
  builds: 'Build Catalog',
  progression: 'Progression',
  assets: 'Assets',
  packs: 'Asset Packs',
  deps: 'Dependencies',
  strata: 'Strata',
  hazards: 'Hazards',
  town: 'Town Structures',
  loot: 'Loot Tables',
  transitions: 'Transitions',
};

// EUB-006: domainOrder must stay exhaustive — when adding a new Domain variant to
// validation-helpers.ts, add a corresponding entry here and in domainLabels above.
const domainOrder: Domain[] = ['world', 'entities', 'items', 'dialogue', 'player', 'builds', 'progression', 'assets', 'packs', 'strata', 'hazards', 'town', 'loot', 'transitions', 'deps'];

export function ValidationPanel() {
  const { project } = useProjectStore();
  const { setSelectedZone, setRightTab, setBuildsSubTab, setFocusTarget } = useEditorStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const result = useMemo(() => validateProject(project), [project]);
  const advisory = useMemo(() => advisoryValidation(project), [project]);
  const depIssueCount = useMemo(() => {
    const r = scanDependencies(project);
    return r.summary.broken + r.summary.mismatched + r.summary.orphaned;
  }, [project]);

  const grouped = useMemo(() => {
    const map: Record<Domain, ValidationError[]> = {
      world: [], entities: [], items: [], dialogue: [],
      player: [], builds: [], progression: [], assets: [], packs: [], deps: [],
      strata: [], hazards: [], town: [], loot: [], transitions: [],
    };
    for (const err of result.errors) {
      map[classifyError(err)].push(err);
    }
    return map;
  }, [result]);

  // F-001: routing decisions now live in the single shared navigationForError
  // helper (validation-helpers.ts) instead of being duplicated here.
  const handleClick = (err: ValidationError) => {
    const focus = { domain: classifyError(err), subPath: err.path, timestamp: Date.now() };
    const nav = navigationForError(err, project);
    if (nav.selectZoneId) setSelectedZone(nav.selectZoneId);
    else if (nav.clearZone) setSelectedZone(null);
    setRightTab(nav.tab);
    if (nav.buildsSubTab) setBuildsSubTab(nav.buildsSubTab);
    setFocusTarget(focus);
  };

  const toggle = (domain: string) => {
    setCollapsed((c) => ({ ...c, [domain]: !c[domain] }));
  };

  if (result.valid) {
    return (
      <div>
        <PanelHeader title="Validation" />
        <div style={{ color: '#3fb950', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
          No issues found — ready to export.
        </div>
        {advisory.items.length > 0 && (
          <AdvisorySuggestions items={advisory.items} collapsed={collapsed} toggle={toggle} />
        )}
      </div>
    );
  }

  return (
    <div>
      <PanelHeader title="Validation" badge={`${result.errors.length} issue${result.errors.length !== 1 ? 's' : ''}`} />
      {domainOrder.map((domain) => {
        const errors = grouped[domain];
        if (errors.length === 0) return null;
        const isCollapsed = collapsed[domain];
        return (
          <div key={domain} style={{ marginBottom: 8 }}>
            <div
              onClick={() => toggle(domain)}
              style={{
                fontSize: 12, fontWeight: 600, color: '#f85149',
                cursor: 'pointer', padding: '4px 0', userSelect: 'none',
              }}
            >
              {isCollapsed ? '\u25b6' : '\u25bc'} {domainLabels[domain]} ({errors.length})
            </div>
            {!isCollapsed && errors.map((err, i) => (
              <div
                key={i}
                style={{
                  fontSize: 11, color: '#f0883e', padding: '3px 0 3px 14px',
                  cursor: 'pointer', borderLeft: '2px solid #30363d',
                  transition: 'background 0.15s',
                  display: 'flex', alignItems: 'baseline', gap: 6,
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1c2128'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
              >
                <span
                  onClick={() => handleClick(err)}
                  title={`Click to jump to: ${err.path}`}
                  style={{ flex: 1 }}
                >
                  {err.message}
                </span>
                {isRefError(err) && depIssueCount > 0 && (
                  <span
                    onClick={(e) => { e.stopPropagation(); setRightTab('deps'); }}
                    title="Open Dependency Manager to repair"
                    style={{ fontSize: 10, color: '#d29922', whiteSpace: 'nowrap', textDecoration: 'underline' }}
                  >
                    Open Deps
                  </span>
                )}
              </div>
            ))}
          </div>
        );
      })}
      {advisory.items.length > 0 && (
        <AdvisorySuggestions items={advisory.items} collapsed={collapsed} toggle={toggle} />
      )}
    </div>
  );
}

function AdvisorySuggestions({ items, collapsed, toggle }: {
  items: { path: string; message: string; severity: string }[];
  collapsed: Record<string, boolean>;
  toggle: (key: string) => void;
}) {
  const isCollapsed = collapsed['advisory'] ?? true; // default collapsed
  return (
    <div style={{ marginTop: 8 }}>
      <button
        data-testid="wf-suggestions-toggle"
        onClick={() => toggle('advisory')}
        style={{
          fontSize: 12, fontWeight: 600, color: '#58a6ff',
          cursor: 'pointer', padding: '4px 8px', userSelect: 'none',
          background: 'none', border: 'none', width: '100%', textAlign: 'left',
        }}
      >
        {isCollapsed ? '\u25b6' : '\u25bc'} Suggestions ({items.length})
      </button>
      {!isCollapsed && items.map((item, i) => (
        <div
          key={i}
          style={{
            fontSize: 11, color: '#58a6ff', padding: '3px 0 3px 14px',
            borderLeft: `2px solid ${ACTIVE_TAB_BG}`,
          }}
        >
          {item.message}
        </div>
      ))}
    </div>
  );
}

/** Returns the total issue count for use in the bottom bar badge. */
export function useIssueCount(): number {
  const { project } = useProjectStore();
  return useMemo(() => validateProject(project).errors.length, [project]);
}

