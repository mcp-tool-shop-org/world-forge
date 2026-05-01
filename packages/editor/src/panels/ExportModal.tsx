// ExportModal.tsx — export dialog with readiness summary and content overview

import { useState, useMemo, useEffect } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import {
  runEngineExport, runUnrealExport, runGodotExport,
  type ExportReceipt, type AiRpgExportOptions, type UnrealExportOptions, type GodotExportUIOptions,
  DEFAULT_AI_RPG_OPTIONS, DEFAULT_UNREAL_OPTIONS, DEFAULT_GODOT_OPTIONS,
} from './export-handlers.js';
import { validateProject, scanDependencies } from '@world-forge/schema';
import { classifyError, buildsSubTabFor } from './validation-helpers.js';
import { diffProjects } from '../diff/diff-model.js';
import { serializeProject, projectFilename } from '../projects/index.js';
import { buttonBase, buttonAccent, activeTabBg } from '../ui/styles.js';
import { useKitStore } from '../kits/index.js';
import { ModalFrame } from '../ui/ModalFrame.js';

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const kb = bytes / 1024;
  return kb < 1024 ? `${kb.toFixed(1)} KB` : `${(kb / 1024).toFixed(1)} MB`;
}

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
  const [receipts, setReceipts] = useState<ExportReceipt[]>([]);
  // 10B: Per-target export options
  const [aiRpgOpts, setAiRpgOpts] = useState<AiRpgExportOptions>({ ...DEFAULT_AI_RPG_OPTIONS });
  const [unrealOpts, setUnrealOpts] = useState<UnrealExportOptions>({ ...DEFAULT_UNREAL_OPTIONS });
  const [godotOpts, setGodotOpts] = useState<GodotExportUIOptions>({ ...DEFAULT_GODOT_OPTIONS });
  const [showOptions, setShowOptions] = useState(false);
  // ED-B-002: manual-download fallback anchor — populated after a successful
  // export so the user can click it if the synthetic download was blocked.
  const [fallback, setFallback] = useState<{ href: string; filename: string } | null>(null);

  // Revoke the fallback URL when it's cleared or the modal unmounts so we
  // don't leak object URLs across sessions.
  useEffect(() => {
    return () => {
      if (fallback?.href) {
        try { URL.revokeObjectURL(fallback.href); } catch { /* ignore */ }
      }
    };
  }, [fallback]);

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

  const addReceipt = (r: ExportReceipt) => setReceipts((prev) => [r, ...prev.filter((p) => p.target !== r.target)]);

  const handleExport = () => {
    setFallback(null);
    void runEngineExport(project, { setErrors, setWarnings, setStatus, markExported, setFallback, addReceipt }, undefined, aiRpgOpts);
  };

  const handleExportUnreal = () => {
    setFallback(null);
    void runUnrealExport(project, { setErrors, setWarnings, setStatus, markExported, setFallback, addReceipt }, undefined, unrealOpts);
  };

  const handleExportGodot = () => {
    setFallback(null);
    void runGodotExport(project, { setErrors, setWarnings, setStatus, markExported, setFallback, addReceipt }, undefined, godotOpts);
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

  // Pre-export advisories — surface engine-specific warnings before the user
  // clicks Export so they can fix issues proactively.
  const advisories = useMemo(() => {
    const items: string[] = [];
    if (project.entityPlacements.length === 0) {
      items.push('No entity placements — exported world will have no actors/NPCs.');
    }
    if (project.connections.length === 0 && project.zones.length > 1) {
      items.push('Multiple zones but no connections — engines cannot stream between them.');
    }
    if (project.zones.every((z) => z.elevation === undefined && z.elevationRange === undefined)) {
      items.push('No zone elevation authored — everything exports at Z=0 (flat).');
    }
    if (project.zones.every((z) => !z.parallaxLayers || z.parallaxLayers.length === 0)) {
      items.push('No parallax layers — UE5 2.5D backdrops will be bare.');
    }
    return items;
  }, [project]);

  // 10C: Per-target readiness with target-specific advisory counts
  const targetReadiness = useMemo(() => {
    const base = precheck.valid;
    const aiRpgAdvisories: string[] = [];
    const unrealAdvisories: string[] = [];
    const godotAdvisories: string[] = [];

    if (project.entityPlacements.length === 0) {
      aiRpgAdvisories.push('No entity placements');
      unrealAdvisories.push('No entity placements');
      godotAdvisories.push('No entity placements');
    }
    if (project.connections.length === 0 && project.zones.length > 1) {
      unrealAdvisories.push('No connections — cannot stream between zones');
      godotAdvisories.push('No connections — cannot generate transitions');
    }
    if (project.zones.every((z) => z.elevation === undefined && z.elevationRange === undefined)) {
      unrealAdvisories.push('No elevation — exports at Z=0 (flat)');
    }
    if (project.zones.every((z) => !z.parallaxLayers || z.parallaxLayers.length === 0)) {
      unrealAdvisories.push('No parallax layers — backdrops will be bare');
    }
    if (!project.playerTemplate) {
      aiRpgAdvisories.push('No player template — pack will lack player data');
    }

    return {
      aiRpg: { ready: base, advisories: aiRpgAdvisories },
      unreal: { ready: base, advisories: unrealAdvisories },
      godot: { ready: base, advisories: godotAdvisories },
    };
  }, [project, precheck.valid]);

  return (
    <ModalFrame title="Export" width={450} onClose={onClose}>

      {/* 10C: Per-target readiness */}
      {precheck.valid ? (
        <div style={{ padding: '8px 12px', borderRadius: 4, marginBottom: 12, background: '#0d2818', border: '1px solid #238636', fontSize: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {([
              { label: 'AI RPG', info: targetReadiness.aiRpg },
              { label: 'UE5', info: targetReadiness.unreal },
              { label: 'Godot', info: targetReadiness.godot },
            ] as const).map(({ label, info }) => (
              <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ color: '#3fb950' }}>{'\u2713'}</span>
                <span style={{ color: '#c9d1d9', fontWeight: 500, minWidth: 52 }}>{label}:</span>
                <span style={{ color: info.advisories.length > 0 ? '#d29922' : '#3fb950' }}>
                  {info.advisories.length > 0
                    ? `Ready with ${info.advisories.length} advisor${info.advisories.length !== 1 ? 'ies' : 'y'}`
                    : 'Ready'}
                </span>
              </div>
            ))}
          </div>
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
        // ED-A-015: Guard against a malformed diff (e.g. corrupt import snapshot
        // that yields no domain summaries). Without this, rendering would throw
        // when we iterate `diff.domains`.
        if (!diff || !diff.domains) return null;
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

      {/* ED-B-012: short help row so users can tell the export buttons apart
            without hovering for tooltips. */}
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 6, lineHeight: 1.4 }}>
        <div><strong style={{ color: '#c9d1d9' }}>Export JSON:</strong> generic AI-RPG-Engine pack.</div>
        <div><strong style={{ color: '#c9d1d9' }}>Export UE5:</strong> 2.5D-aware pack for Unreal Engine 5.</div>
        <div><strong style={{ color: '#c9d1d9' }}>Export Godot 4:</strong> .tscn scenes + resource pack for Godot.</div>
      </div>

      {/* 10B: Per-target export options */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setShowOptions(!showOptions)}
          style={{ ...buttonBase, fontSize: 11, padding: '3px 8px' }}
        >
          {showOptions ? '▾' : '▸'} Target Options
        </button>
        {showOptions && (
          <div style={{ marginTop: 8, padding: '8px 12px', borderRadius: 4, background: '#0d1117', border: '1px solid #30363d', fontSize: 11 }}>
            {/* AI RPG Options */}
            <div style={{ marginBottom: 8 }}>
              <div style={{ fontWeight: 600, color: '#3fb950', marginBottom: 4 }}>AI RPG</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', cursor: 'pointer', marginBottom: 2 }}>
                <input type="checkbox" checked={aiRpgOpts.includeFidelityReport} onChange={(e) => setAiRpgOpts({ ...aiRpgOpts, includeFidelityReport: e.target.checked })} />
                Include fidelity report
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', cursor: 'pointer', marginBottom: 2 }}>
                <input type="checkbox" checked={aiRpgOpts.includeBuildCatalog} onChange={(e) => setAiRpgOpts({ ...aiRpgOpts, includeBuildCatalog: e.target.checked })} />
                Include build catalog
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', cursor: 'pointer' }}>
                <input type="checkbox" checked={aiRpgOpts.includeDialogueProgression} onChange={(e) => setAiRpgOpts({ ...aiRpgOpts, includeDialogueProgression: e.target.checked })} />
                Include dialogue / progression
              </label>
            </div>
            {/* UE5 Options */}
            <div style={{ marginBottom: 8, borderTop: '1px solid #21262d', paddingTop: 8 }}>
              <div style={{ fontWeight: 600, color: '#58a6ff', marginBottom: 4 }}>Unreal Engine 5</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', marginBottom: 2 }}>
                <span style={{ minWidth: 90 }}>Tile size (cm):</span>
                <input
                  type="number" min={10} max={1000} step={10}
                  value={unrealOpts.tileSizeCm}
                  onChange={(e) => setUnrealOpts({ ...unrealOpts, tileSizeCm: Math.max(10, Number(e.target.value) || 100) })}
                  style={{ width: 60, background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: 3, padding: '1px 4px' }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', marginBottom: 2 }}>
                <span style={{ minWidth: 90 }}>Blueprint prefix:</span>
                <input
                  type="text"
                  value={unrealOpts.blueprintPathPrefix}
                  onChange={(e) => setUnrealOpts({ ...unrealOpts, blueprintPathPrefix: e.target.value })}
                  style={{ flex: 1, background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace', fontSize: 10 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', cursor: 'pointer', marginBottom: 2 }}>
                <input type="checkbox" checked={unrealOpts.includeStreamingHints} onChange={(e) => setUnrealOpts({ ...unrealOpts, includeStreamingHints: e.target.checked })} />
                Include streaming hints
              </label>
              <div style={{ fontSize: 10, color: '#484f58', fontStyle: 'italic' }}>Signing: disabled (CLI-only via --sign flag)</div>
            </div>
            {/* Godot Options */}
            <div style={{ borderTop: '1px solid #21262d', paddingTop: 8 }}>
              <div style={{ fontWeight: 600, color: '#478cbf', marginBottom: 4 }}>Godot 4</div>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', marginBottom: 2 }}>
                <span style={{ minWidth: 100 }}>Entity prefix:</span>
                <input
                  type="text"
                  value={godotOpts.entityScenePrefix}
                  onChange={(e) => setGodotOpts({ ...godotOpts, entityScenePrefix: e.target.value })}
                  style={{ flex: 1, background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace', fontSize: 10 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', marginBottom: 2 }}>
                <span style={{ minWidth: 100 }}>Transition prefix:</span>
                <input
                  type="text"
                  value={godotOpts.transitionScenePrefix}
                  onChange={(e) => setGodotOpts({ ...godotOpts, transitionScenePrefix: e.target.value })}
                  style={{ flex: 1, background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: 3, padding: '1px 4px', fontFamily: 'monospace', fontSize: 10 }}
                />
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', cursor: 'pointer', marginBottom: 2 }}>
                <input type="checkbox" checked={godotOpts.includeWorldTscn} onChange={(e) => setGodotOpts({ ...godotOpts, includeWorldTscn: e.target.checked })} />
                Include world .tscn
              </label>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#c9d1d9', cursor: 'pointer' }}>
                <span style={{ minWidth: 100 }}>Asset binding:</span>
                <select
                  value={godotOpts.assetBindingMode}
                  onChange={(e) => setGodotOpts({ ...godotOpts, assetBindingMode: e.target.value as 'manual' | 'manifest' })}
                  style={{ background: '#161b22', border: '1px solid #30363d', color: '#c9d1d9', borderRadius: 3, padding: '1px 4px', fontSize: 10 }}
                >
                  <option value="manifest">manifest</option>
                  <option value="manual">manual</option>
                </select>
              </label>
            </div>
          </div>
        )}
      </div>

      {/* Pre-export advisories */}
      {advisories.length > 0 && (
        <div style={{ padding: '8px 12px', borderRadius: 4, marginBottom: 12, background: '#2a1c08', border: '1px solid #9e6a03', fontSize: 11, color: '#d29922' }}>
          <div style={{ fontWeight: 600, marginBottom: 4, fontSize: 12 }}>Advisories</div>
          {advisories.map((a, i) => (
            <div key={i} style={{ padding: '1px 0' }}>{'\u26A0'} {a}</div>
          ))}
        </div>
      )}

      {/* Action buttons */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <button onClick={handleValidate} style={buttonBase}>Validate</button>
        <button onClick={handleExport} style={{
          ...buttonBase,
          background: precheck.valid ? 'var(--wf-success)' : 'var(--wf-bg-control)',
          color: precheck.valid ? '#fff' : 'var(--wf-text-hint)',
          cursor: precheck.valid ? 'pointer' : 'not-allowed',
          opacity: precheck.valid ? 1 : 0.6,
        }} disabled={!precheck.valid}>Export JSON</button>
        <button
          onClick={handleExportUnreal}
          title="Export a 2.5D-aware Unreal Engine 5 content pack"
          style={{
            ...buttonBase,
            background: precheck.valid ? 'var(--wf-accent)' : 'var(--wf-bg-control)',
            color: precheck.valid ? '#fff' : 'var(--wf-text-hint)',
            cursor: precheck.valid ? 'pointer' : 'not-allowed',
            opacity: precheck.valid ? 1 : 0.6,
          }}
          disabled={!precheck.valid}
        >
          Export Unreal Engine 5
        </button>
        <button
          onClick={handleExportGodot}
          title="Export a Godot 4 content pack with .tscn scenes"
          style={{
            ...buttonBase,
            background: precheck.valid ? '#478cbf' : 'var(--wf-bg-control)',
            color: precheck.valid ? '#fff' : 'var(--wf-text-hint)',
            cursor: precheck.valid ? 'pointer' : 'not-allowed',
            opacity: precheck.valid ? 1 : 0.6,
          }}
          disabled={!precheck.valid}
        >
          Export Godot 4
        </button>
        {!precheck.valid && precheck.errors.length > 0 && (
          <button onClick={handleGoToFirstIssue} style={buttonAccent}>Fix first issue</button>
        )}
        <button onClick={onClose} style={buttonBase}>Close</button>
      </div>

      {status === 'valid' && <div style={{ color: '#3fb950', fontSize: 13 }}>Validation passed!</div>}
      {status === 'exported' && (
        <div style={{ color: '#3fb950', fontSize: 13 }}>
          Download triggered {'\u2014'} check your browser's downloads.
          {fallback && (
            <>
              {' '}If nothing appears,{' '}
              <a
                href={fallback.href}
                download={fallback.filename}
                data-testid="wf-export-fallback-link"
                style={{ color: '#58a6ff', textDecoration: 'underline' }}
              >
                click here to save {fallback.filename}
              </a>
              .
            </>
          )}
        </div>
      )}

      {/* 10A: Export receipts */}
      {receipts.length > 0 && (
        <div style={{ marginTop: 12, padding: '8px 12px', borderRadius: 4, background: '#0d1117', border: '1px solid #30363d' }}>
          <div style={{ fontSize: 11, fontWeight: 600, color: '#c9d1d9', marginBottom: 6 }}>Export History</div>
          {receipts.map((r) => (
            <div key={r.target} style={{ fontSize: 11, color: '#8b949e', marginBottom: 8, paddingBottom: 8, borderBottom: '1px solid #21262d' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 2 }}>
                <span style={{ color: '#3fb950', fontWeight: 500 }}>
                  {'\u2713'} {r.target === 'ai-rpg' ? 'AI RPG' : r.target === 'unreal' ? 'UE5' : 'Godot 4'}
                </span>
                <span style={{ fontSize: 10 }}>{formatSize(r.sizeEstimate)}</span>
              </div>
              <div style={{ fontFamily: 'monospace', fontSize: 10, color: '#58a6ff', marginBottom: 2 }}>{r.filename}</div>
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                <span>{r.zones}z</span>
                <span>{r.entities}e</span>
                <span>{r.items}i</span>
                <span>{r.dialogues}d</span>
                <span>{r.trees}t</span>
                {r.warnings > 0 && <span style={{ color: '#d29922' }}>{r.warnings} warning{r.warnings !== 1 ? 's' : ''}</span>}
                <span style={{ color: r.fidelity === 'preserved' ? '#3fb950' : r.fidelity === 'approximated' ? '#d29922' : '#f85149' }}>
                  {r.fidelity}
                </span>
              </div>
            </div>
          ))}
        </div>
      )}

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
          // ED-B-010: if the project references a kit that has since been
          // deleted, make the provenance loss explicit rather than silently
          // dropping it. confirm() is blocking + built-in; good enough for
          // this edge case until we have a proper in-app dialog primitive.
          if (activeKitId && !activeKit) {
            const proceed = typeof window !== 'undefined' && typeof window.confirm === 'function'
              ? window.confirm('The active kit was deleted. Continue without kit provenance?')
              : true;
            if (!proceed) return;
          }
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
        }} style={{ ...buttonBase, background: activeTabBg, color: '#fff' }}>
          Export Project Bundle
        </button>
        {bundleExported && <span style={{ color: '#3fb950', fontSize: 12, marginLeft: 8 }}>Bundle saved!</span>}
        {/* FT-018: Multi-user documentation hint */}
        <div style={{ fontSize: 10, color: '#484f58', marginTop: 8, fontStyle: 'italic' }}>
          Projects are designed for single-author use. For team collaboration, consider versioning project files with Git.
        </div>
        {/* FT-033: Version tracking tip */}
        <div style={{ fontSize: 10, color: '#484f58', marginTop: 4, fontStyle: 'italic' }}>
          Tip: Use descriptive filenames with dates (e.g., &apos;my-world-2026-03-31.wfproject.json&apos;) for version tracking.
        </div>
      </div>
    </ModalFrame>
  );
}

