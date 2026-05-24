import { Button } from './button.js';
import { Collectable, isGrenadeCollectableType } from './collectable.js';
import { Door } from './door.js';
import { getMapBlocksNearWorldPoint } from './map.js';
import { buildDefaultPaletteCycle, resolveAnimatedPaletteIndex } from './palette-cycle.js';

const spriteRectMapCache = new WeakMap<object, Record<string, any>>();
const transformedSpriteCanvasCache = new WeakMap<object, Map<string, HTMLCanvasElement>>();
const angledSpriteCanvasCache = new WeakMap<object, Map<string, { canvas: HTMLCanvasElement; offsetX: number; offsetY: number }>>();
const transformedSpriteBoundsCache = new WeakMap<object, SpriteVisibleBounds | null>();
const sourceSpriteBoundsCache = new WeakMap<object, Map<string, SpriteVisibleBounds | null>>();

export type SpriteTranslation = 'center' | 'top' | 'right' | 'bottom' | 'left';

type SpriteVisibleBounds = {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
    width: number;
    height: number;
};

export const SPRITE_TRANSLATION_OPTIONS: SpriteTranslation[] = ['center', 'top', 'right', 'bottom', 'left'];

function getSourceSpriteVisibleBounds(
    sheet: CanvasImageSource,
    rect: { x: number; y: number; w: number; h: number }
) {
    if (!sheet || typeof sheet !== 'object') {
        return null;
    }

    const cacheOwner = sheet as object;
    let cache = sourceSpriteBoundsCache.get(cacheOwner);
    if (!cache) {
        cache = new Map<string, SpriteVisibleBounds | null>();
        sourceSpriteBoundsCache.set(cacheOwner, cache);
    }

    const cacheKey = `${rect.x},${rect.y},${rect.w},${rect.h}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey) ?? null;
    }

    const canvas = document.createElement('canvas');
    canvas.width = rect.w;
    canvas.height = rect.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        cache.set(cacheKey, null);
        return null;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(sheet, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
    const bounds = getSpriteVisibleBounds(canvas);
    cache.set(cacheKey, bounds);
    return bounds;
}

export function getVisibleCenterRotationOffset(
    sheet: CanvasImageSource,
    rect: { x: number; y: number; w: number; h: number },
    anchorRotation: number = 1,
    rotation: number = 1
) {
    const normalizedAnchorRotation = typeof anchorRotation === 'number' ? Math.round(anchorRotation) : 1;
    const normalizedRotation = typeof rotation === 'number' ? Math.round(rotation) : 1;
    if (normalizedAnchorRotation === normalizedRotation) {
        return { x: 0, y: 0 };
    }

    const anchorSprite = getTransformedSpriteCanvas(sheet, rect, normalizedAnchorRotation, false);
    const sourceBounds = anchorSprite ? getSpriteVisibleBounds(anchorSprite) : getSourceSpriteVisibleBounds(sheet, rect);
    const transformedSprite = getTransformedSpriteCanvas(sheet, rect, normalizedRotation, false);
    const transformedBounds = getSpriteVisibleBounds(transformedSprite);
    if (!sourceBounds || !transformedBounds) {
        return { x: 0, y: 0 };
    }
    return {
        x: ((sourceBounds.minX + sourceBounds.maxX) - (transformedBounds.minX + transformedBounds.maxX)) / 2,
        y: ((sourceBounds.minY + sourceBounds.maxY) - (transformedBounds.minY + transformedBounds.maxY)) / 2
    };
}

function buildSpriteRectMap(spriteMap: any) {
    if (spriteMap instanceof Array) {
        const rectMap: Record<string, any> = {};
        for (let row = 0; row < spriteMap.length; row++) {
            for (let col = 0; col < spriteMap[row].length; col++) {
                const rect = spriteMap[row][col];
                if (rect?.name) {
                    rectMap[rect.name] = rect;
                }
            }
        }
        return rectMap;
    }
    return spriteMap ?? {};
}

function getSpriteRectMap(spriteMap: any) {
    if (!spriteMap || typeof spriteMap !== 'object') {
        return buildSpriteRectMap(spriteMap);
    }
    const cachedRectMap = spriteRectMapCache.get(spriteMap);
    if (cachedRectMap) {
        return cachedRectMap;
    }
    const rectMap = buildSpriteRectMap(spriteMap);
    spriteRectMapCache.set(spriteMap, rectMap);
    return rectMap;
}

function getSpriteRectByType(spriteMap: any, type: string) {
    const rectMap = getSpriteRectMap(spriteMap);
    return rectMap[type] || null;
}

function applySpriteRotationTransform(ctx: CanvasRenderingContext2D, rotation: number) {
    if (rotation >= 1 && rotation <= 4) {
        ctx.rotate(((rotation - 1) * Math.PI) / 2);
    } else if (rotation === 5) {
        ctx.scale(-1, 1);
    } else if (rotation === 6) {
        ctx.scale(1, -1);
    } else if (rotation === 7) {
        ctx.scale(-1, -1);
    }
}

export function getTransformedSpriteCanvas(
    sheet: CanvasImageSource,
    rect: { x: number; y: number; w: number; h: number },
    rotation: number = 1,
    flipAroundVisibleCenter: boolean = false
) {
    if (!sheet || typeof sheet !== 'object') {
        return null;
    }

    const cacheOwner = sheet as object;
    let cache = transformedSpriteCanvasCache.get(cacheOwner);
    if (!cache) {
        cache = new Map<string, HTMLCanvasElement>();
        transformedSpriteCanvasCache.set(cacheOwner, cache);
    }

    const normalizedRotation = typeof rotation === 'number' ? Math.round(rotation) : 1;
    const cacheKey = `${rect.x},${rect.y},${rect.w},${rect.h},${normalizedRotation},${flipAroundVisibleCenter ? 1 : 0}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const swapDimensions = normalizedRotation === 2 || normalizedRotation === 4;
    const canvas = document.createElement('canvas');
    canvas.width = swapDimensions ? rect.h : rect.w;
    canvas.height = swapDimensions ? rect.w : rect.h;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    applySpriteRotationTransform(ctx, normalizedRotation);
    ctx.drawImage(
        sheet,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        -rect.w / 2,
        -rect.h / 2,
        rect.w,
        rect.h
    );

    cache.set(cacheKey, canvas);
    return canvas;
}

