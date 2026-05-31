import { drawObjectSnapGuide as drawObjectSnapGuideOverlay, drawOverview as drawOverviewOverlay, redrawOverviewBase as redrawOverviewBaseLayer } from '../overview/world-designer-overview.js';

import type { DesignerCategory, DesignerState, ObjectSnapGuide } from '../core/world-designer-types.js';

type WorldDesignerRenderLifecycleDeps = {
    overviewBaseCanvas: HTMLCanvasElement;
    refs: {
        overviewCanvas: HTMLCanvasElement;
        showSpriteOutlineCheckbox: HTMLInputElement;
        root: HTMLElement;
        modal: HTMLElement;
        paletteFlyout: HTMLElement;
    };
    state: DesignerState;
    host: {
        canvas: HTMLCanvasElement;
        getShowSpriteOutlines: () => boolean;
        drawSpritePreview: (
            ctx: CanvasRenderingContext2D,
            type: string,
            palette: number,
            rotation: number,
            usePalette: boolean,
            targetSize: number
        ) => void;
        drawSpriteOutlineOverlay: (
            ctx: CanvasRenderingContext2D,
            camera: { x: number; y: number },
            layerVisibility: Record<DesignerCategory, boolean>
        ) => void;
    };
    mapWidth: number;
    mapHeight: number;
    tileSize: number;
    getChunkedWorldOverview: () => any;
    getCategoryArray: (category: DesignerCategory) => any[];
    getEntityRect: (entity: any, category: DesignerCategory) => { left: number; top: number; width: number; height: number };
    getAstronautStartPosition: () => { x: number; y: number };
    ensureOverviewWorldTilesLoaded: () => void;
    getOverviewWorldTiles: () => Array<{ x: number; y: number }> | null;
    getSelectionVisuals: (selections: any[]) => Array<{
        isPrimary: boolean;
        rect: { left: number; top: number; width: number; height: number };
    }>;
    getSelectedItems: () => any[];
    drawCustomSpriteDefinitionAt: (
        ctx: CanvasRenderingContext2D,
        definition: any,
        x: number,
        y: number
    ) => void;
    getCustomSpriteDefinitionForInstance: (instance: any) => any;
    normalizeRect: (
        from: { x: number; y: number },
        to: { x: number; y: number }
    ) => { left: number; top: number; width: number; height: number };
    getAutoPanDelta: (point: { x: number; y: number }) => { x: number; y: number };
    updateDraggedItems: (point: { x: number; y: number }, autoPan?: boolean) => void;
    screenToWorld: (x: number, y: number) => { x: number; y: number };
    resolvePlacementPosition: (
        x: number,
        y: number,
        category: DesignerCategory
    ) => {
        x: number;
        y: number;
        guides: ObjectSnapGuide[];
    };
    dragGhostCanvas: HTMLCanvasElement;
    dragGhostPadding: number;
    dragGhostTargetSize: number;
    renderCustomSpritePreviewCanvas: (canvas: HTMLCanvasElement, definition: any) => void;
    getCustomSpriteDefinitionById: (id: string | null | undefined) => any;
    isButtonCompositeType: (type: string) => boolean;
    renderButtonCompositePreviewCanvas: (canvas: HTMLCanvasElement, button: any) => void;
    createButtonEntity: (config: {
        x: number;
        y: number;
        rotation: number;
        collision: boolean;
        active: boolean;
        linkedDoors: number[];
    }) => any;
    getPlacementPreviewType: (type: string) => string;
    isTeleporterCompositeType: (type: string) => boolean;
    getTeleporterBaseRotationForPadRotation: (rotation: number) => number;
    drawMagnifier: (ctx: CanvasRenderingContext2D) => void;
    setViewportExpanded: (expanded: boolean) => void;
    resetSpriteResolversAndCache: () => void;
    closeContextMenu: () => void;
    eventHandlers: {
        handleOverviewMouseDown: (event: MouseEvent) => void;
        handleOverviewMouseMove: (event: MouseEvent) => void;
        handleOverviewMouseUp: (event: MouseEvent) => void;
        handleCanvasMouseDown: (event: MouseEvent) => void;
        handleCanvasMouseMove: (event: MouseEvent) => void;
        handleCanvasMouseLeave: (event: MouseEvent) => void;
        handleCanvasMouseUp: (event: MouseEvent) => void;
        handleKeyDown: (event: KeyboardEvent) => void;
        handleKeyUp: (event: KeyboardEvent) => void;
        handleWindowMouseDown: (event: MouseEvent) => void;
        resizeExpandedViewport: () => void;
        applyDesignerOverlayZoomCompensation: () => void;
        handleWindowBeforeUnload: (event: BeforeUnloadEvent) => void;
    };
    styles: HTMLElement;
};

