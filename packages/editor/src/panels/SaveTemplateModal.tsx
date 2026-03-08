// SaveTemplateModal.tsx — save current project as a reusable template

import { useState, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useTemplateStore } from '../store/template-store.js';

interface Props { onClose: () => void }

const GENRE_OPTIONS = ['fantasy', 'cyberpunk', 'detective', 'pirate', 'zombie', 'custom'];

export function SaveTemplateModal({ onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const saveTemplate = useTemplateStore((s) => s.saveTemplate);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [genre, setGenre] = useState(project.genre || 'fantasy');
  const [icon, setIcon] = useState('📦');

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    saveTemplate({
      name: name.trim(),
      description: description.trim(),
      genre,
      icon,
      project: JSON.parse(JSON.stringify(project)),
    });
    onClose();
  }, [name, description, genre, icon, project, saveTemplate, onClose]);

  return (
    <div style={overlayStyle}>
      <div style={cardStyle}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#c9d1d9', fontSize: 16 }}>Save as Template</h2>
          <button onClick={onClose} style={closeBtnStyle}>×</button>
        </div>

        {/* Name */}
        <label style={labelStyle}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          placeholder="Template name"
        />

        {/* Description */}
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          placeholder="What this template is for..."
        />

        {/* Genre */}
        <label style={labelStyle}>Genre</label>
        <select value={genre} onChange={(e) => setGenre(e.target.value)} style={inputStyle}>
          {GENRE_OPTIONS.map((g) => (
            <option key={g} value={g}>{g.charAt(0).toUpperCase() + g.slice(1)}</option>
          ))}
        </select>

        {/* Icon */}
        <label style={labelStyle}>Icon</label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          style={{ ...inputStyle, width: 60 }}
          maxLength={2}
        />

        {/* Content summary */}
        <div style={{ fontSize: 11, color: '#8b949e', marginTop: 8, marginBottom: 16 }}>
          This template will include: {project.zones.length} zones, {project.entityPlacements.length} entities,
          {' '}{project.dialogues.length} dialogues, {project.itemPlacements.length} items
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnStyle}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              ...btnStyle,
              background: name.trim() ? '#238636' : '#21262d',
              color: name.trim() ? '#fff' : '#484f58',
            }}
          >
            Save Template
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
  padding: 24, width: 400,
};

const labelStyle: React.CSSProperties = {
  display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 4, marginTop: 12,
};

const inputStyle: React.CSSProperties = {
  width: '100%', padding: '6px 8px', background: '#0d1117', color: '#c9d1d9',
  border: '1px solid #30363d', borderRadius: 4, fontSize: 13, boxSizing: 'border-box',
};

const btnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e', fontSize: 18, cursor: 'pointer',
};
