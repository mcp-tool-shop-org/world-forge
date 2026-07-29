// import-zones.ts — engine ZoneDefinition[] → schema Zone[] with auto-layout

import type { Zone } from '@world-forge/schema';
import { formatConditionSpec } from '@world-forge/schema';
import type { ZoneDefinition } from '@ai-rpg-engine/content-schema';
import type { FidelityEntry } from './fidelity.js';
import type { ExportedZone } from './convert-zones.js';

export interface ZoneLayoutOptions {
  defaultWidth?: number;
  defaultHeight?: number;
  spacing?: number;
}

export function importZones(
  // `ExportedZone`, not `ZoneDefinition`: the C3 `entryGate` field lives on
  // engine `main` and is not in the published 3.8.0 type. See ExportedEntryGate.
  engineZones: Array<ZoneDefinition | ExportedZone>,
  options?: ZoneLayoutOptions,
): { zones: Zone[]; fidelity: FidelityEntry[] } {
  const w = options?.defaultWidth ?? 6;
  const h = options?.defaultHeight ?? 5;
  const sp = options?.spacing ?? 4;
  const fidelity: FidelityEntry[] = [];

  const cols = Math.max(1, Math.ceil(Math.sqrt(engineZones.length)));
  const rows = Math.ceil(engineZones.length / cols);

  if (cols > 20 || rows > 20) {
    fidelity.push({
      level: 'approximated', domain: 'zones', severity: 'warning',
      fieldPath: 'grid-layout',
      message: `Auto-layout grid is ${cols}\u00d7${rows} — exceeds 20\u00d720 recommended maximum. Consider grouping zones into districts.`,
      reason: 'grid-exceeds-recommended-size',
    });
  }

  const zones = engineZones.map((ez, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);

    // Grid positions are auto-generated — always approximated
    fidelity.push({
      level: 'approximated', domain: 'zones', severity: 'warning',
      entityId: ez.id, fieldPath: 'gridX,gridY',
      message: `Zone '${ez.name}' grid position auto-generated`,
      reason: 'grid-auto-generated',
    });

    // Reconstruct description from TextBlock[] or string
    let description = '';
    if (ez.description) {
      if (Array.isArray(ez.description)) {
        description = ez.description.map((b: { text: string }) => b.text).join(' ');
      } else {
        description = ez.description as string;
      }
    }

    // Reconstruct interactables — engine only preserves names
    const interactables = (ez.interactables ?? []).map((name: string) => {
      fidelity.push({
        level: 'approximated', domain: 'zones', severity: 'info',
        entityId: ez.id, fieldPath: `interactables.${name}`,
        message: `Interactable '${name}' type defaulted to 'inspect'`,
        reason: 'interactable-type-defaulted',
      });
      return { name, type: 'inspect' as const };
    });

    // Reconstruct exits.
    //
    // ⚠ C3/P1 — REPAIRS A REGRESSION C1 INTRODUCED. This line read
    // `condition: e.condition?.type`, which discards `params`. Before C1 that
    // accidentally worked, because the exporter stuffed the WHOLE grammar
    // string into `type` — a garbled export and a lossy import cancelled out.
    // C1 correctly fixed the export to COMPILE through parseSpawnCondition and
    // thereby broke this side: `item:rope` exports as
    // `{ type: 'has-item', params: { id: 'rope' } }` and came back as the bare
    // string `"has-item"`, which parseSpawnCondition REJECTS. So an
    // export→import round-trip produced a project whose exit conditions fail
    // validateSpawnCondition, and nothing caught it because C1's proof was
    // one-directional (it asserted the exported shape, correctly).
    //
    // `formatConditionSpec` is the codec's inverse and re-derives the authored
    // string from the operands. A spec it cannot express yields `undefined` and
    // a fidelity entry rather than an invalid grammar string: an unparseable
    // condition that reaches a project is worse than an absent one, because
    // validateProject rejects the whole project for it.
    const exits = (ez.exits ?? []).map((e) => {
      if (e.condition === undefined) {
        return { targetZoneId: e.targetZoneId, label: e.label ?? '', condition: undefined };
      }
      const condition = formatConditionSpec(e.condition);
      if (condition === null) {
        fidelity.push({
          level: 'approximated', domain: 'zones', severity: 'warning',
          entityId: ez.id, fieldPath: `exits.${e.targetZoneId}.condition`,
          message:
            `Zone '${ez.name}' exit to '${e.targetZoneId}' carries a condition ` +
            `(type '${String((e.condition as { type?: unknown }).type)}') that the SpawnCondition ` +
            `grammar cannot express — the exit is imported without a condition.`,
          reason: 'condition-not-expressible-in-grammar',
        });
      }
      return {
        targetZoneId: e.targetZoneId,
        label: e.label ?? '',
        condition: condition ?? undefined,
      };
    });

    // C3/P2 — decompile the entry gate back to authored grammar, using the same
    // codec as the exits above. A condition the grammar cannot express is
    // dropped WITH a fidelity entry; if that leaves the gate empty, the GATE is
    // dropped rather than re-imported with no conditions — an empty AND-array is
    // vacuously true, so an empty gate silently unlocks the zone.
    let entryGate: Zone['entryGate'];
    const sourceGate = (ez as ExportedZone).entryGate;
    if (sourceGate) {
      const conditions: string[] = [];
      for (const spec of sourceGate.conditions ?? []) {
        const authored = formatConditionSpec(spec);
        if (authored === null) {
          fidelity.push({
            level: 'approximated', domain: 'zones', severity: 'warning',
            entityId: ez.id, fieldPath: 'entryGate.conditions',
            message:
              `Zone '${ez.name}' entryGate carries a condition (type '${String((spec as { type?: unknown }).type)}') ` +
              `that the SpawnCondition grammar cannot express — it was dropped from the imported gate.`,
            reason: 'condition-not-expressible-in-grammar',
          });
          continue;
        }
        conditions.push(authored);
      }
      if (conditions.length > 0) {
        entryGate = {
          conditions,
          mode: sourceGate.mode,
          ...(sourceGate.reason !== undefined ? { reason: sourceGate.reason } : {}),
        };
      } else {
        fidelity.push({
          level: 'approximated', domain: 'zones', severity: 'warning',
          entityId: ez.id, fieldPath: 'entryGate',
          message:
            `Zone '${ez.name}' entryGate had no expressible conditions, so the GATE was dropped rather than ` +
            `imported empty — an empty condition list reads as "no requirements" and would unlock the zone.`,
          reason: 'entry-gate-dropped-no-expressible-conditions',
        });
      }
    }

    return {
      id: ez.id,
      name: ez.name,
      tags: [...(ez.tags ?? [])],
      description,
      gridX: col * (w + sp),
      gridY: row * (h + sp),
      gridWidth: w,
      gridHeight: h,
      neighbors: [...(ez.neighbors ?? [])],
      exits,
      light: ez.light ?? 5,
      noise: ez.noise ?? 3,
      hazards: [...(ez.hazards ?? [])],
      interactables,
      ...(entryGate !== undefined ? { entryGate } : {}),
    };
  });

  return { zones, fidelity };
}
