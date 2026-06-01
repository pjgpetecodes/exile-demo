import { Creature } from '../../entities/creature.js';
import { Collectable, getDefaultGrenadeExplosionPower, isGrenadeCollectableType } from '../../entities/collectable.js';
import { DESTRUCTION_SOURCE_OPTIONS, getDefaultDestructibleEnabled, getDefaultDestructibleHealth, getDefaultDestructionSource } from '../../entities/destructibles.js';
import { MOVEMENT_SETTINGS } from '../../config/settings.js';
import { CREATURE_SOUND_MANIFEST } from '../../assets/creature-sound-manifest.js';
import { shouldMaskAstronaut } from '../../world/map.js';
import { buildDefaultPaletteCycle, getEffectivePaletteCycle } from '../../world/palette-cycle.js';
import { normalizeSpriteTranslation, SPRITE_TRANSLATION_OPTIONS } from '../../shared/utilities.js';
import {
    BUTTON_DEFAULT_BOX_OFFSET_X,
    BUTTON_DEFAULT_BOX_OFFSET_Y,
    BUTTON_DEFAULT_PRESS_OFFSET,
    CATEGORY_LABELS,
    PNG_CHUNK_DEFAULT_TILE_HEIGHT,
    PNG_CHUNK_DEFAULT_TILE_WIDTH,
    PNG_CHUNK_EXPORT_MANIFEST_NAME,
    PNG_IMPORT_DEFAULT_URL,
    PNG_IMPORT_PREVIEW_MAX_TILE_SIZE,
    PNG_IMPORT_SOURCE_TILE_SIZE,
    TILE_SIZE
} from '../config/world-designer-config.js';
import {
    categorySupportsTranslation,
    clamp,
    deepClone,
    formatSpriteTranslation,
    isTeleporterMode,
    normalizeRect,
    normalizeRotation
} from '../core/world-designer-helpers.js';
import {
    serializeWorldData,
    stableStringify,
    snapshotsEqual,
    toMapBlockData
} from '../core/world-designer-serialization.js';
import { parseDoorIds, parsePaletteCyclePalettes, parseStringIds } from '../core/world-designer-ui.js';

export function createInteractionCoordinatorMainContext(context: any) {
    const [state, host, refs, spriteTypes, historyLimit, paletteCount] = context.core;
    const resolve = context.resolve;
    return {
        core: { state, host, refs, spriteTypes, historyLimit, paletteCount },
        clipboardEntriesRef: context.clipboardEntriesRef,
        data: {
            getCategoryArray: resolve('getCategoryArray'),
            getButtons: () => host.getRawWorldData().buttons,
            getCurrentType: resolve('getCurrentType'),
            getPaletteCount: () => paletteCount
        },
        teleporters: {
            getTeleporters: () => resolve('getTeleporters')(),
            findTeleporterForWorldBlock: (...args: [any]) => resolve('findTeleporterForWorldBlock')(...args),
            findWorldBlockByExactPosition: (...args: [number, number, string]) => resolve('findWorldBlockByExactPosition')(...args),
            applyEntityRotationWithTeleporterSync: (entity: any, rotation: number) => resolve('applyEntityRotationWithTeleporterSync')(entity, rotation),
            applyEntityPositionWithTeleporterSync: (entity: any, x: number, y: number) => resolve('applyEntityPositionWithTeleporterSync')(entity, x, y),
            createTeleporterCompositeAt: (...args: [number, number]) => resolve('createTeleporterCompositeAt')(...args),
            getContextMenuSelectedTeleporterPair: () => resolve('getContextMenuSelectedTeleporterPair')(),
            convertTeleporterWorldPair: (...args: [any, any]) => resolve('convertTeleporterWorldPair')(...args)
        },
        mutations: {
            runMutation: resolve('runMutation'),
            refreshPanel: resolve('refreshPanel'),
            persistDesignerUiState: resolve('persistDesignerUiState'),
            setStatus: resolve('setStatus'),
            invalidateOverviewBase: resolve('invalidateOverviewBase'),
            updateDirtyState: resolve('updateDirtyState'),
            syncEditModeSnapshot: resolve('syncEditModeSnapshot')
        },
        selectionGeometry: {
            getSelectionBounds: resolve('getSelectionBounds'),
            getHitCandidates: resolve('getHitCandidates')
        },
        selection: {
            serializeSelectionEntity: resolve('serializeSelectionEntity'),
            createPastedSelections: resolve('createPastedSelections'),
            getSnapshot: resolve('getSnapshot'),
            designerSnapshotsEqual: resolve('designerSnapshotsEqual'),
            updateSelectionFromInspectorState: resolve('updateSelectionFromInspectorState'),
            canGroupSelections: resolve('canGroupSelections'),
            groupSelectionsAsCustomSprite: resolve('groupSelectionsAsCustomSprite'),
            ungroupCustomSpriteSelection: resolve('ungroupCustomSpriteSelection'),
            convertSelectionToCategory: resolve('convertSelectionToCategory'),
            canConvertCustomSpriteToButton: resolve('canConvertCustomSpriteToButton')
        },
        geometry: {
            getRectAtPosition: resolve('getRectAtPosition'),
            getEntityRect: resolve('getEntityRect'),
            screenToWorld: resolve('screenToWorld'),
            getCanvasPoint: resolve('getCanvasPoint')
        },
        utilities: { normalizeRotation, normalizeSpriteTranslation, categorySupportsTranslation, deepClone, clamp },
        types: {
            isTeleporterCompositeType: resolve('isTeleporterCompositeType'),
            isButtonCompositeType: resolve('isButtonCompositeType'),
            shouldMaskAstronaut
        },
        entityFactories: {
            createButtonEntity: resolve('createButtonEntity'),
            createCustomSpriteInstance: resolve('createCustomSpriteInstance'),
            createDoorEntity: resolve('createDoorEntity'),
            createCreatureEntity: ({ x, y, type, palette, rotation, translation }: any) => new Creature({
                x, y, type, palette, rotation, translation, state: {}
            }),
            createCollectableEntity: ({ x, y, type, palette, rotation, weight, paletteCycle }: any) => new Collectable({
                x, y, type, palette, rotation, name: type, weight,
                pickupEnabled: true, storable: true, affectsAstronaut: true, collision: true,
                collected: false, held: false, stored: false, paletteCycle
            })
        },
        defaults: {
            getDefaultCollectableWeight: resolve('getDefaultCollectableWeight'),
            getDefaultCollectablePaletteCycle: resolve('getDefaultCollectablePaletteCycle')
        },
        customSprites: {
            getCustomSpriteDefinitionById: resolve('getCustomSpriteDefinitionById'),
            deleteCustomSpriteSelectionDefinition: resolve('deleteCustomSpriteSelectionDefinition')
        },
        effects: { playMushroomPlacementSound: resolve('playMushroomPlacementSound') },
        rendering: { renderSpritePreviewCanvas: resolve('renderSpritePreviewCanvas') }
    };
}