function getAngledSpriteCanvas(
    sheet: CanvasImageSource,
    rect: { x: number; y: number; w: number; h: number },
    angleDegrees: number
) {
    if (!sheet || typeof sheet !== 'object' || !Number.isFinite(angleDegrees)) {
        return null;
    }

    const cacheOwner = sheet as object;
    let cache = angledSpriteCanvasCache.get(cacheOwner);
    if (!cache) {
        cache = new Map<string, { canvas: HTMLCanvasElement; offsetX: number; offsetY: number }>();
        angledSpriteCanvasCache.set(cacheOwner, cache);
    }

    const normalizedAngle = Math.round(angleDegrees);
    const cacheKey = `${rect.x},${rect.y},${rect.w},${rect.h},${normalizedAngle}`;
    const cached = cache.get(cacheKey);
    if (cached) {
        return cached;
    }

    const radians = (normalizedAngle * Math.PI) / 180;
    const cos = Math.cos(radians);
    const sin = Math.sin(radians);
    const canvasWidth = Math.max(1, Math.ceil(Math.abs(rect.w * cos) + Math.abs(rect.h * sin)));
    const canvasHeight = Math.max(1, Math.ceil(Math.abs(rect.w * sin) + Math.abs(rect.h * cos)));
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }

    ctx.imageSmoothingEnabled = false;
    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(radians);
    ctx.drawImage(
        sheet,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        -rect.w / 2,
        -rect.h / 2,
        rect.w,
        rect.h
    );

    const visibleBounds = getSpriteVisibleBounds(canvas);
    if (!visibleBounds) {
        const result = {
            canvas,
            offsetX: (rect.w - canvas.width) / 2,
            offsetY: (rect.h - canvas.height) / 2
        };
        cache.set(cacheKey, result);
        return result;
    }

    const trimmedCanvas = document.createElement('canvas');
    trimmedCanvas.width = visibleBounds.width;
    trimmedCanvas.height = visibleBounds.height;
    const trimmedCtx = trimmedCanvas.getContext('2d');
    if (!trimmedCtx) {
        return null;
    }
    trimmedCtx.imageSmoothingEnabled = false;
    trimmedCtx.drawImage(
        canvas,
        visibleBounds.minX,
        visibleBounds.minY,
        visibleBounds.width,
        visibleBounds.height,
        0,
        0,
        visibleBounds.width,
        visibleBounds.height
    );

    const result = {
        canvas: trimmedCanvas,
        offsetX: (rect.w - canvas.width) / 2 + visibleBounds.minX,
        offsetY: (rect.h - canvas.height) / 2 + visibleBounds.minY
    };
    cache.set(cacheKey, result);
    return result;
}

