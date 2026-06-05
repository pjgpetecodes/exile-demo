import { assignEntityId } from '../game/runtime/game-entity-id.js';
import {
    DEFAULT_MAP_HEIGHT,
    DEFAULT_MAP_WIDTH,
    SPRITE_SCALE as DEFAULT_SPRITE_SCALE,
    setMapBounds
} from '../config/constants.js';
import type { DestructionSourceRequirement } from '../entities/destructibles.js';
import { resolveAnimatedPaletteIndex } from './palette-cycle.js';
import { PaletteCycleSettings, Position, WindEmitterMode } from '../types/index.js';
import {
    getSpriteTranslationOffset,
    getSpriteVisibleBounds,
    getTransformedSpriteCanvas,
    normalizeSpriteTranslation,
    SpriteTranslation
} from '../shared/utilities.js';
import { normalizeWaterBlock } from './water-blocks.js';
import {
    getMushroomPatternKey,
    hashStringToSeed,
    isMushroomType,
    MUSHROOM_PATTERN_COLORS,
    nextSeed
} from './map/mushroom-pattern.js';

export type MapBlock = {
    x: number; // tile x
    y: number; // tile y
    type: string; // allow any block type, not just 'floor_grass' | 'floor_plain_half'
    collision: boolean;
    maskAstronaut?: boolean;
    palette?: string | number;
    paletteCycle?: PaletteCycleSettings;
    rotation?: 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9;
    translation?: SpriteTranslation;
    teleporterId?: string;
    teleporterEnabled?: boolean;
    teleporterRequiresKey?: boolean;
    teleporterDestinationA?: Position;
    teleporterDestinationB?: Position | null;
    teleporterActiveDestinationIndex?: 0 | 1;
    destructible?: boolean;
    destructionHealth?: number;
    destructionSource?: DestructionSourceRequirement;
    windEnabled?: boolean;
    windDirectionDegrees?: number;
    windStrength?: number;
    windRadius?: number;
    windMode?: WindEmitterMode;
    windVariabilityHz?: number;
    windVariabilityAmount?: number;
    windAffectsAstronaut?: boolean;
    windAffectsLooseObjects?: boolean;
    windShowParticles?: boolean;
    water?: boolean;
    waterOnly?: boolean;
    archetype?: string;
};

export let mapBlocks: MapBlock[] = [];
export let mapLoaded = false;
let mapBlocksRevision = 0;

type BlockBucketMap = Map<string, MapBlock[]>;

const MAP_BLOCK_TILE_SIZE = 32 * DEFAULT_SPRITE_SCALE;
// --- Render/collision cache views derived from mapBlocks ---
let mapBlocksWithoutBlackBackground: MapBlock[] = [];
let mapBlocksBehindAstronaut: MapBlock[] = [];
let mapBlocksBehindAstronautWithoutBlackBackground: MapBlock[] = [];
let mapBlocksMaskAstronaut: MapBlock[] = [];
let blackBackgroundBlocks: MapBlock[] = [];
let mushroomBlocks: MapBlock[] = [];
let mapWaterCellKeys = new Set<string>();
let allMapBlockBuckets: BlockBucketMap = new Map();
let mapBlocksWithoutBlackBackgroundBuckets: BlockBucketMap = new Map();
let mapBlocksBehindAstronautBuckets: BlockBucketMap = new Map();
let mapBlocksBehindAstronautWithoutBlackBackgroundBuckets: BlockBucketMap = new Map();
let mapBlocksMaskAstronautBuckets: BlockBucketMap = new Map();
let blackBackgroundBlockBuckets: BlockBucketMap = new Map();
let mapBlockPositionLookup = new Map<string, MapBlock>();
const spriteRectMapCache = new WeakMap<object, Record<string, any>>();
const mushroomTransparentPixelCache = new Map<string, MushroomPixelPoint[]>();
const mushroomSporeFrameCache = new Map<string, { frameIndex: number; canvas: HTMLCanvasElement }>();
const spriteAlphaMaskCache = new WeakMap<HTMLCanvasElement, Uint8Array>();
const mapBlockChunkKeyLookup = new WeakMap<MapBlock, string>();
const CHUNK_CACHE_MAX_RESIDENCY = 48;
const DEFAULT_CHUNK_WORLD_SIZE = 2048;
const MUSHROOM_SPORE_FRAME_MS = 150;
const MUSHROOM_SPORES_PER_FRAME = 10;
const MUSHROOM_SIDE_SPILL_PIXELS_PER_FRAME = 4;
const WATER_FILL_COLOR_ALIAS = 'Blue';
const WATER_SURFACE_COLOR_ALIAS = 'Cyan';
const FIRE_ARCHETYPE = 'fire';
const FIRE_PRIMARY_PALETTE = 38;
const FIRE_SECONDARY_PALETTE = 39;
const FIRE_MAX_EMBERS_PER_BLOCK = 6;
const FIRE_BOB_X_PIXELS = 2.4;
const FIRE_BOB_Y_PIXELS = 2.8;
const FIRE_ROTATION_DEGREES = 6;
const FIRE_MIN_ROTATION_BIAS_DEGREES = 1.2;
const FIRE_EMBER_STEP_MS = 70;
const FIRE_EMBER_LIFETIME_STEPS = 12;
const FIRE_EMBER_ALPHA_FALLOFF = 1.2;
const FIRE_GLOBAL_EMBER_BUDGET_PER_FRAME = 96;

function toWaterGridCoordinate(value: number) {
    return Math.round(value / MAP_BLOCK_TILE_SIZE);
}

function toWaterGridKey(x: number, y: number) {
    return `${toWaterGridCoordinate(x)}:${toWaterGridCoordinate(y)}`;
}

type MushroomPixelPoint = {
    x: number;
    y: number;
};

