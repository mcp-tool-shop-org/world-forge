// shared.tsx — reusable panel components and hooks

import { useCallback, useEffect, useRef, useState, type CSSProperties, type KeyboardEvent, type ReactNode } from 'react';
import { useEditorStore } from '../store/editor-store.js';
import { buttonDangerFull, buttonFullWidth } from '../ui/styles.js';

/** Keyboard handler — fires callback on Enter or Space, matching button semantics. */
export const onEnter = (fn: () => void) => (e: KeyboardEvent) => {
  if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fn(); }
};

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

/** Centered empty-panel primitive. Icon is decorative; actions are optional. */
export function EmptyState({ title, description, actions, icon }: {
  title: string;
  description: string;
  actions?: { label: string; onClick: () => void; testId?: string }[];
  icon?: string;
}) {
  const items = actions ?? [];
  return (
    <div style={{ padding: 'var(--wf-space-2) 0', textAlign: 'center' }}>
      <div
        aria-hidden
        style={{
          fontSize: 22, lineHeight: 1, marginBottom: 6,
          color: 'var(--wf-text-muted)',
        }}
      >
        {icon ?? '\u25A2'}
      </div>
      <div style={{ fontSize: 13, color: 'var(--wf-text-primary)', fontWeight: 600, marginBottom: 6 }}>{title}</div>
      <div style={{ fontSize: 11, color: 'var(--wf-text-muted)', lineHeight: 1.5, marginBottom: items.length > 0 ? 10 : 0 }}>{description}</div>
      {items.map((a, i) => (
        <button
          key={i}
          onClick={a.onClick}
          data-testid={a.testId}
          style={{ ...buttonFullWidth, marginTop: i > 0 ? 4 : 0 }}
        >
          {a.label}
        </button>
      ))}
    </div>
  );
}

/** Pressed-chip used by ToolPalette layer/snap toggles (replaces native checkboxes). */
export function LayerChip({ label, pressed, onToggle }: {
  label: string;
  pressed: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={pressed}
      onClick={onToggle}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        fontSize: 'var(--wf-font-md)',
        padding: 'var(--wf-space-1) var(--wf-space-2)',
        marginBottom: 2,
        cursor: 'pointer',
        borderRadius: 'var(--wf-radius-sm)',
        border: `1px solid ${pressed ? 'var(--wf-accent)' : 'var(--wf-border-default)'}`,
        background: pressed ? 'var(--wf-bg-hover)' : 'var(--wf-bg-control)',
        color: pressed ? 'var(--wf-text-primary)' : 'var(--wf-text-muted)',
      }}
    >
      {pressed ? '\u25C9' : '\u25CE'} {label}
    </button>
  );
}

/** Semantic / status palettes as named tokens (light-mode remaps with --wf-*). */
export const STATUS_TOKEN = {
  unchanged: 'var(--wf-text-muted)',
  modified: 'var(--wf-accent)',
  added: 'var(--wf-success-text)',
  removed: 'var(--wf-danger-text)',
} as const;

export const HEALTH_TOKEN = {
  ready: 'var(--wf-success-text)',
  healthy: 'var(--wf-success-text)',
  degraded: 'var(--wf-warning)',
  blocked: 'var(--wf-danger-text)',
} as const;

export const KIND_TOKEN: Record<string, string> = {
  portrait: 'var(--wf-accent)',
  sprite: 'var(--wf-success-text)',
  background: 'var(--wf-text-faint)',
  icon: 'var(--wf-warning)',
  tileset: 'var(--wf-accent)',
};

export const ROLE_TOKEN: Record<string, string> = {
  npc: 'var(--wf-accent)',
  enemy: 'var(--wf-danger-text)',
  merchant: 'var(--wf-warning)',
  'quest-giver': 'var(--wf-success-text)',
  companion: 'var(--wf-success-text)',
  boss: 'var(--wf-danger)',
};

export const BANNER_OK: CSSProperties = {
  background: 'color-mix(in srgb, var(--wf-success) 18%, var(--wf-bg-panel))',
  border: '1px solid var(--wf-success)',
  color: 'var(--wf-success-text)',
};

export const BANNER_WARN: CSSProperties = {
  background: 'color-mix(in srgb, var(--wf-warning) 18%, var(--wf-bg-panel))',
  border: '1px solid var(--wf-warning)',
  color: 'var(--wf-warning)',
};

export const BANNER_DANGER: CSSProperties = {
  background: 'var(--wf-danger-bg, color-mix(in srgb, var(--wf-danger) 18%, var(--wf-bg-panel)))',
  border: '1px solid var(--wf-danger-text)',
  color: 'var(--wf-danger-text)',
};

// ── Visibility Toggle (FT-009) ────────────────────────────────

/** Eye icon button for toggling per-object visibility on the canvas. */
export function VisibilityToggle({ id }: { id: string }) {
  const hidden = useEditorStore((s) => s.hiddenIds.has(id));
  const toggleHidden = useEditorStore((s) => s.toggleHidden);
  return (
    <button
      data-testid={`visibility-toggle-${id}`}
      onClick={(e) => { e.stopPropagation(); toggleHidden(id); }}
      title={hidden ? 'Show on canvas' : 'Hide on canvas'}
      // ED-B-004: icon-only button — screen readers need both an aria-label
      // and the pressed-state for this toggle. tabIndex is already default 0
      // for buttons, but we pin it so the a11y intent is visible in source.
      aria-label={hidden ? 'Show on canvas' : 'Hide on canvas'}
      aria-pressed={hidden}
      tabIndex={0}
      style={{
        background: 'none', border: 'none', cursor: 'pointer', padding: '0 4px',
        fontSize: 12, color: hidden ? 'var(--wf-text-muted)' : 'var(--wf-text-primary)', lineHeight: 1,
      }}
    >
      {hidden ? '\u25C9' : '\u25CE'}
    </button>
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
