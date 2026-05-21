import { MAP_HEIGHT, MAP_WIDTH, SPRITE_SCALE } from './constants.js';
import { MapBlock, shouldMaskAstronaut } from './map.js';
import { Button } from './button.js';
import { Door } from './door.js';
import { Creature } from './creature.js';
import { Collectable } from './collectable.js';
import { PaletteCycleSettings, Position } from './types/index.js';
import { buildDefaultPaletteCycle, getEffectivePaletteCycle } from './palette-cycle.js';
import { normalizeSpriteTranslation, SPRITE_TRANSLATION_OPTIONS, SpriteTranslation } from './utilities.js';

export type DesignerCategory = 'world' | 'buttons' | 'doors' | 'creatures' | 'collectables';
export type DesignerMode = 'edit' | 'preview';
export type DesignerTool = 'select' | 'place';

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
    collision?: boolean;
    pressOffset?: number;
    boxOffsetX?: number;
    boxOffsetY?: number;
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
};

export type CreatureSaveData = {
    x: number;
    y: number;
    type: string;
    palette?: number;
    rotation?: number;
    state?: Record<string, unknown>;
    paletteCycle?: PaletteCycleSettings;
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
};

export type RawWorldData = {
    worldMap: MapBlock[];
    buttons: ButtonSaveData[];
    doors: DoorSaveData[];
    creatures: CreatureSaveData[];
    collectables: CollectableSaveData[];
    astronautStart: Position;
};

export type LayerVisibility = Record<DesignerCategory, boolean>;
export type SpriteCatalogEntry = {
    name: string;
    palette: number;
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
    replaceRawWorldData(data: RawWorldData): void;
    afterWorldDataMutated(): void;
    getFocusWorldPosition(): Position;
    resetAstronautToPosition(position: Position): void;
    setAstronautStartPosition(position: Position, applyToAstronaut?: boolean): void;
    getSoundEnabled(): boolean;
    setSoundEnabled(enabled: boolean): void;
    getShowSpriteOutlines(): boolean;
    setShowSpriteOutlines(value: boolean): void;
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
    data: MapBlock | ButtonSaveData | DoorSaveData | CreatureSaveData | CollectableSaveData;
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
    blocks: MapBlock[];
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
    relativeTileX: number;
    relativeTileY: number;
    columns: number;
    rows: number;
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
    disableCollisionInPreview: boolean;
    layerVisibility: LayerVisibility;
    camera: Position;
    hasOpenedOnce: boolean;
    spritePickerOpen: boolean;
    spritePickerFilter: string;
    magnifierEnabled: boolean;
    viewportExpanded: boolean;
    soundEnabled: boolean;
    paletteDesignerOpen: boolean;
    selectedPaletteIndex: number;
    palettePreviewType: string;
};

type ContextMenuState = {
    screen: Position | null;
    world: Position | null;
    primarySelection: Selection | null;
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
    dragStartSnapshot: RawWorldData | null;
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
    magnifierEnabled: boolean;
    pickerDrag: PickerDrag | null;
    pickerDragCanvas: Position | null;
    savePreviewOpen: boolean;
    viewportExpanded: boolean;
    paletteDesignerOpen: boolean;
    selectedPaletteIndex: number;
    palettePreviewType: string;
    paletteDefinitions: PaletteDefinition[];
    lastSavedPaletteDefinitions: PaletteDefinition[];
    contextMenu: ContextMenuState;
    suppressContextMenuOnce: boolean;
    undoStack: RawWorldData[];
    redoStack: RawWorldData[];
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
    convertButton: HTMLButtonElement;
    focusAstronautButton: HTMLButtonElement;
    moveAstronautButton: HTMLButtonElement;
    expandViewportCheckbox: HTMLInputElement;
    soundEnabledCheckbox: HTMLInputElement;
    addAtCenterButton: HTMLButtonElement;
    setAstronautStartButton: HTMLButtonElement;
    showCollisionCheckbox: HTMLInputElement;
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
const CATEGORY_LABELS: Record<DesignerCategory, string> = {
    world: 'World items',
    buttons: 'Buttons',
    doors: 'Doors',
    creatures: 'Creatures',
    collectables: 'Collectables'
};

const SAVE_FILE_LABELS: Record<keyof RawWorldData, string> = {
    worldMap: 'world_map.json',
    buttons: 'buttons.json',
    doors: 'doors.json',
    creatures: 'creatures.json',
    collectables: 'collectables.json',
    astronautStart: 'astronaut_start.json'
};
const PALETTE_FILE_LABEL = 'palettes.json';

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
    return clamp(Math.round(rotation), 1, 7);
}

function formatSpriteTranslation(translation?: string | null) {
    const normalized = normalizeSpriteTranslation(translation);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

function toMapBlockData(block: MapBlock): MapBlock {
    return {
        x: block.x,
        y: block.y,
        type: block.type,
        collision: block.collision !== false,
        maskAstronaut: shouldMaskAstronaut(block),
        palette: typeof block.palette === 'number' ? block.palette : 0,
        rotation: normalizeRotation(block.rotation) as MapBlock['rotation'],
        translation: normalizeSpriteTranslation(block.translation),
        ...(block.paletteCycle ? { paletteCycle: deepClone(block.paletteCycle) } : {})
    };
}

function toButtonData(button: any): ButtonSaveData {
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
        collision: button.collision !== false,
        pressOffset: button.pressOffset ?? 2,
        boxOffsetX: button.boxOffsetX ?? 12,
        boxOffsetY: button.boxOffsetY ?? 0,
        ...(button.paletteCycle ? { paletteCycle: deepClone(button.paletteCycle) } : {})
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
        ...(door.paletteCycle ? { paletteCycle: deepClone(door.paletteCycle) } : {})
    };
}

function toCreatureData(creature: any): CreatureSaveData {
    return {
        x: creature.x,
        y: creature.y,
        type: creature.type,
        palette: creature.palette ?? 0,
        rotation: normalizeRotation(creature.rotation),
        state: deepClone(creature.state ?? {}),
        ...(creature.paletteCycle ? { paletteCycle: deepClone(creature.paletteCycle) } : {})
    };
}

function toCollectableData(collectable: any): CollectableSaveData {
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
        ...(collectable.paletteCycle ? { paletteCycle: deepClone(collectable.paletteCycle) } : {})
    };
}

