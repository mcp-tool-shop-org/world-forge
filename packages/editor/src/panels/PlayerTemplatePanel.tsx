// PlayerTemplatePanel.tsx — player starting state editor

import { useState } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { EmptyState, useFocusHighlight } from './shared.js';
import { sectionHeader as sectionTitle, labelText as labelStyle, inputBase as inputStyle, buttonFullWidth as addBtnStyle, buttonRemove as xBtnStyle, hintText as hintStyle } from '../ui/styles.js';
import {
  createDefaultPlayerTemplate,
  isMissingSpawnPoint,
  pickDefaultSpawnPointId,
  inventoryWithItem,
  missingInventoryIds,
} from './player-template-helpers.js';

export function PlayerTemplatePanel() {
  const { project, setPlayerTemplate, updatePlayerTemplate } = useProjectStore();
  const focusRef = useFocusHighlight('player');
  const pt = project.playerTemplate;
  const defaultSpawnId = pickDefaultSpawnPointId(project.spawnPoints);
  const canCreate = defaultSpawnId != null;

  if (!pt) {
    return (
      <EmptyState
        title="Player Template"
        description={canCreate
          ? 'Defines how new players start: base stats, resources, inventory, equipment, and spawn location. Required for a playable pack.'
          : 'Place a spawn point on the map before creating a player template. An empty spawnPointId fails validation and blocks Export.'}
        actions={canCreate && defaultSpawnId
          ? [{ label: '+ Create Player Template', onClick: () => setPlayerTemplate(createDefaultPlayerTemplate(defaultSpawnId)) }]
          : []}
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
          onChange={(e) => {
            const next = e.target.value;
            if (!next) return;
            updatePlayerTemplate({ spawnPointId: next });
          }}>
          {isMissingSpawnPoint(pt.spawnPointId, project.spawnPoints) && (
            <option value="">None</option>
          )}
          {project.spawnPoints.map((sp) => (
            <option key={sp.id} value={sp.id}>{sp.id} ({sp.zoneId})</option>
          ))}
        </select>
        {project.spawnPoints.length === 0 && (
          <div style={hintStyle}>Place a spawn point on the map first.</div>
        )}
        {isMissingSpawnPoint(pt.spawnPointId, project.spawnPoints) && (
          <div style={{ ...hintStyle, color: 'var(--wf-danger-text)' }} data-testid="wf-player-missing-spawn">
            Spawn point is required. Empty spawnPointId fails validation and blocks Export.
          </div>
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
      <InventoryPicker
        inventory={pt.startingInventory}
        items={project.itemPlacements}
        onChange={(startingInventory) => updatePlayerTemplate({ startingInventory })}
      />

      <div style={sectionTitle}>Starting Equipment</div>
      <EquipmentEditor data={pt.startingEquipment} items={project.itemPlacements}
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
          <span style={{ fontSize: 11, color: 'var(--wf-text-primary)', minWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>{key}</span>
          <input style={{ ...inputStyle, width: 60, marginTop: 0, textAlign: 'center' }} type="number" value={val}
            onChange={(e) => onChange({ ...data, [key]: Number(e.target.value) })} />
          <button onClick={() => handleRemove(key)} style={xBtnStyle} title={`Remove ${key}`}>&times;</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder={placeholder}
          value={newKey} onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} style={{ ...xBtnStyle, color: 'var(--wf-success-text)', fontSize: 16 }} title="Add">+</button>
      </div>
    </div>
  );
}

function InventoryPicker({ inventory, items, onChange }: {
  inventory: string[];
  items: Array<{ itemId: string; name?: string }>;
  onChange: (next: string[]) => void;
}) {
  const missing = missingInventoryIds(inventory, items);
  if (items.length === 0) {
    return <div style={hintStyle} data-testid="wf-player-inventory-empty">Place items on the map, then pick them here.</div>;
  }
  return (
    <div style={{ marginBottom: 8 }} data-testid="wf-player-inventory-picker">
      {items.map((it) => (
        <label key={it.itemId} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginBottom: 3 }}>
          <input
            type="checkbox"
            checked={inventory.includes(it.itemId)}
            onChange={(e) => onChange(inventoryWithItem(inventory, it.itemId, e.target.checked))}
          />
          {it.name ?? it.itemId}
        </label>
      ))}
      {missing.map((id) => (
        <div key={id} style={{ ...hintStyle, color: 'var(--wf-danger-text)' }}>Missing placement: {id}</div>
      ))}
    </div>
  );
}

function EquipmentEditor({ data, items, onChange }: {
  data: Record<string, string>;
  items: Array<{ itemId: string; name?: string }>;
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
          <span style={{ fontSize: 11, color: 'var(--wf-text-primary)', minWidth: 70, overflow: 'hidden', textOverflow: 'ellipsis' }}>{slot}</span>
          <select style={{ ...inputStyle, flex: 1, marginTop: 0 }} value={itemId}
            onChange={(e) => onChange({ ...data, [slot]: e.target.value })}>
            <option value="">None</option>
            {itemId && !items.some((i) => i.itemId === itemId) && (
              <option value={itemId}>{itemId} (missing)</option>
            )}
            {items.map((i) => (
              <option key={i.itemId} value={i.itemId}>{i.name ?? i.itemId}</option>
            ))}
          </select>
          <button onClick={() => handleRemove(slot)} style={xBtnStyle} title={`Remove ${slot}`}>&times;</button>
        </div>
      ))}
      <div style={{ display: 'flex', gap: 4, marginTop: 6 }}>
        <input style={{ ...inputStyle, flex: 1, marginTop: 0 }} placeholder="e.g. weapon, armor, charm"
          value={newSlot} onChange={(e) => setNewSlot(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleAdd()} />
        <button onClick={handleAdd} style={{ ...xBtnStyle, color: 'var(--wf-success-text)', fontSize: 16 }} title="Add slot">+</button>
      </div>
    </div>
  );
}
