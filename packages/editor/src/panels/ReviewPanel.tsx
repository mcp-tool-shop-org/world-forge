// ReviewPanel.tsx — read-only project review snapshot with health status and content overview

import { useCallback, useMemo, useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { buildReviewSnapshot, type ReviewSnapshot, type HealthStatus } from '@world-forge/schema';
import { reviewSnapshotToMarkdown, reviewSnapshotToJSON, summaryFilename } from '../review/export-summary.js';
import { buttonBase } from '../ui/styles.js';

// ── Enriched snapshot (adds editor-only context) ────────────

export interface EnrichedReviewSnapshot extends ReviewSnapshot {
  kitName?: string;
  kitSource?: string;
  importFormat?: string;
  bundleSource?: string;
  importFidelityPercent?: number;
  hasExported: boolean;
  unassignedZoneNames?: string[];
}

export function enrichReviewSnapshot(
  snapshot: ReviewSnapshot,
  context: {
    activeKitId: string | null;
    importSourceFormat: string | null;
    projectBundleSource: string | null;
    importFidelityPercent: number | null;
    hasExported: boolean;
    unassignedZoneNames?: string[];
  },
): EnrichedReviewSnapshot {
  return {
    ...snapshot,
    kitName: context.activeKitId ?? undefined,
    importFormat: context.importSourceFormat ?? undefined,
    bundleSource: context.projectBundleSource ?? undefined,
    importFidelityPercent: context.importFidelityPercent ?? undefined,
    hasExported: context.hasExported,
    unassignedZoneNames: context.unassignedZoneNames,
  };
}

// ── Health badge styling ────────────────────────────────────

const HEALTH_COLORS: Record<HealthStatus, string> = {
  ready: '#3fb950',
  healthy: '#3fb950',
  degraded: '#d29922',
  blocked: '#f85149',
};

const HEALTH_BG: Record<HealthStatus, string> = {
  ready: 'rgba(63,185,80,0.12)',
  healthy: 'rgba(63,185,80,0.12)',
  degraded: 'rgba(210,153,34,0.12)',
  blocked: 'rgba(248,81,73,0.12)',
};

// ── Component ───────────────────────────────────────────────

export function ReviewPanel() {
  const { project } = useProjectStore();
  const { setRightTab, setSelectedZone, activeKitId, importSourceFormat, projectBundleSource, importFidelity, hasExported } = useEditorStore();
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const snapshot = useMemo(() => buildReviewSnapshot(project), [project]);

  // Unassigned zones: zones not in any district
  const unassignedZones = useMemo(() => {
    const assignedZoneIds = new Set(project.districts.flatMap((d) => d.zoneIds));
    return project.zones.filter((z) => !assignedZoneIds.has(z.id));
  }, [project]);

  const enriched = useMemo(() => enrichReviewSnapshot(snapshot, {
    activeKitId,
    importSourceFormat: importSourceFormat ?? null,
    projectBundleSource,
    importFidelityPercent: importFidelity?.summary.losslessPercent ?? null,
    hasExported,
    unassignedZoneNames: unassignedZones.map((z) => z.name),
  }), [snapshot, activeKitId, importSourceFormat, projectBundleSource, importFidelity, hasExported, unassignedZones]);

  const [exportMsg, setExportMsg] = useState<string | null>(null);

  const toggle = (key: string) => setCollapsed((c) => ({ ...c, [key]: !c[key] }));
  const isOpen = (key: string) => !collapsed[key];

  const downloadBlob = useCallback((content: string, filename: string, mime: string) => {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
    setExportMsg('Summary saved!');
    setTimeout(() => setExportMsg(null), 2000);
  }, []);

  const handleExportMd = useCallback(() => {
    const md = reviewSnapshotToMarkdown(enriched);
    downloadBlob(md, summaryFilename(enriched.projectName, 'md'), 'text/markdown');
  }, [enriched, downloadBlob]);

  const handleExportJson = useCallback(() => {
    const json = JSON.stringify(reviewSnapshotToJSON(enriched), null, 2);
    downloadBlob(json, summaryFilename(enriched.projectName, 'json'), 'application/json');
  }, [enriched, downloadBlob]);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
        <span style={headerStyle}>Review</span>
        <div style={{ flex: 1 }} />
        <button onClick={handleExportMd} style={exportBtnStyle}>Export MD</button>
        <button onClick={handleExportJson} style={exportBtnStyle}>Export JSON</button>
        {exportMsg && <span style={{ fontSize: 10, color: '#3fb950' }}>{exportMsg}</span>}
      </div>

      {/* Health banner */}
      <div style={{
        padding: '8px 10px', marginBottom: 10, borderRadius: 6,
        background: HEALTH_BG[enriched.health],
        border: `1px solid ${HEALTH_COLORS[enriched.health]}33`,
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{
          fontSize: 10, fontWeight: 700, textTransform: 'uppercase',
          color: HEALTH_COLORS[enriched.health],
          background: `${HEALTH_COLORS[enriched.health]}22`,
          borderRadius: 4, padding: '2px 6px',
        }}>
          {enriched.health}
        </span>
        <span style={{ fontSize: 12, color: '#c9d1d9' }}>{enriched.healthLabel}</span>
      </div>

      {/* Project overview */}
      <Section title="Project" isOpen={isOpen('project')} toggle={() => toggle('project')}>
        <Row label="Name" value={enriched.projectName} />
        <Row label="Mode" value={`${enriched.modeLabel}`} />
        <Row label="Genre" value={enriched.genre} />
        <Row label="Version" value={enriched.version} />
        {enriched.description && <Row label="Desc" value={enriched.description} />}
      </Section>

      {/* Content counts */}
      <Section title="Content" isOpen={isOpen('content')} toggle={() => toggle('content')}>
        <CountGrid counts={enriched.counts} />
      </Section>

      {/* System completeness */}
      <Section title="Systems" isOpen={isOpen('systems')} toggle={() => toggle('systems')}>
        <SystemCheck label="Player Template" ok={enriched.systems.hasPlayerTemplate} />
        <SystemCheck label="Build Catalog" ok={enriched.systems.hasBuildCatalog} />
        <SystemCheck label="Progression Trees" ok={enriched.systems.hasProgressionTrees} />
        <SystemCheck label="Dialogues" ok={enriched.systems.hasDialogues} />
        <SystemCheck label="Spawn Points" ok={enriched.systems.hasSpawnPoints} />
      </Section>

      {/* Regions */}
      <Section title={`Regions (${enriched.regions.length})`} isOpen={isOpen('regions')} toggle={() => toggle('regions')}>
        {enriched.regions.length === 0 && <EmptyNote>No districts defined</EmptyNote>}
        {enriched.regions.map((r) => (
          <div key={r.id} style={{ marginBottom: 8, padding: '6px 8px', background: '#161b22', borderRadius: 4 }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9', marginBottom: 4, cursor: 'pointer' }}
              onClick={() => { if (r.zoneNames.length > 0) { setSelectedZone(r.id); setRightTab('map'); } }}
              title="Click to navigate"
            >
              {r.name}
            </div>
            <Row label="Zones" value={`${r.zoneCount} — ${r.zoneNames.join(', ')}`} />
            {r.controllingFaction && <Row label="Faction" value={r.controllingFaction} />}
            <MetricsBar metrics={r.metrics} />
            {r.entityCount > 0 && (
              <div style={{ marginTop: 4 }}>
                <span style={{ fontSize: 10, color: '#8b949e' }}>Entities: {r.entityCount}</span>
                <RolePills roles={r.entityRoles} />
              </div>
            )}
            {r.encounterCount > 0 && <Row label="Encounters" value={`${r.encounterCount}`} />}
            {r.itemCount > 0 && <Row label="Items" value={`${r.itemCount}`} />}
          </div>
        ))}
        {unassignedZones.length > 0 && (
          <div style={{ marginBottom: 8, padding: '6px 8px', background: '#161b22', borderRadius: 4, borderLeft: '2px solid #d29922' }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: '#d29922', marginBottom: 4 }}>
              Unassigned ({unassignedZones.length})
            </div>
            <div style={{ fontSize: 11, color: '#8b949e' }}>
              {unassignedZones.map((z) => z.name).join(', ')}
            </div>
          </div>
        )}
      </Section>

      {/* Encounters */}
      <Section title={`Encounters (${enriched.encounters.totalCount})`} isOpen={isOpen('encounters')} toggle={() => toggle('encounters')}>
        {enriched.encounters.totalCount === 0 && <EmptyNote>No encounters</EmptyNote>}
        {enriched.encounters.totalCount > 0 && (
          <>
            {Object.entries(enriched.encounters.byType).map(([type, count]) => (
              <Row key={type} label={type} value={`${count}`} />
            ))}
            <Row label="Avg Probability" value={`${(enriched.encounters.avgProbability * 100).toFixed(0)}%`} />
            <Row label="Zones w/ Encounters" value={`${enriched.encounters.zonesWithEncounters}`} />
            {enriched.encounters.bossEncounters > 0 && (
              <Row label="Boss Encounters" value={`${enriched.encounters.bossEncounters}`} highlight />
            )}
          </>
        )}
      </Section>

      {/* Connections */}
      <Section title={`Connections (${enriched.connections.totalCount})`} isOpen={isOpen('connections')} toggle={() => toggle('connections')}>
        {enriched.connections.totalCount === 0 && <EmptyNote>No connections</EmptyNote>}
        {enriched.connections.totalCount > 0 && (
          <>
            {Object.entries(enriched.connections.byKind).map(([kind, count]) => (
              <Row key={kind} label={kind} value={`${count}`} />
            ))}
            <Row label="Bidirectional" value={`${enriched.connections.bidirectionalCount}`} />
            <Row label="One-way" value={`${enriched.connections.oneWayCount}`} />
            {enriched.connections.conditionalCount > 0 && (
              <Row label="Conditional" value={`${enriched.connections.conditionalCount}`} />
            )}
          </>
        )}
      </Section>

      {/* Dependencies */}
      <Section title="Dependencies" isOpen={isOpen('deps')} toggle={() => toggle('deps')}>
        {enriched.dependencies.totalIssues === 0 ? (
          <div style={{ fontSize: 11, color: '#3fb950' }}>All references resolved</div>
        ) : (
          <>
            <Row label="Broken" value={`${enriched.dependencies.broken}`} highlight={enriched.dependencies.broken > 0} />
            <Row label="Mismatched" value={`${enriched.dependencies.mismatched}`} highlight={enriched.dependencies.mismatched > 0} />
            <Row label="Orphaned" value={`${enriched.dependencies.orphaned}`} />
            <LinkButton onClick={() => setRightTab('deps')}>Open Dependency Manager</LinkButton>
          </>
        )}
      </Section>

      {/* Validation */}
      <Section title="Validation" isOpen={isOpen('validation')} toggle={() => toggle('validation')}>
        {enriched.validation.valid ? (
          <div style={{ fontSize: 11, color: '#3fb950' }}>No validation errors</div>
        ) : (
          <>
            <Row label="Errors" value={`${enriched.validation.errorCount}`} highlight />
            {Object.entries(enriched.validation.errorsByDomain).map(([domain, count]) => (
              <Row key={domain} label={domain} value={`${count}`} />
            ))}
            {enriched.validation.firstErrors.length > 0 && (
              <div style={{ marginTop: 4 }}>
                {enriched.validation.firstErrors.map((e, i) => (
                  <div key={i} style={{ fontSize: 10, color: '#f0883e', padding: '2px 0' }}>{e.message}</div>
                ))}
              </div>
            )}
            <LinkButton onClick={() => setRightTab('issues')}>Open Issues Panel</LinkButton>
          </>
        )}
      </Section>

      {/* Provenance */}
      {(enriched.kitName || enriched.importFormat || enriched.bundleSource) && (
        <Section title="Provenance" isOpen={isOpen('provenance')} toggle={() => toggle('provenance')}>
          {enriched.kitName && <Row label="Kit" value={enriched.kitName} />}
          {enriched.importFormat && <Row label="Import Format" value={enriched.importFormat} />}
          {enriched.bundleSource && <Row label="Source" value={enriched.bundleSource} />}
          {enriched.importFidelityPercent != null && (
            <Row label="Fidelity" value={`${enriched.importFidelityPercent}%`} />
          )}
          {enriched.hasExported && <Row label="Exported" value="Yes" />}
        </Section>
      )}
    </div>
  );
}

/** Hook for external use: returns current health status for bottom bar. */
export function useReviewHealth(): HealthStatus {
  const { project } = useProjectStore();
  return useMemo(() => buildReviewSnapshot(project).health, [project]);
}

// ── Sub-components ──────────────────────────────────────────

function Section({ title, isOpen, toggle, children }: {
  title: string; isOpen: boolean; toggle: () => void; children: React.ReactNode;
}) {
  return (
    <div style={{ marginBottom: 8 }}>
      <div
        onClick={toggle}
        style={{
          fontSize: 12, fontWeight: 600, color: '#58a6ff',
          cursor: 'pointer', padding: '4px 0', userSelect: 'none',
        }}
      >
        {isOpen ? '\u25bc' : '\u25b6'} {title}
      </div>
      {isOpen && <div style={{ paddingLeft: 8 }}>{children}</div>}
    </div>
  );
}

function Row({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '2px 0' }}>
      <span style={{ color: '#8b949e' }}>{label}</span>
      <span style={{ color: highlight ? '#d29922' : '#c9d1d9' }}>{value}</span>
    </div>
  );
}

