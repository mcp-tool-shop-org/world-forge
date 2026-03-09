// App.tsx — editor layout shell

import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from './store/project-store.js';
import { useEditorStore, getSelectedZoneId, getSelectionCount, type RightTab } from './store/editor-store.js';
import { ToolPalette } from './panels/ToolPalette.js';
import { ZoneProperties } from './panels/ZoneProperties.js';
import { DistrictPanel } from './panels/DistrictPanel.js';
import { EntityProperties } from './panels/EntityProperties.js';
import { SelectionActionsPanel } from './panels/SelectionActionsPanel.js';
import { ExportModal } from './panels/ExportModal.js';
import { ValidationPanel, useIssueCount } from './panels/ValidationPanel.js';
import { PlayerTemplatePanel } from './panels/PlayerTemplatePanel.js';
import { BuildCatalogPanel } from './panels/BuildCatalogPanel.js';
import { ProgressionPanel } from './panels/ProgressionPanel.js';
import { DialoguePanel } from './panels/DialoguePanel.js';
import { ChecklistPanel } from './panels/ChecklistPanel.js';
import { TemplateManager } from './panels/TemplateManager.js';
import { ImportModal } from './panels/ImportModal.js';
import { SaveTemplateModal } from './panels/SaveTemplateModal.js';
import { ImportSummaryPanel } from './panels/ImportSummaryPanel.js';
import { DiffPanel } from './panels/DiffPanel.js';
import { AssetPanel } from './panels/AssetPanel.js';
import { ObjectListPanel } from './panels/ObjectListPanel.js';
import { SearchOverlay } from './panels/SearchOverlay.js';
import { Canvas } from './Canvas.js';

export function App() {
  const { project, dirty, loadProject, undo, redo } = useProjectStore();
  const { activeTool, selection, rightTab, setRightTab, viewport, checklistDismissed, showSearch } = useEditorStore();
  const selectedZoneId = getSelectedZoneId(selection);
  const selectionCount = getSelectionCount(selection);
  const importFidelity = useEditorStore((s) => s.importFidelity);
  const importSnapshot = useEditorStore((s) => s.importSnapshot);
  const [showExport, setShowExport] = useState(false);
  const [showTemplateManager, setShowTemplateManager] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [showSaveTemplate, setShowSaveTemplate] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);
  const issueCount = useIssueCount();

  const losslessPct = importFidelity?.summary.losslessPercent;

  const tabs: { id: RightTab; label: string; badge?: string; badgeColor?: string }[] = [
    { id: 'map', label: 'Map' },
    { id: 'player', label: 'Player' },
    { id: 'builds', label: 'Builds' },
    { id: 'trees', label: 'Trees' },
    { id: 'dialogue', label: 'Dialogue' },
    { id: 'objects', label: 'Objects' },
    { id: 'assets', label: 'Assets', badge: project.assets.length > 0 ? `${project.assets.length}` : undefined },
    { id: 'issues', label: 'Issues' },
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
        background: '#161b22', borderBottom: '1px solid #30363d',
      }}>
        <strong style={{ color: '#58a6ff' }}>World Forge</strong>
        <span style={{ color: '#8b949e', fontSize: 12 }}>{project.name}{dirty ? ' *' : ''}</span>
        <div style={{ flex: 1 }} />
        <button onClick={() => setShowTemplateManager(true)} style={btnStyle}>New</button>
        <button onClick={() => setShowImport(true)} style={btnStyle}>Import</button>
        <button onClick={handleLoad} style={btnStyle}>Load</button>
        <button onClick={handleSave} style={btnStyle}>Save</button>
        <button onClick={() => setShowSaveTemplate(true)} style={btnStyle}>Save as Template</button>
        <button onClick={undo} style={btnStyle}>Undo</button>
        <button onClick={redo} style={btnStyle}>Redo</button>
        <button onClick={() => setShowExport(true)} style={{ ...btnStyle, background: '#238636', color: '#fff' }}>Export</button>
        <input ref={fileInput} type="file" accept=".json" style={{ display: 'none' }} onChange={handleFileChange} />
      </div>

      {/* Main area */}
      <div style={{ display: 'flex', flex: 1, overflow: 'hidden' }}>
        {/* Left sidebar */}
        <div style={{ width: 200, background: '#0d1117', borderRight: '1px solid #30363d', overflow: 'auto', padding: 8 }}>
          <ToolPalette />
          <DistrictPanel />
        </div>

        {/* Canvas */}
        <div style={{ flex: 1, position: 'relative' }}>
          <Canvas />
        </div>

        {/* Right sidebar */}
        <div style={{ width: 300, background: '#0d1117', borderLeft: '1px solid #30363d', display: 'flex', flexDirection: 'column' }}>
          {/* Tab bar — scrollable to handle many tabs */}
          <div style={{ display: 'flex', borderBottom: '1px solid #30363d', background: '#161b22', overflowX: 'auto' }}>
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setRightTab(t.id)}
                style={{
                  flexShrink: 0, padding: '6px 8px', fontSize: 11, cursor: 'pointer', whiteSpace: 'nowrap',
                  background: rightTab === t.id ? '#0d1117' : 'transparent',
                  color: rightTab === t.id ? '#58a6ff' : '#8b949e',
                  border: 'none',
                  borderBottom: rightTab === t.id ? '2px solid #58a6ff' : '2px solid transparent',
                }}
              >
                {t.label}
                {t.id === 'issues' && issueCount > 0 && (
                  <span style={{
                    marginLeft: 4, fontSize: 9, background: '#f85149', color: '#fff',
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
                {selectedZoneId && <ZoneProperties />}
                {activeTool === 'entity-place' && <EntityProperties />}
                {!selectedZoneId && selection.zones.length <= 1 && activeTool !== 'entity-place' && (
                  <div style={{ fontSize: 12, color: '#8b949e', padding: '8px 0' }}>
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
            {rightTab === 'assets' && <AssetPanel />}
            {rightTab === 'issues' && <ValidationPanel />}
            {rightTab === 'guide' && <ChecklistPanel />}
            {rightTab === 'import-summary' && <ImportSummaryPanel />}
            {rightTab === 'diff' && <DiffPanel />}
          </div>
        </div>
      </div>

      {/* Bottom bar */}
      <div style={{
        display: 'flex', alignItems: 'center', gap: 12, padding: '4px 12px',
        background: '#161b22', borderTop: '1px solid #30363d', fontSize: 11, color: '#8b949e',
      }}>
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
            style={{ color: '#f85149', cursor: 'pointer' }}
          >
            {issueCount} issue{issueCount !== 1 ? 's' : ''}
          </span>
        ) : (
          <span style={{ color: '#3fb950' }}>Valid</span>
        )}
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
      {showTemplateManager && <TemplateManager onClose={() => setShowTemplateManager(false)} />}
      {showImport && <ImportModal onClose={() => setShowImport(false)} />}
      {showSaveTemplate && <SaveTemplateModal onClose={() => setShowSaveTemplate(false)} />}
      {showSearch && <SearchOverlay />}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
};
