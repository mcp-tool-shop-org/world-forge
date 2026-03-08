// ValidationPanel.tsx — grouped validation issues with click-to-focus

import { useMemo, useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
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

export function ValidationPanel() {
  const { project } = useProjectStore();
  const { setSelectedZone, setRightTab } = useEditorStore();
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
    // Try to extract a zone ID to focus on
    const zoneMatch = p.match(/^zones\.([^.]+)/);
    if (zoneMatch) {
      setSelectedZone(zoneMatch[1]);
      setRightTab('map');
      return;
    }
    // Entity placement — switch to map tab
    const entityMatch = p.match(/^entityPlacements\.([^.]+)/);
    if (entityMatch) {
      setRightTab('map');
      return;
    }
    // Domain-level focus
    if (p.startsWith('playerTemplate')) { setRightTab('player'); return; }
    if (p.startsWith('buildCatalog')) { setRightTab('builds'); return; }
    if (p.startsWith('progressionTrees')) { setRightTab('trees'); return; }
    if (p.startsWith('dialogues')) { setRightTab('dialogue'); return; }
  };

  const toggle = (domain: string) => {
    setCollapsed((c) => ({ ...c, [domain]: !c[domain] }));
  };

  if (result.valid) {
    return (
      <div>
        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>Validation</div>
        <div style={{ color: '#3fb950', fontSize: 13, padding: '8px 0' }}>No issues found</div>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>
        Validation — {result.errors.length} issue{result.errors.length !== 1 ? 's' : ''}
      </div>
      {domainOrder.map((domain) => {
        const errors = grouped[domain];
        if (errors.length === 0) return null;
        const isCollapsed = collapsed[domain];
        return (
          <div key={domain} style={{ marginBottom: 6 }}>
            <div
              onClick={() => toggle(domain)}
              style={{
                fontSize: 12, fontWeight: 'bold', color: '#f85149',
                cursor: 'pointer', padding: '3px 0', userSelect: 'none',
              }}
            >
              {isCollapsed ? '\u25b6' : '\u25bc'} {domainLabels[domain]} ({errors.length})
            </div>
            {!isCollapsed && errors.map((err, i) => (
              <div
                key={i}
                onClick={() => handleClick(err)}
                style={{
                  fontSize: 11, color: '#f0883e', padding: '2px 0 2px 12px',
                  cursor: 'pointer', borderLeft: '2px solid #30363d',
                }}
                title={`[${err.path}] ${err.message}`}
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
