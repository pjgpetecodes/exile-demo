import type { MapBlock } from '../../world/map.js';
import type { PaletteCycleSettings, Position } from '../../types/index.js';
import type { TeleporterRuntime } from './game-teleporter-runtime.js';
import type { SpriteTranslation } from '../../shared/utilities.js';

// Teleporter pad rendering/sweep math is isolated from game.ts to keep the main loop readable.

export type TeleporterRenderPad = {
    teleporter: TeleporterRuntime;
    active: boolean;
    x: number;
    y: number;
    palette: number;
    rotation: number;
    translation: SpriteTranslation;
    paletteCycle?: PaletteCycleSettings;
};

type TeleporterPadViewportFilter = {
    x: number;
    y: number;
    width: number;
    height: number;
    margin?: number;
};

type TeleporterPadProximityFilter = {
    x: number;
    y: number;
    radius: number;
};

type TeleporterDrawEntity = {
    x: number;
    y: number;
    type: 'teleporter_pad';
    palette: number;
    rotation: number;
    translation: SpriteTranslation;
    paletteCycle?: PaletteCycleSettings;
    collision: false;
};

type TeleporterBlockIndex = {
    version: number;
    baseBlocksById: Map<string, MapBlock>;
    padBlocksById: Map<string, MapBlock>;
    baseBlocksByPosition: Map<string, MapBlock>;
    padBlocksByPosition: Map<string, MapBlock>;
};

type RenderedEntityWorldSprite = {
    canvas: HTMLCanvasElement;
    drawX: number;
    drawY: number;
};

type TeleporterPadRuntimeOptions = {
    spriteScale: number;
    getMapBlocks: () => MapBlock[];
    getTeleporters: () => TeleporterRuntime[];
    getCanvasSize: () => { width: number; height: number };
    getRenderedEntityWorldSprite: (entity: {
        x: number;
        y: number;
        type: string;
        rotation?: number;
        translation?: string | null;
        palette?: number;
        paletteCycle?: PaletteCycleSettings;
    }) => RenderedEntityWorldSprite | null;
    normalizeSpriteTranslation: (translation?: string | null) => SpriteTranslation;
    getSpriteVisibleBounds: (canvas: HTMLCanvasElement) => { minX: number; minY: number; maxX: number; maxY: number } | null;
    drawEntities: (
        context: CanvasRenderingContext2D,
        camera: Position,
        entities: TeleporterDrawEntity[],
        now: number
    ) => void;
    canUseKeyLockedTeleporter?: (teleporter: TeleporterRuntime) => boolean;
};

type RenderPadOptions = {
    ignoreKeyRequirement?: boolean;
    activeOnly?: boolean;
    inactiveOnly?: boolean;
    fixedProgress?: number;
    viewport?: TeleporterPadViewportFilter;
    proximity?: TeleporterPadProximityFilter;
};

const TELEPORTER_PAD_SWEEP_PHASES = [0, 0.28, 0.56, 0.82, 1] as const;
const TELEPORTER_PAD_SWEEP_FRAME_MS = 90;
const TELEPORTER_PAD_SWEEP_CACHE_LIMIT = 4096;

