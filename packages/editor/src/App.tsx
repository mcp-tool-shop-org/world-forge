// App.tsx — editor layout shell

import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from './store/project-store.js';
import { useEditorStore, getSelectedZoneId, getSelectionCount, type RightTab } from './store/editor-store.js';
import { useModalStore } from './store/modal-store.js';
import { ToolPalette } from './panels/ToolPalette.js';
import { ZoneProperties } from './panels/ZoneProperties.js';
import { DistrictPanel } from './panels/DistrictPanel.js';
import { EntityProperties } from './panels/EntityProperties.js';
import { SelectionActionsPanel } from './panels/SelectionActionsPanel.js';
import { ConnectionProperties } from './panels/ConnectionProperties.js';
import { EncounterProperties } from './panels/EncounterProperties.js';
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
import { buttonBase, buttonPrimary } from './ui/styles.js';

export function App() {
  const { project, dirty, loadProject, undo, redo } = useProjectStore();
  const { activeTool, selection, selectedConnection, rightTab, setRightTab, viewport, checklistDismissed, showSearch, showSpeedPanel } = useEditorStore();
  const selectedZoneId = getSelectedZoneId(selection);
  const selectionCount = getSelectionCount(selection);
  const importFidelity = useEditorStore((s) => s.importFidelity);
  const importSnapshot = useEditorStore((s) => s.importSnapshot);
  const openModal = useModalStore((s) => s.openModal);
  const [leftCollapsed, setLeftCollapsed] = useState(false);
  const [rightCollapsed, setRightCollapsed] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const issueCount = useIssueCount();
  const depsCount = useDependencyCount();

  const losslessPct = importFidelity?.summary.losslessPercent;

  const tabs: { id: RightTab; label: string; badge?: string; badgeColor?: string }[] = [
    { id: 'map', label: 'Map' },
    { id: 'player', label: 'Player' },
    { id: 'builds', label: 'Builds' },
    { id: 'trees', label: 'Trees' },
    { id: 'dialogue', label: 'Dialogue' },
    { id: 'objects', label: 'Objects' },
    { id: 'presets', label: 'Presets' },
    { id: 'assets', label: 'Assets', badge: project.assets.length > 0 ? `${project.assets.length}` : undefined },
    { id: 'issues', label: 'Issues' },
    { id: 'deps', label: 'Deps', badge: depsCount > 0 ? `${depsCount}` : undefined, badgeColor: '#d29922' },
    { id: 'review', label: 'Review' },
    ...(!checklistDismissed ? [{ id: 'guide' as RightTab, label: 'Guide' }] : []),
    ...(importFidelity ? [{ id: 'import-summary' as RightTab, label: 'Import', badge: `${losslessPct}%`, badgeColor: losslessPct === 100 ? '#3fb950' : '#d29922' }] : []),
    ...(importSnapshot ? [{ id: 'diff' as RightTab, label: 'Diff' }] : []),
  ];

  const handleLoad = useCallback(() => {
    fileInput.current?.click();
  }, []);

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const p = JSON.parse(reader.result as string);
        loadProject(p);
      } catch {
        alert('Invalid project JSON');
      }
    };
    reader.readAsText(file);
  }, [loadProject]);

  const handleSave = useCallback(() => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.id}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [project]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 8, padding: '6px 12px',
        background: 'var(--wf-bg-panel)', borderBottom: '1px solid var(--wf-border-default)',
      }}>
        <img src="/logo.png" alt="World Forge" style={{ height: 24, borderRadius: 4 }} />
        <strong style={{ color: 'var(--wf-accent)' }}>World Forge</strong>
        <span style={{ color: 'var(--wf-text-muted)', fontSize: 12 }}>{project.name}{dirty ? ' *' : ''}</span>
        <span style={{ fontSize: 11, color: 'var(--wf-text-hint)', background: 'var(--wf-bg-control)', borderRadius: 8, padding: '1px 6px' }}>
          {getModeProfile(project.mode).icon} {getModeProfile(project.mode).label}
        </span>
        <div style={{ flex: 1 }} />
        <button onClick={() => openModal('template-manager')} style={buttonBase}>New</button>
        <button onClick={() => openModal('import')} style={buttonBase}>Import</button>
        <button onClick={handleLoad} style={buttonBase}>Load</button>
        <button onClick={handleSave} style={buttonBase}>Save</button>
        <button onClick={() => openModal('save-template')} style={buttonBase}>Save as Template</button>
        <button onClick={() => openModal('save-kit')} style={buttonBase}>Save as Kit</button>
        <button onClick={undo} style={buttonBase}>Undo</button>
        <button onClick={redo} style={buttonBase}>Redo</button>
        <button onClick={() => openModal('export')} style={buttonPrimary}>Export</button>
        <input ref={fileInput} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <div style={{
          width: leftCollapsed ? 36 : 200,
          background: 'var(--wf-bg-app)', borderRight: '1px solid var(--wf-border-default)',
          overflow: 'hidden', display: 'flex', flexDirection: 'column',
          transition: 'width 0.15s ease',
        }}>
          <button
            onClick={() => setLeftCollapsed((c) => !c)}
            title={leftCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
              <DistrictPanel />
            </div>
          )}
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Canvas />
          {showSpeedPanel && <SpeedPanel />}
        </div>

        {/* Right sidebar */}
        <div style={{
          width: rightCollapsed ? 36 : 300,
          background: 'var(--wf-bg-app)', borderLeft: '1px solid var(--wf-border-default)',
          display: 'flex', flexDirection: 'column', overflow: 'hidden',
          transition: 'width 0.15s ease',
        }}>
          <button
            onClick={() => setRightCollapsed((c) => !c)}
            title={rightCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
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
              {/* Tab bar — scrollable to handle many tabs */}
              <div style={{ display: 'flex', borderBottom: '1px solid var(--wf-border-default)', background: 'var(--wf-bg-panel)', overflowX: 'auto' }}>
                {tabs.map((t) => (
                  <button
                    key={t.id}
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
                        marginLeft: 4, fontSize: 9, background: 'var(--wf-danger)', color: '#fff',
                        borderRadius: 8, padding: '1px 5px', fontWeight: 'bold',
                      }}>
                        {issueCount}
                      </span>
                    )}
                    {t.badge && (
                      <span style={{
                        marginLeft: 4, fontSize: 9, background: t.badgeColor ?? '#8b949e', color: '#fff',
                        borderRadius: 8, padding: '1px 5px', fontWeight: 'bold',
                      }}>
                        {t.badge}
                      </span>
                    )}
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <div style={{ flex: 1, overflow: 'auto', padding: 8 }}>
                {rightTab === 'map' && (
                  <>
                    {getSelectionCount(selection) >= 2 && <SelectionActionsPanel />}
                    {selectedConnection && <ConnectionProperties />}
                    {selection.encounters.length === 1 && <EncounterProperties />}
                    {selectedZoneId && <ZoneProperties />}
                    {activeTool === 'entity-place' && <EntityProperties />}
                    {!selectedZoneId && selection.zones.length <= 1 && activeTool !== 'entity-place' && (
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
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px',
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
          <span
            onClick={() => setRightTab('issues')}
            style={{ color: 'var(--wf-danger)', cursor: 'pointer' }}
          >
            {issueCount} issue{issueCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <span style={{ color: 'var(--wf-success)' }}>Valid</span>
        )}
      </div>

      <ModalLayer />
    </div>
  );
}


