// ImportModal.tsx — import WorldProject / ContentPack / ExportResult / ProjectBundle JSON

import { useState, useRef, useCallback, useEffect } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { importProject, detectImportFormat, type ImportResult, type ImportFormat } from '@world-forge/export-ai-rpg';
import { buildFidelityReport } from '@world-forge/export-ai-rpg';
import { prepareProjectImport, extractDependencies, type ImportProjectResult } from '../projects/index.js';
import { scanDependencies } from '@world-forge/schema';
import { activeTabBg as ACTIVE_TAB_BG } from '../ui/styles.js';
import { ModalFrame } from '../ui/ModalFrame.js';
import { buttonBase, modalFooter } from '../ui/styles.js';
import { applyBundleImport, canConfirmImport, distinctBundleWarnings, jsonFileParseError, safeExtractDependencies } from './import-modal-helpers.js';

interface Props { onClose: () => void }

const FORMAT_LABELS: Record<ImportFormat, string> = {
  'world-project': 'WorldProject (lossless)',
  'content-pack': 'ContentPack (lossy)',
  'export-result': 'ExportResult (lossy)',
  'project-bundle': 'ProjectBundle (lossless)',
};

const FORMAT_COLORS: Record<ImportFormat, React.CSSProperties> = {
  'world-project': { background: 'color-mix(in srgb, var(--wf-success) 18%, var(--wf-bg-panel))', color: 'var(--wf-success-text)', border: '1px solid var(--wf-success)' },
  'content-pack': { background: 'color-mix(in srgb, var(--wf-warning) 18%, var(--wf-bg-panel))', color: 'var(--wf-warning)', border: '1px solid var(--wf-warning)' },
  'export-result': { background: 'color-mix(in srgb, var(--wf-warning) 18%, var(--wf-bg-panel))', color: 'var(--wf-warning)', border: '1px solid var(--wf-warning)' },
  'project-bundle': { background: 'color-mix(in srgb, var(--wf-success) 18%, var(--wf-bg-panel))', color: 'var(--wf-success-text)', border: '1px solid var(--wf-success)' },
};