export function createTeleporterPadRuntime(runtimeOptions: TeleporterPadRuntimeOptions) {
    const teleporterTileSize = 32 * runtimeOptions.spriteScale;
    const teleporterPadSweepPositionCache = new Map<string, Position>();
    let teleporterPadCacheVersion = 0;
    let teleporterPadKeyCache: { version: number; keys: Set<string> } = { version: -1, keys: new Set<string>() };
    const teleporterPadFilteredMapCache = new WeakMap<MapBlock[], { version: number; filtered: MapBlock[] }>();
    let teleporterBlockIndexCache: TeleporterBlockIndex | null = null;
    const teleporterPadDrawEntities: TeleporterDrawEntity[] = [];

    function makeTeleporterPositionKey(x: number, y: number) {
        return `${x},${y}`;
    }

    function invalidateCaches() {
        teleporterPadCacheVersion += 1;
        teleporterPadSweepPositionCache.clear();
        teleporterPadKeyCache = { version: -1, keys: new Set<string>() };
        teleporterBlockIndexCache = null;
    }

    function getTeleporterBlockIndex() {
        if (teleporterBlockIndexCache && teleporterBlockIndexCache.version === teleporterPadCacheVersion) {
            return teleporterBlockIndexCache;
        }

        const baseBlocksById = new Map<string, MapBlock>();
        const padBlocksById = new Map<string, MapBlock>();
        const baseBlocksByPosition = new Map<string, MapBlock>();
        const padBlocksByPosition = new Map<string, MapBlock>();
        for (const block of runtimeOptions.getMapBlocks()) {
            if (block.type === 'teleporter') {
                baseBlocksByPosition.set(makeTeleporterPositionKey(block.x, block.y), block);
            } else if (block.type === 'teleporter_pad') {
                padBlocksByPosition.set(makeTeleporterPositionKey(block.x, block.y), block);
            } else {
                continue;
            }

            if (!block.teleporterId) {
                continue;
            }
            const id = String(block.teleporterId).trim();
            if (!id) {
                continue;
            }
            if (block.type === 'teleporter') {
                baseBlocksById.set(id, block);
            } else {
                padBlocksById.set(id, block);
            }
        }

        teleporterBlockIndexCache = {
            version: teleporterPadCacheVersion,
            baseBlocksById,
            padBlocksById,
            baseBlocksByPosition,
            padBlocksByPosition
        };
        return teleporterBlockIndexCache;
    }

    function isTeleporterActive(teleporter: TeleporterRuntime, options?: Pick<RenderPadOptions, 'ignoreKeyRequirement'>) {
        if (teleporter.enabled === false) {
            return false;
        }
        if (!options?.ignoreKeyRequirement && teleporter.requiresKey && !runtimeOptions.canUseKeyLockedTeleporter?.(teleporter)) {
            return false;
        }
        return true;
    }

    function getTeleporterActiveDestination(teleporter: TeleporterRuntime) {
        if (teleporter.activeDestinationIndex === 1 && teleporter.destinationB) {
            return teleporter.destinationB;
        }
        return teleporter.destinationA;
    }

    function getTeleporterBaseBlock(teleporter: TeleporterRuntime) {
        const block = getTeleporterBlockIndex()
            .baseBlocksByPosition
            .get(makeTeleporterPositionKey(teleporter.baseX, teleporter.baseY));
        return block ?? null;
    }

    function getTeleporterPadBlock(teleporter: TeleporterRuntime) {
        const block = getTeleporterBlockIndex()
            .padBlocksByPosition
            .get(makeTeleporterPositionKey(teleporter.padX, teleporter.padY));
        return block ?? null;
    }

    function getTeleporterPadSweepPosition(
        teleporter: TeleporterRuntime,
        progress: number,
        padRender: Pick<TeleporterRenderPad, 'palette' | 'rotation' | 'translation' | 'paletteCycle'>,
        baseBlock: MapBlock | null
    ) {
        const basePalette = typeof baseBlock?.palette === 'number' ? baseBlock.palette : padRender.palette;
        const baseRotation = typeof baseBlock?.rotation === 'number' ? baseBlock.rotation : 1;
        const baseTranslation = runtimeOptions.normalizeSpriteTranslation(baseBlock?.translation);
        const baseRendered = runtimeOptions.getRenderedEntityWorldSprite({
            x: teleporter.baseX,
            y: teleporter.baseY,
            type: 'teleporter',
            palette: basePalette,
            rotation: baseRotation,
            translation: baseTranslation,
            paletteCycle: baseBlock?.paletteCycle
        });
        const padProbe = runtimeOptions.getRenderedEntityWorldSprite({
            x: teleporter.baseX,
            y: teleporter.baseY,
            type: 'teleporter_pad',
            palette: padRender.palette,
            rotation: padRender.rotation,
            translation: padRender.translation,
            paletteCycle: padRender.paletteCycle
        });

        const baseBounds = baseRendered ? runtimeOptions.getSpriteVisibleBounds(baseRendered.canvas) : null;
        const padBounds = padProbe ? runtimeOptions.getSpriteVisibleBounds(padProbe.canvas) : null;
        const fallbackSpan = 32 * runtimeOptions.spriteScale;
        const tileLeft = teleporter.baseX;
        const tileTop = teleporter.baseY;
        const tileRight = tileLeft + fallbackSpan;
        const tileBottom = tileTop + fallbackSpan;
        const tileCenterX = tileLeft + fallbackSpan / 2;
        const tileCenterY = tileTop + fallbackSpan / 2;
        const baseVisibleLeft = baseRendered && baseBounds
            ? baseRendered.drawX + baseBounds.minX * runtimeOptions.spriteScale
            : tileLeft;
        const baseVisibleRight = baseRendered && baseBounds
            ? baseRendered.drawX + (baseBounds.maxX + 1) * runtimeOptions.spriteScale
            : tileRight;
        const baseVisibleTop = baseRendered && baseBounds
            ? baseRendered.drawY + baseBounds.minY * runtimeOptions.spriteScale
            : tileTop;
        const baseVisibleBottom = baseRendered && baseBounds
            ? baseRendered.drawY + (baseBounds.maxY + 1) * runtimeOptions.spriteScale
            : tileBottom;

        const normalizedRotation = Math.round(padRender.rotation);
        const sweepAxis = normalizedRotation === 2
            ? 'left'
            : normalizedRotation === 3
                ? 'up'
                : normalizedRotation === 4
                    ? 'right'
                    : normalizedRotation === 6 || normalizedRotation === 7
                        ? 'up'
                        : 'down';

        const padProbeAnchor = (() => {
            if (!padProbe || !padBounds) {
                return { x: teleporter.baseX, y: teleporter.baseY };
            }
            const left = padProbe.drawX + padBounds.minX * runtimeOptions.spriteScale;
            const right = padProbe.drawX + (padBounds.maxX + 1) * runtimeOptions.spriteScale;
            const top = padProbe.drawY + padBounds.minY * runtimeOptions.spriteScale;
            const bottom = padProbe.drawY + (padBounds.maxY + 1) * runtimeOptions.spriteScale;
            const centerX = (left + right) / 2;
            const centerY = (top + bottom) / 2;
            if (sweepAxis === 'left') {
                return { x: right, y: centerY };
            }
            if (sweepAxis === 'right') {
                return { x: left, y: centerY };
            }
            if (sweepAxis === 'up') {
                return { x: centerX, y: bottom };
            }
            return { x: centerX, y: top };
        })();
        const padAnchorOffsetX = padProbeAnchor.x - teleporter.baseX;
        const padAnchorOffsetY = padProbeAnchor.y - teleporter.baseY;

        const sweepStart = (() => {
            if (sweepAxis === 'left') {
                return { x: tileRight, y: tileCenterY };
            }
            if (sweepAxis === 'right') {
                return { x: tileLeft, y: tileCenterY };
            }
            if (sweepAxis === 'up') {
                return { x: tileCenterX, y: tileBottom };
            }
            return { x: tileCenterX, y: tileTop };
        })();
        const sweepEnd = (() => {
            if (sweepAxis === 'left') {
                return { x: Math.min(sweepStart.x, baseVisibleRight), y: sweepStart.y };
            }
            if (sweepAxis === 'right') {
                return { x: Math.max(sweepStart.x, baseVisibleLeft), y: sweepStart.y };
            }
            if (sweepAxis === 'up') {
                return { x: sweepStart.x, y: Math.min(sweepStart.y, baseVisibleBottom) };
            }
            return { x: sweepStart.x, y: Math.max(sweepStart.y, baseVisibleTop) };
        })();
        const fallbackSweepEnd = (() => {
            if (sweepAxis === 'left') {
                return { x: Math.max(tileLeft, Math.min(baseVisibleRight, tileRight)), y: sweepStart.y };
            }
            if (sweepAxis === 'right') {
                return { x: Math.min(tileRight, Math.max(baseVisibleLeft, tileLeft)), y: sweepStart.y };
            }
            if (sweepAxis === 'up') {
                return { x: sweepStart.x, y: Math.max(tileTop, Math.min(baseVisibleBottom, tileBottom)) };
            }
            return { x: sweepStart.x, y: Math.min(tileBottom, Math.max(baseVisibleTop, tileTop)) };
        })();
        const usesVerticalAxis = sweepAxis === 'up' || sweepAxis === 'down';
        const primarySpan = usesVerticalAxis
            ? Math.abs(sweepEnd.y - sweepStart.y)
            : Math.abs(sweepEnd.x - sweepStart.x);
        const effectiveSweepEnd = primarySpan >= 1 ? sweepEnd : fallbackSweepEnd;
        const desiredAnchor = {
            x: sweepStart.x + (effectiveSweepEnd.x - sweepStart.x) * progress,
            y: sweepStart.y + (effectiveSweepEnd.y - sweepStart.y) * progress
        };

        return {
            x: desiredAnchor.x - padAnchorOffsetX,
            y: desiredAnchor.y - padAnchorOffsetY
        };
    }

    function isTeleporterInViewport(teleporter: TeleporterRuntime, viewport: TeleporterPadViewportFilter) {
        const margin = Math.max(0, viewport.margin ?? 0);
        const left = viewport.x - margin;
        const top = viewport.y - margin;
        const right = viewport.x + viewport.width + margin;
        const bottom = viewport.y + viewport.height + margin;
        const candidates = [
            { x: teleporter.baseX, y: teleporter.baseY },
            { x: teleporter.padX, y: teleporter.padY }
        ];
        for (const candidate of candidates) {
            if (
                candidate.x + teleporterTileSize >= left &&
                candidate.x <= right &&
                candidate.y + teleporterTileSize >= top &&
                candidate.y <= bottom
            ) {
                return true;
            }
        }
        return false;
    }

    function isTeleporterNearPoint(teleporter: TeleporterRuntime, proximity: TeleporterPadProximityFilter) {
        const radius = Math.max(0, proximity.radius);
        const radiusSquared = radius * radius;
        const candidates = [
            { x: teleporter.baseX + teleporterTileSize / 2, y: teleporter.baseY + teleporterTileSize / 2 },
            { x: teleporter.padX + teleporterTileSize / 2, y: teleporter.padY + teleporterTileSize / 2 }
        ];
        for (const candidate of candidates) {
            const dx = candidate.x - proximity.x;
            const dy = candidate.y - proximity.y;
            if ((dx * dx + dy * dy) <= radiusSquared) {
                return true;
            }
        }
        return false;
    }

    function getRenderPads(
        now: number,
        renderOptions?: RenderPadOptions
    ): TeleporterRenderPad[] {
        const renderPads: TeleporterRenderPad[] = [];
        const sweepProgress = typeof renderOptions?.fixedProgress === 'number'
            ? Math.max(0, Math.min(1, renderOptions.fixedProgress))
            : (() => {
                const frameIndex = Math.floor(now / TELEPORTER_PAD_SWEEP_FRAME_MS) % TELEPORTER_PAD_SWEEP_PHASES.length;
                return TELEPORTER_PAD_SWEEP_PHASES[frameIndex];
            })();
        const { baseBlocksById, padBlocksById } = getTeleporterBlockIndex();
        for (const teleporter of runtimeOptions.getTeleporters()) {
            if (renderOptions?.viewport && !isTeleporterInViewport(teleporter, renderOptions.viewport)) {
                continue;
            }
            if (renderOptions?.proximity && !isTeleporterNearPoint(teleporter, renderOptions.proximity)) {
                continue;
            }
            const active = isTeleporterActive(teleporter, renderOptions);
            if (renderOptions?.activeOnly && !active) {
                continue;
            }
            if (renderOptions?.inactiveOnly && active) {
                continue;
            }
            const baseBlock = baseBlocksById.get(teleporter.id)
                ?? getTeleporterBaseBlock(teleporter);
            const padBlock = padBlocksById.get(teleporter.id)
                ?? getTeleporterPadBlock(teleporter);
            const palette = typeof padBlock?.palette === 'number'
                ? padBlock.palette
                : (typeof baseBlock?.palette === 'number' ? baseBlock.palette : 0);
            const rotation = typeof padBlock?.rotation === 'number'
                ? padBlock.rotation
                : (typeof baseBlock?.rotation === 'number' ? baseBlock.rotation : 1);
            const translation = runtimeOptions.normalizeSpriteTranslation(padBlock?.translation ?? baseBlock?.translation);
            const paletteCycle = padBlock?.paletteCycle;
            const baseRotation = typeof baseBlock?.rotation === 'number' ? baseBlock.rotation : 1;
            const basePalette = typeof baseBlock?.palette === 'number' ? baseBlock.palette : palette;
            const baseTranslation = runtimeOptions.normalizeSpriteTranslation(baseBlock?.translation);
            const padCycleKey = paletteCycle && Array.isArray(paletteCycle.palettes)
                ? `${paletteCycle.intervalMs ?? 0}:${paletteCycle.palettes.join(',')}`
                : 'none';
            const progress = !active && !renderOptions?.activeOnly
                ? 1
                : sweepProgress;
            const progressBucketForPad = Math.round(progress * 1000);
            const positionCacheKey = [
                teleporter.id,
                teleporter.baseX,
                teleporter.baseY,
                teleporter.padX,
                teleporter.padY,
                progressBucketForPad,
                palette,
                rotation,
                translation,
                basePalette,
                baseRotation,
                baseTranslation,
                padCycleKey
            ].join('|');
            let position = teleporterPadSweepPositionCache.get(positionCacheKey);
            if (!position) {
                position = getTeleporterPadSweepPosition(teleporter, progress, {
                    palette,
                    rotation,
                    translation,
                    paletteCycle
                }, baseBlock);
                if (teleporterPadSweepPositionCache.size >= TELEPORTER_PAD_SWEEP_CACHE_LIMIT) {
                    teleporterPadSweepPositionCache.clear();
                }
                teleporterPadSweepPositionCache.set(positionCacheKey, position);
            }
            renderPads.push({
                teleporter,
                active,
                x: position.x,
                y: position.y,
                palette,
                rotation,
                translation,
                paletteCycle
            });
        }
        return renderPads;
    }

    function getTeleporterPadKeySet() {
        if (teleporterPadKeyCache.version === teleporterPadCacheVersion) {
            return teleporterPadKeyCache.keys;
        }
        const keys = new Set<string>();
        for (const teleporter of runtimeOptions.getTeleporters()) {
            keys.add(makeTeleporterPositionKey(teleporter.padX, teleporter.padY));
        }
        teleporterPadKeyCache = { version: teleporterPadCacheVersion, keys };
        return keys;
    }

    function filterTeleporterPadsFromBlocks(blocks: MapBlock[], teleporterPadKeys: Set<string>) {
        if (teleporterPadKeys.size === 0 || blocks.length === 0) {
            return blocks;
        }
        const cached = teleporterPadFilteredMapCache.get(blocks);
        if (cached && cached.version === teleporterPadCacheVersion) {
            return cached.filtered;
        }
        const filtered = blocks.filter((block) =>
            block.type !== 'teleporter_pad' || !teleporterPadKeys.has(makeTeleporterPositionKey(block.x, block.y))
        );
        teleporterPadFilteredMapCache.set(blocks, { version: teleporterPadCacheVersion, filtered });
        return filtered;
    }

    function drawTeleporterPads(
        context: CanvasRenderingContext2D,
        camera: Position,
        now: number,
        drawOptions?: { ignoreKeyRequirement?: boolean }
    ) {
        const canvasSize = runtimeOptions.getCanvasSize();
        const viewport = {
            x: camera.x,
            y: camera.y,
            width: canvasSize.width,
            height: canvasSize.height,
            margin: teleporterTileSize * 2
        };
        const pads = getRenderPads(now, {
            ignoreKeyRequirement: drawOptions?.ignoreKeyRequirement,
            viewport
        });
        if (pads.length === 0) {
            return;
        }
        teleporterPadDrawEntities.length = 0;
        const pushPad = (pad: TeleporterRenderPad) => {
            const nextIndex = teleporterPadDrawEntities.length;
            const entity = teleporterPadDrawEntities[nextIndex] ?? {
                x: 0,
                y: 0,
                type: 'teleporter_pad' as const,
                palette: 0,
                rotation: 1,
                translation: 'center' as SpriteTranslation,
                collision: false as const
            };
            entity.x = pad.x;
            entity.y = pad.y;
            entity.palette = pad.palette;
            entity.rotation = pad.rotation;
            entity.translation = pad.translation;
            entity.paletteCycle = pad.paletteCycle;
            teleporterPadDrawEntities[nextIndex] = entity;
        };
        for (const pad of pads) {
            if (!pad.active) {
                pushPad(pad);
            }
        }
        for (const pad of pads) {
            if (pad.active) {
                pushPad(pad);
            }
        }
        const previousAlpha = context.globalAlpha;
        context.globalAlpha = previousAlpha * 0.82;
        runtimeOptions.drawEntities(
            context,
            camera,
            teleporterPadDrawEntities,
            now
        );
        context.globalAlpha = previousAlpha;
    }

    return {
        getTileSize: () => teleporterTileSize,
        invalidateCaches,
        getTeleporterPadKeySet,
        filterTeleporterPadsFromBlocks,
        drawTeleporterPads,
        getRenderPads,
        getTeleporterActiveDestination
    };
}
