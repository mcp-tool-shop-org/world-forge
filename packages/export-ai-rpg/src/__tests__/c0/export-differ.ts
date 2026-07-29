// export-differ.ts — verifies the declared EXPORT truth table against a live export.
//
// The table in `export-table-data.ts` is a CLAIM. This module turns every claim
// into a mechanical check against real `exportToEngine` output, so a row that
// says "carried" when the field is dropped (or vice versa) fails the suite.
//
// Deliberately NOT an auto-matcher. A first draft of this audit DID auto-match
// by leaf-key + value multiset, and produced confident nonsense on small value
// sets — `transitions[].zoneId` "matched" `encounterAnchors[].zoneId` purely
// because both held one zone id. The table declares the image; the differ only
// confirms or refutes it.

import type { WorldProject } from '@world-forge/schema';
import { exportToEngine, type ExportResult } from '../../export.js';
import {
  collectKeyNames,
  collectLeafPaths,
  collectLeafValues,
  resolvePath,
} from './leaf-paths.js';
import {
  DROPPED_CONTAINERS,
  EXPLICIT_ROWS,
  type ExportChannel,
  type ExportRow,
  type CarriedRow,
  type DroppedRow,
  type ScopeSpec,
} from './export-table-data.js';

export type Artifacts = Record<Exclude<ExportChannel, 'none'>, unknown>;

/** The six artifacts `exportToEngine` produces, addressed by channel name. */
export function artifactsOf(result: ExportResult): Artifacts {
  return {
    contentPack: result.contentPack,
    manifest: result.manifest,
    packMeta: result.packMeta,
    // `assets` / `assetPacks` are bare arrays; wrap them so their paths read
    // the same way as every other channel.
    assets: { assets: result.assets ?? [] },
    assetPacks: { assetPacks: result.assetPacks ?? [] },
    assetBindings: result.assetBindings ?? {},
  };
}

export function exportFixture(project: WorldProject): ExportResult {
  const result = exportToEngine(project);
  if (!result.success) {
    throw new Error(`fixture failed to export: ${JSON.stringify(result.errors, null, 2)}`);
  }
  return result;
}

/** Every key name appearing anywhere across all six artifacts. */
export function allExportKeyNames(artifacts: Artifacts): Set<string> {
  return scopedKeyNames(artifacts);
}

/** Every scalar leaf value appearing anywhere across all six artifacts. */
export function allExportLeafValues(artifacts: Artifacts): Set<unknown> {
  return scopedLeafValues(artifacts);
}

/**
 * Resolve a scope list to the set of subtree roots it names. `undefined` means
 * "every artifact whole" — the default for rows whose claim really is global.
 */
function scopeRoots(artifacts: Artifacts, scope?: ScopeSpec[]): unknown[] {
  if (!scope) return Object.values(artifacts);
  const roots: unknown[] = [];
  for (const s of scope) {
    const artifact = artifacts[s.channel];
    if (s.packPath === undefined) roots.push(artifact);
    else roots.push(...resolvePath(artifact, s.packPath));
  }
  return roots;
}

export function scopedKeyNames(artifacts: Artifacts, scope?: ScopeSpec[]): Set<string> {
  const out = new Set<string>();
  for (const root of scopeRoots(artifacts, scope)) for (const k of collectKeyNames(root)) out.add(k);
  return out;
}

export function scopedLeafValues(artifacts: Artifacts, scope?: ScopeSpec[]): Set<unknown> {
  const out = new Set<unknown>();
  for (const root of scopeRoots(artifacts, scope)) for (const v of collectLeafValues(root)) out.add(v);
  return out;
}

/**
 * Expand the declared table into one row per authored leaf path.
 *
 * Paths under a `DROPPED_CONTAINERS` domain are generated from the fixture's
 * own leaf paths, so a schema that grows a new field inside an already-dropped
 * domain is covered automatically and still gets a real absence proof.
 */
