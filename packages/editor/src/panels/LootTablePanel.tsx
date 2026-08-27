import type { CSSProperties } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { nextId } from '../ids.js';
import type { ItemRarity, LootTable } from '@world-forge/schema';
import { validateSpawnCondition } from '@world-forge/schema';
import { PanelHeader, EmptyState, useFocusHighlight } from './shared.js';
import { buttonBase } from '../ui/styles.js';
import {
  ITEM_RARITIES, defaultLootTable,
  withAddedLootTable, withUpdatedLootTable, withRemovedLootTable,
  withLootEntry, withAddedLootEntry, withRemovedLootEntry,
  parseQuantity, emptyToUndef,
} from './item-loot-transition-helpers.js';

const card: CSSProperties = { border: '1px solid var(--wf-border-default)', borderRadius: 4, padding: 6, marginBottom: 6, background: 'var(--wf-bg-panel)' };
const rowHead: CSSProperties = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 };
const lbl: CSSProperties = { display: 'block', fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 };
const inp: CSSProperties = { width: '100%', boxSizing: 'border-box', fontSize: 12, padding: '3px 5px', background: 'var(--wf-bg-app)', color: 'var(--wf-text-primary)', border: '1px solid var(--wf-border-default)', borderRadius: 3, marginTop: 2 };
const addBtn: CSSProperties = { ...buttonBase, padding: '3px 8px', fontSize: 11, borderRadius: 3 };
const delBtn: CSSProperties = { ...buttonBase, padding: '0 6px', fontSize: 12 };
const grid2: CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 };
const entryCard: CSSProperties = { border: '1px solid var(--wf-border-default)', borderRadius: 3, padding: 5, marginBottom: 4, background: 'var(--wf-bg-app)' };

/**
 * LootTablePanel — project-level weighted drop pools. Composed from
 * HazardLibraryPanel (Map tab when no zone is selected). Mutates via
 * updateProject; addLootTable lives in editor-core when present.
 */
export function LootTablePanel() {
  const { project, updateProject } = useProjectStore();
  const focusRef = useFocusHighlight('loot');
  const tables = project.lootTables ?? [];
  const itemIds = project.itemPlacements.map((i) => i.itemId);

  const add = () => updateProject((p) => withAddedLootTable(p, defaultLootTable(nextId('loot'))), 'Add loot table');
  const patch = (id: string, updates: Partial<LootTable>) =>
    updateProject((p) => withUpdatedLootTable(p, id, updates), 'Update loot table');
  const remove = (id: string) => updateProject((p) => withRemovedLootTable(p, id), 'Delete loot table');

  return (
    <div ref={focusRef} style={{ marginTop: 12 }} data-testid="wf-loot-table-panel">
      <PanelHeader title="Loot Tables" badge={tables.length} />
      {tables.length === 0 && (
        <EmptyState
          title="No loot tables"
          description="Author weighted drop pools (rolls, item weight, quantity, condition, rarity)."
          icon={'\u25C8'}
        />
      )}
      {tables.map((t) => (
        <div key={t.id} style={card} data-testid={`wf-loot-card-${t.id}`}>
          <div style={rowHead}>
            <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>{t.id}</span>
            <button title="Remove loot table" style={delBtn} onClick={() => remove(t.id)}>×</button>
          </div>
          <label style={lbl}>Rolls
            <input style={inp} type="number" min={1} value={t.rolls ?? 1}
              onChange={(e) => patch(t.id, { rolls: Math.max(1, Number(e.target.value) || 1) })} />
          </label>
          <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', margin: '6px 0 3px' }}>Entries ({t.entries.length})</div>
          {t.entries.map((entry, i) => {
            const condErr = entry.condition ? validateSpawnCondition(entry.condition) : null;
            return (
              <div key={i} style={entryCard}>
                <div style={rowHead}>
                  <span style={{ fontSize: 10, color: 'var(--wf-text-muted)' }}>entry {i + 1}</span>
                  <button title="Remove entry" style={delBtn} disabled={t.entries.length <= 1}
                    onClick={() => patch(t.id, withRemovedLootEntry(t, i))}>×</button>
                </div>
                <label style={lbl}>Item id
                  <input style={inp} value={entry.itemId} list="wf-loot-item-ids"
                    onChange={(e) => patch(t.id, withLootEntry(t, i, { itemId: e.target.value }))} />
                </label>
                <div style={grid2}>
                  <label style={lbl}>Weight
                    <input style={inp} type="number" min={0} step={0.1} value={entry.weight}
                      onChange={(e) => patch(t.id, withLootEntry(t, i, { weight: Number(e.target.value) || 0 }))} />
                  </label>
                  <label style={lbl}>Rarity
                    <select style={inp} value={entry.rarity ?? ''}
                      onChange={(e) => patch(t.id, withLootEntry(t, i, { rarity: (e.target.value || undefined) as ItemRarity | undefined }))}>
                      <option value="">—</option>
                      {ITEM_RARITIES.map((r) => <option key={r} value={r}>{r}</option>)}
                    </select>
                  </label>
                </div>
                <div style={grid2}>
                  <label style={lbl}>Qty min
                    <input style={inp} type="number" min={0} value={entry.quantity?.min ?? ''}
                      onChange={(e) => patch(t.id, withLootEntry(t, i, {
                        quantity: parseQuantity(e.target.value, String(entry.quantity?.max ?? e.target.value)),
                      }))} />
                  </label>
                  <label style={lbl}>Qty max
                    <input style={inp} type="number" min={0} value={entry.quantity?.max ?? ''}
                      onChange={(e) => patch(t.id, withLootEntry(t, i, {
                        quantity: parseQuantity(String(entry.quantity?.min ?? e.target.value), e.target.value),
                      }))} />
                  </label>
                </div>
                <label style={lbl}>Condition
                  <input style={{ ...inp, borderColor: condErr ? 'var(--wf-danger-text)' : undefined }}
                    value={entry.condition ?? ''} placeholder="always / item:key"
                    onChange={(e) => patch(t.id, withLootEntry(t, i, { condition: emptyToUndef(e.target.value) }))} />
                  {condErr && <div style={{ fontSize: 10, color: 'var(--wf-danger-text)' }} title={condErr}>⚠ unrecognized condition</div>}
                </label>
              </div>
            );
          })}
          <button style={addBtn} onClick={() => patch(t.id, withAddedLootEntry(t))}>+ Add entry</button>
        </div>
      ))}
      <datalist id="wf-loot-item-ids">
        {itemIds.map((id) => <option key={id} value={id} />)}
      </datalist>
      <button style={addBtn} data-testid="wf-add-loot-table" onClick={add}>+ Add loot table</button>
    </div>
  );
}