type MushroomSpillSide = 'left' | 'right';
type FireFrameStats = {
    visibleFireBlocks: number;
    renderedEmbers: number;
    emberBudget: number;
};
let lastFireFrameStats: FireFrameStats = {
    visibleFireBlocks: 0,
    renderedEmbers: 0,
    emberBudget: FIRE_GLOBAL_EMBER_BUDGET_PER_FRAME
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function normalizeArchetype(value: unknown) {
    return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function isFireArchetype(block: Pick<MapBlock, 'archetype'>) {
    return normalizeArchetype(block.archetype) === FIRE_ARCHETYPE;
}

function getBlockEffectSeed(block: Pick<MapBlock, 'x' | 'y' | 'type' | 'rotation'>, suffix: string) {
    return hashStringToSeed(`${block.type}:${block.x}:${block.y}:${block.rotation ?? 1}:${suffix}`);
}

export function resolveFirePaletteIndex(
    basePalette: number,
    paletteCount: number,
    now: number,
    seed: number
) {
    const normalizedPaletteCount = Math.max(1, Math.floor(paletteCount));
    const fallbackPalette = clamp(Math.round(basePalette), 0, normalizedPaletteCount - 1);
    const preferredPalettes = [FIRE_PRIMARY_PALETTE, FIRE_SECONDARY_PALETTE]
        .filter((palette) => palette >= 0 && palette < normalizedPaletteCount);
    if (preferredPalettes.length === 0) {
        return fallbackPalette;
    }
    if (preferredPalettes.length === 1) {
        return preferredPalettes[0];
    }

    const phase = now / 93 + (seed % 1021) * 0.013;
    const irregularSignal =
        Math.sin(phase) +
        0.42 * Math.sin(phase * 2.27 + 1.19) +
        0.18 * Math.sin(phase * 5.11 + 2.41);
    return irregularSignal > 0.1
        ? preferredPalettes[1]
        : preferredPalettes[0];
}

export function resolveFireMotion(now: number, seed: number) {
    const phase = now / 215 + (seed % 7919) * 0.0008;
    const offsetX =
        (Math.sin(phase) + 0.35 * Math.sin(phase * 1.91 + 1.4)) * FIRE_BOB_X_PIXELS;
    const offsetY =
        (Math.sin(phase * 1.43 + 2.1) + 0.24 * Math.sin(phase * 3.17 + 0.35)) * FIRE_BOB_Y_PIXELS;
    const rotationDegrees =
        (Math.sin(phase * 1.21 + 0.8) + 0.28 * Math.sin(phase * 2.37 + 2.3)) * FIRE_ROTATION_DEGREES;
    const minBias = FIRE_MIN_ROTATION_BIAS_DEGREES;
    const biasedRotationDegrees = rotationDegrees >= 0
        ? Math.max(minBias, rotationDegrees)
        : Math.min(-minBias, rotationDegrees);
    return {
        offsetX,
        offsetY,
        rotationRadians: (biasedRotationDegrees * Math.PI) / 180
    };
}

export function resolveFireGlobalEmberBudget() {
    return FIRE_GLOBAL_EMBER_BUDGET_PER_FRAME;
}

export function getLastFireFrameStats() {
    return { ...lastFireFrameStats };
}

function drawFireEmbers(
    ctx: CanvasRenderingContext2D,
    block: Pick<MapBlock, 'x' | 'y' | 'type' | 'rotation'>,
    now: number,
    tileW: number,
    tileH: number,
    drawLeft: number,
    drawTop: number,
    maxToDraw: number
) {
    if (maxToDraw <= 0) {
        return 0;
    }
    const emberSeed = getBlockEffectSeed(block, 'embers');
    const step = Math.floor(Math.max(0, now) / FIRE_EMBER_STEP_MS);
    const worldPixelSize = Math.max(1, Math.round(Math.min(tileW, tileH) / 32));
    const maxRise = tileH;
    const startY = drawTop + tileH * 0.7;
    let drawnCount = 0;

    for (let index = 0; index < FIRE_MAX_EMBERS_PER_BLOCK; index += 1) {
        if (drawnCount >= maxToDraw) {
            break;
        }
        const slotSeed = hashStringToSeed(`${emberSeed}:${index}`);
        const slotStep = step + (slotSeed % FIRE_EMBER_LIFETIME_STEPS);
        const ageStep = slotStep % FIRE_EMBER_LIFETIME_STEPS;
        const lifeRatio = ageStep / FIRE_EMBER_LIFETIME_STEPS;
        const rise = lifeRatio * maxRise;
        const y = startY - rise;
        if (y < drawTop - 1) {
            continue;
        }

        const swayPhase = slotStep * 0.38 + (slotSeed % 1000) * 0.006;
        const x =
            drawLeft + tileW * 0.5 +
            Math.sin(swayPhase) * (tileW * 0.12) +
            Math.sin(swayPhase * 1.7 + 1.2) * (tileW * 0.05);
        const alpha = Math.max(0, 1 - Math.pow(lifeRatio, FIRE_EMBER_ALPHA_FALLOFF));
        if (alpha <= 0.02) {
            continue;
        }

        ctx.save();
        ctx.globalAlpha = alpha;
        ctx.fillStyle = ageStep % 2 === 0 ? '#f8eb40' : '#ffffff';
        ctx.fillRect(Math.round(x), Math.round(y), worldPixelSize, worldPixelSize);
        ctx.restore();
        drawnCount += 1;
    }
    return drawnCount;
}

function getTransparentMushroomPixels(sourceCanvas: HTMLCanvasElement, key: string) {
    const cached = mushroomTransparentPixelCache.get(key);
    if (cached) {
        return cached;
    }

    const context = sourceCanvas.getContext('2d');
    if (!context) {
        return [];
    }
    const imageData = context.getImageData(0, 0, sourceCanvas.width, sourceCanvas.height);
    const transparentPixels: MushroomPixelPoint[] = [];
    const lowerHalfStartY = Math.floor(sourceCanvas.height / 2);
    for (let y = 0; y < sourceCanvas.height; y += 1) {
        if (y < lowerHalfStartY) {
            continue;
        }
        for (let x = 0; x < sourceCanvas.width; x += 1) {
            const alpha = imageData.data[(y * sourceCanvas.width + x) * 4 + 3];
            if (alpha === 0) {
                transparentPixels.push({ x, y });
            }
        }
    }

    mushroomTransparentPixelCache.set(key, transparentPixels);
    return transparentPixels;
}

function getMushroomPatternCanvas(block: MapBlock, spriteCanvas: HTMLCanvasElement, now: number) {
    const key = getMushroomPatternKey(block);
    const frameIndex = Math.floor(Math.max(0, now) / MUSHROOM_SPORE_FRAME_MS);
    const cached = mushroomSporeFrameCache.get(key);
    if (cached && cached.frameIndex === frameIndex) {
        return cached.canvas;
    }

    const canvas = document.createElement('canvas');
    canvas.width = spriteCanvas.width;
    canvas.height = spriteCanvas.height;
    const context = canvas.getContext('2d');
    if (!context) {
        return null;
    }

    const transparentPixels = getTransparentMushroomPixels(
        spriteCanvas,
        `${block.type}:${block.rotation ?? 1}:${spriteCanvas.width}x${spriteCanvas.height}`
    );
    if (transparentPixels.length === 0) {
        mushroomSporeFrameCache.set(key, { frameIndex, canvas });
        return canvas;
    }

    let seed = hashStringToSeed(`${key}:${frameIndex}`);
    const usedIndexes = new Set<number>();
    const flashes = Math.min(MUSHROOM_SPORES_PER_FRAME, transparentPixels.length);
    for (let count = 0; count < flashes; count += 1) {
        let pixelIndex = -1;
        for (let attempt = 0; attempt < 6; attempt += 1) {
            seed = nextSeed(seed);
            const candidate = seed % transparentPixels.length;
            if (!usedIndexes.has(candidate)) {
                pixelIndex = candidate;
                break;
            }
        }
        if (pixelIndex < 0) {
            continue;
        }
        usedIndexes.add(pixelIndex);
        const point = transparentPixels[pixelIndex];
        seed = nextSeed(seed);
        context.fillStyle = MUSHROOM_PATTERN_COLORS[seed % MUSHROOM_PATTERN_COLORS.length];
        context.fillRect(point.x, point.y, 1, 1);
    }

    mushroomSporeFrameCache.set(key, { frameIndex, canvas });
    return canvas;
}

function getMapBlockPositionKey(x: number, y: number) {
    // Fixed precision avoids lookup misses caused by tiny floating-point drift.
    return `${x.toFixed(3)}:${y.toFixed(3)}`;
}

function getMapBlockAtPosition(x: number, y: number) {
    return mapBlockPositionLookup.get(getMapBlockPositionKey(x, y));
}

function getSpriteAlphaMask(sourceCanvas: HTMLCanvasElement) {
    const cached = spriteAlphaMaskCache.get(sourceCanvas);
    if (cached) {
        return cached;
    }
    const context = sourceCanvas.getContext('2d');
    if (!context) {
        return null;
    }
    const width = sourceCanvas.width;
    const height = sourceCanvas.height;
    const imageData = context.getImageData(0, 0, width, height);
    const mask = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) {
        for (let x = 0; x < width; x += 1) {
            const alpha = imageData.data[(y * width + x) * 4 + 3];
            mask[y * width + x] = alpha > 0 ? 1 : 0;
        }
    }
    spriteAlphaMaskCache.set(sourceCanvas, mask);
    return mask;
}

// Resolve the final sprite canvas after palette animation + authored rotation.
function getMapBlockSpriteCanvas(
    block: MapBlock,
    rectMap: Record<string, any>,
    spriteSheets: CanvasImageSource[],
    now?: number
) {
    const rect = rectMap[block.type];
    if (!rect) {
        return null;
    }
    const basePalette = typeof block.palette === "number" ? block.palette : 0;
    const paletteIdx = resolveAnimatedPaletteIndex(
        block.type,
        block.paletteCycle,
        basePalette,
        spriteSheets.length,
        now
    );
    const sheet = spriteSheets[paletteIdx] || spriteSheets[0];
    const spriteCanvas = getTransformedSpriteCanvas(sheet, rect, block.rotation ?? 1);
    return spriteCanvas instanceof HTMLCanvasElement ? spriteCanvas : null;
}

function drawMushroomSpillPixels(
    ctx: CanvasRenderingContext2D,
    mushroomBlock: MapBlock,
    side: MushroomSpillSide,
    tileW: number,
    tileH: number,
    spriteCanvas: HTMLCanvasElement,
    translationOffset: Position,
    rectMap: Record<string, any>,
    spriteSheets: CanvasImageSource[],
    now: number
) {
    const neighborX = side === 'left' ? mushroomBlock.x - tileW : mushroomBlock.x + tileW;
    const neighbor = getMapBlockAtPosition(neighborX, mushroomBlock.y);
    const neighborCanvas = neighbor ? getMapBlockSpriteCanvas(neighbor, rectMap, spriteSheets, now) : null;
    const neighborMask = neighborCanvas ? getSpriteAlphaMask(neighborCanvas) : null;
    if (neighbor && !neighborMask) {
        return;
    }
    const width = spriteCanvas.width;
    const height = spriteCanvas.height;
    const lowerHalfStartY = Math.floor(height / 2);
    const spillStartX = side === 'left' ? Math.floor(width / 2) : 0;
    const spillEndXExclusive = side === 'left' ? width : Math.ceil(width / 2);
    const candidates: MushroomPixelPoint[] = [];
    for (let y = lowerHalfStartY; y < height; y += 1) {
        for (let x = spillStartX; x < spillEndXExclusive; x += 1) {
            if (neighborMask && neighborMask[y * width + x] !== 0) {
                continue;
            }
            candidates.push({ x, y });
        }
    }
    if (candidates.length === 0) {
        return;
    }

    const frameIndex = Math.floor(Math.max(0, now) / MUSHROOM_SPORE_FRAME_MS);
    let seed = hashStringToSeed(`${getMushroomPatternKey(mushroomBlock)}:${side}:${frameIndex}`);
    const usedIndexes = new Set<number>();
    const flashes = Math.min(MUSHROOM_SIDE_SPILL_PIXELS_PER_FRAME, candidates.length);
    const pixelScaleX = tileW / width;
    const pixelScaleY = tileH / height;
    const sideOffsetX = side === 'left' ? -tileW : tileW;
    for (let count = 0; count < flashes; count += 1) {
        let pixelIndex = -1;
        for (let attempt = 0; attempt < 6; attempt += 1) {
            seed = nextSeed(seed);
            const candidate = seed % candidates.length;
            if (!usedIndexes.has(candidate)) {
                pixelIndex = candidate;
                break;
            }
        }
        if (pixelIndex < 0) {
            continue;
        }
        usedIndexes.add(pixelIndex);
        const point = candidates[pixelIndex];
        seed = nextSeed(seed);
        ctx.fillStyle = MUSHROOM_PATTERN_COLORS[seed % MUSHROOM_PATTERN_COLORS.length];
        ctx.fillRect(
            -tileW / 2 + sideOffsetX + translationOffset.x + point.x * pixelScaleX,
            -tileH / 2 + translationOffset.y + point.y * pixelScaleY,
            pixelScaleX,
            pixelScaleY
        );
    }
}

function getBucketKey(column: number, row: number) {
    return `${column},${row}`;
}

function buildBlockBuckets(blocks: MapBlock[]) {
    const buckets: BlockBucketMap = new Map();
    for (const block of blocks) {
        const column = Math.floor(block.x / MAP_BLOCK_TILE_SIZE);
        const row = Math.floor(block.y / MAP_BLOCK_TILE_SIZE);
        const key = getBucketKey(column, row);
        const bucket = buckets.get(key);
        if (bucket) {
            bucket.push(block);
        } else {
            buckets.set(key, [block]);
        }
    }
    return buckets;
}

function addBlockToBucketMap(buckets: BlockBucketMap, bucketKey: string, block: MapBlock) {
    const bucket = buckets.get(bucketKey);
    if (bucket) {
        bucket.push(block);
    } else {
        buckets.set(bucketKey, [block]);
    }
}

export function rebuildMapBlockRenderCache() {
    const rebuildStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    mushroomSporeFrameCache.clear();
    mushroomTransparentPixelCache.clear();
    mushroomBlocks = [];
    mapBlockPositionLookup = new Map();
    mapBlocksWithoutBlackBackground = [];
    mapBlocksBehindAstronaut = [];
    mapBlocksBehindAstronautWithoutBlackBackground = [];
    mapBlocksMaskAstronaut = [];
    blackBackgroundBlocks = [];
    mapWaterCellKeys = new Set<string>();

    allMapBlockBuckets = new Map();
    mapBlocksWithoutBlackBackgroundBuckets = new Map();
    mapBlocksBehindAstronautBuckets = new Map();
    mapBlocksBehindAstronautWithoutBlackBackgroundBuckets = new Map();
    mapBlocksMaskAstronautBuckets = new Map();
    blackBackgroundBlockBuckets = new Map();

    for (const block of mapBlocks) {
        mapBlockPositionLookup.set(getMapBlockPositionKey(block.x, block.y), block);
        if (isMushroomType(block.type)) {
            mushroomBlocks.push(block);
        }
        if (block.water === true) {
            mapWaterCellKeys.add(toWaterGridKey(block.x, block.y));
        }

        const isBlackBackground = block.type === 'black_background';
        const maskAstronaut = shouldMaskAstronaut(block);
        const column = Math.floor(block.x / MAP_BLOCK_TILE_SIZE);
        const row = Math.floor(block.y / MAP_BLOCK_TILE_SIZE);
        const bucketKey = getBucketKey(column, row);

        addBlockToBucketMap(allMapBlockBuckets, bucketKey, block);

        if (isBlackBackground) {
            blackBackgroundBlocks.push(block);
            addBlockToBucketMap(blackBackgroundBlockBuckets, bucketKey, block);
        } else {
            mapBlocksWithoutBlackBackground.push(block);
            addBlockToBucketMap(mapBlocksWithoutBlackBackgroundBuckets, bucketKey, block);
        }

        if (maskAstronaut) {
            mapBlocksMaskAstronaut.push(block);
            addBlockToBucketMap(mapBlocksMaskAstronautBuckets, bucketKey, block);
        } else {
            mapBlocksBehindAstronaut.push(block);
            addBlockToBucketMap(mapBlocksBehindAstronautBuckets, bucketKey, block);
            if (!isBlackBackground) {
                mapBlocksBehindAstronautWithoutBlackBackground.push(block);
                addBlockToBucketMap(mapBlocksBehindAstronautWithoutBlackBackgroundBuckets, bucketKey, block);
            }
        }
    }
}

export function getRenderableMapBlocks(hideBlackBackground = false) {
    return hideBlackBackground ? mapBlocksWithoutBlackBackground : mapBlocks;
}

export function getMapBlocksBehindAstronaut(hideBlackBackground = false) {
    return hideBlackBackground ? mapBlocksBehindAstronautWithoutBlackBackground : mapBlocksBehindAstronaut;
}

export function getMapBlocksMaskAstronaut() {
    return mapBlocksMaskAstronaut;
}

export function getBlackBackgroundBlocks() {
    return blackBackgroundBlocks;
}

export function getMushroomBlocks() {
    return mushroomBlocks;
}

function getBucketMapForBlocks(blocks?: MapBlock[]) {
    if (!blocks || blocks === mapBlocks) {
        return allMapBlockBuckets;
    }
    if (blocks === mapBlocksWithoutBlackBackground) {
        return mapBlocksWithoutBlackBackgroundBuckets;
    }
    if (blocks === mapBlocksBehindAstronaut) {
        return mapBlocksBehindAstronautBuckets;
    }
    if (blocks === mapBlocksBehindAstronautWithoutBlackBackground) {
        return mapBlocksBehindAstronautWithoutBlackBackgroundBuckets;
    }
    if (blocks === mapBlocksMaskAstronaut) {
        return mapBlocksMaskAstronautBuckets;
    }
    if (blocks === blackBackgroundBlocks) {
        return blackBackgroundBlockBuckets;
    }
    return null;
}

function getBucketedBlocksInViewport(
    buckets: BlockBucketMap,
    camera: { x: number, y: number },
    width: number,
    height: number,
    tileW: number,
    tileH: number
) {
    // Bucket scan is the fast path used by rendering and coarse collision queries.
    const minColumn = Math.floor((camera.x - tileW) / MAP_BLOCK_TILE_SIZE);
    const maxColumn = Math.floor((camera.x + width + tileW) / MAP_BLOCK_TILE_SIZE);
    const minRow = Math.floor((camera.y - tileH) / MAP_BLOCK_TILE_SIZE);
    const maxRow = Math.floor((camera.y + height + tileH) / MAP_BLOCK_TILE_SIZE);
    const visibleBlocks: MapBlock[] = [];

    for (let row = minRow; row <= maxRow; row += 1) {
        for (let column = minColumn; column <= maxColumn; column += 1) {
            const bucket = buckets.get(getBucketKey(column, row));
            if (bucket) {
                visibleBlocks.push(...bucket);
            }
        }
    }

    return visibleBlocks;
}

export function getMapBlocksNearWorldPoint(
    x: number,
    y: number,
    SPRITE_SCALE: number,
    blocks?: MapBlock[]
) {
    const bucketMap = getBucketMapForBlocks(blocks);
    if (!bucketMap) {
        return blocks || mapBlocks;
    }

    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const minColumn = Math.floor((x - tileW) / MAP_BLOCK_TILE_SIZE);
    const maxColumn = Math.floor((x + tileW) / MAP_BLOCK_TILE_SIZE);
    const minRow = Math.floor((y - tileH) / MAP_BLOCK_TILE_SIZE);
    const maxRow = Math.floor((y + tileH) / MAP_BLOCK_TILE_SIZE);
    const nearbyBlocks: MapBlock[] = [];

    for (let row = minRow; row <= maxRow; row += 1) {
        for (let column = minColumn; column <= maxColumn; column += 1) {
            const bucket = bucketMap.get(getBucketKey(column, row));
            if (bucket) {
                nearbyBlocks.push(...bucket);
            }
        }
    }

    return nearbyBlocks;
}

export function shouldMaskAstronaut(block: Pick<MapBlock, 'type' | 'collision' | 'maskAstronaut' | 'water' | 'waterOnly'>) {
    if (block.water === true || block.waterOnly === true) {
        return false;
    }
    if (typeof block.maskAstronaut === 'boolean') {
        return block.maskAstronaut;
    }
    if (block.type === 'black_background') {
        return false;
    }
    return block.collision === false;
}

// --- Chunked world streaming state ---
let colorAliases: Record<string, [number, number, number]> = {};
let colorAliasesLoaded = false;
type WorldChunkManifestEntry = {
    x: number;
    y: number;
    file: string;
    count?: number;
};
type WorldChunkManifest = {
    version?: number;
    chunkWorldSize?: number;
    chunks?: WorldChunkManifestEntry[];
};
export type ChunkedWorldOverview = {
    chunkWorldSize: number;
    chunks: Array<{
        x: number;
        y: number;
        count?: number;
    }>;
};
type ChunkCacheEntry = {
    manifestEntry: WorldChunkManifestEntry;
    blocks: MapBlock[] | null;
    active: boolean;
    lastAccessedAt: number;
    loadPromise: Promise<void> | null;
};

type MapChunkPerfTraceSnapshot = {
    lastRebuildMapBlockRenderCacheMs: number;
    lastEnsureChunksLoadedMs: number;
    lastEnsureChunksLoadedCount: number;
    lastEnsureChunksActivatedCount: number;
    lastViewportSyncCallMs: number;
    lastViewportPostLoadDeactivateMs: number;
};

function getTeleporterBlockPreferenceScore(block: MapBlock) {
    let score = 0;
    if (block.type === 'teleporter') {
        if (block.collision !== false) {
            score += 2;
        }
        if (block.maskAstronaut === false) {
            score += 1;
        }
        if (block.translation === 'center') {
            score += 1;
        }
        return score;
    }
    if (block.type === 'teleporter_pad') {
        if (block.maskAstronaut === false) {
            score += 2;
        }
        if (block.translation === 'center') {
            score += 1;
        }
    }
    return score;
}

function normalizeChunkTeleporterBlocks(blocks: MapBlock[]) {
    if (blocks.length === 0) {
        return blocks;
    }
    const preferredByTypeAndPosition = new Map<string, MapBlock>();
    for (const block of blocks) {
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            continue;
        }
        const key = `${block.type}:${block.x},${block.y}`;
        const existing = preferredByTypeAndPosition.get(key);
        if (!existing) {
            preferredByTypeAndPosition.set(key, block);
            continue;
        }
        const existingScore = getTeleporterBlockPreferenceScore(existing);
        const candidateScore = getTeleporterBlockPreferenceScore(block);
        if (candidateScore > existingScore) {
            preferredByTypeAndPosition.set(key, block);
        }
    }
    return blocks.filter((block) => {
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            return true;
        }
        const key = `${block.type}:${block.x},${block.y}`;
        return preferredByTypeAndPosition.get(key) === block;
    });
}

