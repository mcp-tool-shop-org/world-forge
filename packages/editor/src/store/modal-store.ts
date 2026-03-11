// modal-store.ts — centralized modal state

import { create } from 'zustand';

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
