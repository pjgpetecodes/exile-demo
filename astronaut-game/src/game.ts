// Main entry point for the astronaut game
import {
    Astronaut,
    ChunkActivityBand,
    ChunkActivityRadii,
    CreatureFireMode,
    CreatureProjectileKind,
    CreatureProjectileRuntimeData,
    GameState,
    PaletteCycleSettings,
    Position,
    TeleporterDestinationMode,
    TeleporterSaveData
} from './types/index.js';
import {
    astronaut, resetAstronaut, resetAstronautToPosition, flipAstronaut, handleAstronautMovement, applyLandingMomentum, getAstronautCollisionOffsets, setAstronautCollisionProfile,
    getAstronautStartPosition, setAstronautStartPosition,
    walkSpeed, facingLeft, upPressed, downPressed, leftPressed, rightPressed,
    checkAstronautCollisions
} from './astronaut.js';
import { applyGravity } from './gravity.js';
import {
    DynamicObjectPhysicsSettings,
    applyDynamicObjectGravity,
    applyDynamicObjectGroundFriction,
    getDynamicObjectBounceRestitution,
    getDynamicObjectHeadBounceLaunchSpeed,
    getDynamicObjectPushedVelocity,
    getDynamicObjectPushScale
} from './object-physics.js';
import {
    clearMapSpriteCache,
    mapBlocks,
    type MapBlock,
    mapLoaded,
    loadMapBlocks,
    drawMap,
    ensureMapChunksAroundWorldPosition,
    getBlockAtWorld,
    getBlackBackgroundBlocks,
    getMapBlocksBehindAstronaut,
    getMapBlocksMaskAstronaut,
    getMushroomBlocks,
    getRenderableMapBlocks,
    rebuildMapBlockRenderCache,
    materializeAllMapChunksForSave,
    prefetchMapChunksAroundWorldPosition,
    syncMapChunksForViewport
} from './map.js';
import { initStars, updateAndDrawStars } from './stars.js';
import { emitJetpackDots, updateAndDrawJetpackDots, resetJetpackDotEmitTimer, hasActiveJetpackDots } from './jetpack.js';
import { Button } from './button.js';
import {
    getDefaultDestructibleEnabled,
    getDefaultDestructibleHealth,
    getDefaultDestructionSource,
    type DestructionSourceRequirement
} from './destructibles.js';
import { Door } from './door.js';
import { Creature, getCreatureAuthoredType, toCreatureSaveData } from './creature.js';
import { Collectable, getDefaultGrenadeExplosionPower, isGrenadeCollectableType } from './collectable.js';
import { makeBlackTransparent, remapSpritePalette, calculateSpriteCollisionBoundingBoxes, 
calculateAstronautSpriteBoundingBoxes, getSolidBlockAtWorld, getAnyBlockAtWorld, 
drawEntities, getSpriteTranslationOffset, getSpriteVisibleBounds, getTransformedSpriteCanvas,
getVisibleCenterRotationOffset, getRenderedEntitySpriteCanvas, normalizeSpriteTranslation, SpriteTranslation
} from './utilities.js';
import {
    CHUNK_ACTIVITY_SETTINGS,
    BULLET_IMPACT_AUDIO_SETTINGS,
    type BulletImpactAudioSettings,
    CREATURE_PROJECTILE_SETTINGS,
    MOVEMENT_SETTINGS,
    VIEWPORT_SETTINGS
} from './settings.js';
import { ChunkActivityManager } from './chunk-activity-manager.js';
import {
    SPRITE_ROW, SPRITE_COL_STAND, SPRITE_COL_FLY_RIGHT, SPRITE_COL_FLY_DIAGONAL,
    SPRITE_COL_FLY_FLOAT, SPRITE_COL_FLY_DOWN, SPRITE_COL_WALK_START, SPRITE_COL_WALK_RIGHT1,
    SPRITE_COL_WALK_RIGHT2, SPRITE_COL_WALK_END, TELEPORT_ANIM_FRAMES, MAP_WIDTH, MAP_HEIGHT,
    SPRITE_SCALE, rememberSound, teleportSound, buttonOnSound, doorOpenSound, doorCloseSound, getSound, saveSound, bulletExplosionSound, bulletExplosion2Sound, grenadeArmedSound, mushroomsSound, ouchSounds, creatureManifestSounds,
    setMapBounds,
    getSoundEnabled, setSoundEnabled, toggleSoundEnabled
} from './constants.js';
import {
    createWorldDesigner,
    LayerVisibility,
    PaletteDefinition,
    RawWorldData,
    SpriteCatalogEntry,
    SpriteSheetNormalizationReport,
    WorldDesigner
} from './world-designer.js';

// Instead of dynamic import, fetch the JSON file at runtime for browser compatibility
let spriteMap: any;

async function loadSpriteMap() {
    const res = await fetch('./src/assets/exile_sprites_map.json');
    spriteMap = await res.json();
}

let rawPaletteDefinitions: PaletteDefinition[] = [];
let palettes: Array<{ from: [number, number, number], to: [number, number, number] }[]> = [];
let remappedSpriteSheets: CanvasImageSource[] = [];
let colorAliases: Record<string, [number, number, number]> = {};
const customPalettePreviewCache = new Map<string, CanvasImageSource>();
const WORLD_BOUNDS_PADDING = Math.ceil(32 * SPRITE_SCALE * 2);
const COLLECTABLE_PHYSICS_SETTINGS = {
    gravity: MOVEMENT_SETTINGS.collectableGravity,
    terminalVelocity: MOVEMENT_SETTINGS.collectableTerminalVelocity,
    bounceRestitution: MOVEMENT_SETTINGS.collectableBounceRestitution,
    bounceMinImpactSpeed: MOVEMENT_SETTINGS.collectableBounceMinImpactSpeed,
    bounceWeightPenaltyPerUnit: MOVEMENT_SETTINGS.collectableBounceWeightPenaltyPerUnit,
    groundFriction: MOVEMENT_SETTINGS.collectableGroundFriction,
    pushVelocityMultiplier: MOVEMENT_SETTINGS.collectablePushVelocityMultiplier,
    pushMaxSpeed: MOVEMENT_SETTINGS.collectablePushMaxSpeed,
    pushResistancePerUnit: MOVEMENT_SETTINGS.collectablePushResistancePerUnit,
    pushMinScale: MOVEMENT_SETTINGS.collectablePushMinScale,
    headBounceMinImpactSpeed: MOVEMENT_SETTINGS.headBounceMinImpactSpeed,
    headBounceMaxLaunchSpeed: MOVEMENT_SETTINGS.collectableHeadBounceMaxLaunchSpeed
} as const;
const BIRD_ANIMATION_FRAMES = ['bird1', 'bird2', 'bird3', 'bird4'] as const;
const BIRD_ANIMATION_FRAME_DURATION_MS = 90;
const BIRD_TRACK_RELEASE_RANGE_MULTIPLIER = 1.75;
const BIRD_TRACK_RELEASE_RANGE_PADDING = 96;
const BIRD_AVOIDANCE_VERTICAL_THRESHOLD = 12;
const HELD_COLLECTABLE_HAND_INSET = 4 * SPRITE_SCALE;
const HELD_COLLECTABLE_HAND_OVERLAP = -12;
const MUSHROOM_AMBIENT_RANGE = 360;
const MUSHROOM_AMBIENT_BASE_VOLUME = 0.6;
const MUSHROOM_AMBIENT_MIN_DELAY_MS = 180;
const MUSHROOM_AMBIENT_MAX_DELAY_MS = 420;

function getCreatureProjectilePhysicsSettings(collectable: Pick<Collectable, 'bounciness' | 'creatureProjectile'>) {
    const projectileKind = collectable.creatureProjectile?.kind;
    const projectileSettings = projectileKind ? getProjectileSettings(projectileKind) : null;
    return {
        ...COLLECTABLE_PHYSICS_SETTINGS,
        gravity: MOVEMENT_SETTINGS.creatureProjectileGravity * (projectileSettings?.gravityScale ?? 1),
        terminalVelocity: MOVEMENT_SETTINGS.creatureProjectileTerminalVelocity,
        bounceRestitution: Math.max(0, collectable.bounciness),
        headBounceMaxLaunchSpeed: 0
    } as const;
}

function getCollectablePhysicsSettings(collectable: Pick<Collectable, 'bounciness' | 'creatureProjectile'>) {
    return collectable.creatureProjectile
        ? getCreatureProjectilePhysicsSettings(collectable)
        : COLLECTABLE_PHYSICS_SETTINGS;
}

function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
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
    if (Object.keys(colorAliases).length > 0) return;
    colorAliases = await fetchFreshJson('./src/assets/colors.json');
}

function resolveColor(color: string | [number, number, number]): [number, number, number] {
    if (typeof color === "string") {
        return colorAliases[color] || [0, 0, 0];
    }
    return color;
}

async function loadPalettes() {
    await loadColorAliases();
    rawPaletteDefinitions = await fetchFreshJson<PaletteDefinition[]>('./src/assets/palettes.json');
    palettes = rawPaletteDefinitions.map((palette) =>
        palette.map(({ from, to }) => ({
            from: resolveColor(from),
            to: resolveColor(to)
        }))
    );
}

function rebuildRemappedSpriteSheets() {
    if (!spriteSheet) return;
    customPalettePreviewCache.clear();
    clearMapSpriteCache();
    remappedSpriteSheets = palettes.map((palette) => remapSpritePalette(spriteSheet, palette));
    astronautSpriteSource = remappedSpriteSheets[1] || remappedSpriteSheets[0] || spriteSheet;
}

function applyPaletteDefinitions(definitions: PaletteDefinition[]) {
    rawPaletteDefinitions = deepClone(definitions);
    palettes = rawPaletteDefinitions.map((palette) =>
        palette.map(({ from, to }) => ({
            from: resolveColor(from),
            to: resolveColor(to)
        }))
    );
    rebuildRemappedSpriteSheets();
}

function shouldBlockBrowserShortcut(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey)) {
        return false;
    }
    const key = event.key.toLowerCase();
    return key === 'p' || key === 'w' || event.code === 'KeyP' || event.code === 'KeyW';
}

function blockBrowserShortcut(event: KeyboardEvent) {
    if (!shouldBlockBrowserShortcut(event)) {
        return false;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
}

function getInputKey(event: KeyboardEvent) {
    if (event.code === 'Space') {
        return ' ';
    }
    if (event.key.length === 1) {
        return event.key.toLowerCase();
    }
    return event.key;
}

document.addEventListener('keydown', (event) => {
    blockBrowserShortcut(event);
}, { capture: true });

window.addEventListener('keydown', (event) => {
    if (blockBrowserShortcut(event)) {
        event.preventDefault();
        return;
    }
    const key = getInputKey(event);
    if (key === ' ') {
        event.preventDefault();
    }
    keys[key] = true;
    requestImmediateFrame();
});

window.addEventListener('keyup', (event) => {
    const key = getInputKey(event);
    if (key === ' ') {
        event.preventDefault();
    }
    keys[key] = false;
    requestImmediateFrame();
});

// --- Mouse tracking for debug ---
let mouseScreen = { x: 0, y: 0 };
let mouseWorld = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseScreen.x = e.clientX - rect.left;
    mouseScreen.y = e.clientY - rect.top;
    if (gameState.debugMode) {
        requestImmediateFrame();
    }
});

document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
        requestImmediateFrame();
    }
});

window.addEventListener('keydown', (e) => {
    if (isDesignerOpen()) return;
    if (e.key === "Tab") {
        e.preventDefault(); // Prevent tab from bubbling to browser
        if (currentAstronautRenderState.flipVertical) {
            layDownVerticalFlipToggled = !layDownVerticalFlipToggled;
        } else {
            flipAstronaut();
            layDownVerticalFlipToggled = false;
        }
        requestImmediateFrame();
    }
});

// --- Camera ---
function getCameraOffset() {
    if (worldDesigner?.isActive()) {
        return worldDesigner.getCamera();
    }
    // Center astronaut on screen
    return {
        x: astronaut.position.x - canvas.width / 2,
        y: astronaut.position.y - canvas.height / 2
    };
}

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

if (!canvas || !ctx) {
    throw new Error('Canvas or 2D context not found');
}

canvas.width = VIEWPORT_SETTINGS.defaultWidth;
canvas.height = VIEWPORT_SETTINGS.defaultHeight;

let gameState: GameState & { debugMode: boolean } = {
    astronaut,
    gravity: MOVEMENT_SETTINGS.gravity,
    trail: [],
    isRunning: true,
    debugMode: false
};

const IDLE_FRAME_DELAY_MS = 125;
const HIDDEN_FRAME_DELAY_MS = 500;
const ACTIVE_MOTION_EPSILON = 0.05;

type ScheduledFrameMode = 'raf' | 'timeout' | null;

let scheduledFrameMode: ScheduledFrameMode = null;
let scheduledFrameHandle: number | null = null;
let isGameLoopRunning = false;
const PERF_WINDOW_SIZE = 180;
const PERF_CONSOLE_SUMMARY_INTERVAL_MS = 5000;
let showPerformanceHud = false;
let showPerformanceConsoleSummary = false;
let lastPerformanceConsoleSummaryAt = 0;
let perfSampleCount = 0;
let perfSampleIndex = 0;
let lastFrameTimestamp: number | null = null;
const perfFrameTimes = new Float32Array(PERF_WINDOW_SIZE);
const perfUpdateTimes = new Float32Array(PERF_WINDOW_SIZE);
const perfMapDrawTimes = new Float32Array(PERF_WINDOW_SIZE);
const perfEntityDrawTimes = new Float32Array(PERF_WINDOW_SIZE);
const perfTotalFrameTimes = new Float32Array(PERF_WINDOW_SIZE);
let perfFrameTimeSum = 0;
let perfUpdateTimeSum = 0;
let perfMapDrawTimeSum = 0;
let perfEntityDrawTimeSum = 0;
let perfTotalFrameTimeSum = 0;
let perfWorstFrameTime = 0;
let perfWorstUpdateTime = 0;
let perfWorstMapDrawTime = 0;
let perfWorstEntityDrawTime = 0;
let perfWorstTotalFrameTime = 0;

let spriteSheet: HTMLImageElement;
let astronautSpriteSource: CanvasImageSource; // Use this for astronaut rendering
let walkAnimFrame = SPRITE_COL_WALK_START;
let walkAnimTimer = 0;

// Flying direction change animation state
let flyHoldTimer = 0;
let flyDir: 'left' | 'right' | null = null;
let flySwitching = false;
let flySwitchStep = 0;
let flySwitchTimer = 0;

// Add fly down transition state variables
let flyDownTransitioning = false;
let flyDownTransitionStep = 0;
let flyDownTransitionTimer = 0;
let flyDownTravelDir: 'left' | 'right' | null = null;
let flyDownFacingLeft = false;
let flyDownMode: 'direct' | 'diagonal' | null = null;
let lastFlySpriteCol = SPRITE_COL_FLY_RIGHT; // Track last flying sprite col
let lastFlyFlipSprite = false; // Track the currently displayed flying flip state

// --- Teleport memory ---
type TeleportLocation = { x: number, y: number };
const teleportLocations: TeleportLocation[] = [];
let teleportSlot = 0;
let defaultTeleportLocation: TeleportLocation = { ...getAstronautStartPosition() };
let teleporting = false;
let teleportAnimFrame = 0;
let teleportPhase: 'none' | 'out' | 'in' = 'none';
let teleportTarget: TeleportLocation | null = null;
let teleportSpriteCol = SPRITE_COL_STAND;
let teleportFlipSprite = false;
let teleportFlipVertical = false;

// --- Input state ---
const keys: Record<string, boolean> = {};
let prevKeys: Record<string, boolean> = {}

function hasPressedKeys() {
    for (const key in keys) {
        if (keys[key]) {
            return true;
        }
    }
    return false;
}

function hasMovingCollectables() {
    return collectableEntities.some((collectable) =>
        !collectable.stored &&
        (
            collectable.armed ||
            collectable.held ||
            !collectable.isGrounded ||
            Math.abs(collectable.velocity.x) > ACTIVE_MOTION_EPSILON ||
            Math.abs(collectable.velocity.y) > ACTIVE_MOTION_EPSILON ||
            collectable.astronautCollisionIgnoreFrames > 0
        )
    );
}

function hasActiveCreatureWork() {
    return creatureEntities.length > 0 || collectableEntities.some(isCreatureProjectileCollectable);
}

function shouldRunInteractiveFrameRate() {
    if (isDesignerOpen()) {
        return true;
    }

    return (
        hasPressedKeys() ||
        teleporting ||
        flySwitching ||
        flyDownTransitioning ||
        throwGuideDots.length > 0 ||
        hasActiveJetpackDots() ||
        doorEntities.some((door) => door.animating) ||
        hasActiveCreatureWork() ||
        hasMovingCollectables() ||
        !astronaut.isLanded ||
        astronaut.energy < astronaut.maxEnergy ||
        Math.abs(astronaut.velocity.x) > ACTIVE_MOTION_EPSILON ||
        Math.abs(astronaut.velocity.y) > ACTIVE_MOTION_EPSILON ||
        Math.abs(walkSpeed) > ACTIVE_MOTION_EPSILON
    );
}

function clearScheduledFrame() {
    if (scheduledFrameMode === 'raf' && scheduledFrameHandle !== null) {
        window.cancelAnimationFrame(scheduledFrameHandle);
    } else if (scheduledFrameMode === 'timeout' && scheduledFrameHandle !== null) {
        window.clearTimeout(scheduledFrameHandle);
    }

    scheduledFrameMode = null;
    scheduledFrameHandle = null;
}

function requestImmediateFrame() {
    if (!gameState.isRunning || !mapLoaded || scheduledFrameMode === 'raf') {
        return;
    }

    if (scheduledFrameMode === 'timeout') {
        clearScheduledFrame();
    }

    scheduledFrameMode = 'raf';
    scheduledFrameHandle = window.requestAnimationFrame(() => {
        scheduledFrameMode = null;
        scheduledFrameHandle = null;
        void gameLoop();
    });
}

function scheduleNextFrame() {
    if (!gameState.isRunning || !mapLoaded || scheduledFrameMode !== null) {
        return;
    }

    const delayMs = document.visibilityState === 'hidden'
        ? HIDDEN_FRAME_DELAY_MS
        : (shouldRunInteractiveFrameRate() ? 0 : IDLE_FRAME_DELAY_MS);

    if (delayMs === 0) {
        requestImmediateFrame();
        return;
    }

    scheduledFrameMode = 'timeout';
    scheduledFrameHandle = window.setTimeout(() => {
        scheduledFrameMode = null;
        scheduledFrameHandle = null;
        requestImmediateFrame();
    }, delayMs);
}

function isPerformanceInstrumentationEnabled() {
    return showPerformanceHud || showPerformanceConsoleSummary;
}

function recomputeWorstPerformanceSample(buffer: Float32Array) {
    let worst = 0;
    for (let index = 0; index < perfSampleCount; index++) {
        if (buffer[index] > worst) {
            worst = buffer[index];
        }
    }
    return worst;
}

function formatPerfSummaryLine(label: string, averageMs: number, worstMs: number) {
    return `${label} ${averageMs.toFixed(2)}ms avg / ${worstMs.toFixed(2)}ms worst`;
}

function recordPerformanceFrameSample(
    frameTimeMs: number,
    updateWorkMs: number,
    mapDrawMs: number,
    entityEffectsDrawMs: number,
    totalFrameMs: number,
    frameNow: number
) {
    const replacingExistingSample = perfSampleCount === PERF_WINDOW_SIZE;
    const replaceIndex = perfSampleIndex;
    const replacedFrameTime = perfFrameTimes[replaceIndex];
    const replacedUpdateTime = perfUpdateTimes[replaceIndex];
    const replacedMapDrawTime = perfMapDrawTimes[replaceIndex];
    const replacedEntityDrawTime = perfEntityDrawTimes[replaceIndex];
    const replacedTotalFrameTime = perfTotalFrameTimes[replaceIndex];

    if (replacingExistingSample) {
        perfFrameTimeSum -= replacedFrameTime;
        perfUpdateTimeSum -= replacedUpdateTime;
        perfMapDrawTimeSum -= replacedMapDrawTime;
        perfEntityDrawTimeSum -= replacedEntityDrawTime;
        perfTotalFrameTimeSum -= replacedTotalFrameTime;
    } else {
        perfSampleCount++;
    }

    perfFrameTimes[replaceIndex] = frameTimeMs;
    perfUpdateTimes[replaceIndex] = updateWorkMs;
    perfMapDrawTimes[replaceIndex] = mapDrawMs;
    perfEntityDrawTimes[replaceIndex] = entityEffectsDrawMs;
    perfTotalFrameTimes[replaceIndex] = totalFrameMs;
    perfFrameTimeSum += frameTimeMs;
    perfUpdateTimeSum += updateWorkMs;
    perfMapDrawTimeSum += mapDrawMs;
    perfEntityDrawTimeSum += entityEffectsDrawMs;
    perfTotalFrameTimeSum += totalFrameMs;

    if (frameTimeMs >= perfWorstFrameTime) {
        perfWorstFrameTime = frameTimeMs;
    } else if (replacingExistingSample && replacedFrameTime >= perfWorstFrameTime) {
        perfWorstFrameTime = recomputeWorstPerformanceSample(perfFrameTimes);
    }

    if (updateWorkMs >= perfWorstUpdateTime) {
        perfWorstUpdateTime = updateWorkMs;
    } else if (replacingExistingSample && replacedUpdateTime >= perfWorstUpdateTime) {
        perfWorstUpdateTime = recomputeWorstPerformanceSample(perfUpdateTimes);
    }

    if (mapDrawMs >= perfWorstMapDrawTime) {
        perfWorstMapDrawTime = mapDrawMs;
    } else if (replacingExistingSample && replacedMapDrawTime >= perfWorstMapDrawTime) {
        perfWorstMapDrawTime = recomputeWorstPerformanceSample(perfMapDrawTimes);
    }

    if (entityEffectsDrawMs >= perfWorstEntityDrawTime) {
        perfWorstEntityDrawTime = entityEffectsDrawMs;
    } else if (replacingExistingSample && replacedEntityDrawTime >= perfWorstEntityDrawTime) {
        perfWorstEntityDrawTime = recomputeWorstPerformanceSample(perfEntityDrawTimes);
    }

    if (totalFrameMs >= perfWorstTotalFrameTime) {
        perfWorstTotalFrameTime = totalFrameMs;
    } else if (replacingExistingSample && replacedTotalFrameTime >= perfWorstTotalFrameTime) {
        perfWorstTotalFrameTime = recomputeWorstPerformanceSample(perfTotalFrameTimes);
    }

    perfSampleIndex = (perfSampleIndex + 1) % PERF_WINDOW_SIZE;

    if (
        showPerformanceConsoleSummary &&
        frameNow - lastPerformanceConsoleSummaryAt >= PERF_CONSOLE_SUMMARY_INTERVAL_MS
    ) {
        const sampleCount = Math.max(perfSampleCount, 1);
        console.info(
            `[perf][${navigator.userAgent.includes('Firefox') ? 'Firefox' : (navigator.userAgent.includes('Edg') ? 'Edge' : 'Other')}] ` +
            `${formatPerfSummaryLine('frame', perfFrameTimeSum / sampleCount, perfWorstFrameTime)} | ` +
            `${formatPerfSummaryLine('update', perfUpdateTimeSum / sampleCount, perfWorstUpdateTime)} | ` +
            `${formatPerfSummaryLine('map', perfMapDrawTimeSum / sampleCount, perfWorstMapDrawTime)} | ` +
            `${formatPerfSummaryLine('entities', perfEntityDrawTimeSum / sampleCount, perfWorstEntityDrawTime)} | ` +
            `${formatPerfSummaryLine('total', perfTotalFrameTimeSum / sampleCount, perfWorstTotalFrameTime)}`
        );
        lastPerformanceConsoleSummaryAt = frameNow;
    }
}

function finalizePerformanceInstrumentationFrame(
    frameNow: number,
    frameStartMs: number,
    frameTimeMs: number,
    updateWorkMs: number,
    mapDrawMs: number,
    drawPhaseMs: number
) {
    if (!isPerformanceInstrumentationEnabled()) {
        return;
    }

    const entityEffectsDrawMs = Math.max(0, drawPhaseMs - mapDrawMs);
    const totalFrameMs = performance.now() - frameStartMs;
    recordPerformanceFrameSample(frameTimeMs, updateWorkMs, mapDrawMs, entityEffectsDrawMs, totalFrameMs, frameNow);
}

function resetFlySwitchAnimationState() {
    flySwitching = false;
    flySwitchStep = 0;
    flySwitchTimer = 0;
}

function resetFlyDownAnimationState() {
    flyDownTransitioning = false;
    flyDownTransitionStep = 0;
    flyDownTransitionTimer = 0;
    flyDownTravelDir = null;
    flyDownMode = null;
}

function syncDefaultTeleportLocation(position: Position) {
    defaultTeleportLocation = {
        x: Math.round(position.x),
        y: Math.round(position.y)
    };
}

function updateAstronautStartPosition(position: Position, applyToAstronaut: boolean = false) {
    setAstronautStartPosition(position, applyToAstronaut);
    syncDefaultTeleportLocation(position);
}

function popLatestTeleportLocation() {
    if (teleportLocations.length > 0) {
        const location = teleportLocations.pop()!;
        if (teleportSlot > teleportLocations.length) {
            teleportSlot = teleportLocations.length;
        }
        return location;
    }
    return { ...defaultTeleportLocation };
}

function startTeleportToLocation(location: TeleportLocation) {
    if (teleporting) {
        return false;
    }

    prefetchMapChunksAroundWorldPosition(astronaut.position, 1);
    prefetchMapChunksAroundWorldPosition(location, 2);
    chunkActivityManager.markTeleportKeepAlive(
        astronaut.position,
        location,
        performance.now()
    );
    teleporting = true;
    teleportPhase = 'out';
    teleportAnimFrame = 0;
    teleportTarget = location;
    teleportSpriteCol = currentAstronautRenderState.spriteCol;
    teleportFlipSprite = currentAstronautRenderState.flipSprite;
    teleportFlipVertical = currentAstronautRenderState.flipVertical;
    try { teleportSound.currentTime = 0; teleportSound.play(); } catch {}
    requestImmediateFrame();
    return true;
}

function getAstronautInjuryRatio() {
    if (astronaut.maxEnergy <= 0) {
        return 0;
    }
    return Math.max(0, 1 - astronaut.energy / astronaut.maxEnergy);
}

function isAstronautDamageFlashVisible(now: number) {
    const injuryRatio = getAstronautInjuryRatio();
    if (injuryRatio <= 0) {
        return false;
    }

    const flashIntervalMs = MOVEMENT_SETTINGS.astronautDamageFlashMaxIntervalMs - injuryRatio * (
        MOVEMENT_SETTINGS.astronautDamageFlashMaxIntervalMs - MOVEMENT_SETTINGS.astronautDamageFlashMinIntervalMs
    );
    return Math.floor(now / flashIntervalMs) % 2 === 0;
}

function drawAstronautDamageFlashOverlay(
    context: CanvasRenderingContext2D,
    drawW: number,
    drawH: number,
    now: number
) {
    if (!isAstronautDamageFlashVisible(now)) {
        return;
    }

    context.save();
    context.globalCompositeOperation = 'source-atop';
    context.fillStyle = 'rgba(255, 255, 255, 0.85)';
    context.fillRect(-drawW / 2, -drawH / 2, drawW, drawH);
    context.restore();
}

function drawAstronautSprite(
    context: CanvasRenderingContext2D,
    spriteRect: { x: number; y: number; w: number; h: number },
    drawW: number,
    drawH: number,
    now: number
) {
    const frameCanvas = getAstronautSpriteFrameCanvas(spriteRect);
    if (!frameCanvas) {
        return;
    }
    context.imageSmoothingEnabled = false;

    if (!isAstronautDamageFlashVisible(now)) {
        context.drawImage(
            frameCanvas,
            -drawW / 2,
            -drawH / 2,
            drawW, drawH
        );
        return;
    }

    const flashCanvas = document.createElement('canvas');
    flashCanvas.width = Math.max(1, Math.round(drawW));
    flashCanvas.height = Math.max(1, Math.round(drawH));
    const flashContext = flashCanvas.getContext('2d');
    if (!flashContext) {
        context.drawImage(
            frameCanvas,
            -drawW / 2,
            -drawH / 2,
            drawW, drawH
        );
        return;
    }

    flashContext.imageSmoothingEnabled = false;
    flashContext.drawImage(
        frameCanvas,
        0,
        0,
        flashCanvas.width,
        flashCanvas.height
    );
    flashContext.globalCompositeOperation = 'source-atop';
    flashContext.fillStyle = 'rgba(255, 255, 255, 0.85)';
    flashContext.fillRect(0, 0, flashCanvas.width, flashCanvas.height);
    context.drawImage(
        flashCanvas,
        -drawW / 2,
        -drawH / 2,
        drawW,
        drawH
    );
}

function updateAstronautEnergyRecovery(now: number) {
    if (teleporting || astronaut.energy >= astronaut.maxEnergy) {
        return;
    }

    const nextRegenAt = astronaut.nextEnergyRegenAtMs ?? (now + MOVEMENT_SETTINGS.astronautEnergyRegenIntervalMs);
    if (now < nextRegenAt) {
        astronaut.nextEnergyRegenAtMs = nextRegenAt;
        return;
    }

    const intervalMs = MOVEMENT_SETTINGS.astronautEnergyRegenIntervalMs;
    const regenSteps = Math.floor((now - nextRegenAt) / intervalMs) + 1;
    astronaut.energy = Math.min(
        astronaut.maxEnergy,
        astronaut.energy + regenSteps * MOVEMENT_SETTINGS.astronautEnergyRegenAmount
    );
    astronaut.nextEnergyRegenAtMs = nextRegenAt + regenSteps * intervalMs;
}

function triggerAstronautEmergencyTeleport() {
    if (teleporting) {
        return;
    }

    releaseHeldCollectable();
    astronaut.energy = Math.min(
        astronaut.maxEnergy,
        Math.max(1, MOVEMENT_SETTINGS.astronautEmergencyTeleportEnergy)
    );
    startTeleportToLocation(popLatestTeleportLocation());
}

function applyAstronautDamage(amount: number, now: number = performance.now()) {
    if (amount <= 0 || teleporting) {
        return;
    }

    const scaledDamage = amount * MOVEMENT_SETTINGS.astronautDamageIntakeMultiplier;
    astronaut.energy = Math.max(0, astronaut.energy - scaledDamage);
    astronaut.nextEnergyRegenAtMs = now + MOVEMENT_SETTINGS.astronautEnergyRegenIntervalMs;
    if (astronaut.energy <= 0) {
        triggerAstronautEmergencyTeleport();
    }
}

function rememberLastFlyPose(col: number, flip: boolean) {
    lastFlySpriteCol = col;
    lastFlyFlipSprite = flip;
}

function getDirectDownTransitionSequence(targetFacingLeft: boolean) {
    const startCol =
        lastFlySpriteCol === SPRITE_COL_FLY_RIGHT ||
        lastFlySpriteCol === SPRITE_COL_FLY_DIAGONAL ||
        lastFlySpriteCol === SPRITE_COL_FLY_DOWN ||
        lastFlySpriteCol === SPRITE_COL_FLY_FLOAT
            ? lastFlySpriteCol
            : SPRITE_COL_STAND;

    const startFlip =
        startCol === SPRITE_COL_FLY_DOWN
            ? lastFlyFlipSprite
            : startCol === SPRITE_COL_STAND
                ? targetFacingLeft
                : lastFlyFlipSprite;

    if (
        startCol === SPRITE_COL_FLY_RIGHT ||
        startCol === SPRITE_COL_FLY_DIAGONAL ||
        startCol === SPRITE_COL_FLY_FLOAT
    ) {
        return [
            { col: startCol, flip: startFlip, flipVertical: false },
            { col: SPRITE_COL_FLY_DOWN, flip: targetFacingLeft, flipVertical: false },
            { col: SPRITE_COL_STAND, flip: targetFacingLeft, flipVertical: true }
        ];
    }

    return [
        { col: startCol, flip: startFlip, flipVertical: false },
        { col: SPRITE_COL_STAND, flip: targetFacingLeft, flipVertical: true }
    ];
}

function getHorizontalTravelDirection(keys: Record<string, boolean>): 'left' | 'right' | null {
    if (keys['q'] && !keys['w']) {
        return 'left';
    }
    if (keys['w'] && !keys['q']) {
        return 'right';
    }
    if (Math.abs(astronaut.velocity.x) > 0.01) {
        return astronaut.velocity.x < 0 ? 'left' : 'right';
    }
    if (leftPressed !== rightPressed) {
        return leftPressed ? 'left' : 'right';
    }
    return null;
}

