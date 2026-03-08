// ExportModal.tsx — export dialog with readiness summary

import { useState, useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { exportToEngine } from '@world-forge/export-ai-rpg';
import { validateProject } from '@world-forge/schema';

export function ExportModal({ onClose }: { onClose: () => void }) {
  const { project } = useProjectStore();
  const [status, setStatus] = useState<'idle' | 'valid' | 'invalid' | 'exported'>('idle');
  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  // Live readiness precheck
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
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
    }}>
      <div style={{ background: '#161b22', border: '1px solid #30363d', borderRadius: 8, padding: 20, width: 450, maxHeight: '80vh', overflow: 'auto' }}>
        <h3 style={{ margin: '0 0 12px', fontSize: 16 }}>Export to AI RPG Engine</h3>

        {/* Readiness banner */}
        {precheck.valid ? (
          <div style={{
            padding: '8px 12px', borderRadius: 4, marginBottom: 12,
            background: '#0d2818', border: '1px solid #238636', fontSize: 12, color: '#3fb950',
          }}>
            Ready to export — no issues found.
          </div>
        ) : (
          <div style={{
            padding: '8px 12px', borderRadius: 4, marginBottom: 12,
            background: '#2a1c08', border: '1px solid #9e6a03', fontSize: 12, color: '#d29922',
          }}>
            Not ready — {precheck.errors.length} issue{precheck.errors.length !== 1 ? 's' : ''} must be fixed first.
            <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
              {precheck.errors.slice(0, 3).map((e, i) => (
                <div key={i}>{e.message}</div>
              ))}
              {precheck.errors.length > 3 && (
                <div style={{ fontStyle: 'italic' }}>...and {precheck.errors.length - 3} more. See Issues tab.</div>
              )}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <button onClick={handleValidate} style={modalBtnStyle}>Validate</button>
          <button onClick={handleExport} style={{
            ...modalBtnStyle,
            background: precheck.valid ? '#238636' : '#21262d',
            color: precheck.valid ? '#fff' : '#484f58',
            cursor: precheck.valid ? 'pointer' : 'not-allowed',
            opacity: precheck.valid ? 1 : 0.6,
          }} disabled={!precheck.valid}>Export JSON</button>
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
      </div>
    </div>
  );
}

const modalBtnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 13,
};
