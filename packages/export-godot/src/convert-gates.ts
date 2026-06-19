/**
 * convert-gates.ts — WorldProject zone entry gates → Godot zone metadata.
 *
 * Entry gates are zone-attached: a gated zone simply carries its gate as metadata
 * on its zone node (no dedicated gate node exists in Godot — the runtime reads the
 * metadata and evaluates the conditions against party state on entry, surfacing
 * the reason when unmet). This converter resolves the per-zone gate map; the
 * actual metadata lines are emitted by scene-builder on each zone node.
 */

import type { WorldProject } from '@world-forge/schema';
import type { FidelityEntry } from './fidelity.js';

export interface GodotZoneGate {
    zoneId: string;
    conditions: string[];
    mode: string;
    reason?: string;
}

export interface ConvertGatesResult {
    /** zoneId → its entry gate (for metadata on the zone node). */
    zoneGates: Record<string, GodotZoneGate>;
    fidelity: FidelityEntry[];
}

export function convertGates(project: WorldProject): ConvertGatesResult {
    const zoneGates: Record<string, GodotZoneGate> = {};
    let count = 0;

    for (const z of project.zones) {
        const gate = z.entryGate;
        if (!gate) continue;
        zoneGates[z.id] = {
            zoneId: z.id,
            conditions: gate.conditions.slice(),
            mode: gate.mode,
            reason: gate.reason,
        };
        count++;
    }

    const fidelity: FidelityEntry[] = [];
    if (count > 0) {
        fidelity.push({
            level: 'approximated',
            domain: 'structures',
            severity: 'info',
            fieldPath: 'zones.entryGate',
            message: `${count} zone entry gate(s) exported as zone metadata (entry_gate conditions + mode + reason); the runtime evaluates them against party state on entry.`,
            reason: 'Godot has no dedicated gate node; the gate rides as metadata on the zone node and the runtime allows/denies entry from it.',
        });
    }

    return { zoneGates, fidelity };
}
