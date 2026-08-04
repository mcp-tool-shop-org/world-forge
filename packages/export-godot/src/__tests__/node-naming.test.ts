/**
 * node-naming.test.ts — the shared Godot node-name sanitizer (F-001/F-18d722e0).
 *
 * RED CONTROL for the headline defect: the pre-fix sanitizer (9 near-identical
 * copies, one per converter, plus a 10th local copy in scene-builder.ts) never
 * stripped a literal double quote. A zone/entity/item/prop authored with a
 * nickname-style quote — `Big "Boss" Tony` — produced a `[node name="..."]`
 * tag header Godot Engine v4.7.stable refuses to parse at all. These tests
 * pin the character-safety contract of the ONE now-shared implementation.
 */

import { describe, it, expect } from 'vitest';
import { sanitizeNodeName } from '../node-naming.js';

describe('sanitizeNodeName — quote handling (the headline defect)', () => {
    it('strips a literal double quote', () => {
        const sanitized = sanitizeNodeName('Big "Boss" Tony');
        expect(sanitized).not.toContain('"');
    });

    it('strips a unit-mark quote at the end of a name', () => {
        const sanitized = sanitizeNodeName('18" Cutlass');
        expect(sanitized).not.toContain('"');
    });

    it('produces a name usable, unescaped, inside a double-quoted tag attribute', () => {
        // The point of sanitizing (vs. escaping) a node name: the result must be
        // safe to drop straight into `name="${sanitized}"` with no further work,
        // because node names also serve as NodePath segments elsewhere in
        // scene-builder.ts (e.g. `parent="${zone.nodeName}/Entities"`), and a
        // NodePath segment cannot contain an escaped special character — it has
        // to not have one.
        const sanitized = sanitizeNodeName('Big "Boss" Tony');
        const header = `[node name="${sanitized}" type="Node2D" parent="."]`;
        expect(header).toMatch(/^\[node name="[^"]*" type="Node2D" parent="\."\]$/);
    });
});

describe('sanitizeNodeName — other .tscn-hostile characters', () => {
    it('strips a backslash', () => {
        expect(sanitizeNodeName('Foo\\Bar')).not.toContain('\\');
    });

    it('strips embedded newlines', () => {
        const sanitized = sanitizeNodeName('Foo\nBar');
        expect(sanitized).not.toContain('\n');
    });

    it('strips control characters', () => {
        const sanitized = sanitizeNodeName('Foo\x00\x1fBar');
        expect(sanitized).toBe('Foo__Bar');
    });

    it('strips a forward slash (NodePath separator)', () => {
        expect(sanitizeNodeName('North/South')).not.toContain('/');
    });

    it('strips an @ sign (NodePath unique-name marker)', () => {
        expect(sanitizeNodeName('@Anonymous')).not.toContain('@');
    });

    it('strips a colon and percent sign (NodePath subpath / unique markers)', () => {
        const sanitized = sanitizeNodeName('Sub:Path%Node');
        expect(sanitized).not.toMatch(/[:%]/);
    });

    it('strips unicode characters not in the allow-list', () => {
        const sanitized = sanitizeNodeName('Café');
        expect(sanitized).toMatch(/^[a-zA-Z0-9_]*$/);
    });
});

describe('sanitizeNodeName — preserves existing, already-tested behavior', () => {
    it('leaves an ordinary alphanumeric/underscore name untouched', () => {
        expect(sanitizeNodeName('Ground')).toBe('Ground');
        expect(sanitizeNodeName('Barrel')).toBe('Barrel');
    });

    it('collapses runs of whitespace to a single underscore', () => {
        expect(sanitizeNodeName('Big   Boss')).toBe('Big_Boss');
        expect(sanitizeNodeName('Big Boss')).toBe('Big_Boss');
    });

    it('prefixes an underscore when the name starts with a digit', () => {
        // Two of the nine original copies (convert-entities.ts, convert-items.ts)
        // already guarded this; it is now universal across all call sites.
        expect(sanitizeNodeName('123 Ruins')).toBe('_123_Ruins');
    });

    it('returns an empty string for an all-invalid input (callers guard the fallback)', () => {
        // Matches the pre-existing contract: sanitizeNodeName itself does not
        // invent a fallback name — call sites that need one already do
        // `sanitizeNodeName(x) || 'Node'` locally, and that is unchanged.
        expect(sanitizeNodeName('')).toBe('');
    });
});

describe('sanitizeNodeName — the two previously-diverged call sites now agree', () => {
    // Before the fix, convert-entities.ts / convert-items.ts used
    // `name.replace(/[/@\s]/g, '_').replace(/^(\d)/, '_$1')` while the other
    // seven used `name.replace(/[/@]/g, '_').replace(/\s+/g, '_')` — a second,
    // smaller drift on top of the shared quote omission. There is now exactly
    // one implementation, so there is nothing left to diverge.
    it('quote handling and leading-digit handling agree in the same call', () => {
        expect(sanitizeNodeName('1 "Lucky" Strike')).toBe('_1__Lucky__Strike');
    });
});
