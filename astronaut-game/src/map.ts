import { assignEntityId } from './game.js';
import {
    DEFAULT_MAP_HEIGHT,
    DEFAULT_MAP_WIDTH,
    SPRITE_SCALE as DEFAULT_SPRITE_SCALE,
    setMapBounds
} from './constants.js';
import type { DestructionSourceRequirement } from './destructibles.js';
import { resolveAnimatedPaletteIndex } from './palette-cycle.js';
import { PaletteCycleSettings, Position, WindEmitterMode } from './types/index.js';
import { getSpriteTranslationOffset, getTransformedSpriteCanvas, normalizeSpriteTranslation, SpriteTranslation } from './utilities.js';

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
    windShowParticles?: boolean;
};

export let mapBlocks: MapBlock[] = [];
export let mapLoaded = false;

type BlockBucketMap = Map<string, MapBlock[]>;

const MAP_BLOCK_TILE_SIZE = 32 * DEFAULT_SPRITE_SCALE;
let mapBlocksWithoutBlackBackground: MapBlock[] = [];
let mapBlocksBehindAstronaut: MapBlock[] = [];
let mapBlocksBehindAstronautWithoutBlackBackground: MapBlock[] = [];
let mapBlocksMaskAstronaut: MapBlock[] = [];
let blackBackgroundBlocks: MapBlock[] = [];
let mushroomBlocks: MapBlock[] = [];
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
const MUSHROOM_PATTERN_COLORS = ['#2ad850', '#5ef57d', '#f8eb40', '#ef4f58', '#72c9ff', '#ffffff'];
const MUSHROOM_SPORE_FRAME_MS = 150;
const MUSHROOM_SPORES_PER_FRAME = 10;
const MUSHROOM_SIDE_SPILL_PIXELS_PER_FRAME = 4;

type MushroomPixelPoint = {
    x: number;
    y: number;
};

type MushroomSpillSide = 'left' | 'right';

function hashStringToSeed(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

function nextSeed(seed: number) {
    return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

function isMushroomType(type: string) {
    return type === 'mushrooms' || type === 'mushroom';
}

function getMushroomPatternKey(block: MapBlock) {
    const palette = typeof block.palette === 'number' ? block.palette : 0;
    return `${block.x}:${block.y}:${palette}:${block.rotation ?? 1}`;
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
    mushroomSporeFrameCache.clear();
    mushroomTransparentPixelCache.clear();
    mushroomBlocks = [];
    mapBlockPositionLookup = new Map();
    mapBlocksWithoutBlackBackground = [];
    mapBlocksBehindAstronaut = [];
    mapBlocksBehindAstronautWithoutBlackBackground = [];
    mapBlocksMaskAstronaut = [];
    blackBackgroundBlocks = [];

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

export function shouldMaskAstronaut(block: Pick<MapBlock, 'type' | 'collision' | 'maskAstronaut'>) {
    if (typeof block.maskAstronaut === 'boolean') {
        return block.maskAstronaut;
    }
    if (block.type === 'black_background') {
        return false;
    }
    return block.collision === false;
}

// New: Color alias map and loader
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

function getChunkCacheKey(chunkX: number, chunkY: number) {
    return `${chunkX},${chunkY}`;
}

let chunkedWorldMapEnabled = false;
let chunkWorldSize = DEFAULT_CHUNK_WORLD_SIZE;
let desiredActiveChunkKeys = new Set<string>();
let chunkManifestEntriesByKey = new Map<string, WorldChunkManifestEntry>();
let chunkCacheByKey = new Map<string, ChunkCacheEntry>();
let lastViewportSyncedChunkKeys = new Set<string>();

function setMapBlocks(nextBlocks: MapBlock[]) {
    mapBlocks.splice(0, mapBlocks.length, ...nextBlocks);
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
    return true;
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

    if (!cacheEntry.loadPromise) {
        cacheEntry.loadPromise = (async () => {
            const chunkPayload = await fetchFreshJson<any[]>(`./src/assets/world_chunks/${manifestEntry.file}`);
            if (!Array.isArray(chunkPayload)) {
                throw new Error('Invalid world chunk payload. Each chunk file must contain an array of map blocks.');
            }
            cacheEntry!.blocks = chunkPayload.map((block: any) => {
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
    let mapChanged = false;
    const loadPromises = [...chunkKeys].map(async (chunkKey) => {
        const cacheEntry = await ensureChunkLoaded(chunkKey);
        if (!cacheEntry) {
            return;
        }
        cacheEntry.lastAccessedAt = Date.now();
        if (activateLoadedChunks && desiredActiveChunkKeys.has(chunkKey)) {
            if (activateChunk(chunkKey)) {
                mapChanged = true;
            }
        }
    });
    await Promise.all(loadPromises);
    evictInactiveChunkCache(chunkKeys);
    if (mapChanged) {
        rebuildMapBlockRenderCache();
    }
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
    colorAliases = await fetchFreshJson('./src/assets/colors.json');
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
        manifest = await fetchFreshJson<WorldChunkManifest>('./src/assets/world_chunks/manifest.json');
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
        const arr = await fetchFreshJson<any[]>('./src/assets/world_map.json');
        // Assign entityId to each block using global assignEntityId
        setMapBlocks(arr.map((block: any) => assignEntityId(block)));
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

export function syncMapChunksForViewport(
    camera: Position,
    viewportWidth: number,
    viewportHeight: number,
    prefetchRadiusChunks: number = 1,
    zoom: number = 1,
    forceSync: boolean = false
) {
    if (!chunkedWorldMapEnabled) {
        return;
    }

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
    void ensureChunksLoaded(requiredChunkKeys, true);
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

    // Only draw blocks in camera viewport (+1 tile margin)
    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const minX = camera.x - tileW, maxX = camera.x + ctx.canvas.width + tileW;
    const minY = camera.y - tileH, maxY = camera.y + ctx.canvas.height + tileH;

    const bucketMap = getBucketMapForBlocks(blocks);
    const blocksToDraw = bucketMap
        ? getBucketedBlocksInViewport(bucketMap, camera, ctx.canvas.width, ctx.canvas.height, tileW, tileH)
        : (blocks || mapBlocks);

    for (const block of blocksToDraw) {
        // Only draw visible blocks
        if (
            block.x + tileW < minX || block.x > maxX ||
            block.y + tileH < minY || block.y > maxY
        ) continue;

        // Fast rect lookup
        const rect = rectMap[block.type];
        if (!rect) continue;

        const basePalette = typeof block.palette === "number" ? block.palette : 0;
        const paletteIdx = resolveAnimatedPaletteIndex(
            block.type,
            block.paletteCycle,
            basePalette,
            spriteSheets.length,
            drawNow
        );

        ctx.save();
        const drawX = block.x - camera.x;
        const drawY = block.y - camera.y;
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

        ctx.drawImage(
            offCanvas,
            -drawW / 2 + translationOffset.x,
            -drawH / 2 + translationOffset.y,
            drawW,
            drawH
        );

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
}
