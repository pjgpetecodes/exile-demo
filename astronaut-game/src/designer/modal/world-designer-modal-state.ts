type WorldDesignerModalStateDeps = {
    refs: {
        modal: HTMLElement;
        modalConfirm: HTMLElement;
    };
    state: {
        savePreviewOpen: boolean;
    };
    clearPngImportObjectUrl: () => void;
};

export function createWorldDesignerModalState(deps: WorldDesignerModalStateDeps) {
    const { refs, state, clearPngImportObjectUrl } = deps;
    let modalConfirmAction: (() => void | Promise<void>) | null = null;

    function setModalConfirmAction(action: (() => void | Promise<void>) | null) {
        modalConfirmAction = action;
    }

    function getModalConfirmAction() {
        return modalConfirmAction;
    }

    function closeModal(force: boolean = false) {
        if (!force && refs.modal.dataset.busy === 'true') {
            return;
        }
        const modalCard = refs.modal.querySelector('.world-designer-modal-card') as HTMLDivElement | null;
        state.savePreviewOpen = false;
        modalConfirmAction = null;
        refs.modal.classList.remove('open');
        modalCard?.classList.remove('world-designer-modal-card-import');
        clearPngImportObjectUrl();
        refs.modal.dataset.busy = 'false';
        refs.modalConfirm.style.display = '';
    }

    return {
        setModalConfirmAction,
        getModalConfirmAction,
        closeModal
    };
}
