import { mushroomsSound, getSoundEnabled } from '../config/constants.js';
import {
    getDefaultDestructibleEnabled,
    getDefaultDestructibleHealth,
    getDefaultDestructionSource
} from '../entities/destructibles.js';
import { getChunkedWorldOverview, MapBlock, shouldMaskAstronaut } from '../world/map.js';
import { Button } from '../entities/button.js';
import { getDefaultGrenadeExplosionPower } from '../entities/collectable.js';
import {
    PaletteCycleSettings,
    Position,
    TeleporterDestinationMode,
} from '../types/index.js';
import { buildDefaultPaletteCycle } from '../world/palette-cycle.js';
import { normalizeSpriteTranslation, SpriteTranslation } from '../shared/utilities.js';
import {
    composePngChunkFolderSource,
    exportPngChunksToDirectory,
    getDirectoryPicker,
    getPngChunkSelectionEntries,
    readPngChunkFolderSelection
} from './io/world-designer-png-chunks.js';
import {
    designerSnapshotsEqual,
    serializeWorldData,
    snapshotsEqual,
    toMapBlockData
} from './core/world-designer-serialization.js';
import {
    createDesignerStyles,
    isFormTarget,
} from './core/world-designer-ui.js';
import {
    applyPosition,
    categorySupportsTranslation,
    clamp,
    clearPreviewCanvas,
    deepClone,
    formatSpriteTranslation,
    getDoorTypeFromSourceType,
    normalizeRect,
    normalizeRotation,
    normalizeSnapOffset,
    rectsIntersect,
    snapCoordinate,
    yieldToUi
} from './core/world-designer-helpers.js';
import { createDesignerEntityGeometryHelpers } from './geometry/world-designer-entity-geometry.js';
import { createWorldDesignerDom } from './dom/world-designer-dom.js';
import { createWorldDesignerPngImportDraftApi } from './import/world-designer-png-import-draft.js';
import { reconcileTeleporterPairsForSave } from './teleporters/world-designer-teleporters.js';
import { createWorldDesignerTeleporterRuntime } from './teleporters/world-designer-teleporter-runtime.js';
import { createWorldDesignerTeleporterDelegates } from './teleporters/world-designer-teleporter-delegates.js';
import { createWorldDesignerPaletteDesigner } from './palette/world-designer-palette-designer.js';
import { createWorldDesignerSpritePreviewCanvasHelpers } from './preview/world-designer-sprite-preview-canvas.js';
import { renderWorldDesignerSpritePickerGrid } from './picker/world-designer-sprite-picker.js';
import { createWorldDesignerBootstrap } from './bootstrap/world-designer-bootstrap.js';
import { createOverviewWorldTileLoader, initializeDesignerOverlayDrag } from './bootstrap/world-designer-main-setup.js';
import { createWorldDesignerClipboard } from './selection/world-designer-clipboard.js';
import { createWorldDesignerCustomSpriteActions } from './entities/world-designer-custom-sprite-actions.js';
import { createWorldDesignerMagnifier } from './render/world-designer-magnifier.js';
import {
    initializeEntityConversionApiFromMain,
    initializeInspectorCoordinatorFromMain,
    initializeInteractionHandlersFromMain,
    initializeInteractionCoordinatorFromMain,
    initializeLifecycleControllerFromMain,
    initializeModalCoordinatorFromMain,
    initializePanelRefreshControllerFromMain,
    initializePreviewRenderingControllerFromMain,
    initializeRuntimeAssemblyFromMain
} from './bootstrap/world-designer-main-initializer-wiring.js';
import { createWorldDesignerSelectionGeometry } from './selection/world-designer-selection-geometry.js';
import {
    createInteractionCoordinatorMainContext,
    createModalAndInspectorCoordinatorMainContexts,
    createRuntimeAssemblyMainContext
} from './factory/world-designer-main-initializer-context-factory.js';
import {
    BUTTON_COMPOSITE_TYPE,
    BUTTON_DEFAULT_BOX_OFFSET_X,
    BUTTON_DEFAULT_BOX_OFFSET_Y,
    BUTTON_DEFAULT_PRESS_OFFSET,
    CATEGORY_LABELS,
    DESIGNER_STATE_STORAGE_KEY,
    HISTORY_LIMIT,
    MAGNIFIER_CURSOR_OFFSET,
    MAGNIFIER_SIZE,
    MAGNIFIER_ZOOM,
    TELEPORTER_COMPOSITE_TYPE,
    TILE_SIZE,
    getPngImportSourceTileCount,
    getPngImportWorldSpanFromTileCount,
    getSuggestedPngImportWorldSpan
} from './config/world-designer-config.js';
import {
    configureVisibleSpriteRectResolver,
    getVisibleSpriteRect,
    resetVisibleSpriteRectResolverCache
} from './preview/world-designer-visible-sprite-resolver.js';

import type {
    ButtonSaveData,
    ClipboardEntry,
    CustomSpriteDefinition,
    CustomSpriteInstance,
    DesignerCategory,
    DesignerSnapshot,
    DesignerState,
    ObjectSnapMode,
    PlacementTypeOption,
    PaletteDefinition,
    PngImportDraft,
    RawWorldData,
    Selection,
    WorldDesigner,
    WorldDesignerHost
} from './core/world-designer-types.js';
let customSpriteDefinitionResolver: ((instance: CustomSpriteInstance) => CustomSpriteDefinition | null) | null = null;

export type {
    ButtonSaveData,
    CollectableSaveData,
    CustomSpriteDefinition,
    CustomSpriteInstance,
    DesignerCategory,
    DesignerMode,
    DesignerTool,
    DoorSaveData,
    LayerVisibility,
    PaletteDefinition,
    PaletteRemapEntry,
    RawWorldData,
    SpriteCatalogEntry,
    SpriteSheetNormalizationReplacement,
    SpriteSheetNormalizationReport,
    WorldDesigner,
    WorldDesignerHost
} from './core/world-designer-types.js';

