// DependencyPanel.tsx — dependency manager with repair actions

import { useMemo, useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { scanDependencies, type DependencyEdge, type DepDomain } from '@world-forge/schema';
import { repairsForEdge, batchRepair, type RepairAction } from '../repairs.js';
import { PanelHeader } from './shared.js';

const domainLabels: Record<DepDomain, string> = {
  'zone-asset': 'Zone Assets',
  'entity-asset': 'Entity Assets',
  'item-asset': 'Item Assets',
  'landmark-asset': 'Landmark Assets',
  'asset-pack': 'Asset Packs',
  'zone-ref': 'Zone References',
  'dialogue-ref': 'Dialogue References',
  'orphan-asset': 'Orphaned Assets',
  'orphan-pack': 'Orphaned Packs',
  'kit-provenance': 'Kit Provenance',
};

const domainOrder: DepDomain[] = [
  'zone-asset', 'entity-asset', 'item-asset', 'landmark-asset',
  'asset-pack', 'zone-ref', 'dialogue-ref', 'orphan-asset', 'orphan-pack', 'kit-provenance',
];

const statusColors: Record<string, string> = {
  broken: '#f85149',
  mismatched: '#d29922',
  orphaned: '#8b949e',
  informational: '#58a6ff',
};

export function DependencyPanel() {
  const { project, updateProject } = useProjectStore();
  const { setRightTab, setSelectedZone, setFocusTarget } = useEditorStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});
  const [relinkEdge, setRelinkEdge] = useState<DependencyEdge | null>(null);

  const report = useMemo(() => scanDependencies(project), [project]);

  // Group non-ok edges by domain
  const issueEdges = useMemo(
    () => report.edges.filter((e) => e.status !== 'ok'),
    [report],
  );

  const grouped = useMemo(() => {
    const map: Record<string, DependencyEdge[]> = {};
    for (const domain of domainOrder) map[domain] = [];
    for (const edge of issueEdges) {
      if (!map[edge.domain]) map[edge.domain] = [];
      map[edge.domain].push(edge);
    }
    return map;
  }, [issueEdges]);

  const handleRepair = (repair: RepairAction) => {
    updateProject(repair.apply);
    setRelinkEdge(null);
  };

  const handleBatchClearBroken = () => {
    const broken = issueEdges.filter((e) => e.status === 'broken');
    const repairs = broken.flatMap((e) => {
      const r = repairsForEdge(e, project);
      return r.filter((a) => a.kind === 'clear-broken-ref' || a.kind === 'clear-pack-ref' || a.kind === 'clear-broken-zone-ref' || a.kind === 'clear-broken-dialogue-ref');
    });
    if (repairs.length > 0) updateProject(batchRepair(repairs));
  };

  const handleBatchRemoveOrphans = () => {
    const orphans = issueEdges.filter((e) => e.status === 'orphaned');
    const repairs = orphans.flatMap((e) => repairsForEdge(e, project));
    if (repairs.length > 0) updateProject(batchRepair(repairs));
  };

  const handleNavigate = (edge: DependencyEdge) => {
    if (edge.sourceType === 'zone') {
      setSelectedZone(edge.sourceId);
      setRightTab('map');
    } else if (edge.sourceType === 'asset' || edge.sourceType === 'assetPack') {
      setRightTab('assets');
      setFocusTarget({ domain: 'assets', subPath: `assets.${edge.sourceId}`, timestamp: Date.now() });
    } else if (edge.sourceType === 'entityPlacement') {
      setRightTab('map');
      setFocusTarget({ domain: 'entities', subPath: `entityPlacements.${edge.sourceId}`, timestamp: Date.now() });
    } else if (edge.sourceType === 'itemPlacement') {
      setRightTab('map');
      setFocusTarget({ domain: 'items', subPath: `itemPlacements.${edge.sourceId}`, timestamp: Date.now() });
    } else if (edge.sourceType === 'landmark') {
      setRightTab('map');
    } else {
      setRightTab('map');
    }
  };

  const toggle = (domain: string) => {
    setCollapsed((c) => ({ ...c, [domain]: !c[domain] }));
  };

  const brokenCount = report.summary.broken;
  const mismatchedCount = report.summary.mismatched;
  const orphanedCount = report.summary.orphaned;
  const totalIssues = brokenCount + mismatchedCount + orphanedCount;

  if (totalIssues === 0) {
    return (
      <div>
        <PanelHeader title="Dependencies" />
        <div style={{ color: '#3fb950', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>
          No dependency issues found.
        </div>
      </div>
    );
  }

  return (
    <div>
      <PanelHeader title="Dependencies" badge={`${totalIssues} issue${totalIssues !== 1 ? 's' : ''}`} />

      {/* Summary bar */}
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>
        {brokenCount > 0 && <span style={{ color: '#f85149' }}>{brokenCount} broken</span>}
        {brokenCount > 0 && (mismatchedCount > 0 || orphanedCount > 0) && ', '}
        {mismatchedCount > 0 && <span style={{ color: '#d29922' }}>{mismatchedCount} mismatched</span>}
        {mismatchedCount > 0 && orphanedCount > 0 && ', '}
        {orphanedCount > 0 && <span style={{ color: '#8b949e' }}>{orphanedCount} orphaned</span>}
      </div>

      {/* Batch actions */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 8 }}>
        {brokenCount > 0 && (
          <button onClick={handleBatchClearBroken} style={batchBtnStyle}>
            Clear all broken refs
          </button>
        )}
        {orphanedCount > 0 && (
          <button onClick={handleBatchRemoveOrphans} style={batchBtnStyle}>
            Remove all orphans
          </button>
        )}
      </div>

      {/* Domain groups */}
      {domainOrder.map((domain) => {
        const edges = grouped[domain];
        if (!edges || edges.length === 0) return null;
        const isCollapsed = collapsed[domain];
        return (
          <div key={domain} style={{ marginBottom: 8 }}>
            <div
              onClick={() => toggle(domain)}
              style={{
                fontSize: 12, fontWeight: 600,
                color: statusColors[edges[0]?.status] || '#8b949e',
                cursor: 'pointer', padding: '4px 0', userSelect: 'none',
              }}
            >
              {isCollapsed ? '\u25b6' : '\u25bc'} {domainLabels[domain]} ({edges.length})
            </div>
            {!isCollapsed && edges.map((edge, i) => (
              <div key={i} style={{
                fontSize: 11, padding: '4px 0 4px 14px',
                borderLeft: `2px solid ${statusColors[edge.status] || '#30363d'}`,
              }}>
                {/* Status badge */}
                <span style={{
                  display: 'inline-block', fontSize: 9, fontWeight: 600,
                  background: statusColors[edge.status] || '#30363d',
                  color: '#fff', borderRadius: 4, padding: '1px 4px', marginRight: 4,
                }}>
                  {edge.status}
                </span>

                {/* Source label — clickable */}
                <span
                  onClick={() => handleNavigate(edge)}
                  style={{ color: '#58a6ff', cursor: 'pointer', textDecoration: 'underline' }}
                  title={`Navigate to ${edge.sourceType} "${edge.sourceId}"`}
                >
                  {edge.sourceLabel || edge.sourceId}
                </span>

                {/* Message */}
                <div style={{ color: '#8b949e', fontSize: 10, marginTop: 2 }}>
                  {edge.message}
                </div>

                {/* Repair buttons */}
                <div style={{ display: 'flex', gap: 4, marginTop: 3 }}>
                  {repairsForEdge(edge, project)
                    .filter((r) => r.kind !== 'relink-asset')
                    .map((repair, j) => (
                      <button
                        key={j}
                        onClick={() => handleRepair(repair)}
                        style={repairBtnStyle}
                      >
                        {repair.label}
                      </button>
                    ))}
                  {/* Relink button — opens picker */}
                  {repairsForEdge(edge, project).some((r) => r.kind === 'relink-asset') && (
                    <button
                      onClick={() => setRelinkEdge(relinkEdge === edge ? null : edge)}
                      style={repairBtnStyle}
                    >
                      Relink...
                    </button>
                  )}
                </div>

                {/* Relink picker */}
                {relinkEdge === edge && (
                  <div style={{ marginTop: 4, padding: 4, background: '#161b22', borderRadius: 4, border: '1px solid #30363d' }}>
                    <div style={{ fontSize: 10, color: '#8b949e', marginBottom: 4 }}>
                      Choose a {edge.expectedKind} asset:
                    </div>
                    {repairsForEdge(edge, project)
                      .filter((r) => r.kind === 'relink-asset')
                      .map((repair, j) => (
                        <div
                          key={j}
                          onClick={() => handleRepair(repair)}
                          style={{
                            fontSize: 11, color: '#58a6ff', cursor: 'pointer', padding: '2px 4px',
                            borderRadius: 3,
                          }}
                          onMouseEnter={(e) => { e.currentTarget.style.background = '#1c2128'; }}
                          onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}
                        >
                          {repair.label}
                        </div>
                      ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

/** Returns the count of non-ok, non-informational dependency edges. */
export function useDependencyCount(): number {
  const { project } = useProjectStore();
  return useMemo(() => {
    const r = scanDependencies(project);
    return r.summary.broken + r.summary.mismatched + r.summary.orphaned;
  }, [project]);
}

const batchBtnStyle: React.CSSProperties = {
  fontSize: 10, padding: '3px 8px', cursor: 'pointer',
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d', borderRadius: 4,
};

const repairBtnStyle: React.CSSProperties = {
  fontSize: 10, padding: '2px 6px', cursor: 'pointer',
  background: '#1c2128', color: '#58a6ff', border: '1px solid #30363d', borderRadius: 3,
};
