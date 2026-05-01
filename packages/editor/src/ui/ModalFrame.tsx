// ModalFrame.tsx — shared modal shell consuming design-system tokens
//
// Provides: backdrop, card, title row with close button.
// ED-A-025: role="dialog", aria-modal, focus trap, Escape-to-close.
// Usage:
//   <ModalFrame title="Export" width={600} onClose={onClose}>
//     {/* modal body */}
//   </ModalFrame>

import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useRef, useCallback } from 'react';
import { overlayBackdrop, modalCard, modalTitleRow, modalTitle, closeButton } from '../ui/styles.js';

interface Props {
  title: string;
  width?: number;
  onClose: () => void;
  children: ReactNode;
  /** Extra styles applied to the card container */
  cardStyle?: CSSProperties;
}

/** Focusable element selector for focus trap. */
const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function ModalFrame({ title, width = 520, onClose, children, cardStyle }: Props) {
  const cardRef = useRef<HTMLDivElement>(null);

  // Focus trap: cycle Tab within the modal card
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); onClose(); return; }
    if (e.key !== 'Tab') return;
    const card = cardRef.current;
    if (!card) return;
    const focusable = Array.from(card.querySelectorAll<HTMLElement>(FOCUSABLE));
    if (focusable.length === 0) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  }, [onClose]);

  // Auto-focus the card on mount, restore focus on unmount
  useEffect(() => {
    const prev = document.activeElement as HTMLElement | null;
    cardRef.current?.focus();
    return () => { prev?.focus(); };
  }, []);

  return (
    <div style={overlayBackdrop} onClick={onClose}>
      <div
        ref={cardRef}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
        style={{ ...modalCard(width), ...cardStyle, outline: 'none' }}
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div style={modalTitleRow}>
          <h2 style={modalTitle}>{title}</h2>
          {/* ED-B-004: icon-only close button needs an accessible label. */}
          <button
            onClick={onClose}
            style={closeButton}
            aria-label={`Close ${title} dialog`}
            tabIndex={0}
          >
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}
