// wave-18-amend.test.ts — Stage C humanization coverage for editor-core findings
// in swarm-1787820671-c76a wave 18.

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { liveRegionForKind, pushToast, _resetToastsForTest, _getToastsForTest } from '../ui/Toast.js';
import { AUTOSAVE_SAVE_HINT, AUTOSAVE_EXPORT_HINT } from '../store/project-store.js';
import { failReasonToUserMessage } from '../speed-panel-execute.js';

const here = dirname(fileURLToPath(import.meta.url));

function src(rel: string): string {
  return readFileSync(join(here, rel), 'utf8');
}

describe('F-2fc5e0ad: toast live regions', () => {
  beforeEach(() => { _resetToastsForTest(); });

  it('error and warning use assertive alert; info/success stay polite status', () => {
    expect(liveRegionForKind('error')).toEqual({ role: 'alert', ariaLive: 'assertive' });
    expect(liveRegionForKind('warning')).toEqual({ role: 'alert', ariaLive: 'assertive' });
    expect(liveRegionForKind('info')).toEqual({ role: 'status', ariaLive: 'polite' });
    expect(liveRegionForKind('success')).toEqual({ role: 'status', ariaLive: 'polite' });
  });

  it('error toasts do not auto-dismiss by default', () => {
    vi.useFakeTimers();
    pushToast('save failed', 'error');
    expect(_getToastsForTest()).toHaveLength(1);
    expect(_getToastsForTest()[0].durationMs).toBe(0);
    vi.advanceTimersByTime(60_000);
    expect(_getToastsForTest()).toHaveLength(1);
    vi.useRealTimers();
  });

  it('ToastHost markup uses role=alert for errors and App banners declare alert', () => {
    const toast = src('../ui/Toast.tsx');
    expect(toast).toContain('liveRegionForKind');
    expect(toast).toContain("role={live.role}");
    const app = src('../App.tsx');
    expect(app).toContain('role="alert"');
    expect(app).toContain('wf-autosave-oversize-banner');
    expect(app).toContain('wf-autosave-error-banner');
    expect(app).toContain('wf-file-error-banner');
    expect(app).toContain("pushToast('Issue resolved");
    expect(app).not.toContain('showResolvedToast');
  });
});

describe('F-579225c9: save busy + load reading banner', () => {
  it('Save is gated on an in-flight flag and Load paints a reading banner', () => {
    const app = src('../App.tsx');
    expect(app).toContain('savingRef.current');
    expect(app).toContain('aria-busy={saving}');
    expect(app).toContain('wf-file-reading-banner');
    expect(app).toContain('Reading ${file.name}');
    expect(app).toContain('reader.onloadstart');
  });
});

describe('F-6c1fa8ce: Space-to-pan is canvas-scoped', () => {
  it('Canvas only preventDefaults Space via shouldArmSpacePan', () => {
    const canvas = src('../Canvas.tsx');
    expect(canvas).toContain('shouldArmSpacePan');
    expect(canvas).not.toMatch(/if \(e\.code === 'Space' && !e\.repeat\) \{\s*e\.preventDefault\(\);/);
  });
});

describe('F-77c70524: context menu is keyboard-operable', () => {
  it('opens from contextmenu (keyboard) and renders role=menu/menuitem', () => {
    const canvas = src('../Canvas.tsx');
    expect(canvas).toContain('handleContextMenu');
    expect(canvas).toContain('role="menu"');
    expect(canvas).toContain('role="menuitem"');
    expect(canvas).toContain('ArrowDown');
    expect(canvas).toContain('openObjectContextMenu');
    expect(canvas).toMatch(/<button[\s\S]*role="menuitem"/);
  });
});

describe('F-8912e227: export-summary does not sync-revoke', () => {
  it('default path reuses defaultDownloadViaAnchor and does not revoke in the same tick as click', () => {
    const exe = src('../speed-panel-execute.ts');
    expect(exe).toContain('defaultDownloadViaAnchor');
    expect(exe).not.toMatch(/a\.click\(\);\s*URL\.revokeObjectURL/);
  });
});

describe('F-aa55b8da: crash-screen copy fallback', () => {
  it('retitles the button and offers a download when clipboard fails', () => {
    const eb = src('../ErrorBoundary.tsx');
    expect(eb).toContain('Copy failed — select the text below');
    expect(eb).toContain('Download error.json');
    expect(eb).toContain('copyFailed');
    expect(eb).toContain('error.json');
    expect(eb).toContain('userSelect');
  });
});

describe('F-d94458a6: auto-save copy names visible controls', () => {
  it('oversize / quota surfaces agree on Save vs Export wording', () => {
    expect(AUTOSAVE_SAVE_HINT).toBe('Click Save in the top bar (Ctrl+S)');
    expect(AUTOSAVE_EXPORT_HINT).toBe('Click Export, then Export Project Bundle');
    const store = src('../store/project-store.ts');
    const app = src('../App.tsx');
    expect(store).toContain('AUTOSAVE_SAVE_HINT');
    expect(store).toContain('AUTOSAVE_EXPORT_HINT');
    expect(store).not.toContain('File → Save');
    expect(store).not.toContain('File → Export Project Bundle');
    expect(app).toContain('{AUTOSAVE_SAVE_HINT}');
    expect(app).not.toContain('use File');
  });
});

describe('F-dd0278b5: fail reasons stay tokens; toasts are sentences', () => {
  it('cancelled is silent and merge-zones is a fix-it', () => {
    expect(failReasonToUserMessage('set-elevation', 'cancelled')).toBeNull();
    expect(failReasonToUserMessage('merge-zones', 'need at least 2 zones'))
      .toBe('Select at least two zones, then Merge Zones again.');
  });
});

describe('F-fa0b8bf5: placement reject toasts', () => {
  it('Canvas pushes one-line hints on mouse-down rejects', () => {
    const canvas = src('../Canvas.tsx');
    expect(canvas).toContain("needZone: 'Click inside a zone'");
    expect(canvas).toContain("needTile: 'Pick a tile in the left palette first'");
    expect(canvas).toContain("needProp: 'Pick a prop in the left palette first'");
    expect(canvas).toContain("zonePaintSize: 'Drag to at least 2×2'");
    expect(canvas).toContain('CANVAS_PLACEMENT_HINTS.needZone');
    expect(canvas).toContain('CANVAS_PLACEMENT_HINTS.needTile');
    expect(canvas).toContain('CANVAS_PLACEMENT_HINTS.needProp');
    expect(canvas).toContain('CANVAS_PLACEMENT_HINTS.zonePaintSize');
  });
});

describe('F-fc437ba4: right-rail tabs and status-line issue count', () => {
  it('tablist/tab roles, aria-selected, arrows, and a real button for issues', () => {
    const app = src('../App.tsx');
    expect(app).toContain('role="tablist"');
    expect(app).toContain('role="tab"');
    expect(app).toContain('aria-selected={rightTab === t.id}');
    expect(app).toContain('ArrowRight');
    expect(app).toContain('role="tabpanel"');
    expect(app).toContain('aria-label={`${issueCount} issue');
    expect(app).not.toMatch(/<span\s+onClick=\{\(\) => setRightTab\('issues'\)\}/);
  });
});
