// App.tsx — editor layout shell

import { useState, useRef, useCallback, useEffect, useMemo } from 'react';
import {
  useProjectStore,
  getLastAutoSaveError, clearLastAutoSaveError, getAutoSaveHealth,
  attemptCrashRecovery,
  startAutoSave, stopAutoSave,
  flushAutoSaveIfDirty,
  AUTOSAVE_SAVE_HINT,
} from './store/project-store.js';
import { saveProjectFile } from './save-project.js';
import { resetFileInput } from './file-load.js';
import { validateProject } from '@world-forge/schema';
import { useEditorStore, getSelectedZoneId, getSelectionCount, type RightTab } from './store/editor-store.js';
import { ToastHost, pushToast } from './ui/Toast.js';
import { useModalStore } from './store/modal-store.js';
import { ToolPalette } from './panels/ToolPalette.js';
import { TilePalette } from './panels/TilePalette.js';
import { PropPalette } from './panels/PropPalette.js';
import { ZoneProperties } from './panels/ZoneProperties.js';
import { EconomyPanel } from './panels/EconomyPanel.js';
import { TownStructuresPanel } from './panels/TownStructuresPanel.js';
import { StrataPanel } from './panels/StrataPanel.js';
import { HazardLibraryPanel } from './panels/HazardLibraryPanel.js';
import { DistrictPanel } from './panels/DistrictPanel.js';
import { EntityProperties } from './panels/EntityProperties.js';
import { SelectionActionsPanel } from './panels/SelectionActionsPanel.js';
import { ConnectionProperties } from './panels/ConnectionProperties.js';
import { EncounterProperties } from './panels/EncounterProperties.js';
import { LandmarkProperties } from './LandmarkProperties.js';
import { SpawnProperties } from './SpawnProperties.js';
import { ValidationPanel, useIssueCount } from './panels/ValidationPanel.js';
import { PlayerTemplatePanel } from './panels/PlayerTemplatePanel.js';
import { BuildCatalogPanel } from './panels/BuildCatalogPanel.js';
import { ProgressionPanel } from './panels/ProgressionPanel.js';
import { DialoguePanel } from './panels/DialoguePanel.js';
import { ChecklistPanel } from './panels/ChecklistPanel.js';
import { ImportSummaryPanel } from './panels/ImportSummaryPanel.js';
import { DiffPanel } from './panels/DiffPanel.js';
import { AssetPanel } from './panels/AssetPanel.js';
import { ObjectListPanel } from './panels/ObjectListPanel.js';
import { PresetBrowser } from './panels/PresetBrowser.js';
import { SpeedPanel } from './panels/SpeedPanel.js';
import { DependencyPanel, useDependencyCount } from './panels/DependencyPanel.js';
import { ReviewPanel } from './panels/ReviewPanel.js';
import { ModalLayer } from './panels/ModalLayer.js';
import { Canvas } from './Canvas.js';
import { getModeProfile } from './mode-profiles.js';
import { confirmDiscard } from './modal-guards.js';
import { buttonBase, buttonPrimary, toolbarRow } from './ui/styles.js';
import { SAMPLE_WORLDS } from './templates/samples.js';

/** FT-030: persisted theme, else prefers-color-scheme, else dark. */
export function getInitialTheme(): 'dark' | 'light' {
  try {
    const stored = localStorage.getItem('wf-theme');
    if (stored === 'light' || stored === 'dark') return stored;
  } catch { /* ignore */ }
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      if (window.matchMedia('(prefers-color-scheme: light)').matches) return 'light';
    } catch { /* ignore */ }
  }
  return 'dark';
}