function getChunkCacheKey(chunkX: number, chunkY: number) {
    return `${chunkX},${chunkY}`;
}

let chunkedWorldMapEnabled = false;
let chunkWorldSize = DEFAULT_CHUNK_WORLD_SIZE;
let desiredActiveChunkKeys = new Set<string>();
let chunkManifestEntriesByKey = new Map<string, WorldChunkManifestEntry>();
let chunkCacheByKey = new Map<string, ChunkCacheEntry>();
let lastViewportSyncedChunkKeys = new Set<string>();
let mapChunkPerfTraceSnapshot: MapChunkPerfTraceSnapshot = {
    lastRebuildMapBlockRenderCacheMs: 0,
    lastEnsureChunksLoadedMs: 0,
    lastEnsureChunksLoadedCount: 0,
    lastEnsureChunksActivatedCount: 0,
    lastViewportSyncCallMs: 0,
    lastViewportPostLoadDeactivateMs: 0
};

function setMapBlocks(nextBlocks: MapBlock[]) {
    mapBlocks.splice(0, mapBlocks.length, ...nextBlocks);
    mapBlocksRevision += 1;
}

function removeChunkBlocksFromMap(chunkKey: string) {
    if (mapBlocks.length === 0) {
        return false;
    }
    const retained = mapBlocks.filter((block) => mapBlockChunkKeyLookup.get(block) !== chunkKey);
    if (retained.length === mapBlocks.length) {
        return false;
    }
    setMapBlocks(retained);
    return true;
}

