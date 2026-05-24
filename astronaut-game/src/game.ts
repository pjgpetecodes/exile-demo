// Main entry point for the astronaut game
import {
    Astronaut,
    CreatureFireMode,
    CreatureProjectileKind,
    CreatureProjectileRuntimeData,
    GameState,
    Position
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
    mapLoaded,
    loadMapBlocks,
    drawMap,
    getBlockAtWorld,
    getBlackBackgroundBlocks,
    getMapBlocksBehindAstronaut,
    getMapBlocksMaskAstronaut,
    getRenderableMapBlocks,
    rebuildMapBlockRenderCache
} from './map.js';
import { initStars, updateAndDrawStars } from './stars.js';
import { emitJetpackDots, updateAndDrawJetpackDots, resetJetpackDotEmitTimer, hasActiveJetpackDots } from './jetpack.js';
import { Button } from './button.js';
import { Door } from './door.js';
import { Creature, toCreatureSaveData } from './creature.js';
import { Collectable, getDefaultGrenadeExplosionPower, isGrenadeCollectableType } from './collectable.js';
import { makeBlackTransparent, remapSpritePalette, calculateSpriteCollisionBoundingBoxes, 
calculateAstronautSpriteBoundingBoxes, getSolidBlockAtWorld, getAnyBlockAtWorld, 
drawEntities, getSpriteTranslationOffset, getSpriteVisibleBounds, getTransformedSpriteCanvas,
getVisibleCenterRotationOffset, getRenderedEntitySpriteCanvas, normalizeSpriteTranslation, SpriteTranslation
} from './utilities.js';
import { CREATURE_PROJECTILE_SETTINGS, MOVEMENT_SETTINGS, VIEWPORT_SETTINGS } from './settings.js';
import {
    SPRITE_ROW, SPRITE_COL_STAND, SPRITE_COL_FLY_RIGHT, SPRITE_COL_FLY_DIAGONAL,
    SPRITE_COL_FLY_FLOAT, SPRITE_COL_FLY_DOWN, SPRITE_COL_WALK_START, SPRITE_COL_WALK_RIGHT1,
    SPRITE_COL_WALK_RIGHT2, SPRITE_COL_WALK_END, TELEPORT_ANIM_FRAMES, MAP_WIDTH, MAP_HEIGHT,
    SPRITE_SCALE, rememberSound, teleportSound, buttonOnSound, doorOpenSound, doorCloseSound, getSound, saveSound, ouchSounds, creatureManifestSounds,
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

window.addEventListener('keydown', (event) => {
    const key = event.code === 'Space' ? ' ' : event.key;
    if (key === ' ') {
        event.preventDefault();
    }
    keys[key] = true;
    requestImmediateFrame();
});

window.addEventListener('keyup', (event) => {
    const key = event.code === 'Space' ? ' ' : event.key;
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
        flipAstronaut();
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
        !collectable.collected &&
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
    const spriteSource = astronautSpriteSource || spriteSheet;
    if (!spriteSource) {
        return;
    }

    if (!isAstronautDamageFlashVisible(now)) {
        context.drawImage(
            spriteSource,
            spriteRect.x, spriteRect.y, spriteRect.w, spriteRect.h,
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
            spriteSource,
            spriteRect.x, spriteRect.y, spriteRect.w, spriteRect.h,
            -drawW / 2,
            -drawH / 2,
            drawW, drawH
        );
        return;
    }

    flashContext.imageSmoothingEnabled = false;
    flashContext.drawImage(
        spriteSource,
        spriteRect.x, spriteRect.y, spriteRect.w, spriteRect.h,
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
let throwGuideDots: ThrowGuideDot[] = [];
let throwGuideDotEmitTimer = 0;
let projectileImpactEffects: ProjectileImpactEffect[] = [];
let bulletImpactParticles: BulletImpactParticle[] = [];
let worldDesigner: WorldDesigner | null = null;
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

(window as any).__exileDebug = {
    getButtons: () => buttonEntities,
    getSelectedDesignerSelection: () => worldDesigner?.getDebugSelection() ?? null,
    getSelectedDesignerButton: () => {
        const selection = worldDesigner?.getDebugSelection() ?? null;
        return selection?.category === 'buttons' ? selection.entity : null;
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
        !collectable.held &&
        !collectable.collected
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
        astronautStart: getAstronautStartPosition()
    };
}

function replaceRawWorldData(data: RawWorldData) {
    mapBlocks.splice(0, mapBlocks.length, ...data.worldMap.map((block) => assignEntityId({ ...block })));
    doorEntities = data.doors.map((door) => assignEntityId(new Door(door)));
    buttonEntities = data.buttons.map((button) => assignEntityId(new Button(button)));
    creatureEntities = data.creatures.map((creature) => assignEntityId(new Creature(creature)));
    collectableEntities = data.collectables.map((collectable) => assignEntityId(new Collectable(collectable)));
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
    await loadAstronautStartPosition();
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
        astronaut.position.x - camera.x,
        astronaut.position.y - camera.y
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

        ctx!.imageSmoothingEnabled = false;
        ctx!.clearRect(0, 0, canvas.width, canvas.height);

        const camera = getCameraOffset();

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
    const mapBlocksToDraw = !layerVisibility.world
        ? []
        : getRenderableMapBlocks(hideBlackBackgroundBlocks);
    const mapBlocksBehindAstronaut = !layerVisibility.world
        ? []
        : getMapBlocksBehindAstronaut(hideBlackBackgroundBlocks);
    const mapBlocksMaskAstronaut = !layerVisibility.world
        ? []
        : getMapBlocksMaskAstronaut();
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
        drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksBehindAstronaut, frameNow);
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
            const collectablesToDraw = worldDesigner?.isActive() && !worldDesigner.isPreviewMode()
                ? getDesignerRenderableCollectables()
                : getRenderableCollectables();
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
    }

    if (worldDesigner?.isActive()) {
        drawAstronautInWorld(ctx!, camera, spriteCol, flipSprite, flipVertical);
        if (mapBlocksMaskAstronaut.length > 0) {
            drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
        }
        const creatureProjectileDrawables = getCreatureProjectileCollectables();
        if (layerVisibility.creatures && creatureProjectileDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDrawables, frameNow);
        }
        if (layerVisibility.creatures && projectileImpactEffects.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, projectileImpactEffects, frameNow);
        }
        if (bulletImpactParticles.length > 0) {
            updateAndDrawBulletImpactParticles(layerVisibility.creatures ? ctx! : null, camera);
        }
        if (heldCollectable) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, [heldCollectable], frameNow);
        }
        worldDesigner.render(ctx!);
        prevKeys = { ...keys };
        return;
    }

    // --- Controls: Upward and horizontal movement ---
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

    updateCreatures(frameNow);
    updateCreatureSounds(frameNow);
    updateProjectileImpactEffects();
    resolveAstronautCreatureCollisions();
    updateThrowAngle();
    handleCollectableInteractions();
    updateHeldCollectablePosition();
    resolveAstronautCollectableCollisions(
        gameState.astronaut.position.x - movementStartX,
        gameState.astronaut.position.y - movementStartY
    );
    updateCollectablePhysics();
    updateHeldCollectablePosition();

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
        walkSpeed > 0
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
            drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
        }
        const creatureProjectileOverlayDrawables = getCreatureProjectileCollectables();
        if (layerVisibility.creatures && creatureProjectileOverlayDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileOverlayDrawables, frameNow);
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
        ctx!.translate(canvas.width / 2, canvas.height / 2);
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
            drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksMaskAstronaut, frameNow);
        }
        const creatureProjectileDebugDrawables = getCreatureProjectileCollectables();
        if (layerVisibility.creatures && creatureProjectileDebugDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileDebugDrawables, frameNow);
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

        if (heldCollectable) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, [heldCollectable], frameNow);
        }

        const creatureProjectileHudDrawables = getCreatureProjectileCollectables();
        if (layerVisibility.creatures && creatureProjectileHudDrawables.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectileHudDrawables, frameNow);
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

