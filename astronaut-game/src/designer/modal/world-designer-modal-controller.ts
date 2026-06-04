import { createWorldDesignerModalState } from './world-designer-modal-state.js';

type WorldDesignerModalControllerDeps = Parameters<typeof createWorldDesignerModalState>[0];

export function createWorldDesignerModalController(deps: WorldDesignerModalControllerDeps) {
    let modalStateApi: ReturnType<typeof createWorldDesignerModalState> | null = null;

    function ensureModalStateApi() {
        if (!modalStateApi) {
            modalStateApi = createWorldDesignerModalState(deps);
        }
        return modalStateApi;
    }

    function closeModal(force: boolean = false) {
        ensureModalStateApi().closeModal(force);
    }

    function setModalConfirmAction(action: (() => void | Promise<void>) | null) {
        ensureModalStateApi().setModalConfirmAction(action);
    }

    function getModalConfirmAction() {
        return ensureModalStateApi().getModalConfirmAction();
    }

    return {
        closeModal,
        setModalConfirmAction,
        getModalConfirmAction
    };
}
