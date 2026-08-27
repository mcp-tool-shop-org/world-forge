import { useState, useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import type { EntityPlacement, EntityRole } from '@world-forge/schema';
import { PanelHeader, VisibilityToggle } from './shared.js';
import { labelText, inputCompact, buttonDangerFull as deleteBtnStyle } from '../ui/styles.js';
import {
  ALL_ROLES, parseCsv, formatCsv, parseNamedNumbers, formatNamedNumbers,
  emptyToUndef, spawnConditionMessage,
} from './entity-properties-helpers.js';

const labelStyle: React.CSSProperties = labelText;
const inputStyle: React.CSSProperties = inputCompact;

export function EntityProperties() {
  const { project, updateEntity, removeEntity } = useProjectStore();
  const { selection, activeTool, clearSelection, selectEntity } = useEditorStore();
  const [activeRole, setActiveRole] = useState<EntityRole | 'all'>('all');

  const entityId = selection.entities.length === 1 ? selection.entities[0] : null;
  const entity = entityId ? project.entityPlacements.find((e) => e.entityId === entityId) : null;

  if (entity) {
    return <EntityInspector entity={entity} onDelete={() => { removeEntity(entity.entityId); clearSelection(); }} />;
  }

  if (activeTool !== 'entity-place') return null;

  return (
    <EntityPlacePalette
      activeRole={activeRole}
      setActiveRole={setActiveRole}
      onSelect={(id) => selectEntity(id, false)}
    />
  );
}

function EntityInspector({ entity, onDelete }: { entity: EntityPlacement; onDelete: () => void }) {
  const { project, updateEntity } = useProjectStore();
  const zone = project.zones.find((z) => z.id === entity.zoneId);
  const condErr = spawnConditionMessage(entity.spawnCondition);
  const patch = (updates: Partial<EntityPlacement>) => updateEntity(entity.entityId, updates);

  return (
    <div data-testid="wf-entity-inspector">
      <PanelHeader title="Entity Properties" actions={<VisibilityToggle id={entity.entityId} />} />
      <label style={labelStyle}>ID
        <input style={inputStyle} value={entity.entityId} readOnly />
      </label>
      <label style={labelStyle}>Zone
        <input style={inputStyle} value={zone?.name ?? entity.zoneId} readOnly />
        {!zone && <span style={{ color: 'var(--wf-danger-text)', fontSize: 11 }}>Zone deleted</span>}
      </label>
      <label style={labelStyle}>Name
        <input style={inputStyle} value={entity.name ?? ''}
          onChange={(e) => patch({ name: emptyToUndef(e.target.value) })} />
      </label>
      <label style={labelStyle}>Role
        <select style={inputStyle} value={entity.role} data-testid="wf-entity-role"
          onChange={(e) => patch({ role: e.target.value as EntityRole })}>
          {ALL_ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
        </select>
      </label>
      <label style={labelStyle}>Dialogue
        <select style={inputStyle} value={entity.dialogueId ?? ''} data-testid="wf-entity-dialogue"
          onChange={(e) => patch({ dialogueId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.dialogues.map((d) => <option key={d.id} value={d.id}>{d.id}</option>)}
        </select>
      </label>
      <label style={labelStyle}>Faction
        <select style={inputStyle} value={entity.factionId ?? ''}
          onChange={(e) => patch({ factionId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.factionPresences.map((f) => <option key={f.factionId} value={f.factionId}>{f.factionId}</option>)}
        </select>
      </label>
      <label style={labelStyle}>Spawn condition
        <input style={{ ...inputStyle, borderColor: condErr ? 'var(--wf-danger-text)' : undefined }}
          value={entity.spawnCondition ?? ''} placeholder="always / random:0.3 / time:night"
          data-testid="wf-entity-spawn-condition"
          onChange={(e) => patch({ spawnCondition: emptyToUndef(e.target.value) })} />
        {condErr && <div style={{ fontSize: 10, color: 'var(--wf-danger-text)' }} title={condErr}>⚠ unrecognized condition</div>}
      </label>
      <label style={labelStyle}>Stats (name:value, comma-separated)
        <input style={inputStyle} value={formatNamedNumbers(entity.stats)} placeholder="vigor:3, instinct:2"
          onChange={(e) => {
            const stats = parseNamedNumbers(e.target.value);
            patch({ stats: Object.keys(stats).length ? stats : undefined });
          }} />
      </label>
      <label style={labelStyle}>Resources (name:value, comma-separated)
        <input style={inputStyle} value={formatNamedNumbers(entity.resources)} placeholder="hp:10, stamina:5"
          onChange={(e) => {
            const resources = parseNamedNumbers(e.target.value);
            patch({ resources: Object.keys(resources).length ? resources : undefined });
          }} />
      </label>
      <label style={labelStyle}>Tags (comma-separated)
        <input style={inputStyle} value={formatCsv(entity.tags)}
          onChange={(e) => patch({ tags: parseCsv(e.target.value) })} />
      </label>
      <label style={labelStyle}>Portrait
        <select style={inputStyle} value={entity.portraitId ?? ''}
          onChange={(e) => patch({ portraitId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.assets.filter((a) => a.kind === 'portrait').map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </label>
      <label style={labelStyle}>Sprite
        <select style={inputStyle} value={entity.spriteId ?? ''}
          onChange={(e) => patch({ spriteId: e.target.value || undefined })}>
          <option value="">None</option>
          {project.assets.filter((a) => a.kind === 'sprite').map((a) => (
            <option key={a.id} value={a.id}>{a.label}</option>
          ))}
        </select>
      </label>
      <button style={deleteBtnStyle} onClick={onDelete}>Delete Entity</button>
    </div>
  );
}

function EntityPlacePalette({
  activeRole, setActiveRole, onSelect,
}: {
  activeRole: EntityRole | 'all';
  setActiveRole: (r: EntityRole | 'all') => void;
  onSelect: (id: string) => void;
}) {
  const { project } = useProjectStore();

  const roleCounts = useMemo(() => {
    const counts: Record<string, number> = { all: project.entityPlacements.length };
    for (const role of ALL_ROLES) counts[role] = 0;
    for (const ep of project.entityPlacements) {
      if (ep.role in counts) counts[ep.role]++;
    }
    return counts;
  }, [project.entityPlacements]);

  const filteredEntities = useMemo(() => {
    if (activeRole === 'all') return project.entityPlacements;
    return project.entityPlacements.filter((ep) => ep.role === activeRole);
  }, [project.entityPlacements, activeRole]);

  return (
    <div>
      <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', marginBottom: 4 }}>Entity Placement</div>
      <p style={{ fontSize: 12, color: 'var(--wf-text-muted)' }}>
        Click on a zone to place an entity. Select an entity below to edit its properties.
      </p>

      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, marginTop: 8 }}>
        {(['all', ...ALL_ROLES] as const).map((role) => (
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            data-testid={`role-pill-${role}`}
            style={{
              padding: '2px 8px', fontSize: 11, borderRadius: 10, cursor: 'pointer',
              border: role === activeRole ? '1px solid var(--wf-accent)' : '1px solid var(--wf-border-default)',
              background: role === activeRole ? 'var(--wf-accent)' : 'var(--wf-bg-control)',
              color: role === activeRole ? '#fff' : 'var(--wf-text-muted)',
            }}
          >
            {role === 'all' ? 'All' : role} ({roleCounts[role] ?? 0})
          </button>
        ))}
      </div>

      <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', marginTop: 4 }}>
        {filteredEntities.length === 0 ? (
          <div style={{ fontStyle: 'italic', padding: '4px 0' }}>No entities{activeRole !== 'all' ? ` with role "${activeRole}"` : ''}</div>
        ) : (
          filteredEntities.map((ep) => (
            <div
              key={ep.entityId}
              role="button"
              tabIndex={0}
              data-testid={`wf-entity-row-${ep.entityId}`}
              onClick={() => onSelect(ep.entityId)}
              onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSelect(ep.entityId); } }}
              style={{ padding: '2px 0', display: 'flex', gap: 6, alignItems: 'center', cursor: 'pointer' }}
            >
              <VisibilityToggle id={ep.entityId} />
              <span style={{ color: 'var(--wf-text-primary)' }}>{ep.name ?? ep.entityId}</span>
              <span style={{ color: 'var(--wf-text-muted)', fontSize: 10 }}>{ep.role}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
