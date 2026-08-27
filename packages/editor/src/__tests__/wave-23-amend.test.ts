// wave-23-amend.test.ts — Stage D visual polish for editor-core findings
// in swarm-1787820671-c76a wave 23.

import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { KIND_COLORS } from '../ui/Toast.js';
import { SPEED_PANEL_ACTIONS, SPEED_PANEL_ICON_GLYPH } from '../speed-panel-actions.js';
import { CONNECTION_KIND_STYLES, getKindStyle } from '../connection-lines.js';
import { resolveCssColor } from '../ui/css-var.js';
import { toolbarRow } from '../ui/styles.js';
import { getInitialTheme } from '../App.js';

const here = dirname(fileURLToPath(import.meta.url));

function src(rel: string): string {
  return readFileSync(join(here, rel), 'utf8');
}

function extractTokens(block: string): Record<string, string> {
  const out: Record<string, string> = {};
  const re = /(--wf-[\w-]+)\s*:\s*([^;]+);/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(block))) out[m[1]] = m[2].trim();
  return out;
}

function isColorValue(value: string): boolean {
  return /^(#|rgba?\(|hsla?\()/i.test(value);
}

function srgbToLin(channel: number): number {
  const s = channel / 255;
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
}

function hexLum(hex: string): number {
  const raw = hex.replace('#', '');
  const full = raw.length === 3 ? raw.split('').map((c) => c + c).join('') : raw;
  const n = Number.parseInt(full, 16);
  const r = (n >> 16) & 255;
  const g = (n >> 8) & 255;
  const b = n & 255;
  return 0.2126 * srgbToLin(r) + 0.7152 * srgbToLin(g) + 0.0722 * srgbToLin(b);
}

function contrast(a: string, b: string): number {
  const L1 = hexLum(a);
  const L2 = hexLum(b);
  const hi = Math.max(L1, L2);
  const lo = Math.min(L1, L2);
  return (hi + 0.05) / (lo + 0.05);
}

const themeCss = src('../ui/theme.css');
const darkBlock = themeCss.slice(
  themeCss.indexOf(':root, html.dark, body.dark {'),
  themeCss.indexOf('html.light, body.light {'),
);
const lightBlock = themeCss.slice(
  themeCss.indexOf('html.light, body.light {'),
  themeCss.indexOf('\n:root {'),
);
const darkTokens = extractTokens(darkBlock);
const lightTokens = extractTokens(lightBlock);

describe('F-ce49d7e0: complete light/dark token tables', () => {
  it('light table defines every --wf-* color token :root/dark defines', () => {
    const missing: string[] = [];
    for (const [name, value] of Object.entries(darkTokens)) {
      if (!isColorValue(value)) continue;
      if (!(name in lightTokens)) missing.push(name);
    }
    expect(missing).toEqual([]);
  });

  it('light overrides input/elevated/hover/faint/success-text/danger-text/border-subtle', () => {
    for (const name of [
      '--wf-bg-input', '--wf-bg-elevated', '--wf-bg-hover',
      '--wf-text-faint', '--wf-success-text', '--wf-danger-text', '--wf-border-subtle',
    ]) {
      expect(lightTokens[name]).toBeTruthy();
      expect(lightTokens[name]).not.toBe(darkTokens[name]);
    }
  });

  it('index.html applies a FOUC theme class and body uses tokens after load', () => {
    const html = src('../../index.html');
    expect(html).toContain('prefers-color-scheme: light');
    expect(html).toContain("document.documentElement.classList.add(theme)");
    expect(html).toContain('/favicon.svg');
    expect(html).toContain('html.light, html.light body');
  });

  it('App no longer injects a partial LIGHT_THEME_STYLE overlay', () => {
    const app = src('../App.tsx');
    expect(app).not.toContain('LIGHT_THEME_STYLE');
    expect(app).toContain('prefers-color-scheme: light');
    expect(app).toContain('document.documentElement.classList.toggle');
  });

  it('ErrorBoundary, Toast, canvas menu, and minimap consume tokens not zinc hex', () => {
    const err = src('../ErrorBoundary.tsx');
    expect(err).toContain('var(--wf-bg-app)');
    expect(err).toContain('var(--wf-text-primary)');
    expect(err).toContain('/mark.svg');
    expect(err).not.toContain('#18181b');
    const toast = src('../ui/Toast.tsx');
    expect(toast).toContain('var(--wf-accent)');
    expect(toast).toContain('var(--wf-success-text)');
    const canvas = src('../Canvas.tsx');
    expect(canvas).toContain("readCssVar('--wf-bg-app'");
    expect(canvas).toContain('var(--wf-bg-elevated)');
    expect(canvas).not.toContain("background: '#1c2128'");
    expect(canvas).not.toContain("background: 'rgba(13,17,23,0.85)'");
  });

  it('F-407b7c74: canvas overlay stroke/fill and App badgeColor keep no leftover #fff/#aaa/#ccc hex', () => {
    const canvas = src('../Canvas.tsx');
    expect(canvas).not.toMatch(/(?:strokeStyle|fillStyle)\s*=\s*'#fff'/);
    expect(canvas).not.toMatch(/fillStyle\s*=\s*'#aaa'/);
    expect(canvas).not.toMatch(/fillStyle\s*=\s*'#ccc'/);
    expect(canvas).not.toMatch(/selected \? '#fff' : '#ccc'/);
    // F-b42da805: leftover GitHub-dark overlay paint (not readCssVar fallbacks)
    expect(canvas).not.toMatch(/fillStyle\s*=\s*['"]#e6f0ff['"]/);
    expect(canvas).not.toMatch(/fillStyle\s*=\s*['"]#58a6ff['"]/);
    expect(canvas).not.toMatch(/fillStyle\s*=\s*['"]rgba\(\s*88\s*,\s*166\s*,\s*255/);
    expect(canvas).toMatch(/fillLabelPill\(text,\s*[^,]+,\s*[^,]+,\s*tokenAccentText\)/);
    expect(canvas).toContain("readCssVar('--wf-accent'");
    expect(canvas).toContain("readCssVar('--wf-text-muted'");
    expect(canvas).toContain("readCssVar('--wf-bg-overlay'");
    expect(canvas).toContain("readCssVar('--wf-accent-text'");
    const app = src('../App.tsx');
    expect(app).not.toMatch(/badgeColor:\s*'#[0-9A-Fa-f]+'/);
    expect(app).not.toMatch(/badgeColor \?\? '#[0-9A-Fa-f]+'/);
    expect(app).toContain("badgeColor: 'var(--wf-warning)'");
    expect(app).toContain("'var(--wf-success)'");
    expect(app).toContain("t.badgeColor ?? 'var(--wf-text-muted)'");
    expect(app).toContain("color: 'var(--wf-on-danger)'");
    expect(app).toContain('var(--wf-on-warning)');
    expect(app).toContain('var(--wf-on-success)');
  });

  it('F-407b7c74: ring/label/tab-badge token pairs meet 4.5:1 in light', () => {
    expect(contrast(lightTokens['--wf-accent'], lightTokens['--wf-bg-app'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightTokens['--wf-text-primary'], lightTokens['--wf-bg-app'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightTokens['--wf-text-muted'], lightTokens['--wf-bg-elevated'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightTokens['--wf-accent-text'], lightTokens['--wf-bg-elevated'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightTokens['--wf-text-primary'], lightTokens['--wf-bg-elevated'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightTokens['--wf-on-warning'], lightTokens['--wf-warning'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightTokens['--wf-on-success'], lightTokens['--wf-success'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightTokens['--wf-on-danger'], lightTokens['--wf-danger'])).toBeGreaterThanOrEqual(4.5);
    expect(contrast(lightTokens['--wf-on-accent'], lightTokens['--wf-text-muted'])).toBeGreaterThanOrEqual(4.5);
    for (const tokens of [darkTokens, lightTokens]) {
      expect(contrast(tokens['--wf-accent'], tokens['--wf-bg-app'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--wf-text-muted'], tokens['--wf-bg-elevated'])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('getInitialTheme stored value wins; unset honors prefers-color-scheme when window exists', () => {
    try { localStorage.removeItem('wf-theme'); } catch { /* ignore */ }
    localStorage.setItem('wf-theme', 'dark');
    expect(getInitialTheme()).toBe('dark');
    localStorage.setItem('wf-theme', 'light');
    expect(getInitialTheme()).toBe('light');
    localStorage.removeItem('wf-theme');
    if (typeof window !== 'undefined') {
      Object.defineProperty(window, 'matchMedia', {
        writable: true,
        configurable: true,
        value: (query: string) => ({
          matches: query.includes('prefers-color-scheme: light'),
          media: query,
          onchange: null,
          addListener: () => {},
          removeListener: () => {},
          addEventListener: () => {},
          removeEventListener: () => {},
          dispatchEvent: () => false,
        }),
      });
      expect(getInitialTheme()).toBe('light');
    }
  });
});

describe('F-516a5c4f: status-line contrast fixture', () => {
  it('Valid/Issues text tokens meet 4.5:1 on panel in both themes', () => {
    for (const tokens of [darkTokens, lightTokens]) {
      expect(contrast(tokens['--wf-success-text'], tokens['--wf-bg-panel'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--wf-danger-text'], tokens['--wf-bg-panel'])).toBeGreaterThanOrEqual(4.5);
      expect(contrast(tokens['--wf-text-muted'], tokens['--wf-bg-panel'])).toBeGreaterThanOrEqual(4.5);
    }
  });

  it('App paints Valid/Issues with *-text tokens and Ctrl+K / mode pill with muted', () => {
    const app = src('../App.tsx');
    expect(app).toContain("color: 'var(--wf-success-text)'");
    expect(app).toContain("color: 'var(--wf-danger-text)'");
    expect(app).toContain("color: 'var(--wf-text-muted)' }}>Ctrl+K");
    expect(app).toMatch(/fontSize: 11, color: 'var\(--wf-text-muted\)'/);
  });
});

describe('F-43ee22ef: toast host clears the status line and minimap', () => {
  it('anchors above --wf-bottombar-height and shifts left of the minimap', () => {
    const toast = src('../ui/Toast.tsx');
    // F-69a1f39b: canvas-well absolute; status line is a sibling below the well.
    expect(toast).toContain("bottom: 'var(--wf-space-2)'");
    expect(toast).toContain('var(--wf-minimap-width)');
    expect(toast).toContain('shiftForMinimap');
    expect(toast).not.toMatch(/bottom:\s*16/);
    const app = src('../App.tsx');
    expect(app).toContain('var(--wf-bottombar-height)');
    expect(app).toContain('wf-status-line');
  });

  it('F-69a1f39b: ToastHost shares the canvas well containing block with the minimap', () => {
    const toast = src('../ui/Toast.tsx');
    expect(toast).toMatch(/position:\s*'absolute'/);
    expect(toast).not.toMatch(/position:\s*'fixed'/);
    expect(toast).toContain('calc(var(--wf-minimap-width) + var(--wf-space-2) + var(--wf-space-2))');
    expect(toast).not.toContain('wf-bottombar-height');
    const app = src('../App.tsx');
    const well = app.slice(app.indexOf('{/* Canvas */}'), app.indexOf('{/* Right sidebar'));
    expect(well).toContain('<ToastHost');
    expect(well).toContain("position: 'relative'");
    expect(app.slice(app.indexOf('{/* Right sidebar'))).not.toContain('<ToastHost');
    const canvas = src('../Canvas.tsx');
    expect(canvas).toContain('var(--wf-minimap-width)');
    expect(canvas).toContain('var(--wf-minimap-height)');
    expect(canvas).toContain("bottom: 'var(--wf-space-2)'");
    expect(canvas).toContain("right: 'var(--wf-space-2)'");
    expect(canvas).not.toMatch(/const minimapWidth = 200/);
    expect(canvas).not.toMatch(/bottom:\s*8,\s*right:\s*8/);
  });

  it('KIND_COLORS use accent/success/warning/danger with *-text foregrounds', () => {
    expect(KIND_COLORS.info.bar).toBe('var(--wf-accent)');
    expect(KIND_COLORS.success.bar).toBe('var(--wf-success)');
    expect(KIND_COLORS.warning.bar).toBe('var(--wf-warning)');
    expect(KIND_COLORS.error.bar).toBe('var(--wf-danger)');
    expect(KIND_COLORS.info.fg).toBe('var(--wf-accent-text)');
    expect(KIND_COLORS.success.fg).toBe('var(--wf-success-text)');
    expect(KIND_COLORS.warning.fg).toBe('var(--wf-warning-text)');
    expect(KIND_COLORS.error.fg).toBe('var(--wf-danger-text)');
  });
});

describe('F-48ca21cf: first-run welcome overlay', () => {
  it('empty canvas paints a centered welcome with New/Load/Import/sample', () => {
    const app = src('../App.tsx');
    expect(app).toContain('wf-first-run-welcome');
    expect(app).toContain('project.zones.length === 0');
    expect(app).toContain('New template');
    expect(app).toContain('Open sample');
    expect(app).toContain('Author a world, then export it to a game engine.');
    expect(app).toContain('SAMPLE_WORLDS[0].project');
  });
});

describe('F-4ba7e396: chrome consumes layout tokens', () => {
  it('toolbarRow wraps and App uses sidebar/inspector/topbar tokens', () => {
    expect(toolbarRow.flexWrap).toBe('wrap');
    expect(toolbarRow.minHeight).toBe('var(--wf-topbar-height)');
    const app = src('../App.tsx');
    expect(app).toContain('toolbarRow');
    expect(app).toContain('var(--wf-sidebar-width)');
    expect(app).toContain('var(--wf-inspector-width)');
    expect(app).toContain('var(--wf-bottombar-height)');
    expect(app).toContain('wf-save-menu');
    expect(app).toContain("marginLeft: 'auto'");
  });
});

describe('F-95e5bb3f: canvas overlays are tokenized', () => {
  it('grid and connection kinds use tokens; secret stays dashed', () => {
    const canvas = src('../Canvas.tsx');
    expect(canvas).toContain("readCssVar('--wf-grid-line'");
    expect(canvas).toContain("readCssVar('--wf-bg-elevated'");
    expect(canvas).toContain("readCssVar('--wf-text-primary'");
    expect(getKindStyle('secret').dash).toEqual([3, 5]);
    expect(getKindStyle('secret').color).toBe('var(--wf-conn-secret)');
    expect(CONNECTION_KIND_STYLES.passage.color).toBe('var(--wf-conn-passage)');
    expect(CONNECTION_KIND_STYLES.channel.color).toBe('var(--wf-conn-channel)');
  });

  it('grid and secret strokes meet 3:1 against the canvas well', () => {
    for (const tokens of [darkTokens, lightTokens]) {
      expect(contrast(tokens['--wf-grid-line'], tokens['--wf-bg-app'])).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens['--wf-conn-secret'], tokens['--wf-bg-app'])).toBeGreaterThanOrEqual(3);
      expect(contrast(tokens['--wf-conn-passage'], tokens['--wf-bg-app'])).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('F-be3670a3: command-palette glyphs and descriptions', () => {
  it('every action has a closed iconId, unique label, glyph, and one-line description', () => {
    const labels = new Set<string>();
    const iconIds = new Set<string>();
    for (const a of SPEED_PANEL_ACTIONS) {
      expect(a.description && a.description.length).toBeGreaterThan(8);
      expect(a.iconId).toBeTruthy();
      expect(a.icon).toBe(SPEED_PANEL_ICON_GLYPH[a.iconId!]);
      expect(a.icon).not.toMatch(/^[A-Za-z]{1,3}$/);
      expect(labels.has(a.label)).toBe(false);
      labels.add(a.label);
      expect(iconIds.has(a.iconId!)).toBe(false);
      iconIds.add(a.iconId!);
    }
    expect(SPEED_PANEL_ACTIONS.some((a) => a.icon === '\uD83D\uDCCB')).toBe(false);
  });

  it('context menu renders the 16px glyph and the description line', () => {
    const canvas = src('../Canvas.tsx');
    expect(canvas).toContain('action.description');
    expect(canvas).toContain('fontSize: 16, width: 16');
  });
});

describe('F-d0fde662: chrome mark is a transparent 32px cutout', () => {
  it('top bar and ErrorBoundary use mark.svg; favicon is the 16px variant', () => {
    const app = src('../App.tsx');
    expect(app).toContain('/mark.svg');
    expect(app).not.toContain('/logo.png');
    const mark = src('../../public/mark.svg');
    expect(mark).toContain('viewBox="0 0 32 32"');
    expect(mark.toLowerCase()).not.toContain('#e8e8e8');
    const fav = src('../../public/favicon.svg');
    expect(fav).toContain('viewBox="0 0 16 16"');
  });
});

describe('css-var resolver', () => {
  it('passes raw colors through and falls back when document is missing', () => {
    expect(resolveCssColor('#58a6ff', '#000')).toBe('#58a6ff');
    expect(resolveCssColor('var(--wf-accent)', '#58a6ff')).toBe('#58a6ff');
  });
});
