import { useState, useMemo } from 'react';
import { useProjectStore } from '../store/project-store.js';
import { useEditorStore } from '../store/editor-store.js';
import type { EntityRole } from '@world-forge/schema';
import { VisibilityToggle } from './shared.js';

const ALL_ROLES: EntityRole[] = ['npc', 'enemy', 'merchant', 'quest-giver', 'companion', 'boss'];

export function EntityProperties() {
  const { project } = useProjectStore();
  const [activeRole, setActiveRole] = useState<EntityRole | 'all'>('all');

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
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Entity Placement</div>
      <p style={{ fontSize: 12, color: '#8b949e' }}>
        Click on a zone to place an entity. The entity will be created as an NPC by default.
      </p>

      {/* FT-012: Role filter pills */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4, marginBottom: 8, marginTop: 8 }}>
        {(['all', ...ALL_ROLES] as const).map((role) => (
          <button
            key={role}
            onClick={() => setActiveRole(role)}
            data-testid={`role-pill-${role}`}
            style={{
              padding: '2px 8px', fontSize: 11, borderRadius: 10, cursor: 'pointer',
              border: role === activeRole ? '1px solid var(--wf-accent, #58a6ff)' : '1px solid var(--wf-border-default, #30363d)',
              background: role === activeRole ? 'var(--wf-accent, #58a6ff)' : 'var(--wf-bg-control, #21262d)',
              color: role === activeRole ? '#fff' : 'var(--wf-text-muted, #8b949e)',
            }}
          >
            {role === 'all' ? 'All' : role} ({roleCounts[role] ?? 0})
          </button>
        ))}
      </div>

      {/* Filtered entity list */}
      <div style={{ fontSize: 11, color: '#8b949e', marginTop: 4 }}>
        {filteredEntities.length === 0 ? (
          <div style={{ fontStyle: 'italic', padding: '4px 0' }}>No entities{activeRole !== 'all' ? ` with role "${activeRole}"` : ''}</div>
        ) : (
          filteredEntities.map((ep) => (
            <div key={ep.entityId} style={{ padding: '2px 0', display: 'flex', gap: 6, alignItems: 'center' }}>
              <VisibilityToggle id={ep.entityId} />
              <span style={{ color: 'var(--wf-text-primary, #c9d1d9)' }}>{ep.name ?? ep.entityId}</span>
              <span style={{ color: 'var(--wf-text-hint, #484f58)', fontSize: 10 }}>{ep.role}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
