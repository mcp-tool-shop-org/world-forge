// SaveKitModal.tsx — save current project as a reusable starter kit

import { useState, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useKitStore } from '../kits/index.js';
import { AUTHORING_MODES } from '@world-forge/schema';
import type { AuthoringMode } from '@world-forge/schema';
import { MODE_PROFILES } from '../mode-profiles.js';
import { MODAL_OVERLAY, MODAL_CARD, labelStyle, inputStyle } from './shared.js';

interface Props { onClose: () => void }

export function SaveKitModal({ onClose }: Props) {
  const project = useProjectStore((s) => s.project);
  const saveKit = useKitStore((s) => s.saveKit);

  const [name, setName] = useState(project.name);
  const [description, setDescription] = useState(project.description);
  const [icon, setIcon] = useState('\uD83D\uDCE6');
  const [modes, setModes] = useState<AuthoringMode[]>(project.mode ? [project.mode] : ['dungeon']);
  const [tagsInput, setTagsInput] = useState('');

  const toggleMode = (m: AuthoringMode) => {
    setModes((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    if (modes.length === 0) return;
    const tags = tagsInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean);
    saveKit({
      name: name.trim(),
      description: description.trim(),
      icon,
      modes,
      tags,
      project: JSON.parse(JSON.stringify(project)),
      presetRefs: { region: [], encounter: [] },
      guideHints: {},
    });
    onClose();
  }, [name, description, icon, modes, tagsInput, project, saveKit, onClose]);

  return (
    <div style={MODAL_OVERLAY}>
      <div style={MODAL_CARD(440)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#c9d1d9', fontSize: 16 }}>Save as Starter Kit</h2>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        {/* Name */}
        <label style={labelStyle}>Name</label>
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          placeholder="Kit name"
        />

        {/* Description */}
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          placeholder="What this kit is for..."
        />

        {/* Icon */}
        <label style={labelStyle}>Icon</label>
        <input
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          style={{ ...inputStyle, width: 60 }}
          maxLength={2}
        />

        {/* Modes */}
        <label style={labelStyle}>Modes</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
          {AUTHORING_MODES.map((m) => {
            const active = modes.includes(m);
            return (
              <button
                key={m}
                onClick={() => toggleMode(m)}
                style={{
                  background: active ? '#0d1d30' : '#0d1117',
                  border: active ? '2px solid #58a6ff' : '1px solid #30363d',
                  borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                  color: active ? '#58a6ff' : '#8b949e', fontSize: 10,
                }}
              >
                {MODE_PROFILES[m].icon} {MODE_PROFILES[m].label}
              </button>
            );
          })}
        </div>

        {/* Tags */}
        <label style={labelStyle}>Tags (comma-separated)</label>
        <input
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          style={inputStyle}
          placeholder="e.g. fantasy, dungeon, starter"
        />

        {/* Content summary */}
        <div style={{ fontSize: 11, color: '#8b949e', marginTop: 8, marginBottom: 16 }}>
          This kit will include: {project.zones.length} zones, {project.entityPlacements.length} entities,
          {' '}{project.dialogues.length} dialogues, {project.itemPlacements.length} items
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={onClose} style={btnStyle}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || modes.length === 0}
            style={{
              ...btnStyle,
              background: name.trim() && modes.length > 0 ? '#238636' : '#21262d',
              color: name.trim() && modes.length > 0 ? '#fff' : '#484f58',
            }}
          >
            Save Kit
          </button>
        </div>
      </div>
    </div>
  );
}

const btnStyle: React.CSSProperties = {
  background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, padding: '6px 14px', cursor: 'pointer', fontSize: 12,
};

const closeBtnStyle: React.CSSProperties = {
  background: 'none', border: 'none', color: '#8b949e', fontSize: 18, cursor: 'pointer',
};