function getAstronautFacingDirectionForFlyPose(keys: Record<string, boolean>): 'left' | 'right' {
    const travelDirection = getHorizontalTravelDirection(keys);
    if (travelDirection) {
        return travelDirection;
    }
    if (Math.abs(astronaut.velocity.x) > 0.01) {
        return astronaut.velocity.x < 0 ? 'left' : 'right';
    }
    return facingLeft ? 'left' : 'right';
}

// --- Black background block toggles ---
let showBlackBackgroundBlocks = false; // c key
let hideBlackBackgroundBlocks = false; // v key

window.addEventListener('keydown', (e) => {
    if (isDesignerOpen()) return;
    if (e.key === 'c' && !prevKeys['c']) {
        showBlackBackgroundBlocks = !showBlackBackgroundBlocks;
    }
    if (e.key === 'v' && !prevKeys['v']) {
        hideBlackBackgroundBlocks = !hideBlackBackgroundBlocks;
    }
});

// --- Entity arrays ---
let buttonEntities: Button[] = [];
let doorEntities: Door[] = [];
let creatureEntities: Creature[] = [];
let collectableEntities: Collectable[] = [];
let teleporterEntities: TeleporterRuntime[] = [];
let teleporterTouchCooldownUntilMs = 0;
let heldCollectable: Collectable | null = null;
let storedCollectables: Collectable[] = [];
let inventoryCycleIndex = -1;
let throwAngleDegrees = 20;
type ThrowGuideDot = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
    hueDrift: number;
    flickerOffset: number;
};
type CreatureProjectileCollectable = Collectable & {
    creatureProjectile: CreatureProjectileRuntimeData;
};
type ProjectileImpactEffect = {
    x: number;
    y: number;
    centerX: number;
    centerY: number;
    type: string;
    palette: number;
    rotation: number;
    frameIndex: number;
    frameTimer: number;
    frames: string[];
    frameDurationFrames: number;
};
type DoorDestructionEffect = {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    translation?: string | null;
    state?: Record<string, unknown>;
    flipAroundVisibleCenter?: boolean;
    angleDegrees: number;
    vx: number;
    vy: number;
    spinVelocity: number;
    life: number;
    maxLife: number;
};
type TeleporterRuntime = Required<Omit<TeleporterSaveData, 'destinationB'>> & {
    destinationB: Position | null;
    activeDestinationIndex: 0 | 1;
};
type TeleporterRenderPad = {
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

const TELEPORTER_PAD_SWEEP_PHASES = [0, 0.28, 0.56, 0.82, 1] as const;
const TELEPORTER_PAD_SWEEP_FRAME_MS = 90;
const TELEPORTER_TILE_SIZE = 32 * SPRITE_SCALE;
const TELEPORTER_PAD_SWEEP_CACHE_LIMIT = 4096;
const teleporterPadSweepPositionCache = new Map<string, Position>();
let teleporterPadCacheVersion = 0;
let teleporterPadKeyCache: { version: number; keys: Set<string> } = { version: -1, keys: new Set<string>() };
const teleporterPadFilteredMapCache = new WeakMap<MapBlock[], { version: number; filtered: MapBlock[] }>();
let teleporterBlockIndexCache:
    | {
        version: number;
        baseBlocksById: Map<string, MapBlock>;
        padBlocksById: Map<string, MapBlock>;
        baseBlocksByPosition: Map<string, MapBlock>;
        padBlocksByPosition: Map<string, MapBlock>;
    }
    | null = null;
const teleporterPadDrawEntities: Array<{
    x: number;
    y: number;
    type: 'teleporter_pad';
    palette: number;
    rotation: number;
    translation: SpriteTranslation;
    paletteCycle?: PaletteCycleSettings;
    collision: false;
}> = [];
type BulletImpactParticle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    life: number;
    maxLife: number;
};
type DestructibleRuntimeEntity = {
    x: number;
    y: number;
    type: string;
    palette?: string | number;
    destructible?: boolean;
    destructionHealth?: number;
    destructionSource?: DestructionSourceRequirement;
};
let throwGuideDots: ThrowGuideDot[] = [];
let throwGuideDotEmitTimer = 0;
let projectileImpactEffects: ProjectileImpactEffect[] = [];
let doorDestructionEffects: DoorDestructionEffect[] = [];
let bulletImpactParticles: BulletImpactParticle[] = [];
let destructibleDamageByEntity = new WeakMap<object, number>();
let bulletImpactAudioSettings: BulletImpactAudioSettings = { ...BULLET_IMPACT_AUDIO_SETTINGS };
let grenadeArmedLoopActive = false;
let nextMushroomAmbientAt = 0;
let worldDesigner: WorldDesigner | null = null;
let saveSnapshotInProgress = false;
const STARFIELD_HEIGHT = Math.min(MAP_HEIGHT, 2000);
const BULLET_IMPACT_PARTICLE_COLORS = ['#ffffff', '#ffff00', '#ff00ff', '#00ffff', '#0000ff', '#ff0000'];
const BULLET_DAZE_DURATION_MS = 380;
const BULLET_DAZE_WALK_SCALE = 0.45;
const BULLET_DAZE_FLIGHT_SCALE = 0.35;
let currentAstronautRenderState = {
    spriteCol: SPRITE_COL_STAND,
    flipSprite: false,
    flipVertical: false
};
let layDownVerticalFlipToggled = false;
const chunkActivityManager = new ChunkActivityManager({
    chunkWorldSize: CHUNK_ACTIVITY_SETTINGS.chunkWorldSize,
    radiiChunks: deepClone(CHUNK_ACTIVITY_SETTINGS.radiiChunks),
    viewportRadiusScale: deepClone(CHUNK_ACTIVITY_SETTINGS.viewportRadiusScale),
    teleportKeepAliveMs: CHUNK_ACTIVITY_SETTINGS.teleportKeepAliveMs
});
let currentAstronautChunkActivity: ChunkActivityBand = 'near';
type ChunkSimulationCadencePolicy = Record<ChunkActivityBand, number>;
type ChunkActivityCadenceGroup = {
    creatures: ChunkSimulationCadencePolicy;
    collectables: ChunkSimulationCadencePolicy;
    projectiles: ChunkSimulationCadencePolicy;
    teleporters: ChunkSimulationCadencePolicy;
};
type ChunkActivityTuningSnapshot = {
    radiiChunks: ChunkActivityRadii;
    viewportRadiusScale: ChunkActivityRadii;
    teleportKeepAliveMs: number;
    simulationCadenceFrames: ChunkActivityCadenceGroup;
};
type ChunkActivityCadenceUpdate = Partial<Record<ChunkActivityBand, number>>;
type ChunkActivityTuningUpdate = {
    radiiChunks?: Partial<ChunkActivityRadii>;
    viewportRadiusScale?: Partial<ChunkActivityRadii>;
    teleportKeepAliveMs?: number;
    simulationCadenceFrames?: {
        creatures?: ChunkActivityCadenceUpdate;
        collectables?: ChunkActivityCadenceUpdate;
        projectiles?: ChunkActivityCadenceUpdate;
        teleporters?: ChunkActivityCadenceUpdate;
    };
};
const DEFAULT_CHUNK_ACTIVITY_TUNING: ChunkActivityTuningSnapshot = {
    radiiChunks: deepClone(CHUNK_ACTIVITY_SETTINGS.radiiChunks),
    viewportRadiusScale: deepClone(CHUNK_ACTIVITY_SETTINGS.viewportRadiusScale),
    teleportKeepAliveMs: CHUNK_ACTIVITY_SETTINGS.teleportKeepAliveMs,
    simulationCadenceFrames: {
        creatures: deepClone(CHUNK_ACTIVITY_SETTINGS.simulationCadenceFrames.creatures),
        collectables: deepClone(CHUNK_ACTIVITY_SETTINGS.simulationCadenceFrames.collectables),
        projectiles: deepClone(CHUNK_ACTIVITY_SETTINGS.simulationCadenceFrames.projectiles),
        teleporters: deepClone(CHUNK_ACTIVITY_SETTINGS.simulationCadenceFrames.teleporters)
    }
};
const chunkActivityTuning: ChunkActivityTuningSnapshot = deepClone(DEFAULT_CHUNK_ACTIVITY_TUNING);
const CREATURE_CHUNK_CADENCE: ChunkSimulationCadencePolicy = {
    near: chunkActivityTuning.simulationCadenceFrames.creatures.near,
    mid: chunkActivityTuning.simulationCadenceFrames.creatures.mid,
    far: chunkActivityTuning.simulationCadenceFrames.creatures.far
};
const COLLECTABLE_CHUNK_CADENCE: ChunkSimulationCadencePolicy = {
    near: chunkActivityTuning.simulationCadenceFrames.collectables.near,
    mid: chunkActivityTuning.simulationCadenceFrames.collectables.mid,
    far: chunkActivityTuning.simulationCadenceFrames.collectables.far
};
const PROJECTILE_CHUNK_CADENCE: ChunkSimulationCadencePolicy = {
    near: chunkActivityTuning.simulationCadenceFrames.projectiles.near,
    mid: chunkActivityTuning.simulationCadenceFrames.projectiles.mid,
    far: chunkActivityTuning.simulationCadenceFrames.projectiles.far
};
const TELEPORTER_CHUNK_CADENCE: ChunkSimulationCadencePolicy = {
    near: chunkActivityTuning.simulationCadenceFrames.teleporters.near,
    mid: chunkActivityTuning.simulationCadenceFrames.teleporters.mid,
    far: chunkActivityTuning.simulationCadenceFrames.teleporters.far
};

function sanitizeChunkBandRadius(value: number, fallback: number) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function sanitizeViewportRadiusScale(value: number, fallback: number) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sanitizeCadenceFrames(value: number, fallback: number) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function applyCadenceUpdate(
    targetCadence: ChunkSimulationCadencePolicy,
    updateCadence: ChunkActivityCadenceUpdate | undefined
) {
    if (!updateCadence) {
        return;
    }
    targetCadence.near = sanitizeCadenceFrames(updateCadence.near ?? targetCadence.near, targetCadence.near);
    targetCadence.mid = sanitizeCadenceFrames(updateCadence.mid ?? targetCadence.mid, targetCadence.mid);
    targetCadence.far = sanitizeCadenceFrames(updateCadence.far ?? targetCadence.far, targetCadence.far);
}

function applyChunkActivityTuning(update: ChunkActivityTuningUpdate) {
    if (update.radiiChunks) {
        const near = sanitizeChunkBandRadius(
            update.radiiChunks.near ?? chunkActivityTuning.radiiChunks.near,
            chunkActivityTuning.radiiChunks.near
        );
        const mid = Math.max(
            near,
            sanitizeChunkBandRadius(
                update.radiiChunks.mid ?? chunkActivityTuning.radiiChunks.mid,
                chunkActivityTuning.radiiChunks.mid
            )
        );
        chunkActivityTuning.radiiChunks = { near, mid };
    }
    if (update.viewportRadiusScale) {
        chunkActivityTuning.viewportRadiusScale = {
            near: sanitizeViewportRadiusScale(
                update.viewportRadiusScale.near ?? chunkActivityTuning.viewportRadiusScale.near,
                chunkActivityTuning.viewportRadiusScale.near
            ),
            mid: sanitizeViewportRadiusScale(
                update.viewportRadiusScale.mid ?? chunkActivityTuning.viewportRadiusScale.mid,
                chunkActivityTuning.viewportRadiusScale.mid
            )
        };
    }
    if (typeof update.teleportKeepAliveMs === 'number') {
        chunkActivityTuning.teleportKeepAliveMs = Math.max(0, Math.floor(update.teleportKeepAliveMs));
    }
    if (update.simulationCadenceFrames) {
        applyCadenceUpdate(chunkActivityTuning.simulationCadenceFrames.creatures, update.simulationCadenceFrames.creatures);
        applyCadenceUpdate(chunkActivityTuning.simulationCadenceFrames.collectables, update.simulationCadenceFrames.collectables);
        applyCadenceUpdate(chunkActivityTuning.simulationCadenceFrames.projectiles, update.simulationCadenceFrames.projectiles);
        applyCadenceUpdate(chunkActivityTuning.simulationCadenceFrames.teleporters, update.simulationCadenceFrames.teleporters);
    }

    chunkActivityManager.updateConfig({
        radiiChunks: chunkActivityTuning.radiiChunks,
        viewportRadiusScale: chunkActivityTuning.viewportRadiusScale,
        teleportKeepAliveMs: chunkActivityTuning.teleportKeepAliveMs
    });
    Object.assign(CREATURE_CHUNK_CADENCE, chunkActivityTuning.simulationCadenceFrames.creatures);
    Object.assign(COLLECTABLE_CHUNK_CADENCE, chunkActivityTuning.simulationCadenceFrames.collectables);
    Object.assign(PROJECTILE_CHUNK_CADENCE, chunkActivityTuning.simulationCadenceFrames.projectiles);
    Object.assign(TELEPORTER_CHUNK_CADENCE, chunkActivityTuning.simulationCadenceFrames.teleporters);
}

function resetChunkActivityTuning() {
    chunkActivityTuning.radiiChunks = deepClone(DEFAULT_CHUNK_ACTIVITY_TUNING.radiiChunks);
    chunkActivityTuning.viewportRadiusScale = deepClone(DEFAULT_CHUNK_ACTIVITY_TUNING.viewportRadiusScale);
    chunkActivityTuning.teleportKeepAliveMs = DEFAULT_CHUNK_ACTIVITY_TUNING.teleportKeepAliveMs;
    chunkActivityTuning.simulationCadenceFrames = deepClone(DEFAULT_CHUNK_ACTIVITY_TUNING.simulationCadenceFrames);
    applyChunkActivityTuning({});
}

function getChunkActivityTuningSnapshot() {
    return {
        ...deepClone(chunkActivityTuning),
        manager: chunkActivityManager.getConfigSnapshot()
    };
}
type EffectiveViewportState = {
    width: number;
    height: number;
    zoom: number;
    prefetchRadiusChunks: number;
};

function clampViewportZoom(value: number) {
    const minZoom = CHUNK_ACTIVITY_SETTINGS.effectiveViewport.minZoom;
    const maxZoom = CHUNK_ACTIVITY_SETTINGS.effectiveViewport.maxZoom;
    return Math.min(maxZoom, Math.max(minZoom, value));
}

function getEffectiveViewportState(): EffectiveViewportState {
    const width = Math.max(1, canvas.width);
    const height = Math.max(1, canvas.height);
    const expandedViewActive = worldDesigner?.isActive() === true && worldDesigner.isViewportExpanded();
    const configuredZoom = expandedViewActive
        ? CHUNK_ACTIVITY_SETTINGS.effectiveViewport.expandedViewZoom
        : CHUNK_ACTIVITY_SETTINGS.effectiveViewport.defaultZoom;
    const zoom = clampViewportZoom(configuredZoom);
    const viewportWidthWorld = Math.max(1, width / zoom);
    const viewportHeightWorld = Math.max(1, height / zoom);
    const viewportChunkRadius = Math.max(
        0,
        Math.ceil(
            Math.max(viewportWidthWorld, viewportHeightWorld)
            / CHUNK_ACTIVITY_SETTINGS.chunkWorldSize
            / 2
        )
    );
    const residencySettings = CHUNK_ACTIVITY_SETTINGS.chunkResidency;
    const viewportExpansionChunks = Math.max(
        0,
        viewportChunkRadius - residencySettings.viewportChunkRadiusBaseline
    );
    const expandedViewExtraChunks = expandedViewActive
        ? residencySettings.expandedViewExtraRadiusChunks
        : 0;
    const prefetchRadiusChunks = Math.min(
        residencySettings.maxPrefetchRadiusChunks,
        Math.max(
            0,
            residencySettings.basePrefetchRadiusChunks
            + Math.ceil(viewportExpansionChunks * residencySettings.viewportExpansionRadiusScale)
            + expandedViewExtraChunks
        )
    );

    return {
        width,
        height,
        zoom,
        prefetchRadiusChunks
    };
}
let simulationFrameCounter = 0;
const CHUNK_SYNC_INTERVAL_FRAMES = 2;
let chunkSyncFrameCounter = 0;
const astronautSpriteFrameCache = new Map<string, HTMLCanvasElement>();

function getAstronautSpriteFrameCanvas(spriteRect: { x: number; y: number; w: number; h: number }) {
    const spriteSource = astronautSpriteSource || spriteSheet;
    if (!spriteSource) {
        return null;
    }
    const cacheKey = `${spriteRect.x},${spriteRect.y},${spriteRect.w},${spriteRect.h}`;
    const cached = astronautSpriteFrameCache.get(cacheKey);
    if (cached) {
        return cached;
    }
    const frameCanvas = document.createElement('canvas');
    frameCanvas.width = Math.max(1, spriteRect.w);
    frameCanvas.height = Math.max(1, spriteRect.h);
    const frameContext = frameCanvas.getContext('2d');
    if (!frameContext) {
        return null;
    }
    frameContext.imageSmoothingEnabled = false;
    frameContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
    frameContext.drawImage(
        spriteSource,
        spriteRect.x, spriteRect.y, spriteRect.w, spriteRect.h,
        0, 0, frameCanvas.width, frameCanvas.height
    );
    astronautSpriteFrameCache.set(cacheKey, frameCanvas);
    return frameCanvas;
}

(window as any).__exileDebug = {
    getButtons: () => buttonEntities,
    getSelectedDesignerSelection: () => worldDesigner?.getDebugSelection() ?? null,
    getSelectedDesignerButton: () => {
        const selection = worldDesigner?.getDebugSelection() ?? null;
        return selection?.category === 'buttons' ? selection.entity : null;
    },
    chunkActivity: {
        getTuning: () => getChunkActivityTuningSnapshot(),
        setTuning: (update: ChunkActivityTuningUpdate) => {
            applyChunkActivityTuning(update ?? {});
            return getChunkActivityTuningSnapshot();
        },
        resetTuning: () => {
            resetChunkActivityTuning();
            return getChunkActivityTuningSnapshot();
        }
    }
};

function isDesignerOpen() {
    return !!worldDesigner?.isActive();
}

window.addEventListener('keydown', (event) => {
    if (event.altKey && event.key === 'Enter' && !event.repeat) {
        event.preventDefault();
        if (worldDesigner) {
            worldDesigner.setViewportExpanded(!worldDesigner.isViewportExpanded());
        }
    }
    if (event.ctrlKey && event.key.toLowerCase() === 'm' && !event.repeat) {
        event.preventDefault();
        toggleSoundEnabled();
    }
});

function getCurrentAstronautCollisionProfile() {
    if (astronaut.isLanded) {
        return 'stand';
    }

    if (downPressed && !keys['q'] && !keys['w']) {
        return 'stand';
    }
    if (downPressed && (keys['q'] || keys['w'])) {
        return 'fly_down';
    }
    if (leftPressed || rightPressed) {
        return upPressed ? 'fly_diagonal' : 'fly_right';
    }
    if (Math.abs(astronaut.velocity.x) > 0.01) {
        return 'fly_float';
    }

    return upPressed ? 'fly_diagonal' : 'fly_float';
}

// --- Button press debounce state ---
const buttonPressTimestamps: WeakMap<Button, number> = new WeakMap();

// --- Entity loaders ---
export let nextEntityId = 1;
export function assignEntityId(obj: any) {
    obj.entityId = nextEntityId++;
    return obj;
}

function normalizeTeleporter(data: any): TeleporterRuntime {
    const destinationA = {
        x: Math.round(Number(data?.destinationA?.x) || 0),
        y: Math.round(Number(data?.destinationA?.y) || 0)
    };
    const destinationB = data?.destinationB
        ? {
            x: Math.round(Number(data.destinationB.x) || 0),
            y: Math.round(Number(data.destinationB.y) || 0)
        }
        : null;
    const activeDestinationIndex = data?.activeDestinationIndex === 1 && destinationB ? 1 : 0;
    return {
        id: typeof data?.id === 'string' && data.id.trim().length > 0
            ? data.id.trim()
            : `teleporter_${Math.round(Number(data?.padX) || 0)}_${Math.round(Number(data?.padY) || 0)}`,
        baseX: Math.round(Number(data?.baseX) || 0),
        baseY: Math.round(Number(data?.baseY) || 0),
        padX: Math.round(Number(data?.padX) || 0),
        padY: Math.round(Number(data?.padY) || 0),
        enabled: data?.enabled !== false,
        requiresKey: data?.requiresKey === true,
        destinationA,
        destinationB,
        activeDestinationIndex
    };
}

function toRoundedPosition(value: any, fallback: Position) {
    const x = Math.round(Number(value?.x));
    const y = Math.round(Number(value?.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { x: Math.round(fallback.x), y: Math.round(fallback.y) };
    }
    return { x, y };
}

function buildTeleportersFromMapMetadata() {
    const grouped = new Map<string, { base?: MapBlock; pad?: MapBlock }>();
    for (const block of mapBlocks) {
        if ((block.type !== 'teleporter' && block.type !== 'teleporter_pad') || !block.teleporterId) {
            continue;
        }
        const id = String(block.teleporterId).trim();
        if (!id) {
            continue;
        }
        const entry = grouped.get(id) ?? {};
        if (block.type === 'teleporter') {
            entry.base = block;
        } else {
            entry.pad = block;
        }
        grouped.set(id, entry);
    }
    const fallbackDestination = getAstronautStartPosition();
    const reconstructed: TeleporterRuntime[] = [];
    for (const [id, parts] of grouped.entries()) {
        if (!parts.base || !parts.pad) {
            continue;
        }
        const base = parts.base;
        const pad = parts.pad;
        const destinationA = toRoundedPosition(
            base.teleporterDestinationA ?? pad.teleporterDestinationA,
            fallbackDestination
        );
        const destinationBSource = base.teleporterDestinationB ?? pad.teleporterDestinationB;
        const destinationB = destinationBSource
            ? toRoundedPosition(destinationBSource, destinationA)
            : null;
        const activeDestinationIndex = (base.teleporterActiveDestinationIndex ?? pad.teleporterActiveDestinationIndex) === 1 && destinationB
            ? 1
            : 0;
        reconstructed.push(normalizeTeleporter({
            id,
            baseX: base.x,
            baseY: base.y,
            padX: pad.x,
            padY: pad.y,
            enabled: (base.teleporterEnabled ?? pad.teleporterEnabled) !== false,
            requiresKey: (base.teleporterRequiresKey ?? pad.teleporterRequiresKey) === true,
            destinationA,
            destinationB,
            activeDestinationIndex
        }));
    }
    return reconstructed;
}

function findNearestMapBlockByType(
    type: 'teleporter' | 'teleporter_pad',
    targetX: number,
    targetY: number,
    maxDistance: number
) {
    const maxDistanceSquared = maxDistance * maxDistance;
    let best: MapBlock | null = null;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const block of mapBlocks) {
        if (block.type !== type) {
            continue;
        }
        const dx = targetX - block.x;
        const dy = targetY - block.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= maxDistanceSquared && distanceSquared < bestDistanceSquared) {
            best = block;
            bestDistanceSquared = distanceSquared;
        }
    }
    return best;
}

function findMapBlockByTeleporterId(
    type: 'teleporter' | 'teleporter_pad',
    teleporterId: string,
    targetX: number,
    targetY: number
) {
    const candidates = mapBlocks.filter((block) =>
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

function reconcileTeleporterRuntimePositions(teleporters: TeleporterRuntime[]) {
    const correctionDistancePx = 32 * 1.5;
    for (const teleporter of teleporters) {
        const baseById = findMapBlockByTeleporterId('teleporter', teleporter.id, teleporter.baseX, teleporter.baseY);
        const padById = findMapBlockByTeleporterId('teleporter_pad', teleporter.id, teleporter.padX, teleporter.padY);
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
        const hasBaseAtPosition = mapBlocks.some((block) =>
            block.type === 'teleporter' &&
            block.x === teleporter.baseX &&
            block.y === teleporter.baseY
        );
        if (!hasBaseAtPosition) {
            const correctedBase = findNearestMapBlockByType(
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

        const hasPadAtPosition = mapBlocks.some((block) =>
            block.type === 'teleporter_pad' &&
            block.x === teleporter.padX &&
            block.y === teleporter.padY
        );
        if (!hasPadAtPosition) {
            const correctedPad = findNearestMapBlockByType(
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
    }
}

async function loadTeleporters() {
    const arr = await fetchFreshJson<any[]>('./src/assets/teleporters.json');
    teleporterEntities = arr.length > 0
        ? arr.map(normalizeTeleporter)
        : buildTeleportersFromMapMetadata();
    reconcileTeleporterRuntimePositions(teleporterEntities);
    invalidateTeleporterPadCaches();
}

async function loadButtons() {
    const arr = await fetchFreshJson<any[]>('./src/assets/buttons.json');
    buttonEntities = arr.map((data: any) => assignEntityId(new Button(data)));
    syncButtonStatesToDoors();
}

function syncButtonStatesToDoors() {
    for (const button of buttonEntities) {
        if (worldDesigner?.isActive() && !worldDesigner.isPreviewMode()) {
            button.active = button.defaultActive ?? button.active ?? false;
            continue;
        }
        if (!Array.isArray(button.linkedDoors) || button.linkedDoors.length === 0) {
            continue;
        }

        button.active = button.linkedDoors.some((doorID) =>
            doorEntities.some((door) => door.doorID === doorID && door.locked)
        );
    }
}

function applyButtonTeleporterMode(teleporter: TeleporterRuntime, mode: TeleporterDestinationMode) {
    if (mode === 'enable') {
        teleporter.enabled = true;
        return;
    }
    if (mode === 'disable') {
        teleporter.enabled = false;
        return;
    }
    if (mode === 'toggle_enabled') {
        teleporter.enabled = teleporter.enabled === false;
        return;
    }
    if (mode === 'destination_a') {
        teleporter.activeDestinationIndex = 0;
        return;
    }
    if (mode === 'destination_b') {
        if (teleporter.destinationB) {
            teleporter.activeDestinationIndex = 1;
        }
        return;
    }
    if (teleporter.destinationB) {
        teleporter.activeDestinationIndex = teleporter.activeDestinationIndex === 0 ? 1 : 0;
    } else {
        teleporter.activeDestinationIndex = 0;
    }
}

function applyButtonTeleporterLinks(button: Button) {
    if (!Array.isArray(button.linkedTeleporters) || button.linkedTeleporters.length === 0) {
        return;
    }
    const mode: TeleporterDestinationMode = button.teleporterMode ?? 'toggle';
    for (const teleporterId of button.linkedTeleporters) {
        const teleporter = teleporterEntities.find((entry) => entry.id === teleporterId);
        if (teleporter) {
            applyButtonTeleporterMode(teleporter, mode);
        }
    }
}
async function loadDoors() {
    const arr = await fetchFreshJson<any[]>('./src/assets/doors.json');
    doorEntities = arr.map((data: any) => assignEntityId(new Door(data)));
}
async function loadCreatures() {
    const arr = await fetchFreshJson<any[]>('./src/assets/creatures.json');
    creatureEntities = arr.map((data: any) => assignEntityId(new Creature(data)));
}
async function loadCollectables() {
    const arr = await fetchFreshJson<any[]>('./src/assets/collectables.json');
    collectableEntities = arr.map((data: any) => assignEntityId(new Collectable(data)));
    syncCollectableRuntimeState();
}

async function loadAstronautStartPosition() {
    const data = await fetchFreshJson<Position>('./src/assets/astronaut_start.json');
    updateAstronautStartPosition(data, true);
}

function syncCollectableRuntimeState() {
    storedCollectables = collectableEntities.filter(collectable => collectable.stored);
    heldCollectable = collectableEntities.find(collectable => collectable.held) ?? null;
    inventoryCycleIndex = storedCollectables.length > 0 ? storedCollectables.length - 1 : -1;
    const now = performance.now();
    for (const collectable of collectableEntities) {
        syncGrenadeFuseState(collectable, now);
    }
}

function isCreatureProjectileCollectable(collectable: Collectable): collectable is CreatureProjectileCollectable {
    return !!collectable.creatureProjectile;
}

function getCreatureProjectileCollectables() {
    return collectableEntities.filter(isCreatureProjectileCollectable);
}

function getRenderableCollectables() {
    return collectableEntities.filter((collectable) =>
        !isCreatureProjectileCollectable(collectable) &&
        !collectable.stored &&
        !collectable.held
    );
}

function getDesignerRenderableCollectables() {
    return collectableEntities.filter((collectable) =>
        !isCreatureProjectileCollectable(collectable) &&
        !collectable.held
    );
}

function getSavableCollectables() {
    return collectableEntities.filter((collectable) => !isCreatureProjectileCollectable(collectable));
}

function findSpriteRectByType(type: string) {
    if (!spriteMap) return null;
    if (spriteMap instanceof Array) {
        for (const row of spriteMap) {
            for (const sprite of row) {
                if (sprite.name === type) {
                    return sprite;
                }
            }
        }
        return null;
    }
    return spriteMap[type] || null;
}

function getPaletteSheet(palette: number, fallbackPalette?: number) {
    const paletteIndex = Number.isFinite(palette) && palette >= 0 && palette < remappedSpriteSheets.length
        ? palette
        : (Number.isFinite(fallbackPalette) ? fallbackPalette! : 0);
    return remappedSpriteSheets[paletteIndex] || remappedSpriteSheets[0] || null;
}

function getEntityPreviewSheet(entity: { palette?: number }) {
    return getPaletteSheet(typeof entity.palette === 'number' ? entity.palette : 0);
}

function assignRotatedBoundingBoxes(arr: any[]) {
    for (const entity of arr) {
        const type = entity.type;
        const rotation = typeof entity.rotation === "number" ? entity.rotation : 0;
        let bbox =
            (worldMapRotatedBoundingBoxes[type] && worldMapRotatedBoundingBoxes[type][rotation]) ||
            worldMapBoundingBoxes[type];
        if (!bbox) {
            const rect = findSpriteRectByType(type);
            if (rect) {
                bbox = {
                    minX: 0,
                    minY: 0,
                    maxX: rect.w - 1,
                    maxY: rect.h - 1,
                    width: rect.w,
                    height: rect.h
                };
            }
        }
        if (bbox) {
            blockInstanceRotatedBoundingBoxes.set(entity, bbox);
        }
    }
}

function rebuildBlockInstanceBoundingBoxes() {
    blockInstanceRotatedBoundingBoxes = new WeakMap();
    assignRotatedBoundingBoxes(mapBlocks);
    assignRotatedBoundingBoxes(doorEntities);
    assignRotatedBoundingBoxes(buttonEntities);
    assignRotatedBoundingBoxes(creatureEntities);
    assignRotatedBoundingBoxes(collectableEntities);
}

function syncRuntimeMapBounds() {
    let maxRight = 0;
    let maxBottom = 0;
    const approximateEntitySpan = Math.ceil(32 * SPRITE_SCALE);
    const considerEntities = (entities: Array<{ x: number; y: number }>) => {
        for (const entity of entities) {
            if (!Number.isFinite(entity.x) || !Number.isFinite(entity.y)) {
                continue;
            }
            maxRight = Math.max(maxRight, entity.x + approximateEntitySpan);
            maxBottom = Math.max(maxBottom, entity.y + approximateEntitySpan);
        }
    };

    considerEntities(mapBlocks);
    considerEntities(doorEntities);
    considerEntities(buttonEntities);
    considerEntities(creatureEntities);
    considerEntities(collectableEntities);

    const astronautStart = getAstronautStartPosition();
    if (Number.isFinite(astronautStart.x) && Number.isFinite(astronautStart.y)) {
        maxRight = Math.max(maxRight, astronautStart.x + approximateEntitySpan);
        maxBottom = Math.max(maxBottom, astronautStart.y + approximateEntitySpan);
    }

    setMapBounds(
        Math.max(MAP_WIDTH, maxRight + WORLD_BOUNDS_PADDING),
        Math.max(MAP_HEIGHT, maxBottom + WORLD_BOUNDS_PADDING)
    );
}

function ensureWorldBounds(width: number, height: number) {
    setMapBounds(
        Math.max(MAP_WIDTH, Math.round(width)),
        Math.max(MAP_HEIGHT, Math.round(height))
    );
}

function afterWorldDataMutated() {
    syncButtonStatesToDoors();
    syncCollectableRuntimeState();
    rebuildMapBlockRenderCache();
    rebuildBlockInstanceBoundingBoxes();
    syncRuntimeMapBounds();
    initStars(MAP_WIDTH, Math.min(MAP_HEIGHT, 2000));
    invalidateTeleporterPadCaches();
}

function clampCamera(camera: Position) {
    return {
        x: Math.max(0, Math.min(camera.x, Math.max(0, MAP_WIDTH - canvas.width))),
        y: Math.max(0, Math.min(camera.y, Math.max(0, MAP_HEIGHT - canvas.height)))
    };
}

function drawWorldBoundingBoxOverlay(
    context: CanvasRenderingContext2D,
    camera: Position,
    layerVisibility: LayerVisibility = {
        world: true,
        buttons: true,
        doors: true,
        creatures: true,
        collectables: true,
        custom: true
    }
) {
    context.save();
    context.strokeStyle = 'lime';
    context.lineWidth = 2;

    const drawWorldBBox = (entity: any) => {
        if (!entity.collision) return;
        const bounds = getEntityCollisionBounds(entity);
        context.strokeRect(
            entity.x - camera.x + bounds.left,
            entity.y - camera.y + bounds.top,
            bounds.right - bounds.left + 1,
            bounds.bottom - bounds.top + 1
        );
    };

    const mapBlocksToDraw = !layerVisibility.world
        ? []
        : hideBlackBackgroundBlocks
            ? mapBlocks.filter((b) => b.type !== 'black_background')
            : mapBlocks;
    const collectablesToDraw = worldDesigner?.isActive() && !worldDesigner.isPreviewMode()
        ? getDesignerRenderableCollectables()
        : getRenderableCollectables();
    mapBlocksToDraw.forEach(drawWorldBBox);
    if (layerVisibility.doors) doorEntities.forEach(drawWorldBBox);
    if (layerVisibility.buttons) buttonEntities.forEach(drawWorldBBox);
    if (layerVisibility.creatures) {
        creatureEntities.forEach(drawWorldBBox);
        getCreatureProjectileCollectables().forEach(drawWorldBBox);
    }
    if (layerVisibility.collectables) {
        collectablesToDraw.forEach(drawWorldBBox);
    }
    context.restore();
}

function getRawWorldData(): RawWorldData {
    return {
        worldMap: mapBlocks as RawWorldData['worldMap'],
        buttons: buttonEntities as RawWorldData['buttons'],
        doors: doorEntities as RawWorldData['doors'],
        creatures: creatureEntities as RawWorldData['creatures'],
        collectables: collectableEntities as RawWorldData['collectables'],
        teleporters: teleporterEntities as RawWorldData['teleporters'],
        astronautStart: getAstronautStartPosition()
    };
}

async function getRawWorldDataForSave(): Promise<RawWorldData> {
    saveSnapshotInProgress = true;
    try {
        await materializeAllMapChunksForSave();
        return getRawWorldData();
    } finally {
        saveSnapshotInProgress = false;
    }
}

function replaceRawWorldData(data: RawWorldData) {
    mapBlocks.splice(0, mapBlocks.length, ...data.worldMap.map((block) => assignEntityId({ ...block })));
    doorEntities = data.doors.map((door) => assignEntityId(new Door(door)));
    buttonEntities = data.buttons.map((button) => assignEntityId(new Button(button)));
    creatureEntities = data.creatures.map((creature) => assignEntityId(new Creature(creature)));
    collectableEntities = data.collectables.map((collectable) => assignEntityId(new Collectable(collectable)));
    teleporterEntities = (data.teleporters ?? []).length > 0
        ? (data.teleporters ?? []).map(normalizeTeleporter)
        : buildTeleportersFromMapMetadata();
    reconcileTeleporterRuntimePositions(teleporterEntities);
    updateAstronautStartPosition(data.astronautStart, true);
    afterWorldDataMutated();
}

function getSpriteTypes() {
    if (!spriteMap) return [];
    if (spriteMap instanceof Array) {
        return spriteMap.flat().map((entry: any) => entry.name).filter(Boolean);
    }
    return Object.keys(spriteMap);
}

function getSpriteCatalog(): SpriteCatalogEntry[] {
    if (!spriteMap) return [];
    if (spriteMap instanceof Array) {
        return spriteMap.flat()
            .filter((entry: any) => entry?.name)
            .map((entry: any) => ({
                name: entry.name,
                palette: typeof entry.palette === 'number' ? entry.palette : 0
            }));
    }
    return Object.entries(spriteMap).map(([name, entry]: [string, any]) => ({
        name,
        palette: typeof entry?.palette === 'number' ? entry.palette : 0
    }));
}

function drawSpritePreview(
    context: CanvasRenderingContext2D,
    type: string,
    palette: number,
    rotation: number = 1,
    clearFirst: boolean = true,
    targetSize?: number,
    translation: SpriteTranslation = 'center'
) {
    const rect = findSpriteRectByType(type);
    if (!rect || remappedSpriteSheets.length === 0) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }

    const sheet = getPaletteSheet(palette, typeof rect.palette === 'number' ? rect.palette : 0);
    if (!sheet) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }

    return drawSpritePreviewWithSheet(context, type, sheet, rotation, clearFirst, targetSize, translation);
}

function drawSpriteSample(
    context: CanvasRenderingContext2D,
    type: string,
    palette: number,
    rotation: number = 1,
    clearFirst: boolean = true,
    targetSize?: number,
    translation: SpriteTranslation = 'center'
) {
    const rect = findSpriteRectByType(type);
    if (!rect || remappedSpriteSheets.length === 0) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }

    const sheet = getPaletteSheet(palette, typeof rect.palette === 'number' ? rect.palette : 0);
    if (!sheet) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }

    const transformedSprite = getTransformedSpriteCanvas(sheet, rect, rotation);
    if (!transformedSprite) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }

    const drawSize = targetSize ?? Math.min(context.canvas.width, context.canvas.height);
    context.save();
    if (clearFirst) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
    context.imageSmoothingEnabled = false;
    const translationOffset = getSpriteTranslationOffset(
        transformedSprite,
        translation,
        drawSize / transformedSprite.width,
        drawSize / transformedSprite.height
    );
    context.drawImage(
        transformedSprite,
        translationOffset.x,
        translationOffset.y,
        drawSize,
        drawSize
    );
    context.restore();
    return true;
}

function drawSpritePreviewWithSheet(
    context: CanvasRenderingContext2D,
    type: string,
    sheet: CanvasImageSource,
    rotation: number = 1,
    clearFirst: boolean = true,
    targetSize?: number,
    translation: SpriteTranslation = 'center'
) {
    const rect = findSpriteRectByType(type);
    if (!rect) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }

    const padding = 8;
    const previewWidth = targetSize ?? context.canvas.width;
    const previewHeight = targetSize ?? context.canvas.height;
    const maxWidth = Math.max(1, previewWidth - padding * 2);
    const maxHeight = Math.max(1, previewHeight - padding * 2);
    const transformedSprite = getTransformedSpriteCanvas(sheet, rect, rotation);
    if (!transformedSprite) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }
    const scale = Math.max(1, Math.min(
        maxWidth / transformedSprite.width,
        maxHeight / transformedSprite.height
    ));
    const drawW = transformedSprite.width * scale;
    const drawH = transformedSprite.height * scale;
    const translationOffset = getSpriteTranslationOffset(transformedSprite, translation, scale);

    context.save();
    if (clearFirst) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
    context.imageSmoothingEnabled = false;
    context.translate(context.canvas.width / 2, context.canvas.height / 2);
    context.drawImage(
        transformedSprite,
        -drawW / 2 + translationOffset.x,
        -drawH / 2 + translationOffset.y,
        drawW,
        drawH
    );
    context.restore();
    return true;
}

