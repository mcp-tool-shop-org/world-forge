// SaveTemplateModal.tsx — save current project as a reusable template

import { useState, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useTemplateStore } from '../store/template-store.js';
import { labelStyle, inputStyle } from './shared.js';
import { ModalFrame } from '../ui/ModalFrame.js';
import { buttonBase, modalFooter } from '../ui/styles.js';

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
    <ModalFrame title="Save as Template" width={400} onClose={onClose}>

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
        <div style={modalFooter}>
          <button onClick={onClose} style={buttonBase}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim()}
            style={{
              ...buttonBase,
              background: name.trim() ? 'var(--wf-success)' : 'var(--wf-bg-control)',
              color: name.trim() ? '#fff' : 'var(--wf-text-hint)',
              border: 'none',
            }}
          >
            Save Template
          </button>
        </div>
    </ModalFrame>
  );
}


