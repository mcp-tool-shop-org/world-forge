// shared.tsx — reusable panel styles and components

import { useCallback, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { useEditorStore } from '../store/editor-store.js';

// ── Shared Styles ──────────────────────────────────────────────

export const sectionTitle: CSSProperties = {
  fontSize: 12, fontWeight: 600, color: '#c9d1d9', marginTop: 14, marginBottom: 6,
  borderBottom: '1px solid #21262d', paddingBottom: 4,
};

export const labelStyle: CSSProperties = { display: 'block', fontSize: 12, color: '#8b949e', marginBottom: 8 };

export const inputStyle: CSSProperties = {
  display: 'block', width: '100%', background: '#0d1117', color: '#c9d1d9',
  border: '1px solid #30363d', borderRadius: 3, padding: '4px 8px', fontSize: 12, marginTop: 3,
  outline: 'none',
};

export const addBtnStyle: CSSProperties = {
  fontSize: 11, background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 4, cursor: 'pointer', padding: '6px 12px', width: '100%', marginTop: 6,
};

export const smallBtnStyle: CSSProperties = {
  fontSize: 10, background: '#21262d', color: '#c9d1d9', border: '1px solid #30363d',
  borderRadius: 3, cursor: 'pointer', padding: '3px 10px',
};

export const xBtnStyle: CSSProperties = {
  background: 'transparent', border: 'none', color: '#f85149',
  cursor: 'pointer', fontSize: 14, padding: '0 4px', lineHeight: 1,
};

export const itemStyle: CSSProperties = {
  padding: 8, background: '#161b22', borderRadius: 4, marginBottom: 4, border: '1px solid #30363d',
};

export const hintStyle: CSSProperties = {
  fontSize: 10, color: '#484f58', marginTop: 2, fontStyle: 'italic',
};

export const deleteBtnStyle: CSSProperties = {
  width: '100%', background: '#da3633', color: '#fff', border: 'none',
  borderRadius: 4, cursor: 'pointer', padding: '6px 12px', fontSize: 11, marginTop: 10,
};

export const ACTIVE_TAB_BG = '#58a6ff';

export const MODAL_OVERLAY: CSSProperties = {
  position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)',
  display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
};

export function MODAL_CARD(width: number): CSSProperties {
  return {
    background: '#161b22', border: '1px solid #30363d', borderRadius: 8,
    padding: 20, width, maxHeight: '85vh', overflow: 'auto',
  };
}

// ── Panel Header ─────────────────────────────────────────────

export function PanelHeader({ title, badge, actions }: {
  title: string;
  badge?: string | number;
  actions?: ReactNode;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 600, color: '#c9d1d9' }}>{title}</span>
      {badge != null && (
        <span style={{
          fontSize: 10, background: '#30363d', color: '#8b949e',
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
        ...deleteBtnStyle,
        ...(armed ? { background: '#0d1117', color: '#f85149', border: '1px solid #f85149' } : {}),
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
      <div style={{ fontSize: 13, color: '#c9d1d9', fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: '#8b949e', lineHeight: 1.5, marginBottom: 10 }}>{description}</div>
      {actions.map((a, i) => (
        <button key={i} onClick={a.onClick} style={{ ...addBtnStyle, marginTop: i > 0 ? 4 : 0 }}>
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
      ref.current.style.outline = '2px solid #58a6ff';
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
