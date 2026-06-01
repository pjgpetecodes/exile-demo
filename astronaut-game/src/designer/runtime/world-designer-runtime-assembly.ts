import { createRenderLifecycleFromContext } from '../factory/world-designer-render-lifecycle-factory.js';
import { bindWorldDesignerMainEventHandlersFromContext } from '../factory/world-designer-event-handler-wiring-factory.js';
import type { WorldDesigner } from '../core/world-designer-types.js';

export function createWorldDesignerApiAssembly(context: any): WorldDesigner {
    return {
        isActive() {
            return context.state.active;
        },
        isPreviewMode() {
            return context.state.active && context.state.mode === 'preview';
        },
        isViewportExpanded() {
            return context.state.viewportExpanded;
        },
        setViewportExpanded(expanded: boolean) {
            context.setViewportExpanded(expanded);
        },
        getCamera() {
            return context.state.camera;
        },
        getLayerVisibility() {
            return context.state.layerVisibility;
        },
        getDebugSelection() {
            return context.state.selection;
        },
        shouldShowCollisionOverlay() {
            return context.state.active && context.state.showCollisionOverlay;
        },
        shouldDisableCollisionInPreview() {
            return context.state.active && context.state.mode === 'preview' && context.state.disableCollisionInPreview;
        },
        render(ctx: CanvasRenderingContext2D) {
            context.render(ctx);
        },
        destroy() {
            context.destroy();
        }
    };
}