export function createWorldDesignerRenderLifecycle(deps: WorldDesignerRenderLifecycleDeps) {
    const {
        overviewBaseCanvas,
        refs,
        state,
        host,
        mapWidth,
        mapHeight,
        tileSize,
        getChunkedWorldOverview,
        getCategoryArray,
        getEntityRect,
        getAstronautStartPosition,
        ensureOverviewWorldTilesLoaded,
        getOverviewWorldTiles,
        getSelectionVisuals,
        getSelectedItems,
        drawCustomSpriteDefinitionAt,
        getCustomSpriteDefinitionForInstance,
        normalizeRect,
        getAutoPanDelta,
        updateDraggedItems,
        screenToWorld,
        resolvePlacementPosition,
        dragGhostCanvas,
        dragGhostPadding,
        dragGhostTargetSize,
        renderCustomSpritePreviewCanvas,
        getCustomSpriteDefinitionById,
        isButtonCompositeType,
        renderButtonCompositePreviewCanvas,
        createButtonEntity,
        getPlacementPreviewType,
        isTeleporterCompositeType,
        getTeleporterBaseRotationForPadRotation,
        drawMagnifier,
        setViewportExpanded,
        resetSpriteResolversAndCache,
        closeContextMenu,
        eventHandlers,
        styles
    } = deps;

    let overviewBaseDirty = true;
    let lastOverviewWorldCount = -1;
    let lastOverviewMapWidth = -1;
    let lastOverviewMapHeight = -1;

    function invalidateOverviewBase() {
        overviewBaseDirty = true;
    }

    function redrawOverviewBase() {
        redrawOverviewBaseLayer({
            overviewBaseCanvas,
            overviewCanvas: refs.overviewCanvas,
            mapWidth,
            mapHeight,
            layerVisibility: state.layerVisibility,
            getCategoryArray,
            getChunkedWorldOverview,
            overviewWorldTiles: getOverviewWorldTiles(),
            tileSize,
            getEntityRect,
            getAstronautStartPosition
        });
        overviewBaseDirty = false;
    }

    function drawOverview() {
        ensureOverviewWorldTilesLoaded();
        const worldCount = getCategoryArray('world').length;
        if (
            worldCount !== lastOverviewWorldCount ||
            mapWidth !== lastOverviewMapWidth ||
            mapHeight !== lastOverviewMapHeight
        ) {
            overviewBaseDirty = true;
            lastOverviewWorldCount = worldCount;
            lastOverviewMapWidth = mapWidth;
            lastOverviewMapHeight = mapHeight;
        }

        if (
            overviewBaseDirty ||
            overviewBaseCanvas.width !== refs.overviewCanvas.width ||
            overviewBaseCanvas.height !== refs.overviewCanvas.height
        ) {
            redrawOverviewBase();
        }
        drawOverviewOverlay({
            overviewCanvas: refs.overviewCanvas,
            overviewBaseCanvas,
            state,
            hostCanvas: host.canvas,
            mapWidth,
            mapHeight,
            getSelectionVisuals,
            getSelectedItems
        });
    }

    function drawObjectSnapGuide(ctx: CanvasRenderingContext2D, guide: ObjectSnapGuide) {
        drawObjectSnapGuideOverlay(ctx, guide, state.camera);
    }

    function render(ctx: CanvasRenderingContext2D) {
        drawOverview();
        if (!state.active) return;

        if (state.dragging && state.lastPointerCanvas) {
            const autoPan = getAutoPanDelta(state.lastPointerCanvas);
            if (autoPan.x !== 0 || autoPan.y !== 0) {
                updateDraggedItems(state.lastPointerCanvas, false);
            }
        }

        const spriteOutlinesVisible = host.getShowSpriteOutlines();
        if (refs.showSpriteOutlineCheckbox.checked !== spriteOutlinesVisible) {
            refs.showSpriteOutlineCheckbox.checked = spriteOutlinesVisible;
        }

        if (state.layerVisibility.custom) {
            for (const instance of state.customSpriteInstances) {
                const definition = getCustomSpriteDefinitionForInstance(instance);
                if (!definition) {
                    continue;
                }
                drawCustomSpriteDefinitionAt(
                    ctx,
                    definition,
                    instance.x - state.camera.x,
                    instance.y - state.camera.y
                );
            }
        }

        const selections = getSelectedItems();
        if (state.mode !== 'preview' && selections.length > 0) {
            for (const visual of getSelectionVisuals(selections)) {
                ctx.save();
                ctx.strokeStyle = visual.isPrimary ? '#f8fafc' : '#60a5fa';
                ctx.lineWidth = visual.isPrimary ? 2 : 1.5;
                ctx.setLineDash(visual.isPrimary ? [] : [6, 4]);
                ctx.strokeRect(
                    visual.rect.left - state.camera.x,
                    visual.rect.top - state.camera.y,
                    visual.rect.width,
                    visual.rect.height
                );
                ctx.restore();
            }
        }

        if (state.marqueeSelecting && state.marqueeStartWorld && state.marqueeCurrentWorld) {
            const marqueeRect = normalizeRect(state.marqueeStartWorld, state.marqueeCurrentWorld);
            ctx.save();
            ctx.strokeStyle = '#f8fafc';
            ctx.fillStyle = 'rgba(96, 165, 250, 0.14)';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([6, 4]);
            ctx.fillRect(
                marqueeRect.left - state.camera.x,
                marqueeRect.top - state.camera.y,
                marqueeRect.width,
                marqueeRect.height
            );
            ctx.strokeRect(
                marqueeRect.left - state.camera.x,
                marqueeRect.top - state.camera.y,
                marqueeRect.width,
                marqueeRect.height
            );
            ctx.restore();
        }

        if (state.showCollisionOverlay && state.mode !== 'preview') {
            ctx.save();
            ctx.strokeStyle = '#38bdf8';
            ctx.lineWidth = 1.5;
            ctx.setLineDash([]);
            for (const [category, visible] of Object.entries(state.layerVisibility) as Array<[DesignerCategory, boolean]>) {
                if (!visible) continue;
                for (const entity of getCategoryArray(category)) {
                    if (category === 'collectables' && 'creatureProjectile' in entity && entity.creatureProjectile) {
                        continue;
                    }
                    if ('collision' in entity && entity.collision === false) continue;
                    const rect = getEntityRect(entity, category);
                    ctx.strokeRect(
                        rect.left - state.camera.x,
                        rect.top - state.camera.y,
                        rect.width,
                        rect.height
                    );
                }
            }
            ctx.restore();
        }

        for (const guide of state.objectSnapGuides) {
            drawObjectSnapGuide(ctx, guide);
        }

        if (state.pickerDrag && state.pickerDragCanvas) {
            const world = screenToWorld(state.pickerDragCanvas.x, state.pickerDragCanvas.y);
            const placement = resolvePlacementPosition(world.x, world.y, state.pickerDrag.category);
            const ghostCtx = dragGhostCanvas.getContext('2d');
            if (ghostCtx) {
                if (state.pickerDrag.category === 'custom') {
                    renderCustomSpritePreviewCanvas(
                        dragGhostCanvas,
                        getCustomSpriteDefinitionById(state.pickerDrag.type)
                    );
                } else if (
                    state.pickerDrag.category === 'buttons' &&
                    isButtonCompositeType(state.pickerDrag.type)
                ) {
                    renderButtonCompositePreviewCanvas(
                        dragGhostCanvas,
                        createButtonEntity({
                            x: 0,
                            y: 0,
                            rotation: state.pickerDrag.rotation,
                            collision: true,
                            active: false,
                            linkedDoors: []
                        })
                    );
                } else {
                    const previewType = getPlacementPreviewType(state.pickerDrag.type);
                    const previewRotation = isTeleporterCompositeType(state.pickerDrag.type)
                        ? getTeleporterBaseRotationForPadRotation(state.pickerDrag.rotation)
                        : state.pickerDrag.rotation;
                    host.drawSpritePreview(
                        ghostCtx,
                        previewType,
                        state.pickerDrag.palette,
                        previewRotation,
                        true,
                        dragGhostTargetSize
                    );
                }
            }
            ctx.save();
            ctx.globalAlpha = 0.75;
            ctx.drawImage(
                dragGhostCanvas,
                placement.x - state.camera.x - dragGhostPadding,
                placement.y - state.camera.y - dragGhostPadding
            );
            ctx.restore();
            for (const guide of placement.guides) {
                drawObjectSnapGuide(ctx, guide);
            }
        }

        if (spriteOutlinesVisible) {
            host.drawSpriteOutlineOverlay(ctx, state.camera, state.layerVisibility);
        }

        const astronautStart = getAstronautStartPosition();
        const startScreenX = astronautStart.x - state.camera.x;
        const startScreenY = astronautStart.y - state.camera.y;
        ctx.save();
        ctx.strokeStyle = '#f97316';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(startScreenX - 12, startScreenY);
        ctx.lineTo(startScreenX + 12, startScreenY);
        ctx.moveTo(startScreenX, startScreenY - 12);
        ctx.lineTo(startScreenX, startScreenY + 12);
        ctx.stroke();
        ctx.fillStyle = '#fed7aa';
        ctx.font = '12px system-ui, sans-serif';
        ctx.fillText('START', startScreenX + 14, startScreenY - 14);
        ctx.restore();

        drawMagnifier(ctx);
    }

    function destroy() {
        setViewportExpanded(false);
        resetSpriteResolversAndCache();
        closeContextMenu();
        refs.overviewCanvas.removeEventListener('mousedown', eventHandlers.handleOverviewMouseDown);
        refs.overviewCanvas.removeEventListener('mousemove', eventHandlers.handleOverviewMouseMove);
        refs.overviewCanvas.removeEventListener('mouseup', eventHandlers.handleOverviewMouseUp);
        host.canvas.removeEventListener('mousedown', eventHandlers.handleCanvasMouseDown);
        host.canvas.removeEventListener('mousemove', eventHandlers.handleCanvasMouseMove);
        host.canvas.removeEventListener('mouseleave', eventHandlers.handleCanvasMouseLeave);
        window.removeEventListener('mousemove', eventHandlers.handleCanvasMouseMove);
        window.removeEventListener('mouseup', eventHandlers.handleCanvasMouseUp);
        window.removeEventListener('keydown', eventHandlers.handleKeyDown);
        window.removeEventListener('keyup', eventHandlers.handleKeyUp);
        window.removeEventListener('mousedown', eventHandlers.handleWindowMouseDown);
        window.removeEventListener('resize', eventHandlers.resizeExpandedViewport);
        window.removeEventListener('resize', eventHandlers.applyDesignerOverlayZoomCompensation);
        window.visualViewport?.removeEventListener('resize', eventHandlers.applyDesignerOverlayZoomCompensation);
        window.visualViewport?.removeEventListener('scroll', eventHandlers.applyDesignerOverlayZoomCompensation);
        window.removeEventListener('beforeunload', eventHandlers.handleWindowBeforeUnload);
        refs.root.remove();
        refs.modal.remove();
        refs.paletteFlyout.remove();
        styles.remove();
    }

    return {
        invalidateOverviewBase,
        drawOverview,
        render,
        destroy
    };
}
