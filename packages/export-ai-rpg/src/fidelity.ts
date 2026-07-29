/**
 * fidelity.ts — Structured import fidelity reporting
 *
 * ## Purpose
 *
 * The fidelity system tracks how faithfully data survives format conversions
 * (especially the lossy ContentPack → WorldProject round-trip). Every import
 * converter produces {@link FidelityEntry} records that are aggregated into a
 * {@link FidelityReport}.
 *
 * ## How to Create Fidelity Entries for a Custom Converter
 *
 * 1. Import {@link FidelityEntry} and {@link FidelityDomain} from this module.
 * 2. If your converter introduces a new data category, add it to the
 *    {@link FidelityDomain} union type (e.g. `'my-domain'`).
 * 3. In your converter, create entries with the appropriate {@link FidelityLevel}:
 *    - `'lossless'` — data was preserved exactly.
 *    - `'approximated'` — data was reconstructed with heuristics (e.g. inferred
 *      grid positions, default values substituted).
 *    - `'dropped'` — data could not be recovered and was lost.
 * 4. Set `severity` to `'info'` for routine observations, `'warning'` for data
 *    the user should review, or `'error'` for data loss that may break the project.
 * 5. Return your entries array alongside your converted data. The import pipeline
 *    collects all entries and calls {@link buildFidelityReport} to produce the
 *    aggregate {@link FidelityReport}.
 *
 * @module fidelity
 */

/** How faithfully a field survived the export→import round-trip. */
export type FidelityLevel = 'lossless' | 'approximated' | 'dropped';
/** Severity of a fidelity observation. */
export type FidelitySeverity = 'info' | 'warning' | 'error';
/** Domain that a fidelity entry belongs to. */
export type FidelityDomain =
  | 'zones' | 'districts' | 'entities' | 'items'
  | 'dialogues' | 'player' | 'builds' | 'progression'
  | 'world' | 'assets' | 'packs';

/** A single fidelity observation recorded during import. */
export interface FidelityEntry {
  level: FidelityLevel;
  domain: FidelityDomain;
  severity: FidelitySeverity;
  entityId?: string;
  fieldPath?: string;
  message: string;
  reason: string;
}

/** Per-domain count breakdown of fidelity levels. */
export interface DomainSummary {
  total: number;
  lossless: number;
  approximated: number;
  dropped: number;
}

/** Aggregate summary of all fidelity entries for an import operation. */
export interface FidelitySummary {
  total: number;
  lossless: number;
  approximated: number;
  dropped: number;
  /**
   * Percentage of observations that were lossless, or `null` when there are NO
   * observations to compute it from.
   *
   * ⚠ THIS FIELD USED TO RETURN 100 ON AN EMPTY ENTRY LIST, and the C0 audit
   * measured what that cost: on an export that dropped 194 of 377 authored
   * fields, `ExportResult.fidelity` reported `losslessPercent: 100`,
   * `dropped: 0` and zero warnings — a green number computed from zero
   * observations (ai-rpg-engine/docs/c0-alignment/REPORT.md §1). Only one
   * converter is wired to the export-side collector, so on the export path the
   * list is almost always empty.
   *
   * `null` is the honest value: not 100%, not 0% — unmeasured. Consumers must
   * print "unmeasured" rather than a number. See {@link FidelitySummary.observed}.
   *
   * WIRING EVERY CONVERTER to the collector is the real repair and is NOT done
   * here — that is a full pass over eight converters and belongs with the C3
   * vocabulary work. C1's job was to stop the instrument lying about what it
   * knows, and to say plainly what remains.
   */
  losslessPercent: number | null;
  /** False when there were no entries at all — nothing was measured. */
  observed: boolean;
  byDomain: Partial<Record<FidelityDomain, DomainSummary>>;
}

/** Complete fidelity report containing all entries and their summary. */
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
    // `total === 0 ? 100` was the lie. No observations means no percentage.
    losslessPercent: total === 0 ? null : Math.round((lossless / total) * 100),
    observed: total > 0,
    byDomain,
  };
}

export function buildFidelityReport(entries: FidelityEntry[]): FidelityReport {
  return { entries, summary: summarizeFidelity(entries) };
}