export function createModalAndInspectorCoordinatorMainContexts(context: any) {
    const [refs, state, host, spriteTypes, paletteCount] = context.core;
    const resolve = context.resolve;
    return {
        modalCoordinatorContext: {
            core: { refs, state, host, spriteTypes, paletteCount },
            constants: {
                PNG_IMPORT_DEFAULT_URL,
                PNG_IMPORT_SOURCE_TILE_SIZE,
                PNG_CHUNK_EXPORT_MANIFEST_NAME,
                PNG_CHUNK_DEFAULT_TILE_WIDTH,
                PNG_CHUNK_DEFAULT_TILE_HEIGHT,
                PNG_IMPORT_PREVIEW_MAX_TILE_SIZE
            },
            types: { SPRITE_TRANSLATION_OPTIONS },
            data: {
                getPaletteCount: () => paletteCount,
                getAuthoredWorldSnapshot: resolve('getAuthoredWorldSnapshot'),
                getWorldSnapshotForValidationAndSave: resolve('getWorldSnapshotForValidationAndSave')
            },
            panel: { refreshSelectOptions: resolve('refreshSelectOptions') },
            palette: {
                syncPaletteCount: resolve('syncPaletteCount'),
                refreshPaletteDesigner: resolve('refreshPaletteDesigner')
            },
            mutations: {
                syncEditModeSnapshot: resolve('syncEditModeSnapshot'),
                updateDirtyState: resolve('updateDirtyState'),
                setStatus: resolve('setStatus'),
                refreshPanel: resolve('refreshPanel')
            },
            utilities: {
                stableStringify,
                snapshotsEqual,
                paletteDefinitionsEqual: resolve('paletteDefinitionsEqual'),
                deepClone,
                serializeWorldData,
                formatSpriteTranslation,
                normalizeRotation,
                normalizeSpriteTranslation,
                clamp,
                toMapBlockData
            },
            pngImport: {
                clearPngImportObjectUrl: resolve('clearPngImportObjectUrl'),
                getDefaultImportWorldRect: resolve('getDefaultImportWorldRect'),
                getPngImportTypeNames: resolve('getPngImportTypeNames'),
                getPngImportTypeDefaults: resolve('getPngImportTypeDefaults'),
                setPngImportObjectUrl: context.setPngImportObjectUrl,
                getPngChunkSelectionEntries: resolve('getPngChunkSelectionEntries'),
                getPngImportWorldSpanFromTileCount: resolve('getPngImportWorldSpanFromTileCount'),
                composePngChunkFolderSource: resolve('composePngChunkFolderSource'),
                pngImportDraftApi: resolve('pngImportDraftApi'),
                getPngImportSourceTileCount: resolve('getPngImportSourceTileCount'),
                getSuggestedPngImportWorldSpan: resolve('getSuggestedPngImportWorldSpan'),
                getDirectoryPicker: resolve('getDirectoryPicker'),
                readPngChunkFolderSelection: resolve('readPngChunkFolderSelection'),
                exportPngChunksToDirectory: resolve('exportPngChunksToDirectory'),
                applyPngImportDraft: resolve('applyPngImportDraft')
            },
            rendering: {
                renderSpritePreviewCanvas: resolve('renderSpritePreviewCanvas'),
                clearPreviewCanvas: resolve('clearPreviewCanvas')
            }
        },
        inspectorCoordinatorContext: {
            core: { refs, state, host, paletteCount, spriteTypes },
            constants: {
                CATEGORY_LABELS,
                BUTTON_DEFAULT_PRESS_OFFSET,
                BUTTON_DEFAULT_BOX_OFFSET_X,
                BUTTON_DEFAULT_BOX_OFFSET_Y
            },
            types: {
                SPRITE_TRANSLATION_OPTIONS,
                MOVEMENT_SETTINGS,
                DESTRUCTION_SOURCE_OPTIONS,
                CREATURE_SOUND_MANIFEST,
                shouldMaskAstronaut,
                isTeleporterMode,
                isGrenadeCollectableType
            },
            data: {
                getAstronautStartPosition: resolve('getAstronautStartPosition'),
                getConvertTargetCategories: resolve('getConvertTargetCategories')
            },
            defaults: {
                getEffectiveButtonDefaultOverrides: resolve('getEffectiveButtonDefaultOverrides'),
                setButtonDefaultOverridesFromButton: resolve('setButtonDefaultOverridesFromButton'),
                resetButtonDefaultOverrides: resolve('resetButtonDefaultOverrides'),
                getDefaultDestructibleEnabled,
                getDefaultDestructibleHealth,
                getDefaultDestructionSource,
                getButtonCapOffsetsRelativeToBox: resolve('getButtonCapOffsetsRelativeToBox'),
                getDefaultCollectableWeight: resolve('getDefaultCollectableWeight'),
                getDefaultCollectablePaletteCycle: resolve('getDefaultCollectablePaletteCycle'),
                getDefaultGrenadeExplosionPower
            },
            selection: { getSelectedItems: resolve('getSelectedItems') },
            teleporters: {
                applyEntityPositionWithTeleporterSync: resolve('applyEntityPositionWithTeleporterSync'),
                applyEntityRotationWithTeleporterSync: resolve('applyEntityRotationWithTeleporterSync'),
                findTeleporterForWorldBlock: resolve('findTeleporterForWorldBlock'),
                convertWorldTeleporterBlock: resolve('convertWorldTeleporterBlock'),
                renameTeleporterId: resolve('renameTeleporterId')
            },
            palette: { getEffectivePaletteCycle, buildDefaultPaletteCycle },
            parsers: { parsePaletteCyclePalettes, parseDoorIds, parseStringIds },
            customSprites: {
                getCustomSpriteDefinitionForInstance: resolve('getCustomSpriteDefinitionForInstance'),
                createCustomSpriteName: resolve('createCustomSpriteName'),
                renameCustomSpriteDefinition: resolve('renameCustomSpriteDefinition'),
                deleteCustomSpriteSelectionDefinition: resolve('deleteCustomSpriteSelectionDefinition')
            },
            mutations: { runMutation: resolve('runMutation'), setStatus: resolve('setStatus') },
            utilities: { clamp, normalizeRotation, categorySupportsTranslation, normalizeSpriteTranslation, stableStringify },
            pendingInspectorFocusRef: context.pendingInspectorFocusRef
        }
    };
}

