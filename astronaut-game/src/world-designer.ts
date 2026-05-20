import { MAP_HEIGHT, MAP_WIDTH, SPRITE_SCALE } from './constants.js';
import { MapBlock } from './map.js';
import { Button } from './button.js';
import { Door } from './door.js';
import { Creature } from './creature.js';
import { Collectable } from './collectable.js';
import { PaletteCycleSettings, Position } from './types/index.js';
import { buildDefaultPaletteCycle, getEffectivePaletteCycle } from './palette-cycle.js';

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
        targetSize?: number
    ): boolean;
    getPaletteCount(): number;
    clampCamera(camera: Position): Position;
    saveWorldData(data: RawWorldData): Promise<void>;
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
};

type ClipboardEntry = {
    category: DesignerCategory;
    data: MapBlock | ButtonSaveData | DoorSaveData | CreatureSaveData | CollectableSaveData;
};

type SavePreviewFile = {
    key: keyof RawWorldData;
    label: string;
    changed: boolean;
    json: string;
};

type SavePreviewState = {
    files: SavePreviewFile[];
    errors: string[];
};

type PersistedDesignerUiState = {
    active: boolean;
    mode: DesignerMode;
    tool: DesignerTool;
    category: DesignerCategory;
    rotation: number;
    palette: number;
    typeByCategory: Record<DesignerCategory, string>;
    snapToGrid: boolean;
    nudgeAmount: number;
    showCollisionOverlay: boolean;
    disableCollisionInPreview: boolean;
    layerVisibility: LayerVisibility;
    camera: Position;
    hasOpenedOnce: boolean;
    spritePickerOpen: boolean;
    viewportExpanded: boolean;
    soundEnabled: boolean;
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
    palette: number;
    typeByCategory: Record<DesignerCategory, string>;
    snapToGrid: boolean;
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
    pickerDrag: PickerDrag | null;
    pickerDragCanvas: Position | null;
    savePreviewOpen: boolean;
    viewportExpanded: boolean;
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
    spritePickerGrid: HTMLDivElement;
    rotationSelect: HTMLSelectElement;
    paletteSelect: HTMLSelectElement;
    snapCheckbox: HTMLInputElement;
    nudgeInput: HTMLInputElement;
    status: HTMLDivElement;
    selectionSummary: HTMLDivElement;
    inspector: HTMLDivElement;
    overviewCanvas: HTMLCanvasElement;
    activeToggle: HTMLButtonElement;
    savePreviewButton: HTMLButtonElement;
    deleteButton: HTMLButtonElement;
    duplicateButton: HTMLButtonElement;
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
    disablePreviewCollisionCheckbox: HTMLInputElement;
    layerCheckboxes: Record<DesignerCategory, HTMLInputElement>;
    modal: HTMLDivElement;
    modalBody: HTMLDivElement;
    modalClose: HTMLButtonElement;
    modalConfirm: HTMLButtonElement;
    contextMenu: HTMLDivElement;
    contextMenuBody: HTMLDivElement;
};

const HISTORY_LIMIT = 100;
const TILE_SIZE = 32 * SPRITE_SCALE;
const DESIGNER_STATE_STORAGE_KEY = 'exile.world-designer-state.v1';
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

