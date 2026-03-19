// shared.tsx — reusable panel components and hooks

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { buttonDangerFull, buttonFullWidth } from '../ui/styles.js';

// ── Panel Header ─────────────────────────────────────────────

export function PanelHeader({ title, badge, actions }: {
  title: string;
  badge?: string | number;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--wf-text-primary)' }}>{title}</span>
      {badge != null && (
        <span style={{
          fontSize: 10, background: 'var(--wf-bg-hover)', color: 'var(--wf-text-muted)',
          borderRadius: 10, padding: '1px 7px',
        }}>{badge}</span>
      )}
      {actions && <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>{actions}</div>}
    </div>
  );
}

// ── Confirm Button ───────────────────────────────────────────

export function ConfirmButton({ label, onConfirm, style: extraStyle }: {
  label: string;
  onConfirm: () => void;
  style?: CSSProperties;
}) {
  const [armed, setArmed] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClick = useCallback(() => {
    if (armed) {
      onConfirm();
      setArmed(false);
      if (timer.current) clearTimeout(timer.current);
    } else {
      setArmed(true);
      timer.current = setTimeout(() => setArmed(false), 3000);
    }
  }, [armed, onConfirm]);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  return (
    <button
      onClick={handleClick}
      style={{
        ...buttonDangerFull,
        ...(armed ? { background: 'var(--wf-bg-app)', color: 'var(--wf-danger)', border: '1px solid var(--wf-danger)' } : {}),
        ...extraStyle,
      }}
    >
      {armed ? 'Confirm?' : label}
    </button>
  );
}

// ── Empty State ────────────────────────────────────────────────

export function EmptyState({ title, description, actions }: {
  title: string;
  description: string;
  actions: { label: string; onClick: () => void }[];
}) {
  return (
    <div style={{ padding: '8px 0' }}>
      <div style={{ fontSize: 13, color: 'var(--wf-text-primary)', fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', lineHeight: 1.5, marginBottom: 10 }}>{description}</div>
      {actions.map((a, i) => (
        <button key={i} onClick={a.onClick} style={{ ...buttonFullWidth, marginTop: i > 0 ? 4 : 0 }}>
          {a.label}
        </button>
      ))}
    </div>
  );
}

// ── Focus Highlight Hook ───────────────────────────────────────

/** Scrolls into view and pulses the border when focusTarget matches the given domain. */
export function useFocusHighlight(domain: string) {
  const ref = useRef<HTMLDivElement>(null);
  const { focusTarget, setFocusTarget } = useEditorStore();

  useEffect(() => {
    if (!focusTarget || focusTarget.domain !== domain) return;
    // Scroll panel into view
    ref.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    // Pulse highlight
    if (ref.current) {
      ref.current.style.outline = '2px solid var(--wf-accent)';
      ref.current.style.outlineOffset = '2px';
      const timer = setTimeout(() => {
        if (ref.current) {
          ref.current.style.outline = 'none';
          ref.current.style.outlineOffset = '0';
        }
      }, 1500);
      // Clear target so it doesn't re-trigger
      setFocusTarget(null);
      return () => clearTimeout(timer);
    }
    setFocusTarget(null);
  }, [focusTarget, domain, setFocusTarget]);

  return ref;
}