function drawCustomPalettePreview(
    context: CanvasRenderingContext2D,
    type: string,
    paletteDefinition: PaletteDefinition,
    rotation: number = 1,
    clearFirst: boolean = true,
    targetSize?: number
) {
    if (!spriteSheet) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }
    const cacheKey = JSON.stringify(paletteDefinition);
    let sheet = customPalettePreviewCache.get(cacheKey);
    if (!sheet) {
        const resolvedPalette = paletteDefinition.map(({ from, to }) => ({
            from: resolveColor(from),
            to: resolveColor(to)
        }));
        sheet = remapSpritePalette(spriteSheet, resolvedPalette);
        customPalettePreviewCache.set(cacheKey, sheet);
    }
    return drawSpritePreviewWithSheet(context, type, sheet, rotation, clearFirst, targetSize);
}

async function saveWorldData(data: RawWorldData) {
    const res = await postDesignerSaveRequest('http://localhost:3001/save-world-data', data);
    if (!res.ok) {
        throw new Error(await getDesignerSaveError(res, 'Failed to save world data.'));
    }
    try {
        const payload = await res.clone().json() as { files?: string[] };
        const files = Array.isArray(payload.files) ? payload.files : [];
        if (!files.includes('teleporters.json')) {
            throw new Error('The local designer save server is out of date and did not save teleporters.json. Restart the save server on port 3001 and try again.');
        }
    } catch (error) {
        if (error instanceof Error && error.message.includes('teleporters.json')) {
            throw error;
        }
    }
}

async function postDesignerSaveRequest(url: string, body: unknown) {
    try {
        return await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(body)
        });
    } catch {
        throw new Error('This save/normalize feature is only available when the local designer save server is running on port 3001. The deployed app can still load and play normally.');
    }
}

async function getDesignerSaveError(res: Response, fallbackMessage: string, unavailableMessage?: string) {
    let message = fallbackMessage;
    try {
        const text = await res.text();
        if (text) {
            try {
                const payload = JSON.parse(text) as { error?: string };
                if (payload?.error) {
                    message = payload.error;
                } else {
                    message = text;
                }
            } catch {
                message = text;
            }
        }
    } catch {
        message = fallbackMessage;
    }

    if (res.status === 404) {
        return unavailableMessage ?? 'This designer save feature is unavailable because the local save server is out of date. Restart the dev/save server on port 3001 and try again.';
    }

    return message;
}

async function savePaletteDefinitions(paletteDefinitions: PaletteDefinition[], worldData?: RawWorldData) {
    const res = await postDesignerSaveRequest('http://localhost:3001/save-designer-assets', {
        palettes: paletteDefinitions,
        ...(worldData ? { worldData } : {})
    });
    if (!res.ok) {
        throw new Error(await getDesignerSaveError(res, 'Failed to save palette data.'));
    }
    applyPaletteDefinitions(paletteDefinitions);
}

async function postSpriteSheetNormalization(dryRun: boolean): Promise<SpriteSheetNormalizationReport> {
    const res = await postDesignerSaveRequest('http://localhost:3001/normalize-sprite-sheet', { dryRun });
    if (!res.ok) {
        throw new Error(await getDesignerSaveError(
            res,
            dryRun ? 'Failed to analyze sprite_sheet.png.' : 'Failed to normalize sprite_sheet.png.',
            'Sprite-sheet normalization is unavailable because the local save server is out of date. Restart the dev/save server on port 3001 and try again.'
        ));
    }

    const payload = await res.json() as { report: SpriteSheetNormalizationReport };
    return payload.report;
}

async function previewSpriteSheetNormalization() {
    return postSpriteSheetNormalization(true);
}

async function normalizeSpriteSheetColors() {
    return postSpriteSheetNormalization(false);
}

// --- Map rendering and update logic ---
async function init() {
    await loadSpriteMap();
    await loadPalettes();
    await loadMapBlocks();
    await loadDoors();
    await loadButtons();
    await loadCreatures();
    await loadCollectables();
    await loadTeleporters();
    await loadAstronautStartPosition();
    await ensureMapChunksAroundWorldPosition(getAstronautStartPosition(), 1, true);
    initStars(MAP_WIDTH, STARFIELD_HEIGHT);
    const img = new Image();
    img.src = './src/assets/sprite_sheet.png';
    img.onload = () => {
        makeBlackTransparent(img, async (canvasWithTransparency) => {
            spriteSheet = new Image();
            spriteSheet.src = canvasWithTransparency.toDataURL();
            spriteSheet.onload = async () => {
                // Make spriteSheet globally accessible for pixel-perfect collision
                (window as any).spriteSheet = spriteSheet;
                // Also create and store a 2D context for pixel access
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = spriteSheet.width;
                tempCanvas.height = spriteSheet.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx!.drawImage(spriteSheet, 0, 0);
                (window as any)._spriteSheetCtx = tempCtx;
                rebuildRemappedSpriteSheets();

                // --- Calculate tightest collision bounding boxes at startup ---
                const boundingBoxes = await calculateSpriteCollisionBoundingBoxes(
                    spriteSheet,
                    spriteMap,
                    mapBlocks,
                    doorEntities,
                    buttonEntities,
                    creatureEntities,
                    collectableEntities
                );
                worldMapBoundingBoxes = boundingBoxes;

                // --- Calculate rotated bounding boxes for each type and rotation ---
                worldMapRotatedBoundingBoxes = {};
                const getSpriteRectForType = (type: string) => {
                    if (spriteMap instanceof Array) {
                        for (const row of spriteMap) {
                            for (const sprite of row) {
                                if (sprite.name === type) {
                                    return sprite;
                                }
                            }
                        }
                        return null;
                    }
                    return spriteMap[type] || null;
                };
                for (const [type, bbox] of Object.entries(worldMapBoundingBoxes)) {
                    const spriteRect = getSpriteRectForType(type);
                    if (!spriteRect) {
                        continue;
                    }
                    worldMapRotatedBoundingBoxes[type] = {};
                    for (let rot = 0; rot <= 7; rot++) {
                        // Corners relative to (0,0)
                        let corners = [
                            { x: bbox.minX, y: bbox.minY },
                            { x: bbox.maxX, y: bbox.minY },
                            { x: bbox.maxX, y: bbox.maxY },
                            { x: bbox.minX, y: bbox.maxY }
                        ];
                        // Match draw-time transforms by rotating/flipping around the full sprite center.
                        const cx = (spriteRect.w - 1) / 2;
                        const cy = (spriteRect.h - 1) / 2;
                        let rotated: { x: number, y: number }[];
                        if (rot >= 1 && rot <= 4) {
                            const angle = (rot - 1) * (Math.PI / 2);
                            rotated = corners.map(pt => {
                                const dx = pt.x - cx;
                                const dy = pt.y - cy;
                                return {
                                    x: Math.round(cx + dx * Math.cos(angle) - dy * Math.sin(angle)),
                                    y: Math.round(cy + dx * Math.sin(angle) + dy * Math.cos(angle))
                                };
                            });
                        } else if (rot === 5) {
                            // flip X
                            rotated = corners.map(pt => ({ x: Math.round(2 * cx - pt.x), y: pt.y }));
                        } else if (rot === 6) {
                            // flip Y
                            rotated = corners.map(pt => ({ x: pt.x, y: Math.round(2 * cy - pt.y) }));
                        } else if (rot === 7) {
                            // flip X and Y
                            rotated = corners.map(pt => ({ x: Math.round(2 * cx - pt.x), y: Math.round(2 * cy - pt.y) }));
                        } else {
                            // rot == 0, no rotation
                            rotated = corners;
                        }
                        const xs = rotated.map(pt => pt.x);
                        const ys = rotated.map(pt => pt.y);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);
                        worldMapRotatedBoundingBoxes[type][rot] = {
                            minX,
                            minY,
                            maxX,
                            maxY,
                            width: maxX - minX + 1,
                            height: maxY - minY + 1
                        };
                    }
                }

                rebuildBlockInstanceBoundingBoxes();
                syncRuntimeMapBounds();

                // --- Calculate astronaut sprite bounding boxes at startup ---
                astronautBoundingBoxes = await calculateAstronautSpriteBoundingBoxes(
                    spriteSheet,
                    spriteMap
                );
                worldDesigner = createWorldDesigner({
                    canvas,
                    getRawWorldData,
                    getRawWorldDataForSave,
                    replaceRawWorldData,
                    afterWorldDataMutated,
                    getFocusWorldPosition: () => ({
                        x: astronaut.position.x,
                        y: astronaut.position.y
                    }),
                    resetAstronautToPosition,
                    setAstronautStartPosition: updateAstronautStartPosition,
                    getSoundEnabled,
                    setSoundEnabled,
                    getShowSpriteOutlines: () => showWorldBoundingBoxes,
                    setShowSpriteOutlines: (value: boolean) => {
                        showWorldBoundingBoxes = value;
                    },
                    getShowCreatureOverlays: () => showCreatureOverlays,
                    setShowCreatureOverlays: (value: boolean) => {
                        showCreatureOverlays = value;
                    },
                    getBulletImpactAudioSettings: () => ({ ...bulletImpactAudioSettings }),
                    setBulletImpactAudioSettings: (value: BulletImpactAudioSettings) => {
                        bulletImpactAudioSettings = normalizeBulletImpactAudioSettings(value);
                    },
                    drawSpriteOutlineOverlay: drawWorldBoundingBoxOverlay,
                    getSpriteTypes,
                    getSpriteCatalog,
                    drawSpritePreview,
                    drawSpriteSample,
                    drawCustomPalettePreview,
                    getPaletteDefinitions: () => deepClone(rawPaletteDefinitions),
                    getColorAliases: () => deepClone(colorAliases),
                    getPaletteCount: () => Math.max(remappedSpriteSheets.length, palettes.length, 1),
                    clampCamera,
                    ensureWorldBounds,
                    saveWorldData,
                    savePaletteDefinitions,
                    previewSpriteSheetNormalization,
                    normalizeSpriteSheetColors
                });
                requestImmediateFrame();
            };
        });
    };
    img.onerror = () => {
        alert('Sprite sheet not found at ./src/assets/exile_sprites.png');
    };
}

init();

function getSpriteRectFromMap(row: number, col: number) {
    return spriteMap[row][col];
}

function drawAstronautInWorld(
    context: CanvasRenderingContext2D,
    camera: Position,
    spriteCol: number,
    flipSprite: boolean,
    flipVertical: boolean
) {
    if (!(astronautSpriteSource || spriteSheet) || !(spriteSheet && spriteSheet.complete)) {
        return;
    }

    const spriteRect = getSpriteRectFromMap(SPRITE_ROW, spriteCol);
    const drawW = 32 * SPRITE_SCALE;
    const drawH = 32 * SPRITE_SCALE;
    const renderNow = performance.now();

    context.save();
    context.translate(
        Math.round(astronaut.position.x - camera.x),
        Math.round(astronaut.position.y - camera.y)
    );
    if (flipSprite) context.scale(-1, 1);
    if (flipVertical) context.scale(1, -1);
    drawAstronautSprite(context, spriteRect, drawW, drawH, renderNow);
    context.restore();
}