function CountGrid({ counts }: { counts: ReviewSnapshot['counts'] }) {
  const entries = Object.entries(counts) as [string, number][];
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2px 12px' }}>
      {entries.map(([key, count]) => (
        <div key={key} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, padding: '1px 0' }}>
          <span style={{ color: '#8b949e' }}>{key}</span>
          <span style={{ color: '#c9d1d9' }}>{count}</span>
        </div>
      ))}
    </div>
  );
}

function SystemCheck({ label, ok }: { label: string; ok: boolean }) {
  return (
    <div style={{ fontSize: 11, padding: '2px 0', color: ok ? '#3fb950' : '#8b949e' }}>
      {ok ? '\u2714' : '\u2014'} {label}
    </div>
  );
}

function MetricsBar({ metrics }: { metrics: { commerce: number; morale: number; safety: number; stability: number } }) {
  const items = [
    { label: 'Com', value: metrics.commerce },
    { label: 'Mor', value: metrics.morale },
    { label: 'Saf', value: metrics.safety },
    { label: 'Sta', value: metrics.stability },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, marginTop: 2 }}>
      {items.map((m) => (
        <div key={m.label} style={{ flex: 1, textAlign: 'center' }}>
          <div style={{
            height: 4, borderRadius: 2,
            background: `linear-gradient(to right, #58a6ff ${m.value}%, #21262d ${m.value}%)`,
          }} />
          <div style={{ fontSize: 9, color: '#6e7681', marginTop: 1 }}>{m.label} {m.value}</div>
        </div>
      ))}
    </div>
  );
}

