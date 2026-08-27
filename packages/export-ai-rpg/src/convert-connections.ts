// convert-connections.ts — WorldProject.connections → ContentPack.connections
//
// F-2d93b8d0: typed edges (kind / bidirectional / compiled condition / label)
// were listed in DROPPED_CONTAINERS. convertZones only copies Zone.neighbors,
// so traversal-core saw an untyped graph and import reconstructed unlabeled
// bidirectional pairs. Sibling Godot/Unreal lanes already ship this converter.

import type { WorldProject, ConnectionKind } from '@world-forge/schema';
import { parseSpawnCondition } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

const VALID_CONNECTION_KINDS = new Set<ConnectionKind>([
  'passage', 'door', 'stairs', 'road', 'portal', 'secret', 'hazard',
  'channel', 'route', 'docking', 'warp', 'trail',
]);

/** One typed inter-zone edge. Condition is compiled SpawnCondition, never raw author syntax. */
export interface ExportedConnection {
  fromZoneId: string;
  toZoneId: string;
  kind: ConnectionKind;
  bidirectional: boolean;
  label?: string;
  condition?: { type: string; params: Record<string, string | number | boolean> };
}

/**
 * Convert project.connections → ContentPack.connections.
 *
 * Unparseable conditions are warned and dropped (same discipline as
 * convert-placements / convert-zones exits). The edge itself survives:
 * "these zones are linked" is a separate claim from "…under condition X".
 *
 * Missing `kind` defaults to `'passage'` with an approximated fidelity entry.
 */
export function convertConnections(
  project: WorldProject,
  warnings?: string[],
  fidelity?: FidelityEntry[],
): ExportedConnection[] {
  return project.connections.map((c) => {
    let kind: ConnectionKind = 'passage';
    if (c.kind && VALID_CONNECTION_KINDS.has(c.kind)) {
      kind = c.kind;
    } else if (c.kind === undefined) {
      fidelity?.push({
        domain: 'world',
        level: 'approximated',
        severity: 'info',
        fieldPath: `connections.${c.fromZoneId}->${c.toZoneId}.kind`,
        message: `Connection ${c.fromZoneId} → ${c.toZoneId} defaulted kind to "passage".`,
        reason: 'connection-kind-defaulted',
      });
    } else {
      const msg = `Connection ${c.fromZoneId} → ${c.toZoneId} has unrecognized kind '${String(c.kind)}' — defaulting to 'passage'.`;
      warnings?.push(msg);
      fidelity?.push({
        domain: 'world',
        level: 'approximated',
        severity: 'warning',
        fieldPath: `connections.${c.fromZoneId}->${c.toZoneId}.kind`,
        message: msg,
        reason: 'connection-kind-unrecognized',
      });
    }

    const record: ExportedConnection = {
      fromZoneId: c.fromZoneId,
      toZoneId: c.toZoneId,
      kind,
      bidirectional: c.bidirectional,
    };
    if (c.label) record.label = c.label;

    if (c.condition) {
      const parsed = parseSpawnCondition(c.condition);
      if (parsed === null) {
        const msg =
          `Connection ${c.fromZoneId} → ${c.toZoneId} has a condition "${c.condition}" that is not ` +
          `valid SpawnCondition grammar — the edge is exported WITHOUT a condition. Valid forms include ` +
          `"always", "never", "item:<id>", "flag:<id>", "level:>=5", "party-size:>=3", "time:day".`;
        warnings?.push(msg);
        fidelity?.push({
          domain: 'world',
          level: 'approximated',
          severity: 'warning',
          fieldPath: `connections.${c.fromZoneId}->${c.toZoneId}.condition`,
          message: msg,
          reason: 'connection-condition-unparseable',
        });
      } else {
        record.condition = { type: parsed.type, params: parsed.params ?? {} };
      }
    }

    return record;
  });
}
