import { normalizeSpriteTranslation } from '../../shared/utilities.js';
import {
    buildLayerVisibility,
    clamp,
    deepClone,
    getDefaultType,
    normalizeRotation,
    normalizeSnapOffset
} from '../core/world-designer-helpers.js';

import type {
    DesignerCategory,
    DesignerSectionId,
    LayerVisibility,
    DesignerState,
    PaletteDefinition,
    PersistedDesignerUiState,
    RawWorldData,
    WorldDesignerHost
} from '../core/world-designer-types.js';

type WorldDesignerBootstrapContext = {
    host: WorldDesignerHost;
    spriteTypes: string[];
    paletteCount: number;
    initialPaletteDefinitions: PaletteDefinition[];
    initialSnapshot: RawWorldData;
    categoryLabels: Record<DesignerCategory, string>;
    storageKey: string;
};

type WorldDesignerBootstrapResult = {
    state: DesignerState;
    restoredViewportExpanded: boolean;
    persistDesignerUiState: () => void;
    wireSectionAccordions: (sectionAccordions: HTMLDetailsElement[]) => void;
};

function loadPersistedState(storageKey: string): PersistedDesignerUiState | null {
    try {
        const raw = window.localStorage.getItem(storageKey);
        if (!raw) {
            return null;
        }
        return JSON.parse(raw) as PersistedDesignerUiState;
    } catch {
        return null;
    }
}

function createPersistedStateSnapshot(
    state: DesignerState,
    host: WorldDesignerHost
): PersistedDesignerUiState {
    return {
        active: state.active,
        mode: state.mode,
        tool: state.tool,
        category: state.category,
        rotation: state.rotation,
        translation: state.translation,
        palette: state.palette,
        typeByCategory: deepClone(state.typeByCategory),
        snapToGrid: state.snapToGrid,
        objectSnapEnabled: state.objectSnapEnabled,
        snapOffsetX: state.snapOffsetX,
        snapOffsetY: state.snapOffsetY,
        nudgeAmount: state.nudgeAmount,
        showCollisionOverlay: state.showCollisionOverlay,
        showCreatureOverlays: host.getShowCreatureOverlays(),
        disableCollisionInPreview: state.disableCollisionInPreview,
        layerVisibility: deepClone(state.layerVisibility),
        camera: { ...state.camera },
        viewportWidth: host.canvas.width,
        viewportHeight: host.canvas.height,
        hasOpenedOnce: state.hasOpenedOnce,
        spritePickerOpen: state.spritePickerOpen,
        spritePickerFilter: state.spritePickerFilter,
        spritePickerCategoryFilter: state.spritePickerCategoryFilter,
        magnifierEnabled: state.magnifierEnabled,
        viewportExpanded: state.viewportExpanded,
        soundEnabled: host.getSoundEnabled(),
        bulletImpactAudioSettings: host.getBulletImpactAudioSettings(),
        paletteDesignerOpen: state.paletteDesignerOpen,
        selectedPaletteIndex: state.selectedPaletteIndex,
        palettePreviewType: state.palettePreviewType,
        buttonDefaults: deepClone(state.buttonDefaults),
        customSpriteDefinitions: deepClone(state.customSpriteDefinitions),
        customSpriteInstances: deepClone(state.customSpriteInstances),
        sectionOpenState: deepClone(state.sectionOpenState)
    };
}

function normalizePersistedLayerVisibility(
    persistedLayerVisibility: unknown
): LayerVisibility {
    const defaults = buildLayerVisibility();
    if (!persistedLayerVisibility || typeof persistedLayerVisibility !== 'object') {
        return defaults;
    }
    const normalized: LayerVisibility = { ...defaults };
    for (const category of Object.keys(defaults) as DesignerCategory[]) {
        const value = (persistedLayerVisibility as Record<string, unknown>)[category];
        if (typeof value === 'boolean') {
            normalized[category] = value;
        }
    }
    if (!Object.values(normalized).some((value) => value)) {
        return defaults;
    }
    return normalized;
}

