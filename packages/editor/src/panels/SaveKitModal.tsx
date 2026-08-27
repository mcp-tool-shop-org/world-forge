// SaveKitModal.tsx — save current project as a reusable starter kit

import { useState, useCallback } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { StoragePersistError, useKitStore } from '../kits/index.js';
import { pushToast } from '../ui/Toast.js';
import { AUTHORING_MODES } from '@world-forge/schema';
import type { AuthoringMode } from '@world-forge/schema';
import { MODE_PROFILES } from '../mode-profiles.js';
import { labelText as labelStyle, inputBase as inputStyle } from '../ui/styles.js';
import { ModalFrame } from '../ui/ModalFrame.js';
import { buttonBase, modalFooter } from '../ui/styles.js';

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
    try {
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
    } catch (err) {
      // F-9d2f6dae: quota/security persist failure used to close the modal
      // as success while the kit vanished on refresh.
      const msg = err instanceof StoragePersistError
        ? 'Could not save kit — browser storage is full or blocked. The kit was not kept.'
        : (err instanceof Error ? err.message : 'Could not save kit.');
      pushToast(msg, 'error', 4000);
    }
  }, [name, description, icon, modes, tagsInput, project, saveKit, onClose]);

  return (
    <ModalFrame title="Save as Starter Kit" width={440} onClose={onClose}>

        {/* Name */}
        <label style={labelStyle} htmlFor="wf-save-kit-name">Name</label>
        <input
          id="wf-save-kit-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          style={inputStyle}
          placeholder="Kit name"
        />

        {/* Description */}
        <label style={labelStyle} htmlFor="wf-save-kit-desc">Description</label>
        <textarea
          id="wf-save-kit-desc"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle, minHeight: 60, resize: 'vertical' }}
          placeholder="What this kit is for..."
        />

        {/* Icon */}
        <label style={labelStyle} htmlFor="wf-save-kit-icon">Icon</label>
        <input
          id="wf-save-kit-icon"
          value={icon}
          onChange={(e) => setIcon(e.target.value)}
          style={{ ...inputStyle, width: 60 }}
          maxLength={2}
        />

        {/* Modes — fieldset so the group has an accessible name without wrapping buttons in <label> */}
        <fieldset style={{ border: 'none', padding: 0, margin: 0 }}>
          <legend style={labelStyle}>Modes</legend>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 4 }}>
            {AUTHORING_MODES.map((m) => {
              const active = modes.includes(m);
              return (
                <button
                  key={m}
                  type="button"
                  onClick={() => toggleMode(m)}
                  aria-pressed={active}
                  style={{
                    background: active ? 'color-mix(in srgb, var(--wf-accent) 18%, var(--wf-bg-panel))' : 'var(--wf-bg-app)',
                    border: active ? '2px solid var(--wf-accent)' : '1px solid var(--wf-border-default)',
                    borderRadius: 4, padding: '2px 8px', cursor: 'pointer',
                    color: active ? 'var(--wf-accent)' : 'var(--wf-text-muted)', fontSize: 10,
                  }}
                >
                  {MODE_PROFILES[m].icon} {MODE_PROFILES[m].label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {/* Tags */}
        <label style={labelStyle} htmlFor="wf-save-kit-tags">Tags (comma-separated)</label>
        <input
          id="wf-save-kit-tags"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          style={inputStyle}
          placeholder="e.g. fantasy, dungeon, starter"
        />

        {/* Content summary */}
        <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', marginTop: 8, marginBottom: 16 }}>
          This kit will include: {project.zones.length} zones, {project.entityPlacements.length} entities,
          {' '}{project.dialogues.length} dialogues, {project.itemPlacements.length} items
        </div>

        {/* Actions */}
        <div style={modalFooter}>
          <button onClick={onClose} style={buttonBase}>Cancel</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || modes.length === 0}
            style={{
              ...buttonBase,
              background: name.trim() && modes.length > 0 ? 'var(--wf-success)' : 'var(--wf-bg-control)',
              color: name.trim() && modes.length > 0 ? '#fff' : 'var(--wf-text-hint)',
              border: 'none',
            }}
          >
            Save Kit
          </button>
        </div>
    </ModalFrame>
  );
}


