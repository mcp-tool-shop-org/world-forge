// PlayerTemplatePanel.tsx — player starting state editor

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { EmptyState, useFocusHighlight, sectionTitle, labelStyle, inputStyle, addBtnStyle, xBtnStyle, hintStyle } from './shared.js';
import type { PlayerTemplate } from '@world-forge/schema';

function createDefaultTemplate(): PlayerTemplate {
  return {
    name: 'Wanderer',
    baseStats: { vigor: 3, instinct: 3, will: 3 },
    baseResources: { hp: 10, stamina: 5 },
    startingInventory: [],
    startingEquipment: {},
    spawnPointId: '',
    tags: [],
    custom: {},
  };
}

export function PlayerTemplatePanel() {
  const { project, setPlayerTemplate, updatePlayerTemplate } = useProjectStore();
  const focusRef = useFocusHighlight('player');
  const pt = project.playerTemplate;

  if (!pt) {
    return (
      <EmptyState
        title="Player Template"
        description="Defines how new players start: base stats, resources, inventory, equipment, and spawn location. Required for a playable pack."
        actions={[
          { label: '+ Create Player Template', onClick: () => setPlayerTemplate(createDefaultTemplate()) },
        ]}
      />
    );
  }

  return (
    <div ref={focusRef}>
      {/* Identity */}
      <div style={sectionTitle}>Identity</div>
      <label style={labelStyle}>Name
        <input style={inputStyle} value={pt.name} placeholder="e.g. Wanderer"
          onChange={(e) => updatePlayerTemplate({ name: e.target.value })} />
      </label>
      <label style={labelStyle}>Spawn Point
        <select style={inputStyle} value={pt.spawnPointId}
          onChange={(e) => updatePlayerTemplate({ spawnPointId: e.target.value })}>
          <option value="">None</option>
          {project.spawnPoints.map((sp) => (
            <option key={sp.id} value={sp.id}>{sp.id} ({sp.zoneId})</option>
          ))}
        </select>
        {project.spawnPoints.length === 0 && (
          <div style={hintStyle}>Place a spawn point on the map first.</div>
        )}
      </label>
      <label style={labelStyle}>Tags
        <input style={inputStyle} value={pt.tags.join(', ')} placeholder="e.g. newcomer, mortal"
          onChange={(e) => updatePlayerTemplate({
            tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
          })} />
        <div style={hintStyle}>Comma-separated. Used by conditions and effects.</div>
      </label>

      {/* Build defaults */}
      <div style={sectionTitle}>Build Defaults</div>
      <label style={labelStyle}>Default Archetype
        <select style={inputStyle} value={pt.defaultArchetypeId ?? ''}
          onChange={(e) => updatePlayerTemplate({ defaultArchetypeId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.buildCatalog?.archetypes.map((a) => (
            <option key={a.id} value={a.id}>{a.name}</option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>Default Background
        <select style={inputStyle} value={pt.defaultBackgroundId ?? ''}
          onChange={(e) => updatePlayerTemplate({ defaultBackgroundId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.buildCatalog?.backgrounds.map((b) => (
            <option key={b.id} value={b.id}>{b.name}</option>
          ))}
        </select>
      </label>

      {/* Stats & Resources */}
      <div style={sectionTitle}>Base Stats</div>
      <KeyValueEditor data={pt.baseStats} placeholder="e.g. charisma"
        onChange={(baseStats) => updatePlayerTemplate({ baseStats })} />

      <div style={sectionTitle}>Base Resources</div>
      <KeyValueEditor data={pt.baseResources} placeholder="e.g. mana"
        onChange={(baseResources) => updatePlayerTemplate({ baseResources })} />

      {/* Inventory & Equipment */}
      <div style={sectionTitle}>Starting Inventory</div>
      <label style={labelStyle}>
        <input style={inputStyle} value={pt.startingInventory.join(', ')} placeholder="e.g. torch, healing-herb"
          onChange={(e) => updatePlayerTemplate({
            startingInventory: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
          })} />
        <div style={hintStyle}>Comma-separated item IDs from your item placements.</div>
      </label>

      <div style={sectionTitle}>Starting Equipment</div>
      <EquipmentEditor data={pt.startingEquipment}
        onChange={(startingEquipment) => updatePlayerTemplate({ startingEquipment })} />
    </div>
  );
}

function KeyValueEditor({ data, placeholder, onChange }: {
  data: Record<string, number>;
  placeholder: string;
  onChange: (updated: Record<string, number>) => void;
}) {
  const [newKey, setNewKey] = useState('');
  const entries = Object.entries(data);

  const handleAdd = () => {
    if (!newKey || newKey in data) return;
    onChange({ ...data, [newKey]: 0 });
    setNewKey('');
  };

  const handleRemove = (key: string) => {
    const { [key]: _, ...rest } = data;
    onChange(rest);
  };

  return (
    <div style={{ marginBottom: 4 }}>
      {entries.map(([key, val]) => (
        <div key={key} style={{ display: 'flex', gap: 6, marginBottom: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#c9d1d9', minWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>{key}</span>
          <input style={{ ...inputStyle, width: 60, marginTop: 0, textAlign: 'center' }} type="number" value={val}
            onChange={(e) => onChange({ ...data, [key]: Number(e.target.value) })} />
          <button onClick={() => handleRemove(key)} style={xBtnStyle} title={`Remove ${key}`}>&times;</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder={placeholder}
          value={newKey} onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} style={{ ...xBtnStyle, color: '#3fb950', fontSize: 16 }} title="Add">+</button>
      </div>
    </div>
  );
}

function EquipmentEditor({ data, onChange }: {
  data: Record<string, string>;
  onChange: (updated: Record<string, string>) => void;
}) {
  const [newSlot, setNewSlot] = useState('');
  const entries = Object.entries(data);

  const handleAdd = () => {
    if (!newSlot || newSlot in data) return;
    onChange({ ...data, [newSlot]: '' });
    setNewSlot('');
  };

  const handleRemove = (key: string) => {
    const { [key]: _, ...rest } = data;
    onChange(rest);
  };

  return (
    <div style={{ marginBottom: 4 }}>
      {entries.length === 0 && <div style={hintStyle}>No equipment slots. Add one below.</div>}
      {entries.map(([slot, itemId]) => (
        <div key={slot} style={{ display: 'flex', gap: 6, marginBottom: 3, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#c9d1d9', minWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot}</span>
          <input style={{ ...inputStyle, flex: 1, marginTop: 0 }} value={itemId} placeholder="item ID"
            onChange={(e) => onChange({ ...data, [slot]: e.target.value })} />
          <button onClick={() => handleRemove(slot)} style={xBtnStyle} title={`Remove ${slot}`}>&times;</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder="e.g. weapon, armor, charm"
          value={newSlot} onChange={(e) => setNewSlot(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} style={{ ...xBtnStyle, color: '#3fb950', fontSize: 16 }} title="Add slot">+</button>
      </div>
    </div>
  );
}