export function expandTable(project: WorldProject): ExportRow[] {
  const rows: ExportRow[] = [...EXPLICIT_ROWS];
  const explicitPaths = new Set(EXPLICIT_ROWS.map((r) => r.path));

  for (const path of collectLeafPaths(project)) {
    const container = path.split(/[.[{]/, 1)[0];
    const containerNote = DROPPED_CONTAINERS[container];
    if (containerNote === undefined) continue;
    if (explicitPaths.has(path)) continue;
    rows.push({
      path,
      class: 'no-channel',
      absence: { kind: 'key-absent', key: container },
      note: containerNote,
    } satisfies DroppedRow);
  }

  return rows.sort((a, b) => a.path.localeCompare(b.path));
}

export interface RowVerdict {
  row: ExportRow;
  ok: boolean;
  /** What was actually observed — printed on failure, and stored in the artifact. */
  evidence: string;
}

const asSortedStrings = (vals: unknown[]) => vals.map((v) => JSON.stringify(v)).sort();

/**
 * Verify one declared row against the live export.
 *
 *  - `carried-*` with no `transform`: authored values and exported values must
 *    be equal as multisets. This is the strong form and covers most rows.
 *  - `carried-*` WITH a `transform`: the transform is named prose, so the differ
 *    can only require that the declared image path resolves to at least one
 *    value. Each transformed row additionally gets a bespoke assertion in
 *    `c0-export-table.test.ts` — the differ does not pretend to check prose.
 *  - `no-channel` + `key-absent`: the named key appears in NO artifact.
 *  - `no-channel` + `value-absent`: every authored string value at the path is
 *    absent from every artifact's leaf values.
 */
export function verifyRow(
  row: ExportRow,
  project: WorldProject,
  artifacts: Artifacts,
): RowVerdict {
  const authored = resolvePath(project, row.path);

  if (row.class === 'no-channel') {
    const d = row as DroppedRow;
    const scope = d.absence.scope;
    const where = scope
      ? scope.map((s) => `${s.channel}${s.packPath ? `:${s.packPath}` : ''}`).join(' + ')
      : 'all six export artifacts';

    if (d.absence.kind === 'key-absent') {
      const roots = scopeRoots(artifacts, scope);
      if (scope && roots.length === 0) {
        return {
          row,
          ok: false,
          evidence: `scoped key-absent proof is VACUOUS: the scope (${where}) resolves to no subtree at all, so the check cannot fail`,
        };
      }
      const present = scopedKeyNames(artifacts, scope).has(d.absence.key);
      return {
        row,
        ok: !present,
        evidence: present
          ? `key "${d.absence.key}" IS present in ${where} — the row claims no-channel`
          : `key "${d.absence.key}" absent from ${where}`,
      };
    }

    const strings = authored.filter((v): v is string => typeof v === 'string');
    if (strings.length === 0) {
      return {
        row,
        ok: false,
        evidence: `value-absent proof is VACUOUS here: no string values authored at ${row.path} (${authored.length} non-string values). Declare a key-absent proof instead.`,
      };
    }
    const values = scopedLeafValues(artifacts, scope);
    const leaked = strings.filter((s) => values.has(s));
    return {
      row,
      ok: leaked.length === 0,
      evidence: leaked.length
        ? `authored values leaked into ${where}: ${leaked.join(', ')}`
        : `all ${strings.length} authored string values absent from ${where}`,
    };
  }

  const c = row as CarriedRow;
  const artifact = artifacts[c.channel];
  const exported = resolvePath(artifact, c.packPath);

  if (exported.length === 0) {
    return {
      row,
      ok: false,
      evidence: `declared image ${c.channel}:${c.packPath} resolves to NOTHING — the row claims ${c.class}`,
    };
  }

  if (c.transform === undefined) {
    const a = asSortedStrings(authored);
    const b = asSortedStrings(exported);
    const equal = a.length === b.length && a.every((v, i) => v === b[i]);
    return {
      row,
      ok: equal,
      evidence: equal
        ? `${a.length} authored values match ${c.channel}:${c.packPath} exactly`
        : `authored ${JSON.stringify(a).slice(0, 200)} != exported ${JSON.stringify(b).slice(0, 200)}`,
    };
  }

  return {
    row,
    ok: true,
    evidence: `transform "${c.transform}" → ${c.channel}:${c.packPath} (${exported.length} values); semantics asserted separately`,
  };
}

export function verifyTable(project: WorldProject, result: ExportResult): RowVerdict[] {
  const artifacts = artifactsOf(result);
  return expandTable(project).map((row) => verifyRow(row, project, artifacts));
}

export interface TableTally {
  total: number;
  byClass: Record<string, number>;
  byChannel: Record<string, number>;
}

export function tally(rows: ExportRow[]): TableTally {
  const byClass: Record<string, number> = {};
  const byChannel: Record<string, number> = {};
  for (const r of rows) {
    byClass[r.class] = (byClass[r.class] ?? 0) + 1;
    const ch = r.class === 'no-channel' ? 'none' : (r as CarriedRow).channel;
    byChannel[ch] = (byChannel[ch] ?? 0) + 1;
  }
  return { total: rows.length, byClass, byChannel };
}

/** The machine-readable artifact written to `docs/c0-alignment/export-table.json`. */
export function buildArtifact(
  project: WorldProject,
  result: ExportResult,
  meta: { schemaVersion: string; forgeCommit: string; engineDepVersions: Record<string, string> },
) {
  const verdicts = verifyTable(project, result);
  const rows = verdicts.map(({ row, ok, evidence }) => ({
    path: row.path,
    class: row.class,
    channel: row.class === 'no-channel' ? 'none' : (row as CarriedRow).channel,
    packPath: row.class === 'no-channel' ? null : (row as CarriedRow).packPath,
    transform: row.class === 'no-channel' ? null : ((row as CarriedRow).transform ?? null),
    absenceProof: row.class === 'no-channel' ? (row as DroppedRow).absence.kind : null,
    verified: ok,
    evidence,
    note: row.note,
  }));
  return {
    audit: 'C0 — Forge→Engine export truth table',
    direction: 'WorldProject → export artifacts',
    generatedBy: 'packages/export-ai-rpg/src/__tests__/c0-export-table.test.ts',
    ...meta,
    tally: tally(verdicts.map((v) => v.row)),
    exporterSelfReport: {
      fidelitySummary: result.fidelity.summary,
      warnings: result.warnings,
      comment:
        'Recorded verbatim. The lane reports 100% lossless / 0 dropped and zero warnings on a fixture where the table below classifies the majority of authored fields as no-channel.',
    },
    rows,
  };
}

/** Human-readable Markdown rendering of the same table. */
export function renderMarkdown(artifact: ReturnType<typeof buildArtifact>): string {
  const lines: string[] = [];
  lines.push('| Field | Class | Channel | Image | Note |');
  lines.push('|---|---|---|---|---|');
  for (const r of artifact.rows) {
    const img = r.packPath ? `\`${r.packPath}\`${r.transform ? ` *(${r.transform})*` : ''}` : '—';
    lines.push(
      `| \`${r.path}\` | ${r.class} | ${r.channel} | ${img} | ${r.note.replace(/\|/g, '\\|')} |`,
    );
  }
  return lines.join('\n');
}