// When drawing the sprite, ensure the canvas is cleared with a transparent background
async function gameLoop() {
    if (isGameLoopRunning) {
        return;
    }

    isGameLoopRunning = true;

    try {
        if (!gameState.isRunning || !mapLoaded) return;

        const frameNow = performance.now();
        const performanceInstrumentationEnabled = isPerformanceInstrumentationEnabled();
        const frameStartMs = frameNow;
        const frameTimeMs = (
            performanceInstrumentationEnabled && lastFrameTimestamp !== null
                ? frameNow - lastFrameTimestamp
                : 0
        );
        let updateWorkMs = 0;
        let mapDrawMs = 0;
        let drawPhaseMs = 0;
        if (performanceInstrumentationEnabled) {
            lastFrameTimestamp = frameNow;
        }

        ctx!.imageSmoothingEnabled = false;
        ctx!.clearRect(0, 0, canvas.width, canvas.height);

        const camera = getCameraOffset();
        const effectiveViewport = getEffectiveViewportState();
        chunkActivityManager.updateFrame({
            camera,
            viewportWidth: effectiveViewport.width,
            viewportHeight: effectiveViewport.height,
            zoom: effectiveViewport.zoom,
            now: frameNow
        });
        chunkSyncFrameCounter += 1;
        const designerChunkSyncRequired = worldDesigner?.isActive() === true;
        const shouldSyncChunksThisFrame = designerChunkSyncRequired
            || (chunkSyncFrameCounter % CHUNK_SYNC_INTERVAL_FRAMES === 0);
        if (!saveSnapshotInProgress && shouldSyncChunksThisFrame) {
            syncMapChunksForViewport(
                camera,
                effectiveViewport.width,
                effectiveViewport.height,
                effectiveViewport.prefetchRadiusChunks,
                effectiveViewport.zoom,
                designerChunkSyncRequired
            );
        }
        currentAstronautChunkActivity = getChunkActivityForWorldPosition(
            astronaut.position,
            frameNow
        );

        // Update mouse world position
        mouseWorld.x = Math.round(mouseScreen.x + camera.x);
        mouseWorld.y = Math.round(mouseScreen.y + camera.y);

    // --- Sprite selection logic (animation, flipping, flying, walking) ---
    // Declare spriteCol/flipSprite/flipVertical only ONCE at the top of gameLoop
    let spriteCol = SPRITE_COL_STAND;
    let flipSprite = facingLeft;
    let flipVertical = false;

    // --- Teleport memory logic ---
    if (!isDesignerOpen() && keys['r'] && !prevKeys['r']) {
        // Save up to 6 locations, overwrite oldest if full
        if (teleportLocations.length < 6) {
            teleportLocations.push({ x: astronaut.position.x, y: astronaut.position.y });
        } else {
            teleportLocations[teleportSlot] = { x: astronaut.position.x, y: astronaut.position.y };
        }
        teleportSlot = (teleportSlot + 1) % 6;
        // Play remember sound
        try { rememberSound.currentTime = 0; rememberSound.play(); } catch {}
    }
    if (!isDesignerOpen() && keys['t'] && !prevKeys['t']) {
        startTeleportToLocation(popLatestTeleportLocation());
    }

    updateAstronautEnergyRecovery(frameNow);

    // --- Draw twinkling stars ---
        const drawPhaseStartMs = performanceInstrumentationEnabled ? performance.now() : 0;
        updateAndDrawStars(
            ctx!,
            camera,
            canvas,
            MAP_WIDTH,
            STARFIELD_HEIGHT,
            frameNow
        );

    // --- Draw map blocks ---
    const layerVisibility = worldDesigner?.isActive()
        ? worldDesigner.getLayerVisibility()
        : {
            world: true,
            buttons: true,
            doors: true,
            creatures: true,
            collectables: true
        };
    const designerActive = worldDesigner?.isActive() === true;
    const creatureProjectileDrawables = layerVisibility.creatures
        ? getCreatureProjectileCollectables()
        : [];
    const collectablesToDraw = layerVisibility.collectables
        ? (
            worldDesigner?.isActive() && !worldDesigner.isPreviewMode()
                ? getDesignerRenderableCollectables()
                : getRenderableCollectables()
        )
        : [];
    const heldCollectableDrawables = heldCollectable ? [heldCollectable] : [];
    const mapBlocksToDraw = !layerVisibility.world
        ? []
        : getRenderableMapBlocks(hideBlackBackgroundBlocks);
    let mapBlocksBehindAstronaut = !layerVisibility.world
        ? []
        : getMapBlocksBehindAstronaut(hideBlackBackgroundBlocks);
    let mapBlocksMaskAstronaut = !layerVisibility.world
        ? []
        : getMapBlocksMaskAstronaut();
    const teleporterPadKeys = getTeleporterPadKeySet();
    if (teleporterPadKeys.size > 0) {
        mapBlocksBehindAstronaut = filterTeleporterPadsFromBlocks(
            mapBlocksBehindAstronaut,
            teleporterPadKeys
        );
        mapBlocksMaskAstronaut = filterTeleporterPadsFromBlocks(
            mapBlocksMaskAstronaut,
            teleporterPadKeys
        );
    }
    const blackBackgroundBlocksToHighlight = showBlackBackgroundBlocks && !hideBlackBackgroundBlocks
        ? getBlackBackgroundBlocks()
        : [];

    if (spriteSheet && spriteSheet.complete) {
        if (layerVisibility.doors) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, doorEntities, frameNow);
        }
        // Draw map blocks (replace mapBlocks with mapBlocksToDraw in overlays below as well)
        // Patch: temporarily override mapBlocks for drawMap by monkey-patching global (not ideal, but drawMap uses global)
        // Instead, draw overlays and highlights using mapBlocksToDraw, but call drawMap as usual
        // --- Draw overlays and highlights using mapBlocksToDraw ---
        // --- Highlight all black_background blocks if enabled ---
        if (showBlackBackgroundBlocks) {
            ctx!.save();
            ctx!.strokeStyle = 'cyan';
            ctx!.lineWidth = 2;
            for (const block of blackBackgroundBlocksToHighlight) {
                const bbox = blockInstanceRotatedBoundingBoxes.get(block);
                const scale = SPRITE_SCALE;
                const tileW = 32 * scale;
                const tileH = 32 * scale;
                // Center of the sprite
                const drawX = block.x - camera.x + tileW / 2;
                const drawY = block.y - camera.y + tileH / 2;
                ctx!.save();
                ctx!.translate(drawX, drawY);
                // Apply rotation if present
                if (block.rotation) {
                    if (block.rotation >= 1 && block.rotation <= 4) {
                        ctx!.rotate(((block.rotation - 1) * Math.PI) / 2);
                    } else if (block.rotation === 5) {
                        ctx!.scale(-1, 1);
                    } else if (block.rotation === 6) {
                        ctx!.scale(1, -1);
                    } else if (block.rotation === 7) {
                        ctx!.scale(-1, -1);
                    } else if (block.rotation === 8) {
                        ctx!.rotate(Math.PI / 2);
                        ctx!.scale(-1, 1);
                    } else if (block.rotation === 9) {
                        ctx!.rotate((3 * Math.PI) / 2);
                        ctx!.scale(-1, 1);
                    }
                }
                // Draw bbox relative to sprite center
                if (bbox) {
                    const x = -tileW / 2 + bbox.minX * scale;
                    const y = -tileH / 2 + bbox.minY * scale;
                    const w = bbox.width * scale;
                    const h = bbox.height * scale;
                    ctx!.strokeRect(x, y, w, h);
                } else {
                    // fallback: draw full tile
                    ctx!.strokeRect(-tileW / 2, -tileH / 2, tileW, tileH);
                }
                ctx!.restore();
            }
            ctx!.restore();
        }
        // Draw map blocks (drawMap uses global mapBlocks, so black_background blocks will be hidden only if not present in mapBlocks)
        // To hide, we need to patch drawMap to accept a blocks array, or temporarily monkey-patch global. For now, just draw overlays using mapBlocksToDraw.
        if (performanceInstrumentationEnabled) {
            const mapDrawStart = performance.now();
            drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksBehindAstronaut, frameNow);
            mapDrawMs += performance.now() - mapDrawStart;
        } else {
            drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksBehindAstronaut, frameNow);
        }
        if (layerVisibility.world && !designerActive) {
            drawTeleporterPads(ctx!, camera, frameNow, {
                ignoreKeyRequirement: designerActive
            });
        }
        if (layerVisibility.buttons) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, buttonEntities, frameNow);
        }
        if (layerVisibility.creatures) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureEntities, frameNow);
            if (showCreatureOverlays) {
                drawCreatureOverlays(ctx!, camera);
            }
        }
        if (layerVisibility.collectables) {
            drawEntities(
                ctx!,
                camera,
                spriteMap,
                remappedSpriteSheets,
                SPRITE_SCALE,
                collectablesToDraw,
                frameNow
            );
        }
        if (layerVisibility.doors && doorDestructionEffects.length > 0) {
            drawDoorDestructionEffects(ctx!, camera);
        }
    }

    if (worldDesigner?.isActive()) {
        drawAstronautInWorld(ctx!, camera, spriteCol, flipSprite, flipVertical);
        if (mapBlocksMaskAstronaut.length > 0) {
            if (performanceInstrumentationEnabled) {
                const mapDrawStart = performance.now();
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
                mapDrawMs += performance.now() - mapDrawStart;
            } else {
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
            }
        }
        if (layerVisibility.world) {
            drawTeleporterPads(ctx!, camera, frameNow, {
                ignoreKeyRequirement: designerActive
            });
        }
        if (layerVisibility.creatures && creatureProjectileDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDrawables, frameNow);
        }
        if (layerVisibility.creatures && projectileImpactEffects.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, projectileImpactEffects, frameNow);
        }
        if (bulletImpactParticles.length > 0) {
            updateAndDrawBulletImpactParticles(layerVisibility.creatures ? ctx! : null, camera);
        }
        if (heldCollectableDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, heldCollectableDrawables, frameNow);
        }
        if (layerVisibility.doors && doorDestructionEffects.length > 0) {
            drawDoorDestructionEffects(ctx!, camera);
        }
        worldDesigner.render(ctx!);
        if (performanceInstrumentationEnabled) {
            drawPhaseMs = performance.now() - drawPhaseStartMs;
        }
        finalizePerformanceInstrumentationFrame(
            frameNow,
            frameStartMs,
            frameTimeMs,
            updateWorkMs,
            mapDrawMs,
            drawPhaseMs
        );
        prevKeys = { ...keys };
        return;
    }

    // --- Controls: Upward and horizontal movement ---
    const updatePhaseStartMs = performanceInstrumentationEnabled ? performance.now() : 0;
    const movementStartX = gameState.astronaut.position.x;
    const movementStartY = gameState.astronaut.position.y;
    const movementModifiers = getHeldMovementModifiers();
    const astronautControlModifiers = getAstronautControlModifiers(frameNow);
    handleAstronautMovement(keys, true, {
        walkSpeedScale: movementModifiers.walkSpeedScale * astronautControlModifiers.walkSpeedScale,
        flightControlScale: movementModifiers.flightControlScale * astronautControlModifiers.flightControlScale
    });
    const movementTargetX = astronaut.position.x;
    const movementTargetY = astronaut.position.y;
    astronaut.position.x = movementStartX;
    astronaut.position.y = movementStartY;
    setAstronautCollisionProfile(getCurrentAstronautCollisionProfile());

    // --- Door animation update ---
    for (const door of doorEntities) {
        door.updateAnimation(doorOpenSound, doorCloseSound);
    }

    // Clear all velocities if landed and not walking
    if (
        gameState.astronaut.isLanded &&
        walkSpeed === 0
    ) {
        astronaut.velocity.x = 0;
        astronaut.velocity.y = 0;
    }

    // Prevent diagonal takeoff: if landed and only up is pressed, clear horizontal velocity
    if (
        gameState.astronaut.isLanded &&
        upPressed &&
        !leftPressed &&
        !rightPressed
    ) {
        astronaut.velocity.x = 0;
    }

    // --- Gravity ---
    applyGravity(
        astronaut,
        gameState.gravity * movementModifiers.gravityScale,
        (downPressed ? MOVEMENT_SETTINGS.flyDownTerminalVelocity : MOVEMENT_SETTINGS.fallTerminalVelocity) * movementModifiers.terminalVelocityScale
    );
    const wasLanded = gameState.astronaut.isLanded;
    const horizontalVelocityBeforeResolution = astronaut.velocity.x;

    // --- Move astronaut by velocity with collision detection ---
    let nextX = movementTargetX;
    let nextY = movementTargetY;
    if (!gameState.astronaut.isLanded) {
        nextX += astronaut.velocity.x;
        nextY += astronaut.velocity.y;
    }

    const collisionState = checkAstronautCollisions(
        buttonEntities,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        movementStartX,
        movementStartY,
        nextX,
        nextY,
        gameState
    );

    gameState.astronaut.position.x = collisionState.nextX;
    gameState.astronaut.position.y = collisionState.nextY;
    astronaut.velocity.x = collisionState.velocityX;
    astronaut.velocity.y = collisionState.velocityY;
    gameState.astronaut.isLanded = collisionState.isLanded;
    gameState.astronaut.isFlying = !collisionState.isLanded;
    if (!wasLanded && collisionState.isLanded) {
        const carriedHorizontalMotion = collisionState.nextX - movementStartX;
        const landingMomentumSource = Math.abs(carriedHorizontalMotion) > Math.abs(horizontalVelocityBeforeResolution)
            ? carriedHorizontalMotion
            : horizontalVelocityBeforeResolution;
        applyLandingMomentum(landingMomentumSource);
        astronaut.velocity.x = 0;
        astronaut.velocity.y = 0;
        resetFlyDownAnimationState();
        flyHoldTimer = 0;
        flyDir = null;
        resetFlySwitchAnimationState();
        lastFlySpriteCol = SPRITE_COL_STAND;
        lastFlyFlipSprite = facingLeft;
    }

    const collidedButton = collisionState.touchedButton;
    const doorCollision = collisionState.touchedDoor;

    if (collidedButton && Array.isArray(collidedButton.linkedDoors)) {
        const now = performance.now();
        const lastPress = buttonPressTimestamps.get(collidedButton) || 0;
        if (now - lastPress > 500) {
            for (const doorID of collidedButton.linkedDoors) {
                const door = doorEntities.find(d => d.doorID === doorID);
                if (door) {
                    door.locked = !door.locked;
                }
            }
            applyButtonTeleporterLinks(collidedButton);
            syncButtonStatesToDoors();
            buttonPressTimestamps.set(collidedButton, now);
            try { buttonOnSound.currentTime = 0; buttonOnSound.play(); } catch {}
        }
    }

    if (
        doorCollision &&
        doorCollision.type === "door_horizontal" &&
        !doorCollision.locked &&
        !doorCollision.animating
    ) {
        doorCollision.animating = true;
        if (typeof (doorCollision as any)._originalX === "undefined") {
            (doorCollision as any)._originalX = doorCollision.x;
        }
        (doorCollision as any)._animationDirection = "open";
        (doorCollision as any)._animationTimer = 0;
        (doorCollision as any)._closeDelay = 0;
    }

    simulationFrameCounter++;
    updateCreatures(frameNow, simulationFrameCounter);
    updateCreatureSounds(frameNow);
    updateProjectileImpactEffects();
    updateDoorDestructionEffects();
    resolveAstronautCreatureCollisions();
    updateThrowAngle();
    handleCollectableInteractions();
    updateHeldCollectablePosition();
    updateTeleporterPadTeleporting(frameNow, simulationFrameCounter);
    resolveAstronautCollectableCollisions(
        gameState.astronaut.position.x - movementStartX,
        gameState.astronaut.position.y - movementStartY
    );
    updateCollectablePhysics(frameNow, simulationFrameCounter);
    updateHeldCollectablePosition();
    if (performanceInstrumentationEnabled) {
        updateWorkMs = performance.now() - updatePhaseStartMs;
    }

    // Ensure astronaut position is always integer pixels
    gameState.astronaut.position.x = Math.round(gameState.astronaut.position.x);
    gameState.astronaut.position.y = Math.round(gameState.astronaut.position.y);

    // --- Jetpack dots emission (world coordinates) ---
    emitJetpackDots({
        upPressed,
        downPressed,
        leftPressed,
        rightPressed,
        facingLeft,
        astronaut,
        spriteSheet,
        spriteMap,
        SPRITE_ROW,
        SPRITE_COL_STAND,
        SPRITE_SCALE,
        walkAnimFrame,
        walkAnimTimer,
        canvas
    });

    // --- Jetpack dots update and render (draw relative to camera) ---
    updateAndDrawJetpackDots(ctx!, camera, MAP_HEIGHT);

    // --- Sprite selection logic (animation, flipping, flying, walking) ---
    // REMOVE this duplicate declaration:
    // let spriteCol = SPRITE_COL_STAND;
    // let flipSprite = facingLeft;
    // let flipVertical = false; // <-- add this

    // Debug: Log key and state info for animation selection
    if (gameState.debugMode) {
        ctx!.save();
        ctx!.font = '12px monospace';
        ctx!.fillStyle = '#ff0';
        let debugY = 16;
        ctx!.fillText(
            `Astronaut position: (${gameState.astronaut.position.x.toFixed(2)}, ${gameState.astronaut.position.y.toFixed(2)})`,
            10, debugY
        )
        debugY += 16;
        ctx!.fillText(
            `leftPressed: ${leftPressed} | rightPressed: ${rightPressed} | upPressed: ${upPressed} | downPressed: ${downPressed}`,
            10, debugY
        );
        debugY += 16;
        ctx!.fillText(
            `isLanded: ${gameState.astronaut.isLanded} | walkSpeed: ${walkSpeed.toFixed(2)} | spriteCol: ${spriteCol}`,
            10, debugY
        );
        debugY += 16;
        ctx!.fillText(
            `walkAnimFrame: ${walkAnimFrame} | walkAnimTimer: ${walkAnimTimer.toFixed(2)} | flyHoldTimer: ${flyHoldTimer.toFixed(2)}`,
            10, debugY
        );
        debugY += 16;
        ctx!.fillText(
            `flyDir: ${flyDir} | flySwitching: ${flySwitching} | flySwitchStep: ${flySwitchStep}`,
            10, debugY
        );
        debugY += 16;
        const astronautChunk = chunkActivityManager.worldToChunkCoordinates(gameState.astronaut.position);
        const mouseChunk = chunkActivityManager.worldToChunkCoordinates(mouseWorld);
        const mouseChunkActivity = getChunkActivityForEntityPosition(mouseWorld, frameNow);
        const chunkActivitySnapshot = chunkActivityManager.getDebugSnapshot(frameNow);
        ctx!.fillText(
            `Chunk activity: astronaut=${currentAstronautChunkActivity} @ (${astronautChunk.x},${astronautChunk.y}) | mouse=${mouseChunkActivity} @ (${mouseChunk.x},${mouseChunk.y})`,
            10, debugY
        );
        debugY += 16;
        ctx!.fillText(
            `Chunk radii near=${chunkActivitySnapshot.nearRadiusChunks} mid=${chunkActivitySnapshot.midRadiusChunks} keepAlive=${chunkActivitySnapshot.activeTeleportKeepAliveCount}`,
            10, debugY
        );
        debugY += 16;
        // --- Show block under mouse cursor with palette and rotation ---
        let block: any = null;
        if (hideBlackBackgroundBlocks) {
            // Find the topmost non-black_background block under the mouse
            const blocksUnderMouse = mapBlocks.filter(b => {
                const tileW = 32 * SPRITE_SCALE;
                const tileH = 32 * SPRITE_SCALE;
                return (
                    mouseWorld.x >= b.x && mouseWorld.x < b.x + tileW &&
                    mouseWorld.y >= b.y && mouseWorld.y < b.y + tileH
                );
            });
            block = blocksUnderMouse.find(b => b.type !== 'black_background');
            // If not found, fall back to doors/buttons/creatures
            if (!block) {
                block = getAnyBlockAtWorld(mouseWorld.x, mouseWorld.y, SPRITE_SCALE, [], doorEntities, buttonEntities, creatureEntities);
            }
        } else {
            block = getAnyBlockAtWorld(mouseWorld.x, mouseWorld.y, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities, creatureEntities);
        }
        if (block) {
            ctx!.fillText(
                `Block under cursor: ${block.type} (${block.x},${block.y}) id: ${block.entityId ?? 'n/a'} palette: ${block.palette ?? 0} rotation: ${block.rotation ?? 0}` +
                (typeof block.locked !== "undefined" ? ` locked: ${block.locked}` : ""),
                10, debugY
            );
            // Extra: If it's a door, show palette_locked/palette_unlocked
            if (block.type && block.type.startsWith("door")) {
                ctx!.fillText(
                    `palette_locked: ${block.palette_locked} palette_unlocked: ${block.palette_unlocked}`,
                    10, debugY + 16
                );
                debugY += 16;
            }
            // Show tight bounding box world min/max if available
            const bbox = blockInstanceRotatedBoundingBoxes.get(block);
            if (bbox) {
                // Calculate transformed corners (with rotation/flip)
                const scale = SPRITE_SCALE;
                const tileW = 32 * scale;
                const tileH = 32 * scale;
                const cx = block.x + tileW / 2;
                const cy = block.y + tileH / 2;
                // Corners relative to sprite center
                let corners = [
                    { x: -tileW / 2 + bbox.minX * scale, y: -tileH / 2 + bbox.minY * scale },
                    { x: -tileW / 2 + bbox.maxX * scale, y: -tileH / 2 + bbox.minY * scale },
                    { x: -tileW / 2 + bbox.maxX * scale, y: -tileH / 2 + bbox.maxY * scale },
                    { x: -tileW / 2 + bbox.minX * scale, y: -tileH / 2 + bbox.maxY * scale }
                ];
                // Apply rotation/flip
                let rot = block.rotation || 0;
                corners = corners.map(pt => {
                    let { x, y } = pt;
                    // Rotation (1-4 = 0,90,180,270 deg)
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
                ctx!.fillText(
                    `Tight bbox: worldMin=(${worldMinX},${worldMinY}) worldMax=(${worldMaxX},${worldMaxY})`,
                    10, debugY + 16
                );
                debugY += 16;
            }
        } else {
            ctx!.fillText(
                `Block under cursor: (none)`,
                10, debugY
            );
        }
        debugY += 16;
        ctx!.fillText(
            `Mouse world: (${mouseWorld.x.toFixed(1)}, ${mouseWorld.y.toFixed(1)})`,
            10, debugY
        );
        if (showPerformanceHud && perfSampleCount > 0) {
            const sampleCount = Math.max(perfSampleCount, 1);
            debugY += 16;
            ctx!.fillText(
                formatPerfSummaryLine('Frame', perfFrameTimeSum / sampleCount, perfWorstFrameTime),
                10, debugY
            );
            debugY += 16;
            ctx!.fillText(
                formatPerfSummaryLine('Update', perfUpdateTimeSum / sampleCount, perfWorstUpdateTime),
                10, debugY
            );
            debugY += 16;
            ctx!.fillText(
                formatPerfSummaryLine('Map', perfMapDrawTimeSum / sampleCount, perfWorstMapDrawTime),
                10, debugY
            );
            debugY += 16;
            ctx!.fillText(
                formatPerfSummaryLine('Entities', perfEntityDrawTimeSum / sampleCount, perfWorstEntityDrawTime),
                10, debugY
            );
            debugY += 16;
            ctx!.fillText(
                formatPerfSummaryLine('Total', perfTotalFrameTimeSum / sampleCount, perfWorstTotalFrameTime),
                10, debugY
            );
        }
        ctx!.restore();
    }
    // --- Draw world coordinate bounding boxes for each block in green if enabled ---
    if (showWorldBoundingBoxes) {
        drawWorldBoundingBoxOverlay(ctx!, camera);
    }

    // --- Highlight all black_background blocks if enabled ---
    if (showBlackBackgroundBlocks) {
        ctx!.save();
        ctx!.strokeStyle = 'cyan';
        ctx!.lineWidth = 2;
        for (const block of mapBlocks) {
            if (block.type === 'black_background') {
                const bbox = blockInstanceRotatedBoundingBoxes.get(block);
                const scale = SPRITE_SCALE;
                const tileW = 32 * scale;
                const tileH = 32 * scale;
                // Center of the sprite
                const drawX = block.x - camera.x + tileW / 2;
                const drawY = block.y - camera.y + tileH / 2;
                ctx!.save();
                ctx!.translate(drawX, drawY);
                // Apply rotation if present
                if (block.rotation) {
                    if (block.rotation >= 1 && block.rotation <= 4) {
                        ctx!.rotate(((block.rotation - 1) * Math.PI) / 2);
                    } else if (block.rotation === 5) {
                        ctx!.scale(-1, 1);
                    } else if (block.rotation === 6) {
                        ctx!.scale(1, -1);
                    } else if (block.rotation === 7) {
                        ctx!.scale(-1, -1);
                    } else if (block.rotation === 8) {
                        ctx!.rotate(Math.PI / 2);
                        ctx!.scale(-1, 1);
                    } else if (block.rotation === 9) {
                        ctx!.rotate((3 * Math.PI) / 2);
                        ctx!.scale(-1, 1);
                    }
                }
                // Draw bbox relative to sprite center
                if (bbox) {
                    const x = -tileW / 2 + bbox.minX * scale;
                    const y = -tileH / 2 + bbox.minY * scale;
                    const w = bbox.width * scale;
                    const h = bbox.height * scale;
                    ctx!.strokeRect(x, y, w, h);
                } else {
                    // fallback: draw full tile
                    ctx!.strokeRect(-tileW / 2, -tileH / 2, tileW, tileH);
                }
                ctx!.restore();
            }
        }
        ctx!.restore();
    }

    // --- Animate transition to fly_down if flying and down + (q or w) pressed ---
    const horizontalTravelDir = getHorizontalTravelDirection(keys);

    const diagonalDownPressed = !!(
        !gameState.astronaut.isLanded &&
        downPressed &&
        horizontalTravelDir &&
        (keys['q'] || keys['w'])
    );
    const directDownPressed = !gameState.astronaut.isLanded && downPressed && !keys['q'] && !keys['w'];

    if (
        diagonalDownPressed
    ) {
        resetFlyDownAnimationState();
        spriteCol = SPRITE_COL_FLY_DOWN;
        flipSprite = horizontalTravelDir === 'right';
        flyDownMode = 'diagonal';
        flyDownTravelDir = horizontalTravelDir;
        flyDownFacingLeft = horizontalTravelDir === 'left';
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        resetFlySwitchAnimationState();
        rememberLastFlyPose(spriteCol, flipSprite);
    }
    else if (directDownPressed) {
        const directDownFacingLeft = horizontalTravelDir ? horizontalTravelDir === 'right' : facingLeft;
        const flyDownSeq = getDirectDownTransitionSequence(directDownFacingLeft);

        if (
            !flyDownTransitioning ||
            flyDownMode !== 'direct' ||
            flyDownFacingLeft !== directDownFacingLeft ||
            flyDownTravelDir !== horizontalTravelDir
        ) {
            flyDownMode = 'direct';
            flyDownTravelDir = horizontalTravelDir;
            flyDownFacingLeft = directDownFacingLeft;
            flyDownTransitionStep = 0;
            flyDownTransitioning = true;
            flyDownTransitionTimer = 0;
        }

        spriteCol = flyDownSeq[flyDownTransitionStep].col;
        flipSprite = flyDownSeq[flyDownTransitionStep].flip;
        flipVertical = flyDownSeq[flyDownTransitionStep].flipVertical;

        flyDownTransitionTimer += 1 / 60;
        if (flyDownTransitionStep < flyDownSeq.length - 1 && flyDownTransitionTimer > 0.08) {
            flyDownTransitionStep++;
            flyDownTransitionTimer = 0;
        }

        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        resetFlySwitchAnimationState();
        rememberLastFlyPose(spriteCol, flipSprite);
    }
    // --- Walking animation ---
    // Show walking animation if landed and walkSpeed > 0 (even if no keys are pressed)
    else if (
        gameState.astronaut.isLanded &&
        walkSpeed > 0 &&
        !keys['Shift']
    ) {
        if (gameState.debugMode) {
            //console.log('WALKING: isLanded && walkSpeed > 0');
        }
        walkAnimTimer += 1 / 60;
        if (walkAnimTimer > 0.05) { // slower frame rate
            walkAnimFrame++;
            if (walkAnimFrame > SPRITE_COL_WALK_END) walkAnimFrame = SPRITE_COL_WALK_START;
            walkAnimTimer = 0;
        }
        spriteCol = walkAnimFrame;
        resetFlyDownAnimationState();
        flyHoldTimer = 0;
        flyDir = null;
        resetFlySwitchAnimationState();
    } else if (gameState.astronaut.isLanded) {
        spriteCol = SPRITE_COL_STAND;
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        resetFlyDownAnimationState();
        flyHoldTimer = 0;
        flyDir = null;
        resetFlySwitchAnimationState();
    } else if (!gameState.astronaut.isLanded && (keys['q'] || keys['w'])) {
        // --- Regular flying logic ---
        resetFlyDownAnimationState();
        // Debug: Show flying branch taken
        if (gameState.debugMode) {
            //console.log('FLYING: !gameState.astronaut.isLanded && (keys[q] || keys[w])');
        }
        let currentDir: 'left' | 'right' = keys['w'] ? 'right' : 'left';

        // If holding up and q/w, always show fly_diagonal (sprite 1), flipped if left
        if (upPressed) {
            spriteCol = SPRITE_COL_FLY_DIAGONAL;
            flipSprite = currentDir === 'left';
            // Do not reset flyHoldTimer here, so it continues after up is released
            resetFlySwitchAnimationState();
            walkAnimFrame = SPRITE_COL_WALK_START;
            walkAnimTimer = 0;
            rememberLastFlyPose(spriteCol, flipSprite);
        } else {
            // Direction change animation (when not holding up)
            if (flyDir && flyDir !== currentDir) {
                flySwitching = true;
                flySwitchStep = 0;
                flySwitchTimer = 0;
            }
            flyDir = currentDir;

            if (flySwitching) {
                // Sequence: fly_diagonal, fly_float, flipped fly_float, flipped fly_diagonal, flipped fly_right
                const switchSeq = [
                    { col: SPRITE_COL_FLY_DIAGONAL, flip: flyDir === 'left' }, // step 0
                    { col: SPRITE_COL_FLY_FLOAT, flip: flyDir === 'left' },    // step 1
                    { col: SPRITE_COL_FLY_FLOAT, flip: flyDir === 'right' },   // step 2 (flipped)
                    { col: SPRITE_COL_FLY_DIAGONAL, flip: flyDir === 'right' },// step 3 (flipped)
                    { col: SPRITE_COL_FLY_RIGHT, flip: flyDir === 'right' }    // step 4 (flipped)
                ];
                spriteCol = switchSeq[flySwitchStep].col;
                flipSprite = switchSeq[flySwitchStep].flip;
                rememberLastFlyPose(spriteCol, flipSprite);

                flySwitchTimer += 1 / 60;
                if (flySwitchTimer > 0.05) {
                    flySwitchStep++;
                    flySwitchTimer = 0;
                }
                if (flySwitchStep >= switchSeq.length) {
                    flySwitching = false;
                    flyHoldTimer = 0;
                }
                walkAnimFrame = SPRITE_COL_WALK_START;
                walkAnimTimer = 0;
            } else {
                // If flyHoldTimer is less than 0.25s, keep showing fly_diagonal (sprite 1)
                flyHoldTimer += 1 / 60;
                if (flyHoldTimer <= 0.25) {
                    spriteCol = SPRITE_COL_FLY_DIAGONAL;
                    flipSprite = flyDir === 'left';
                } else {
                    spriteCol = SPRITE_COL_FLY_RIGHT;
                    flipSprite = flyDir === 'left';
                }
                rememberLastFlyPose(spriteCol, flipSprite);
                walkAnimFrame = SPRITE_COL_WALK_START;
                walkAnimTimer = 0;
            }
        }
    } else if (
        !gameState.astronaut.isLanded &&
        !keys['q'] && !keys['w'] &&
        gameState.astronaut.velocity.y < -0.01 &&
        Math.abs(gameState.astronaut.velocity.x) <= 0.01
    ) {
        // Show the upright stand pose while flying straight up.
        spriteCol = SPRITE_COL_STAND;
        flipSprite = facingLeft;
        resetFlyDownAnimationState();
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        resetFlySwitchAnimationState();
        rememberLastFlyPose(spriteCol, flipSprite);
    } else if (
        !gameState.astronaut.isLanded &&
        !keys['q'] && !keys['w'] &&
        Math.abs(gameState.astronaut.velocity.x) > 0.01
    ) {
        // Show fly_float sprite if flying with sideways momentum and no q/w pressed
        spriteCol = SPRITE_COL_FLY_FLOAT;
        flipSprite = facingLeft; // use last direction key pressed
        resetFlyDownAnimationState();
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        resetFlySwitchAnimationState();
        rememberLastFlyPose(spriteCol, flipSprite);
    } else {
        // Debug: Show fallback branch taken
        if (gameState.debugMode) {
            //console.log('FALLBACK: no animation branch matched');
        }
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        resetFlyDownAnimationState();
        flyHoldTimer = 0;
        flyDir = null;
        resetFlySwitchAnimationState();
    }

    if (keys['Shift'] && gameState.astronaut.isLanded) {
        spriteCol = SPRITE_COL_FLY_RIGHT;
        flipSprite = getAstronautFacingDirectionForFlyPose(keys) === 'left';
        flipVertical = true;
        rememberLastFlyPose(spriteCol, flipSprite);
    }

    const isLayingDownPose = flipVertical;
    if (isLayingDownPose) {
        if (layDownVerticalFlipToggled) {
            flipVertical = !flipVertical;
        }
    } else {
        layDownVerticalFlipToggled = false;
    }

    currentAstronautRenderState = {
        spriteCol,
        flipSprite,
        flipVertical
    };

    // --- Teleport animation rendering ---
    if (teleporting && spriteSheet && spriteSheet.complete) {
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, teleportSpriteCol);
        const SPRITE_W = spriteRect.w;
        const SPRITE_H = spriteRect.h;
        const drawW = 32 * SPRITE_SCALE;
        const drawH = 32 * SPRITE_SCALE;
        ctx!.save();
        ctx!.translate(canvas.width / 2, canvas.height / 2);
        if (teleportFlipSprite) ctx!.scale(-1, 1);
        if (teleportFlipVertical) ctx!.scale(1, -1);

        // Render random bits of the sprite for a more "teleport" effect
        const totalBits = 32; // number of random bits per frame
        let visibleBits = totalBits;
        if (teleportPhase === 'out') {
            visibleBits = Math.max(2, Math.floor(totalBits * (1 - teleportAnimFrame / TELEPORT_ANIM_FRAMES)));
        } else if (teleportPhase === 'in') {
            visibleBits = Math.max(2, Math.floor(totalBits * (teleportAnimFrame / TELEPORT_ANIM_FRAMES)));
        }
        for (let i = 0; i < visibleBits; ++i) {
            // Randomly pick a region of the sprite
            const bitW = SPRITE_W / 8;
            const bitH = SPRITE_H / 8;
            const sx = spriteRect.x + Math.floor(Math.random() * (SPRITE_W - bitW));
            const sy = spriteRect.y + Math.floor(Math.random() * (SPRITE_H - bitH));
            const dx = -drawW / 2 + ((sx - spriteRect.x) / SPRITE_W) * drawW;
            const dy = -drawH / 2 + ((sy - spriteRect.y) / SPRITE_H) * drawH;
            ctx!.drawImage(
                spriteSheet,
                sx, sy, bitW, bitH,
                dx, dy, bitW * SPRITE_SCALE, bitH * SPRITE_SCALE
            );
        }
        ctx!.restore();
        if (mapBlocksMaskAstronaut.length > 0) {
            if (performanceInstrumentationEnabled) {
                const mapDrawStart = performance.now();
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
                mapDrawMs += performance.now() - mapDrawStart;
            } else {
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
            }
        }
        if (layerVisibility.creatures && creatureProjectileDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDrawables, frameNow);
        }
        teleportAnimFrame++;

        if (teleportPhase === 'out' && teleportAnimFrame >= TELEPORT_ANIM_FRAMES) {
            // Move astronaut after 0.5 second
            if (teleportTarget) {
                astronaut.position.x = teleportTarget.x;
                astronaut.position.y = teleportTarget.y;
                astronaut.velocity.x = 0; // Clear velocity on teleport
                astronaut.velocity.y = 0; // Clear velocity on teleport
                // If teleporting into the air (not on ground), set isFlying so gravity applies
                // We'll check for ground below the feet
                const astronautOffsets = getAstronautCollisionOffsets();
                const feetY = teleportTarget.y + astronautOffsets.bottom;
                const blockBelow = getSolidBlockAtWorld(
                    teleportTarget.x,
                    feetY + 1,
                    spriteMap,
                    SPRITE_SCALE,
                    mapBlocks,
                    doorEntities,
                    buttonEntities
                );
                if (!blockBelow) {
                    astronaut.isLanded = false;
                    astronaut.isFlying = true;
                }
            }
            teleportPhase = 'in';
            teleportAnimFrame = 0;
        } else if (teleportPhase === 'in' && teleportAnimFrame >= TELEPORT_ANIM_FRAMES) {
            astronaut.energy = Math.min(
                astronaut.maxEnergy,
                astronaut.energy + 1
            );
            teleporting = false;
            teleportPhase = 'none';
            teleportTarget = null;
        }

        if (performanceInstrumentationEnabled) {
            drawPhaseMs = performance.now() - drawPhaseStartMs;
        }
        finalizePerformanceInstrumentationFrame(
            frameNow,
            frameStartMs,
            frameTimeMs,
            updateWorkMs,
            mapDrawMs,
            drawPhaseMs
        );
        prevKeys = { ...keys };
        return;
    }

    // --- Render astronaut at center of screen with correct animation ---
    if ((astronautSpriteSource || spriteSheet) && (spriteSheet && spriteSheet.complete)) {
        updateAndDrawThrowGuide(ctx!, camera);
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, spriteCol);
        const SPRITE_W = spriteRect.w;
        const SPRITE_H = spriteRect.h;
        const drawW = 32 * SPRITE_SCALE;
        const drawH = 32 * SPRITE_SCALE;
        const renderNow = performance.now();
        ctx!.save();
        ctx!.translate(Math.round(canvas.width / 2), Math.round(canvas.height / 2));
        if (flipSprite) ctx!.scale(-1, 1);
        if (flipVertical) ctx!.scale(1, -1);
        drawAstronautSprite(ctx!, spriteRect, drawW, drawH, renderNow);

        // --- Draw tight bounding box for astronaut (with transforms) ---
        if (showTightBoundingBoxes) {
            let spriteName = spriteRect.name;
            if (!astronautBoundingBoxes[spriteName]) {
                const colToName: Record<number, string> = {
                    [SPRITE_COL_FLY_RIGHT]: "fly_right",
                    [SPRITE_COL_FLY_DIAGONAL]: "fly_diagonal",
                    [SPRITE_COL_FLY_FLOAT]: "fly_float",
                    [SPRITE_COL_FLY_DOWN]: "fly_down",
                    [SPRITE_COL_STAND]: "stand",
                    [SPRITE_COL_WALK_START]: "walk_right1",
                    [SPRITE_COL_WALK_RIGHT1]: "walk_right2",
                    [SPRITE_COL_WALK_RIGHT2]: "walk_right3"
                };
                spriteName = colToName[spriteCol];
            }
            const bbox = astronautBoundingBoxes[spriteName];
            if (bbox) {
                ctx!.save();
                ctx!.strokeStyle = 'red';
                ctx!.lineWidth = 2;
                // The context is already translated and scaled as for the sprite.
                const scale = SPRITE_SCALE;
                const x = -drawW / 2 + bbox.minX * scale;
                const y = -drawH / 2 + bbox.minY * scale;
                const w = bbox.width * scale;
                const h = bbox.height * scale;
                ctx!.strokeRect(x, y, w, h);
                ctx!.restore();
            }
        }
        ctx!.restore();

        if (mapBlocksMaskAstronaut.length > 0) {
            if (performanceInstrumentationEnabled) {
                const mapDrawStart = performance.now();
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
                mapDrawMs += performance.now() - mapDrawStart;
            } else {
                drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
            }
        }
        if (layerVisibility.creatures && creatureProjectileDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDrawables, frameNow);
        }

        // --- Draw tight bounding boxes for world map sprites with collision ---
        if (showTightBoundingBoxes && spriteSheet && spriteSheet.complete) {
            // Draw for mapBlocks, doorEntities, buttonEntities with collision=true
            const drawBBox = (entity: any) => {
                if (!entity.collision) return;
                // Use precomputed bounding box for this instance
                let bbox = blockInstanceRotatedBoundingBoxes.get(entity);
                // Fallback if not found
                if (!bbox) {
                    let type = entity.type;
                    let rotation = typeof entity.rotation === "number" ? entity.rotation : 0;
                    bbox =
                        (worldMapRotatedBoundingBoxes[type] && worldMapRotatedBoundingBoxes[type][rotation]) ||
                        worldMapBoundingBoxes[type];
                }
                if (!bbox) return;
                const scale = SPRITE_SCALE;
                const tileW = 32 * scale;
                const tileH = 32 * scale;
                ctx!.save();
                // Center of the sprite
                const drawX = entity.x - camera.x + tileW / 2;
                const drawY = entity.y - camera.y + tileH / 2;
                ctx!.translate(drawX, drawY);
                // Apply rotation if present
                if (entity.rotation) {
                    if (entity.rotation >= 1 && entity.rotation <= 4) {
                        ctx!.rotate(((entity.rotation - 1) * Math.PI) / 2);
                    } else if (entity.rotation === 5) {
                        ctx!.scale(-1, 1);
                    } else if (entity.rotation === 6) {
                        ctx!.scale(1, -1);
                    } else if (entity.rotation === 7) {
                        ctx!.scale(-1, -1);
                    } else if (entity.rotation === 8) {
                        ctx!.rotate(Math.PI / 2);
                        ctx!.scale(-1, 1);
                    } else if (entity.rotation === 9) {
                        ctx!.rotate((3 * Math.PI) / 2);
                        ctx!.scale(-1, 1);
                    }
                }
                const rect = findSpriteRectByType(entity.type);
                const previewSheet = getEntityPreviewSheet(entity as { palette?: number });
                const transformedSprite = rect && previewSheet
                    ? getTransformedSpriteCanvas(
                        previewSheet,
                        rect,
                        typeof entity.rotation === "number" ? entity.rotation : 1
                    )
                    : null;
                const translationOffset = getSpriteTranslationOffset(
                    transformedSprite,
                    normalizeSpriteTranslation(entity.translation),
                    scale
                );
                ctx!.strokeStyle = 'red';
                ctx!.lineWidth = 2;
                // Draw bbox relative to sprite center
                const x = -tileW / 2 + translationOffset.x + bbox.minX * scale;
                const y = -tileH / 2 + translationOffset.y + bbox.minY * scale;
                const w = bbox.width * scale;
                const h = bbox.height * scale;
                ctx!.strokeRect(x, y, w, h);
                ctx!.restore();
            };
            mapBlocks.forEach(drawBBox);
            doorEntities.forEach(drawBBox);
            buttonEntities.forEach(drawBBox);
        }

        if (heldCollectableDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, heldCollectableDrawables, frameNow);
        }

        if (layerVisibility.creatures && creatureProjectileDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDrawables, frameNow);
        }
        if (layerVisibility.creatures && projectileImpactEffects.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, projectileImpactEffects, frameNow);
        }
        if (bulletImpactParticles.length > 0) {
            updateAndDrawBulletImpactParticles(layerVisibility.creatures ? ctx! : null, camera);
        }

        if (!getSoundEnabled()) {
            ctx!.save();
            ctx!.globalAlpha = 0.55;
            ctx!.fillStyle = '#020617';
            ctx!.strokeStyle = '#f8fafc';
            ctx!.lineWidth = 2;
            ctx!.beginPath();
            ctx!.roundRect(canvas.width - 62, 14, 48, 36, 8);
            ctx!.fill();
            ctx!.stroke();

            ctx!.fillStyle = '#f8fafc';
            ctx!.beginPath();
            ctx!.moveTo(canvas.width - 50, 31);
            ctx!.lineTo(canvas.width - 42, 31);
            ctx!.lineTo(canvas.width - 34, 23);
            ctx!.lineTo(canvas.width - 34, 41);
            ctx!.lineTo(canvas.width - 42, 33);
            ctx!.lineTo(canvas.width - 50, 33);
            ctx!.closePath();
            ctx!.fill();

            ctx!.beginPath();
            ctx!.moveTo(canvas.width - 28, 22);
            ctx!.lineTo(canvas.width - 16, 42);
            ctx!.moveTo(canvas.width - 16, 22);
            ctx!.lineTo(canvas.width - 28, 42);
            ctx!.stroke();
            ctx!.restore();
        }
    }

    if (performanceInstrumentationEnabled) {
        drawPhaseMs = performance.now() - drawPhaseStartMs;
    }
    finalizePerformanceInstrumentationFrame(
        frameNow,
        frameStartMs,
        frameTimeMs,
        updateWorkMs,
        mapDrawMs,
        drawPhaseMs
    );
    prevKeys = { ...keys };
    } finally {
        isGameLoopRunning = false;
        if (gameState.isRunning && mapLoaded) {
            scheduleNextFrame();
        }
    }
}

// --- Bounding boxes for astronaut sprites (populated after calculation) ---
let astronautBoundingBoxes: Record<string, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }> = {};
// --- Bounding boxes for world map sprites (populated after calculation) ---
let worldMapBoundingBoxes: Record<string, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }> = {};
// --- Rotated bounding boxes for world map sprites (by type and rotation) ---
let worldMapRotatedBoundingBoxes: Record<string, Record<number, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }>> = {};
// --- Rotated bounding boxes for each block instance (populated after map/entities load) ---
let blockInstanceRotatedBoundingBoxes: WeakMap<object, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }> = new WeakMap();

type CollisionBounds = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

function getEntityRenderOffset(entity: {
    type: string;
    rotation?: number;
    translation?: string | null;
    palette?: number;
    state?: Record<string, unknown>;
    flipAroundVisibleCenter?: boolean;
}) {
    const rotation = typeof entity.rotation === 'number' ? Math.round(entity.rotation) : 0;
    const spriteRect = findSpriteRectByType(entity.type);
    const previewSheet = getEntityPreviewSheet(entity);
    const transformedSprite = spriteRect && previewSheet
        ? getTransformedSpriteCanvas(previewSheet, spriteRect, rotation)
        : null;
    const translationOffset = getSpriteTranslationOffset(
        transformedSprite,
        normalizeSpriteTranslation(entity.translation),
        SPRITE_SCALE
    );
    const authoredRotation = typeof entity.state?.authoredRotation === 'number'
        ? Math.round(Number(entity.state.authoredRotation))
        : rotation;
    const visibleCenterOffset = entity.flipAroundVisibleCenter === true && spriteRect && previewSheet
        ? getVisibleCenterRotationOffset(previewSheet, spriteRect, authoredRotation, rotation)
        : { x: 0, y: 0 };

    return {
        x: translationOffset.x + visibleCenterOffset.x * SPRITE_SCALE,
        y: translationOffset.y + visibleCenterOffset.y * SPRITE_SCALE
    };
}

