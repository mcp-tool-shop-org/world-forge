import type { CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore, getSelectedZoneId } from '../store/editor-store.js';
import { nextId } from '../ids.js';
import type { ItemRarity, ItemSlot } from '@world-forge/schema';
import { PanelHeader, EmptyState, useFocusHighlight } from './shared.js';
import { buttonBase } from '../ui/styles.js';
import {
  ITEM_SLOTS, ITEM_RARITIES, defaultItemPlacement,
  withAddedItem, withUpdatedItem, withRemovedItem,
  parseModifiers, formatNamedNumbers, parseCsv, emptyToUndef,
} from './item-loot-transition-helpers.js';

const card: CSSProperties = { border: '1px solid var(--wf-border-default)', borderRadius: 4, padding: 6, marginBottom: 6, background: 'var(--wf-bg-panel)' };
const rowHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '3px 5px', background: 'var(--wf-bg-app)', color: 'var(--wf-text-primary)', border: '1px solid var(--wf-border-default)', borderRadius: 3, marginTop: 2 };
const addBtn: CSSProperties = { ...buttonBase, padding: '3px 8px', fontSize: 11, borderRadius: 3 };
const delBtn: CSSProperties = { ...buttonBase, padding: '0 6px', fontSize: 12 };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 };

/**
 * ItemProperties — zone-scoped ItemPlacement inspector. Rendered as an
 * Economy-adjacent section (composed from EconomyPanel) because App.tsx
 * (editor-core) does not yet mount an items tab. Mutates via updateProject;
 * addItemPlacement lives in editor-core when present.
 */
export function ItemProperties() {
  const { project, updateProject } = useProjectStore();
  const { selection } = useEditorStore();
  const zoneId = getSelectedZoneId(selection);
  const focusRef = useFocusHighlight('items');
  if (!zoneId) return null;

  const items = project.itemPlacements.filter((i) => i.zoneId === zoneId);
  const lootTables = project.lootTables ?? [];
  const zone = project.zones.find((z) => z.id === zoneId);

  const add = () => updateProject((p) => withAddedItem(p, defaultItemPlacement(nextId('item'), zoneId)), 'Add item');
  const patch = (itemId: string, updates: Parameters<typeof withUpdatedItem>[2]) =>
    updateProject((p) => withUpdatedItem(p, itemId, updates), 'Update item');
  const remove = (itemId: string) => updateProject((p) => withRemovedItem(p, itemId), 'Delete item');

  return (
    <div ref={focusRef} style={{ marginTop: 12 }} data-testid="wf-item-properties">
      <PanelHeader title="Items" badge={items.length} />
      {items.length === 0 && (
        <EmptyState
          title="No items"
          description="Add an item placement to this zone (slot, rarity, loot table, modifiers)."
          icon={'\u25CE'}
        />
      )}
      {items.map((it) => (
        <div key={it.itemId} style={card} data-testid={`wf-item-card-${it.itemId}`}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{it.itemId}</span>
            <button title="Remove item" style={delBtn} onClick={() => remove(it.itemId)}>×</button>
          </div>
          <label style={lbl}>Name
            <input style={inp} value={it.name ?? ''} onChange={(e) => patch(it.itemId, { name: emptyToUndef(e.target.value) })} />
          </label>
          <label style={lbl}>Zone
            <input style={inp} value={zone?.name ?? it.zoneId} readOnly />
          </label>
          <div style={grid2}>
            <label style={lbl}>Slot
              <select style={inp} value={it.slot ?? ''} onChange={(e) => patch(it.itemId, { slot: (e.target.value || undefined) as ItemSlot | undefined })}>
                <option value="">—</option>
                {ITEM_SLOTS.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
            <label style={lbl}>Rarity
              <select style={inp} value={it.rarity ?? ''} onChange={(e) => patch(it.itemId, { rarity: (e.target.value || undefined) as ItemRarity | undefined })}>
                <option value="">—</option>
                {ITEM_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </label>
          </div>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer', marginTop: 4 }}>
            <input type="checkbox" checked={it.hidden} onChange={(e) => patch(it.itemId, { hidden: e.target.checked })} /> Hidden
          </label>
          <label style={lbl}>Container
            <input style={inp} value={it.container ?? ''} onChange={(e) => patch(it.itemId, { container: emptyToUndef(e.target.value) })} />
          </label>
          <label style={lbl}>Loot table
            <select style={inp} value={it.lootTableId ?? ''} data-testid="wf-item-loot-table"
              onChange={(e) => patch(it.itemId, { lootTableId: e.target.value || undefined })}>
              <option value="">None</option>
              {lootTables.map((t) => <option key={t.id} value={t.id}>{t.id}</option>)}
            </select>
          </label>
          <label style={lbl}>Stat modifiers (name:value)
            <input style={inp} value={formatNamedNumbers(it.statModifiers)}
              onChange={(e) => patch(it.itemId, { statModifiers: parseModifiers(e.target.value) })} />
          </label>
          <label style={lbl}>Resource modifiers (name:value)
            <input style={inp} value={formatNamedNumbers(it.resourceModifiers)}
              onChange={(e) => patch(it.itemId, { resourceModifiers: parseModifiers(e.target.value) })} />
          </label>
          <label style={lbl}>Granted tags (comma-separated)
            <input style={inp} value={(it.grantedTags ?? []).join(', ')}
              onChange={(e) => patch(it.itemId, { grantedTags: parseCsv(e.target.value) })} />
          </label>
          <label style={lbl}>Granted verbs (comma-separated)
            <input style={inp} value={(it.grantedVerbs ?? []).join(', ')}
              onChange={(e) => patch(it.itemId, { grantedVerbs: parseCsv(e.target.value) })} />
          </label>
          <label style={lbl}>Icon
            <select style={inp} value={it.iconId ?? ''}
              onChange={(e) => patch(it.itemId, { iconId: e.target.value || undefined })}>
              <option value="">None</option>
              {project.assets.filter((a) => a.kind === 'icon').map((a) => (
                <option key={a.id} value={a.id}>{a.label}</option>
              ))}
            </select>
          </label>
        </div>
      ))}
      <button style={addBtn} data-testid="wf-add-item" onClick={add}>+ Add item</button>
    </div>
  );
}
