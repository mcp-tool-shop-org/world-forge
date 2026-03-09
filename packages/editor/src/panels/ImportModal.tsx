// ImportModal.tsx — import WorldProject / ContentPack / ExportResult JSON

import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { importProject, detectImportFormat, type ImportResult, type ImportFormat } from '@world-forge/export-ai-rpg';

interface Props { onClose: () => void }

const FORMAT_LABELS: Record<ImportFormat, string> = {
  'world-project': 'WorldProject (lossless)',
  'content-pack': 'ContentPack (lossy)',
  'export-result': 'ExportResult (lossy)',
};

const FORMAT_COLORS: Record<ImportFormat, React.CSSProperties> = {
  'world-project': { background: '#0d2818', color: '#3fb950', border: '1px solid #238636' },
  'content-pack': { background: '#2a1c08', color: '#d29922', border: '1px solid #9e6a03' },
  'export-result': { background: '#2a1c08', color: '#d29922', border: '1px solid #9e6a03' },
};

export function ImportModal({ onClose }: Props) {
  const { loadProject } = useProjectStore();
  const resetChecklist = useEditorStore((s) => s.resetChecklist);
  const fileInput = useRef<HTMLInputElement>(null);

  const [fileName, setFileName] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [importError, setImportError] = useState<string | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setParseError(null);
    setResult(null);
    setImportError(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const res = importProject(data);
        if ('ok' in res) {
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
  const setRightTab = useEditorStore((s) => s.setRightTab);

  const handleImport = useCallback(() => {
    if (!result) return;
    loadProject(result.project);
    resetChecklist();
    // Store fidelity report and snapshot for import summary + diff panels
    setImportFidelity(result.fidelityReport, result.format);
    setImportSnapshot(structuredClone(result.project));
    // Auto-switch to import summary tab if lossy
    if (!result.lossless) {
      setRightTab('import-summary');
    }
    onClose();
  }, [result, loadProject, resetChecklist, setImportFidelity, setImportSnapshot, setRightTab, onClose]);

  const p = result?.project;

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#c9d1d9', fontSize: 16 }}>Import Project</h2>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {/* File picker */}
        <div style={{ marginBottom: 16 }}>
          <button onClick={() => fileInput.current?.click()} style={btnStyle}>Choose File</button>
          {fileName && <span style={{ marginLeft: 8, color: '#8b949e', fontSize: 12 }}>{fileName}</span>}
          <input ref={fileInput} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFile} />
        </div>

        {/* Error states */}
        {parseError && <div style={{ color: '#f85149', fontSize: 13, marginBottom: 12 }}>{parseError}</div>}
        {importError && <div style={{ color: '#f85149', fontSize: 13, marginBottom: 12 }}>{importError}</div>}

        {/* Preview */}
        {result && p && (
          <div style={{ marginBottom: 16 }}>
            {/* Format badge */}
            <span style={{ ...badgeStyle, ...FORMAT_COLORS[result.format] }}>{FORMAT_LABELS[result.format]}</span>

            {/* Content summary */}
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

            {/* Warnings */}
            {result.warnings.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, fontWeight: 600, color: '#d29922', marginBottom: 4 }}>
                  Warnings ({result.warnings.length})
                </div>
                <div style={{ maxHeight: 120, overflow: 'auto', fontSize: 11, color: '#d29922' }}>
                  {result.warnings.map((w, i) => (
                    <div key={i} style={{ marginBottom: 2 }}>• {w}</div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Import button */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnStyle}>Cancel</button>
          <button
            onClick={handleImport}
            disabled={!result}
            style={{
              ...btnStyle,
              background: result ? '#238636' : '#21262d',
              color: result ? '#fff' : '#484f58',
              cursor: result ? 'pointer' : 'default',
            }}
          >
            Import
          </button>
        </div>
      </div>
    </div>
  );
}

const overlayStyle: React.CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};

const cardStyle: React.CSSProperties = {
  background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
  padding: 24, width: 480, maxHeight: '80vh', overflow: 'auto',
};

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
