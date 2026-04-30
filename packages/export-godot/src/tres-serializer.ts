/**
 * tres-serializer.ts — Serialize Godot resource data to .tres text format.
 *
 * Godot 4's .tres format is a plain-text serialization for custom resources.
 * We use it for zone data, districts, dialogues, loot tables, and items —
 * anything that isn't a scene node but needs to be loadable as a Resource.
 *
 * Format:
 *   [gd_resource type="Resource" script_class="<ClassName>" format=3]
 *   [resource]
 *   key = value
 *   nested/key = value
 */

export interface TresField {
  key: string;
  value: TresValue;
}

export type TresPrimitive = string | number | boolean | null;
export type TresValue = TresPrimitive | TresPrimitive[] | TresValue[] | { [key: string]: TresValue };

/**
 * Serialize a set of fields into a .tres resource file body.
 * @param className The GDScript class_name for this resource type.
 * @param fields Key-value pairs to serialize.
 */
export function serializeTres(className: string, fields: TresField[]): string {
  const lines: string[] = [];
  lines.push(`[gd_resource type="Resource" script_class="${className}" format=3]`);
  lines.push('');
  lines.push('[resource]');

  for (const field of fields) {
    lines.push(`${field.key} = ${formatValue(field.value)}`);
  }

  return lines.join('\n') + '\n';
}

function formatValue(value: TresValue): string {
  if (value === null) return 'null';
  if (typeof value === 'string') return `"${escapeString(value)}"`;
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : value.toFixed(6);
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    const inner = value.map(formatValue).join(', ');
    return `[${inner}]`;
  }
  // Dictionary
  const entries = Object.entries(value).map(([k, v]) => `"${escapeString(k)}": ${formatValue(v)}`);
  return `{${entries.join(', ')}}`;
}

function escapeString(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/"/g, '\\"').replace(/\n/g, '\\n').replace(/\t/g, '\\t');
}

/**
 * Convenience: convert any JSON-serializable object to TresField array.
 */
export function objectToTresFields(obj: Record<string, unknown>): TresField[] {
  const fields: TresField[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value === undefined) continue;
    fields.push({ key, value: value as TresValue });
  }
  return fields;
}
