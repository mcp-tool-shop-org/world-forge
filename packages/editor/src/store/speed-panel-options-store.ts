// speed-panel-options-store.ts — persisted Speed Panel trigger and threshold options

import { create } from 'zustand';
import { HOTKEY_BINDINGS } from '../hotkeys.js';

export const SPEED_PANEL_OPTIONS_KEY = 'wf.speedPanel.options.v1';

export const CLICK_DRIFT_RANGE = { min: 4, max: 15, default: 6, penDefault: 8 } as const;
export const DOUBLE_CLICK_RADIUS_RANGE = { min: 12, max: 45, default: 18, penDefault: 24 } as const;
export const DOUBLE_CLICK_WINDOW_RANGE = { min: 250, max: 500, default: 320, penDefault: 360 } as const;

export interface SpeedPanelOptions {
  version: 1;
  keyTriggerEnabled: boolean;
  triggerKey: string;
  doubleRightClickEnabled: boolean;
  clickDriftPx: number;
  doubleClickRadiusPx: number;
  doubleClickWindowMs: number;
}

export const DEFAULT_SPEED_PANEL_OPTIONS: SpeedPanelOptions = {
  version: 1,
  keyTriggerEnabled: true,
  triggerKey: 'KeyQ',
  doubleRightClickEnabled: true,
  clickDriftPx: CLICK_DRIFT_RANGE.default,
  doubleClickRadiusPx: DOUBLE_CLICK_RADIUS_RANGE.default,
  doubleClickWindowMs: DOUBLE_CLICK_WINDOW_RANGE.default,
};

export interface ResolvedGestureThresholds {
  driftPx: number;
  radiusPx: number;
  windowMs: number;
}

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Resolve effective click-drift, double-click radius, and double-click timing window
 * for a pointer event. Stylus input (`pointerType === 'pen'`) receives calibrated pen
 * headroom within the documented ranges.
 */
export function resolveGestureThresholds(
  options: SpeedPanelOptions,
  pointerType?: string,
): ResolvedGestureThresholds {
  const driftPx = clamp(options.clickDriftPx, CLICK_DRIFT_RANGE.min, CLICK_DRIFT_RANGE.max);
  const radiusPx = clamp(options.doubleClickRadiusPx, DOUBLE_CLICK_RADIUS_RANGE.min, DOUBLE_CLICK_RADIUS_RANGE.max);
  const windowMs = clamp(options.doubleClickWindowMs, DOUBLE_CLICK_WINDOW_RANGE.min, DOUBLE_CLICK_WINDOW_RANGE.max);

  if (pointerType === 'pen') {
    return {
      driftPx: clamp(driftPx + 2, CLICK_DRIFT_RANGE.penDefault, CLICK_DRIFT_RANGE.max),
      radiusPx: clamp(radiusPx + 6, DOUBLE_CLICK_RADIUS_RANGE.penDefault, DOUBLE_CLICK_RADIUS_RANGE.max),
      windowMs: clamp(windowMs + 40, DOUBLE_CLICK_WINDOW_RANGE.penDefault, DOUBLE_CLICK_WINDOW_RANGE.max),
    };
  }
  return { driftPx, radiusPx, windowMs };
}

const KEY_CODE_ALIASES: Record<string, string> = {
  ' ': 'Space',
  Space: 'Space',
  Spacebar: 'Space',
  Tab: 'Tab',
  '`': 'Backquote',
  Backquote: 'Backquote',
  '/': 'Slash',
  Slash: 'Slash',
  ';': 'Semicolon',
  Semicolon: 'Semicolon',
  '[': 'BracketLeft',
  BracketLeft: 'BracketLeft',
  ']': 'BracketRight',
  BracketRight: 'BracketRight',
  ',': 'Comma',
  Comma: 'Comma',
  '.': 'Period',
  Period: 'Period',
  "'": 'Quote',
  Quote: 'Quote',
  '\\': 'Backslash',
  Backslash: 'Backslash',
  '-': 'Minus',
  Minus: 'Minus',
  '=': 'Equal',
  Equal: 'Equal',
  Enter: 'Enter',
  Return: 'Enter',
  Escape: 'Escape',
  Esc: 'Escape',
  Delete: 'Delete',
  Del: 'Delete',
  Backspace: 'Backspace',
  ArrowUp: 'ArrowUp',
  ArrowDown: 'ArrowDown',
  ArrowLeft: 'ArrowLeft',
  ArrowRight: 'ArrowRight',
  Dead: 'Dead',
};

const MODIFIER_CODES = new Set([
  'ShiftLeft',
  'ShiftRight',
  'Shift',
  'ControlLeft',
  'ControlRight',
  'Control',
  'AltLeft',
  'AltRight',
  'Alt',
  'MetaLeft',
  'MetaRight',
  'Meta',
  'OSLeft',
  'OSRight',
  'CapsLock',
  'NumLock',
  'ScrollLock',
  'Unidentified',
]);