export function initializeWorldDesignerRuntimeAssembly(context: any) {
    const renderLifecycle = createRenderLifecycleFromContext({
        overviewBaseCanvas: context.overviewBaseCanvas,
        refs: context.refs,
        state: context.state,
        host: context.host,
        getMapBounds: context.getMapBounds,
        tileSize: context.tileSize,
        getChunkedWorldOverview: context.getChunkedWorldOverview,
        getCategoryArray: context.getCategoryArray,
        getEntityRect: context.getEntityRect,
        getAstronautStartPosition: context.getAstronautStartPosition,
        ensureOverviewWorldTilesLoaded: context.ensureOverviewWorldTilesLoaded,
        getOverviewWorldTiles: context.getOverviewWorldTiles,
        getSelectionVisuals: context.getSelectionVisuals,
        getSelectedItems: context.selectionApi.getSelectedItems,
        drawCustomSpriteDefinitionAt: context.drawCustomSpriteDefinitionAt,
        getCustomSpriteDefinitionForInstance: context.getCustomSpriteDefinitionForInstance,
        normalizeRect: context.normalizeRect,
        getAutoPanDelta: context.selectionApi.getAutoPanDelta,
        updateDraggedItems: context.selectionApi.updateDraggedItems,
        screenToWorld: context.screenToWorld,
        resolvePlacementPosition: context.selectionApi.resolvePlacementPosition,
        dragGhostCanvas: context.dragGhostCanvas,
        dragGhostPadding: context.dragGhostPadding,
        dragGhostTargetSize: context.dragGhostTargetSize,
        renderCustomSpritePreviewCanvas: context.renderCustomSpritePreviewCanvas,
        getCustomSpriteDefinitionById: context.getCustomSpriteDefinitionById,
        isButtonCompositeType: context.isButtonCompositeType,
        renderButtonCompositePreviewCanvas: context.renderButtonCompositePreviewCanvas,
        createButtonEntity: context.createButtonEntity,
        getPlacementPreviewType: context.getPlacementPreviewType,
        isTeleporterCompositeType: context.isTeleporterCompositeType,
        getTeleporterBaseRotationForPadRotation: context.getTeleporterBaseRotationForPadRotation,
        drawMagnifier: context.drawMagnifier,
        setViewportExpanded: context.setViewportExpanded,
        resetSpriteResolversAndCache: context.resetSpriteResolversAndCache,
        closeContextMenu: context.selectionApi.closeContextMenu,
        eventHandlers: {
            handleOverviewMouseDown: context.interactionHandlers.handleOverviewMouseDown,
            handleOverviewMouseMove: context.interactionHandlers.handleOverviewMouseMove,
            handleOverviewMouseUp: context.interactionHandlers.handleOverviewMouseUp,
            handleCanvasMouseDown: context.interactionHandlers.handleCanvasMouseDown,
            handleCanvasMouseMove: context.interactionHandlers.handleCanvasMouseMove,
            handleCanvasMouseLeave: context.interactionHandlers.handleCanvasMouseLeave,
            handleCanvasMouseUp: context.interactionHandlers.handleCanvasMouseUp,
            handleKeyDown: context.interactionHandlers.handleKeyDown,
            handleKeyUp: context.interactionHandlers.handleKeyUp,
            handleWindowMouseDown: context.interactionHandlers.handleWindowMouseDown,
            resizeExpandedViewport: context.resizeExpandedViewport,
            applyDesignerOverlayZoomCompensation: context.applyDesignerOverlayZoomCompensation,
            handleWindowBeforeUnload: context.interactionHandlers.handleWindowBeforeUnload
        },
        styles: context.styles
    });
    context.setRenderLifecycle(renderLifecycle);

    if (context.pendingOverviewBaseInvalidationRef.get()) {
        renderLifecycle.invalidateOverviewBase();
        context.pendingOverviewBaseInvalidationRef.set(false);
    }

    bindWorldDesignerMainEventHandlersFromContext({
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
        setDesignerActive: context.setDesignerActive,
        createNewPalette: context.createNewPalette,
        cloneSelectedPalette: context.cloneSelectedPalette,
        deleteSelectedPalette: context.deleteSelectedPalette,
        savePaletteDesigner: context.savePaletteDesigner,
        restoreEditModeSnapshot: context.restoreEditModeSnapshot,
        refreshPaletteDesigner: context.refreshPaletteDesigner,
        openSavePreview: context.openSavePreview,
        openPngImportModal: context.openPngImportModal,
        openSpriteSheetNormalizationPreview: context.openSpriteSheetNormalizationPreview,
        closeModal: context.closeModal,
        getModalConfirmAction: context.modalCoordinator.getModalConfirmAction,
        getSelectedItems: context.selectionApi.getSelectedItems,
        deleteSelection: context.selectionApi.deleteSelection,
        duplicateSelection: context.selectionApi.duplicateSelection,
        reorderSelections: context.selectionApi.reorderSelections,
        focusSelection: context.selectionApi.focusSelection,
        convertSelection: context.convertSelection,
        placeAtWorld: context.selectionApi.placeAtWorld,
        closeContextMenu: context.selectionApi.closeContextMenu,
        openContextMenu: context.selectionApi.openContextMenu,
        openEmptyContextMenu: context.selectionApi.openEmptyContextMenu,
        focusOnCurrentWorldPosition: context.focusOnCurrentWorldPosition,
        moveLiveAstronautToViewCenter: context.moveLiveAstronautToViewCenter,
        setAstronautStartToViewCenter: context.setAstronautStartToViewCenter,
        handleOverviewMouseDown: context.interactionHandlers.handleOverviewMouseDown,
        handleOverviewMouseMove: context.interactionHandlers.handleOverviewMouseMove,
        handleOverviewMouseUp: context.interactionHandlers.handleOverviewMouseUp,
        getCanvasPoint: context.getCanvasPoint,
        screenToWorld: context.screenToWorld,
        getEntityAt: context.getEntityAt,
        handleCanvasMouseDown: context.interactionHandlers.handleCanvasMouseDown,
        handleCanvasMouseMove: context.interactionHandlers.handleCanvasMouseMove,
        handleCanvasMouseLeave: context.interactionHandlers.handleCanvasMouseLeave,
        handleCanvasMouseUp: context.interactionHandlers.handleCanvasMouseUp,
        handleKeyDown: context.interactionHandlers.handleKeyDown,
        handleKeyUp: context.interactionHandlers.handleKeyUp,
        handleWindowMouseDown: context.interactionHandlers.handleWindowMouseDown,
        handleWindowBeforeUnload: context.interactionHandlers.handleWindowBeforeUnload,
        resizeExpandedViewport: context.resizeExpandedViewport,
        applyDesignerOverlayZoomCompensation: context.applyDesignerOverlayZoomCompensation
    });
    context.refreshSelectOptions();
    if (context.restoredViewportExpanded) {
        context.setViewportExpanded(true);
    }
    context.refreshPanel();

    const drawOverview = () => {
        context.getRenderLifecycle()?.drawOverview();
    };

    const render = (ctx: CanvasRenderingContext2D) => {
        context.getRenderLifecycle()?.render(ctx);
    };

    const destroy = () => {
        context.getRenderLifecycle()?.destroy();
    };

    return {
        drawOverview,
        render,
        destroy,
        api: createWorldDesignerApiAssembly({
            state: context.state,
            setViewportExpanded: context.setViewportExpanded,
            render,
            destroy
        })
    };
}
