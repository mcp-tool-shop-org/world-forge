// ValidationPanel.tsx — grouped validation issues with click-to-focus

import { useMemo, useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, type BuildsSubTab } from '../store/editor-store.js';
import { validateProject, type ValidationError } from '@world-forge/schema';

type Domain = 'world' | 'entities' | 'items' | 'dialogue' | 'player' | 'builds' | 'progression';

const domainLabels: Record<Domain, string> = {
  world: 'World',
  entities: 'Entities',
  items: 'Items',
  dialogue: 'Dialogue',
  player: 'Player Template',
  builds: 'Build Catalog',
  progression: 'Progression',
};

const domainOrder: Domain[] = ['world', 'entities', 'items', 'dialogue', 'player', 'builds', 'progression'];

function classifyError(err: ValidationError): Domain {
  const p = err.path;
  if (p.startsWith('entityPlacements')) return 'entities';
  if (p.startsWith('itemPlacements')) return 'items';
  if (p.startsWith('dialogues')) return 'dialogue';
  if (p.startsWith('playerTemplate')) return 'player';
  if (p.startsWith('buildCatalog')) return 'builds';
  if (p.startsWith('progressionTrees')) return 'progression';
  return 'world';
}

/** Map a build catalog error path to the correct sub-tab. */
function buildsSubTabFor(path: string): BuildsSubTab {
  if (path.includes('.archetypes')) return 'archetypes';
  if (path.includes('.backgrounds')) return 'backgrounds';
  if (path.includes('.traits')) return 'traits';
  if (path.includes('.disciplines')) return 'disciplines';
  if (path.includes('.crossTitles') || path.includes('.entanglements')) return 'combos';
  return 'config';
}

export function ValidationPanel() {
  const { project } = useProjectStore();
  const { setSelectedZone, setRightTab, setBuildsSubTab, setFocusTarget } = useEditorStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const result = useMemo(() => validateProject(project), [project]);

  const grouped = useMemo(() => {
    const map: Record<Domain, ValidationError[]> = {
      world: [], entities: [], items: [], dialogue: [],
      player: [], builds: [], progression: [],
    };
    for (const err of result.errors) {
      map[classifyError(err)].push(err);
    }
    return map;
  }, [result]);

  const handleClick = (err: ValidationError) => {
    const p = err.path;
    const focus = { domain: classifyError(err), subPath: p, timestamp: Date.now() };

    // Zone — select it and switch to map
    const zoneMatch = p.match(/^zones\.([^.]+)/);
    if (zoneMatch) {
      setSelectedZone(zoneMatch[1]);
      setRightTab('map');
      setFocusTarget(focus);
      return;
    }

    // Entity/item/spawn/connection — map tab
    if (p.startsWith('entityPlacements') || p.startsWith('itemPlacements') ||
        p.startsWith('spawnPoints') || p.startsWith('connections') || p.startsWith('landmarks')) {
      setRightTab('map');
      setFocusTarget(focus);
      return;
    }

    // Player template
    if (p.startsWith('playerTemplate')) {
      setRightTab('player');
      setFocusTarget(focus);
      return;
    }

    // Build catalog — also set sub-tab
    if (p.startsWith('buildCatalog')) {
      setRightTab('builds');
      setBuildsSubTab(buildsSubTabFor(p));
      setFocusTarget(focus);
      return;
    }

    // Progression trees
    if (p.startsWith('progressionTrees')) {
      setRightTab('trees');
      setFocusTarget(focus);
      return;
    }

    // Dialogue
    if (p.startsWith('dialogues')) {
      setRightTab('dialogue');
      setFocusTarget(focus);
      return;
    }

    // Fallback: world domain
    setRightTab('map');
    setFocusTarget(focus);
  };

  const toggle = (domain: string) => {
    setCollapsed((c) => ({ ...c, [domain]: !c[domain] }));
  };

  if (result.valid) {
    return (
      <div>
        <div style={headerStyle}>Validation</div>
        <div style={{ color: '#3fb950', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
          No issues found — ready to export.
        </div>
      </div>
    );
  }

  return (
    <div>
      <div style={headerStyle}>
        Validation — {result.errors.length} issue{result.errors.length !== 1 ? 's' : ''}
      </div>
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
                onClick={() => handleClick(err)}
                style={{
                  fontSize: 11, color: '#f0883e', padding: '3px 0 3px 14px',
                  cursor: 'pointer', borderLeft: '2px solid #30363d',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = '#1c2128'; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                title={`Click to jump to: ${err.path}`}
              >
                {err.message}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Returns the total issue count for use in the bottom bar badge. */
export function useIssueCount(): number {
  const { project } = useProjectStore();
  return useMemo(() => validateProject(project).errors.length, [project]);
}

const headerStyle: React.CSSProperties = { fontSize: 11, color: '#8b949e', marginBottom: 8 };
