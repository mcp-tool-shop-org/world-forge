import { describe, it, expect } from 'vitest';
import {
  buttonDangerFull,
  activeTabBg,
  overlayBackdrop,
  modalCard,
} from '../ui/styles.js';

// ── Style constants (now in styles.ts) ──────────────────────

describe('buttonDangerFull', () => {
  it('uses danger red background', () => {
    expect(buttonDangerFull.background).toBe('var(--wf-danger)');
    expect(buttonDangerFull.color).toBe('#fff');
  });
  it('is full-width', () => {
    expect(buttonDangerFull.width).toBe('100%');
  });
});

describe('activeTabBg', () => {
  it('resolves to the accent CSS variable', () => {
    expect(activeTabBg).toBe('var(--wf-accent)');
  });
});

describe('overlayBackdrop', () => {
  it('uses fixed positioning with inset 0', () => {
    expect(overlayBackdrop.position).toBe('fixed');
    expect(overlayBackdrop.inset).toBe(0);
  });
  it('uses the modal z-index token', () => {
    expect(String(overlayBackdrop.zIndex)).toContain('wf-z-modal');
  });
  it('centers content with flex', () => {
    expect(overlayBackdrop.display).toBe('flex');
    expect(overlayBackdrop.alignItems).toBe('center');
    expect(overlayBackdrop.justifyContent).toBe('center');
  });
});

describe('modalCard', () => {
  it('returns an object with the requested width', () => {
    const card = modalCard(450);
    expect(card.width).toBe(450);
  });
  it('normalizes maxHeight to 85vh', () => {
    expect(modalCard(400).maxHeight).toBe('85vh');
    expect(modalCard(600).maxHeight).toBe('85vh');
  });
  it('uses dark background and border', () => {
    const card = modalCard(500);
    expect(card.background).toBe('var(--wf-bg-panel)');
    expect(card.border).toBe('1px solid var(--wf-border-default)');
  });
});

// ── shared.tsx: components & hooks still exported ────────────

describe('shared exports', () => {
  it('module exports all expected component names', async () => {
    const mod = await import('../panels/shared.js');
    expect(mod.PanelHeader).toBeTypeOf('function');
    expect(mod.ConfirmButton).toBeTypeOf('function');
    expect(mod.EmptyState).toBeTypeOf('function');
    expect(mod.useFocusHighlight).toBeTypeOf('function');
  });
});
