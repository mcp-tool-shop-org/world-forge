// Toast.tsx — small toast helper for transient user-facing feedback (ED-B-*).
//
// Stage C humanization: there was already an ad-hoc toast inlined in App.tsx
// (FT-022 validation-resolved toast), plus several findings asked for
// transient non-intrusive notifications (auto-save error, save confirmation,
// stale-search warnings, etc). This file centralises a tiny pub/sub so any
// component can call `pushToast(...)` without wiring through props/stores.

import { useEffect, useState } from 'react';

export type ToastKind = 'info' | 'success' | 'warning' | 'error';

export interface ToastEntry {
  id: number;
  message: string;
  kind: ToastKind;
  /** Milliseconds before auto-dismiss. 0 = stay until dismissed. */
  durationMs: number;
}

/** F-2fc5e0ad: errors/warnings must barge in; info/success stay polite. */
export function liveRegionForKind(kind: ToastKind): { role: 'alert' | 'status'; ariaLive: 'assertive' | 'polite' } {
  if (kind === 'error' || kind === 'warning') return { role: 'alert', ariaLive: 'assertive' };
  return { role: 'status', ariaLive: 'polite' };
}

function defaultDuration(kind: ToastKind): number {
  if (kind === 'error') return 0;
  if (kind === 'warning') return 8000;
  return 2500;
}

type Listener = (toasts: ToastEntry[]) => void;

let _nextId = 1;
let _toasts: ToastEntry[] = [];
const _listeners = new Set<Listener>();

function emit() {
  const snapshot = [..._toasts];
  for (const l of _listeners) l(snapshot);
}

/** Push a toast. Returns the generated id (callers rarely need it). */
export function pushToast(message: string, kind: ToastKind = 'info', durationMs?: number): number {
  const id = _nextId++;
  const resolved = durationMs ?? defaultDuration(kind);
  const entry: ToastEntry = { id, message, kind, durationMs: resolved };
  _toasts = [..._toasts, entry];
  emit();
  // F-2fc5e0ad: error toasts stay until dismissed (duration 0) so a screen
  // reader has time to speak them. Explicit durations still auto-dismiss.
  if (resolved > 0 && typeof setTimeout !== 'undefined') {
    setTimeout(() => dismissToast(id), resolved);
  }
  return id;
}

/** Dismiss a toast by id. No-op if already gone. */
export function dismissToast(id: number): void {
  const next = _toasts.filter((t) => t.id !== id);
  if (next.length === _toasts.length) return;
  _toasts = next;
  emit();
}

/** Test-only — clear everything. */
export function _resetToastsForTest(): void {
  _toasts = [];
  emit();
}

/** Test-only — read current queue. */
export function _getToastsForTest(): ToastEntry[] {
  return [..._toasts];
}

/** F-43ee22ef: kind fill as a bar; --wf-*-text foregrounds meet 4.5:1 on elevated. */
export const KIND_COLORS: Record<ToastKind, { bg: string; fg: string; bar: string }> = {
  info: { bg: 'var(--wf-bg-elevated)', fg: 'var(--wf-accent-text)', bar: 'var(--wf-accent)' },
  success: { bg: 'var(--wf-bg-elevated)', fg: 'var(--wf-success-text)', bar: 'var(--wf-success)' },
  warning: { bg: 'var(--wf-bg-elevated)', fg: 'var(--wf-warning-text)', bar: 'var(--wf-warning)' },
  error: { bg: 'var(--wf-bg-elevated)', fg: 'var(--wf-danger-text)', bar: 'var(--wf-danger)' },
};

export function ToastHost({ shiftForMinimap = false }: { shiftForMinimap?: boolean }) {
  const [toasts, setToasts] = useState<ToastEntry[]>(_toasts);
  useEffect(() => {
    _listeners.add(setToasts);
    return () => { _listeners.delete(setToasts); };
  }, []);

  if (toasts.length === 0) return null;

  // Sit above the 24px status line. When the minimap occupies bottom-right,
  // shift left by minimap width + its inset so Valid / Issues stay visible.
  const right = shiftForMinimap
    ? 'calc(var(--wf-minimap-width) + var(--wf-space-2) + var(--wf-space-2))'
    : 'var(--wf-space-4)';

  return (
    <div
      data-testid="wf-toast-host"
      style={{
        position: 'fixed',
        bottom: 'calc(var(--wf-bottombar-height) + var(--wf-space-2))',
        right,
        zIndex: 'var(--wf-z-toast)' as unknown as number,
        display: 'flex', flexDirection: 'column', gap: 6,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const c = KIND_COLORS[t.kind];
        const live = liveRegionForKind(t.kind);
        const sticky = t.kind === 'error' || t.kind === 'warning' || t.durationMs === 0;
        return (
          <div
            key={t.id}
            role={live.role}
            aria-live={live.ariaLive}
            aria-atomic="true"
            style={{
              background: c.bg, color: c.fg, padding: '6px 12px',
              borderRadius: 6, fontSize: 12, fontWeight: 500,
              borderLeft: `3px solid ${c.bar}`,
              boxShadow: 'var(--wf-shadow-panel)', pointerEvents: 'auto',
              maxWidth: 360, display: 'flex', alignItems: 'center', gap: 8,
            }}
          >
            <span
              style={{ flex: 1, cursor: 'pointer' }}
              onClick={() => dismissToast(t.id)}
            >
              {t.message}
            </span>
            {sticky && (
              <button
                type="button"
                aria-label="Dismiss notification"
                onClick={() => dismissToast(t.id)}
                style={{
                  background: 'transparent', border: 'none', color: c.fg,
                  cursor: 'pointer', fontSize: 12, padding: '0 2px', fontWeight: 700,
                }}
              >
                {'\u2715'}
              </button>
            )}
          </div>
        );
      })}
    </div>
  );
}