function addChunkBlocksToMap(blocks: MapBlock[]) {
    if (blocks.length === 0) {
        return false;
    }
    const additions = blocks.filter((block) => !mapBlocks.includes(block));
    if (additions.length === 0) {
        return false;
    }
    mapBlocks.push(...additions);
    mapBlocksRevision += 1;
    return true;
}

export function getMapBlocksRevision() {
    return mapBlocksRevision;
}

function deactivateChunk(chunkKey: string) {
    const cacheEntry = chunkCacheByKey.get(chunkKey);
    if (!cacheEntry || !cacheEntry.active) {
        return false;
    }
    cacheEntry.active = false;
    return removeChunkBlocksFromMap(chunkKey);
}

function activateChunk(chunkKey: string) {
    const cacheEntry = chunkCacheByKey.get(chunkKey);
    if (!cacheEntry || cacheEntry.active || !cacheEntry.blocks) {
        return false;
    }
    cacheEntry.active = true;
    cacheEntry.lastAccessedAt = Date.now();
    return addChunkBlocksToMap(cacheEntry.blocks);
}

function evictInactiveChunkCache(requiredChunkKeys?: Set<string>) {
    const loadedEntries = [...chunkCacheByKey.entries()]
        .filter(([, entry]) => entry.blocks && !entry.loadPromise);
    if (loadedEntries.length <= CHUNK_CACHE_MAX_RESIDENCY) {
        return;
    }

    const evictionCandidates = loadedEntries
        .filter(([chunkKey, entry]) => !entry.active && !requiredChunkKeys?.has(chunkKey))
        .sort((a, b) => a[1].lastAccessedAt - b[1].lastAccessedAt);

    let loadedCount = loadedEntries.length;
    for (const [chunkKey] of evictionCandidates) {
        if (loadedCount <= CHUNK_CACHE_MAX_RESIDENCY) {
            break;
        }
        chunkCacheByKey.delete(chunkKey);
        loadedCount -= 1;
    }
}