export function createWorldDesignerBootstrap({
    host,
    spriteTypes,
    paletteCount,
    initialPaletteDefinitions,
    initialSnapshot,
    categoryLabels,
    storageKey
}: WorldDesignerBootstrapContext): WorldDesignerBootstrapResult {
    const persistedState = loadPersistedState(storageKey);
    const restoredViewportExpanded = persistedState?.viewportExpanded === true;
    const restoredCustomSpriteDefinitions = Array.isArray(persistedState?.customSpriteDefinitions)
        ? deepClone(persistedState?.customSpriteDefinitions ?? [])
        : [];
    const restoredCustomSpriteInstances = Array.isArray(persistedState?.customSpriteInstances)
        ? deepClone(persistedState?.customSpriteInstances ?? [])
        : [];
    const getAstronautCenteredCamera = () => {
        const focus = host.getFocusWorldPosition();
        return host.clampCamera({
            x: focus.x - host.canvas.width / 2,
            y: focus.y - host.canvas.height / 2
        });
    };
    const defaultTypeByCategory = {
        world: getDefaultType(spriteTypes, 'world'),
        buttons: getDefaultType(spriteTypes, 'buttons'),
        doors: getDefaultType(spriteTypes, 'doors'),
        creatures: getDefaultType(spriteTypes, 'creatures'),
        collectables: getDefaultType(spriteTypes, 'collectables'),
        custom: restoredCustomSpriteDefinitions[0]?.id ?? ''
    };
    const restoredTypeByCategory: Record<DesignerCategory, string> = {
        world: spriteTypes.includes(persistedState?.typeByCategory?.world ?? '')
            ? persistedState!.typeByCategory.world
            : defaultTypeByCategory.world,
        buttons: spriteTypes.includes(persistedState?.typeByCategory?.buttons ?? '')
            ? persistedState!.typeByCategory.buttons
            : defaultTypeByCategory.buttons,
        doors: spriteTypes.includes(persistedState?.typeByCategory?.doors ?? '')
            ? persistedState!.typeByCategory.doors
            : defaultTypeByCategory.doors,
        creatures: spriteTypes.includes(persistedState?.typeByCategory?.creatures ?? '')
            ? persistedState!.typeByCategory.creatures
            : defaultTypeByCategory.creatures,
        collectables: spriteTypes.includes(persistedState?.typeByCategory?.collectables ?? '')
            ? persistedState!.typeByCategory.collectables
            : defaultTypeByCategory.collectables,
        custom: restoredCustomSpriteDefinitions.some((definition) => definition.id === persistedState?.typeByCategory?.custom)
            ? persistedState!.typeByCategory.custom
            : defaultTypeByCategory.custom
    };
    const restoredViewportWidth = Number.isFinite(persistedState?.viewportWidth)
        ? Math.max(1, Math.round(persistedState!.viewportWidth!))
        : (restoredViewportExpanded ? window.innerWidth : host.canvas.width);
    const restoredViewportHeight = Number.isFinite(persistedState?.viewportHeight)
        ? Math.max(1, Math.round(persistedState!.viewportHeight!))
        : (restoredViewportExpanded ? window.innerHeight : host.canvas.height);
    const restoredButtonDefaults = {
        capPalette: typeof persistedState?.buttonDefaults?.capPalette === 'number'
            ? clamp(Math.round(persistedState.buttonDefaults.capPalette), 0, paletteCount - 1)
            : null,
        boxPalette: typeof persistedState?.buttonDefaults?.boxPalette === 'number'
            ? clamp(Math.round(persistedState.buttonDefaults.boxPalette), 0, paletteCount - 1)
            : null,
        capClosedOffsetX: Number.isFinite(persistedState?.buttonDefaults?.capClosedOffsetX)
            ? Math.round(persistedState!.buttonDefaults!.capClosedOffsetX!)
            : null,
        capClosedOffsetY: Number.isFinite(persistedState?.buttonDefaults?.capClosedOffsetY)
            ? Math.round(persistedState!.buttonDefaults!.capClosedOffsetY!)
            : null,
        capOpenOffsetX: Number.isFinite(persistedState?.buttonDefaults?.capOpenOffsetX)
            ? Math.round(persistedState!.buttonDefaults!.capOpenOffsetX!)
            : null,
        capOpenOffsetY: Number.isFinite(persistedState?.buttonDefaults?.capOpenOffsetY)
            ? Math.round(persistedState!.buttonDefaults!.capOpenOffsetY!)
            : null
    };
    const restoredCamera = persistedState?.camera
        ? host.clampCamera({
            x: (Number.isFinite(persistedState.camera.x) ? persistedState.camera.x : 0)
                + restoredViewportWidth / 2
                - host.canvas.width / 2,
            y: (Number.isFinite(persistedState.camera.y) ? persistedState.camera.y : 0)
                + restoredViewportHeight / 2
                - host.canvas.height / 2
        })
        : getAstronautCenteredCamera();
    const initialCamera = persistedState?.active === true && persistedState?.mode === 'edit'
        ? restoredCamera
        : getAstronautCenteredCamera();
    const palettePreviewType = spriteTypes.includes(persistedState?.palettePreviewType ?? '')
        ? persistedState!.palettePreviewType
        : defaultTypeByCategory.world;
    if (typeof persistedState?.soundEnabled === 'boolean') {
        host.setSoundEnabled(persistedState.soundEnabled);
    }
    if (typeof persistedState?.showCreatureOverlays === 'boolean') {
        host.setShowCreatureOverlays(persistedState.showCreatureOverlays);
    }
    if (persistedState?.bulletImpactAudioSettings) {
        host.setBulletImpactAudioSettings(persistedState.bulletImpactAudioSettings);
    }
    const restoredValidCustomSpriteInstances = restoredCustomSpriteInstances.filter((instance) =>
        restoredCustomSpriteDefinitions.some((definition) => definition.id === instance.customSpriteId)
    );
    const state: DesignerState = {
        active: persistedState?.active ?? false,
        mode: persistedState?.mode === 'preview' ? 'preview' : 'edit',
        tool: persistedState?.tool === 'place' ? 'place' : 'select',
        category: persistedState?.category && persistedState.category in categoryLabels ? persistedState.category : 'world',
        rotation: normalizeRotation(persistedState?.rotation),
        translation: normalizeSpriteTranslation(persistedState?.translation),
        palette: clamp(typeof persistedState?.palette === 'number' ? persistedState.palette : 0, 0, paletteCount - 1),
        typeByCategory: restoredTypeByCategory,
        snapToGrid: persistedState?.snapToGrid ?? false,
        objectSnapEnabled: persistedState?.objectSnapEnabled ?? false,
        snapOffsetX: normalizeSnapOffset(Number(persistedState?.snapOffsetX) || 0),
        snapOffsetY: normalizeSnapOffset(Number(persistedState?.snapOffsetY) || 0),
        nudgeAmount: clamp(Number(persistedState?.nudgeAmount) || 1, 1, 64),
        showCollisionOverlay: persistedState?.showCollisionOverlay ?? false,
        showCreatureOverlays: persistedState?.showCreatureOverlays ?? false,
        disableCollisionInPreview: persistedState?.disableCollisionInPreview ?? false,
        layerVisibility: normalizePersistedLayerVisibility(persistedState?.layerVisibility),
        camera: initialCamera,
        dirty: false,
        status: 'Designer hidden by default. Press ` to open it.',
        statusTone: 'neutral',
        selection: null,
        selectedItems: [],
        dragging: false,
        dragItems: [],
        dragAnchorWorld: null,
        objectSnapGuides: [],
        activeObjectSnapMode: (persistedState?.objectSnapEnabled ?? false) ? 'dock' : 'none',
        lastPointerCanvas: null,
        dragStartSnapshot: null,
        panningView: false,
        panStartCanvas: null,
        panStartCamera: null,
        marqueeSelecting: false,
        marqueeStartWorld: null,
        marqueeCurrentWorld: null,
        marqueeAdditive: false,
        overviewDragging: false,
        overviewHoverWorld: null,
        hasOpenedOnce: persistedState?.hasOpenedOnce ?? (persistedState?.active ?? false),
        spritePickerOpen: persistedState?.spritePickerOpen ?? false,
        spritePickerFilter: persistedState?.spritePickerFilter ?? '',
        spritePickerCategoryFilter: persistedState?.spritePickerCategoryFilter ?? 'all',
        magnifierEnabled: persistedState?.magnifierEnabled ?? false,
        pickerDrag: null,
        pickerDragCanvas: null,
        savePreviewOpen: false,
        viewportExpanded: false,
        paletteDesignerOpen: persistedState?.paletteDesignerOpen ?? false,
        selectedPaletteIndex: clamp(typeof persistedState?.selectedPaletteIndex === 'number' ? persistedState.selectedPaletteIndex : 0, 0, paletteCount - 1),
        palettePreviewType,
        buttonDefaults: restoredButtonDefaults,
        paletteDefinitions: initialPaletteDefinitions,
        lastSavedPaletteDefinitions: deepClone(initialPaletteDefinitions),
        customSpriteDefinitions: restoredCustomSpriteDefinitions,
        customSpriteInstances: restoredValidCustomSpriteInstances,
        sectionOpenState: { ...(persistedState?.sectionOpenState ?? {}) },
        contextMenu: {
            screen: null,
            world: null,
            primarySelection: null
        },
        teleporterDestinationPick: null,
        pendingRightPan: false,
        suppressContextMenuOnce: false,
        undoStack: [],
        redoStack: [],
        editModeSnapshot: {
            worldData: initialSnapshot,
            customSpriteDefinitions: deepClone(restoredCustomSpriteDefinitions),
            customSpriteInstances: deepClone(restoredValidCustomSpriteInstances)
        },
        liveResumeSnapshot: null,
        lastSavedSnapshot: initialSnapshot
    };

    const persistDesignerUiState = () => {
        try {
            const payload = createPersistedStateSnapshot(state, host);
            window.localStorage.setItem(storageKey, JSON.stringify(payload));
        } catch {
            // Ignore storage failures and keep the designer usable.
        }
    };

    const wireSectionAccordions = (sectionAccordions: HTMLDetailsElement[]) => {
        const refreshSectionAccordions = () => {
            for (const accordion of sectionAccordions) {
                const sectionId = accordion.dataset.sectionId as DesignerSectionId | undefined;
                if (!sectionId) {
                    continue;
                }
                accordion.open = state.sectionOpenState[sectionId] === true;
            }
        };

        for (const accordion of sectionAccordions) {
            accordion.open = false;
            accordion.addEventListener('toggle', () => {
                const sectionId = accordion.dataset.sectionId as DesignerSectionId | undefined;
                if (!sectionId) {
                    return;
                }
                state.sectionOpenState[sectionId] = accordion.open;
                persistDesignerUiState();
            });
        }
        refreshSectionAccordions();
    };

    return {
        state,
        restoredViewportExpanded,
        persistDesignerUiState,
        wireSectionAccordions
    };
}
