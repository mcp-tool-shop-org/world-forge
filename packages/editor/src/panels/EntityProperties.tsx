import type { EntityRole } from '@world-forge/schema';

const roles: EntityRole[] = ['npc', 'enemy', 'merchant', 'quest-giver', 'companion', 'boss'];

export function EntityProperties() {
  return (
    <div>
      <div style={{ fontSize: 11, color: '#8b949e', marginBottom: 4 }}>Entity Placement</div>
      <p style={{ fontSize: 12, color: '#8b949e' }}>
        Click on a zone to place an entity. The entity will be created as an NPC by default.
      </p>
      <div style={{ fontSize: 11, color: '#8b949e', marginTop: 8 }}>Available roles:</div>
      {roles.map((r) => (
        <div key={r} style={{ fontSize: 12, padding: '2px 0' }}>{r}</div>
      ))}
    </div>
  );
}