function serializeWorldData(data: RawWorldData): RawWorldData {
    return {
        worldMap: data.worldMap.map((block) => toMapBlockData(block)),
        buttons: data.buttons.map((button) => toButtonData(button)),
        doors: data.doors.map((door) => toDoorData(door)),
        creatures: data.creatures.map((creature) => toCreatureData(creature)),
        collectables: data.collectables.map((collectable) => toCollectableData(collectable)),
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

function getDefaultType(spriteTypes: string[], category: DesignerCategory) {
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

function buildLayerVisibility(): LayerVisibility {
    return {
        world: true,
        buttons: true,
        doors: true,
        creatures: true,
        collectables: true
    };
}

function getRectAtPosition(x: number, y: number, category: DesignerCategory): Rect {
    const width = category === 'buttons' ? TILE_SIZE + 14 : TILE_SIZE;
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

function getEntityRect(entity: any, category: DesignerCategory) {
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

    for (let chunkRow = 0; chunkRow < totalChunkRows; chunkRow += 1) {
        for (let chunkColumn = 0; chunkColumn < totalChunkColumns; chunkColumn += 1) {
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
            chunkCanvas.width = pixelWidth;
            chunkCanvas.height = pixelHeight;
            chunkContext.clearRect(0, 0, pixelWidth, pixelHeight);
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
            const imageData = chunkContext.getImageData(0, 0, pixelWidth, pixelHeight);
            const shouldWrite = !config.skipEmpty || !isImageDataEmpty(imageData);
            if (shouldWrite) {
                const blob = await canvasToBlob(chunkCanvas);
                await writeBlobToDirectory(directoryHandle, entry.fileName, blob);
                chunks.push(entry);
            }
            processedChunks += 1;
            if (onProgress) {
                await onProgress({
                    phase: 'Exporting chunk PNGs',
                    completed: processedChunks,
                    total: totalChunkCount,
                    detail: `Writing chunk row ${chunkRow + 1}, column ${chunkColumn + 1}.`
                });
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
    return {
        directoryName: directoryHandle.name,
        manifest,
        files
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
    const limitedChunks = range.maxChunks > 0 ? filteredChunks.slice(0, range.maxChunks) : filteredChunks;
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
    const minTileX = Math.min(...selectedChunks.map((chunk) => chunk.sourceTileX)) - cropTileOriginX;
    const minTileY = Math.min(...selectedChunks.map((chunk) => chunk.sourceTileY)) - cropTileOriginY;
    const maxTileX = Math.max(...selectedChunks.map((chunk) => chunk.sourceTileX + chunk.tileWidth)) - cropTileOriginX;
    const maxTileY = Math.max(...selectedChunks.map((chunk) => chunk.sourceTileY + chunk.tileHeight)) - cropTileOriginY;
    const columns = maxTileX - minTileX;
    const rows = maxTileY - minTileY;
    const tileCount = columns * rows;
    if (tileCount > PNG_IMPORT_MAX_TILES) {
        throw new Error(`The selected chunk range covers ${tileCount} tiles. Reduce the chunk range or max chunk count so the composed import stays within ${PNG_IMPORT_MAX_TILES} tiles.`);
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
        const destinationX = (chunk.sourceTileX - cropTileOriginX - minTileX) * PNG_IMPORT_SOURCE_TILE_SIZE;
        const destinationY = (chunk.sourceTileY - cropTileOriginY - minTileY) * PNG_IMPORT_SOURCE_TILE_SIZE;
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
        relativeTileX: minTileX,
        relativeTileY: minTileY,
        columns,
        rows
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
    const defaultTypeByCategory = {
        world: getDefaultType(spriteTypes, 'world'),
        buttons: getDefaultType(spriteTypes, 'buttons'),
        doors: getDefaultType(spriteTypes, 'doors'),
        creatures: getDefaultType(spriteTypes, 'creatures'),
        collectables: getDefaultType(spriteTypes, 'collectables')
    };
    const restoredTypeByCategory: Record<DesignerCategory, string> = {
        world: spriteTypes.includes(persistedState?.typeByCategory?.world ?? '') ? persistedState!.typeByCategory.world : defaultTypeByCategory.world,
        buttons: spriteTypes.includes(persistedState?.typeByCategory?.buttons ?? '') ? persistedState!.typeByCategory.buttons : defaultTypeByCategory.buttons,
        doors: spriteTypes.includes(persistedState?.typeByCategory?.doors ?? '') ? persistedState!.typeByCategory.doors : defaultTypeByCategory.doors,
        creatures: spriteTypes.includes(persistedState?.typeByCategory?.creatures ?? '') ? persistedState!.typeByCategory.creatures : defaultTypeByCategory.creatures,
        collectables: spriteTypes.includes(persistedState?.typeByCategory?.collectables ?? '') ? persistedState!.typeByCategory.collectables : defaultTypeByCategory.collectables
    };
    const restoredCamera = persistedState?.camera
        ? host.clampCamera({
            x: Number.isFinite(persistedState.camera.x) ? persistedState.camera.x : 0,
            y: Number.isFinite(persistedState.camera.y) ? persistedState.camera.y : 0
        })
        : host.clampCamera({ x: 0, y: 0 });
    const restoredViewportExpanded = persistedState?.viewportExpanded === true;
    const palettePreviewType = spriteTypes.includes(persistedState?.palettePreviewType ?? '')
        ? persistedState!.palettePreviewType
        : defaultTypeByCategory.world;
    if (typeof persistedState?.soundEnabled === 'boolean') {
        host.setSoundEnabled(persistedState.soundEnabled);
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
        disableCollisionInPreview: persistedState?.disableCollisionInPreview ?? false,
        layerVisibility: {
            ...buildLayerVisibility(),
            ...(persistedState?.layerVisibility ?? {})
        },
        camera: restoredCamera,
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
        magnifierEnabled: persistedState?.magnifierEnabled ?? false,
        pickerDrag: null,
        pickerDragCanvas: null,
        savePreviewOpen: false,
        viewportExpanded: false,
        paletteDesignerOpen: persistedState?.paletteDesignerOpen ?? false,
        selectedPaletteIndex: clamp(typeof persistedState?.selectedPaletteIndex === 'number' ? persistedState.selectedPaletteIndex : 0, 0, paletteCount - 1),
        palettePreviewType,
        paletteDefinitions: initialPaletteDefinitions,
        lastSavedPaletteDefinitions: deepClone(initialPaletteDefinitions),
        contextMenu: {
            screen: null,
            world: null,
            primarySelection: null
        },
        pendingRightPan: false,
        suppressContextMenuOnce: false,
        undoStack: [],
        redoStack: [],
        lastSavedSnapshot: initialSnapshot
    };

    const root = document.createElement('div');
    root.className = 'world-designer-panel world-designer-hidden';
    root.innerHTML = `
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <h2>World Designer</h2>
            <button type="button" data-role="active-toggle">Hide panel</button>
        </div>
        <div class="world-designer-status" data-role="status"></div>
        <div class="world-designer-section">
            <h3>Overview navigator</h3>
            <div class="world-designer-summary">Zoomed-out world view. Move the cursor to preview the 1:1 viewport, then drag with the left mouse button to pan the main view.</div>
            <canvas class="world-designer-overview" data-role="overview" width="320" height="220"></canvas>
        </div>
        <div class="world-designer-section">
            <h3>Mode and placement</h3>
            <div class="world-designer-grid">
                <label class="world-designer-field">Mode<select data-role="mode"><option value="edit">Edit</option><option value="preview">Preview</option></select></label>
                <label class="world-designer-field">Tool<select data-role="tool"><option value="select">Select / move</option><option value="place">Place new</option></select></label>
                <label class="world-designer-field">Category<select data-role="category">
                    <option value="world">World items</option>
                    <option value="buttons">Buttons</option>
                    <option value="doors">Doors</option>
                    <option value="creatures">Creatures</option>
                    <option value="collectables">Collectables</option>
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
                            <label class="world-designer-field world-designer-grid-wide">Filter sprites<input type="text" data-role="sprite-picker-filter" placeholder="Type to filter sprite names" /></label>
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
                <button type="button" data-role="convert">Convert</button>
                <button type="button" data-role="png-import">Import PNG draft</button>
                <button type="button" data-role="normalize-sprite-sheet">Normalize sprite colors</button>
                <button type="button" data-role="save-preview">Preview before save</button>
            </div>
        </div>
        <div class="world-designer-section">
            <h3>Selection</h3>
            <div class="world-designer-summary" data-role="selection-summary">Nothing selected.</div>
            <div data-role="inspector"></div>
        </div>
        <div class="world-designer-section">
            <h3>Preview toggles</h3>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="sound-enabled" /> Sound enabled</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="expand-viewport" /> Expand viewport to window</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="show-collision" /> Show collision outlines</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="show-sprite-outlines" /> Show sprite outlines (F)</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="magnifier-enabled" /> Show magnifier</label>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="disable-preview-collision" /> Disable collision during preview</label>
            <div class="world-designer-grid">
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="world" /> World</label>
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="buttons" /> Buttons</label>
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="doors" /> Doors</label>
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="creatures" /> Creatures</label>
                <label class="world-designer-checkbox"><input type="checkbox" checked data-layer="collectables" /> Collectables</label>
            </div>
        </div>
        <div class="world-designer-section">
            <h3>Keyboard shortcuts</h3>
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
        <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;">
            <h2 style="margin:0;">Palette Designer</h2>
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
        <div class="world-designer-section">
            <h3>Color remaps</h3>
            <div class="world-designer-palette-mappings" data-role="palette-mappings"></div>
            <div class="world-designer-actions" style="margin-top:8px;">
                <button type="button" data-role="palette-add-mapping">Add remap</button>
            </div>
        </div>
    `;
    document.body.appendChild(paletteFlyout);
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
        convertButton: root.querySelector('[data-role="convert"]') as HTMLButtonElement,
        focusAstronautButton: root.querySelector('[data-role="focus-astronaut"]') as HTMLButtonElement,
        moveAstronautButton: root.querySelector('[data-role="move-astronaut"]') as HTMLButtonElement,
        expandViewportCheckbox: root.querySelector('[data-role="expand-viewport"]') as HTMLInputElement,
        soundEnabledCheckbox: root.querySelector('[data-role="sound-enabled"]') as HTMLInputElement,
        addAtCenterButton: root.querySelector('[data-role="add-center"]') as HTMLButtonElement,
        setAstronautStartButton: root.querySelector('[data-role="set-start"]') as HTMLButtonElement,
        showCollisionCheckbox: root.querySelector('[data-role="show-collision"]') as HTMLInputElement,
        showSpriteOutlineCheckbox: root.querySelector('[data-role="show-sprite-outlines"]') as HTMLInputElement,
        magnifierCheckbox: root.querySelector('[data-role="magnifier-enabled"]') as HTMLInputElement,
        disablePreviewCollisionCheckbox: root.querySelector('[data-role="disable-preview-collision"]') as HTMLInputElement,
        layerCheckboxes: {
            world: root.querySelector('[data-layer="world"]') as HTMLInputElement,
            buttons: root.querySelector('[data-layer="buttons"]') as HTMLInputElement,
            doors: root.querySelector('[data-layer="doors"]') as HTMLInputElement,
            creatures: root.querySelector('[data-layer="creatures"]') as HTMLInputElement,
            collectables: root.querySelector('[data-layer="collectables"]') as HTMLInputElement
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
    const spritePickerButtons = new Map<string, HTMLButtonElement>();
    const dragGhostPadding = 8;
    let modalConfirmAction: (() => void | Promise<void>) | null = null;
    let pngImportObjectUrl: string | null = null;

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

    function getSnapshot() {
        return serializeWorldData(host.getRawWorldData());
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
                disableCollisionInPreview: state.disableCollisionInPreview,
                layerVisibility: deepClone(state.layerVisibility),
                camera: { ...state.camera },
                hasOpenedOnce: state.hasOpenedOnce,
                spritePickerOpen: state.spritePickerOpen,
                spritePickerFilter: state.spritePickerFilter,
                magnifierEnabled: state.magnifierEnabled,
                viewportExpanded: state.viewportExpanded,
                soundEnabled: host.getSoundEnabled(),
                paletteDesignerOpen: state.paletteDesignerOpen,
                selectedPaletteIndex: state.selectedPaletteIndex,
                palettePreviewType: state.palettePreviewType
            };
            window.localStorage.setItem(DESIGNER_STATE_STORAGE_KEY, JSON.stringify(payload));
        } catch {
            // Ignore storage failures and keep the designer usable.
        }
    }

    function updateDirtyState() {
        state.dirty = !snapshotsEqual(getSnapshot(), state.lastSavedSnapshot);
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

    function setCurrentType(type: string) {
        state.typeByCategory[state.category] = type;
        refs.typeSelect.value = type;
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
    }

    function refreshSelectOptions() {
        refs.typeSelect.innerHTML = spriteTypes
            .map((type) => `<option value="${type}">${type}</option>`)
            .join('');
        refs.palettePreviewTypeSelect.innerHTML = spriteTypes
            .map((type) => `<option value="${type}">${type}</option>`)
            .join('');
        refs.rotationSelect.innerHTML = Array.from({ length: 7 }, (_, index) => {
            const value = index + 1;
            return `<option value="${value}">${value}</option>`;
        }).join('');
        refs.translationSelect.innerHTML = SPRITE_TRANSLATION_OPTIONS
            .map((value) => `<option value="${value}">${formatSpriteTranslation(value)}</option>`)
            .join('');
        refs.paletteSelect.innerHTML = Array.from({ length: paletteCount }, (_, index) => {
            return `<option value="${index}">${index}</option>`;
        }).join('');
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
            worldDataToSave = shiftPaletteReferences(getSnapshot(), removedIndex);
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

    function renderCurrentSpritePreview() {
        const type = getCurrentType();
        const previewTranslation = state.category === 'world' ? state.translation : 'center';
        const rendered = renderSpritePreviewCanvas(
            refs.spritePreviewCanvas,
            type,
            state.palette,
            state.rotation,
            previewTranslation
        );
        refs.spritePreviewMeta.textContent = rendered
            ? state.category === 'world'
                ? `${type} — palette ${state.palette}, rotation ${state.rotation}, translation ${formatSpriteTranslation(state.translation)}`
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
        const tileCount = columns * rows;
        if (tileCount > PNG_IMPORT_MAX_TILES) {
            throw new Error(`PNG import is limited to ${PNG_IMPORT_MAX_TILES} tiles per pass. Reduce the region size and try again.`);
        }
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
            const importedBlocks: MapBlock[] = [];
            const tileMatches: PngImportTileMatch[] = [];
            let uncertainTiles = 0;
            const lowConfidenceTileIndexes: number[] = [];
            let processedTiles = 0;

            for (let row = 0; row < rows; row += 1) {
                const tileSourceY = sourceY + gridOffsetY + (row * tileSourceHeight);

                for (let column = 0; column < columns; column += 1) {
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
                        lowConfidenceTileIndexes.push(row * columns + column);
                    }

                    importedBlocks.push({
                        x: Math.round(worldX + column * worldTileWidth),
                        y: Math.round(worldY + row * worldTileHeight),
                        type: tileMatch.bestCandidate.type,
                        collision: tileMatch.bestCandidate.collision,
                        maskAstronaut: tileMatch.bestCandidate.maskAstronaut,
                        palette: tileMatch.bestCandidate.palette,
                        rotation: normalizeRotation(tileMatch.bestCandidate.rotation) as MapBlock['rotation'],
                        translation: tileMatch.inferredTranslation
                    });
                    processedTiles += 1;
                }

                if (onProgress) {
                    await onProgress({
                        phase,
                        completed: processedTiles,
                        total: tileCount,
                        detail: `Processed row ${row + 1} of ${rows}.`
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
        const inferredGridOffset = inferPngImportSourceGridOffset(initialPass.tileMatches);
        const finalPass = inferredGridOffset.x !== 0 || inferredGridOffset.y !== 0
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

    function applyPngImportDraft(draft: PngImportDraft, replaceExisting: boolean) {
        runMutation(
            `Imported ${draft.blocks.length} draft world tile${draft.blocks.length === 1 ? '' : 's'} from PNG.`,
            () => {
                const worldMap = getCategoryArray('world') as MapBlock[];
                if (replaceExisting) {
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
                const insertedBlocks = draft.blocks.map((block) => toMapBlockData(block));
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
        setStatus(
            draft.uncertainTiles > 0
                ? `Imported ${draft.blocks.length} draft world tiles from PNG. ${draft.uncertainTiles} tile${draft.uncertainTiles === 1 ? '' : 's'} had low-confidence matches, so review the result in the designer before saving.`
                : `Imported ${draft.blocks.length} draft world tiles from PNG.`,
            draft.uncertainTiles > 0 ? 'neutral' : 'success'
        );
    }

    function renderSpritePickerGrid() {
        const currentType = getCurrentType();
        const filter = state.spritePickerFilter.trim().toLowerCase();
        for (const entry of spriteCatalog) {
            let button = spritePickerButtons.get(entry.name);
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
                label.textContent = entry.name;
                button.appendChild(label);

                button.addEventListener('click', () => {
                    setCurrentType(entry.name);
                    state.spritePickerOpen = false;
                    refreshPanel();
                });
                button.addEventListener('mousedown', (event) => {
                    if (event.button !== 0) return;
                    event.preventDefault();
                    state.pickerDrag = {
                        category: state.category,
                        type: entry.name,
                        palette: state.palette,
                        rotation: state.rotation,
                        translation: state.translation
                    };
                    state.pickerDragCanvas = null;
                    setCurrentType(entry.name);
                    button!.classList.add('dragging');
                    setStatus(`Dragging ${entry.name} onto the world to place it.`, 'neutral');
                });

                spritePickerButtons.set(entry.name, button);
                refs.spritePickerGrid.appendChild(button);
            }

            const matchesFilter = filter.length === 0 || entry.name.toLowerCase().includes(filter);
            button.hidden = !matchesFilter;
            button.style.display = matchesFilter ? '' : 'none';
            button.classList.toggle('selected', entry.name === currentType);
            button.classList.toggle('dragging', state.pickerDrag?.type === entry.name);
            const canvas = button.querySelector('canvas');
            if (canvas instanceof HTMLCanvasElement) {
                renderSpritePreviewCanvas(
                    canvas,
                    entry.name,
                    state.palette,
                    1,
                    state.category === 'world' ? state.translation : 'center'
                );
            }
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
            state.translation = primary.category === 'world'
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

    function removeSelectedFromArray() {
        const selections = getSelectedItems();
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

    function convertSpecificSelection(selection: Selection) {
        if (selection.category === 'world') {
            const block = selection.entity as MapBlock;
            const arr = getCategoryArray('world');
            const index = arr.indexOf(block);
            if (index >= 0) {
                arr.splice(index, 1);
            }
            const collectable = new Collectable({
                x: block.x,
                y: block.y,
                type: block.type,
                palette: block.palette ?? 0,
                rotation: normalizeRotation(block.rotation),
                name: block.type,
                weight: 0.2,
                pickupEnabled: true,
                storable: true,
                affectsAstronaut: true,
                collision: block.collision !== false,
                collected: false,
                paletteCycle: block.paletteCycle ? deepClone(block.paletteCycle) : undefined
            });
            getCategoryArray('collectables').push(collectable);
            setSelections([{ category: 'collectables', entity: collectable }]);
            return;
        }

        if (selection.category === 'collectables') {
            const collectable = selection.entity as Collectable;
            const arr = getCategoryArray('collectables');
            const index = arr.indexOf(collectable);
            if (index >= 0) {
                arr.splice(index, 1);
            }
            const block: MapBlock = {
                x: collectable.x,
                y: collectable.y,
                type: collectable.type,
                palette: collectable.palette ?? 0,
                rotation: normalizeRotation(collectable.defaultRotation ?? collectable.rotation) as MapBlock['rotation'],
                translation: 'center',
                collision: collectable.collision !== false,
                maskAstronaut: collectable.collision === false,
                paletteCycle: collectable.paletteCycle ? deepClone(collectable.paletteCycle) : undefined
            };
            getCategoryArray('world').push(block);
            setSelections([{ category: 'world', entity: block }]);
        }
    }

    function convertPrimarySelectionToCollectable() {
        const selection = getContextMenuTargetSelection();
        if (!selection || selection.category !== 'world') return;
        runMutation('Converted world item to collectable.', () => {
            convertSpecificSelection(selection);
        });
    }

    function convertPrimarySelectionToWorldItem() {
        const selection = getContextMenuTargetSelection();
        if (!selection || selection.category !== 'collectables') return;
        runMutation('Converted collectable to world item.', () => {
            convertSpecificSelection(selection);
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
        const target = resolvePlacementPosition(world.x, world.y);
        host.resetAstronautToPosition(target);
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
        }, !selection);

        addContextMenuPaletteSubmenu(selectedItems.length === 0);

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

        if (selection.category === 'world' || selection.category === 'collectables') {
            addContextMenuSubmenu('Convert', (body) => {
                if (selection.category === 'world') {
                    addContextMenuActionToContainer(body, 'Convert to collectable', convertPrimarySelectionToCollectable);
                } else {
                    addContextMenuActionToContainer(body, 'Convert to world item', convertPrimarySelectionToWorldItem);
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

    function serializeSelectionEntity(selection: Selection): ClipboardEntry['data'] {
        return deepClone(selection.category === 'world'
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
        return new Collectable(data as CollectableSaveData);
    }

    function createPastedSelections(entries: ClipboardEntry[], offsetX: number, offsetY: number) {
        const pastedSelections: Selection[] = [];
        for (const entry of entries) {
            const clone = deepClone(entry.data);
            clone.x += offsetX;
            clone.y += offsetY;
            const entity = createSelectionEntity(entry.category, clone);
            getCategoryArray(entry.category).push(entity);
            pastedSelections.push({ category: entry.category, entity });
        }
        return pastedSelections;
    }

    function placeAtWorld(worldX: number, worldY: number, snapMode: ObjectSnapMode = state.activeObjectSnapMode) {
        const { x, y } = resolvePlacementPosition(worldX, worldY, state.category, snapMode);
        const type = getCurrentType();

        if (state.category === 'world') {
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
            setSelections([{ category: 'world', entity }]);
            return;
        }

        if (state.category === 'buttons') {
            const entity = new Button({
                x,
                y,
                type,
                palette: state.palette,
                boxType: spriteTypes.includes('button_box') ? 'button_box' : type,
                boxPalette: state.palette,
                rotation: state.rotation,
                linkedDoors: [],
                collision: true,
                active: false,
                pressOffset: 2,
                boxOffsetX: 12,
                boxOffsetY: 0
            });
            getCategoryArray('buttons').push(entity);
            setSelections([{ category: 'buttons', entity }]);
            return;
        }

        if (state.category === 'doors') {
            const entity = new Door({
                x,
                y,
                z: 0,
                type,
                palette: state.palette,
                rotation: state.rotation,
                name: `${type}_${getNextDoorId()}`,
                doorID: getNextDoorId(),
                locked: false,
                open: false,
                collision: true,
                palette_locked: null,
                palette_unlocked: null
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
            weight: 0.2,
            pickupEnabled: true,
            storable: true,
            affectsAstronaut: true,
            collision: true,
            collected: false,
            held: false,
            stored: false
        });
        getCategoryArray('collectables').push(entity);
        setSelections([{ category: 'collectables', entity }]);
    }

    function commitMutation(before: RawWorldData, message: string) {
        state.undoStack.push(before);
        if (state.undoStack.length > HISTORY_LIMIT) {
            state.undoStack.shift();
        }
        state.redoStack = [];
        host.afterWorldDataMutated();
        updateDirtyState();
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
            candidates.push({ category: 'collectables', entity: collectable });
        }
        for (const creature of [...data.creatures].reverse()) {
            candidates.push({ category: 'creatures', entity: creature });
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
        state.dragging = true;
        state.dragAnchorWorld = world;
        state.dragItems = selections.map((selection) => ({
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

    function updateDraggedItems(point: Position, refreshUi = true) {
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
            applyPosition(
                target.dragItem.selection.entity,
                target.x + snapDeltaX,
                target.y + snapDeltaY
            );
        }

        host.afterWorldDataMutated();
        updateDirtyState();
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
        setStatus('Camera centered on selection.', 'neutral');
    }

    function duplicateSelection() {
        const selections = getSelectedItems();
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
        const selections = getSelectedItems();
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
        if (getSelectedItems().length === 0) return;
        runMutation('Deleted selection.', () => {
            removeSelectedFromArray();
            setSelections([]);
        });
    }

    function rotateSelection() {
        const selections = getSelectedItems();
        if (selections.length === 0) return;
        runMutation('Rotated selection.', () => {
            for (const selection of selections) {
                selection.entity.rotation = ((normalizeRotation(selection.entity.rotation) % 7) + 1);
                if (selection.category === 'collectables' && 'defaultRotation' in selection.entity) {
                    selection.entity.defaultRotation = selection.entity.rotation;
                }
            }
        });
    }

    function nudgeSelection(dx: number, dy: number) {
        const selections = getSelectedItems();
        if (selections.length === 0) return;
        runMutation('Nudged selection.', () => {
            for (const selection of selections) {
                applyPosition(
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

    function restoreSnapshot(snapshot: RawWorldData, message: string) {
        host.replaceRawWorldData(snapshot);
        state.selection = null;
        state.selectedItems = [];
        updateDirtyState();
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

    function getSavePreview(): SavePreviewState {
        const snapshot = getSnapshot();
        const errors: string[] = [];
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

    function renderSavePreview() {
        const preview = getSavePreview();
        refs.modalBody.innerHTML = '';

        const summary = document.createElement('div');
        const changedFiles = preview.files.filter((file) => file.changed);
        summary.innerHTML = `
            <p>${changedFiles.length === 0 ? 'No asset files have changed.' : `The following file(s) will be updated: <strong>${changedFiles.map((file) => file.label).join(', ')}</strong>.`}</p>
            <p>Use this dialog as a pre-save review. If the JSON looks right, confirm the save.</p>
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
        const preview = getSavePreview();
        if (preview.errors.length > 0) {
            setStatus('Resolve the validation issues before saving.', 'error');
            renderSavePreview();
            return;
        }

        const snapshot = getSnapshot();
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
        renderSavePreview();
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
        const rotationOptionMarkup = Array.from({ length: 7 }, (_, index) => {
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
                Create a rough draft of <strong>world items only</strong> by matching PNG pixels against the currently authored world sprite set. You can preview a single PNG region, split it into reusable chunk PNGs, or point the importer at an exported chunk folder to reconstruct a larger map section.
            </div>
            <div class="world-designer-import-layout">
                <div class="world-designer-import-sidebar">
                    <div class="world-designer-import-card">
                        <div class="world-designer-grid">
                            <label class="world-designer-field world-designer-grid-wide">Import source
                                <select data-role="png-import-mode">
                                    <option value="single">Single PNG</option>
                                    <option value="folder">Chunk folder</option>
                                </select>
                            </label>
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
                    <div class="world-designer-import-card">
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
                    </div>
                    <div class="world-designer-import-card">
                        <div class="world-designer-actions">
                            <button type="button" class="world-designer-button-primary" data-role="png-import-preview">Preview blocks</button>
                        </div>
                        <div class="world-designer-import-progress" data-role="png-import-progress" hidden>
                            <progress data-role="png-import-progress-bar" max="1" value="0"></progress>
                            <div class="world-designer-summary" data-role="png-import-progress-label">Preparing import…</div>
                            <div class="world-designer-summary" data-role="png-import-progress-detail"></div>
                        </div>
                        <div class="world-designer-summary" data-role="png-import-meta">
                            Loading PNG metadata…
                        </div>
                    </div>
                </div>
                <div class="world-designer-import-main">
                    <div class="world-designer-import-card">
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
                    <div class="world-designer-import-card">
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

        const modeSelect = refs.modalBody.querySelector('[data-role="png-import-mode"]') as HTMLSelectElement;
        const singleSourceCard = refs.modalBody.querySelector('[data-role="png-import-single-source"]') as HTMLDivElement;
        const folderSourceCard = refs.modalBody.querySelector('[data-role="png-import-folder-source"]') as HTMLDivElement;
        const sourceCropCard = refs.modalBody.querySelector('[data-role="png-import-source-crop"]') as HTMLDivElement;
        const exportCard = refs.modalBody.querySelector('[data-role="png-import-export-card"]') as HTMLDivElement;
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
        const snapButton = refs.modalBody.querySelector('[data-role="png-import-snap"]') as HTMLButtonElement;
        const previewButton = refs.modalBody.querySelector('[data-role="png-import-preview"]') as HTMLButtonElement;
        const meta = refs.modalBody.querySelector('[data-role="png-import-meta"]') as HTMLDivElement;
        const progressWrap = refs.modalBody.querySelector('[data-role="png-import-progress"]') as HTMLDivElement;
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
        let chunkFolderSelection: PngChunkFolderSelection | null = null;
        let lastFolderCompose: PngChunkComposedSource | null = null;
        let previewDraft: PngImportDraft | null = null;
        let previewBlocks: MapBlock[] = [];
        let previewOriginalBlocks: MapBlock[] = [];
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
            const range = getFolderSelectionRange();
            const { selectedChunks } = getPngChunkSelectionEntries(chunkFolderSelection, range);
            if (selectedChunks.length === 0) {
                return;
            }
            const cropTileOriginX = Math.round(chunkFolderSelection.manifest.crop.x / PNG_IMPORT_SOURCE_TILE_SIZE);
            const cropTileOriginY = Math.round(chunkFolderSelection.manifest.crop.y / PNG_IMPORT_SOURCE_TILE_SIZE);
            const minTileX = Math.min(...selectedChunks.map((chunk) => chunk.sourceTileX)) - cropTileOriginX;
            const minTileY = Math.min(...selectedChunks.map((chunk) => chunk.sourceTileY)) - cropTileOriginY;
            const maxTileX = Math.max(...selectedChunks.map((chunk) => chunk.sourceTileX + chunk.tileWidth)) - cropTileOriginX;
            const maxTileY = Math.max(...selectedChunks.map((chunk) => chunk.sourceTileY + chunk.tileHeight)) - cropTileOriginY;
            worldWidthInput.value = String((maxTileX - minTileX) * TILE_SIZE);
            worldHeightInput.value = String((maxTileY - minTileY) * TILE_SIZE);
        };

        const formatDuration = (milliseconds: number) => {
            const totalSeconds = Math.max(0, Math.round(milliseconds / 1000));
            const minutes = Math.floor(totalSeconds / 60);
            const seconds = totalSeconds % 60;
            return minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;
        };

        const setProgress = (progress: PngImportProgress | null) => {
            if (!progress) {
                progressWrap.hidden = true;
                progressBar.value = 0;
                progressLabel.textContent = 'Preparing import…';
                progressDetail.textContent = '';
                return;
            }
            progressWrap.hidden = false;
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
            modeSelect.value = importMode;
            singleSourceCard.hidden = folderMode;
            sourceCropCard.hidden = folderMode;
            exportCard.hidden = folderMode;
            folderSourceCard.hidden = !folderMode;
            worldWidthInput.readOnly = folderMode;
            worldHeightInput.readOnly = folderMode;
            worldMeta.textContent = folderMode
                ? 'Chunk-folder mode places the selected chunk range relative to the exported crop origin. World left/top is that origin, and width/height are kept in sync with the selected chunk range.'
                : 'Single PNG mode uses the source tile grid from the chosen PNG crop and maps it across the world rectangle you enter here.';
        };

        const setImportBusy = (busy: boolean) => {
            importBusy = busy;
            refs.modal.dataset.busy = busy ? 'true' : 'false';
            const controls: Array<HTMLInputElement | HTMLButtonElement | HTMLSelectElement> = [
                modeSelect,
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
                snapButton,
                previewButton,
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
            progressWrap.classList.toggle('busy', busy);
            selectedTypePicker.style.pointerEvents = busy ? 'none' : '';
            previewCanvas.style.pointerEvents = busy ? 'none' : '';
            worldWidthInput.disabled = busy || importMode === 'folder';
            worldHeightInput.disabled = busy || importMode === 'folder';
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
        syncExportChunkInputs();
        syncFolderRangeInputs();
        void syncPngMetadata();
        modeSelect.addEventListener('change', () => {
            importMode = modeSelect.value === 'folder' ? 'folder' : 'single';
            invalidatePreview(importMode === 'folder'
                ? 'Preview not generated yet. Choose a chunk folder and click "Preview blocks" to inspect the reconstructed map section.'
                : 'Preview not generated yet. Click "Preview blocks" to inspect the matches.');
            syncImportModeUi();
            if (importMode === 'folder') {
                syncFolderRangeInputs();
                syncFolderTargetWorldSpan();
                updatePngImportMeta();
            } else {
                void syncPngMetadata();
            }
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
                setImportBusy(true);
                setProgress({
                    phase: 'Reading chunk folder',
                    completed: 0,
                    total: 1,
                    detail: 'Loading the exported chunk manifest and PNG files.'
                });
                const directoryHandle = await getDirectoryPicker()();
                chunkFolderSelection = await readPngChunkFolderSelection(directoryHandle, async (progress) => {
                    setProgress(progress);
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
                setStatus(error instanceof Error ? error.message : 'Failed to read the chunk folder.', 'error');
            } finally {
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
            setImportBusy(true);
            setProgress({
                phase: 'Preparing chunk export',
                completed: 0,
                total: 1,
                detail: 'Validating the PNG crop and opening a destination folder.'
            });
            exportMeta.textContent = 'Exporting chunk PNGs…';
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
                    skipEmpty: exportSkipEmptyCheckbox.checked
                }, async (progress) => {
                    setProgress(progress);
                });
                exportMeta.textContent = `Exported ${result.exportedChunks} chunk PNGs to ${result.directoryName}. The folder also contains ${PNG_CHUNK_EXPORT_MANIFEST_NAME} so the chunk-folder importer can rebuild the larger map automatically.`;
                setStatus(
                    `Exported ${result.exportedChunks} chunk PNGs to ${result.directoryName}.`,
                    'success'
                );
            } catch (error) {
                exportMeta.textContent = error instanceof Error ? error.message : 'Failed to export chunk PNGs.';
                setStatus(error instanceof Error ? error.message : 'Failed to export chunk PNGs.', 'error');
            } finally {
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
            previewBlocks[selectedPreviewIndex] = toMapBlockData(previewOriginalBlocks[selectedPreviewIndex]);
            renderPreviewCanvas();
        });

        previewButton.addEventListener('click', async () => {
            progressStartedAt = Date.now();
            previewButton.textContent = 'Generating…';
            previewMeta.textContent = 'Generating preview…';
            setImportBusy(true);
            setProgress({
                phase: 'Preparing import',
                completed: 0,
                total: 1,
                detail: 'Starting PNG preview generation.'
            });
            try {
                let draft: PngImportDraft;
                let previewContextMessage = '';
                if (importMode === 'folder') {
                    if (!chunkFolderSelection) {
                        throw new Error('Choose an exported chunk folder before previewing the reconstructed map.');
                    }
                    const composed = await composePngChunkFolderSource(
                        chunkFolderSelection,
                        getFolderSelectionRange(),
                        async (progress) => {
                            setProgress(progress);
                        }
                    );
                    lastFolderCompose = composed;
                    const baseWorldX = Math.round(getNumericInputValue(worldXInput, 0));
                    const baseWorldY = Math.round(getNumericInputValue(worldYInput, 0));
                    const composedWorldX = baseWorldX + composed.relativeTileX * TILE_SIZE;
                    const composedWorldY = baseWorldY + composed.relativeTileY * TILE_SIZE;
                    const composedWorldWidth = composed.columns * TILE_SIZE;
                    const composedWorldHeight = composed.rows * TILE_SIZE;
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
                        worldHeight: composedWorldHeight
                    }, async (progress) => {
                        setProgress(progress);
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
                        setProgress(progress);
                    });
                }
                previewDraft = draft;
                previewBlocks = draft.blocks.map((block) => toMapBlockData(block));
                previewOriginalBlocks = draft.blocks.map((block) => toMapBlockData(block));
                selectedPreviewIndex = previewBlocks.length > 0 ? 0 : -1;
                renderPreviewCanvas();
                fitPreviewZoom();
                const gridOffsetMessage = draft.sourceGridOffsetX !== 0 || draft.sourceGridOffsetY !== 0
                    ? ` Auto-aligned the source grid by (${draft.sourceGridOffsetX}, ${draft.sourceGridOffsetY}) px before matching.`
                    : '';
                previewMeta.textContent = draft.uncertainTiles > 0
                    ? `Preview ready. ${draft.uncertainTiles} tile${draft.uncertainTiles === 1 ? '' : 's'} were low-confidence matches and are outlined in gold.${gridOffsetMessage}${previewContextMessage}`
                    : `Preview ready. ${draft.blocks.length} tile${draft.blocks.length === 1 ? '' : 's'} matched cleanly.${gridOffsetMessage}${previewContextMessage}`;
                refs.modalConfirm.disabled = previewBlocks.length === 0;
                updatePngImportMeta();
            } catch (error) {
                invalidatePreview(error instanceof Error ? error.message : 'Failed to generate the preview.');
                setStatus(
                    error instanceof Error ? error.message : 'Failed to generate the PNG preview.',
                    'error'
                );
            } finally {
                setImportBusy(false);
                setProgress(null);
                previewButton.textContent = 'Preview blocks';
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
                    blocks: previewBlocks.map((block) => toMapBlockData(block))
                };
                applyPngImportDraft(committedDraft, replaceCheckbox.checked);
                closeModal(true);
                setStatus(
                    committedDraft.uncertainTiles > 0
                        ? `Imported ${committedDraft.blocks.length} reviewed draft world tiles from the ${sourceLabel}. ${committedDraft.uncertainTiles} tile${committedDraft.uncertainTiles === 1 ? '' : 's'} were low-confidence auto-matches before review.`
                        : `Imported ${committedDraft.blocks.length} reviewed draft world tiles from the ${sourceLabel}.`,
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
    }

    function updateSelectionSummary() {
        const selections = getSelectedItems();
        if (selections.length === 0) {
            const astronautStart = getAstronautStartPosition();
            refs.selectionSummary.textContent = `Nothing selected. Astronaut start: (${astronautStart.x}, ${astronautStart.y})`;
            refs.convertButton.textContent = 'Convert';
            refs.convertButton.disabled = true;
            refs.deleteButton.disabled = true;
            refs.duplicateButton.disabled = true;
            refs.sendToBackButton.disabled = true;
            refs.bringToFrontButton.disabled = true;
            refs.focusButton.disabled = true;
            return;
        }

        if (selections.length > 1) {
            refs.selectionSummary.textContent = `${selections.length} objects selected. Drag any selected object to move the group.`;
            refs.convertButton.textContent = 'Convert';
            refs.convertButton.disabled = true;
            refs.deleteButton.disabled = false;
            refs.duplicateButton.disabled = false;
            refs.sendToBackButton.disabled = false;
            refs.bringToFrontButton.disabled = false;
            refs.focusButton.disabled = false;
            return;
        }

        const { category, entity } = state.selection!;
        refs.selectionSummary.textContent = `${CATEGORY_LABELS[category]}: ${entity.type} at (${entity.x}, ${entity.y})`;
        refs.convertButton.disabled = !(category === 'world' || category === 'collectables');
        refs.convertButton.textContent = category === 'world'
            ? 'Convert to collectable'
            : category === 'collectables'
                ? 'Convert to world item'
                : 'Convert';
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
        input.type = 'checkbox';
        input.checked = checked;
        input.addEventListener('change', () => onChange(input.checked));
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
        input.value = value;
        input.addEventListener('change', () => onCommit(input.value));
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
        input.type = 'number';
        input.step = String(step);
        input.value = String(value);
        input.addEventListener('change', () => onCommit(Number(input.value)));
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
        for (const optionValue of options) {
            const option = document.createElement('option');
            option.value = optionValue;
            option.textContent = optionValue;
            select.appendChild(option);
        }
        select.value = value;
        select.addEventListener('change', () => onCommit(select.value));
        field.appendChild(select);
        container.appendChild(field);
    }

    function refreshInspector() {
        refs.inspector.innerHTML = '';
        updateSelectionSummary();

        if (!state.selection || getSelectedItems().length !== 1) {
            if (getSelectedItems().length > 1) {
                const summary = document.createElement('div');
                summary.className = 'world-designer-summary';
                summary.textContent = 'Multi-selection active. Inspector editing is limited to single-object selection.';
                refs.inspector.appendChild(summary);
            }
            return;
        }

        const { category, entity } = state.selection;
        const container = refs.inspector;

        addSelectInspector(container, 'Type', entity.type, spriteTypes, (value) => {
            runMutation('Updated sprite type.', () => {
                entity.type = value;
                state.typeByCategory[category] = value;
            });
        });
        addNumberInspector(container, 'X', entity.x, (value) => {
            runMutation('Updated X position.', () => {
                entity.x = Math.round(value);
            });
        });
        addNumberInspector(container, 'Y', entity.y, (value) => {
            runMutation('Updated Y position.', () => {
                entity.y = Math.round(value);
            });
        });
        addNumberInspector(container, 'Rotation', normalizeRotation(entity.rotation), (value) => {
            runMutation('Updated rotation.', () => {
                entity.rotation = normalizeRotation(value);
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
        addNumberInspector(container, 'Palette', entity.palette ?? 0, (value) => {
            runMutation('Updated palette.', () => {
                entity.palette = clamp(Math.round(value), 0, paletteCount - 1);
            });
        });
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
            addTextInspector(container, 'Box sprite', entity.boxType ?? 'button_box', (value) => {
                runMutation('Updated button box sprite.', () => {
                    entity.boxType = value;
                });
            });
            addNumberInspector(container, 'Box palette', entity.boxPalette ?? 0, (value) => {
                runMutation('Updated button box palette.', () => {
                    entity.boxPalette = clamp(Math.round(value), 0, paletteCount - 1);
                });
            });
        }

        if (category === 'doors') {
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
            addNumberInspector(container, 'Locked palette', typeof entity.palette_locked === 'number' ? entity.palette_locked : -1, (value) => {
                runMutation('Updated locked palette.', () => {
                    entity.palette_locked = value < 0 ? null : clamp(Math.round(value), 0, paletteCount - 1);
                });
            });
            addNumberInspector(container, 'Unlocked palette', typeof entity.palette_unlocked === 'number' ? entity.palette_unlocked : -1, (value) => {
                runMutation('Updated unlocked palette.', () => {
                    entity.palette_unlocked = value < 0 ? null : clamp(Math.round(value), 0, paletteCount - 1);
                });
            });
        }

        if (category === 'creatures') {
            addTextInspector(container, 'State JSON', stableStringify(entity.state ?? {}), (value) => {
                try {
                    const parsed = value.trim().length === 0 ? {} : JSON.parse(value);
                    runMutation('Updated creature state.', () => {
                        entity.state = parsed;
                    });
                } catch {
                    setStatus('Creature state must be valid JSON.', 'error');
                }
            }, true);
        }

        if (category === 'collectables') {
            addTextInspector(container, 'Name', entity.name ?? '', (value) => {
                runMutation('Updated collectable name.', () => {
                    entity.name = value;
                });
            });
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
        }
    }

    function refreshPanel() {
        refs.root.classList.toggle('world-designer-hidden', !state.active);
        refs.activeToggle.textContent = state.active ? 'Hide panel' : 'Show panel';
        refs.expandViewportCheckbox.checked = state.viewportExpanded;
        refs.soundEnabledCheckbox.checked = host.getSoundEnabled();
        refs.modeSelect.value = state.mode;
        refs.toolSelect.value = state.tool;
        refs.categorySelect.value = state.category;
        refs.rotationSelect.value = String(state.rotation);
        refs.translationSelect.value = state.translation;
        refs.paletteSelect.value = String(state.palette);
        refs.translationSelect.disabled = state.category !== 'world' && state.selection?.category !== 'world';
        refs.snapCheckbox.checked = state.snapToGrid;
        refs.objectSnapCheckbox.checked = state.objectSnapEnabled;
        refs.snapOffsetXInput.value = String(state.snapOffsetX);
        refs.snapOffsetYInput.value = String(state.snapOffsetY);
        refs.nudgeInput.value = String(state.nudgeAmount);
        refs.showCollisionCheckbox.checked = state.showCollisionOverlay;
        refs.showSpriteOutlineCheckbox.checked = host.getShowSpriteOutlines();
        refs.magnifierCheckbox.checked = state.magnifierEnabled;
        refs.disablePreviewCollisionCheckbox.checked = state.disableCollisionInPreview;
        refs.disablePreviewCollisionCheckbox.disabled = state.mode !== 'preview';
        refs.spritePicker.open = state.spritePickerOpen;
        refs.spritePickerFilter.value = state.spritePickerFilter;

        for (const [category, checkbox] of Object.entries(refs.layerCheckboxes) as Array<[DesignerCategory, HTMLInputElement]>) {
            checkbox.checked = state.layerVisibility[category];
        }

        setCurrentType(getCurrentType());
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
        updateSelectionSummary();
        refreshInspector();
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
        state.rotation = normalizeRotation(state.selection.entity.rotation);
        state.translation = state.selection.category === 'world'
            ? normalizeSpriteTranslation(state.selection.entity.translation)
            : 'center';
        state.palette = clamp(state.selection.entity.palette ?? 0, 0, paletteCount - 1);
        state.typeByCategory[state.selection.category] = state.selection.entity.type;
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
        if (state.selection.category === 'world') {
            runMutation('Converted world item to collectable.', () => {
                convertSpecificSelection(state.selection!);
            });
            return;
        }

        if (state.selection.category === 'collectables') {
            runMutation('Converted collectable to world item.', () => {
                convertSpecificSelection(state.selection!);
            });
        }
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
        setStatus('Moved the live astronaut to the center of the current view.', 'success');
    }

    function handleCanvasMouseDown(event: MouseEvent) {
        if (!state.active || state.mode !== 'edit') return;
        if (state.pickerDrag) return;
        const point = getCanvasPoint(event);
        state.lastPointerCanvas = point;
        closeContextMenu();

        const world = screenToWorld(point.x, point.y);

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
            if (snapshotsEqual(before, after)) {
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

    function setDesignerActive(nextActive: boolean) {
        if (state.active === nextActive) return;
        state.active = nextActive;
        closeContextMenu();
        if (!state.active) {
            closeModal();
            refreshPanel();
            return;
        }
        // Re-sync to the current live view each time the panel is restored so
        // the world does not jump back to an older stored designer camera.
        focusOnCurrentWorldPosition();
        state.hasOpenedOnce = true;
        refreshPanel();
    }

    function drawOverview() {
        const ctx = refs.overviewCanvas.getContext('2d');
        if (!ctx) return;

        ctx.clearRect(0, 0, refs.overviewCanvas.width, refs.overviewCanvas.height);
        ctx.fillStyle = '#020617';
        ctx.fillRect(0, 0, refs.overviewCanvas.width, refs.overviewCanvas.height);

        const scaleX = refs.overviewCanvas.width / MAP_WIDTH;
        const scaleY = refs.overviewCanvas.height / MAP_HEIGHT;
        const colors: Record<DesignerCategory, string> = {
            world: '#38bdf8',
            buttons: '#f59e0b',
            doors: '#ef4444',
            creatures: '#22c55e',
            collectables: '#a855f7'
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

        for (const selection of getSelectedItems()) {
            const rect = getEntityRect(selection.entity, selection.category);
            const isPrimary = state.selection ? areSameSelection(selection, state.selection) : false;
            ctx.strokeStyle = isPrimary ? '#ffffff' : '#93c5fd';
            ctx.lineWidth = isPrimary ? 2 : 1.5;
            ctx.strokeRect(
                rect.left * scaleX,
                rect.top * scaleY,
                Math.max(3, rect.width * scaleX),
                Math.max(3, rect.height * scaleY)
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
        const selection = getSingleEditableSelection();
        if (selection) {
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
        renderSpritePickerGrid();
        persistDesignerUiState();
    });
    refs.rotationSelect.addEventListener('change', () => {
        const rotation = normalizeRotation(Number(refs.rotationSelect.value));
        const selection = getSingleEditableSelection();
        if (selection) {
            runMutation('Updated rotation.', () => {
                selection.entity.rotation = rotation;
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
        if (selection?.category === 'world') {
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
    refs.showSpriteOutlineCheckbox.addEventListener('change', () => {
        host.setShowSpriteOutlines(refs.showSpriteOutlineCheckbox.checked);
    });
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

            const selections = getSelectedItems();
            if (selections.length > 0) {
                for (const selection of selections) {
                    const rect = getEntityRect(selection.entity, selection.category);
                    const isPrimary = state.selection ? areSameSelection(selection, state.selection) : false;
                    ctx.save();
                    ctx.strokeStyle = isPrimary ? '#f8fafc' : '#60a5fa';
                    ctx.lineWidth = isPrimary ? 2 : 1.5;
                    ctx.setLineDash(isPrimary
                        ? (state.mode === 'preview' ? [8, 4] : [])
                        : [6, 4]);
                    ctx.strokeRect(
                        rect.left - state.camera.x,
                        rect.top - state.camera.y,
                        rect.width,
                        rect.height
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

            if (state.showCollisionOverlay) {
                ctx.save();
                ctx.strokeStyle = state.mode === 'preview'
                    ? (state.disableCollisionInPreview ? '#94a3b8' : '#22c55e')
                    : '#38bdf8';
                ctx.lineWidth = 1.5;
                ctx.setLineDash(state.mode === 'preview' && state.disableCollisionInPreview ? [4, 4] : []);
                for (const [category, visible] of Object.entries(state.layerVisibility) as Array<[DesignerCategory, boolean]>) {
                    if (!visible) continue;
                    for (const entity of getCategoryArray(category)) {
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
                    host.drawSpritePreview(
                        ghostCtx,
                        state.pickerDrag.type,
                        state.pickerDrag.palette,
                        state.pickerDrag.rotation,
                        true,
                        dragGhostTargetSize
                    );
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
            root.remove();
            modal.remove();
            paletteFlyout.remove();
            styles.remove();
        }
    };
}