function getChunkCoordinatesForWorldPosition(position: Position) {
    return {
        x: Math.floor(position.x / chunkWorldSize),
        y: Math.floor(position.y / chunkWorldSize)
    };
}

function buildChunkKeysAroundChunkCoordinates(chunkX: number, chunkY: number, radiusChunks: number) {
    const radius = Math.max(0, Math.floor(radiusChunks));
    const chunkKeys = new Set<string>();
    for (let y = chunkY - radius; y <= chunkY + radius; y += 1) {
        for (let x = chunkX - radius; x <= chunkX + radius; x += 1) {
            chunkKeys.add(getChunkCacheKey(x, y));
        }
    }
    return chunkKeys;
}

function buildChunkKeysForViewport(
    camera: Position,
    viewportWidth: number,
    viewportHeight: number,
    prefetchRadiusChunks: number,
    zoom: number = 1
) {
    const radius = Math.max(0, Math.floor(prefetchRadiusChunks));
    const safeZoom = Number.isFinite(zoom) && zoom > 0 ? zoom : 1;
    const viewportWidthWorld = Math.max(1, viewportWidth / safeZoom);
    const viewportHeightWorld = Math.max(1, viewportHeight / safeZoom);
    const minChunkX = Math.floor(camera.x / chunkWorldSize) - radius;
    const maxChunkX = Math.floor((camera.x + viewportWidthWorld - 1) / chunkWorldSize) + radius;
    const minChunkY = Math.floor(camera.y / chunkWorldSize) - radius;
    const maxChunkY = Math.floor((camera.y + viewportHeightWorld - 1) / chunkWorldSize) + radius;
    const chunkKeys = new Set<string>();
    for (let y = minChunkY; y <= maxChunkY; y += 1) {
        for (let x = minChunkX; x <= maxChunkX; x += 1) {
            chunkKeys.add(getChunkCacheKey(x, y));
        }
    }
    return chunkKeys;
}

