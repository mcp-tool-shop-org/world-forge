// ImportModal.tsx — import WorldProject / ContentPack / ExportResult / ProjectBundle JSON

import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { importProject, detectImportFormat, type ImportResult, type ImportFormat } from '@world-forge/export-ai-rpg';
import { buildFidelityReport } from '@world-forge/export-ai-rpg';
import { prepareProjectImport, extractDependencies, type ImportProjectResult } from '../projects/index.js';
import { scanDependencies } from '@world-forge/schema';
import { MODAL_OVERLAY, MODAL_CARD, ACTIVE_TAB_BG } from './shared.js';

interface Props { onClose: () => void }

const FORMAT_LABELS: Record<ImportFormat, string> = {
  'world-project': 'WorldProject (lossless)',
  'content-pack': 'ContentPack (lossy)',
  'export-result': 'ExportResult (lossy)',
  'project-bundle': 'ProjectBundle (lossless)',
};

const FORMAT_COLORS: Record<ImportFormat, React.CSSProperties> = {
  'world-project': { background: '#0d2818', color: '#3fb950', border: '1px solid #238636' },
  'content-pack': { background: '#2a1c08', color: '#d29922', border: '1px solid #9e6a03' },
  'export-result': { background: '#2a1c08', color: '#d29922', border: '1px solid #9e6a03' },
  'project-bundle': { background: '#0d2818', color: '#3fb950', border: '1px solid #238636' },
};

