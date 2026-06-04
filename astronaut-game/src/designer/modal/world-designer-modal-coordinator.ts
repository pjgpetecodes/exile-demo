import { openWorldDesignerPngImportModal } from '../import/world-designer-png-import-modal.js';
import { createWorldDesignerModalController } from './world-designer-modal-controller.js';
import { createWorldDesignerSaveWorkflow } from '../save/world-designer-save-workflow.js';
import type { RawWorldData, SpriteSheetNormalizationReport } from '../core/world-designer-types.js';

type ModalConfirmAction = (() => void | Promise<void>) | null;

export function createWorldDesignerModalCoordinator(deps: {
    modalControllerDeps: Parameters<typeof createWorldDesignerModalController>[0];
    saveWorkflowDeps: Omit<Parameters<typeof createWorldDesignerSaveWorkflow>[0], 'closeModal' | 'setModalConfirmAction'>;
    pngImportModalDeps: Omit<Parameters<typeof openWorldDesignerPngImportModal>[0], 'closeModal' | 'setModalConfirmAction'>;
}) {
    const {
        modalControllerDeps,
        saveWorkflowDeps,
        pngImportModalDeps
    } = deps;

    const modalController = createWorldDesignerModalController(modalControllerDeps);

    function closeModal(force = false) {
        modalController.closeModal(force);
    }

    function setModalConfirmAction(action: ModalConfirmAction) {
        modalController.setModalConfirmAction(action);
    }

    const saveWorkflow = createWorldDesignerSaveWorkflow({
        ...saveWorkflowDeps,
        closeModal,
        setModalConfirmAction
    });

    function buildSavePreview(snapshot: RawWorldData, options?: { strictTeleporterValidation?: boolean }) {
        return saveWorkflow.buildSavePreview(snapshot, options);
    }

    async function renderSavePreview() {
        await saveWorkflow.renderSavePreview();
    }

    function renderSpriteSheetNormalizationPreview(report: SpriteSheetNormalizationReport) {
        saveWorkflow.renderSpriteSheetNormalizationPreview(report);
    }

    async function saveFromPreview() {
        await saveWorkflow.saveFromPreview();
    }

    async function normalizeSpriteSheetColors() {
        await saveWorkflow.normalizeSpriteSheetColors();
    }

    async function openSpriteSheetNormalizationPreview() {
        await saveWorkflow.openSpriteSheetNormalizationPreview();
    }

    function openSavePreview() {
        saveWorkflow.openSavePreview();
    }

    async function openPngImportModal() {
        await openWorldDesignerPngImportModal({
            ...pngImportModalDeps,
            closeModal,
            setModalConfirmAction
        });
    }

    return {
        buildSavePreview,
        renderSavePreview,
        renderSpriteSheetNormalizationPreview,
        saveFromPreview,
        normalizeSpriteSheetColors,
        openSpriteSheetNormalizationPreview,
        openSavePreview,
        openPngImportModal,
        closeModal,
        getModalConfirmAction: () => modalController.getModalConfirmAction()
    };
}