export function getRenderedEntitySpriteCanvas(
    sheet: CanvasImageSource,
    rect: { x: number; y: number; w: number; h: number },
    entity: {
        cropLeftHalf?: boolean;
        cropRightHalf?: boolean;
        rotation?: number;
        flipAroundVisibleCenter?: boolean;
        angleDegrees?: number;
        creatureProjectile?: { kind?: string };
    }
): { canvas: HTMLCanvasElement; offsetX: number; offsetY: number } | null {
    if (
        !entity.cropLeftHalf &&
        !entity.cropRightHalf &&
        Number.isFinite(entity.angleDegrees) &&
        entity.creatureProjectile?.kind !== 'bullet'
    ) {
        return getAngledSpriteCanvas(sheet, rect, Number(entity.angleDegrees));
    }

    const transformedSprite = getTransformedSpriteCanvas(
        sheet,
        rect,
        entity.rotation ?? 1,
        entity.flipAroundVisibleCenter === true
    );
    if (!transformedSprite) {
        return null;
    }
    if (!entity.cropLeftHalf && !entity.cropRightHalf) {
        return {
            canvas: transformedSprite,
            offsetX: 0,
            offsetY: 0
        };
    }
    const maskSource = document.createElement('canvas');
    maskSource.width = rect.w;
    maskSource.height = rect.h;
    const maskCtx = maskSource.getContext('2d');
    if (!maskCtx) {
        return {
            canvas: transformedSprite,
            offsetX: 0,
            offsetY: 0
        };
    }
    const halfWidth = Math.max(1, Math.floor(rect.w / 2));
    const cropStartX = entity.cropRightHalf
        ? Math.max(0, rect.w - halfWidth)
        : 0;
    maskCtx.fillStyle = '#ffffff';
    maskCtx.fillRect(cropStartX, 0, halfWidth, rect.h);

    const transformedMask = getTransformedSpriteCanvas(
        maskSource,
        { x: 0, y: 0, w: maskSource.width, h: maskSource.height },
        entity.rotation ?? 1
    );
    const bounds = getSpriteVisibleBounds(transformedMask);
    if (!transformedMask || !bounds) {
        return {
            canvas: transformedSprite,
            offsetX: 0,
            offsetY: 0
        };
    }

    const canvas = document.createElement('canvas');
    canvas.width = bounds.width;
    canvas.height = bounds.height;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return null;
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(
        transformedSprite,
        bounds.minX,
        bounds.minY,
        bounds.width,
        bounds.height,
        0,
        0,
        bounds.width,
        bounds.height
    );
    return {
        canvas,
        offsetX: bounds.minX,
        offsetY: bounds.minY
    };
}

export function normalizeSpriteTranslation(translation?: string | null): SpriteTranslation {
    return SPRITE_TRANSLATION_OPTIONS.includes(translation as SpriteTranslation)
        ? translation as SpriteTranslation
        : 'center';
}

export function getSpriteVisibleBounds(sprite: CanvasImageSource | null) {
    if (!sprite || typeof sprite !== 'object') {
        return null;
    }

    const cacheOwner = sprite as object;
    if (transformedSpriteBoundsCache.has(cacheOwner)) {
        return transformedSpriteBoundsCache.get(cacheOwner) ?? null;
    }

    if (!(sprite instanceof HTMLCanvasElement) && !(typeof OffscreenCanvas !== 'undefined' && sprite instanceof OffscreenCanvas)) {
        transformedSpriteBoundsCache.set(cacheOwner, null);
        return null;
    }

    const ctx = sprite.getContext('2d');
    if (!ctx || !('getImageData' in ctx)) {
        transformedSpriteBoundsCache.set(cacheOwner, null);
        return null;
    }

    const imageData = ctx.getImageData(0, 0, sprite.width, sprite.height).data;
    let minX = sprite.width;
    let minY = sprite.height;
    let maxX = -1;
    let maxY = -1;

    for (let y = 0; y < sprite.height; y += 1) {
        for (let x = 0; x < sprite.width; x += 1) {
            if (imageData[(y * sprite.width + x) * 4 + 3] <= 0) continue;
            if (x < minX) minX = x;
            if (y < minY) minY = y;
            if (x > maxX) maxX = x;
            if (y > maxY) maxY = y;
        }
    }

    const bounds = maxX >= minX && maxY >= minY
        ? {
            minX,
            minY,
            maxX,
            maxY,
            width: maxX - minX + 1,
            height: maxY - minY + 1
        }
        : null;
    transformedSpriteBoundsCache.set(cacheOwner, bounds);
    return bounds;
}

