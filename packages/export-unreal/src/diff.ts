/**
 * diff.ts — UE-FT-005 pack-to-pack structural diff.
 *
 * Compares two on-disk Unreal pack directories by id set per category. Output
 * is the shape a reviewer wants at a glance: "N added, M removed, K changed",
 * optionally with the id lists. Pure over readdir + JSON — caller prints.
 *
 * A zone/district/actor is "changed" when it appears in both packs but its
 * JSON content (sorted-key canonical form) differs. Ids that appear in only
 * one side are "added" or "removed".
 */

import { readFile, readdir } from 'node:fs/promises';
import { join } from 'node:path';

import type { UnrealPackMeta } from './export.js';

export interface CategoryDiff {
  added: string[];
  removed: string[];
  changed: string[];
}

export interface PackDiff {
  prevDir: string;
  newDir: string;
  zones: CategoryDiff;
  districts: CategoryDiff;
  actors: CategoryDiff;
  formatVersion: { prev: string; next: string; changed: boolean };
  signature: { prev: boolean; next: boolean; changed: boolean };
}

export interface DiffError {
  error: string;
  hint?: string;
}

async function readJson<T>(path: string): Promise<T> {
  const raw = await readFile(path, 'utf-8');
  return JSON.parse(raw) as T;
}

async function readDirSafe(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const entries = await readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isFile() || !entry.name.endsWith('.json')) continue;
      const full = join(dir, entry.name);
      try {
        const raw = await readFile(full, 'utf-8');
        const parsed = JSON.parse(raw) as { Id?: string };
        const id = typeof parsed.Id === 'string' ? parsed.Id : entry.name.replace(/\.json$/, '');
        // Canonicalize for change-detection: sorted-key JSON.
        out[id] = canonicalStringify(parsed);
      } catch {
        // Unreadable file → skip; ids not in both sides will show as added/removed.
      }
    }
  } catch {
    // Missing directory → empty map; the category diff will report the shape.
  }
  return out;
}

/**
 * Stable stringify with sorted keys at every depth. Used for change-detection
 * only; not a canonical form suitable for signing (that lives in signing.ts).
 */
function canonicalStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(canonicalStringify).join(',') + ']';
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + canonicalStringify(record[k]))
      .join(',') +
    '}'
  );
}

function categoryDiff(prev: Record<string, string>, next: Record<string, string>): CategoryDiff {
  const prevIds = new Set(Object.keys(prev));
  const nextIds = new Set(Object.keys(next));
  const added: string[] = [];
  const removed: string[] = [];
  const changed: string[] = [];
  for (const id of nextIds) {
    if (!prevIds.has(id)) added.push(id);
    else if (prev[id] !== next[id]) changed.push(id);
  }
  for (const id of prevIds) {
    if (!nextIds.has(id)) removed.push(id);
  }
  added.sort();
  removed.sort();
  changed.sort();
  return { added, removed, changed };
}

async function collectActors(dir: string): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const manifest = await readJson<{ All?: Array<{ ActorId?: string } & Record<string, unknown>> }>(
      join(dir, 'actors', 'manifest.json'),
    );
    if (Array.isArray(manifest.All)) {
      for (const actor of manifest.All) {
        if (typeof actor.ActorId === 'string') {
          out[actor.ActorId] = canonicalStringify(actor);
        }
      }
    }
  } catch {
    // Missing actors/manifest.json → no actor diff entries.
  }
  return out;
}

/** Compute a structural diff between two pack directories. */
export async function diffPacks(prevDir: string, newDir: string): Promise<PackDiff | DiffError> {
  let prevMeta: UnrealPackMeta;
  let nextMeta: UnrealPackMeta;
  try {
    prevMeta = await readJson<UnrealPackMeta>(join(prevDir, 'pack.json'));
  } catch (err) {
    return {
      error: `Cannot read pack.json at ${prevDir}: ${err instanceof Error ? err.message : String(err)}`,
      hint: `Check that ${prevDir} is a pack directory (contains pack.json).`,
    };
  }
  try {
    nextMeta = await readJson<UnrealPackMeta>(join(newDir, 'pack.json'));
  } catch (err) {
    return {
      error: `Cannot read pack.json at ${newDir}: ${err instanceof Error ? err.message : String(err)}`,
      hint: `Check that ${newDir} is a pack directory (contains pack.json).`,
    };
  }

  const [prevZones, nextZones] = await Promise.all([
    readDirSafe(join(prevDir, 'zones')),
    readDirSafe(join(newDir, 'zones')),
  ]);
  const [prevDistricts, nextDistricts] = await Promise.all([
    readDirSafe(join(prevDir, 'districts')),
    readDirSafe(join(newDir, 'districts')),
  ]);
  const [prevActors, nextActors] = await Promise.all([
    collectActors(prevDir),
    collectActors(newDir),
  ]);

  const prevFmt = prevMeta.FormatVersion;
  const nextFmt = nextMeta.FormatVersion;
  const prevSigned = !!prevMeta.Signature;
  const nextSigned = !!nextMeta.Signature;

  return {
    prevDir,
    newDir,
    zones: categoryDiff(prevZones, nextZones),
    districts: categoryDiff(prevDistricts, nextDistricts),
    actors: categoryDiff(prevActors, nextActors),
    formatVersion: { prev: prevFmt, next: nextFmt, changed: prevFmt !== nextFmt },
    signature: { prev: prevSigned, next: nextSigned, changed: prevSigned !== nextSigned },
  };
}

/** Format a diff for stdout. `detailed` includes the id lists under each line. */
export function formatDiff(diff: PackDiff, detailed = false): string {
  const lines: string[] = [];
  const categoryLine = (label: string, cat: CategoryDiff): string =>
    `${label.padEnd(12)} ${cat.added.length} added, ${cat.removed.length} removed, ${cat.changed.length} changed`;

  lines.push(`Diff: ${diff.prevDir} -> ${diff.newDir}`);
  lines.push(categoryLine('Zones:', diff.zones));
  if (detailed) lines.push(...detailLines(diff.zones));
  lines.push(categoryLine('Districts:', diff.districts));
  if (detailed) lines.push(...detailLines(diff.districts));
  lines.push(categoryLine('Actors:', diff.actors));
  if (detailed) lines.push(...detailLines(diff.actors));

  if (diff.formatVersion.changed) {
    lines.push(`FormatVersion: ${diff.formatVersion.prev} -> ${diff.formatVersion.next}`);
  } else {
    lines.push(`FormatVersion: ${diff.formatVersion.next} (unchanged)`);
  }

  if (diff.signature.changed) {
    const verb = diff.signature.next ? 'added' : 'removed';
    lines.push(`Signature: ${verb}`);
  } else if (diff.signature.next) {
    lines.push(`Signature: present (unchanged)`);
  }

  return lines.join('\n');
}

function detailLines(cat: CategoryDiff): string[] {
  const out: string[] = [];
  for (const id of cat.added) out.push(`  + ${id}`);
  for (const id of cat.removed) out.push(`  - ${id}`);
  for (const id of cat.changed) out.push(`  ~ ${id}`);
  return out;
}
