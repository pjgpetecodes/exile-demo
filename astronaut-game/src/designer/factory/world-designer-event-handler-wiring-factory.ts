import { bindWorldDesignerMainEventHandlers } from '../events/world-designer-events-coordinator.js';

export function bindWorldDesignerMainEventHandlersFromContext(context: any) {
    bindWorldDesignerMainEventHandlers({
        core: {
            refs: context.refs,
            state: context.state,
            host: context.host,
            paletteCount: context.paletteCount,
            colorAliasNames: context.colorAliasNames,
            CATEGORY_LABELS: context.CATEGORY_LABELS,
            clamp: context.clamp,
            normalizeRotation: context.normalizeRotation,
            normalizeSpriteTranslation: context.normalizeSpriteTranslation,
            categorySupportsTranslation: context.categorySupportsTranslation,
            isTeleporterCompositeType: context.isTeleporterCompositeType,
            isButtonCompositeType: context.isButtonCompositeType,
            getSingleEditableSelection: context.getSingleEditableSelection,
            getCustomSpriteDefinitionById: context.getCustomSpriteDefinitionById,
            runMutation: context.runMutation,
            updateSelectionFromInspectorState: context.updateSelectionFromInspectorState,
            setCurrentType: context.setCurrentType,
            renderSpritePickerGrid: context.renderSpritePickerGrid,
            persistDesignerUiState: context.persistDesignerUiState,
            applyEntityRotationWithTeleporterSync: context.applyEntityRotationWithTeleporterSync,
            renderCurrentSpritePreview: context.renderCurrentSpritePreview,
            refreshModifierSnapInteraction: context.refreshModifierSnapInteraction,
            setSnapOffsets: context.setSnapOffsets,
            setSnapOffsetsFromPosition: context.setSnapOffsetsFromPosition,
            refreshPanel: context.refreshPanel,
            setStatus: context.setStatus,
            setViewportExpanded: context.setViewportExpanded,
            invalidateOverviewBase: context.invalidateOverviewBase,
            setDesignerActive: context.setDesignerActive
        },
        palette: {
            createNewPalette: context.createNewPalette,
            cloneSelectedPalette: context.cloneSelectedPalette,
            deleteSelectedPalette: context.deleteSelectedPalette,
            savePaletteDesigner: context.savePaletteDesigner,
            restoreEditModeSnapshot: context.restoreEditModeSnapshot,
            refreshPaletteDesigner: context.refreshPaletteDesigner
        },
        modal: {
            openSavePreview: context.openSavePreview,
            openPngImportModal: context.openPngImportModal,
            openSpriteSheetNormalizationPreview: context.openSpriteSheetNormalizationPreview,
            closeModal: context.closeModal,
            getModalConfirmAction: context.getModalConfirmAction
        },
        selection: {
            getSelectedItems: context.getSelectedItems,
            deleteSelection: context.deleteSelection,
            duplicateSelection: context.duplicateSelection,
            reorderSelections: context.reorderSelections,
            focusSelection: context.focusSelection,
            convertSelection: context.convertSelection,
            placeAtWorld: context.placeAtWorld,
            closeContextMenu: context.closeContextMenu,
            openContextMenu: context.openContextMenu,
            openEmptyContextMenu: context.openEmptyContextMenu
        },
        navigation: {
            focusOnCurrentWorldPosition: context.focusOnCurrentWorldPosition,
            moveLiveAstronautToViewCenter: context.moveLiveAstronautToViewCenter,
            setAstronautStartToViewCenter: context.setAstronautStartToViewCenter
        },
        canvas: {
            handleOverviewMouseDown: context.handleOverviewMouseDown,
            handleOverviewMouseMove: context.handleOverviewMouseMove,
            handleOverviewMouseUp: context.handleOverviewMouseUp,
            getCanvasPoint: context.getCanvasPoint,
            screenToWorld: context.screenToWorld,
            getEntityAt: context.getEntityAt,
            handleCanvasMouseDown: context.handleCanvasMouseDown,
            handleCanvasMouseMove: context.handleCanvasMouseMove,
            handleCanvasMouseLeave: context.handleCanvasMouseLeave,
            handleCanvasMouseUp: context.handleCanvasMouseUp,
            handleKeyDown: context.handleKeyDown,
            handleKeyUp: context.handleKeyUp,
            handleWindowMouseDown: context.handleWindowMouseDown,
            handleWindowBeforeUnload: context.handleWindowBeforeUnload,
            resizeExpandedViewport: context.resizeExpandedViewport,
            applyDesignerOverlayZoomCompensation: context.applyDesignerOverlayZoomCompensation
        }
    });
}
