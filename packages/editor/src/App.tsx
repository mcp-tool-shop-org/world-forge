// App.tsx — editor layout shell

import { useState, useRef, useCallback } from 'react';
import { useProjectStore } from './store/project-store.js';
import { useEditorStore } from './store/editor-store.js';
import { ToolPalette } from './panels/ToolPalette.js';
import { ZoneProperties } from './panels/ZoneProperties.js';
import { DistrictPanel } from './panels/DistrictPanel.js';
import { EntityProperties } from './panels/EntityProperties.js';
import { ExportModal } from './panels/ExportModal.js';
import { Canvas } from './Canvas.js';

export function App() {
  const { project, dirty, newProject, loadProject, undo, redo } = useProjectStore();
  const { activeTool, selectedZoneId, zoom } = useEditorStore();
  const [showExport, setShowExport] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

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
        <button onClick={newProject} style={btnStyle}>New</button>
        <button onClick={handleLoad} style={btnStyle}>Load</button>
        <button onClick={handleSave} style={btnStyle}>Save</button>
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
        <div style={{ width: 260, background: '#0d1117', borderLeft: '1px solid #30363d', overflow: 'auto', padding: 8 }}>
          {selectedZoneId && <ZoneProperties />}
          {activeTool === 'entity-place' && <EntityProperties />}
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
        <span>Zoom: {Math.round(zoom * 100)}%</span>
      </div>

      {showExport && <ExportModal onClose={() => setShowExport(false)} />}
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '4px 10px', cursor: 'pointer', fontSize: 12,
};