async function ensureChunkLoaded(chunkKey: string): Promise<ChunkCacheEntry | null> {
    const manifestEntry = chunkManifestEntriesByKey.get(chunkKey);
    if (!manifestEntry) {
        return null;
    }
    const now = Date.now();
    let cacheEntry = chunkCacheByKey.get(chunkKey);
    if (cacheEntry && cacheEntry.blocks) {
        cacheEntry.lastAccessedAt = now;
        return cacheEntry;
    }

    if (!cacheEntry) {
        cacheEntry = {
            manifestEntry,
            blocks: null,
            active: false,
            lastAccessedAt: now,
            loadPromise: null
        };
        chunkCacheByKey.set(chunkKey, cacheEntry);
    }

    // Deduplicate concurrent fetches for the same chunk via a shared promise.
    if (!cacheEntry.loadPromise) {
        cacheEntry.loadPromise = (async () => {
            const chunkPayload = await fetchFreshJson<any[]>(`./src/assets/data/world_chunks/${manifestEntry.file}`);
            if (!Array.isArray(chunkPayload)) {
                throw new Error('Invalid world chunk payload. Each chunk file must contain an array of map blocks.');
            }
            const normalizedBlocks = normalizeChunkTeleporterBlocks(
                chunkPayload.map((block: any) => normalizeWaterBlock(block as MapBlock))
            );
            cacheEntry!.blocks = normalizedBlocks.map((block: MapBlock) => {
                const assignedBlock = assignEntityId(block) as MapBlock;
                mapBlockChunkKeyLookup.set(assignedBlock, chunkKey);
                return assignedBlock;
            });
            cacheEntry!.lastAccessedAt = Date.now();
        })().finally(() => {
            cacheEntry!.loadPromise = null;
        });
    }

    await cacheEntry.loadPromise;
    return cacheEntry;
}

async function ensureChunksLoaded(chunkKeys: Set<string>, activateLoadedChunks: boolean) {
    const ensureStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    let mapChanged = false;
    let activatedChunkCount = 0;
    const loadPromises = [...chunkKeys].map(async (chunkKey) => {
        const cacheEntry = await ensureChunkLoaded(chunkKey);
        if (!cacheEntry) {
            return;
        }
        cacheEntry.lastAccessedAt = Date.now();
        if (activateLoadedChunks && desiredActiveChunkKeys.has(chunkKey)) {
            if (activateChunk(chunkKey)) {
                mapChanged = true;
                activatedChunkCount += 1;
            }
        }
    });
    await Promise.all(loadPromises);
    evictInactiveChunkCache(chunkKeys);
    if (mapChanged) {
        rebuildMapBlockRenderCache();
    }
    mapChunkPerfTraceSnapshot.lastEnsureChunksLoadedMs = (
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - ensureStartedAt
    );
    mapChunkPerfTraceSnapshot.lastEnsureChunksLoadedCount = chunkKeys.size;
    mapChunkPerfTraceSnapshot.lastEnsureChunksActivatedCount = activatedChunkCount;
}

function areSetsEqual(left: Set<string>, right: Set<string>) {
    if (left.size !== right.size) {
        return false;
    }
    for (const value of left) {
        if (!right.has(value)) {
            return false;
        }
    }
    return true;
}

