// fidelity.ts — structured import fidelity reporting

export type FidelityLevel = 'lossless' | 'approximated' | 'dropped';
export type FidelitySeverity = 'info' | 'warning' | 'error';
export type FidelityDomain =
  | 'zones' | 'districts' | 'entities' | 'items'
  | 'dialogues' | 'player' | 'builds' | 'progression'
  | 'world';

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
