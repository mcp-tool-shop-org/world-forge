// entity-properties-helpers.ts — pure helpers for EntityProperties.

import type { EntityRole } from '@world-forge/schema';
import { validateSpawnCondition } from '@world-forge/schema';

export const ALL_ROLES: EntityRole[] = ['npc', 'enemy', 'merchant', 'quest-giver', 'companion', 'boss'];

export function parseCsv(s: string): string[] {
  return s.split(',').map((x) => x.trim()).filter(Boolean);
}

export function formatCsv(values?: string[]): string {
  return (values ?? []).join(', ');
}

/** Parse "vigor:3, hp:10" into a number record. Unknown tokens are skipped. */
export function parseNamedNumbers(s: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const part of s.split(',')) {
    const trimmed = part.trim();
    if (!trimmed) continue;
    const colon = trimmed.indexOf(':');
    if (colon <= 0) continue;
    const key = trimmed.slice(0, colon).trim();
    const n = Number(trimmed.slice(colon + 1).trim());
    if (key && Number.isFinite(n)) out[key] = n;
  }
  return out;
}

export function formatNamedNumbers(data?: Record<string, number | undefined>): string {
  if (!data) return '';
  return Object.entries(data)
    .filter((entry): entry is [string, number] => entry[1] !== undefined && Number.isFinite(entry[1]))
    .map(([k, v]) => `${k}:${v}`)
    .join(', ');
}

export function emptyToUndef(s: string): string | undefined {
  const t = s.trim();
  return t.length === 0 ? undefined : t;
}

/** null when the string is empty or a recognised spawn-condition form. */
export function spawnConditionMessage(value: string | undefined): string | null {
  if (!value || !value.trim()) return null;
  return validateSpawnCondition(value);
}
