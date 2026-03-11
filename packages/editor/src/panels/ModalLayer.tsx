// ModalLayer.tsx — renders the active modal based on modal-store

import { useModalStore } from '../store/modal-store.js';
import { useEditorStore } from '../store/editor-store.js';
import { ExportModal } from '../panels/ExportModal.js';
import { ImportModal } from '../panels/ImportModal.js';
import { TemplateManager } from '../panels/TemplateManager.js';
import { SaveTemplateModal } from '../panels/SaveTemplateModal.js';
import { SaveKitModal } from '../panels/SaveKitModal.js';
import { SearchOverlay } from '../panels/SearchOverlay.js';

export function ModalLayer() {
  const { activeModal, closeModal } = useModalStore();
  const showSearch = useEditorStore((s) => s.showSearch);

  return (
    <>
      {activeModal === 'export' && <ExportModal onClose={closeModal} />}
      {activeModal === 'template-manager' && <TemplateManager onClose={closeModal} />}
      {activeModal === 'import' && <ImportModal onClose={closeModal} />}
      {activeModal === 'save-template' && <SaveTemplateModal onClose={closeModal} />}
      {activeModal === 'save-kit' && <SaveKitModal onClose={closeModal} />}
      {showSearch && <SearchOverlay />}
    </>
  );
}