function getRenderedEntityWorldSprite(entity: {
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

function clampToRange(value: number, minimum: number, maximum: number) {
    return Math.max(minimum, Math.min(maximum, value));
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

function getGrenadeExplosionRadius(type: string) {
    return type === 'plasma_grenade'
        ? MOVEMENT_SETTINGS.plasmaGrenadeExplosionRadius
        : MOVEMENT_SETTINGS.grenadeExplosionRadius;
}

function getGrenadeExplosionPower(type: string, explosionPower?: number) {
    const fallbackPower = getDefaultGrenadeExplosionPower(type) ?? MOVEMENT_SETTINGS.grenadeExplosionPower;
    const resolvedPower = typeof explosionPower === 'number' ? explosionPower : fallbackPower;
    return clampToRange(resolvedPower, 0.5, MOVEMENT_SETTINGS.grenadeMaxExplosionPower);
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

function applyAstronautImpact(sourceX: number, sourceY: number, force: number) {
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
        Math.max(1.6, damage * 0.75 + proximity * 2.6)
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
            Math.max(0.8, projectile.creatureProjectile.damage * (settings.splashDamageMultiplier ?? 1) * (1 - astronautDistance / radius))
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
    const radius = getGrenadeExplosionRadius(grenadeType);
    const power = getGrenadeExplosionPower(grenadeType, collectable.explosionPower);
    spawnGrenadeExplosionEffect(grenadeType, collectable.palette ?? 0, center.x, center.y);

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
            Math.max(1, power * (1 - astronautDistance / radius))
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
    let muzzleAnchor = getEntitySideAnchorPoint(
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
            muzzleAnchor = getEntitySideAnchorPoint(
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

function updateCreatures(frameNow: number) {
    const astronautRect = getAstronautRect();
    const astronautCenter = {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };
    const astronautAimPoint = getAstronautAimPoint();

    for (const creature of creatureEntities) {
        creature.previousX = creature.x;
        creature.previousY = creature.y;

        const runtimeState = creature.state ?? {};
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
        const shouldTrackAstronaut = distanceToAstronaut <= trackRange;
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
        if (creature.fireMode !== 'none' && hasFiringTarget) {
            const nextFireAt = typeof runtimeState.nextFireAt === 'number'
                ? Number(runtimeState.nextFireAt)
                : 0;
            if (frameNow >= nextFireAt) {
                spawnCreatureProjectile(creature, aimTarget.x, aimTarget.y, isTurret ? turretAimCenter : undefined);
                runtimeState.nextFireAt = getNextCreatureFireAt(frameNow, creature);
            }
        }
        creature.state = runtimeState;
        creature.x = Math.round(nextX);
        creature.y = Math.round(nextY);

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
        } else {
            creature.rotation = authoredRotation;
        }
    }

    for (const predator of [...creatureEntities]) {
        if (!predator.canEatWasps) {
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

    const astronautRect = getAstronautRect();
    const collectableBounds = getEntityCollisionBounds(heldCollectable);
    const collectableHalfHeight = (collectableBounds.bottom - collectableBounds.top + 1) / 2;
    const desiredCenterY = astronaut.position.y + MOVEMENT_SETTINGS.heldCollectableVerticalOffset;

    const x = facingLeft
        ? astronautRect.left - 2 - collectableBounds.right
        : astronautRect.right + 2 - collectableBounds.left;

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
        y: astronaut.velocity.y * MOVEMENT_SETTINGS.droppedCollectableMomentumTransfer
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
    return !collectable.collected && !collectable.held && !collectable.stored;
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

function updateCollectablePhysics() {
    const now = performance.now();
    for (const collectable of [...collectableEntities]) {
        if (isCreatureProjectileCollectable(collectable)) {
            updateCreatureProjectileCollectable(collectable);
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
});
