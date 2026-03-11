import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  deleteBtnStyle,
  ACTIVE_TAB_BG,
  MODAL_OVERLAY,
  MODAL_CARD,
} from '../panels/shared.js';

// ── Style constants ──────────────────────────────────────────

describe('deleteBtnStyle', () => {
  it('uses danger red background', () => {
    expect(deleteBtnStyle.background).toBe('var(--wf-danger)');
    expect(deleteBtnStyle.color).toBe('#fff');
  });
  it('is full-width', () => {
    expect(deleteBtnStyle.width).toBe('100%');
  });
});

describe('ACTIVE_TAB_BG', () => {
  it('is the canonical #58a6ff blue', () => {
    expect(ACTIVE_TAB_BG).toBe('#58a6ff');
  });
});

describe('MODAL_OVERLAY', () => {
  it('uses fixed positioning with inset 0', () => {
    expect(MODAL_OVERLAY.position).toBe('fixed');
    expect(MODAL_OVERLAY.inset).toBe(0);
  });
  it('has z-index 100', () => {
    expect(MODAL_OVERLAY.zIndex).toBe(100);
  });
  it('centers content with flex', () => {
    expect(MODAL_OVERLAY.display).toBe('flex');
    expect(MODAL_OVERLAY.alignItems).toBe('center');
    expect(MODAL_OVERLAY.justifyContent).toBe('center');
  });
});

describe('MODAL_CARD', () => {
  it('returns an object with the requested width', () => {
    const card = MODAL_CARD(450);
    expect(card.width).toBe(450);
  });
  it('normalizes maxHeight to 85vh', () => {
    expect(MODAL_CARD(400).maxHeight).toBe('85vh');
    expect(MODAL_CARD(600).maxHeight).toBe('85vh');
  });
  it('uses dark background and border', () => {
    const card = MODAL_CARD(500);
    expect(card.background).toBe('var(--wf-bg-panel)');
    expect(card.border).toBe('1px solid var(--wf-border-default)');
  });
});

// ── PanelHeader & ConfirmButton (React components) ───────────
// These are tested via DOM rendering in ui-consistency.test.ts.
// Here we verify the exported shapes only.

describe('shared exports', () => {
  it('module exports all expected names', async () => {
    const mod = await import('../panels/shared.js');
    expect(mod.PanelHeader).toBeTypeOf('function');
    expect(mod.ConfirmButton).toBeTypeOf('function');
    expect(mod.EmptyState).toBeTypeOf('function');
    expect(mod.useFocusHighlight).toBeTypeOf('function');
    expect(mod.deleteBtnStyle).toBeDefined();
    expect(mod.ACTIVE_TAB_BG).toBeDefined();
    expect(mod.MODAL_OVERLAY).toBeDefined();
    expect(mod.MODAL_CARD).toBeTypeOf('function');
  });
});
