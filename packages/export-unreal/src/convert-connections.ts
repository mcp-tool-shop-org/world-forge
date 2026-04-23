// convert-connections.ts — ZoneConnection → UE5 LevelStreamingHint

import type { WorldProject, ConnectionKind } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

/**
 * UE5 LevelStreamingHint — a cheap descriptor the runtime uses to decide
 * whether crossing a zone boundary should stream, teleport, or blend.
 */
export interface UnrealLevelStreamingHint {
  FromZoneId: string;
  ToZoneId: string;
  Kind: ConnectionKind;
  Bidirectional: boolean;
  Label?: string;
  Condition?: string;
  /** Suggested streaming behavior derived from connection kind. */
  StreamMode: 'load' | 'stream' | 'portal' | 'teleport';
}

const KIND_TO_STREAM_MODE: Record<ConnectionKind, UnrealLevelStreamingHint['StreamMode']> = {
  passage: 'stream',
  door: 'load',
  stairs: 'load',
  road: 'stream',
  portal: 'portal',
  secret: 'load',
  hazard: 'stream',
  channel: 'stream',
  route: 'stream',
  docking: 'load',
  warp: 'teleport',
  trail: 'stream',
};

const DEFAULT_STREAM_MODE: UnrealLevelStreamingHint['StreamMode'] = 'stream';

export interface ConvertConnectionsResult {
  connections: UnrealLevelStreamingHint[];
  fidelity: FidelityEntry[];
}

export function convertConnections(project: WorldProject): ConvertConnectionsResult {
  const fidelity: FidelityEntry[] = [];
  const connections: UnrealLevelStreamingHint[] = [];

  for (const c of project.connections) {
    // Kind defaults to 'passage' for round-trip completeness (matches ai-rpg exporter convention).
    const kind: ConnectionKind = c.kind ?? 'passage';
    if (c.kind === undefined) {
      fidelity.push({
        level: 'approximated',
        domain: 'connections',
        severity: 'info',
        fieldPath: `connections.${c.fromZoneId}->${c.toZoneId}.kind`,
        message: `Connection ${c.fromZoneId} → ${c.toZoneId} defaulted kind to "passage".`,
        reason: 'No kind authored; using safe default.',
      });
    }

    connections.push({
      FromZoneId: c.fromZoneId,
      ToZoneId: c.toZoneId,
      Kind: kind,
      Bidirectional: c.bidirectional,
      Label: c.label,
      Condition: c.condition,
      StreamMode: KIND_TO_STREAM_MODE[kind] ?? DEFAULT_STREAM_MODE,
    });
  }

  return { connections, fidelity };
}