export function ImportModal({ onClose }: Props) {
  const { loadProject } = useProjectStore();
  const dirty = useProjectStore((s) => s.dirty);
  const resetChecklist = useEditorStore((s) => s.resetChecklist);
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [bundleResult, setBundleResult] = useState<ImportProjectResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setResult(null);
    setBundleResult(null);
    setImportError(null);
    setConfirmOverwrite(false);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const format = detectImportFormat(data);

        if (format === 'project-bundle') {
          const res = prepareProjectImport(data);
          if (!res.ok) {
            setImportError(res.error);
          } else {
            setBundleResult(res);
          }
          return;
        }

        const res = importProject(data);
        if (!res.success) {
          setImportError(res.message);
        } else {
          setResult(res);
        }
      } catch {
        setParseError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, []);

  const setImportFidelity = useEditorStore((s) => s.setImportFidelity);
  const setImportSnapshot = useEditorStore((s) => s.setImportSnapshot);
  const setProjectBundleSource = useEditorStore((s) => s.setProjectBundleSource);
  const setRightTab = useEditorStore((s) => s.setRightTab);

  const doImport = useCallback(() => {
    if (bundleResult) {
      loadProject(bundleResult.project);
      resetChecklist();
      setImportFidelity(buildFidelityReport([]), 'project-bundle');
      setImportSnapshot(structuredClone(bundleResult.project));
      setProjectBundleSource('imported');
      // Auto-switch to deps tab if the imported project has dependency issues
      const depReport = scanDependencies(bundleResult.project);
      if (depReport.summary.broken + depReport.summary.mismatched + depReport.summary.orphaned > 0) {
        setRightTab('deps');
      }
      onClose();
      return;
    }
    if (!result) return;
    loadProject(result.project);
    resetChecklist();
    setImportFidelity(result.fidelityReport, result.format);
    setImportSnapshot(structuredClone(result.project));
    setProjectBundleSource(null);
    // Auto-switch to deps tab if issues, otherwise import-summary for lossy formats
    const depReport = scanDependencies(result.project);
    if (depReport.summary.broken + depReport.summary.mismatched + depReport.summary.orphaned > 0) {
      setRightTab('deps');
    } else if (!result.lossless) {
      setRightTab('import-summary');
    }
    onClose();
  }, [result, bundleResult, loadProject, resetChecklist, setImportFidelity, setImportSnapshot, setProjectBundleSource, setRightTab, onClose]);

  const handleImport = useCallback(() => {
    if (dirty && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    doImport();
  }, [dirty, confirmOverwrite, doImport]);

  const hasResult = !!(result || bundleResult);
  const p = result?.project ?? bundleResult?.project;
  const deps = bundleResult ? extractDependencies(bundleResult.bundle) : null;

  return (
    <div style={MODAL_OVERLAY}>
      <div style={MODAL_CARD(480)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#c9d1d9', fontSize: 16 }}>Import Project</h2>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        {/* File picker */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => fileInput.current?.click()} style={btnStyle}>Choose File</button>
          {fileName && <span style={{ marginLeft: 8, color: '#8b949e', fontSize: 12 }}>{fileName}</span>}
          <input ref={fileInput} type="file" accept=".json,.wfproject.json" style={{ display: 'none' }} onChange={handleFile} />
        </div>

        {/* Error states */}
        {parseError && <div style={{ color: '#f85149', fontSize: 13, marginBottom: 12 }}>{parseError}</div>}
        {importError && <div style={{ color: '#f85149', fontSize: 13, marginBottom: 12 }}>{importError}</div>}

        {/* Standard format preview */}
        {result && p && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...badgeStyle, ...FORMAT_COLORS[result.format] }}>{FORMAT_LABELS[result.format]}</span>

            <div style={{ marginTop: 12, fontSize: 13, color: '#c9d1d9' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
              <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 8 }}>{p.description}</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#8b949e' }}>
                <span>Zones: {p.zones.length}</span>
                <span>Districts: {p.districts.length}</span>
                <span>Entities: {p.entityPlacements.length}</span>
                <span>Items: {p.itemPlacements.length}</span>
                <span>Dialogues: {p.dialogues.length}</span>
                <span>Trees: {p.progressionTrees.length}</span>
              </div>
            </div>

            {/* Dependency health */}
            <DepHealthPreview project={result.project} />

            {result.warnings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#d29922', marginBottom: 4 }}>
                  Warnings ({result.warnings.length})
                </div>
                <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, color: '#d29922' }}>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>{'\u2022'} {w}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Project bundle preview */}
        {bundleResult && p && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...badgeStyle, ...FORMAT_COLORS['project-bundle'] }}>{FORMAT_LABELS['project-bundle']}</span>

            <div style={{ marginTop: 12, fontSize: 13, color: '#c9d1d9' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{bundleResult.bundle.name}</div>
              {bundleResult.bundle.description && (
                <div style={{ color: '#8b949e', fontSize: 12, marginBottom: 4 }}>{bundleResult.bundle.description}</div>
              )}
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {bundleResult.bundle.mode && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#0d1d30', color: '#58a6ff', border: `1px solid ${ACTIVE_TAB_BG}` }}>
                    {bundleResult.bundle.mode}
                  </span>
                )}
                {bundleResult.bundle.genre && (
                  <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: '#21262d', color: '#8b949e', border: '1px solid #30363d' }}>
                    {bundleResult.bundle.genre}
                  </span>
                )}
              </div>

              {/* Summary counts from bundle */}
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: '#8b949e' }}>
                <span>Zones: {bundleResult.bundle.summary.zones}</span>
                <span>Districts: {bundleResult.bundle.summary.districts}</span>
                <span>Entities: {bundleResult.bundle.summary.entities}</span>
                <span>Items: {bundleResult.bundle.summary.items}</span>
                <span>Dialogues: {bundleResult.bundle.summary.dialogues}</span>
                <span>Spawns: {bundleResult.bundle.summary.spawns}</span>
              </div>
            </div>

            {/* Kit provenance */}
            {deps?.kitRef && (
              <div style={{ marginTop: 8, fontSize: 11, color: '#58a6ff' }}>
                Kit provenance: {deps.kitRef.name}
                {deps.kitRef.source && <span style={{ color: '#8b949e' }}> ({deps.kitRef.source})</span>}
              </div>
            )}

            {/* Asset packs */}
            {deps && deps.assetPacks.length > 0 && (
              <div style={{ marginTop: 4, fontSize: 11, color: '#8b949e' }}>
                Asset packs: {deps.assetPacks.map((p) => p.label).join(', ')}
              </div>
            )}

            {/* Exported timestamp */}
            {bundleResult.bundle.exportedAt && (
              <div style={{ marginTop: 4, fontSize: 10, color: '#484f58' }}>
                Exported: {new Date(bundleResult.bundle.exportedAt).toLocaleString()}
              </div>
            )}

            {/* Dependency health */}
            <DepHealthPreview project={bundleResult.project} />

            {/* Validation warnings */}
            {bundleResult.validationWarnings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#d29922', marginBottom: 4 }}>
                  Warnings ({bundleResult.validationWarnings.length})
                </div>
                <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, color: '#d29922' }}>
                  {bundleResult.validationWarnings.map((w, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>{'\u2022'} {w}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unsaved changes warning */}
        {confirmOverwrite && (
          <div style={{ padding: '8px 12px', borderRadius: 4, marginBottom: 12, background: '#2a1c08', border: '1px solid #9e6a03', fontSize: 12, color: '#d29922' }}>
            Your current project has unsaved changes. Import anyway?
          </div>
        )}

        {/* Import button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnStyle}>Cancel</button>
          <button
            onClick={handleImport}
            disabled={!hasResult}
            style={{
              ...btnStyle,
              background: hasResult ? (confirmOverwrite ? '#9e6a03' : '#238636') : '#21262d',
              color: hasResult ? '#fff' : '#484f58',
              cursor: hasResult ? 'pointer' : 'default',
            }}
          >
            {confirmOverwrite ? 'Confirm Import' : 'Import'}
          </button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e', fontSize: 18, cursor: 'pointer',
};

const badgeStyle: React.CSSProperties = {
  display: 'inline-block', fontSize: 11, borderRadius: 12, padding: '2px 10px', fontWeight: 600,
};

function DepHealthPreview({ project }: { project: import('@world-forge/schema').WorldProject }) {
  const report = scanDependencies(project);
  const { broken, mismatched, orphaned } = report.summary;
  const issues = broken + mismatched;

  if (issues === 0 && orphaned === 0) {
    return (
      <div style={{ marginTop: 8, fontSize: 11, color: '#3fb950' }}>
        Dependencies: all references resolved
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: '#8b949e' }}>
        Dependencies:{' '}
        {broken > 0 && <span style={{ color: '#f85149' }}>{broken} broken</span>}
        {broken > 0 && (mismatched > 0 || orphaned > 0) && ', '}
        {mismatched > 0 && <span style={{ color: '#d29922' }}>{mismatched} mismatched</span>}
        {mismatched > 0 && orphaned > 0 && ', '}
        {orphaned > 0 && <span style={{ color: '#8b949e' }}>{orphaned} orphaned</span>}
      </div>
      {issues > 0 && (
        <div style={{ marginTop: 4, fontSize: 10, color: '#d29922' }}>
          This project has broken references that can be repaired after import
        </div>
      )}
    </div>
  );
}
