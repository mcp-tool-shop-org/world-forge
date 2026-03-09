// ImportKitModal.tsx — import a .wfkit.json kit bundle

import { useState, useRef, useCallback } from 'react';
import { useKitStore } from '../kits/index.js';
import { prepareKitImport } from '../kits/bundle.js';
import type { ImportKitResult } from '../kits/bundle.js';
import { countContent } from './TemplateManager.js';
import { MODAL_OVERLAY, MODAL_CARD } from './shared.js';

interface Props { onClose: () => void }

export function ImportKitModal({ onClose }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const { kits, importKit } = useKitStore();

  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportKitResult | null>(null);
  const [collision, setCollision] = useState<{ existingId: string; isBuiltIn: boolean } | null>(null);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setResult(null);
    setCollision(null);

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result as string);
        const res = prepareKitImport(data);
        if (!res.ok) {
          setError(res.error);
          return;
        }
        setResult(res);
        // Name collision check (case-insensitive)
        const existing = kits.find((k) => k.name.toLowerCase() === res.kit.name.toLowerCase());
        if (existing) {
          setCollision({ existingId: existing.id, isBuiltIn: existing.builtIn });
        }
      } catch {
        setError('Invalid JSON file');
      }
    };
    reader.readAsText(file);
  }, [kits]);

  const handleImportAsCopy = useCallback(() => {
    if (!result) return;
    const kit = { ...result.kit, name: `${result.kit.name} (imported)` };
    importKit(kit);
    onClose();
  }, [result, importKit, onClose]);

  const handleReplace = useCallback(() => {
    if (!result || !collision) return;
    importKit(result.kit, collision.existingId);
    onClose();
  }, [result, collision, importKit, onClose]);

  const handleImport = useCallback(() => {
    if (!result) return;
    importKit(result.kit);
    onClose();
  }, [result, importKit, onClose]);

  const c = result ? countContent(result.kit.project) : null;
  const allWarnings = result
    ? [...result.parseWarnings, ...result.validationWarnings]
    : [];

  return (
    <div style={MODAL_OVERLAY}>
      <div style={MODAL_CARD(480)}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <h3 style={{ margin: 0, color: '#e6edf3' }}>Import Starter Kit</h3>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        {/* File picker */}
        <input ref={fileInput} type="file" accept=".wfkit.json,.json" onChange={handleFile} style={{ display: 'none' }} />
        <button onClick={() => fileInput.current?.click()} style={btnStyle}>
          {fileName || 'Choose .wfkit.json file\u2026'}
        </button>

        {/* Error */}
        {error && (
          <div style={{ marginTop: 12, padding: 8, background: '#3d1418', border: '1px solid #f85149', borderRadius: 4, color: '#f85149', fontSize: 12 }}>
            {error}
          </div>
        )}

        {/* Validation errors */}
        {result && result.validationErrors.length > 0 && (
          <div style={{ marginTop: 12, padding: 8, background: '#3d1418', border: '1px solid #f85149', borderRadius: 4, color: '#f85149', fontSize: 12 }}>
            <strong>Validation errors:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              {result.validationErrors.map((e, i) => <li key={i}>{e}</li>)}
            </ul>
          </div>
        )}

        {/* Preview */}
        {result && result.isValid && c && (
          <div style={{ marginTop: 12, padding: 10, background: '#0d1117', border: '1px solid #30363d', borderRadius: 4 }}>
            <div style={{ fontWeight: 600, color: '#e6edf3', marginBottom: 4 }}>
              {result.kit.icon} {result.kit.name}
            </div>
            {result.kit.description && (
              <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6 }}>{result.kit.description}</div>
            )}
            <div style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginBottom: 6 }}>
              {result.kit.modes.map((m) => (
                <span key={m} style={modeBadgeStyle}>{m}</span>
              ))}
            </div>
            <div style={{ fontSize: 10, color: '#484f58' }}>
              {c.zones} zones &middot; {c.entities} entities &middot; {c.dialogues} dialogues &middot; {c.trees} trees &middot; {c.items} items
            </div>
          </div>
        )}

        {/* Warnings */}
        {allWarnings.length > 0 && (
          <div style={{ marginTop: 8, padding: 8, background: '#2a1c08', border: '1px solid #9e6a03', borderRadius: 4, color: '#d29922', fontSize: 11 }}>
            <strong>Warnings:</strong>
            <ul style={{ margin: '4px 0 0', paddingLeft: 16 }}>
              {allWarnings.map((w, i) => <li key={i}>{w}</li>)}
            </ul>
          </div>
        )}

        {/* Collision UI */}
        {result && result.isValid && collision && (
          <div style={{ marginTop: 12, padding: 10, background: '#1c1917', border: '1px solid #9e6a03', borderRadius: 4, color: '#d29922', fontSize: 12 }}>
            A kit named &ldquo;{result.kit.name}&rdquo; already exists.
          </div>
        )}

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, marginTop: 16, justifyContent: 'flex-end' }}>
          {result && result.isValid && collision && (
            <>
              <button onClick={handleImportAsCopy} style={importBtnStyle}>Import as Copy</button>
              {!collision.isBuiltIn && (
                <button onClick={handleReplace} style={{ ...btnStyle, color: '#d29922' }}>Replace Existing</button>
              )}
            </>
          )}
          {result && result.isValid && !collision && (
            <button onClick={handleImport} style={importBtnStyle}>Import</button>
          )}
          <button onClick={onClose} style={btnStyle}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
};

const importBtnStyle: React.CSSProperties = {
  background: '#238636', color: '#fff', border: '1px solid #238636',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 12, fontWeight: 600,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e', fontSize: 18, cursor: 'pointer',
};

const modeBadgeStyle: React.CSSProperties = {
  fontSize: 9, padding: '1px 6px', borderRadius: 4,
  background: '#21262d', color: '#8b949e', border: '1px solid #30363d',
};