export function ImportModal({ onClose }: Props) {
  const { loadProject } = useProjectStore();
  const dirty = useProjectStore((s) => s.dirty);
  const resetChecklist = useEditorStore((s) => s.resetChecklist);
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [reading, setReading] = useState(false);
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [bundleResult, setBundleResult] = useState<ImportProjectResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const [confirmOverwrite, setConfirmOverwrite] = useState(false);

  // ED-B-011: abort the previous in-flight FileReader so back-to-back file
  // picks can't resolve out of order (e.g. first file is 50 MB and resolves
  // AFTER a second, smaller file, clobbering the correct result).
  const activeReaderRef = useRef<FileReader | null>(null);
  useEffect(() => () => {
    activeReaderRef.current?.abort();
    activeReaderRef.current = null;
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // F-ca164509: reset so the same path can be re-picked after an edit/error.
    e.target.value = '';
    if (!file) return;
    // ED-B-011: abort any previous read + fully reset file-read state before
    // starting a new one.
    if (activeReaderRef.current) {
      try { activeReaderRef.current.abort(); } catch { /* ignore */ }
      activeReaderRef.current = null;
    }
    setFileName(file.name);
    setReading(true);
    setParseError(null);
    setResult(null);
    setBundleResult(null);
    setImportError(null);
    setConfirmOverwrite(false);

    const reader = new FileReader();
    activeReaderRef.current = reader;
    const clearActive = () => {
      if (activeReaderRef.current === reader) activeReaderRef.current = null;
    };
    reader.onload = () => {
      clearActive();
      setReading(false);
      try {
        if (reader.result == null || typeof reader.result !== 'string') {
          setParseError('Could not read file \u2014 please try a different file.');
          return;
        }
        const data = JSON.parse(reader.result);
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
      } catch (err) {
        setParseError(jsonFileParseError(err, file.name));
      }
    };
    // EU-003: Handle FileReader error and abort events
    reader.onerror = () => {
      clearActive();
      setReading(false);
      setParseError(`Failed to read file: ${reader.error?.message ?? 'unknown error'}`);
    };
    reader.onabort = () => {
      // ED-B-011: if we were intentionally replaced (new file picked) the
      // activeReaderRef already points elsewhere — stay silent. Only surface
      // "aborted" if this was the reader the UI was waiting on.
      const supplanted = activeReaderRef.current !== reader;
      clearActive();
      if (!supplanted) {
        setReading(false);
        setParseError('File reading was aborted.');
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
      // F-f6081e61: refuse schema-invalid bundles (isValid:false) — do not loadProject.
      if (!applyBundleImport(bundleResult, loadProject)) return;
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
    if (!canConfirmImport({ result, bundleResult })) return;
    if (dirty && !confirmOverwrite) {
      setConfirmOverwrite(true);
      return;
    }
    doImport();
  }, [dirty, confirmOverwrite, doImport, result, bundleResult]);

  const importEnabled = canConfirmImport({ result, bundleResult });
  const p = result?.project ?? bundleResult?.project;
  const deps = bundleResult ? safeExtractDependencies(extractDependencies, bundleResult.bundle) : null;
  const bundleWarnings = bundleResult ? distinctBundleWarnings(bundleResult) : null;

  return (
    <ModalFrame title="Import Project" width={480} onClose={onClose}>
      <div aria-busy={reading || undefined}>

        {/* File picker */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => fileInput.current?.click()} style={buttonBase} disabled={reading}>
            {reading ? `Reading ${fileName}…` : 'Choose File'}
          </button>
          {fileName && !reading && <span style={{ marginLeft: 8, color: 'var(--wf-text-muted)', fontSize: 12 }}>{fileName}</span>}
          <input ref={fileInput} type="file" accept=".json,.wfproject.json" style={{ display: 'none' }} onChange={handleFile} disabled={reading} />
        </div>

        {/* Error states */}
        {parseError && <div role="alert" aria-live="assertive" style={{ color: 'var(--wf-danger-text)', fontSize: 13, marginBottom: 12 }}>{parseError}</div>}
        {importError && <div role="alert" aria-live="assertive" style={{ color: 'var(--wf-danger-text)', fontSize: 13, marginBottom: 12 }}>{importError}</div>}

        {/* Standard format preview */}
        {result && p && (
          <div style={{ marginBottom: 16 }}>
            <span style={{ ...badgeStyle, ...FORMAT_COLORS[result.format] }}>{FORMAT_LABELS[result.format]}</span>

            <div style={{ marginTop: 12, fontSize: 13, color: 'var(--wf-text-primary)' }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>{p.name}</div>
              <div style={{ color: 'var(--wf-text-muted)', fontSize: 12, marginBottom: 8 }}>{p.description}</div>
              <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--wf-text-muted)' }}>
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
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--wf-warning)', marginBottom: 4 }}>
                  Warnings ({result.warnings.length})
                </div>
                <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, color: 'var(--wf-warning)' }}>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>{'\u2022'} {w}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Project bundle — preview only when valid (mirrors ImportKitModal) */}
        {bundleResult && (
          <div style={{ marginBottom: 16 }}>
            {bundleResult.isValid && p && (
              <>
                <span style={{ ...badgeStyle, ...FORMAT_COLORS['project-bundle'] }}>{FORMAT_LABELS['project-bundle']}</span>

                <div style={{ marginTop: 12, fontSize: 13, color: 'var(--wf-text-primary)' }}>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{bundleResult.bundle.name}</div>
                  {bundleResult.bundle.description && (
                    <div style={{ color: 'var(--wf-text-muted)', fontSize: 12, marginBottom: 4 }}>{bundleResult.bundle.description}</div>
                  )}
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                    {bundleResult.bundle.mode && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'color-mix(in srgb, var(--wf-accent) 18%, var(--wf-bg-panel))', color: 'var(--wf-accent)', border: `1px solid ${ACTIVE_TAB_BG}` }}>
                        {bundleResult.bundle.mode}
                      </span>
                    )}
                    {bundleResult.bundle.genre && (
                      <span style={{ fontSize: 10, padding: '1px 6px', borderRadius: 4, background: 'var(--wf-bg-control)', color: 'var(--wf-text-muted)', border: '1px solid var(--wf-border-default)' }}>
                        {bundleResult.bundle.genre}
                      </span>
                    )}
                  </div>

                  <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', fontSize: 12, color: 'var(--wf-text-muted)' }}>
                    <span>Zones: {bundleResult.bundle.summary.zones}</span>
                    <span>Districts: {bundleResult.bundle.summary.districts}</span>
                    <span>Entities: {bundleResult.bundle.summary.entities}</span>
                    <span>Items: {bundleResult.bundle.summary.items}</span>
                    <span>Dialogues: {bundleResult.bundle.summary.dialogues}</span>
                    <span>Spawns: {bundleResult.bundle.summary.spawns}</span>
                  </div>
                </div>

                {deps?.kitRef && (
                  <div style={{ marginTop: 8, fontSize: 11, color: 'var(--wf-accent)' }}>
                    Kit provenance: {deps.kitRef.name}
                    {deps.kitRef.source && <span style={{ color: 'var(--wf-text-muted)' }}> ({deps.kitRef.source})</span>}
                  </div>
                )}

                {deps && deps.assetPacks.length > 0 && (
                  <div style={{ marginTop: 4, fontSize: 11, color: 'var(--wf-text-muted)' }}>
                    Asset packs: {deps.assetPacks.map((pack) => pack.label).join(', ')}
                  </div>
                )}

                {bundleResult.bundle.exportedAt && (
                  <div style={{ marginTop: 4, fontSize: 10, color: 'var(--wf-text-muted)' }}>
                    Exported: {new Date(bundleResult.bundle.exportedAt).toLocaleString()}
                  </div>
                )}

                <DepHealthPreview project={bundleResult.project} />
              </>
            )}

            {/* Validation errors — F-f6081e61: these are blocking, not warnings */}
            {bundleResult.validationErrors.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--wf-danger-text)', marginBottom: 4 }}>
                  Errors ({bundleResult.validationErrors.length})
                </div>
                <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, color: 'var(--wf-danger-text)' }}>
                  {bundleResult.validationErrors.map((err, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>{'\u2022'} {err}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Parse warnings (envelope), kept separate from validation errors */}
            {bundleWarnings && bundleWarnings.parseWarnings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--wf-warning)', marginBottom: 4 }}>
                  Parse warnings ({bundleWarnings.parseWarnings.length})
                </div>
                <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, color: 'var(--wf-warning)' }}>
                  {bundleWarnings.parseWarnings.map((w, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>{'\u2022'} {w}</div>
                  ))}
                </div>
              </div>
            )}

            {/* Validation warnings that are not also listed as errors */}
            {bundleWarnings && bundleWarnings.validationWarnings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: 'var(--wf-warning)', marginBottom: 4 }}>
                  Warnings ({bundleWarnings.validationWarnings.length})
                </div>
                <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, color: 'var(--wf-warning)' }}>
                  {bundleWarnings.validationWarnings.map((w, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>{'\u2022'} {w}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Unsaved changes warning */}
        {confirmOverwrite && (
          <div style={{ padding: '8px 12px', borderRadius: 4, marginBottom: 12, background: 'color-mix(in srgb, var(--wf-warning) 18%, var(--wf-bg-panel))', border: '1px solid var(--wf-warning)', fontSize: 12, color: 'var(--wf-warning)' }}>
            Your current project has unsaved changes. Import anyway?
          </div>
        )}

        {/* Import button */}
        <div style={modalFooter}>
          <button onClick={onClose} style={buttonBase}>Cancel</button>
          <button
            onClick={handleImport}
            disabled={!importEnabled || reading}
            style={{
              ...buttonBase,
              background: importEnabled && !reading ? (confirmOverwrite ? 'var(--wf-warning)' : 'var(--wf-success)') : 'var(--wf-bg-control)',
              color: importEnabled && !reading ? '#fff' : 'var(--wf-text-hint)',
              cursor: importEnabled && !reading ? 'pointer' : 'default',
              border: 'none',
            }}
          >
            {confirmOverwrite ? 'Confirm Import' : 'Import'}
          </button>
        </div>
      </div>
    </ModalFrame>
  );
}