async function fetchFreshJson<T>(url: string): Promise<T> {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

async function loadColorAliases() {
    if (colorAliasesLoaded) return;
    colorAliases = await fetchFreshJson('./src/assets/data/colors.json');
    colorAliasesLoaded = true;
}

function isChunkManifestEntry(value: unknown): value is WorldChunkManifestEntry {
    if (!value || typeof value !== 'object') {
        return false;
    }
    const entry = value as Partial<WorldChunkManifestEntry>;
    return Number.isFinite(entry.x)
        && Number.isFinite(entry.y)
        && typeof entry.file === 'string'
        && entry.file.trim().length > 0;
}

async function loadChunkedWorldMapBlocks() {
    let manifest: WorldChunkManifest;
    try {
        manifest = await fetchFreshJson<WorldChunkManifest>('./src/assets/data/world_chunks/manifest.json');
    } catch (error) {
        if (error instanceof Error && error.message.includes('world_chunks/manifest.json: 404')) {
            return null;
        }
        throw error;
    }
    const chunkEntries = Array.isArray(manifest?.chunks)
        ? manifest.chunks.filter(isChunkManifestEntry)
        : [];
    chunkWorldSize = Number.isFinite(manifest.chunkWorldSize)
        ? Math.max(1, Math.floor(manifest.chunkWorldSize!))
        : DEFAULT_CHUNK_WORLD_SIZE;
    chunkManifestEntriesByKey = new Map(chunkEntries.map((entry) => [
        getChunkCacheKey(entry.x, entry.y),
        entry
    ]));
    chunkCacheByKey = new Map();
    desiredActiveChunkKeys = new Set();
    return chunkEntries;
}

function setMapBoundsFromChunkManifestEntries(chunkEntries: WorldChunkManifestEntry[]) {
    if (chunkEntries.length === 0) {
        setMapBounds(DEFAULT_MAP_WIDTH, DEFAULT_MAP_HEIGHT);
        return;
    }

    let maxChunkX = 0;
    let maxChunkY = 0;
    for (const entry of chunkEntries) {
        if (entry.x > maxChunkX) {
            maxChunkX = entry.x;
        }
        if (entry.y > maxChunkY) {
            maxChunkY = entry.y;
        }
    }

    setMapBounds(
        Math.max(DEFAULT_MAP_WIDTH, (maxChunkX + 1) * chunkWorldSize),
        Math.max(DEFAULT_MAP_HEIGHT, (maxChunkY + 1) * chunkWorldSize)
    );
}

// Utility: Resolve color alias or return RGB array
function resolveColor(color: string | [number, number, number]): [number, number, number] {
    if (typeof color === "string") {
        return colorAliases[color] || [0, 0, 0];
    }
    return color;
}

function toCssRgbColor(color: [number, number, number]) {
    return `rgb(${color[0]}, ${color[1]}, ${color[2]})`;
}

export async function loadMapBlocks() {
    await loadColorAliases(); // Ensure color aliases are loaded
    const chunkEntries = await loadChunkedWorldMapBlocks();
    if (chunkEntries) {
        chunkedWorldMapEnabled = chunkEntries.length > 0;
        setMapBoundsFromChunkManifestEntries(chunkEntries);
        setMapBlocks([]);
        lastViewportSyncedChunkKeys = new Set();
    } else {
        chunkedWorldMapEnabled = false;
        const arr = await fetchFreshJson<any[]>('./src/assets/data/world_map.json');
        // Assign entityId to each block using global assignEntityId
        setMapBlocks(arr.map((block: any) => assignEntityId(normalizeWaterBlock(block as MapBlock))));
    }
    rebuildMapBlockRenderCache();
    mapLoaded = true;
}

export async function ensureMapChunksAroundWorldPosition(
    position: Position,
    radiusChunks: number = 1,
    activateLoadedChunks: boolean = true
) {
    if (!chunkedWorldMapEnabled) {
        return;
    }
    const centerChunk = getChunkCoordinatesForWorldPosition(position);
    const requiredChunkKeys = buildChunkKeysAroundChunkCoordinates(centerChunk.x, centerChunk.y, radiusChunks);
    if (activateLoadedChunks) {
        desiredActiveChunkKeys = requiredChunkKeys;
        lastViewportSyncedChunkKeys = new Set();
        let mapChanged = false;
        for (const activeChunkKey of [...chunkCacheByKey.keys()]) {
            if (!requiredChunkKeys.has(activeChunkKey)) {
                if (deactivateChunk(activeChunkKey)) {
                    mapChanged = true;
                }
            }
        }
        if (mapChanged) {
            rebuildMapBlockRenderCache();
        }
    }
    await ensureChunksLoaded(requiredChunkKeys, activateLoadedChunks);
}

export function prefetchMapChunksAroundWorldPosition(position: Position, radiusChunks: number = 1) {
    void ensureMapChunksAroundWorldPosition(position, radiusChunks, false);
}

export function isWorldPositionChunkLoaded(position: Position) {
    if (!chunkedWorldMapEnabled) {
        return true;
    }
    const { x, y } = getChunkCoordinatesForWorldPosition(position);
    const chunkKey = getChunkCacheKey(x, y);
    const cacheEntry = chunkCacheByKey.get(chunkKey);
    return !!cacheEntry && cacheEntry.active && Array.isArray(cacheEntry.blocks);
}

export function syncMapChunksForViewport(
    camera: Position,
    viewportWidth: number,
    viewportHeight: number,
    prefetchRadiusChunks: number = 1,
    zoom: number = 1,
    forceSync: boolean = false
) {
    const syncStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!chunkedWorldMapEnabled) {
        return;
    }

    // Viewport-driven chunk set includes a configurable prefetch margin.
    const requiredChunkKeys = buildChunkKeysForViewport(
        camera,
        viewportWidth,
        viewportHeight,
        prefetchRadiusChunks,
        zoom
    );
    if (!forceSync && areSetsEqual(requiredChunkKeys, lastViewportSyncedChunkKeys)) {
        return;
    }
    lastViewportSyncedChunkKeys = new Set(requiredChunkKeys);
    desiredActiveChunkKeys = requiredChunkKeys;
    void ensureChunksLoaded(requiredChunkKeys, true).then(() => {
        const postLoadStartedAt = typeof performance !== 'undefined' ? performance.now() : Date.now();
        // Keep previously active chunks visible until required chunks finish loading
        // so designer camera movement does not render an empty world between loads.
        let mapChanged = false;
        for (const activeChunkKey of [...chunkCacheByKey.keys()]) {
            if (!desiredActiveChunkKeys.has(activeChunkKey)) {
                if (deactivateChunk(activeChunkKey)) {
                    mapChanged = true;
                }
            }
        }
        if (mapChanged) {
            rebuildMapBlockRenderCache();
        }
        mapChunkPerfTraceSnapshot.lastViewportPostLoadDeactivateMs = (
            (typeof performance !== 'undefined' ? performance.now() : Date.now()) - postLoadStartedAt
        );
    });
    mapChunkPerfTraceSnapshot.lastViewportSyncCallMs = (
        (typeof performance !== 'undefined' ? performance.now() : Date.now()) - syncStartedAt
    );
}

export function getMapChunkPerfTraceSnapshot() {
    return { ...mapChunkPerfTraceSnapshot };
}

export async function materializeAllMapChunksForSave() {
    if (!chunkedWorldMapEnabled || chunkManifestEntriesByKey.size === 0) {
        return;
    }
    const allChunkKeys = new Set(chunkManifestEntriesByKey.keys());
    lastViewportSyncedChunkKeys = new Set();
    desiredActiveChunkKeys = allChunkKeys;
    await ensureChunksLoaded(allChunkKeys, true);
}

export function getChunkedWorldOverview(): ChunkedWorldOverview | null {
    if (!chunkedWorldMapEnabled || chunkManifestEntriesByKey.size === 0) {
        return null;
    }
    return {
        chunkWorldSize,
        chunks: [...chunkManifestEntriesByKey.values()].map((entry) => ({
            x: entry.x,
            y: entry.y,
            count: Number.isFinite(entry.count) ? Math.max(0, Math.floor(entry.count!)) : undefined
        }))
    };
}

// Collision detection with blocks
export function getBlockAtWorld(
    x: number,
    y: number,
    spriteMap: any,
    SPRITE_SCALE: number
): MapBlock | undefined {
    x = Math.round(x);
    y = Math.round(y);
    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const column = Math.floor(x / MAP_BLOCK_TILE_SIZE);
    const row = Math.floor(y / MAP_BLOCK_TILE_SIZE);
    const candidates = allMapBlockBuckets.get(getBucketKey(column, row)) ?? [];

    for (const b of candidates) {
        if (
            x >= b.x && x < b.x + tileW &&
            y >= b.y && y < b.y + tileH &&
            b.collision
        ) {
            return b;
        }
    }
    return undefined;
}

// Utility: Cache for filtered sprites (black-to-transparent)
export function clearMapSpriteCache() {
    // Transformed sprite canvases are cached in utilities by source sheet and rect.
}

