// Main entry point for the astronaut game
import { Astronaut, GameState, Position } from './types/index.js';
import {
    astronaut, resetAstronaut, resetAstronautToPosition, flipAstronaut, handleAstronautMovement, applyLandingMomentum, getAstronautCollisionOffsets, setAstronautCollisionProfile,
    getAstronautStartPosition, setAstronautStartPosition,
    walkSpeed, facingLeft, upPressed, downPressed, leftPressed, rightPressed,
    checkAstronautCollisions
} from './astronaut.js';
import { applyGravity } from './gravity.js';
import {
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
import { Collectable } from './collectable.js';
import { makeBlackTransparent, remapSpritePalette, calculateSpriteCollisionBoundingBoxes, 
calculateAstronautSpriteBoundingBoxes, getSolidBlockAtWorld, getAnyBlockAtWorld, 
drawEntities, getSpriteTranslationOffset, getSpriteVisibleBounds, getTransformedSpriteCanvas,
getVisibleCenterRotationOffset, normalizeSpriteTranslation, SpriteTranslation
} from './utilities.js';
import { MOVEMENT_SETTINGS, VIEWPORT_SETTINGS } from './settings.js';
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
    keys[event.key] = true;
    requestImmediateFrame();
});

window.addEventListener('keyup', (event) => {
    keys[event.key] = false;
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
        !collectable.held &&
        (
            !collectable.isGrounded ||
            Math.abs(collectable.velocity.x) > ACTIVE_MOTION_EPSILON ||
            Math.abs(collectable.velocity.y) > ACTIVE_MOTION_EPSILON ||
            collectable.astronautCollisionIgnoreFrames > 0
        )
    );
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
        hasMovingCollectables() ||
        !astronaut.isLanded ||
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
type CreatureProjectileKind = 'bullet' | 'grenade' | 'energy_pod';
type CreatureProjectile = {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    velocity: Position;
    kind: CreatureProjectileKind;
    homing: boolean;
    remainingFrames: number;
    damage: number;
    sourceEntityId?: number;
};
let throwGuideDots: ThrowGuideDot[] = [];
let throwGuideDotEmitTimer = 0;
let creatureProjectiles: CreatureProjectile[] = [];
let worldDesigner: WorldDesigner | null = null;
const STARFIELD_HEIGHT = Math.min(MAP_HEIGHT, 2000);

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
    creatureProjectiles = [];
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
        ? collectableEntities.filter((collectable) => !collectable.held)
        : collectableEntities.filter((collectable) => !collectable.stored && !collectable.collected);
    mapBlocksToDraw.forEach(drawWorldBBox);
    if (layerVisibility.doors) doorEntities.forEach(drawWorldBBox);
    if (layerVisibility.buttons) buttonEntities.forEach(drawWorldBBox);
    if (layerVisibility.creatures) creatureEntities.forEach(drawWorldBBox);
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
    creatureProjectiles = [];
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

    context.save();
    context.translate(
        astronaut.position.x - camera.x,
        astronaut.position.y - camera.y
    );
    if (flipSprite) context.scale(-1, 1);
    if (flipVertical) context.scale(1, -1);
    context.drawImage(
        astronautSpriteSource || spriteSheet,
        spriteRect.x, spriteRect.y, spriteRect.w, spriteRect.h,
        -drawW / 2,
        -drawH / 2,
        drawW, drawH
    );
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
        let loc: TeleportLocation | null = null;
        if (teleportLocations.length > 0) {
            // Use the most recent (last) location
            loc = teleportLocations.pop()!;
            if (teleportSlot > teleportLocations.length) teleportSlot = teleportLocations.length;
        } else {
            loc = { ...defaultTeleportLocation };
        }
        if (loc && !teleporting) {
            teleporting = true;
            teleportPhase = 'out';
            teleportAnimFrame = 0;
            teleportTarget = loc;
            teleportSpriteCol = spriteCol;
            teleportFlipSprite = flipSprite;
            teleportFlipVertical = flipVertical;
            // Play teleport sound
            try { teleportSound.currentTime = 0; teleportSound.play(); } catch {}
        }
    }

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
                ? collectableEntities.filter((collectable) => !collectable.held)
                : collectableEntities.filter((collectable) => !collectable.stored && !collectable.held && !collectable.collected);
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
        if (layerVisibility.creatures && creatureProjectiles.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectiles, frameNow);
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
    handleAstronautMovement(keys, true, {
        walkSpeedScale: movementModifiers.walkSpeedScale,
        flightControlScale: movementModifiers.flightControlScale
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
    updateCreatureProjectiles();
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
        if (layerVisibility.creatures && creatureProjectiles.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectiles, frameNow);
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
        ctx!.save();
        ctx!.translate(canvas.width / 2, canvas.height / 2);
        if (flipSprite) ctx!.scale(-1, 1);
        if (flipVertical) ctx!.scale(1, -1);
        ctx!.drawImage(
            astronautSpriteSource || spriteSheet,
            spriteRect.x, spriteRect.y, SPRITE_W, SPRITE_H,
            -drawW / 2,
            -drawH / 2,
            drawW, drawH
        );

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
        if (layerVisibility.creatures && creatureProjectiles.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectiles, frameNow);
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

        if (layerVisibility.creatures && creatureProjectiles.length > 0) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureProjectiles, frameNow);
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
}) {
    const tileSize = 32 * SPRITE_SCALE;
    const rotation = typeof entity.rotation === "number" ? entity.rotation : 0;
    const renderOffset = getEntityRenderOffset(entity);
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

    const spriteRect = findSpriteRectByType(entity.type);
    const previewSheet = getEntityPreviewSheet(entity as { palette?: number });
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

function clampToRange(value: number, minimum: number, maximum: number) {
    return Math.max(minimum, Math.min(maximum, value));
}

function getProjectileSpriteType(kind: CreatureProjectileKind) {
    if (kind === 'grenade') {
        return 'grenade';
    }
    if (kind === 'energy_pod') {
        return 'energy_pod2';
    }
    return 'bullet1';
}

function spawnEnergyPodCollectable(projectile: CreatureProjectile) {
    const pod = assignEntityId(new Collectable({
        x: Math.round(projectile.x),
        y: Math.round(projectile.y),
        type: 'energy_pod2',
        palette: projectile.palette ?? 0,
        rotation: projectile.rotation,
        collected: false,
        name: 'energy_pod',
        weight: 0.1,
        pickupEnabled: true,
        storable: false,
        affectsAstronaut: false,
        collision: false,
        velocity: { x: 0, y: 0 },
        isGrounded: false,
        ttlFrames: MOVEMENT_SETTINGS.creatureEnergyPodLifetimeFrames,
        ambientSoundKey: 'get',
        ambientSoundIntervalMs: 900
    }));
    collectableEntities.push(pod);
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
    astronaut.velocity.x += (dx / distance) * force;
    astronaut.velocity.y += (dy / distance) * Math.max(0.8, force * 0.65);
    playRuntimeSound(ouchSounds[Math.floor(Math.random() * ouchSounds.length)], 0.8);
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

function projectileOverlapsCreature(projectile: CreatureProjectile, creature: Creature) {
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

function explodeProjectile(projectile: CreatureProjectile) {
    const radius = projectile.kind === 'grenade' ? 96 : 52;
    for (const creature of [...creatureEntities]) {
        if (creature.entityId === projectile.sourceEntityId) {
            continue;
        }
        const creatureBounds = getEntityCollisionBounds(creature);
        const creatureCenter = getEntityCenter(creature.x, creature.y, creatureBounds);
        const distance = Math.hypot(creatureCenter.x - projectile.x, creatureCenter.y - projectile.y);
        if (distance > radius) {
            continue;
        }
        const damage = Math.max(0.5, projectile.damage * (1 - distance / radius));
        applyDamageToCreature(creature, damage);
    }

    const astronautRect = getAstronautRect();
    const astronautCenter = {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };
    const astronautDistance = Math.hypot(astronautCenter.x - projectile.x, astronautCenter.y - projectile.y);
    if (astronautDistance <= radius) {
        applyAstronautImpact(projectile.x, projectile.y, Math.max(0.8, projectile.damage * (1 - astronautDistance / radius)));
    }
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

function spawnCreatureProjectile(creature: Creature, targetX: number, targetY: number) {
    if (creature.fireMode === 'none') {
        return;
    }

    const kind: CreatureProjectileKind = creature.fireMode === 'grenades'
        ? 'grenade'
        : creature.fireMode === 'energy_pods'
            ? 'energy_pod'
            : 'bullet';
    const bounds = getEntityCollisionBounds(creature);
    const creatureCenter = getEntityCenter(creature.x, creature.y, bounds);
    const creatureRect = getEntityRect(creature.x, creature.y, bounds);
    const dx = targetX - creatureCenter.x;
    const dy = targetY - creatureCenter.y;
    const distance = Math.max(1, Math.hypot(dx, dy));
    const directionX = dx / distance;
    const directionY = dy / distance;
    const speed = Math.max(1, creature.projectileSpeed);
    const baseVelocity = kind === 'grenade'
        ? {
            x: directionX * speed,
            y: directionY * speed - 1.2
        }
        : kind === 'energy_pod'
            ? {
                x: directionX * Math.max(1, speed * 0.85),
                y: directionY * Math.max(1, speed * 0.85) - 0.5
            }
            : {
                x: directionX * speed,
                y: directionY * speed
            };
    const projectileRotation = directionX < 0 ? 5 : 1;
    const projectileBounds = getEntityCollisionBounds({
        type: getProjectileSpriteType(kind),
        rotation: projectileRotation
    });
    const creatureHalfWidth = (creatureRect.right - creatureRect.left + 1) / 2;
    const creatureHalfHeight = (creatureRect.bottom - creatureRect.top + 1) / 2;
    const projectileHalfExtent = Math.max(
        (projectileBounds.right - projectileBounds.left + 1) / 2,
        (projectileBounds.bottom - projectileBounds.top + 1) / 2
    );
    const distanceToCreatureEdge = Math.min(
        Number.POSITIVE_INFINITY,
        directionX === 0 ? Number.POSITIVE_INFINITY : creatureHalfWidth / Math.max(0.001, Math.abs(directionX)),
        directionY === 0 ? Number.POSITIVE_INFINITY : creatureHalfHeight / Math.max(0.001, Math.abs(directionY))
    );
    const muzzlePadding = 2;
    const projectileSpawnCenter = {
        x: creatureCenter.x + directionX * (distanceToCreatureEdge + projectileHalfExtent + muzzlePadding),
        y: creatureCenter.y + directionY * (distanceToCreatureEdge + projectileHalfExtent + muzzlePadding)
    };
    const projectileSpawnPosition = getEntityPositionFromCenter(
        projectileSpawnCenter.x,
        projectileSpawnCenter.y,
        projectileBounds
    );

    creatureProjectiles.push({
        x: projectileSpawnPosition.x,
        y: projectileSpawnPosition.y,
        type: getProjectileSpriteType(kind),
        palette: creature.palette ?? 0,
        rotation: projectileRotation,
        velocity: baseVelocity,
        kind,
        homing: creature.homingBullets && kind === 'bullet',
        remainingFrames: kind === 'energy_pod'
            ? MOVEMENT_SETTINGS.creatureEnergyPodLifetimeFrames
            : MOVEMENT_SETTINGS.creatureProjectileLifetimeFrames,
        damage: Math.max(1, creature.damageOnContact || 1),
        sourceEntityId: creature.entityId
    });
}

function projectileHitsWorld(projectile: CreatureProjectile, nextX: number, nextY: number) {
    const bounds = getEntityCollisionBounds(projectile);
    return (
        collidesAtSide(nextX, nextY, bounds, 'left') ||
        collidesAtSide(nextX, nextY, bounds, 'right') ||
        collidesAtSide(nextX, nextY, bounds, 'top') ||
        collidesAtSide(nextX, nextY, bounds, 'bottom')
    );
}

function projectileOverlapsAstronaut(projectile: CreatureProjectile) {
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

function updateCreatureProjectiles() {
    const nextProjectiles: CreatureProjectile[] = [];
    for (const projectile of creatureProjectiles) {
        let expired = false;

        if (projectile.homing) {
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
            const targetVx = (dx / distance) * Math.max(1, Math.hypot(projectile.velocity.x, projectile.velocity.y));
            const targetVy = (dy / distance) * Math.max(1, Math.hypot(projectile.velocity.x, projectile.velocity.y));
            projectile.velocity.x += (targetVx - projectile.velocity.x) * 0.08;
            projectile.velocity.y += (targetVy - projectile.velocity.y) * 0.08;
        }

        if (projectile.kind !== 'bullet') {
            projectile.velocity.y = Math.min(
                projectile.velocity.y + MOVEMENT_SETTINGS.creatureProjectileGravity,
                MOVEMENT_SETTINGS.creatureProjectileTerminalVelocity
            );
        }

        const targetX = projectile.x + projectile.velocity.x;
        const targetY = projectile.y + projectile.velocity.y;
        const steps = Math.max(1, Math.ceil(Math.max(Math.abs(projectile.velocity.x), Math.abs(projectile.velocity.y))));

        for (let step = 0; step < steps; step++) {
            const nextX = projectile.x + (targetX - projectile.x) / Math.max(1, steps - step);
            const nextY = projectile.y + (targetY - projectile.y) / Math.max(1, steps - step);

            if (projectileHitsWorld(projectile, nextX, nextY)) {
                if (projectile.kind === 'grenade') {
                    explodeProjectile(projectile);
                    expired = true;
                } else if (projectile.kind === 'energy_pod') {
                    spawnEnergyPodCollectable(projectile);
                    expired = true;
                } else {
                    expired = true;
                }
                break;
            }

            projectile.x = nextX;
            projectile.y = nextY;

            for (const creature of [...creatureEntities]) {
                if (creature.entityId === projectile.sourceEntityId) {
                    continue;
                }
                if (!projectileOverlapsCreature(projectile, creature)) {
                    continue;
                }
                const wasRemoved = applyDamageToCreature(
                    creature,
                    projectile.kind === 'grenade' ? projectile.damage * 1.5 : projectile.damage
                );
                if (projectile.kind === 'energy_pod') {
                    spawnEnergyPodCollectable(projectile);
                }
                if (projectile.kind === 'grenade') {
                    explodeProjectile(projectile);
                }
                expired = true;
                if (wasRemoved) {
                    playManifestSound('get', 0.55);
                }
                break;
            }
            if (expired) {
                break;
            }

            if (projectileOverlapsAstronaut(projectile)) {
                if (projectile.kind === 'grenade') {
                    explodeProjectile(projectile);
                } else {
                    applyAstronautImpact(projectile.x, projectile.y, Math.max(0.9, projectile.damage));
                }
                expired = true;
                break;
            }
        }

        projectile.remainingFrames--;
        if (projectile.remainingFrames <= 0) {
            if (projectile.kind === 'grenade') {
                explodeProjectile(projectile);
            } else if (projectile.kind === 'energy_pod') {
                spawnEnergyPodCollectable(projectile);
            }
            expired = true;
        }

        if (!expired) {
            nextProjectiles.push(projectile);
        }
    }
    creatureProjectiles = nextProjectiles;
}

function updateCreatures(frameNow: number) {
    const astronautRect = getAstronautRect();
    const astronautCenter = {
        x: (astronautRect.left + astronautRect.right) / 2,
        y: (astronautRect.top + astronautRect.bottom) / 2
    };

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
        const turretAimDx = astronautCenter.x - turretAimCenter.x;
        const distanceToAstronaut = Math.hypot(dx, dy);
        const trackRange = Math.max(creature.trackRange ?? 0, creature.followRange ?? 0);
        const shouldTrackAstronaut = distanceToAstronaut <= trackRange;
        const shouldAutoAim = shouldTrackAstronaut && (creature.followsAstronaut || creature.fireMode !== 'none');
        const homeDistance = Math.hypot(creature.x - creature.homeX, creature.y - creature.homeY);

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
        if (creature.fireMode !== 'none' && shouldTrackAstronaut) {
            const nextFireAt = typeof runtimeState.nextFireAt === 'number'
                ? Number(runtimeState.nextFireAt)
                : 0;
            if (frameNow >= nextFireAt) {
                spawnCreatureProjectile(creature, astronautCenter.x, astronautCenter.y);
                runtimeState.nextFireAt = frameNow + Math.max(250, creature.fireCooldownMs);
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

        if (creature.hostile && creature.damageOnContact > 0) {
            const runtimeState = creature.state ?? {};
            const nextSoundAt = typeof runtimeState.nextContactSoundAt === 'number'
                ? Number(runtimeState.nextContactSoundAt)
                : 0;
            const now = performance.now();
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
        const bounds = getEntityCollisionBounds(creature);
        const rect = getEntityRect(creature.x, creature.y, bounds);
        const screenX = rect.left - camera.x;
        const screenY = rect.top - camera.y;
        const width = rect.right - rect.left + 1;
        const height = rect.bottom - rect.top + 1;
        const damageFlashUntil = typeof creature.state?.damageFlashUntil === 'number'
            ? Number(creature.state.damageFlashUntil)
            : 0;
        if (creature.damageFlash && damageFlashUntil > now) {
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
                const pushScale = getDynamicObjectPushScale(collectable, COLLECTABLE_PHYSICS_SETTINGS);
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
                    COLLECTABLE_PHYSICS_SETTINGS
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
            const launchSpeed = getDynamicObjectHeadBounceLaunchSpeed(
                collectable,
                impactSpeed,
                COLLECTABLE_PHYSICS_SETTINGS
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

function updateSingleCollectablePhysics(collectable: Collectable) {
    if (!isLooseCollectable(collectable)) return;

    if (collectable.astronautCollisionIgnoreFrames > 0) {
        collectable.astronautCollisionIgnoreFrames--;
    }

    const collisionBounds = getEntityCollisionBounds(collectable);
    applyDynamicObjectGravity(collectable, COLLECTABLE_PHYSICS_SETTINGS);

    const targetX = collectable.x + collectable.velocity.x;
    const targetY = collectable.y + collectable.velocity.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(targetX - collectable.x), Math.abs(targetY - collectable.y))));
    let nextX = collectable.x;
    let nextY = collectable.y;
    let grounded = false;
    let bounced = false;

    for (let step = 0; step < steps; step++) {
        const stepTargetX = collectable.x + ((targetX - collectable.x) * (step + 1)) / steps;
        const stepTargetY = collectable.y + ((targetY - collectable.y) * (step + 1)) / steps;

        if (stepTargetX !== nextX) {
            const horizontalDirection = stepTargetX > nextX ? 'right' : 'left';
            if (!collidesAtSide(stepTargetX, nextY, collisionBounds, horizontalDirection)) {
                nextX = stepTargetX;
            } else {
                collectable.velocity.x = 0;
            }
        }

        if (stepTargetY !== nextY) {
            const verticalDirection = stepTargetY > nextY ? 'bottom' : 'top';
            if (!collidesAtSide(nextX, stepTargetY, collisionBounds, verticalDirection)) {
                nextY = stepTargetY;
            } else {
                if (verticalDirection === 'bottom') {
                    const impactSpeed = collectable.velocity.y;
                    const bounceRestitution = getDynamicObjectBounceRestitution(
                        collectable,
                        impactSpeed,
                        COLLECTABLE_PHYSICS_SETTINGS
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
            const snapImpactSpeed = collectable.velocity.y + snapAmount * COLLECTABLE_PHYSICS_SETTINGS.gravity * 2;
            const bounceRestitution = getDynamicObjectBounceRestitution(
                collectable,
                snapImpactSpeed,
                COLLECTABLE_PHYSICS_SETTINGS
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
        applyDynamicObjectGroundFriction(collectable, COLLECTABLE_PHYSICS_SETTINGS);
    }
}

function updateCollectablePhysics() {
    const now = performance.now();
    for (const collectable of [...collectableEntities]) {
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
