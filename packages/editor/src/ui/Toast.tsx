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
  /** Milliseconds before auto-dismiss. Defaults to 2500. */
  durationMs: number;
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
export function pushToast(message: string, kind: ToastKind = 'info', durationMs = 2500): number {
  const id = _nextId++;
  const entry: ToastEntry = { id, message, kind, durationMs };
  _toasts = [..._toasts, entry];
  emit();
  // Auto-dismiss
  if (typeof setTimeout !== 'undefined') {
    setTimeout(() => dismissToast(id), durationMs);
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

const KIND_COLORS: Record<ToastKind, { bg: string; fg: string }> = {
  info: { bg: '#1f6feb', fg: '#fff' },
  success: { bg: '#238636', fg: '#fff' },
  warning: { bg: '#9e6a03', fg: '#fff' },
  error: { bg: '#da3633', fg: '#fff' },
};

export function ToastHost() {
  const [toasts, setToasts] = useState<ToastEntry[]>(_toasts);
  useEffect(() => {
    _listeners.add(setToasts);
    return () => { _listeners.delete(setToasts); };
  }, []);

  if (toasts.length === 0) return null;

  return (
    <div
      data-testid="wf-toast-host"
      style={{
        position: 'fixed', bottom: 16, right: 16, zIndex: 10000,
        display: 'flex', flexDirection: 'column', gap: 6,
        pointerEvents: 'none',
      }}
    >
      {toasts.map((t) => {
        const c = KIND_COLORS[t.kind];
        return (
          <div
            key={t.id}
            role="status"
            aria-live="polite"
            style={{
              background: c.bg, color: c.fg, padding: '6px 12px',
              borderRadius: 6, fontSize: 12, fontWeight: 500,
              boxShadow: '0 4px 12px rgba(0,0,0,0.4)', pointerEvents: 'auto',
              maxWidth: 360,
            }}
            onClick={() => dismissToast(t.id)}
          >
            {t.message}
          </div>
        );
      })}
    </div>
  );
}