/** Normalize a KeyboardEvent code/key or short key name into a canonical KeyboardEvent.code. */
export function normalizeTriggerKeyCode(input: string): string | null {
  const trimmed = input === ' ' ? ' ' : input.trim();
  if (!trimmed) return null;
  if (trimmed in KEY_CODE_ALIASES) return KEY_CODE_ALIASES[trimmed];
  if (/^Key[A-Z]$/.test(trimmed)) return trimmed;
  if (/^[a-zA-Z]$/.test(trimmed)) return `Key${trimmed.toUpperCase()}`;
  if (/^Digit[0-9]$/.test(trimmed)) return trimmed;
  if (/^[0-9]$/.test(trimmed)) return `Digit${trimmed}`;
  if (MODIFIER_CODES.has(trimmed)) return trimmed;
  return null;
}

const KEY_LABELS: Record<string, string> = {
  Semicolon: ';',
  BracketLeft: '[',
  BracketRight: ']',
  Comma: ',',
  Period: '.',
  Quote: "'",
  Backslash: '\\',
  Minus: '-',
  Equal: '=',
  Space: 'Space',
  Tab: 'Tab',
  Backquote: '`',
  Slash: '/',
};

/** Format a canonical trigger key code for UI labels and discovery footers. */
export function formatTriggerKeyLabel(code: string): string {
  if (code.startsWith('Key') && code.length === 4) return code.slice(3);
  if (code.startsWith('Digit') && code.length === 6) return code.slice(5);
  return KEY_LABELS[code] ?? code;
}

export type TriggerKeyValidation =
  | { valid: true; code: string; label: string }
  | { valid: false; reason: string };

/** Validate a candidate trigger key, refusing canvas-reserved, layout-hazardous, or hotkey-clashing keys. */
export function validateTriggerKey(input: string): TriggerKeyValidation {
  const code = normalizeTriggerKeyCode(input);
  if (!code) {
    return {
      valid: false,
      reason: `Unsupported trigger key "${input}". Choose an unused letter or punctuation key such as Q, K, or ;.`,
    };
  }
  if (MODIFIER_CODES.has(code)) {
    return { valid: false, reason: 'Modifier and lock keys cannot be used as the Speed Panel trigger.' };
  }
  if (code === 'Dead') {
    return { valid: false, reason: 'Dead keys cannot trigger the Speed Panel reliably across keyboard layouts.' };
  }
  if (code === 'Space') {
    return { valid: false, reason: 'Space is used to pan the canvas while held.' };
  }
  if (code === 'Tab') {
    return { valid: false, reason: 'Tab is used for keyboard focus navigation.' };
  }
  if (code === 'Backquote') {
    return { valid: false, reason: 'Backtick is a dead key on several international keyboard layouts.' };
  }
  if (code === 'Slash') {
    return { valid: false, reason: 'Slash triggers browser Quick Find.' };
  }

  for (const binding of HOTKEY_BINDINGS) {
    if (binding.ctrl || binding.shift) continue;
    if (binding.key === code) {
      return {
        valid: false,
        reason: `Key ${binding.label} is already used by ${binding.description} (${binding.action}).`,
      };
    }
  }

  return { valid: true, code, label: formatTriggerKeyLabel(code) };
}

/** Generate the compact context-menu discovery footer purely from active trigger options. */
export function formatSpeedPanelTriggerFooter(options: SpeedPanelOptions): string {
  const triggers: string[] = [];
  if (options.keyTriggerEnabled) {
    triggers.push(formatTriggerKeyLabel(options.triggerKey));
  }
  if (options.doubleRightClickEnabled) {
    triggers.push('2\u00D7Right-Click');
  }
  return triggers.length > 0 ? `Speed Panel \u2014 ${triggers.join(' / ')}` : 'Speed Panel';
}