// Utility: Build a rect lookup map for fast access
function buildSpriteRectMap(spriteMap: any) {
    const rectMap: Record<string, any> = {};
    if (spriteMap instanceof Array) {
        for (let row = 0; row < spriteMap.length; row++) {
            for (let col = 0; col < spriteMap[row].length; col++) {
                const rect = spriteMap[row][col];
                if (rect && rect.name) rectMap[rect.name] = rect;
            }
        }
    } else {
        Object.assign(rectMap, spriteMap);
    }
    return rectMap;
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

// Draw map blocks
export function drawMap(
    ctx: CanvasRenderingContext2D,
    camera: { x: number, y: number },
    spriteMap: any,
    spriteSheets: CanvasImageSource[],
    SPRITE_SCALE: number,
    blocks?: MapBlock[], // Optional: blocks to draw instead of global mapBlocks
    now?: number
) {
    if (!spriteMap || !mapLoaded) return;

    const rectMap = getSpriteRectMap(spriteMap);
    const drawNow = typeof now === 'number'
        ? now
        : (typeof performance !== 'undefined' ? performance.now() : Date.now());
    const waterFillColor = toCssRgbColor(resolveColor(WATER_FILL_COLOR_ALIAS));
    const waterSurfaceColor = toCssRgbColor(resolveColor(WATER_SURFACE_COLOR_ALIAS));

    // Only draw blocks in camera viewport (+1 tile margin)
    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const minX = camera.x - tileW, maxX = camera.x + ctx.canvas.width + tileW;
    const minY = camera.y - tileH, maxY = camera.y + ctx.canvas.height + tileH;

    const bucketMap = getBucketMapForBlocks(blocks);
    const blocksToDraw = bucketMap
        ? getBucketedBlocksInViewport(bucketMap, camera, ctx.canvas.width, ctx.canvas.height, tileW, tileH)
        : (blocks || mapBlocks);
    const visibleFireBlocks = blocksToDraw.reduce(
        (count, block) => count + (isFireArchetype(block) ? 1 : 0),
        0
    );
    let remainingFireEmbers = resolveFireGlobalEmberBudget();
    let renderedFireEmbers = 0;
    const waterSurfaceThickness = Math.max(1, Math.round(SPRITE_SCALE));
    const waterBodyDrawWidth = Math.ceil(tileW) + 1;
    const waterBodyDrawHeight = Math.ceil(tileH) + 1;
    const hasWaterAbove = (block: MapBlock) => mapWaterCellKeys.has(
        `${toWaterGridCoordinate(block.x)}:${toWaterGridCoordinate(block.y) - 1}`
    );

    for (const block of blocksToDraw) {
        // Only draw visible blocks
        if (
            block.x + tileW < minX || block.x > maxX ||
            block.y + tileH < minY || block.y > maxY
        ) continue;

        const drawX = block.x - camera.x;
        const drawY = block.y - camera.y;
        if (block.water === true) {
            const snappedDrawX = Math.round(drawX);
            const snappedDrawY = Math.round(drawY);
            ctx.save();
            // Water is always a background layer; never paint it over already-rendered entities.
            ctx.globalCompositeOperation = 'destination-over';
            ctx.fillStyle = waterFillColor;
            ctx.fillRect(snappedDrawX, snappedDrawY, waterBodyDrawWidth, waterBodyDrawHeight);
            if (!hasWaterAbove(block)) {
                // Draw the surface line over the water body so it remains visible.
                ctx.globalCompositeOperation = 'source-over';
                ctx.fillStyle = waterSurfaceColor;
                ctx.fillRect(snappedDrawX, snappedDrawY, waterBodyDrawWidth, waterSurfaceThickness);
            }
            ctx.restore();
            if (block.waterOnly === true) {
                continue;
            }
        }

        if (block.waterOnly === true) {
            continue;
        }

        // Fast rect lookup
        const rect = rectMap[block.type];
        if (!rect) continue;

        const basePalette = typeof block.palette === "number" ? block.palette : 0;
        const effectSeed = getBlockEffectSeed(block, 'motion');
        const isFire = isFireArchetype(block);
        const paletteIdx = isFire
            ? resolveFirePaletteIndex(basePalette, spriteSheets.length, drawNow, effectSeed)
            : resolveAnimatedPaletteIndex(
                block.type,
                block.paletteCycle,
                basePalette,
                spriteSheets.length,
                drawNow
            );

        ctx.save();
        ctx.translate(drawX + tileW / 2, drawY + tileH / 2);

        const sheet = spriteSheets[paletteIdx] || spriteSheets[0];

        const offCanvas = getTransformedSpriteCanvas(sheet, rect, block.rotation ?? 1);
        if (!offCanvas) {
            ctx.restore();
            continue;
        }
        const scaleX = tileW / rect.w;
        const scaleY = tileH / rect.h;
        const drawW = offCanvas.width * scaleX;
        const drawH = offCanvas.height * scaleY;
        const translationOffset = getSpriteTranslationOffset(
            offCanvas,
            normalizeSpriteTranslation(block.translation),
            scaleX,
            scaleY
        );
        const baseDrawLeft = -drawW / 2 + translationOffset.x;
        const baseDrawTop = -drawH / 2 + translationOffset.y;
        const fireMotion = isFire ? resolveFireMotion(drawNow, effectSeed) : null;
        const drawLeft = baseDrawLeft + (fireMotion?.offsetX ?? 0);
        const drawTop = baseDrawTop + (fireMotion?.offsetY ?? 0);

        if (isFire) {
            const visibleBounds = getSpriteVisibleBounds(offCanvas);
            const pivotX = visibleBounds
                ? drawLeft + ((visibleBounds.minX + visibleBounds.maxX + 1) / 2) * scaleX
                : drawLeft + drawW / 2;
            const pivotY = visibleBounds
                ? drawTop + ((visibleBounds.minY + visibleBounds.maxY + 1) / 2) * scaleY
                : drawTop + drawH / 2;
            ctx.save();
            ctx.translate(pivotX, pivotY);
            ctx.rotate(fireMotion?.rotationRadians ?? 0);
            ctx.drawImage(
                offCanvas,
                drawLeft - pivotX,
                drawTop - pivotY,
                drawW,
                drawH
            );
            ctx.restore();
            const blockEmberBudget = Math.min(FIRE_MAX_EMBERS_PER_BLOCK, remainingFireEmbers);
            if (blockEmberBudget > 0) {
                const drawn = drawFireEmbers(ctx, block, drawNow, tileW, tileH, drawLeft, drawTop, blockEmberBudget);
                renderedFireEmbers += drawn;
                remainingFireEmbers = Math.max(0, remainingFireEmbers - drawn);
            }
        } else {
            ctx.drawImage(
                offCanvas,
                drawLeft,
                drawTop,
                drawW,
                drawH
            );
        }

        if (isMushroomType(block.type) && offCanvas instanceof HTMLCanvasElement) {
            const pattern = getMushroomPatternCanvas(
                block,
                offCanvas,
                drawNow
            );
            if (pattern) {
                ctx.drawImage(
                    pattern,
                    -tileW / 2 + translationOffset.x,
                    -tileH / 2 + translationOffset.y,
                    tileW,
                    tileH
                );
            }
            drawMushroomSpillPixels(
                ctx,
                block,
                'left',
                tileW,
                tileH,
                offCanvas,
                translationOffset,
                rectMap,
                spriteSheets,
                drawNow
            );
            drawMushroomSpillPixels(
                ctx,
                block,
                'right',
                tileW,
                tileH,
                offCanvas,
                translationOffset,
                rectMap,
                spriteSheets,
                drawNow
            );
        }
        ctx.restore();
    }
    lastFireFrameStats = {
        visibleFireBlocks,
        renderedEmbers: renderedFireEmbers,
        emberBudget: resolveFireGlobalEmberBudget()
    };
}
