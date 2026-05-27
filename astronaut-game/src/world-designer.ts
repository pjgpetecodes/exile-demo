import { MAP_HEIGHT, MAP_WIDTH, SPRITE_SCALE, mushroomsSound, getSoundEnabled } from './constants.js';
import { CREATURE_SOUND_MANIFEST } from './assets/creature-sound-manifest.js';
import {
    DESTRUCTION_SOURCE_OPTIONS,
    getDefaultDestructibleEnabled,
    getDefaultDestructibleHealth,
    getDefaultDestructionSource,
    type DestructionSourceRequirement
} from './destructibles.js';
import { MapBlock, shouldMaskAstronaut } from './map.js';
import { Button } from './button.js';
import { Door } from './door.js';
import { Creature, toCreatureSaveData } from './creature.js';
import { Collectable, getDefaultGrenadeExplosionPower, isGrenadeCollectableType } from './collectable.js';
import {
    CreatureSaveData,
    PaletteCycleSettings,
    Position,
    TeleporterDestinationMode,
    TeleporterSaveData
} from './types/index.js';
import { buildDefaultPaletteCycle, getEffectivePaletteCycle } from './palette-cycle.js';
import { MOVEMENT_SETTINGS, type BulletImpactAudioSettings } from './settings.js';
import { getSpriteVisibleBounds, normalizeSpriteTranslation, SPRITE_TRANSLATION_OPTIONS, SpriteTranslation } from './utilities.js';

export type DesignerCategory = 'world' | 'buttons' | 'doors' | 'creatures' | 'collectables' | 'custom';
export type DesignerMode = 'edit' | 'preview';
export type DesignerTool = 'select' | 'place';
type RuntimeDesignerCategory = Exclude<DesignerCategory, 'custom'>;
type SpritePickerCategoryFilter = 'all' | DesignerCategory;

export type ButtonSaveData = {
    x: number;
    y: number;
    type: string;
    palette: number;
    boxType?: string;
    boxPalette?: number;
    rotation?: number;
    active?: boolean;
    linkedDoors?: number[];
    linkedTeleporters?: string[];
    teleporterMode?: TeleporterDestinationMode;
    collision?: boolean;
    pressOffset?: number;
    boxOffsetX?: number;
    boxOffsetY?: number;
    capClosedOffsetX?: number;
    capClosedOffsetY?: number;
    capOpenOffsetX?: number;
    capOpenOffsetY?: number;
    paletteCycle?: PaletteCycleSettings;
};

export type DoorSaveData = {
    x: number;
    y: number;
    z?: number;
    type: string;
    palette?: number;
    rotation?: number;
    name?: string;
    doorID?: number;
    locked?: boolean;
    open?: boolean;
    palette_locked?: number | null;
    palette_unlocked?: number | null;
    collision?: boolean;
    paletteCycle?: PaletteCycleSettings;
    destructible?: boolean;
    destructionHealth?: number;
    destructionSource?: DestructionSourceRequirement;
};

export type CollectableSaveData = {
    x: number;
    y: number;
    type: string;
    palette?: number;
    rotation?: number;
    collected?: boolean;
    name?: string;
    weight?: number;
    pickupEnabled?: boolean;
    storable?: boolean;
    affectsAstronaut?: boolean;
    collision?: boolean;
    held?: boolean;
    stored?: boolean;
    isGrounded?: boolean;
    velocity?: Position;
    astronautCollisionIgnoreFrames?: number;
    paletteCycle?: PaletteCycleSettings;
    radioactive?: boolean;
    armed?: boolean;
    explosionPower?: number;
    explosionRadius?: number;
};

export type RawWorldData = {
    worldMap: MapBlock[];
    buttons: ButtonSaveData[];
    doors: DoorSaveData[];
    creatures: CreatureSaveData[];
    collectables: CollectableSaveData[];
    teleporters: TeleporterSaveData[];
    astronautStart: Position;
};

export type LayerVisibility = Record<DesignerCategory, boolean>;
export type SpriteCatalogEntry = {
    name: string;
    palette: number;
};

export type CustomSpriteInstance = {
    x: number;
    y: number;
    type: string;
    customSpriteId: string;
};

export type CustomSpriteMember = {
    category: RuntimeDesignerCategory;
    offsetX: number;
    offsetY: number;
    data: MapBlock | ButtonSaveData | DoorSaveData | CreatureSaveData | CollectableSaveData;
};

export type CustomSpriteDefinition = {
    id: string;
    name: string;
    members: CustomSpriteMember[];
};

export type PaletteRemapEntry = {
    from: string;
    to: string;
};

export type PaletteDefinition = PaletteRemapEntry[];
export type SpriteSheetNormalizationReplacement = {
    from: [number, number, number];
    toAlias: string;
    to: [number, number, number];
    count: number;
};

export type SpriteSheetNormalizationReport = {
    spriteCount: number;
    scannedPixels: number;
    changedPixels: number;
    changedSourceColors: number;
    replacements: SpriteSheetNormalizationReplacement[];
};

export interface WorldDesignerHost {
    canvas: HTMLCanvasElement;
    getRawWorldData(): RawWorldData;
    getRawWorldDataForSave?(): Promise<RawWorldData>;
    replaceRawWorldData(data: RawWorldData): void;
    afterWorldDataMutated(): void;
    getFocusWorldPosition(): Position;
    resetAstronautToPosition(position: Position): void;
    setAstronautStartPosition(position: Position, applyToAstronaut?: boolean): void;
    getSoundEnabled(): boolean;
    setSoundEnabled(enabled: boolean): void;
    getShowSpriteOutlines(): boolean;
    setShowSpriteOutlines(value: boolean): void;
    getShowCreatureOverlays(): boolean;
    setShowCreatureOverlays(value: boolean): void;
    getBulletImpactAudioSettings(): BulletImpactAudioSettings;
    setBulletImpactAudioSettings(settings: BulletImpactAudioSettings): void;
    drawSpriteOutlineOverlay(ctx: CanvasRenderingContext2D, camera: Position, layerVisibility: LayerVisibility): void;
    getSpriteTypes(): string[];
    getSpriteCatalog(): SpriteCatalogEntry[];
    drawSpritePreview(
        ctx: CanvasRenderingContext2D,
        type: string,
        palette: number,
        rotation?: number,
        clearFirst?: boolean,
        targetSize?: number,
        translation?: SpriteTranslation
    ): boolean;
    drawSpriteSample(
        ctx: CanvasRenderingContext2D,
        type: string,
        palette: number,
        rotation?: number,
        clearFirst?: boolean,
        targetSize?: number,
        translation?: SpriteTranslation
    ): boolean;
    drawCustomPalettePreview(
        ctx: CanvasRenderingContext2D,
        type: string,
        paletteDefinition: PaletteDefinition,
        rotation?: number,
        clearFirst?: boolean,
        targetSize?: number
    ): boolean;
    getPaletteDefinitions(): PaletteDefinition[];
    getColorAliases(): Record<string, [number, number, number]>;
    getPaletteCount(): number;
    clampCamera(camera: Position): Position;
    ensureWorldBounds(width: number, height: number): void;
    saveWorldData(data: RawWorldData): Promise<void>;
    savePaletteDefinitions(palettes: PaletteDefinition[], worldData?: RawWorldData): Promise<void>;
    previewSpriteSheetNormalization(): Promise<SpriteSheetNormalizationReport>;
    normalizeSpriteSheetColors(): Promise<SpriteSheetNormalizationReport>;
}

export interface WorldDesigner {
    isActive(): boolean;
    isPreviewMode(): boolean;
    isViewportExpanded(): boolean;
    setViewportExpanded(expanded: boolean): void;
    getCamera(): Position;
    getLayerVisibility(): LayerVisibility;
    getDebugSelection(): Selection | null;
    shouldShowCollisionOverlay(): boolean;
    shouldDisableCollisionInPreview(): boolean;
    render(ctx: CanvasRenderingContext2D): void;
    destroy(): void;
}

type Selection = {
    category: DesignerCategory;
    entity: any;
};

type DragItem = {
    selection: Selection;
    startX: number;
    startY: number;
};

type PickerDrag = {
    category: DesignerCategory;
    type: string;
    palette: number;
    rotation: number;
    translation: SpriteTranslation;
};

type ClipboardEntry = {
    category: DesignerCategory;
    data: MapBlock | ButtonSaveData | DoorSaveData | CreatureSaveData | CollectableSaveData | CustomSpriteInstance;
};

type DesignerSnapshot = {
    worldData: RawWorldData;
    customSpriteDefinitions: CustomSpriteDefinition[];
    customSpriteInstances: CustomSpriteInstance[];
};

type LiveResumeSnapshot = {
    snapshot: DesignerSnapshot;
    astronautPosition: Position;
};

type SavePreviewFile = {
    key: keyof RawWorldData | 'palettes';
    label: string;
    changed: boolean;
    json: string;
};

type SavePreviewState = {
    files: SavePreviewFile[];
    errors: string[];
};

type PngImportCandidate = {
    type: string;
    palette: number;
    rotation: number;
    collision: boolean;
    maskAstronaut: boolean;
    signature: PngImportSampleSignature;
};

type PngImportSampleSignature = {
    normalizedSample: Uint8ClampedArray;
    normalizedLabels: Uint16Array;
    foregroundPixelCount: number;
    matchKey: string;
    foregroundBounds: {
        minX: number;
        minY: number;
        width: number;
        height: number;
    } | null;
};

type PngImportTileMatch = {
    bestCandidate: PngImportCandidate;
    bestScore: number;
    sourceSignature: PngImportSampleSignature;
    inferredTranslation: SpriteTranslation;
    column: number;
    row: number;
};

type PngImportDraft = {
    blocks: Array<MapBlock | null>;
    columns: number;
    rows: number;
    worldX: number;
    worldY: number;
    worldWidth: number;
    worldHeight: number;
    uncertainTiles: number;
    lowConfidenceTileIndexes: number[];
    sourceGridOffsetX: number;
    sourceGridOffsetY: number;
};

type PngImportProgress = {
    phase: string;
    completed: number;
    total: number;
    detail: string;
};

type PngImportSourceMode = 'single' | 'folder';
type PngImportWorkTab = 'import' | 'export';

type PngChunkEntry = {
    fileName: string;
    chunkColumn: number;
    chunkRow: number;
    sourceTileX: number;
    sourceTileY: number;
    tileWidth: number;
    tileHeight: number;
    pixelX: number;
    pixelY: number;
    pixelWidth: number;
    pixelHeight: number;
};

type PngChunkManifest = {
    version: 1;
    sourceName: string;
    tileSize: number;
    crop: {
        x: number;
        y: number;
        width: number;
        height: number;
    };
    chunkTileWidth: number;
    chunkTileHeight: number;
    totalSourceColumns: number;
    totalSourceRows: number;
    totalChunkColumns: number;
    totalChunkRows: number;
    chunks: PngChunkEntry[];
};

type PngChunkFolderSelection = {
    directoryName: string;
    manifest: PngChunkManifest;
    files: Map<string, File>;
    emptyChunkFileNames: Set<string>;
};

type PngChunkSelectionRange = {
    minChunkColumn: number;
    maxChunkColumn: number;
    minChunkRow: number;
    maxChunkRow: number;
    maxChunks: number;
};

type PngChunkComposedSource = {
    image: HTMLImageElement;
    manifest: PngChunkManifest;
    selectedChunks: PngChunkEntry[];
    chunkCount: number;
    totalSelectedChunks: number;
    sourceWidth: number;
    sourceHeight: number;
    columns: number;
    rows: number;
    activeTileIndexes: Set<number>;
};

type BrowserFileSystemWriteChunk =
    | Blob
    | BufferSource
    | string
    | { type: 'write'; position?: number; data: Blob | BufferSource | string }
    | { type: 'seek'; position: number }
    | { type: 'truncate'; size: number };

interface BrowserWritableFileStream {
    write(data: BrowserFileSystemWriteChunk): Promise<void>;
    close(): Promise<void>;
}

interface BrowserFileHandle {
    kind: 'file';
    name: string;
    getFile(): Promise<File>;
    createWritable(): Promise<BrowserWritableFileStream>;
}

interface BrowserDirectoryHandle {
    kind: 'directory';
    name: string;
    getFileHandle(name: string, options?: { create?: boolean }): Promise<BrowserFileHandle>;
    values(): AsyncIterable<BrowserFileHandle | BrowserDirectoryHandle>;
}

interface BrowserWindowWithDirectoryPicker extends Window {
    showDirectoryPicker?: () => Promise<BrowserDirectoryHandle>;
}

type Rect = {
    left: number;
    top: number;
    right: number;
    bottom: number;
    width: number;
    height: number;
};

type ObjectSnapGuide = {
    axis: 'x' | 'y';
    mode: 'dock' | 'align';
    targetRect: Rect;
    line: {
        start: Position;
        end: Position;
    };
};

type ObjectSnapMode = 'none' | 'dock' | 'align' | 'both';

type ObjectSnapMatch = {
    axis: 'x' | 'y';
    mode: 'dock' | 'align';
    delta: number;
    distance: number;
    alignmentGap: number;
    guide: ObjectSnapGuide;
};

type ObjectSnapResolution = {
    x: ObjectSnapMatch | null;
    y: ObjectSnapMatch | null;
    guides: ObjectSnapGuide[];
};

type DesignerSectionId =
    | 'overview'
    | 'mode-placement'
    | 'mode-and-sprite'
    | 'placement-actions'
    | 'selection'
    | 'preview-toggles'
    | 'keyboard-shortcuts'
    | 'palette-remaps';

type PersistedDesignerUiState = {
    active: boolean;
    mode: DesignerMode;
    tool: DesignerTool;
    category: DesignerCategory;
    rotation: number;
    translation: SpriteTranslation;
    palette: number;
    typeByCategory: Record<DesignerCategory, string>;
    snapToGrid: boolean;
    objectSnapEnabled: boolean;
    snapOffsetX: number;
    snapOffsetY: number;
    nudgeAmount: number;
    showCollisionOverlay: boolean;
    showCreatureOverlays: boolean;
    disableCollisionInPreview: boolean;
    layerVisibility: LayerVisibility;
    camera: Position;
    viewportWidth?: number;
    viewportHeight?: number;
    hasOpenedOnce: boolean;
    spritePickerOpen: boolean;
    spritePickerFilter: string;
    spritePickerCategoryFilter: SpritePickerCategoryFilter;
    magnifierEnabled: boolean;
    viewportExpanded: boolean;
    soundEnabled: boolean;
    bulletImpactAudioSettings?: BulletImpactAudioSettings;
    paletteDesignerOpen: boolean;
    selectedPaletteIndex: number;
    palettePreviewType: string;
    buttonDefaults?: ButtonDefaultOverrides;
    customSpriteDefinitions?: CustomSpriteDefinition[];
    customSpriteInstances?: CustomSpriteInstance[];
    sectionOpenState?: Partial<Record<DesignerSectionId, boolean>>;
};

type ButtonDefaultOverrides = {
    capPalette?: number | null;
    boxPalette?: number | null;
    capClosedOffsetX?: number | null;
    capClosedOffsetY?: number | null;
    capOpenOffsetX?: number | null;
    capOpenOffsetY?: number | null;
};

type ContextMenuState = {
    screen: Position | null;
    world: Position | null;
    primarySelection: Selection | null;
};

type TeleporterDestinationPickState = {
    teleporterId: string;
    slot: 'a' | 'b';
};

type DesignerState = {
    active: boolean;
    mode: DesignerMode;
    tool: DesignerTool;
    category: DesignerCategory;
    rotation: number;
    translation: SpriteTranslation;
    palette: number;
    typeByCategory: Record<DesignerCategory, string>;
    snapToGrid: boolean;
    objectSnapEnabled: boolean;
    snapOffsetX: number;
    snapOffsetY: number;
    nudgeAmount: number;
    showCollisionOverlay: boolean;
    showCreatureOverlays: boolean;
    disableCollisionInPreview: boolean;
    layerVisibility: LayerVisibility;
    camera: Position;
    dirty: boolean;
    status: string;
    statusTone: 'neutral' | 'success' | 'error';
    selection: Selection | null;
    selectedItems: Selection[];
    dragging: boolean;
    dragItems: DragItem[];
    dragAnchorWorld: Position | null;
    objectSnapGuides: ObjectSnapGuide[];
    activeObjectSnapMode: ObjectSnapMode;
    lastPointerCanvas: Position | null;
    dragStartSnapshot: DesignerSnapshot | null;
    panningView: boolean;
    pendingRightPan: boolean;
    panStartCanvas: Position | null;
    panStartCamera: Position | null;
    marqueeSelecting: boolean;
    marqueeStartWorld: Position | null;
    marqueeCurrentWorld: Position | null;
    marqueeAdditive: boolean;
    overviewDragging: boolean;
    overviewHoverWorld: Position | null;
    hasOpenedOnce: boolean;
    spritePickerOpen: boolean;
    spritePickerFilter: string;
    spritePickerCategoryFilter: SpritePickerCategoryFilter;
    magnifierEnabled: boolean;
    pickerDrag: PickerDrag | null;
    pickerDragCanvas: Position | null;
    savePreviewOpen: boolean;
    viewportExpanded: boolean;
    paletteDesignerOpen: boolean;
    selectedPaletteIndex: number;
    palettePreviewType: string;
    buttonDefaults: ButtonDefaultOverrides;
    paletteDefinitions: PaletteDefinition[];
    lastSavedPaletteDefinitions: PaletteDefinition[];
    customSpriteDefinitions: CustomSpriteDefinition[];
    customSpriteInstances: CustomSpriteInstance[];
    sectionOpenState: Partial<Record<DesignerSectionId, boolean>>;
    contextMenu: ContextMenuState;
    teleporterDestinationPick: TeleporterDestinationPickState | null;
    suppressContextMenuOnce: boolean;
    undoStack: DesignerSnapshot[];
    redoStack: DesignerSnapshot[];
    editModeSnapshot: DesignerSnapshot;
    liveResumeSnapshot: LiveResumeSnapshot | null;
    lastSavedSnapshot: RawWorldData;
};

type ControlRefs = {
    root: HTMLDivElement;
    modeSelect: HTMLSelectElement;
    toolSelect: HTMLSelectElement;
    categorySelect: HTMLSelectElement;
    typeSelect: HTMLSelectElement;
    spritePreviewCanvas: HTMLCanvasElement;
    spritePreviewMeta: HTMLDivElement;
    spritePicker: HTMLDetailsElement;
    spritePickerFilter: HTMLInputElement;
    spritePickerCategoryFilter: HTMLSelectElement;
    spritePickerGrid: HTMLDivElement;
    rotationSelect: HTMLSelectElement;
    translationSelect: HTMLSelectElement;
    paletteSelect: HTMLSelectElement;
    snapCheckbox: HTMLInputElement;
    objectSnapCheckbox: HTMLInputElement;
    snapOffsetXInput: HTMLInputElement;
    snapOffsetYInput: HTMLInputElement;
    snapOffsetCaptureButton: HTMLButtonElement;
    nudgeInput: HTMLInputElement;
    status: HTMLDivElement;
    selectionSummary: HTMLDivElement;
    inspector: HTMLDivElement;
    overviewCanvas: HTMLCanvasElement;
    activeToggle: HTMLButtonElement;
    paletteDesignerToggle: HTMLButtonElement;
    pngImportButton: HTMLButtonElement;
    savePreviewButton: HTMLButtonElement;
    normalizeSpriteSheetButton: HTMLButtonElement;
    deleteButton: HTMLButtonElement;
    duplicateButton: HTMLButtonElement;
    sendToBackButton: HTMLButtonElement;
    bringToFrontButton: HTMLButtonElement;
    focusButton: HTMLButtonElement;
    convertTargetSelect: HTMLSelectElement;
    convertButton: HTMLButtonElement;
    focusAstronautButton: HTMLButtonElement;
    moveAstronautButton: HTMLButtonElement;
    expandViewportCheckbox: HTMLInputElement;
    soundEnabledCheckbox: HTMLInputElement;
    bulletImpactPrimarySelect: HTMLSelectElement;
    bulletImpactAlternateSelect: HTMLSelectElement;
    bulletImpactAlternateChanceInput: HTMLInputElement;
    bulletImpactVolumeInput: HTMLInputElement;
    addAtCenterButton: HTMLButtonElement;
    setAstronautStartButton: HTMLButtonElement;
    showCollisionCheckbox: HTMLInputElement;
    showCreatureOverlaysCheckbox: HTMLInputElement;
    showSpriteOutlineCheckbox: HTMLInputElement;
    magnifierCheckbox: HTMLInputElement;
    disablePreviewCollisionCheckbox: HTMLInputElement;
    layerCheckboxes: Record<DesignerCategory, HTMLInputElement>;
    modal: HTMLDivElement;
    modalTitle: HTMLHeadingElement;
    modalBody: HTMLDivElement;
    modalClose: HTMLButtonElement;
    modalConfirm: HTMLButtonElement;
    contextMenu: HTMLDivElement;
    contextMenuBody: HTMLDivElement;
    paletteFlyout: HTMLDivElement;
    paletteFlyoutClose: HTMLButtonElement;
    paletteList: HTMLSelectElement;
    paletteUsage: HTMLDivElement;
    palettePreviewCanvas: HTMLCanvasElement;
    palettePreviewTypeSelect: HTMLSelectElement;
    paletteMappings: HTMLDivElement;
    paletteNewButton: HTMLButtonElement;
    paletteCloneButton: HTMLButtonElement;
    paletteDeleteButton: HTMLButtonElement;
    paletteAddMappingButton: HTMLButtonElement;
    paletteSaveButton: HTMLButtonElement;
};

const HISTORY_LIMIT = 100;
const TILE_SIZE = 32 * SPRITE_SCALE;
const DESIGNER_STATE_STORAGE_KEY = 'exile.world-designer-state.v1';
const PNG_IMPORT_DEFAULT_URL = './src/assets/MAP-Exile-BC.png';
const PNG_IMPORT_SOURCE_TILE_SIZE = 32;
const PNG_IMPORT_SAMPLE_SIZE = 32;
const PNG_IMPORT_WARNING_SCORE = 58;
const PNG_IMPORT_PALETTE_SCORE_WEIGHT = 0.2;
const PNG_IMPORT_MAX_TILES = 4096;
const PNG_CHUNK_EXPORT_MANIFEST_NAME = 'png-import-chunks.manifest.json';
const PNG_CHUNK_DEFAULT_TILE_WIDTH = 16;
const PNG_CHUNK_DEFAULT_TILE_HEIGHT = 16;
const PNG_IMPORT_PREVIEW_MAX_DIMENSION = 960;
const PNG_IMPORT_PREVIEW_MIN_TILE_SIZE = 18;
const PNG_IMPORT_PREVIEW_MAX_TILE_SIZE = 48;
const pngImportImageCache = new Map<string, Promise<HTMLImageElement>>();
const MAGNIFIER_SIZE = 160;
const MAGNIFIER_ZOOM = 6;
const MAGNIFIER_CURSOR_OFFSET = 26;
const OBJECT_SNAP_THRESHOLD = 20;
const OBJECT_SNAP_ALIGNMENT_THRESHOLD = 24;
const BUTTON_DEFAULT_PRESS_OFFSET = 3;
const BUTTON_DEFAULT_BOX_OFFSET_X = 12;
const BUTTON_DEFAULT_BOX_OFFSET_Y = 0;
const TELEPORTER_COMPOSITE_TYPE = '__teleporter_composite__';
const BUTTON_COMPOSITE_TYPE = '__button_composite__';
const visibleSpriteRectCache = new Map<string, { left: number; top: number; width: number; height: number } | null>();
const CATEGORY_LABELS: Record<DesignerCategory, string> = {
    world: 'World items',
    buttons: 'Buttons',
    doors: 'Doors',
    creatures: 'Creatures',
    collectables: 'Collectables',
    custom: 'Custom sprites'
};
let customSpriteDefinitionResolver: ((instance: CustomSpriteInstance) => CustomSpriteDefinition | null) | null = null;
let visibleSpriteRectResolver: ((
    type: string,
    palette: number,
    rotation: number,
    translation?: SpriteTranslation
) => { left: number; top: number; width: number; height: number } | null) | null = null;

const SAVE_FILE_LABELS: Record<keyof RawWorldData, string> = {
    worldMap: 'world_chunks/manifest.json (+ chunk files)',
    buttons: 'buttons.json',
    doors: 'doors.json',
    creatures: 'creatures.json',
    collectables: 'collectables.json',
    teleporters: 'teleporters.json',
    astronautStart: 'astronaut_start.json'
};
const PALETTE_FILE_LABEL = 'palettes.json';

type PlacementTypeOption = {
    value: string;
    label: string;
    previewType?: string;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function normalizeRotation(rotation?: number) {
    if (typeof rotation !== 'number' || Number.isNaN(rotation)) {
        return 1;
    }
    return clamp(Math.round(rotation), 1, 9);
}

function formatSpriteTranslation(translation?: string | null) {
    const normalized = normalizeSpriteTranslation(translation);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function categorySupportsTranslation(category: DesignerCategory) {
    return category === 'world' || category === 'creatures';
}

function toMapBlockData(block: MapBlock): MapBlock {
    const hasDestructibleMetadata = typeof block.destructible === 'boolean'
        || typeof block.destructionHealth === 'number'
        || typeof block.destructionSource === 'string';
    return {
        x: block.x,
        y: block.y,
        type: block.type,
        collision: block.collision !== false,
        maskAstronaut: shouldMaskAstronaut(block),
        palette: typeof block.palette === 'number' ? block.palette : 0,
        rotation: normalizeRotation(block.rotation) as MapBlock['rotation'],
        translation: normalizeSpriteTranslation(block.translation),
        ...(typeof block.teleporterId === 'string' && block.teleporterId.trim().length > 0
            ? { teleporterId: block.teleporterId.trim() }
            : {}),
        ...(typeof block.teleporterEnabled === 'boolean'
            ? { teleporterEnabled: block.teleporterEnabled }
            : {}),
        ...(typeof block.teleporterRequiresKey === 'boolean'
            ? { teleporterRequiresKey: block.teleporterRequiresKey }
            : {}),
        ...(block.teleporterDestinationA
            ? {
                teleporterDestinationA: {
                    x: Math.round(Number(block.teleporterDestinationA.x) || 0),
                    y: Math.round(Number(block.teleporterDestinationA.y) || 0)
                }
            }
            : {}),
        ...(block.teleporterDestinationB
            ? {
                teleporterDestinationB: {
                    x: Math.round(Number(block.teleporterDestinationB.x) || 0),
                    y: Math.round(Number(block.teleporterDestinationB.y) || 0)
                }
            }
            : {}),
        ...(typeof block.teleporterActiveDestinationIndex === 'number'
            ? { teleporterActiveDestinationIndex: block.teleporterActiveDestinationIndex === 1 ? 1 : 0 }
            : {}),
        ...(hasDestructibleMetadata
            ? {
                destructible: typeof block.destructible === 'boolean'
                    ? block.destructible
                    : getDefaultDestructibleEnabled('world', block.type),
                destructionHealth: typeof block.destructionHealth === 'number'
                    ? Math.max(0.1, block.destructionHealth)
                    : getDefaultDestructibleHealth('world', block.type),
                destructionSource: typeof block.destructionSource === 'string'
                    ? block.destructionSource
                    : getDefaultDestructionSource('world', block.type)
            }
            : {}),
        ...(block.paletteCycle ? { paletteCycle: deepClone(block.paletteCycle) } : {})
    };
}

function toButtonData(button: any): ButtonSaveData {
    const normalizedBoxOffsetX = [8, 4, -8, -12].includes(button.boxOffsetX)
        ? 12
        : (button.boxOffsetX ?? 12);
    const capClosedOffsetX = button.capClosedOffsetX ?? 0;
    const capClosedOffsetY = button.capClosedOffsetY ?? 0;
    const capOpenOffsetX = button.capOpenOffsetX ?? (button.pressOffset ?? 2);
    const capOpenOffsetY = button.capOpenOffsetY ?? 0;
    return {
        x: button.x,
        y: button.y,
        type: button.type,
        palette: button.palette ?? 0,
        boxType: button.boxType,
        boxPalette: button.boxPalette ?? 0,
        rotation: normalizeRotation(button.rotation),
        active: button.defaultActive ?? button.active ?? false,
        linkedDoors: Array.isArray(button.linkedDoors) ? [...button.linkedDoors] : [],
        linkedTeleporters: Array.isArray(button.linkedTeleporters)
            ? button.linkedTeleporters.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
            : [],
        teleporterMode: isTeleporterMode(button.teleporterMode)
            ? button.teleporterMode
            : 'toggle',
        collision: button.collision !== false,
        pressOffset: capOpenOffsetX - capClosedOffsetX,
        boxOffsetX: normalizedBoxOffsetX,
        boxOffsetY: button.boxOffsetY ?? 0,
        capClosedOffsetX,
        capClosedOffsetY,
        capOpenOffsetX,
        capOpenOffsetY,
        ...(button.paletteCycle ? { paletteCycle: deepClone(button.paletteCycle) } : {})
    };
}

function toTeleporterData(teleporter: any): TeleporterSaveData {
    const activeDestinationIndex = teleporter.activeDestinationIndex === 1 ? 1 : 0;
    return {
        id: typeof teleporter.id === 'string' && teleporter.id.trim().length > 0
            ? teleporter.id.trim()
            : `teleporter_${Math.round(Number(teleporter.padX) || 0)}_${Math.round(Number(teleporter.padY) || 0)}`,
        baseX: Math.round(Number(teleporter.baseX) || 0),
        baseY: Math.round(Number(teleporter.baseY) || 0),
        padX: Math.round(Number(teleporter.padX) || 0),
        padY: Math.round(Number(teleporter.padY) || 0),
        enabled: teleporter.enabled !== false,
        requiresKey: teleporter.requiresKey === true,
        destinationA: {
            x: Math.round(Number(teleporter.destinationA?.x) || 0),
            y: Math.round(Number(teleporter.destinationA?.y) || 0)
        },
        destinationB: teleporter.destinationB
            ? {
                x: Math.round(Number(teleporter.destinationB.x) || 0),
                y: Math.round(Number(teleporter.destinationB.y) || 0)
            }
            : null,
        activeDestinationIndex
    };
}

function toDoorData(door: any): DoorSaveData {
    return {
        x: door.x,
        y: door.y,
        z: door.z ?? 0,
        type: door.type,
        palette: door.palette ?? 0,
        rotation: normalizeRotation(door.rotation),
        name: door.name ?? '',
        doorID: door.doorID ?? -1,
        locked: door.defaultLocked ?? door.locked ?? false,
        open: door.defaultOpen ?? door.open ?? false,
        palette_locked: typeof door.palette_locked === 'number' ? door.palette_locked : null,
        palette_unlocked: typeof door.palette_unlocked === 'number' ? door.palette_unlocked : null,
        collision: door.collision !== false,
        destructible: typeof door.destructible === 'boolean'
            ? door.destructible
            : getDefaultDestructibleEnabled('doors', door.type),
        destructionHealth: typeof door.destructionHealth === 'number'
            ? Math.max(0.1, door.destructionHealth)
            : getDefaultDestructibleHealth('doors', door.type),
        destructionSource: typeof door.destructionSource === 'string'
            ? door.destructionSource
            : getDefaultDestructionSource('doors', door.type),
        ...(door.paletteCycle ? { paletteCycle: deepClone(door.paletteCycle) } : {})
    };
}

function toCreatureData(creature: any): CreatureSaveData {
    return toCreatureSaveData({
        ...creature,
        rotation: normalizeRotation(creature.rotation)
    });
}

function toCollectableData(collectable: any): CollectableSaveData {
    const grenadeDefaults = isGrenadeCollectableType(collectable.type)
        ? {
            armed: collectable.armed === true,
            explosionPower: typeof collectable.explosionPower === 'number'
                ? collectable.explosionPower
                : getDefaultGrenadeExplosionPower(collectable.type),
            ...(typeof collectable.explosionRadius === 'number'
                ? { explosionRadius: Math.max(1, collectable.explosionRadius) }
                : {})
        }
        : {};
    return {
        x: collectable.x,
        y: collectable.y,
        type: collectable.type,
        palette: collectable.palette ?? 0,
        rotation: normalizeRotation(collectable.defaultRotation ?? collectable.rotation),
        collected: collectable.collected ?? false,
        name: collectable.name ?? '',
        weight: typeof collectable.weight === 'number' ? collectable.weight : 0,
        pickupEnabled: collectable.pickupEnabled ?? true,
        storable: collectable.storable ?? false,
        affectsAstronaut: collectable.affectsAstronaut ?? true,
        collision: collectable.collision !== false,
        held: collectable.held ?? false,
        stored: collectable.stored ?? false,
        isGrounded: collectable.isGrounded ?? false,
        velocity: deepClone(collectable.velocity ?? { x: 0, y: 0 }),
        astronautCollisionIgnoreFrames: collectable.astronautCollisionIgnoreFrames ?? 0,
        ...(collectable.radioactive ? { radioactive: true } : {}),
        ...(collectable.paletteCycle ? { paletteCycle: deepClone(collectable.paletteCycle) } : {}),
        ...grenadeDefaults
    };
}

function compareNumbers(left: number, right: number) {
    return left - right;
}

function compareStrings(left: string, right: string) {
    return left.localeCompare(right);
}

function serializeWorldData(data: RawWorldData): RawWorldData {
    const worldMap = data.worldMap
        .map((block) => toMapBlockData(block))
        .sort((left, right) =>
            compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
            || compareStrings(String(left.palette ?? ''), String(right.palette ?? ''))
            || compareNumbers(left.rotation ?? 0, right.rotation ?? 0)
        );
    const buttons = data.buttons
        .map((button) => toButtonData(button))
        .sort((left, right) =>
            compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
            || compareNumbers(left.palette ?? 0, right.palette ?? 0)
        );
    const doors = data.doors
        .map((door) => toDoorData(door))
        .sort((left, right) =>
            compareNumbers(left.doorID ?? -1, right.doorID ?? -1)
            || compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
        );
    const creatures = data.creatures
        .map((creature) => toCreatureData(creature))
        .sort((left, right) =>
            compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
            || compareNumbers(left.palette ?? 0, right.palette ?? 0)
            || compareNumbers(left.rotation ?? 0, right.rotation ?? 0)
        );
    const collectables = data.collectables
        .filter((collectable) => !('creatureProjectile' in collectable) || !collectable.creatureProjectile)
        .map((collectable) => toCollectableData(collectable))
        .sort((left, right) =>
            compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
            || compareNumbers(left.palette ?? 0, right.palette ?? 0)
            || compareNumbers(left.rotation ?? 0, right.rotation ?? 0)
        );
    const teleporters = (data.teleporters ?? [])
        .map((teleporter) => toTeleporterData(teleporter))
        .sort((left, right) =>
            compareStrings(left.id, right.id)
            || compareNumbers(left.baseY, right.baseY)
            || compareNumbers(left.baseX, right.baseX)
        );

    return {
        worldMap,
        buttons,
        doors,
        creatures,
        collectables,
        teleporters,
        astronautStart: {
            x: Math.round(data.astronautStart.x),
            y: Math.round(data.astronautStart.y)
        }
    };
}

function stableStringify(value: unknown) {
    return JSON.stringify(value, null, 2);
}

function snapshotsEqual(left: RawWorldData, right: RawWorldData) {
    return stableStringify(left) === stableStringify(right);
}

function designerSnapshotsEqual(left: DesignerSnapshot, right: DesignerSnapshot) {
    return stableStringify(left) === stableStringify(right);
}

function getDefaultType(spriteTypes: string[], category: RuntimeDesignerCategory) {
    const preferred = {
        world: ['floor_full', 'floor_grass', 'wall_full', 'ship_1'],
        buttons: ['button', 'button_box'],
        doors: ['door_horizontal', 'door_vertical'],
        creatures: ['bird2', 'monkey1', 'robot1'],
        collectables: ['crystal', 'rcd', 'boulder']
    }[category];

    for (const type of preferred) {
        if (spriteTypes.includes(type)) {
            return type;
        }
    }

    return spriteTypes[0] ?? 'floor_full';
}

function isDoorSpriteType(type: string): type is 'door_horizontal' | 'door_vertical' {
    return type === 'door_horizontal' || type === 'door_vertical';
}

function isTeleporterMode(value: unknown): value is TeleporterDestinationMode {
    return value === 'toggle' ||
        value === 'destination_a' ||
        value === 'destination_b' ||
        value === 'toggle_enabled' ||
        value === 'enable' ||
        value === 'disable';
}

function getDoorTypeFromSourceType(type: string): 'door_horizontal' | 'door_vertical' | null {
    if (isDoorSpriteType(type)) {
        return type;
    }
    if (type === 'wall_left_quarter') {
        return 'door_vertical';
    }
    return null;
}

function buildLayerVisibility(): LayerVisibility {
    return {
        world: true,
        buttons: true,
        doors: true,
        creatures: true,
        collectables: true,
        custom: true
    };
}

function getRectAtPosition(x: number, y: number, category: DesignerCategory): Rect {
    const width = category === 'buttons'
        ? TILE_SIZE + 14
        : TILE_SIZE;
    const height = TILE_SIZE;
    return {
        left: x,
        top: y,
        right: x + width,
        bottom: y + height,
        width,
        height
    };
}

function getVisibleSpriteRect(
    type: string,
    palette: number,
    rotation: number,
    translation: SpriteTranslation = 'center'
) {
    if (!visibleSpriteRectResolver) {
        return null;
    }
    const cacheKey = `${type}|${palette}|${rotation}|${translation}`;
    if (visibleSpriteRectCache.has(cacheKey)) {
        return visibleSpriteRectCache.get(cacheKey) ?? null;
    }

    const rect = visibleSpriteRectResolver(type, palette, rotation, translation);
    visibleSpriteRectCache.set(cacheKey, rect);
    return rect;
}

function invertButtonOffset(offsetX: number, offsetY: number, rotation: number) {
    if (rotation >= 1 && rotation <= 4) {
        const angle = -((rotation - 1) * Math.PI) / 2;
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return {
            x: Math.round(offsetX * cos - offsetY * sin),
            y: Math.round(offsetX * sin + offsetY * cos)
        };
    }

    if (rotation === 5) {
        return { x: -offsetX, y: offsetY };
    }
    if (rotation === 6) {
        return { x: offsetX, y: -offsetY };
    }
    if (rotation === 7) {
        return { x: -offsetX, y: -offsetY };
    }
    if (rotation === 8) {
        return { x: -offsetY, y: -offsetX };
    }
    if (rotation === 9) {
        return { x: offsetY, y: offsetX };
    }

    return { x: offsetX, y: offsetY };
}

function getEntityRect(entity: any, category: DesignerCategory) {
    if (category === 'buttons' && entity instanceof Button) {
        const partRects = entity.getRenderParts().map((part) => ({
            left: part.x,
            top: part.y,
            right: part.x + ((part.cropLeftHalf || part.cropRightHalf) ? TILE_SIZE / 2 : TILE_SIZE),
            bottom: part.y + TILE_SIZE
        }));
        const left = Math.min(...partRects.map((rect) => rect.left));
        const top = Math.min(...partRects.map((rect) => rect.top));
        const right = Math.max(...partRects.map((rect) => rect.right));
        const bottom = Math.max(...partRects.map((rect) => rect.bottom));
        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top
        };
    }
    if (category === 'custom') {
        const instance = entity as CustomSpriteInstance;
        const definition = customSpriteDefinitionResolver?.(instance) ?? null;
        if (!definition || definition.members.length === 0) {
            return getRectAtPosition(instance.x, instance.y, 'world');
        }
        const partRects = definition.members.map((member) => {
            const absoluteX = instance.x + member.offsetX;
            const absoluteY = instance.y + member.offsetY;
            if (member.category === 'buttons') {
                const button = new Button({
                    ...(deepClone(member.data) as ButtonSaveData),
                    x: absoluteX,
                    y: absoluteY
                });
                return getEntityRect(button, 'buttons');
            }
            return getRectAtPosition(absoluteX, absoluteY, member.category);
        });
        const left = Math.min(...partRects.map((rect) => rect.left));
        const top = Math.min(...partRects.map((rect) => rect.top));
        const right = Math.max(...partRects.map((rect) => rect.right));
        const bottom = Math.max(...partRects.map((rect) => rect.bottom));
        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top
        };
    }
    if (category === 'collectables' && typeof entity.type === 'string') {
        const visibleRect = getVisibleSpriteRect(
            entity.type,
            typeof entity.palette === 'number' ? entity.palette : 0,
            normalizeRotation('defaultRotation' in entity ? entity.defaultRotation ?? entity.rotation : entity.rotation),
            'center'
        );
        if (visibleRect) {
            const left = entity.x + visibleRect.left;
            const top = entity.y + visibleRect.top;
            const right = left + visibleRect.width;
            const bottom = top + visibleRect.height;
            return {
                left,
                top,
                right,
                bottom,
                width: right - left,
                height: bottom - top
            };
        }
    }
    return getRectAtPosition(entity.x, entity.y, category);
}

function normalizeRect(start: Position, end: Position): Rect {
    const left = Math.min(start.x, end.x);
    const top = Math.min(start.y, end.y);
    const right = Math.max(start.x, end.x);
    const bottom = Math.max(start.y, end.y);
    return {
        left,
        top,
        right,
        bottom,
        width: right - left,
        height: bottom - top
    };
}

function rectsIntersect(
    left: { left: number; top: number; right: number; bottom: number },
    right: { left: number; top: number; right: number; bottom: number }
) {
    return !(
        left.right < right.left ||
        left.left > right.right ||
        left.bottom < right.top ||
        left.top > right.bottom
    );
}

function applyPosition(entity: any, x: number, y: number) {
    entity.x = Math.round(x);
    entity.y = Math.round(y);
}

function snapCoordinate(value: number) {
    return Math.round(value / 32) * 32;
}

function getPngImportSourceTileCount(size: number) {
    return Math.max(1, Math.round(size / PNG_IMPORT_SOURCE_TILE_SIZE));
}

function getSuggestedPngImportWorldSpan(sourceSize: number) {
    return Math.max(1, Math.round(getPngImportSourceTileCount(sourceSize) * TILE_SIZE));
}

function getPngImportWorldSpanFromTileCount(tileCount: number) {
    return Math.max(1, Math.round(tileCount * TILE_SIZE));
}

function normalizeSnapOffset(value: number) {
    const rounded = Math.round(value);
    return ((rounded % 32) + 32) % 32;
}

function snapCoordinateToOffset(value: number, offset: number) {
    return Math.round((value - offset) / 32) * 32 + offset;
}

function getRangeGap(startA: number, endA: number, startB: number, endB: number) {
    if (endA < startB) {
        return startB - endA;
    }
    if (endB < startA) {
        return startA - endB;
    }
    return 0;
}

function getGuideSpan(startA: number, endA: number, startB: number, endB: number) {
    const start = Math.max(startA, startB);
    const end = Math.min(endA, endB);
    if (end >= start) {
        return { start, end };
    }
    const midpoint = (Math.max(startA, startB) + Math.min(endA, endB)) / 2;
    return { start: midpoint, end: midpoint };
}

function parseDoorIds(value: string) {
    return value
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isFinite(entry));
}

function parseStringIds(value: string) {
    return [...new Set(
        value
            .split(',')
            .map((entry) => entry.trim())
            .filter((entry) => entry.length > 0)
    )];
}

function yieldToUi() {
    return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

function padInteger(value: number, minimumDigits: number) {
    return Math.max(0, Math.round(value)).toString().padStart(minimumDigits, '0');
}

function getChunkBaseName(sourceName: string) {
    const withoutExtension = sourceName.replace(/\.[^.]+$/, '');
    const normalized = withoutExtension
        .trim()
        .replace(/[^a-z0-9]+/gi, '-')
        .replace(/^-+|-+$/g, '')
        .toLowerCase();
    return normalized || 'png-import';
}

function buildPngChunkFileName(sourceName: string, entry: PngChunkEntry) {
    const baseName = getChunkBaseName(sourceName);
    return `${baseName}__r${padInteger(entry.chunkRow, 4)}__c${padInteger(entry.chunkColumn, 4)}__tx${padInteger(entry.sourceTileX, 5)}__ty${padInteger(entry.sourceTileY, 5)}__w${padInteger(entry.tileWidth, 4)}__h${padInteger(entry.tileHeight, 4)}.png`;
}

function parsePngChunkFileName(fileName: string): PngChunkEntry | null {
    const match = /__r(\d+)__c(\d+)__tx(\d+)__ty(\d+)__w(\d+)__h(\d+)\.png$/i.exec(fileName);
    if (!match) {
        return null;
    }
    const chunkRow = Number(match[1]);
    const chunkColumn = Number(match[2]);
    const sourceTileX = Number(match[3]);
    const sourceTileY = Number(match[4]);
    const tileWidth = Number(match[5]);
    const tileHeight = Number(match[6]);
    if (
        !Number.isFinite(chunkRow) ||
        !Number.isFinite(chunkColumn) ||
        !Number.isFinite(sourceTileX) ||
        !Number.isFinite(sourceTileY) ||
        !Number.isFinite(tileWidth) ||
        !Number.isFinite(tileHeight) ||
        tileWidth <= 0 ||
        tileHeight <= 0
    ) {
        return null;
    }
    return {
        fileName,
        chunkColumn: Math.round(chunkColumn),
        chunkRow: Math.round(chunkRow),
        sourceTileX: Math.round(sourceTileX),
        sourceTileY: Math.round(sourceTileY),
        tileWidth: Math.round(tileWidth),
        tileHeight: Math.round(tileHeight),
        pixelX: Math.round(sourceTileX) * PNG_IMPORT_SOURCE_TILE_SIZE,
        pixelY: Math.round(sourceTileY) * PNG_IMPORT_SOURCE_TILE_SIZE,
        pixelWidth: Math.round(tileWidth) * PNG_IMPORT_SOURCE_TILE_SIZE,
        pixelHeight: Math.round(tileHeight) * PNG_IMPORT_SOURCE_TILE_SIZE
    };
}

function getDirectoryPicker() {
    const picker = (window as BrowserWindowWithDirectoryPicker).showDirectoryPicker;
    if (!picker) {
        throw new Error('This browser does not support choosing a folder. Use a Chromium-based browser with the File System Access API enabled.');
    }
    return picker.bind(window as BrowserWindowWithDirectoryPicker);
}

function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png') {
    return new Promise<Blob>((resolve, reject) => {
        canvas.toBlob((blob) => {
            if (blob) {
                resolve(blob);
                return;
            }
            reject(new Error('Could not create a PNG blob from the chunk canvas.'));
        }, type);
    });
}

async function writeBlobToDirectory(directoryHandle: BrowserDirectoryHandle, fileName: string, blob: Blob) {
    const fileHandle = await directoryHandle.getFileHandle(fileName, { create: true });
    const writable = await fileHandle.createWritable();
    await writable.write(blob);
    await writable.close();
}

async function writeTextToDirectory(directoryHandle: BrowserDirectoryHandle, fileName: string, text: string) {
    const blob = new Blob([text], { type: 'application/json' });
    await writeBlobToDirectory(directoryHandle, fileName, blob);
}

function isImageDataEmpty(imageData: ImageData) {
    for (let index = 0; index < imageData.data.length; index += 4) {
        const alpha = imageData.data[index + 3];
        if (alpha === 0) {
            continue;
        }
        if (
            imageData.data[index] !== 0 ||
            imageData.data[index + 1] !== 0 ||
            imageData.data[index + 2] !== 0
        ) {
            return false;
        }
    }
    return true;
}

async function loadImageFromBlob(blob: Blob) {
    const url = URL.createObjectURL(blob);
    try {
        const image = new Image();
        image.decoding = 'async';
        await new Promise<void>((resolve, reject) => {
            image.onload = () => resolve();
            image.onerror = () => reject(new Error('Failed to decode an exported PNG chunk.'));
            image.src = url;
        });
        return image;
    } finally {
        URL.revokeObjectURL(url);
    }
}

async function isChunkFileEmpty(file: File) {
    const bitmap = await createImageBitmap(file);
    try {
        const canvas = document.createElement('canvas');
        canvas.width = bitmap.width;
        canvas.height = bitmap.height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            throw new Error('Could not create a canvas context while analyzing chunk PNGs.');
        }
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(bitmap, 0, 0);
        return isImageDataEmpty(ctx.getImageData(0, 0, canvas.width, canvas.height));
    } finally {
        bitmap.close();
    }
}

function normalizePngChunkManifest(raw: unknown): PngChunkManifest {
    if (!raw || typeof raw !== 'object') {
        throw new Error('Chunk manifest is missing or invalid.');
    }
    const manifestRecord = raw as Record<string, unknown>;
    const cropRecord = manifestRecord.crop;
    if (!cropRecord || typeof cropRecord !== 'object') {
        throw new Error('Chunk manifest is missing crop metadata.');
    }
    const crop = cropRecord as Record<string, unknown>;
    const rawChunks = Array.isArray(manifestRecord.chunks) ? manifestRecord.chunks : [];
    const chunks = rawChunks.map((entry, index) => {
        if (!entry || typeof entry !== 'object') {
            throw new Error(`Chunk manifest entry ${index + 1} is invalid.`);
        }
        const record = entry as Record<string, unknown>;
        const chunkEntry: PngChunkEntry = {
            fileName: String(record.fileName ?? ''),
            chunkColumn: Number(record.chunkColumn),
            chunkRow: Number(record.chunkRow),
            sourceTileX: Number(record.sourceTileX),
            sourceTileY: Number(record.sourceTileY),
            tileWidth: Number(record.tileWidth),
            tileHeight: Number(record.tileHeight),
            pixelX: Number(record.pixelX),
            pixelY: Number(record.pixelY),
            pixelWidth: Number(record.pixelWidth),
            pixelHeight: Number(record.pixelHeight)
        };
        if (
            !chunkEntry.fileName ||
            !Number.isFinite(chunkEntry.chunkColumn) ||
            !Number.isFinite(chunkEntry.chunkRow) ||
            !Number.isFinite(chunkEntry.sourceTileX) ||
            !Number.isFinite(chunkEntry.sourceTileY) ||
            !Number.isFinite(chunkEntry.tileWidth) ||
            !Number.isFinite(chunkEntry.tileHeight) ||
            !Number.isFinite(chunkEntry.pixelX) ||
            !Number.isFinite(chunkEntry.pixelY) ||
            !Number.isFinite(chunkEntry.pixelWidth) ||
            !Number.isFinite(chunkEntry.pixelHeight)
        ) {
            throw new Error(`Chunk manifest entry ${index + 1} is incomplete.`);
        }
        return {
            ...chunkEntry,
            chunkColumn: Math.round(chunkEntry.chunkColumn),
            chunkRow: Math.round(chunkEntry.chunkRow),
            sourceTileX: Math.round(chunkEntry.sourceTileX),
            sourceTileY: Math.round(chunkEntry.sourceTileY),
            tileWidth: Math.round(chunkEntry.tileWidth),
            tileHeight: Math.round(chunkEntry.tileHeight),
            pixelX: Math.round(chunkEntry.pixelX),
            pixelY: Math.round(chunkEntry.pixelY),
            pixelWidth: Math.round(chunkEntry.pixelWidth),
            pixelHeight: Math.round(chunkEntry.pixelHeight)
        };
    });
    const manifest: PngChunkManifest = {
        version: 1,
        sourceName: String(manifestRecord.sourceName ?? 'png-import'),
        tileSize: Math.round(Number(manifestRecord.tileSize)),
        crop: {
            x: Math.round(Number(crop.x)),
            y: Math.round(Number(crop.y)),
            width: Math.round(Number(crop.width)),
            height: Math.round(Number(crop.height))
        },
        chunkTileWidth: Math.round(Number(manifestRecord.chunkTileWidth)),
        chunkTileHeight: Math.round(Number(manifestRecord.chunkTileHeight)),
        totalSourceColumns: Math.round(Number(manifestRecord.totalSourceColumns)),
        totalSourceRows: Math.round(Number(manifestRecord.totalSourceRows)),
        totalChunkColumns: Math.round(Number(manifestRecord.totalChunkColumns)),
        totalChunkRows: Math.round(Number(manifestRecord.totalChunkRows)),
        chunks
    };
    if (
        manifest.tileSize !== PNG_IMPORT_SOURCE_TILE_SIZE ||
        manifest.crop.x < 0 ||
        manifest.crop.y < 0 ||
        manifest.crop.width <= 0 ||
        manifest.crop.height <= 0 ||
        manifest.chunkTileWidth <= 0 ||
        manifest.chunkTileHeight <= 0 ||
        manifest.totalSourceColumns <= 0 ||
        manifest.totalSourceRows <= 0 ||
        manifest.totalChunkColumns <= 0 ||
        manifest.totalChunkRows <= 0
    ) {
        throw new Error('Chunk manifest metadata is invalid or unsupported.');
    }
    return manifest;
}

function buildChunkManifestFromFiles(directoryName: string, entries: PngChunkEntry[]) {
    if (entries.length === 0) {
        throw new Error('The selected folder does not contain any chunk PNGs with a supported naming pattern.');
    }
    const minTileX = Math.min(...entries.map((entry) => entry.sourceTileX));
    const minTileY = Math.min(...entries.map((entry) => entry.sourceTileY));
    const maxTileX = Math.max(...entries.map((entry) => entry.sourceTileX + entry.tileWidth));
    const maxTileY = Math.max(...entries.map((entry) => entry.sourceTileY + entry.tileHeight));
    const maxChunkColumn = Math.max(...entries.map((entry) => entry.chunkColumn));
    const maxChunkRow = Math.max(...entries.map((entry) => entry.chunkRow));
    return normalizePngChunkManifest({
        version: 1,
        sourceName: directoryName,
        tileSize: PNG_IMPORT_SOURCE_TILE_SIZE,
        crop: {
            x: minTileX * PNG_IMPORT_SOURCE_TILE_SIZE,
            y: minTileY * PNG_IMPORT_SOURCE_TILE_SIZE,
            width: (maxTileX - minTileX) * PNG_IMPORT_SOURCE_TILE_SIZE,
            height: (maxTileY - minTileY) * PNG_IMPORT_SOURCE_TILE_SIZE
        },
        chunkTileWidth: Math.max(...entries.map((entry) => entry.tileWidth)),
        chunkTileHeight: Math.max(...entries.map((entry) => entry.tileHeight)),
        totalSourceColumns: maxTileX - minTileX,
        totalSourceRows: maxTileY - minTileY,
        totalChunkColumns: maxChunkColumn + 1,
        totalChunkRows: maxChunkRow + 1,
        chunks: entries.map((entry) => ({
            ...entry,
            sourceTileX: entry.sourceTileX,
            sourceTileY: entry.sourceTileY
        }))
    });
}

async function exportPngChunksToDirectory(config: {
    image: HTMLImageElement;
    sourceName: string;
    sourceX: number;
    sourceY: number;
    sourceWidth: number;
    sourceHeight: number;
    chunkTileWidth: number;
    chunkTileHeight: number;
    skipEmpty: boolean;
    shouldCancel?: () => boolean;
}, onProgress?: (progress: PngImportProgress) => void | Promise<void>) {
    if (
        config.sourceX % PNG_IMPORT_SOURCE_TILE_SIZE !== 0 ||
        config.sourceY % PNG_IMPORT_SOURCE_TILE_SIZE !== 0 ||
        config.sourceWidth % PNG_IMPORT_SOURCE_TILE_SIZE !== 0 ||
        config.sourceHeight % PNG_IMPORT_SOURCE_TILE_SIZE !== 0
    ) {
        throw new Error('Chunk export requires a source crop aligned to 32px tile boundaries.');
    }
    const directoryHandle = await getDirectoryPicker()();
    const totalSourceColumns = config.sourceWidth / PNG_IMPORT_SOURCE_TILE_SIZE;
    const totalSourceRows = config.sourceHeight / PNG_IMPORT_SOURCE_TILE_SIZE;
    const totalChunkColumns = Math.ceil(totalSourceColumns / config.chunkTileWidth);
    const totalChunkRows = Math.ceil(totalSourceRows / config.chunkTileHeight);
    const sourceTileOriginX = Math.round(config.sourceX / PNG_IMPORT_SOURCE_TILE_SIZE);
    const sourceTileOriginY = Math.round(config.sourceY / PNG_IMPORT_SOURCE_TILE_SIZE);
    const chunkCanvas = document.createElement('canvas');
    const chunkContext = chunkCanvas.getContext('2d');
    if (!chunkContext) {
        throw new Error('Could not create a canvas context for chunk export.');
    }
    chunkContext.imageSmoothingEnabled = false;

    const chunks: PngChunkEntry[] = [];
    const totalChunkCount = Math.max(1, totalChunkColumns * totalChunkRows);
    let processedChunks = 0;
    let exportedChunks = 0;
    let skippedChunks = 0;
    const progressStep = Math.max(1, Math.floor(totalChunkCount / 40));
    let lastYieldAt = 0;

    for (let chunkRow = 0; chunkRow < totalChunkRows; chunkRow += 1) {
        for (let chunkColumn = 0; chunkColumn < totalChunkColumns; chunkColumn += 1) {
            if (config.shouldCancel?.()) {
                throw new Error('Chunk export cancelled.');
            }
            const sourceTileX = sourceTileOriginX + chunkColumn * config.chunkTileWidth;
            const sourceTileY = sourceTileOriginY + chunkRow * config.chunkTileHeight;
            const tileWidth = Math.min(config.chunkTileWidth, totalSourceColumns - chunkColumn * config.chunkTileWidth);
            const tileHeight = Math.min(config.chunkTileHeight, totalSourceRows - chunkRow * config.chunkTileHeight);
            const pixelX = sourceTileX * PNG_IMPORT_SOURCE_TILE_SIZE;
            const pixelY = sourceTileY * PNG_IMPORT_SOURCE_TILE_SIZE;
            const pixelWidth = tileWidth * PNG_IMPORT_SOURCE_TILE_SIZE;
            const pixelHeight = tileHeight * PNG_IMPORT_SOURCE_TILE_SIZE;
            const entry: PngChunkEntry = {
                fileName: '',
                chunkColumn,
                chunkRow,
                sourceTileX,
                sourceTileY,
                tileWidth,
                tileHeight,
                pixelX,
                pixelY,
                pixelWidth,
                pixelHeight
            };
            entry.fileName = buildPngChunkFileName(config.sourceName, entry);
            if (chunkCanvas.width !== pixelWidth) {
                chunkCanvas.width = pixelWidth;
            }
            if (chunkCanvas.height !== pixelHeight) {
                chunkCanvas.height = pixelHeight;
            }
            chunkContext.imageSmoothingEnabled = false;
            chunkContext.clearRect(0, 0, chunkCanvas.width, chunkCanvas.height);
            chunkContext.drawImage(
                config.image,
                pixelX,
                pixelY,
                pixelWidth,
                pixelHeight,
                0,
                0,
                pixelWidth,
                pixelHeight
            );
            const shouldWrite = !config.skipEmpty || !isImageDataEmpty(
                chunkContext.getImageData(0, 0, pixelWidth, pixelHeight)
            );
            if (shouldWrite) {
                const blob = await canvasToBlob(chunkCanvas);
                await writeBlobToDirectory(directoryHandle, entry.fileName, blob);
                chunks.push(entry);
                exportedChunks += 1;
            } else {
                skippedChunks += 1;
            }
            processedChunks += 1;
            const shouldReportProgress = processedChunks === totalChunkCount ||
                processedChunks - lastYieldAt >= progressStep;
            if (onProgress && shouldReportProgress) {
                await onProgress({
                    phase: 'Exporting chunk PNGs',
                    completed: processedChunks,
                    total: totalChunkCount,
                    detail: `Processed ${processedChunks} of ${totalChunkCount} chunks. Exported ${exportedChunks}, skipped ${skippedChunks}. Current chunk: row ${chunkRow + 1}, column ${chunkColumn + 1}.`
                });
            }
            if (shouldReportProgress) {
                lastYieldAt = processedChunks;
                await yieldToUi();
            }
        }
    }

    const manifest: PngChunkManifest = {
        version: 1,
        sourceName: config.sourceName,
        tileSize: PNG_IMPORT_SOURCE_TILE_SIZE,
        crop: {
            x: config.sourceX,
            y: config.sourceY,
            width: config.sourceWidth,
            height: config.sourceHeight
        },
        chunkTileWidth: config.chunkTileWidth,
        chunkTileHeight: config.chunkTileHeight,
        totalSourceColumns,
        totalSourceRows,
        totalChunkColumns,
        totalChunkRows,
        chunks
    };
    await writeTextToDirectory(
        directoryHandle,
        PNG_CHUNK_EXPORT_MANIFEST_NAME,
        `${JSON.stringify(manifest, null, 2)}\n`
    );
    return {
        directoryName: directoryHandle.name,
        manifest,
        exportedChunks: chunks.length,
        skippedChunks,
        totalChunkCount
    };
}

async function readPngChunkFolderSelection(
    directoryHandle: BrowserDirectoryHandle,
    onProgress?: (progress: PngImportProgress) => void | Promise<void>
) {
    const files = new Map<string, File>();
    let processedEntries = 0;
    for await (const entry of directoryHandle.values()) {
        processedEntries += 1;
        if (entry.kind === 'file') {
            files.set(entry.name, await entry.getFile());
        }
        if (onProgress) {
            await onProgress({
                phase: 'Reading chunk folder',
                completed: processedEntries,
                total: Math.max(processedEntries, 1),
                detail: `Scanning ${entry.name}.`
            });
        }
    }
    const manifestFile = files.get(PNG_CHUNK_EXPORT_MANIFEST_NAME);
    let manifest: PngChunkManifest;
    if (manifestFile) {
        manifest = normalizePngChunkManifest(JSON.parse(await manifestFile.text()));
    } else {
        const parsedEntries = [...files.keys()]
            .filter((name) => name.toLowerCase().endsWith('.png'))
            .map((name) => parsePngChunkFileName(name))
            .filter((entry): entry is PngChunkEntry => entry !== null);
        manifest = buildChunkManifestFromFiles(directoryHandle.name, parsedEntries);
    }
    for (const chunk of manifest.chunks) {
        if (!files.has(chunk.fileName)) {
            throw new Error(`Chunk folder is missing ${chunk.fileName}, which is referenced by the manifest.`);
        }
    }
    const emptyChunkFileNames = new Set<string>();
    for (let index = 0; index < manifest.chunks.length; index += 1) {
        const chunk = manifest.chunks[index];
        const file = files.get(chunk.fileName);
        if (!file) {
            continue;
        }
        if (await isChunkFileEmpty(file)) {
            emptyChunkFileNames.add(chunk.fileName);
        }
        if (onProgress) {
            await onProgress({
                phase: 'Checking chunk occupancy',
                completed: index + 1,
                total: manifest.chunks.length,
                detail: `Inspecting ${chunk.fileName}.`
            });
        }
    }
    return {
        directoryName: directoryHandle.name,
        manifest,
        files,
        emptyChunkFileNames
    };
}

function getPngChunkSelectionEntries(
    selection: PngChunkFolderSelection,
    range: PngChunkSelectionRange
) {
    const filteredChunks = selection.manifest.chunks
        .filter((chunk) => (
            chunk.chunkColumn >= range.minChunkColumn &&
            chunk.chunkColumn <= range.maxChunkColumn &&
            chunk.chunkRow >= range.minChunkRow &&
            chunk.chunkRow <= range.maxChunkRow
        ))
        .sort((left, right) => (
            left.chunkRow === right.chunkRow
                ? left.chunkColumn - right.chunkColumn
                : left.chunkRow - right.chunkRow
        ));
    const totalSelectedChunks = filteredChunks.length;
    const limitedChunks = range.maxChunks > 0
        ? filteredChunks
            .filter((chunk) => !selection.emptyChunkFileNames.has(chunk.fileName))
            .slice(0, range.maxChunks)
        : filteredChunks;
    return {
        selectedChunks: limitedChunks,
        totalSelectedChunks
    };
}

async function composePngChunkFolderSource(
    selection: PngChunkFolderSelection,
    range: PngChunkSelectionRange,
    onProgress?: (progress: PngImportProgress) => void | Promise<void>
) {
    const { selectedChunks, totalSelectedChunks } = getPngChunkSelectionEntries(selection, range);
    if (selectedChunks.length === 0) {
        throw new Error('The selected chunk range did not include any exported PNG chunks.');
    }
    const cropTileOriginX = Math.round(selection.manifest.crop.x / PNG_IMPORT_SOURCE_TILE_SIZE);
    const cropTileOriginY = Math.round(selection.manifest.crop.y / PNG_IMPORT_SOURCE_TILE_SIZE);
    const columns = selection.manifest.totalSourceColumns;
    const rows = selection.manifest.totalSourceRows;
    const activeTileIndexes = new Set<number>();
    for (const chunk of selectedChunks) {
        const startColumn = chunk.sourceTileX - cropTileOriginX;
        const startRow = chunk.sourceTileY - cropTileOriginY;
        for (let row = 0; row < chunk.tileHeight; row += 1) {
            for (let column = 0; column < chunk.tileWidth; column += 1) {
                activeTileIndexes.add((startRow + row) * columns + startColumn + column);
            }
        }
    }
    const canvas = document.createElement('canvas');
    canvas.width = columns * PNG_IMPORT_SOURCE_TILE_SIZE;
    canvas.height = rows * PNG_IMPORT_SOURCE_TILE_SIZE;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        throw new Error('Could not create a canvas context for chunk composition.');
    }
    ctx.imageSmoothingEnabled = false;
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    for (let index = 0; index < selectedChunks.length; index += 1) {
        const chunk = selectedChunks[index];
        const file = selection.files.get(chunk.fileName);
        if (!file) {
            throw new Error(`The chunk folder is missing ${chunk.fileName}.`);
        }
        const bitmap = await createImageBitmap(file);
        const destinationX = (chunk.sourceTileX - cropTileOriginX) * PNG_IMPORT_SOURCE_TILE_SIZE;
        const destinationY = (chunk.sourceTileY - cropTileOriginY) * PNG_IMPORT_SOURCE_TILE_SIZE;
        ctx.drawImage(bitmap, destinationX, destinationY);
        bitmap.close();
        if (onProgress) {
            await onProgress({
                phase: 'Composing chunk folder',
                completed: index + 1,
                total: selectedChunks.length,
                detail: `Placed ${chunk.fileName}.`
            });
            await yieldToUi();
        }
    }
    const image = await loadImageFromBlob(await canvasToBlob(canvas));
    return {
        image,
        manifest: selection.manifest,
        selectedChunks,
        chunkCount: selectedChunks.length,
        totalSelectedChunks,
        sourceWidth: canvas.width,
        sourceHeight: canvas.height,
        columns,
        rows,
        activeTileIndexes
    };
}

function parsePaletteCyclePalettes(value: string, paletteCount: number) {
    return [...new Set(
        value
            .split(',')
            .map((entry) => Number(entry.trim()))
            .filter((entry) => Number.isFinite(entry) && entry >= 0 && entry < paletteCount)
            .map((entry) => Math.round(entry))
    )];
}

function isFormTarget(target: EventTarget | null) {
    return target instanceof HTMLInputElement ||
        target instanceof HTMLTextAreaElement ||
        target instanceof HTMLSelectElement;
}

function createDesignerStyles() {
    const style = document.createElement('style');
    style.dataset.designerStyle = 'true';
    style.textContent = `
        .world-designer-panel {
            position: fixed;
            top: 8px;
            right: 8px;
            width: 360px;
            max-height: calc(100vh - 16px);
            overflow: auto;
            z-index: 9999;
            background: rgba(10, 16, 22, 0.94);
            color: #f1f5f9;
            border: 1px solid rgba(148, 163, 184, 0.4);
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            font: 12px/1.4 system-ui, sans-serif;
            padding: 12px;
            backdrop-filter: blur(10px);
        }
        .world-designer-drag-handle {
            display: flex;
            justify-content: space-between;
            align-items: center;
            gap: 8px;
            cursor: move;
            user-select: none;
        }
        .world-designer-drag-title {
            flex: 1 1 auto;
        }
        .world-designer-drag-active {
            user-select: none;
        }
        .world-designer-panel h2,
        .world-designer-panel h3 {
            margin: 0 0 8px;
            font-size: 13px;
        }
        .world-designer-grid {
            display: grid;
            grid-template-columns: repeat(2, minmax(0, 1fr));
            gap: 8px;
        }
        .world-designer-grid-wide {
            grid-column: 1 / -1;
        }
        .world-designer-section {
            border-top: 1px solid rgba(148, 163, 184, 0.2);
            margin-top: 10px;
            padding-top: 10px;
        }
        .world-designer-accordion {
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.78);
            border: 1px solid rgba(148, 163, 184, 0.2);
            overflow: hidden;
        }
        .world-designer-accordion summary {
            cursor: pointer;
            padding: 10px 12px;
            color: #f8fafc;
            user-select: none;
            list-style: none;
            font-weight: 600;
        }
        .world-designer-accordion summary::-webkit-details-marker {
            display: none;
        }
        .world-designer-accordion summary::before {
            content: '▸';
            display: inline-block;
            margin-right: 8px;
            transition: transform 0.15s ease;
        }
        .world-designer-accordion[open] summary::before {
            transform: rotate(90deg);
        }
        .world-designer-accordion-body {
            padding: 0 12px 12px;
        }
        .world-designer-accordion-body > :first-child {
            margin-top: 0;
        }
        .world-designer-accordion-body > :last-child {
            margin-bottom: 0;
        }
        .world-designer-field {
            display: flex;
            flex-direction: column;
            gap: 4px;
            margin-bottom: 8px;
        }
        .world-designer-field input,
        .world-designer-field select,
        .world-designer-field textarea,
        .world-designer-panel button {
            font: inherit;
        }
        .world-designer-field input,
        .world-designer-field select,
        .world-designer-field textarea {
            width: 100%;
            box-sizing: border-box;
            border-radius: 6px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: rgba(15, 23, 42, 0.9);
            color: #f8fafc;
            padding: 6px 8px;
        }
        .world-designer-checkbox {
            display: flex;
            align-items: center;
            gap: 8px;
            margin-bottom: 6px;
        }
        .world-designer-actions {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
        }
        .world-designer-panel button,
        .world-designer-modal-card button {
            border-radius: 6px;
            border: 1px solid rgba(96, 165, 250, 0.22);
            background: linear-gradient(180deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
            color: #f8fafc;
            padding: 7px 12px;
            cursor: pointer;
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.06), 0 4px 12px rgba(2, 6, 23, 0.22);
            transition: transform 0.08s ease, background 0.12s ease, border-color 0.12s ease, box-shadow 0.12s ease;
        }
        .world-designer-panel button:hover,
        .world-designer-modal-card button:hover {
            background: linear-gradient(180deg, rgba(51, 65, 85, 0.98), rgba(30, 41, 59, 0.98));
            border-color: rgba(96, 165, 250, 0.4);
            box-shadow: inset 0 1px 0 rgba(255, 255, 255, 0.07), 0 6px 16px rgba(2, 6, 23, 0.28);
        }
        .world-designer-panel button:active,
        .world-designer-modal-card button:active {
            transform: translateY(1px);
        }
        .world-designer-panel button:disabled,
        .world-designer-modal-card button:disabled {
            opacity: 0.45;
            cursor: default;
            transform: none;
            box-shadow: none;
        }
        .world-designer-modal-card .world-designer-button-primary,
        .world-designer-modal-card .world-designer-button-secondary,
        .world-designer-modal-card .world-designer-button-subtle {
            border-color: rgba(96, 165, 250, 0.22);
            background: linear-gradient(180deg, rgba(30, 41, 59, 0.98), rgba(15, 23, 42, 0.98));
            color: #f8fafc;
        }
        .world-designer-button-primary {
            background: linear-gradient(180deg, rgba(14, 165, 233, 0.96), rgba(2, 132, 199, 0.96));
            border-color: rgba(125, 211, 252, 0.5);
            color: #eff6ff;
        }
        .world-designer-button-primary:hover {
            background: linear-gradient(180deg, rgba(56, 189, 248, 0.98), rgba(14, 165, 233, 0.98));
        }
        .world-designer-button-secondary {
            background: linear-gradient(180deg, rgba(37, 99, 235, 0.18), rgba(15, 23, 42, 0.98));
        }
        .world-designer-button-subtle {
            background: rgba(15, 23, 42, 0.7);
        }
        .world-designer-status {
            margin-top: 6px;
            padding: 6px 8px;
            border-radius: 6px;
            background: rgba(30, 41, 59, 0.6);
        }
        .world-designer-status.success {
            background: rgba(20, 83, 45, 0.7);
        }
        .world-designer-status.error {
            background: rgba(127, 29, 29, 0.8);
        }
        .world-designer-overview {
            width: 100%;
            height: auto;
            display: block;
            border-radius: 8px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: #020617;
        }
        .world-designer-shortcuts {
            margin: 0;
            padding-left: 16px;
        }
        .world-designer-summary {
            color: #cbd5e1;
            margin-bottom: 6px;
        }
        .world-designer-sprite-preview {
            display: flex;
            align-items: center;
            gap: 10px;
            margin-bottom: 8px;
            padding: 8px;
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(148, 163, 184, 0.2);
        }
        .world-designer-sprite-canvas {
            width: 72px;
            height: 72px;
            flex: 0 0 auto;
            border-radius: 6px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background:
                linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
                linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
                rgba(2, 6, 23, 0.95);
            background-position: 0 0, 8px 8px, 0 0;
            background-size: 16px 16px;
            image-rendering: pixelated;
        }
        .world-designer-sprite-meta {
            min-width: 0;
            color: #cbd5e1;
            word-break: break-word;
        }
        .world-designer-sprite-picker {
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.85);
            border: 1px solid rgba(148, 163, 184, 0.2);
            overflow: hidden;
        }
        .world-designer-sprite-picker summary {
            cursor: pointer;
            padding: 8px 10px;
            color: #f8fafc;
            user-select: none;
            list-style: none;
        }
        .world-designer-sprite-picker summary::-webkit-details-marker {
            display: none;
        }
        .world-designer-sprite-picker summary::before {
            content: '▸';
            display: inline-block;
            margin-right: 8px;
            transition: transform 0.15s ease;
        }
        .world-designer-sprite-picker[open] summary::before {
            transform: rotate(90deg);
        }
        .world-designer-sprite-picker-body {
            max-height: 280px;
            overflow-x: hidden;
            overflow-y: auto;
            padding: 0 8px 8px;
            box-sizing: border-box;
            min-width: 0;
        }
        .world-designer-sprite-picker-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(92px, 1fr));
            gap: 8px;
            width: 100%;
            min-width: 0;
        }
        .world-designer-sprite-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            width: 100%;
            box-sizing: border-box;
            padding: 6px;
            min-width: 0;
            text-align: center;
            overflow: hidden;
        }
        .world-designer-sprite-option.selected {
            border-color: rgba(56, 189, 248, 0.9);
            box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
            background: rgba(14, 116, 144, 0.25);
        }
        .world-designer-sprite-option.dragging {
            opacity: 0.55;
            cursor: grabbing;
        }
        .world-designer-sprite-option-label {
            width: 100%;
            font-size: 11px;
            color: #cbd5e1;
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        .world-designer-modal {
            position: fixed;
            inset: 0;
            z-index: 10000;
            display: none;
            align-items: center;
            justify-content: center;
            background: rgba(2, 6, 23, 0.7);
        }
        .world-designer-modal.open {
            display: flex;
        }
        .world-designer-modal-card {
            width: min(92vw, 900px);
            max-height: 88vh;
            overflow: auto;
            border-radius: 12px;
            background: #0f172a;
            color: #f8fafc;
            border: 1px solid rgba(148, 163, 184, 0.35);
            padding: 16px;
            font: 12px/1.4 system-ui, sans-serif;
        }
        .world-designer-modal-card.world-designer-modal-card-import {
            width: min(96vw, 1380px);
            max-height: 92vh;
        }
        .world-designer-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 12px;
        }
        .world-designer-import-layout {
            display: grid;
            grid-template-columns: minmax(320px, 420px) minmax(0, 1fr);
            gap: 18px;
            align-items: start;
        }
        .world-designer-import-sidebar,
        .world-designer-import-main {
            min-width: 0;
        }
        .world-designer-import-card {
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.18);
            background: rgba(15, 23, 42, 0.55);
            padding: 12px;
            margin-bottom: 12px;
        }
        .world-designer-import-tabs {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            margin-bottom: 8px;
        }
        .world-designer-import-tab {
            border-radius: 999px;
            padding: 8px 14px;
        }
        .world-designer-import-tab.selected {
            border-color: rgba(56, 189, 248, 0.9);
            box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
            background: rgba(8, 47, 73, 0.75);
        }
        .world-designer-import-paths {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
            gap: 10px;
        }
        .world-designer-import-path {
            display: flex;
            flex-direction: column;
            align-items: flex-start;
            gap: 6px;
            padding: 12px;
            border-radius: 10px;
            border: 1px solid rgba(148, 163, 184, 0.24);
            background: rgba(15, 23, 42, 0.72);
            text-align: left;
        }
        .world-designer-import-path strong {
            font-size: 13px;
        }
        .world-designer-import-path span {
            color: #cbd5e1;
        }
        .world-designer-import-path.selected {
            border-color: rgba(56, 189, 248, 0.9);
            box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
            background: rgba(8, 47, 73, 0.75);
        }
        .world-designer-import-card:last-child {
            margin-bottom: 0;
        }
        .world-designer-import-progress {
            display: grid;
            gap: 8px;
            margin-top: 8px;
        }
        .world-designer-import-progress[hidden] {
            display: none;
        }
        .world-designer-import-progress progress {
            width: 100%;
            height: 12px;
            accent-color: #38bdf8;
        }
        .world-designer-import-progress-actions {
            display: flex;
            justify-content: flex-end;
        }
        .world-designer-import-toolbar {
            display: flex;
            flex-wrap: wrap;
            justify-content: space-between;
            gap: 8px;
            align-items: center;
            margin-bottom: 8px;
        }
        .world-designer-import-zoom-controls {
            display: flex;
            flex-wrap: wrap;
            gap: 8px;
            align-items: center;
        }
        .world-designer-import-zoom-label {
            color: #cbd5e1;
            min-width: 70px;
        }
        .world-designer-png-preview-frame {
            margin: 8px 0;
            max-height: 70vh;
            min-height: 420px;
            overflow: auto;
            border-radius: 8px;
            border: 1px solid rgba(148, 163, 184, 0.25);
            background:
                linear-gradient(45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.08) 75%),
                linear-gradient(45deg, rgba(148, 163, 184, 0.08) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.08) 75%),
                rgba(2, 6, 23, 0.95);
            background-position: 0 0, 8px 8px, 0 0;
            background-size: 16px 16px;
        }
        .world-designer-png-preview-canvas {
            display: block;
            image-rendering: pixelated;
            cursor: crosshair;
        }
        .world-designer-png-preview-frame.busy,
        .world-designer-import-card.busy {
            opacity: 0.68;
        }
        @media (max-width: 1080px) {
            .world-designer-import-layout {
                grid-template-columns: 1fr;
            }
            .world-designer-png-preview-frame {
                min-height: 320px;
            }
        }
        .world-designer-context-menu {
            position: fixed;
            z-index: 10001;
            display: none;
            min-width: 220px;
            border-radius: 10px;
            background: rgba(15, 23, 42, 0.96);
            border: 1px solid rgba(148, 163, 184, 0.35);
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.45);
            padding: 6px;
            font: 12px/1.4 system-ui, sans-serif;
        }
        .world-designer-context-menu.open {
            display: block;
        }
        .world-designer-context-menu button {
            display: block;
            width: 100%;
            text-align: left;
            margin: 0;
            border: 0;
            border-radius: 6px;
            background: transparent;
            color: #f8fafc;
            padding: 8px 10px;
        }
        .world-designer-context-menu button:hover {
            background: rgba(51, 65, 85, 0.95);
        }
        .world-designer-context-toggle-action {
            white-space: nowrap;
        }
        .world-designer-context-toggle-check {
            display: inline-block;
            width: 14px;
            margin-right: 8px;
            color: #38bdf8;
            text-align: center;
        }
        .world-designer-context-menu button:disabled {
            opacity: 0.45;
            cursor: default;
        }
        .world-designer-context-menu hr {
            border: 0;
            border-top: 1px solid rgba(148, 163, 184, 0.2);
            margin: 6px 0;
        }
        .world-designer-context-submenu {
            margin: 2px 0;
        }
        .world-designer-context-submenu > summary {
            display: block;
            border-radius: 6px;
            color: #f8fafc;
            padding: 8px 10px;
            cursor: pointer;
            list-style: none;
            user-select: none;
        }
        .world-designer-context-submenu > summary::-webkit-details-marker {
            display: none;
        }
        .world-designer-context-submenu > summary:hover {
            background: rgba(51, 65, 85, 0.95);
        }
        .world-designer-context-submenu > summary::after {
            content: '▸';
            float: right;
            color: #cbd5e1;
        }
        .world-designer-context-submenu[open] > summary::after {
            content: '▾';
        }
        .world-designer-context-submenu-body {
            display: grid;
            gap: 4px;
            max-height: 220px;
            overflow: auto;
            padding: 4px 0 4px 12px;
        }
        .world-designer-context-palette-option {
            display: flex;
            align-items: center;
            gap: 8px;
            width: 100%;
            text-align: left;
            margin: 0;
            border: 0;
            border-radius: 6px;
            background: transparent;
            color: #f8fafc;
            padding: 6px 8px;
        }
        .world-designer-context-palette-option:hover {
            background: rgba(51, 65, 85, 0.95);
        }
        .world-designer-context-palette-option.selected {
            background: rgba(14, 116, 144, 0.25);
            box-shadow: inset 0 0 0 1px rgba(56, 189, 248, 0.35);
        }
        .world-designer-context-palette-canvas {
            width: 36px;
            height: 36px;
            flex: 0 0 auto;
            border-radius: 4px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background:
                linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
                linear-gradient(45deg, rgba(148, 163, 184, 0.12) 25%, transparent 25%, transparent 75%, rgba(148, 163, 184, 0.12) 75%),
                rgba(2, 6, 23, 0.95);
            background-position: 0 0, 6px 6px, 0 0;
            background-size: 12px 12px;
            image-rendering: pixelated;
        }
        .world-designer-context-palette-label {
            color: #cbd5e1;
        }
        .world-designer-pre {
            margin: 8px 0 12px;
            padding: 10px;
            overflow: auto;
            border-radius: 8px;
            background: rgba(15, 23, 42, 0.95);
            border: 1px solid rgba(148, 163, 184, 0.25);
            max-height: 240px;
            white-space: pre-wrap;
            word-break: break-word;
        }
        .world-designer-hidden {
            display: none !important;
        }
        .world-designer-flyout {
            position: fixed;
            top: 8px;
            right: 384px;
            width: 360px;
            max-height: calc(100vh - 16px);
            overflow: auto;
            z-index: 9998;
            background: rgba(10, 16, 22, 0.96);
            color: #f1f5f9;
            border: 1px solid rgba(148, 163, 184, 0.4);
            border-radius: 10px;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
            padding: 12px;
            backdrop-filter: blur(10px);
            font: 12px/1.4 system-ui, sans-serif;
        }
        .world-designer-flyout-hidden {
            display: none !important;
        }
        .world-designer-palette-preview {
            width: 100%;
            height: 120px;
        }
        .world-designer-palette-list {
            min-height: 160px;
        }
        .world-designer-palette-mappings {
            display: grid;
            gap: 8px;
        }
        .world-designer-palette-row {
            display: grid;
            grid-template-columns: minmax(0, 1fr) minmax(0, 1fr) auto;
            gap: 8px;
            align-items: end;
        }
        `;
    document.head.appendChild(style);
    return style;
}

function clearPreviewCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function createWorldDesigner(host: WorldDesignerHost): WorldDesigner {
    const spriteTypes = [...host.getSpriteTypes()].sort();
    const spriteCatalog = host.getSpriteCatalog();
    const colorAliasNames = Object.keys(host.getColorAliases());
    let paletteCount = Math.max(host.getPaletteCount(), 1);
    const initialPaletteDefinitions = deepClone(host.getPaletteDefinitions());
    paletteCount = Math.max(paletteCount, initialPaletteDefinitions.length, 1);
    let pngImportCandidateCache: { key: string; candidates: PngImportCandidate[] } | null = null;
    const styles = createDesignerStyles();
    const initialSnapshot = serializeWorldData(host.getRawWorldData());
    const loadPersistedState = (): PersistedDesignerUiState | null => {
        try {
            const raw = window.localStorage.getItem(DESIGNER_STATE_STORAGE_KEY);
            if (!raw) return null;
            return JSON.parse(raw) as PersistedDesignerUiState;
        } catch {
            return null;
        }
    };
    const persistedState = loadPersistedState();
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
        world: spriteTypes.includes(persistedState?.typeByCategory?.world ?? '') ? persistedState!.typeByCategory.world : defaultTypeByCategory.world,
        buttons: spriteTypes.includes(persistedState?.typeByCategory?.buttons ?? '') ? persistedState!.typeByCategory.buttons : defaultTypeByCategory.buttons,
        doors: spriteTypes.includes(persistedState?.typeByCategory?.doors ?? '') ? persistedState!.typeByCategory.doors : defaultTypeByCategory.doors,
        creatures: spriteTypes.includes(persistedState?.typeByCategory?.creatures ?? '') ? persistedState!.typeByCategory.creatures : defaultTypeByCategory.creatures,
        collectables: spriteTypes.includes(persistedState?.typeByCategory?.collectables ?? '') ? persistedState!.typeByCategory.collectables : defaultTypeByCategory.collectables,
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
    const restoredButtonDefaults: ButtonDefaultOverrides = {
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
    const state: DesignerState = {
        active: persistedState?.active ?? false,
        mode: persistedState?.mode === 'preview' ? 'preview' : 'edit',
        tool: persistedState?.tool === 'place' ? 'place' : 'select',
        category: persistedState?.category && persistedState.category in CATEGORY_LABELS ? persistedState.category : 'world',
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
        layerVisibility: {
            ...buildLayerVisibility(),
            ...(persistedState?.layerVisibility ?? {})
        },
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
        customSpriteInstances: restoredCustomSpriteInstances.filter((instance) =>
            restoredCustomSpriteDefinitions.some((definition) => definition.id === instance.customSpriteId)
        ),
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
            customSpriteInstances: deepClone(
                restoredCustomSpriteInstances.filter((instance) =>
                    restoredCustomSpriteDefinitions.some((definition) => definition.id === instance.customSpriteId)
                )
            )
        },
        liveResumeSnapshot: null,
        lastSavedSnapshot: initialSnapshot
    };
    customSpriteDefinitionResolver = (instance) =>
        state.customSpriteDefinitions.find((definition) => definition.id === instance.customSpriteId) ?? null;
    visibleSpriteRectResolver = (type, palette, rotation, translation = 'center') => {
        const spriteCanvas = document.createElement('canvas');
        spriteCanvas.width = TILE_SIZE;
        spriteCanvas.height = TILE_SIZE;
        const spriteCtx = spriteCanvas.getContext('2d');
        if (!spriteCtx) {
            return null;
        }
        const rendered = host.drawSpriteSample(
            spriteCtx,
            type,
            palette,
            rotation,
            true,
            TILE_SIZE,
            translation
        );
        if (!rendered) {
            return null;
        }
        const visibleBounds = getSpriteVisibleBounds(spriteCanvas);
        if (!visibleBounds) {
            return null;
        }
        return {
            left: visibleBounds.minX,
            top: visibleBounds.minY,
            width: visibleBounds.width,
            height: visibleBounds.height
        };
    };

    const root = document.createElement('div');
    root.className = 'world-designer-panel world-designer-hidden';
    root.innerHTML = `
        <div class="world-designer-drag-handle" data-role="panel-drag-handle">
            <h2 class="world-designer-drag-title">World Designer</h2>
            <button type="button" data-role="active-toggle">Hide panel</button>
        </div>
        <div class="world-designer-status" data-role="status"></div>
        <details class="world-designer-section world-designer-accordion" data-section-id="overview">
            <summary>Overview navigator</summary>
            <div class="world-designer-accordion-body">
            <div class="world-designer-summary">Zoomed-out world view. Move the cursor to preview the 1:1 viewport, then drag with the left mouse button to pan the main view.</div>
            <canvas class="world-designer-overview" data-role="overview" width="320" height="220"></canvas>
            </div>
        </details>
        <details class="world-designer-section world-designer-accordion" data-section-id="mode-and-sprite">
            <summary>Mode and sprite setup</summary>
            <div class="world-designer-accordion-body">
            <div class="world-designer-grid">
                <label class="world-designer-field">Mode<select data-role="mode"><option value="edit">Edit</option><option value="preview">Preview</option></select></label>
                <label class="world-designer-field">Tool<select data-role="tool"><option value="select">Select / move</option><option value="place">Place new</option></select></label>
                <label class="world-designer-field">Category<select data-role="category">
                    <option value="world">World items</option>
                    <option value="buttons">Buttons</option>
                    <option value="doors">Doors</option>
                    <option value="creatures">Creatures</option>
                    <option value="collectables">Collectables</option>
                    <option value="custom">Custom sprites</option>
                </select></label>
                <label class="world-designer-field">Sprite type<select data-role="type"></select></label>
                <div class="world-designer-grid-wide">
                    <div class="world-designer-sprite-preview">
                        <canvas class="world-designer-sprite-canvas" data-role="sprite-preview" width="72" height="72"></canvas>
                        <div class="world-designer-sprite-meta" data-role="sprite-preview-meta"></div>
                    </div>
                    <details class="world-designer-sprite-picker" data-role="sprite-picker">
                        <summary>Choose from sprite grid</summary>
                        <div class="world-designer-sprite-picker-body">
                            <div class="world-designer-grid world-designer-grid-wide">
                                <label class="world-designer-field">Filter sprites<input type="text" data-role="sprite-picker-filter" placeholder="Type to filter sprite names" /></label>
                                <label class="world-designer-field">Category filter<select data-role="sprite-picker-category-filter"></select></label>
                            </div>
                            <div class="world-designer-sprite-picker-grid" data-role="sprite-picker-grid"></div>
                        </div>
                    </details>
                </div>
                <label class="world-designer-field">Rotation<select data-role="rotation"></select></label>
                <label class="world-designer-field">Translation<select data-role="translation"></select></label>
                <div class="world-designer-field">
                    <label>Palette</label>
                    <div style="display:flex;gap:8px;align-items:center;">
                        <select data-role="palette" style="flex:1 1 auto;"></select>
                        <button type="button" data-role="palette-designer-toggle">Edit</button>
                    </div>
                </div>
            </div>
            </div>
        </details>
        <details class="world-designer-section world-designer-accordion" data-section-id="placement-actions">
            <summary>Placement and actions</summary>
            <div class="world-designer-accordion-body">
            <label class="world-designer-checkbox"><input type="checkbox" data-role="snap" /> Snap rough placement to 32px grid</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="object-snap" /> Snap to nearby object edges</label>
            <div class="world-designer-grid" style="margin-top:8px;">
                <label class="world-designer-field">Grid offset X<input type="number" min="0" max="31" step="1" value="0" data-role="snap-offset-x" /></label>
                <label class="world-designer-field">Grid offset Y<input type="number" min="0" max="31" step="1" value="0" data-role="snap-offset-y" /></label>
                <button type="button" data-role="snap-offset-capture">Use selection / view center</button>
            </div>
            <label class="world-designer-field">Arrow-key nudge size<input type="number" min="1" max="64" step="1" value="1" data-role="nudge" /></label>
            <div class="world-designer-actions">
                <button type="button" data-role="focus-astronaut">Center on astronaut</button>
                <button type="button" data-role="move-astronaut">Move live astronaut to view center</button>
                <button type="button" data-role="add-center">Place at view center</button>
                <button type="button" data-role="set-start">Set astronaut start to view center</button>
                <button type="button" data-role="duplicate">Duplicate selection</button>
                <button type="button" data-role="delete">Delete selection</button>
                <button type="button" data-role="send-to-back">Send to back</button>
                <button type="button" data-role="bring-to-front">Bring to front</button>
                <button type="button" data-role="focus">Focus selection</button>
                <label class="world-designer-field" style="min-width:180px;">
                    <span>Convert to</span>
                    <select data-role="convert-target"></select>
                </label>
                <button type="button" data-role="convert">Convert</button>
                <button type="button" data-role="png-import">Import PNG draft</button>
                <button type="button" data-role="normalize-sprite-sheet">Normalize sprite colors</button>
                <button type="button" data-role="save-preview">Preview before save</button>
            </div>
            </div>
        </details>
        <details class="world-designer-section world-designer-accordion" data-section-id="selection">
            <summary>Selection</summary>
            <div class="world-designer-accordion-body">
            <div class="world-designer-summary" data-role="selection-summary">Nothing selected.</div>
            <div data-role="inspector"></div>
            </div>
        </details>
        <details class="world-designer-section world-designer-accordion" data-section-id="preview-toggles">
            <summary>Preview toggles</summary>
            <div class="world-designer-accordion-body">
            <label class="world-designer-checkbox"><input type="checkbox" data-role="sound-enabled" /> Sound enabled</label>
            <div class="world-designer-grid" style="margin-top:8px;">
                <label class="world-designer-field">Bullet impact primary audio
                    <select data-role="bullet-impact-primary">
                        <option value="bulletExplosion">BulletExplosion.wav</option>
                        <option value="bulletExplosion2">BulletExplosion2.wav</option>
                    </select>
                </label>
                <label class="world-designer-field">Bullet impact alternate audio
                    <select data-role="bullet-impact-alternate">
                        <option value="bulletExplosion">BulletExplosion.wav</option>
                        <option value="bulletExplosion2">BulletExplosion2.wav</option>
                    </select>
                </label>
                <label class="world-designer-field">Alternate chance (0..1)
                    <input type="number" min="0" max="1" step="0.01" data-role="bullet-impact-alternate-chance" />
                </label>
                <label class="world-designer-field">Bullet impact volume (0..1)
                    <input type="number" min="0" max="1" step="0.05" data-role="bullet-impact-volume" />
                </label>
            </div>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="expand-viewport" /> Expand viewport to window</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="show-collision" /> Show collision outlines</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="show-creature-overlays" /> Show creature overlays</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="show-sprite-outlines" /> Show sprite outlines (F)</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="magnifier-enabled" /> Show magnifier</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="disable-preview-collision" /> Disable collision during preview</label>
            <div class="world-designer-grid">
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="world" /> World</label>
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="buttons" /> Buttons</label>
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="doors" /> Doors</label>
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="creatures" /> Creatures</label>
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="collectables" /> Collectables</label>
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="custom" /> Custom sprites</label>
            </div>
            </div>
        </details>
        <details class="world-designer-section world-designer-accordion" data-section-id="keyboard-shortcuts">
            <summary>Keyboard shortcuts</summary>
            <div class="world-designer-accordion-body">
            <ul class="world-designer-shortcuts">
                <li><strong>\`</strong> show/hide panel</li>
                <li><strong>1</strong> select tool, <strong>2</strong> place tool, <strong>M</strong> toggle preview mode</li>
                <li><strong>Alt+Enter</strong> toggle expanded viewport</li>
                <li><strong>R</strong> rotate selection, <strong>Delete</strong> remove selection, <strong>Ctrl+C</strong> copy, <strong>Ctrl+V</strong> paste, <strong>Ctrl+D</strong> duplicate</li>
                <li><strong>Arrow keys</strong> nudge selected item, <strong>Shift+Arrow</strong> larger nudge</li>
                <li><strong>Ctrl+drag</strong> dock to nearby block edges, <strong>Alt+drag</strong> align matching edges, <strong>Ctrl+Alt+drag</strong> allow both</li>
                <li><strong>F</strong> toggle sprite outlines, <strong>G</strong> toggle grid snap, <strong>X</strong> toggle magnifier, <strong>Ctrl+S</strong> preview before save</li>
                <li><strong>Ctrl+Z</strong> undo, <strong>Ctrl+Y</strong> or <strong>Ctrl+Shift+Z</strong> redo</li>
            </ul>
            </div>
        </details>
    `;
    document.body.appendChild(root);

    const modal = document.createElement('div');
    modal.className = 'world-designer-modal';
    modal.innerHTML = `
        <div class="world-designer-modal-card">
            <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
                <h2 style="margin:0;" data-role="modal-title">Preview before save</h2>
                <button type="button" data-role="modal-close">Close</button>
            </div>
            <div data-role="modal-body"></div>
            <div class="world-designer-modal-actions">
                <button type="button" data-role="modal-confirm">Save changes</button>
            </div>
        </div>
    `;
    document.body.appendChild(modal);

    const contextMenu = document.createElement('div');
    contextMenu.className = 'world-designer-context-menu';
    contextMenu.innerHTML = '<div data-role="context-menu-body"></div>';
    document.body.appendChild(contextMenu);

    const paletteFlyout = document.createElement('div');
    paletteFlyout.className = 'world-designer-flyout world-designer-flyout-hidden';
    paletteFlyout.innerHTML = `
        <div class="world-designer-drag-handle" data-role="palette-flyout-drag-handle">
            <h2 class="world-designer-drag-title" style="margin:0;">Palette Designer</h2>
            <button type="button" data-role="palette-flyout-close">Close</button>
        </div>
        <div class="world-designer-summary" data-role="palette-usage"></div>
        <div class="world-designer-grid">
            <label class="world-designer-field world-designer-grid-wide">Palette<select class="world-designer-palette-list" size="8" data-role="palette-list"></select></label>
            <div class="world-designer-actions world-designer-grid-wide">
                <button type="button" data-role="palette-new">New</button>
                <button type="button" data-role="palette-clone">Clone</button>
                <button type="button" data-role="palette-delete">Delete</button>
                <button type="button" data-role="palette-save">Save palettes</button>
            </div>
            <label class="world-designer-field world-designer-grid-wide">Preview sprite<select data-role="palette-preview-type"></select></label>
            <div class="world-designer-grid-wide">
                <canvas class="world-designer-sprite-canvas world-designer-palette-preview" data-role="palette-preview-canvas" width="320" height="120"></canvas>
            </div>
        </div>
        <details class="world-designer-section world-designer-accordion" data-section-id="palette-remaps">
            <summary>Color remaps</summary>
            <div class="world-designer-accordion-body">
            <div class="world-designer-palette-mappings" data-role="palette-mappings"></div>
            <div class="world-designer-actions" style="margin-top:8px;">
                <button type="button" data-role="palette-add-mapping">Add remap</button>
            </div>
            </div>
        </details>
    `;
    document.body.appendChild(paletteFlyout);
    const panelDragHandle = root.querySelector('[data-role="panel-drag-handle"]') as HTMLDivElement;
    const paletteFlyoutDragHandle = paletteFlyout.querySelector('[data-role="palette-flyout-drag-handle"]') as HTMLDivElement;
    const magnifierCanvas = document.createElement('canvas');
    magnifierCanvas.width = Math.max(1, Math.round(MAGNIFIER_SIZE / MAGNIFIER_ZOOM));
    magnifierCanvas.height = Math.max(1, Math.round(MAGNIFIER_SIZE / MAGNIFIER_ZOOM));

    const refs: ControlRefs = {
        root,
        modeSelect: root.querySelector('[data-role="mode"]') as HTMLSelectElement,
        toolSelect: root.querySelector('[data-role="tool"]') as HTMLSelectElement,
        categorySelect: root.querySelector('[data-role="category"]') as HTMLSelectElement,
        typeSelect: root.querySelector('[data-role="type"]') as HTMLSelectElement,
        spritePreviewCanvas: root.querySelector('[data-role="sprite-preview"]') as HTMLCanvasElement,
        spritePreviewMeta: root.querySelector('[data-role="sprite-preview-meta"]') as HTMLDivElement,
        spritePicker: root.querySelector('[data-role="sprite-picker"]') as HTMLDetailsElement,
        spritePickerFilter: root.querySelector('[data-role="sprite-picker-filter"]') as HTMLInputElement,
        spritePickerCategoryFilter: root.querySelector('[data-role="sprite-picker-category-filter"]') as HTMLSelectElement,
        spritePickerGrid: root.querySelector('[data-role="sprite-picker-grid"]') as HTMLDivElement,
        rotationSelect: root.querySelector('[data-role="rotation"]') as HTMLSelectElement,
        translationSelect: root.querySelector('[data-role="translation"]') as HTMLSelectElement,
        paletteSelect: root.querySelector('[data-role="palette"]') as HTMLSelectElement,
        snapCheckbox: root.querySelector('[data-role="snap"]') as HTMLInputElement,
        objectSnapCheckbox: root.querySelector('[data-role="object-snap"]') as HTMLInputElement,
        snapOffsetXInput: root.querySelector('[data-role="snap-offset-x"]') as HTMLInputElement,
        snapOffsetYInput: root.querySelector('[data-role="snap-offset-y"]') as HTMLInputElement,
        snapOffsetCaptureButton: root.querySelector('[data-role="snap-offset-capture"]') as HTMLButtonElement,
        nudgeInput: root.querySelector('[data-role="nudge"]') as HTMLInputElement,
        status: root.querySelector('[data-role="status"]') as HTMLDivElement,
        selectionSummary: root.querySelector('[data-role="selection-summary"]') as HTMLDivElement,
        inspector: root.querySelector('[data-role="inspector"]') as HTMLDivElement,
        overviewCanvas: root.querySelector('[data-role="overview"]') as HTMLCanvasElement,
        activeToggle: root.querySelector('[data-role="active-toggle"]') as HTMLButtonElement,
        paletteDesignerToggle: root.querySelector('[data-role="palette-designer-toggle"]') as HTMLButtonElement,
        pngImportButton: root.querySelector('[data-role="png-import"]') as HTMLButtonElement,
        savePreviewButton: root.querySelector('[data-role="save-preview"]') as HTMLButtonElement,
        normalizeSpriteSheetButton: root.querySelector('[data-role="normalize-sprite-sheet"]') as HTMLButtonElement,
        deleteButton: root.querySelector('[data-role="delete"]') as HTMLButtonElement,
        duplicateButton: root.querySelector('[data-role="duplicate"]') as HTMLButtonElement,
        sendToBackButton: root.querySelector('[data-role="send-to-back"]') as HTMLButtonElement,
        bringToFrontButton: root.querySelector('[data-role="bring-to-front"]') as HTMLButtonElement,
        focusButton: root.querySelector('[data-role="focus"]') as HTMLButtonElement,
        convertTargetSelect: root.querySelector('[data-role="convert-target"]') as HTMLSelectElement,
        convertButton: root.querySelector('[data-role="convert"]') as HTMLButtonElement,
        focusAstronautButton: root.querySelector('[data-role="focus-astronaut"]') as HTMLButtonElement,
        moveAstronautButton: root.querySelector('[data-role="move-astronaut"]') as HTMLButtonElement,
        expandViewportCheckbox: root.querySelector('[data-role="expand-viewport"]') as HTMLInputElement,
        soundEnabledCheckbox: root.querySelector('[data-role="sound-enabled"]') as HTMLInputElement,
        bulletImpactPrimarySelect: root.querySelector('[data-role="bullet-impact-primary"]') as HTMLSelectElement,
        bulletImpactAlternateSelect: root.querySelector('[data-role="bullet-impact-alternate"]') as HTMLSelectElement,
        bulletImpactAlternateChanceInput: root.querySelector('[data-role="bullet-impact-alternate-chance"]') as HTMLInputElement,
        bulletImpactVolumeInput: root.querySelector('[data-role="bullet-impact-volume"]') as HTMLInputElement,
        addAtCenterButton: root.querySelector('[data-role="add-center"]') as HTMLButtonElement,
        setAstronautStartButton: root.querySelector('[data-role="set-start"]') as HTMLButtonElement,
        showCollisionCheckbox: root.querySelector('[data-role="show-collision"]') as HTMLInputElement,
        showCreatureOverlaysCheckbox: root.querySelector('[data-role="show-creature-overlays"]') as HTMLInputElement,
        showSpriteOutlineCheckbox: root.querySelector('[data-role="show-sprite-outlines"]') as HTMLInputElement,
        magnifierCheckbox: root.querySelector('[data-role="magnifier-enabled"]') as HTMLInputElement,
        disablePreviewCollisionCheckbox: root.querySelector('[data-role="disable-preview-collision"]') as HTMLInputElement,
        layerCheckboxes: {
            world: root.querySelector('[data-layer="world"]') as HTMLInputElement,
            buttons: root.querySelector('[data-layer="buttons"]') as HTMLInputElement,
            doors: root.querySelector('[data-layer="doors"]') as HTMLInputElement,
            creatures: root.querySelector('[data-layer="creatures"]') as HTMLInputElement,
            collectables: root.querySelector('[data-layer="collectables"]') as HTMLInputElement,
            custom: root.querySelector('[data-layer="custom"]') as HTMLInputElement
        },
        modal,
        modalTitle: modal.querySelector('[data-role="modal-title"]') as HTMLHeadingElement,
        modalBody: modal.querySelector('[data-role="modal-body"]') as HTMLDivElement,
        modalClose: modal.querySelector('[data-role="modal-close"]') as HTMLButtonElement,
        modalConfirm: modal.querySelector('[data-role="modal-confirm"]') as HTMLButtonElement,
        contextMenu,
        contextMenuBody: contextMenu.querySelector('[data-role="context-menu-body"]') as HTMLDivElement,
        paletteFlyout,
        paletteFlyoutClose: paletteFlyout.querySelector('[data-role="palette-flyout-close"]') as HTMLButtonElement,
        paletteList: paletteFlyout.querySelector('[data-role="palette-list"]') as HTMLSelectElement,
        paletteUsage: paletteFlyout.querySelector('[data-role="palette-usage"]') as HTMLDivElement,
        palettePreviewCanvas: paletteFlyout.querySelector('[data-role="palette-preview-canvas"]') as HTMLCanvasElement,
        palettePreviewTypeSelect: paletteFlyout.querySelector('[data-role="palette-preview-type"]') as HTMLSelectElement,
        paletteMappings: paletteFlyout.querySelector('[data-role="palette-mappings"]') as HTMLDivElement,
        paletteNewButton: paletteFlyout.querySelector('[data-role="palette-new"]') as HTMLButtonElement,
        paletteCloneButton: paletteFlyout.querySelector('[data-role="palette-clone"]') as HTMLButtonElement,
        paletteDeleteButton: paletteFlyout.querySelector('[data-role="palette-delete"]') as HTMLButtonElement,
        paletteAddMappingButton: paletteFlyout.querySelector('[data-role="palette-add-mapping"]') as HTMLButtonElement,
        paletteSaveButton: paletteFlyout.querySelector('[data-role="palette-save"]') as HTMLButtonElement
    };
    const sectionAccordions = [
        ...Array.from(root.querySelectorAll('[data-section-id]')),
        ...Array.from(paletteFlyout.querySelectorAll('[data-section-id]'))
    ] as HTMLDetailsElement[];
    const spritePickerButtons = new Map<string, HTMLButtonElement>();
    const dragGhostPadding = 8;
    let modalConfirmAction: (() => void | Promise<void>) | null = null;
    let pngImportObjectUrl: string | null = null;
    let pendingInspectorFocusKey: string | null = null;
    const overviewBaseCanvas = document.createElement('canvas');
    let overviewBaseDirty = true;

    function clearPngImportObjectUrl() {
        if (pngImportObjectUrl) {
            URL.revokeObjectURL(pngImportObjectUrl);
            pngImportObjectUrl = null;
        }
    }

    function formatRgb(color: [number, number, number]) {
        return `${color[0]}, ${color[1]}, ${color[2]}`;
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

    function clampOverlayPosition(element: HTMLElement, left: number, top: number) {
        const maxLeft = Math.max(8, window.innerWidth - element.offsetWidth - 8);
        const maxTop = Math.max(8, window.innerHeight - element.offsetHeight - 8);
        return {
            left: clamp(left, 8, maxLeft),
            top: clamp(top, 8, maxTop)
        };
    }

    function attachDraggableSurface(element: HTMLElement, handle: HTMLElement) {
        let dragPointerId: number | null = null;
        let dragOffsetX = 0;
        let dragOffsetY = 0;
        handle.addEventListener('pointerdown', (event) => {
            const target = event.target as HTMLElement | null;
            if (!target || target.closest('button, input, select, textarea, label, summary, canvas, a')) {
                return;
            }
            const rect = element.getBoundingClientRect();
            dragPointerId = event.pointerId;
            dragOffsetX = event.clientX - rect.left;
            dragOffsetY = event.clientY - rect.top;
            element.style.left = `${rect.left}px`;
            element.style.top = `${rect.top}px`;
            element.style.right = 'auto';
            element.classList.add('world-designer-drag-active');
            handle.setPointerCapture(event.pointerId);
            event.preventDefault();
        });
        handle.addEventListener('pointermove', (event) => {
            if (dragPointerId !== event.pointerId) {
                return;
            }
            const next = clampOverlayPosition(element, event.clientX - dragOffsetX, event.clientY - dragOffsetY);
            element.style.left = `${next.left}px`;
            element.style.top = `${next.top}px`;
        });
        const stopDrag = (event: PointerEvent) => {
            if (dragPointerId !== event.pointerId) {
                return;
            }
            dragPointerId = null;
            element.classList.remove('world-designer-drag-active');
            if (handle.hasPointerCapture(event.pointerId)) {
                handle.releasePointerCapture(event.pointerId);
            }
        };
        handle.addEventListener('pointerup', stopDrag);
        handle.addEventListener('pointercancel', stopDrag);
    }

    attachDraggableSurface(root, panelDragHandle);
    attachDraggableSurface(paletteFlyout, paletteFlyoutDragHandle);

    function findNearestWorldBlockByType(
        worldMap: MapBlock[],
        type: 'teleporter' | 'teleporter_pad',
        targetX: number,
        targetY: number,
        maxDistance: number
    ) {
        let bestPart: MapBlock | null = null;
        let bestDistanceSquared = Number.POSITIVE_INFINITY;
        const maxDistanceSquared = maxDistance * maxDistance;
        for (const part of worldMap) {
            if (part.type !== type) {
                continue;
            }
            const dx = targetX - part.x;
            const dy = targetY - part.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared <= maxDistanceSquared && distanceSquared < bestDistanceSquared) {
                bestPart = part;
                bestDistanceSquared = distanceSquared;
            }
        }
        return bestPart;
    }

    function findWorldTeleporterPartById(
        worldMap: MapBlock[],
        type: 'teleporter' | 'teleporter_pad',
        teleporterId: string,
        targetX: number,
        targetY: number
    ) {
        const candidates = worldMap.filter((block) =>
            block.type === type &&
            block.teleporterId === teleporterId
        );
        if (candidates.length === 0) {
            return null;
        }
        let best = candidates[0];
        let bestDistanceSquared = Number.POSITIVE_INFINITY;
        for (const candidate of candidates) {
            const dx = targetX - candidate.x;
            const dy = targetY - candidate.y;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared < bestDistanceSquared) {
                best = candidate;
                bestDistanceSquared = distanceSquared;
            }
        }
        return best;
    }

    function syncTeleporterMetadataToWorldBlocks(data: RawWorldData) {
        for (const teleporter of data.teleporters ?? []) {
            const base = data.worldMap.find((block) =>
                block.type === 'teleporter' &&
                (block.teleporterId === teleporter.id || (block.x === teleporter.baseX && block.y === teleporter.baseY))
            ) ?? null;
            const pad = data.worldMap.find((block) =>
                block.type === 'teleporter_pad' &&
                (block.teleporterId === teleporter.id || (block.x === teleporter.padX && block.y === teleporter.padY))
            ) ?? null;
            for (const part of [base, pad]) {
                if (!part) {
                    continue;
                }
                part.teleporterId = teleporter.id;
                part.teleporterEnabled = teleporter.enabled !== false;
                part.teleporterRequiresKey = teleporter.requiresKey === true;
                part.teleporterDestinationA = {
                    x: Math.round(teleporter.destinationA.x),
                    y: Math.round(teleporter.destinationA.y)
                };
                part.teleporterDestinationB = teleporter.destinationB
                    ? {
                        x: Math.round(teleporter.destinationB.x),
                        y: Math.round(teleporter.destinationB.y)
                    }
                    : null;
                part.teleporterActiveDestinationIndex = teleporter.activeDestinationIndex === 1 ? 1 : 0;
            }
        }
    }

    function reconcileTeleporterPairsForSave(data: RawWorldData) {
        const teleporters = data.teleporters ?? [];
        const taggedTeleporterParts = new Map<string, { base?: MapBlock; pad?: MapBlock }>();
        for (const block of data.worldMap) {
            if ((block.type !== 'teleporter' && block.type !== 'teleporter_pad') || !block.teleporterId) {
                continue;
            }
            const id = String(block.teleporterId).trim();
            if (!id) {
                continue;
            }
            const existing = taggedTeleporterParts.get(id) ?? {};
            if (block.type === 'teleporter') {
                existing.base = block;
            } else {
                existing.pad = block;
            }
            taggedTeleporterParts.set(id, existing);
        }
        if (taggedTeleporterParts.size > 0) {
            const byId = new Map<string, TeleporterSaveData>();
            for (const teleporter of teleporters) {
                byId.set(teleporter.id, teleporter);
            }
            const startX = Math.round(data.astronautStart.x);
            const startY = Math.round(data.astronautStart.y);
            const toPositionOrNull = (value: unknown) => {
                if (!value || typeof value !== 'object') {
                    return null;
                }
                const x = Math.round(Number((value as { x?: number }).x));
                const y = Math.round(Number((value as { y?: number }).y));
                if (!Number.isFinite(x) || !Number.isFinite(y)) {
                    return null;
                }
                return { x, y };
            };
            for (const [id, parts] of taggedTeleporterParts.entries()) {
                if (!parts.base || !parts.pad) {
                    continue;
                }
                const existing = byId.get(id)
                    ?? teleporters.find((teleporter) =>
                        teleporter.baseX === parts.base!.x &&
                        teleporter.baseY === parts.base!.y &&
                        teleporter.padX === parts.pad!.x &&
                        teleporter.padY === parts.pad!.y
                    );
                if (existing) {
                    existing.baseX = parts.base.x;
                    existing.baseY = parts.base.y;
                    existing.padX = parts.pad.x;
                    existing.padY = parts.pad.y;
                    parts.base.teleporterId = existing.id;
                    parts.pad.teleporterId = existing.id;
                } else {
                    const destinationA = toPositionOrNull(parts.base.teleporterDestinationA)
                        ?? toPositionOrNull(parts.pad.teleporterDestinationA)
                        ?? { x: startX, y: startY };
                    const destinationB = toPositionOrNull(parts.base.teleporterDestinationB)
                        ?? toPositionOrNull(parts.pad.teleporterDestinationB);
                    data.teleporters.push({
                        id,
                        baseX: parts.base.x,
                        baseY: parts.base.y,
                        padX: parts.pad.x,
                        padY: parts.pad.y,
                        enabled: (parts.base.teleporterEnabled ?? parts.pad.teleporterEnabled) !== false,
                        requiresKey: (parts.base.teleporterRequiresKey ?? parts.pad.teleporterRequiresKey) === true,
                        destinationA,
                        destinationB,
                        activeDestinationIndex:
                            ((parts.base.teleporterActiveDestinationIndex ?? parts.pad.teleporterActiveDestinationIndex) === 1 && destinationB)
                                ? 1
                                : 0
                    });
                }
            }
        }
        if (teleporters.length === 0) {
            return;
        }
        const correctionDistancePx = TILE_SIZE * 1.5;
        teleporters.forEach((teleporter) => {
            teleporter.baseX = Math.round(teleporter.baseX);
            teleporter.baseY = Math.round(teleporter.baseY);
            teleporter.padX = Math.round(teleporter.padX);
            teleporter.padY = Math.round(teleporter.padY);
            const baseById = findWorldTeleporterPartById(
                data.worldMap,
                'teleporter',
                teleporter.id,
                teleporter.baseX,
                teleporter.baseY
            );
            const padById = findWorldTeleporterPartById(
                data.worldMap,
                'teleporter_pad',
                teleporter.id,
                teleporter.padX,
                teleporter.padY
            );
            if (baseById) {
                teleporter.baseX = baseById.x;
                teleporter.baseY = baseById.y;
                baseById.teleporterId = teleporter.id;
            }
            if (padById) {
                teleporter.padX = padById.x;
                teleporter.padY = padById.y;
                padById.teleporterId = teleporter.id;
            }
            const hasBaseAtPosition = data.worldMap.some((block) =>
                block.type === 'teleporter' &&
                block.x === teleporter.baseX &&
                block.y === teleporter.baseY
            );
            if (!hasBaseAtPosition) {
                const correctedBase = findNearestWorldBlockByType(
                    data.worldMap,
                    'teleporter',
                    teleporter.baseX,
                    teleporter.baseY,
                    correctionDistancePx
                );
                if (correctedBase) {
                    teleporter.baseX = correctedBase.x;
                    teleporter.baseY = correctedBase.y;
                    correctedBase.teleporterId = teleporter.id;
                }
            }
            const hasPadAtPosition = data.worldMap.some((block) =>
                block.type === 'teleporter_pad' &&
                block.x === teleporter.padX &&
                block.y === teleporter.padY
            );
            if (!hasPadAtPosition) {
                const correctedPad = findNearestWorldBlockByType(
                    data.worldMap,
                    'teleporter_pad',
                    teleporter.padX,
                    teleporter.padY,
                    correctionDistancePx
                );
                if (correctedPad) {
                    teleporter.padX = correctedPad.x;
                    teleporter.padY = correctedPad.y;
                    correctedPad.teleporterId = teleporter.id;
                }
            }
        });
        syncTeleporterMetadataToWorldBlocks(data);
    }

    function getWorldSnapshot() {
        const rawWorldData = host.getRawWorldData();
        reconcileTeleporterPairsForSave(rawWorldData);
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
            reconcileTeleporterPairsForSave(rawWorldData);
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

    function persistDesignerUiState() {
        try {
            const payload: PersistedDesignerUiState = {
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
            window.localStorage.setItem(DESIGNER_STATE_STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore storage failures and keep the designer usable.
        }
    }

    function invalidateOverviewBase() {
        overviewBaseDirty = true;
    }

    function refreshSectionAccordions() {
        for (const accordion of sectionAccordions) {
            const sectionId = accordion.dataset.sectionId as DesignerSectionId | undefined;
            if (!sectionId) {
                continue;
            }
            accordion.open = state.sectionOpenState[sectionId] === true;
        }
    }

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
        if (!id) {
            return null;
        }
        return state.customSpriteDefinitions.find((definition) => definition.id === id) ?? null;
    }

    function getCustomSpriteDefinitionForInstance(instance: CustomSpriteInstance) {
        return getCustomSpriteDefinitionById(instance.customSpriteId);
    }

    function createCustomSpriteName() {
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

    function refreshSelectOptions() {
        const editingSelection = getSingleEditableSelection();
        const placementTypeOptions = getPlacementTypeOptions(state.category, !editingSelection);
        const selectableTypes = state.category === 'custom'
            ? state.customSpriteDefinitions.map((definition) => definition.id)
            : placementTypeOptions.map((option) => option.value);
        refs.typeSelect.innerHTML = state.category === 'custom'
            ? state.customSpriteDefinitions
                .map((definition) => `<option value="${definition.id}">${definition.name}</option>`)
                .join('')
            : placementTypeOptions
                .map((option) => `<option value="${option.value}">${option.label}</option>`)
                .join('');
        refs.palettePreviewTypeSelect.innerHTML = spriteTypes
            .map((type) => `<option value="${type}">${type}</option>`)
            .join('');
        refs.rotationSelect.innerHTML = Array.from({ length: 9 }, (_, index) => {
            const value = index + 1;
            return `<option value="${value}">${value}</option>`;
        }).join('');
        refs.translationSelect.innerHTML = SPRITE_TRANSLATION_OPTIONS
            .map((value) => `<option value="${value}">${formatSpriteTranslation(value)}</option>`)
            .join('');
        refs.paletteSelect.innerHTML = Array.from({ length: paletteCount }, (_, index) => {
            return `<option value="${index}">${index}</option>`;
        }).join('');
        refs.spritePickerCategoryFilter.innerHTML = [
            ['all', 'All sprites'],
            ['world', 'World items'],
            ['buttons', 'Buttons'],
            ['doors', 'Doors'],
            ['creatures', 'Creatures'],
            ['collectables', 'Collectables'],
            ['custom', 'Custom sprites']
        ].map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
        if (state.category === 'custom' && !selectableTypes.includes(state.typeByCategory.custom)) {
            state.typeByCategory.custom = selectableTypes[0] ?? '';
        }
        if (state.category !== 'custom' && !selectableTypes.includes(state.typeByCategory[state.category])) {
            state.typeByCategory[state.category] = selectableTypes[0] ?? '';
        }
    }

    function syncPaletteCount() {
        paletteCount = Math.max(state.paletteDefinitions.length, 1);
        state.palette = clamp(state.palette, 0, paletteCount - 1);
        state.selectedPaletteIndex = clamp(state.selectedPaletteIndex, 0, paletteCount - 1);
    }

    function paletteDefinitionsEqual(left: PaletteDefinition[], right: PaletteDefinition[]) {
        return stableStringify(left) === stableStringify(right);
    }

    function getPaletteUsageCounts() {
        const usageCounts = Array.from({ length: paletteCount }, () => 0);
        const addUsage = (value?: number | null) => {
            if (typeof value !== 'number' || value < 0 || value >= usageCounts.length) return;
            usageCounts[value] += 1;
        };
        const data = host.getRawWorldData();
        for (const block of data.worldMap) addUsage(typeof block.palette === 'number' ? block.palette : 0);
        for (const button of data.buttons) {
            addUsage(typeof button.palette === 'number' ? button.palette : 0);
            addUsage(typeof button.boxPalette === 'number' ? button.boxPalette : null);
        }
        for (const door of data.doors) {
            addUsage(typeof door.palette === 'number' ? door.palette : 0);
            addUsage(typeof door.palette_locked === 'number' ? door.palette_locked : null);
            addUsage(typeof door.palette_unlocked === 'number' ? door.palette_unlocked : null);
        }
        for (const creature of data.creatures) addUsage(typeof creature.palette === 'number' ? creature.palette : 0);
        for (const collectable of data.collectables) addUsage(typeof collectable.palette === 'number' ? collectable.palette : 0);
        return usageCounts;
    }

    function shiftPaletteReferences(snapshot: RawWorldData, removedIndex: number) {
        const adjust = (value?: number | null) => {
            if (typeof value !== 'number') return value;
            return value > removedIndex ? value - 1 : value;
        };
        const nextSnapshot = deepClone(snapshot);
        nextSnapshot.worldMap.forEach((block) => {
            if (typeof block.palette === 'number') {
                block.palette = adjust(block.palette) as number;
            }
        });
        nextSnapshot.buttons.forEach((button) => {
            if (typeof button.palette === 'number') button.palette = adjust(button.palette) as number;
            if (typeof button.boxPalette === 'number') button.boxPalette = adjust(button.boxPalette) as number;
        });
        nextSnapshot.doors.forEach((door) => {
            if (typeof door.palette === 'number') door.palette = adjust(door.palette) as number;
            if (typeof door.palette_locked === 'number') door.palette_locked = adjust(door.palette_locked) as number;
            if (typeof door.palette_unlocked === 'number') door.palette_unlocked = adjust(door.palette_unlocked) as number;
        });
        nextSnapshot.creatures.forEach((creature) => {
            if (typeof creature.palette === 'number') creature.palette = adjust(creature.palette) as number;
        });
        nextSnapshot.collectables.forEach((collectable) => {
            if (typeof collectable.palette === 'number') collectable.palette = adjust(collectable.palette) as number;
        });
        return nextSnapshot;
    }

    function renderPalettePreview() {
        const paletteDefinition = state.paletteDefinitions[state.selectedPaletteIndex] ?? [];
        const ctx = refs.palettePreviewCanvas.getContext('2d');
        if (!ctx) return;
        host.drawCustomPalettePreview(ctx, state.palettePreviewType, paletteDefinition, 1, true);
    }

    function updatePaletteUsageSummary() {
        const usageCounts = getPaletteUsageCounts();
        const selectedUsage = usageCounts[state.selectedPaletteIndex] ?? 0;
        refs.paletteUsage.textContent = `Palette ${state.selectedPaletteIndex} — ${selectedUsage} object${selectedUsage === 1 ? '' : 's'} currently use this index.${paletteDefinitionsEqual(state.paletteDefinitions, state.lastSavedPaletteDefinitions) ? '' : ' Unsaved palette changes.'}`;
    }

    function renderPaletteMappings() {
        refs.paletteMappings.innerHTML = '';
        const paletteDefinition = state.paletteDefinitions[state.selectedPaletteIndex] ?? [];
        for (const [index, entry] of paletteDefinition.entries()) {
            const row = document.createElement('div');
            row.className = 'world-designer-palette-row';

            const fromField = document.createElement('label');
            fromField.className = 'world-designer-field';
            fromField.textContent = 'Base color';
            const fromSelect = document.createElement('select');
            fromSelect.innerHTML = colorAliasNames.map((name) => `<option value="${name}">${name}</option>`).join('');
            fromSelect.value = entry.from;
            fromSelect.addEventListener('change', () => {
                paletteDefinition[index].from = fromSelect.value;
                renderPalettePreview();
                updatePaletteUsageSummary();
            });
            fromField.appendChild(fromSelect);

            const toField = document.createElement('label');
            toField.className = 'world-designer-field';
            toField.textContent = 'New color';
            const toSelect = document.createElement('select');
            toSelect.innerHTML = colorAliasNames.map((name) => `<option value="${name}">${name}</option>`).join('');
            toSelect.value = entry.to;
            toSelect.addEventListener('change', () => {
                paletteDefinition[index].to = toSelect.value;
                renderPalettePreview();
                updatePaletteUsageSummary();
            });
            toField.appendChild(toSelect);

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
                paletteDefinition.splice(index, 1);
                refreshPaletteDesigner();
            });

            row.appendChild(fromField);
            row.appendChild(toField);
            row.appendChild(removeButton);
            refs.paletteMappings.appendChild(row);
        }
    }

    function refreshPaletteDesigner() {
        syncPaletteCount();
        const usageCounts = getPaletteUsageCounts();
        refs.paletteFlyout.classList.toggle('world-designer-flyout-hidden', !state.paletteDesignerOpen || !state.active);
        refs.paletteDesignerToggle.textContent = state.paletteDesignerOpen ? 'Palettes ✓' : 'Palettes';
        refs.palettePreviewTypeSelect.value = state.palettePreviewType;
        refs.paletteList.innerHTML = state.paletteDefinitions
            .map((_, index) => `<option value="${index}">Palette ${index} (${usageCounts[index] ?? 0} use${(usageCounts[index] ?? 0) === 1 ? '' : 's'})</option>`)
            .join('');
        refs.paletteList.value = String(state.selectedPaletteIndex);
        refs.paletteCloneButton.disabled = state.paletteDefinitions.length === 0;
        refs.paletteDeleteButton.disabled = state.paletteDefinitions.length <= 1;
        renderPaletteMappings();
        renderPalettePreview();
        updatePaletteUsageSummary();
    }

    function createNewPalette() {
        state.paletteDefinitions.push([]);
        syncPaletteCount();
        state.selectedPaletteIndex = state.paletteDefinitions.length - 1;
        state.palette = clamp(state.palette, 0, paletteCount - 1);
        refreshSelectOptions();
        refreshPaletteDesigner();
        refreshPanel();
    }

    function cloneSelectedPalette() {
        const paletteDefinition = state.paletteDefinitions[state.selectedPaletteIndex];
        if (!paletteDefinition) return;
        state.paletteDefinitions.push(deepClone(paletteDefinition));
        syncPaletteCount();
        state.selectedPaletteIndex = state.paletteDefinitions.length - 1;
        refreshSelectOptions();
        refreshPaletteDesigner();
        refreshPanel();
    }

    async function deleteSelectedPalette() {
        if (state.paletteDefinitions.length <= 1) {
            setStatus('At least one palette must remain.', 'error');
            return;
        }
        const usageCounts = getPaletteUsageCounts();
        const removedIndex = state.selectedPaletteIndex;
        if ((usageCounts[removedIndex] ?? 0) > 0) {
            setStatus('Cannot delete a palette that is currently in use.', 'error');
            return;
        }

        let worldDataToSave: RawWorldData | undefined;
        if (removedIndex < state.paletteDefinitions.length - 1) {
            if (state.dirty) {
                setStatus('Save world changes before deleting a middle palette.', 'error');
                return;
            }
            worldDataToSave = shiftPaletteReferences(getWorldSnapshot(), removedIndex);
        }

        const nextPaletteDefinitions = state.paletteDefinitions.filter((_, index) => index !== removedIndex);
        try {
            setStatus('Saving palette changes...', 'neutral');
            await host.savePaletteDefinitions(nextPaletteDefinitions, worldDataToSave);
            state.paletteDefinitions = deepClone(nextPaletteDefinitions);
            state.lastSavedPaletteDefinitions = deepClone(nextPaletteDefinitions);
            if (worldDataToSave) {
                host.replaceRawWorldData(worldDataToSave);
                state.selection = null;
                state.selectedItems = [];
                state.lastSavedSnapshot = serializeWorldData(worldDataToSave);
                updateDirtyState();
                syncEditModeSnapshot();
            }
            syncPaletteCount();
            state.selectedPaletteIndex = clamp(state.selectedPaletteIndex, 0, paletteCount - 1);
            refreshSelectOptions();
            refreshPaletteDesigner();
            refreshPanel();
            setStatus('Deleted palette and saved palette assets.', 'success');
        } catch (error) {
            setStatus(
                error instanceof Error ? error.message : 'Failed to delete palette.',
                'error'
            );
        }
    }

    async function savePaletteDesigner() {
        try {
            setStatus('Saving palette definitions...', 'neutral');
            await host.savePaletteDefinitions(state.paletteDefinitions);
            state.lastSavedPaletteDefinitions = deepClone(state.paletteDefinitions);
            syncPaletteCount();
            refreshSelectOptions();
            refreshPaletteDesigner();
            refreshPanel();
            setStatus('Saved palette definitions.', 'success');
        } catch (error) {
            setStatus(
                error instanceof Error ? error.message : 'Failed to save palette definitions.',
                'error'
            );
        }
    }

    function renderSpritePreviewCanvas(
        canvas: HTMLCanvasElement,
        type: string,
        palette: number,
        rotation: number,
        translation: SpriteTranslation = 'center'
    ) {
        clearPreviewCanvas(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        return host.drawSpritePreview(ctx, type, palette, rotation, false, undefined, translation);
    }

    function renderButtonCompositePreviewCanvas(
        canvas: HTMLCanvasElement,
        button?: Button
    ) {
        clearPreviewCanvas(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const previewButton = button ?? createButtonEntity({
            x: 0,
            y: 0,
            palette: state.palette,
            rotation: state.rotation,
            collision: true,
            active: false,
            linkedDoors: []
        });
        const parts = previewButton.getRenderParts();
        const sourceTileSize = 32;
        const sourceRects = parts.map((part) => ({
            part,
            left: part.x,
            top: part.y,
            width: (part.cropLeftHalf || part.cropRightHalf) ? Math.floor(sourceTileSize / 2) : sourceTileSize,
            height: sourceTileSize
        }));
        const boxRect = sourceRects.find((rect) => rect.part.type === previewButton.boxType) ?? sourceRects[sourceRects.length - 1];
        if (!boxRect) {
            return false;
        }
        const boxCenterX = boxRect.left + boxRect.width / 2;
        const boxCenterY = boxRect.top + boxRect.height / 2;
        const minX = Math.min(...sourceRects.map((rect) => rect.left - boxCenterX));
        const minY = Math.min(...sourceRects.map((rect) => rect.top - boxCenterY));
        const maxX = Math.max(...sourceRects.map((rect) => rect.left + rect.width - boxCenterX));
        const maxY = Math.max(...sourceRects.map((rect) => rect.top + rect.height - boxCenterY));
        const padding = 8;
        const availableWidth = Math.max(1, canvas.width - padding * 2);
        const availableHeight = Math.max(1, canvas.height - padding * 2);
        const fixedPreviewSpan = sourceTileSize * 3.5;
        const fittedScale = Math.min(
            availableWidth / Math.max(1, maxX - minX),
            availableHeight / Math.max(1, maxY - minY)
        );
        const scale = Math.max(
            1,
            Math.min(
                fittedScale,
                Math.min(availableWidth, availableHeight) / fixedPreviewSpan
            )
        );
        const drawTileSize = Math.max(1, Math.round(sourceTileSize * scale));
        const anchorX = canvas.width / 2;
        const anchorY = canvas.height / 2;

        for (const rect of sourceRects) {
            const partCanvas = document.createElement('canvas');
            partCanvas.width = drawTileSize;
            partCanvas.height = drawTileSize;
            const partCtx = partCanvas.getContext('2d');
            if (!partCtx) {
                continue;
            }
            host.drawSpriteSample(
                partCtx,
                rect.part.type,
                rect.part.palette,
                rect.part.rotation,
                true,
                drawTileSize
            );
            const sourceWidth = (rect.part.cropLeftHalf || rect.part.cropRightHalf)
                ? Math.max(1, Math.floor(partCanvas.width / 2))
                : partCanvas.width;
            const sourceStartX = rect.part.cropRightHalf
                ? Math.max(0, partCanvas.width - sourceWidth)
                : 0;
            const destinationWidth = Math.max(1, Math.round(rect.width * scale));
            const destinationHeight = Math.max(1, Math.round(rect.height * scale));
            ctx.drawImage(
                partCanvas,
                sourceStartX,
                0,
                sourceWidth,
                partCanvas.height,
                Math.round(anchorX + (rect.left - boxCenterX) * scale),
                Math.round(anchorY + (rect.top - boxCenterY) * scale),
                destinationWidth,
                destinationHeight
            );
        }

        return true;
    }

    function drawSpriteAt(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        type: string,
        palette: number,
        rotation: number,
        translation: SpriteTranslation = 'center'
    ) {
        const spriteCanvas = document.createElement('canvas');
        spriteCanvas.width = TILE_SIZE;
        spriteCanvas.height = TILE_SIZE;
        const spriteCtx = spriteCanvas.getContext('2d');
        if (!spriteCtx) {
            return false;
        }
        const rendered = host.drawSpriteSample(
            spriteCtx,
            type,
            palette,
            rotation,
            true,
            TILE_SIZE,
            translation
        );
        if (!rendered) {
            return false;
        }
        ctx.drawImage(spriteCanvas, Math.round(x), Math.round(y));
        return true;
    }

    function drawButtonEntityAt(
        ctx: CanvasRenderingContext2D,
        button: Button,
        screenX: number,
        screenY: number
    ) {
        let rendered = false;
        for (const part of button.getRenderParts()) {
            const partCanvas = document.createElement('canvas');
            partCanvas.width = TILE_SIZE;
            partCanvas.height = TILE_SIZE;
            const partCtx = partCanvas.getContext('2d');
            if (!partCtx) {
                continue;
            }
            const partRendered = host.drawSpriteSample(
                partCtx,
                part.type,
                part.palette,
                part.rotation,
                true,
                TILE_SIZE
            );
            if (!partRendered) {
                continue;
            }
            rendered = true;
            const sourceWidth = (part.cropLeftHalf || part.cropRightHalf)
                ? Math.max(1, Math.floor(partCanvas.width / 2))
                : partCanvas.width;
            const sourceStartX = part.cropRightHalf
                ? Math.max(0, partCanvas.width - sourceWidth)
                : 0;
            const destinationWidth = (part.cropLeftHalf || part.cropRightHalf)
                ? Math.max(1, Math.floor(TILE_SIZE / 2))
                : TILE_SIZE;
            ctx.drawImage(
                partCanvas,
                sourceStartX,
                0,
                sourceWidth,
                partCanvas.height,
                Math.round(screenX + (part.x - button.x)),
                Math.round(screenY + (part.y - button.y)),
                destinationWidth,
                TILE_SIZE
            );
        }
        return rendered;
    }

    function getCustomSpriteDefinitionBounds(definition: CustomSpriteDefinition) {
        if (definition.members.length === 0) {
            return { left: 0, top: 0, right: TILE_SIZE, bottom: TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
        }
        const rects = definition.members.map((member) => {
            if (member.category === 'buttons') {
                return getEntityRect(new Button({
                    ...(deepClone(member.data) as ButtonSaveData),
                    x: member.offsetX,
                    y: member.offsetY
                }), 'buttons');
            }
            return getRectAtPosition(member.offsetX, member.offsetY, member.category);
        });
        const left = Math.min(...rects.map((rect) => rect.left));
        const top = Math.min(...rects.map((rect) => rect.top));
        const right = Math.max(...rects.map((rect) => rect.right));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top
        };
    }

    function drawCustomSpriteDefinitionAt(
        ctx: CanvasRenderingContext2D,
        definition: CustomSpriteDefinition,
        screenX: number,
        screenY: number
    ) {
        let rendered = false;
        for (const member of definition.members) {
            const memberX = screenX + member.offsetX;
            const memberY = screenY + member.offsetY;
            if (member.category === 'buttons') {
                rendered = drawButtonEntityAt(
                    ctx,
                    new Button({
                        ...(deepClone(member.data) as ButtonSaveData),
                        x: memberX,
                        y: memberY
                    }),
                    memberX,
                    memberY
                ) || rendered;
                continue;
            }
            const data = member.data as MapBlock | DoorSaveData | CreatureSaveData | CollectableSaveData;
            rendered = drawSpriteAt(
                ctx,
                memberX,
                memberY,
                data.type,
                typeof data.palette === 'number' ? data.palette : 0,
                normalizeRotation((data as MapBlock).rotation),
                member.category === 'world'
                    ? normalizeSpriteTranslation((data as MapBlock).translation)
                    : 'center'
            ) || rendered;
        }
        return rendered;
    }

    function renderCustomSpritePreviewCanvas(
        canvas: HTMLCanvasElement,
        definition: CustomSpriteDefinition | null
    ) {
        clearPreviewCanvas(canvas);
        if (!definition) {
            return false;
        }
        const bounds = getCustomSpriteDefinitionBounds(definition);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(1, Math.ceil(bounds.width));
        tempCanvas.height = Math.max(1, Math.ceil(bounds.height));
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
            return false;
        }
        const rendered = drawCustomSpriteDefinitionAt(tempCtx, definition, -bounds.left, -bounds.top);
        if (!rendered) {
            return false;
        }
        const visibleBounds = getSpriteVisibleBounds(tempCanvas);
        if (!visibleBounds) {
            return false;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return false;
        }
        const padding = 8;
        const availableWidth = Math.max(1, canvas.width - padding * 2);
        const availableHeight = Math.max(1, canvas.height - padding * 2);
        const scale = Math.min(
            availableWidth / Math.max(1, visibleBounds.width),
            availableHeight / Math.max(1, visibleBounds.height)
        );
        const drawWidth = Math.max(1, Math.round(visibleBounds.width * scale));
        const drawHeight = Math.max(1, Math.round(visibleBounds.height * scale));
        ctx.drawImage(
            tempCanvas,
            visibleBounds.minX,
            visibleBounds.minY,
            visibleBounds.width,
            visibleBounds.height,
            Math.round((canvas.width - drawWidth) / 2),
            Math.round((canvas.height - drawHeight) / 2),
            drawWidth,
            drawHeight
        );
        return true;
    }

    function renderCurrentSpritePreview() {
        const selectedButton = state.selection?.category === 'buttons' && getSelectedItems().length === 1
            ? state.selection.entity as Button
            : null;
        const selectedType = getCurrentType();
        const compositeButtonPreview = !selectedButton && state.category === 'buttons' && isButtonCompositeType(selectedType)
            ? createButtonEntity({
                x: 0,
                y: 0,
                rotation: state.rotation,
                collision: true,
                active: false,
                linkedDoors: []
            })
            : null;
        const customDefinition = state.category === 'custom'
            ? getCustomSpriteDefinitionById(getCurrentType())
            : null;
        const previewType = getPlacementPreviewType(selectedType);
        const type = state.category === 'buttons'
            ? selectedType
            : state.category === 'custom'
                ? (customDefinition?.name ?? 'Custom sprite')
                : previewType;
        const previewTranslation = (
            state.category === 'world' &&
            isTeleporterCompositeType(selectedType)
        )
            ? 'center'
            : (categorySupportsTranslation(state.category) ? state.translation : 'center');
        const rendered = selectedButton
            ? renderButtonCompositePreviewCanvas(refs.spritePreviewCanvas, selectedButton)
            : compositeButtonPreview
                ? renderButtonCompositePreviewCanvas(refs.spritePreviewCanvas, compositeButtonPreview)
            : state.category === 'buttons'
                ? renderSpritePreviewCanvas(
                refs.spritePreviewCanvas,
                previewType,
                state.palette,
                state.rotation,
                'center'
                )
            : state.category === 'custom'
                ? renderCustomSpritePreviewCanvas(refs.spritePreviewCanvas, customDefinition)
                : renderSpritePreviewCanvas(
                refs.spritePreviewCanvas,
                type,
                state.palette,
                state.rotation,
                previewTranslation
                );
        refs.spritePreviewMeta.textContent = rendered
            ? categorySupportsTranslation(state.category)
                ? `${type} — palette ${state.palette}, rotation ${state.rotation}, translation ${formatSpriteTranslation(state.translation)}`
                : selectedButton
                ? `${selectedButton.type} + ${selectedButton.boxType} — ${selectedButton.active ? 'open' : 'closed'} preview`
                : compositeButtonPreview
                    ? 'button (composite) — one drop places a full live button (cap + box)'
                : state.category === 'buttons'
                ? `${type} — place button/button_box sprites manually, then group and convert to make a live button`
                : state.category === 'world' && isTeleporterCompositeType(selectedType)
                    ? 'teleporter (composite) — one drop places base + pad + linked teleporter mechanism'
                : state.category === 'custom'
                    ? customDefinition
                        ? `${customDefinition.name} — ${customDefinition.members.length} part${customDefinition.members.length === 1 ? '' : 's'}`
                        : 'No custom sprites yet'
                : `${type} — palette ${state.palette}, rotation ${state.rotation}`
            : `${type} — preview unavailable`;
    }

    function isBackgroundSamplePixel(sample: Uint8ClampedArray, index: number) {
        return sample[index] === 0 &&
            sample[index + 1] === 0 &&
            sample[index + 2] === 0;
    }

    function isSameSampleColor(sample: Uint8ClampedArray, leftIndex: number, rightIndex: number) {
        return sample[leftIndex] === sample[rightIndex] &&
            sample[leftIndex + 1] === sample[rightIndex + 1] &&
            sample[leftIndex + 2] === sample[rightIndex + 2];
    }

    function getSampleColorKey(sample: Uint8ClampedArray, index: number) {
        return `${sample[index]},${sample[index + 1]},${sample[index + 2]}`;
    }

    function getSampleForegroundBounds(sample: Uint8ClampedArray) {
        let minX = PNG_IMPORT_SAMPLE_SIZE;
        let minY = PNG_IMPORT_SAMPLE_SIZE;
        let maxX = -1;
        let maxY = -1;

        for (let row = 0; row < PNG_IMPORT_SAMPLE_SIZE; row += 1) {
            for (let column = 0; column < PNG_IMPORT_SAMPLE_SIZE; column += 1) {
                const pixelIndex = (row * PNG_IMPORT_SAMPLE_SIZE + column) * 4;
                if (isBackgroundSamplePixel(sample, pixelIndex)) {
                    continue;
                }
                minX = Math.min(minX, column);
                minY = Math.min(minY, row);
                maxX = Math.max(maxX, column);
                maxY = Math.max(maxY, row);
            }
        }

        if (maxX < 0 || maxY < 0) {
            return null;
        }

        return {
            minX,
            minY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        };
    }


    function buildPaletteInvariantLabelMap(sample: Uint8ClampedArray) {
        const labels = new Uint16Array(sample.length / 4);
        const colorLabels = new Map<string, number>();
        let nextLabel = 1;

        for (let pixel = 0; pixel < labels.length; pixel += 1) {
            const index = pixel * 4;
            if (isBackgroundSamplePixel(sample, index)) {
                labels[pixel] = 0;
                continue;
            }

            const colorKey = getSampleColorKey(sample, index);
            let label = colorLabels.get(colorKey);
            if (!label) {
                label = nextLabel;
                colorLabels.set(colorKey, label);
                nextLabel += 1;
            }
            labels[pixel] = label;
        }

        return labels;
    }

    function hashUint8Array(data: Uint8ClampedArray) {
        let hash = 2166136261;
        for (let index = 0; index < data.length; index += 1) {
            hash ^= data[index];
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function hashUint16Array(data: Uint16Array) {
        let hash = 2166136261;
        for (let index = 0; index < data.length; index += 1) {
            hash ^= data[index];
            hash = Math.imul(hash, 16777619);
        }
        return hash >>> 0;
    }

    function normalizeSampleToForegroundOrigin(
        sample: Uint8ClampedArray,
        bounds: ReturnType<typeof getSampleForegroundBounds> = getSampleForegroundBounds(sample)
    ) {
        const normalizedSample = new Uint8ClampedArray(sample.length);
        if (!bounds) {
            return normalizedSample;
        }

        for (let row = 0; row < bounds.height; row += 1) {
            for (let column = 0; column < bounds.width; column += 1) {
                const sourceIndex = ((bounds.minY + row) * PNG_IMPORT_SAMPLE_SIZE + bounds.minX + column) * 4;
                const targetIndex = (row * PNG_IMPORT_SAMPLE_SIZE + column) * 4;
                normalizedSample[targetIndex] = sample[sourceIndex];
                normalizedSample[targetIndex + 1] = sample[sourceIndex + 1];
                normalizedSample[targetIndex + 2] = sample[sourceIndex + 2];
                normalizedSample[targetIndex + 3] = sample[sourceIndex + 3];
            }
        }

        return normalizedSample;
    }

    function buildPngImportSampleSignature(sample: Uint8ClampedArray): PngImportSampleSignature {
        const foregroundBounds = getSampleForegroundBounds(sample);
        const normalizedSample = normalizeSampleToForegroundOrigin(sample, foregroundBounds);
        const normalizedLabels = buildPaletteInvariantLabelMap(normalizedSample);
        let foregroundPixelCount = 0;
        for (let pixel = 0; pixel < normalizedLabels.length; pixel += 1) {
            if (normalizedLabels[pixel] !== 0) {
                foregroundPixelCount += 1;
            }
        }
        const sampleHash = hashUint8Array(normalizedSample).toString(36);
        const labelHash = hashUint16Array(normalizedLabels).toString(36);
        const matchKey = foregroundBounds
            ? `${foregroundPixelCount}:${foregroundBounds.minX},${foregroundBounds.minY},${foregroundBounds.width},${foregroundBounds.height}:${sampleHash}:${labelHash}`
            : `empty:${sampleHash}:${labelHash}`;

        return {
            normalizedSample,
            normalizedLabels,
            foregroundPixelCount,
            matchKey,
            foregroundBounds
        };
    }

    function renderPngImportSourceSample(
        sourceContext: CanvasRenderingContext2D,
        image: HTMLImageElement,
        tileSourceX: number,
        tileSourceY: number,
        tileSourceWidth: number,
        tileSourceHeight: number
    ) {
        sourceContext.fillStyle = '#000';
        sourceContext.fillRect(0, 0, sourceContext.canvas.width, sourceContext.canvas.height);

        const sourceLeft = Math.max(0, tileSourceX);
        const sourceTop = Math.max(0, tileSourceY);
        const sourceRight = Math.min(image.width, tileSourceX + tileSourceWidth);
        const sourceBottom = Math.min(image.height, tileSourceY + tileSourceHeight);
        const boundedWidth = sourceRight - sourceLeft;
        const boundedHeight = sourceBottom - sourceTop;
        if (boundedWidth <= 0 || boundedHeight <= 0) {
            return;
        }

        const destinationX = ((sourceLeft - tileSourceX) / tileSourceWidth) * sourceContext.canvas.width;
        const destinationY = ((sourceTop - tileSourceY) / tileSourceHeight) * sourceContext.canvas.height;
        const destinationWidth = (boundedWidth / tileSourceWidth) * sourceContext.canvas.width;
        const destinationHeight = (boundedHeight / tileSourceHeight) * sourceContext.canvas.height;

        sourceContext.drawImage(
            image,
            sourceLeft,
            sourceTop,
            boundedWidth,
            boundedHeight,
            destinationX,
            destinationY,
            destinationWidth,
            destinationHeight
        );
    }

    function getMedianNumber(values: number[]) {
        if (values.length === 0) {
            return 0;
        }
        const sortedValues = [...values].sort((left, right) => left - right);
        const middleIndex = Math.floor(sortedValues.length / 2);
        if (sortedValues.length % 2 === 1) {
            return sortedValues[middleIndex];
        }
        return (sortedValues[middleIndex - 1] + sortedValues[middleIndex]) / 2;
    }

    function getPngImportTranslatedBounds(
        bounds: NonNullable<PngImportSampleSignature['foregroundBounds']>,
        translation: SpriteTranslation
    ) {
        if (translation === 'top') {
            return {
                minX: bounds.minX,
                minY: 0,
                width: bounds.width,
                height: bounds.height
            };
        }
        if (translation === 'right') {
            return {
                minX: PNG_IMPORT_SAMPLE_SIZE - bounds.width,
                minY: bounds.minY,
                width: bounds.width,
                height: bounds.height
            };
        }
        if (translation === 'bottom') {
            return {
                minX: bounds.minX,
                minY: PNG_IMPORT_SAMPLE_SIZE - bounds.height,
                width: bounds.width,
                height: bounds.height
            };
        }
        if (translation === 'left') {
            return {
                minX: 0,
                minY: bounds.minY,
                width: bounds.width,
                height: bounds.height
            };
        }
        return bounds;
    }

    function getPngImportForegroundBoundsDifference(
        left: NonNullable<PngImportSampleSignature['foregroundBounds']>,
        right: NonNullable<PngImportSampleSignature['foregroundBounds']>
    ) {
        const leftMaxX = left.minX + left.width - 1;
        const leftMaxY = left.minY + left.height - 1;
        const rightMaxX = right.minX + right.width - 1;
        const rightMaxY = right.minY + right.height - 1;
        return Math.abs(left.minX - right.minX) +
            Math.abs(left.minY - right.minY) +
            Math.abs(leftMaxX - rightMaxX) +
            Math.abs(leftMaxY - rightMaxY);
    }

    function inferPngImportTranslation(
        sourceSignature: PngImportSampleSignature,
        candidateSignature: PngImportSampleSignature
    ): SpriteTranslation {
        const sourceBounds = sourceSignature.foregroundBounds;
        const candidateBounds = candidateSignature.foregroundBounds;
        if (!sourceBounds || !candidateBounds) {
            return 'center';
        }

        let bestTranslation: SpriteTranslation = 'center';
        let bestDifference = Number.POSITIVE_INFINITY;
        let centerDifference = Number.POSITIVE_INFINITY;

        for (const translation of SPRITE_TRANSLATION_OPTIONS) {
            const translatedBounds = getPngImportTranslatedBounds(candidateBounds, translation);
            const difference = getPngImportForegroundBoundsDifference(sourceBounds, translatedBounds);
            if (translation === 'center') {
                centerDifference = difference;
            }
            if (difference < bestDifference) {
                bestDifference = difference;
                bestTranslation = translation;
            }
        }

        return bestTranslation !== 'center' && bestDifference >= centerDifference
            ? 'center'
            : bestTranslation;
    }

    function matchPngImportSample(
        sourceSample: Uint8ClampedArray,
        candidates: PngImportCandidate[],
        column: number,
        row: number,
        sourceSignature: PngImportSampleSignature = buildPngImportSampleSignature(sourceSample)
    ): PngImportTileMatch {
        let bestCandidate = candidates[0];
        let bestScore = Number.POSITIVE_INFINITY;

        for (const candidate of candidates) {
            const score = compareImageData(sourceSignature, candidate.signature);
            if (score < bestScore) {
                bestScore = score;
                bestCandidate = candidate;
            }
        }

        return {
            bestCandidate,
            bestScore,
            sourceSignature,
            inferredTranslation: inferPngImportTranslation(sourceSignature, bestCandidate.signature),
            column,
            row
        };
    }

    function inferPngImportSourceGridOffset(matches: PngImportTileMatch[]) {
        const offsetXValues: number[] = [];
        const offsetYValues: number[] = [];

        for (const match of matches) {
            const sourceBounds = match.sourceSignature.foregroundBounds;
            const candidateBounds = match.bestCandidate.signature.foregroundBounds;
            if (!sourceBounds || !candidateBounds) {
                continue;
            }
            if (!Number.isFinite(match.bestScore) || match.bestScore >= PNG_IMPORT_WARNING_SCORE * 1.5) {
                continue;
            }
            const hasPlacementSignal = sourceBounds.width < PNG_IMPORT_SAMPLE_SIZE ||
                sourceBounds.height < PNG_IMPORT_SAMPLE_SIZE ||
                candidateBounds.width < PNG_IMPORT_SAMPLE_SIZE ||
                candidateBounds.height < PNG_IMPORT_SAMPLE_SIZE;
            if (!hasPlacementSignal) {
                continue;
            }
            offsetXValues.push(sourceBounds.minX - candidateBounds.minX);
            offsetYValues.push(sourceBounds.minY - candidateBounds.minY);
        }

        return {
            x: clamp(Math.round(getMedianNumber(offsetXValues)), -PNG_IMPORT_SAMPLE_SIZE + 1, PNG_IMPORT_SAMPLE_SIZE - 1),
            y: clamp(Math.round(getMedianNumber(offsetYValues)), -PNG_IMPORT_SAMPLE_SIZE + 1, PNG_IMPORT_SAMPLE_SIZE - 1)
        };
    }

    function compareImageData(leftSignature: PngImportSampleSignature, rightSignature: PngImportSampleSignature) {
        if (leftSignature.foregroundPixelCount === 0 || rightSignature.foregroundPixelCount === 0) {
            return leftSignature.foregroundPixelCount === rightSignature.foregroundPixelCount
                ? 0
                : Number.POSITIVE_INFINITY;
        }

        const left = leftSignature.normalizedSample;
        const right = rightSignature.normalizedSample;
        const sampleWidth = PNG_IMPORT_SAMPLE_SIZE;
        const sampleHeight = PNG_IMPORT_SAMPLE_SIZE;
        const leftLabels = leftSignature.normalizedLabels;
        const rightLabels = rightSignature.normalizedLabels;
        let totalDifference = 0;
        let comparisonCount = 0;
        let totalPaletteDifference = 0;
        let paletteComparisonCount = 0;

        for (let row = 0; row < sampleHeight; row += 1) {
            for (let column = 0; column < sampleWidth; column += 1) {
                const pixelIndex = (row * sampleWidth + column) * 4;
                const pixelNumber = row * sampleWidth + column;
                const leftIsBackground = isBackgroundSamplePixel(left, pixelIndex);
                const rightIsBackground = isBackgroundSamplePixel(right, pixelIndex);
                totalDifference += leftIsBackground === rightIsBackground ? 0 : 255;
                comparisonCount += 1;

                totalDifference += leftLabels[pixelNumber] === rightLabels[pixelNumber] ? 0 : 255;
                comparisonCount += 1;

                if (!leftIsBackground && !rightIsBackground) {
                    totalPaletteDifference += (
                        Math.abs(left[pixelIndex] - right[pixelIndex]) +
                        Math.abs(left[pixelIndex + 1] - right[pixelIndex + 1]) +
                        Math.abs(left[pixelIndex + 2] - right[pixelIndex + 2])
                    ) / 3;
                    paletteComparisonCount += 1;
                }

                if (column < sampleWidth - 1) {
                    const rightPixelIndex = pixelIndex + 4;
                    const rightPixelNumber = pixelNumber + 1;
                    const leftHorizontalMatch = isSameSampleColor(left, pixelIndex, rightPixelIndex);
                    const rightHorizontalMatch = isSameSampleColor(right, pixelIndex, rightPixelIndex);
                    totalDifference += leftHorizontalMatch === rightHorizontalMatch ? 0 : 255;
                    comparisonCount += 1;
                    totalDifference += (leftLabels[pixelNumber] === leftLabels[rightPixelNumber]) ===
                        (rightLabels[pixelNumber] === rightLabels[rightPixelNumber]) ? 0 : 255;
                    comparisonCount += 1;
                }

                if (row < sampleHeight - 1) {
                    const belowPixelIndex = pixelIndex + sampleWidth * 4;
                    const belowPixelNumber = pixelNumber + sampleWidth;
                    const leftVerticalMatch = isSameSampleColor(left, pixelIndex, belowPixelIndex);
                    const rightVerticalMatch = isSameSampleColor(right, pixelIndex, belowPixelIndex);
                    totalDifference += leftVerticalMatch === rightVerticalMatch ? 0 : 255;
                    comparisonCount += 1;
                    totalDifference += (leftLabels[pixelNumber] === leftLabels[belowPixelNumber]) ===
                        (rightLabels[pixelNumber] === rightLabels[belowPixelNumber]) ? 0 : 255;
                    comparisonCount += 1;
                }
            }
        }

        const structuralScore = comparisonCount > 0 ? totalDifference / comparisonCount : Number.POSITIVE_INFINITY;
        if (!Number.isFinite(structuralScore)) {
            return structuralScore;
        }
        const paletteScore = paletteComparisonCount > 0
            ? totalPaletteDifference / paletteComparisonCount
            : 255;
        return structuralScore + (paletteScore * PNG_IMPORT_PALETTE_SCORE_WEIGHT);
    }

    function loadImage(url: string) {
        const cached = pngImportImageCache.get(url);
        if (cached) {
            return cached;
        }
        const promise = new Promise<HTMLImageElement>((resolve, reject) => {
            const image = new Image();
            image.onload = () => resolve(image);
            image.onerror = () => {
                pngImportImageCache.delete(url);
                reject(new Error(`Failed to load PNG at ${url}. Use a browser-served path such as ./src/assets/MAP-Exile-BC.png.`));
            };
            image.src = url;
        });
        pngImportImageCache.set(url, promise);
        return promise;
    }

    function getDefaultImportWorldRect() {
        const worldSelections = getSelectedItems().filter((selection) => selection.category === 'world');
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

    function getPngImportPreviewTileSize(columns: number, rows: number) {
        const largestDimension = Math.max(columns, rows, 1);
        return clamp(
            Math.floor(PNG_IMPORT_PREVIEW_MAX_DIMENSION / largestDimension),
            PNG_IMPORT_PREVIEW_MIN_TILE_SIZE,
            PNG_IMPORT_PREVIEW_MAX_TILE_SIZE
        );
    }

    async function buildPngImportCandidates(
        onProgress?: (progress: PngImportProgress) => void | Promise<void>
    ) {
        const snapshot = host.getRawWorldData();
        const typeDefaults = getPngImportTypeDefaults(snapshot);

        const typeNames = getPngImportTypeNames(snapshot);
        const candidateKey = JSON.stringify({
            paletteCount,
            typeNames,
            typeDefaults: typeNames.map((type) => {
                const defaults = typeDefaults.get(type) ?? { collision: true, maskAstronaut: false };
                return [type, defaults.collision, defaults.maskAstronaut];
            })
        });
        if (pngImportCandidateCache?.key === candidateKey) {
            if (onProgress) {
                await onProgress({
                    phase: 'Preparing sprite candidates',
                    completed: 1,
                    total: 1,
                    detail: 'Reusing cached sprite candidates.'
                });
            }
            return pngImportCandidateCache.candidates;
        }

        const sampleCanvas = document.createElement('canvas');
        sampleCanvas.width = PNG_IMPORT_SAMPLE_SIZE;
        sampleCanvas.height = PNG_IMPORT_SAMPLE_SIZE;
        const sampleContext = sampleCanvas.getContext('2d');
        if (!sampleContext) {
            throw new Error('Could not create a canvas context for PNG import.');
        }
        sampleContext.imageSmoothingEnabled = false;

        const candidates: PngImportCandidate[] = [];
        const totalCandidateRenders = Math.max(1, typeNames.length * paletteCount * 7);
        let processedCandidateRenders = 0;
        let lastYield = 0;

        for (const type of typeNames) {
            const defaults = typeDefaults.get(type) ?? { collision: true, maskAstronaut: false };
            for (let palette = 0; palette < paletteCount; palette += 1) {
                for (let rotation = 1; rotation <= 7; rotation += 1) {
                    processedCandidateRenders += 1;
                    sampleContext.fillStyle = '#000';
                    sampleContext.fillRect(0, 0, sampleCanvas.width, sampleCanvas.height);
                    const rendered = host.drawSpriteSample(
                        sampleContext,
                        type,
                        palette,
                        rotation,
                        false,
                        PNG_IMPORT_SAMPLE_SIZE
                    );
                    if (!rendered) {
                        continue;
                    }
                    const candidateSample = new Uint8ClampedArray(
                        sampleContext.getImageData(0, 0, sampleCanvas.width, sampleCanvas.height).data
                    );
                    candidates.push({
                        type,
                        palette,
                        rotation,
                        collision: defaults.collision,
                        maskAstronaut: defaults.maskAstronaut,
                        signature: buildPngImportSampleSignature(candidateSample)
                    });
                    if (onProgress && (
                        processedCandidateRenders === totalCandidateRenders ||
                        processedCandidateRenders - lastYield >= Math.max(8, Math.floor(totalCandidateRenders / 20))
                    )) {
                        lastYield = processedCandidateRenders;
                        await onProgress({
                            phase: 'Preparing sprite candidates',
                            completed: processedCandidateRenders,
                            total: totalCandidateRenders,
                            detail: `Rendering ${type} palette ${palette}, rotation ${rotation}.`
                        });
                        await yieldToUi();
                    }
                }
            }
        }

        if (candidates.length === 0) {
            throw new Error('PNG import could not build any world-tile candidates from the current sprite catalog.');
        }

        pngImportCandidateCache = {
            key: candidateKey,
            candidates
        };
        return candidates;
    }

    async function buildPngImportDraftFromImage(image: HTMLImageElement, config: {
        sourceX: number;
        sourceY: number;
        sourceWidth: number;
        sourceHeight: number;
        worldX: number;
        worldY: number;
        worldWidth: number;
        worldHeight: number;
        activeTileIndexes?: Set<number>;
        allowGridOffsetInference?: boolean;
    }, onProgress?: (progress: PngImportProgress) => void | Promise<void>) {
        const worldWidth = Math.max(1, Math.round(config.worldWidth));
        const worldHeight = Math.max(1, Math.round(config.worldHeight));
        const worldX = Math.round(config.worldX);
        const worldY = Math.round(config.worldY);

        const sourceWidth = Math.max(1, Math.round(config.sourceWidth));
        const sourceHeight = Math.max(1, Math.round(config.sourceHeight));
        if (onProgress) {
            await onProgress({
                phase: 'Preparing PNG source',
                completed: 1,
                total: 1,
                detail: 'Using the prepared source image for matching.'
            });
            await yieldToUi();
        }
        const sourceX = clamp(Math.round(config.sourceX), 0, Math.max(0, image.width - 1));
        const sourceY = clamp(Math.round(config.sourceY), 0, Math.max(0, image.height - 1));
        const boundedSourceWidth = Math.min(sourceWidth, image.width - sourceX);
        const boundedSourceHeight = Math.min(sourceHeight, image.height - sourceY);

        if (boundedSourceWidth <= 0 || boundedSourceHeight <= 0) {
            throw new Error('The selected PNG source region is outside the image bounds.');
        }

        const columns = getPngImportSourceTileCount(boundedSourceWidth);
        const rows = getPngImportSourceTileCount(boundedSourceHeight);
        const tileIndexes = config.activeTileIndexes
            ? [...config.activeTileIndexes].sort((left, right) => left - right)
            : Array.from({ length: columns * rows }, (_, index) => index);
        const tileCount = tileIndexes.length;
        if (!config.activeTileIndexes && tileCount > PNG_IMPORT_MAX_TILES) {
            throw new Error(`PNG import is limited to ${PNG_IMPORT_MAX_TILES} tiles per pass. Reduce the region size and try again.`);
        }
        const matchingBatchSize = config.activeTileIndexes ? PNG_IMPORT_MAX_TILES : tileCount;
        const worldTileWidth = worldWidth / columns;
        const worldTileHeight = worldHeight / rows;

        const candidates = await buildPngImportCandidates(onProgress);
        const sourceCanvas = document.createElement('canvas');
        sourceCanvas.width = PNG_IMPORT_SAMPLE_SIZE;
        sourceCanvas.height = PNG_IMPORT_SAMPLE_SIZE;
        const sourceContext = sourceCanvas.getContext('2d');
        if (!sourceContext) {
            throw new Error('Could not create a source canvas for PNG import.');
        }
        sourceContext.imageSmoothingEnabled = false;
        const sourceImageData = sourceContext.createImageData(sourceCanvas.width, sourceCanvas.height);
        const tileSourceWidth = boundedSourceWidth / columns;
        const tileSourceHeight = boundedSourceHeight / rows;
        const matchCache = new Map<string, {
            bestCandidate: PngImportCandidate;
            bestScore: number;
            sourceSignature: PngImportSampleSignature;
            inferredTranslation: SpriteTranslation;
        }>();

        const runMatchingPass = async (
            gridOffsetX: number,
            gridOffsetY: number,
            phase: string
        ) => {
            const importedBlocks: Array<MapBlock | null> = new Array<MapBlock | null>(columns * rows).fill(null);
            const tileMatches: PngImportTileMatch[] = [];
            let uncertainTiles = 0;
            const lowConfidenceTileIndexes: number[] = [];
            let processedTiles = 0;

            for (let batchStart = 0; batchStart < tileIndexes.length; batchStart += matchingBatchSize) {
                const batchTileIndexes = tileIndexes.slice(batchStart, batchStart + matchingBatchSize);
                for (const tileIndex of batchTileIndexes) {
                    const row = Math.floor(tileIndex / columns);
                    const column = tileIndex % columns;
                    const tileSourceY = sourceY + gridOffsetY + (row * tileSourceHeight);
                    const tileSourceX = sourceX + gridOffsetX + (column * tileSourceWidth);
                    renderPngImportSourceSample(
                        sourceContext,
                        image,
                        tileSourceX,
                        tileSourceY,
                        tileSourceWidth,
                        tileSourceHeight
                    );

                    sourceImageData.data.set(sourceContext.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height).data);
                    const sourceSample = new Uint8ClampedArray(sourceImageData.data);
                    const sourceSignature = buildPngImportSampleSignature(sourceSample);
                    const cachedMatch = matchCache.get(sourceSignature.matchKey);
                    const tileMatch = cachedMatch
                        ? {
                            ...cachedMatch,
                            column,
                            row
                        }
                        : matchPngImportSample(sourceSample, candidates, column, row, sourceSignature);
                    if (!cachedMatch) {
                        matchCache.set(sourceSignature.matchKey, {
                            bestCandidate: tileMatch.bestCandidate,
                            bestScore: tileMatch.bestScore,
                            sourceSignature: tileMatch.sourceSignature,
                            inferredTranslation: tileMatch.inferredTranslation
                        });
                    }
                    tileMatches.push(tileMatch);

                    if (tileMatch.bestScore >= PNG_IMPORT_WARNING_SCORE) {
                        uncertainTiles += 1;
                        lowConfidenceTileIndexes.push(tileIndex);
                    }

                    importedBlocks[tileIndex] = {
                        x: Math.round(worldX + column * worldTileWidth),
                        y: Math.round(worldY + row * worldTileHeight),
                        type: tileMatch.bestCandidate.type,
                        collision: tileMatch.bestCandidate.collision,
                        maskAstronaut: tileMatch.bestCandidate.maskAstronaut,
                        palette: tileMatch.bestCandidate.palette,
                        rotation: normalizeRotation(tileMatch.bestCandidate.rotation) as MapBlock['rotation'],
                        translation: tileMatch.inferredTranslation
                    };
                    processedTiles += 1;
                }

                if (onProgress) {
                    await onProgress({
                        phase,
                        completed: processedTiles,
                        total: tileCount,
                        detail: config.activeTileIndexes
                            ? `Processed ${processedTiles} of ${tileCount} selected tiles.`
                            : `Processed ${processedTiles} of ${tileCount} tiles.`
                    });
                    await yieldToUi();
                }
            }

            return {
                importedBlocks,
                tileMatches,
                uncertainTiles,
                lowConfidenceTileIndexes
            };
        };

        const initialPass = await runMatchingPass(0, 0, 'Matching source tiles');
        const shouldInferGridOffset = config.allowGridOffsetInference !== false;
        const inferredGridOffset = shouldInferGridOffset
            ? inferPngImportSourceGridOffset(initialPass.tileMatches)
            : { x: 0, y: 0 };
        const finalPass = shouldInferGridOffset && (inferredGridOffset.x !== 0 || inferredGridOffset.y !== 0)
            ? await runMatchingPass(inferredGridOffset.x, inferredGridOffset.y, 'Refining source alignment')
            : initialPass;

        return {
            blocks: finalPass.importedBlocks,
            columns,
            rows,
            worldX,
            worldY,
            worldWidth,
            worldHeight,
            uncertainTiles: finalPass.uncertainTiles,
            lowConfidenceTileIndexes: finalPass.lowConfidenceTileIndexes,
            sourceGridOffsetX: inferredGridOffset.x,
            sourceGridOffsetY: inferredGridOffset.y
        };
    }

    async function buildPngImportDraftFromPng(config: {
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
    }, onProgress?: (progress: PngImportProgress) => void | Promise<void>) {
        const url = config.url.trim();
        if (!url) {
            throw new Error('Enter a PNG URL before importing.');
        }
        if (onProgress) {
            await onProgress({
                phase: 'Loading PNG',
                completed: 0,
                total: 1,
                detail: 'Loading PNG metadata and source image.'
            });
            await yieldToUi();
        }
        const image = await loadImage(url);
        return buildPngImportDraftFromImage(image, config, onProgress);
    }

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
        const draft = await buildPngImportDraftFromPng(config);
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
        const currentType = getCurrentType();
        const filter = state.spritePickerFilter.trim().toLowerCase();
        const activeCategoryFilter = filter.length > 0 ? 'all' : state.spritePickerCategoryFilter;
        type PickerEntry = {
            key: string;
            name: string;
            label: string;
            category: DesignerCategory;
            previewType?: string;
        };
        const compositePickerEntries: PickerEntry[] = [];
        if (
            state.category === 'world' ||
            activeCategoryFilter === 'all' ||
            activeCategoryFilter === 'world'
        ) {
            compositePickerEntries.push({
                key: `sprite:${TELEPORTER_COMPOSITE_TYPE}`,
                name: TELEPORTER_COMPOSITE_TYPE,
                label: 'teleporter (composite)',
                category: 'world',
                previewType: 'teleporter'
            });
        }
        if (
            state.category === 'buttons' ||
            activeCategoryFilter === 'all' ||
            activeCategoryFilter === 'buttons'
        ) {
            compositePickerEntries.push({
                key: `sprite:${BUTTON_COMPOSITE_TYPE}`,
                name: BUTTON_COMPOSITE_TYPE,
                label: 'button (composite)',
                category: 'buttons',
                previewType: 'button'
            });
        }
        const spriteCategorySets = (() => {
            const data = host.getRawWorldData();
            const buttons = new Set<string>(['button', 'button_box']);
            for (const button of data.buttons) {
                if (button.type) buttons.add(button.type);
                if (button.boxType) buttons.add(button.boxType);
            }
            const doors = new Set<string>(data.doors.map((door) => door.type));
            const creatures = new Set<string>(data.creatures.map((creature) => creature.type));
            const collectables = new Set<string>(data.collectables.map((collectable) => collectable.type));
            const world = new Set<string>(spriteTypes.filter((type) =>
                !buttons.has(type) &&
                !doors.has(type) &&
                !creatures.has(type) &&
                !collectables.has(type)
            ));
            return { world, buttons, doors, creatures, collectables } satisfies Record<RuntimeDesignerCategory, Set<string>>;
        })();
        const pickerEntries: PickerEntry[] = state.category === 'custom' || activeCategoryFilter === 'custom'
            ? state.customSpriteDefinitions.map((definition) => ({
                key: `custom:${definition.id}`,
                name: definition.id,
                label: definition.name,
                category: 'custom' as const
            }))
            : [
                ...compositePickerEntries,
                ...spriteCatalog.map((entry) => ({
                    key: `sprite:${entry.name}`,
                    name: entry.name,
                    label: entry.name,
                    category: state.category as DesignerCategory
                }))
            ];
        const activeKeys = new Set(pickerEntries.map((entry) => entry.key));

        for (const entry of pickerEntries) {
            let button = spritePickerButtons.get(entry.key);
            if (!button) {
                button = document.createElement('button');
                button.type = 'button';
                button.className = 'world-designer-sprite-option';
                button.dataset.spriteType = entry.name;

                const canvas = document.createElement('canvas');
                canvas.className = 'world-designer-sprite-canvas';
                canvas.width = 56;
                canvas.height = 56;
                button.appendChild(canvas);

                const label = document.createElement('div');
                label.className = 'world-designer-sprite-option-label';
                label.textContent = entry.label;
                button.appendChild(label);

                button.addEventListener('click', () => {
                    state.category = entry.category;
                    setCurrentType(entry.name);
                    state.spritePickerOpen = false;
                    refreshPanel();
                });
                button.addEventListener('mousedown', (event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    state.category = entry.category;
                    setCurrentType(entry.name);
                    const dragTranslation = (
                        entry.category === 'world' &&
                        isTeleporterCompositeType(entry.name)
                    )
                        ? 'center'
                        : state.translation;
                    state.pickerDrag = {
                        category: entry.category,
                        type: entry.name,
                        palette: state.palette,
                        rotation: state.rotation,
                        translation: dragTranslation
                    };
                    state.pickerDragCanvas = null;
                    button!.classList.add('dragging');
                    setStatus(`Dragging ${entry.label} onto the world to place it.`, 'neutral');
                });

                spritePickerButtons.set(entry.key, button);
                refs.spritePickerGrid.appendChild(button);
            }

            const matchesFilter = filter.length === 0 || entry.label.toLowerCase().includes(filter);
            const matchesCategory = state.category === 'custom' ||
                activeCategoryFilter === 'all' ||
                activeCategoryFilter === 'custom' ||
                (entry.name === TELEPORTER_COMPOSITE_TYPE && activeCategoryFilter === 'world') ||
                (entry.name === BUTTON_COMPOSITE_TYPE && activeCategoryFilter === 'buttons') ||
                spriteCategorySets[activeCategoryFilter].has(entry.name);
            button.hidden = !matchesFilter;
            button.style.display = matchesFilter && matchesCategory ? '' : 'none';
            button.hidden = !(matchesFilter && matchesCategory);
            button.classList.toggle('selected', entry.name === currentType);
            button.classList.toggle('dragging', state.pickerDrag?.type === entry.name);
            const label = button.querySelector('.world-designer-sprite-option-label');
            if (label instanceof HTMLDivElement) {
                label.textContent = entry.label;
            }
            const canvas = button.querySelector('canvas');
            if (canvas instanceof HTMLCanvasElement) {
                if (entry.category === 'custom') {
                    renderCustomSpritePreviewCanvas(canvas, getCustomSpriteDefinitionById(entry.name));
                } else {
                    renderSpritePreviewCanvas(
                        canvas,
                        entry.previewType ?? entry.name,
                        state.palette,
                        1,
                        entry.category === 'world' && !isTeleporterCompositeType(entry.name)
                            ? state.translation
                            : 'center'
                    );
                }
            }
        }

        for (const [key, button] of spritePickerButtons.entries()) {
            if (activeKeys.has(key)) {
                continue;
            }
            button.style.display = 'none';
            button.hidden = true;
        }
    }

    function drawMagnifier(ctx: CanvasRenderingContext2D) {
        if (!state.active || !state.magnifierEnabled || !state.lastPointerCanvas) {
            return;
        }

        const sampleWidth = magnifierCanvas.width;
        const sampleHeight = magnifierCanvas.height;
        const sourceX = clamp(
            Math.round(state.lastPointerCanvas.x - sampleWidth / 2),
            0,
            Math.max(0, host.canvas.width - sampleWidth)
        );
        const sourceY = clamp(
            Math.round(state.lastPointerCanvas.y - sampleHeight / 2),
            0,
            Math.max(0, host.canvas.height - sampleHeight)
        );

        const magnifierCtx = magnifierCanvas.getContext('2d');
        if (!magnifierCtx) {
            return;
        }
        magnifierCtx.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
        magnifierCtx.imageSmoothingEnabled = false;
        magnifierCtx.drawImage(
            host.canvas,
            sourceX,
            sourceY,
            sampleWidth,
            sampleHeight,
            0,
            0,
            magnifierCanvas.width,
            magnifierCanvas.height
        );

        const radius = MAGNIFIER_SIZE / 2;
        const lensX = clamp(
            state.lastPointerCanvas.x + MAGNIFIER_CURSOR_OFFSET,
            radius + 8,
            host.canvas.width - radius - 8
        );
        const lensY = clamp(
            state.lastPointerCanvas.y + MAGNIFIER_CURSOR_OFFSET,
            radius + 8,
            host.canvas.height - radius - 8
        );

        ctx.save();
        ctx.beginPath();
        ctx.arc(lensX, lensY, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fill();
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            magnifierCanvas,
            0,
            0,
            magnifierCanvas.width,
            magnifierCanvas.height,
            lensX - radius,
            lensY - radius,
            MAGNIFIER_SIZE,
            MAGNIFIER_SIZE
        );
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lensX, lensY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lensX - 12, lensY);
        ctx.lineTo(lensX + 12, lensY);
        ctx.moveTo(lensX, lensY - 12);
        ctx.lineTo(lensX, lensY + 12);
        ctx.stroke();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.fillRect(lensX - radius, lensY + radius - 22, 72, 20);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(`${MAGNIFIER_ZOOM}x`, lensX - radius + 8, lensY + radius - 8);
        ctx.restore();
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

    function buildObjectSnapGuide(
        axis: 'x' | 'y',
        mode: 'dock' | 'align',
        movingRect: Rect,
        targetRect: Rect,
        targetEdge: 'left' | 'right' | 'top' | 'bottom'
    ): ObjectSnapGuide {
        if (axis === 'x') {
            const span = getGuideSpan(movingRect.top, movingRect.bottom, targetRect.top, targetRect.bottom);
            const x = targetEdge === 'left' ? targetRect.left : targetRect.right;
            return {
                axis,
                mode,
                targetRect,
                line: {
                    start: { x, y: span.start },
                    end: { x, y: span.end }
                }
            };
        }

        const span = getGuideSpan(movingRect.left, movingRect.right, targetRect.left, targetRect.right);
        const y = targetEdge === 'top' ? targetRect.top : targetRect.bottom;
        return {
            axis,
            mode,
            targetRect,
            line: {
                start: { x: span.start, y },
                end: { x: span.end, y }
            }
        };
    }

    function getObjectSnapMode(ctrlKey: boolean, altKey: boolean): ObjectSnapMode {
        if (ctrlKey && altKey) {
            return 'both';
        }
        if (ctrlKey) {
            return 'dock';
        }
        if (altKey) {
            return 'align';
        }
        return state.objectSnapEnabled ? 'dock' : 'none';
    }

    function isObjectSnapModeEnabled(mode: ObjectSnapMode, type: 'dock' | 'align') {
        return mode === 'both' || mode === type;
    }

    function findObjectSnapMatch(
        movingRect: Rect,
        snapMode: ObjectSnapMode,
        excludedEntities: Set<any> = new Set<any>()
    ): ObjectSnapResolution {
        if (snapMode === 'none') {
            return {
                x: null,
                y: null,
                guides: []
            };
        }

        let bestXMatch: ObjectSnapMatch | null = null;
        let bestYMatch: ObjectSnapMatch | null = null;
        const movingCenterX = movingRect.left + movingRect.width / 2;
        const movingCenterY = movingRect.top + movingRect.height / 2;

        function shouldReplaceSnapMatch(current: ObjectSnapMatch | null, next: ObjectSnapMatch) {
            return !current ||
                next.distance < current.distance ||
                (next.distance === current.distance && next.alignmentGap < current.alignmentGap) ||
                (
                    next.distance === current.distance &&
                    next.alignmentGap === current.alignmentGap &&
                    next.mode === 'dock' &&
                    current.mode === 'align'
                );
        }

        for (const candidate of getHitCandidates()) {
            if (!state.layerVisibility[candidate.category] || excludedEntities.has(candidate.entity)) {
                continue;
            }

            const targetRect = getEntityRect(candidate.entity, candidate.category);
            const targetCenterX = targetRect.left + targetRect.width / 2;
            const targetCenterY = targetRect.top + targetRect.height / 2;
            const horizontalAlignmentGap = getRangeGap(movingRect.left, movingRect.right, targetRect.left, targetRect.right);
            const verticalAlignmentGap = getRangeGap(movingRect.top, movingRect.bottom, targetRect.top, targetRect.bottom);
            const candidates: ObjectSnapMatch[] = [];

            if (isObjectSnapModeEnabled(snapMode, 'dock') && horizontalAlignmentGap <= OBJECT_SNAP_ALIGNMENT_THRESHOLD) {
                const snapAboveTarget = movingCenterY <= targetCenterY;
                const delta = snapAboveTarget
                    ? targetRect.top - movingRect.bottom
                    : targetRect.bottom - movingRect.top;
                const snappedRect = {
                    ...movingRect,
                    top: movingRect.top + delta,
                    bottom: movingRect.bottom + delta
                };
                const distance = Math.abs(delta);
                if (distance <= OBJECT_SNAP_THRESHOLD) {
                    candidates.push({
                        axis: 'y',
                        mode: 'dock',
                        delta,
                        distance,
                        alignmentGap: horizontalAlignmentGap,
                        guide: buildObjectSnapGuide(
                            'y',
                            'dock',
                            snappedRect,
                            targetRect,
                            snapAboveTarget ? 'top' : 'bottom'
                        )
                    });
                }
            }

            if (isObjectSnapModeEnabled(snapMode, 'dock') && verticalAlignmentGap <= OBJECT_SNAP_ALIGNMENT_THRESHOLD) {
                const snapLeftOfTarget = movingCenterX <= targetCenterX;
                const delta = snapLeftOfTarget
                    ? targetRect.left - movingRect.right
                    : targetRect.right - movingRect.left;
                const snappedRect = {
                    ...movingRect,
                    left: movingRect.left + delta,
                    right: movingRect.right + delta
                };
                const distance = Math.abs(delta);
                if (distance <= OBJECT_SNAP_THRESHOLD) {
                    candidates.push({
                        axis: 'x',
                        mode: 'dock',
                        delta,
                        distance,
                        alignmentGap: verticalAlignmentGap,
                        guide: buildObjectSnapGuide(
                            'x',
                            'dock',
                            snappedRect,
                            targetRect,
                            snapLeftOfTarget ? 'left' : 'right'
                        )
                    });
                }
            }

            if (isObjectSnapModeEnabled(snapMode, 'align') && horizontalAlignmentGap <= OBJECT_SNAP_ALIGNMENT_THRESHOLD) {
                const alignToTop = Math.abs(movingRect.top - targetRect.top) <= Math.abs(movingRect.bottom - targetRect.bottom);
                const delta = alignToTop
                    ? targetRect.top - movingRect.top
                    : targetRect.bottom - movingRect.bottom;
                const snappedRect = {
                    ...movingRect,
                    top: movingRect.top + delta,
                    bottom: movingRect.bottom + delta
                };
                const distance = Math.abs(delta);
                if (distance <= OBJECT_SNAP_THRESHOLD) {
                    candidates.push({
                        axis: 'y',
                        mode: 'align',
                        delta,
                        distance,
                        alignmentGap: horizontalAlignmentGap,
                        guide: buildObjectSnapGuide(
                            'y',
                            'align',
                            snappedRect,
                            targetRect,
                            alignToTop ? 'top' : 'bottom'
                        )
                    });
                }
            }

            if (isObjectSnapModeEnabled(snapMode, 'align') && verticalAlignmentGap <= OBJECT_SNAP_ALIGNMENT_THRESHOLD) {
                const alignToLeft = Math.abs(movingRect.left - targetRect.left) <= Math.abs(movingRect.right - targetRect.right);
                const delta = alignToLeft
                    ? targetRect.left - movingRect.left
                    : targetRect.right - movingRect.right;
                const snappedRect = {
                    ...movingRect,
                    left: movingRect.left + delta,
                    right: movingRect.right + delta
                };
                const distance = Math.abs(delta);
                if (distance <= OBJECT_SNAP_THRESHOLD) {
                    candidates.push({
                        axis: 'x',
                        mode: 'align',
                        delta,
                        distance,
                        alignmentGap: verticalAlignmentGap,
                        guide: buildObjectSnapGuide(
                            'x',
                            'align',
                            snappedRect,
                            targetRect,
                            alignToLeft ? 'left' : 'right'
                        )
                    });
                }
            }

            for (const candidateMatch of candidates) {
                if (candidateMatch.axis === 'x') {
                    if (shouldReplaceSnapMatch(bestXMatch, candidateMatch)) {
                        bestXMatch = candidateMatch;
                    }
                } else if (shouldReplaceSnapMatch(bestYMatch, candidateMatch)) {
                    bestYMatch = candidateMatch;
                }
            }
        }

        return {
            x: bestXMatch,
            y: bestYMatch,
            guides: [
                ...(bestXMatch ? [bestXMatch.guide] : []),
                ...(bestYMatch ? [bestYMatch.guide] : [])
            ]
        };
    }

    function resolvePlacementPosition(
        worldX: number,
        worldY: number,
        category: DesignerCategory = state.category,
        snapMode: ObjectSnapMode = state.activeObjectSnapMode
    ) {
        const baseX = state.snapToGrid ? snapCoordinateToOffset(worldX, state.snapOffsetX) : Math.round(worldX);
        const baseY = state.snapToGrid ? snapCoordinateToOffset(worldY, state.snapOffsetY) : Math.round(worldY);
        const movingRect = getRectAtPosition(baseX, baseY, category);
        const objectSnap = findObjectSnapMatch(movingRect, snapMode);
        return {
            x: baseX + (objectSnap.x?.delta ?? 0),
            y: baseY + (objectSnap.y?.delta ?? 0),
            guides: objectSnap.guides
        };
    }

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

    function areSameSelection(left: Selection, right: Selection) {
        return left.category === right.category && left.entity === right.entity;
    }

    function getSelectedItems() {
        return state.selectedItems.length > 0
            ? state.selectedItems
            : state.selection
                ? [state.selection]
                : [];
    }

    function isSelected(selection: Selection) {
        return getSelectedItems().some((item) => areSameSelection(item, selection));
    }

    function syncPalettePreviewTypeFromSelection(selection: Selection | null) {
        if (!state.paletteDesignerOpen || !selection) {
            return;
        }
        if (spriteTypes.includes(selection.entity.type)) {
            state.palettePreviewType = selection.entity.type;
        }
    }

    function setSelections(selections: Selection[], primary: Selection | null = selections[0] ?? null) {
        state.selectedItems = selections;
        state.selection = primary;
        if (primary) {
            state.category = primary.category;
            state.rotation = normalizeRotation(primary.entity.rotation);
            state.translation = categorySupportsTranslation(primary.category)
                ? normalizeSpriteTranslation(primary.entity.translation)
                : 'center';
            state.palette = primary.entity.palette ?? 0;
            state.typeByCategory[primary.category] = primary.entity.type;
        }
        syncPalettePreviewTypeFromSelection(primary);
        refreshPanel();
    }

    function mergeSelections(existing: Selection[], incoming: Selection[]) {
        const merged = [...existing];
        for (const selection of incoming) {
            if (!merged.some((item) => areSameSelection(item, selection))) {
                merged.push(selection);
            }
        }
        return merged;
    }

    function removeSelection(existing: Selection[], target: Selection) {
        return existing.filter((item) => !areSameSelection(item, target));
    }

    function getLinkedTeleporterSelection(selection: Selection): Selection | null {
        if (selection.category !== 'world') {
            return null;
        }
        const block = selection.entity as MapBlock;
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            return null;
        }
        const teleporter = findTeleporterForWorldBlock(block);
        if (!teleporter) {
            return null;
        }
        const counterpart = block.type === 'teleporter'
            ? findWorldBlockByExactPosition(teleporter.padX, teleporter.padY, 'teleporter_pad')
            : findWorldBlockByExactPosition(teleporter.baseX, teleporter.baseY, 'teleporter');
        return counterpart ? { category: 'world', entity: counterpart } : null;
    }

    function expandSelectionsWithLinkedTeleporters(selections: Selection[]) {
        let expanded = [...selections];
        for (const selection of selections) {
            const linkedSelection = getLinkedTeleporterSelection(selection);
            if (linkedSelection) {
                expanded = mergeSelections(expanded, [linkedSelection]);
            }
        }
        return expanded;
    }

    function getSelectionDrawOrder(selection: Selection) {
        const categoryOrder: Record<RuntimeDesignerCategory, number> = {
            world: 0,
            doors: 1,
            buttons: 2,
            creatures: 3,
            collectables: 4
        };
        const category = selection.category as RuntimeDesignerCategory;
        const categoryRank = categoryOrder[category] ?? 0;
        const indexInCategory = getCategoryArray(selection.category).indexOf(selection.entity);
        return {
            categoryRank,
            indexInCategory
        };
    }

    function getSelectionsInDrawOrder(selections: Selection[]) {
        return [...selections].sort((left, right) => {
            const leftOrder = getSelectionDrawOrder(left);
            const rightOrder = getSelectionDrawOrder(right);
            if (leftOrder.categoryRank !== rightOrder.categoryRank) {
                return leftOrder.categoryRank - rightOrder.categoryRank;
            }
            return leftOrder.indexInCategory - rightOrder.indexInCategory;
        });
    }

    function removeTeleportersForSelections(selections: Selection[]) {
        const teleporterIdsToRemove = new Set<string>();
        for (const selection of selections) {
            if (selection.category !== 'world') {
                continue;
            }
            const block = selection.entity as MapBlock;
            if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
                continue;
            }
            const teleporter = findTeleporterForWorldBlock(block);
            if (teleporter?.id) {
                teleporterIdsToRemove.add(teleporter.id);
            }
        }
        if (teleporterIdsToRemove.size === 0) {
            return;
        }
        const teleporters = getTeleporters();
        for (let index = teleporters.length - 1; index >= 0; index -= 1) {
            if (teleporterIdsToRemove.has(teleporters[index].id)) {
                teleporters.splice(index, 1);
            }
        }
        for (const button of host.getRawWorldData().buttons) {
            if (!Array.isArray(button.linkedTeleporters) || button.linkedTeleporters.length === 0) {
                continue;
            }
            button.linkedTeleporters = button.linkedTeleporters.filter((id) => !teleporterIdsToRemove.has(id));
        }
    }

    function removeSelectedFromArray(selections: Selection[] = getSelectedItems()) {
        for (const selection of selections) {
            const arr = getCategoryArray(selection.category);
            const index = arr.indexOf(selection.entity);
            if (index >= 0) {
                arr.splice(index, 1);
            }
        }
    }

    function reorderSelections(toFront: boolean) {
        const selections = getSelectedItems();
        if (selections.length === 0) {
            return;
        }

        runMutation(toFront ? 'Brought selection to front.' : 'Sent selection to back.', () => {
            const selectedByCategory = new Map<DesignerCategory, Set<any>>();
            for (const selection of selections) {
                let categorySet = selectedByCategory.get(selection.category);
                if (!categorySet) {
                    categorySet = new Set<any>();
                    selectedByCategory.set(selection.category, categorySet);
                }
                categorySet.add(selection.entity);
            }

            for (const [category, selectedEntities] of selectedByCategory) {
                const arr = getCategoryArray(category);
                const selectedInOrder = arr.filter((entity) => selectedEntities.has(entity));
                if (selectedInOrder.length === 0 || selectedInOrder.length === arr.length) {
                    continue;
                }
                const unselectedInOrder = arr.filter((entity) => !selectedEntities.has(entity));
                arr.splice(
                    0,
                    arr.length,
                    ...(toFront
                        ? [...unselectedInOrder, ...selectedInOrder]
                        : [...selectedInOrder, ...unselectedInOrder])
                );
            }
        });
    }

    function closeContextMenu() {
        state.contextMenu.screen = null;
        state.contextMenu.world = null;
        state.contextMenu.primarySelection = null;
        refs.contextMenu.classList.remove('open');
        refs.contextMenuBody.innerHTML = '';
    }

    function positionContextMenu() {
        if (!state.contextMenu.screen) return;
        const viewportPadding = 12;
        const rect = refs.contextMenu.getBoundingClientRect();
        const left = Math.min(
            state.contextMenu.screen.x,
            window.innerWidth - rect.width - viewportPadding
        );
        const top = Math.min(
            state.contextMenu.screen.y,
            window.innerHeight - rect.height - viewportPadding
        );
        refs.contextMenu.style.left = `${Math.max(viewportPadding, left)}px`;
        refs.contextMenu.style.top = `${Math.max(viewportPadding, top)}px`;
    }

    function addContextMenuAction(label: string, onClick: () => void, disabled = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener('click', () => {
            if (disabled) return;
            onClick();
            closeContextMenu();
        });
        refs.contextMenuBody.appendChild(button);
    }

    function addContextMenuDivider() {
        refs.contextMenuBody.appendChild(document.createElement('hr'));
    }

    function addContextMenuSubmenu(
        label: string,
        renderBody: (body: HTMLDivElement) => void,
        disabled = false
    ) {
        const details = document.createElement('details');
        details.className = 'world-designer-context-submenu';
        details.open = false;

        const summary = document.createElement('summary');
        summary.textContent = label;
        if (disabled) {
            summary.style.opacity = '0.45';
            summary.style.cursor = 'default';
        }
        details.appendChild(summary);

        if (!disabled) {
            const body = document.createElement('div');
            body.className = 'world-designer-context-submenu-body';
            renderBody(body);
            details.appendChild(body);
        }

        refs.contextMenuBody.appendChild(details);
    }

    function addContextMenuActionToContainer(container: HTMLElement, label: string, onClick: () => void, disabled = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener('click', () => {
            if (disabled) return;
            onClick();
            closeContextMenu();
        });
        container.appendChild(button);
    }

    function addContextMenuToggleActionToContainer(
        container: HTMLElement,
        label: string,
        checked: boolean,
        onClick: () => void,
        disabled = false
    ) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'world-designer-context-toggle-action';
        button.disabled = disabled;

        const check = document.createElement('span');
        check.className = 'world-designer-context-toggle-check';
        check.textContent = checked ? '✓' : '';
        button.appendChild(check);

        const text = document.createElement('span');
        text.textContent = label;
        button.appendChild(text);

        button.addEventListener('click', () => {
            if (disabled) return;
            onClick();
            closeContextMenu();
        });
        container.appendChild(button);
    }

    function getContextMenuWorldPosition() {
        return state.contextMenu.world;
    }

    function getContextMenuActionSelections() {
        const primary = getContextMenuTargetSelection();
        if (!primary) {
            return [];
        }
        const selected = getSelectedItems();
        return selected.some((item) => areSameSelection(item, primary))
            ? selected
            : [primary];
    }

    function activateContextMenuSelections() {
        const primary = getContextMenuTargetSelection();
        const selections = getContextMenuActionSelections();
        if (!primary || selections.length === 0) {
            return;
        }
        setSelections(selections, primary);
    }

    function setPaletteSelection(palette: number) {
        const selections = getSelectedItems();
        if (selections.length === 0) return;
        const clampedPalette = clamp(palette, 0, paletteCount - 1);
        runMutation(`Set palette to ${clampedPalette}.`, () => {
            for (const selection of selections) {
                if (!('palette' in selection.entity)) continue;
                selection.entity.palette = clampedPalette;
            }
        });
        updateSelectionFromInspectorState();
    }

    function setWorldAstronautMask(maskAstronaut: boolean) {
        const worldSelections = getSelectedItems().filter((selection) => selection.category === 'world');
        if (worldSelections.length === 0) return;
        runMutation(`Updated astronaut masking${maskAstronaut ? '' : ' off'}.`, () => {
            for (const selection of worldSelections) {
                selection.entity.maskAstronaut = maskAstronaut;
            }
        });
    }

    function setContextMenuWorldAstronautMask(maskAstronaut: boolean) {
        const selection = getContextMenuTargetSelection();
        if (!selection || selection.category !== 'world') return;
        runMutation(`Updated astronaut masking${maskAstronaut ? '' : ' off'}.`, () => {
            selection.entity.maskAstronaut = maskAstronaut;
        });
    }

    function addContextMenuPaletteSubmenu(disabled = false) {
        const selection = state.contextMenu.primarySelection;
        const currentPalette = selection && 'palette' in selection.entity && typeof selection.entity.palette === 'number'
            ? selection.entity.palette
            : 0;
        const previewType = selection?.entity.type ?? getCurrentType();
        const previewRotation = selection?.entity.rotation ?? state.rotation;
        const previewTranslation = selection?.category === 'world'
            ? normalizeSpriteTranslation(selection.entity.translation)
            : (state.category === 'world' ? state.translation : 'center');

        addContextMenuSubmenu(`Palette (${currentPalette})`, (body) => {
            for (let palette = 0; palette < paletteCount; palette += 1) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'world-designer-context-palette-option';
                if (palette === currentPalette) {
                    button.classList.add('selected');
                }

                const canvas = document.createElement('canvas');
                canvas.className = 'world-designer-context-palette-canvas';
                canvas.width = 36;
                canvas.height = 36;
                renderSpritePreviewCanvas(
                    canvas,
                    previewType,
                    palette,
                    normalizeRotation(previewRotation),
                    previewTranslation
                );
                button.appendChild(canvas);

                const label = document.createElement('span');
                label.className = 'world-designer-context-palette-label';
                label.textContent = `Palette ${palette}`;
                button.appendChild(label);

                button.addEventListener('click', () => {
                    activateContextMenuSelections();
                    closeContextMenu();
                    setPaletteSelection(palette);
                });
                body.appendChild(button);
            }
        }, disabled);
    }

    function getContextMenuTargetSelection() {
        return state.contextMenu.primarySelection;
    }

    function getContextMenuEntity() {
        return getContextMenuTargetSelection()?.entity ?? null;
    }

    function setContextMenuSelectionCollision(enabled: boolean) {
        const selection = getContextMenuTargetSelection();
        if (!selection || !('collision' in selection.entity)) return;
        runMutation(`Updated ${selection.category} collision.`, () => {
            selection.entity.collision = enabled;
            if (selection.category === 'world' && !enabled && typeof selection.entity.maskAstronaut !== 'boolean') {
                selection.entity.maskAstronaut = selection.entity.type === 'black_background' ? false : true;
            }
        });
    }

    function setContextMenuCollectableFlag(
        message: string,
        mutate: (entity: Collectable) => void
    ) {
        const selection = getContextMenuTargetSelection();
        if (!selection || selection.category !== 'collectables') return;
        runMutation(message, () => {
            mutate(selection.entity as Collectable);
        });
    }

    function convertPrimarySelectionToCategory(targetCategory: DesignerCategory, message: string) {
        const selection = getContextMenuTargetSelection();
        if (!selection || selection.category === targetCategory) return;
        runMutation(message, () => {
            convertSelectionToCategory(selection, targetCategory);
        });
    }

    function pasteSelectionAtWorld(world: Position) {
        if (clipboardEntries.length === 0) {
            setStatus('Nothing copied yet.', 'neutral');
            return;
        }
        const target = resolvePlacementPosition(world.x, world.y);
        const xs = clipboardEntries.map((entry) => entry.data.x);
        const ys = clipboardEntries.map((entry) => entry.data.y);
        const sourceCenter = {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
        runMutation('Pasted selection at cursor.', () => {
            const pastedSelections = createPastedSelections(
                clipboardEntries,
                target.x - sourceCenter.x,
                target.y - sourceCenter.y
            );
            setSelections(pastedSelections);
        });
    }

    function setAstronautStartAtWorldPosition(world: Position) {
        const target = resolvePlacementPosition(world.x, world.y);
        runMutation('Updated astronaut start position.', () => {
            host.setAstronautStartPosition(target);
        });
    }

    function moveLiveAstronautToWorldPosition(world: Position) {
        const target = {
            x: Math.round(world.x),
            y: Math.round(world.y)
        };
        host.resetAstronautToPosition(target);
        if (state.liveResumeSnapshot) {
            state.liveResumeSnapshot.astronautPosition = target;
        }
        setStatus('Moved the live astronaut to the clicked position.', 'success');
    }

    function toggleDoorLockedDefault() {
        const selection = state.contextMenu.primarySelection;
        if (!selection || selection.category !== 'doors') return;
        runMutation('Toggled door locked default.', () => {
            const nextLocked = !(selection.entity.defaultLocked ?? selection.entity.locked ?? false);
            selection.entity.defaultLocked = nextLocked;
            selection.entity.locked = nextLocked;
        });
    }

    function toggleDoorOpenDefault() {
        const selection = state.contextMenu.primarySelection;
        if (!selection || selection.category !== 'doors') return;
        runMutation('Toggled door open default.', () => {
            const nextOpen = !(selection.entity.defaultOpen ?? selection.entity.open ?? false);
            selection.entity.defaultOpen = nextOpen;
            selection.entity.open = nextOpen;
        });
    }

    function toggleButtonActiveDefault() {
        const selection = state.contextMenu.primarySelection;
        if (!selection || selection.category !== 'buttons') return;
        runMutation('Toggled button active default.', () => {
            const nextActive = !(selection.entity.defaultActive ?? selection.entity.active ?? false);
            selection.entity.defaultActive = nextActive;
            selection.entity.active = nextActive;
        });
    }

    function openContextMenu(selection: Selection, event: MouseEvent) {
        state.contextMenu.primarySelection = selection;
        state.contextMenu.screen = {
            x: event.clientX,
            y: event.clientY
        };
        const point = getCanvasPoint(event);
        state.contextMenu.world = screenToWorld(point.x, point.y);
        refs.contextMenuBody.innerHTML = '';

        const selectedItems = getSelectedItems();
        addContextMenuSubmenu('Edit', (body) => {
            addContextMenuActionToContainer(body, 'Rotate', () => {
                activateContextMenuSelections();
                rotateSelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Send to back', () => {
                activateContextMenuSelections();
                reorderSelections(false);
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Bring to front', () => {
                activateContextMenuSelections();
                reorderSelections(true);
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Copy', () => {
                activateContextMenuSelections();
                copySelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Duplicate', () => {
                activateContextMenuSelections();
                duplicateSelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Delete', () => {
                activateContextMenuSelections();
                deleteSelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Focus selection', () => {
                activateContextMenuSelections();
                focusSelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Group as custom sprite', () => {
                activateContextMenuSelections();
                groupSelectionsAsCustomSprite();
            }, !canGroupSelections(selectedItems.length > 0 ? selectedItems : selection ? [selection] : []));
            addContextMenuActionToContainer(body, 'Ungroup custom sprite', () => {
                activateContextMenuSelections();
                ungroupCustomSpriteSelection();
            }, selection.category !== 'custom');
            addContextMenuActionToContainer(body, 'Delete custom sprite type', () => {
                activateContextMenuSelections();
                deleteCustomSpriteSelectionDefinition();
            }, selection.category !== 'custom');
        }, !selection);

        addContextMenuPaletteSubmenu(selectedItems.length === 0 || selection.category === 'custom');

        if ('collision' in selection.entity || selection.category === 'world') {
            addContextMenuSubmenu('Properties', (body) => {
                if ('collision' in selection.entity) {
                    addContextMenuToggleActionToContainer(
                        body,
                        'Collision enabled',
                        selection.entity.collision !== false,
                        () => setContextMenuSelectionCollision(selection.entity.collision === false)
                    );
                }
                if (selection.category === 'world') {
                    addContextMenuToggleActionToContainer(
                        body,
                        'Mask astronaut',
                        shouldMaskAstronaut(selection.entity),
                        () => setContextMenuWorldAstronautMask(!shouldMaskAstronaut(selection.entity))
                    );
                }
            });
        }

        if (selection.category === 'collectables') {
            addContextMenuSubmenu('Collectable', (body) => {
                addContextMenuToggleActionToContainer(
                    body,
                    'Can be picked up',
                    selection.entity.pickupEnabled ?? true,
                    () => setContextMenuCollectableFlag('Updated pickup flag.', (entity) => {
                        entity.pickupEnabled = !(entity.pickupEnabled ?? true);
                        if (entity.pickupEnabled === false) {
                            entity.storable = false;
                            entity.stored = false;
                        }
                    })
                );
                addContextMenuToggleActionToContainer(
                    body,
                    'Storable',
                    selection.entity.storable ?? false,
                    () => setContextMenuCollectableFlag('Updated storable flag.', (entity) => {
                        entity.storable = !(entity.storable ?? false);
                        if (entity.storable) {
                            entity.pickupEnabled = true;
                        }
                    })
                );
                addContextMenuToggleActionToContainer(
                    body,
                    'Collected by default',
                    selection.entity.collected ?? false,
                    () => setContextMenuCollectableFlag('Updated collected flag.', (entity) => {
                        entity.collected = !(entity.collected ?? false);
                    })
                );
                addContextMenuToggleActionToContainer(
                    body,
                    'Affects astronaut',
                    selection.entity.affectsAstronaut ?? true,
                    () => setContextMenuCollectableFlag('Updated affects astronaut flag.', (entity) => {
                        entity.affectsAstronaut = !(entity.affectsAstronaut ?? true);
                    })
                );
            });
        }

        if (
            selection.category === 'world' ||
            selection.category === 'collectables' ||
            selection.category === 'buttons' ||
            selection.category === 'doors' ||
            selection.category === 'creatures' ||
            selection.category === 'custom'
        ) {
            addContextMenuSubmenu('Convert', (body) => {
                if (selection.category === 'world') {
                    const teleporterPair = getContextMenuSelectedTeleporterPair();
                    addContextMenuActionToContainer(body, 'Convert selected base+pad to teleporter', () => {
                        if (!teleporterPair) {
                            return;
                        }
                        runMutation('Converted selected teleporter base+pad to a teleporter.', () => {
                            convertTeleporterWorldPair(teleporterPair.base, teleporterPair.pad);
                        });
                    }, !teleporterPair);
                    addContextMenuActionToContainer(body, 'Convert to collectable', () => {
                        convertPrimarySelectionToCategory('collectables', 'Converted world item to collectable.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to creature', () => {
                        convertPrimarySelectionToCategory('creatures', 'Converted world item to creature.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to button', () => {
                        convertPrimarySelectionToCategory('buttons', 'Converted world item to button.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to door', () => {
                        convertPrimarySelectionToCategory('doors', 'Converted world item to door.');
                    });
                } else if (selection.category === 'collectables') {
                    addContextMenuActionToContainer(body, 'Convert to world item', () => {
                        convertPrimarySelectionToCategory('world', 'Converted collectable to world item.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to creature', () => {
                        convertPrimarySelectionToCategory('creatures', 'Converted collectable to creature.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to button', () => {
                        convertPrimarySelectionToCategory('buttons', 'Converted collectable to button.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to door', () => {
                        convertPrimarySelectionToCategory('doors', 'Converted collectable to door.');
                    });
                } else if (selection.category === 'buttons') {
                    addContextMenuActionToContainer(body, 'Convert to world item', () => {
                        convertPrimarySelectionToCategory('world', 'Converted button to world item.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to collectable', () => {
                        convertPrimarySelectionToCategory('collectables', 'Converted button to collectable.');
                    });
                } else if (selection.category === 'doors') {
                    addContextMenuActionToContainer(body, 'Convert to world item', () => {
                        convertPrimarySelectionToCategory('world', 'Converted door to world item.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to collectable', () => {
                        convertPrimarySelectionToCategory('collectables', 'Converted door to collectable.');
                    });
                } else if (selection.category === 'creatures') {
                    addContextMenuActionToContainer(body, 'Convert to world item', () => {
                        convertPrimarySelectionToCategory('world', 'Converted creature to world item.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to collectable', () => {
                        convertPrimarySelectionToCategory('collectables', 'Converted creature to collectable.');
                    });
                } else if (selection.category === 'custom') {
                    addContextMenuActionToContainer(body, 'Convert to button', () => {
                        convertPrimarySelectionToCategory('buttons', 'Converted custom sprite to button.');
                    }, !canConvertCustomSpriteToButton(selection.entity as CustomSpriteInstance));
                }
            });
        }

        if (selection.category === 'doors' || selection.category === 'buttons') {
            addContextMenuSubmenu('Defaults', (body) => {
                if (selection.category === 'doors') {
                    addContextMenuToggleActionToContainer(
                        body,
                        'Locked by default',
                        selection.entity.defaultLocked ?? selection.entity.locked ?? false,
                        toggleDoorLockedDefault
                    );
                    addContextMenuToggleActionToContainer(
                        body,
                        'Open by default',
                        selection.entity.defaultOpen ?? selection.entity.open ?? false,
                        toggleDoorOpenDefault
                    );
                } else {
                    addContextMenuToggleActionToContainer(
                        body,
                        'Active by default',
                        selection.entity.defaultActive ?? selection.entity.active ?? false,
                        toggleButtonActiveDefault
                    );
                }
            });
        }

        refs.contextMenu.classList.add('open');
        positionContextMenu();
    }

    function openEmptyContextMenu(event: MouseEvent, world: Position) {
        state.contextMenu.primarySelection = null;
        state.contextMenu.screen = {
            x: event.clientX,
            y: event.clientY
        };
        state.contextMenu.world = world;
        refs.contextMenuBody.innerHTML = '';
        addContextMenuAction('Paste copied selection here', () => {
            const target = getContextMenuWorldPosition();
            if (!target) return;
            pasteSelectionAtWorld(target);
        }, clipboardEntries.length === 0);
        addContextMenuDivider();
        addContextMenuAction('Set astronaut start here', () => {
            const target = getContextMenuWorldPosition();
            if (!target) return;
            setAstronautStartAtWorldPosition(target);
        });
        addContextMenuAction('Move live astronaut here', () => {
            const target = getContextMenuWorldPosition();
            if (!target) return;
            moveLiveAstronautToWorldPosition(target);
        });
        refs.contextMenu.classList.add('open');
        positionContextMenu();
    }

    function getNextDoorId() {
        return host
            .getRawWorldData()
            .doors
            .reduce((maxDoorId, door) => Math.max(maxDoorId, door.doorID ?? -1), -1) + 1;
    }

    function getPreferredButtonTypes() {
        const fallbackType = spriteTypes[0] ?? 'button';
        const capType = spriteTypes.includes('button')
            ? 'button'
            : fallbackType;
        const boxType = spriteTypes.includes('button_box')
            ? 'button_box'
            : capType;
        return { capType, boxType };
    }

    function getDefaultButtonPalettePair() {
        const defaultCapPalette = paletteCount > 9 ? 9 : Math.max(0, paletteCount - 1);
        const defaultBoxPalette = paletteCount > 8 ? 8 : defaultCapPalette;
        return {
            capPalette: defaultCapPalette,
            boxPalette: defaultBoxPalette
        };
    }

    function getEffectiveButtonDefaultOverrides() {
        const paletteDefaults = getDefaultButtonPalettePair();
        return {
            capPalette: state.buttonDefaults.capPalette ?? paletteDefaults.capPalette,
            boxPalette: state.buttonDefaults.boxPalette ?? paletteDefaults.boxPalette,
            capClosedOffsetX: state.buttonDefaults.capClosedOffsetX ?? 0,
            capClosedOffsetY: state.buttonDefaults.capClosedOffsetY ?? 0,
            capOpenOffsetX: state.buttonDefaults.capOpenOffsetX ?? BUTTON_DEFAULT_PRESS_OFFSET,
            capOpenOffsetY: state.buttonDefaults.capOpenOffsetY ?? 0
        };
    }

    function applyButtonDefaultRelativeOffsets(boxOffsetX: number, boxOffsetY: number) {
        const defaults = getEffectiveButtonDefaultOverrides();
        return {
            capClosedOffsetX: boxOffsetX + defaults.capClosedOffsetX,
            capClosedOffsetY: boxOffsetY + defaults.capClosedOffsetY,
            capOpenOffsetX: boxOffsetX + defaults.capOpenOffsetX,
            capOpenOffsetY: boxOffsetY + defaults.capOpenOffsetY
        };
    }

    function setButtonDefaultOverridesFromButton(button: Button) {
        const closedRelative = getButtonCapOffsetsRelativeToBox(button, false);
        const openRelative = getButtonCapOffsetsRelativeToBox(button, true);
        state.buttonDefaults = {
            capPalette: button.palette ?? 0,
            boxPalette: button.boxPalette ?? 0,
            capClosedOffsetX: closedRelative.x,
            capClosedOffsetY: closedRelative.y,
            capOpenOffsetX: openRelative.x,
            capOpenOffsetY: openRelative.y
        };
    }

    function resetButtonDefaultOverrides() {
        state.buttonDefaults = {
            capPalette: null,
            boxPalette: null,
            capClosedOffsetX: null,
            capClosedOffsetY: null,
            capOpenOffsetX: null,
            capOpenOffsetY: null
        };
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
        const { capType, boxType } = getPreferredButtonTypes();
        const defaultButtonOverrides = getEffectiveButtonDefaultOverrides();
        const boxOffsetX = config.boxOffsetX ?? BUTTON_DEFAULT_BOX_OFFSET_X;
        const boxOffsetY = config.boxOffsetY ?? BUTTON_DEFAULT_BOX_OFFSET_Y;
        const defaultCapOffsets = applyButtonDefaultRelativeOffsets(boxOffsetX, boxOffsetY);
        const capClosedOffsetX = config.capClosedOffsetX ?? defaultCapOffsets.capClosedOffsetX;
        const capClosedOffsetY = config.capClosedOffsetY ?? defaultCapOffsets.capClosedOffsetY;
        const capOpenOffsetX = config.capOpenOffsetX ?? defaultCapOffsets.capOpenOffsetX;
        const capOpenOffsetY = config.capOpenOffsetY ?? defaultCapOffsets.capOpenOffsetY;
        return new Button({
            x: config.x,
            y: config.y,
            type: config.type ?? capType,
            palette: config.palette ?? defaultButtonOverrides.capPalette,
            boxType: config.boxType ?? boxType,
            boxPalette: config.boxPalette ?? defaultButtonOverrides.boxPalette,
            rotation: normalizeRotation(config.rotation ?? state.rotation),
            linkedDoors: config.linkedDoors ?? [],
            linkedTeleporters: config.linkedTeleporters ?? [],
            teleporterMode: config.teleporterMode ?? 'toggle',
            collision: config.collision !== false,
            active: config.active ?? false,
            pressOffset: config.pressOffset ?? (capOpenOffsetX - capClosedOffsetX),
            boxOffsetX,
            boxOffsetY,
            capClosedOffsetX,
            capClosedOffsetY,
            capOpenOffsetX,
            capOpenOffsetY,
            paletteCycle: config.paletteCycle ? deepClone(config.paletteCycle) : undefined
        });
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

    function createCustomSpriteInstance(definition: CustomSpriteDefinition, x: number, y: number): CustomSpriteInstance {
        return {
            x: Math.round(x),
            y: Math.round(y),
            type: definition.name,
            customSpriteId: definition.id
        };
    }

    function renameCustomSpriteDefinition(definition: CustomSpriteDefinition, nextName: string) {
        definition.name = nextName;
        for (const instance of state.customSpriteInstances) {
            if (instance.customSpriteId === definition.id) {
                instance.type = nextName;
            }
        }
    }

    function deleteCustomSpriteDefinition(definitionId: string) {
        state.customSpriteDefinitions = state.customSpriteDefinitions.filter((definition) => definition.id !== definitionId);
        state.customSpriteInstances = state.customSpriteInstances.filter((instance) => instance.customSpriteId !== definitionId);
        if (state.typeByCategory.custom === definitionId) {
            state.typeByCategory.custom = state.customSpriteDefinitions[0]?.id ?? '';
        }
        if (state.selection?.category === 'custom' && state.selection.entity.customSpriteId === definitionId) {
            setSelections([]);
        }
    }

    function canGroupSelections(selections = getSelectedItems()) {
        return selections.length > 1 && selections.every((selection) => selection.category !== 'custom');
    }

    function groupSelectionsAsCustomSprite() {
        const selections = getSelectionsInDrawOrder(getSelectedItems());
        if (!canGroupSelections(selections)) {
            setStatus('Select at least two non-custom objects to group them into a custom sprite.', 'error');
            return;
        }
        runMutation('Grouped selection as a custom sprite.', () => {
            const anchorX = Math.min(...selections.map((selection) => Math.round(selection.entity.x)));
            const anchorY = Math.min(...selections.map((selection) => Math.round(selection.entity.y)));
            const definition: CustomSpriteDefinition = {
                id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
                name: createCustomSpriteName(),
                members: selections.map((selection) => ({
                    category: selection.category as RuntimeDesignerCategory,
                    offsetX: Math.round(selection.entity.x) - anchorX,
                    offsetY: Math.round(selection.entity.y) - anchorY,
                    data: serializeSelectionEntity(selection) as MapBlock | ButtonSaveData | DoorSaveData | CreatureSaveData | CollectableSaveData
                }))
            };
            state.customSpriteDefinitions.push(definition);
            removeSelectedFromArray();
            const instance = createCustomSpriteInstance(definition, anchorX, anchorY);
            state.customSpriteInstances.push(instance);
            state.typeByCategory.custom = definition.id;
            setSelections([{ category: 'custom', entity: instance }]);
        });
    }

    function ungroupCustomSpriteSelection() {
        if (!state.selection || state.selection.category !== 'custom') {
            setStatus('Select a custom sprite to ungroup it.', 'error');
            return;
        }
        const instance = state.selection.entity as CustomSpriteInstance;
        const definition = getCustomSpriteDefinitionForInstance(instance);
        if (!definition) {
            setStatus('This custom sprite definition is missing.', 'error');
            return;
        }
        runMutation('Ungrouped custom sprite.', () => {
            const customInstances = getCategoryArray('custom');
            const instanceIndex = customInstances.indexOf(instance);
            if (instanceIndex >= 0) {
                customInstances.splice(instanceIndex, 1);
            }
            const restoredSelections: Selection[] = [];
            for (const member of definition.members) {
                const clone = deepClone(member.data);
                clone.x = Math.round(instance.x + member.offsetX);
                clone.y = Math.round(instance.y + member.offsetY);
                const entity = createSelectionEntity(member.category, clone);
                getCategoryArray(member.category).push(entity);
                restoredSelections.push({ category: member.category, entity });
            }
            setSelections(restoredSelections, restoredSelections[0] ?? null);
        });
    }

    function deleteCustomSpriteSelectionDefinition() {
        if (!state.selection || state.selection.category !== 'custom') {
            setStatus('Select a custom sprite to delete its saved type.', 'error');
            return;
        }
        const instance = state.selection.entity as CustomSpriteInstance;
        const definition = getCustomSpriteDefinitionForInstance(instance);
        if (!definition) {
            setStatus('This custom sprite definition is missing.', 'error');
            return;
        }
        runMutation('Deleted custom sprite type.', () => {
            deleteCustomSpriteDefinition(definition.id);
        });
    }

    function buildButtonEntityFromCustomSpriteInstance(instance: CustomSpriteInstance) {
        const definition = getCustomSpriteDefinitionForInstance(instance);
        if (!definition) {
            throw new Error('This custom sprite definition is missing.');
        }
        const capMember = definition.members.find((member) => member.data.type === 'button');
        const boxMember = definition.members.find((member) => member.data.type === 'button_box');
        if (!capMember || !boxMember) {
            throw new Error('Custom sprite needs one "button" part and one "button_box" part before it can convert to a button.');
        }
        const capData = capMember.data as ButtonSaveData | MapBlock | CollectableSaveData;
        const boxData = boxMember.data as ButtonSaveData | MapBlock | DoorSaveData | CreatureSaveData | CollectableSaveData;
        const rotation = normalizeRotation(capData.rotation);
        const localBoxOffset = invertButtonOffset(
            boxMember.offsetX - capMember.offsetX,
            boxMember.offsetY - capMember.offsetY,
            rotation
        );
        const buttonDefaults = state.buttonDefaults;
        const closedCapOffsetX = -localBoxOffset.x;
        const closedCapOffsetY = -localBoxOffset.y;
        const defaultOpenTravel = BUTTON_DEFAULT_PRESS_OFFSET + 5;
        const capTravelX = localBoxOffset.x < 0 ? defaultOpenTravel : -defaultOpenTravel;
        const capOpenOffsetX = buttonDefaults.capOpenOffsetX ?? (closedCapOffsetX + capTravelX);
        const capOpenOffsetY = buttonDefaults.capOpenOffsetY ?? closedCapOffsetY;
        return createButtonEntity({
            x: Math.round(instance.x + boxMember.offsetX),
            y: Math.round(instance.y + boxMember.offsetY),
            type: capData.type,
            palette: typeof buttonDefaults.capPalette === 'number'
                ? buttonDefaults.capPalette
                : (typeof capData.palette === 'number' ? capData.palette : undefined),
            boxType: boxData.type,
            boxPalette: typeof buttonDefaults.boxPalette === 'number'
                ? buttonDefaults.boxPalette
                : (typeof boxData.palette === 'number' ? boxData.palette : undefined),
            rotation,
            collision: ('collision' in capData ? capData.collision !== false : true) && ('collision' in boxData ? boxData.collision !== false : true),
            active: false,
            linkedDoors: [],
            paletteCycle: capData.paletteCycle ? deepClone(capData.paletteCycle) : undefined,
            pressOffset: capOpenOffsetX - (buttonDefaults.capClosedOffsetX ?? closedCapOffsetX),
            boxOffsetX: 0,
            boxOffsetY: 0,
            capClosedOffsetX: buttonDefaults.capClosedOffsetX ?? closedCapOffsetX,
            capClosedOffsetY: buttonDefaults.capClosedOffsetY ?? closedCapOffsetY,
            capOpenOffsetX,
            capOpenOffsetY
        });
    }

    function canConvertCustomSpriteToButton(instance: CustomSpriteInstance) {
        const definition = getCustomSpriteDefinitionForInstance(instance);
        return !!definition &&
            definition.members.some((member) => member.data.type === 'button') &&
            definition.members.some((member) => member.data.type === 'button_box');
    }

    function getButtonCapLocalOffsets(button: ButtonSaveData | Button, open: boolean) {
        const closed = {
            x: button.capClosedOffsetX ?? 0,
            y: button.capClosedOffsetY ?? 0
        };
        const openOffsets = {
            x: button.capOpenOffsetX ?? (button.pressOffset ?? 2),
            y: button.capOpenOffsetY ?? 0
        };
        return open ? openOffsets : closed;
    }

    function getButtonCapOffsetsRelativeToBox(button: ButtonSaveData | Button, open: boolean) {
        const cap = getButtonCapLocalOffsets(button, open);
        return {
            x: cap.x - (button.boxOffsetX ?? BUTTON_DEFAULT_BOX_OFFSET_X),
            y: cap.y - (button.boxOffsetY ?? BUTTON_DEFAULT_BOX_OFFSET_Y)
        };
    }

    function createDoorEntity(config: {
        x: number;
        y: number;
        type?: string;
        palette?: number;
        rotation?: number;
        collision?: boolean;
        paletteCycle?: PaletteCycleSettings;
    }) {
        const doorId = getNextDoorId();
        const type = isDoorSpriteType(config.type ?? '')
            ? (config.type as 'door_horizontal' | 'door_vertical')
            : (state.typeByCategory.doors as 'door_horizontal' | 'door_vertical');
        return new Door({
            x: config.x,
            y: config.y,
            z: 0,
            type,
            palette: config.palette ?? state.palette,
            rotation: normalizeRotation(config.rotation ?? state.rotation),
            name: `${type}_${doorId}`,
            doorID: doorId,
            locked: false,
            open: false,
            collision: config.collision !== false,
            palette_locked: null,
            palette_unlocked: null,
            destructible: getDefaultDestructibleEnabled('doors', type),
            destructionHealth: getDefaultDestructibleHealth('doors', type),
            destructionSource: getDefaultDestructionSource('doors', type),
            paletteCycle: config.paletteCycle ? deepClone(config.paletteCycle) : undefined
        });
    }

    function getTeleporters() {
        return host.getRawWorldData().teleporters;
    }

    function getTeleporterById(id: string) {
        return getTeleporters().find((teleporter) => teleporter.id === id) ?? null;
    }

    function findTeleporterByPartPosition(
        type: 'teleporter' | 'teleporter_pad',
        x: number,
        y: number,
        maxDistance: number = TILE_SIZE * 1.5
    ) {
        const targetX = Math.round(x);
        const targetY = Math.round(y);
        const exact = getTeleporters().find((entry) =>
            type === 'teleporter'
                ? entry.baseX === targetX && entry.baseY === targetY
                : entry.padX === targetX && entry.padY === targetY
        );
        if (exact) {
            return exact;
        }
        const maxDistanceSquared = maxDistance * maxDistance;
        let best: { teleporter: TeleporterSaveData; distanceSquared: number } | null = null;
        for (const entry of getTeleporters()) {
            const partX = type === 'teleporter' ? entry.baseX : entry.padX;
            const partY = type === 'teleporter' ? entry.baseY : entry.padY;
            const dx = partX - targetX;
            const dy = partY - targetY;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared > maxDistanceSquared) {
                continue;
            }
            if (!best || distanceSquared < best.distanceSquared) {
                best = { teleporter: entry, distanceSquared };
            }
        }
        return best?.teleporter ?? null;
    }

    function applyEntityPositionWithTeleporterSync(entity: any, x: number, y: number) {
        const nextX = Math.round(x);
        const nextY = Math.round(y);
        if (entity?.type === 'teleporter' || entity?.type === 'teleporter_pad') {
            const teleporter = typeof entity.teleporterId === 'string' && entity.teleporterId.trim().length > 0
                ? getTeleporterById(entity.teleporterId)
                : findTeleporterByPartPosition(entity.type, entity.x, entity.y);
            if (teleporter) {
                if (entity.type === 'teleporter') {
                    teleporter.baseX = nextX;
                    teleporter.baseY = nextY;
                } else {
                    teleporter.padX = nextX;
                    teleporter.padY = nextY;
                }
                entity.teleporterId = teleporter.id;
            }
        }
        applyPosition(entity, nextX, nextY);
    }

    function getTeleporterBaseRotationForPadRotation(padRotation: number) {
        const normalizedPadRotation = normalizeRotation(padRotation);
        if (normalizedPadRotation === 1) {
            return 6;
        }
        if (normalizedPadRotation === 3) {
            return 5;
        }
        if (normalizedPadRotation === 5) {
            return 3;
        }
        if (normalizedPadRotation === 6) {
            return 6;
        }
        return normalizedPadRotation;
    }

    function getTeleporterPartBlock(teleporter: TeleporterSaveData, type: 'teleporter' | 'teleporter_pad') {
        const x = type === 'teleporter' ? teleporter.baseX : teleporter.padX;
        const y = type === 'teleporter' ? teleporter.baseY : teleporter.padY;
        const worldMap = host.getRawWorldData().worldMap;
        const byId = worldMap.find((block) =>
            block.type === type &&
            block.teleporterId === teleporter.id
        );
        if (byId) {
            return byId;
        }
        return worldMap.find((block) =>
            block.type === type &&
            block.x === x &&
            block.y === y
        ) ?? null;
    }

    function renameTeleporterId(teleporter: TeleporterSaveData, requestedId: string) {
        const nextId = requestedId.trim();
        if (!nextId || nextId === teleporter.id) {
            return;
        }
        if (getTeleporters().some((entry) => entry !== teleporter && entry.id === nextId)) {
            return;
        }
        const previousId = teleporter.id;
        teleporter.id = nextId;
        const base = getTeleporterPartBlock(teleporter, 'teleporter');
        const pad = getTeleporterPartBlock(teleporter, 'teleporter_pad');
        if (base) {
            base.teleporterId = nextId;
        }
        if (pad) {
            pad.teleporterId = nextId;
        }
        for (const button of host.getRawWorldData().buttons) {
            if (!Array.isArray(button.linkedTeleporters) || button.linkedTeleporters.length === 0) {
                continue;
            }
            button.linkedTeleporters = button.linkedTeleporters.map((id) => id === previousId ? nextId : id);
        }
    }

    function applyEntityRotationWithTeleporterSync(entity: any, rotation: number) {
        const nextRotation = normalizeRotation(rotation);
        if (entity?.type === 'teleporter' || entity?.type === 'teleporter_pad') {
            const teleporter = typeof entity.teleporterId === 'string' && entity.teleporterId.trim().length > 0
                ? getTeleporterById(entity.teleporterId)
                : findTeleporterByPartPosition(entity.type, entity.x, entity.y);
            if (teleporter) {
                const base = getTeleporterPartBlock(teleporter, 'teleporter');
                const pad = getTeleporterPartBlock(teleporter, 'teleporter_pad');
                const nextPadRotation = nextRotation;
                const nextBaseRotation = getTeleporterBaseRotationForPadRotation(nextPadRotation);
                if (base) {
                    base.rotation = nextBaseRotation as MapBlock['rotation'];
                    base.teleporterId = teleporter.id;
                }
                if (pad) {
                    pad.rotation = nextPadRotation as MapBlock['rotation'];
                    pad.teleporterId = teleporter.id;
                }
                entity.teleporterId = teleporter.id;
            }
        }
        entity.rotation = nextRotation;
    }

    function getNextTeleporterId() {
        const existingIds = new Set(getTeleporters().map((teleporter) => teleporter.id));
        let index = 1;
        while (existingIds.has(`teleporter_${index}`)) {
            index += 1;
        }
        return `teleporter_${index}`;
    }

    function findWorldBlockByExactPosition(x: number, y: number, type: string) {
        return host.getRawWorldData().worldMap.find((block) =>
            block.x === x &&
            block.y === y &&
            block.type === type
        ) ?? null;
    }

    function findTeleporterForWorldBlock(block: MapBlock) {
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            return null;
        }
        if (typeof block.teleporterId === 'string' && block.teleporterId.trim().length > 0) {
            const byId = getTeleporterById(block.teleporterId);
            if (byId) {
                return byId;
            }
        }
        return findTeleporterByPartPosition(block.type, block.x, block.y, 0);
    }

    function findClosestTeleporterCounterpart(sourceBlock: MapBlock) {
        const counterpartType = sourceBlock.type === 'teleporter' ? 'teleporter_pad' : 'teleporter';
        const sourceCenterX = sourceBlock.x + TILE_SIZE / 2;
        const sourceCenterY = sourceBlock.y + TILE_SIZE / 2;
        let best: { block: MapBlock; distanceSquared: number } | null = null;
        for (const block of host.getRawWorldData().worldMap) {
            if (block === sourceBlock || block.type !== counterpartType) {
                continue;
            }
            const dx = sourceCenterX - (block.x + TILE_SIZE / 2);
            const dy = sourceCenterY - (block.y + TILE_SIZE / 2);
            const distanceSquared = dx * dx + dy * dy;
            if (!best || distanceSquared < best.distanceSquared) {
                best = { block, distanceSquared };
            }
        }
        return best?.block ?? null;
    }

    function convertWorldTeleporterBlock(block: MapBlock) {
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            throw new Error('Select a teleporter base or teleporter pad world item first.');
        }
        if (findTeleporterForWorldBlock(block)) {
            throw new Error('This world item is already part of a teleporter.');
        }
        const counterpart = findClosestTeleporterCounterpart(block);
        if (!counterpart) {
            throw new Error(`No nearby "${block.type === 'teleporter' ? 'teleporter_pad' : 'teleporter'}" world item found to pair with.`);
        }
        if (findTeleporterForWorldBlock(counterpart)) {
            throw new Error('The nearest matching teleporter part is already paired.');
        }

        const base = block.type === 'teleporter' ? block : counterpart;
        const pad = block.type === 'teleporter_pad' ? block : counterpart;
        convertTeleporterWorldPair(base, pad);
    }

    function convertTeleporterWorldPair(base: MapBlock, pad: MapBlock) {
        if (findTeleporterForWorldBlock(base) || findTeleporterForWorldBlock(pad)) {
            throw new Error('One of the selected teleporter parts is already paired.');
        }
        const astronautStart = host.getRawWorldData().astronautStart;
        const teleporterId = getNextTeleporterId();
        base.teleporterId = teleporterId;
        pad.teleporterId = teleporterId;
        const teleporter: TeleporterSaveData = {
            id: teleporterId,
            baseX: base.x,
            baseY: base.y,
            padX: pad.x,
            padY: pad.y,
            enabled: true,
            requiresKey: false,
            destinationA: {
                x: Math.round(astronautStart.x),
                y: Math.round(astronautStart.y)
            },
            destinationB: null,
            activeDestinationIndex: 0
        };
        getTeleporters().push(teleporter);
        base.teleporterEnabled = true;
        pad.teleporterEnabled = true;
        base.teleporterRequiresKey = false;
        pad.teleporterRequiresKey = false;
        base.teleporterDestinationA = { ...teleporter.destinationA };
        pad.teleporterDestinationA = { ...teleporter.destinationA };
        base.teleporterDestinationB = null;
        pad.teleporterDestinationB = null;
        base.teleporterActiveDestinationIndex = 0;
        pad.teleporterActiveDestinationIndex = 0;
    }

    function createTeleporterCompositeAt(x: number, y: number) {
        const palette = state.palette;
        const padRotation = normalizeRotation(state.rotation);
        const baseRotation = getTeleporterBaseRotationForPadRotation(padRotation);
        const translation: SpriteTranslation = 'center';
        const base: MapBlock = {
            x,
            y,
            type: 'teleporter',
            collision: true,
            maskAstronaut: false,
            palette,
            rotation: baseRotation as MapBlock['rotation'],
            translation
        };
        const pad: MapBlock = {
            x,
            y,
            type: 'teleporter_pad',
            collision: false,
            maskAstronaut: false,
            palette,
            rotation: padRotation as MapBlock['rotation'],
            translation
        };
        const worldMap = getCategoryArray('world') as MapBlock[];
        worldMap.push(base);
        worldMap.push(pad);
        convertTeleporterWorldPair(base, pad);
        return base;
    }

    function getContextMenuSelectedTeleporterPair() {
        const selections = getContextMenuActionSelections();
        if (selections.length !== 2 || !selections.every((entry) => entry.category === 'world')) {
            return null;
        }
        const worldBlocks = selections.map((entry) => entry.entity as MapBlock);
        const base = worldBlocks.find((block) => block.type === 'teleporter') ?? null;
        const pad = worldBlocks.find((block) => block.type === 'teleporter_pad') ?? null;
        if (!base || !pad) {
            return null;
        }
        return { base, pad };
    }

    function getConvertTargetCategory(selection: Selection): DesignerCategory | null {
        if (selection.category === 'custom') {
            return canConvertCustomSpriteToButton(selection.entity as CustomSpriteInstance) ? 'buttons' : null;
        }
        if (selection.category === 'world') {
            if (state.category === 'buttons' || state.category === 'doors' || state.category === 'collectables' || state.category === 'creatures') {
                return state.category;
            }
            return 'collectables';
        }
        if (selection.category === 'collectables') {
            if (state.category === 'buttons' || state.category === 'doors' || state.category === 'world' || state.category === 'creatures') {
                return state.category;
            }
            return 'world';
        }
        if (selection.category === 'buttons' || selection.category === 'doors') {
            if (state.category === 'world' || state.category === 'collectables') {
                return state.category;
            }
        }
        if (selection.category === 'creatures') {
            if (state.category === 'world' || state.category === 'collectables') {
                return state.category;
            }
        }
        return null;
    }

    function getConvertActionLabel(selection: Selection): string {
        const target = getConvertTargetCategory(selection);
        if (!target) {
            return 'Convert';
        }
        return `Convert to ${CATEGORY_LABELS[target].toLowerCase().replace(/^[a-z]/, (letter) => letter.toUpperCase())}`;
    }

    function getConvertActionMessage(targetCategory: DesignerCategory) {
        const label = CATEGORY_LABELS[targetCategory].toLowerCase();
        return `Converted selection to ${label.endsWith('s') ? label : `a ${label}`}.`;
    }

    function getConvertTargetCategories(selection: Selection): DesignerCategory[] {
        if (selection.category === 'custom') {
            return canConvertCustomSpriteToButton(selection.entity as CustomSpriteInstance) ? ['buttons'] : [];
        }
        if (selection.category === 'world') {
            return ['collectables', 'creatures', 'buttons', 'doors'];
        }
        if (selection.category === 'collectables') {
            return ['world', 'creatures', 'buttons', 'doors'];
        }
        if (selection.category === 'buttons' || selection.category === 'doors' || selection.category === 'creatures') {
            return ['world', 'collectables'];
        }
        return [];
    }

    function convertSelectionToCategory(selection: Selection, targetCategory: DesignerCategory) {
        if (selection.category === targetCategory) {
            return;
        }
        const sourceArray = getCategoryArray(selection.category);
        const sourceIndex = sourceArray.indexOf(selection.entity);
        if (sourceIndex >= 0) {
            sourceArray.splice(sourceIndex, 1);
        }

        if (targetCategory === 'collectables') {
            const block = selection.entity as MapBlock;
            const blockPalette = typeof block.palette === 'number' ? block.palette : 0;
            const collectable = new Collectable({
                x: block.x,
                y: block.y,
                type: block.type,
                palette: blockPalette,
                rotation: normalizeRotation(block.rotation),
                name: block.type,
                weight: getDefaultCollectableWeight(block.type),
                pickupEnabled: true,
                storable: true,
                affectsAstronaut: true,
                collision: block.collision !== false,
                collected: false,
                paletteCycle: block.paletteCycle
                    ? deepClone(block.paletteCycle)
                    : getDefaultCollectablePaletteCycle(block.type, blockPalette, paletteCount)
            });
            getCategoryArray('collectables').push(collectable);
            setSelections([{ category: 'collectables', entity: collectable }]);
            return;
        }

        if (targetCategory === 'world') {
            const sourceEntity = selection.entity as Collectable | Button | Door | Creature;
            const block: MapBlock = {
                x: sourceEntity.x,
                y: sourceEntity.y,
                type: sourceEntity.type,
                palette: sourceEntity.palette ?? 0,
                rotation: normalizeRotation((sourceEntity as Collectable).defaultRotation ?? sourceEntity.rotation) as MapBlock['rotation'],
                translation: 'translation' in sourceEntity && typeof sourceEntity.translation === 'string'
                    ? normalizeSpriteTranslation(sourceEntity.translation)
                    : 'center',
                collision: sourceEntity.collision !== false,
                maskAstronaut: sourceEntity.collision === false,
                paletteCycle: sourceEntity.paletteCycle ? deepClone(sourceEntity.paletteCycle) : undefined
            };
            getCategoryArray('world').push(block);
            setSelections([{ category: 'world', entity: block }]);
            return;
        }

        const basePalette = typeof selection.entity.palette === 'number' ? selection.entity.palette : state.palette;
        const baseRotation = normalizeRotation(selection.entity.rotation);
        const baseCollision = 'collision' in selection.entity ? selection.entity.collision !== false : true;
        const basePaletteCycle = 'paletteCycle' in selection.entity ? selection.entity.paletteCycle : undefined;

        if (selection.category === 'custom' && targetCategory === 'buttons') {
            const button = buildButtonEntityFromCustomSpriteInstance(selection.entity as CustomSpriteInstance);
            getCategoryArray('buttons').push(button);
            setSelections([{ category: 'buttons', entity: button }]);
            return;
        }

        if (targetCategory === 'buttons') {
            const button = createButtonEntity({
                x: selection.entity.x,
                y: selection.entity.y,
                rotation: baseRotation,
                collision: baseCollision,
                active: false,
                linkedDoors: [],
                paletteCycle: basePaletteCycle
            });
            getCategoryArray('buttons').push(button);
            setSelections([{ category: 'buttons', entity: button }]);
            return;
        }

        if (targetCategory === 'doors') {
            const sourceType = typeof selection.entity.type === 'string' ? selection.entity.type : '';
            const resolvedDoorType = getDoorTypeFromSourceType(sourceType);
            const door = createDoorEntity({
                x: selection.entity.x,
                y: selection.entity.y,
                type: resolvedDoorType ?? undefined,
                palette: basePalette,
                rotation: baseRotation,
                collision: baseCollision,
                paletteCycle: basePaletteCycle
            });
            getCategoryArray('doors').push(door);
            setSelections([{ category: 'doors', entity: door }]);
            return;
        }

        if (targetCategory === 'creatures') {
            const creature = new Creature({
                x: selection.entity.x,
                y: selection.entity.y,
                type: selection.entity.type,
                palette: basePalette,
                rotation: baseRotation,
                translation: 'translation' in selection.entity && typeof selection.entity.translation === 'string'
                    ? normalizeSpriteTranslation(selection.entity.translation)
                    : 'center',
                state: {},
                paletteCycle: basePaletteCycle ? deepClone(basePaletteCycle) : undefined
            });
            getCategoryArray('creatures').push(creature);
            setSelections([{ category: 'creatures', entity: creature }]);
        }
    }

    function serializeSelectionEntity(selection: Selection): ClipboardEntry['data'] {
        return deepClone(selection.category === 'custom'
            ? selection.entity
            : selection.category === 'world'
            ? toMapBlockData(selection.entity)
            : selection.category === 'buttons'
                ? toButtonData(selection.entity)
                : selection.category === 'doors'
                    ? toDoorData(selection.entity)
                    : selection.category === 'creatures'
                        ? toCreatureData(selection.entity)
                        : toCollectableData(selection.entity));
    }

    function createSelectionEntity(
        category: DesignerCategory,
        data: ClipboardEntry['data']
    ) {
        if (category === 'custom') {
            return deepClone(data as CustomSpriteInstance);
        }
        if (category === 'world') {
            return data as MapBlock;
        }
        if (category === 'buttons') {
            return new Button(data as ButtonSaveData);
        }
        if (category === 'doors') {
            return new Door({ ...(data as DoorSaveData), doorID: getNextDoorId() });
        }
        if (category === 'creatures') {
            return new Creature(data as CreatureSaveData);
        }
        const collectableData = {
            ...(data as CollectableSaveData),
            collected: false,
            held: false,
            stored: false,
            velocity: { x: 0, y: 0 },
            astronautCollisionIgnoreFrames: 0
        };
        return new Collectable(collectableData);
    }

    function createPastedSelections(entries: ClipboardEntry[], offsetX: number, offsetY: number) {
        const pastedSelections: Selection[] = [];
        const groupedTeleporterEntries = new Map<string, { base?: MapBlock; pad?: MapBlock }>();

        const clearTeleporterMetadata = (block: MapBlock) => {
            delete block.teleporterId;
            delete block.teleporterEnabled;
            delete block.teleporterRequiresKey;
            delete block.teleporterDestinationA;
            delete block.teleporterDestinationB;
            delete block.teleporterActiveDestinationIndex;
        };

        const applyTeleporterRuntimeToBlocks = (teleporter: TeleporterSaveData, base: MapBlock, pad: MapBlock) => {
            const activeDestinationIndex = teleporter.activeDestinationIndex === 1 ? 1 : 0;
            const destinationA = {
                x: Math.round(teleporter.destinationA.x),
                y: Math.round(teleporter.destinationA.y)
            };
            const destinationB = teleporter.destinationB
                ? {
                    x: Math.round(teleporter.destinationB.x),
                    y: Math.round(teleporter.destinationB.y)
                }
                : null;
            const enabled = teleporter.enabled !== false;
            const requiresKey = teleporter.requiresKey === true;

            for (const block of [base, pad]) {
                block.teleporterId = teleporter.id;
                block.teleporterEnabled = enabled;
                block.teleporterRequiresKey = requiresKey;
                block.teleporterDestinationA = { ...destinationA };
                block.teleporterDestinationB = destinationB ? { ...destinationB } : null;
                block.teleporterActiveDestinationIndex = activeDestinationIndex;
            }
        };

        for (const entry of entries) {
            const clone = deepClone(entry.data);
            clone.x += offsetX;
            clone.y += offsetY;
            const worldClone = clone as MapBlock;
            if (
                entry.category === 'world' &&
                (worldClone.type === 'teleporter' || worldClone.type === 'teleporter_pad') &&
                typeof worldClone.teleporterId === 'string' &&
                worldClone.teleporterId.trim().length > 0
            ) {
                const teleporterId = worldClone.teleporterId.trim();
                const grouped = groupedTeleporterEntries.get(teleporterId) ?? {};
                if (worldClone.type === 'teleporter') {
                    grouped.base = worldClone;
                } else {
                    grouped.pad = worldClone;
                }
                groupedTeleporterEntries.set(teleporterId, grouped);
                continue;
            }
            const entity = createSelectionEntity(entry.category, clone);
            getCategoryArray(entry.category).push(entity);
            pastedSelections.push({ category: entry.category, entity });
        }

        for (const [sourceTeleporterId, grouped] of groupedTeleporterEntries.entries()) {
            if (!grouped.base || !grouped.pad) {
                if (grouped.base) {
                    clearTeleporterMetadata(grouped.base);
                    getCategoryArray('world').push(grouped.base);
                    pastedSelections.push({ category: 'world', entity: grouped.base });
                }
                if (grouped.pad) {
                    clearTeleporterMetadata(grouped.pad);
                    getCategoryArray('world').push(grouped.pad);
                    pastedSelections.push({ category: 'world', entity: grouped.pad });
                }
                continue;
            }

            const base = grouped.base;
            const pad = grouped.pad;
            clearTeleporterMetadata(base);
            clearTeleporterMetadata(pad);
            getCategoryArray('world').push(base);
            getCategoryArray('world').push(pad);
            convertTeleporterWorldPair(base, pad);

            const pastedTeleporter = findTeleporterForWorldBlock(base);
            const sourceTeleporter = getTeleporterById(sourceTeleporterId);
            if (pastedTeleporter && sourceTeleporter) {
                pastedTeleporter.enabled = sourceTeleporter.enabled !== false;
                pastedTeleporter.requiresKey = sourceTeleporter.requiresKey === true;
                pastedTeleporter.destinationA = {
                    x: Math.round(sourceTeleporter.destinationA.x),
                    y: Math.round(sourceTeleporter.destinationA.y)
                };
                pastedTeleporter.destinationB = sourceTeleporter.destinationB
                    ? {
                        x: Math.round(sourceTeleporter.destinationB.x),
                        y: Math.round(sourceTeleporter.destinationB.y)
                    }
                    : null;
                pastedTeleporter.activeDestinationIndex = sourceTeleporter.activeDestinationIndex === 1 ? 1 : 0;
                applyTeleporterRuntimeToBlocks(pastedTeleporter, base, pad);
            }

            pastedSelections.push({ category: 'world', entity: base });
        }

        return pastedSelections;
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

    function placeAtWorld(worldX: number, worldY: number, snapMode: ObjectSnapMode = state.activeObjectSnapMode) {
        const { x, y } = resolvePlacementPosition(worldX, worldY, state.category, snapMode);
        const type = getCurrentType();

        if (state.category === 'world') {
            if (isTeleporterCompositeType(type)) {
                const teleporterBase = createTeleporterCompositeAt(x, y);
                setSelections([{ category: 'world', entity: teleporterBase }]);
                return;
            }
            const entity: MapBlock = {
                x,
                y,
                type,
                collision: true,
                maskAstronaut: false,
                palette: state.palette,
                rotation: state.rotation as MapBlock['rotation'],
                translation: state.translation
            };
            getCategoryArray('world').push(entity);
            playMushroomPlacementSound(type);
            setSelections([{ category: 'world', entity }]);
            return;
        }

        if (state.category === 'buttons') {
            if (isButtonCompositeType(type)) {
                const button = createButtonEntity({
                    x,
                    y,
                    rotation: state.rotation,
                    collision: true,
                    active: false,
                    linkedDoors: []
                });
                getCategoryArray('buttons').push(button);
                setSelections([{ category: 'buttons', entity: button }]);
                return;
            }
            const entity: MapBlock = {
                x,
                y,
                type,
                collision: true,
                maskAstronaut: false,
                palette: state.palette,
                rotation: state.rotation as MapBlock['rotation'],
                translation: 'center'
            };
            getCategoryArray('world').push(entity);
            playMushroomPlacementSound(type);
            setSelections([{ category: 'world', entity }]);
            return;
        }

        if (state.category === 'custom') {
            const definition = getCustomSpriteDefinitionById(type);
            if (!definition) {
                setStatus('Create a custom sprite by grouping placed items first.', 'error');
                return;
            }
            const entity = createCustomSpriteInstance(definition, x, y);
            getCategoryArray('custom').push(entity);
            setSelections([{ category: 'custom', entity }]);
            return;
        }

        if (state.category === 'doors') {
            const entity = createDoorEntity({
                x,
                y,
                palette: state.palette,
                rotation: state.rotation,
                collision: true
            });
            getCategoryArray('doors').push(entity);
            setSelections([{ category: 'doors', entity }]);
            return;
        }

        if (state.category === 'creatures') {
            const entity = new Creature({
                x,
                y,
                type,
                palette: state.palette,
                rotation: state.rotation,
                translation: state.translation,
                state: {}
            });
            getCategoryArray('creatures').push(entity);
            setSelections([{ category: 'creatures', entity }]);
            return;
        }

        const entity = new Collectable({
            x,
            y,
            type,
            palette: state.palette,
            rotation: state.rotation,
            name: type,
            weight: getDefaultCollectableWeight(type),
            pickupEnabled: true,
            storable: true,
            affectsAstronaut: true,
            collision: true,
            collected: false,
            held: false,
            stored: false,
            paletteCycle: getDefaultCollectablePaletteCycle(type, state.palette, paletteCount)
        });
        getCategoryArray('collectables').push(entity);
        setSelections([{ category: 'collectables', entity }]);
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

    function getHitCandidates() {
        const data = host.getRawWorldData();
        const candidates: Array<{ category: DesignerCategory; entity: any }> = [];

        for (const collectable of [...data.collectables].reverse()) {
            if ('creatureProjectile' in collectable && collectable.creatureProjectile) {
                continue;
            }
            candidates.push({ category: 'collectables', entity: collectable });
        }
        for (const creature of [...data.creatures].reverse()) {
            candidates.push({ category: 'creatures', entity: creature });
        }
        for (const customSprite of [...state.customSpriteInstances].reverse()) {
            candidates.push({ category: 'custom', entity: customSprite });
        }
        for (const button of [...data.buttons].reverse()) {
            candidates.push({ category: 'buttons', entity: button });
        }
        for (const door of [...data.doors].reverse()) {
            candidates.push({ category: 'doors', entity: door });
        }
        for (const block of [...data.worldMap].reverse()) {
            candidates.push({ category: 'world', entity: block });
        }

        return candidates;
    }

    function getEntityAt(worldX: number, worldY: number) {
        const visibleLayers = state.layerVisibility;
        for (const candidate of getHitCandidates()) {
            if (!visibleLayers[candidate.category]) continue;
            const rect = getEntityRect(candidate.entity, candidate.category);
            if (
                worldX >= rect.left &&
                worldX <= rect.right &&
                worldY >= rect.top &&
                worldY <= rect.bottom
            ) {
                return candidate;
            }
        }
        return null;
    }

    function getSelectionBounds(selections: Selection[]) {
        const rects = selections.map((selection) => getEntityRect(selection.entity, selection.category));
        return {
            left: Math.min(...rects.map((rect) => rect.left)),
            top: Math.min(...rects.map((rect) => rect.top)),
            right: Math.max(...rects.map((rect) => rect.right)),
            bottom: Math.max(...rects.map((rect) => rect.bottom)),
            width: Math.max(...rects.map((rect) => rect.right)) - Math.min(...rects.map((rect) => rect.left)),
            height: Math.max(...rects.map((rect) => rect.bottom)) - Math.min(...rects.map((rect) => rect.top))
        };
    }

    function getTeleporterSelectionRect(teleporter: TeleporterSaveData): Rect | null {
        const base = findWorldBlockByExactPosition(teleporter.baseX, teleporter.baseY, 'teleporter');
        if (base) {
            return getEntityRect(base, 'world');
        }
        const pad = findWorldBlockByExactPosition(teleporter.padX, teleporter.padY, 'teleporter_pad');
        if (pad) {
            return getEntityRect(pad, 'world');
        }
        return null;
    }

    function getSelectionVisuals(selections: Selection[]) {
        const visuals: Array<{ rect: Rect; isPrimary: boolean }> = [];
        const handledTeleporters = new Set<string>();
        const primaryTeleporterId = state.selection?.category === 'world'
            ? (findTeleporterForWorldBlock(state.selection.entity as MapBlock)?.id ?? null)
            : null;

        for (const selection of selections) {
            if (selection.category === 'world') {
                const teleporter = findTeleporterForWorldBlock(selection.entity as MapBlock);
                if (teleporter) {
                    if (handledTeleporters.has(teleporter.id)) {
                        continue;
                    }
                    handledTeleporters.add(teleporter.id);
                    visuals.push({
                        rect: getTeleporterSelectionRect(teleporter) ?? getEntityRect(selection.entity, selection.category),
                        isPrimary: primaryTeleporterId === teleporter.id
                    });
                    continue;
                }
            }

            visuals.push({
                rect: getEntityRect(selection.entity, selection.category),
                isPrimary: state.selection ? areSameSelection(selection, state.selection) : false
            });
        }

        return visuals;
    }

    function getBoundsFromRects(rects: Rect[]): Rect {
        return {
            left: Math.min(...rects.map((rect) => rect.left)),
            top: Math.min(...rects.map((rect) => rect.top)),
            right: Math.max(...rects.map((rect) => rect.right)),
            bottom: Math.max(...rects.map((rect) => rect.bottom)),
            width: Math.max(...rects.map((rect) => rect.right)) - Math.min(...rects.map((rect) => rect.left)),
            height: Math.max(...rects.map((rect) => rect.bottom)) - Math.min(...rects.map((rect) => rect.top))
        };
    }

    function getSelectionsInRect(start: Position, end: Position) {
        const visibleLayers = state.layerVisibility;
        const marqueeRect = normalizeRect(start, end);
        return getHitCandidates()
            .filter((candidate) => visibleLayers[candidate.category])
            .filter((candidate) => rectsIntersect(marqueeRect, getEntityRect(candidate.entity, candidate.category)));
    }

    function beginDrag(world: Position, selections: Selection[]) {
        const dragSelections = expandSelectionsWithLinkedTeleporters(selections);
        state.dragging = true;
        state.dragAnchorWorld = world;
        state.dragItems = dragSelections.map((selection) => ({
            selection,
            startX: selection.entity.x,
            startY: selection.entity.y
        }));
        state.dragStartSnapshot = getSnapshot();
    }

    function getAutoPanDelta(point: Position) {
        const edgeThreshold = 48;
        const panSpeed = 10;
        return {
            x: point.x <= edgeThreshold
                ? -panSpeed
                : point.x >= host.canvas.width - edgeThreshold
                    ? panSpeed
                    : 0,
            y: point.y <= edgeThreshold
                ? -panSpeed
                : point.y >= host.canvas.height - edgeThreshold
                    ? panSpeed
                    : 0
        };
    }

    function updateDraggedItems(point: Position, refreshUi = false) {
        if (!state.dragging || !state.dragAnchorWorld) return;

        const autoPan = getAutoPanDelta(point);
        if (autoPan.x !== 0 || autoPan.y !== 0) {
            state.camera = host.clampCamera({
                x: state.camera.x + autoPan.x,
                y: state.camera.y + autoPan.y
            });
        }

        const world = screenToWorld(point.x, point.y);
        const deltaX = world.x - state.dragAnchorWorld.x;
        const deltaY = world.y - state.dragAnchorWorld.y;
        const dragTargets = state.dragItems.map((dragItem) => {
            const x = state.snapToGrid
                ? snapCoordinateToOffset(dragItem.startX + deltaX, state.snapOffsetX)
                : dragItem.startX + deltaX;
            const y = state.snapToGrid
                ? snapCoordinateToOffset(dragItem.startY + deltaY, state.snapOffsetY)
                : dragItem.startY + deltaY;
            return {
                dragItem,
                x,
                y,
                rect: getRectAtPosition(x, y, dragItem.selection.category)
            };
        });
        const excludedEntities = new Set(state.dragItems.map((dragItem) => dragItem.selection.entity));
        const objectSnap = dragTargets.length > 0
            ? findObjectSnapMatch(getBoundsFromRects(dragTargets.map((entry) => entry.rect)), state.activeObjectSnapMode, excludedEntities)
            : { x: null, y: null, guides: [] };
        const snapDeltaX = objectSnap.x?.delta ?? 0;
        const snapDeltaY = objectSnap.y?.delta ?? 0;
        state.objectSnapGuides = objectSnap.guides;

        for (const target of dragTargets) {
            applyEntityPositionWithTeleporterSync(
                target.dragItem.selection.entity,
                target.x + snapDeltaX,
                target.y + snapDeltaY
            );
        }
        if (refreshUi) {
            refreshPanel();
        }
    }

    function focusSelection() {
        const selections = getSelectedItems();
        if (selections.length === 0) return;
        const rect = getSelectionBounds(selections);
        state.camera = host.clampCamera({
            x: rect.left - host.canvas.width / 2 + rect.width / 2,
            y: rect.top - host.canvas.height / 2 + rect.height / 2
        });
        persistDesignerUiState();
        setStatus('Camera centered on selection.', 'neutral');
    }

    function duplicateSelection() {
        const selections = getSelectionsInDrawOrder(
            expandSelectionsWithLinkedTeleporters(getSelectedItems())
        );
        if (selections.length === 0) return;
        runMutation('Duplicated selection.', () => {
            const duplicatedSelections = createPastedSelections(
                selections.map((selection) => ({
                    category: selection.category,
                    data: serializeSelectionEntity(selection)
                })),
                12,
                12
            );
            setSelections(duplicatedSelections);
        });
    }

    function copySelection() {
        const selections = getSelectionsInDrawOrder(
            expandSelectionsWithLinkedTeleporters(getSelectedItems())
        );
        if (selections.length === 0) {
            setStatus('Nothing selected to copy.', 'neutral');
            return;
        }
        clipboardEntries = selections.map((selection) => ({
            category: selection.category,
            data: serializeSelectionEntity(selection)
        }));
        setStatus(`Copied ${clipboardEntries.length} object${clipboardEntries.length === 1 ? '' : 's'}.`, 'neutral');
    }

    function pasteSelection() {
        if (clipboardEntries.length === 0) {
            setStatus('Nothing copied yet.', 'neutral');
            return;
        }
        runMutation('Pasted selection.', () => {
            const pastedSelections = createPastedSelections(clipboardEntries, 12, 12);
            setSelections(pastedSelections);
        });
    }

    function deleteSelection() {
        const selections = expandSelectionsWithLinkedTeleporters(getSelectedItems());
        if (selections.length === 0) return;
        runMutation('Deleted selection.', () => {
            removeTeleportersForSelections(selections);
            removeSelectedFromArray(selections);
            setSelections([]);
        });
    }

    function rotateSelection() {
        const selections = expandSelectionsWithLinkedTeleporters(getSelectedItems());
        if (selections.length === 0) return;
        if (selections.some((selection) => selection.category === 'custom')) {
            setStatus('Custom sprites keep the rotation authored into their grouped parts.', 'neutral');
            return;
        }
        runMutation('Rotated selection.', () => {
            for (const selection of selections) {
                const nextRotation = ((normalizeRotation(selection.entity.rotation) % 9) + 1);
                applyEntityRotationWithTeleporterSync(selection.entity, nextRotation);
                if (selection.category === 'creatures') {
                    selection.entity.state = selection.entity.state ?? {};
                    selection.entity.state.authoredRotation = selection.entity.rotation;
                }
                if (selection.category === 'collectables' && 'defaultRotation' in selection.entity) {
                    selection.entity.defaultRotation = selection.entity.rotation;
                }
            }
        });
    }

    function nudgeSelection(dx: number, dy: number) {
        const selections = expandSelectionsWithLinkedTeleporters(getSelectedItems());
        if (selections.length === 0) return;
        runMutation('Nudged selection.', () => {
            for (const selection of selections) {
                applyEntityPositionWithTeleporterSync(
                    selection.entity,
                    selection.entity.x + dx,
                    selection.entity.y + dy
                );
            }
        });
    }

    function setSelection(selection: Selection | null) {
        setSelections(selection ? [selection] : [], selection);
    }

    function restoreSnapshot(snapshot: DesignerSnapshot, message: string) {
        host.replaceRawWorldData(snapshot.worldData);
        state.customSpriteDefinitions = deepClone(snapshot.customSpriteDefinitions);
        state.customSpriteInstances = deepClone(snapshot.customSpriteInstances);
        if (!getCustomSpriteDefinitionById(state.typeByCategory.custom)) {
            state.typeByCategory.custom = state.customSpriteDefinitions[0]?.id ?? '';
        }
        state.selection = null;
        state.selectedItems = [];
        invalidateOverviewBase();
        updateDirtyState();
        syncEditModeSnapshot();
        refreshPanel();
        setStatus(message, 'neutral');
    }

    function undo() {
        const previous = state.undoStack.pop();
        if (!previous) return;
        state.redoStack.push(getSnapshot());
        restoreSnapshot(previous, 'Undid last change.');
    }

    function redo() {
        const next = state.redoStack.pop();
        if (!next) return;
        state.undoStack.push(getSnapshot());
        restoreSnapshot(next, 'Redid change.');
    }

    function buildSavePreview(snapshot: RawWorldData, options?: { strictTeleporterValidation?: boolean }): SavePreviewState {
        const errors: string[] = [];
        const strictTeleporterValidation = options?.strictTeleporterValidation !== false;
        const spriteTypeSet = new Set(spriteTypes);
        const paletteMax = paletteCount - 1;
        const palettesChanged = !paletteDefinitionsEqual(state.paletteDefinitions, state.lastSavedPaletteDefinitions);

        const doorIds = new Set<number>();
        const duplicateDoorIds = new Set<number>();
        for (const door of snapshot.doors) {
            const doorID = door.doorID ?? -1;
            if (doorIds.has(doorID)) duplicateDoorIds.add(doorID);
            doorIds.add(doorID);
        }

        if (duplicateDoorIds.size > 0) {
            errors.push(`Duplicate door IDs: ${[...duplicateDoorIds].join(', ')}`);
        }

        const validateSpriteAndPalette = (
            categoryLabel: string,
            entry: { type: string; palette?: string | number },
            index: number
        ) => {
            if (!spriteTypeSet.has(entry.type)) {
                errors.push(`${categoryLabel} #${index + 1} uses unknown sprite type "${entry.type}".`);
            }
            if (typeof entry.palette === 'number' && (entry.palette < 0 || entry.palette > paletteMax)) {
                errors.push(`${categoryLabel} #${index + 1} uses palette ${entry.palette}, outside 0-${paletteMax}.`);
            }
        };

        snapshot.worldMap.forEach((entry, index) => validateSpriteAndPalette('World item', entry, index));
        snapshot.buttons.forEach((entry, index) => {
            validateSpriteAndPalette('Button', entry, index);
            for (const linkedDoor of entry.linkedDoors ?? []) {
                if (!doorIds.has(linkedDoor)) {
                    errors.push(`Button #${index + 1} links to missing door ID ${linkedDoor}.`);
                }
            }
        });
        snapshot.doors.forEach((entry, index) => validateSpriteAndPalette('Door', entry, index));
        snapshot.creatures.forEach((entry, index) => validateSpriteAndPalette('Creature', entry, index));
        snapshot.collectables.forEach((entry, index) => validateSpriteAndPalette('Collectable', entry, index));
        const teleporterIds = new Set<string>();
        const duplicateTeleporterIds = new Set<string>();
        for (const teleporter of snapshot.teleporters) {
            if (teleporterIds.has(teleporter.id)) {
                duplicateTeleporterIds.add(teleporter.id);
            }
            teleporterIds.add(teleporter.id);
        }
        if (duplicateTeleporterIds.size > 0) {
            errors.push(`Duplicate teleporter IDs: ${[...duplicateTeleporterIds].join(', ')}`);
        }
        snapshot.teleporters.forEach((teleporter, index) => {
            if (strictTeleporterValidation) {
                if (!snapshot.worldMap.some((block) => block.x === teleporter.baseX && block.y === teleporter.baseY && block.type === 'teleporter')) {
                    errors.push(`Teleporter #${index + 1} base sprite is missing at (${teleporter.baseX}, ${teleporter.baseY}).`);
                }
                if (!snapshot.worldMap.some((block) => block.x === teleporter.padX && block.y === teleporter.padY && block.type === 'teleporter_pad')) {
                    errors.push(`Teleporter #${index + 1} pad sprite is missing at (${teleporter.padX}, ${teleporter.padY}).`);
                }
            }
            if (!Number.isFinite(teleporter.destinationA.x) || !Number.isFinite(teleporter.destinationA.y)) {
                errors.push(`Teleporter #${index + 1} destination A must have numeric x and y.`);
            }
            if (teleporter.destinationB && (!Number.isFinite(teleporter.destinationB.x) || !Number.isFinite(teleporter.destinationB.y))) {
                errors.push(`Teleporter #${index + 1} destination B must have numeric x and y.`);
            }
            if (teleporter.activeDestinationIndex === 1 && !teleporter.destinationB) {
                errors.push(`Teleporter #${index + 1} is set to destination B but has no destination B.`);
            }
        });
        snapshot.buttons.forEach((entry, index) => {
            for (const linkedTeleporterId of entry.linkedTeleporters ?? []) {
                if (!teleporterIds.has(linkedTeleporterId)) {
                    errors.push(`Button #${index + 1} links to missing teleporter "${linkedTeleporterId}".`);
                }
            }
        });
        if (!Number.isFinite(snapshot.astronautStart.x) || !Number.isFinite(snapshot.astronautStart.y)) {
            errors.push('Astronaut start position must have numeric x and y values.');
        }

        const files: SavePreviewFile[] = (Object.keys(snapshot) as Array<keyof RawWorldData>).map((key) => {
            const currentJson = stableStringify(snapshot[key]);
            const previousJson = stableStringify(state.lastSavedSnapshot[key]);
            return {
                key,
                label: SAVE_FILE_LABELS[key],
                changed: currentJson !== previousJson,
                json: currentJson
            };
        });
        files.push({
            key: 'palettes',
            label: PALETTE_FILE_LABEL,
            changed: palettesChanged,
            json: stableStringify(state.paletteDefinitions)
        });

        return { files, errors };
    }

    async function renderSavePreview() {
        refs.modalConfirm.disabled = true;
        refs.modalBody.innerHTML = '<p>Preparing save preview…</p>';
        const snapshot = getAuthoredWorldSnapshot();
        const preview = buildSavePreview(snapshot, { strictTeleporterValidation: false });
        refs.modalBody.innerHTML = '';

        const summary = document.createElement('div');
        const changedFiles = preview.files.filter((file) => file.changed);
        summary.innerHTML = `
            <p>${changedFiles.length === 0 ? 'No asset files have changed.' : `The following file(s) will be updated: <strong>${changedFiles.map((file) => file.label).join(', ')}</strong>.`}</p>
            <p>Use this dialog as a pre-save review. If the JSON looks right, confirm the save.</p>
            <p>Full teleporter placement validation runs on save.</p>
        `;
        refs.modalBody.appendChild(summary);

        if (preview.errors.length > 0) {
            const errorTitle = document.createElement('h3');
            errorTitle.textContent = 'Validation issues';
            refs.modalBody.appendChild(errorTitle);

            const list = document.createElement('ul');
            for (const error of preview.errors) {
                const item = document.createElement('li');
                item.textContent = error;
                list.appendChild(item);
            }
            refs.modalBody.appendChild(list);
        }

        for (const file of preview.files) {
            if (!file.changed) continue;
            const title = document.createElement('h3');
            title.textContent = file.label;
            refs.modalBody.appendChild(title);

            const pre = document.createElement('pre');
            pre.className = 'world-designer-pre';
            pre.textContent = file.json;
            refs.modalBody.appendChild(pre);
        }

        refs.modalConfirm.disabled = preview.errors.length > 0 || changedFiles.length === 0;
    }

    function renderSpriteSheetNormalizationPreview(report: SpriteSheetNormalizationReport) {
        refs.modalBody.innerHTML = '';

        const summary = document.createElement('div');
        summary.innerHTML = `
            <p>This will rewrite <strong>sprite_sheet.png</strong> by snapping sprite pixels to the nearest proper color from <strong>colors.json</strong>.</p>
            <p>Only pixels inside the sprite rectangles from <strong>exile_sprites_map.json</strong> are touched. Grid lines and separators are left unchanged.</p>
            <p><strong>${report.changedPixels}</strong> of <strong>${report.scannedPixels}</strong> scanned sprite pixels will change across <strong>${report.changedSourceColors}</strong> off-palette source colors in <strong>${report.spriteCount}</strong> mapped sprite slots.</p>
        `;
        refs.modalBody.appendChild(summary);

        if (report.replacements.length > 0) {
            const title = document.createElement('h3');
            title.textContent = 'Most common replacements';
            refs.modalBody.appendChild(title);

            const list = document.createElement('ul');
            for (const replacement of report.replacements.slice(0, 12)) {
                const item = document.createElement('li');
                item.textContent = `${formatRgb(replacement.from)} -> ${replacement.toAlias} (${formatRgb(replacement.to)}) x ${replacement.count}`;
                list.appendChild(item);
            }
            refs.modalBody.appendChild(list);
        } else {
            const note = document.createElement('p');
            note.textContent = 'The sprite sheet already matches the proper palette colors in all mapped sprite areas.';
            refs.modalBody.appendChild(note);
        }

        refs.modalConfirm.disabled = report.changedPixels === 0;
    }

    async function saveFromPreview() {
        const snapshot = await getWorldSnapshotForValidationAndSave();
        const preview = buildSavePreview(snapshot, { strictTeleporterValidation: true });
        if (preview.errors.length > 0) {
            setStatus('Resolve the validation issues before saving.', 'error');
            await renderSavePreview();
            return;
        }
        const liveAstronautPosition = host.getFocusWorldPosition();
        const astronautStartChanged =
            snapshot.astronautStart.x !== state.lastSavedSnapshot.astronautStart.x ||
            snapshot.astronautStart.y !== state.lastSavedSnapshot.astronautStart.y;
        const palettesChanged = !paletteDefinitionsEqual(state.paletteDefinitions, state.lastSavedPaletteDefinitions);
        const worldChanged = !snapshotsEqual(snapshot, state.lastSavedSnapshot);
        try {
            if (palettesChanged) {
                await host.savePaletteDefinitions(state.paletteDefinitions, worldChanged ? snapshot : undefined);
                state.lastSavedPaletteDefinitions = deepClone(state.paletteDefinitions);
                syncPaletteCount();
                refreshSelectOptions();
                refreshPaletteDesigner();
            } else {
                await host.saveWorldData(snapshot);
            }
            state.lastSavedSnapshot = snapshot;
            if (state.mode === 'edit') {
                syncEditModeSnapshot();
            } else {
                state.editModeSnapshot = {
                    worldData: serializeWorldData(snapshot),
                    customSpriteDefinitions: deepClone(state.customSpriteDefinitions),
                    customSpriteInstances: deepClone(state.customSpriteInstances)
                };
            }
            if (!astronautStartChanged) {
                host.resetAstronautToPosition(liveAstronautPosition);
            }
            updateDirtyState();
            closeModal();
            setStatus(
                astronautStartChanged
                    ? 'Saved designer changes, including the astronaut start position.'
                    : 'Saved designer changes and restored the live astronaut to the current working position.',
                'success'
            );
            refreshPanel();
        } catch (error) {
            setStatus(
                error instanceof Error ? error.message : 'Failed to save world data.',
                'error'
            );
        }
    }

    async function normalizeSpriteSheetColors() {
        try {
            refs.modalConfirm.disabled = true;
            setStatus('Normalizing sprite sheet colors...', 'neutral');
            const report = await host.normalizeSpriteSheetColors();
            closeModal();
            setStatus(
                report.changedPixels === 0
                    ? 'sprite_sheet.png already matches the proper palette colors in mapped sprite areas.'
                    : `Normalized ${report.changedPixels} sprite pixel${report.changedPixels === 1 ? '' : 's'} in sprite_sheet.png. Grid lines were left untouched.`,
                'success'
            );
        } catch (error) {
            refs.modalConfirm.disabled = false;
            setStatus(
                error instanceof Error ? error.message : 'Failed to normalize sprite_sheet.png.',
                'error'
            );
        }
    }

    async function openSpriteSheetNormalizationPreview() {
        refs.modalTitle.textContent = 'Normalize sprite sheet colors';
        refs.modalConfirm.textContent = 'Normalize sprite sheet';
        refs.modalBody.innerHTML = '<p>Analyzing sprite_sheet.png...</p>';
        refs.modalConfirm.disabled = true;
        refs.modal.classList.add('open');
        modalConfirmAction = () => normalizeSpriteSheetColors();

        try {
            const report = await host.previewSpriteSheetNormalization();
            renderSpriteSheetNormalizationPreview(report);
        } catch (error) {
            refs.modal.classList.remove('open');
            modalConfirmAction = null;
            setStatus(
                error instanceof Error ? error.message : 'Failed to analyze sprite_sheet.png.',
                'error'
            );
        }
    }

    function openSavePreview() {
        state.savePreviewOpen = true;
        refs.modalTitle.textContent = 'Preview before save';
        refs.modalConfirm.textContent = 'Save changes';
        void renderSavePreview().catch((error) => {
            refs.modalBody.innerHTML = '';
            const message = error instanceof Error ? error.message : 'Failed to prepare save preview.';
            const summary = document.createElement('div');
            summary.innerHTML = `<p>${message}</p>`;
            refs.modalBody.appendChild(summary);
            refs.modalConfirm.disabled = true;
        });
        modalConfirmAction = () => saveFromPreview();
        refs.modal.classList.add('open');
    }

    function openPngImportModal() {
        const modalCard = refs.modal.querySelector('.world-designer-modal-card') as HTMLDivElement | null;
        modalCard?.classList.add('world-designer-modal-card-import');
        const defaultWorldRect = getDefaultImportWorldRect();
        const importSnapshot = host.getRawWorldData();
        const pngImportTypeNames = getPngImportTypeNames(importSnapshot);
        const pngImportTypeDefaults = getPngImportTypeDefaults(importSnapshot);
        const rotationOptionMarkup = Array.from({ length: 9 }, (_, index) => {
            const rotation = index + 1;
            return `<option value="${rotation}">${rotation}</option>`;
        }).join('');
        const translationOptionMarkup = SPRITE_TRANSLATION_OPTIONS
            .map((translation) => `<option value="${translation}">${formatSpriteTranslation(translation)}</option>`)
            .join('');
        refs.modalTitle.textContent = 'Import PNG draft';
        refs.modalConfirm.textContent = 'Import draft';
        refs.modalConfirm.disabled = true;
        clearPngImportObjectUrl();
        refs.modalBody.innerHTML = `
            <div class="world-designer-summary">
                Create a rough draft of <strong>world items only</strong> by matching PNG pixels against the currently authored world sprite set. This modal now has two separate paths: <strong>Single PNG</strong> for direct small-region imports, and <strong>Chunk folder</strong> for rebuilding larger areas from exported chunks.
            </div>
            <div class="world-designer-import-layout">
                <div class="world-designer-import-sidebar">
                    <div class="world-designer-import-card">
                        <h3>Choose an import path</h3>
                        <div class="world-designer-import-paths">
                            <button type="button" class="world-designer-import-path" data-role="png-import-mode-single">
                                <strong>Single PNG</strong>
                                <span>Import one PNG or one cropped section directly.</span>
                            </button>
                            <button type="button" class="world-designer-import-path" data-role="png-import-mode-folder">
                                <strong>Chunk folder</strong>
                                <span>Rebuild a larger area from exported chunks.</span>
                            </button>
                        </div>
                        <div class="world-designer-summary">
                            Pick <strong>Single PNG</strong> for fast small-area imports. Pick <strong>Chunk folder</strong> for staged large-map reconstruction.
                        </div>
                    </div>
                    <div class="world-designer-import-card">
                        <div class="world-designer-import-tabs">
                            <button type="button" class="world-designer-import-tab" data-role="png-import-tab-import">Import</button>
                            <button type="button" class="world-designer-import-tab" data-role="png-import-tab-export">Chunk export</button>
                        </div>
                        <div class="world-designer-summary" data-role="png-import-tab-summary">
                            Import mode previews matched world blocks before they touch the live world.
                        </div>
                    </div>
                    <div class="world-designer-import-card" data-role="png-import-single-source">
                        <div class="world-designer-grid">
                            <label class="world-designer-field world-designer-grid-wide">PNG file or URL
                                <div style="display:flex;gap:8px;align-items:center;">
                                    <input type="text" data-role="png-import-url" value="${PNG_IMPORT_DEFAULT_URL}" style="flex:1 1 auto;" />
                                    <button type="button" class="world-designer-button-secondary" data-role="png-import-browse">Browse…</button>
                                </div>
                                <input type="file" data-role="png-import-file" accept=".png,image/png" style="display:none;" />
                            </label>
                        </div>
                    </div>
                    <div class="world-designer-import-card" data-role="png-import-folder-source" hidden>
                        <h3>Exported chunk folder</h3>
                        <div class="world-designer-actions">
                            <button type="button" class="world-designer-button-secondary" data-role="png-import-folder-browse">Choose folder…</button>
                        </div>
                        <div class="world-designer-grid" style="margin-top:8px;">
                            <label class="world-designer-field world-designer-grid-wide">Selected folder
                                <input type="text" data-role="png-import-folder-name" value="No folder selected" readonly />
                            </label>
                            <label class="world-designer-field">Chunk column from
                                <input type="number" data-role="png-import-folder-min-column" value="1" min="1" step="1" />
                            </label>
                            <label class="world-designer-field">Chunk column to
                                <input type="number" data-role="png-import-folder-max-column" value="1" min="1" step="1" />
                            </label>
                            <label class="world-designer-field">Chunk row from
                                <input type="number" data-role="png-import-folder-min-row" value="1" min="1" step="1" />
                            </label>
                            <label class="world-designer-field">Chunk row to
                                <input type="number" data-role="png-import-folder-max-row" value="1" min="1" step="1" />
                            </label>
                            <label class="world-designer-field">Max chunks
                                <input type="number" data-role="png-import-folder-max-chunks" value="0" min="0" step="1" />
                            </label>
                        </div>
                        <label class="world-designer-checkbox">
                            <input type="checkbox" data-role="png-import-folder-fit-target" checked />
                            Keep the world span matched to the selected chunk range
                        </label>
                        <div class="world-designer-summary" data-role="png-import-folder-meta">
                            Choose an exported chunk folder to reconstruct a larger map region.
                        </div>
                    </div>
                    <div class="world-designer-import-card" data-role="png-import-source-crop">
                        <h3>PNG crop in the source image</h3>
                        <div class="world-designer-grid">
                            <label class="world-designer-field">Crop left (px)
                                <input type="number" data-role="png-import-source-x" value="0" step="1" />
                            </label>
                            <label class="world-designer-field">Crop top (px)
                                <input type="number" data-role="png-import-source-y" value="0" step="1" />
                            </label>
                            <label class="world-designer-field">Crop width (px)
                                <input type="number" data-role="png-import-source-width" value="0" step="1" />
                            </label>
                            <label class="world-designer-field">Crop height (px)
                                <input type="number" data-role="png-import-source-height" value="0" step="1" />
                            </label>
                        </div>
                        <div class="world-designer-actions">
                            <button type="button" class="world-designer-button-subtle" data-role="png-import-snap">Snap crop to 32px tiles</button>
                        </div>
                    </div>
                    <div class="world-designer-import-card" data-role="png-import-export-card">
                        <h3>Split PNG into import chunks</h3>
                        <div class="world-designer-grid">
                            <label class="world-designer-field">Chunk preset
                                <select data-role="png-import-export-preset">
                                    <option value="4x4">4 x 4 tiles</option>
                                    <option value="8x8">8 x 8 tiles</option>
                                    <option value="16x16" selected>16 x 16 tiles</option>
                                    <option value="24x16">24 x 16 tiles</option>
                                    <option value="16x24">16 x 24 tiles</option>
                                    <option value="custom">Custom</option>
                                </select>
                            </label>
                            <label class="world-designer-field">Chunk width (tiles)
                                <input type="number" data-role="png-import-export-width" value="16" min="1" step="1" />
                            </label>
                            <label class="world-designer-field">Chunk height (tiles)
                                <input type="number" data-role="png-import-export-height" value="16" min="1" step="1" />
                            </label>
                        </div>
                        <label class="world-designer-checkbox">
                            <input type="checkbox" data-role="png-import-export-skip-empty" checked />
                            Skip fully empty / black chunk PNGs
                        </label>
                        <div class="world-designer-actions">
                            <button type="button" class="world-designer-button-secondary" data-role="png-import-export">Export chunks…</button>
                        </div>
                        <div class="world-designer-summary" data-role="png-import-export-meta">
                            Export chunk PNGs with stable names and a manifest so the folder importer can reconstruct the larger map later.
                        </div>
                    </div>
                    <div class="world-designer-import-card" data-role="png-import-progress-card" hidden>
                        <h3 data-role="png-import-progress-title">Progress</h3>
                        <div class="world-designer-import-progress" data-role="png-import-progress">
                            <progress data-role="png-import-progress-bar" max="1" value="0"></progress>
                            <div class="world-designer-summary" data-role="png-import-progress-label">Preparing…</div>
                            <div class="world-designer-summary" data-role="png-import-progress-detail"></div>
                            <div class="world-designer-import-progress-actions">
                                <button type="button" class="world-designer-button-secondary" data-role="png-import-progress-cancel" hidden>Cancel chunk export</button>
                            </div>
                        </div>
                    </div>
                    <div class="world-designer-import-card" data-role="png-import-world-card">
                        <h3>Place matched blocks in the world</h3>
                        <div class="world-designer-grid">
                            <label class="world-designer-field">World left
                                <input type="number" data-role="png-import-world-x" value="${defaultWorldRect.x}" step="1" />
                            </label>
                            <label class="world-designer-field">World top
                                <input type="number" data-role="png-import-world-y" value="${defaultWorldRect.y}" step="1" />
                            </label>
                            <label class="world-designer-field">World span width
                                <input type="number" data-role="png-import-world-width" value="${defaultWorldRect.width}" step="1" />
                            </label>
                            <label class="world-designer-field">World span height
                                <input type="number" data-role="png-import-world-height" value="${defaultWorldRect.height}" step="1" />
                            </label>
                        </div>
                        <div class="world-designer-summary" data-role="png-import-world-meta">
                            In chunk-folder mode, world left/top is the origin for the exported crop and the folder preview keeps the selected chunk range aligned relative to that origin.
                        </div>
                        <label class="world-designer-checkbox">
                            <input type="checkbox" data-role="png-import-replace" checked />
                            Replace existing world items inside the target area before importing
                        </label>
                        <label class="world-designer-checkbox">
                            <input type="checkbox" data-role="png-import-clear-all" />
                            Clear all existing world items and collectibles before importing
                        </label>
                    </div>
                    <div class="world-designer-import-card" data-role="png-import-action-card">
                        <div class="world-designer-actions">
                            <button type="button" class="world-designer-button-primary" data-role="png-import-preview">Preview blocks</button>
                            <button type="button" class="world-designer-button-secondary" data-role="png-import-direct-folder" hidden>Try folder import now</button>
                        </div>
                        <div class="world-designer-summary" data-role="png-import-meta">
                            Loading PNG metadata…
                        </div>
                    </div>
                </div>
                <div class="world-designer-import-main" data-role="png-import-main">
                    <div class="world-designer-import-card" data-role="png-import-preview-card">
                        <div class="world-designer-import-toolbar">
                            <div class="world-designer-summary">
                                Preview the matched world blocks before importing. Click a tile below to edit its type, palette, rotation, or translation.
                            </div>
                            <div class="world-designer-import-zoom-controls">
                                <button type="button" class="world-designer-button-subtle" data-role="png-import-zoom-out">−</button>
                                <button type="button" class="world-designer-button-subtle" data-role="png-import-zoom-fit">Fit</button>
                                <button type="button" class="world-designer-button-subtle" data-role="png-import-zoom-reset">100%</button>
                                <button type="button" class="world-designer-button-subtle" data-role="png-import-zoom-in">+</button>
                                <span class="world-designer-import-zoom-label" data-role="png-import-zoom-label">100%</span>
                            </div>
                        </div>
                        <div class="world-designer-png-preview-frame" data-role="png-import-preview-frame">
                            <canvas class="world-designer-png-preview-canvas" data-role="png-import-preview-canvas" width="32" height="32"></canvas>
                        </div>
                        <div class="world-designer-summary" data-role="png-import-preview-meta">
                            Preview not generated yet.
                        </div>
                    </div>
                    <div class="world-designer-import-card" data-role="png-import-editor-card">
                        <div class="world-designer-grid">
                            <label class="world-designer-field world-designer-grid-wide">Selected preview tile
                                <input type="text" data-role="png-import-selected-tile" value="No tile selected" readonly />
                            </label>
                            <div class="world-designer-grid-wide">
                                <div class="world-designer-sprite-preview">
                                    <canvas class="world-designer-sprite-canvas" data-role="png-import-selected-type-preview" width="72" height="72"></canvas>
                                    <div class="world-designer-sprite-meta" data-role="png-import-selected-type-meta">No sprite selected</div>
                                </div>
                                <details class="world-designer-sprite-picker" data-role="png-import-type-picker">
                                    <summary>Choose replacement sprite</summary>
                                    <div class="world-designer-sprite-picker-body">
                                        <label class="world-designer-field">
                                            Filter sprites
                                            <input type="text" data-role="png-import-type-filter" placeholder="Filter sprite names" />
                                        </label>
                                        <div class="world-designer-sprite-picker-grid" data-role="png-import-type-grid"></div>
                                    </div>
                                </details>
                            </div>
                            <label class="world-designer-field">Palette
                                <input type="number" data-role="png-import-selected-palette" value="0" min="0" step="1" />
                            </label>
                            <label class="world-designer-field">Rotation
                                <select data-role="png-import-selected-rotation">${rotationOptionMarkup}</select>
                            </label>
                            <label class="world-designer-field">Translation
                                <select data-role="png-import-selected-translation">${translationOptionMarkup}</select>
                            </label>
                        </div>
                        <div class="world-designer-actions">
                            <button type="button" class="world-designer-button-subtle" data-role="png-import-reset-tile">Reset selected tile</button>
                        </div>
                    </div>
                </div>
            </div>
        `;
        refs.modal.classList.add('open');

        const singleModeButton = refs.modalBody.querySelector('[data-role="png-import-mode-single"]') as HTMLButtonElement;
        const folderModeButton = refs.modalBody.querySelector('[data-role="png-import-mode-folder"]') as HTMLButtonElement;
        const importTabButton = refs.modalBody.querySelector('[data-role="png-import-tab-import"]') as HTMLButtonElement;
        const exportTabButton = refs.modalBody.querySelector('[data-role="png-import-tab-export"]') as HTMLButtonElement;
        const tabSummary = refs.modalBody.querySelector('[data-role="png-import-tab-summary"]') as HTMLDivElement;
        const singleSourceCard = refs.modalBody.querySelector('[data-role="png-import-single-source"]') as HTMLDivElement;
        const folderSourceCard = refs.modalBody.querySelector('[data-role="png-import-folder-source"]') as HTMLDivElement;
        const sourceCropCard = refs.modalBody.querySelector('[data-role="png-import-source-crop"]') as HTMLDivElement;
        const exportCard = refs.modalBody.querySelector('[data-role="png-import-export-card"]') as HTMLDivElement;
        const progressCard = refs.modalBody.querySelector('[data-role="png-import-progress-card"]') as HTMLDivElement;
        const progressTitle = refs.modalBody.querySelector('[data-role="png-import-progress-title"]') as HTMLHeadingElement;
        const progressCancelButton = refs.modalBody.querySelector('[data-role="png-import-progress-cancel"]') as HTMLButtonElement;
        const worldCard = refs.modalBody.querySelector('[data-role="png-import-world-card"]') as HTMLDivElement;
        const actionCard = refs.modalBody.querySelector('[data-role="png-import-action-card"]') as HTMLDivElement;
        const importMain = refs.modalBody.querySelector('[data-role="png-import-main"]') as HTMLDivElement;
        const previewCard = refs.modalBody.querySelector('[data-role="png-import-preview-card"]') as HTMLDivElement;
        const editorCard = refs.modalBody.querySelector('[data-role="png-import-editor-card"]') as HTMLDivElement;
        const urlInput = refs.modalBody.querySelector('[data-role="png-import-url"]') as HTMLInputElement;
        const browseButton = refs.modalBody.querySelector('[data-role="png-import-browse"]') as HTMLButtonElement;
        const fileInput = refs.modalBody.querySelector('[data-role="png-import-file"]') as HTMLInputElement;
        const folderBrowseButton = refs.modalBody.querySelector('[data-role="png-import-folder-browse"]') as HTMLButtonElement;
        const folderNameInput = refs.modalBody.querySelector('[data-role="png-import-folder-name"]') as HTMLInputElement;
        const folderMinColumnInput = refs.modalBody.querySelector('[data-role="png-import-folder-min-column"]') as HTMLInputElement;
        const folderMaxColumnInput = refs.modalBody.querySelector('[data-role="png-import-folder-max-column"]') as HTMLInputElement;
        const folderMinRowInput = refs.modalBody.querySelector('[data-role="png-import-folder-min-row"]') as HTMLInputElement;
        const folderMaxRowInput = refs.modalBody.querySelector('[data-role="png-import-folder-max-row"]') as HTMLInputElement;
        const folderMaxChunksInput = refs.modalBody.querySelector('[data-role="png-import-folder-max-chunks"]') as HTMLInputElement;
        const folderFitTargetCheckbox = refs.modalBody.querySelector('[data-role="png-import-folder-fit-target"]') as HTMLInputElement;
        const folderMeta = refs.modalBody.querySelector('[data-role="png-import-folder-meta"]') as HTMLDivElement;
        const sourceXInput = refs.modalBody.querySelector('[data-role="png-import-source-x"]') as HTMLInputElement;
        const sourceYInput = refs.modalBody.querySelector('[data-role="png-import-source-y"]') as HTMLInputElement;
        const sourceWidthInput = refs.modalBody.querySelector('[data-role="png-import-source-width"]') as HTMLInputElement;
        const sourceHeightInput = refs.modalBody.querySelector('[data-role="png-import-source-height"]') as HTMLInputElement;
        const exportPresetSelect = refs.modalBody.querySelector('[data-role="png-import-export-preset"]') as HTMLSelectElement;
        const exportWidthInput = refs.modalBody.querySelector('[data-role="png-import-export-width"]') as HTMLInputElement;
        const exportHeightInput = refs.modalBody.querySelector('[data-role="png-import-export-height"]') as HTMLInputElement;
        const exportSkipEmptyCheckbox = refs.modalBody.querySelector('[data-role="png-import-export-skip-empty"]') as HTMLInputElement;
        const exportButton = refs.modalBody.querySelector('[data-role="png-import-export"]') as HTMLButtonElement;
        const exportMeta = refs.modalBody.querySelector('[data-role="png-import-export-meta"]') as HTMLDivElement;
        const worldXInput = refs.modalBody.querySelector('[data-role="png-import-world-x"]') as HTMLInputElement;
        const worldYInput = refs.modalBody.querySelector('[data-role="png-import-world-y"]') as HTMLInputElement;
        const worldWidthInput = refs.modalBody.querySelector('[data-role="png-import-world-width"]') as HTMLInputElement;
        const worldHeightInput = refs.modalBody.querySelector('[data-role="png-import-world-height"]') as HTMLInputElement;
        const worldMeta = refs.modalBody.querySelector('[data-role="png-import-world-meta"]') as HTMLDivElement;
        const replaceCheckbox = refs.modalBody.querySelector('[data-role="png-import-replace"]') as HTMLInputElement;
        const clearAllCheckbox = refs.modalBody.querySelector('[data-role="png-import-clear-all"]') as HTMLInputElement;
        const snapButton = refs.modalBody.querySelector('[data-role="png-import-snap"]') as HTMLButtonElement;
        const previewButton = refs.modalBody.querySelector('[data-role="png-import-preview"]') as HTMLButtonElement;
        const directFolderImportButton = refs.modalBody.querySelector('[data-role="png-import-direct-folder"]') as HTMLButtonElement;
        const meta = refs.modalBody.querySelector('[data-role="png-import-meta"]') as HTMLDivElement;
        const progressBar = refs.modalBody.querySelector('[data-role="png-import-progress-bar"]') as HTMLProgressElement;
        const progressLabel = refs.modalBody.querySelector('[data-role="png-import-progress-label"]') as HTMLDivElement;
        const progressDetail = refs.modalBody.querySelector('[data-role="png-import-progress-detail"]') as HTMLDivElement;
        const previewFrame = refs.modalBody.querySelector('[data-role="png-import-preview-frame"]') as HTMLDivElement;
        const previewCanvas = refs.modalBody.querySelector('[data-role="png-import-preview-canvas"]') as HTMLCanvasElement;
        const previewMeta = refs.modalBody.querySelector('[data-role="png-import-preview-meta"]') as HTMLDivElement;
        const zoomOutButton = refs.modalBody.querySelector('[data-role="png-import-zoom-out"]') as HTMLButtonElement;
        const zoomFitButton = refs.modalBody.querySelector('[data-role="png-import-zoom-fit"]') as HTMLButtonElement;
        const zoomResetButton = refs.modalBody.querySelector('[data-role="png-import-zoom-reset"]') as HTMLButtonElement;
        const zoomInButton = refs.modalBody.querySelector('[data-role="png-import-zoom-in"]') as HTMLButtonElement;
        const zoomLabel = refs.modalBody.querySelector('[data-role="png-import-zoom-label"]') as HTMLSpanElement;
        const selectedTileInput = refs.modalBody.querySelector('[data-role="png-import-selected-tile"]') as HTMLInputElement;
        const selectedTypePreviewCanvas = refs.modalBody.querySelector('[data-role="png-import-selected-type-preview"]') as HTMLCanvasElement;
        const selectedTypeMeta = refs.modalBody.querySelector('[data-role="png-import-selected-type-meta"]') as HTMLDivElement;
        const selectedTypePicker = refs.modalBody.querySelector('[data-role="png-import-type-picker"]') as HTMLDetailsElement;
        const selectedTypeFilterInput = refs.modalBody.querySelector('[data-role="png-import-type-filter"]') as HTMLInputElement;
        const selectedTypeGrid = refs.modalBody.querySelector('[data-role="png-import-type-grid"]') as HTMLDivElement;
        const selectedPaletteInput = refs.modalBody.querySelector('[data-role="png-import-selected-palette"]') as HTMLInputElement;
        const selectedRotationSelect = refs.modalBody.querySelector('[data-role="png-import-selected-rotation"]') as HTMLSelectElement;
        const selectedTranslationSelect = refs.modalBody.querySelector('[data-role="png-import-selected-translation"]') as HTMLSelectElement;
        const resetTileButton = refs.modalBody.querySelector('[data-role="png-import-reset-tile"]') as HTMLButtonElement;
        let resolvedPngUrl = urlInput.value.trim();
        let resolvedPngLabel = resolvedPngUrl;
        let loadedImage: HTMLImageElement | null = null;
        let importMode: PngImportSourceMode = 'single';
        let workTab: PngImportWorkTab = 'import';
        let progressMode: 'none' | 'import' | 'export' = 'none';
        let cancelLongRunningRequested = false;
        let chunkFolderSelection: PngChunkFolderSelection | null = null;
        let lastFolderCompose: PngChunkComposedSource | null = null;
        let previewDraft: PngImportDraft | null = null;
        let previewBlocks: Array<MapBlock | null> = [];
        let previewOriginalBlocks: Array<MapBlock | null> = [];
        let selectedPreviewIndex = -1;
        let previewTileSize = PNG_IMPORT_PREVIEW_MAX_TILE_SIZE;
        let previewZoom = 1;
        let importBusy = false;
        let progressStartedAt = 0;
        const selectedTypeButtons = new Map<string, HTMLButtonElement>();
        selectedPaletteInput.max = String(Math.max(paletteCount - 1, 0));

        const getNumericInputValue = (input: HTMLInputElement, fallback: number) => {
            const value = Number(input.value);
            return Number.isFinite(value) ? value : fallback;
        };

        const getSelectedPreviewBlock = () => (
            selectedPreviewIndex >= 0 && selectedPreviewIndex < previewBlocks.length
                ? previewBlocks[selectedPreviewIndex]
                : null
        );

        const getFolderSelectionRange = (): PngChunkSelectionRange => {
            if (!chunkFolderSelection) {
                return {
                    minChunkColumn: 0,
                    maxChunkColumn: 0,
                    minChunkRow: 0,
                    maxChunkRow: 0,
                    maxChunks: 0
                };
            }
            const manifest = chunkFolderSelection.manifest;
            const minChunkColumn = clamp(Math.round(getNumericInputValue(folderMinColumnInput, 1)) - 1, 0, manifest.totalChunkColumns - 1);
            const maxChunkColumn = clamp(Math.round(getNumericInputValue(folderMaxColumnInput, manifest.totalChunkColumns)) - 1, minChunkColumn, manifest.totalChunkColumns - 1);
            const minChunkRow = clamp(Math.round(getNumericInputValue(folderMinRowInput, 1)) - 1, 0, manifest.totalChunkRows - 1);
            const maxChunkRow = clamp(Math.round(getNumericInputValue(folderMaxRowInput, manifest.totalChunkRows)) - 1, minChunkRow, manifest.totalChunkRows - 1);
            const maxChunks = Math.max(0, Math.round(getNumericInputValue(folderMaxChunksInput, 0)));
            return {
                minChunkColumn,
                maxChunkColumn,
                minChunkRow,
                maxChunkRow,
                maxChunks
            };
        };

        const syncFolderRangeInputs = () => {
            if (!chunkFolderSelection) {
                folderNameInput.value = 'No folder selected';
                folderMinColumnInput.value = '1';
                folderMaxColumnInput.value = '1';
                folderMinRowInput.value = '1';
                folderMaxRowInput.value = '1';
                folderMaxChunksInput.value = '0';
                folderMeta.textContent = 'Choose an exported chunk folder to reconstruct a larger map region.';
                return;
            }
            const manifest = chunkFolderSelection.manifest;
            const normalizedRange = getFolderSelectionRange();
            folderNameInput.value = chunkFolderSelection.directoryName;
            folderMinColumnInput.value = String(normalizedRange.minChunkColumn + 1);
            folderMaxColumnInput.value = String(normalizedRange.maxChunkColumn + 1);
            folderMinRowInput.value = String(normalizedRange.minChunkRow + 1);
            folderMaxRowInput.value = String(normalizedRange.maxChunkRow + 1);
            folderMaxChunksInput.value = String(normalizedRange.maxChunks);
            const selected = getPngChunkSelectionEntries(chunkFolderSelection, normalizedRange);
            folderMeta.textContent = `Loaded ${chunkFolderSelection.directoryName}. Export grid ${manifest.totalChunkColumns} x ${manifest.totalChunkRows} chunks covering ${manifest.totalSourceColumns} x ${manifest.totalSourceRows} source tiles. Current range includes ${selected.selectedChunks.length} of ${selected.totalSelectedChunks} available chunk PNGs.`;
        };

        const syncExportChunkInputs = () => {
            const preset = exportPresetSelect.value;
            const presetMatch = /^(\d+)x(\d+)$/i.exec(preset);
            const useCustom = preset === 'custom' || !presetMatch;
            exportWidthInput.disabled = !useCustom;
            exportHeightInput.disabled = !useCustom;
            if (presetMatch && !useCustom) {
                exportWidthInput.value = presetMatch[1];
                exportHeightInput.value = presetMatch[2];
            }
        };

        const getExportChunkSize = () => ({
            width: Math.max(1, Math.round(getNumericInputValue(exportWidthInput, PNG_CHUNK_DEFAULT_TILE_WIDTH))),
            height: Math.max(1, Math.round(getNumericInputValue(exportHeightInput, PNG_CHUNK_DEFAULT_TILE_HEIGHT)))
        });

        const syncFolderTargetWorldSpan = () => {
            if (!chunkFolderSelection || !folderFitTargetCheckbox.checked) {
                return;
            }
            worldWidthInput.value = String(getPngImportWorldSpanFromTileCount(chunkFolderSelection.manifest.totalSourceColumns));
            worldHeightInput.value = String(getPngImportWorldSpanFromTileCount(chunkFolderSelection.manifest.totalSourceRows));
        };

        const formatDuration = (milliseconds: number) => {
            const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        };

        const setProgress = (progress: PngImportProgress | null) => {
            if (!progress) {
                progressCard.hidden = true;
                progressBar.value = 0;
                progressLabel.textContent = 'Preparing…';
                progressDetail.textContent = '';
                progressTitle.textContent = 'Progress';
                progressCancelButton.hidden = true;
                progressCancelButton.textContent = 'Cancel';
                return;
            }
            progressCard.hidden = false;
            progressTitle.textContent = progressMode === 'export' ? 'Chunk export progress' : 'Import progress';
            progressCancelButton.hidden = progressMode === 'none';
            progressCancelButton.textContent = progressMode === 'export'
                ? (cancelLongRunningRequested ? 'Cancelling chunk export…' : 'Cancel chunk export')
                : (cancelLongRunningRequested ? 'Cancelling import…' : 'Cancel import');
            progressBar.max = Math.max(progress.total, 1);
            progressBar.value = clamp(progress.completed, 0, Math.max(progress.total, 1));
            const percent = progress.total > 0 ? Math.round((progress.completed / progress.total) * 100) : 0;
            progressLabel.textContent = `${progress.phase} — ${percent}%`;
            const elapsed = progressStartedAt > 0 ? Date.now() - progressStartedAt : 0;
            const eta = progress.completed > 0 && progress.total > progress.completed
                ? ` About ${formatDuration((elapsed / progress.completed) * (progress.total - progress.completed))} left.`
                : '';
            progressDetail.textContent = `${progress.detail}${eta}`;
        };

        const getCancellationMessage = () => (
            progressMode === 'export' ? 'Chunk export cancelled.' : 'Import cancelled.'
        );

        const throwIfCancelled = () => {
            if (cancelLongRunningRequested) {
                throw new Error(getCancellationMessage());
            }
        };

        const handleProgressUpdate = async (progress: PngImportProgress, detailTarget?: HTMLDivElement) => {
            throwIfCancelled();
            setProgress(progress);
            if (detailTarget) {
                detailTarget.textContent = `${progress.phase}: ${progress.detail}`;
            }
        };

        const buildDraftForCurrentImportMode = async () => {
            let draft: PngImportDraft;
            let previewContextMessage = '';
            if (importMode === 'folder') {
                if (!chunkFolderSelection) {
                    throw new Error('Choose an exported chunk folder before previewing or importing the reconstructed map.');
                }
                const composed = await composePngChunkFolderSource(
                    chunkFolderSelection,
                    getFolderSelectionRange(),
                    async (progress) => {
                        await handleProgressUpdate(progress, previewMeta);
                    }
                );
                lastFolderCompose = composed;
                const baseWorldX = Math.round(getNumericInputValue(worldXInput, 0));
                const baseWorldY = Math.round(getNumericInputValue(worldYInput, 0));
                const composedWorldX = baseWorldX;
                const composedWorldY = baseWorldY;
                const composedWorldWidth = getPngImportWorldSpanFromTileCount(composed.manifest.totalSourceColumns);
                const composedWorldHeight = getPngImportWorldSpanFromTileCount(composed.manifest.totalSourceRows);
                worldWidthInput.value = String(composedWorldWidth);
                worldHeightInput.value = String(composedWorldHeight);
                draft = await buildPngImportDraftFromImage(composed.image, {
                    sourceX: 0,
                    sourceY: 0,
                    sourceWidth: composed.sourceWidth,
                    sourceHeight: composed.sourceHeight,
                    worldX: composedWorldX,
                    worldY: composedWorldY,
                    worldWidth: composedWorldWidth,
                    worldHeight: composedWorldHeight,
                    activeTileIndexes: composed.activeTileIndexes,
                    allowGridOffsetInference: false
                }, async (progress) => {
                    await handleProgressUpdate(progress, previewMeta);
                });
                previewContextMessage = composed.totalSelectedChunks > composed.chunkCount
                    ? ` Preview uses ${composed.chunkCount} chunk PNGs from the selected range (limited from ${composed.totalSelectedChunks}).`
                    : ` Preview uses ${composed.chunkCount} chunk PNGs from the selected folder range.`;
            } else {
                draft = await buildPngImportDraftFromPng({
                    url: resolvedPngUrl,
                    sourceX: getNumericInputValue(sourceXInput, 0),
                    sourceY: getNumericInputValue(sourceYInput, 0),
                    sourceWidth: getNumericInputValue(sourceWidthInput, 0),
                    sourceHeight: getNumericInputValue(sourceHeightInput, 0),
                    worldX: getNumericInputValue(worldXInput, 0),
                    worldY: getNumericInputValue(worldYInput, 0),
                    worldWidth: getNumericInputValue(worldWidthInput, 32),
                    worldHeight: getNumericInputValue(worldHeightInput, 32),
                    replaceExisting: replaceCheckbox.checked
                }, async (progress) => {
                    await handleProgressUpdate(progress, previewMeta);
                });
            }
            return {
                draft,
                previewContextMessage
            };
        };

        const setPreviewZoom = (zoom: number) => {
            previewZoom = clamp(zoom, 0.25, 8);
            previewCanvas.style.width = `${Math.max(1, Math.round(previewCanvas.width * previewZoom))}px`;
            previewCanvas.style.height = `${Math.max(1, Math.round(previewCanvas.height * previewZoom))}px`;
            zoomLabel.textContent = `${Math.round(previewZoom * 100)}%`;
        };

        const fitPreviewZoom = () => {
            if (!previewDraft || previewCanvas.width <= 0 || previewCanvas.height <= 0) {
                setPreviewZoom(1);
                return;
            }
            const availableWidth = Math.max(1, previewFrame.clientWidth - 12);
            const availableHeight = Math.max(1, previewFrame.clientHeight - 12);
            const fitZoom = Math.min(
                availableWidth / previewCanvas.width,
                availableHeight / previewCanvas.height
            );
            setPreviewZoom(clamp(fitZoom, 0.25, 8));
        };

        const syncImportModeUi = () => {
            const folderMode = importMode === 'folder';
            singleModeButton.classList.toggle('selected', !folderMode);
            folderModeButton.classList.toggle('selected', folderMode);
            singleSourceCard.hidden = folderMode;
            sourceCropCard.hidden = folderMode;
            folderSourceCard.hidden = !folderMode || workTab !== 'import';
            exportTabButton.disabled = folderMode;
            if (folderMode && workTab !== 'import') {
                workTab = 'import';
            }
            worldWidthInput.readOnly = folderMode;
            worldHeightInput.readOnly = folderMode;
            worldMeta.textContent = folderMode
                ? 'Chunk-folder mode uses the full folder import width and height, even if you limit the chunk run. World left/top is the origin for that full import area.'
                : 'Single PNG mode uses the source tile grid from the chosen PNG crop and maps it across the world rectangle you enter here.';
            refs.modalConfirm.style.display = workTab === 'export' ? 'none' : '';
        };

        const syncWorkTabUi = () => {
            const exportTabEnabled = importMode === 'single';
            const exportTabActive = exportTabEnabled && workTab === 'export';
            importTabButton.classList.toggle('selected', !exportTabActive);
            exportTabButton.classList.toggle('selected', exportTabActive);
            exportTabButton.hidden = !exportTabEnabled;
            tabSummary.textContent = exportTabActive
                ? 'Chunk export lets you slice a source PNG into reusable import sections with a manifest.'
                : 'Import mode previews matched world blocks before they touch the live world.';
            exportCard.hidden = !exportTabActive;
            worldCard.hidden = exportTabActive;
            actionCard.hidden = exportTabActive;
            importMain.hidden = exportTabActive;
            previewCard.hidden = exportTabActive;
            editorCard.hidden = exportTabActive;
            folderSourceCard.hidden = importMode !== 'folder' || exportTabActive;
            directFolderImportButton.hidden = exportTabActive || importMode !== 'folder';
        };

        const setImportBusy = (busy: boolean) => {
            importBusy = busy;
            refs.modal.dataset.busy = busy ? 'true' : 'false';
            const controls: Array<HTMLInputElement | HTMLButtonElement | HTMLSelectElement> = [
                singleModeButton,
                folderModeButton,
                importTabButton,
                exportTabButton,
                urlInput,
                browseButton,
                fileInput,
                folderBrowseButton,
                folderMinColumnInput,
                folderMaxColumnInput,
                folderMinRowInput,
                folderMaxRowInput,
                folderMaxChunksInput,
                folderFitTargetCheckbox,
                sourceXInput,
                sourceYInput,
                sourceWidthInput,
                sourceHeightInput,
                exportPresetSelect,
                exportWidthInput,
                exportHeightInput,
                exportSkipEmptyCheckbox,
                exportButton,
                worldXInput,
                worldYInput,
                worldWidthInput,
                worldHeightInput,
                replaceCheckbox,
                clearAllCheckbox,
                snapButton,
                previewButton,
                directFolderImportButton,
                selectedTypeFilterInput,
                selectedPaletteInput,
                selectedRotationSelect,
                selectedTranslationSelect,
                resetTileButton,
                zoomOutButton,
                zoomFitButton,
                zoomResetButton,
                zoomInButton,
                refs.modalClose
            ];
            for (const control of controls) {
                control.disabled = busy;
            }
            previewFrame.classList.toggle('busy', busy);
            progressCard.classList.toggle('busy', busy);
            selectedTypePicker.style.pointerEvents = busy ? 'none' : '';
            previewCanvas.style.pointerEvents = busy ? 'none' : '';
            worldWidthInput.disabled = busy || importMode === 'folder';
            worldHeightInput.disabled = busy || importMode === 'folder';
            progressCancelButton.disabled = !busy || progressMode === 'none';
            renderImportTypePicker();
            syncSelectedPreviewControls();
        };

        const renderImportTypePicker = () => {
            const selectedBlock = getSelectedPreviewBlock();
            const filter = selectedTypeFilterInput.value.trim().toLowerCase();
            const palette = selectedBlock && typeof selectedBlock.palette === 'number' ? selectedBlock.palette : 0;
            const rotation = normalizeRotation(selectedBlock?.rotation);
            const translation = normalizeSpriteTranslation(selectedBlock?.translation);
            for (const type of pngImportTypeNames) {
                let button = selectedTypeButtons.get(type);
                if (!button) {
                    button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'world-designer-sprite-option';
                    button.dataset.spriteType = type;

                    const canvas = document.createElement('canvas');
                    canvas.className = 'world-designer-sprite-canvas';
                    canvas.width = 56;
                    canvas.height = 56;
                    button.appendChild(canvas);

                    const label = document.createElement('div');
                    label.className = 'world-designer-sprite-option-label';
                    label.textContent = type;
                    button.appendChild(label);

                    button.addEventListener('click', () => {
                        const currentBlock = getSelectedPreviewBlock();
                        if (!currentBlock) {
                            return;
                        }
                        currentBlock.type = type;
                        const defaults = pngImportTypeDefaults.get(type);
                        if (defaults) {
                            currentBlock.collision = defaults.collision;
                            currentBlock.maskAstronaut = defaults.maskAstronaut;
                        }
                        selectedTypePicker.open = false;
                        renderPreviewCanvas();
                    });

                    selectedTypeButtons.set(type, button);
                    selectedTypeGrid.appendChild(button);
                }

                const matchesFilter = filter.length === 0 || type.toLowerCase().includes(filter);
                button.hidden = !matchesFilter;
                button.style.display = matchesFilter ? '' : 'none';
                button.disabled = !selectedBlock || importBusy;
                button.classList.toggle('selected', type === selectedBlock?.type);
                const canvas = button.querySelector('canvas');
                if (canvas instanceof HTMLCanvasElement) {
                    renderSpritePreviewCanvas(canvas, type, palette, rotation, translation);
                }
            }
        };

        const syncSelectedPreviewControls = () => {
            const selectedBlock = getSelectedPreviewBlock();
            const hasSelection = selectedBlock !== null;
            selectedTypePicker.open = hasSelection ? selectedTypePicker.open : false;
            selectedTypeFilterInput.disabled = !hasSelection || importBusy;
            selectedPaletteInput.disabled = !hasSelection || importBusy;
            selectedRotationSelect.disabled = !hasSelection || importBusy;
            selectedTranslationSelect.disabled = !hasSelection || importBusy;
            resetTileButton.disabled = !hasSelection || importBusy;
            if (!selectedBlock || !previewDraft) {
                selectedTileInput.value = 'No tile selected';
                clearPreviewCanvas(selectedTypePreviewCanvas);
                selectedTypeMeta.textContent = 'No sprite selected';
                renderImportTypePicker();
                return;
            }

            const column = selectedPreviewIndex % previewDraft.columns;
            const row = Math.floor(selectedPreviewIndex / previewDraft.columns);
            selectedTileInput.value = `Column ${column + 1}, row ${row + 1} — ${selectedBlock.type}`;
            selectedPaletteInput.value = String(typeof selectedBlock.palette === 'number' ? selectedBlock.palette : 0);
            selectedRotationSelect.value = String(normalizeRotation(selectedBlock.rotation));
            selectedTranslationSelect.value = normalizeSpriteTranslation(selectedBlock.translation);
            renderSpritePreviewCanvas(
                selectedTypePreviewCanvas,
                selectedBlock.type,
                typeof selectedBlock.palette === 'number' ? selectedBlock.palette : 0,
                normalizeRotation(selectedBlock.rotation),
                normalizeSpriteTranslation(selectedBlock.translation)
            );
            selectedTypeMeta.textContent = `${selectedBlock.type} — palette ${typeof selectedBlock.palette === 'number' ? selectedBlock.palette : 0}, rotation ${normalizeRotation(selectedBlock.rotation)}, translation ${formatSpriteTranslation(selectedBlock.translation)}`;
            renderImportTypePicker();
        };

        const renderPreviewCanvas = () => {
            if (!previewDraft) {
                previewCanvas.width = 32;
                previewCanvas.height = 32;
                setPreviewZoom(previewZoom);
                clearPreviewCanvas(previewCanvas);
                syncSelectedPreviewControls();
                return;
            }

            previewTileSize = getPngImportPreviewTileSize(previewDraft.columns, previewDraft.rows);
            previewCanvas.width = Math.max(1, previewDraft.columns * previewTileSize);
            previewCanvas.height = Math.max(1, previewDraft.rows * previewTileSize);
            setPreviewZoom(previewZoom);
            const ctx = previewCanvas.getContext('2d');
            if (!ctx) {
                syncSelectedPreviewControls();
                return;
            }

            ctx.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.fillStyle = '#020617';
            ctx.fillRect(0, 0, previewCanvas.width, previewCanvas.height);
            ctx.imageSmoothingEnabled = false;

            const lowConfidenceIndexes = new Set(previewDraft.lowConfidenceTileIndexes);
            for (let index = 0; index < previewBlocks.length; index += 1) {
                const block = previewBlocks[index];
                const column = index % previewDraft.columns;
                const row = Math.floor(index / previewDraft.columns);
                const drawX = column * previewTileSize;
                const drawY = row * previewTileSize;
                if (block) {
                    ctx.save();
                    ctx.translate(drawX, drawY);
                    host.drawSpriteSample(
                        ctx,
                        block.type,
                        typeof block.palette === 'number' ? block.palette : 0,
                        normalizeRotation(block.rotation),
                        false,
                        previewTileSize,
                        normalizeSpriteTranslation(block.translation)
                    );
                    ctx.restore();
                }

                ctx.strokeStyle = 'rgba(148, 163, 184, 0.18)';
                ctx.lineWidth = 1;
                ctx.strokeRect(drawX + 0.5, drawY + 0.5, previewTileSize - 1, previewTileSize - 1);

                if (lowConfidenceIndexes.has(index)) {
                    ctx.strokeStyle = 'rgba(251, 191, 36, 0.95)';
                    ctx.lineWidth = 2;
                    ctx.strokeRect(drawX + 1, drawY + 1, previewTileSize - 2, previewTileSize - 2);
                }
            }

            if (selectedPreviewIndex >= 0 && selectedPreviewIndex < previewBlocks.length) {
                const column = selectedPreviewIndex % previewDraft.columns;
                const row = Math.floor(selectedPreviewIndex / previewDraft.columns);
                ctx.strokeStyle = 'rgba(56, 189, 248, 0.98)';
                ctx.lineWidth = 3;
                ctx.strokeRect(
                    column * previewTileSize + 1.5,
                    row * previewTileSize + 1.5,
                    previewTileSize - 3,
                    previewTileSize - 3
                );
            }

            syncSelectedPreviewControls();
        };

        const invalidatePreview = (message: string) => {
            lastFolderCompose = null;
            previewDraft = null;
            previewBlocks = [];
            previewOriginalBlocks = [];
            selectedPreviewIndex = -1;
            refs.modalConfirm.disabled = true;
            previewMeta.textContent = message;
            renderPreviewCanvas();
        };

        const updatePngImportMeta = () => {
            const previewStateMessage = previewDraft
                ? ' Preview is ready below; click tiles to edit them before importing.'
                : ' Preview the blocks before importing so you can review and fix any bad matches.';
            if (importMode === 'folder') {
                if (!chunkFolderSelection) {
                    meta.textContent = 'Choose an exported chunk folder to inspect and rebuild a larger map section.';
                    return;
                }
                const range = getFolderSelectionRange();
                const { selectedChunks, totalSelectedChunks } = getPngChunkSelectionEntries(chunkFolderSelection, range);
                const worldX = Math.round(getNumericInputValue(worldXInput, 0));
                const worldY = Math.round(getNumericInputValue(worldYInput, 0));
                meta.textContent = `Loaded chunk folder ${chunkFolderSelection.directoryName}. The selected chunk range spans columns ${range.minChunkColumn + 1}-${range.maxChunkColumn + 1} and rows ${range.minChunkRow + 1}-${range.maxChunkRow + 1}, using ${selectedChunks.length} of ${totalSelectedChunks} available chunk PNGs. The importer will place that range relative to world origin (${worldX}, ${worldY}).${previewStateMessage}`;
                return;
            }
            if (!loadedImage) {
                meta.textContent = 'Enter a PNG URL to inspect and import.';
                return;
            }

            const sourceX = clamp(
                Math.round(getNumericInputValue(sourceXInput, 0)),
                0,
                Math.max(0, loadedImage.width - 1)
            );
            const sourceY = clamp(
                Math.round(getNumericInputValue(sourceYInput, 0)),
                0,
                Math.max(0, loadedImage.height - 1)
            );
            const sourceWidth = Math.max(
                1,
                Math.min(Math.round(getNumericInputValue(sourceWidthInput, loadedImage.width)), loadedImage.width - sourceX)
            );
            const sourceHeight = Math.max(
                1,
                Math.min(Math.round(getNumericInputValue(sourceHeightInput, loadedImage.height)), loadedImage.height - sourceY)
            );
            const sourceColumns = getPngImportSourceTileCount(sourceWidth);
            const sourceRows = getPngImportSourceTileCount(sourceHeight);
            const worldWidth = Math.max(1, Math.round(getNumericInputValue(worldWidthInput, getSuggestedPngImportWorldSpan(sourceWidth))));
            const worldHeight = Math.max(1, Math.round(getNumericInputValue(worldHeightInput, getSuggestedPngImportWorldSpan(sourceHeight))));
            const sourceTileAligned = sourceX % 32 === 0 &&
                sourceY % 32 === 0 &&
                sourceWidth % 32 === 0 &&
                sourceHeight % 32 === 0;
            meta.textContent = `Loaded ${resolvedPngLabel || resolvedPngUrl} (${loadedImage.width}x${loadedImage.height}). Source rect (${sourceX}, ${sourceY}, ${sourceWidth}x${sourceHeight}) is ${sourceTileAligned ? 'tile-aligned' : 'not tile-aligned'} and spans ${sourceColumns} x ${sourceRows} source tiles. Target world rect ${worldWidth}x${worldHeight} will place those ${sourceColumns} x ${sourceRows} blocks across that world area.${previewStateMessage}`;
        };

        const syncPngMetadata = async (options?: { forceFullImageBounds?: boolean }) => {
            if (importMode === 'folder') {
                loadedImage = null;
                updatePngImportMeta();
                return;
            }
            const url = resolvedPngUrl.trim();
            if (!url) {
                loadedImage = null;
                invalidatePreview('Preview not generated yet.');
                updatePngImportMeta();
                return;
            }

            try {
                const image = await loadImage(url);
                loadedImage = image;
                if (options?.forceFullImageBounds) {
                    sourceXInput.value = '0';
                    sourceYInput.value = '0';
                    sourceWidthInput.value = String(image.width);
                    sourceHeightInput.value = String(image.height);
                    worldWidthInput.value = String(getSuggestedPngImportWorldSpan(image.width));
                    worldHeightInput.value = String(getSuggestedPngImportWorldSpan(image.height));
                } else if (Number(sourceWidthInput.value) <= 0 || Number(sourceHeightInput.value) <= 0) {
                    sourceXInput.value = '0';
                    sourceYInput.value = '0';
                    sourceWidthInput.value = String(image.width);
                    sourceHeightInput.value = String(image.height);
                    if (Number(worldWidthInput.value) <= 0) {
                        worldWidthInput.value = String(getSuggestedPngImportWorldSpan(image.width));
                    }
                    if (Number(worldHeightInput.value) <= 0) {
                        worldHeightInput.value = String(getSuggestedPngImportWorldSpan(image.height));
                    }
                }
                invalidatePreview('Preview not generated yet. Click "Preview blocks" to inspect the matches.');
                updatePngImportMeta();
            } catch (error) {
                loadedImage = null;
                invalidatePreview(error instanceof Error ? error.message : 'Failed to generate a preview.');
                meta.textContent = error instanceof Error ? error.message : 'Failed to load the PNG metadata.';
            }
        };

        syncImportModeUi();
        syncWorkTabUi();
        syncExportChunkInputs();
        syncFolderRangeInputs();
        void syncPngMetadata();
        const switchImportMode = (nextMode: PngImportSourceMode) => {
            importMode = nextMode;
            invalidatePreview(importMode === 'folder'
                ? 'Preview not generated yet. Choose a chunk folder and click "Preview blocks" to inspect the reconstructed map section.'
                : 'Preview not generated yet. Click "Preview blocks" to inspect the matches.');
            syncImportModeUi();
            syncWorkTabUi();
            if (importMode === 'folder') {
                syncFolderRangeInputs();
                syncFolderTargetWorldSpan();
                updatePngImportMeta();
            } else {
                void syncPngMetadata();
            }
        };
        const switchWorkTab = (nextTab: PngImportWorkTab) => {
            if (nextTab === 'export' && importMode !== 'single') {
                return;
            }
            workTab = nextTab;
            syncImportModeUi();
            syncWorkTabUi();
        };
        singleModeButton.addEventListener('click', () => switchImportMode('single'));
        folderModeButton.addEventListener('click', () => switchImportMode('folder'));
        importTabButton.addEventListener('click', () => switchWorkTab('import'));
        exportTabButton.addEventListener('click', () => switchWorkTab('export'));
        progressCancelButton.addEventListener('click', () => {
            if (!importBusy || progressMode === 'none') {
                return;
            }
            cancelLongRunningRequested = true;
            setProgress({
                phase: progressMode === 'export' ? 'Cancelling chunk export' : 'Cancelling import',
                completed: progressBar.value,
                total: progressBar.max,
                detail: 'Finishing the current step before stopping.'
            });
        });
        browseButton.addEventListener('click', () => {
            fileInput.click();
        });
        fileInput.addEventListener('change', () => {
            const file = fileInput.files?.[0];
            if (!file) {
                return;
            }
            clearPngImportObjectUrl();
            pngImportObjectUrl = URL.createObjectURL(file);
            resolvedPngUrl = pngImportObjectUrl;
            resolvedPngLabel = file.name;
            urlInput.value = file.name;
            void syncPngMetadata({ forceFullImageBounds: true });
        });
        folderBrowseButton.addEventListener('click', async () => {
            try {
                progressStartedAt = Date.now();
                progressMode = 'import';
                cancelLongRunningRequested = false;
                setImportBusy(true);
                setProgress({
                    phase: 'Reading chunk folder',
                    completed: 0,
                    total: 1,
                    detail: 'Loading the exported chunk manifest and PNG files.'
                });
                const directoryHandle = await getDirectoryPicker()();
                chunkFolderSelection = await readPngChunkFolderSelection(directoryHandle, async (progress) => {
                    await handleProgressUpdate(progress, folderMeta);
                });
                folderMinColumnInput.value = '1';
                folderMaxColumnInput.value = String(chunkFolderSelection.manifest.totalChunkColumns);
                folderMinRowInput.value = '1';
                folderMaxRowInput.value = String(chunkFolderSelection.manifest.totalChunkRows);
                folderMaxChunksInput.value = '0';
                syncFolderRangeInputs();
                syncFolderTargetWorldSpan();
                invalidatePreview('Preview not generated yet. Click "Preview blocks" to inspect the reconstructed map section.');
                updatePngImportMeta();
            } catch (error) {
                chunkFolderSelection = null;
                syncFolderRangeInputs();
                invalidatePreview(error instanceof Error ? error.message : 'Failed to read the chunk folder.');
                setStatus(
                    error instanceof Error ? error.message : 'Failed to read the chunk folder.',
                    error instanceof Error && error.message === 'Import cancelled.' ? 'neutral' : 'error'
                );
            } finally {
                progressMode = 'none';
                setImportBusy(false);
                setProgress(null);
            }
        });

        urlInput.addEventListener('change', () => {
            clearPngImportObjectUrl();
            resolvedPngUrl = urlInput.value.trim();
            resolvedPngLabel = resolvedPngUrl;
            sourceWidthInput.value = '0';
            sourceHeightInput.value = '0';
            void syncPngMetadata();
        });

        const handleImportFieldChanged = () => {
            invalidatePreview(importMode === 'folder'
                ? 'Preview is out of date. Click "Preview blocks" again before importing the reconstructed chunk range.'
                : 'Preview is out of date. Click "Preview blocks" again before importing.');
            if (importMode === 'folder') {
                syncFolderTargetWorldSpan();
            }
            updatePngImportMeta();
        };

        [
            sourceXInput,
            sourceYInput,
            sourceWidthInput,
            sourceHeightInput,
            worldXInput,
            worldYInput,
            worldWidthInput,
            worldHeightInput
        ].forEach((input) => {
            input.addEventListener('input', handleImportFieldChanged);
            input.addEventListener('change', handleImportFieldChanged);
        });
        [
            folderMinColumnInput,
            folderMaxColumnInput,
            folderMinRowInput,
            folderMaxRowInput,
            folderMaxChunksInput
        ].forEach((input) => {
            input.addEventListener('input', () => {
                syncFolderRangeInputs();
                handleImportFieldChanged();
            });
            input.addEventListener('change', () => {
                syncFolderRangeInputs();
                handleImportFieldChanged();
            });
        });
        folderFitTargetCheckbox.addEventListener('change', () => {
            syncFolderTargetWorldSpan();
            updatePngImportMeta();
        });
        exportPresetSelect.addEventListener('change', () => {
            syncExportChunkInputs();
            updatePngImportMeta();
        });
        [exportWidthInput, exportHeightInput].forEach((input) => {
            input.addEventListener('input', () => {
                exportPresetSelect.value = 'custom';
                syncExportChunkInputs();
                updatePngImportMeta();
            });
            input.addEventListener('change', () => {
                exportPresetSelect.value = 'custom';
                syncExportChunkInputs();
                updatePngImportMeta();
            });
        });

        zoomOutButton.addEventListener('click', () => setPreviewZoom(previewZoom / 1.25));
        zoomInButton.addEventListener('click', () => setPreviewZoom(previewZoom * 1.25));
        zoomResetButton.addEventListener('click', () => setPreviewZoom(1));
        zoomFitButton.addEventListener('click', fitPreviewZoom);

        snapButton.addEventListener('click', () => {
            if (!loadedImage) {
                setStatus('Load a PNG before snapping the source rectangle.', 'error');
                return;
            }

            const currentX = clamp(
                Math.round(getNumericInputValue(sourceXInput, 0)),
                0,
                Math.max(0, loadedImage.width - 1)
            );
            const currentY = clamp(
                Math.round(getNumericInputValue(sourceYInput, 0)),
                0,
                Math.max(0, loadedImage.height - 1)
            );
            const currentWidth = Math.max(
                1,
                Math.min(Math.round(getNumericInputValue(sourceWidthInput, loadedImage.width)), loadedImage.width - currentX)
            );
            const currentHeight = Math.max(
                1,
                Math.min(Math.round(getNumericInputValue(sourceHeightInput, loadedImage.height)), loadedImage.height - currentY)
            );
            const snappedX = Math.floor(currentX / 32) * 32;
            const snappedY = Math.floor(currentY / 32) * 32;
            const snappedRight = Math.min(loadedImage.width, Math.ceil((currentX + currentWidth) / 32) * 32);
            const snappedBottom = Math.min(loadedImage.height, Math.ceil((currentY + currentHeight) / 32) * 32);
            sourceXInput.value = String(snappedX);
            sourceYInput.value = String(snappedY);
            sourceWidthInput.value = String(Math.max(1, snappedRight - snappedX));
            sourceHeightInput.value = String(Math.max(1, snappedBottom - snappedY));
            invalidatePreview('Preview is out of date. Click "Preview blocks" again before importing.');
            updatePngImportMeta();
        });
        exportButton.addEventListener('click', async () => {
            if (importMode !== 'single') {
                setStatus('Chunk export is only available when working from a single PNG source.', 'error');
                return;
            }
            if (!loadedImage) {
                setStatus('Load a PNG before exporting chunk files.', 'error');
                return;
            }
            const sourceX = clamp(Math.round(getNumericInputValue(sourceXInput, 0)), 0, Math.max(0, loadedImage.width - 1));
            const sourceY = clamp(Math.round(getNumericInputValue(sourceYInput, 0)), 0, Math.max(0, loadedImage.height - 1));
            const sourceWidth = Math.max(1, Math.min(Math.round(getNumericInputValue(sourceWidthInput, loadedImage.width)), loadedImage.width - sourceX));
            const sourceHeight = Math.max(1, Math.min(Math.round(getNumericInputValue(sourceHeightInput, loadedImage.height)), loadedImage.height - sourceY));
            const chunkSize = getExportChunkSize();
            progressStartedAt = Date.now();
            progressMode = 'export';
            cancelLongRunningRequested = false;
            setImportBusy(true);
            setProgress({
                phase: 'Preparing chunk export',
                completed: 0,
                total: 1,
                detail: 'Validating the PNG crop and opening a destination folder.'
            });
            const totalChunkColumns = Math.ceil((sourceWidth / PNG_IMPORT_SOURCE_TILE_SIZE) / chunkSize.width);
            const totalChunkRows = Math.ceil((sourceHeight / PNG_IMPORT_SOURCE_TILE_SIZE) / chunkSize.height);
            const estimatedChunkCount = Math.max(1, totalChunkColumns * totalChunkRows);
            exportMeta.textContent = `Preparing to export about ${estimatedChunkCount} chunk PNGs (${totalChunkColumns} x ${totalChunkRows}).`;
            try {
                const result = await exportPngChunksToDirectory({
                    image: loadedImage,
                    sourceName: resolvedPngLabel || resolvedPngUrl || 'png-import',
                    sourceX,
                    sourceY,
                    sourceWidth,
                    sourceHeight,
                    chunkTileWidth: chunkSize.width,
                    chunkTileHeight: chunkSize.height,
                    skipEmpty: exportSkipEmptyCheckbox.checked,
                    shouldCancel: () => cancelLongRunningRequested
                }, async (progress) => {
                    await handleProgressUpdate(progress, exportMeta);
                });
                exportMeta.textContent = `Exported ${result.exportedChunks} chunk PNGs to ${result.directoryName}${result.skippedChunks > 0 ? ` and skipped ${result.skippedChunks} empty chunks` : ''}. The folder also contains ${PNG_CHUNK_EXPORT_MANIFEST_NAME} so the chunk-folder importer can rebuild the larger map automatically.`;
                setStatus(
                    `Exported ${result.exportedChunks} chunk PNGs to ${result.directoryName}${result.skippedChunks > 0 ? ` and skipped ${result.skippedChunks} empty chunks` : ''}.`,
                    'success'
                );
            } catch (error) {
                exportMeta.textContent = error instanceof Error ? error.message : 'Failed to export chunk PNGs.';
                setStatus(
                    error instanceof Error ? error.message : 'Failed to export chunk PNGs.',
                    error instanceof Error && error.message === 'Chunk export cancelled.' ? 'neutral' : 'error'
                );
            } finally {
                progressMode = 'none';
                setImportBusy(false);
                setProgress(null);
            }
        });

        previewCanvas.addEventListener('click', (event) => {
            if (!previewDraft || previewBlocks.length === 0) {
                return;
            }
            const rect = previewCanvas.getBoundingClientRect();
            if (rect.width <= 0 || rect.height <= 0) {
                return;
            }
            const scaleX = previewCanvas.width / rect.width;
            const scaleY = previewCanvas.height / rect.height;
            const localX = (event.clientX - rect.left) * scaleX;
            const localY = (event.clientY - rect.top) * scaleY;
            const column = clamp(Math.floor(localX / previewTileSize), 0, previewDraft.columns - 1);
            const row = clamp(Math.floor(localY / previewTileSize), 0, previewDraft.rows - 1);
            selectedPreviewIndex = row * previewDraft.columns + column;
            renderPreviewCanvas();
        });

        selectedPaletteInput.addEventListener('change', () => {
            const selectedBlock = getSelectedPreviewBlock();
            if (!selectedBlock) {
                return;
            }
            const palette = clamp(Math.round(getNumericInputValue(selectedPaletteInput, 0)), 0, Math.max(paletteCount - 1, 0));
            selectedBlock.palette = palette;
            selectedPaletteInput.value = String(palette);
            renderPreviewCanvas();
        });

        selectedRotationSelect.addEventListener('change', () => {
            const selectedBlock = getSelectedPreviewBlock();
            if (!selectedBlock) {
                return;
            }
            selectedBlock.rotation = normalizeRotation(Number(selectedRotationSelect.value)) as MapBlock['rotation'];
            renderPreviewCanvas();
        });

        selectedTranslationSelect.addEventListener('change', () => {
            const selectedBlock = getSelectedPreviewBlock();
            if (!selectedBlock) {
                return;
            }
            selectedBlock.translation = normalizeSpriteTranslation(selectedTranslationSelect.value);
            renderPreviewCanvas();
        });

        resetTileButton.addEventListener('click', () => {
            if (selectedPreviewIndex < 0 || selectedPreviewIndex >= previewOriginalBlocks.length) {
                return;
            }
            const originalBlock = previewOriginalBlocks[selectedPreviewIndex];
            previewBlocks[selectedPreviewIndex] = originalBlock ? toMapBlockData(originalBlock) : null;
            renderPreviewCanvas();
        });

        previewButton.addEventListener('click', async () => {
            progressStartedAt = Date.now();
            previewButton.textContent = 'Generating…';
            previewMeta.textContent = 'Generating preview…';
            progressMode = 'import';
            cancelLongRunningRequested = false;
            setImportBusy(true);
            setProgress({
                phase: 'Preparing import',
                completed: 0,
                total: 1,
                detail: 'Starting PNG preview generation.'
            });
            try {
                const { draft, previewContextMessage } = await buildDraftForCurrentImportMode();
                previewDraft = draft;
                previewBlocks = draft.blocks.map((block) => (block ? toMapBlockData(block) : null));
                previewOriginalBlocks = draft.blocks.map((block) => (block ? toMapBlockData(block) : null));
                selectedPreviewIndex = previewBlocks.findIndex((block) => block !== null);
                renderPreviewCanvas();
                fitPreviewZoom();
                const importedTileCount = draft.blocks.filter((block) => block !== null).length;
                const gridOffsetMessage = draft.sourceGridOffsetX !== 0 || draft.sourceGridOffsetY !== 0
                    ? ` Auto-aligned the source grid by (${draft.sourceGridOffsetX}, ${draft.sourceGridOffsetY}) px before matching.`
                    : '';
                previewMeta.textContent = draft.uncertainTiles > 0
                    ? `Preview ready. ${draft.uncertainTiles} tile${draft.uncertainTiles === 1 ? '' : 's'} were low-confidence matches and are outlined in gold.${gridOffsetMessage}${previewContextMessage}`
                    : `Preview ready. ${importedTileCount} tile${importedTileCount === 1 ? '' : 's'} matched cleanly.${gridOffsetMessage}${previewContextMessage}`;
                refs.modalConfirm.disabled = selectedPreviewIndex < 0;
                updatePngImportMeta();
            } catch (error) {
                invalidatePreview(error instanceof Error ? error.message : 'Failed to generate the preview.');
                setStatus(
                    error instanceof Error ? error.message : 'Failed to generate the PNG preview.',
                    error instanceof Error && error.message === 'Import cancelled.' ? 'neutral' : 'error'
                );
            } finally {
                progressMode = 'none';
                setImportBusy(false);
                setProgress(null);
                previewButton.textContent = 'Preview blocks';
            }
        });

        directFolderImportButton.addEventListener('click', async () => {
            if (importMode !== 'folder') {
                return;
            }
            progressStartedAt = Date.now();
            previewMeta.textContent = 'Trying folder import without manual review…';
            progressMode = 'import';
            cancelLongRunningRequested = false;
            setImportBusy(true);
            setProgress({
                phase: 'Preparing import',
                completed: 0,
                total: 1,
                detail: 'Starting direct chunk-folder import.'
            });
            try {
                const { draft } = await buildDraftForCurrentImportMode();
                applyPngImportDraft(draft, replaceCheckbox.checked, clearAllCheckbox.checked);
                closeModal(true);
                const blockCount = draft.blocks.filter((block): block is MapBlock => block !== null).length;
                setStatus(
                    draft.uncertainTiles > 0
                        ? `Imported ${blockCount} draft world tiles from the chunk folder without manual preview review. ${draft.uncertainTiles} tile${draft.uncertainTiles === 1 ? '' : 's'} were low-confidence matches, so review the result before saving.`
                        : `Imported ${blockCount} draft world tiles from the chunk folder without manual preview review.`,
                    draft.uncertainTiles > 0 ? 'neutral' : 'success'
                );
            } catch (error) {
                const message = error instanceof Error ? error.message : 'Failed to import the chunk folder.';
                previewMeta.textContent = message;
                setStatus(
                    message,
                    error instanceof Error && error.message === 'Import cancelled.' ? 'neutral' : 'error'
                );
            } finally {
                progressMode = 'none';
                setImportBusy(false);
                setProgress(null);
            }
        });

        selectedTypeFilterInput.addEventListener('input', () => {
            renderImportTypePicker();
        });

        modalConfirmAction = async () => {
            if (!previewDraft || previewBlocks.length === 0) {
                setStatus('Generate a preview before importing so you can review the matched blocks.', 'error');
                refs.modalConfirm.disabled = true;
                return;
            }
            try {
                setImportBusy(true);
                const sourceLabel = importMode === 'folder' ? 'chunk folder' : 'PNG';
                const committedDraft: PngImportDraft = {
                    ...previewDraft,
                    blocks: previewBlocks.map((block) => (block ? toMapBlockData(block) : null))
                };
                applyPngImportDraft(committedDraft, replaceCheckbox.checked, clearAllCheckbox.checked);
                closeModal(true);
                const blockCount = committedDraft.blocks.filter((block): block is MapBlock => block !== null).length;
                setStatus(
                    committedDraft.uncertainTiles > 0
                        ? `Imported ${blockCount} reviewed draft world tiles from the ${sourceLabel}. ${committedDraft.uncertainTiles} tile${committedDraft.uncertainTiles === 1 ? '' : 's'} were low-confidence auto-matches before review.`
                        : `Imported ${blockCount} reviewed draft world tiles from the ${sourceLabel}.`,
                    committedDraft.uncertainTiles > 0 ? 'neutral' : 'success'
                );
            } catch (error) {
                refs.modalConfirm.disabled = false;
                setStatus(
                    error instanceof Error ? error.message : 'Failed to import a draft from the PNG.',
                    'error'
                );
            } finally {
                setImportBusy(false);
            }
        };

        renderImportTypePicker();
        syncSelectedPreviewControls();
        setPreviewZoom(1);
        setImportBusy(false);
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

    function updateSelectionSummary() {
        const resetConvertControls = () => {
            refs.convertTargetSelect.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'No conversion available';
            refs.convertTargetSelect.appendChild(placeholder);
            refs.convertTargetSelect.value = '';
            refs.convertTargetSelect.disabled = true;
            refs.convertButton.disabled = true;
            refs.convertButton.textContent = 'Convert';
        };
        const selections = getSelectedItems();
        if (selections.length === 0) {
            const astronautStart = getAstronautStartPosition();
            refs.selectionSummary.textContent = `Nothing selected. Astronaut start: (${astronautStart.x}, ${astronautStart.y})`;
            resetConvertControls();
            refs.deleteButton.disabled = true;
            refs.duplicateButton.disabled = true;
            refs.sendToBackButton.disabled = true;
            refs.bringToFrontButton.disabled = true;
            refs.focusButton.disabled = true;
            return;
        }
        if (selections.length > 1) {
            refs.selectionSummary.textContent = `${selections.length} objects selected. Drag any selected object to move the group, or right-click to group them as a custom sprite.`;
            refs.selectionSummary.textContent = `${selections.length} objects selected. Drag any selected object to move the group, or right-click to group them as a custom sprite.`;
            resetConvertControls();
            refs.deleteButton.disabled = false;
            refs.duplicateButton.disabled = false;
            refs.sendToBackButton.disabled = false;
            refs.bringToFrontButton.disabled = false;
            refs.focusButton.disabled = false;
            return;
        }

        const { category, entity } = state.selection!;
        refs.selectionSummary.textContent = category === 'custom'
            ? `${CATEGORY_LABELS[category]}: ${entity.type} at (${entity.x}, ${entity.y})`
            : `${CATEGORY_LABELS[category]}: ${entity.type} at (${entity.x}, ${entity.y})`;
        const convertTargets = getConvertTargetCategories(state.selection!);
        refs.convertTargetSelect.innerHTML = '';
        for (const target of convertTargets) {
            const option = document.createElement('option');
            option.value = target;
            option.textContent = CATEGORY_LABELS[target].replace(/^[a-z]/, (letter) => letter.toUpperCase());
            refs.convertTargetSelect.appendChild(option);
        }
        refs.convertTargetSelect.disabled = convertTargets.length === 0;
        refs.convertButton.disabled = convertTargets.length === 0;
        refs.convertButton.textContent = 'Convert';
        refs.deleteButton.disabled = false;
        refs.duplicateButton.disabled = false;
        refs.sendToBackButton.disabled = false;
        refs.bringToFrontButton.disabled = false;
        refs.focusButton.disabled = false;
    }

    function addCheckboxInspector(
        container: HTMLElement,
        label: string,
        checked: boolean,
        onChange: (checked: boolean) => void
    ) {
        const row = document.createElement('label');
        row.className = 'world-designer-checkbox';
        const input = document.createElement('input');
        const focusKey = label;
        input.type = 'checkbox';
        input.checked = checked;
        input.dataset.inspectorKey = focusKey;
        input.addEventListener('change', () => {
            pendingInspectorFocusKey = focusKey;
            onChange(input.checked);
        });
        row.appendChild(input);
        row.append(label);
        container.appendChild(row);
    }

    function addTextInspector(
        container: HTMLElement,
        label: string,
        value: string,
        onCommit: (value: string) => void,
        multiline = false
    ) {
        const field = document.createElement('label');
        field.className = 'world-designer-field';
        field.textContent = label;
        const input = multiline ? document.createElement('textarea') : document.createElement('input');
        const focusKey = label;
        input.value = value;
        input.dataset.inspectorKey = focusKey;
        input.addEventListener('change', () => {
            pendingInspectorFocusKey = focusKey;
            onCommit(input.value);
        });
        field.appendChild(input);
        container.appendChild(field);
    }

    function addNumberInspector(
        container: HTMLElement,
        label: string,
        value: number,
        onCommit: (value: number) => void,
        step = 1
    ) {
        const field = document.createElement('label');
        field.className = 'world-designer-field';
        field.textContent = label;
        const input = document.createElement('input');
        const focusKey = label;
        input.type = 'number';
        input.step = String(step);
        input.value = String(value);
        input.dataset.inspectorKey = focusKey;
        input.addEventListener('change', () => {
            pendingInspectorFocusKey = focusKey;
            onCommit(Number(input.value));
        });
        field.appendChild(input);
        container.appendChild(field);
    }

    function addSelectInspector(
        container: HTMLElement,
        label: string,
        value: string,
        options: string[],
        onCommit: (value: string) => void
    ) {
        const field = document.createElement('label');
        field.className = 'world-designer-field';
        field.textContent = label;
        const select = document.createElement('select');
        const focusKey = label;
        for (const optionValue of options) {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            select.appendChild(option);
        }
        select.value = value;
        select.dataset.inspectorKey = focusKey;
        select.addEventListener('change', () => {
            pendingInspectorFocusKey = focusKey;
            onCommit(select.value);
        });
        field.appendChild(select);
        container.appendChild(field);
    }

    function addOptionSelectInspector(
        container: HTMLElement,
        label: string,
        value: string,
        options: Array<{ value: string; label: string }>,
        onCommit: (value: string) => void
    ) {
        const field = document.createElement('label');
        field.className = 'world-designer-field';
        field.textContent = label;
        const select = document.createElement('select');
        const focusKey = label;
        for (const optionValue of options) {
            const option = document.createElement('option');
            option.value = optionValue.value;
            option.textContent = optionValue.label;
            select.appendChild(option);
        }
        select.value = value;
        select.dataset.inspectorKey = focusKey;
        select.addEventListener('change', () => {
            pendingInspectorFocusKey = focusKey;
            onCommit(select.value);
        });
        field.appendChild(select);
        container.appendChild(field);
    }

    function restorePendingInspectorFocus() {
        if (!pendingInspectorFocusKey) {
            return;
        }
        const selector = `[data-inspector-key="${CSS.escape(pendingInspectorFocusKey)}"]`;
        const field = refs.inspector.querySelector(selector);
        pendingInspectorFocusKey = null;
        if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
            return;
        }
        if (field.disabled) {
            return;
        }
        field.focus();
        if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
            field.select();
        }
    }

    function addInspectorAction(
        container: HTMLElement,
        label: string,
        onClick: () => void
    ) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', onClick);
        container.appendChild(button);
    }

    function renderButtonDefaultsInspector(container: HTMLElement, selectedButton: Button | null) {
        const effectiveDefaults = getEffectiveButtonDefaultOverrides();
        const paletteOptions = Array.from({ length: paletteCount }, (_, index) => ({
            value: String(index),
            label: `Palette ${index}`
        }));
        const accordion = document.createElement('details');
        const accordionSummary = document.createElement('summary');
        accordionSummary.textContent = 'Defaults for new buttons and button conversions';
        accordion.appendChild(accordionSummary);
        const body = document.createElement('div');
        const summary = document.createElement('div');
        summary.className = 'world-designer-summary';
        summary.textContent = 'Existing buttons keep their own values.';
        body.appendChild(summary);
        addOptionSelectInspector(body, 'Default button cap palette', String(effectiveDefaults.capPalette), paletteOptions, (value) => {
            runMutation('Updated default button cap palette.', () => {
                state.buttonDefaults.capPalette = clamp(Math.round(Number(value)), 0, paletteCount - 1);
            });
        });
        addOptionSelectInspector(body, 'Default box palette', String(effectiveDefaults.boxPalette), paletteOptions, (value) => {
            runMutation('Updated default button box palette.', () => {
                state.buttonDefaults.boxPalette = clamp(Math.round(Number(value)), 0, paletteCount - 1);
            });
        });
        addNumberInspector(body, 'Default closed cap offset X (from box)', effectiveDefaults.capClosedOffsetX, (value) => {
            runMutation('Updated default closed button cap X.', () => {
                state.buttonDefaults.capClosedOffsetX = Math.round(value);
            });
        });
        addNumberInspector(body, 'Default closed cap offset Y (from box)', effectiveDefaults.capClosedOffsetY, (value) => {
            runMutation('Updated default closed button cap Y.', () => {
                state.buttonDefaults.capClosedOffsetY = Math.round(value);
            });
        });
        addNumberInspector(body, 'Default open cap offset X (from box)', effectiveDefaults.capOpenOffsetX, (value) => {
            runMutation('Updated default open button cap X.', () => {
                state.buttonDefaults.capOpenOffsetX = Math.round(value);
            });
        });
        addNumberInspector(body, 'Default open cap offset Y (from box)', effectiveDefaults.capOpenOffsetY, (value) => {
            runMutation('Updated default open button cap Y.', () => {
                state.buttonDefaults.capOpenOffsetY = Math.round(value);
            });
        });
        if (selectedButton) {
            addInspectorAction(body, 'Use selected button as new-button defaults', () => {
                runMutation('Copied selected button to button defaults.', () => {
                    setButtonDefaultOverridesFromButton(selectedButton);
                });
            });
        }
        addInspectorAction(body, 'Reset button defaults', () => {
            runMutation('Reset button defaults.', () => {
                resetButtonDefaultOverrides();
            });
        });
        accordion.appendChild(body);
        container.appendChild(accordion);
    }

    function refreshInspector() {
        refs.inspector.innerHTML = '';
        updateSelectionSummary();

        const selectedItems = getSelectedItems();
        if (!state.selection) {
            if (state.category === 'buttons') {
                renderButtonDefaultsInspector(refs.inspector, null);
            }
            return;
        }
        if (selectedItems.length > 1) {
            const summary = document.createElement('div');
            summary.className = 'world-designer-summary';
            summary.textContent = 'Multi-selection active. Palette edits apply to all selected sprites.';
            refs.inspector.appendChild(summary);
            if (state.category === 'buttons') {
                renderButtonDefaultsInspector(refs.inspector, null);
            }
            return;
        }

        const { category, entity } = state.selection;
        const container = refs.inspector;

        if (category === 'custom') {
            const definition = getCustomSpriteDefinitionForInstance(entity as CustomSpriteInstance);
            addTextInspector(container, 'Name', definition?.name ?? entity.type, (value) => {
                runMutation('Renamed custom sprite.', () => {
                    const trimmed = value.trim();
                    const nextName = trimmed.length > 0 ? trimmed : createCustomSpriteName();
                    if (definition) {
                        renameCustomSpriteDefinition(definition, nextName);
                    } else {
                        entity.type = nextName;
                    }
                });
            });
            addNumberInspector(container, 'X', entity.x, (value) => {
                runMutation('Updated X position.', () => {
                    applyEntityPositionWithTeleporterSync(entity, value, entity.y);
                });
            });
            addNumberInspector(container, 'Y', entity.y, (value) => {
                runMutation('Updated Y position.', () => {
                    applyEntityPositionWithTeleporterSync(entity, entity.x, value);
                });
            });
            const summary = document.createElement('div');
            summary.className = 'world-designer-summary';
            summary.textContent = definition
                ? `${definition.members.length} part${definition.members.length === 1 ? '' : 's'}. Use Convert to button for a live runtime button, or right-click to ungroup.`
                : 'Missing custom sprite definition.';
            container.appendChild(summary);
            if (definition) {
                addInspectorAction(container, 'Delete custom sprite type', () => {
                    deleteCustomSpriteSelectionDefinition();
                });
            }
            return;
        }

        addSelectInspector(container, 'Type', entity.type, spriteTypes, (value) => {
            runMutation('Updated sprite type.', () => {
                entity.type = value;
                state.typeByCategory[category] = value;
            });
        });
        addNumberInspector(container, 'X', entity.x, (value) => {
            runMutation('Updated X position.', () => {
                applyEntityPositionWithTeleporterSync(entity, value, entity.y);
            });
        });
        addNumberInspector(container, 'Y', entity.y, (value) => {
            runMutation('Updated Y position.', () => {
                applyEntityPositionWithTeleporterSync(entity, entity.x, value);
            });
        });
        addNumberInspector(container, 'Rotation', normalizeRotation(entity.rotation), (value) => {
            runMutation('Updated rotation.', () => {
                applyEntityRotationWithTeleporterSync(entity, value);
                if (category === 'creatures') {
                    entity.state = entity.state ?? {};
                    entity.state.authoredRotation = entity.rotation;
                }
                if ('defaultRotation' in entity) {
                    entity.defaultRotation = entity.rotation;
                }
            });
        });
        if (category === 'world') {
            addSelectInspector(
                container,
                'Translation',
                normalizeSpriteTranslation(entity.translation),
                [...SPRITE_TRANSLATION_OPTIONS],
                (value) => {
                    runMutation('Updated translation.', () => {
                        entity.translation = normalizeSpriteTranslation(value);
                    });
                }
            );
        }
        const paletteOptions = Array.from({ length: paletteCount }, (_, index) => ({
            value: String(index),
            label: `Palette ${index}`
        }));
        if (category === 'buttons') {
            addOptionSelectInspector(container, 'Button cap palette', String(entity.palette ?? 0), paletteOptions, (value) => {
                runMutation('Updated palette.', () => {
                    const nextPalette = clamp(Math.round(Number(value)), 0, paletteCount - 1);
                    entity.palette = nextPalette;
                });
            });
        } else {
            addNumberInspector(container, 'Palette', entity.palette ?? 0, (value) => {
                runMutation('Updated palette.', () => {
                    const nextPalette = clamp(Math.round(value), 0, paletteCount - 1);
                    entity.palette = nextPalette;
                });
            });
        }
        const effectivePaletteCycle = getEffectivePaletteCycle(entity.type, entity.paletteCycle, paletteCount);
        if (effectivePaletteCycle) {
            const isTeleporterDefault = entity.type === 'teleporter_pad' && !entity.paletteCycle;
            if (isTeleporterDefault) {
                const summary = document.createElement('div');
                summary.className = 'world-designer-summary';
                summary.textContent = 'Teleporters cycle palettes by default.';
                container.appendChild(summary);
            } else {
                addCheckboxInspector(container, 'Timed palette cycle', !!entity.paletteCycle, (checked) => {
                    runMutation('Updated timed palette cycle.', () => {
                        entity.paletteCycle = checked
                            ? entity.paletteCycle ?? buildDefaultPaletteCycle(entity.palette ?? 0, paletteCount)
                            : undefined;
                    });
                });
            }
            addTextInspector(
                container,
                'Cycle palettes (comma separated)',
                effectivePaletteCycle.palettes.join(', '),
                (value) => {
                    const palettes = parsePaletteCyclePalettes(value, paletteCount);
                    runMutation('Updated palette cycle palettes.', () => {
                        if (palettes.length === 0) {
                            entity.paletteCycle = undefined;
                            return;
                        }
                        entity.paletteCycle = {
                            palettes,
                            intervalMs: entity.paletteCycle?.intervalMs ?? effectivePaletteCycle.intervalMs
                        };
                    });
                }
            );
            addNumberInspector(
                container,
                'Cycle interval (seconds)',
                Number((effectivePaletteCycle.intervalMs / 1000).toFixed(3)),
                (value) => {
                    runMutation('Updated palette cycle interval.', () => {
                        entity.paletteCycle = {
                            palettes: entity.paletteCycle?.palettes ?? effectivePaletteCycle.palettes,
                            intervalMs: Math.max(50, Math.round(Math.max(0.05, value) * 1000))
                        };
                    });
                },
                0.1
            );
        } else {
            addCheckboxInspector(container, 'Timed palette cycle', false, (checked) => {
                if (!checked) return;
                runMutation('Enabled timed palette cycle.', () => {
                    entity.paletteCycle = buildDefaultPaletteCycle(entity.palette ?? 0, paletteCount);
                });
            });
        }
        if ('collision' in entity) {
            addCheckboxInspector(container, 'Collision enabled', entity.collision !== false, (checked) => {
                runMutation('Updated collision flag.', () => {
                    entity.collision = checked;
                    if (category === 'world' && !checked && typeof entity.maskAstronaut !== 'boolean') {
                        entity.maskAstronaut = entity.type === 'black_background' ? false : true;
                    }
                });
            });
        }

        if (category === 'world') {
            addCheckboxInspector(container, 'Mask astronaut', shouldMaskAstronaut(entity), (checked) => {
                runMutation('Updated astronaut masking.', () => {
                    entity.maskAstronaut = checked;
                });
            });

            if (entity.type === 'teleporter' || entity.type === 'teleporter_pad') {
                const linkedTeleporter = findTeleporterForWorldBlock(entity);
                if (!linkedTeleporter) {
                    const summary = document.createElement('div');
                    summary.className = 'world-designer-summary';
                    summary.textContent = 'This teleporter part is not converted yet. Convert to create a linked base+pad mechanism.';
                    container.appendChild(summary);
                    addInspectorAction(container, 'Convert to teleporter', () => {
                        runMutation('Converted world sprites to a teleporter.', () => {
                            convertWorldTeleporterBlock(entity);
                        });
                    });
                } else {
                    addTextInspector(container, 'Teleporter ID', linkedTeleporter.id, (value) => {
                        runMutation('Updated teleporter ID.', () => {
                            renameTeleporterId(linkedTeleporter, value);
                        });
                    });
                    addCheckboxInspector(container, 'Teleporter enabled', linkedTeleporter.enabled !== false, (checked) => {
                        runMutation('Updated teleporter enabled state.', () => {
                            linkedTeleporter.enabled = checked;
                        });
                    });
                    addCheckboxInspector(container, 'Require key hook', linkedTeleporter.requiresKey === true, (checked) => {
                        runMutation('Updated teleporter key requirement.', () => {
                            linkedTeleporter.requiresKey = checked;
                        });
                    });
                    addNumberInspector(container, 'Destination A X', linkedTeleporter.destinationA.x, (value) => {
                        runMutation('Updated teleporter destination A X.', () => {
                            linkedTeleporter.destinationA.x = Math.round(value);
                        });
                    });
                    addNumberInspector(container, 'Destination A Y', linkedTeleporter.destinationA.y, (value) => {
                        runMutation('Updated teleporter destination A Y.', () => {
                            linkedTeleporter.destinationA.y = Math.round(value);
                        });
                    });
                    const hasDestinationB = !!linkedTeleporter.destinationB;
                    addCheckboxInspector(container, 'Enable destination B', hasDestinationB, (checked) => {
                        runMutation('Updated teleporter destination B.', () => {
                            linkedTeleporter.destinationB = checked
                                ? {
                                    x: linkedTeleporter.destinationA.x,
                                    y: linkedTeleporter.destinationA.y
                                }
                                : null;
                            if (!checked && linkedTeleporter.activeDestinationIndex === 1) {
                                linkedTeleporter.activeDestinationIndex = 0;
                            }
                        });
                    });
                    if (linkedTeleporter.destinationB) {
                        addNumberInspector(container, 'Destination B X', linkedTeleporter.destinationB.x, (value) => {
                            runMutation('Updated teleporter destination B X.', () => {
                                if (linkedTeleporter.destinationB) {
                                    linkedTeleporter.destinationB.x = Math.round(value);
                                }
                            });
                        });
                        addNumberInspector(container, 'Destination B Y', linkedTeleporter.destinationB.y, (value) => {
                            runMutation('Updated teleporter destination B Y.', () => {
                                if (linkedTeleporter.destinationB) {
                                    linkedTeleporter.destinationB.y = Math.round(value);
                                }
                            });
                        });
                    }
                    addOptionSelectInspector(
                        container,
                        'Active destination',
                        String(linkedTeleporter.activeDestinationIndex === 1 ? 1 : 0),
                        [
                            { value: '0', label: 'A' },
                            { value: '1', label: 'B' }
                        ],
                        (value) => {
                            runMutation('Updated teleporter active destination.', () => {
                                linkedTeleporter.activeDestinationIndex = value === '1' && linkedTeleporter.destinationB ? 1 : 0;
                            });
                        }
                    );
                    addInspectorAction(container, 'Set destination A to view center', () => {
                        runMutation('Set teleporter destination A to view center.', () => {
                            linkedTeleporter.destinationA = {
                                x: Math.round(state.camera.x + host.canvas.width / 2),
                                y: Math.round(state.camera.y + host.canvas.height / 2)
                            };
                        });
                    });
                    addInspectorAction(container, 'Pick destination A on map', () => {
                        state.teleporterDestinationPick = {
                            teleporterId: linkedTeleporter.id,
                            slot: 'a'
                        };
                        setStatus('Click anywhere in the viewport to set teleporter destination A.', 'neutral');
                    });
                    if (linkedTeleporter.destinationB) {
                        addInspectorAction(container, 'Set destination B to view center', () => {
                            runMutation('Set teleporter destination B to view center.', () => {
                                if (linkedTeleporter.destinationB) {
                                    linkedTeleporter.destinationB = {
                                        x: Math.round(state.camera.x + host.canvas.width / 2),
                                        y: Math.round(state.camera.y + host.canvas.height / 2)
                                    };
                                }
                            });
                        });
                        addInspectorAction(container, 'Pick destination B on map', () => {
                            state.teleporterDestinationPick = {
                                teleporterId: linkedTeleporter.id,
                                slot: 'b'
                            };
                            setStatus('Click anywhere in the viewport to set teleporter destination B.', 'neutral');
                        });
                    }
                    if (state.teleporterDestinationPick?.teleporterId === linkedTeleporter.id) {
                        const pickingSlot = state.teleporterDestinationPick.slot === 'b' ? 'B' : 'A';
                        const pickerSummary = document.createElement('div');
                        pickerSummary.className = 'world-designer-summary';
                        pickerSummary.textContent = `Pick mode is armed for destination ${pickingSlot}.`;
                        container.appendChild(pickerSummary);
                        addInspectorAction(container, 'Cancel destination pick mode', () => {
                            state.teleporterDestinationPick = null;
                            setStatus('Cancelled teleporter destination pick mode.', 'neutral');
                        });
                    }
                }
            }
        }

        if (category === 'world' || category === 'doors') {
            const destructibleCategory = category;
            const resolvedDestructible = typeof entity.destructible === 'boolean'
                ? entity.destructible
                : getDefaultDestructibleEnabled(destructibleCategory, entity.type);
            const resolvedHealth = typeof entity.destructionHealth === 'number'
                ? Math.max(0.1, entity.destructionHealth)
                : getDefaultDestructibleHealth(destructibleCategory, entity.type);
            const resolvedSource = typeof entity.destructionSource === 'string'
                ? entity.destructionSource
                : getDefaultDestructionSource(destructibleCategory, entity.type);

            addCheckboxInspector(container, 'Destructible', resolvedDestructible, (checked) => {
                runMutation('Updated destructible flag.', () => {
                    entity.destructible = checked;
                    if (checked) {
                        entity.destructionHealth = entity.destructionHealth ?? getDefaultDestructibleHealth(destructibleCategory, entity.type);
                        entity.destructionSource = entity.destructionSource ?? getDefaultDestructionSource(destructibleCategory, entity.type);
                    }
                });
            });

            if (resolvedDestructible) {
                addNumberInspector(container, 'Damage required', resolvedHealth, (value) => {
                    runMutation('Updated destruction health.', () => {
                        entity.destructionHealth = Math.max(0.1, value);
                    });
                }, 0.1);
                addOptionSelectInspector(container, 'Damage source', resolvedSource, DESTRUCTION_SOURCE_OPTIONS, (value) => {
                    runMutation('Updated destruction source.', () => {
                        entity.destructionSource = value as DestructionSourceRequirement;
                    });
                });
            }
        }

        if (category === 'buttons') {
            addCheckboxInspector(container, 'Active by default', entity.defaultActive ?? entity.active ?? false, (checked) => {
                runMutation('Updated button default state.', () => {
                    entity.active = checked;
                    entity.defaultActive = checked;
                });
            });
            addTextInspector(container, 'Linked door IDs (comma separated)', (entity.linkedDoors ?? []).join(', '), (value) => {
                runMutation('Updated button linked doors.', () => {
                    entity.linkedDoors = parseDoorIds(value);
                });
            });
            addTextInspector(container, 'Linked teleporter IDs (comma separated)', (entity.linkedTeleporters ?? []).join(', '), (value) => {
                runMutation('Updated button linked teleporters.', () => {
                    entity.linkedTeleporters = parseStringIds(value);
                });
            });
            addOptionSelectInspector(
                container,
                'Teleporter action',
                entity.teleporterMode ?? 'toggle',
                [
                    { value: 'toggle', label: 'Toggle A/B' },
                    { value: 'destination_a', label: 'Set destination A' },
                    { value: 'destination_b', label: 'Set destination B' },
                    { value: 'toggle_enabled', label: 'Toggle enabled' },
                    { value: 'enable', label: 'Enable teleporter' },
                    { value: 'disable', label: 'Disable teleporter' }
                ],
                (value) => {
                    runMutation('Updated button teleporter action.', () => {
                        entity.teleporterMode = isTeleporterMode(value) ? value : 'toggle';
                    });
                }
            );
            addTextInspector(container, 'Box sprite', entity.boxType ?? 'button_box', (value) => {
                runMutation('Updated button box sprite.', () => {
                    entity.boxType = value;
                });
            });
            addOptionSelectInspector(container, 'Box palette', String(entity.boxPalette ?? 0), paletteOptions, (value) => {
                runMutation('Updated button box palette.', () => {
                    entity.boxPalette = clamp(Math.round(Number(value)), 0, paletteCount - 1);
                });
            });
            const closedCapOffset = getButtonCapOffsetsRelativeToBox(entity, false);
            const openCapOffset = getButtonCapOffsetsRelativeToBox(entity, true);
            const buttonDesignerSummary = document.createElement('div');
            buttonDesignerSummary.className = 'world-designer-summary';
            buttonDesignerSummary.textContent = 'Button cap offsets are authored in button-local space relative to the box, then rotated/flipped with the button.';
            container.appendChild(buttonDesignerSummary);
            addNumberInspector(container, 'Closed cap offset X (from box)', closedCapOffset.x, (value) => {
                runMutation('Updated closed button cap X.', () => {
                    entity.capClosedOffsetX = (entity.boxOffsetX ?? BUTTON_DEFAULT_BOX_OFFSET_X) + Math.round(value);
                    entity.pressOffset = (entity.capOpenOffsetX ?? (entity.pressOffset ?? BUTTON_DEFAULT_PRESS_OFFSET))
                        - (entity.capClosedOffsetX ?? 0);
                });
            });
            addNumberInspector(container, 'Closed cap offset Y (from box)', closedCapOffset.y, (value) => {
                runMutation('Updated closed button cap Y.', () => {
                    entity.capClosedOffsetY = (entity.boxOffsetY ?? BUTTON_DEFAULT_BOX_OFFSET_Y) + Math.round(value);
                });
            });
            addNumberInspector(container, 'Open cap offset X (from box)', openCapOffset.x, (value) => {
                runMutation('Updated open button cap X.', () => {
                    entity.capOpenOffsetX = (entity.boxOffsetX ?? BUTTON_DEFAULT_BOX_OFFSET_X) + Math.round(value);
                    entity.pressOffset = (entity.capOpenOffsetX ?? (entity.pressOffset ?? BUTTON_DEFAULT_PRESS_OFFSET))
                        - (entity.capClosedOffsetX ?? 0);
                });
            });
            addNumberInspector(container, 'Open cap offset Y (from box)', openCapOffset.y, (value) => {
                runMutation('Updated open button cap Y.', () => {
                    entity.capOpenOffsetY = (entity.boxOffsetY ?? BUTTON_DEFAULT_BOX_OFFSET_Y) + Math.round(value);
                });
            });
            renderButtonDefaultsInspector(container, entity);
        }

        if (category === 'doors') {
            const paletteOptions = [
                { value: '', label: 'Base palette' },
                ...Array.from({ length: paletteCount }, (_, index) => ({
                    value: String(index),
                    label: `Palette ${index}`
                }))
            ];
            addTextInspector(container, 'Name', entity.name ?? '', (value) => {
                runMutation('Updated door name.', () => {
                    entity.name = value;
                });
            });
            addNumberInspector(container, 'Door ID', entity.doorID ?? 0, (value) => {
                runMutation('Updated door ID.', () => {
                    entity.doorID = Math.round(value);
                });
            });
            addCheckboxInspector(container, 'Locked by default', entity.defaultLocked ?? entity.locked ?? false, (checked) => {
                runMutation('Updated door default state.', () => {
                    entity.locked = checked;
                    entity.defaultLocked = checked;
                });
            });
            addCheckboxInspector(container, 'Open by default', entity.defaultOpen ?? entity.open ?? false, (checked) => {
                runMutation('Updated door open state.', () => {
                    entity.open = checked;
                    entity.defaultOpen = checked;
                });
            });
            addOptionSelectInspector(
                container,
                'Locked palette',
                typeof entity.palette_locked === 'number' ? String(entity.palette_locked) : '',
                paletteOptions,
                (value) => {
                    runMutation('Updated locked palette.', () => {
                        entity.palette_locked = value === ''
                            ? null
                            : clamp(Math.round(Number(value)), 0, paletteCount - 1);
                        if (state.selection?.category === 'doors' && state.selection.entity === entity) {
                            state.palette = entity.palette;
                        }
                    });
                }
            );
            addOptionSelectInspector(
                container,
                'Unlocked palette',
                typeof entity.palette_unlocked === 'number' ? String(entity.palette_unlocked) : '',
                paletteOptions,
                (value) => {
                    runMutation('Updated unlocked palette.', () => {
                        entity.palette_unlocked = value === ''
                            ? null
                            : clamp(Math.round(Number(value)), 0, paletteCount - 1);
                        if (state.selection?.category === 'doors' && state.selection.entity === entity) {
                            state.palette = entity.palette;
                        }
                    });
                }
            );
        }

        if (category === 'creatures') {
            const archetypeOptions = [
                { value: 'custom', label: 'Custom' },
                { value: 'monkey', label: 'Monkey' },
                { value: 'bird', label: 'Bird' },
                { value: 'bee', label: 'Bee / wasp' },
                { value: 'turret', label: 'Turret' }
            ];
            const movementModeOptions = [
                { value: 'ground', label: 'Ground' },
                { value: 'fly', label: 'Fly' },
                { value: 'hover', label: 'Hover' },
                { value: 'turret', label: 'Turret' }
            ];
            const fireModeOptions = [
                { value: 'none', label: 'None' },
                { value: 'bullets', label: 'Bullets' },
                { value: 'grenades', label: 'Grenades' },
                { value: 'plasma_grenades', label: 'Plasma grenades' },
                { value: 'energy_pods', label: 'Energy pods' }
            ];
            const soundOptions = [
                { value: '', label: 'No sound' },
                ...CREATURE_SOUND_MANIFEST.map((entry) => ({
                    value: entry.key,
                    label: entry.label
                }))
            ];
            addOptionSelectInspector(container, 'Archetype', entity.archetype ?? 'custom', archetypeOptions, (value) => {
                runMutation('Updated creature archetype.', () => {
                    entity.archetype = value as Creature['archetype'];
                });
            });
            addCheckboxInspector(container, 'Collision enabled', entity.collision ?? false, (checked) => {
                runMutation('Updated creature collision.', () => {
                    entity.collision = checked;
                });
            });
            addCheckboxInspector(container, 'Hostile', entity.hostile ?? false, (checked) => {
                runMutation('Updated hostile flag.', () => {
                    entity.hostile = checked;
                });
            });
            addNumberInspector(container, 'Damage on contact', entity.damageOnContact ?? 0, (value) => {
                runMutation('Updated contact damage.', () => {
                    entity.damageOnContact = Math.max(0, value);
                });
            }, 0.1);
            addCheckboxInspector(container, 'Follows astronaut', entity.followsAstronaut ?? false, (checked) => {
                runMutation('Updated follow flag.', () => {
                    entity.followsAstronaut = checked;
                });
            });
            addNumberInspector(container, 'Follow range', entity.followRange ?? 160, (value) => {
                runMutation('Updated follow range.', () => {
                    entity.followRange = Math.max(0, value);
                });
            });
            addOptionSelectInspector(container, 'Movement mode', entity.movementMode ?? 'ground', movementModeOptions, (value) => {
                runMutation('Updated movement mode.', () => {
                    entity.movementMode = value as Creature['movementMode'];
                    if (value === 'turret') {
                        entity.fixed = true;
                        entity.speed = 0;
                    }
                });
            });
            addCheckboxInspector(container, 'Fixed in place', entity.fixed ?? false, (checked) => {
                runMutation('Updated fixed flag.', () => {
                    entity.fixed = checked;
                    if (checked) {
                        entity.movementMode = 'turret';
                        entity.speed = 0;
                    } else if (entity.movementMode === 'turret') {
                        entity.movementMode = 'ground';
                    }
                });
            });
            addNumberInspector(container, 'Speed', entity.speed ?? 1.5, (value) => {
                runMutation('Updated creature speed.', () => {
                    entity.speed = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Home X', entity.homeX ?? entity.x, (value) => {
                runMutation('Updated home X.', () => {
                    entity.homeX = value;
                });
            });
            addNumberInspector(container, 'Home Y', entity.homeY ?? entity.y, (value) => {
                runMutation('Updated home Y.', () => {
                    entity.homeY = value;
                });
            });
            addNumberInspector(container, 'Patrol min X', entity.patrolMinX ?? entity.x - 96, (value) => {
                runMutation('Updated patrol min X.', () => {
                    entity.patrolMinX = value;
                });
            });
            addNumberInspector(container, 'Patrol max X', entity.patrolMaxX ?? entity.x + 96, (value) => {
                runMutation('Updated patrol max X.', () => {
                    entity.patrolMaxX = value;
                });
            });
            addNumberInspector(container, 'Patrol min Y', entity.patrolMinY ?? entity.y - 32, (value) => {
                runMutation('Updated patrol min Y.', () => {
                    entity.patrolMinY = value;
                });
            });
            addNumberInspector(container, 'Patrol max Y', entity.patrolMaxY ?? entity.y + 32, (value) => {
                runMutation('Updated patrol max Y.', () => {
                    entity.patrolMaxY = value;
                });
            });
            addNumberInspector(container, 'Hover amplitude', entity.hoverAmplitude ?? 0, (value) => {
                runMutation('Updated hover amplitude.', () => {
                    entity.hoverAmplitude = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Track range', entity.trackRange ?? entity.followRange ?? 160, (value) => {
                runMutation('Updated track range.', () => {
                    entity.trackRange = Math.max(0, value);
                });
            });
            addOptionSelectInspector(container, 'Fire mode', entity.fireMode ?? 'none', fireModeOptions, (value) => {
                runMutation('Updated fire mode.', () => {
                    entity.fireMode = value as Creature['fireMode'];
                });
            });
            addCheckboxInspector(container, 'Homing bullets', entity.homingBullets ?? false, (checked) => {
                runMutation('Updated homing setting.', () => {
                    entity.homingBullets = checked;
                });
            });
            addNumberInspector(container, 'Fire cooldown (ms)', entity.fireCooldownMs ?? 1200, (value) => {
                runMutation('Updated fire cooldown.', () => {
                    entity.fireCooldownMs = Math.max(0, value);
                });
            });
            addNumberInspector(container, 'Fire cooldown variance (ms)', entity.fireCooldownVarianceMs ?? 0, (value) => {
                runMutation('Updated cooldown variance.', () => {
                    entity.fireCooldownVarianceMs = Math.max(0, value);
                });
            });
            addNumberInspector(container, 'Target refresh (ms)', entity.targetRefreshMs ?? 0, (value) => {
                runMutation('Updated target refresh.', () => {
                    entity.targetRefreshMs = Math.max(0, value);
                });
            });
            addNumberInspector(container, 'Aim lead factor', entity.aimLeadFactor ?? 0, (value) => {
                runMutation('Updated aim lead factor.', () => {
                    entity.aimLeadFactor = Math.max(0, value);
                });
            }, 0.05);
            addNumberInspector(container, 'Aim jitter (px)', entity.aimJitterPx ?? 0, (value) => {
                runMutation('Updated aim jitter.', () => {
                    entity.aimJitterPx = Math.max(0, value);
                });
            }, 0.5);
            addCheckboxInspector(container, 'Requires line of sight', entity.requiresLineOfSight ?? false, (checked) => {
                runMutation('Updated line-of-sight gating.', () => {
                    entity.requiresLineOfSight = checked;
                });
            });
            addNumberInspector(container, 'Projectile speed', entity.projectileSpeed ?? 3, (value) => {
                runMutation('Updated projectile speed.', () => {
                    entity.projectileSpeed = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Projectile weight', entity.projectileWeight ?? 0.1, (value) => {
                runMutation('Updated projectile weight.', () => {
                    entity.projectileWeight = Math.max(0, value);
                });
            }, 0.05);
            addNumberInspector(container, 'Projectile bounciness', entity.projectileBounciness ?? 0, (value) => {
                runMutation('Updated projectile bounciness.', () => {
                    entity.projectileBounciness = Math.max(0, value);
                });
            }, 0.05);
            addCheckboxInspector(container, 'Can eat wasps', entity.canEatWasps ?? false, (checked) => {
                runMutation('Updated predator flag.', () => {
                    entity.canEatWasps = checked;
                });
            });
            addCheckboxInspector(container, 'Can jump', entity.canJump ?? false, (checked) => {
                runMutation('Updated jump flag.', () => {
                    entity.canJump = checked;
                });
            });
            addNumberInspector(container, 'Jump strength', entity.jumpStrength ?? 6, (value) => {
                runMutation('Updated jump strength.', () => {
                    entity.jumpStrength = Math.max(0, value);
                });
            }, 0.1);
            addCheckboxInspector(container, 'Teleport home', entity.teleportHome ?? false, (checked) => {
                runMutation('Updated teleport-home flag.', () => {
                    entity.teleportHome = checked;
                });
            });
            addNumberInspector(container, 'Teleport distance', entity.teleportHomeDistance ?? 512, (value) => {
                runMutation('Updated teleport-home distance.', () => {
                    entity.teleportHomeDistance = Math.max(0, value);
                });
            });
            addCheckboxInspector(container, 'Push astronaut', entity.pushAstronaut ?? true, (checked) => {
                runMutation('Updated push flag.', () => {
                    entity.pushAstronaut = checked;
                });
            });
            addCheckboxInspector(container, 'Can be picked up', entity.pickupEnabled ?? false, (checked) => {
                runMutation('Updated pickup flag.', () => {
                    entity.pickupEnabled = checked;
                    if (!checked) {
                        entity.storable = false;
                    }
                });
            });
            addCheckboxInspector(container, 'Storable', entity.storable ?? false, (checked) => {
                runMutation('Updated storable flag.', () => {
                    entity.storable = checked;
                    if (checked) {
                        entity.pickupEnabled = true;
                    }
                });
            });
            addNumberInspector(container, 'Current damage', entity.currentDamage ?? 0, (value) => {
                runMutation('Updated damage state.', () => {
                    entity.currentDamage = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Force required to kill', entity.killForce ?? 3, (value) => {
                runMutation('Updated kill-force threshold.', () => {
                    entity.killForce = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Visible energy', entity.visibleEnergy ?? 1, (value) => {
                runMutation('Updated visible energy.', () => {
                    entity.visibleEnergy = Math.max(0, value);
                });
            }, 0.1);
            addCheckboxInspector(container, 'Damage flash visible', entity.damageFlash ?? true, (checked) => {
                runMutation('Updated damage flash flag.', () => {
                    entity.damageFlash = checked;
                });
            });
            addCheckboxInspector(container, 'Makes sound', entity.sound?.enabled ?? false, (checked) => {
                runMutation('Updated sound-enabled flag.', () => {
                    entity.sound = {
                        enabled: checked,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: entity.sound?.range ?? 320,
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addOptionSelectInspector(container, 'Sound', entity.sound?.sound ?? '', soundOptions, (value) => {
                runMutation('Updated creature sound.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? value !== '',
                        sound: value,
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: entity.sound?.range ?? 320,
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addNumberInspector(container, 'Sound interval (ms)', entity.sound?.intervalMs ?? 3000, (value) => {
                runMutation('Updated sound interval.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? false,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: Math.max(0, value),
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: entity.sound?.range ?? 320,
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addNumberInspector(container, 'Sound randomness (ms)', entity.sound?.randomVarianceMs ?? 0, (value) => {
                runMutation('Updated sound randomness.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? false,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: Math.max(0, value),
                        range: entity.sound?.range ?? 320,
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addNumberInspector(container, 'Sound range', entity.sound?.range ?? 320, (value) => {
                runMutation('Updated sound range.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? false,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: Math.max(0, value),
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addNumberInspector(container, 'Sound volume', entity.sound?.volume ?? 1, (value) => {
                runMutation('Updated sound volume.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? false,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: entity.sound?.range ?? 320,
                        volume: Math.max(0, value)
                    };
                });
            }, 0.1);
            const accordion = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = 'Advanced state JSON';
            accordion.appendChild(summary);
            const advancedBody = document.createElement('div');
            addTextInspector(advancedBody, 'State JSON', stableStringify(entity.state ?? {}), (value) => {
                try {
                    const parsed = value.trim().length === 0 ? {} : JSON.parse(value);
                    runMutation('Updated creature state.', () => {
                        entity.state = parsed;
                    });
                } catch {
                    setStatus('Creature state must be valid JSON.', 'error');
                }
            }, true);
            accordion.appendChild(advancedBody);
            container.appendChild(accordion);
        }

        if (category === 'collectables') {
            addTextInspector(container, 'Name', entity.name ?? '', (value) => {
                runMutation('Updated collectable name.', () => {
                    entity.name = value;
                });
            });
            if (entity.type === 'boulder') {
                addCheckboxInspector(container, 'Radioactive', entity.radioactive === true, (checked) => {
                    runMutation('Updated boulder radioactivity.', () => {
                        const regularWeight = getDefaultCollectableWeight(entity.type, false);
                        const radioactiveWeight = getDefaultCollectableWeight(entity.type, true);
                        const radioactivePaletteCycle = getDefaultCollectablePaletteCycle(
                            entity.type,
                            entity.palette ?? 0,
                            paletteCount,
                            true
                        );
                        entity.radioactive = checked;
                        if (checked) {
                            if (Math.abs((entity.weight ?? regularWeight) - regularWeight) < 0.0001) {
                                entity.weight = radioactiveWeight;
                            }
                            if (!entity.paletteCycle && radioactivePaletteCycle) {
                                entity.paletteCycle = radioactivePaletteCycle;
                            }
                            return;
                        }

                        if (Math.abs((entity.weight ?? radioactiveWeight) - radioactiveWeight) < 0.0001) {
                            entity.weight = regularWeight;
                        }
                        if (
                            radioactivePaletteCycle &&
                            entity.paletteCycle &&
                            stableStringify(entity.paletteCycle) === stableStringify(radioactivePaletteCycle)
                        ) {
                            entity.paletteCycle = undefined;
                        }
                    });
                });
            }
            addNumberInspector(container, 'Weight', entity.weight ?? 0, (value) => {
                runMutation('Updated item weight.', () => {
                    entity.weight = Number.isFinite(value) ? value : 0;
                });
            }, 0.1);
            addCheckboxInspector(container, 'Can be picked up', entity.pickupEnabled ?? true, (checked) => {
                runMutation('Updated pickup-enabled flag.', () => {
                    entity.pickupEnabled = checked;
                    if (!checked) {
                        entity.storable = false;
                        entity.held = false;
                        entity.stored = false;
                    }
                });
            });
            addCheckboxInspector(container, 'Collected by default', entity.collected ?? false, (checked) => {
                runMutation('Updated collectable state.', () => {
                    entity.collected = checked;
                });
            });
            addCheckboxInspector(container, 'Storable', entity.storable ?? false, (checked) => {
                runMutation('Updated storable flag.', () => {
                    entity.storable = checked;
                    if (checked) {
                        entity.pickupEnabled = true;
                    }
                });
            });
            addCheckboxInspector(container, 'Affects astronaut', entity.affectsAstronaut ?? true, (checked) => {
                runMutation('Updated affects-astronaut flag.', () => {
                    entity.affectsAstronaut = checked;
                });
            });
            if (isGrenadeCollectableType(entity.type)) {
                addCheckboxInspector(container, 'Armed', entity.armed ?? false, (checked) => {
                    runMutation('Updated grenade armed state.', () => {
                        if (checked) {
                            entity.arm();
                        } else {
                            entity.disarm();
                        }
                    });
                });
                addNumberInspector(
                    container,
                    'Explosion power',
                    entity.explosionPower ?? getDefaultGrenadeExplosionPower(entity.type) ?? 0,
                    (value) => {
                        runMutation('Updated grenade explosion power.', () => {
                            entity.explosionPower = Math.max(0.5, value);
                        });
                    },
                    0.1
                );
                addNumberInspector(
                    container,
                    'Explosion radius',
                    entity.explosionRadius ?? (entity.type === 'plasma_grenade'
                        ? MOVEMENT_SETTINGS.plasmaGrenadeExplosionRadius
                        : MOVEMENT_SETTINGS.grenadeExplosionRadius),
                    (value) => {
                        runMutation('Updated grenade explosion radius.', () => {
                            entity.explosionRadius = Math.max(1, value);
                        });
                    },
                    1
                );
            }
        }
    }

    function refreshPanel() {
        refreshSelectOptions();
        refs.root.classList.toggle('world-designer-hidden', !state.active);
        refs.activeToggle.textContent = state.active ? 'Hide panel' : 'Show panel';
        refs.expandViewportCheckbox.checked = state.viewportExpanded;
        refs.soundEnabledCheckbox.checked = host.getSoundEnabled();
        const bulletImpactAudioSettings = host.getBulletImpactAudioSettings();
        refs.bulletImpactPrimarySelect.value = bulletImpactAudioSettings.primary;
        refs.bulletImpactAlternateSelect.value = bulletImpactAudioSettings.alternate;
        refs.bulletImpactAlternateChanceInput.value = bulletImpactAudioSettings.alternateChance.toFixed(2);
        refs.bulletImpactVolumeInput.value = bulletImpactAudioSettings.volume.toFixed(2);
        refs.modeSelect.value = state.mode;
        refs.toolSelect.value = state.tool;
        refs.categorySelect.value = state.category;
        refs.rotationSelect.value = String(state.rotation);
        refs.translationSelect.value = state.translation;
        refs.paletteSelect.value = String(state.palette);
        refs.translationSelect.disabled = !categorySupportsTranslation(state.category) && !categorySupportsTranslation(state.selection?.category ?? 'custom');
        refs.rotationSelect.disabled = state.category === 'custom';
        refs.paletteSelect.disabled = state.category === 'custom';
        refs.snapCheckbox.checked = state.snapToGrid;
        refs.objectSnapCheckbox.checked = state.objectSnapEnabled;
        refs.snapOffsetXInput.value = String(state.snapOffsetX);
        refs.snapOffsetYInput.value = String(state.snapOffsetY);
        refs.nudgeInput.value = String(state.nudgeAmount);
        refs.showCollisionCheckbox.checked = state.showCollisionOverlay;
        refs.showCreatureOverlaysCheckbox.checked = host.getShowCreatureOverlays();
        refs.showSpriteOutlineCheckbox.checked = host.getShowSpriteOutlines();
        refs.magnifierCheckbox.checked = state.magnifierEnabled;
        refs.disablePreviewCollisionCheckbox.checked = state.disableCollisionInPreview;
        refs.disablePreviewCollisionCheckbox.disabled = state.mode !== 'preview';
        refs.spritePicker.open = state.spritePickerOpen;
        refs.spritePickerFilter.value = state.spritePickerFilter;
        refs.spritePickerCategoryFilter.value = state.spritePickerCategoryFilter;
        refs.spritePickerCategoryFilter.disabled = state.spritePickerFilter.trim().length > 0;

        for (const [category, checkbox] of Object.entries(refs.layerCheckboxes) as Array<[DesignerCategory, HTMLInputElement]>) {
            checkbox.checked = state.layerVisibility[category];
        }

        setCurrentType(getCurrentType());
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
        updateSelectionSummary();
        refreshInspector();
        restorePendingInspectorFocus();
        refreshPaletteDesigner();
        refreshStatus();
        persistDesignerUiState();
    }

    function applyViewportSize(width: number, height: number) {
        const currentCenter = {
            x: state.camera.x + host.canvas.width / 2,
            y: state.camera.y + host.canvas.height / 2
        };
        host.canvas.width = Math.max(1, Math.round(width));
        host.canvas.height = Math.max(1, Math.round(height));
        state.camera = host.clampCamera({
            x: currentCenter.x - host.canvas.width / 2,
            y: currentCenter.y - host.canvas.height / 2
        });
    }

    function resizeExpandedViewport() {
        if (!state.viewportExpanded) return;
        applyViewportSize(window.innerWidth, window.innerHeight);
        host.canvas.style.width = `${window.innerWidth}px`;
        host.canvas.style.height = `${window.innerHeight}px`;
    }

    function setViewportExpanded(expanded: boolean) {
        if (state.viewportExpanded === expanded) {
            return;
        }

        state.viewportExpanded = expanded;
        if (expanded) {
            host.canvas.style.position = 'fixed';
            host.canvas.style.inset = '0';
            host.canvas.style.margin = '0';
            host.canvas.style.zIndex = '9000';
            document.body.style.overflow = 'hidden';
            resizeExpandedViewport();
            setStatus('Expanded the game viewport to fill the window for designer work.', 'neutral');
        } else {
            host.canvas.style.position = initialCanvasStyle.position;
            host.canvas.style.inset = initialCanvasStyle.inset;
            host.canvas.style.width = initialCanvasStyle.width;
            host.canvas.style.height = initialCanvasStyle.height;
            host.canvas.style.margin = initialCanvasStyle.margin;
            host.canvas.style.zIndex = initialCanvasStyle.zIndex;
            document.body.style.overflow = initialBodyOverflow;
            applyViewportSize(initialCanvasSize.width, initialCanvasSize.height);
            setStatus('Restored the game viewport to its normal size.', 'neutral');
        }

        refreshPanel();
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

    function isEventOverCanvas(event: MouseEvent) {
        const rect = host.canvas.getBoundingClientRect();
        return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
        );
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

    function moveCameraToWorldCenter(worldX: number, worldY: number) {
        state.camera = host.clampCamera({
            x: worldX - host.canvas.width / 2,
            y: worldY - host.canvas.height / 2
        });
    }

    function focusOnCurrentWorldPosition() {
        const focus = host.getFocusWorldPosition();
        state.overviewHoverWorld = {
            x: clamp(focus.x, 0, MAP_WIDTH),
            y: clamp(focus.y, 0, MAP_HEIGHT)
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

    function handleCanvasMouseDown(event: MouseEvent) {
        if (!state.active || state.mode !== 'edit') return;
        if (state.pickerDrag) return;
        const point = getCanvasPoint(event);
        state.lastPointerCanvas = point;
        closeContextMenu();

        const world = screenToWorld(point.x, point.y);

        if (state.teleporterDestinationPick) {
            if (event.button === 2) {
                state.teleporterDestinationPick = null;
                setStatus('Cancelled teleporter destination pick mode.', 'neutral');
                event.preventDefault();
                return;
            }
            if (event.button !== 0) {
                return;
            }
            const pickState = state.teleporterDestinationPick;
            const slotLabel = pickState.slot === 'b' ? 'B' : 'A';
            runMutation(`Set teleporter destination ${slotLabel} from map pick.`, () => {
                const teleporter = getTeleporterById(pickState.teleporterId);
                if (!teleporter) {
                    throw new Error(`Teleporter "${pickState.teleporterId}" no longer exists.`);
                }
                const destination = {
                    x: Math.round(world.x),
                    y: Math.round(world.y)
                };
                if (pickState.slot === 'b') {
                    teleporter.destinationB = destination;
                } else {
                    teleporter.destinationA = destination;
                }
            });
            state.teleporterDestinationPick = null;
            setStatus(`Set teleporter destination ${slotLabel} to (${Math.round(world.x)}, ${Math.round(world.y)}).`, 'success');
            return;
        }

        if (event.button === 2) {
            const hit = getEntityAt(world.x, world.y);
            if (hit) {
                state.suppressContextMenuOnce = false;
                const menuSelections = isSelected(hit) ? getSelectedItems() : [hit];
                setSelections(menuSelections, hit);
                event.preventDefault();
                return;
            }
            state.pendingRightPan = true;
            state.panningView = false;
            state.panStartCanvas = point;
            state.panStartCamera = { ...state.camera };
            return;
        }

        if (event.button !== 0) return;
        if (state.tool === 'place') {
            updateModifierSnapMode(event.ctrlKey, event.altKey);
            runMutation(`Placed new ${CATEGORY_LABELS[state.category].toLowerCase()}.`, () => {
                placeAtWorld(world.x, world.y, state.activeObjectSnapMode);
            });
            updateSelectionFromInspectorState();
            return;
        }

        const hit = getEntityAt(world.x, world.y);
        if (!hit) {
            state.marqueeSelecting = true;
            state.marqueeStartWorld = world;
            state.marqueeCurrentWorld = world;
            state.marqueeAdditive = event.shiftKey;
            return;
        }

        if (event.shiftKey) {
            const currentSelections = getSelectedItems();
            if (isSelected(hit)) {
                const remainingSelections = removeSelection(currentSelections, hit);
                const nextPrimary = state.selection && areSameSelection(state.selection, hit)
                    ? (remainingSelections[remainingSelections.length - 1] ?? null)
                    : state.selection;
                setSelections(remainingSelections, nextPrimary);
                setStatus(
                    remainingSelections.length > 0
                        ? `Removed object from selection. ${remainingSelections.length} selected.`
                        : 'Selection cleared.',
                    'neutral'
                );
            } else {
                const mergedSelections = mergeSelections(currentSelections, [hit]);
                setSelections(mergedSelections, hit);
                setStatus(`Added object to selection. ${mergedSelections.length} selected.`, 'neutral');
            }
            return;
        }

        const dragSelections = isSelected(hit) ? getSelectedItems() : [hit];
        setSelections(dragSelections, hit);
        updateModifierSnapMode(event.ctrlKey, event.altKey);
        beginDrag(world, dragSelections);
    }

    function handleCanvasMouseMove(event: MouseEvent) {
        if (!state.active) return;
        const isOverCanvas = isEventOverCanvas(event);
        if (state.pickerDrag) {
            state.pickerDragCanvas = isOverCanvas ? getCanvasPoint(event) : null;
            return;
        }
        if (!isOverCanvas && !state.dragging && !state.panningView && !state.pendingRightPan) {
            state.lastPointerCanvas = null;
            return;
        }
        const point = getCanvasPoint(event);
        state.lastPointerCanvas = point;
        updateModifierSnapMode(event.ctrlKey, event.altKey);
        if (state.mode !== 'edit') return;

        if (state.panningView && state.panStartCanvas && state.panStartCamera) {
            state.camera = host.clampCamera({
                x: state.panStartCamera.x - (point.x - state.panStartCanvas.x),
                y: state.panStartCamera.y - (point.y - state.panStartCanvas.y)
            });
            return;
        }

        if (state.pendingRightPan && state.panStartCanvas) {
            const deltaX = point.x - state.panStartCanvas.x;
            const deltaY = point.y - state.panStartCanvas.y;
            if (Math.hypot(deltaX, deltaY) >= 6) {
                state.pendingRightPan = false;
                state.suppressContextMenuOnce = true;
                state.panningView = true;
                setStatus('Panning editor view.', 'neutral');
            }
            return;
        }

        const world = screenToWorld(point.x, point.y);

        if (state.marqueeSelecting) {
            state.marqueeCurrentWorld = world;
            return;
        }

        if (state.dragging) {
            updateDraggedItems(point);
        }
    }

    function handleCanvasMouseLeave() {
        if (state.dragging || state.panningView || state.pendingRightPan || state.pickerDrag) {
            return;
        }
        state.lastPointerCanvas = null;
        state.objectSnapGuides = [];
    }

    function handleCanvasMouseUp(event?: MouseEvent) {
        if (state.pickerDrag) {
            updateModifierSnapMode(event?.ctrlKey ?? false, event?.altKey ?? false);
            if (event && isEventOverCanvas(event)) {
                placeDraggedPickerSprite(getCanvasPoint(event));
            }
            clearPickerDrag();
            return;
        }

        if (state.panningView) {
            state.panningView = false;
            state.pendingRightPan = false;
            state.panStartCanvas = null;
            state.panStartCamera = null;
            state.lastPointerCanvas = null;
            persistDesignerUiState();
            setStatus('Moved camera by right-dragging.', 'neutral');
            return;
        }

        if (state.pendingRightPan) {
            state.pendingRightPan = false;
            state.panStartCanvas = null;
            state.panStartCamera = null;
        }

        if (state.marqueeSelecting && state.marqueeStartWorld && state.marqueeCurrentWorld) {
            const selections = getSelectionsInRect(state.marqueeStartWorld, state.marqueeCurrentWorld);
            const nextSelections = state.marqueeAdditive
                ? mergeSelections(getSelectedItems(), selections)
                : selections;
            state.marqueeSelecting = false;
            state.marqueeStartWorld = null;
            state.marqueeCurrentWorld = null;
            state.marqueeAdditive = false;
            setSelections(nextSelections, selections[0] ?? nextSelections[0] ?? null);
            setStatus(
                nextSelections.length > 0
                    ? `Selected ${nextSelections.length} object${nextSelections.length === 1 ? '' : 's'}.`
                    : 'Nothing selected.',
                'neutral'
            );
            return;
        }

        if (!state.dragging) return;
        state.dragging = false;
        state.dragItems = [];
        state.dragAnchorWorld = null;
        state.objectSnapGuides = [];
        state.activeObjectSnapMode = state.objectSnapEnabled ? 'dock' : 'none';
        state.lastPointerCanvas = null;
        if (state.dragStartSnapshot) {
            const before = state.dragStartSnapshot;
            state.dragStartSnapshot = null;
            const after = getSnapshot();
            if (designerSnapshotsEqual(before, after)) {
                host.afterWorldDataMutated();
                updateDirtyState();
                refreshPanel();
                return;
            }
            state.undoStack.push(before);
            if (state.undoStack.length > HISTORY_LIMIT) {
                state.undoStack.shift();
            }
            state.redoStack = [];
            host.afterWorldDataMutated();
            updateDirtyState();
            refreshPanel();
            setStatus('Moved selected objects with the mouse. Use arrow keys for precise nudging.', 'neutral');
        }
    }

    function updateOverviewHover(event: MouseEvent) {
        const rect = refs.overviewCanvas.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;
        const worldX = clamp(x / refs.overviewCanvas.width * MAP_WIDTH, 0, MAP_WIDTH);
        const worldY = clamp(y / refs.overviewCanvas.height * MAP_HEIGHT, 0, MAP_HEIGHT);
        state.overviewHoverWorld = { x: worldX, y: worldY };
    }

    function handleOverviewMouseMove(event: MouseEvent) {
        updateOverviewHover(event);
        if (state.overviewDragging) {
            moveCameraToWorldCenter(state.overviewHoverWorld!.x, state.overviewHoverWorld!.y);
        }
    }

    function handleOverviewMouseDown(event: MouseEvent) {
        if (event.button !== 0) return;
        closeContextMenu();
        updateOverviewHover(event);
        state.overviewDragging = true;
        moveCameraToWorldCenter(state.overviewHoverWorld!.x, state.overviewHoverWorld!.y);
        setStatus('Dragging overview navigator.', 'neutral');
    }

    function handleOverviewMouseUp() {
        if (!state.overviewDragging) return;
        state.overviewDragging = false;
        if (!state.overviewHoverWorld) return;
        persistDesignerUiState();
        setStatus('Moved camera from the overview navigator.', 'neutral');
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === '`') {
            setDesignerActive(!state.active);
            setStatus(state.active ? 'Designer panel restored.' : 'Designer panel hidden. Press ` to restore.', 'neutral');
            return;
        }

        if (!state.active) return;
        if (isFormTarget(event.target)) return;

        if (event.key === 'Control' || event.key === 'Alt') {
            updateModifierSnapMode(event.ctrlKey, event.altKey);
            refreshModifierSnapInteraction();
        }

        if (event.key === 'Escape') {
            if (refs.modal.classList.contains('open')) {
                closeModal();
                event.preventDefault();
                return;
            }
            closeContextMenu();
        }

        if (event.ctrlKey && event.key.toLowerCase() === 's') {
            event.preventDefault();
            openSavePreview();
            return;
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'z' && !event.shiftKey) {
            event.preventDefault();
            undo();
            return;
        }
        if (
            (event.ctrlKey && event.key.toLowerCase() === 'y') ||
            (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z')
        ) {
            event.preventDefault();
            redo();
            return;
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'd') {
            event.preventDefault();
            duplicateSelection();
            return;
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            copySelection();
            return;
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'v') {
            event.preventDefault();
            pasteSelection();
            return;
        }

        switch (event.key) {
            case '1':
                state.tool = 'select';
                refreshPanel();
                event.preventDefault();
                return;
            case '2':
                state.tool = 'place';
                refreshPanel();
                event.preventDefault();
                return;
            case 'm':
            case 'M':
                state.mode = state.mode === 'edit' ? 'preview' : 'edit';
                if (state.mode === 'edit' && restoreEditModeSnapshot()) {
                    setStatus('Restored the authored world state for editing.', 'neutral');
                }
                state.liveResumeSnapshot = null;
                refreshPanel();
                event.preventDefault();
                return;
            case 'g':
            case 'G':
                state.snapToGrid = !state.snapToGrid;
                refreshPanel();
                event.preventDefault();
                return;
            case 'x':
            case 'X':
                state.magnifierEnabled = !state.magnifierEnabled;
                if (!state.magnifierEnabled) {
                    state.lastPointerCanvas = null;
                }
                refreshPanel();
                event.preventDefault();
                return;
            case 'Delete':
            case 'Backspace':
                deleteSelection();
                event.preventDefault();
                return;
            case 'r':
            case 'R':
                rotateSelection();
                event.preventDefault();
                return;
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'ArrowUp':
            case 'ArrowDown': {
                const step = event.shiftKey ? state.nudgeAmount * 10 : state.nudgeAmount;
                const delta = {
                    ArrowLeft: { x: -step, y: 0 },
                    ArrowRight: { x: step, y: 0 },
                    ArrowUp: { x: 0, y: -step },
                    ArrowDown: { x: 0, y: step }
                }[event.key];
                nudgeSelection(delta.x, delta.y);
                event.preventDefault();
                return;
            }
        }
    }

    function handleKeyUp(event: KeyboardEvent) {
        if (!state.active || isFormTarget(event.target)) return;
        if (event.key !== 'Control' && event.key !== 'Alt') return;
        updateModifierSnapMode(event.ctrlKey, event.altKey);
        refreshModifierSnapInteraction();
    }

    function handleWindowMouseDown(event: MouseEvent) {
        if (!refs.contextMenu.classList.contains('open')) return;
        if (!(event.target instanceof Node) || !refs.contextMenu.contains(event.target)) {
            closeContextMenu();
        }
    }

    function handleWindowBeforeUnload() {
        persistDesignerUiState();
    }

    function setDesignerActive(nextActive: boolean) {
        if (state.active === nextActive) return;
        state.active = nextActive;
        closeContextMenu();
        if (!state.active) {
            closeModal();
            state.liveResumeSnapshot = null;
            refreshPanel();
            return;
        }
        if (state.mode === 'edit' && restoreEditModeSnapshot()) {
            setStatus('Restored the authored world state for editing.', 'neutral');
        }
        // Re-sync to the current live view each time the panel is restored so
        // the world does not jump back to an older stored designer camera.
        focusOnCurrentWorldPosition();
        state.hasOpenedOnce = true;
        refreshPanel();
    }

    function redrawOverviewBase() {
        if (
            overviewBaseCanvas.width !== refs.overviewCanvas.width ||
            overviewBaseCanvas.height !== refs.overviewCanvas.height
        ) {
            overviewBaseCanvas.width = refs.overviewCanvas.width;
            overviewBaseCanvas.height = refs.overviewCanvas.height;
        }
        const ctx = overviewBaseCanvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, overviewBaseCanvas.width, overviewBaseCanvas.height);
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, overviewBaseCanvas.width, overviewBaseCanvas.height);

        const scaleX = overviewBaseCanvas.width / MAP_WIDTH;
        const scaleY = overviewBaseCanvas.height / MAP_HEIGHT;
        const colors: Record<DesignerCategory, string> = {
            world: '#38bdf8',
            buttons: '#f59e0b',
            doors: '#ef4444',
            creatures: '#22c55e',
            collectables: '#a855f7',
            custom: '#facc15'
        };

        for (const [category, visible] of Object.entries(state.layerVisibility) as Array<[DesignerCategory, boolean]>) {
            if (!visible) continue;
            const entities = getCategoryArray(category);
            ctx.fillStyle = colors[category];
            for (const entity of entities) {
                const rect = getEntityRect(entity, category);
                ctx.fillRect(
                    rect.left * scaleX,
                    rect.top * scaleY,
                    Math.max(2, rect.width * scaleX),
                    Math.max(2, rect.height * scaleY)
                );
            }
        }

        const astronautStart = getAstronautStartPosition();
        ctx.fillStyle = '#f97316';
        ctx.beginPath();
        ctx.arc(astronautStart.x * scaleX, astronautStart.y * scaleY, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#fed7aa';
        ctx.lineWidth = 1.5;
        ctx.strokeRect(
            astronautStart.x * scaleX - 5,
            astronautStart.y * scaleY - 5,
            10,
            10
        );
        overviewBaseDirty = false;
    }

    function drawOverview() {
        const ctx = refs.overviewCanvas.getContext('2d');
        if (!ctx) return;

        if (
            overviewBaseDirty ||
            overviewBaseCanvas.width !== refs.overviewCanvas.width ||
            overviewBaseCanvas.height !== refs.overviewCanvas.height
        ) {
            redrawOverviewBase();
        }

        ctx.clearRect(0, 0, refs.overviewCanvas.width, refs.overviewCanvas.height);
        ctx.drawImage(overviewBaseCanvas, 0, 0);
        const scaleX = refs.overviewCanvas.width / MAP_WIDTH;
        const scaleY = refs.overviewCanvas.height / MAP_HEIGHT;

        for (const visual of getSelectionVisuals(getSelectedItems())) {
            ctx.strokeStyle = visual.isPrimary ? '#ffffff' : '#93c5fd';
            ctx.lineWidth = visual.isPrimary ? 2 : 1.5;
            ctx.strokeRect(
                visual.rect.left * scaleX,
                visual.rect.top * scaleY,
                Math.max(3, visual.rect.width * scaleX),
                Math.max(3, visual.rect.height * scaleY)
            );
        }

        const currentCameraRect = {
            left: state.camera.x * scaleX,
            top: state.camera.y * scaleY,
            width: host.canvas.width * scaleX,
            height: host.canvas.height * scaleY
        };
        ctx.strokeStyle = '#22d3ee';
        ctx.lineWidth = 2;
        ctx.strokeRect(
            currentCameraRect.left,
            currentCameraRect.top,
            currentCameraRect.width,
            currentCameraRect.height
        );

        if (state.overviewHoverWorld) {
            ctx.strokeStyle = '#f8fafc';
            ctx.setLineDash([6, 4]);
            ctx.strokeRect(
                (state.overviewHoverWorld.x - host.canvas.width / 2) * scaleX,
                (state.overviewHoverWorld.y - host.canvas.height / 2) * scaleY,
                host.canvas.width * scaleX,
                host.canvas.height * scaleY
            );
            ctx.setLineDash([]);
        }
    }

    function drawObjectSnapGuide(ctx: CanvasRenderingContext2D, guide: ObjectSnapGuide) {
        ctx.save();
        ctx.strokeStyle = '#22d3ee';
        ctx.fillStyle = guide.mode === 'align'
            ? 'rgba(167, 139, 250, 0.12)'
            : 'rgba(34, 211, 238, 0.12)';
        ctx.strokeStyle = guide.mode === 'align'
            ? '#a78bfa'
            : '#22d3ee';
        ctx.lineWidth = 2;
        ctx.setLineDash(guide.mode === 'align' ? [2, 4] : [6, 4]);
        ctx.strokeRect(
            guide.targetRect.left - state.camera.x,
            guide.targetRect.top - state.camera.y,
            guide.targetRect.width,
            guide.targetRect.height
        );
        ctx.setLineDash([]);
        ctx.beginPath();
        ctx.moveTo(
            guide.line.start.x - state.camera.x,
            guide.line.start.y - state.camera.y
        );
        ctx.lineTo(
            guide.line.end.x - state.camera.x,
            guide.line.end.y - state.camera.y
        );
        ctx.stroke();
        ctx.restore();
    }

    refs.activeToggle.addEventListener('click', () => {
        setDesignerActive(!state.active);
    });
    refs.paletteDesignerToggle.addEventListener('click', () => {
        state.paletteDesignerOpen = !state.paletteDesignerOpen;
        refreshPanel();
    });
    refs.paletteFlyoutClose.addEventListener('click', () => {
        state.paletteDesignerOpen = false;
        refreshPanel();
    });
    refs.paletteList.addEventListener('change', () => {
        state.selectedPaletteIndex = clamp(Number(refs.paletteList.value) || 0, 0, paletteCount - 1);
        refreshPaletteDesigner();
        persistDesignerUiState();
    });
    refs.palettePreviewTypeSelect.addEventListener('change', () => {
        state.palettePreviewType = refs.palettePreviewTypeSelect.value;
        refreshPaletteDesigner();
        persistDesignerUiState();
    });
    refs.paletteNewButton.addEventListener('click', createNewPalette);
    refs.paletteCloneButton.addEventListener('click', cloneSelectedPalette);
    refs.paletteDeleteButton.addEventListener('click', () => {
        void deleteSelectedPalette();
    });
    refs.paletteAddMappingButton.addEventListener('click', () => {
        const paletteDefinition = state.paletteDefinitions[state.selectedPaletteIndex];
        if (!paletteDefinition) return;
        paletteDefinition.push({
            from: colorAliasNames[0] ?? 'White',
            to: colorAliasNames[0] ?? 'White'
        });
        refreshPaletteDesigner();
    });
    refs.paletteSaveButton.addEventListener('click', () => {
        void savePaletteDesigner();
    });

    refs.modeSelect.addEventListener('change', () => {
        state.mode = refs.modeSelect.value as DesignerMode;
        if (state.mode === 'edit' && restoreEditModeSnapshot()) {
            setStatus('Restored the authored world state for editing.', 'neutral');
        }
        state.liveResumeSnapshot = null;
        refreshPanel();
    });
    refs.toolSelect.addEventListener('change', () => {
        state.tool = refs.toolSelect.value as DesignerTool;
        refreshPanel();
    });
    refs.categorySelect.addEventListener('change', () => {
        state.category = refs.categorySelect.value as DesignerCategory;
        setCurrentType(state.typeByCategory[state.category]);
        refreshPanel();
    });
    refs.typeSelect.addEventListener('change', () => {
        if (
            isTeleporterCompositeType(refs.typeSelect.value) ||
            isButtonCompositeType(refs.typeSelect.value)
        ) {
            setCurrentType(refs.typeSelect.value);
            return;
        }
        const selection = getSingleEditableSelection();
        if (selection) {
            if (selection.category === 'custom') {
                const definition = getCustomSpriteDefinitionById(refs.typeSelect.value);
                if (!definition) {
                    return;
                }
                runMutation('Updated custom sprite type.', () => {
                    selection.entity.customSpriteId = definition.id;
                    selection.entity.type = definition.name;
                    state.typeByCategory.custom = definition.id;
                });
                updateSelectionFromInspectorState();
                return;
            }
            runMutation('Updated sprite type.', () => {
                selection.entity.type = refs.typeSelect.value;
                state.typeByCategory[selection.category] = refs.typeSelect.value;
            });
            updateSelectionFromInspectorState();
            return;
        }
        setCurrentType(refs.typeSelect.value);
    });
    refs.spritePicker.addEventListener('toggle', () => {
        state.spritePickerOpen = refs.spritePicker.open;
    });
    refs.spritePickerFilter.addEventListener('input', () => {
        state.spritePickerFilter = refs.spritePickerFilter.value;
        if (state.spritePickerFilter.trim().length > 0) {
            refs.spritePickerCategoryFilter.value = 'all';
        }
        renderSpritePickerGrid();
        persistDesignerUiState();
    });
    refs.spritePickerCategoryFilter.addEventListener('change', () => {
        state.spritePickerCategoryFilter = refs.spritePickerCategoryFilter.value as SpritePickerCategoryFilter;
        renderSpritePickerGrid();
        persistDesignerUiState();
    });
    refs.rotationSelect.addEventListener('change', () => {
        const rotation = normalizeRotation(Number(refs.rotationSelect.value));
        const selection = getSingleEditableSelection();
        if (selection) {
            runMutation('Updated rotation.', () => {
                applyEntityRotationWithTeleporterSync(selection.entity, rotation);
                if (selection.category === 'creatures') {
                    selection.entity.state = selection.entity.state ?? {};
                    selection.entity.state.authoredRotation = rotation;
                }
                if ('defaultRotation' in selection.entity) {
                    selection.entity.defaultRotation = rotation;
                }
            });
            updateSelectionFromInspectorState();
            return;
        }
        state.rotation = rotation;
        renderCurrentSpritePreview();
    });
    refs.translationSelect.addEventListener('change', () => {
        const translation = normalizeSpriteTranslation(refs.translationSelect.value);
        const selection = getSingleEditableSelection();
        if (selection && categorySupportsTranslation(selection.category)) {
            runMutation('Updated translation.', () => {
                selection.entity.translation = translation;
            });
            updateSelectionFromInspectorState();
            return;
        }
        state.translation = translation;
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
        persistDesignerUiState();
    });
    refs.paletteSelect.addEventListener('change', () => {
        const palette = clamp(Number(refs.paletteSelect.value), 0, paletteCount - 1);
        const selections = getSelectedItems();
        if (selections.length > 1) {
            const paletteTargets = selections
                .map((selection) => selection.entity)
                .filter((entity): entity is { palette?: number } =>
                    !!entity &&
                    typeof entity === 'object' &&
                    'palette' in entity
                );
            if (paletteTargets.length > 0) {
                runMutation('Updated selected palettes.', () => {
                    for (const target of paletteTargets) {
                        target.palette = palette;
                    }
                });
                updateSelectionFromInspectorState();
                return;
            }
        }
        const selection = getSingleEditableSelection();
        if (selection) {
            runMutation('Updated palette.', () => {
                selection.entity.palette = palette;
            });
            updateSelectionFromInspectorState();
            return;
        }
        state.palette = palette;
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
    });
    refs.snapCheckbox.addEventListener('change', () => {
        state.snapToGrid = refs.snapCheckbox.checked;
        persistDesignerUiState();
    });
    refs.objectSnapCheckbox.addEventListener('change', () => {
        state.objectSnapEnabled = refs.objectSnapCheckbox.checked;
        state.activeObjectSnapMode = state.objectSnapEnabled ? 'dock' : 'none';
        if (!state.objectSnapEnabled) {
            state.objectSnapGuides = [];
        } else {
            refreshModifierSnapInteraction();
        }
        persistDesignerUiState();
    });
    refs.snapOffsetXInput.addEventListener('change', () => {
        setSnapOffsets(Number(refs.snapOffsetXInput.value) || 0, state.snapOffsetY);
        refs.snapOffsetXInput.value = String(state.snapOffsetX);
        persistDesignerUiState();
    });
    refs.snapOffsetYInput.addEventListener('change', () => {
        setSnapOffsets(state.snapOffsetX, Number(refs.snapOffsetYInput.value) || 0);
        refs.snapOffsetYInput.value = String(state.snapOffsetY);
        persistDesignerUiState();
    });
    refs.snapOffsetCaptureButton.addEventListener('click', () => {
        const sourceSelection = getSelectedItems()[0];
        if (sourceSelection) {
            setSnapOffsetsFromPosition(sourceSelection.entity);
            refreshPanel();
            setStatus('Aligned the snap grid offset to the current selection.', 'neutral');
            return;
        }

        const viewCenter = {
            x: Math.round(state.camera.x + host.canvas.width / 2),
            y: Math.round(state.camera.y + host.canvas.height / 2)
        };
        setSnapOffsetsFromPosition(viewCenter);
        refreshPanel();
        setStatus('Aligned the snap grid offset to the current view center.', 'neutral');
    });
    refs.nudgeInput.addEventListener('change', () => {
        state.nudgeAmount = clamp(Number(refs.nudgeInput.value) || 1, 1, 64);
        refs.nudgeInput.value = String(state.nudgeAmount);
    });
    refs.showCollisionCheckbox.addEventListener('change', () => {
        state.showCollisionOverlay = refs.showCollisionCheckbox.checked;
    });
    refs.showCreatureOverlaysCheckbox.addEventListener('change', () => {
        state.showCreatureOverlays = refs.showCreatureOverlaysCheckbox.checked;
        host.setShowCreatureOverlays(state.showCreatureOverlays);
        persistDesignerUiState();
    });
    refs.showSpriteOutlineCheckbox.addEventListener('change', () => {
        host.setShowSpriteOutlines(refs.showSpriteOutlineCheckbox.checked);
    });
    const applyBulletImpactAudioSettingsFromControls = () => {
        const current = host.getBulletImpactAudioSettings();
        const alternateChance = clamp(Number(refs.bulletImpactAlternateChanceInput.value) || 0, 0, 1);
        const volume = clamp(Number(refs.bulletImpactVolumeInput.value) || 0, 0, 1);
        host.setBulletImpactAudioSettings({
            primary: refs.bulletImpactPrimarySelect.value === 'bulletExplosion2' ? 'bulletExplosion2' : 'bulletExplosion',
            alternate: refs.bulletImpactAlternateSelect.value === 'bulletExplosion2' ? 'bulletExplosion2' : 'bulletExplosion',
            alternateChance,
            volume
        });
        const updated = host.getBulletImpactAudioSettings();
        refs.bulletImpactPrimarySelect.value = updated.primary;
        refs.bulletImpactAlternateSelect.value = updated.alternate;
        refs.bulletImpactAlternateChanceInput.value = updated.alternateChance.toFixed(2);
        refs.bulletImpactVolumeInput.value = updated.volume.toFixed(2);
        if (
            current.primary !== updated.primary ||
            current.alternate !== updated.alternate ||
            current.alternateChance !== updated.alternateChance ||
            current.volume !== updated.volume
        ) {
            persistDesignerUiState();
        }
    };
    refs.bulletImpactPrimarySelect.addEventListener('change', applyBulletImpactAudioSettingsFromControls);
    refs.bulletImpactAlternateSelect.addEventListener('change', applyBulletImpactAudioSettingsFromControls);
    refs.bulletImpactAlternateChanceInput.addEventListener('change', applyBulletImpactAudioSettingsFromControls);
    refs.bulletImpactVolumeInput.addEventListener('change', applyBulletImpactAudioSettingsFromControls);
    refs.magnifierCheckbox.addEventListener('change', () => {
        state.magnifierEnabled = refs.magnifierCheckbox.checked;
        if (!state.magnifierEnabled) {
            state.lastPointerCanvas = null;
        }
        persistDesignerUiState();
    });
    refs.disablePreviewCollisionCheckbox.addEventListener('change', () => {
        state.disableCollisionInPreview = refs.disablePreviewCollisionCheckbox.checked;
    });
    for (const [category, checkbox] of Object.entries(refs.layerCheckboxes) as Array<[DesignerCategory, HTMLInputElement]>) {
        checkbox.addEventListener('change', () => {
            state.layerVisibility[category] = checkbox.checked;
            invalidateOverviewBase();
        });
    }
    refs.savePreviewButton.addEventListener('click', openSavePreview);
    refs.pngImportButton.addEventListener('click', openPngImportModal);
    refs.deleteButton.addEventListener('click', deleteSelection);
    refs.duplicateButton.addEventListener('click', duplicateSelection);
    refs.sendToBackButton.addEventListener('click', () => reorderSelections(false));
    refs.bringToFrontButton.addEventListener('click', () => reorderSelections(true));
    refs.focusButton.addEventListener('click', focusSelection);
    refs.convertButton.addEventListener('click', convertSelection);
    refs.focusAstronautButton.addEventListener('click', () => {
        focusOnCurrentWorldPosition();
        setStatus('Centered view on the astronaut.', 'neutral');
    });
    refs.moveAstronautButton.addEventListener('click', () => {
        moveLiveAstronautToViewCenter();
    });
    refs.expandViewportCheckbox.addEventListener('change', () => {
        setViewportExpanded(refs.expandViewportCheckbox.checked);
    });
    refs.soundEnabledCheckbox.addEventListener('change', () => {
        host.setSoundEnabled(refs.soundEnabledCheckbox.checked);
        persistDesignerUiState();
    });
    refs.addAtCenterButton.addEventListener('click', () => {
        runMutation(`Placed new ${CATEGORY_LABELS[state.category].toLowerCase()} at the view center.`, () => {
            placeAtWorld(
                state.camera.x + host.canvas.width / 2,
                state.camera.y + host.canvas.height / 2
            );
        });
        updateSelectionFromInspectorState();
    });
    refs.setAstronautStartButton.addEventListener('click', () => {
        setAstronautStartToViewCenter();
    });
    refs.normalizeSpriteSheetButton.addEventListener('click', () => {
        void openSpriteSheetNormalizationPreview();
    });
    refs.modalClose.addEventListener('click', () => closeModal());
    refs.modalConfirm.addEventListener('click', () => {
        if (modalConfirmAction) {
            void modalConfirmAction();
        }
    });
    refs.modal.addEventListener('click', (event) => {
        if (event.target === refs.modal) {
            closeModal();
        }
    });
    refs.contextMenu.addEventListener('contextmenu', (event) => {
        event.preventDefault();
    });
    refs.contextMenu.addEventListener('mousedown', (event) => {
        event.stopPropagation();
    });
    refs.overviewCanvas.addEventListener('mousedown', handleOverviewMouseDown);
    refs.overviewCanvas.addEventListener('mousemove', handleOverviewMouseMove);
    refs.overviewCanvas.addEventListener('mouseleave', () => {
        state.overviewDragging = false;
        state.overviewHoverWorld = null;
    });
    refs.overviewCanvas.addEventListener('mouseup', handleOverviewMouseUp);
    host.canvas.addEventListener('contextmenu', (event) => {
        if (state.active && state.mode === 'edit') {
            event.preventDefault();
            if (state.suppressContextMenuOnce) {
                state.suppressContextMenuOnce = false;
                closeContextMenu();
                return;
            }
            const point = getCanvasPoint(event);
            const world = screenToWorld(point.x, point.y);
            const hit = getEntityAt(world.x, world.y);
            if (hit) {
                openContextMenu(hit, event);
            } else {
                openEmptyContextMenu(event, world);
            }
        }
    });
    host.canvas.addEventListener('mousedown', handleCanvasMouseDown);
    host.canvas.addEventListener('mousemove', handleCanvasMouseMove);
    host.canvas.addEventListener('mouseleave', handleCanvasMouseLeave);
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('mousedown', handleWindowMouseDown);
    window.addEventListener('resize', resizeExpandedViewport);
    window.addEventListener('beforeunload', handleWindowBeforeUnload);

    refreshSelectOptions();
    if (restoredViewportExpanded) {
        setViewportExpanded(true);
    }
    refreshPanel();

    return {
        isActive() {
            return state.active;
        },
        isPreviewMode() {
            return state.active && state.mode === 'preview';
        },
        isViewportExpanded() {
            return state.viewportExpanded;
        },
        setViewportExpanded(expanded: boolean) {
            setViewportExpanded(expanded);
        },
        getCamera() {
            return state.camera;
        },
        getLayerVisibility() {
            return state.layerVisibility;
        },
        getDebugSelection() {
            return state.selection;
        },
        shouldShowCollisionOverlay() {
            return state.active && state.showCollisionOverlay;
        },
        shouldDisableCollisionInPreview() {
            return state.active && state.mode === 'preview' && state.disableCollisionInPreview;
        },
        render(ctx: CanvasRenderingContext2D) {
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
        },
        destroy() {
            setViewportExpanded(false);
            customSpriteDefinitionResolver = null;
            visibleSpriteRectResolver = null;
            visibleSpriteRectCache.clear();
            closeContextMenu();
            refs.overviewCanvas.removeEventListener('mousedown', handleOverviewMouseDown);
            refs.overviewCanvas.removeEventListener('mousemove', handleOverviewMouseMove);
            refs.overviewCanvas.removeEventListener('mouseup', handleOverviewMouseUp);
            host.canvas.removeEventListener('mousedown', handleCanvasMouseDown);
            host.canvas.removeEventListener('mousemove', handleCanvasMouseMove);
            host.canvas.removeEventListener('mouseleave', handleCanvasMouseLeave);
            window.removeEventListener('mousemove', handleCanvasMouseMove);
            window.removeEventListener('mouseup', handleCanvasMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('keyup', handleKeyUp);
            window.removeEventListener('mousedown', handleWindowMouseDown);
            window.removeEventListener('resize', resizeExpandedViewport);
            window.removeEventListener('beforeunload', handleWindowBeforeUnload);
            root.remove();
            modal.remove();
            paletteFlyout.remove();
            styles.remove();
        }
    };
}