export function getSpriteTranslationOffset(
    sprite: CanvasImageSource | null,
    translation?: string | null,
    scaleX: number = 1,
    scaleY: number = scaleX
) {
    const normalizedTranslation = normalizeSpriteTranslation(translation);
    if (normalizedTranslation === 'center' || !sprite || typeof sprite !== 'object') {
        return { x: 0, y: 0 };
    }

    const bounds = getSpriteVisibleBounds(sprite);
    if (!bounds) {
        return { x: 0, y: 0 };
    }

    const width = 'width' in sprite ? Number(sprite.width) : 0;
    const height = 'height' in sprite ? Number(sprite.height) : 0;

    switch (normalizedTranslation) {
        case 'top':
            return { x: 0, y: -bounds.minY * scaleY };
        case 'right':
            return { x: (width - bounds.maxX - 1) * scaleX, y: 0 };
        case 'bottom':
            return { x: 0, y: (height - bounds.maxY - 1) * scaleY };
        case 'left':
            return { x: -bounds.minX * scaleX, y: 0 };
        default:
            return { x: 0, y: 0 };
    }
}

function getEntityRotation(entity: any): number {
    if (typeof entity.rotation !== 'number') {
        return 1;
    }
    return entity.rotation;
}

function isEntitySolid(entity: any): boolean {
    if (entity.collision === false) {
        return false;
    }
    if (entity instanceof Door && entity.open) {
        return false;
    }
    return true;
}

function getEntitySpriteGeometry(
    entity: any,
    rect: { x: number; y: number; w: number; h: number },
    SPRITE_SCALE: number
) {
    const halfWidth = Math.floor(rect.w / 2);
    const cropHalf = entity.cropLeftHalf || entity.cropRightHalf;
    const sourceX = entity.cropRightHalf
        ? rect.x + rect.w - halfWidth
        : rect.x;
    const sourceY = rect.y;
    const sourceW = cropHalf ? halfWidth : rect.w;
    const sourceH = rect.h;
    const drawW = sourceW * SPRITE_SCALE;
    const drawH = sourceH * SPRITE_SCALE;

    return {
        sourceX,
        sourceY,
        sourceW,
        sourceH,
        drawW,
        drawH
    };
}

function isSolidSpritePixelAtWorld(
    x: number,
    y: number,
    entity: any,
    rect: { x: number; y: number; w: number; h: number },
    SPRITE_SCALE: number,
    spriteSheetCtx?: CanvasRenderingContext2D
): boolean {
    const geometry = getEntitySpriteGeometry(entity, rect, SPRITE_SCALE);
    const transformedSprite = spriteSheetCtx
        ? getTransformedSpriteCanvas(
            spriteSheetCtx.canvas,
            {
                x: geometry.sourceX,
                y: geometry.sourceY,
                w: geometry.sourceW,
                h: geometry.sourceH
            },
            getEntityRotation(entity)
        )
        : null;
    const translationOffset = getSpriteTranslationOffset(
        transformedSprite,
        entity.translation,
        SPRITE_SCALE
    );
    const centerX = entity.x + translationOffset.x + geometry.drawW / 2;
    const centerY = entity.y + translationOffset.y + geometry.drawH / 2;

    let localX = x - centerX;
    let localY = y - centerY;
    const rotation = getEntityRotation(entity);

    if (rotation >= 2 && rotation <= 4) {
        const angle = -((rotation - 1) * Math.PI / 2);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotatedX = localX * cos - localY * sin;
        const rotatedY = localX * sin + localY * cos;
        localX = rotatedX;
        localY = rotatedY;
    } else if (rotation === 5) {
        localX = -localX;
    } else if (rotation === 6) {
        localY = -localY;
    } else if (rotation === 7) {
        localX = -localX;
        localY = -localY;
    }

    const drawX = localX + geometry.drawW / 2;
    const drawY = localY + geometry.drawH / 2;
    if (
        drawX < 0 ||
        drawX >= geometry.drawW ||
        drawY < 0 ||
        drawY >= geometry.drawH
    ) {
        return false;
    }

    const pixelX = Math.floor(drawX / SPRITE_SCALE);
    const pixelY = Math.floor(drawY / SPRITE_SCALE);
    if (
        pixelX < 0 ||
        pixelX >= geometry.sourceW ||
        pixelY < 0 ||
        pixelY >= geometry.sourceH
    ) {
        return false;
    }

    if (!spriteSheetCtx) {
        return true;
    }

    const alpha = spriteSheetCtx.getImageData(geometry.sourceX + pixelX, geometry.sourceY + pixelY, 1, 1).data[3];
    return alpha > 0;
}

// After loading the sprite sheet, convert black pixels to transparent
export function makeBlackTransparent(img: HTMLImageElement, callback: (result: HTMLCanvasElement) => void) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(img, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // If pixel is black (0,0,0), set alpha to 0
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
            data[i + 3] = 0;
        }
    }
    tempCtx.putImageData(imageData, 0, 0);
    callback(tempCanvas);
}

