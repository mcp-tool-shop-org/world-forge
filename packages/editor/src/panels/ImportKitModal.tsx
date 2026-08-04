// ImportKitModal.tsx — import a .wfkit.json kit bundle

import { useState, useRef, useCallback, useEffect } from 'react';
import { useKitStore } from '../kits/index.js';
import { prepareKitImport } from '../kits/bundle.js';
import type { ImportKitResult } from '../kits/bundle.js';
import { countContent } from './TemplateManager.js';
import { ModalFrame } from '../ui/ModalFrame.js';
import { buttonBase, buttonPrimary, modalFooter } from '../ui/styles.js';
import { readerOutcomeMessage } from './import-kit-modal-helpers.js';

interface Props { onClose: () => void }

export function ImportKitModal({ onClose }: Props) {
  const fileInput = useRef<HTMLInputElement>(null);
  const { kits, importKit } = useKitStore();

  const [fileName, setFileName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ImportKitResult | null>(null);
  const [collision, setCollision] = useState<{ existingId: string; isBuiltIn: boolean } | null>(null);

  // F-005: mirrors ImportModal.tsx's ED-B-011 hardening — abort the previous
  // in-flight FileReader so back-to-back file picks can't resolve out of
  // order (a second, smaller kit resolving before a first, larger one would
  // otherwise silently win and overwrite `result`).
  const activeReaderRef = useRef<FileReader | null>(null);
  useEffect(() => () => {
    activeReaderRef.current?.abort();
    activeReaderRef.current = null;
  }, []);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (activeReaderRef.current) {
      try { activeReaderRef.current.abort(); } catch { /* ignore */ }
      activeReaderRef.current = null;
    }
    setFileName(file.name);
    setError(null);
    setResult(null);
    setCollision(null);

    const reader = new FileReader();
    activeReaderRef.current = reader;
    const clearActive = () => {
      if (activeReaderRef.current === reader) activeReaderRef.current = null;
    };
    reader.onload = () => {
      clearActive();
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
    // F-005: surface read errors/aborts instead of leaving the modal looking
    // stuck (fileName updates but result/error never populate).
    reader.onerror = () => {
      clearActive();
      setError(readerOutcomeMessage('error', false, reader.error?.message));
    };
    reader.onabort = () => {
      const supplanted = activeReaderRef.current !== reader;
      clearActive();
      const message = readerOutcomeMessage('abort', supplanted);
      if (message) setError(message);
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
    <ModalFrame title="Import Starter Kit" width={480} onClose={onClose}>

        {/* File picker */}
        <input ref={fileInput} type="file" accept=".wfkit.json,.json" onChange={handleFile} style={{ display: 'none' }} />
        <button onClick={() => fileInput.current?.click()} style={buttonBase}>
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
        <div style={modalFooter}>
          {result && result.isValid && collision && (
            <>
              <button onClick={handleImportAsCopy} style={buttonPrimary}>Import as Copy</button>
              {!collision.isBuiltIn && (
                <button onClick={handleReplace} style={{ ...buttonBase, color: 'var(--wf-warning)' }}>Replace Existing</button>
              )}
            </>
          )}
          {result && result.isValid && !collision && (
            <button onClick={handleImport} style={buttonPrimary}>Import</button>
          )}
          <button onClick={onClose} style={buttonBase}>Cancel</button>
        </div>
    </ModalFrame>
  );
}

const modeBadgeStyle: React.CSSProperties = {
  fontSize: 9, padding: '1px 6px', borderRadius: 4,
  background: '#21262d', color: '#8b949e', border: '1px solid #30363d',
};