export function createRuntimeAssemblyMainContext(context: any) {
    const [refs, state, host, paletteCount, colorAliasNames, overviewBaseCanvas, styles] = context.core;
    const resolve = context.resolve;
    return {
        core: { refs, state, host, paletteCount, colorAliasNames, overviewBaseCanvas, styles },
        constants: { CATEGORY_LABELS, TILE_SIZE },
        data: {
            setCurrentType: resolve('setCurrentType'),
            getCategoryArray: resolve('getCategoryArray'),
            getChunkedWorldOverview: resolve('getChunkedWorldOverview'),
            getAstronautStartPosition: resolve('getAstronautStartPosition'),
            ensureOverviewWorldTilesLoaded: resolve('ensureOverviewWorldTilesLoaded'),
            getOverviewWorldTiles: resolve('overviewWorldTileLoader').getOverviewWorldTiles,
            getMapBounds: resolve('getMapBounds')
        },
        utilities: { clamp, normalizeRotation, normalizeSpriteTranslation, categorySupportsTranslation, normalizeRect },
        types: {
            isTeleporterCompositeType: resolve('isTeleporterCompositeType'),
            isButtonCompositeType: resolve('isButtonCompositeType')
        },
        selection: {
            getSingleEditableSelection: resolve('getSingleEditableSelection'),
            getEntityAt: resolve('getEntityAt'),
            getSelectionVisuals: resolve('getSelectionVisuals'),
            getPlacementPreviewType: resolve('getPlacementPreviewType'),
            updateSelectionFromInspectorState: resolve('updateSelectionFromInspectorState'),
            convertSelection: resolve('convertSelection')
        },
        customSprites: {
            getCustomSpriteDefinitionById: resolve('getCustomSpriteDefinitionById'),
            getCustomSpriteDefinitionForInstance: resolve('getCustomSpriteDefinitionForInstance'),
            drawCustomSpriteDefinitionAt: resolve('drawCustomSpriteDefinitionAt')
        },
        mutations: {
            runMutation: resolve('runMutation'),
            persistDesignerUiState: resolve('persistDesignerUiState'),
            setStatus: resolve('setStatus'),
            invalidateOverviewBase: resolve('invalidateOverviewBase')
        },
        teleporters: {
            applyEntityRotationWithTeleporterSync: resolve('applyEntityRotationWithTeleporterSync'),
            getTeleporterBaseRotationForPadRotation: resolve('getTeleporterBaseRotationForPadRotation')
        },
        interaction: {
            refreshModifierSnapInteraction: resolve('refreshModifierSnapInteraction'),
            setSnapOffsets: resolve('setSnapOffsets'),
            setSnapOffsetsFromPosition: resolve('setSnapOffsetsFromPosition'),
            setDesignerActive: resolve('setDesignerActive'),
            restoreEditModeSnapshot: resolve('restoreEditModeSnapshot'),
            focusOnCurrentWorldPosition: resolve('focusOnCurrentWorldPosition'),
            moveLiveAstronautToViewCenter: resolve('moveLiveAstronautToViewCenter'),
            setAstronautStartToViewCenter: resolve('setAstronautStartToViewCenter'),
            interactionHandlers: resolve('interactionHandlers'),
            selectionApi: context.selectionApi,
            restoredViewportExpanded: resolve('restoredViewportExpanded')
        },
        palette: {
            createNewPalette: resolve('createNewPalette'),
            cloneSelectedPalette: resolve('cloneSelectedPalette'),
            deleteSelectedPalette: resolve('deleteSelectedPalette'),
            savePaletteDesigner: resolve('savePaletteDesigner'),
            refreshPaletteDesigner: resolve('refreshPaletteDesigner')
        },
        modal: {
            openSavePreview: resolve('openSavePreview'),
            openPngImportModal: resolve('openPngImportModal'),
            openSpriteSheetNormalizationPreview: resolve('openSpriteSheetNormalizationPreview'),
            closeModal: resolve('closeModal'),
            modalCoordinator: resolve('modalCoordinator')
        },
        geometry: {
            getCanvasPoint: resolve('getCanvasPoint'),
            screenToWorld: resolve('screenToWorld'),
            getEntityRect: resolve('getEntityRect')
        },
        rendering: {
            renderSpritePickerGrid: resolve('renderSpritePickerGrid'),
            renderCurrentSpritePreview: resolve('renderCurrentSpritePreview'),
            dragGhostCanvas: resolve('dragGhostCanvas'),
            dragGhostPadding: resolve('dragGhostPadding'),
            dragGhostTargetSize: resolve('dragGhostTargetSize'),
            renderCustomSpritePreviewCanvas: resolve('renderCustomSpritePreviewCanvas'),
            renderButtonCompositePreviewCanvas: resolve('renderButtonCompositePreviewCanvas'),
            drawMagnifier: resolve('drawMagnifier')
        },
        entityFactories: { createButtonEntity: resolve('createButtonEntity') },
        panel: {
            refreshSelectOptions: resolve('refreshSelectOptions'),
            refreshPanel: resolve('refreshPanel')
        },
        lifecycle: {
            resetSpriteResolversAndCache: context.resetSpriteResolversAndCache,
            resizeExpandedViewport: resolve('resizeExpandedViewport'),
            applyDesignerOverlayZoomCompensation: resolve('applyDesignerOverlayZoomCompensation'),
            setViewportExpanded: resolve('setViewportExpanded'),
            setRenderLifecycle: context.setRenderLifecycle,
            getRenderLifecycle: context.getRenderLifecycle
        },
        pendingOverviewBaseInvalidationRef: context.pendingOverviewBaseInvalidationRef
    };
}
