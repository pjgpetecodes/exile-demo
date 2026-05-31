import { normalizeSpriteTranslation } from '../../shared/utilities.js';

import type {
    DesignerCategory,
    LayerVisibility,
    Rect,
    RuntimeDesignerCategory
} from './world-designer-types.js';
import type { Position, TeleporterDestinationMode } from '../../types/index.js';

export function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

export function normalizeRotation(rotation?: number) {
    if (typeof rotation !== 'number' || Number.isNaN(rotation)) {
        return 1;
    }
    return clamp(Math.round(rotation), 1, 9);
}

export function formatSpriteTranslation(translation?: string | null) {
    const normalized = normalizeSpriteTranslation(translation);
    return normalized.charAt(0).toUpperCase() + normalized.slice(1);
}

export function categorySupportsTranslation(category: DesignerCategory) {
    return category === 'world' || category === 'creatures' || category === 'doors';
}

export function getDefaultType(spriteTypes: string[], category: RuntimeDesignerCategory) {
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

export function isDoorSpriteType(type: string): type is 'door_horizontal' | 'door_vertical' {
    return type === 'door_horizontal' || type === 'door_vertical';
}

export function isTeleporterMode(value: unknown): value is TeleporterDestinationMode {
    return value === 'toggle' ||
        value === 'destination_a' ||
        value === 'destination_b' ||
        value === 'toggle_enabled' ||
        value === 'enable' ||
        value === 'disable';
}

export function getDoorTypeFromSourceType(type: string): 'door_horizontal' | 'door_vertical' | null {
    if (isDoorSpriteType(type)) {
        return type;
    }
    if (type === 'wall_left_quarter') {
        return 'door_vertical';
    }
    return null;
}

export function buildLayerVisibility(): LayerVisibility {
    return {
        world: true,
        buttons: true,
        doors: true,
        creatures: true,
        collectables: true,
        custom: true
    };
}

export function normalizeRect(start: Position, end: Position): Rect {
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

export function rectsIntersect(
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

export function applyPosition(entity: { x: number; y: number }, x: number, y: number) {
    entity.x = Math.round(x);
    entity.y = Math.round(y);
}

export function snapCoordinate(value: number) {
    return Math.round(value / 32) * 32;
}

export function getPngImportSourceTileCount(size: number, sourceTileSize: number) {
    return Math.max(1, Math.round(size / sourceTileSize));
}

export function getSuggestedPngImportWorldSpan(sourceSize: number, sourceTileSize: number, worldTileSize: number) {
    return Math.max(1, Math.round(getPngImportSourceTileCount(sourceSize, sourceTileSize) * worldTileSize));
}

export function getPngImportWorldSpanFromTileCount(tileCount: number, worldTileSize: number) {
    return Math.max(1, Math.round(tileCount * worldTileSize));
}

export function normalizeSnapOffset(value: number) {
    const rounded = Math.round(value);
    return ((rounded % 32) + 32) % 32;
}

export function snapCoordinateToOffset(value: number, offset: number) {
    return Math.round((value - offset) / 32) * 32 + offset;
}

export function getRangeGap(startA: number, endA: number, startB: number, endB: number) {
    if (endA < startB) {
        return startB - endA;
    }
    if (endB < startA) {
        return startA - endB;
    }
    return 0;
}

export function getGuideSpan(startA: number, endA: number, startB: number, endB: number) {
    const start = Math.max(startA, startB);
    const end = Math.min(endA, endB);
    if (end >= start) {
        return { start, end };
    }
    const midpoint = (Math.max(startA, startB) + Math.min(endA, endB)) / 2;
    return { start: midpoint, end: midpoint };
}

export function yieldToUi() {
    return new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve());
    });
}

export function clearPreviewCanvas(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return;
    }
    ctx.clearRect(0, 0, canvas.width, canvas.height);
}
