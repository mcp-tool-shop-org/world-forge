// F-36785d5f: the browser `'.'` entry must not statically import node:crypto
// or node:fs. Signing / summary / diff live on dedicated subpaths.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const srcDir = join(dirname(fileURLToPath(import.meta.url)), '..');

const STATIC_FROM_RE =
  /(?:^|\n)\s*(?:import|export)\s+(?!type\b)[\s\S]*?from\s+['"]([^'"]+)['"]/g;

function staticImportSpecifiers(source: string): string[] {
  const out: string[] = [];
  const re = new RegExp(STATIC_FROM_RE.source, 'g');
  let match: RegExpExecArray | null;
  while ((match = re.exec(source)) !== null) {
    out.push(match[1]);
  }
  return out;
}

function walkStaticGraph(entry: string): string[] {
  const seen = new Set<string>();
  const files: string[] = [];
  const queue = [entry];
  while (queue.length > 0) {
    const file = queue.pop()!;
    if (seen.has(file)) continue;
    seen.add(file);
    files.push(file);
    const src = readFileSync(file, 'utf8');
    for (const spec of staticImportSpecifiers(src)) {
      if (!spec.startsWith('.')) continue;
      const resolved = spec.endsWith('.js') ? spec.slice(0, -3) + '.ts' : spec;
      queue.push(join(dirname(file), resolved));
    }
  }
  return files;
}

describe('F-36785d5f: browser entry import graph is free of Node builtins', () => {
  it('static graph from index.ts contains neither node:crypto nor node:fs', () => {
    const files = walkStaticGraph(join(srcDir, 'index.ts'));
    expect(files.some((f) => f.endsWith('signing.ts'))).toBe(false);
    expect(files.some((f) => f.endsWith('summary.ts'))).toBe(false);
    expect(files.some((f) => f.endsWith('diff.ts'))).toBe(false);
    expect(files.some((f) => f.endsWith('cli.ts'))).toBe(false);
    for (const file of files) {
      const src = readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/from\s+['"]node:crypto['"]/);
      expect(src, file).not.toMatch(/from\s+['"]node:fs(?:\/promises)?['"]/);
    }
  });

  it('export.ts does not statically import signing.ts (dynamic import only)', () => {
    const src = readFileSync(join(srcDir, 'export.ts'), 'utf8');
    const staticSpecs = staticImportSpecifiers(src);
    expect(staticSpecs).not.toContain('./signing.js');
    expect(src).toMatch(/import\(\s*['"]\.\/signing\.js['"]\s*\)/);
  });

  it('index.ts does not re-export signing / summary / diff values', () => {
    const src = readFileSync(join(srcDir, 'index.ts'), 'utf8');
    expect(src).not.toMatch(/from\s+['"]\.\/signing\.js['"]/);
    expect(src).not.toMatch(/from\s+['"]\.\/summary\.js['"]/);
    expect(src).not.toMatch(/from\s+['"]\.\/diff\.js['"]/);
  });
});