const {
    getRectAtPosition,
    invertButtonOffset,
    getEntityRect
} = createDesignerEntityGeometryHelpers({
    tileSize: TILE_SIZE,
    deepClone,
    normalizeRotation,
    resolveCustomSpriteDefinition: (instance) => customSpriteDefinitionResolver?.(instance) ?? null,
    getVisibleSpriteRect
});

export function createWorldDesigner(host: WorldDesignerHost): WorldDesigner {
    const spriteTypes = [...host.getSpriteTypes()].sort();
    const spriteCatalog = host.getSpriteCatalog();
    const colorAliasNames = Object.keys(host.getColorAliases());
    let paletteCount = Math.max(host.getPaletteCount(), 1);
    const initialPaletteDefinitions = deepClone(host.getPaletteDefinitions());
    paletteCount = Math.max(paletteCount, initialPaletteDefinitions.length, 1);
    const styles = createDesignerStyles();
    const initialSnapshot = serializeWorldData(host.getRawWorldData());
    const {
        state,
        restoredViewportExpanded,
        persistDesignerUiState,
        wireSectionAccordions
    } = createWorldDesignerBootstrap({
        host,
        spriteTypes,
        paletteCount,
        initialPaletteDefinitions,
        initialSnapshot,
        categoryLabels: CATEGORY_LABELS,
        storageKey: DESIGNER_STATE_STORAGE_KEY
    });
    customSpriteDefinitionResolver = (instance) =>
        state.customSpriteDefinitions.find((definition) => definition.id === instance.customSpriteId) ?? null;
    configureVisibleSpriteRectResolver(host, TILE_SIZE);

    const {
        refs,
        panelDragHandle,
        paletteFlyoutDragHandle,
        magnifierCanvas,
        sectionAccordions
    } = createWorldDesignerDom({
        magnifierSize: MAGNIFIER_SIZE,
        magnifierZoom: MAGNIFIER_ZOOM
    });
    const spritePickerButtons = new Map<string, HTMLButtonElement>();
    const dragGhostPadding = 8;
    let pngImportObjectUrl: string | null = null;
    let pendingInspectorFocusKey: string | null = null;
    const overviewBaseCanvas = document.createElement('canvas');
    let renderLifecycle: any | null = null;
    let pendingOverviewBaseInvalidation = false;
    let clipboardApi: ReturnType<typeof createWorldDesignerClipboard> | null = null;
    let customSpriteActionsApi: ReturnType<typeof createWorldDesignerCustomSpriteActions> | null = null;
    let interactionCoordinatorApi: ReturnType<typeof initializeInteractionCoordinatorFromMain> | null = null;
    let inspectorCoordinatorApi: ReturnType<typeof initializeInspectorCoordinatorFromMain> | null = null;

    function clearPngImportObjectUrl() {
        if (pngImportObjectUrl) {
            URL.revokeObjectURL(pngImportObjectUrl);
            pngImportObjectUrl = null;
        }
    }

    const dragGhostTargetSize = TILE_SIZE + dragGhostPadding * 2;
    const dragGhostCanvas = document.createElement('canvas');
    dragGhostCanvas.width = Math.ceil(dragGhostTargetSize);
    dragGhostCanvas.height = Math.ceil(dragGhostTargetSize);
    let clipboardEntries: ClipboardEntry[] = [];
    const initialCanvasSize = {
        width: host.canvas.width,
        height: host.canvas.height
    };
    const initialCanvasStyle = {
        position: host.canvas.style.position,
        inset: host.canvas.style.inset,
        width: host.canvas.style.width,
        height: host.canvas.style.height,
        margin: host.canvas.style.margin,
        zIndex: host.canvas.style.zIndex
    };
    const initialBodyOverflow = document.body.style.overflow;
    const initialDevicePixelRatio = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : 1;

    const { applyDesignerOverlayZoomCompensation } = initializeDesignerOverlayDrag({
        root: refs.root,
        paletteFlyout: refs.paletteFlyout,
        panelDragHandle,
        paletteFlyoutDragHandle,
        initialDevicePixelRatio
    });

    function getWorldSnapshot() {
        const rawWorldData = host.getRawWorldData();
        reconcileTeleporterPairsForSave(rawWorldData, TILE_SIZE);
        return serializeWorldData(rawWorldData);
    }

    function getAuthoredWorldSnapshot() {
        return serializeWorldData(state.editModeSnapshot.worldData);
    }

    function getWorldSnapshotForSave() {
        return state.mode === 'edit'
            ? getWorldSnapshot()
            : getAuthoredWorldSnapshot();
    }

    async function getWorldSnapshotForValidationAndSave() {
        if (typeof host.getRawWorldDataForSave === 'function') {
            const rawWorldData = await host.getRawWorldDataForSave();
            reconcileTeleporterPairsForSave(rawWorldData, TILE_SIZE);
            return serializeWorldData(rawWorldData);
        }
        return getWorldSnapshotForSave();
    }

    function getSnapshot(): DesignerSnapshot {
        return {
            worldData: getWorldSnapshot(),
            customSpriteDefinitions: deepClone(state.customSpriteDefinitions),
            customSpriteInstances: deepClone(state.customSpriteInstances)
        };
    }

    function syncEditModeSnapshot() {
        state.editModeSnapshot = getSnapshot();
    }

    function captureLiveResumeSnapshot() {
        state.liveResumeSnapshot = {
            snapshot: getSnapshot(),
            astronautPosition: host.getFocusWorldPosition()
        };
    }

    function restoreEditModeSnapshot() {
        const liveAstronautPosition = host.getFocusWorldPosition();
        if (designerSnapshotsEqual(getSnapshot(), state.editModeSnapshot)) {
            return false;
        }

        host.replaceRawWorldData(state.editModeSnapshot.worldData);
        state.customSpriteDefinitions = deepClone(state.editModeSnapshot.customSpriteDefinitions);
        state.customSpriteInstances = deepClone(state.editModeSnapshot.customSpriteInstances);
        if (!getCustomSpriteDefinitionById(state.typeByCategory.custom)) {
            state.typeByCategory.custom = state.customSpriteDefinitions[0]?.id ?? '';
        }
        state.selection = null;
        state.selectedItems = [];
        host.resetAstronautToPosition(liveAstronautPosition);
        invalidateOverviewBase();
        updateDirtyState();
        return true;
    }

    function restoreLiveResumeSnapshot() {
        if (!state.liveResumeSnapshot) {
            return false;
        }

        host.replaceRawWorldData(state.liveResumeSnapshot.snapshot.worldData);
        state.selection = null;
        state.selectedItems = [];
        host.resetAstronautToPosition(state.liveResumeSnapshot.astronautPosition);
        state.liveResumeSnapshot = null;
        return true;
    }

    function invalidateOverviewBase() {
        if (renderLifecycle) {
            renderLifecycle.invalidateOverviewBase();
            return;
        }
        pendingOverviewBaseInvalidation = true;
    }

    const overviewWorldTileLoader = createOverviewWorldTileLoader({
        host,
        getChunkedWorldOverview,
        invalidateOverviewBase
    });
    const { ensureOverviewWorldTilesLoaded } = overviewWorldTileLoader;

    wireSectionAccordions(sectionAccordions);

    function updateDirtyState() {
        const snapshotForDirtyCheck = state.mode === 'edit'
            ? getAuthoredWorldSnapshot()
            : getWorldSnapshotForSave();
        state.dirty = !snapshotsEqual(snapshotForDirtyCheck, state.lastSavedSnapshot);
    }

    function setStatus(message: string, tone: DesignerState['statusTone'] = 'neutral') {
        state.status = message;
        state.statusTone = tone;
        refreshStatus();
    }

    function refreshStatus() {
        refs.status.textContent = `${state.dirty ? 'Unsaved changes. ' : ''}${state.status}`;
        refs.status.className = `world-designer-status ${state.statusTone === 'neutral' ? '' : state.statusTone}`.trim();
    }

    function getCurrentType() {
        return state.typeByCategory[state.category];
    }

    function isTeleporterCompositeType(type: string) {
        return type === TELEPORTER_COMPOSITE_TYPE;
    }

    function isButtonCompositeType(type: string) {
        return type === BUTTON_COMPOSITE_TYPE;
    }

    function getPlacementTypeOptions(category: DesignerCategory, includeComposite = true): PlacementTypeOption[] {
        if (category === 'custom') {
            return [];
        }
        const baseOptions = spriteTypes.map((type) => ({ value: type, label: type }));
        if (!includeComposite) {
            return baseOptions;
        }
        if (category === 'world') {
            return [
                {
                    value: TELEPORTER_COMPOSITE_TYPE,
                    label: 'teleporter (composite)',
                    previewType: 'teleporter'
                },
                ...baseOptions
            ];
        }
        if (category === 'buttons') {
            return [
                {
                    value: BUTTON_COMPOSITE_TYPE,
                    label: 'button (composite)',
                    previewType: 'button'
                },
                ...baseOptions
            ];
        }
        return baseOptions;
    }

    function getPlacementPreviewType(type: string) {
        if (isTeleporterCompositeType(type)) {
            return 'teleporter';
        }
        if (isButtonCompositeType(type)) {
            return 'button';
        }
        return type;
    }

    function getCustomSpriteDefinitionById(id: string | null | undefined) {
        if (customSpriteActionsApi) {
            return customSpriteActionsApi.getCustomSpriteDefinitionById(id);
        }
        if (!id) {
            return null;
        }
        return state.customSpriteDefinitions.find((definition) => definition.id === id) ?? null;
    }

    function getCustomSpriteDefinitionForInstance(instance: CustomSpriteInstance) {
        return customSpriteActionsApi
            ? customSpriteActionsApi.getCustomSpriteDefinitionForInstance(instance)
            : getCustomSpriteDefinitionById(instance.customSpriteId);
    }

    function createCustomSpriteName() {
        if (customSpriteActionsApi) {
            return customSpriteActionsApi.createCustomSpriteName();
        }
        let index = state.customSpriteDefinitions.length + 1;
        let candidate = `Custom sprite ${index}`;
        const existing = new Set(state.customSpriteDefinitions.map((definition) => definition.name));
        while (existing.has(candidate)) {
            index += 1;
            candidate = `Custom sprite ${index}`;
        }
        return candidate;
    }

    function setCurrentType(type: string) {
        if (state.category !== 'custom') {
            const options = getPlacementTypeOptions(state.category, true);
            if (!options.some((option) => option.value === type)) {
                type = options[0]?.value ?? spriteTypes[0] ?? type;
            }
        }
        if (
            state.category === 'world' &&
            isTeleporterCompositeType(type) &&
            !getSingleEditableSelection()
        ) {
            state.rotation = 1;
        }
        state.typeByCategory[state.category] = type;
        refs.typeSelect.value = type;
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
    }

    function getSelectedItems() {
        if (!interactionCoordinatorApi) {
            throw new Error('Interaction coordinator is not initialized.');
        }
        return interactionCoordinatorApi.getSelectedItems();
    }

    function updateSelectionSummary() {
        if (!inspectorCoordinatorApi) {
            throw new Error('Inspector coordinator is not initialized.');
        }
        inspectorCoordinatorApi.updateSelectionSummary();
    }

    function refreshInspector() {
        if (!inspectorCoordinatorApi) {
            throw new Error('Inspector coordinator is not initialized.');
        }
        inspectorCoordinatorApi.refreshInspector();
    }

    function restorePendingInspectorFocus() {
        if (!inspectorCoordinatorApi) {
            throw new Error('Inspector coordinator is not initialized.');
        }
        inspectorCoordinatorApi.restorePendingInspectorFocus();
    }

    const panelRefreshController = initializePanelRefreshControllerFromMain({
        core: { refs, state, host, spriteTypes },
        data: { paletteCount: () => paletteCount, getCurrentType, setCurrentType },
        selection: { getSingleEditableSelection, getPlacementTypeOptions },
        rendering: { renderCurrentSpritePreview, renderSpritePickerGrid },
        utilities: { formatSpriteTranslation, categorySupportsTranslation },
        panel: { updateSelectionSummary, refreshInspector, restorePendingInspectorFocus, refreshStatus, persistDesignerUiState },
        palette: { refreshPaletteDesigner }
    });

    function refreshSelectOptions() {
        panelRefreshController.refreshSelectOptions();
    }

    const paletteDesigner = createWorldDesignerPaletteDesigner({
        state,
        refs,
        host,
        colorAliasNames,
        getPaletteCount: () => paletteCount,
        setPaletteCount: (value) => {
            paletteCount = value;
        },
        getWorldSnapshot,
        refreshSelectOptions,
        refreshPanel,
        updateDirtyState,
        syncEditModeSnapshot,
        setStatus
    });

    const spritePreviewCanvasHelpers = createWorldDesignerSpritePreviewCanvasHelpers({
        host,
        createButtonEntity,
        getPalette: () => state.palette,
        getRotation: () => state.rotation
    });

    function syncPaletteCount() {
        paletteDesigner.syncPaletteCount();
    }

    function paletteDefinitionsEqual(left: PaletteDefinition[], right: PaletteDefinition[]) {
        return paletteDesigner.paletteDefinitionsEqual(left, right);
    }

    function refreshPaletteDesigner() {
        paletteDesigner.refreshPaletteDesigner();
    }

    function createNewPalette() {
        paletteDesigner.createNewPalette();
    }

    function cloneSelectedPalette() {
        paletteDesigner.cloneSelectedPalette();
    }

    async function deleteSelectedPalette() {
        await paletteDesigner.deleteSelectedPalette();
    }

    async function savePaletteDesigner() {
        await paletteDesigner.savePaletteDesigner();
    }

    function renderSpritePreviewCanvas(
        canvas: HTMLCanvasElement,
        type: string,
        palette: number,
        rotation: number,
        translation: SpriteTranslation = 'center'
    ) {
        return spritePreviewCanvasHelpers.renderSpritePreviewCanvas(
            canvas,
            type,
            palette,
            rotation,
            translation
        );
    }

    function renderButtonCompositePreviewCanvas(
        canvas: HTMLCanvasElement,
        button?: Button
    ) {
        return spritePreviewCanvasHelpers.renderButtonCompositePreviewCanvas(canvas, button);
    }

    const previewRenderingController = initializePreviewRenderingControllerFromMain({
        core: { tileSize: TILE_SIZE, host, state },
        refs: {
            spritePreviewCanvas: refs.spritePreviewCanvas,
            spritePreviewMeta: refs.spritePreviewMeta
        },
        data: { getCurrentType },
        selection: { getSelectedItems, getPlacementPreviewType },
        types: { isButtonCompositeType, isTeleporterCompositeType },
        entityFactories: { createButtonEntity },
        customSprites: { getCustomSpriteDefinitionById },
        utilities: {
            categorySupportsTranslation,
            formatSpriteTranslation,
            normalizeRotation,
            normalizeSpriteTranslation,
            deepClone
        },
        geometry: { getEntityRect, getRectAtPosition },
        rendering: { renderSpritePreviewCanvas, renderButtonCompositePreviewCanvas }
    });

    function drawCustomSpriteDefinitionAt(
        ctx: CanvasRenderingContext2D,
        definition: CustomSpriteDefinition,
        screenX: number,
        screenY: number
    ) {
        return previewRenderingController.drawCustomSpriteDefinitionAt(ctx, definition, screenX, screenY);
    }

    function renderCustomSpritePreviewCanvas(
        canvas: HTMLCanvasElement,
        definition: CustomSpriteDefinition | null
    ) {
        return previewRenderingController.renderCustomSpritePreviewCanvas(canvas, definition);
    }

    function renderCurrentSpritePreview() {
        previewRenderingController.renderCurrentSpritePreview();
    }

    function getDefaultImportWorldRect() {
        const worldSelections = getSelectedItems().filter((selection: Selection) => selection.category === 'world');
        if (worldSelections.length > 0) {
            const bounds = getSelectionBounds(worldSelections);
            const width = Math.max(32, Math.ceil((bounds.right - bounds.left) / 32) * 32);
            const height = Math.max(32, Math.ceil((bounds.bottom - bounds.top) / 32) * 32);
            return {
                x: snapCoordinate(bounds.left),
                y: snapCoordinate(bounds.top),
                width,
                height
            };
        }

        const width = Math.max(32, Math.ceil(host.canvas.width / 32) * 32);
        const height = Math.max(32, Math.ceil(host.canvas.height / 32) * 32);
        return {
            x: snapCoordinate(state.camera.x),
            y: snapCoordinate(state.camera.y),
            width,
            height
        };
    }

    function getPngImportTypeDefaults(snapshot: RawWorldData) {
        const typeDefaults = new Map<string, { collision: boolean; maskAstronaut: boolean }>();
        for (const block of snapshot.worldMap) {
            if (!typeDefaults.has(block.type)) {
                typeDefaults.set(block.type, {
                    collision: block.collision !== false,
                    maskAstronaut: shouldMaskAstronaut(block)
                });
            }
        }
        return typeDefaults;
    }

    function getPngImportTypeNames(snapshot: RawWorldData) {
        return [...new Set(snapshot.worldMap.map((block) => block.type))]
            .filter((type) => spriteTypes.includes(type))
            .sort();
    }

    const pngImportDraftApi = createWorldDesignerPngImportDraftApi({
        host,
        getPaletteCount: () => paletteCount,
        getPngImportTypeNames,
        getPngImportTypeDefaults,
        getPngImportSourceTileCount,
        clamp,
        normalizeRotation,
        yieldToUi
    });

    const explicitResolverBindings: Record<string, unknown> = {
        clearPreviewCanvas,
        composePngChunkFolderSource,
        exportPngChunksToDirectory,
        getDirectoryPicker,
        getPngChunkSelectionEntries,
        getPngImportWorldSpanFromTileCount,
        getPngImportSourceTileCount,
        getSuggestedPngImportWorldSpan,
        readPngChunkFolderSelection
    };
    const resolveFromMainScope = (name: string) =>
        Object.prototype.hasOwnProperty.call(explicitResolverBindings, name)
            ? explicitResolverBindings[name]
            : eval(name);

    function applyPngImportDraft(draft: PngImportDraft, replaceExisting: boolean, clearAllExisting: boolean = false) {
        const draftBlocks = draft.blocks.filter((block): block is MapBlock => block !== null);
        runMutation(
            `Imported ${draftBlocks.length} draft world tile${draftBlocks.length === 1 ? '' : 's'} from PNG.`,
            () => {
                host.ensureWorldBounds(draft.worldX + draft.worldWidth, draft.worldY + draft.worldHeight);
                const worldMap = getCategoryArray('world') as MapBlock[];
                const collectables = getCategoryArray('collectables');
                if (clearAllExisting) {
                    worldMap.splice(0, worldMap.length);
                    collectables.splice(0, collectables.length);
                } else if (replaceExisting) {
                    for (let index = worldMap.length - 1; index >= 0; index -= 1) {
                        const block = worldMap[index];
                        if (
                            block.x >= draft.worldX &&
                            block.x < draft.worldX + draft.worldWidth &&
                            block.y >= draft.worldY &&
                            block.y < draft.worldY + draft.worldHeight
                        ) {
                            worldMap.splice(index, 1);
                        }
                    }
                }
                const insertedBlocks = draftBlocks.map((block) => toMapBlockData(block));
                worldMap.push(...insertedBlocks);
                setSelections(
                    insertedBlocks.map((block) => ({ category: 'world' as const, entity: block })),
                    insertedBlocks[0] ? { category: 'world', entity: insertedBlocks[0] } : null
                );
            }
        );
    }

    async function importWorldDraftFromPng(config: {
        url: string;
        sourceX: number;
        sourceY: number;
        sourceWidth: number;
        sourceHeight: number;
        worldX: number;
        worldY: number;
        worldWidth: number;
        worldHeight: number;
        replaceExisting: boolean;
    }) {
        const draft = await pngImportDraftApi.buildPngImportDraftFromPng(config);
        applyPngImportDraft(draft, config.replaceExisting);
        closeModal();
        const blockCount = draft.blocks.filter((block): block is MapBlock => block !== null).length;
        setStatus(
            draft.uncertainTiles > 0
                ? `Imported ${blockCount} draft world tiles from PNG. ${draft.uncertainTiles} tile${draft.uncertainTiles === 1 ? '' : 's'} had low-confidence matches, so review the result in the designer before saving.`
                : `Imported ${blockCount} draft world tiles from PNG.`,
            draft.uncertainTiles > 0 ? 'neutral' : 'success'
        );
    }

    function renderSpritePickerGrid() {
        renderWorldDesignerSpritePickerGrid({
            state,
            host,
            refs,
            spriteTypes,
            spriteCatalog,
            spritePickerButtons,
            teleporterCompositeType: TELEPORTER_COMPOSITE_TYPE,
            buttonCompositeType: BUTTON_COMPOSITE_TYPE,
            getCurrentType,
            setCurrentType,
            refreshPanel,
            setStatus,
            isTeleporterCompositeType,
            renderCustomSpritePreviewCanvas,
            getCustomSpriteDefinitionById,
            renderSpritePreviewCanvas
        });
    }

    const magnifier = createWorldDesignerMagnifier({
        state,
        host,
        magnifierCanvas,
        magnifierSize: MAGNIFIER_SIZE,
        magnifierZoom: MAGNIFIER_ZOOM,
        magnifierCursorOffset: MAGNIFIER_CURSOR_OFFSET,
        clamp
    });

    function drawMagnifier(ctx: CanvasRenderingContext2D) {
        magnifier.drawMagnifier(ctx);
    }

    function getCategoryArray(category: DesignerCategory): any[] {
        const data = host.getRawWorldData();
        if (category === 'world') return data.worldMap;
        if (category === 'buttons') return data.buttons as any[];
        if (category === 'doors') return data.doors as any[];
        if (category === 'creatures') return data.creatures as any[];
        if (category === 'custom') return state.customSpriteInstances;
        return data.collectables as any[];
    }

    function getAstronautStartPosition() {
        return host.getRawWorldData().astronautStart;
    }

    const {
        getHitCandidates,
        getEntityAt,
        getSelectionBounds,
        getSelectionVisuals,
        getSelectionsInRect
    } = createWorldDesignerSelectionGeometry({
        host,
        getCustomSpriteInstances: () => state.customSpriteInstances,
        getLayerVisibility: () => state.layerVisibility,
        getEntityRect,
        findWorldBlockByExactPosition: (...args: [number, number, string]) => findWorldBlockByExactPosition(...args),
        findTeleporterForWorldBlock: (...args: [MapBlock]) => findTeleporterForWorldBlock(...args),
        getPrimarySelection: () => state.selection,
        areSameSelection: (...args: Parameters<typeof areSameSelection>) => areSameSelection(...args),
        normalizeRect,
        rectsIntersect
    });

    function setSnapOffsets(x: number, y: number) {
        state.snapOffsetX = normalizeSnapOffset(x);
        state.snapOffsetY = normalizeSnapOffset(y);
    }

    function setSnapOffsetsFromPosition(position: Position) {
        setSnapOffsets(position.x, position.y);
    }

    function updateModifierSnapMode(ctrlKey: boolean, altKey: boolean) {
        state.activeObjectSnapMode = getObjectSnapMode(ctrlKey, altKey);
    }

    interactionCoordinatorApi = initializeInteractionCoordinatorFromMain(createInteractionCoordinatorMainContext({
        core: [state, host, refs, spriteTypes, HISTORY_LIMIT, paletteCount],
        resolve: resolveFromMainScope,
        clipboardEntriesRef: {
            get: () => clipboardEntries,
            set: (entries: ClipboardEntry[]) => {
                clipboardEntries = entries;
            }
        }
    }));

    const {
        getObjectSnapMode,
        resolvePlacementPosition: resolvePlacementPositionBase,
        areSameSelection,
        isSelected,
        setSelections,
        mergeSelections,
        removeSelection,
        expandSelectionsWithLinkedTeleporters,
        getSelectionsInDrawOrder,
        removeTeleportersForSelections,
        removeSelectedFromArray,
        reorderSelections,
        placeAtWorld,
        beginDrag,
        getAutoPanDelta,
        updateDraggedItems,
        completeDrag,
        focusSelection,
        duplicateSelection,
        copySelection,
        pasteSelection,
        deleteSelection,
        rotateSelection,
        nudgeSelection,
        setSelection,
        restoreSnapshot,
        undo,
        redo,
        closeContextMenu,
        positionContextMenu,
        getContextMenuWorldPosition,
        getContextMenuActionSelections,
        openContextMenu,
        openEmptyContextMenu
    } = interactionCoordinatorApi;

    function resolvePlacementPosition(
        worldX: number,
        worldY: number,
        category: DesignerCategory = state.category,
        snapMode: ObjectSnapMode = state.activeObjectSnapMode
    ) {
        return resolvePlacementPositionBase(worldX, worldY, category, snapMode);
    }

    function getNextDoorId() {
        return host
            .getRawWorldData()
            .doors
            .reduce((maxDoorId, door) => Math.max(maxDoorId, door.doorID ?? -1), -1) + 1;
    }

    function getDefaultCollectableWeight(type: string, radioactive = false) {
        if (type === 'boulder' && radioactive) {
            return 0.17;
        }
        return 0.2;
    }

    function getDefaultCollectablePaletteCycle(type: string, palette: number, paletteCount: number, radioactive = false) {
        if (type === 'boulder' && radioactive) {
            return buildDefaultPaletteCycle(palette, paletteCount);
        }
        return undefined;
    }

    const entityConversionApi = initializeEntityConversionApiFromMain({
        core: { state, spriteTypes },
        constants: {
            CATEGORY_LABELS,
            BUTTON_DEFAULT_PRESS_OFFSET,
            BUTTON_DEFAULT_BOX_OFFSET_X,
            BUTTON_DEFAULT_BOX_OFFSET_Y
        },
        data: { getPaletteCount: () => paletteCount, getCategoryArray, getNextDoorId, getDoorTypeFromSourceType },
        selection: { setSelections },
        customSprites: { getCustomSpriteDefinitionForInstance },
        utilities: { normalizeRotation, normalizeSpriteTranslation, categorySupportsTranslation, invertButtonOffset, deepClone },
        defaults: {
            getDefaultCollectableWeight,
            getDefaultCollectablePaletteCycle,
            getDefaultDestructibleEnabled,
            getDefaultDestructibleHealth,
            getDefaultDestructionSource
        }
    });

    function getEffectiveButtonDefaultOverrides() {
        return entityConversionApi.getEffectiveButtonDefaultOverrides();
    }

    function setButtonDefaultOverridesFromButton(button: Button) {
        entityConversionApi.setButtonDefaultOverridesFromButton(button);
    }

    function resetButtonDefaultOverrides() {
        entityConversionApi.resetButtonDefaultOverrides();
    }

    function createButtonEntity(config: {
        x: number;
        y: number;
        type?: string;
        palette?: number;
        boxType?: string;
        boxPalette?: number;
        rotation?: number;
        collision?: boolean;
        active?: boolean;
        linkedDoors?: number[];
        linkedTeleporters?: string[];
        teleporterMode?: TeleporterDestinationMode;
        paletteCycle?: PaletteCycleSettings;
        pressOffset?: number;
        boxOffsetX?: number;
        boxOffsetY?: number;
        capClosedOffsetX?: number;
        capClosedOffsetY?: number;
        capOpenOffsetX?: number;
        capOpenOffsetY?: number;
    }) {
        return entityConversionApi.createButtonEntity(config);
    }

    function createCustomSpriteInstance(definition: CustomSpriteDefinition, x: number, y: number): CustomSpriteInstance {
        return entityConversionApi.createCustomSpriteInstance(definition, x, y);
    }

    function ensureCustomSpriteActionsApi() {
        if (!customSpriteActionsApi) {
            customSpriteActionsApi = createWorldDesignerCustomSpriteActions({
                state,
                setSelections,
                getSelectedItems,
                getSelectionsInDrawOrder,
                setStatus,
                runMutation,
                serializeSelectionEntity,
                removeSelectedFromArray,
                createSelectionEntity,
                getCategoryArray: (category) => getCategoryArray(category as DesignerCategory),
                deepClone,
                createCustomSpriteInstance
            });
        }
        return customSpriteActionsApi;
    }

    function renameCustomSpriteDefinition(definition: CustomSpriteDefinition, nextName: string) {
        ensureCustomSpriteActionsApi().renameCustomSpriteDefinition(definition, nextName);
    }

    function canGroupSelections(selections = getSelectedItems()) {
        return ensureCustomSpriteActionsApi().canGroupSelections(selections);
    }

    function groupSelectionsAsCustomSprite() {
        ensureCustomSpriteActionsApi().groupSelectionsAsCustomSprite();
    }

    function ungroupCustomSpriteSelection() {
        ensureCustomSpriteActionsApi().ungroupCustomSpriteSelection();
    }

    function deleteCustomSpriteSelectionDefinition() {
        ensureCustomSpriteActionsApi().deleteCustomSpriteSelectionDefinition();
    }

    function canConvertCustomSpriteToButton(instance: CustomSpriteInstance) {
        return entityConversionApi.canConvertCustomSpriteToButton(instance);
    }

    function getButtonCapOffsetsRelativeToBox(button: ButtonSaveData | Button, open: boolean) {
        return entityConversionApi.getButtonCapOffsetsRelativeToBox(button, open);
    }

    function createDoorEntity(config: {
        x: number;
        y: number;
        type?: string;
        palette?: number;
        rotation?: number;
        translation?: SpriteTranslation;
        collision?: boolean;
        paletteCycle?: PaletteCycleSettings;
    }) {
        return entityConversionApi.createDoorEntity(config);
    }

    const teleporterRuntime = createWorldDesignerTeleporterRuntime({
        host,
        state,
        tileSize: TILE_SIZE,
        normalizeRotation,
        applyPosition,
        getWorldBlocks: () => getCategoryArray('world') as MapBlock[],
        getContextMenuActionSelections
    });

    const {
        getTeleporters,
        getTeleporterById,
        applyEntityPositionWithTeleporterSync,
        getTeleporterBaseRotationForPadRotation,
        renameTeleporterId,
        applyEntityRotationWithTeleporterSync,
        getNextTeleporterId,
        findWorldBlockByExactPosition,
        findTeleporterForWorldBlock,
        convertWorldTeleporterBlock,
        convertTeleporterWorldPair,
        createTeleporterCompositeAt,
        getContextMenuSelectedTeleporterPair
    } = createWorldDesignerTeleporterDelegates({
        teleporterRuntime,
        host,
        tileSize: TILE_SIZE
    });

    function getConvertActionMessage(targetCategory: DesignerCategory) {
        return entityConversionApi.getConvertActionMessage(targetCategory);
    }

    function getConvertTargetCategories(selection: Selection): DesignerCategory[] {
        return entityConversionApi.getConvertTargetCategories(selection);
    }

    function convertSelectionToCategory(selection: Selection, targetCategory: DesignerCategory) {
        entityConversionApi.convertSelectionToCategory(selection, targetCategory);
    }

    function ensureClipboardApi() {
        if (!clipboardApi) {
            clipboardApi = createWorldDesignerClipboard({
                deepClone,
                getNextDoorId,
                getCategoryArray,
                convertTeleporterWorldPair,
                findTeleporterForWorldBlock,
                getTeleporterById,
                clearTeleporterMetadata: (block) => {
                    teleporterRuntime.clearTeleporterMetadata(block);
                },
                applyTeleporterRuntimeToBlocks: (teleporter, base, pad) => {
                    teleporterRuntime.applyTeleporterRuntimeToBlocks(teleporter, base, pad);
                }
            });
        }
        return clipboardApi;
    }

    function serializeSelectionEntity(selection: Selection): ClipboardEntry['data'] {
        return ensureClipboardApi().serializeSelectionEntity(selection);
    }

    function createSelectionEntity(
        category: DesignerCategory,
        data: ClipboardEntry['data']
    ) {
        return ensureClipboardApi().createSelectionEntity(category, data);
    }

    function createPastedSelections(entries: ClipboardEntry[], offsetX: number, offsetY: number) {
        return ensureClipboardApi().createPastedSelections(entries, offsetX, offsetY);
    }

    function playMushroomPlacementSound(type: string) {
        if (type !== 'mushrooms' && type !== 'mushroom') {
            return;
        }
        if (!getSoundEnabled()) {
            return;
        }
        const placementSound = mushroomsSound.cloneNode(true);
        if (!(placementSound instanceof HTMLAudioElement)) {
            return;
        }
        placementSound.volume = 0.8;
        void placementSound.play().catch(() => { });
    }

    function commitMutation(before: DesignerSnapshot, message: string) {
        state.undoStack.push(before);
        if (state.undoStack.length > HISTORY_LIMIT) {
            state.undoStack.shift();
        }
        state.redoStack = [];
        host.afterWorldDataMutated();
        invalidateOverviewBase();
        updateDirtyState();
        syncEditModeSnapshot();
        refreshPanel();
        setStatus(message, 'neutral');
    }

    function runMutation(message: string, mutate: () => void) {
        const before = getSnapshot();
        mutate();
        commitMutation(before, message);
    }

    function clearSelection() {
        setSelections([]);
    }

    const { modalCoordinatorContext, inspectorCoordinatorContext } = createModalAndInspectorCoordinatorMainContexts({
        core: [refs, state, host, spriteTypes, paletteCount],
        resolve: resolveFromMainScope,
        setPngImportObjectUrl: (value: string | null) => { pngImportObjectUrl = value; },
        pendingInspectorFocusRef: {
            get: () => pendingInspectorFocusKey,
            set: (value: string | null) => {
                pendingInspectorFocusKey = value;
            }
        }
    });

    const modalCoordinator = initializeModalCoordinatorFromMain(modalCoordinatorContext);

    const {
        buildSavePreview,
        renderSavePreview,
        renderSpriteSheetNormalizationPreview,
        saveFromPreview,
        normalizeSpriteSheetColors,
        openSpriteSheetNormalizationPreview,
        openSavePreview,
        openPngImportModal,
        closeModal
    } = modalCoordinator;

    inspectorCoordinatorApi = initializeInspectorCoordinatorFromMain(inspectorCoordinatorContext);

    function refreshPanel() {
        panelRefreshController.refreshPanel();
    }

    const lifecycleController = initializeLifecycleControllerFromMain({
        core: { state, host },
        initialState: { initialCanvasStyle, initialCanvasSize, initialBodyOverflow },
        mutations: { setStatus, syncEditModeSnapshot },
        panel: { refreshPanel },
        interaction: { focusOnCurrentWorldPosition, closeContextMenu },
        modal: { closeModal: () => closeModal() }
    });

    function resizeExpandedViewport() {
        lifecycleController.resizeExpandedViewport();
    }

    function setViewportExpanded(expanded: boolean) {
        lifecycleController.setViewportExpanded(expanded);
    }

    function updateSelectionFromInspectorState() {
        if (!state.selection) return;
        state.rotation = state.selection.category === 'custom'
            ? state.rotation
            : normalizeRotation(state.selection.entity.rotation);
        state.translation = categorySupportsTranslation(state.selection.category)
            ? normalizeSpriteTranslation(state.selection.entity.translation)
            : 'center';
        state.palette = state.selection.category === 'custom'
            ? state.palette
            : clamp(state.selection.entity.palette ?? 0, 0, paletteCount - 1);
        state.typeByCategory[state.selection.category] = state.selection.category === 'custom'
            ? state.selection.entity.customSpriteId
            : state.selection.entity.type;
        refreshPanel();
    }

    function getSingleEditableSelection() {
        if (!state.selection || getSelectedItems().length !== 1) {
            return null;
        }
        return state.selection;
    }

    function convertSelection() {
        if (!state.selection) return;
        const targetCategory = refs.convertTargetSelect.value as DesignerCategory;
        if (!targetCategory) return;
        runMutation(getConvertActionMessage(targetCategory), () => {
            convertSelectionToCategory(state.selection!, targetCategory);
        });
    }

    function screenToWorld(x: number, y: number) {
        return {
            x: x + state.camera.x,
            y: y + state.camera.y
        };
    }

    function getCanvasPoint(event: MouseEvent) {
        const rect = host.canvas.getBoundingClientRect();
        return {
            x: clamp(event.clientX - rect.left, 0, rect.width),
            y: clamp(event.clientY - rect.top, 0, rect.height)
        };
    }

    function placeDraggedPickerSprite(point: Position) {
        if (!state.pickerDrag) return;
        const drag = state.pickerDrag;
        const previousCategory = state.category;
        const previousType = getCurrentType();
        const previousPalette = state.palette;
        const previousRotation = state.rotation;
        const previousTranslation = state.translation;
        runMutation(`Placed new ${CATEGORY_LABELS[drag.category].toLowerCase()} from the sprite grid.`, () => {
            state.category = drag.category;
            state.typeByCategory[drag.category] = drag.type;
            state.palette = drag.palette;
            state.rotation = drag.rotation;
            state.translation = drag.translation;
            const world = screenToWorld(point.x, point.y);
            placeAtWorld(world.x, world.y);
            state.category = previousCategory;
            state.typeByCategory[previousCategory] = previousType;
            state.palette = previousPalette;
            state.rotation = previousRotation;
            state.translation = previousTranslation;
        });
        updateSelectionFromInspectorState();
    }

    function refreshModifierSnapInteraction() {
        if (state.dragging && state.lastPointerCanvas) {
            updateDraggedItems(state.lastPointerCanvas, false);
        }
    }

    function clearPickerDrag() {
        state.pickerDrag = null;
        state.pickerDragCanvas = null;
        state.objectSnapGuides = [];
        renderSpritePickerGrid();
    }

    function getMapBounds() {
        return host.getMapBounds();
    }

    const interactionHandlers = initializeInteractionHandlersFromMain({
        core: { state, refs, host },
        constants: { CATEGORY_LABELS },
        data: { getMapBounds },
        types: { isFormTarget },
        geometry: { getCanvasPoint, screenToWorld },
        teleporters: { getTeleporterById },
        mutations: { runMutation, setStatus, persistDesignerUiState },
        selection: {
            getEntityAt,
            isSelected,
            getSelectedItems,
            setSelections,
            removeSelection,
            areSameSelection,
            mergeSelections,
            getSelectionsInRect,
            updateSelectionFromInspectorState
        },
        interaction: {
            closeContextMenu,
            updateModifierSnapMode,
            placeAtWorld,
            beginDrag,
            updateDraggedItems,
            placeDraggedPickerSprite,
            clearPickerDrag,
            completeDrag,
            setDesignerActive,
            refreshModifierSnapInteraction,
            restoreEditModeSnapshot
        },
        modal: { closeModal, openSavePreview },
        history: { undo, redo, duplicateSelection, copySelection, pasteSelection, deleteSelection, rotateSelection, nudgeSelection },
        panel: { refreshPanel },
        utilities: { clamp }
    });

    function moveCameraToWorldCenter(worldX: number, worldY: number) {
        interactionHandlers.moveCameraToWorldCenter(worldX, worldY);
    }

    function focusOnCurrentWorldPosition() {
        const focus = host.getFocusWorldPosition();
        const { width: mapWidth, height: mapHeight } = getMapBounds();
        state.overviewHoverWorld = {
            x: clamp(focus.x, 0, mapWidth),
            y: clamp(focus.y, 0, mapHeight)
        };
        moveCameraToWorldCenter(state.overviewHoverWorld.x, state.overviewHoverWorld.y);
        persistDesignerUiState();
    }

    function setAstronautStartToViewCenter() {
        runMutation('Updated astronaut start position.', () => {
            host.setAstronautStartPosition({
                x: Math.round(state.camera.x + host.canvas.width / 2),
                y: Math.round(state.camera.y + host.canvas.height / 2)
            }, true);
        });
    }

    function moveLiveAstronautToViewCenter() {
        const position = {
            x: Math.round(state.camera.x + host.canvas.width / 2),
            y: Math.round(state.camera.y + host.canvas.height / 2)
        };
        host.resetAstronautToPosition(position);
        if (state.liveResumeSnapshot) {
            state.liveResumeSnapshot.astronautPosition = position;
        }
        setStatus('Moved the live astronaut to the center of the current view.', 'success');
    }

    function setDesignerActive(nextActive: boolean) {
        lifecycleController.setDesignerActive(nextActive);
    }

    const runtimeAssembly = initializeRuntimeAssemblyFromMain(createRuntimeAssemblyMainContext({
        core: [refs, state, host, paletteCount, colorAliasNames, overviewBaseCanvas, styles],
        resolve: resolveFromMainScope,
        selectionApi: interactionCoordinatorApi,
        resetSpriteResolversAndCache: () => {
            customSpriteDefinitionResolver = null;
            resetVisibleSpriteRectResolverCache();
        },
        setRenderLifecycle: (nextRenderLifecycle: any) => { renderLifecycle = nextRenderLifecycle; },
        getRenderLifecycle: () => renderLifecycle,
        pendingOverviewBaseInvalidationRef: {
            get: () => pendingOverviewBaseInvalidation,
            set: (value: boolean) => {
                pendingOverviewBaseInvalidation = value;
            }
        }
    }));

    return runtimeAssembly.api;
}