// Utility: Check if a pixel in the sprite sheet is transparent
export function isSpritePixelTransparent(
    img: HTMLImageElement,
    spriteRect: { x: number, y: number, w: number, h: number },
    px: number,
    py: number
): Promise<boolean> {
    return new Promise((resolve) => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.drawImage(img, 0, 0);
        const sx = Math.floor(px - spriteRect.x);
        const sy = Math.floor(py - spriteRect.y);
        if (
            sx < 0 || sy < 0 ||
            sx >= spriteRect.w || sy >= spriteRect.h
        ) {
            resolve(true);
            return;
        }
        const imageData = tempCtx.getImageData(spriteRect.x + sx, spriteRect.y + sy, 1, 1).data;
        resolve(imageData[3] === 0);
    });
}

/**
 * Remap the palette of a sprite image.
 * @param img The source image.
 * @param colorMap An array of {from: [r,g,b], to: [r,g,b]} mappings.
 * @returns A new HTMLCanvasElement with remapped colors.
 */
export function remapSpritePalette(
    img: HTMLImageElement,
    colorMap: { from: [number, number, number], to: [number, number, number] }[]
): HTMLCanvasElement {
    // This export function allows for any number of color mappings.
    // Each entry in colorMap will be applied to the image.
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        for (const { from, to } of colorMap) {
            if (
                data[i] === from[0] &&
                data[i + 1] === from[1] &&
                data[i + 2] === from[2]
            ) {
                data[i] = to[0];
                data[i + 1] = to[1];
                data[i + 2] = to[2];
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

// Utility: Get any block at world position (ignores collision)
export function getAnyBlockAtWorld(
    x: number,
    y: number,
    SPRITE_SCALE: number,
    mapBlocks: any[],
    doorEntities: any[],
    buttonEntities: any[],
    creatureEntities: any[]
): any {
    x = Math.round(x);
    y = Math.round(y);
    const mapBlockCandidates = getMapBlocksNearWorldPoint(x, y, SPRITE_SCALE, mapBlocks);
    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    // Check map blocks
    for (const b of mapBlockCandidates) {
        if (
            x >= b.x && x < b.x + tileW &&
            y >= b.y && y < b.y + tileH
        ) {
            return b;
        }
    }
    // Check doors
    for (const d of doorEntities) {
        if (
            x >= d.x && x < d.x + tileW &&
            y >= d.y && y < d.y + tileH
        ) {
            return d;
        }
    }
    // Check buttons
    for (const btn of buttonEntities) {
        const parts = btn instanceof Button ? btn.getCollisionParts() : [btn];
        for (const part of parts) {
            if (
                x >= part.x && x < part.x + tileW &&
                y >= part.y && y < part.y + tileH
            ) {
                return btn;
            }
        }
    }
    // Check creatures
    for (const c of creatureEntities) {
        if (
            x >= c.x && x < c.x + tileW &&
            y >= c.y && y < c.y + tileH
        ) {
            return c;
        }
    }
    return undefined;
}

// Utility: Get any solid block (map, door, button) at world position
export function getSolidBlockAtWorld(
    x: number,
    y: number,
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: any[],
    doorEntities: any[],
    buttonEntities: any[]
): any {
    x = Math.round(x);
    y = Math.round(y);
    const spriteSheetCtx = (window as any)._spriteSheetCtx as CanvasRenderingContext2D | undefined;
    const mapBlockCandidates = getMapBlocksNearWorldPoint(x, y, SPRITE_SCALE, mapBlocks);
    // Check map blocks
    for (const b of mapBlockCandidates) {
        if (!isEntitySolid(b)) {
            continue;
        }
        const rect = getSpriteRectByType(spriteMap, b.type);
        if (rect && isSolidSpritePixelAtWorld(x, y, b, rect, SPRITE_SCALE, spriteSheetCtx)) {
            return b;
        }
    }
    // Check doors
    for (const d of doorEntities) {
        if (!isEntitySolid(d)) {
            continue;
        }
        const rect = getSpriteRectByType(spriteMap, d.type);
        if (rect && isSolidSpritePixelAtWorld(x, y, d, rect, SPRITE_SCALE, spriteSheetCtx)) {
            return d;
        }
    }
    // Check buttons (treat as solid)
    for (const btn of buttonEntities) {
        if (!isEntitySolid(btn)) {
            continue;
        }
        const parts = btn instanceof Button ? btn.getCollisionParts() : [btn];
        for (const part of parts) {
            if (!isEntitySolid(part)) {
                continue;
            }
            const rect = getSpriteRectByType(spriteMap, part.type);
            if (rect && isSolidSpritePixelAtWorld(x, y, part, rect, SPRITE_SCALE, spriteSheetCtx)) {
                return btn;
            }
        }
    }
    return undefined;
}

// --- After all assets are loaded, calculate tightest collision bounding boxes ---
export async function calculateSpriteCollisionBoundingBoxes(
    spriteSheet: HTMLImageElement,
    spriteMap: any,
    mapBlocks: any[],
    doorEntities: any[],
    buttonEntities: any[],
    creatureEntities: any[] = [],
    collectableEntities: any[] = []
) {
    // Gather all entities with collision = true
    const allEntities = [
        ...mapBlocks.filter(b => b.collision === true),
        ...doorEntities.filter(d => d.collision === true),
        ...buttonEntities.filter(b => b.collision === true),
        ...creatureEntities.filter(c => c.collision === true),
        ...collectableEntities.filter(c => c.collision === true)
    ];
    // Find all unique sprite types with collision = true
    const typesWithCollision = new Set(allEntities.map(e => e.type));
    const boundingBoxes: Record<string, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }> = {};

    // Helper to check if a pixel is transparent in the sprite sheet
    function isPixelTransparent(imgData: Uint8ClampedArray, imgW: number, x: number, y: number): boolean {
        const idx = (y * imgW + x) * 4;
        return imgData[idx + 3] === 0;
    }

    // Get image data once for efficiency
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = spriteSheet.width;
    tempCanvas.height = spriteSheet.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(spriteSheet, 0, 0);
    const imgData = tempCtx.getImageData(0, 0, spriteSheet.width, spriteSheet.height).data;

    for (const type of typesWithCollision) {
        // Find the sprite rect for this type
        let rect = null;
        if (spriteMap instanceof Array) {
            outer: for (let row = 0; row < spriteMap.length; row++) {
                for (let col = 0; col < spriteMap[row].length; col++) {
                    if (spriteMap[row][col].name === type) {
                        rect = spriteMap[row][col];
                        break outer;
                    }
                }
            }
        } else if (spriteMap[type]) {
            rect = spriteMap[type];
        }
        if (!rect) continue;

        let minX = rect.w, minY = rect.h, maxX = -1, maxY = -1;
        for (let y = 0; y < rect.h; y++) {
            for (let x = 0; x < rect.w; x++) {
                const sx = rect.x + x;
                const sy = rect.y + y;
                if (!isPixelTransparent(imgData, spriteSheet.width, sx, sy)) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX >= minX && maxY >= minY) {
            boundingBoxes[type] = {
                minX, minY, maxX, maxY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            };
        }
    }
    console.log("Tightest collision bounding boxes for sprites with collision=true (map, doors, buttons):", boundingBoxes);

    // --- Calculate and store world coordinate bounding boxes ---
    // Use SPRITE_SCALE for all world bounding box calculations
    const { SPRITE_SCALE } = await import('./constants.js');
    const worldBoundingBoxes: Record<string, any[]> = {};
    for (const entity of allEntities) {
        const type = entity.type;
        const box = boundingBoxes[type];
        let rect = null;
        if (spriteMap instanceof Array) {
            outer: for (let row = 0; row < spriteMap.length; row++) {
                for (let col = 0; col < spriteMap[row].length; col++) {
                    if (spriteMap[row][col].name === type) {
                        rect = spriteMap[row][col];
                        break outer;
                    }
                }
            }
        } else if (spriteMap[type]) {
            rect = spriteMap[type];
        }
        if (!box || !rect) continue;
        const scale = SPRITE_SCALE;
        const tileW = 32 * scale;
        const tileH = 32 * scale;
        // Center of the sprite in world coordinates
        const cx = entity.x + tileW / 2;
        const cy = entity.y + tileH / 2;
        // Corners relative to sprite center
        let corners = [
            { x: -tileW / 2 + box.minX * scale, y: -tileH / 2 + box.minY * scale },
            { x: -tileW / 2 + box.maxX * scale, y: -tileH / 2 + box.minY * scale },
            { x: -tileW / 2 + box.maxX * scale, y: -tileH / 2 + box.maxY * scale },
            { x: -tileW / 2 + box.minX * scale, y: -tileH / 2 + box.maxY * scale }
        ];
        // Apply rotation/flip
        let rot = entity.rotation || 0;
        corners = corners.map(pt => {
            let { x, y } = pt;
            if (rot >= 1 && rot <= 4) {
                const angle = ((rot - 1) * Math.PI) / 2;
                const cos = Math.cos(angle);
                const sin = Math.sin(angle);
                const nx = x * cos - y * sin;
                const ny = x * sin + y * cos;
                x = nx; y = ny;
            } else if (rot === 5) {
                x = -x;
            } else if (rot === 6) {
                y = -y;
            } else if (rot === 7) {
                x = -x; y = -y;
            }
            // Translate to world
            return { x: cx + x, y: cy + y };
        });
        const xs = corners.map(pt => pt.x);
        const ys = corners.map(pt => pt.y);
        const worldMinX = Math.round(Math.min(...xs));
        const worldMinY = Math.round(Math.min(...ys));
        const worldMaxX = Math.round(Math.max(...xs));
        const worldMaxY = Math.round(Math.max(...ys));
        const width = worldMaxX - worldMinX + 1;
        const height = worldMaxY - worldMinY + 1;
        const worldBox = {
            entityId: entity.entityId, // always use entity.entityId
            type,
            worldMinX,
            worldMinY,
            worldMaxX,
            worldMaxY,
            width,
            height
        };
        if (!worldBoundingBoxes[type]) worldBoundingBoxes[type] = [];
        worldBoundingBoxes[type].push(worldBox);
    }
    // Store globally
    (window as any).spriteWorldBoundingBoxes = worldBoundingBoxes;
    console.log("World coordinate bounding boxes for sprites with collision=true (map, doors, buttons):", worldBoundingBoxes);
    return boundingBoxes;
}

// --- Calculate tightest bounding boxes for astronaut sprites by name ---
export async function calculateAstronautSpriteBoundingBoxes(
    spriteSheet: HTMLImageElement,
    spriteMap: any
) {
    // List of astronaut sprite names to check
    const astronautSpriteNames = [
        "fly_right",
        "fly_diagonal",
        "fly_float",
        "fly_down",
        "stand",
        "walk_right1",
        "walk_right2",
        "walk_right3"
    ];
    const boundingBoxes: Record<string, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }> = {};

    // Helper to check if a pixel is transparent in the sprite sheet
    function isPixelTransparent(imgData: Uint8ClampedArray, imgW: number, x: number, y: number): boolean {
        const idx = (y * imgW + x) * 4;
        return imgData[idx + 3] === 0;
    }

    // Get image data once for efficiency
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = spriteSheet.width;
    tempCanvas.height = spriteSheet.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(spriteSheet, 0, 0);
    const imgData = tempCtx.getImageData(0, 0, spriteSheet.width, spriteSheet.height).data;

    for (const name of astronautSpriteNames) {
        // Find the sprite rect for this name
        let rect = null;
        if (spriteMap instanceof Array) {
            outer: for (let row = 0; row < spriteMap.length; row++) {
                for (let col = 0; col < spriteMap[row].length; col++) {
                    if (spriteMap[row][col].name === name) {
                        rect = spriteMap[row][col];
                        break outer;
                    }
                }
            }
        } else if (spriteMap[name]) {
            rect = spriteMap[name];
        }
        if (!rect) continue;

        let minX = rect.w, minY = rect.h, maxX = -1, maxY = -1;
        for (let y = 0; y < rect.h; y++) {
            for (let x = 0; x < rect.w; x++) {
                const sx = rect.x + x;
                const sy = rect.y + y;
                if (!isPixelTransparent(imgData, spriteSheet.width, sx, sy)) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX >= minX && maxY >= minY) {
            boundingBoxes[name] = {
                minX, minY, maxX, maxY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            };
        }
    }
    console.log("Tightest collision bounding boxes for astronaut sprites:", boundingBoxes);

    // --- Calculate and store world coordinate bounding boxes for astronauts ---
    // This function does not have entity positions, so just store the bounding boxes at (0,0) for each sprite name
    const worldBoundingBoxes: Record<string, any> = {};
    for (const name of astronautSpriteNames) {
        const box = boundingBoxes[name];
        if (!box) continue;
        worldBoundingBoxes[name] = {
            worldMinX: box.minX,
            worldMinY: box.minY,
            worldMaxX: box.maxX,
            worldMaxY: box.maxY,
            width: box.width,
            height: box.height
        };
    }
    (window as any).astronautWorldBoundingBoxes = worldBoundingBoxes;
    console.log("World coordinate bounding boxes for astronaut sprites:", worldBoundingBoxes);
    return boundingBoxes;
}

// --- Draw generic entity array (same as drawMap but for any array) ---
export function drawEntities(
    ctx: CanvasRenderingContext2D,
    camera: { x: number, y: number },
    spriteMap: any,
    spriteSheets: CanvasImageSource[],
    SPRITE_SCALE: number,
    entities: any[],
    now?: number
) {
    const rectMap = getSpriteRectMap(spriteMap);

    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const minX = camera.x - tileW, maxX = camera.x + ctx.canvas.width + tileW;
    const minY = camera.y - tileH, maxY = camera.y + ctx.canvas.height + tileH;

    for (const entity of entities) {
        const renderParts = entity instanceof Button ? entity.getRenderParts() : [entity];

        for (const renderPart of renderParts) {
            const renderEntity = entity instanceof Collectable && entity.creatureProjectile?.kind === 'bullet'
                ? { ...renderPart, angleDegrees: undefined }
                : renderPart;
            const rect = rectMap[renderPart.type];
            if (!rect) continue;

            let paletteIdx = 0;
            let paletteDebug = "";
            // Use instanceof Door to check for Door entities
            if (entity instanceof Door) {
                if (entity.locked === true && typeof entity.palette_locked === "number") {
                    paletteIdx = entity.palette_locked;
                    paletteDebug = `DOOR locked: true, using palette_locked (${paletteIdx})`;
                } else if (entity.locked === false && typeof entity.palette_unlocked === "number") {
                    paletteIdx = entity.palette_unlocked;
                    paletteDebug = `DOOR locked: false, using palette_unlocked (${paletteIdx})`;
                } else if (typeof renderPart.palette === "number") {
                    paletteIdx = renderPart.palette;
                    paletteDebug = `DOOR fallback, using palette (${paletteIdx})`;
                }
            } else if (typeof renderPart.palette === "number" && renderPart.palette >= 0 && renderPart.palette < spriteSheets.length) {
                paletteIdx = renderPart.palette;
            }
            const animatedPaletteCycle = entity instanceof Button && renderPart.type !== entity.type
                ? undefined
                : entity instanceof Collectable && isGrenadeCollectableType(entity.type)
                    ? (entity.armed
                        ? (entity.paletteCycle ?? buildDefaultPaletteCycle(entity.palette ?? paletteIdx, spriteSheets.length))
                        : undefined)
                    : entity.paletteCycle;
            paletteIdx = resolveAnimatedPaletteIndex(
                renderPart.type,
                animatedPaletteCycle,
                paletteIdx,
                spriteSheets.length,
                now
            );
            const sheet = spriteSheets[paletteIdx] || spriteSheets[0];
            const renderedSprite = getRenderedEntitySpriteCanvas(sheet, rect, renderEntity);
            if (!renderedSprite) continue;
            const translationOffset = entity instanceof Button
                ? { x: 0, y: 0 }
                : getSpriteTranslationOffset(
                    renderedSprite.canvas,
                    normalizeSpriteTranslation(renderEntity.translation),
                    SPRITE_SCALE
                );
            const authoredRotation = typeof entity.state?.authoredRotation === 'number'
                ? Math.round(Number(entity.state.authoredRotation))
                : (typeof renderEntity.rotation === 'number' ? Math.round(renderEntity.rotation) : 1);
            const visibleCenterFlipOffset = entity.flipAroundVisibleCenter === true
                ? getVisibleCenterRotationOffset(sheet, rect, authoredRotation, renderEntity.rotation)
                : { x: 0, y: 0 };
            const drawX = renderPart.x
                + renderedSprite.offsetX * SPRITE_SCALE
                + translationOffset.x
                + visibleCenterFlipOffset.x * SPRITE_SCALE;
            const drawY = renderPart.y
                + renderedSprite.offsetY * SPRITE_SCALE
                + translationOffset.y
                + visibleCenterFlipOffset.y * SPRITE_SCALE;
            const drawW = renderedSprite.canvas.width * SPRITE_SCALE;
            const drawH = renderedSprite.canvas.height * SPRITE_SCALE;
            if (
                drawX + drawW < minX || drawX > maxX ||
                drawY + drawH < minY || drawY > maxY
            ) continue;

            // --- DEBUG: Draw palette info above door ---
            if (
                entity instanceof Door &&
                ctx && ctx.canvas && (window as any).DEBUG_DOOR_PALETTE
            ) {
                ctx.save();
                ctx.font = "12px monospace";
                ctx.fillStyle = "#f0f";
                ctx.fillText(
                    `locked:${entity.locked} paletteIdx:${paletteIdx}`,
                    entity.x - camera.x,
                    entity.y - camera.y - 8
                );
                ctx.fillStyle = "#0ff";
                ctx.fillText(
                    paletteDebug,
                    entity.x - camera.x,
                    entity.y - camera.y - 20
                );
                ctx.restore();
            }

            ctx.drawImage(
                renderedSprite.canvas,
                drawX - camera.x,
                drawY - camera.y,
                drawW,
                drawH
            );
        }
    }
}
