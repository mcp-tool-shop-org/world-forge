// ModalFrame.tsx — shared modal shell consuming design-system tokens
//
// Provides: backdrop, card, title row with close button.
// Usage:
//   <ModalFrame title="Export" width={600} onClose={onClose}>
//     {/* modal body */}
//   </ModalFrame>

import type { CSSProperties, ReactNode } from 'react';
import { overlayBackdrop, modalCard, modalTitleRow, modalTitle, closeButton } from '../ui/styles.js';

interface Props {
  title: string;
  width?: number;
  onClose: () => void;
  children: ReactNode;
  /** Extra styles applied to the card container */
  cardStyle?: CSSProperties;
}

export function ModalFrame({ title, width = 520, onClose, children, cardStyle }: Props) {
  return (
    <div style={overlayBackdrop}>
      <div style={{ ...modalCard(width), ...cardStyle }}>
        <div style={modalTitleRow}>
          <h2 style={modalTitle}>{title}</h2>
          <button onClick={onClose} style={closeButton}>&times;</button>
        </div>
        {children}
      </div>
    </div>
  );
}
