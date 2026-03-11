/* styles.ts — reusable style primitives referencing theme.css tokens
 *
 * These are CSSProperties objects for use with style={} props.
 * They replace the most common repeated inline-style blobs.
 * Import selectively: import { panelShell, buttonBase } from '../ui/styles.js';
 */

import type { CSSProperties } from 'react';

// ── Layout shells ────────────────────────────────────────────

export const panelShell: CSSProperties = {
  background: 'var(--wf-bg-panel)',
  borderRight: '1px solid var(--wf-border-default)',
  padding: 'var(--wf-space-2)',
  overflowY: 'auto',
  fontSize: 'var(--wf-font-md)',
  color: 'var(--wf-text-primary)',
};

export const inspectorShell: CSSProperties = {
  ...panelShell,
  borderRight: 'none',
  borderLeft: '1px solid var(--wf-border-default)',
};

export const sectionHeader: CSSProperties = {
  fontSize: 'var(--wf-font-md)',
  fontWeight: 600,
  color: 'var(--wf-text-primary)',
  marginTop: 14,
  marginBottom: 6,
  borderBottom: '1px solid var(--wf-border-subtle)',
  paddingBottom: 4,
};

export const toolbarRow: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 'var(--wf-space-2)',
  padding: '6px var(--wf-space-3)',
  background: 'var(--wf-bg-panel)',
  borderBottom: '1px solid var(--wf-border-default)',
};

// ── Buttons ──────────────────────────────────────────────────

export const buttonBase: CSSProperties = {
  background: 'var(--wf-bg-control)',
  color: 'var(--wf-text-primary)',
  border: '1px solid var(--wf-border-default)',
  borderRadius: 'var(--wf-radius-md)',
  padding: '4px 10px',
  cursor: 'pointer',
  fontSize: 'var(--wf-font-md)',
};

export const buttonPrimary: CSSProperties = {
  ...buttonBase,
  background: 'var(--wf-success)',
  color: '#fff',
  border: 'none',
};

export const buttonDanger: CSSProperties = {
  ...buttonBase,
  background: 'var(--wf-danger)',
  color: '#fff',
  border: 'none',
};

export const buttonAccent: CSSProperties = {
  ...buttonBase,
  color: 'var(--wf-accent)',
};

export const buttonGhost: CSSProperties = {
  background: 'transparent',
  border: 'none',
  color: 'var(--wf-text-muted)',
  cursor: 'pointer',
  padding: '0 var(--wf-space-1)',
  fontSize: 'var(--wf-font-xl)',
  lineHeight: 1,
};

// ── Form controls ────────────────────────────────────────────

export const inputBase: CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'var(--wf-bg-input)',
  color: 'var(--wf-text-primary)',
  border: '1px solid var(--wf-border-default)',
  borderRadius: 'var(--wf-radius-sm)',
  padding: '4px 8px',
  fontSize: 'var(--wf-font-md)',
  marginTop: 3,
  outline: 'none',
};

export const labelText: CSSProperties = {
  display: 'block',
  fontSize: 'var(--wf-font-md)',
  color: 'var(--wf-text-muted)',
  marginBottom: 'var(--wf-space-2)',
};

export const selectBase: CSSProperties = {
  ...inputBase,
  cursor: 'pointer',
};

export const inputCompact: CSSProperties = {
  ...inputBase,
  padding: '3px 6px',
  marginTop: 2,
};

// ── Modal primitives ─────────────────────────────────────────

export const overlayBackdrop: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'var(--wf-bg-overlay)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 'var(--wf-z-modal)' as unknown as number,
};

export function modalCard(width: number): CSSProperties {
  return {
    background: 'var(--wf-bg-panel)',
    border: '1px solid var(--wf-border-default)',
    borderRadius: 'var(--wf-radius-lg)',
    padding: 'var(--wf-space-5)',
    width,
    maxHeight: '85vh',
    overflow: 'auto',
  };
}

export const modalTitleRow: CSSProperties = {
  display: 'flex',
  justifyContent: 'space-between',
  alignItems: 'center',
  marginBottom: 'var(--wf-space-4)',
};

export const modalTitle: CSSProperties = {
  margin: 0,
  color: 'var(--wf-text-primary)',
  fontSize: 'var(--wf-font-2xl)',
};

export const modalFooter: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 'var(--wf-space-2)',
  marginTop: 'var(--wf-space-4)',
};

export const closeButton: CSSProperties = {
  ...buttonGhost,
  color: 'var(--wf-text-muted)',
  fontSize: 18,
};

// ── Misc ─────────────────────────────────────────────────────

export const scrollArea: CSSProperties = {
  overflowY: 'auto',
  flex: 1,
};

export const badgePill: CSSProperties = {
  fontSize: 'var(--wf-font-xs)',
  background: 'var(--wf-bg-hover)',
  color: 'var(--wf-text-muted)',
  borderRadius: 'var(--wf-radius-pill)',
  padding: '1px 7px',
};

export const cardItem: CSSProperties = {
  padding: 'var(--wf-space-2)',
  background: 'var(--wf-bg-panel)',
  borderRadius: 'var(--wf-radius-md)',
  marginBottom: 'var(--wf-space-1)',
  border: '1px solid var(--wf-border-default)',
};

export const hintText: CSSProperties = {
  fontSize: 'var(--wf-font-xs)',
  color: 'var(--wf-text-hint)',
  marginTop: 2,
  fontStyle: 'italic',
};
