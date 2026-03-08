// PlayerTemplatePanel.tsx — player starting state editor

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
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
  const pt = project.playerTemplate;

  if (!pt) {
    return (
      <div>
        <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>Player Template</div>
        <div style={{ fontSize: 12, color: '#8b949e', marginBottom: 8 }}>No player template defined.</div>
        <button onClick={() => setPlayerTemplate(createDefaultTemplate())} style={addBtnStyle}>
          + Create Player Template
        </button>
      </div>
    );
  }

  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 8 }}>Player Template</div>

      <label style={labelStyle}>Name
        <input style={inputStyle} value={pt.name}
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
      </label>

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

      <KeyValueEditor
        label="Base Stats"
        data={pt.baseStats}
        onChange={(baseStats) => updatePlayerTemplate({ baseStats })}
      />

      <KeyValueEditor
        label="Base Resources"
        data={pt.baseResources}
        onChange={(baseResources) => updatePlayerTemplate({ baseResources })}
      />

      <label style={labelStyle}>Starting Inventory (item IDs, comma-separated)
        <input style={inputStyle} value={pt.startingInventory.join(', ')}
          onChange={(e) => updatePlayerTemplate({
            startingInventory: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
          })} />
      </label>

      <EquipmentEditor
        data={pt.startingEquipment}
        onChange={(startingEquipment) => updatePlayerTemplate({ startingEquipment })}
      />

      <label style={labelStyle}>Tags (comma-separated)
        <input style={inputStyle} value={pt.tags.join(', ')}
          onChange={(e) => updatePlayerTemplate({
            tags: e.target.value.split(',').map((s) => s.trim()).filter(Boolean),
          })} />
      </label>
    </div>
  );
}

/** Reusable key-value editor for Record<string, number>. */
function KeyValueEditor({ label, data, onChange }: {
  label: string;
  data: Record<string, number>;
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
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>{label}</div>
      {entries.map(([key, val]) => (
        <div key={key} style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#c9d1d9', minWidth: 60 }}>{key}</span>
          <input style={{ ...inputStyle, width: 60, marginTop: 0 }} type="number" value={val}
            onChange={(e) => onChange({ ...data, [key]: Number(e.target.value) })} />
          <button onClick={() => handleRemove(key)} style={xBtnStyle}>&times;</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <input style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder="new key"
          value={newKey} onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} style={xBtnStyle}>+</button>
      </div>
    </div>
  );
}

/** Equipment slot editor for Record<string, string>. */
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
    <div style={{ marginBottom: 8 }}>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Starting Equipment</div>
      {entries.map(([slot, itemId]) => (
        <div key={slot} style={{ display: 'flex', gap: 4, marginBottom: 2, alignItems: 'center' }}>
          <span style={{ fontSize: 11, color: '#c9d1d9', minWidth: 60 }}>{slot}</span>
          <input style={{ ...inputStyle, flex: 1, marginTop: 0 }} value={itemId}
            onChange={(e) => onChange({ ...data, [slot]: e.target.value })} />
          <button onClick={() => handleRemove(slot)} style={xBtnStyle}>&times;</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 4 }}>
        <input style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder="slot name"
          value={newSlot} onChange={(e) => setNewSlot(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} style={xBtnStyle}>+</button>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = { display: 'block', fontSize: 12, marginBottom: 6 };
const inputStyle: React.CSSProperties = {
  display: 'block', width: '100%', background: '#0d1117', color: '#c9d1d9',
  border: '1px solid #30363d', borderRadius: 3, padding: '3px 6px', fontSize: 12, marginTop: 2,
};
const addBtnStyle: React.CSSProperties = {
  fontSize: 11, background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 3, cursor: 'pointer', padding: '4px 10px', width: '100%',
};
const xBtnStyle: React.CSSProperties = {
  background: 'transparent', border: 'none', color: '#f85149',
  cursor: 'pointer', fontSize: 14, padding: '0 4px',
};