function toMapBlockData(block: MapBlock): MapBlock {
    return {
        x: block.x,
        y: block.y,
        type: block.type,
        collision: block.collision !== false,
        palette: typeof block.palette === 'number' ? block.palette : 0,
        rotation: normalizeRotation(block.rotation) as MapBlock['rotation'],
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

function getEntityRect(entity: any, category: DesignerCategory) {
    const width = category === 'buttons' ? TILE_SIZE + 14 : TILE_SIZE;
    const height = TILE_SIZE;
    return {
        left: entity.x,
        top: entity.y,
        right: entity.x + width,
        bottom: entity.y + height,
        width,
        height
    };
}

function normalizeRect(start: Position, end: Position) {
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

function parseDoorIds(value: string) {
    return value
        .split(',')
        .map((entry) => Number(entry.trim()))
        .filter((entry) => Number.isFinite(entry));
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
        .world-designer-panel button {
            border-radius: 6px;
            border: 1px solid rgba(148, 163, 184, 0.35);
            background: rgba(30, 41, 59, 0.95);
            color: #f8fafc;
            padding: 6px 10px;
            cursor: pointer;
        }
        .world-designer-panel button:hover {
            background: rgba(51, 65, 85, 0.95);
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
            overflow: auto;
            padding: 0 8px 8px;
        }
        .world-designer-sprite-picker-grid {
            display: grid;
            grid-template-columns: repeat(4, minmax(0, 1fr));
            gap: 8px;
        }
        .world-designer-sprite-option {
            display: flex;
            flex-direction: column;
            align-items: center;
            gap: 4px;
            padding: 6px;
            min-width: 0;
            text-align: center;
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
        }
        .world-designer-modal-actions {
            display: flex;
            justify-content: flex-end;
            gap: 8px;
            margin-top: 12px;
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
    const paletteCount = Math.max(host.getPaletteCount(), 1);
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
    if (typeof persistedState?.soundEnabled === 'boolean') {
        host.setSoundEnabled(persistedState.soundEnabled);
    }
    const state: DesignerState = {
        active: persistedState?.active ?? false,
        mode: persistedState?.mode === 'preview' ? 'preview' : 'edit',
        tool: persistedState?.tool === 'place' ? 'place' : 'select',
        category: persistedState?.category && persistedState.category in CATEGORY_LABELS ? persistedState.category : 'world',
        rotation: normalizeRotation(persistedState?.rotation),
        palette: clamp(typeof persistedState?.palette === 'number' ? persistedState.palette : 0, 0, paletteCount - 1),
        typeByCategory: restoredTypeByCategory,
        snapToGrid: persistedState?.snapToGrid ?? false,
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
        pickerDrag: null,
        pickerDragCanvas: null,
        savePreviewOpen: false,
        viewportExpanded: false,
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
                            <div class="world-designer-sprite-picker-grid" data-role="sprite-picker-grid"></div>
                        </div>
                    </details>
                </div>
                <label class="world-designer-field">Rotation<select data-role="rotation"></select></label>
                <label class="world-designer-field">Palette<select data-role="palette"></select></label>
            </div>
            <label class="world-designer-checkbox"><input type="checkbox" data-role="snap" /> Snap rough placement to 32px grid</label>
            <label class="world-designer-field">Arrow-key nudge size<input type="number" min="1" max="64" step="1" value="1" data-role="nudge" /></label>
            <div class="world-designer-actions">
                <button type="button" data-role="focus-astronaut">Center on astronaut</button>
                <button type="button" data-role="move-astronaut">Move live astronaut to view center</button>
                <button type="button" data-role="add-center">Place at view center</button>
                <button type="button" data-role="set-start">Set astronaut start to view center</button>
                <button type="button" data-role="duplicate">Duplicate selection</button>
                <button type="button" data-role="delete">Delete selection</button>
                <button type="button" data-role="focus">Focus selection</button>
                <button type="button" data-role="convert">Convert</button>
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
                <li><strong>F</strong> toggle sprite outlines, <strong>G</strong> toggle grid snap, <strong>Ctrl+S</strong> preview before save</li>
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
                <h2 style="margin:0;">Preview before save</h2>
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

    const refs: ControlRefs = {
        root,
        modeSelect: root.querySelector('[data-role="mode"]') as HTMLSelectElement,
        toolSelect: root.querySelector('[data-role="tool"]') as HTMLSelectElement,
        categorySelect: root.querySelector('[data-role="category"]') as HTMLSelectElement,
        typeSelect: root.querySelector('[data-role="type"]') as HTMLSelectElement,
        spritePreviewCanvas: root.querySelector('[data-role="sprite-preview"]') as HTMLCanvasElement,
        spritePreviewMeta: root.querySelector('[data-role="sprite-preview-meta"]') as HTMLDivElement,
        spritePicker: root.querySelector('[data-role="sprite-picker"]') as HTMLDetailsElement,
        spritePickerGrid: root.querySelector('[data-role="sprite-picker-grid"]') as HTMLDivElement,
        rotationSelect: root.querySelector('[data-role="rotation"]') as HTMLSelectElement,
        paletteSelect: root.querySelector('[data-role="palette"]') as HTMLSelectElement,
        snapCheckbox: root.querySelector('[data-role="snap"]') as HTMLInputElement,
        nudgeInput: root.querySelector('[data-role="nudge"]') as HTMLInputElement,
        status: root.querySelector('[data-role="status"]') as HTMLDivElement,
        selectionSummary: root.querySelector('[data-role="selection-summary"]') as HTMLDivElement,
        inspector: root.querySelector('[data-role="inspector"]') as HTMLDivElement,
        overviewCanvas: root.querySelector('[data-role="overview"]') as HTMLCanvasElement,
        activeToggle: root.querySelector('[data-role="active-toggle"]') as HTMLButtonElement,
        savePreviewButton: root.querySelector('[data-role="save-preview"]') as HTMLButtonElement,
        deleteButton: root.querySelector('[data-role="delete"]') as HTMLButtonElement,
        duplicateButton: root.querySelector('[data-role="duplicate"]') as HTMLButtonElement,
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
        disablePreviewCollisionCheckbox: root.querySelector('[data-role="disable-preview-collision"]') as HTMLInputElement,
        layerCheckboxes: {
            world: root.querySelector('[data-layer="world"]') as HTMLInputElement,
            buttons: root.querySelector('[data-layer="buttons"]') as HTMLInputElement,
            doors: root.querySelector('[data-layer="doors"]') as HTMLInputElement,
            creatures: root.querySelector('[data-layer="creatures"]') as HTMLInputElement,
            collectables: root.querySelector('[data-layer="collectables"]') as HTMLInputElement
        },
        modal,
        modalBody: modal.querySelector('[data-role="modal-body"]') as HTMLDivElement,
        modalClose: modal.querySelector('[data-role="modal-close"]') as HTMLButtonElement,
        modalConfirm: modal.querySelector('[data-role="modal-confirm"]') as HTMLButtonElement,
        contextMenu,
        contextMenuBody: contextMenu.querySelector('[data-role="context-menu-body"]') as HTMLDivElement
    };
    const spritePickerButtons = new Map<string, HTMLButtonElement>();
    const dragGhostPadding = 8;
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
                palette: state.palette,
                typeByCategory: deepClone(state.typeByCategory),
                snapToGrid: state.snapToGrid,
                nudgeAmount: state.nudgeAmount,
                showCollisionOverlay: state.showCollisionOverlay,
                disableCollisionInPreview: state.disableCollisionInPreview,
                layerVisibility: deepClone(state.layerVisibility),
                camera: { ...state.camera },
                hasOpenedOnce: state.hasOpenedOnce,
                spritePickerOpen: state.spritePickerOpen,
                viewportExpanded: state.viewportExpanded,
                soundEnabled: host.getSoundEnabled()
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
        refs.rotationSelect.innerHTML = Array.from({ length: 7 }, (_, index) => {
            const value = index + 1;
            return `<option value="${value}">${value}</option>`;
        }).join('');
        refs.paletteSelect.innerHTML = Array.from({ length: paletteCount }, (_, index) => {
            return `<option value="${index}">${index}</option>`;
        }).join('');
    }

    function renderSpritePreviewCanvas(canvas: HTMLCanvasElement, type: string, palette: number, rotation: number) {
        clearPreviewCanvas(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        return host.drawSpritePreview(ctx, type, palette, rotation, false);
    }

    function renderCurrentSpritePreview() {
        const type = getCurrentType();
        const rendered = renderSpritePreviewCanvas(
            refs.spritePreviewCanvas,
            type,
            state.palette,
            state.rotation
        );
        refs.spritePreviewMeta.textContent = rendered
            ? `${type} — palette ${state.palette}, rotation ${state.rotation}`
            : `${type} — preview unavailable`;
    }

    function renderSpritePickerGrid() {
        const currentType = getCurrentType();
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
                        rotation: state.rotation
                    };
                    state.pickerDragCanvas = null;
                    setCurrentType(entry.name);
                    button!.classList.add('dragging');
                    setStatus(`Dragging ${entry.name} onto the world to place it.`, 'neutral');
                });

                spritePickerButtons.set(entry.name, button);
                refs.spritePickerGrid.appendChild(button);
            }

            button.classList.toggle('selected', entry.name === currentType);
            button.classList.toggle('dragging', state.pickerDrag?.type === entry.name);
            const canvas = button.querySelector('canvas');
            if (canvas instanceof HTMLCanvasElement) {
                renderSpritePreviewCanvas(canvas, entry.name, state.palette, 1);
            }
        }
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

    function resolvePlacementPosition(worldX: number, worldY: number) {
        return {
            x: state.snapToGrid ? snapCoordinate(worldX) : Math.round(worldX),
            y: state.snapToGrid ? snapCoordinate(worldY) : Math.round(worldY)
        };
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

    function setSelections(selections: Selection[], primary: Selection | null = selections[0] ?? null) {
        state.selectedItems = selections;
        state.selection = primary;
        if (primary) {
            state.category = primary.category;
            state.rotation = normalizeRotation(primary.entity.rotation);
            state.palette = primary.entity.palette ?? 0;
            state.typeByCategory[primary.category] = primary.entity.type;
        }
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

    function getContextMenuWorldPosition() {
        return state.contextMenu.world;
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

    function addContextMenuPaletteSubmenu(disabled = false) {
        const selection = state.contextMenu.primarySelection;
        const currentPalette = selection && 'palette' in selection.entity && typeof selection.entity.palette === 'number'
            ? selection.entity.palette
            : 0;
        const previewType = selection?.entity.type ?? getCurrentType();
        const previewRotation = selection?.entity.rotation ?? state.rotation;

        const details = document.createElement('details');
        details.className = 'world-designer-context-submenu';
        details.open = false;

        const summary = document.createElement('summary');
        summary.textContent = `Palette (${currentPalette})`;
        if (disabled) {
            summary.style.opacity = '0.45';
            summary.style.cursor = 'default';
        }
        details.appendChild(summary);

        if (!disabled) {
            const body = document.createElement('div');
            body.className = 'world-designer-context-submenu-body';
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
                renderSpritePreviewCanvas(canvas, previewType, palette, normalizeRotation(previewRotation));
                button.appendChild(canvas);

                const label = document.createElement('span');
                label.className = 'world-designer-context-palette-label';
                label.textContent = `Palette ${palette}`;
                button.appendChild(label);

                button.addEventListener('click', () => {
                    closeContextMenu();
                    setPaletteSelection(palette);
                });
                body.appendChild(button);
            }
            details.appendChild(body);
        }

        refs.contextMenuBody.appendChild(details);
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
        addContextMenuAction('Rotate', rotateSelection, selectedItems.length === 0);
        addContextMenuPaletteSubmenu(selectedItems.length === 0);
        addContextMenuAction('Copy', copySelection, selectedItems.length === 0);
        addContextMenuAction('Duplicate', duplicateSelection, selectedItems.length === 0);
        addContextMenuAction('Delete', deleteSelection, selectedItems.length === 0);
        addContextMenuAction('Focus selection', focusSelection, selectedItems.length === 0);

        if (selection.category === 'doors') {
            addContextMenuDivider();
            addContextMenuAction(
                (selection.entity.defaultLocked ?? selection.entity.locked ?? false) ? 'Set unlocked by default' : 'Set locked by default',
                toggleDoorLockedDefault
            );
            addContextMenuAction(
                (selection.entity.defaultOpen ?? selection.entity.open ?? false) ? 'Set closed by default' : 'Set open by default',
                toggleDoorOpenDefault
            );
        } else if (selection.category === 'buttons') {
            addContextMenuDivider();
            addContextMenuAction(
                (selection.entity.defaultActive ?? selection.entity.active ?? false) ? 'Set inactive by default' : 'Set active by default',
                toggleButtonActiveDefault
            );
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

    function placeAtWorld(worldX: number, worldY: number) {
        const { x, y } = resolvePlacementPosition(worldX, worldY);
        const type = getCurrentType();

        if (state.category === 'world') {
            const entity: MapBlock = {
                x,
                y,
                type,
                collision: true,
                palette: state.palette,
                rotation: state.rotation as MapBlock['rotation']
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

        for (const dragItem of state.dragItems) {
            const targetX = state.snapToGrid
                ? snapCoordinate(dragItem.startX + deltaX)
                : dragItem.startX + deltaX;
            const targetY = state.snapToGrid
                ? snapCoordinate(dragItem.startY + deltaY)
                : dragItem.startY + deltaY;
            applyPosition(dragItem.selection.entity, targetX, targetY);
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

        const files = (Object.keys(snapshot) as Array<keyof RawWorldData>).map((key) => {
            const currentJson = stableStringify(snapshot[key]);
            const previousJson = stableStringify(state.lastSavedSnapshot[key]);
            return {
                key,
                label: SAVE_FILE_LABELS[key],
                changed: currentJson !== previousJson,
                json: currentJson
            };
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
        try {
            await host.saveWorldData(snapshot);
            state.lastSavedSnapshot = snapshot;
            if (!astronautStartChanged) {
                host.resetAstronautToPosition(liveAstronautPosition);
            }
            updateDirtyState();
            closeSavePreview();
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

    function openSavePreview() {
        state.savePreviewOpen = true;
        renderSavePreview();
        refs.modal.classList.add('open');
    }

    function closeSavePreview() {
        state.savePreviewOpen = false;
        refs.modal.classList.remove('open');
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
            refs.focusButton.disabled = true;
            return;
        }

        if (selections.length > 1) {
            refs.selectionSummary.textContent = `${selections.length} objects selected. Drag any selected object to move the group.`;
            refs.convertButton.textContent = 'Convert';
            refs.convertButton.disabled = true;
            refs.deleteButton.disabled = false;
            refs.duplicateButton.disabled = false;
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
            addCheckboxInspector(container, 'Collected by default', entity.collected ?? false, (checked) => {
                runMutation('Updated collectable state.', () => {
                    entity.collected = checked;
                });
            });
            addCheckboxInspector(container, 'Storable', entity.storable ?? false, (checked) => {
                runMutation('Updated storable flag.', () => {
                    entity.storable = checked;
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
        refs.paletteSelect.value = String(state.palette);
        refs.snapCheckbox.checked = state.snapToGrid;
        refs.nudgeInput.value = String(state.nudgeAmount);
        refs.showCollisionCheckbox.checked = state.showCollisionOverlay;
        refs.showSpriteOutlineCheckbox.checked = host.getShowSpriteOutlines();
        refs.disablePreviewCollisionCheckbox.checked = state.disableCollisionInPreview;
        refs.disablePreviewCollisionCheckbox.disabled = state.mode !== 'preview';
        refs.spritePicker.open = state.spritePickerOpen;

        for (const [category, checkbox] of Object.entries(refs.layerCheckboxes) as Array<[DesignerCategory, HTMLInputElement]>) {
            checkbox.checked = state.layerVisibility[category];
        }

        setCurrentType(getCurrentType());
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
        updateSelectionSummary();
        refreshInspector();
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
                const source = state.selection!;
                const block = source.entity as MapBlock;
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
                    storable: true,
                    affectsAstronaut: true,
                    collision: block.collision !== false,
                    collected: false,
                    paletteCycle: block.paletteCycle ? deepClone(block.paletteCycle) : undefined
                });
                getCategoryArray('collectables').push(collectable);
                setSelections([{ category: 'collectables', entity: collectable }]);
            });
            return;
        }

        if (state.selection.category === 'collectables') {
            runMutation('Converted collectable to world item.', () => {
                const source = state.selection!;
                const collectable = source.entity;
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
                    collision: collectable.collision !== false,
                    paletteCycle: collectable.paletteCycle ? deepClone(collectable.paletteCycle) : undefined
                };
                getCategoryArray('world').push(block);
                setSelections([{ category: 'world', entity: block }]);
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
        runMutation(`Placed new ${CATEGORY_LABELS[drag.category].toLowerCase()} from the sprite grid.`, () => {
            state.category = drag.category;
            state.typeByCategory[drag.category] = drag.type;
            state.palette = drag.palette;
            state.rotation = drag.rotation;
            const world = screenToWorld(point.x, point.y);
            placeAtWorld(world.x, world.y);
            state.category = previousCategory;
            state.typeByCategory[previousCategory] = previousType;
            state.palette = previousPalette;
            state.rotation = previousRotation;
        });
        updateSelectionFromInspectorState();
    }

    function clearPickerDrag() {
        state.pickerDrag = null;
        state.pickerDragCanvas = null;
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
            runMutation(`Placed new ${CATEGORY_LABELS[state.category].toLowerCase()}.`, () => {
                placeAtWorld(world.x, world.y);
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
        beginDrag(world, dragSelections);
    }

    function handleCanvasMouseMove(event: MouseEvent) {
        if (!state.active || state.mode !== 'edit') return;
        if (state.pickerDrag) {
            state.pickerDragCanvas = isEventOverCanvas(event) ? getCanvasPoint(event) : null;
            return;
        }
        const point = getCanvasPoint(event);
        state.lastPointerCanvas = point;

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

    function handleCanvasMouseUp(event?: MouseEvent) {
        if (state.pickerDrag) {
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

        if (event.key === 'Escape') {
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
            closeSavePreview();
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

    refs.activeToggle.addEventListener('click', () => {
        setDesignerActive(!state.active);
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
    refs.disablePreviewCollisionCheckbox.addEventListener('change', () => {
        state.disableCollisionInPreview = refs.disablePreviewCollisionCheckbox.checked;
    });
    for (const [category, checkbox] of Object.entries(refs.layerCheckboxes) as Array<[DesignerCategory, HTMLInputElement]>) {
        checkbox.addEventListener('change', () => {
            state.layerVisibility[category] = checkbox.checked;
        });
    }
    refs.savePreviewButton.addEventListener('click', openSavePreview);
    refs.deleteButton.addEventListener('click', deleteSelection);
    refs.duplicateButton.addEventListener('click', duplicateSelection);
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
    refs.modalClose.addEventListener('click', closeSavePreview);
    refs.modalConfirm.addEventListener('click', () => {
        void saveFromPreview();
    });
    refs.modal.addEventListener('click', (event) => {
        if (event.target === refs.modal) {
            closeSavePreview();
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
    window.addEventListener('mousemove', handleCanvasMouseMove);
    window.addEventListener('mouseup', handleCanvasMouseUp);
    window.addEventListener('keydown', handleKeyDown);
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

            if (state.pickerDrag && state.pickerDragCanvas) {
                const world = screenToWorld(state.pickerDragCanvas.x, state.pickerDragCanvas.y);
                const placement = resolvePlacementPosition(world.x, world.y);
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
        },
        destroy() {
            setViewportExpanded(false);
            closeContextMenu();
            refs.overviewCanvas.removeEventListener('mousedown', handleOverviewMouseDown);
            refs.overviewCanvas.removeEventListener('mousemove', handleOverviewMouseMove);
            refs.overviewCanvas.removeEventListener('mouseup', handleOverviewMouseUp);
            host.canvas.removeEventListener('mousedown', handleCanvasMouseDown);
            host.canvas.removeEventListener('mousemove', handleCanvasMouseMove);
            window.removeEventListener('mousemove', handleCanvasMouseMove);
            window.removeEventListener('mouseup', handleCanvasMouseUp);
            window.removeEventListener('keydown', handleKeyDown);
            window.removeEventListener('mousedown', handleWindowMouseDown);
            window.removeEventListener('resize', resizeExpandedViewport);
            root.remove();
            modal.remove();
            styles.remove();
        }
    };
}
