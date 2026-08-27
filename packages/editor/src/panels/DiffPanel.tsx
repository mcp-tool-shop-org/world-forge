// DiffPanel.tsx — semantic diff viewer for imported projects

import { useMemo } from 'react';
import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { diffProjects } from '../diff/diff-model.js';
import type { FidelityDomain } from '@world-forge/export-ai-rpg';
import { EmptyState, STATUS_TOKEN } from './shared.js';
import { useModalStore } from '../store/modal-store.js';

// EUB-019: DOMAIN_LABELS must stay exhaustive with the FidelityDomain union.
// When adding a new FidelityDomain variant in export-ai-rpg, add a corresponding label here.
const DOMAIN_LABELS: Record<FidelityDomain, string> = {
  zones: 'Zones', districts: 'Districts', entities: 'Entities', items: 'Items',
  dialogues: 'Dialogues', player: 'Player Template', builds: 'Build Catalog',
  progression: 'Progression Trees', world: 'World', assets: 'Assets', packs: 'Packs',
};

const STATUS_COLORS = STATUS_TOKEN;

export function DiffPanel() {
  const { project } = useProjectStore();
  const snapshot = useEditorStore((s) => s.importSnapshot);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

  const diff = useMemo(() => {
    if (!snapshot) return null;
    return diffProjects(snapshot, project);
  }, [snapshot, project]);

  if (!snapshot || !diff) {
    return (
      <EmptyState
        title="No change tracking"
        description="Import a project to enable change tracking."
        icon={'\u2194'}
        actions={[{ label: 'Open Import', onClick: () => useModalStore.getState().openModal('import') }]}
      />
    );
  }

  const totalChanges = diff.totalModified + diff.totalAdded + diff.totalRemoved;

  const toggleDomain = (d: string) => setCollapsed((s) => ({ ...s, [d]: !s[d] }));

  return (
    <div style={{ fontSize: 12 }}>
      <div style={{ fontWeight: 600, color: 'var(--wf-text-primary)', marginBottom: 8, fontSize: 14 }}>Changes Since Import</div>

      {totalChanges === 0 ? (
        <div style={{ color: 'var(--wf-success-text)', marginBottom: 12 }}>No changes since import.</div>
      ) : (
        <div style={{ marginBottom: 12, color: 'var(--wf-text-muted)' }}>
          <span style={{ color: STATUS_COLORS.modified }}>{diff.totalModified} modified</span>
          {', '}
          <span style={{ color: STATUS_COLORS.added }}>{diff.totalAdded} added</span>
          {', '}
          <span style={{ color: STATUS_COLORS.removed }}>{diff.totalRemoved} removed</span>
        </div>
      )}

      {diff.domains.map((dd) => {
        const changeCount = dd.modified + dd.added + dd.removed;
        if (dd.objects.length === 0 && changeCount === 0) return null;

        const label = DOMAIN_LABELS[dd.domain] ?? dd.domain;
        const isCollapsed = collapsed[dd.domain] ?? (changeCount === 0);

        return (
          <div key={dd.domain} style={{ marginBottom: 8 }}>
            <div
              onClick={() => toggleDomain(dd.domain)}
              style={{
                display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                padding: '4px 6px', cursor: 'pointer', borderRadius: 4,
                background: 'var(--wf-bg-panel)', border: '1px solid var(--wf-bg-control)',
              }}
            >
              <span style={{ color: 'var(--wf-text-primary)' }}>
                {isCollapsed ? '\u25B6' : '\u25BC'} {label}
              </span>
              <span style={{ fontSize: 11, color: changeCount === 0 ? 'var(--wf-success-text)' : 'var(--wf-accent)' }}>
                {changeCount === 0 ? 'no changes' : `${changeCount} change${changeCount !== 1 ? 's' : ''}`}
              </span>
            </div>
            {!isCollapsed && changeCount > 0 && (
              <div style={{ paddingLeft: 12, marginTop: 4 }}>
                {dd.objects.filter((o) => o.status !== 'unchanged').map((obj) => (
                  <div key={obj.id} style={{ marginBottom: 6 }}>
                    <div style={{ color: STATUS_COLORS[obj.status], fontSize: 11, fontWeight: 600 }}>
                      {obj.name ?? obj.id} — {obj.status}
                    </div>
                    {obj.fieldDiffs.length > 0 && (
                      <div style={{ paddingLeft: 8, fontSize: 11 }}>
                        {obj.fieldDiffs.map((fd, i) => (
                          <div key={i} style={{ marginBottom: 2 }}>
                            <span style={{ color: 'var(--wf-text-muted)' }}>{fd.field}: </span>
                            <span style={{ color: 'var(--wf-danger-text)', textDecoration: 'line-through', opacity: 0.7 }}>
                              {formatValue(fd.before)}
                            </span>
                            {' \u2192 '}
                            <span style={{ color: 'var(--wf-success-text)' }}>{formatValue(fd.after)}</span>
                          </div>
                        ))}
                      </div>
                    )}
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

function formatValue(v: unknown): string {
  if (v === undefined || v === null) return '(none)';
  if (typeof v === 'string') return v.length > 40 ? v.slice(0, 37) + '...' : v;
  if (typeof v === 'number' || typeof v === 'boolean') return String(v);
  return JSON.stringify(v).slice(0, 50);
}