const ROLE_COLORS: Record<string, string> = {
  npc: '#58a6ff',
  enemy: '#f85149',
  merchant: '#3fb950',
  boss: '#bc8cff',
  companion: '#79c0ff',
  'quest-giver': '#d29922',
};

function RolePills({ roles }: { roles: Record<string, number> }) {
  return (
    <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 2 }}>
      {Object.entries(roles).map(([role, count]) => (
        <span key={role} style={{
          fontSize: 9, borderRadius: 8, padding: '1px 6px',
          background: `${ROLE_COLORS[role] ?? '#8b949e'}22`,
          color: ROLE_COLORS[role] ?? '#8b949e',
        }}>
          {role} {count}
        </span>
      ))}
    </div>
  );
}

function EmptyNote({ children }: { children: React.ReactNode }) {
  return <div style={{ fontSize: 11, color: '#6e7681', fontStyle: 'italic' }}>{children}</div>;
}

function LinkButton({ onClick, children }: { onClick: () => void; children: React.ReactNode }) {
  return (
    <div
      onClick={onClick}
      style={{
        fontSize: 10, color: '#58a6ff', cursor: 'pointer', marginTop: 4,
        textDecoration: 'underline',
      }}
    >
      {children}
    </div>
  );
}

const headerStyle: React.CSSProperties = { fontSize: 11, color: '#8b949e', marginBottom: 8 };

const exportBtnStyle: React.CSSProperties = {
  ...buttonBase, padding: '2px 8px', fontSize: 10,
};
