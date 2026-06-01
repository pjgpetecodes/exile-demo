import { MapBlock } from '../../world/map.js';
import type { DestructionSourceRequirement } from '../../entities/destructibles.js';
import { SPRITE_SCALE } from '../../config/constants.js';
import type { PaletteCycleSettings, Position, TeleporterDestinationMode, TeleporterSaveData, WindEmitterSaveData, WindGlobalSettings, CreatureSaveData } from '../../types/index.js';
import type { BulletImpactAudioSettings } from '../../config/settings.js';
import type { SpriteTranslation } from '../../shared/utilities.js';

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
    translation?: SpriteTranslation;
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
    windEmitters?: WindEmitterSaveData[];
    windSettings?: WindGlobalSettings;
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
    getPerformanceHudEnabled(): boolean;
    setPerformanceHudEnabled(enabled: boolean): void;
    getBulletImpactAudioSettings(): BulletImpactAudioSettings;
    setBulletImpactAudioSettings(settings: BulletImpactAudioSettings): void;
    getWindRuntimeToggles(): {
        windEnabled: boolean;
        emittersEnabled: boolean;
        surfaceWindEnabled: boolean;
        windVfxEnabled: boolean;
    };
    setWindRuntimeToggle(
        key: 'windEnabled' | 'emittersEnabled' | 'surfaceWindEnabled' | 'windVfxEnabled',
        enabled: boolean
    ): void;
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
    getMapBounds(): { width: number; height: number };
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
    windEnabledCheckbox: HTMLInputElement;
    windEmittersEnabledCheckbox: HTMLInputElement;
    windSurfaceEnabledCheckbox: HTMLInputElement;
    windVfxEnabledCheckbox: HTMLInputElement;
    addAtCenterButton: HTMLButtonElement;
    setAstronautStartButton: HTMLButtonElement;
    showCollisionCheckbox: HTMLInputElement;
    showCreatureOverlaysCheckbox: HTMLInputElement;
    showSpriteOutlineCheckbox: HTMLInputElement;
    showPerformanceHudCheckbox: HTMLInputElement;
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
const PNG_IMPORT_DEFAULT_URL = './src/assets/images/maps/MAP-Exile-BC.png';
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
    windEmitters: 'wind_emitters.json',
    windSettings: 'wind_settings.json',
    astronautStart: 'astronaut_start.json'
};
const PALETTE_FILE_LABEL = 'palettes.json';

type PlacementTypeOption = {
    value: string;
    label: string;
    previewType?: string;
};


export type {
    BrowserDirectoryHandle,
    BrowserFileHandle,
    BrowserFileSystemWriteChunk,
    BrowserWindowWithDirectoryPicker,
    BrowserWritableFileStream,
    ButtonDefaultOverrides,
    ClipboardEntry,
    ContextMenuState,
    ControlRefs,
    DesignerSectionId,
    DesignerSnapshot,
    DesignerState,
    DragItem,
    LiveResumeSnapshot,
    ObjectSnapGuide,
    ObjectSnapMatch,
    ObjectSnapMode,
    ObjectSnapResolution,
    PersistedDesignerUiState,
    PickerDrag,
    PlacementTypeOption,
    PngChunkComposedSource,
    PngChunkEntry,
    PngChunkFolderSelection,
    PngChunkManifest,
    PngChunkSelectionRange,
    PngImportCandidate,
    PngImportDraft,
    PngImportProgress,
    PngImportSampleSignature,
    PngImportSourceMode,
    PngImportTileMatch,
    PngImportWorkTab,
    Rect,
    RuntimeDesignerCategory,
    SavePreviewFile,
    SavePreviewState,
    Selection,
    SpritePickerCategoryFilter,
    TeleporterDestinationPickState
};
