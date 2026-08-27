import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { defaultDownloadJson } from '../export-handlers.js';

const here = dirname(fileURLToPath(import.meta.url));

describe('F-c28f6fa5: defaultDownloadJson keeps the object URL', () => {
  const revoke = vi.fn();
  const create = vi.fn(() => 'blob:keep-me');
  const click = vi.fn();

  beforeEach(() => {
    revoke.mockClear();
    create.mockClear();
    click.mockClear();
    vi.stubGlobal('Blob', class FakeBlob {
      constructor(public parts: unknown[], public options?: unknown) {}
    });
    vi.stubGlobal('URL', {
      createObjectURL: create,
      revokeObjectURL: revoke,
    });
    vi.stubGlobal('document', {
      createElement: () => ({
        href: '',
        download: '',
        click,
      }),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns the object URL and does not revoke it', () => {
    const url = defaultDownloadJson('world.wfproject.json', { ok: true });
    expect(url).toBe('blob:keep-me');
    expect(create).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revoke).not.toHaveBeenCalled();
  });
});

describe('F-c28f6fa5: leftover sites route through defaultDownloadJson', () => {
  it('ExportModal bundle export keeps the URL and reuses the fallback anchor', () => {
    const src = readFileSync(join(here, '../ExportModal.tsx'), 'utf8');
    expect(src).toContain('defaultDownloadJson(');
    expect(src).toContain('handleExportBundle');
    expect(src).not.toContain('Bundle saved!');
    expect(src).toContain('If nothing appears, click here');
    expect(src).toContain('data-testid="wf-export-fallback-link"');
    expect(src).not.toMatch(/a\.click\(\);\s*URL\.revokeObjectURL/);
  });

  it('TemplateManager.handleExportKit keeps the URL and shows a fallback', () => {
    const src = readFileSync(join(here, '../TemplateManager.tsx'), 'utf8');
    expect(src).toContain('defaultDownloadJson(');
    expect(src).toContain('data-testid="wf-kit-export-fallback-link"');
    expect(src).toContain('If nothing appears, click here');
    expect(src).not.toMatch(/a\.click\(\);\s*URL\.revokeObjectURL/);
  });
});