/** Load and sanitize persisted options without disturbing pre-existing Speed Panel localStorage keys. */
export function loadSpeedPanelOptions(): SpeedPanelOptions {
  try {
    if (typeof localStorage === 'undefined') return { ...DEFAULT_SPEED_PANEL_OPTIONS };
    const raw = localStorage.getItem(SPEED_PANEL_OPTIONS_KEY);
    if (!raw) return { ...DEFAULT_SPEED_PANEL_OPTIONS };
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { ...DEFAULT_SPEED_PANEL_OPTIONS };
    }
    const obj = parsed as Record<string, unknown>;
    const keyResult =
      typeof obj.triggerKey === 'string'
        ? validateTriggerKey(obj.triggerKey)
        : ({ valid: false } as const);

    return {
      version: 1,
      keyTriggerEnabled:
        typeof obj.keyTriggerEnabled === 'boolean'
          ? obj.keyTriggerEnabled
          : DEFAULT_SPEED_PANEL_OPTIONS.keyTriggerEnabled,
      triggerKey: keyResult.valid ? keyResult.code : DEFAULT_SPEED_PANEL_OPTIONS.triggerKey,
      doubleRightClickEnabled:
        typeof obj.doubleRightClickEnabled === 'boolean'
          ? obj.doubleRightClickEnabled
          : DEFAULT_SPEED_PANEL_OPTIONS.doubleRightClickEnabled,
      clickDriftPx:
        typeof obj.clickDriftPx === 'number'
          ? clamp(obj.clickDriftPx, CLICK_DRIFT_RANGE.min, CLICK_DRIFT_RANGE.max)
          : DEFAULT_SPEED_PANEL_OPTIONS.clickDriftPx,
      doubleClickRadiusPx:
        typeof obj.doubleClickRadiusPx === 'number'
          ? clamp(obj.doubleClickRadiusPx, DOUBLE_CLICK_RADIUS_RANGE.min, DOUBLE_CLICK_RADIUS_RANGE.max)
          : DEFAULT_SPEED_PANEL_OPTIONS.doubleClickRadiusPx,
      doubleClickWindowMs:
        typeof obj.doubleClickWindowMs === 'number'
          ? clamp(obj.doubleClickWindowMs, DOUBLE_CLICK_WINDOW_RANGE.min, DOUBLE_CLICK_WINDOW_RANGE.max)
          : DEFAULT_SPEED_PANEL_OPTIONS.doubleClickWindowMs,
    };
  } catch {
    return { ...DEFAULT_SPEED_PANEL_OPTIONS };
  }
}

let _warnedOptionsWrite = false;

function saveSpeedPanelOptions(options: SpeedPanelOptions): void {
  try {
    if (typeof localStorage === 'undefined') return;
    localStorage.setItem(SPEED_PANEL_OPTIONS_KEY, JSON.stringify(options));
  } catch (e) {
    if (!_warnedOptionsWrite) {
      console.warn('Failed to persist speed-panel options to localStorage:', e);
      _warnedOptionsWrite = true;
    }
  }
}

export interface SpeedPanelOptionsState {
  options: SpeedPanelOptions;
  setKeyTriggerEnabled: (enabled: boolean) => void;
  setTriggerKey: (input: string) => { ok: true; code: string } | { ok: false; reason: string };
  setDoubleRightClickEnabled: (enabled: boolean) => void;
  setClickDriftPx: (px: number) => void;
  setDoubleClickRadiusPx: (px: number) => void;
  setDoubleClickWindowMs: (ms: number) => void;
  resetOptions: () => void;
}

export const useSpeedPanelOptions = create<SpeedPanelOptionsState>((set, get) => ({
  options: loadSpeedPanelOptions(),

  setKeyTriggerEnabled: (enabled) => set((s) => {
    const next: SpeedPanelOptions = { ...s.options, keyTriggerEnabled: enabled };
    saveSpeedPanelOptions(next);
    return { options: next };
  }),

  setTriggerKey: (input) => {
    const res = validateTriggerKey(input);
    if (!res.valid) {
      return { ok: false, reason: res.reason };
    }
    const next: SpeedPanelOptions = { ...get().options, triggerKey: res.code };
    saveSpeedPanelOptions(next);
    set({ options: next });
    return { ok: true, code: res.code };
  },

  setDoubleRightClickEnabled: (enabled) => set((s) => {
    const next: SpeedPanelOptions = { ...s.options, doubleRightClickEnabled: enabled };
    saveSpeedPanelOptions(next);
    return { options: next };
  }),

  setClickDriftPx: (px) => set((s) => {
    const next: SpeedPanelOptions = {
      ...s.options,
      clickDriftPx: clamp(px, CLICK_DRIFT_RANGE.min, CLICK_DRIFT_RANGE.max),
    };
    saveSpeedPanelOptions(next);
    return { options: next };
  }),

  setDoubleClickRadiusPx: (px) => set((s) => {
    const next: SpeedPanelOptions = {
      ...s.options,
      doubleClickRadiusPx: clamp(px, DOUBLE_CLICK_RADIUS_RANGE.min, DOUBLE_CLICK_RADIUS_RANGE.max),
    };
    saveSpeedPanelOptions(next);
    return { options: next };
  }),

  setDoubleClickWindowMs: (ms) => set((s) => {
    const next: SpeedPanelOptions = {
      ...s.options,
      doubleClickWindowMs: clamp(ms, DOUBLE_CLICK_WINDOW_RANGE.min, DOUBLE_CLICK_WINDOW_RANGE.max),
    };
    saveSpeedPanelOptions(next);
    return { options: next };
  }),

  resetOptions: () => {
    const next = { ...DEFAULT_SPEED_PANEL_OPTIONS };
    saveSpeedPanelOptions(next);
    set({ options: next });
  },
}));
