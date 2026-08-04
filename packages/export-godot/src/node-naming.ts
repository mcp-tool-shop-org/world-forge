/**
 * node-naming.ts — the ONE shared Godot node-name sanitizer.
 *
 * Godot 4's `.tscn` text format tokenizes a `[node name="..."]` tag header
 * with the SAME string-literal grammar it uses for ordinary `key = value`
 * property lines (see the format doc linked at the top of scene-builder.ts).
 * A literal `"` inside the name value terminates that string early and
 * desyncs the rest of the tag. Verified end to end against a real engine:
 * a zone named `Big "Boss" Tony` produces the header
 * `[node name="Big_"Boss"_Tony" type="Node2D" parent="."]` — six quotes,
 * evenly balanced, invisible to a quote-COUNTING check — and Godot Engine
 * v4.7.stable refuses to load the scene at all:
 * `Parse Error ... at _parse_node_tag (resource_format_text.cpp:293)`.
 *
 * This function used to be ~9 near-identical deny-list copies (one per
 * converter, plus a 10th local copy in scene-builder.ts) that each stripped
 * '/' and '@' and collapsed whitespace but never touched '"' — two of the
 * nine had already drifted onto a slightly different regex. A duplicated
 * security-relevant sanitizer is how the omission went unnoticed for so
 * long; this is the ONE copy, and every call site imports it.
 *
 * Design: an ALLOW-list, not a deny-list. Only `[a-zA-Z0-9_]` survive
 * untouched; everything else — quotes, backslashes, newlines/control chars,
 * '/', '@', '.', ':', '%', unicode, whatever the next hostile character
 * turns out to be — becomes '_'. A deny-list has to correctly enumerate
 * every future-invalid character; an allow-list cannot under-strip. This
 * also happens to be the technically-required answer for THIS value
 * specifically (as opposed to plain metadata strings, which are correctly
 * handled elsewhere via backslash-escaping through escapeGodot()): node
 * names double as NodePath segments in this very file (e.g.
 * `parent="${zone.nodeName}/Entities"`), and NodePath metacharacters like
 * '/' or ':' cannot be escaped away — they have to be gone.
 */

/**
 * Sanitize a string for use as a Godot node name.
 *
 * - Runs of whitespace collapse to a single `_` (so "Big   Boss" and
 *   "Big Boss" don't produce visibly different names).
 * - Everything that is not `[a-zA-Z0-9_]` is then replaced with `_` —
 *   this is what removes '"', '\\', newlines/control characters, '/', '@',
 *   and any other character that could break out of a quoted tag-header
 *   attribute or a NodePath segment.
 * - A leading digit gets an underscore prefix (two of the nine original
 *   copies already guarded this; it is now universal).
 *
 * Does NOT guarantee a non-empty result (e.g. a name that is entirely
 * whitespace/symbols sanitizes to `""` or `"_"`) — callers that need a
 * non-empty node name already fall back locally (`sanitizeNodeName(x) ||
 * 'Node'`), and that contract is unchanged by this consolidation.
 */
export function sanitizeNodeName(name: string): string {
    return name
        .replace(/\s+/g, '_')
        .replace(/[^a-zA-Z0-9_]/g, '_')
        .replace(/^(\d)/, '_$1');
}
