// browser-entry-safety.test.ts — proves browser entry points never pull Node builtins,
// the CLI module, the Node engine-gate helper, or runtime @ai-rpg-engine/* packages.

import { describe, it, expect } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join, normalize, resolve } from 'node:path';

const PKG_SRC = resolve(import.meta.dirname, '..');
const EDITOR_SRC = resolve(PKG_SRC, '../../editor/src');
const BROWSER_ENTRY = resolve(PKG_SRC, 'index.ts');

const RUNTIME_IMPORT_RE = /(?:^|\n)\s*(?!import\s+type\b)(?:import|export)\b[^;]*?\bfrom\s+['"]([^'"]+)['"]|import\(\s*['"]([^'"]+)['"]\s*\)/g;

function resolveRelativeTs(fromFile: string, spec: string): string {
  const withoutExt = spec.replace(/\.js$/, '');
  const tsCandidate = resolve(dirname(fromFile), `${withoutExt}.ts`);
  if (existsSync(tsCandidate)) return normalize(tsCandidate);
  const tsxCandidate = resolve(dirname(fromFile), `${withoutExt}.tsx`);
  if (existsSync(tsxCandidate)) return normalize(tsxCandidate);
  return normalize(resolve(dirname(fromFile), spec));
}

function collectRuntimeGraph(entryFile: string): {
  files: string[];
  externalSpecifiers: Array<{ file: string; specifier: string }>;
} {
  const visited = new Set<string>();
  const externalSpecifiers: Array<{ file: string; specifier: string }> = [];
  const queue = [normalize(entryFile)];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);

    const src = readFileSync(current, 'utf-8');
    let match: RegExpExecArray | null;
    RUNTIME_IMPORT_RE.lastIndex = 0;
    while ((match = RUNTIME_IMPORT_RE.exec(src)) !== null) {
      const spec = match[1] ?? match[2];
      if (!spec) continue;
      if (spec.startsWith('./') || spec.startsWith('../')) {
        const target = resolveRelativeTs(current, spec);
        if (target.startsWith(PKG_SRC) && existsSync(target)) {
          queue.push(target);
        }
      } else {
        externalSpecifiers.push({ file: current, specifier: spec });
      }
    }
  }

  return { files: [...visited].sort(), externalSpecifiers };
}

function walkEditorSourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === '__tests__' || entry.name === 'stubs') continue;
      out.push(...walkEditorSourceFiles(full));
    } else if ((entry.name.endsWith('.ts') || entry.name.endsWith('.tsx')) && !entry.name.endsWith('.test.ts')) {
      out.push(full);
    }
  }
  return out;
}

describe('browser bundle safety for @world-forge/export-ai-rpg and editor', () => {
  it('browser entry index.ts never reaches engine-gate, cli, node builtins, or runtime @ai-rpg-engine/* packages', () => {
    const graph = collectRuntimeGraph(BROWSER_ENTRY);
    const gateFile = normalize(resolve(PKG_SRC, 'engine-gate.ts'));
    const cliFile = normalize(resolve(PKG_SRC, 'cli.ts'));

    expect(graph.files).not.toContain(gateFile);
    expect(graph.files).not.toContain(cliFile);

    for (const edge of graph.externalSpecifiers) {
      expect(edge.specifier, `${edge.file} imports Node builtin ${edge.specifier}`).not.toMatch(/^node:/);
      expect(edge.specifier, `${edge.file} imports runtime engine module ${edge.specifier}`).not.toMatch(
        /^@ai-rpg-engine\//,
      );
    }
  });

  it('editor runtime sources never import engine-gate, cli, or @ai-rpg-engine/* packages directly', () => {
    const editorFiles = walkEditorSourceFiles(EDITOR_SRC);
    expect(editorFiles.length).toBeGreaterThan(10);

    for (const file of editorFiles) {
      const src = readFileSync(file, 'utf-8');
      let match: RegExpExecArray | null;
      RUNTIME_IMPORT_RE.lastIndex = 0;
      while ((match = RUNTIME_IMPORT_RE.exec(src)) !== null) {
        const spec = match[1] ?? match[2];
        if (!spec) continue;
        expect(spec, `${file} must not import Node builtin ${spec}`).not.toMatch(/^node:/);
        expect(spec, `${file} must not import runtime engine module ${spec}`).not.toMatch(/^@ai-rpg-engine\//);
        expect(spec, `${file} must not bypass index.ts to import engine-gate or cli`).not.toMatch(
          /export-ai-rpg.*\/(?:engine-gate|cli)/,
        );
      }
    }
  });
});