function getEntityCollisionBounds(entity: {
    type: string;
    rotation?: number;
    translation?: string | null;
    palette?: number;
    state?: Record<string, unknown>;
    flipAroundVisibleCenter?: boolean;
    angleDegrees?: number;
    cropLeftHalf?: boolean;
    cropRightHalf?: boolean;
    creatureProjectile?: { kind?: string };
}) {
    const tileSize = 32 * SPRITE_SCALE;
    const rotation = typeof entity.rotation === "number" ? entity.rotation : 0;
    const renderOffset = getEntityRenderOffset(entity);
    const spriteRect = findSpriteRectByType(entity.type);
    const previewSheet = getEntityPreviewSheet(entity as { palette?: number });

    if (
        Number.isFinite(entity.angleDegrees) &&
        spriteRect &&
        previewSheet &&
        entity.creatureProjectile?.kind !== 'bullet'
    ) {
        const renderedSprite = getRenderedEntitySpriteCanvas(previewSheet, spriteRect, entity);
        const renderedBounds = getSpriteVisibleBounds(renderedSprite?.canvas ?? null);
        if (renderedSprite && renderedBounds) {
            return {
                left: renderOffset.x + renderedSprite.offsetX * SPRITE_SCALE + renderedBounds.minX * SPRITE_SCALE,
                right: renderOffset.x + renderedSprite.offsetX * SPRITE_SCALE + (renderedBounds.maxX + 1) * SPRITE_SCALE - 1,
                top: renderOffset.y + renderedSprite.offsetY * SPRITE_SCALE + renderedBounds.minY * SPRITE_SCALE,
                bottom: renderOffset.y + renderedSprite.offsetY * SPRITE_SCALE + (renderedBounds.maxY + 1) * SPRITE_SCALE - 1
            };
        }
    }

    const bbox =
        worldMapRotatedBoundingBoxes[entity.type]?.[rotation] ||
        blockInstanceRotatedBoundingBoxes.get(entity as object) ||
        worldMapBoundingBoxes[entity.type];
    if (bbox) {
        return {
            left: renderOffset.x + bbox.minX * SPRITE_SCALE,
            right: renderOffset.x + (bbox.maxX + 1) * SPRITE_SCALE - 1,
            top: renderOffset.y + bbox.minY * SPRITE_SCALE,
            bottom: renderOffset.y + (bbox.maxY + 1) * SPRITE_SCALE - 1
        };
    }

    const transformedSprite = spriteRect && previewSheet
        ? getTransformedSpriteCanvas(previewSheet, spriteRect, rotation)
        : null;
    const visibleBounds = getSpriteVisibleBounds(transformedSprite);
    if (visibleBounds) {
        return {
            left: renderOffset.x + visibleBounds.minX * SPRITE_SCALE,
            right: renderOffset.x + (visibleBounds.maxX + 1) * SPRITE_SCALE - 1,
            top: renderOffset.y + visibleBounds.minY * SPRITE_SCALE,
            bottom: renderOffset.y + (visibleBounds.maxY + 1) * SPRITE_SCALE - 1
        };
    }

    return {
        left: 0,
        right: tileSize - 1,
        top: 0,
        bottom: tileSize - 1
    };
}

function getHeldMovementModifiers() {
    if (!heldCollectable || heldCollectable.stored || !heldCollectable.affectsAstronaut) {
        return {
            effectiveWeight: 0,
            walkSpeedScale: 1,
            flightControlScale: 1,
            gravityScale: 1,
            terminalVelocityScale: 1
        };
    }

    const effectiveWeight = heldCollectable.weight < MOVEMENT_SETTINGS.heldWeightIgnoreThreshold
        ? 0
        : heldCollectable.weight;
    if (effectiveWeight === 0) {
        return {
            effectiveWeight,
            walkSpeedScale: 1,
            flightControlScale: 1,
            gravityScale: 1,
            terminalVelocityScale: 1
        };
    }

    const walkSpeedScale = Math.max(
        MOVEMENT_SETTINGS.heldWeightMinScale,
        1 - effectiveWeight * MOVEMENT_SETTINGS.heldWeightWalkPenaltyPerUnit
    );
    const flightControlScale = Math.max(
        MOVEMENT_SETTINGS.heldWeightMinScale,
        1 - effectiveWeight * MOVEMENT_SETTINGS.heldWeightFlyPenaltyPerUnit
    );

    return {
        effectiveWeight,
        walkSpeedScale,
        flightControlScale,
        gravityScale: 1 + effectiveWeight * MOVEMENT_SETTINGS.heldWeightGravityBonusPerUnit,
        terminalVelocityScale: 1 + effectiveWeight * MOVEMENT_SETTINGS.heldWeightTerminalVelocityBonusPerUnit
    };
}

function getAstronautDazeProgress(now: number) {
    const dazeUntil = astronaut.controlDazeUntilMs ?? 0;
    if (dazeUntil <= now) {
        return 0;
    }
    return Math.min(1, (dazeUntil - now) / BULLET_DAZE_DURATION_MS);
}

function getAstronautControlModifiers(now: number) {
    const dazeProgress = getAstronautDazeProgress(now);
    if (dazeProgress <= 0) {
        return {
            walkSpeedScale: 1,
            flightControlScale: 1
        };
    }

    return {
        walkSpeedScale: BULLET_DAZE_WALK_SCALE + (1 - BULLET_DAZE_WALK_SCALE) * (1 - dazeProgress),
        flightControlScale: BULLET_DAZE_FLIGHT_SCALE + (1 - BULLET_DAZE_FLIGHT_SCALE) * (1 - dazeProgress)
    };
}

function applyAstronautBulletDaze(now: number, durationMs: number = BULLET_DAZE_DURATION_MS) {
    astronaut.controlDazeUntilMs = Math.max(astronaut.controlDazeUntilMs ?? 0, now + durationMs);
}

function getFacingSign() {
    return facingLeft ? -1 : 1;
}

function getAstronautRect() {
    const astronautOffsets = getAstronautCollisionOffsets();
    return {
        left: astronaut.position.x + astronautOffsets.left,
        right: astronaut.position.x + astronautOffsets.right,
        top: astronaut.position.y + astronautOffsets.top,
        bottom: astronaut.position.y + astronautOffsets.bottom
    };
}

function getEntityRect(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds
) {
    return {
        left: entityX + collisionBounds.left,
        right: entityX + collisionBounds.right,
        top: entityY + collisionBounds.top,
        bottom: entityY + collisionBounds.bottom
    };
}

function getEntityCenter(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds
) {
    const rect = getEntityRect(entityX, entityY, collisionBounds);
    return {
        x: (rect.left + rect.right) / 2,
        y: (rect.top + rect.bottom) / 2
    };
}

function getEntityPositionFromCenter(
    centerX: number,
    centerY: number,
    collisionBounds: CollisionBounds
) {
    return {
        x: centerX - (collisionBounds.left + collisionBounds.right) / 2,
        y: centerY - (collisionBounds.top + collisionBounds.bottom) / 2
    };
}

function getChunkActivityForWorldPosition(position: Position, now: number): ChunkActivityBand {
    return chunkActivityManager.getChunkActivityForWorldPosition(position, now);
}

function getChunkActivityForEntityPosition(entity: Pick<Position, 'x' | 'y'>, now: number): ChunkActivityBand {
    return getChunkActivityForWorldPosition({ x: entity.x, y: entity.y }, now);
}

function shouldRunChunkBandUpdate(
    chunkActivity: ChunkActivityBand,
    cadencePolicy: ChunkSimulationCadencePolicy,
    frameCounter: number
) {
    const cadenceFrames = Math.max(0, Math.floor(cadencePolicy[chunkActivity]));
    if (cadenceFrames <= 0) {
        return false;
    }
    if (cadenceFrames <= 1) {
        return true;
    }
    return frameCounter % cadenceFrames === 0;
}

function getRenderedEntityWorldSprite(entity: {
    x: number;
    y: number;
    type: string;
    rotation?: number;
    translation?: string | null;
    palette?: number;
    paletteCycle?: PaletteCycleSettings;
    state?: Record<string, unknown>;
    flipAroundVisibleCenter?: boolean;
    angleDegrees?: number;
    cropLeftHalf?: boolean;
    cropRightHalf?: boolean;
}) {
    const spriteRect = findSpriteRectByType(entity.type);
    const previewSheet = getEntityPreviewSheet(entity);
    if (!spriteRect || !previewSheet) {
        return null;
    }

    const renderedSprite = getRenderedEntitySpriteCanvas(previewSheet, spriteRect, entity);
    if (!renderedSprite) {
        return null;
    }

    const translationOffset = getSpriteTranslationOffset(
        renderedSprite.canvas,
        normalizeSpriteTranslation(entity.translation),
        SPRITE_SCALE
    );
    const authoredRotation = typeof entity.state?.authoredRotation === 'number'
        ? Math.round(Number(entity.state.authoredRotation))
        : (typeof entity.rotation === 'number' ? Math.round(entity.rotation) : 1);
    const visibleCenterFlipOffset = entity.flipAroundVisibleCenter === true
        ? getVisibleCenterRotationOffset(previewSheet, spriteRect, authoredRotation, entity.rotation)
        : { x: 0, y: 0 };

    return {
        canvas: renderedSprite.canvas,
        drawX: entity.x
            + renderedSprite.offsetX * SPRITE_SCALE
            + translationOffset.x
            + visibleCenterFlipOffset.x * SPRITE_SCALE,
        drawY: entity.y
            + renderedSprite.offsetY * SPRITE_SCALE
            + translationOffset.y
            + visibleCenterFlipOffset.y * SPRITE_SCALE
    };
}

function makeTeleporterPositionKey(x: number, y: number) {
    return `${x},${y}`;
}

