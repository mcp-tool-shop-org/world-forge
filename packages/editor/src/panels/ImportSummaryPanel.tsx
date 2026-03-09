// ImportSummaryPanel.tsx — fidelity report display for imported projects

import { useState } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import type { FidelityDomain, FidelityEntry } from '@world-forge/export-ai-rpg';

const DOMAIN_LABELS: Record<FidelityDomain, string> = {
  zones: 'Zones', districts: 'Districts', entities: 'Entities', items: 'Items',
  dialogues: 'Dialogues', player: 'Player Template', builds: 'Build Catalog',
  progression: 'Progression Trees', world: 'World',
};

const DOMAIN_ORDER: FidelityDomain[] = [
  'zones', 'districts', 'entities', 'items', 'dialogues', 'player', 'builds', 'progression', 'world',
];

const LEVEL_COLORS = {
  lossless: '#3fb950',
  approximated: '#d29922',
  dropped: '#f85149',
};

const SEVERITY_ICONS = {
  info: '\u2139',
  warning: '\u26A0',
  error: '\u2716',
};

export function ImportSummaryPanel() {
  const report = useEditorStore((s) => s.importFidelity);
  const format = useEditorStore((s) => s.importSourceFormat);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  if (!report) {
    return (
      <div style={{ fontSize: 12, color: '#8b949e', padding: '8px 0' }}>
        No import data. Import a project to see fidelity details.
      </div>
    );
  }

  const { summary, entries } = report;
  const pct = summary.losslessPercent;

  // Group entries by domain
  const byDomain: Partial<Record<FidelityDomain, FidelityEntry[]>> = {};
  for (const e of entries) {
    (byDomain[e.domain] ??= []).push(e);
  }

  const toggleDomain = (d: string) => setCollapsed((s) => ({ ...s, [d]: !s[d] }));

  const formatLabel = format === 'world-project' ? 'WorldProject (lossless)'
    : format === 'export-result' ? 'ExportResult (lossy)'
    : 'ContentPack (lossy)';

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: '#c9d1d9', marginBottom: 8, fontSize: 14 }}>Import Summary</div>

      {/* Format badge */}
      <div style={{ marginBottom: 12 }}>
        <span style={{
          display: 'inline-block', fontSize: 11, borderRadius: 12, padding: '2px 10px', fontWeight: 600,
          background: format === 'world-project' ? '#0d2818' : '#2a1c08',
          color: format === 'world-project' ? '#3fb950' : '#d29922',
          border: `1px solid ${format === 'world-project' ? '#238636' : '#9e6a03'}`,
        }}>
          {formatLabel}
        </span>
      </div>

      {/* Overall bar */}
      <div style={{ marginBottom: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
          <span style={{ color: '#c9d1d9' }}>Overall: {pct}% lossless</span>
          <span style={{ color: '#8b949e' }}>{summary.total} entries</span>
        </div>
        <div style={{ height: 6, background: '#21262d', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{
            height: '100%', borderRadius: 3,
            width: `${pct}%`,
            background: pct === 100 ? '#3fb950' : pct >= 70 ? '#d29922' : '#f85149',
          }} />
        </div>
        <div style={{ display: 'flex', gap: 12, marginTop: 4, color: '#8b949e', fontSize: 11 }}>
          <span style={{ color: LEVEL_COLORS.lossless }}>Lossless: {summary.lossless}</span>
          <span style={{ color: LEVEL_COLORS.approximated }}>Approximated: {summary.approximated}</span>
          <span style={{ color: LEVEL_COLORS.dropped }}>Dropped: {summary.dropped}</span>
        </div>
      </div>

      {/* Domain groups */}
      {DOMAIN_ORDER.map((domain) => {
        const domainEntries = byDomain[domain];
        if (!domainEntries || domainEntries.length === 0) return null;
        const ds = summary.byDomain[domain];
        const domainPct = ds ? Math.round((ds.lossless / ds.total) * 100) : 0;
        const isCollapsed = collapsed[domain] ?? false;

        return (
          <div key={domain} style={{ marginBottom: 8 }}>
            <div
              onClick={() => toggleDomain(domain)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 6px', cursor: 'pointer', borderRadius: 4,
                background: '#161b22', border: '1px solid #21262d',
              }}
            >
              <span style={{ color: '#c9d1d9' }}>
                {isCollapsed ? '\u25B6' : '\u25BC'} {DOMAIN_LABELS[domain]} ({domainEntries.length})
              </span>
              <span style={{
                fontSize: 11,
                color: domainPct === 100 ? '#3fb950' : domainPct >= 50 ? '#d29922' : '#f85149',
              }}>
                {domainPct}%
              </span>
            </div>
            {!isCollapsed && (
              <div style={{ paddingLeft: 12, marginTop: 4 }}>
                {domainEntries.map((entry, i) => (
                  <div key={i} style={{
                    fontSize: 11, padding: '2px 0', color: LEVEL_COLORS[entry.level],
                    display: 'flex', gap: 4, alignItems: 'flex-start',
                  }}>
                    <span>{SEVERITY_ICONS[entry.severity]}</span>
                    <span>
                      {entry.entityId && <span style={{ color: '#8b949e' }}>{entry.entityId}: </span>}
                      {entry.message}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
