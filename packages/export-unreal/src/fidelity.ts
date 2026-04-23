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
}

export interface FidelityReport {
  entries: FidelityEntry[];
  summary: FidelitySummary;
}

export function summarizeFidelity(entries: FidelityEntry[]): FidelitySummary {
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
  return {
    total,
    lossless,
    approximated,
    dropped,
    losslessPercent: total === 0 ? 100 : Math.round((lossless / total) * 100),
    byDomain,
  };
}

export function buildFidelityReport(entries: FidelityEntry[]): FidelityReport {
  return { entries, summary: summarizeFidelity(entries) };
}
