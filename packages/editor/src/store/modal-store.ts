// modal-store.ts — centralized modal state

import { create } from 'zustand';

/**
 * Union of all known modal identifiers. Add new entries here when introducing
 * new modals — the type system will surface any switch/if branches that need
 * updating. `null` means no modal is active.
 */
export type ModalId = 'export' | 'import' | 'template-manager' | 'save-template' | 'save-kit' | null;

interface ModalState {
  activeModal: ModalId;
  openModal: (id: NonNullable<ModalId>) => void;
  closeModal: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  activeModal: null,
  openModal: (id) => set({ activeModal: id }),
  closeModal: () => set({ activeModal: null }),
}));