function invalidateTeleporterPadCaches() {
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
    for (const block of mapBlocks) {
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

function canUseKeyLockedTeleporter(_teleporter: TeleporterRuntime) {
    // Hook for future RCD+key progression checks.
    return false;
}

function isTeleporterActive(teleporter: TeleporterRuntime, options?: { ignoreKeyRequirement?: boolean }) {
    if (teleporter.enabled === false) {
        return false;
    }
    if (!options?.ignoreKeyRequirement && teleporter.requiresKey && !canUseKeyLockedTeleporter(teleporter)) {
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
    const baseTranslation = normalizeSpriteTranslation(baseBlock?.translation);
    const baseRendered = getRenderedEntityWorldSprite({
        x: teleporter.baseX,
        y: teleporter.baseY,
        type: 'teleporter',
        palette: basePalette,
        rotation: baseRotation,
        translation: baseTranslation,
        paletteCycle: baseBlock?.paletteCycle
    });
    const padProbe = getRenderedEntityWorldSprite({
        x: teleporter.baseX,
        y: teleporter.baseY,
        type: 'teleporter_pad',
        palette: padRender.palette,
        rotation: padRender.rotation,
        translation: padRender.translation,
        paletteCycle: padRender.paletteCycle
    });

    const baseBounds = baseRendered ? getSpriteVisibleBounds(baseRendered.canvas) : null;
    const padBounds = padProbe ? getSpriteVisibleBounds(padProbe.canvas) : null;
    const fallbackSpan = 32 * SPRITE_SCALE;
    const tileLeft = teleporter.baseX;
    const tileTop = teleporter.baseY;
    const tileRight = tileLeft + fallbackSpan;
    const tileBottom = tileTop + fallbackSpan;
    const tileCenterX = tileLeft + fallbackSpan / 2;
    const tileCenterY = tileTop + fallbackSpan / 2;
    const baseVisibleLeft = baseRendered && baseBounds
        ? baseRendered.drawX + baseBounds.minX * SPRITE_SCALE
        : tileLeft;
    const baseVisibleRight = baseRendered && baseBounds
        ? baseRendered.drawX + (baseBounds.maxX + 1) * SPRITE_SCALE
        : tileRight;
    const baseVisibleTop = baseRendered && baseBounds
        ? baseRendered.drawY + baseBounds.minY * SPRITE_SCALE
        : tileTop;
    const baseVisibleBottom = baseRendered && baseBounds
        ? baseRendered.drawY + (baseBounds.maxY + 1) * SPRITE_SCALE
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
        const left = padProbe.drawX + padBounds.minX * SPRITE_SCALE;
        const right = padProbe.drawX + (padBounds.maxX + 1) * SPRITE_SCALE;
        const top = padProbe.drawY + padBounds.minY * SPRITE_SCALE;
        const bottom = padProbe.drawY + (padBounds.maxY + 1) * SPRITE_SCALE;
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
            candidate.x + TELEPORTER_TILE_SIZE >= left &&
            candidate.x <= right &&
            candidate.y + TELEPORTER_TILE_SIZE >= top &&
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
        { x: teleporter.baseX + TELEPORTER_TILE_SIZE / 2, y: teleporter.baseY + TELEPORTER_TILE_SIZE / 2 },
        { x: teleporter.padX + TELEPORTER_TILE_SIZE / 2, y: teleporter.padY + TELEPORTER_TILE_SIZE / 2 }
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

function getTeleporterRenderPads(
    now: number,
    options?: {
        ignoreKeyRequirement?: boolean;
        activeOnly?: boolean;
        inactiveOnly?: boolean;
        fixedProgress?: number;
        viewport?: TeleporterPadViewportFilter;
        proximity?: TeleporterPadProximityFilter;
    }
): TeleporterRenderPad[] {
    const renderPads: TeleporterRenderPad[] = [];
    const sweepProgress = typeof options?.fixedProgress === 'number'
        ? Math.max(0, Math.min(1, options.fixedProgress))
        : (() => {
            const frameIndex = Math.floor(now / TELEPORTER_PAD_SWEEP_FRAME_MS) % TELEPORTER_PAD_SWEEP_PHASES.length;
            return TELEPORTER_PAD_SWEEP_PHASES[frameIndex];
        })();
    const { baseBlocksById, padBlocksById } = getTeleporterBlockIndex();
    for (const teleporter of teleporterEntities) {
        if (options?.viewport && !isTeleporterInViewport(teleporter, options.viewport)) {
            continue;
        }
        if (options?.proximity && !isTeleporterNearPoint(teleporter, options.proximity)) {
            continue;
        }
        const active = isTeleporterActive(teleporter, options);
        if (options?.activeOnly && !active) {
            continue;
        }
        if (options?.inactiveOnly && active) {
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
        const translation = normalizeSpriteTranslation(padBlock?.translation ?? baseBlock?.translation);
        const paletteCycle = padBlock?.paletteCycle;
        const baseRotation = typeof baseBlock?.rotation === 'number' ? baseBlock.rotation : 1;
        const basePalette = typeof baseBlock?.palette === 'number' ? baseBlock.palette : palette;
        const baseTranslation = normalizeSpriteTranslation(baseBlock?.translation);
        const padCycleKey = paletteCycle && Array.isArray(paletteCycle.palettes)
            ? `${paletteCycle.intervalMs ?? 0}:${paletteCycle.palettes.join(',')}`
            : 'none';
        const progress = !active && !options?.activeOnly
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
    for (const teleporter of teleporterEntities) {
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
    options?: { ignoreKeyRequirement?: boolean }
) {
    const viewport = {
        x: camera.x,
        y: camera.y,
        width: canvas.width,
        height: canvas.height,
        margin: TELEPORTER_TILE_SIZE * 2
    };
    const pads = getTeleporterRenderPads(now, {
        ignoreKeyRequirement: options?.ignoreKeyRequirement,
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
    drawEntities(
        context,
        camera,
        spriteMap,
        remappedSpriteSheets,
        SPRITE_SCALE,
        teleporterPadDrawEntities,
        now
    );
    context.globalAlpha = previousAlpha;
}

function updateTeleporterPadTeleporting(now: number, simulationFrame: number) {
    if (isDesignerOpen() || teleporting || now < teleporterTouchCooldownUntilMs) {
        return;
    }
    const astronautRect = getAstronautRect();
    for (const activePad of getTeleporterRenderPads(now, {
        activeOnly: true,
        proximity: {
            x: astronaut.position.x + TELEPORTER_TILE_SIZE / 2,
            y: astronaut.position.y + TELEPORTER_TILE_SIZE / 2,
            radius: TELEPORTER_TILE_SIZE * 8
        }
    })) {
        const teleporterChunkActivity = getChunkActivityForWorldPosition(
            { x: activePad.x, y: activePad.y },
            now
        );
        if (!shouldRunChunkBandUpdate(teleporterChunkActivity, TELEPORTER_CHUNK_CADENCE, simulationFrame)) {
            continue;
        }
        const padLeft = activePad.x;
        const padTop = activePad.y;
        const padRight = padLeft + TELEPORTER_TILE_SIZE;
        const padBottom = padTop + TELEPORTER_TILE_SIZE;
        const overlapsPad = !(
            astronautRect.right < padLeft ||
            astronautRect.left > padRight ||
            astronautRect.bottom < padTop ||
            astronautRect.top > padBottom
        );
        if (!overlapsPad) {
            continue;
        }
        if (startTeleportToLocation(getTeleporterActiveDestination(activePad.teleporter))) {
            teleporterTouchCooldownUntilMs = now + 700;
        }
        break;
    }
}

function getRenderedSpriteOpaqueSamples(canvas: HTMLCanvasElement) {
    const ctx = canvas.getContext('2d');
    if (!ctx) {
        return [];
    }
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
    const points: Array<{ x: number; y: number }> = [];
    for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
            if (imageData[(y * canvas.width + x) * 4 + 3] > 0) {
                points.push({ x, y });
            }
        }
    }
    return points;
}

function isRenderedSpriteOpaqueAtWorld(
    rendered: { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null,
    worldX: number,
    worldY: number
) {
    if (!rendered) {
        return false;
    }

    const localX = Math.floor((worldX - rendered.drawX) / SPRITE_SCALE);
    const localY = Math.floor((worldY - rendered.drawY) / SPRITE_SCALE);
    if (
        localX < 0 ||
        localY < 0 ||
        localX >= rendered.canvas.width ||
        localY >= rendered.canvas.height
    ) {
        return false;
    }

    const ctx = rendered.canvas.getContext('2d');
    if (!ctx) {
        return false;
    }
    return ctx.getImageData(localX, localY, 1, 1).data[3] > 0;
}

function doRenderedSpritesOverlap(
    first: { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null,
    second: { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null
) {
    if (!first || !second) {
        return false;
    }

    const overlapLeft = Math.max(first.drawX, second.drawX);
    const overlapTop = Math.max(first.drawY, second.drawY);
    const overlapRight = Math.min(
        first.drawX + first.canvas.width * SPRITE_SCALE,
        second.drawX + second.canvas.width * SPRITE_SCALE
    );
    const overlapBottom = Math.min(
        first.drawY + first.canvas.height * SPRITE_SCALE,
        second.drawY + second.canvas.height * SPRITE_SCALE
    );

    if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) {
        return false;
    }

    for (let worldY = Math.floor(overlapTop); worldY < Math.ceil(overlapBottom); worldY++) {
        for (let worldX = Math.floor(overlapLeft); worldX < Math.ceil(overlapRight); worldX++) {
            if (
                isRenderedSpriteOpaqueAtWorld(first, worldX, worldY) &&
                isRenderedSpriteOpaqueAtWorld(second, worldX, worldY)
            ) {
                return true;
            }
        }
    }

    return false;
}

function getAstronautRenderedWorldSprite() {
    if (!(astronautSpriteSource || spriteSheet) || !(spriteSheet && spriteSheet.complete)) {
        return null;
    }

    const spriteRect = getSpriteRectFromMap(SPRITE_ROW, currentAstronautRenderState.spriteCol);
    if (!spriteRect) {
        return null;
    }

    let rotation = 1;
    if (currentAstronautRenderState.flipSprite && currentAstronautRenderState.flipVertical) {
        rotation = 7;
    } else if (currentAstronautRenderState.flipSprite) {
        rotation = 5;
    } else if (currentAstronautRenderState.flipVertical) {
        rotation = 6;
    }

    const renderedSprite = getRenderedEntitySpriteCanvas(
        astronautSpriteSource || spriteSheet,
        spriteRect,
        { rotation }
    );
    if (!renderedSprite) {
        return null;
    }

    return {
        canvas: renderedSprite.canvas,
        drawX: astronaut.position.x - (spriteRect.w * SPRITE_SCALE) / 2 + renderedSprite.offsetX * SPRITE_SCALE,
        drawY: astronaut.position.y - (spriteRect.h * SPRITE_SCALE) / 2 + renderedSprite.offsetY * SPRITE_SCALE
    };
}

function getRenderedSpriteWorldCenter(
    rendered: { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null
) {
    if (!rendered) {
        return null;
    }

    const visibleBounds = getSpriteVisibleBounds(rendered.canvas);
    if (visibleBounds) {
        const width = visibleBounds.maxX - visibleBounds.minX + 1;
        const height = visibleBounds.maxY - visibleBounds.minY + 1;
        return {
            x: rendered.drawX + (visibleBounds.minX + width / 2) * SPRITE_SCALE,
            y: rendered.drawY + (visibleBounds.minY + height / 2) * SPRITE_SCALE
        };
    }

    return {
        x: rendered.drawX + (rendered.canvas.width * SPRITE_SCALE) / 2,
        y: rendered.drawY + (rendered.canvas.height * SPRITE_SCALE) / 2
    };
}

function getAstronautAimPoint() {
    const renderedCenter = getRenderedSpriteWorldCenter(getAstronautRenderedWorldSprite());
    if (renderedCenter) {
        return renderedCenter;
    }

    const astronautRect = getAstronautRect();
    return {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };
}

function getEntitySideAnchorPoint(
    entity: {
        x: number;
        y: number;
        type: string;
        rotation?: number;
        translation?: string | null;
        palette?: number;
        state?: Record<string, unknown>;
        flipAroundVisibleCenter?: boolean;
        angleDegrees?: number;
        cropLeftHalf?: boolean;
        cropRightHalf?: boolean;
    },
    side: 'left' | 'right'
) {
    const rendered = getRenderedEntityWorldSprite(entity);
    if (!rendered) {
        return null;
    }

    const opaquePoints = getRenderedSpriteOpaqueSamples(rendered.canvas);
    if (opaquePoints.length === 0) {
        return null;
    }

    const edgeX = side === 'left'
        ? Math.min(...opaquePoints.map((point) => point.x))
        : Math.max(...opaquePoints.map((point) => point.x));
    const edgePoints = opaquePoints.filter((point) => point.x === edgeX);
    const averageY = edgePoints.reduce((sum, point) => sum + point.y + 0.5, 0) / edgePoints.length;

    return {
        x: rendered.drawX + (edgeX + 0.5) * SPRITE_SCALE,
        y: rendered.drawY + averageY * SPRITE_SCALE
    };
}

function getEntityFrontAnchorPoint(
    entity: {
        x: number;
        y: number;
        type: string;
        rotation?: number;
        translation?: string | null;
        palette?: number;
        state?: Record<string, unknown>;
        flipAroundVisibleCenter?: boolean;
        angleDegrees?: number;
        cropLeftHalf?: boolean;
        cropRightHalf?: boolean;
    },
    direction: Position
) {
    const rendered = getRenderedEntityWorldSprite(entity);
    if (!rendered) {
        return null;
    }

    const opaquePoints = getRenderedSpriteOpaqueSamples(rendered.canvas);
    if (opaquePoints.length === 0) {
        return null;
    }

    const magnitude = Math.hypot(direction.x, direction.y);
    const normalizedDirection = magnitude > 0.001
        ? { x: direction.x / magnitude, y: direction.y / magnitude }
        : { x: 1, y: 0 };
    let bestPoint = opaquePoints[0];
    let bestScore = Number.NEGATIVE_INFINITY;
    for (const point of opaquePoints) {
        const score = (point.x + 0.5) * normalizedDirection.x + (point.y + 0.5) * normalizedDirection.y;
        if (score > bestScore) {
            bestScore = score;
            bestPoint = point;
        }
    }

    return {
        x: rendered.drawX + (bestPoint.x + 0.5) * SPRITE_SCALE,
        y: rendered.drawY + (bestPoint.y + 0.5) * SPRITE_SCALE
    };
}

function getStableCreatureAimCenter(creature: Creature, rotation: number) {
    const spriteRect = findSpriteRectByType(creature.type);
    const previewSheet = getEntityPreviewSheet(creature);
    if (!spriteRect || !previewSheet) {
        const bounds = getEntityCollisionBounds(creature);
        return getEntityCenter(creature.x, creature.y, bounds);
    }
    const transformedSprite = getTransformedSpriteCanvas(previewSheet, spriteRect, rotation, false);
    const visibleBounds = getSpriteVisibleBounds(transformedSprite);
    const renderOffset = getEntityRenderOffset({
        ...creature,
        rotation
    });
    if (!visibleBounds) {
        return {
            x: creature.x + renderOffset.x + (spriteRect.w * SPRITE_SCALE) / 2,
            y: creature.y + renderOffset.y + (spriteRect.h * SPRITE_SCALE) / 2
        };
    }

    return {
        x: creature.x + renderOffset.x + ((visibleBounds.minX + visibleBounds.maxX + 1) / 2) * SPRITE_SCALE,
        y: creature.y + renderOffset.y + ((visibleBounds.minY + visibleBounds.maxY + 1) / 2) * SPRITE_SCALE
    };
}

function getTurretFacingRotations(authoredRotation: number) {
    const normalizedRotation = typeof authoredRotation === 'number'
        ? Math.round(authoredRotation)
        : 1;

    switch (normalizedRotation) {
        case 5:
            return { left: 5, right: 1, authoredFacing: -1 };
        case 2:
            return { left: 4, right: 2, authoredFacing: 1 };
        case 4:
            return { left: 4, right: 2, authoredFacing: -1 };
        case 3:
            return { left: 3, right: 6, authoredFacing: -1 };
        case 6:
            return { left: 3, right: 6, authoredFacing: 1 };
        case 7:
            return { left: 7, right: 6, authoredFacing: -1 };
        case 1:
        default:
            return { left: 5, right: 1, authoredFacing: 1 };
    }
}

function isTurretLikeCreature(creature: Creature) {
    return creature.archetype === 'turret' || creature.movementMode === 'turret';
}

function isBirdCreature(creature: Creature, authoredType = getCreatureAuthoredType(creature.type, creature.state)) {
    return creature.archetype === 'bird' || /^bird/i.test(authoredType);
}

function getBirdSpriteFrameOffset(type: string) {
    const match = /^bird(\d+)$/i.exec(type);
    if (!match) {
        return 0;
    }
    return (Math.max(1, Number(match[1])) - 1) % BIRD_ANIMATION_FRAMES.length;
}

function getAnimatedBirdSpriteType(authoredType: string, frameNow: number, entityId?: number) {
    const frameOffset = getBirdSpriteFrameOffset(authoredType);
    const entityOffset = typeof entityId === 'number'
        ? Math.abs(entityId) % BIRD_ANIMATION_FRAMES.length
        : 0;
    const frameIndex = (
        Math.floor(frameNow / BIRD_ANIMATION_FRAME_DURATION_MS) + frameOffset + entityOffset
    ) % BIRD_ANIMATION_FRAMES.length;
    return BIRD_ANIMATION_FRAMES[frameIndex];
}

function clampToRange(value: number, minimum: number, maximum: number) {
    return Math.max(minimum, Math.min(maximum, value));
}

function normalizeBulletImpactAudioSettings(
    settings: BulletImpactAudioSettings | Partial<BulletImpactAudioSettings> | null | undefined
): BulletImpactAudioSettings {
    const normalizeKey = (value: unknown): BulletImpactAudioSettings['primary'] =>
        value === 'bulletExplosion2' ? 'bulletExplosion2' : 'bulletExplosion';

    return {
        primary: normalizeKey(settings?.primary),
        alternate: normalizeKey(settings?.alternate),
        alternateChance: clampToRange(
            typeof settings?.alternateChance === 'number'
                ? settings.alternateChance
                : BULLET_IMPACT_AUDIO_SETTINGS.alternateChance,
            0,
            1
        ),
        volume: clampToRange(
            typeof settings?.volume === 'number'
                ? settings.volume
                : BULLET_IMPACT_AUDIO_SETTINGS.volume,
            0,
            1
        )
    };
}

function getCreatureProjectileLaunchSpeed(creature: Creature) {
    const kind = getProjectileKindForFireMode(creature.fireMode);
    const projectileSettings = kind ? getProjectileSettings(kind) : null;
    return Math.max(1, creature.projectileSpeed) * (projectileSettings?.speedMultiplier ?? 1);
}

function getNextCreatureFireAt(frameNow: number, creature: Creature) {
    const baseCooldown = Math.max(250, creature.fireCooldownMs);
    const variance = Math.max(0, creature.fireCooldownVarianceMs ?? 0);
    const offset = variance > 0 ? (Math.random() * 2 - 1) * variance : 0;
    return frameNow + Math.max(250, baseCooldown + offset);
}

function hasCreatureLineOfSight(start: Position, target: Position) {
    const dx = target.x - start.x;
    const dy = target.y - start.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 8) {
        return true;
    }

    const steps = Math.max(2, Math.ceil(distance / 6));
    for (let index = 1; index < steps; index++) {
        const progress = index / steps;
        const sampleX = start.x + dx * progress;
        const sampleY = start.y + dy * progress;
        if (getSolidBlockAtWorld(
            sampleX,
            sampleY,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        )) {
            return false;
        }
    }

    return true;
}

function getCreatureTargetPoint(
    creature: Creature,
    aimOrigin: Position,
    targetCenter: Position
) {
    const leadFactor = Math.max(0, creature.aimLeadFactor ?? 0);
    const astronautSpeed = Math.hypot(astronaut.velocity.x, astronaut.velocity.y);
    const jitterScale = clampToRange(astronautSpeed / 2.5, 0, 1);
    const jitterRadius = Math.max(0, creature.aimJitterPx ?? 0) * jitterScale;
    const projectileTravelFrames = Math.max(
        1,
        Math.hypot(targetCenter.x - aimOrigin.x, targetCenter.y - aimOrigin.y) /
            Math.max(1, getCreatureProjectileLaunchSpeed(creature))
    );
    const jitterAngle = Math.random() * Math.PI * 2;
    const jitterDistance = Math.random() * jitterRadius;

    return {
        x: targetCenter.x + astronaut.velocity.x * projectileTravelFrames * leadFactor + Math.cos(jitterAngle) * jitterDistance,
        y: targetCenter.y + astronaut.velocity.y * projectileTravelFrames * leadFactor + Math.sin(jitterAngle) * jitterDistance
    };
}

function isGrenadeCollectable(collectable: Collectable | null | undefined): collectable is Collectable {
    return !!collectable && isGrenadeCollectableType(collectable.type);
}

function getGrenadeExplosionRadius(type: string, explosionRadius?: number) {
    const fallbackRadius = type === 'plasma_grenade'
        ? MOVEMENT_SETTINGS.plasmaGrenadeExplosionRadius
        : MOVEMENT_SETTINGS.grenadeExplosionRadius;
    return typeof explosionRadius === 'number'
        ? Math.max(1, explosionRadius)
        : fallbackRadius;
}

function getGrenadeExplosionPower(type: string, explosionPower?: number) {
    const fallbackPower = getDefaultGrenadeExplosionPower(type) ?? MOVEMENT_SETTINGS.grenadeExplosionPower;
    const resolvedPower = typeof explosionPower === 'number' ? explosionPower : fallbackPower;
    return clampToRange(resolvedPower, 0.5, MOVEMENT_SETTINGS.grenadeMaxExplosionPower);
}

function getExplosionDamageSource(type: 'grenade' | 'plasma_grenade' | 'coronium') {
    if (type === 'plasma_grenade') {
        return 'plasma_grenade_explosion' as const;
    }
    if (type === 'coronium') {
        return 'coronium_explosion' as const;
    }
    return 'grenade_explosion' as const;
}

function isRadioactiveBoulderCollectable(collectable: Collectable) {
    return collectable.type === 'boulder' && collectable.radioactive === true;
}

function isCoroniumExplosionAtCenter(center: Position) {
    const radioactiveBoulderCenters = collectableEntities
        .filter((collectable) =>
            isRadioactiveBoulderCollectable(collectable) &&
            !collectable.collected &&
            !collectable.stored
        )
        .map((collectable) => getEntityCenter(
            collectable.x,
            collectable.y,
            getEntityCollisionBounds(collectable)
        ));

    for (let index = 0; index < radioactiveBoulderCenters.length; index++) {
        for (let otherIndex = index + 1; otherIndex < radioactiveBoulderCenters.length; otherIndex++) {
            const a = radioactiveBoulderCenters[index];
            const b = radioactiveBoulderCenters[otherIndex];
            const midpoint = {
                x: (a.x + b.x) / 2,
                y: (a.y + b.y) / 2
            };
            const pairDistance = Math.hypot(a.x - b.x, a.y - b.y);
            if (
                pairDistance <= 120 &&
                Math.hypot(midpoint.x - center.x, midpoint.y - center.y) <= 28
            ) {
                return true;
            }
        }
    }

    return false;
}

function getEffectiveDestructibleSettings(entity: DestructibleRuntimeEntity, category: 'world' | 'doors') {
    return {
        destructible: typeof entity.destructible === 'boolean'
            ? entity.destructible
            : getDefaultDestructibleEnabled(category, entity.type),
        health: typeof entity.destructionHealth === 'number'
            ? Math.max(0.1, entity.destructionHealth)
            : getDefaultDestructibleHealth(category, entity.type),
        source: typeof entity.destructionSource === 'string'
            ? entity.destructionSource
            : getDefaultDestructionSource(category, entity.type)
    };
}

function matchesDestructionSourceRequirement(
    requiredSource: DestructionSourceRequirement,
    source: DestructionSourceRequirement
) {
    if (requiredSource === 'any_explosion') {
        return true;
    }
    return requiredSource === source;
}

function removeDoorEntity(door: Door) {
    const index = doorEntities.indexOf(door);
    if (index >= 0) {
        doorEntities.splice(index, 1);
    }
}

function removeMapBlockEntity(block: MapBlock) {
    const index = mapBlocks.indexOf(block);
    if (index >= 0) {
        mapBlocks.splice(index, 1);
    }
}

function getDestructibleCollisionBounds(entity: DestructibleRuntimeEntity) {
    return getEntityCollisionBounds({
        ...entity,
        palette: typeof entity.palette === 'number' ? entity.palette : 0
    });
}

function spawnDestructibleExplosionEffect(
    entity: DestructibleRuntimeEntity,
    category: 'world' | 'doors',
    source: DestructionSourceRequirement,
    centerX: number,
    centerY: number,
    blastCenter?: Position
) {
    const palette = typeof entity.palette === 'number' ? entity.palette : 0;
    const explosionType = source === 'plasma_grenade_explosion' || source === 'coronium_explosion'
        ? 'plasma_grenade'
        : 'grenade';
    spawnGrenadeExplosionEffect(explosionType, palette, centerX, centerY);
    if (category === 'doors') {
        const sourceCenter = blastCenter ?? { x: centerX, y: centerY };
        const horizontalDirection = centerX >= sourceCenter.x ? 1 : -1;
        const verticalDirection = centerY - sourceCenter.y;
        const distance = Math.hypot(centerX - sourceCenter.x, verticalDirection);
        const normalizedDirection = distance > 0.001
            ? {
                x: (centerX - sourceCenter.x) / distance,
                y: verticalDirection / distance
            }
            : {
                x: horizontalDirection,
                y: -0.35
            };
        const liftBias = Math.min(-0.25, normalizedDirection.y - 0.35);
        doorDestructionEffects.push({
            x: entity.x,
            y: entity.y,
            type: entity.type,
            palette,
            rotation: typeof (entity as { rotation?: unknown }).rotation === 'number'
                ? Math.round(Number((entity as { rotation?: unknown }).rotation))
                : 1,
            translation: typeof (entity as { translation?: unknown }).translation === 'string'
                ? String((entity as { translation?: unknown }).translation)
                : undefined,
            state: typeof (entity as { state?: unknown }).state === 'object' && (entity as { state?: unknown }).state
                ? { ...((entity as { state?: Record<string, unknown> }).state ?? {}) }
                : undefined,
            flipAroundVisibleCenter: (entity as { flipAroundVisibleCenter?: unknown }).flipAroundVisibleCenter === true,
            angleDegrees: 0,
            vx: normalizedDirection.x * 8.5,
            vy: liftBias * 6.4,
            spinVelocity: horizontalDirection * 28,
            life: 24,
            maxLife: 24
        });
    }
}

function damageDestructibleEntity(
    entity: DestructibleRuntimeEntity,
    category: 'world' | 'doors',
    damage: number,
    source: DestructionSourceRequirement,
    blastCenter?: Position
) {
    const settings = getEffectiveDestructibleSettings(entity, category);
    if (
        !settings.destructible ||
        damage <= 0 ||
        !matchesDestructionSourceRequirement(settings.source, source)
    ) {
        return false;
    }

    const accumulatedDamage = (destructibleDamageByEntity.get(entity as object) ?? 0) + damage;
    if (accumulatedDamage < settings.health) {
        destructibleDamageByEntity.set(entity as object, accumulatedDamage);
        return false;
    }

    const bounds = getDestructibleCollisionBounds(entity);
    const center = getEntityCenter(entity.x, entity.y, bounds);
    spawnDestructibleExplosionEffect(entity, category, source, center.x, center.y, blastCenter);
    destructibleDamageByEntity.delete(entity as object);
    if (category === 'doors') {
        removeDoorEntity(entity as Door);
    } else {
        removeMapBlockEntity(entity as MapBlock);
    }
    return true;
}

function applyExplosionDamageToDestructibles(
    center: Position,
    radius: number,
    maxDamage: number,
    source: DestructionSourceRequirement
) {
    let destroyedAny = false;
    let destroyedDoor = false;

    for (const door of [...doorEntities]) {
        const bounds = getEntityCollisionBounds(door);
        const entityCenter = getEntityCenter(door.x, door.y, bounds);
        const distance = Math.hypot(entityCenter.x - center.x, entityCenter.y - center.y);
        if (distance > radius) {
            continue;
        }
        const scaledDamage = maxDamage * (1 - distance / radius);
        if (damageDestructibleEntity(door, 'doors', scaledDamage, source, center)) {
            destroyedAny = true;
            destroyedDoor = true;
        }
    }

    for (const block of [...mapBlocks]) {
        const bounds = getDestructibleCollisionBounds(block);
        const entityCenter = getEntityCenter(block.x, block.y, bounds);
        const distance = Math.hypot(entityCenter.x - center.x, entityCenter.y - center.y);
        if (distance > radius) {
            continue;
        }
        const scaledDamage = maxDamage * (1 - distance / radius);
        if (damageDestructibleEntity(block, 'world', scaledDamage, source, center)) {
            destroyedAny = true;
        }
    }

    if (destroyedAny) {
        afterWorldDataMutated();
    }

    return {
        destroyedAny,
        destroyedDoor
    };
}

function syncGrenadeFuseState(collectable: Collectable, now: number = performance.now()) {
    if (!isGrenadeCollectable(collectable)) {
        return;
    }

    if (collectable.armed) {
        if (typeof collectable.armedAtMs !== 'number') {
            collectable.armedAtMs = now;
        }
    } else {
        collectable.armedAtMs = undefined;
    }
}

function setGrenadeCollectableArmedState(collectable: Collectable, armed: boolean, now: number = performance.now()) {
    if (!isGrenadeCollectable(collectable)) {
        return;
    }

    if (armed) {
        collectable.arm(now);
    } else {
        collectable.disarm();
    }
}

function spawnGrenadeExplosionEffect(type: 'grenade' | 'plasma_grenade', palette: number, centerX: number, centerY: number) {
    const settings = getProjectileSettings(type);
    const effectBounds = getEntityCollisionBounds({
        type: settings.spriteType,
        rotation: 1
    });
    const effectPosition = getEntityPositionFromCenter(centerX, centerY, effectBounds);
    spawnProjectileImpactEffect(new Collectable({
        x: effectPosition.x,
        y: effectPosition.y,
        type: settings.spriteType,
        palette,
        rotation: 1,
        pickupEnabled: false,
        storable: false,
        affectsAstronaut: false,
        collision: false,
        velocity: { x: 0, y: 0 },
        weight: 0,
        bounciness: 0,
        isGrounded: false,
        creatureProjectile: {
            kind: type,
            homing: false,
            remainingFrames: 0,
            damage: 0
        }
    }) as CreatureProjectileCollectable);
}

function getProjectileSettings(kind: CreatureProjectileKind) {
    return CREATURE_PROJECTILE_SETTINGS[kind];
}

function updateProjectileFlightFrame(
    projectile: CreatureProjectileCollectable,
    projectileSettings: ReturnType<typeof getProjectileSettings>
) {
    const flightAnimation = projectileSettings.flightAnimation;
    if (!flightAnimation || flightAnimation.frames.length === 0) {
        projectile.type = projectileSettings.spriteType;
        return;
    }

    const ageFrames = Math.max(0, projectileSettings.lifetimeFrames - projectile.creatureProjectile.remainingFrames);
    const frameDurationFrames = Math.max(1, flightAnimation.frameDurationFrames);
    if (projectile.creatureProjectile.kind === 'bullet' && flightAnimation.frames.length > 1) {
        const velocity = projectile.velocity;
        const speed = Math.hypot(velocity.x, velocity.y);
        if (speed <= 0.001) {
            projectile.type = flightAnimation.frames[0];
            return;
        }
        const angle = Math.atan2(Math.abs(velocity.y), Math.abs(velocity.x));
        const angleRatio = clampToRange(angle / (Math.PI / 2), 0, 1);
        const frameIndex = Math.min(
            flightAnimation.frames.length - 1,
            Math.round(angleRatio * (flightAnimation.frames.length - 1))
        );
        projectile.type = flightAnimation.frames[frameIndex];
        return;
    }

    const frameIndex = Math.floor(ageFrames / frameDurationFrames) % flightAnimation.frames.length;
    projectile.type = flightAnimation.frames[frameIndex];
}

function getProjectileKindForFireMode(fireMode: CreatureFireMode): CreatureProjectileKind | null {
    if (fireMode === 'bullets') {
        return 'bullet';
    }
    if (fireMode === 'grenades') {
        return 'grenade';
    }
    if (fireMode === 'plasma_grenades') {
        return 'plasma_grenade';
    }
    if (fireMode === 'energy_pods') {
        return 'energy_pod';
    }
    return null;
}

function updateProjectileImpactEffectFrame(effect: ProjectileImpactEffect) {
    const nextType = effect.frames[clampToRange(effect.frameIndex, 0, effect.frames.length - 1)];
    const bounds = getEntityCollisionBounds({
        type: nextType,
        rotation: effect.rotation
    });
    const position = getEntityPositionFromCenter(effect.centerX, effect.centerY, bounds);
    effect.type = nextType;
    effect.x = position.x;
    effect.y = position.y;
}

function spawnProjectileImpactEffect(
    projectile: CreatureProjectileCollectable,
    entityX = projectile.x,
    entityY = projectile.y,
    centerOverride?: Position
) {
    const settings = getProjectileSettings(projectile.creatureProjectile.kind);
    const impactAnimation = settings.impactAnimation;
    if (!impactAnimation || impactAnimation.frames.length === 0) {
        return;
    }
    const bounds = getEntityCollisionBounds(projectile);
    const center = centerOverride ?? getEntityCenter(entityX, entityY, bounds);
    const effect: ProjectileImpactEffect = {
        x: entityX,
        y: entityY,
        centerX: center.x,
        centerY: center.y,
        type: impactAnimation.frames[0],
        palette: impactAnimation.paletteSource === 'projectile' ? projectile.palette ?? 0 : 0,
        rotation: 1,
        frameIndex: 0,
        frameTimer: 0,
        frames: [...impactAnimation.frames],
        frameDurationFrames: Math.max(1, impactAnimation.frameDurationFrames)
    };
    updateProjectileImpactEffectFrame(effect);
    projectileImpactEffects.push(effect);

    if (projectile.creatureProjectile.kind === 'bullet') {
        playBulletImpactSound();
        spawnBulletImpactParticles(effect.centerX, effect.centerY);
        applyAstronautBulletImpactBlast(effect.centerX, effect.centerY, projectile.creatureProjectile.damage);
    }
}

function updateProjectileImpactEffects() {
    const nextEffects: ProjectileImpactEffect[] = [];
    for (const effect of projectileImpactEffects) {
        effect.frameTimer++;
        if (effect.frameTimer >= effect.frameDurationFrames) {
            effect.frameTimer = 0;
            effect.frameIndex++;
            if (effect.frameIndex >= effect.frames.length) {
                continue;
            }
            updateProjectileImpactEffectFrame(effect);
        }
        nextEffects.push(effect);
    }
    projectileImpactEffects = nextEffects;
}

function updateDoorDestructionEffects() {
    const nextEffects: DoorDestructionEffect[] = [];
    for (const effect of doorDestructionEffects) {
        effect.x += effect.vx;
        effect.y += effect.vy;
        effect.vy += 0.22;
        effect.vx *= 0.97;
        effect.angleDegrees += effect.spinVelocity;
        effect.spinVelocity *= 0.92;
        effect.life--;
        if (effect.life <= 0) {
            continue;
        }
        nextEffects.push(effect);
    }
    doorDestructionEffects = nextEffects;
}

function drawDoorDestructionEffects(context: CanvasRenderingContext2D, camera: Position) {
    for (const effect of doorDestructionEffects) {
        const rendered = getRenderedEntityWorldSprite(effect);
        if (!rendered) {
            continue;
        }
        const age = effect.maxLife - effect.life;
        const fadeAlpha = clampToRange(effect.life / effect.maxLife, 0, 1);
        const alpha = Math.max(0.2, fadeAlpha);
        if (alpha <= 0.02) {
            continue;
        }
        const drawX = rendered.drawX - camera.x;
        const drawY = rendered.drawY - camera.y;
        const drawWidth = rendered.canvas.width * SPRITE_SCALE;
        const drawHeight = rendered.canvas.height * SPRITE_SCALE;
        const flashProgress = age < 6 ? 1 - age / 6 : 0;
        context.save();
        context.globalAlpha = alpha;
        context.drawImage(
            rendered.canvas,
            drawX,
            drawY,
            drawWidth,
            drawHeight
        );
        if (flashProgress > 0) {
            const flashScale = 1 + flashProgress * 0.24;
            const flashWidth = drawWidth * flashScale;
            const flashHeight = drawHeight * flashScale;
            context.globalCompositeOperation = 'lighter';
            context.globalAlpha = 0.55 * flashProgress;
            context.drawImage(
                rendered.canvas,
                drawX - (flashWidth - drawWidth) / 2,
                drawY - (flashHeight - drawHeight) / 2,
                flashWidth,
                flashHeight
            );
        }
        context.restore();
    }
}

function spawnBulletImpactParticles(centerX: number, centerY: number) {
    const particleCount = 28 + Math.floor(Math.random() * 9);
    for (let index = 0; index < particleCount; index++) {
        const angle = Math.random() * Math.PI * 2;
        const launchRadius = 2 + Math.random() * 6;
        const speed = 1.4 + Math.random() * 4.6;
        const life = 18 + Math.floor(Math.random() * 10);
        bulletImpactParticles.push({
            x: centerX + Math.cos(angle) * launchRadius,
            y: centerY + Math.sin(angle) * launchRadius,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed - Math.random() * 1.2,
            color: BULLET_IMPACT_PARTICLE_COLORS[Math.floor(Math.random() * BULLET_IMPACT_PARTICLE_COLORS.length)],
            size: Math.random() < 0.4 ? 4 : 3,
            life,
            maxLife: life
        });
    }
}

function updateAndDrawBulletImpactParticles(context: CanvasRenderingContext2D | null, camera: Position) {
    const nextParticles: BulletImpactParticle[] = [];

    for (const particle of bulletImpactParticles) {
        particle.x += particle.vx;
        particle.y += particle.vy;
        particle.vy += 0.08;
        particle.vx *= 0.97;
        particle.life--;

        if (particle.life <= 0) {
            continue;
        }

        const screenX = Math.round(particle.x - camera.x);
        const screenY = Math.round(particle.y - camera.y);
        if (
            screenX + particle.size < 0 ||
            screenX > canvas.width ||
            screenY + particle.size < 0 ||
            screenY > canvas.height
        ) {
            continue;
        }

        nextParticles.push(particle);
        if (context) {
            context.save();
            context.globalAlpha = Math.max(0.45, particle.life / particle.maxLife);
            context.fillStyle = particle.color;
            context.fillRect(screenX, screenY, particle.size, particle.size);
            context.restore();
        }
    }

    bulletImpactParticles = nextParticles;
}

function getProjectileAngleDegrees(velocity: Position) {
    if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) {
        return 0;
    }
    if (Math.abs(velocity.x) < 0.001 && Math.abs(velocity.y) < 0.001) {
        return 0;
    }
    return (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI;
}

function convertProjectileToEnergyPodCollectable(projectile: CreatureProjectileCollectable) {
    projectile.type = 'energy_pod2';
    projectile.name = 'energy_pod';
    projectile.weight = 0.1;
    projectile.pickupEnabled = true;
    projectile.storable = false;
    projectile.affectsAstronaut = false;
    projectile.collision = false;
    projectile.velocity = { x: 0, y: 0 };
    projectile.isGrounded = false;
    projectile.ttlFrames = MOVEMENT_SETTINGS.creatureEnergyPodLifetimeFrames;
    projectile.ambientSoundKey = 'get';
    projectile.ambientSoundIntervalMs = 900;
    projectile.nextAmbientSoundAt = undefined;
    projectile.angleDegrees = undefined;
    projectile.bounciness = 0;
    delete (projectile as Collectable).creatureProjectile;
}

function playRuntimeSound(audio: HTMLAudioElement, volume = 1) {
    if (!getSoundEnabled()) {
        return;
    }
    audio.volume = Math.max(0, Math.min(1, volume));
    try {
        audio.currentTime = 0;
        audio.play();
    } catch {}
}

function playManifestSound(key: string, volume = 1) {
    const audio = creatureManifestSounds[key];
    if (!audio) {
        return;
    }
    playRuntimeSound(audio, volume);
}

function playAstronautImpactSound() {
    playRuntimeSound(ouchSounds[Math.floor(Math.random() * ouchSounds.length)], 0.8);
}

function updateGrenadeArmedLoopSound() {
    const shouldPlay = getSoundEnabled() && collectableEntities.some(
        (collectable) => isGrenadeCollectable(collectable) && collectable.armed
    );
    if (shouldPlay) {
        grenadeArmedSound.loop = true;
        grenadeArmedSound.volume = 0.5;
        if (!grenadeArmedLoopActive) {
            try {
                grenadeArmedSound.currentTime = 0;
                grenadeArmedSound.play();
            } catch {}
            grenadeArmedLoopActive = true;
        }
        return;
    }

    if (grenadeArmedLoopActive) {
        try {
            grenadeArmedSound.pause();
            grenadeArmedSound.currentTime = 0;
        } catch {}
        grenadeArmedLoopActive = false;
    }
}

function updateMushroomAmbientLoopSound() {
    if (!getSoundEnabled()) {
        nextMushroomAmbientAt = 0;
        return;
    }

    const mushrooms = getMushroomBlocks();
    if (mushrooms.length === 0) {
        nextMushroomAmbientAt = 0;
        return;
    }

    const tileSize = 32 * SPRITE_SCALE;
    const mushroomCenterOffset = tileSize / 2;
    let nearestDistance = Number.POSITIVE_INFINITY;
    for (const mushroom of mushrooms) {
        const dx = mushroom.x + mushroomCenterOffset - astronaut.position.x;
        const dy = mushroom.y + mushroomCenterOffset - astronaut.position.y;
        const distance = Math.hypot(dx, dy);
        if (distance < nearestDistance) {
            nearestDistance = distance;
        }
    }

    if (nearestDistance > MUSHROOM_AMBIENT_RANGE) {
        nextMushroomAmbientAt = 0;
        return;
    }

    const now = performance.now();
    if (now < nextMushroomAmbientAt) {
        return;
    }

    const volume = Math.max(
        0,
        Math.min(1, MUSHROOM_AMBIENT_BASE_VOLUME * (1 - nearestDistance / MUSHROOM_AMBIENT_RANGE))
    );
    if (volume > 0) {
        const ambientInstance = mushroomsSound.cloneNode(true);
        if (ambientInstance instanceof HTMLAudioElement) {
            ambientInstance.volume = volume;
            void ambientInstance.play().catch(() => { });
        }
    }
    const delay = MUSHROOM_AMBIENT_MIN_DELAY_MS
        + Math.random() * (MUSHROOM_AMBIENT_MAX_DELAY_MS - MUSHROOM_AMBIENT_MIN_DELAY_MS);
    nextMushroomAmbientAt = now + delay;
}

function playBulletImpactSound() {
    playRuntimeSound(bulletExplosionSound, bulletImpactAudioSettings.volume);
}

function playExplosionDamageSound(destroyedDoor: boolean, volume: number) {
    playRuntimeSound(
        destroyedDoor ? bulletExplosion2Sound : bulletExplosionSound,
        volume
    );
}

function cleanupCollectableReferences(collectable: Collectable) {
    if (heldCollectable === collectable) {
        heldCollectable = null;
    }
    const storedIndex = storedCollectables.indexOf(collectable);
    if (storedIndex >= 0) {
        storedCollectables.splice(storedIndex, 1);
        if (storedCollectables.length === 0) {
            inventoryCycleIndex = -1;
        } else if (inventoryCycleIndex >= storedCollectables.length) {
            inventoryCycleIndex = storedCollectables.length - 1;
        }
    }
}

function removeCollectableEntity(collectable: Collectable) {
    cleanupCollectableReferences(collectable);
    const index = collectableEntities.indexOf(collectable);
    if (index >= 0) {
        collectableEntities.splice(index, 1);
    }
}

function applyAstronautImpact(sourceX: number, sourceY: number, force: number, canSpinFromExplosion = false) {
    const astronautRect = getAstronautRect();
    const astronautCenterX = (astronautRect.left + astronautRect.right) / 2;
    const astronautCenterY = (astronautRect.top + astronautRect.bottom) / 2;
    const dx = astronautCenterX - sourceX;
    const dy = astronautCenterY - sourceY;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const wasLanded = astronaut.isLanded;
    const horizontalImpulse = (dx / distance) * Math.max(1, force * 1.1);
    let verticalDirection = dy / distance;
    if (wasLanded && verticalDirection > -0.35) {
        verticalDirection = -0.35;
    }

    astronaut.isLanded = false;
    astronaut.isFlying = true;
    astronaut.velocity.x += horizontalImpulse;
    astronaut.velocity.y += verticalDirection * Math.max(1.1, force * 0.95);
    if (
        canSpinFromExplosion &&
        force >= MOVEMENT_SETTINGS.astronautExplosionSpinMinForce &&
        Math.random() < MOVEMENT_SETTINGS.astronautExplosionSpinChance
    ) {
        const blastDirection = Math.sign(dx);
        if (blastDirection !== 0) {
            const shouldFaceLeft = blastDirection < 0;
            if (facingLeft !== shouldFaceLeft) {
                flipAstronaut();
            }
        }
    }
    playAstronautImpactSound();
}

function applyAstronautBulletImpactBlast(centerX: number, centerY: number, damage: number) {
    const blastRadius = 34;
    const astronautRect = getAstronautRect();
    const astronautCenter = {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };
    const astronautDistance = Math.hypot(astronautCenter.x - centerX, astronautCenter.y - centerY);
    if (astronautDistance > blastRadius) {
        return;
    }

    const proximity = 1 - astronautDistance / blastRadius;
    applyAstronautDamage(
        Math.max(6, damage * (5 + proximity * 7)),
        performance.now()
    );
    applyAstronautBulletDaze(
        performance.now(),
        BULLET_DAZE_DURATION_MS + damage * 90 + proximity * 140
    );
    applyAstronautImpact(
        centerX,
        centerY,
        Math.max(1.6, damage * 0.75 + proximity * 2.6),
        true
    );
}

function applyAstronautProjectileImpact(projectile: CreatureProjectileCollectable) {
    if (projectile.creatureProjectile.kind === 'bullet') {
        return;
    }

    const astronautDamage = Math.max(
        5,
        projectile.creatureProjectile.damage * 8
    );
    applyAstronautDamage(astronautDamage);

    const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
    if (speed < 0.001) {
        applyAstronautImpact(projectile.x, projectile.y, Math.max(0.9, projectile.creatureProjectile.damage));
        return;
    }

    const physicsSettings = getCreatureProjectilePhysicsSettings(projectile);
    const pushScale = getDynamicObjectPushScale(projectile, physicsSettings);
    const force = Math.max(
        projectile.creatureProjectile.damage * 0.7,
        speed * Math.max(0.45, projectile.weight * 2.4) * pushScale
    );
    astronaut.velocity.x += (projectile.velocity.x / speed) * force;
    astronaut.velocity.y += (projectile.velocity.y / speed) * Math.max(0.55, force * 0.8);
    playAstronautImpactSound();
}

function markCreatureDamaged(creature: Creature, damage: number) {
    creature.currentDamage = Math.max(0, (creature.currentDamage ?? 0) + damage);
    const runtimeState = creature.state ?? {};
    runtimeState.damageFlashUntil = performance.now() + 180;
    creature.state = runtimeState;
}

function spawnCreatureCarryProxy(creature: Creature) {
    const proxy = assignEntityId(new Collectable({
        x: creature.x,
        y: creature.y,
        type: creature.type,
        palette: creature.palette ?? 0,
        rotation: creature.rotation,
        collected: false,
        name: creature.type,
        weight: 0.3,
        pickupEnabled: true,
        storable: false,
        affectsAstronaut: false,
        collision: false,
        velocity: { x: 0, y: 0 },
        isGrounded: false,
        creaturePayload: toCreatureSaveData(creature)
    }));
    collectableEntities.push(proxy);
    return proxy;
}

function removeCreatureEntity(creature: Creature) {
    const index = creatureEntities.indexOf(creature);
    if (index >= 0) {
        creatureEntities.splice(index, 1);
    }
}

function handleCreatureDeath(creature: Creature) {
    removeCreatureEntity(creature);
    if (creature.pickupEnabled) {
        const proxy = spawnCreatureCarryProxy(creature);
        proxy.ttlFrames = undefined;
        proxy.ambientSoundKey = undefined;
    }
}

function applyDamageToCreature(creature: Creature, damage: number) {
    if (damage <= 0) {
        return false;
    }
    markCreatureDamaged(creature, damage);
    if (creature.currentDamage >= Math.max(1, creature.killForce)) {
        handleCreatureDeath(creature);
        return true;
    }
    return false;
}

function projectileOverlapsCreature(projectile: CreatureProjectileCollectable, creature: Creature) {
    const projectileBounds = getEntityCollisionBounds(projectile);
    const projectileRect = getEntityRect(projectile.x, projectile.y, projectileBounds);
    const creatureBounds = getEntityCollisionBounds(creature);
    const creatureRect = getEntityRect(creature.x, creature.y, creatureBounds);
    return (
        projectileRect.right >= creatureRect.left &&
        projectileRect.left <= creatureRect.right &&
        projectileRect.bottom >= creatureRect.top &&
        projectileRect.top <= creatureRect.bottom
    );
}

function explodeProjectile(projectile: CreatureProjectileCollectable, entityX = projectile.x, entityY = projectile.y) {
    const settings = getProjectileSettings(projectile.creatureProjectile.kind);
    const radius = settings.splashRadius;
    if (!radius) {
        spawnProjectileImpactEffect(projectile, entityX, entityY);
        return;
    }
    const bounds = getEntityCollisionBounds(projectile);
    const center = getEntityCenter(entityX, entityY, bounds);
    spawnProjectileImpactEffect(projectile, entityX, entityY);
    const destructionSource = isCoroniumExplosionAtCenter(center)
        ? getExplosionDamageSource('coronium')
        : projectile.creatureProjectile.kind === 'plasma_grenade'
            ? getExplosionDamageSource('plasma_grenade')
            : getExplosionDamageSource('grenade');
    const doorCountBeforeExplosion = doorEntities.length;
    const destructibleDamageResult = applyExplosionDamageToDestructibles(
        center,
        radius,
        Math.max(
            6,
            projectile.creatureProjectile.damage * 12 * (settings.splashDamageMultiplier ?? 1)
        ),
        destructionSource
    );
    playExplosionDamageSound(
        destructibleDamageResult.destroyedDoor || doorEntities.length < doorCountBeforeExplosion,
        bulletImpactAudioSettings.volume
    );
    for (const creature of [...creatureEntities]) {
        if (creature.entityId === projectile.creatureProjectile.sourceEntityId) {
            continue;
        }
        const creatureBounds = getEntityCollisionBounds(creature);
        const creatureCenter = getEntityCenter(creature.x, creature.y, creatureBounds);
        const distance = Math.hypot(creatureCenter.x - center.x, creatureCenter.y - center.y);
        if (distance > radius) {
            continue;
        }
        const damage = Math.max(
            settings.minimumSplashDamage ?? 0.5,
            projectile.creatureProjectile.damage * (settings.splashDamageMultiplier ?? 1) * (1 - distance / radius)
        );
        applyDamageToCreature(creature, damage);
    }

    const astronautRect = getAstronautRect();
    const astronautCenter = {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };
    const astronautDistance = Math.hypot(astronautCenter.x - center.x, astronautCenter.y - center.y);
    if (astronautDistance <= radius) {
        applyAstronautDamage(
            Math.max(
                8,
                projectile.creatureProjectile.damage * 10 * (1 - astronautDistance / radius)
            )
        );
        applyAstronautImpact(
            center.x,
            center.y,
            Math.max(0.8, projectile.creatureProjectile.damage * (settings.splashDamageMultiplier ?? 1) * (1 - astronautDistance / radius)),
            true
        );
    }
}

function explodeCollectableGrenade(collectable: Collectable) {
    if (!isGrenadeCollectable(collectable)) {
        return;
    }

    const center = collectable.stored
        ? { x: astronaut.position.x, y: astronaut.position.y }
        : getEntityCenter(collectable.x, collectable.y, getEntityCollisionBounds(collectable));
    const grenadeType = collectable.type === 'plasma_grenade' ? 'plasma_grenade' : 'grenade';
    const radius = getGrenadeExplosionRadius(grenadeType, collectable.explosionRadius);
    const power = getGrenadeExplosionPower(grenadeType, collectable.explosionPower);
    const destructionSource = isCoroniumExplosionAtCenter(center)
        ? getExplosionDamageSource('coronium')
        : getExplosionDamageSource(grenadeType);
    spawnGrenadeExplosionEffect(grenadeType, collectable.palette ?? 0, center.x, center.y);
    const doorCountBeforeExplosion = doorEntities.length;
    const destructibleDamageResult = applyExplosionDamageToDestructibles(
        center,
        radius,
        power * 6,
        destructionSource
    );
    playExplosionDamageSound(
        destructibleDamageResult.destroyedDoor || doorEntities.length < doorCountBeforeExplosion,
        0.9
    );

    for (const creature of [...creatureEntities]) {
        const creatureBounds = getEntityCollisionBounds(creature);
        const creatureCenter = getEntityCenter(creature.x, creature.y, creatureBounds);
        const distance = Math.hypot(creatureCenter.x - center.x, creatureCenter.y - center.y);
        if (distance > radius) {
            continue;
        }
        const damage = Math.max(0.75, power * 1.35 * (1 - distance / radius));
        applyDamageToCreature(creature, damage);
    }

    const astronautRect = getAstronautRect();
    const astronautCenter = {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };
    const astronautDistance = Math.hypot(astronautCenter.x - center.x, astronautCenter.y - center.y);
    if (astronautDistance <= radius) {
        applyAstronautDamage(
            Math.max(10, power * 4 * (1 - astronautDistance / radius))
        );
        applyAstronautImpact(
            center.x,
            center.y,
            Math.max(1, power * (1 - astronautDistance / radius)),
            true
        );
    }

    removeCollectableEntity(collectable);
}

function spawnCreatureGrenadeCollectable(
    creature: Creature,
    kind: 'grenade' | 'plasma_grenade',
    spawnPosition: Position,
    velocity: Position,
    rotation: number
) {
    const defaultPower = getDefaultGrenadeExplosionPower(kind) ?? MOVEMENT_SETTINGS.grenadeExplosionPower;
    const grenade = assignEntityId(new Collectable({
        x: spawnPosition.x,
        y: spawnPosition.y,
        type: kind,
        palette: creature.palette ?? 0,
        rotation,
        collected: false,
        name: kind,
        weight: Math.max(0.1, creature.projectileWeight ?? 0.2),
        bounciness: Math.max(0, creature.projectileBounciness ?? CREATURE_PROJECTILE_SETTINGS[kind].defaultBounciness),
        pickupEnabled: true,
        storable: true,
        affectsAstronaut: false,
        collision: true,
        velocity,
        isGrounded: false,
        armed: true,
        explosionPower: getGrenadeExplosionPower(
            kind,
            defaultPower * Math.max(0.5, creature.damageOnContact ?? 1)
        )
    }));
    syncGrenadeFuseState(grenade);
    collectableEntities.push(grenade);
}

function getNearestPickupCreature() {
    let bestCreature: Creature | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const creature of creatureEntities) {
        if (!creature.pickupEnabled || creature.fixed) continue;
        const bounds = getEntityCollisionBounds(creature);
        const creatureCenter = getEntityCenter(creature.x, creature.y, bounds);
        const distance = Math.hypot(creatureCenter.x - astronaut.position.x, creatureCenter.y - astronaut.position.y);
        if (distance > MOVEMENT_SETTINGS.collectablePickupRange) continue;
        if (distance < bestDistance) {
            bestDistance = distance;
            bestCreature = creature;
        }
    }

    return bestCreature;
}

function spawnCreatureProjectile(
    creature: Creature,
    targetX: number,
    targetY: number,
    aimOriginOverride?: Position
) {
    const kind = getProjectileKindForFireMode(creature.fireMode);
    if (!kind) {
        return;
    }

    const projectileSettings = getProjectileSettings(kind);
    const projectilePalette = kind === 'bullet' ? 0 : (creature.palette ?? 0);
    const bounds = getEntityCollisionBounds(creature);
    const creatureCenter = getEntityCenter(creature.x, creature.y, bounds);
    const creatureRect = getEntityRect(creature.x, creature.y, bounds);
    const aimOrigin = aimOriginOverride ?? creatureCenter;
    const speed = Math.max(1, creature.projectileSpeed) * projectileSettings.speedMultiplier;
    const turretFacingRotations = getTurretFacingRotations(
        typeof creature.state?.authoredRotation === 'number'
            ? Number(creature.state.authoredRotation)
            : creature.rotation
    );
    let launchDirectionX = targetX - aimOrigin.x;
    let launchDirectionY = targetY - aimOrigin.y;
    let launchDistance = Math.max(1, Math.hypot(launchDirectionX, launchDirectionY));
    let directionX = launchDirectionX / launchDistance;
    let directionY = launchDirectionY / launchDistance;
    let projectileRotation = directionX < 0 ? 5 : 1;
    const muzzleSourceEntity = isTurretLikeCreature(creature)
        ? {
            ...creature,
            rotation: directionX < 0 ? turretFacingRotations.left : turretFacingRotations.right
        }
        : creature;
    let muzzleAnchor = getEntityFrontAnchorPoint(
        muzzleSourceEntity,
        { x: directionX, y: directionY }
    ) ?? getEntitySideAnchorPoint(
        muzzleSourceEntity,
        directionX < 0 ? 'left' : 'right'
    );
    if (muzzleAnchor) {
        launchDirectionX = targetX - muzzleAnchor.x;
        launchDirectionY = targetY - muzzleAnchor.y;
        launchDistance = Math.max(1, Math.hypot(launchDirectionX, launchDirectionY));
        directionX = launchDirectionX / launchDistance;
        directionY = launchDirectionY / launchDistance;
        const refinedProjectileRotation = directionX < 0 ? 5 : 1;
        if (refinedProjectileRotation !== projectileRotation && isTurretLikeCreature(creature)) {
            projectileRotation = refinedProjectileRotation;
            muzzleAnchor = getEntityFrontAnchorPoint(
                {
                    ...creature,
                    rotation: directionX < 0 ? turretFacingRotations.left : turretFacingRotations.right
                },
                { x: directionX, y: directionY }
            ) ?? getEntitySideAnchorPoint(
                {
                    ...creature,
                    rotation: directionX < 0 ? turretFacingRotations.left : turretFacingRotations.right
                },
                directionX < 0 ? 'left' : 'right'
            );
            if (muzzleAnchor) {
                launchDirectionX = targetX - muzzleAnchor.x;
                launchDirectionY = targetY - muzzleAnchor.y;
                launchDistance = Math.max(1, Math.hypot(launchDirectionX, launchDirectionY));
                directionX = launchDirectionX / launchDistance;
                directionY = launchDirectionY / launchDistance;
            }
        } else {
            projectileRotation = refinedProjectileRotation;
        }
    }
    const baseVelocity = {
        x: directionX * speed,
        y: directionY * speed + projectileSettings.launchVerticalBias
    };
    const projectileTemplate = {
        type: projectileSettings.spriteType,
        rotation: projectileRotation,
        palette: projectilePalette,
        angleDegrees: projectileSettings.angleMatchesVelocity ? getProjectileAngleDegrees(baseVelocity) : undefined,
        creatureProjectile: { kind }
    };
    const projectileBounds = getEntityCollisionBounds(projectileTemplate);
    const projectileRearOffset = getEntityFrontAnchorPoint(
        {
            ...projectileTemplate,
            x: 0,
            y: 0
        },
        {
            x: -baseVelocity.x,
            y: -baseVelocity.y
        }
    );
    const muzzlePadding = 2 * SPRITE_SCALE;
    const projectileSpawnPosition = muzzleAnchor && projectileRearOffset
        ? {
            x: muzzleAnchor.x + directionX * muzzlePadding - projectileRearOffset.x,
            y: muzzleAnchor.y + directionY * muzzlePadding - projectileRearOffset.y
        }
        : getEntityPositionFromCenter(
            creatureCenter.x + directionX * (
                Math.min(
                    Number.POSITIVE_INFINITY,
                    directionX === 0 ? Number.POSITIVE_INFINITY : (creatureRect.right - creatureRect.left + 1) / 2 / Math.max(0.001, Math.abs(directionX)),
                    directionY === 0 ? Number.POSITIVE_INFINITY : (creatureRect.bottom - creatureRect.top + 1) / 2 / Math.max(0.001, Math.abs(directionY))
                ) + Math.max(
                    (projectileBounds.right - projectileBounds.left + 1) / 2,
                    (projectileBounds.bottom - projectileBounds.top + 1) / 2
                ) + 2
            ),
            creatureCenter.y + directionY * (
                Math.min(
                    Number.POSITIVE_INFINITY,
                    directionX === 0 ? Number.POSITIVE_INFINITY : (creatureRect.right - creatureRect.left + 1) / 2 / Math.max(0.001, Math.abs(directionX)),
                    directionY === 0 ? Number.POSITIVE_INFINITY : (creatureRect.bottom - creatureRect.top + 1) / 2 / Math.max(0.001, Math.abs(directionY))
                ) + Math.max(
                    (projectileBounds.right - projectileBounds.left + 1) / 2,
                    (projectileBounds.bottom - projectileBounds.top + 1) / 2
                ) + 2
            ),
            projectileBounds
        );

    if (kind === 'grenade' || kind === 'plasma_grenade') {
        spawnCreatureGrenadeCollectable(
            creature,
            kind,
            projectileSpawnPosition,
            baseVelocity,
            projectileRotation
        );
        return;
    }

    const projectile = assignEntityId(new Collectable({
        x: projectileSpawnPosition.x,
        y: projectileSpawnPosition.y,
        type: projectileSettings.spriteType,
        palette: projectilePalette,
        rotation: projectileRotation,
        collected: false,
        name: kind,
        weight: Math.max(0, creature.projectileWeight ?? projectileSettings.defaultWeight),
        pickupEnabled: false,
        storable: false,
        affectsAstronaut: false,
        collision: true,
        velocity: baseVelocity,
        angleDegrees: projectileSettings.angleMatchesVelocity ? getProjectileAngleDegrees(baseVelocity) : undefined,
        bounciness: Math.max(0, creature.projectileBounciness ?? projectileSettings.defaultBounciness),
        isGrounded: false,
        creatureProjectile: {
            kind,
            homing: creature.homingBullets && projectileSettings.supportsHoming === true,
            remainingFrames: projectileSettings.lifetimeFrames,
            damage: Math.max(1, creature.damageOnContact || 1) * projectileSettings.damageMultiplier,
            sourceEntityId: creature.entityId
        }
    }));
    collectableEntities.push(projectile);
}

function getProjectileImpactPointAgainstWorld(
    projectile: CreatureProjectileCollectable,
    previousPosition: Position,
    previousVelocity: Position,
    previousAngleDegrees: number | undefined
) {
    const direction = Math.hypot(previousVelocity.x, previousVelocity.y) > 0.001
        ? previousVelocity
        : { x: projectile.x - previousPosition.x, y: projectile.y - previousPosition.y };
    const previousFront = getEntityFrontAnchorPoint(
        {
            ...projectile,
            x: previousPosition.x,
            y: previousPosition.y,
            angleDegrees: previousAngleDegrees
        },
        direction
    );
    const currentFront = getEntityFrontAnchorPoint(
        {
            ...projectile,
            angleDegrees: projectile.angleDegrees
        },
        direction
    );
    if (!previousFront || !currentFront) {
        return null;
    }

    const magnitude = Math.hypot(direction.x, direction.y);
    const normalizedDirection = magnitude > 0.001
        ? { x: direction.x / magnitude, y: direction.y / magnitude }
        : { x: 1, y: 0 };
    const endPoint = {
        x: currentFront.x + normalizedDirection.x * SPRITE_SCALE,
        y: currentFront.y + normalizedDirection.y * SPRITE_SCALE
    };
    const steps = Math.max(2, Math.ceil(Math.hypot(endPoint.x - previousFront.x, endPoint.y - previousFront.y)));
    for (let index = 0; index <= steps; index++) {
        const progress = index / steps;
        const sampleX = previousFront.x + (endPoint.x - previousFront.x) * progress;
        const sampleY = previousFront.y + (endPoint.y - previousFront.y) * progress;
        if (getSolidBlockAtWorld(
            sampleX,
            sampleY,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        )) {
            return { x: sampleX, y: sampleY };
        }
    }

    return currentFront;
}

function getProjectileImpactPointAgainstRect(
    projectile: CreatureProjectileCollectable,
    previousPosition: Position,
    previousVelocity: Position,
    previousAngleDegrees: number | undefined,
    rect: { left: number; right: number; top: number; bottom: number },
    clampOnMiss: boolean = true
) {
    const direction = Math.hypot(previousVelocity.x, previousVelocity.y) > 0.001
        ? previousVelocity
        : { x: projectile.x - previousPosition.x, y: projectile.y - previousPosition.y };
    const previousFront = getEntityFrontAnchorPoint(
        {
            ...projectile,
            x: previousPosition.x,
            y: previousPosition.y,
            angleDegrees: previousAngleDegrees
        },
        direction
    );
    const currentFront = getEntityFrontAnchorPoint(
        {
            ...projectile,
            angleDegrees: projectile.angleDegrees
        },
        direction
    );
    if (!previousFront || !currentFront) {
        return null;
    }

    const steps = Math.max(2, Math.ceil(Math.hypot(currentFront.x - previousFront.x, currentFront.y - previousFront.y)));
    for (let index = 0; index <= steps; index++) {
        const progress = index / steps;
        const sampleX = previousFront.x + (currentFront.x - previousFront.x) * progress;
        const sampleY = previousFront.y + (currentFront.y - previousFront.y) * progress;
        if (
            sampleX >= rect.left &&
            sampleX <= rect.right &&
            sampleY >= rect.top &&
            sampleY <= rect.bottom
        ) {
            return { x: sampleX, y: sampleY };
        }
    }

    if (!clampOnMiss) {
        return null;
    }

    return {
        x: Math.max(rect.left, Math.min(rect.right, currentFront.x)),
        y: Math.max(rect.top, Math.min(rect.bottom, currentFront.y))
    };
}

function getProjectileImpactPointAgainstOpaquePixels(
    projectile: CreatureProjectileCollectable,
    previousPosition: Position,
    previousVelocity: Position,
    previousAngleDegrees: number | undefined,
    hitTest: (worldX: number, worldY: number) => boolean
) {
    const direction = Math.hypot(previousVelocity.x, previousVelocity.y) > 0.001
        ? previousVelocity
        : { x: projectile.x - previousPosition.x, y: projectile.y - previousPosition.y };
    const previousFront = getEntityFrontAnchorPoint(
        {
            ...projectile,
            x: previousPosition.x,
            y: previousPosition.y,
            angleDegrees: previousAngleDegrees
        },
        direction
    );
    const currentFront = getEntityFrontAnchorPoint(
        {
            ...projectile,
            angleDegrees: projectile.angleDegrees
        },
        direction
    );
    if (!previousFront || !currentFront) {
        return null;
    }

    const steps = Math.max(2, Math.ceil(Math.hypot(currentFront.x - previousFront.x, currentFront.y - previousFront.y)));
    for (let index = 0; index <= steps; index++) {
        const progress = index / steps;
        const sampleX = previousFront.x + (currentFront.x - previousFront.x) * progress;
        const sampleY = previousFront.y + (currentFront.y - previousFront.y) * progress;
        if (hitTest(sampleX, sampleY)) {
            return { x: sampleX, y: sampleY };
        }
    }

    return null;
}

function updateSingleCreatureProjectilePhysics(projectile: CreatureProjectileCollectable) {
    const surfaceResult = updateSingleCollectablePhysics(
        projectile,
        getCreatureProjectilePhysicsSettings(projectile),
        {
            bounceHorizontally: true,
            groundFrictionStopThreshold: 0.01
        }
    );
    if (getProjectileSettings(projectile.creatureProjectile.kind).angleMatchesVelocity) {
        projectile.angleDegrees = getProjectileAngleDegrees(projectile.velocity);
    }
    return surfaceResult;
}

function projectileOverlapsAstronaut(projectile: CreatureProjectileCollectable) {
    const bounds = getEntityCollisionBounds(projectile);
    const projectileRect = getEntityRect(projectile.x, projectile.y, bounds);
    const astronautRect = getAstronautRect();
    return (
        projectileRect.right >= astronautRect.left &&
        projectileRect.left <= astronautRect.right &&
        projectileRect.bottom >= astronautRect.top &&
        projectileRect.top <= astronautRect.bottom
    );
}

function updateProjectileHomingVelocity(projectile: CreatureProjectileCollectable) {
    const bounds = getEntityCollisionBounds(projectile);
    const projectileCenter = getEntityCenter(projectile.x, projectile.y, bounds);
    const astronautRect = getAstronautRect();
    const astronautCenter = {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };
    const dx = astronautCenter.x - projectileCenter.x;
    const dy = astronautCenter.y - projectileCenter.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const speed = Math.max(1, Math.hypot(projectile.velocity.x, projectile.velocity.y));
    const targetVx = (dx / distance) * speed;
    const targetVy = (dy / distance) * speed;
    projectile.velocity.x += (targetVx - projectile.velocity.x) * 0.08;
    projectile.velocity.y += (targetVy - projectile.velocity.y) * 0.08;
}

function updateCreatureProjectileCollectable(projectile: CreatureProjectileCollectable) {
    let expired = false;
    const projectileRuntime = projectile.creatureProjectile;
    const previousPosition = {
        x: projectile.x,
        y: projectile.y
    };
    const previousVelocity = {
        x: projectile.velocity.x,
        y: projectile.velocity.y
    };
    const previousAngleDegrees = projectile.angleDegrees;

    if (projectileRuntime.homing) {
        updateProjectileHomingVelocity(projectile);
    }

    const projectileSettings = getProjectileSettings(projectileRuntime.kind);
    updateProjectileFlightFrame(projectile, projectileSettings);
    const usePreciseHitTest = projectileRuntime.kind === 'bullet' || projectileSettings.angleMatchesVelocity === true;

    const surfaceResult = updateSingleCreatureProjectilePhysics(projectile);
    if (surfaceResult.hitWorld && projectile.bounciness <= 0) {
        const impactPoint = getProjectileImpactPointAgainstWorld(
            projectile,
            previousPosition,
            previousVelocity,
            previousAngleDegrees
        );
        if (projectileSettings.splashRadius) {
            explodeProjectile(projectile);
        } else if (projectileSettings.spawnsCollectableOnImpact) {
            convertProjectileToEnergyPodCollectable(projectile);
        } else {
            spawnProjectileImpactEffect(projectile, projectile.x, projectile.y, impactPoint ?? undefined);
            removeCollectableEntity(projectile);
        }
        expired = true;
    }
    if (expired) {
        if (isCreatureProjectileCollectable(projectile)) {
            removeCollectableEntity(projectile);
        }
        return;
    }

    for (const creature of [...creatureEntities]) {
        if (creature.entityId === projectileRuntime.sourceEntityId) {
            continue;
        }
        const creatureRendered = getRenderedEntityWorldSprite(creature);
        const creatureImpactPoint = usePreciseHitTest
            ? getProjectileImpactPointAgainstOpaquePixels(
                projectile,
                previousPosition,
                previousVelocity,
                previousAngleDegrees,
                (worldX, worldY) => isRenderedSpriteOpaqueAtWorld(creatureRendered, worldX, worldY)
            )
            : null;
        if (usePreciseHitTest ? !creatureImpactPoint : !projectileOverlapsCreature(projectile, creature)) {
            continue;
        }
        const wasRemoved = applyDamageToCreature(
            creature,
            projectileRuntime.damage * projectileSettings.directHitDamageMultiplier
        );
        if (projectileSettings.spawnsCollectableOnImpact) {
            convertProjectileToEnergyPodCollectable(projectile);
        }
        if (projectileSettings.splashRadius) {
            explodeProjectile(projectile);
        } else if (!projectileSettings.spawnsCollectableOnImpact) {
            spawnProjectileImpactEffect(projectile, projectile.x, projectile.y, creatureImpactPoint ?? undefined);
            removeCollectableEntity(projectile);
        }
        expired = true;
        if (wasRemoved) {
            playManifestSound('get', 0.55);
        }
        break;
    }
    if (expired) {
        if (isCreatureProjectileCollectable(projectile)) {
            removeCollectableEntity(projectile);
        }
        return;
    }

    const astronautRendered = getAstronautRenderedWorldSprite();
    const astronautImpactPoint = usePreciseHitTest
        ? getProjectileImpactPointAgainstOpaquePixels(
            projectile,
            previousPosition,
            previousVelocity,
            previousAngleDegrees,
            (worldX, worldY) => isRenderedSpriteOpaqueAtWorld(astronautRendered, worldX, worldY)
        )
        : null;
    if (usePreciseHitTest ? !!astronautImpactPoint : projectileOverlapsAstronaut(projectile)) {
        applyAstronautProjectileImpact(projectile);
        if (projectileSettings.splashRadius) {
            explodeProjectile(projectile);
        } else {
            spawnProjectileImpactEffect(projectile, projectile.x, projectile.y, astronautImpactPoint ?? undefined);
            removeCollectableEntity(projectile);
        }
        expired = true;
    }

    projectileRuntime.remainingFrames--;
    if (projectileRuntime.remainingFrames <= 0) {
        if (projectileSettings.splashRadius) {
            explodeProjectile(projectile);
        } else if (projectileSettings.spawnsCollectableOnExpire) {
            convertProjectileToEnergyPodCollectable(projectile);
        } else {
            removeCollectableEntity(projectile);
        }
        expired = true;
    }
    if (expired && isCreatureProjectileCollectable(projectile)) {
        removeCollectableEntity(projectile);
    }
}

function updateCreatures(frameNow: number, simulationFrame: number) {
    const astronautRect = getAstronautRect();
    const astronautCenter = {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };
    const astronautAimPoint = getAstronautAimPoint();

    for (const creature of creatureEntities) {
        creature.previousX = creature.x;
        creature.previousY = creature.y;
        const creatureChunkActivity = getChunkActivityForEntityPosition(creature, frameNow);
        if (!shouldRunChunkBandUpdate(creatureChunkActivity, CREATURE_CHUNK_CADENCE, simulationFrame)) {
            continue;
        }

        const runtimeState = creature.state ?? {};
        const authoredType = getCreatureAuthoredType(creature.type, runtimeState);
        runtimeState.authoredType = authoredType;
        const bird = isBirdCreature(creature, authoredType);
        const authoredRotation = typeof runtimeState.authoredRotation === 'number'
            ? Math.round(Number(runtimeState.authoredRotation))
            : (runtimeState.authoredRotation = creature.rotation);
        const turretAimCenter = getStableCreatureAimCenter(creature, authoredRotation);
        const bounds = getEntityCollisionBounds(creature);
        const creatureCenter = getEntityCenter(creature.x, creature.y, bounds);
        const dx = astronautCenter.x - creatureCenter.x;
        const dy = astronautCenter.y - creatureCenter.y;
        const distanceToAstronaut = Math.hypot(dx, dy);
        const trackRange = Math.max(creature.trackRange ?? 0, creature.followRange ?? 0);
        const wasTrackingAstronaut = runtimeState.followingAstronaut === true;
        const shouldTrackAstronaut = distanceToAstronaut <= trackRange || (
            bird &&
            wasTrackingAstronaut &&
            distanceToAstronaut <= Math.max(
                trackRange * BIRD_TRACK_RELEASE_RANGE_MULTIPLIER,
                trackRange + BIRD_TRACK_RELEASE_RANGE_PADDING
            )
        );
        const isTurret = isTurretLikeCreature(creature);
        const hasSightToAstronaut = !creature.requiresLineOfSight || hasCreatureLineOfSight(turretAimCenter, astronautCenter);
        const homeDistance = Math.hypot(creature.x - creature.homeX, creature.y - creature.homeY);
        let aimTarget = astronautAimPoint;
        let hasFiringTarget = shouldTrackAstronaut && hasSightToAstronaut;
        let hasAimTarget = shouldTrackAstronaut;

        if (isTurret) {
            const nextTargetRefreshAt = typeof runtimeState.nextTargetRefreshAt === 'number'
                ? Number(runtimeState.nextTargetRefreshAt)
                : 0;
            const hasCachedTarget = typeof runtimeState.targetX === 'number' && typeof runtimeState.targetY === 'number';
            if (!hasCachedTarget || frameNow >= nextTargetRefreshAt) {
                if (shouldTrackAstronaut && hasSightToAstronaut) {
                    const refreshedTarget = getCreatureTargetPoint(creature, turretAimCenter, astronautAimPoint);
                    runtimeState.targetX = refreshedTarget.x;
                    runtimeState.targetY = refreshedTarget.y;
                    runtimeState.hasTarget = true;
                    runtimeState.nextTargetRefreshAt = frameNow + Math.max(0, creature.targetRefreshMs ?? 0);
                } else {
                    delete runtimeState.targetX;
                    delete runtimeState.targetY;
                    runtimeState.hasTarget = false;
                    runtimeState.nextTargetRefreshAt = frameNow + Math.min(
                        80,
                        Math.max(0, creature.targetRefreshMs ?? 0) || 80
                    );
                }
            }

            if (runtimeState.hasTarget === true && typeof runtimeState.targetX === 'number' && typeof runtimeState.targetY === 'number') {
                aimTarget = {
                    x: Number(runtimeState.targetX),
                    y: Number(runtimeState.targetY)
                };
                hasAimTarget = true;
                hasFiringTarget = shouldTrackAstronaut && hasSightToAstronaut;
            } else {
                hasAimTarget = false;
                hasFiringTarget = false;
            }
        }

        const turretAimDx = aimTarget.x - turretAimCenter.x;
        const shouldAutoAim = hasAimTarget && (creature.followsAstronaut || creature.fireMode !== 'none');

        if (creature.teleportHome && homeDistance > creature.teleportHomeDistance) {
            creature.x = Math.round(creature.homeX);
            creature.y = Math.round(creature.homeY);
            runtimeState.patrolDirection = 1;
            creature.state = runtimeState;
            continue;
        }

        const speed = creature.fixed ? 0 : creature.speed;
        let nextX = creature.x;
        let nextY = creature.y;
        let horizontalDirection = typeof runtimeState.patrolDirection === 'number'
            ? Math.sign(Number(runtimeState.patrolDirection)) || 1
            : 1;

        if (creature.movementMode === 'ground') {
            const jumpVelocity = typeof runtimeState.jumpVelocity === 'number'
                ? Number(runtimeState.jumpVelocity)
                : 0;
            if (creature.followsAstronaut && shouldTrackAstronaut) {
                horizontalDirection = Math.sign(dx) || horizontalDirection;
            } else {
                if (creature.x <= creature.patrolMinX) {
                    horizontalDirection = 1;
                } else if (creature.x >= creature.patrolMaxX) {
                    horizontalDirection = -1;
                }
            }
            nextX = clampToRange(
                creature.x + horizontalDirection * speed,
                creature.patrolMinX,
                creature.patrolMaxX
            );
            if (jumpVelocity !== 0) {
                nextY = creature.y + jumpVelocity;
                const updatedJumpVelocity = jumpVelocity + MOVEMENT_SETTINGS.creatureProjectileGravity * 7;
                if (nextY >= creature.homeY) {
                    nextY = creature.homeY;
                    runtimeState.jumpVelocity = 0;
                } else {
                    runtimeState.jumpVelocity = updatedJumpVelocity;
                }
            } else {
                nextY = creature.homeY;
                const nextJumpAt = typeof runtimeState.nextJumpAt === 'number'
                    ? Number(runtimeState.nextJumpAt)
                    : 0;
                if (
                    creature.canJump &&
                    shouldTrackAstronaut &&
                    frameNow >= nextJumpAt &&
                    (Math.abs(dy) > 18 || Math.abs(dx) < 72)
                ) {
                    runtimeState.jumpVelocity = -Math.max(2, creature.jumpStrength);
                    runtimeState.nextJumpAt = frameNow + 1200;
                }
            }
        } else if (creature.movementMode === 'fly' || creature.movementMode === 'hover') {
            if (creature.followsAstronaut && shouldTrackAstronaut) {
                if (bird) {
                    const normalizedDistance = distanceToAstronaut > 0.001 ? distanceToAstronaut : 1;
                    nextX = creature.x + (dx / normalizedDistance) * Math.max(1, speed);
                    if (creature.movementMode === 'fly') {
                        nextY = creature.y + (dy / normalizedDistance) * Math.max(0.9, speed);
                    }
                } else {
                    nextX = clampToRange(
                        creature.x + (Math.sign(dx) || 0) * speed,
                        creature.patrolMinX,
                        creature.patrolMaxX
                    );
                    if (creature.movementMode === 'fly') {
                        nextY = clampToRange(
                            creature.y + (Math.sign(dy) || 0) * Math.max(0.5, speed * 0.75),
                            creature.patrolMinY,
                            creature.patrolMaxY
                        );
                    }
                }
            } else {
                if (creature.x <= creature.patrolMinX) {
                    horizontalDirection = 1;
                } else if (creature.x >= creature.patrolMaxX) {
                    horizontalDirection = -1;
                }
                nextX = clampToRange(
                    creature.x + horizontalDirection * speed,
                    creature.patrolMinX,
                    creature.patrolMaxX
                );
            }

            const hoverPhase = typeof runtimeState.hoverPhase === 'number'
                ? Number(runtimeState.hoverPhase)
                : (frameNow / 180);
            const nextHoverPhase = hoverPhase + Math.max(0.02, speed * 0.04);
            runtimeState.hoverPhase = nextHoverPhase;

            if (creature.movementMode === 'hover') {
                nextY = clampToRange(
                    creature.homeY + Math.sin(nextHoverPhase) * creature.hoverAmplitude,
                    creature.patrolMinY,
                    creature.patrolMaxY
                );
            } else if (!creature.followsAstronaut || !shouldTrackAstronaut) {
                const midY = (creature.patrolMinY + creature.patrolMaxY) / 2;
                const amplitude = Math.max(2, (creature.patrolMaxY - creature.patrolMinY) / 2);
                nextY = clampToRange(
                    midY + Math.sin(nextHoverPhase) * amplitude,
                    creature.patrolMinY,
                    creature.patrolMaxY
                );
            }
        }

        runtimeState.patrolDirection = horizontalDirection;
        runtimeState.followingAstronaut = creature.followsAstronaut && shouldTrackAstronaut;
        if (creature.fireMode !== 'none' && hasFiringTarget) {
            const nextFireAt = typeof runtimeState.nextFireAt === 'number'
                ? Number(runtimeState.nextFireAt)
                : 0;
            if (frameNow >= nextFireAt) {
                spawnCreatureProjectile(creature, aimTarget.x, aimTarget.y, isTurret ? turretAimCenter : undefined);
                runtimeState.nextFireAt = getNextCreatureFireAt(frameNow, creature);
            }
        }

        let birdChasingAstronaut = false;
        if (bird && creature.movementMode === 'fly') {
            birdChasingAstronaut = runtimeState.followingAstronaut === true;
            if (birdChasingAstronaut && Math.abs(dy) < BIRD_AVOIDANCE_VERTICAL_THRESHOLD) {
                const avoidanceDirection = typeof runtimeState.birdAvoidanceDirection === 'number'
                    ? Math.sign(Number(runtimeState.birdAvoidanceDirection)) || 1
                    : (Math.sign(dx) || 1);
                runtimeState.birdAvoidanceDirection = avoidanceDirection;
                nextY += avoidanceDirection * Math.max(1, speed * 0.8);
            } else if (!birdChasingAstronaut) {
                delete runtimeState.birdAvoidanceDirection;
            }
        }

        let movementResult: AxisMovementResult | null = null;
        if (creature.collision && !creature.fixed && creature.movementMode !== 'turret') {
            movementResult = moveCreatureWithEnvironmentCollisions(creature, nextX, nextY);
            nextX = movementResult.x;
            nextY = movementResult.y;
        }

        if (bird && creature.movementMode === 'fly' && movementResult) {
            if (birdChasingAstronaut) {
                if (movementResult.movedY !== 0) {
                    runtimeState.birdAvoidanceDirection = Math.sign(movementResult.movedY) || runtimeState.birdAvoidanceDirection;
                }
                if (movementResult.blockedX && movementResult.blockedY) {
                    const currentAvoidance = typeof runtimeState.birdAvoidanceDirection === 'number'
                        ? Math.sign(Number(runtimeState.birdAvoidanceDirection)) || 1
                        : 1;
                    runtimeState.birdAvoidanceDirection = -currentAvoidance;
                }
            }
        }

        creature.state = runtimeState;
        if (!bird || creature.movementMode !== 'fly') {
            creature.x = Math.round(nextX);
            creature.y = Math.round(nextY);
        }
        if (bird) {
            creature.type = getAnimatedBirdSpriteType(authoredType, frameNow, creature.entityId);
        }

        const shouldUseTurretAutoAim = shouldAutoAim && (
            creature.fixed ||
            creature.movementMode === 'turret' ||
            authoredRotation === 1 ||
            authoredRotation === 5
        );
        if (shouldUseTurretAutoAim) {
            const aimDeadZone = 4;
            const facingRotations = getTurretFacingRotations(authoredRotation);
            const currentAimFacing = typeof runtimeState.aimFacing === 'number'
                ? Math.sign(Number(runtimeState.aimFacing)) || facingRotations.authoredFacing
                : facingRotations.authoredFacing;
            let nextAimFacing = currentAimFacing;
            if (turretAimDx < -aimDeadZone) {
                nextAimFacing = -1;
            } else if (turretAimDx > aimDeadZone) {
                nextAimFacing = 1;
            }
            runtimeState.aimFacing = nextAimFacing;
            creature.rotation = nextAimFacing < 0
                ? facingRotations.left
                : facingRotations.right;
        } else if (
            bird &&
            (authoredRotation === 1 || authoredRotation === 5) &&
            creature.x !== creature.previousX
        ) {
            creature.rotation = creature.x < creature.previousX ? 5 : 1;
        } else {
            creature.rotation = authoredRotation;
        }
    }

    for (const predator of [...creatureEntities]) {
        if (!predator.canEatWasps) {
            continue;
        }
        const predatorChunkActivity = getChunkActivityForEntityPosition(predator, frameNow);
        if (!shouldRunChunkBandUpdate(predatorChunkActivity, CREATURE_CHUNK_CADENCE, simulationFrame)) {
            continue;
        }
        const predatorBounds = getEntityCollisionBounds(predator);
        const predatorCenter = getEntityCenter(predator.x, predator.y, predatorBounds);
        const prey = creatureEntities.find((candidate) =>
            candidate !== predator &&
            /^wasp/i.test(candidate.type) &&
            Math.hypot(
                getEntityCenter(candidate.x, candidate.y, getEntityCollisionBounds(candidate)).x - predatorCenter.x,
                getEntityCenter(candidate.x, candidate.y, getEntityCollisionBounds(candidate)).y - predatorCenter.y
            ) <= 42
        );
        if (!prey) {
            continue;
        }
        removeCreatureEntity(prey);
        predator.currentDamage = Math.max(0, predator.currentDamage - 0.5);
        playManifestSound('get', 0.5);
    }
}

function resolveAstronautCreatureCollisions() {
    for (const creature of creatureEntities) {
        const astronautRect = getAstronautRect();
        const bounds = getEntityCollisionBounds(creature);
        const creatureRect = getEntityRect(creature.x, creature.y, bounds);
        const overlapX = Math.min(astronautRect.right, creatureRect.right) - Math.max(astronautRect.left, creatureRect.left) + 1;
        const overlapY = Math.min(astronautRect.bottom, creatureRect.bottom) - Math.max(astronautRect.top, creatureRect.top) + 1;

        if (overlapX <= 0 || overlapY <= 0) {
            continue;
        }

        const creatureDeltaX = creature.x - creature.previousX;
        const creatureDeltaY = creature.y - creature.previousY;
        const astronautCenterX = (astronautRect.left + astronautRect.right) / 2;
        const creatureCenterX = (creatureRect.left + creatureRect.right) / 2;
        const astronautCenterY = (astronautRect.top + astronautRect.bottom) / 2;
        const creatureCenterY = (creatureRect.top + creatureRect.bottom) / 2;

        if (creature.pushAstronaut && creature.collision) {
            const resolveHorizontally = Math.abs(creatureDeltaX) >= Math.abs(creatureDeltaY) || overlapX <= overlapY;
            if (resolveHorizontally) {
                const horizontalDirection = creatureDeltaX !== 0
                    ? Math.sign(creatureDeltaX)
                    : astronautCenterX < creatureCenterX ? -1 : 1;
                gameState.astronaut.position.x += horizontalDirection * Math.ceil(overlapX);
                astronaut.velocity.x = 0;
            } else {
                const verticalDirection = creatureDeltaY !== 0
                    ? Math.sign(creatureDeltaY)
                    : astronautCenterY < creatureCenterY ? -1 : 1;
                gameState.astronaut.position.y += verticalDirection * Math.ceil(overlapY);
                astronaut.velocity.y = 0;
            }
        }

        if (creature.damageOnContact > 0) {
            const runtimeState = creature.state ?? {};
            const nextSoundAt = typeof runtimeState.nextContactSoundAt === 'number'
                ? Number(runtimeState.nextContactSoundAt)
                : 0;
            const nextDamageAt = typeof runtimeState.nextContactDamageAt === 'number'
                ? Number(runtimeState.nextContactDamageAt)
                : 0;
            const now = performance.now();
            if (now >= nextDamageAt) {
                applyAstronautDamage(Math.max(4, creature.damageOnContact * 6), now);
                runtimeState.nextContactDamageAt = now + 450;
            }
            if (now >= nextSoundAt) {
                const ouchSound = ouchSounds[Math.floor(Math.random() * ouchSounds.length)];
                try {
                    ouchSound.currentTime = 0;
                    ouchSound.play();
                } catch {}
                runtimeState.nextContactSoundAt = now + 600;
                creature.state = runtimeState;
            }
        }
    }
}

function updateCreatureSounds(frameNow: number) {
    if (!getSoundEnabled()) {
        return;
    }

    const astronautRect = getAstronautRect();
    const astronautCenter = {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };

    for (const creature of creatureEntities) {
        if (!creature.sound?.enabled || !creature.sound.sound) {
            continue;
        }

        const audio = creatureManifestSounds[creature.sound.sound];
        if (!audio) {
            continue;
        }

        const bounds = getEntityCollisionBounds(creature);
        const creatureCenter = getEntityCenter(creature.x, creature.y, bounds);
        const distance = Math.hypot(
            astronautCenter.x - creatureCenter.x,
            astronautCenter.y - creatureCenter.y
        );
        const range = Math.max(1, creature.sound.range);
        if (distance > range) {
            continue;
        }

        const runtimeState = creature.state ?? {};
        const nextSoundAt = typeof runtimeState.nextAmbientSoundAt === 'number'
            ? Number(runtimeState.nextAmbientSoundAt)
            : 0;
        if (frameNow < nextSoundAt) {
            continue;
        }

        const varianceWindow = Math.max(0, creature.sound.randomVarianceMs);
        const variance = varianceWindow > 0
            ? (Math.random() * 2 - 1) * varianceWindow
            : 0;
        runtimeState.nextAmbientSoundAt = frameNow + Math.max(250, creature.sound.intervalMs + variance);
        creature.state = runtimeState;

        playRuntimeSound(audio, creature.sound.volume * (1 - distance / range));
    }
}

function drawCreatureOverlays(context: CanvasRenderingContext2D, camera: Position) {
    const now = performance.now();
    for (const creature of creatureEntities) {
        const damageFlashUntil = typeof creature.state?.damageFlashUntil === 'number'
            ? Number(creature.state.damageFlashUntil)
            : 0;
        if (creature.damageFlash && damageFlashUntil > now) {
            const rendered = getRenderedEntityWorldSprite(creature);
            const bounds = getEntityCollisionBounds(creature);
            const rect = getEntityRect(creature.x, creature.y, bounds);
            const screenX = (rendered?.drawX ?? rect.left) - camera.x;
            const screenY = (rendered?.drawY ?? rect.top) - camera.y;
            const width = (rendered?.canvas.width ?? (rect.right - rect.left + 1) / SPRITE_SCALE) * SPRITE_SCALE;
            const height = (rendered?.canvas.height ?? (rect.bottom - rect.top + 1) / SPRITE_SCALE) * SPRITE_SCALE;
            context.strokeStyle = 'rgba(255, 255, 255, 0.9)';
            context.lineWidth = 2;
            context.strokeRect(screenX - 1, screenY - 1, width + 2, height + 2);
        }
    }
}

function getHeldCollectableTargetPosition(): Position {
    if (!heldCollectable) {
        return {
            x: astronaut.position.x,
            y: astronaut.position.y
        };
    }

    const collectableBounds = getEntityCollisionBounds(heldCollectable);
    const collectableHalfHeight = (collectableBounds.bottom - collectableBounds.top + 1) / 2;
    const desiredCenterY = astronaut.position.y + MOVEMENT_SETTINGS.heldCollectableVerticalOffset;
    const renderedAstronaut = getAstronautRenderedWorldSprite();
    const visibleBounds = renderedAstronaut ? getSpriteVisibleBounds(renderedAstronaut.canvas) : null;

    let x: number;
    if (renderedAstronaut && visibleBounds) {
        const visibleLeft = renderedAstronaut.drawX + visibleBounds.minX * SPRITE_SCALE;
        const visibleRight = renderedAstronaut.drawX + (visibleBounds.maxX + 1) * SPRITE_SCALE;
        const handX = facingLeft
            ? visibleLeft + HELD_COLLECTABLE_HAND_INSET
            : visibleRight - HELD_COLLECTABLE_HAND_INSET;
        x = facingLeft
            ? handX + HELD_COLLECTABLE_HAND_OVERLAP - collectableBounds.right
            : handX - HELD_COLLECTABLE_HAND_OVERLAP - collectableBounds.left;
    } else {
        const astronautRect = getAstronautRect();
        x = facingLeft
            ? astronautRect.left + HELD_COLLECTABLE_HAND_INSET - collectableBounds.right
            : astronautRect.right - HELD_COLLECTABLE_HAND_INSET - collectableBounds.left;
    }

    return {
        x,
        y: desiredCenterY - collectableBounds.top - collectableHalfHeight
    };
}

function getAimOriginPosition() {
    if (heldCollectable) {
        const originPosition = getHeldCollectableTargetPosition();
        const heldBounds = getEntityCollisionBounds(heldCollectable);
        return getEntityCenter(originPosition.x, originPosition.y, heldBounds);
    }

    const astronautRect = getAstronautRect();
    return {
        x: facingLeft ? astronautRect.left - 2 : astronautRect.right + 2,
        y: astronaut.position.y + MOVEMENT_SETTINGS.heldCollectableVerticalOffset
    };
}

function getReleasedCollectablePosition(thrown: boolean) {
    if (!heldCollectable) {
        return {
            x: astronaut.position.x,
            y: astronaut.position.y
        };
    }

    const heldPosition = getHeldCollectableTargetPosition();
    return {
        x: thrown
            ? heldPosition.x + getFacingSign() * (MOVEMENT_SETTINGS.droppedCollectableForwardOffset - MOVEMENT_SETTINGS.heldCollectableForwardOffset)
            : heldPosition.x,
        y: heldPosition.y
    };
}

function getDroppedCollectableReleaseVelocity(): Position {
    return {
        x: astronaut.velocity.x * MOVEMENT_SETTINGS.droppedCollectableMomentumTransfer,
        y: Math.max(0, astronaut.velocity.y * MOVEMENT_SETTINGS.droppedCollectableMomentumTransfer)
    };
}

function updateHeldCollectablePosition() {
    if (!heldCollectable) return;
    heldCollectable.setHeldFacing(facingLeft);
    const heldPosition = getHeldCollectableTargetPosition();
    heldCollectable.x = heldPosition.x;
    heldCollectable.y = heldPosition.y;
    heldCollectable.velocity.x = 0;
    heldCollectable.velocity.y = 0;
    heldCollectable.isGrounded = false;
}

function isLooseCollectable(collectable: Collectable) {
    return !collectable.held && !collectable.stored;
}

function getEntityOverlapBounds(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds
) {
    return getEntityRect(entityX, entityY, collisionBounds);
}

function isCollectableNearAstronaut(collectable: Collectable) {
    const collectableBounds = getEntityCollisionBounds(collectable);
    const collectableRect = getEntityOverlapBounds(collectable.x, collectable.y, collectableBounds);
    const astronautRect = getAstronautRect();

    const overlaps =
        collectableRect.right >= astronautRect.left &&
        collectableRect.left <= astronautRect.right &&
        collectableRect.bottom >= astronautRect.top &&
        collectableRect.top <= astronautRect.bottom;
    if (overlaps) return true;

    const collectableCenter = getEntityCenter(collectable.x, collectable.y, collectableBounds);
    const dx = collectableCenter.x - astronaut.position.x;
    const dy = collectableCenter.y - astronaut.position.y;
    return Math.hypot(dx, dy) <= MOVEMENT_SETTINGS.collectablePickupRange;
}

function getNearestPickupCollectable() {
    let bestCollectable: Collectable | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const collectable of collectableEntities) {
        if (!isLooseCollectable(collectable)) continue;
        if (collectable.pickupEnabled === false) continue;
        if (!isCollectableNearAstronaut(collectable)) continue;
        const bounds = getEntityCollisionBounds(collectable);
        const collectableCenter = getEntityCenter(collectable.x, collectable.y, bounds);
        const distance = Math.hypot(collectableCenter.x - astronaut.position.x, collectableCenter.y - astronaut.position.y);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestCollectable = collectable;
        }
    }

    return bestCollectable;
}

function storeHeldCollectable() {
    if (!heldCollectable || !heldCollectable.storable) return;
    if (isGrenadeCollectable(heldCollectable) && heldCollectable.armed) return;
    if (storedCollectables.length >= MOVEMENT_SETTINGS.collectableInventoryLimit) return;

    heldCollectable.store();
    storedCollectables.push(heldCollectable);
    inventoryCycleIndex = storedCollectables.length - 1;
    heldCollectable = null;
    try { saveSound.currentTime = 0; saveSound.play(); } catch {}
}

function cycleStoredCollectable() {
    if (heldCollectable && !heldCollectable.storable) {
        return;
    }

    if (heldCollectable) {
        const previousHeldCollectable = heldCollectable;
        storeHeldCollectable();
        if (heldCollectable === previousHeldCollectable) {
            return;
        }
    }

    if (storedCollectables.length === 0) return;
    if (inventoryCycleIndex < 0 || inventoryCycleIndex >= storedCollectables.length) {
        inventoryCycleIndex = storedCollectables.length - 1;
    }

    const nextCollectable = storedCollectables.splice(inventoryCycleIndex, 1)[0];
    nextCollectable.hold(facingLeft);
    heldCollectable = nextCollectable;
    try { getSound.currentTime = 0; getSound.play(); } catch {}

    if (storedCollectables.length === 0) {
        inventoryCycleIndex = -1;
    } else {
        inventoryCycleIndex = (inventoryCycleIndex - 1 + storedCollectables.length) % storedCollectables.length;
    }
}

function releaseHeldCollectable(velocity: Position = { x: 0, y: 0 }) {
    if (!heldCollectable) return;
    const isThrown = velocity.x !== 0 || velocity.y !== 0;
    const releasePosition = getReleasedCollectablePosition(isThrown);
    const releaseVelocity = isThrown ? velocity : getDroppedCollectableReleaseVelocity();
    if (heldCollectable.creaturePayload) {
        const restoredCreature = assignEntityId(new Creature({
            ...heldCollectable.creaturePayload,
            x: Math.round(releasePosition.x),
            y: Math.round(releasePosition.y)
        }));
        creatureEntities.push(restoredCreature);
        removeCollectableEntity(heldCollectable);
        heldCollectable = null;
        return;
    }
    heldCollectable.release(
        releasePosition.x,
        releasePosition.y,
        releaseVelocity,
        isThrown ? 0 : MOVEMENT_SETTINGS.droppedCollectableAstronautIgnoreFrames
    );
    if (isGrenadeCollectable(heldCollectable)) {
        setGrenadeCollectableArmedState(heldCollectable, true);
    }
    heldCollectable = null;
}

function handleCollectableInteractions() {
    if (keys[','] && !prevKeys[','] && !heldCollectable) {
        const pickupTarget = getNearestPickupCollectable();
        if (pickupTarget) {
            pickupTarget.hold(facingLeft);
            heldCollectable = pickupTarget;
        } else {
            const pickupCreature = getNearestPickupCreature();
            if (pickupCreature) {
                const proxy = spawnCreatureCarryProxy(pickupCreature);
                removeCreatureEntity(pickupCreature);
                proxy.hold(facingLeft);
                heldCollectable = proxy;
            }
        }
    }

    if (keys['s'] && !prevKeys['s']) {
        storeHeldCollectable();
    }

    if (keys['g'] && !prevKeys['g']) {
        cycleStoredCollectable();
    }

    if (keys[' '] && !prevKeys[' '] && heldCollectable && isGrenadeCollectable(heldCollectable)) {
        setGrenadeCollectableArmedState(heldCollectable, !heldCollectable.armed);
    }

    if (keys['m'] && !prevKeys['m']) {
        releaseHeldCollectable();
    }

    if (keys['.'] && !prevKeys['.'] && heldCollectable) {
        const angleRadians = (throwAngleDegrees * Math.PI) / 180;
        const horizontalVelocity = Math.cos(angleRadians) * MOVEMENT_SETTINGS.throwVelocity * getFacingSign();
        const verticalVelocity = -Math.sin(angleRadians) * MOVEMENT_SETTINGS.throwVelocity;
        releaseHeldCollectable({ x: horizontalVelocity, y: verticalVelocity });
    }
}

function updateThrowAngle() {
    const raisingThrowAngle = !!keys['o'];
    const loweringThrowAngle = !!keys['k'];
    if (raisingThrowAngle === loweringThrowAngle) return;

    const nextAngle = throwAngleDegrees + (raisingThrowAngle ? 1 : -1) * MOVEMENT_SETTINGS.throwAngleAdjustDegreesPerFrame;
    throwAngleDegrees = Math.max(-90, Math.min(90, nextAngle));
}

function getCollectableEdgeSamples(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds,
    side: 'left' | 'right' | 'top' | 'bottom'
) {
    const left = entityX + collisionBounds.left;
    const right = entityX + collisionBounds.right;
    const top = entityY + collisionBounds.top;
    const bottom = entityY + collisionBounds.bottom;
    const sampleEdge = (start: number, end: number, segments = 6) => {
        if (start >= end) {
            return [start];
        }

        const points: number[] = [];
        for (let index = 0; index <= segments; index++) {
            points.push(start + ((end - start) * index) / segments);
        }
        return points;
    };

    if (side === 'left' || side === 'right') {
        const x = side === 'left' ? left : right;
        return sampleEdge(top + 1, bottom - 1).map((y) => ({ x, y }));
    }

    const y = side === 'top' ? top : bottom;
    return sampleEdge(left + 1, right - 1).map((x) => ({ x, y }));
}

function collidesAtSide(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds,
    side: 'left' | 'right' | 'top' | 'bottom'
) {
    const samples = getCollectableEdgeSamples(entityX, entityY, collisionBounds, side);
    const probeOffset = side === 'right' || side === 'bottom' ? 1 : -1;
    return samples.some(sample => !!getSolidBlockAtWorld(
        sample.x + (side === 'left' || side === 'right' ? probeOffset : 0),
        sample.y + (side === 'top' || side === 'bottom' ? probeOffset : 0),
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    ));
}

type AxisMovementResult = {
    x: number;
    y: number;
    movedX: number;
    movedY: number;
    blockedX: boolean;
    blockedY: boolean;
};

function simulateCreatureAxisMovement(
    creature: Creature,
    collisionBounds: CollisionBounds,
    targetX: number,
    targetY: number,
    axisOrder: Array<'x' | 'y'>
): AxisMovementResult {
    let x = creature.x;
    let y = creature.y;
    let movedX = 0;
    let movedY = 0;
    let blockedX = false;
    let blockedY = false;

    for (const axis of axisOrder) {
        const target = axis === 'x' ? targetX : targetY;
        const current = axis === 'x' ? x : y;
        const amount = target - current;
        const direction = Math.sign(amount);
        if (direction === 0) {
            continue;
        }

        const side = axis === 'x'
            ? (direction > 0 ? 'right' : 'left')
            : (direction > 0 ? 'bottom' : 'top');
        let moved = 0;

        for (let step = 0; step < Math.abs(amount); step++) {
            const nextX = axis === 'x' ? x + direction : x;
            const nextY = axis === 'y' ? y + direction : y;
            if (collidesAtSide(nextX, nextY, collisionBounds, side)) {
                if (axis === 'x') {
                    blockedX = true;
                } else {
                    blockedY = true;
                }
                break;
            }

            if (axis === 'x') {
                x = nextX;
            } else {
                y = nextY;
            }
            moved += direction;
        }

        if (axis === 'x') {
            movedX = moved;
            if (moved !== amount) {
                blockedX = true;
            }
        } else {
            movedY = moved;
            if (moved !== amount) {
                blockedY = true;
            }
        }
    }

    return { x, y, movedX, movedY, blockedX, blockedY };
}

function moveCreatureWithEnvironmentCollisions(creature: Creature, targetX: number, targetY: number): AxisMovementResult {
    const collisionBounds = getEntityCollisionBounds(creature);
    const clampedTargetX = Math.round(clampToRange(targetX, 0, MAP_WIDTH));
    const clampedTargetY = Math.round(clampToRange(targetY, 0, MAP_HEIGHT));
    const horizontalFirst = simulateCreatureAxisMovement(creature, collisionBounds, clampedTargetX, clampedTargetY, ['x', 'y']);
    const verticalFirst = simulateCreatureAxisMovement(creature, collisionBounds, clampedTargetX, clampedTargetY, ['y', 'x']);
    const horizontalError = Math.abs(clampedTargetX - horizontalFirst.x) + Math.abs(clampedTargetY - horizontalFirst.y);
    const verticalError = Math.abs(clampedTargetX - verticalFirst.x) + Math.abs(clampedTargetY - verticalFirst.y);
    const bestResult = verticalError < horizontalError
        ? verticalFirst
        : verticalError > horizontalError
            ? horizontalFirst
            : (Math.abs(verticalFirst.movedX) + Math.abs(verticalFirst.movedY)) > (Math.abs(horizontalFirst.movedX) + Math.abs(horizontalFirst.movedY))
                ? verticalFirst
                : horizontalFirst;
    creature.x = bestResult.x;
    creature.y = bestResult.y;
    return bestResult;
}

function getFloorSnapAmount(entityX: number, entityY: number, collisionBounds: CollisionBounds) {
    for (let distance = 1; distance <= MOVEMENT_SETTINGS.collectableGroundSnapDistance; distance++) {
        const samples = getCollectableEdgeSamples(entityX, entityY + distance, collisionBounds, 'bottom');
        const supported = samples.some(sample => !!getSolidBlockAtWorld(
            sample.x,
            sample.y + 1,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        ));
        if (supported) return distance;
    }

    return 0;
}

function moveCollectableHorizontally(collectable: Collectable, amount: number) {
    if (amount === 0) return 0;

    const direction = amount > 0 ? 1 : -1;
    const collisionBounds = getEntityCollisionBounds(collectable);
    const side = direction > 0 ? 'right' : 'left';
    let moved = 0;

    for (let step = 0; step < Math.abs(amount); step++) {
        const nextX = collectable.x + direction;
        if (collidesAtSide(nextX, collectable.y, collisionBounds, side)) {
            let steppedUp = false;
            for (let stepHeight = 1; stepHeight <= MOVEMENT_SETTINGS.collectablePushStepUpHeight; stepHeight++) {
                const candidateY = collectable.y - stepHeight;
                if (collidesAtSide(nextX, candidateY, collisionBounds, side)) {
                    continue;
                }
                if (collidesAtSide(nextX, candidateY, collisionBounds, 'top')) {
                    continue;
                }
                if (!collidesAtSide(nextX, candidateY, collisionBounds, 'bottom')) {
                    continue;
                }

                collectable.x = nextX;
                collectable.y = candidateY;
                collectable.isGrounded = true;
                moved += direction;
                steppedUp = true;
                break;
            }

            if (!steppedUp) {
                break;
            }
            continue;
        }
        collectable.x = nextX;
        moved += direction;
    }

    return moved;
}

function moveCollectableVertically(collectable: Collectable, amount: number) {
    if (amount === 0) return 0;

    const direction = amount > 0 ? 1 : -1;
    const collisionBounds = getEntityCollisionBounds(collectable);
    const side = direction > 0 ? 'bottom' : 'top';
    let moved = 0;

    for (let step = 0; step < Math.abs(amount); step++) {
        const nextY = collectable.y + direction;
        if (collidesAtSide(collectable.x, nextY, collisionBounds, side)) {
            break;
        }
        collectable.y = nextY;
        moved += direction;
    }

    return moved;
}

function resolveAstronautCollectableCollisions(horizontalMovement: number, verticalMovement: number) {
    const astronautRendered = getAstronautRenderedWorldSprite();
    for (const collectable of collectableEntities) {
        if (!isLooseCollectable(collectable)) continue;
        if (isCreatureProjectileCollectable(collectable)) continue;
        if (collectable.astronautCollisionIgnoreFrames > 0) continue;

        const astronautRect = getAstronautRect();
        const bounds = getEntityCollisionBounds(collectable);
        const collectableRect = getEntityRect(collectable.x, collectable.y, bounds);
        const overlapX = Math.min(astronautRect.right, collectableRect.right) - Math.max(astronautRect.left, collectableRect.left) + 1;
        const overlapY = Math.min(astronautRect.bottom, collectableRect.bottom) - Math.max(astronautRect.top, collectableRect.top) + 1;

        if (overlapX <= 0 || overlapY <= 0) {
            continue;
        }

        if (!doRenderedSpritesOverlap(astronautRendered, getRenderedEntityWorldSprite(collectable))) {
            continue;
        }

        const shouldResolveHorizontally = overlapX <= overlapY;

        if (shouldResolveHorizontally) {
            const horizontalDirection = horizontalMovement !== 0
                ? Math.sign(horizontalMovement)
                : ((astronautRect.left + astronautRect.right) / 2) < ((collectableRect.left + collectableRect.right) / 2)
                    ? -1
                    : 1;
            const pushAmount = Math.ceil(overlapX);
            if (horizontalMovement !== 0) {
                const physicsSettings = getCollectablePhysicsSettings(collectable);
                const pushScale = getDynamicObjectPushScale(collectable, physicsSettings);
                const requestedPush = Math.max(1, Math.ceil(pushAmount * pushScale));
                const moved = moveCollectableHorizontally(collectable, horizontalDirection * requestedPush);
                const remaining = pushAmount - Math.abs(moved);
                if (remaining > 0) {
                    gameState.astronaut.position.x -= horizontalDirection * remaining;
                    astronaut.velocity.x = 0;
                }

                collectable.velocity.x = getDynamicObjectPushedVelocity(
                    horizontalMovement,
                    collectable,
                    physicsSettings
                );
            } else {
                gameState.astronaut.position.x -= horizontalDirection * pushAmount;
                astronaut.velocity.x = 0;
            }
        } else if (verticalMovement > 0) {
            gameState.astronaut.position.y -= Math.ceil(overlapY);
            astronaut.velocity.y = 0;
            gameState.astronaut.isLanded = true;
        } else if (verticalMovement < 0) {
            const impactSpeed = Math.max(Math.abs(verticalMovement), Math.abs(astronaut.velocity.y));
            const physicsSettings = getCollectablePhysicsSettings(collectable);
            const launchSpeed = getDynamicObjectHeadBounceLaunchSpeed(
                collectable,
                impactSpeed,
                physicsSettings
            );
            const liftAmount = Math.ceil(overlapY);
            const desiredLift = Math.min(liftAmount, Math.ceil(launchSpeed));
            const movedUp = desiredLift > 0 ? Math.abs(moveCollectableVertically(collectable, -desiredLift)) : 0;
            const remaining = liftAmount - movedUp;

            astronaut.velocity.y = Math.max(astronaut.velocity.y, 0);

            if (movedUp > 0) {
                collectable.isGrounded = false;
                collectable.velocity.y = Math.min(
                    collectable.velocity.y,
                    -launchSpeed
                );
            }

            if (remaining > 0) {
                gameState.astronaut.position.y += remaining;
            }
        }
    }
}

function updateSingleCollectablePhysics(
    collectable: Collectable,
    physicsSettings: DynamicObjectPhysicsSettings = getCollectablePhysicsSettings(collectable),
    options: {
        bounceHorizontally?: boolean;
        groundFrictionStopThreshold?: number;
    } = {}
) {
    if (!isLooseCollectable(collectable)) {
        return {
            hitWorld: false,
            bounced: false,
            grounded: collectable.isGrounded
        };
    }

    if (collectable.astronautCollisionIgnoreFrames > 0) {
        collectable.astronautCollisionIgnoreFrames--;
    }

    const collisionBounds = getEntityCollisionBounds(collectable);
    applyDynamicObjectGravity(collectable, physicsSettings);

    const targetX = collectable.x + collectable.velocity.x;
    const targetY = collectable.y + collectable.velocity.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(targetX - collectable.x), Math.abs(targetY - collectable.y))));
    let nextX = collectable.x;
    let nextY = collectable.y;
    let grounded = false;
    let bounced = false;
    let hitWorld = false;

    for (let step = 0; step < steps; step++) {
        const stepTargetX = collectable.x + ((targetX - collectable.x) * (step + 1)) / steps;
        const stepTargetY = collectable.y + ((targetY - collectable.y) * (step + 1)) / steps;

        if (stepTargetX !== nextX) {
            const horizontalDirection = stepTargetX > nextX ? 'right' : 'left';
            if (!collidesAtSide(stepTargetX, nextY, collisionBounds, horizontalDirection)) {
                nextX = stepTargetX;
            } else {
                hitWorld = true;
                if (options.bounceHorizontally) {
                    const bounceRestitution = getDynamicObjectBounceRestitution(
                        collectable,
                        Math.abs(collectable.velocity.x),
                        physicsSettings
                    );
                    if (bounceRestitution > 0) {
                        collectable.velocity.x = -collectable.velocity.x * bounceRestitution;
                        bounced = true;
                    } else {
                        collectable.velocity.x = 0;
                    }
                } else {
                    collectable.velocity.x = 0;
                }
            }
        }

        if (stepTargetY !== nextY) {
            const verticalDirection = stepTargetY > nextY ? 'bottom' : 'top';
            if (!collidesAtSide(nextX, stepTargetY, collisionBounds, verticalDirection)) {
                nextY = stepTargetY;
            } else {
                hitWorld = true;
                if (verticalDirection === 'bottom') {
                    const impactSpeed = collectable.velocity.y;
                    const bounceRestitution = getDynamicObjectBounceRestitution(
                        collectable,
                        impactSpeed,
                        physicsSettings
                    );
                    if (bounceRestitution > 0) {
                        collectable.velocity.y = -impactSpeed * bounceRestitution;
                        bounced = true;
                    } else {
                        grounded = true;
                        collectable.velocity.y = 0;
                    }
                    break;
                } else {
                    collectable.velocity.y = 0;
                    break;
                }
            }
        }
    }

    if (!grounded && !bounced && collectable.velocity.y >= 0) {
        const snapAmount = getFloorSnapAmount(nextX, nextY, collisionBounds);
        if (snapAmount > 0) {
            hitWorld = true;
            const snapImpactSpeed = collectable.velocity.y + snapAmount * physicsSettings.gravity * 2;
            const bounceRestitution = getDynamicObjectBounceRestitution(
                collectable,
                snapImpactSpeed,
                physicsSettings
            );
            nextY += snapAmount;
            if (bounceRestitution > 0) {
                collectable.velocity.y = -snapImpactSpeed * bounceRestitution;
                bounced = true;
            } else {
                grounded = true;
                collectable.velocity.y = 0;
            }
        }
    }

    collectable.x = Math.round(nextX);
    collectable.y = Math.round(nextY);
    collectable.isGrounded = grounded;

    if (grounded) {
        applyDynamicObjectGroundFriction(
            collectable,
            physicsSettings,
            options.groundFrictionStopThreshold
        );
    }

    return {
        hitWorld,
        bounced,
        grounded
    };
}

function updateCollectablePhysics(now: number, simulationFrame: number) {
    for (const collectable of [...collectableEntities]) {
        const collectableChunkActivity = getChunkActivityForEntityPosition(collectable, now);
        if (isCreatureProjectileCollectable(collectable)) {
            if (!shouldRunChunkBandUpdate(collectableChunkActivity, PROJECTILE_CHUNK_CADENCE, simulationFrame)) {
                continue;
            }
            updateCreatureProjectileCollectable(collectable);
            continue;
        }
        if (!shouldRunChunkBandUpdate(collectableChunkActivity, COLLECTABLE_CHUNK_CADENCE, simulationFrame)) {
            continue;
        }
        syncGrenadeFuseState(collectable, now);

        if (typeof collectable.ambientSoundKey === 'string') {
            const nextAmbientSoundAt = typeof collectable.nextAmbientSoundAt === 'number'
                ? collectable.nextAmbientSoundAt
                : 0;
            if (now >= nextAmbientSoundAt) {
                const bounds = getEntityCollisionBounds(collectable);
                const center = getEntityCenter(collectable.x, collectable.y, bounds);
                const distance = Math.hypot(center.x - astronaut.position.x, center.y - astronaut.position.y);
                const range = 280;
                if (distance <= range) {
                    playManifestSound(collectable.ambientSoundKey, 0.35 * (1 - distance / range));
                }
                collectable.nextAmbientSoundAt = now + Math.max(250, collectable.ambientSoundIntervalMs ?? 1000);
            }
        }

        if (typeof collectable.ttlFrames === 'number') {
            collectable.ttlFrames--;
            if (collectable.ttlFrames <= 0) {
                playManifestSound('teleport', 0.45);
                removeCollectableEntity(collectable);
                continue;
            }
        }
        if (
            isGrenadeCollectable(collectable) &&
            collectable.armed &&
            typeof collectable.armedAtMs === 'number' &&
            now - collectable.armedAtMs >= MOVEMENT_SETTINGS.grenadeFuseMs
        ) {
            explodeCollectableGrenade(collectable);
            continue;
        }
        updateSingleCollectablePhysics(collectable);
    }
    updateGrenadeArmedLoopSound();
    updateMushroomAmbientLoopSound();
}

function updateAndDrawThrowGuide(context: CanvasRenderingContext2D, camera: Position) {
    const aimingActive = !!keys['o'] || !!keys['k'];
    if (aimingActive) {
        throwGuideDotEmitTimer++;
        if (throwGuideDotEmitTimer % MOVEMENT_SETTINGS.throwGuideDotEmitIntervalFrames === 0) {
            const origin = getAimOriginPosition();
            const angleRadians = (throwAngleDegrees * Math.PI) / 180;
            const directionX = Math.cos(angleRadians) * getFacingSign();
            const directionY = -Math.sin(angleRadians);
            for (let index = 0; index < MOVEMENT_SETTINGS.throwGuideDotsPerBurst; index++) {
                const speedJitter = 0.85 + Math.random() * 0.3;
                throwGuideDots.push({
                    x: origin.x,
                    y: origin.y,
                    vx: directionX * MOVEMENT_SETTINGS.throwGuideDotSpeed * speedJitter,
                    vy: directionY * MOVEMENT_SETTINGS.throwGuideDotSpeed * speedJitter,
                    hue: Math.random() * 360,
                    hueDrift: (Math.random() - 0.5) * 16,
                    flickerOffset: Math.random() * Math.PI * 2
                });
            }
        }
    } else {
        throwGuideDotEmitTimer = 0;
    }

    const animationTime = performance.now() * 0.02;
    const nextThrowGuideDots: ThrowGuideDot[] = [];

    for (const dot of throwGuideDots) {
        dot.x += dot.vx;
        dot.y += dot.vy;

        const screenX = dot.x - camera.x;
        const screenY = dot.y - camera.y;
        if (screenX < 0 || screenX > canvas.width || screenY < 0 || screenY > canvas.height) {
            continue;
        }

        nextThrowGuideDots.push(dot);
        const hue = (dot.hue + animationTime * 120 + dot.hueDrift) % 360;
        const lightness = 58 + (Math.sin(animationTime * 2.3 + dot.flickerOffset) + 1) * 14;
        context.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
        context.beginPath();
        context.arc(screenX, screenY, MOVEMENT_SETTINGS.throwGuideDotSize, 0, Math.PI * 2);
        context.fill();
    }

    throwGuideDots = nextThrowGuideDots;
}

// --- Show tight bounding boxes toggle ---
let showTightBoundingBoxes = false; // Red sprite-based bounding boxes
let showWorldBoundingBoxes = false; // Green world-coordinate bounding boxes
let showCreatureOverlays = false;
window.addEventListener('keydown', (e) => {
    if (isDesignerOpen()) return;
    if (e.key === 'b') showTightBoundingBoxes = !showTightBoundingBoxes;
    if (e.key === 'f') showWorldBoundingBoxes = !showWorldBoundingBoxes;
    if (e.key === 'd') gameState.debugMode = !gameState.debugMode;
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        showPerformanceHud = !showPerformanceHud;
        if (!isPerformanceInstrumentationEnabled()) {
            lastFrameTimestamp = null;
        }
        requestImmediateFrame();
    }
    if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'j') {
        e.preventDefault();
        showPerformanceConsoleSummary = !showPerformanceConsoleSummary;
        if (showPerformanceConsoleSummary) {
            lastPerformanceConsoleSummaryAt = 0;
        } else if (!isPerformanceInstrumentationEnabled()) {
            lastFrameTimestamp = null;
        }
        requestImmediateFrame();
    }
});
