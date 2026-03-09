// EditKitModal.tsx — edit custom kit metadata, preset refs, and guide hints

import { useState, useCallback } from 'react';
import { useKitStore } from '../kits/index.js';
import type { StarterKit } from '../kits/index.js';
import { AUTHORING_MODES } from '@world-forge/schema';
import type { AuthoringMode } from '@world-forge/schema';
import { MODE_PROFILES } from '../mode-profiles.js';
import { BUILTIN_REGION_PRESETS, BUILTIN_ENCOUNTER_PRESETS } from '../presets/index.js';
import { MODAL_OVERLAY, MODAL_CARD } from './shared.js';

interface Props {
  kit: StarterKit;
  onClose: () => void;
}

const GUIDE_STEP_KEYS = ['district', 'zone', 'spawn', 'player', 'npc'] as const;

export function EditKitModal({ kit, onClose }: Props) {
  const updateKit = useKitStore((s) => s.updateKit);

  const [name, setName] = useState(kit.name);
  const [description, setDescription] = useState(kit.description);
  const [icon, setIcon] = useState(kit.icon);
  const [modes, setModes] = useState<AuthoringMode[]>([...kit.modes]);
  const [tagsInput, setTagsInput] = useState(kit.tags.join(', '));
  const [regionRefs, setRegionRefs] = useState<string[]>([...kit.presetRefs.region]);
  const [encounterRefs, setEncounterRefs] = useState<string[]>([...kit.presetRefs.encounter]);
  const [guideHints, setGuideHints] = useState<Record<string, { label: string; description: string }>>({ ...kit.guideHints } as Record<string, { label: string; description: string }>);

  const toggleMode = (m: AuthoringMode) => {
    setModes((prev) =>
      prev.includes(m) ? prev.filter((x) => x !== m) : [...prev, m],
    );
  };

  const toggleRef = (list: string[], setList: (v: string[]) => void, id: string) => {
    setList(list.includes(id) ? list.filter((x) => x !== id) : [...list, id]);
  };

  const setGuideHint = (key: string, field: 'label' | 'description', value: string) => {
    setGuideHints((prev) => ({
      ...prev,
      [key]: { label: prev[key]?.label ?? '', description: prev[key]?.description ?? '', [field]: value },
    }));
  };

  const handleSave = useCallback(() => {
    if (!name.trim()) return;
    if (modes.length === 0) return;
    const tags = tagsInput.split(',').map((t) => t.trim()).filter(Boolean);
    // Clean guide hints: remove entries where both label and description are empty
    const cleanedHints: Record<string, { label: string; description: string }> = {};
    for (const [key, val] of Object.entries(guideHints)) {
      if (val.label.trim() || val.description.trim()) {
        cleanedHints[key] = { label: val.label.trim(), description: val.description.trim() };
      }
    }
    updateKit(kit.id, {
      name: name.trim(),
      description: description.trim(),
      icon,
      modes,
      tags,
      presetRefs: { region: regionRefs, encounter: encounterRefs },
      guideHints: cleanedHints,
    });
    onClose();
  }, [name, description, icon, modes, tagsInput, regionRefs, encounterRefs, guideHints, kit.id, updateKit, onClose]);

  return (
    <div style={MODAL_OVERLAY}>
      <div style={MODAL_CARD(480)}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ margin: 0, color: '#c9d1d9', fontSize: 16 }}>Edit Kit</h2>
          <button onClick={onClose} style={closeBtnStyle}>&times;</button>
        </div>

        {/* Name */}
        <label style={labelStyle}>Name</label>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} placeholder="Kit name" />

        {/* Description */}
        <label style={labelStyle}>Description</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          style={{ ...inputStyle, minHeight: 50, resize: 'vertical' }}
          placeholder="What this kit is for..."
        />

        {/* Icon */}
        <label style={labelStyle}>Icon</label>
        <input value={icon} onChange={(e) => setIcon(e.target.value)} style={{ ...inputStyle, width: 60 }} maxLength={2} />

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
        <input value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} style={inputStyle} placeholder="e.g. fantasy, dungeon" />

        {/* Region Preset Refs */}
        <label style={labelStyle}>Region Presets</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 100, overflow: 'auto' }}>
          {BUILTIN_REGION_PRESETS.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#c9d1d9', cursor: 'pointer' }}>
              <input type="checkbox" checked={regionRefs.includes(p.id)} onChange={() => toggleRef(regionRefs, setRegionRefs, p.id)} />
              {p.name}
            </label>
          ))}
        </div>

        {/* Encounter Preset Refs */}
        <label style={labelStyle}>Encounter Presets</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 100, overflow: 'auto' }}>
          {BUILTIN_ENCOUNTER_PRESETS.map((p) => (
            <label key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#c9d1d9', cursor: 'pointer' }}>
              <input type="checkbox" checked={encounterRefs.includes(p.id)} onChange={() => toggleRef(encounterRefs, setEncounterRefs, p.id)} />
              {p.name}
            </label>
          ))}
        </div>

        {/* Guide Hints */}
        <label style={labelStyle}>Guide Hints (optional)</label>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 150, overflow: 'auto' }}>
          {GUIDE_STEP_KEYS.map((key) => (
            <div key={key} style={{ background: '#0d1117', border: '1px solid #21262d', borderRadius: 4, padding: 6 }}>
              <div style={{ fontSize: 10, color: '#58a6ff', marginBottom: 4, textTransform: 'capitalize' }}>{key}</div>
              <input
                value={guideHints[key]?.label ?? ''}
                onChange={(e) => setGuideHint(key, 'label', e.target.value)}
                placeholder="Label override"
                style={{ ...inputStyle, fontSize: 11, marginBottom: 4 }}
              />
              <input
                value={guideHints[key]?.description ?? ''}
                onChange={(e) => setGuideHint(key, 'description', e.target.value)}
                placeholder="Description override"
                style={{ ...inputStyle, fontSize: 11 }}
              />
            </div>
          ))}
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
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
            Save Changes
          </button>
        </div>
      </div>
    </div>
  );
}

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
