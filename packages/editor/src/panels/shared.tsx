// shared.tsx — reusable panel styles and components

import { useEffect, useRef, type CSSProperties } from 'react';
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