export function App() {
  const { project, dirty, loadProject, markClean, undo, redo, getUndoCount, getRedoCount, getUndoLabel, getRedoLabel } = useProjectStore();
  const { activeTool, selection, selectedConnection, rightTab, setRightTab, viewport, checklistDismissed, showSpeedPanel, showMinimap } = useEditorStore();
  const selectedZoneId = getSelectedZoneId(selection);
  const selectionCount = getSelectionCount(selection);
  const importFidelity = useEditorStore((s) => s.importFidelity);
  const importSnapshot = useEditorStore((s) => s.importSnapshot);
  const openModal = useModalStore((s) => s.openModal);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const [fileError, setFileError] = useState<string | null>(null);
  const [fileLoading, setFileLoading] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveMenuOpen, setSaveMenuOpen] = useState(false);
  const savingRef = useRef(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const issueCount = useIssueCount();
  const depsCount = useDependencyCount();

  // FT-030: Theme toggle state
  const [theme, setTheme] = useState<'dark' | 'light'>(getInitialTheme);
  useEffect(() => {
    document.body.classList.toggle('light', theme === 'light');
    document.body.classList.toggle('dark', theme === 'dark');
    document.documentElement.classList.toggle('light', theme === 'light');
    document.documentElement.classList.toggle('dark', theme === 'dark');
    try { localStorage.setItem('wf-theme', theme); } catch { /* ignore */ }
  }, [theme]);

  // FT-022: Validation toast when issues are resolved — F-2fc5e0ad: one live region.
  const prevIssueCount = useRef(issueCount);
  useEffect(() => {
    if (prevIssueCount.current > 0 && issueCount < prevIssueCount.current) {
      pushToast('Issue resolved \u2713', 'success', 2000);
    }
    prevIssueCount.current = issueCount;
  }, [issueCount]);

  // FT-001: Start auto-save timer on mount; check for crash recovery.
  // F-b7d3a887: the recover-then-clear decision lives in attemptCrashRecovery
  // (project-store.ts) — it only deletes the autosave AFTER the recovered
  // snapshot is confirmed loadable, so a corrupted/legacy-schema snapshot
  // that fails to load survives instead of being destroyed in the same tick
  // the failed load is discovered.
  useEffect(() => {
    const outcome = attemptCrashRecovery();
    if (outcome.attempted) {
      if (outcome.loaded) {
        pushToast('Recovered unsaved project from last session', 'success', 4000);
      } else {
        pushToast(
          'Could not recover the last session — the autosave looked corrupted and was left in place for troubleshooting.',
          'error', 6000,
        );
      }
    }
    startAutoSave();
    return () => stopAutoSave();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // FT-002: warn on unsaved changes before closing
  useEffect(() => {
    const handler = (e: BeforeUnloadEvent) => {
      if (!dirty) return;
      e.preventDefault();
      // Legacy browsers need returnValue set
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [dirty]);

  // F-e6f1b71a: flush the crash-recovery slot on hide/quit. Timers freeze
  // when a mobile browser backgrounds; beforeunload is only a prompt.
  useEffect(() => {
    const onPageHide = () => { flushAutoSaveIfDirty(); };
    const onVisibility = () => { if (document.hidden) flushAutoSaveIfDirty(); };
    window.addEventListener('pagehide', onPageHide);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('pagehide', onPageHide);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  // ED-B-001 + ED-B-008: poll the auto-save health + error getters each tick so the
  // non-intrusive banner below can surface silent quota failures and oversize
  // auto-save suspensions. A 3-second poll keeps the banner responsive without
  // adding a zustand subscription for what is a rarely-changing diagnostic.
  const [autoSaveErr, setAutoSaveErr] = useState<string | null>(getLastAutoSaveError());
  const [autoSaveHealth, setAutoSaveHealth] = useState(() => getAutoSaveHealth());
  useEffect(() => {
    const id = setInterval(() => {
      setAutoSaveErr(getLastAutoSaveError());
      setAutoSaveHealth(getAutoSaveHealth());
    }, 3000);
    return () => clearInterval(id);
  }, []);

  const losslessPct = importFidelity?.summary.losslessPercent;

  const tabs: { id: RightTab; label: string; badge?: string; badgeColor?: string; badgeFg?: string }[] = [
    { id: 'map', label: 'Map' },
    { id: 'player', label: 'Player' },
    { id: 'builds', label: 'Builds' },
    { id: 'trees', label: 'Trees' },
    { id: 'dialogue', label: 'Dialogue' },
    { id: 'objects', label: 'Objects' },
    { id: 'presets', label: 'Presets' },
    { id: 'assets', label: 'Assets', badge: (project.assets?.length ?? 0) > 0 ? `${project.assets!.length}` : undefined },
    { id: 'issues', label: 'Issues' },
    { id: 'deps', label: 'Deps', badge: depsCount > 0 ? `${depsCount}` : undefined, badgeColor: 'var(--wf-warning)', badgeFg: 'var(--wf-on-warning)' },
    { id: 'review', label: 'Review' },
    ...(!checklistDismissed ? [{ id: 'guide' as RightTab, label: 'Guide' }] : []),
    ...(importFidelity ? [{ id: 'import-summary' as RightTab, label: 'Import', badge: `${losslessPct}%`, badgeColor: losslessPct === 100 ? 'var(--wf-success)' : 'var(--wf-warning)', badgeFg: losslessPct === 100 ? 'var(--wf-on-success)' : 'var(--wf-on-warning)' }] : []),
    ...(importSnapshot ? [{ id: 'diff' as RightTab, label: 'Diff' }] : []),
  ];

  const handleLoad = useCallback(() => {
    if (dirty && !confirmDiscard()) return;
    fileInput.current?.click();
  }, [dirty]);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    // F-5c713675: always clear so choosing the same .json again fires onChange
    // (success, parse error, and empty-file paths).
    resetFileInput(e.target);
    if (!file) return;
    setFileError(null);
    setFileLoading(`Reading ${file.name}\u2026`);
    const reader = new FileReader();
    const clearLoading = () => setFileLoading(null);
    reader.onloadstart = () => setFileLoading(`Reading ${file.name}\u2026`);
    reader.onload = () => {
      clearLoading();
      const raw = reader.result;
      try {
        const p = JSON.parse(raw as string);
        // EU-010 / F-b7d3a887: loadProject() now structurally normalizes the
        // incoming project (backfilling every array/object field it expects)
        // and reports failure via its boolean return instead of throwing —
        // a rejected load leaves the current project untouched. The
        // try/catch stays as a defensive backstop for anything unexpected.
        try {
          const ok = loadProject(p);
          if (!ok) {
            setFileError('Failed to load project: the file does not look like a World Forge project (expected a JSON object with project fields).');
          } else {
            const validation = validateProject(useProjectStore.getState().project);
            if (!validation.valid) {
              pushToast(
                `Loaded with ${validation.errors.length} validation issue${validation.errors.length === 1 ? '' : 's'} — see the Issues tab.`,
                'warning', 5000,
              );
            }
          }
        } catch (loadErr) {
          setFileError(`Failed to load project: ${loadErr instanceof Error ? loadErr.message : String(loadErr)}`);
        }
      } catch (parseErr) {
        // EUB-001: log first 200 chars of file content for debugging
        console.warn('[WorldForge] JSON parse failed. File starts with:', typeof raw === 'string' ? raw.slice(0, 200) : '(non-string)');
        // EUB-010: log stack trace for debugging
        console.error('[WorldForge] Parse error:', parseErr);
        setFileError('Invalid project JSON — the file could not be parsed.');
      }
    };
    // EU-002: Handle FileReader error and abort events
    reader.onerror = () => {
      // EUB-002: log full reader.error for debugging
      console.error('[WorldForge] FileReader error:', reader.error);
      clearLoading();
      setFileError(`Failed to read file: ${reader.error?.message ?? 'unknown error'}`);
    };
    reader.onabort = () => {
      clearLoading();
      setFileError('File reading was aborted.');
    };
    reader.readAsText(file);
  }, [loadProject]);

  const handleSave = useCallback(() => {
    // F-579225c9: ignore a second click while a picker/download is in flight.
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    // F-95295187: never markClean/clearAutoSave until the write is confirmed.
    void saveProjectFile(project, { markClean, toast: pushToast }).finally(() => {
      savingRef.current = false;
      setSaving(false);
    });
  }, [project, markClean]);

  const handleOpenSample = useCallback(() => {
    if (dirty && !confirmDiscard()) return;
    loadProject(SAMPLE_WORLDS[0].project);
  }, [dirty, loadProject]);

  useEffect(() => {
    if (!saveMenuOpen) return;
    const close = () => setSaveMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [saveMenuOpen]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar — F-4ba7e396: toolbarRow + layout tokens; Save menu; wrap; pin Export. */}
      <div style={toolbarRow}>
        <img src="/mark.svg" alt="World Forge" width={24} height={24} style={{ height: 24, width: 24 }} />
        <strong style={{ color: 'var(--wf-accent)' }}>World Forge</strong>
        <span style={{ color: 'var(--wf-text-muted)', fontSize: 12 }}>
          {project.name}
          {dirty && (
            <span
              title="Unsaved changes"
              aria-label="Unsaved changes"
              role="status"
              style={{
                display: 'inline-block', width: 8, height: 8, borderRadius: '50%',
                background: 'var(--wf-warning-text)', marginLeft: 6, verticalAlign: 'middle',
              }}
            />
          )}
        </span>
        <span style={{ fontSize: 11, color: 'var(--wf-text-muted)', background: 'var(--wf-bg-control)', borderRadius: 8, padding: '1px 6px' }}>
          {getModeProfile(project.mode).icon} {getModeProfile(project.mode).label}
        </span>
        <div style={{ flex: 1, minWidth: 8 }} />
        {/* FT-030: Theme toggle button */}
        <button
          onClick={() => setTheme((t) => t === 'dark' ? 'light' : 'dark')}
          style={{ ...buttonBase, fontSize: 16, lineHeight: 1 }}
          title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
          data-testid="theme-toggle"
        >
          {theme === 'dark' ? '\uD83C\uDF19' : '\u2600\uFE0F'}
        </button>
        <button
          onClick={() => useEditorStore.getState().setShowSearch(true)}
          style={{ ...buttonBase, display: 'flex', alignItems: 'center', gap: 4 }}
          title="Search (Ctrl+K)"
          aria-label="Search (Ctrl+K)"
        >
          <span style={{ fontSize: 13 }}>{'\uD83D\uDD0D'}</span>
          <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>Ctrl+K</span>
        </button>
        <button onClick={() => openModal('template-manager')} style={buttonBase}>New</button>
        <button onClick={() => openModal('import')} style={buttonBase}>Import</button>
        <button onClick={handleLoad} style={buttonBase}>Load</button>
        <div style={{ display: 'flex', position: 'relative' }} onClick={(e) => e.stopPropagation()}>
          <button
            onClick={handleSave}
            style={{ ...buttonBase, borderTopRightRadius: 0, borderBottomRightRadius: 0 }}
            disabled={saving}
            aria-busy={saving}
            aria-label={saving ? 'Saving' : 'Save'}
          >
            {saving ? 'Saving\u2026' : 'Save'}
          </button>
          <button
            type="button"
            aria-label="More save options"
            aria-haspopup="menu"
            aria-expanded={saveMenuOpen}
            data-testid="wf-save-menu-toggle"
            onClick={() => setSaveMenuOpen((o) => !o)}
            style={{ ...buttonBase, borderTopLeftRadius: 0, borderBottomLeftRadius: 0, borderLeft: 'none', padding: '4px 6px' }}
          >
            {'\u25BE'}
          </button>
          {saveMenuOpen && (
            <div
              role="menu"
              data-testid="wf-save-menu"
              style={{
                position: 'absolute', top: '100%', right: 0, zIndex: 20, marginTop: 4,
                background: 'var(--wf-bg-elevated)', border: '1px solid var(--wf-border-default)',
                borderRadius: 'var(--wf-radius-md)', boxShadow: 'var(--wf-shadow-panel)', minWidth: 160,
              }}
            >
              <button
                role="menuitem"
                onClick={() => { setSaveMenuOpen(false); openModal('save-template'); }}
                style={{ ...buttonBase, display: 'block', width: '100%', border: 'none', borderRadius: 0, textAlign: 'left' }}
              >
                Save as Template
              </button>
              <button
                role="menuitem"
                onClick={() => { setSaveMenuOpen(false); openModal('save-kit'); }}
                style={{ ...buttonBase, display: 'block', width: '100%', border: 'none', borderRadius: 0, textAlign: 'left' }}
              >
                Save as Kit
              </button>
            </div>
          )}
        </div>
        <button
          onClick={undo}
          style={{ ...buttonBase, opacity: getUndoCount() > 0 ? 1 : 0.4 }}
          title={getUndoLabel() ? `Undo: ${getUndoLabel()}` : 'Nothing to undo'}
          disabled={getUndoCount() === 0}
        >
          Undo{getUndoCount() > 0 ? ` (${getUndoCount()})` : ''}
        </button>
        <button
          onClick={redo}
          style={{ ...buttonBase, opacity: getRedoCount() > 0 ? 1 : 0.4 }}
          title={getRedoLabel() ? `Redo: ${getRedoLabel()}` : 'Nothing to redo'}
          disabled={getRedoCount() === 0}
        >
          Redo{getRedoCount() > 0 ? ` (${getRedoCount()})` : ''}
        </button>
        <button onClick={() => openModal('export')} style={{ ...buttonPrimary, marginLeft: 'auto' }}>Export</button>
        <input ref={fileInput} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {/* ED-B-008: oversize auto-save warning. Persistent (no dismiss) since the
          suspension is structural — it ends when the project shrinks. */}
      {autoSaveHealth.oversize && (
        <div
          data-testid="wf-autosave-oversize-banner"
          role="alert"
          aria-live="assertive"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            background: 'var(--wf-danger-bg, #3d1214)', borderBottom: '1px solid var(--wf-warning, #d29922)',
            color: 'var(--wf-warning, #d29922)', fontSize: 12,
          }}
        >
          <span style={{ flex: 1 }}>
            Project too large for auto-save — {AUTOSAVE_SAVE_HINT}. Auto-save will resume if the project shrinks.
            {autoSaveHealth.lastBytes > 0 && (
              <span style={{ color: 'var(--wf-text-hint)', marginLeft: 6 }}>
                ({Math.round(autoSaveHealth.lastBytes / 1024 / 1024 * 10) / 10} MB /
                {' '}{Math.round(autoSaveHealth.limitBytes / 1024 / 1024 * 10) / 10} MB)
              </span>
            )}
          </span>
        </div>
      )}

      {/* ED-B-001: surface auto-save errors (typically quota) as a dismissable
          banner. Only shown when we have a non-oversize error — oversize has its
          own persistent banner above. */}
      {autoSaveErr && !autoSaveHealth.oversize && (
        <div
          data-testid="wf-autosave-error-banner"
          role="alert"
          aria-live="assertive"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            background: 'var(--wf-danger-bg, #3d1214)', borderBottom: '1px solid var(--wf-danger, #f85149)',
            color: 'var(--wf-danger, #f85149)', fontSize: 12,
          }}
        >
          <span style={{ flex: 1 }}>{autoSaveErr}</span>
          <button
            onClick={() => { clearLastAutoSaveError(); setAutoSaveErr(null); }}
            aria-label="Dismiss auto-save error"
            style={{ background: 'none', border: 'none', color: 'var(--wf-danger, #f85149)', cursor: 'pointer', fontSize: 14 }}
          >
            {'\u2715'}
          </button>
        </div>
      )}

      {/* EU-004: File error banner */}
      {fileLoading && (
        <div
          data-testid="wf-file-reading-banner"
          role="status"
          aria-live="polite"
          style={{
            display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
            background: 'var(--wf-bg-panel)', borderBottom: '1px solid var(--wf-border-default)',
            color: 'var(--wf-text-muted)', fontSize: 12,
          }}
        >
          {fileLoading}
        </div>
      )}

      {fileError && (
        <div
          role="alert"
          aria-live="assertive"
          data-testid="wf-file-error-banner"
          style={{
          display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
          background: 'var(--wf-danger-bg, #3d1214)', borderBottom: '1px solid var(--wf-danger, #f85149)',
          color: 'var(--wf-danger, #f85149)', fontSize: 12,
        }}>
          <span style={{ flex: 1 }}>{fileError}</span>
          <button
            onClick={() => setFileError(null)}
            aria-label="Dismiss file error"
            style={{ background: 'none', border: 'none', color: 'var(--wf-danger, #f85149)', cursor: 'pointer', fontSize: 14 }}
          >
            {'\u2715'}
          </button>
        </div>
      )}

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <div style={{
          width: leftCollapsed ? 36 : 'var(--wf-sidebar-width)',
          background: 'var(--wf-bg-app)', borderRight: '1px solid var(--wf-border-default)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'width 0.15s ease',
          position: 'relative', zIndex: 1, flexShrink: 0,
        }}>
          <button
            onClick={() => setLeftCollapsed((c) => !c)}
            title={leftCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={leftCollapsed ? 'Expand left sidebar' : 'Collapse left sidebar'}
            style={{
              background: 'none', border: 'none', color: 'var(--wf-text-muted)', cursor: 'pointer',
              padding: '6px 8px', fontSize: 14, textAlign: leftCollapsed ? 'center' : 'right',
              borderBottom: '1px solid var(--wf-border-default)', flexShrink: 0,
            }}
          >
            {leftCollapsed ? '▶' : '◀'}
          </button>
          {!leftCollapsed && (
            <div style={{ overflow: 'auto', padding: 8, flex: 1 }}>
              <ToolPalette />
              <TilePalette />
              <PropPalette />
              <DistrictPanel />
            </div>
          )}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative', minWidth: 0, overflow: 'hidden' }}>
          <Canvas />
          {project.zones.length === 0 && (
            <div
              data-testid="wf-first-run-welcome"
              style={{
                position: 'absolute', inset: 0, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
                pointerEvents: 'none', zIndex: 2,
              }}
            >
              <div
                style={{
                  pointerEvents: 'auto', textAlign: 'center',
                  background: 'var(--wf-bg-elevated)',
                  border: '1px solid var(--wf-border-default)',
                  borderRadius: 'var(--wf-radius-lg)',
                  boxShadow: 'var(--wf-shadow-panel)',
                  padding: 'var(--wf-space-6) var(--wf-space-5)',
                  maxWidth: 360,
                }}
              >
                <img src="/mark.svg" alt="" width={32} height={32} style={{ display: 'block', margin: '0 auto 12px' }} />
                <div style={{ fontSize: 'var(--wf-font-2xl)', fontWeight: 600, color: 'var(--wf-text-primary)', marginBottom: 6 }}>
                  World Forge
                </div>
                <p style={{ margin: '0 0 16px', fontSize: 'var(--wf-font-md)', color: 'var(--wf-text-muted)' }}>
                  Author a world, then export it to a game engine.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, justifyContent: 'center' }}>
                  <button type="button" onClick={() => openModal('template-manager')} style={buttonPrimary}>New template</button>
                  <button type="button" onClick={handleLoad} style={buttonBase}>Load</button>
                  <button type="button" onClick={() => openModal('import')} style={buttonBase}>Import</button>
                  <button type="button" onClick={handleOpenSample} style={buttonBase} data-testid="wf-open-sample">Open sample</button>
                </div>
              </div>
            </div>
          )}
          {showSpeedPanel && <SpeedPanel />}
          {/* F-69a1f39b: same containing block as the minimap (canvas well), not viewport-fixed. */}
          <ToastHost shiftForMinimap={showMinimap && project.zones.length > 0} />
        </div>

        {/* Right sidebar */}
        <div style={{
          width: rightCollapsed ? 36 : 'var(--wf-inspector-width)',
          background: 'var(--wf-bg-app)', borderLeft: '1px solid var(--wf-border-default)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'width 0.15s ease',
          position: 'relative', zIndex: 1, flexShrink: 0,
        }}>
          <button
            onClick={() => setRightCollapsed((c) => !c)}
            title={rightCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={rightCollapsed ? 'Expand right sidebar' : 'Collapse right sidebar'}
            style={{
              background: 'none', border: 'none', color: 'var(--wf-text-muted)', cursor: 'pointer',
              padding: '6px 8px', fontSize: 14, textAlign: rightCollapsed ? 'center' : 'left',
              borderBottom: '1px solid var(--wf-border-default)', flexShrink: 0,
            }}
          >
            {rightCollapsed ? '◀' : '▶'}
          </button>
          {!rightCollapsed && (
            <>
              {/* Tab bar — scrollable to handle many tabs.
                  ED-B-007: subtle right-edge gradient hints that tabs overflow. */}
              <div style={{ position: 'relative' }}>
              <div
                data-testid="wf-tab-bar"
                role="tablist"
                aria-label="Editor panels"
                onKeyDown={(e) => {
                  if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'Home' && e.key !== 'End') return;
                  e.preventDefault();
                  const ids = tabs.map((t) => t.id);
                  const idx = Math.max(0, ids.indexOf(rightTab));
                  let next = idx;
                  if (e.key === 'ArrowRight') next = (idx + 1) % ids.length;
                  else if (e.key === 'ArrowLeft') next = (idx - 1 + ids.length) % ids.length;
                  else if (e.key === 'Home') next = 0;
                  else if (e.key === 'End') next = ids.length - 1;
                  const nextId = ids[next];
                  setRightTab(nextId);
                  const btn = e.currentTarget.querySelector(`[data-tab-id="${nextId}"]`) as HTMLButtonElement | null;
                  btn?.focus();
                }}
                style={{ display: 'flex', borderBottom: '1px solid var(--wf-border-default)', background: 'var(--wf-bg-panel)', overflowX: 'auto' }}
              >
                {tabs.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    role="tab"
                    id={`wf-tab-${t.id}`}
                    data-tab-id={t.id}
                    aria-selected={rightTab === t.id}
                    aria-controls={`wf-tab-panel-${t.id}`}
                    tabIndex={rightTab === t.id ? 0 : -1}
                    onClick={() => setRightTab(t.id)}
                    style={{
                      flexShrink: 0, padding: '6px 8px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                      background: rightTab === t.id ? 'var(--wf-bg-app)' : 'transparent',
                      color: rightTab === t.id ? 'var(--wf-accent)' : 'var(--wf-text-muted)',
                      border: 'none',
                      borderBottom: rightTab === t.id ? '2px solid var(--wf-accent)' : '2px solid transparent',
                    }}
                  >
                    {t.label}
                    {t.id === 'issues' && issueCount > 0 && (
                      <span style={{
                        marginLeft: 4, fontSize: 9, background: 'var(--wf-danger)', color: 'var(--wf-on-danger)',
                        borderRadius: 8, padding: '1px 5px', fontWeight: 'bold',
                      }}>
                        {issueCount}
                      </span>
                    )}
                    {t.badge && (
                      <span style={{
                        marginLeft: 4, fontSize: 9, background: t.badgeColor ?? 'var(--wf-text-muted)', color: t.badgeFg ?? 'var(--wf-on-accent)',
                        borderRadius: 8, padding: '1px 5px', fontWeight: 'bold',
                      }}>
                        {t.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>
              {/* ED-B-007: right-edge overflow indicator. `pointer-events:none`
                  keeps it from swallowing clicks on the rightmost tab. */}
              <div
                aria-hidden="true"
                data-testid="wf-tab-overflow-fade"
                style={{
                  position: 'absolute', top: 0, right: 0, bottom: 0, width: 18,
                  pointerEvents: 'none',
                  background: 'linear-gradient(to right, transparent, var(--wf-bg-panel))',
                }}
              />
              </div>

              {/* Tab content */}
              <div
                role="tabpanel"
                id={`wf-tab-panel-${rightTab}`}
                aria-labelledby={`wf-tab-${rightTab}`}
                style={{ flex: 1, overflow: 'auto', padding: 8 }}
              >
                {rightTab === 'map' && (
                  <>
                    {getSelectionCount(selection) >= 2 && <SelectionActionsPanel />}
                    {selectedConnection && <ConnectionProperties />}
                    {selection.encounters.length === 1 && <EncounterProperties />}
                    {selection.landmarks.length === 1 && <LandmarkProperties />}
                    {selection.spawns.length === 1 && <SpawnProperties />}
                    {selectedZoneId && <ZoneProperties />}
                    {selectedZoneId && <EconomyPanel />}
                    {selectedZoneId && <TownStructuresPanel />}
                    {activeTool === 'entity-place' && <EntityProperties />}
                    {!selectedZoneId && getSelectionCount(selection) < 2 && activeTool !== 'entity-place' && selection.landmarks.length !== 1 && selection.spawns.length !== 1 && selection.encounters.length !== 1 && !selectedConnection && <StrataPanel />}
                    {!selectedZoneId && getSelectionCount(selection) < 2 && activeTool !== 'entity-place' && selection.landmarks.length !== 1 && selection.spawns.length !== 1 && selection.encounters.length !== 1 && !selectedConnection && <HazardLibraryPanel />}
                    {!selectedZoneId && selection.zones.length <= 1 && activeTool !== 'entity-place' && selection.landmarks.length !== 1 && selection.spawns.length !== 1 && selection.encounters.length !== 1 && !selectedConnection && (
                      <div style={{ fontSize: 12, color: 'var(--wf-text-muted)', padding: '8px 0' }}>
                        Select a zone or use a tool to see properties.
                      </div>
                    )}
                  </>
                )}
                {rightTab === 'player' && <PlayerTemplatePanel />}
                {rightTab === 'builds' && <BuildCatalogPanel />}
                {rightTab === 'trees' && <ProgressionPanel />}
                {rightTab === 'dialogue' && <DialoguePanel />}
                {rightTab === 'objects' && <ObjectListPanel />}
                {rightTab === 'presets' && <PresetBrowser />}
                {rightTab === 'assets' && <AssetPanel />}
                {rightTab === 'issues' && <ValidationPanel />}
                {rightTab === 'deps' && <DependencyPanel />}
                {rightTab === 'review' && <ReviewPanel />}
                {rightTab === 'guide' && <ChecklistPanel />}
                {rightTab === 'import-summary' && <ImportSummaryPanel />}
                {rightTab === 'diff' && <DiffPanel />}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Bottom bar */}
      <div
        data-testid="wf-status-line"
        style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px',
        height: 'var(--wf-bottombar-height)', boxSizing: 'border-box',
        background: 'var(--wf-bg-panel)', borderTop: '1px solid var(--wf-border-default)', fontSize: 11, color: 'var(--wf-text-muted)',
      }}>
        <span>Mode: {getModeProfile(project.mode).icon} {getModeProfile(project.mode).label}</span>
        <span>Tool: {activeTool}</span>
        <span>Zones: {project.zones.length}</span>
        <span>Entities: {project.entityPlacements.length}</span>
        <span>Assets: {project.assets.length}</span>
        <span>Zoom: {Math.round(viewport.zoom * 100)}%</span>
        {selectionCount > 0 && <span>Selected: {selectionCount}</span>}
        <div style={{ flex: 1 }} />
        {issueCount > 0 ? (
          <button
            type="button"
            onClick={() => setRightTab('issues')}
            aria-label={`${issueCount} issue${issueCount !== 1 ? 's' : ''} — open Issues tab`}
            style={{
              background: 'none', border: 'none', padding: 0, font: 'inherit',
              color: 'var(--wf-danger-text)', cursor: 'pointer',
            }}
          >
            {issueCount} issue{issueCount !== 1 ? 's' : ''}
          </button>
        ) : (
          <span style={{ color: 'var(--wf-success-text)' }}>Valid</span>
        )}
      </div>

      <ModalLayer />
    </div>
  );
}


