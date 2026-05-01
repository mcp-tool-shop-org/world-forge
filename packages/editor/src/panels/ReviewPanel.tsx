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

      {/* FT-035: Project Metadata UI */}
      <Section title="Project Info" isOpen={isOpen('project-info')} toggle={() => toggle('project-info')}>
        <Row label="Name" value={enriched.projectName} />
        <Row label="Mode" value={`${enriched.modeLabel}`} />
        <Row label="Genre" value={enriched.genre} />
        <Row label="Version" value={enriched.version} />
        {enriched.description && <Row label="Desc" value={enriched.description} />}
        <ProjectMetadataFields />
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

      {/* FT-031: Project Statistics */}
      <Section title="Statistics" isOpen={isOpen('statistics')} toggle={() => toggle('statistics')}>
        <StatisticsSection project={project} snapshot={enriched} />
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

// ── FT-035: Project Metadata editor ────────────────────────

function ProjectMetadataFields() {
  const { project, updateProject } = useProjectStore();

  const setField = (field: 'author' | 'license' | 'category', value: string) => {
    updateProject((p) => ({ ...p, [field]: value || undefined }), `Set ${field}`);
  };

  const [tagInput, setTagInput] = useState('');

  const addTag = () => {
    const tag = tagInput.trim();
    if (!tag) return;
    const existing = project.projectTags ?? [];
    if (existing.includes(tag)) return;
    updateProject((p) => ({ ...p, projectTags: [...(p.projectTags ?? []), tag] }), 'Add project tag');
    setTagInput('');
  };

  const removeTag = (tag: string) => {
    updateProject((p) => ({ ...p, projectTags: (p.projectTags ?? []).filter((t) => t !== tag) }), 'Remove project tag');
  };

  const metaInputStyle: React.CSSProperties = {
    width: '100%', background: 'var(--wf-bg-app)', border: '1px solid var(--wf-border-default)',
    borderRadius: 3, padding: '3px 6px', color: 'var(--wf-text-primary)', fontSize: 11, outline: 'none',
  };

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#8b949e' }}>Author</span>
        <input
          value={project.author ?? ''}
          onChange={(e) => setField('author', e.target.value)}
          placeholder="Author name"
          style={metaInputStyle}
        />
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#8b949e' }}>License</span>
        <input
          value={project.license ?? ''}
          onChange={(e) => setField('license', e.target.value)}
          placeholder="e.g. CC-BY-4.0, MIT"
          style={metaInputStyle}
        />
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#8b949e' }}>Category</span>
        <input
          value={project.category ?? ''}
          onChange={(e) => setField('category', e.target.value)}
          placeholder="e.g. fantasy, sci-fi, horror"
          style={metaInputStyle}
        />
      </div>
      <div style={{ marginBottom: 4 }}>
        <span style={{ fontSize: 10, color: '#8b949e' }}>Tags</span>
        <div style={{ display: 'flex', gap: 3, marginTop: 2 }}>
          <input
            value={tagInput}
            onChange={(e) => setTagInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
            placeholder="Add tag..."
            style={{ ...metaInputStyle, flex: 1 }}
          />
          <button onClick={addTag} style={{ background: 'var(--wf-bg-control)', border: '1px solid var(--wf-border-default)', borderRadius: 3, color: 'var(--wf-text-muted)', cursor: 'pointer', fontSize: 11, padding: '2px 6px' }}>+</button>
        </div>
        {(project.projectTags ?? []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 3, marginTop: 4 }}>
            {(project.projectTags ?? []).map((tag) => (
              <span key={tag} style={{ fontSize: 10, background: 'var(--wf-bg-control)', border: '1px solid var(--wf-border-default)', borderRadius: 8, padding: '1px 6px', color: 'var(--wf-text-muted)', display: 'flex', alignItems: 'center', gap: 3 }}>
                {tag}
                <span onClick={() => removeTag(tag)} style={{ cursor: 'pointer', color: 'var(--wf-danger, #f85149)', fontWeight: 'bold' }}>{'\u00D7'}</span>
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ── FT-031: Statistics Section ─────────────────────────────

/** Simple colored bar with label and count */
export function StatBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, padding: '2px 0' }}>
      <span style={{ color: '#8b949e', minWidth: 80 }}>{label}</span>
      <div style={{ flex: 1, height: 8, background: '#21262d', borderRadius: 4, overflow: 'hidden' }}>
        <div style={{ width: `${pct}%`, height: '100%', background: color, borderRadius: 4, minWidth: count > 0 ? 2 : 0 }} />
      </div>
      <span style={{ color: '#c9d1d9', minWidth: 32, textAlign: 'right' }}>{count}</span>
      <span style={{ color: '#6e7681', minWidth: 32, fontSize: 10 }}>{pct}%</span>
    </div>
  );
}

/** Compute and render entity role distribution, connection kinds, encounter types, zones per district */
export function computeStatistics(project: import('@world-forge/schema').WorldProject) {
  // Entity role distribution
  const roleMap: Record<string, number> = {};
  for (const ep of project.entityPlacements) {
    roleMap[ep.role] = (roleMap[ep.role] ?? 0) + 1;
  }

  // Connection kind breakdown
  const kindMap: Record<string, number> = {};
  for (const conn of project.connections) {
    const kind = conn.kind ?? 'passage';
    kindMap[kind] = (kindMap[kind] ?? 0) + 1;
  }

  // Encounter type summary
  const encTypeMap: Record<string, number> = {};
  for (const enc of project.encounterAnchors) {
    const type = enc.encounterType ?? 'unknown';
    encTypeMap[type] = (encTypeMap[type] ?? 0) + 1;
  }

  // Zone count per district
  const districtZones: Array<{ name: string; count: number }> = [];
  for (const d of project.districts) {
    districtZones.push({ name: d.name, count: d.zoneIds.length });
  }
  // Unassigned zones
  const assignedZoneIds = new Set(project.districts.flatMap((d) => d.zoneIds));
  const unassignedCount = project.zones.filter((z) => !assignedZoneIds.has(z.id)).length;
  if (unassignedCount > 0) {
    districtZones.push({ name: 'Unassigned', count: unassignedCount });
  }

  return { roleMap, kindMap, encTypeMap, districtZones };
}

const STAT_COLORS = ['#58a6ff', '#f85149', '#3fb950', '#d29922', '#bc8cff', '#79c0ff', '#ff7b72', '#39d5ff'];

function StatisticsSection({ project, snapshot }: { project: import('@world-forge/schema').WorldProject; snapshot: EnrichedReviewSnapshot }) {
  const stats = useMemo(() => computeStatistics(project), [project]);
  const totalEntities = project.entityPlacements.length;
  const totalConnections = project.connections.length;
  const totalEncounters = project.encounterAnchors.length;
  const totalDistrictZones = stats.districtZones.reduce((s, d) => s + d.count, 0);

  return (
    <div>
      {/* Entity role distribution */}
      {totalEntities > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#6e7681', fontWeight: 600, marginBottom: 2 }}>Entity Roles ({totalEntities})</div>
          {Object.entries(stats.roleMap)
            .sort(([, a], [, b]) => b - a)
            .map(([role, count], i) => (
              <StatBar key={role} label={role} count={count} total={totalEntities} color={STAT_COLORS[i % STAT_COLORS.length]} />
            ))}
        </div>
      )}

      {/* Connection kind breakdown */}
      {totalConnections > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#6e7681', fontWeight: 600, marginBottom: 2 }}>Connection Kinds ({totalConnections})</div>
          {Object.entries(stats.kindMap)
            .sort(([, a], [, b]) => b - a)
            .map(([kind, count], i) => (
              <StatBar key={kind} label={kind} count={count} total={totalConnections} color={STAT_COLORS[(i + 2) % STAT_COLORS.length]} />
            ))}
        </div>
      )}

      {/* Encounter type summary */}
      {totalEncounters > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#6e7681', fontWeight: 600, marginBottom: 2 }}>Encounter Types ({totalEncounters})</div>
          {Object.entries(stats.encTypeMap)
            .sort(([, a], [, b]) => b - a)
            .map(([type, count], i) => (
              <StatBar key={type} label={type} count={count} total={totalEncounters} color={STAT_COLORS[(i + 4) % STAT_COLORS.length]} />
            ))}
        </div>
      )}

      {/* Zone count per district */}
      {stats.districtZones.length > 0 && (
        <div style={{ marginBottom: 8 }}>
          <div style={{ fontSize: 10, color: '#6e7681', fontWeight: 600, marginBottom: 2 }}>Zones per District ({totalDistrictZones})</div>
          {stats.districtZones.map((d, i) => (
            <StatBar key={d.name} label={d.name} count={d.count} total={totalDistrictZones} color={STAT_COLORS[(i + 1) % STAT_COLORS.length]} />
          ))}
        </div>
      )}

      {totalEntities === 0 && totalConnections === 0 && totalEncounters === 0 && stats.districtZones.length === 0 && (
        <EmptyNote>No data to display statistics for yet.</EmptyNote>
      )}
    </div>
  );
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