const badgeStyle: React.CSSProperties = {
  display: 'inline-block', fontSize: 11, borderRadius: 12, padding: '2px 10px', fontWeight: 600,
};

function DepHealthPreview({ project }: { project: import('@world-forge/schema').WorldProject }) {
  const report = scanDependencies(project);
  const { broken, mismatched, orphaned } = report.summary;
  const issues = broken + mismatched;

  if (issues === 0 && orphaned === 0) {
    return (
      <div style={{ marginTop: 8, fontSize: 11, color: 'var(--wf-success-text)' }}>
        Dependencies: all references resolved
      </div>
    );
  }

  return (
    <div style={{ marginTop: 8 }}>
      <div style={{ fontSize: 11, color: 'var(--wf-text-muted)' }}>
        Dependencies:{' '}
        {broken > 0 && <span style={{ color: 'var(--wf-danger-text)' }}>{broken} broken</span>}
        {broken > 0 && (mismatched > 0 || orphaned > 0) && ', '}
        {mismatched > 0 && <span style={{ color: 'var(--wf-warning)' }}>{mismatched} mismatched</span>}
        {mismatched > 0 && orphaned > 0 && ', '}
        {orphaned > 0 && <span style={{ color: 'var(--wf-text-muted)' }}>{orphaned} orphaned</span>}
      </div>
      {issues > 0 && (
        <div style={{ marginTop: 4, fontSize: 10, color: 'var(--wf-warning)' }}>
          This project has broken references that can be repaired after import
        </div>
      )}
    </div>
  );
}
