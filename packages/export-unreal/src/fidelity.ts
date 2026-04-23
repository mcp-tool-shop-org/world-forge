/**
 * fidelity.ts — Structured export fidelity reporting for the Unreal target.
 *
 * Mirrors the shape of `@world-forge/export-ai-rpg/fidelity` on purpose — a future
 * cross-lane comparison can normalize both into a shared report format.
 *
 * An Unreal export is "lossless" when every WorldProject field lands in the
 * generated UnrealContentPack without approximation. Anything dropped or
 * heuristically reconstructed is recorded here so the UE5 loader and the user
 * both know what to expect.
 */

export type FidelityLevel = 'lossless' | 'approximated' | 'dropped';
export type FidelitySeverity = 'info' | 'warning' | 'error';
export type FidelityDomain =
  | 'zones' | 'districts' | 'entities' | 'items'
  | 'connections' | 'world-partition' | 'assets' | 'parallax'
  | 'elevation' | 'skyline' | 'dialogues' | 'world'
  | 'lighting' | 'collision' | 'physics' | 'transitions';

export interface FidelityEntry {
  level: FidelityLevel;
  domain: FidelityDomain;
  severity: FidelitySeverity;
  entityId?: string;
  fieldPath?: string;
  message: string;
  reason: string;
}

export interface DomainSummary {
  total: number;
  lossless: number;
  approximated: number;
  dropped: number;
}

export interface FidelitySummary {
  total: number;
  lossless: number;
  approximated: number;
  dropped: number;
  losslessPercent: number;
  byDomain: Partial<Record<FidelityDomain, DomainSummary>>;
  /**
   * UE-B-003: `true` when at least one entity placement was dropped during
   * conversion (e.g. orphan zone reference). Lets a UE5 loader fail-fast or
   * warn when the pack is known-incomplete. Counts only dropped entities,
   * not every `level: 'dropped'` fidelity entry (which may include expected
   * lossy-projection drops like `dialogues`).
   */
  incomplete: boolean;
  /**
   * UE-B-003: count of entity placements dropped during conversion. Mirrors
   * `UnrealActorManifest.Dropped.length` and is the canonical number the UE5
   * loader should use to decide whether the manifest is complete.
   */
  droppedEntityCount: number;
}

export interface FidelityReport {
  entries: FidelityEntry[];
  summary: FidelitySummary;
}

export function summarizeFidelity(
  entries: FidelityEntry[],
  options?: { droppedEntityCount?: number },
): FidelitySummary {
  let lossless = 0;
  let approximated = 0;
  let dropped = 0;
  const byDomain: Partial<Record<FidelityDomain, DomainSummary>> = {};

  for (const e of entries) {
    if (e.level === 'lossless') lossless++;
    else if (e.level === 'approximated') approximated++;
    else dropped++;

    let ds = byDomain[e.domain];
    if (!ds) {
      ds = { total: 0, lossless: 0, approximated: 0, dropped: 0 };
      byDomain[e.domain] = ds;
    }
    ds.total++;
    ds[e.level]++;
  }

  const total = entries.length;
  const droppedEntityCount = options?.droppedEntityCount ?? 0;
  return {
    total,
    lossless,
    approximated,
    dropped,
    losslessPercent: total === 0 ? 100 : Math.round((lossless / total) * 100),
    byDomain,
    incomplete: droppedEntityCount > 0,
    droppedEntityCount,
  };
}

export function buildFidelityReport(
  entries: FidelityEntry[],
  options?: { droppedEntityCount?: number },
): FidelityReport {
  return { entries, summary: summarizeFidelity(entries, options) };
}
