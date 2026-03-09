// ExportModal.tsx — export dialog with readiness summary and content overview

import { useState, useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { exportToEngine } from '@world-forge/export-ai-rpg';
import { validateProject, scanDependencies } from '@world-forge/schema';
import { classifyError, buildsSubTabFor } from './validation-helpers.js';
import { diffProjects } from '../diff/diff-model.js';
import { serializeProject, projectFilename } from '../projects/index.js';
import { useKitStore } from '../kits/index.js';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { project } = useProjectStore();
  const { setRightTab, setBuildsSubTab, setFocusTarget, setSelectedZone, markExported } = useEditorStore();
  const importSnapshot = useEditorStore((s) => s.importSnapshot);
  const importFidelity = useEditorStore((s) => s.importFidelity);
  const importSourceFormat = useEditorStore((s) => s.importSourceFormat);
  const activeKitId = useEditorStore((s) => s.activeKitId);
  const projectBundleSource = useEditorStore((s) => s.projectBundleSource);
  const { kits } = useKitStore();
  const [bundleExported, setBundleExported] = useState(false);
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid' | 'exported'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  const precheck = useMemo(() => validateProject(project), [project]);

  const handleValidate = () => {
    if (precheck.valid) {
      setStatus('valid');
      setErrors([]);
    } else {
      setStatus('invalid');
      setErrors(precheck.errors.map((e) => `[${e.path}] ${e.message}`));
    }
  };

  const handleExport = () => {
    const result = exportToEngine(project);
    if ('ok' in result) {
      setStatus('invalid');
      setErrors(result.errors.map((e) => `[${e.path}] ${e.message}`));
      return;
    }

    setWarnings(result.warnings);

    const blob = new Blob([JSON.stringify({
      contentPack: result.contentPack,
      manifest: result.manifest,
      packMeta: result.packMeta,
    }, null, 2)], { type: 'application/json' });

    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}-engine-pack.json`;
    a.click();
    URL.revokeObjectURL(url);
    setStatus('exported');
    markExported();
  };

  const handleGoToFirstIssue = () => {
    if (precheck.errors.length === 0) return;
    const err = precheck.errors[0];
    const p = err.path;
    const domain = classifyError(err);
    const focus = { domain, subPath: p, timestamp: Date.now() };

    const zoneMatch = p.match(/^zones\.([^.]+)/);
    if (zoneMatch) { setSelectedZone(zoneMatch[1]); setRightTab('map'); setFocusTarget(focus); onClose(); return; }
    if (p.startsWith('entityPlacements') || p.startsWith('itemPlacements') || p.startsWith('spawnPoints') || p.startsWith('connections')) { setRightTab('map'); setFocusTarget(focus); onClose(); return; }
    if (p.startsWith('playerTemplate')) { setRightTab('player'); setFocusTarget(focus); onClose(); return; }
    if (p.startsWith('buildCatalog')) { setRightTab('builds'); setBuildsSubTab(buildsSubTabFor(p)); setFocusTarget(focus); onClose(); return; }
    if (p.startsWith('progressionTrees')) { setRightTab('trees'); setFocusTarget(focus); onClose(); return; }
    if (p.startsWith('dialogues')) { setRightTab('dialogue'); setFocusTarget(focus); onClose(); return; }
    setRightTab('map'); setFocusTarget(focus); onClose();
  };

  // Content counts
  const counts = [
    { label: 'Zones', value: project.zones.length },
    { label: 'Districts', value: project.districts.length },
    { label: 'Entities', value: project.entityPlacements.length },
    { label: 'Items', value: project.itemPlacements.length },
    { label: 'Dialogues', value: project.dialogues.length },
    { label: 'Trees', value: project.progressionTrees.length },
    { label: 'Spawns', value: project.spawnPoints.length },
    { label: 'Assets', value: project.assets.length },
    { label: 'Packs', value: project.assetPacks.length },
  ];

  // Missing systems
  const missing: string[] = [];
  if (!project.playerTemplate) missing.push('No player template');
  if (!project.buildCatalog) missing.push('No build catalog');
  if (project.progressionTrees.length === 0) missing.push('No progression trees');
  if (project.dialogues.length === 0) missing.push('No dialogues');
  if (project.spawnPoints.length === 0) missing.push('No spawn points');

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20, width: 450, maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Export to AI RPG Engine</h3>

        {/* Readiness banner */}
        {precheck.valid ? (
          <div style={{ padding: '8px 12px', borderRadius: 4, marginBottom: 12, background: '#0d2818', border: '1px solid #238636', fontSize: 12, color: '#3fb950' }}>
            Ready to export — no issues found.
          </div>
        ) : (
          <div style={{ padding: '8px 12px', borderRadius: 4, marginBottom: 12, background: '#2a1c08', border: '1px solid #9e6a03', fontSize: 12, color: '#d29922' }}>
            Not ready — {precheck.errors.length} issue{precheck.errors.length !== 1 ? 's' : ''} must be fixed first.
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
              {precheck.errors.slice(0, 3).map((e, i) => (
                <div key={i}>{e.message}</div>
              ))}
              {precheck.errors.length > 3 && (
                <div style={{ fontStyle: 'italic' }}>...and {precheck.errors.length - 3} more</div>
              )}
            </div>
          </div>
        )}

        {/* Changes since import */}
        {importSnapshot && (() => {
          const diff = diffProjects(importSnapshot, project);
          const totalChanges = diff.totalModified + diff.totalAdded + diff.totalRemoved;
          const caveats = importFidelity
            ? [...new Set(importFidelity.entries.filter((e) => e.severity === 'warning').map((e) => e.message))]
            : [];
          return (
            <div style={{ padding: '8px 12px', borderRadius: 4, marginBottom: 12, background: '#0d1117', border: '1px solid #30363d', fontSize: 12 }}>
              <div style={{ fontWeight: 600, color: '#c9d1d9', marginBottom: 4 }}>Changes Since Import</div>
              <div style={{ color: '#8b949e', marginBottom: 4 }}>
                Imported from {importSourceFormat === 'export-result' ? 'ExportResult' : importSourceFormat === 'content-pack' ? 'ContentPack' : importSourceFormat === 'project-bundle' ? 'ProjectBundle' : 'WorldProject'}.
                {totalChanges === 0
                  ? <span style={{ color: '#3fb950' }}> No changes since import.</span>
                  : <span> Since import: <span style={{ color: '#58a6ff' }}>{diff.totalModified} modified</span>, <span style={{ color: '#3fb950' }}>{diff.totalAdded} added</span>, <span style={{ color: '#f85149' }}>{diff.totalRemoved} removed</span>.</span>
                }
              </div>
              {totalChanges > 0 && (
                <div style={{ fontSize: 11, color: '#8b949e' }}>
                  {diff.domains.filter((d) => d.modified + d.added + d.removed > 0).map((d) => (
                    <span key={d.domain} style={{ marginRight: 8 }}>
                      {d.domain}: {d.modified > 0 ? `${d.modified} modified` : ''}{d.added > 0 ? ` ${d.added} added` : ''}{d.removed > 0 ? ` ${d.removed} removed` : ''}
                    </span>
                  ))}
                </div>
              )}
              {caveats.length > 0 && (
                <div style={{ marginTop: 6, fontSize: 11, color: '#d29922' }}>
                  Import caveats:
                  {caveats.slice(0, 4).map((c, i) => (
                    <div key={i} style={{ paddingLeft: 8 }}>{'\u2022'} {c}</div>
                  ))}
                  {caveats.length > 4 && <div style={{ paddingLeft: 8, fontStyle: 'italic' }}>...and {caveats.length - 4} more</div>}
                </div>
              )}
            </div>
          );
        })()}

        {/* Content summary */}
        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4, fontWeight: 'bold' }}>Export Contents</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 12px', fontSize: 11, color: '#c9d1d9', marginBottom: 8 }}>
          {counts.map((c) => (
            <span key={c.label}>
              <span style={{ color: '#8b949e' }}>{c.label}:</span> {c.value}
            </span>
          ))}
        </div>

        {/* Missing systems */}
        {missing.length > 0 && (
          <div style={{ marginBottom: 12 }}>
            {missing.map((m, i) => (
              <div key={i} style={{ fontSize: 10, color: '#484f58', padding: '1px 0' }}>— {m}</div>
            ))}
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={handleValidate} style={modalBtnStyle}>Validate</button>
          <button onClick={handleExport} style={{
            ...modalBtnStyle,
            background: precheck.valid ? '#238636' : '#21262d',
            color: precheck.valid ? '#fff' : '#484f58',
            cursor: precheck.valid ? 'pointer' : 'not-allowed',
            opacity: precheck.valid ? 1 : 0.6,
          }} disabled={!precheck.valid}>Export JSON</button>
          {!precheck.valid && precheck.errors.length > 0 && (
            <button onClick={handleGoToFirstIssue} style={{ ...modalBtnStyle, color: '#58a6ff' }}>Fix first issue</button>
          )}
          <button onClick={onClose} style={modalBtnStyle}>Close</button>
        </div>

        {status === 'valid' && <div style={{ color: '#3fb950', fontSize: 13 }}>Validation passed!</div>}
        {status === 'exported' && <div style={{ color: '#3fb950', fontSize: 13 }}>Exported successfully!</div>}

        {errors.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ color: '#f85149', fontSize: 12, fontWeight: 'bold' }}>Errors:</div>
            {errors.map((e, i) => <div key={i} style={{ color: '#f85149', fontSize: 11, padding: '2px 0' }}>{e}</div>)}
          </div>
        )}

        {warnings.length > 0 && (
          <div style={{ marginTop: 8 }}>
            <div style={{ color: '#d29922', fontSize: 12, fontWeight: 'bold' }}>Warnings:</div>
            {warnings.map((w, i) => <div key={i} style={{ color: '#d29922', fontSize: 11, padding: '2px 0' }}>{w}</div>)}
          </div>
        )}

        {/* Project Bundle Export */}
        <div style={{ borderTop: '1px solid #30363d', marginTop: 16, paddingTop: 12 }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#c9d1d9', marginBottom: 4 }}>Export Project Bundle</div>
          <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>
            Save a portable <code style={{ color: '#58a6ff' }}>.wfproject.json</code> file that can be imported in another World Forge instance. Includes all project data and provenance metadata.
          </div>
          {projectBundleSource === 'imported' && (
            <div style={{ fontSize: 11, color: '#58a6ff', marginBottom: 8 }}>
              This project was imported from a project bundle.
            </div>
          )}
          {(() => {
            const depReport = scanDependencies(project);
            const broken = depReport.summary.broken + depReport.summary.mismatched;
            if (broken > 0) return (
              <div
                onClick={() => { setRightTab('deps'); onClose(); }}
                style={{ fontSize: 11, color: '#d29922', marginBottom: 8, cursor: 'pointer' }}
              >
                This project has {broken} broken reference{broken !== 1 ? 's' : ''}. Open Deps tab to repair before exporting.
              </div>
            );
            return null;
          })()}
          <button onClick={() => {
            const activeKit = activeKitId ? kits.find((k) => k.id === activeKitId) : undefined;
            const bundle = serializeProject(
              project,
              activeKit ? { name: activeKit.name, source: activeKit.builtIn ? 'built-in' : activeKit.source } : null,
            );
            const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = projectFilename(project.name);
            a.click();
            URL.revokeObjectURL(url);
            setBundleExported(true);
          }} style={{ ...modalBtnStyle, background: '#1f6feb', color: '#fff' }}>
            Export Project Bundle
          </button>
          {bundleExported && <span style={{ color: '#3fb950', fontSize: 12, marginLeft: 8 }}>Bundle saved!</span>}
        </div>
      </div>
    </div>
  );
}

const modalBtnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
};
