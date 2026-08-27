// import-connections.ts — ContentPack.connections → schema ZoneConnection[]

import type { ZoneConnection, ConnectionKind } from '@world-forge/schema';
import { formatConditionSpec } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';
import type { ExportedConnection } from './convert-connections.js';

const VALID_CONNECTION_KINDS = new Set<ConnectionKind>([
  'passage', 'door', 'stairs', 'road', 'portal', 'secret', 'hazard',
  'channel', 'route', 'docking', 'warp', 'trail',
]);

/**
 * Restore typed connections from the pack channel.
 *
 * Returns `null` when the pack has no connections channel (legacy pack) so
 * the caller can fall back to reconstructing unlabeled bidirectional pairs
 * from zone.neighbors.
 */
export function importConnections(
  exported: ExportedConnection[] | undefined,
): { connections: ZoneConnection[]; fidelity: FidelityEntry[]; fromPack: boolean } {
  const fidelity: FidelityEntry[] = [];
  if (!Array.isArray(exported)) {
    return { connections: [], fidelity, fromPack: false };
  }
  if (exported.length === 0) {
    return { connections: [], fidelity, fromPack: true };
  }

  const connections: ZoneConnection[] = exported.map((c) => {
    const fromZoneId = c.fromZoneId ?? (c as { from?: string }).from ?? '';
    const toZoneId = c.toZoneId ?? (c as { to?: string }).to ?? '';
    const kind: ConnectionKind | undefined =
      c.kind && VALID_CONNECTION_KINDS.has(c.kind) ? c.kind : c.kind ? undefined : 'passage';

    const conn: ZoneConnection = {
      fromZoneId,
      toZoneId,
      bidirectional: c.bidirectional !== false,
    };
    if (kind) conn.kind = kind;
    if (c.label) conn.label = c.label;
    if (c.condition) {
      const decompiled = formatConditionSpec(c.condition);
      if (decompiled !== null) {
        conn.condition = decompiled;
      } else {
        fidelity.push({
          level: 'approximated', domain: 'world', severity: 'warning',
          fieldPath: `connections.${fromZoneId}->${toZoneId}.condition`,
          message: `Connection ${fromZoneId} → ${toZoneId} condition (type '${String(c.condition.type)}') could not be decompiled back into SpawnCondition grammar — dropped on import.`,
          reason: 'connection-condition-not-expressible-in-grammar',
        });
      }
    }
    return conn;
  });

  fidelity.push({
    level: 'lossless', domain: 'world', severity: 'info',
    message: `${connections.length} connection(s) restored from pack connections[] data`,
    reason: 'connections-from-pack',
  });

  return { connections, fidelity, fromPack: true };
}
