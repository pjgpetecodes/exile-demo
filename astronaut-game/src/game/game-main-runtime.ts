// Main entry point for the astronaut game
import {
    Astronaut,
    ChunkActivityBand,
    CreatureProjectileKind,
    CreatureProjectileRuntimeData,
    GameState,
    Position,
    WindGlobalSettings
} from '../types/index.js';
import {
    astronaut, resetAstronaut, resetAstronautToPosition, flipAstronaut, handleAstronautMovement, applyLandingMomentum, getAstronautCollisionOffsets, setAstronautCollisionProfile, canAstronautFitCollisionProfile,
    getAstronautStartPosition, setAstronautStartPosition,
    walkSpeed, facingLeft, upPressed, downPressed, leftPressed, rightPressed,
    checkAstronautCollisions
} from '../entities/astronaut.js';
import { applyGravity } from '../physics/gravity.js';
import {
    DynamicObjectPhysicsSettings,
    applyDynamicObjectGravity,
    applyDynamicObjectGroundFriction,
    getDynamicObjectBounceRestitution,
    getDynamicObjectHeadBounceLaunchSpeed,
    getDynamicObjectPushedVelocity,
    getDynamicObjectPushScale
} from '../physics/object-physics.js';
import {
    clearMapSpriteCache,
    mapBlocks,
    mapLoaded,
    loadMapBlocks,
    drawMap,
    ensureMapChunksAroundWorldPosition,
    getBlockAtWorld,
    getBlackBackgroundBlocks,
    getMapBlocksNearWorldPoint,
    getMapBlocksBehindAstronaut,
    getMapBlocksMaskAstronaut,
    getMushroomBlocks,
    getRenderableMapBlocks,
    getChunkedWorldOverview,
    rebuildMapBlockRenderCache,
    materializeAllMapChunksForSave,
    prefetchMapChunksAroundWorldPosition,
    syncMapChunksForViewport
} from '../world/map.js';
import { initStars, updateAndDrawStars } from '../world/stars.js';
import { emitJetpackDots, updateAndDrawJetpackDots, resetJetpackDotEmitTimer, hasActiveJetpackDots } from '../physics/jetpack.js';
import { Button } from '../entities/button.js';
import {
    getDefaultDestructibleEnabled,
    getDefaultDestructibleHealth,
    getDefaultDestructionSource
} from '../entities/destructibles.js';
import { Door } from '../entities/door.js';
import { Creature, getCreatureAuthoredType } from '../entities/creature.js';
import { Collectable, getDefaultGrenadeExplosionPower } from '../entities/collectable.js';
import { makeBlackTransparent, remapSpritePalette, calculateSpriteCollisionBoundingBoxes, 
calculateAstronautSpriteBoundingBoxes, getSolidBlockAtWorld, getAnyBlockAtWorld, 
drawEntities, getSpriteTranslationOffset, getSpriteVisibleBounds, getTransformedSpriteCanvas,
getVisibleCenterRotationOffset, getRenderedEntitySpriteCanvas, normalizeSpriteTranslation, SpriteTranslation
} from '../shared/utilities.js';
import {
    CHUNK_ACTIVITY_SETTINGS,
    BULLET_IMPACT_AUDIO_SETTINGS,
    type BulletImpactAudioSettings,
    CREATURE_PROJECTILE_SETTINGS,
    MOVEMENT_SETTINGS,
    VIEWPORT_SETTINGS
} from '../config/settings.js';
import { ChunkActivityManager } from '../world/chunk-activity-manager.js';
import {
    SPRITE_ROW, SPRITE_COL_STAND, SPRITE_COL_FLY_RIGHT, SPRITE_COL_FLY_DIAGONAL,
    SPRITE_COL_FLY_FLOAT, SPRITE_COL_FLY_DOWN, SPRITE_COL_WALK_START, SPRITE_COL_WALK_RIGHT1,
    SPRITE_COL_WALK_RIGHT2, SPRITE_COL_WALK_END, TELEPORT_ANIM_FRAMES, MAP_WIDTH, MAP_HEIGHT,
    SPRITE_SCALE, rememberSound, teleportSound, buttonOnSound, doorOpenSound, doorCloseSound, getSound, saveSound, bulletExplosionSound, bulletExplosion2Sound, grenadeArmedSound, plasmaGrenadeImpactSound, mushroomsSound, ouchSounds, creatureManifestSounds,
    setMapBounds,
    getSoundEnabled, setSoundEnabled, toggleSoundEnabled
} from '../config/constants.js';
import {
    createWorldDesigner,
    PaletteDefinition,
    SpriteCatalogEntry,
    WorldDesigner
} from '../designer/world-designer.js';
import {
    blockBrowserShortcut,
    getInputKey,
    shouldPreventGameplayDefault
} from './input/game-input.js';
import { createGameFrameScheduler } from './runtime/game-frame-scheduler.js';
import { createGamePerformanceTracker } from './runtime/game-performance-tracker.js';
import {
    type TeleporterRuntime,
    normalizeTeleporter,
    buildTeleportersFromMapMetadata,
    reconcileTeleporterRuntimePositions,
    applyButtonTeleporterLinks
} from './teleporter/game-teleporter-runtime.js';
import { createTeleporterPadRuntime } from './teleporter/game-teleporter-pad-runtime.js';
import {
    type WindEmitterRuntime,
    type WindRuntimeToggles,
    normalizeWindEmitter,
    normalizeWindSettings,
    setWindDebugToggle,
    getEffectiveWindToggles,
    toWindEmitterFromBlock,
    resolveEmitterMagnitude,
    computeEmitterWindAccelerationAtPoint,
    getSurfaceWindEdgeProximity,
    getSurfaceWindBoundaryOvershoot,
    applySurfaceWindField
} from './wind/game-wind-runtime.js';
import { createGameAudioRuntime } from './audio/game-audio-runtime.js';
import { createAstronautRenderer } from './render/astronaut-render.js';
import { createCreatureOverlayRenderer } from './render/creature-overlay-render.js';
import { createCustomPalettePreviewRenderer } from './render/palette/custom-palette-preview.js';
import { createWorldBoundingBoxOverlayDrawer } from './render/game-world-bounding-box-overlay.js';
import { createGameSpriteSheetRuntime } from './render/spritesheet/game-sprite-sheet-runtime.js';
import { createGameSpritePreviewRuntime } from './render/spritesheet/game-sprite-preview-runtime.js';
import { normalizeBulletImpactAudioSettings } from './effects/game-bullet-impact-audio-settings.js';
import { createGameDestructibleRuntimeHelpers } from './effects/game-destructible-runtime-helpers.js';
import {
    type CreatureProjectileCollectable,
    isCreatureProjectileCollectable,
    isCollectableCollected as isCollectableCollectedRuntime,
    markCollectableCollected as markCollectableCollectedRuntime,
    syncGrenadeFuseState,
    setGrenadeCollectableArmedState,
    isGrenadeCollectable,
    getGrenadeExplosionRadius,
    getGrenadeExplosionPower,
    getExplosionDamageSource,
    isRadioactiveBoulderCollectable,
    getCreatureProjectileCollectables as getCreatureProjectileCollectablesRuntime,
    getRenderableCollectables as getRenderableCollectablesRuntime,
    getDesignerRenderableCollectables as getDesignerRenderableCollectablesRuntime,
    getSavableCollectables as getSavableCollectablesRuntime
} from './collectables/game-collectable-runtime.js';
import { convertProjectileToEnergyPodCollectable } from './projectiles/game-energy-pod-conversion.js';
import { getProjectileKindForFireMode } from './projectiles/game-projectile-kind.js';
import {
    deepClone,
    fetchFreshJson,
    mapPaletteDefinitions,
    resolveColorAlias
} from './palette/game-palette-utils.js';
import {
    createEnvironmentCollisionHelpers,
} from './collision/game-environment-collision.js';
import { createGameDesignerSaveApi } from './designer/game-designer-save-api.js';
import { createAstronautFlightHelpers } from './astronaut/game-astronaut-flight-helpers.js';
import {
    createAstronautTeleportSurvivalHelpers,
    type TeleportLocation
} from './astronaut/game-astronaut-teleport-survival.js';
import { createAstronautControlRuntime } from './astronaut/game-astronaut-control-runtime.js';
import {
    createCurrentAstronautCollisionProfileGetter,
    createFlyAnimationStateHelpers
} from './astronaut/game-main-astronaut-state-helpers.js';
import {
    getEntityCenter,
    getEntityPositionFromCenter,
    getEntityRect
} from './geometry/game-entity-geometry.js';
import { createGameEntityRenderHelpers } from './geometry/game-entity-render-helpers.js';
import { attachGameWindowInput } from './input/game-window-input.js';
import { attachGameDebugRuntimeShortcuts } from './input/game-debug-runtime-shortcuts.js';
import { runGameLoopRuntime } from './runtime/game-loop-runtime.js';
import { buildGameLoopRuntimeContext } from './runtime/game-main-runtime-builders.js';
import { assignEntityId } from './runtime/game-entity-id.js';
import { createGameMainCameraViewportHelpers } from './runtime/game-main-camera-viewport.js';
import { shouldRunGameInteractiveFrameRate } from './runtime/game-main-frame-rate.js';
import {
    type ThrowGuideDot,
    type ProjectileImpactEffect,
    type DoorDestructionEffect,
    type BulletImpactParticle,
    type WindParticle,
    type DestructibleRuntimeEntity
} from './runtime/game-main-effect-types.js';
import { createGameMainInitFromContext } from './runtime/game-main-init-builder.js';
import {
    createGameMainLoopRuntimeValuesProviderFromContext,
} from './runtime/game-main-loop-runtime-builder.js';
import { createGameMainRuntimeBootstrapFromContext } from './runtime/game-main-runtime-bootstrap-builder.js';
import {
    createSharedRuntimeContextFromState,
    createExtraRuntimeContextFromState,
    mergeRuntimeContexts,
    createLoopStateAccessorsFromState
} from './runtime/game-main-runtime-context-builder.js';
import { createSpawnCreatureCarryProxy } from './runtime/game-creature-carry-proxy.js';
import { createGameWindHelpers } from './wind/game-wind-helpers.js';
import { createGameDestructionEffects } from './effects/game-destruction-effects.js';
import { createGameCombatHelpers } from './combat/game-combat-helpers.js';
import { createAstronautImpactHelpers } from './combat/game-astronaut-impact-helpers.js';
import { createGameCreatureRenderTargetHelpers } from './creatures/game-creature-render-target-helpers.js';
import { createGameCollectableRemovalHelpers } from './collectables/game-collectable-removal-helpers.js';
import { createGameCreatureTargetingHelpers } from './creatures/game-creature-targeting-helpers.js';
import { createProjectileImpactRuntime } from './projectiles/game-projectile-impact-runtime.js';
import { createCollectablePhysicsRuntime } from './projectiles/game-collectable-physics-settings.js';
import {
    createChunkActivityTuningController
} from './chunk-activity/chunk-activity-tuning.js';
import { createChunkActivityHelpers } from './chunk-activity/game-chunk-activity-helpers.js';
import { createTeleporterPadHelpers } from './teleporter/game-teleporter-pad-helpers.js';
import { createGameMainPaletteRuntime } from './palette/game-main-palette-runtime.js';
import { createGameMainWorldLoaders } from './runtime/game-main-world-loaders.js';
import { createGameMainQueryHelpers } from './runtime/game-main-query-helpers.js';
import { createGameMainWorldBootstrapFromContext } from './runtime/game-main-world-bootstrap-builder.js';
import {
    attachBlackBackgroundWindowShortcuts,
    attachGlobalWindowShortcuts,
    exposeGameMainDebugRuntime
} from './runtime/game-main-window-runtime.js';

// Instead of dynamic import, fetch the JSON file at runtime for browser compatibility
let spriteMap: any;
let spriteSheetSetCount = 0;
let lastSetSpriteSheetWidth = 0;
let lastSetSpriteSheetDefined = false;

async function loadSpriteMap() {
    const res = await fetch('./src/assets/data/exile_sprites_map.json');
    spriteMap = await res.json();
    return spriteMap;
}

let rawPaletteDefinitions: PaletteDefinition[] = [];
let palettes: Array<{ from: [number, number, number], to: [number, number, number] }[]> = [];
let remappedSpriteSheets: CanvasImageSource[] = [];
let colorAliases: Record<string, [number, number, number]> = {};
const spriteSheetRuntime = createGameSpriteSheetRuntime({
    getSpriteMap: () => spriteMap,
    getRemappedSpriteSheets: () => remappedSpriteSheets
});
const spritePreviewRuntime = createGameSpritePreviewRuntime({
    findSpriteRectByType: spriteSheetRuntime.findSpriteRectByType,
    getPaletteSheet: spriteSheetRuntime.getPaletteSheet,
    getRemappedSpriteSheets: () => remappedSpriteSheets,
    getTransformedSpriteCanvas,
    getSpriteTranslationOffset
});
const WORLD_BOUNDS_PADDING = Math.ceil(32 * SPRITE_SCALE * 2);
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
const gameAudio = createGameAudioRuntime({
    getSoundEnabled,
    creatureManifestSounds,
    ouchSounds,
    plasmaGrenadeImpactSound,
    grenadeArmedSound,
    bulletExplosionSound,
    bulletExplosion2Sound,
    mushroomsSound
});

const {
    getCreatureProjectilePhysicsSettings,
    getCollectablePhysicsSettings
} = createCollectablePhysicsRuntime({
    movementSettings: MOVEMENT_SETTINGS,
    getProjectileSettings: (kind) => getProjectileSettings(kind)
});

let customPalettePreviewRenderer: ReturnType<typeof createCustomPalettePreviewRenderer>;
const {
    resolveColor,
    loadPalettes,
    rebuildRemappedSpriteSheets,
    applyPaletteDefinitions
} = createGameMainPaletteRuntime({
    fetchFreshJson,
    deepClone,
    mapPaletteDefinitions,
    resolveColorAlias,
    remapSpritePalette,
    clearMapSpriteCache,
    clearPalettePreviewCache: () => customPalettePreviewRenderer.clearCache(),
    getColorAliases: () => colorAliases,
    setColorAliases: (value) => { colorAliases = value; },
    getRawPaletteDefinitions: () => rawPaletteDefinitions,
    setRawPaletteDefinitions: (value) => { rawPaletteDefinitions = value; },
    getPalettes: () => palettes,
    setPalettes: (value) => { palettes = value; },
    getSpriteSheet: () => spriteSheet,
    getRemappedSpriteSheets: () => remappedSpriteSheets,
    setRemappedSpriteSheets: (value) => { remappedSpriteSheets = value; },
    setAstronautSpriteSource: (value) => { astronautSpriteSource = value; }
});

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

let isGameLoopRunning = false;
const PERF_WINDOW_SIZE = 180;
const PERF_CONSOLE_SUMMARY_INTERVAL_MS = 5000;
const performanceTracker = createGamePerformanceTracker({
    windowSize: PERF_WINDOW_SIZE,
    consoleSummaryIntervalMs: PERF_CONSOLE_SUMMARY_INTERVAL_MS
});

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
// --- Mouse tracking for debug ---
let mouseScreen = { x: 0, y: 0 };
let mouseWorld = { x: 0, y: 0 };

function shouldRunInteractiveFrameRate() {
    return shouldRunGameInteractiveFrameRate({
        isDesignerOpen,
        hasActiveJetpackDots,
        keys,
        isTeleporting: () => teleporting,
        isFlySwitching: () => flySwitching,
        isFlyDownTransitioning: () => flyDownTransitioning,
        getThrowGuideDotCount: () => throwGuideDots.length,
        getDoorEntities: () => doorEntities,
        getCreatureEntities: () => creatureEntities,
        getCollectableEntities: () => collectableEntities,
        isCreatureProjectileCollectable,
        astronaut,
        getWalkSpeed: () => walkSpeed,
        activeMotionEpsilon: ACTIVE_MOTION_EPSILON
    });
}

const { requestImmediateFrame, scheduleNextFrame } = createGameFrameScheduler({
    idleFrameDelayMs: IDLE_FRAME_DELAY_MS,
    hiddenFrameDelayMs: HIDDEN_FRAME_DELAY_MS,
    shouldRunInteractiveFrameRate,
    canRunFrames: () => Boolean(gameState.isRunning && mapLoaded),
    runFrame: () => {
        void gameLoop();
    }
});

attachGameWindowInput({
    blockBrowserShortcut,
    shouldPreventGameplayDefault,
    getInputKey,
    isDesignerOpen,
    requestImmediateFrame,
    onInputKeyChanged: (key, pressed) => {
        keys[key] = pressed;
    },
    onMouseMoved: (x, y) => {
        mouseScreen.x = x;
        mouseScreen.y = y;
    },
    getCanvas: () => canvas,
    isDebugModeEnabled: () => gameState.debugMode,
    onTabPressed: () => {
        if (pronePoseActive) {
            layDownVerticalFlipToggled = !layDownVerticalFlipToggled;
        } else {
            flipAstronaut();
            layDownVerticalFlipToggled = false;
        }
    }
});

const {
    resetFlySwitchAnimationState,
    resetFlyDownAnimationState,
    rememberLastFlyPose
} = createFlyAnimationStateHelpers({
    setFlySwitching: (value) => { flySwitching = value; },
    setFlySwitchStep: (value) => { flySwitchStep = value; },
    setFlySwitchTimer: (value) => { flySwitchTimer = value; },
    setFlyDownTransitioning: (value) => { flyDownTransitioning = value; },
    setFlyDownTransitionStep: (value) => { flyDownTransitionStep = value; },
    setFlyDownTransitionTimer: (value) => { flyDownTransitionTimer = value; },
    setFlyDownTravelDir: (value) => { flyDownTravelDir = value; },
    setFlyDownMode: (value) => { flyDownMode = value; },
    setLastFlySpriteCol: (value) => { lastFlySpriteCol = value; },
    setLastFlyFlipSprite: (value) => { lastFlyFlipSprite = value; }
});

const {
    getDirectDownTransitionSequence,
    getHorizontalTravelDirection,
    getAstronautFacingDirectionForFlyPose
} = createAstronautFlightHelpers({
    getLastFlySpriteCol: () => lastFlySpriteCol,
    getLastFlyFlipSprite: () => lastFlyFlipSprite,
    getAstronautVelocityX: () => astronaut.velocity.x,
    getFacingLeft: () => facingLeft,
    getLeftPressed: () => leftPressed,
    getRightPressed: () => rightPressed,
    spriteCols: {
        stand: SPRITE_COL_STAND,
        flyRight: SPRITE_COL_FLY_RIGHT,
        flyDiagonal: SPRITE_COL_FLY_DIAGONAL,
        flyDown: SPRITE_COL_FLY_DOWN,
        flyFloat: SPRITE_COL_FLY_FLOAT
    }
});

// --- Black background block toggles ---
let showBlackBackgroundBlocks = false; // c key
let hideBlackBackgroundBlocks = false; // v key

// --- Entity arrays ---
let buttonEntities: Button[] = [];
let doorEntities: Door[] = [];
let creatureEntities: Creature[] = [];
let collectableEntities: Collectable[] = [];
let teleporterEntities: TeleporterRuntime[] = [];
let windEmitters: WindEmitterRuntime[] = [];
let windSettings: WindGlobalSettings = {};
let cachedWindEmittersForFrame: WindEmitterRuntime[] = [];
let cachedWindEmittersFrameKey = -1;
let cachedNearbyBlockWindEmitters: WindEmitterRuntime[] = [];
let cachedNearbyBlockWindSample = { x: Number.NaN, y: Number.NaN, timeMs: Number.NEGATIVE_INFINITY };
let teleporterTouchCooldownUntilMs = 0;
let heldCollectable: Collectable | null = null;
let storedCollectables: Collectable[] = [];
let collectedCollectableEntityIds = new Set<number>();
let inventoryCycleIndex = -1;
let windDebugToggles: Partial<WindRuntimeToggles> = {};
let throwAngleDegrees = 20;
let throwGuideDots: ThrowGuideDot[] = [];
let throwGuideDotEmitTimer = 0;
let projectileImpactEffects: ProjectileImpactEffect[] = [];
let doorDestructionEffects: DoorDestructionEffect[] = [];
let bulletImpactParticles: BulletImpactParticle[] = [];
let windParticles: WindParticle[] = [];
let destructibleDamageByEntity = new WeakMap<object, number>();
let bulletImpactAudioSettings: BulletImpactAudioSettings = { ...BULLET_IMPACT_AUDIO_SETTINGS };
let worldDesigner: WorldDesigner | null = null;
let saveSnapshotInProgress = false;
const STARFIELD_HEIGHT = Math.min(MAP_HEIGHT, 2000);
const BULLET_IMPACT_PARTICLE_COLORS = ['#ffffff', '#ffff00', '#ff00ff', '#00ffff', '#0000ff', '#ff0000'];
const BULLET_DAZE_DURATION_MS = 380;
const BULLET_DAZE_WALK_SCALE = 0.45;
const BULLET_DAZE_FLIGHT_SCALE = 0.35;
const WIND_BLOCK_SAMPLE_INTERVAL_MS = 120;
const WIND_BLOCK_SAMPLE_DISTANCE_PX = 96;
const TELEPORTER_TILE_SIZE = 32 * SPRITE_SCALE;
function canUseKeyLockedTeleporter(_teleporter: TeleporterRuntime) {
    // Hook for future RCD+key progression checks.
    return false;
}
let currentAstronautRenderState = {
    spriteCol: SPRITE_COL_STAND,
    flipSprite: false,
    flipVertical: false
};
let lastAstronautWindAcceleration = { x: 0, y: 0, activeEmitterCount: 0 };
const teleporterPadRuntime = createTeleporterPadRuntime({
    spriteScale: SPRITE_SCALE,
    getMapBlocks: () => mapBlocks,
    getTeleporters: () => teleporterEntities,
    getCanvasSize: () => ({ width: canvas.width, height: canvas.height }),
    getRenderedEntityWorldSprite: (entity) => getRenderedEntityWorldSprite(entity),
    normalizeSpriteTranslation,
    getSpriteVisibleBounds,
    drawEntities: (context, camera, entities, now) => {
        drawEntities(
            context,
            camera,
            spriteMap,
            remappedSpriteSheets,
            SPRITE_SCALE,
            entities,
            now
        );
    },
    canUseKeyLockedTeleporter
});
let layDownVerticalFlipToggled = false;
let pronePoseActive = false;
let proneForcedByGeometry = false;
let activeAstronautCollisionProfile = 'stand';
const astronautRenderer = createAstronautRenderer({
    spriteScale: SPRITE_SCALE,
    spriteRow: SPRITE_ROW,
    damageFlashMinIntervalMs: MOVEMENT_SETTINGS.astronautDamageFlashMinIntervalMs,
    damageFlashMaxIntervalMs: MOVEMENT_SETTINGS.astronautDamageFlashMaxIntervalMs,
    getAstronaut: () => astronaut,
    getSpriteSheet: () => spriteSheet,
    getAstronautSpriteSource: () => astronautSpriteSource,
    getSpriteRectFromMap: spriteSheetRuntime.getSpriteRectFromMap,
    getPronePoseActive: () => pronePoseActive,
    getActiveCollisionProfile: () => activeAstronautCollisionProfile,
    getAstronautCollisionOffsets,
    getSpriteVisibleBounds,
    getRenderedEntitySpriteCanvas
});
const chunkActivityManager = new ChunkActivityManager({
    chunkWorldSize: CHUNK_ACTIVITY_SETTINGS.chunkWorldSize,
    radiiChunks: deepClone(CHUNK_ACTIVITY_SETTINGS.radiiChunks),
    viewportRadiusScale: deepClone(CHUNK_ACTIVITY_SETTINGS.viewportRadiusScale),
    teleportKeepAliveMs: CHUNK_ACTIVITY_SETTINGS.teleportKeepAliveMs
});
const {
    updateAstronautStartPosition,
    popLatestTeleportLocation,
    startTeleportToLocation,
    updateAstronautEnergyRecovery,
    triggerAstronautEmergencyTeleport,
    applyAstronautDamage,
    computeLandingImpactDamage
} = createAstronautTeleportSurvivalHelpers({
    setAstronautStartPosition,
    getDefaultTeleportLocation: () => defaultTeleportLocation,
    setDefaultTeleportLocation: (location) => { defaultTeleportLocation = location; },
    getTeleportLocations: () => teleportLocations,
    getTeleportSlot: () => teleportSlot,
    setTeleportSlot: (slot) => { teleportSlot = slot; },
    getTeleporting: () => teleporting,
    prefetchMapChunksAroundWorldPosition,
    chunkActivityManager,
    getAstronautPosition: () => astronaut.position,
    now: () => performance.now(),
    setTeleporting: (value) => { teleporting = value; },
    setTeleportPhase: (value) => { teleportPhase = value; },
    setTeleportAnimFrame: (value) => { teleportAnimFrame = value; },
    setTeleportTarget: (target) => { teleportTarget = target; },
    getCurrentAstronautRenderState: () => currentAstronautRenderState,
    setTeleportSpriteCol: (value) => { teleportSpriteCol = value; },
    setTeleportFlipSprite: (value) => { teleportFlipSprite = value; },
    setTeleportFlipVertical: (value) => { teleportFlipVertical = value; },
    teleportSound,
    requestImmediateFrame,
    getAstronaut: () => astronaut,
    movementSettings: MOVEMENT_SETTINGS,
    releaseHeldCollectable: () => releaseHeldCollectable()
});
let currentAstronautChunkActivity: ChunkActivityBand = 'near';
type ChunkSimulationCadencePolicy = Record<ChunkActivityBand, number>;
const {
    creatureChunkCadence: CREATURE_CHUNK_CADENCE,
    collectableChunkCadence: COLLECTABLE_CHUNK_CADENCE,
    projectileChunkCadence: PROJECTILE_CHUNK_CADENCE,
    teleporterChunkCadence: TELEPORTER_CHUNK_CADENCE,
    applyChunkActivityTuning,
    resetChunkActivityTuning,
    getChunkActivityTuningSnapshot
} = createChunkActivityTuningController({
    manager: chunkActivityManager,
    deepClone,
    defaults: {
        radiiChunks: deepClone(CHUNK_ACTIVITY_SETTINGS.radiiChunks),
        viewportRadiusScale: deepClone(CHUNK_ACTIVITY_SETTINGS.viewportRadiusScale),
        teleportKeepAliveMs: CHUNK_ACTIVITY_SETTINGS.teleportKeepAliveMs,
        simulationCadenceFrames: {
            creatures: deepClone(CHUNK_ACTIVITY_SETTINGS.simulationCadenceFrames.creatures),
            collectables: deepClone(CHUNK_ACTIVITY_SETTINGS.simulationCadenceFrames.collectables),
            projectiles: deepClone(CHUNK_ACTIVITY_SETTINGS.simulationCadenceFrames.projectiles),
            teleporters: deepClone(CHUNK_ACTIVITY_SETTINGS.simulationCadenceFrames.teleporters)
        }
    }
});
const { getCameraOffset, getEffectiveViewportState } = createGameMainCameraViewportHelpers({
    getWorldDesigner: () => worldDesigner,
    getAstronautPosition: () => astronaut.position,
    getCanvasSize: () => ({ width: canvas.width, height: canvas.height }),
    chunkWorldSize: CHUNK_ACTIVITY_SETTINGS.chunkWorldSize,
    effectiveViewport: CHUNK_ACTIVITY_SETTINGS.effectiveViewport,
    chunkResidency: CHUNK_ACTIVITY_SETTINGS.chunkResidency
});
let simulationFrameCounter = 0;
const CHUNK_SYNC_INTERVAL_FRAMES = 2;
let chunkSyncFrameCounter = 0;
const windowRuntimeOptions = {
    isDesignerOpen,
    getPrevKeys: () => prevKeys,
    getShowBlackBackgroundBlocks: () => showBlackBackgroundBlocks,
    setShowBlackBackgroundBlocks: (value: boolean) => { showBlackBackgroundBlocks = value; },
    getHideBlackBackgroundBlocks: () => hideBlackBackgroundBlocks,
    setHideBlackBackgroundBlocks: (value: boolean) => { hideBlackBackgroundBlocks = value; },
    getButtons: () => buttonEntities,
    getWorldDesigner: () => worldDesigner,
    getChunkActivityTuningSnapshot: () => getChunkActivityTuningSnapshot(),
    applyChunkActivityTuning,
    resetChunkActivityTuning,
    toggleSoundEnabled,
    forceRebuildSpriteSheets: () => {
        try {
            rebuildRemappedSpriteSheets();
            return { ok: true, count: remappedSpriteSheets.length };
        } catch (error) {
            return {
                ok: false,
                count: remappedSpriteSheets.length,
                error: error instanceof Error ? error.message : String(error)
            };
        }
    },
    getRuntimeSnapshot: () => ({
        spriteSheetSetCount,
        lastSetSpriteSheetWidth,
        lastSetSpriteSheetDefined,
        missingMapSpriteTypes: (() => {
            if (!spriteMap) {
                return [];
            }
            const knownTypes = new Set<string>();
            if (Array.isArray(spriteMap)) {
                for (const row of spriteMap) {
                    for (const entry of row ?? []) {
                        if (entry?.name) {
                            knownTypes.add(entry.name);
                        }
                    }
                }
            } else {
                for (const key of Object.keys(spriteMap)) {
                    knownTypes.add(key);
                }
            }
            const missing = new Set<string>();
            for (const block of mapBlocks) {
                if (block?.type && !knownTypes.has(block.type)) {
                    missing.add(block.type);
                }
            }
            return [...missing].slice(0, 20);
        })(),
        sampleMapTypes: mapBlocks.slice(0, 20).map((block) => block?.type ?? ''),
        mapBlocksCount: mapBlocks.length,
        chunkedWorldMapEnabled: !!getChunkedWorldOverview(),
        mapLoaded,
        spriteMapLoaded: !!spriteMap,
        runtimeSpriteSheetLoaded: !!spriteSheet,
        runtimeSpriteSheetComplete: !!spriteSheet?.complete,
        spriteTypeCount: spriteSheetRuntime.getSpriteTypes().length,
        rawPaletteDefinitionCount: rawPaletteDefinitions.length,
        paletteCount: palettes.length,
        remappedSpriteSheetCount: remappedSpriteSheets.length,
        worldDesignerExists: !!worldDesigner,
        worldDesignerActive: worldDesigner?.isActive() === true,
        mapWidth: MAP_WIDTH,
        mapHeight: MAP_HEIGHT,
        astronautPosition: {
            x: astronaut.position.x,
            y: astronaut.position.y
        },
        astronautVelocity: {
            x: astronaut.velocity.x,
            y: astronaut.velocity.y
        },
        astronautIsLanded: astronaut.isLanded,
        walkAnimFrame,
        walkAnimTimer,
        designerCamera: worldDesigner?.getCamera() ?? null
    })
};
attachBlackBackgroundWindowShortcuts(windowRuntimeOptions);
exposeGameMainDebugRuntime(windowRuntimeOptions);

function isDesignerOpen() {
    return !!worldDesigner?.isActive();
}

attachGlobalWindowShortcuts(windowRuntimeOptions);

const getCurrentAstronautCollisionProfile = createCurrentAstronautCollisionProfileGetter({
    getLayDownVerticalFlipToggled: () => layDownVerticalFlipToggled,
    getShiftPressed: () => !!keys['Shift'],
    isAstronautLanded: () => astronaut.isLanded,
    getProneForcedByGeometry: () => proneForcedByGeometry,
    getDownPressed: () => downPressed,
    getQPressed: () => !!keys['q'],
    getWPressed: () => !!keys['w'],
    getLeftPressed: () => leftPressed,
    getRightPressed: () => rightPressed,
    getUpPressed: () => upPressed,
    getAstronautVelocityX: () => astronaut.velocity.x
});

// --- Button press debounce state ---
const buttonPressTimestamps: WeakMap<Button, number> = new WeakMap();

// --- Entity loaders ---

const { loadTeleporters, loadWindData } = createGameMainWorldLoaders({
    fetchFreshJson,
    normalizeTeleporter,
    buildTeleportersFromMapMetadata,
    reconcileTeleporterRuntimePositions,
    normalizeWindEmitter,
    normalizeWindSettings,
    getMapBlocks: () => mapBlocks,
    getAstronautStartPosition,
    setTeleporterEntities: (value) => { teleporterEntities = value; },
    setWindEmitters: (value) => { windEmitters = value; },
    setWindSettings: (value) => { windSettings = value as WindGlobalSettings; },
    resetWindCaches: () => {
        cachedWindEmittersFrameKey = -1;
        cachedWindEmittersForFrame = [];
        cachedNearbyBlockWindEmitters = [];
        cachedNearbyBlockWindSample = { x: Number.NaN, y: Number.NaN, timeMs: Number.NEGATIVE_INFINITY };
    },
    invalidateTeleporterPadCaches: () => invalidateTeleporterPadCaches()
});

const {
    loadButtons,
    syncButtonStatesToDoors,
    loadDoors,
    loadCreatures,
    loadCollectables,
    loadAstronautStartPosition,
    syncCollectableRuntimeState,
    isCollectableCollected,
    markCollectableCollected,
    getCreatureProjectileCollectables,
    getRenderableCollectables,
    getDesignerRenderableCollectables,
    getSavableCollectables,
    rebuildBlockInstanceBoundingBoxes,
    syncRuntimeMapBounds,
    ensureWorldBounds,
    afterWorldDataMutated,
    clampCamera: clampCameraRuntime,
    getRawWorldData,
    getRawWorldDataForSave,
    replaceRawWorldData
} = createGameMainWorldBootstrapFromContext({
    fetchFreshJson,
    assignEntityId,
    createButton: (value: any) => new Button(value),
    createDoor: (value: any) => new Door(value),
    createCreature: (value: any) => new Creature(value),
    createCollectable: (value: any) => new Collectable(value),
    getEntityLists: () => ({
        buttons: buttonEntities,
        doors: doorEntities,
        creatures: creatureEntities,
        collectables: collectableEntities,
        mapBlocks
    }),
    setButtons: (value: any) => { buttonEntities = value; },
    setDoors: (value: any) => { doorEntities = value; },
    setCreatures: (value: any) => { creatureEntities = value; },
    setCollectables: (value: any) => { collectableEntities = value; },
    getCollectedCollectableEntityIds: () => collectedCollectableEntityIds,
    setCollectedCollectableEntityIds: (value: any) => { collectedCollectableEntityIds = value; },
    getStoredCollectables: () => storedCollectables,
    setStoredCollectables: (value: any) => { storedCollectables = value; },
    getHeldCollectable: () => heldCollectable,
    setHeldCollectable: (value: any) => { heldCollectable = value; },
    setInventoryCycleIndex: (value: any) => { inventoryCycleIndex = value; },
    syncGrenadeFuseState,
    isCollectableCollectedRuntime,
    markCollectableCollectedRuntime,
    getCreatureProjectileCollectablesRuntime,
    getRenderableCollectablesRuntime,
    getDesignerRenderableCollectablesRuntime,
    getSavableCollectablesRuntime,
    getWorldDesigner: () => worldDesigner,
    getWorldMapRotatedBoundingBoxes: () => worldMapRotatedBoundingBoxes,
    getWorldMapBoundingBoxes: () => worldMapBoundingBoxes,
    setBlockInstanceRotatedBoundingBoxes: (value: any) => { blockInstanceRotatedBoundingBoxes = value; },
    getBlockInstanceRotatedBoundingBoxes: () => blockInstanceRotatedBoundingBoxes,
    findSpriteRectByType: (type: any) => spriteSheetRuntime.findSpriteRectByType(type),
    getAstronautStartPosition,
    getMapWidth: () => MAP_WIDTH,
    getMapHeight: () => MAP_HEIGHT,
    spriteScale: SPRITE_SCALE,
    worldBoundsPadding: WORLD_BOUNDS_PADDING,
    setMapBounds,
    rebuildMapBlockRenderCache,
    initStars,
    invalidateTeleporterPadCaches: () => teleporterPadRuntime.invalidateCaches(),
    getCachedWindReset: () => ({
        setCachedWindEmittersFrameKey: (value: any) => { cachedWindEmittersFrameKey = value; },
        setCachedWindEmittersForFrame: (value: any) => { cachedWindEmittersForFrame = value; },
        setCachedNearbyBlockWindEmitters: (value: any) => { cachedNearbyBlockWindEmitters = value; },
        setCachedNearbyBlockWindSample: (value: any) => { cachedNearbyBlockWindSample = value; }
    }),
    getMapBlocks: () => mapBlocks,
    getButtonEntities: () => buttonEntities,
    setButtonEntities: (value: any) => { buttonEntities = value; },
    getDoorEntities: () => doorEntities,
    setDoorEntities: (value: any) => { doorEntities = value; },
    getCreatureEntities: () => creatureEntities,
    setCreatureEntities: (value: any) => { creatureEntities = value; },
    getCollectableEntities: () => collectableEntities,
    setCollectableEntities: (value: any) => { collectableEntities = value; },
    getTeleporterEntities: () => teleporterEntities,
    setTeleporterEntities: (value: any) => { teleporterEntities = value; },
    getWindEmitters: () => windEmitters,
    setWindEmitters: (value: any) => { windEmitters = value; },
    getWindSettings: () => windSettings,
    setWindSettings: (value: any) => { windSettings = value; },
    normalizeTeleporter,
    buildTeleportersFromMapMetadata,
    normalizeWindEmitter,
    normalizeWindSettings,
    reconcileTeleporterRuntimePositions,
    clearCollectedCollectableEntityIds: () => { collectedCollectableEntityIds.clear(); },
    materializeAllMapChunksForSave,
    setSaveSnapshotInProgress: (value: any) => { saveSnapshotInProgress = value; },
    updateAstronautStartPosition
});

const clampCamera = (camera: Position) => clampCameraRuntime(camera, { width: canvas.width, height: canvas.height });


const drawWorldBoundingBoxOverlayRuntime = createWorldBoundingBoxOverlayDrawer({
    getEntityCollisionBounds: (entity) => getEntityCollisionBounds(entity),
    getMapBlocks: () => mapBlocks,
    getDoorEntities: () => doorEntities,
    getButtonEntities: () => buttonEntities,
    getCreatureEntities: () => creatureEntities,
    getCreatureProjectileCollectables,
    getDesignerRenderableCollectables,
    getRenderableCollectables,
    getWorldDesigner: () => worldDesigner,
    getHideBlackBackgroundBlocks: () => hideBlackBackgroundBlocks
});

const {
    findSpriteRectByType,
    getPaletteSheet,
    getEntityPreviewSheet,
    drawWorldBoundingBoxOverlay,
    getChunkActivityForWorldPosition,
    getAstronautAimPoint,
    clampToRange
} = createGameMainQueryHelpers({
    findSpriteRectByType: spriteSheetRuntime.findSpriteRectByType,
    getPaletteSheet: spriteSheetRuntime.getPaletteSheet,
    getEntityPreviewSheet: spriteSheetRuntime.getEntityPreviewSheet,
    drawWorldBoundingBoxOverlayRuntime,
    getChunkActivityForWorldPosition: (position, now) => chunkActivityManager.getChunkActivityForWorldPosition(position, now),
    getAstronautRenderedWorldSprite: () => astronautRenderer.getAstronautRenderedWorldSprite(currentAstronautRenderState),
    getRenderedSpriteWorldCenter: (renderedSprite) => getRenderedSpriteWorldCenter(renderedSprite),
    getAstronautRect: () => getAstronautRect()
});
const getAstronautRenderedWorldSprite = () => astronautRenderer.getAstronautRenderedWorldSprite(currentAstronautRenderState);

const getSpriteTypes = () => spriteSheetRuntime.getSpriteTypes();
const getSpriteCatalog = (): SpriteCatalogEntry[] => spriteSheetRuntime.getSpriteCatalog();
const drawSpritePreview = spritePreviewRuntime.drawSpritePreview;
const drawSpriteSample = spritePreviewRuntime.drawSpriteSample;
const drawSpritePreviewWithSheet = spritePreviewRuntime.drawSpritePreviewWithSheet;

customPalettePreviewRenderer = createCustomPalettePreviewRenderer({
    getSpriteSheet: () => spriteSheet,
    resolveColor,
    remapSpritePalette,
    drawSpritePreviewWithSheet
});

const drawCustomPalettePreview = customPalettePreviewRenderer.drawCustomPalettePreview;

const {
    saveWorldData,
    savePaletteDefinitions,
    previewSpriteSheetNormalization,
    normalizeSpriteSheetColors
} = createGameDesignerSaveApi({
    applyPaletteDefinitions
});

let getLoopRuntimeValues: () => Record<string, any>;
let loopStateAccessors: Record<string, any>;

async function gameLoop() {
    await runGameLoopRuntime(buildGameLoopRuntimeContext(getLoopRuntimeValues(), loopStateAccessors));
}

type BoundingBox = { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number };
type BoundingBoxMap = Record<string, BoundingBox>;

// --- Bounding boxes for astronaut sprites (populated after calculation) ---
let astronautBoundingBoxes: BoundingBoxMap = {};
// --- Bounding boxes for world map sprites (populated after calculation) ---
let worldMapBoundingBoxes: BoundingBoxMap = {};
// --- Rotated bounding boxes for world map sprites (by type and rotation) ---
let worldMapRotatedBoundingBoxes: Record<string, Record<number, BoundingBox>> = {};
// --- Rotated bounding boxes for each block instance (populated after map/entities load) ---
let blockInstanceRotatedBoundingBoxes: WeakMap<object, BoundingBox> = new WeakMap();

const {
    getEntityRenderOffset,
    getEntityCollisionBounds,
    getRenderedEntityWorldSprite,
    isRenderedSpriteOpaqueAtWorld,
    doRenderedSpritesOverlap,
    getRenderedSpriteWorldCenter,
    getEntitySideAnchorPoint,
    getEntityFrontAnchorPoint
} = createGameEntityRenderHelpers({
    spriteScale: SPRITE_SCALE,
    findSpriteRectByType,
    getEntityPreviewSheet,
    getTransformedSpriteCanvas,
    normalizeSpriteTranslation,
    getSpriteTranslationOffset,
    getVisibleCenterRotationOffset,
    getRenderedEntitySpriteCanvas,
    getSpriteVisibleBounds,
    getWorldMapRotatedBoundingBoxes: () => worldMapRotatedBoundingBoxes,
    getBlockInstanceRotatedBoundingBoxes: () => blockInstanceRotatedBoundingBoxes,
    getWorldMapBoundingBoxes: () => worldMapBoundingBoxes
});

const {
    getActiveWindEmittersNearAstronaut,
    computeAstronautWindAcceleration,
    spawnWindParticlesNearAstronaut,
    updateAndDrawWindParticles
} = createGameWindHelpers({
    astronaut,
    getWindSettings: () => windSettings,
    getWindDebugToggles: () => windDebugToggles,
    getWindEmitters: () => windEmitters,
    getMapBlocksNearWorldPoint,
    toWindEmitterFromBlock,
    getEffectiveWindToggles,
    resolveEmitterMagnitude,
    computeEmitterWindAccelerationAtPoint,
    applySurfaceWindField,
    normalizeWindSettings,
    getSurfaceWindEdgeProximity,
    getSurfaceWindBoundaryOvershoot,
    clampToRange,
    movementSettings: MOVEMENT_SETTINGS,
    spriteScale: SPRITE_SCALE,
    windParticles,
    getCanvasSize: () => ({ width: canvas.width, height: canvas.height }),
    windBlockSampleIntervalMs: WIND_BLOCK_SAMPLE_INTERVAL_MS,
    windBlockSampleDistancePx: WIND_BLOCK_SAMPLE_DISTANCE_PX,
    getCachedWindEmittersForFrame: () => cachedWindEmittersForFrame,
    setCachedWindEmittersForFrame: (emitters) => { cachedWindEmittersForFrame = emitters; },
    getCachedWindEmittersFrameKey: () => cachedWindEmittersFrameKey,
    setCachedWindEmittersFrameKey: (key) => { cachedWindEmittersFrameKey = key; },
    getCachedNearbyBlockWindEmitters: () => cachedNearbyBlockWindEmitters,
    setCachedNearbyBlockWindEmitters: (emitters) => { cachedNearbyBlockWindEmitters = emitters; },
    getCachedNearbyBlockWindSample: () => cachedNearbyBlockWindSample,
    setCachedNearbyBlockWindSample: (sample) => { cachedNearbyBlockWindSample = sample; }
});

const {
    applySurfaceWindCarryToAstronaut,
    getHeldMovementModifiers,
    getAstronautControlModifiers,
    applyAstronautBulletDaze,
    getFacingSign,
    getAstronautRect
} = createAstronautControlRuntime({
    astronaut,
    getHeldCollectable: () => heldCollectable,
    getFacingLeft: () => facingLeft,
    getAstronautCollisionOffsets,
    movementSettings: MOVEMENT_SETTINGS,
    bulletDazeDurationMs: BULLET_DAZE_DURATION_MS,
    bulletDazeWalkScale: BULLET_DAZE_WALK_SCALE,
    bulletDazeFlightScale: BULLET_DAZE_FLIGHT_SCALE,
    getWindSettings: () => windSettings,
    getWindDebugToggles: () => windDebugToggles,
    getEffectiveWindToggles,
    normalizeWindSettings,
    getSurfaceWindEdgeProximity,
    getSurfaceWindBoundaryOvershoot,
    applySurfaceWindField,
    clampToRange
});

const {
    getChunkActivityForEntityPosition,
    shouldRunChunkBandUpdate
} = createChunkActivityHelpers({
    getChunkActivityForWorldPosition
});

const {
    invalidateTeleporterPadCaches,
    isTeleporterActive,
    getTeleporterActiveDestination,
    getTeleporterPadKeySet,
    filterTeleporterPadsFromBlocks,
    drawTeleporterPads,
    updateTeleporterPadTeleporting
} = createTeleporterPadHelpers({
    teleporterTileSize: TELEPORTER_TILE_SIZE,
    teleporterChunkCadence: TELEPORTER_CHUNK_CADENCE,
    getAstronautPosition: () => astronaut.position,
    getTeleporterTouchCooldownUntilMs: () => teleporterTouchCooldownUntilMs,
    setTeleporterTouchCooldownUntilMs: (value) => { teleporterTouchCooldownUntilMs = value; },
    isDesignerOpen,
    isTeleporting: () => teleporting,
    getAstronautRect,
    startTeleportToLocation,
    getChunkActivityForWorldPosition,
    shouldRunChunkBandUpdate,
    teleporterPadRuntime
});

const {
    getStableCreatureAimCenter,
    getTurretFacingRotations,
    isTurretLikeCreature,
    isBirdCreature,
    getAnimatedBirdSpriteType
} = createGameCreatureRenderTargetHelpers({
    birdAnimationFrames: BIRD_ANIMATION_FRAMES,
    birdAnimationFrameDurationMs: BIRD_ANIMATION_FRAME_DURATION_MS,
    spriteScale: SPRITE_SCALE,
    getCreatureAuthoredType,
    findSpriteRectByType,
    getEntityPreviewSheet,
    getEntityCollisionBounds,
    getEntityCenter,
    getTransformedSpriteCanvas,
    getSpriteVisibleBounds,
    getEntityRenderOffset
});

const {
    collidesAtSide,
    getFloorSnapAmount,
    moveCollectableHorizontally,
    moveCollectableVertically,
    moveCreatureWithEnvironmentCollisions
} = createEnvironmentCollisionHelpers({
    getEntityCollisionBounds,
    isSolidAtWorld: (x, y) => !!getSolidBlockAtWorld(
        x,
        y,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    ),
    clampToRange,
    mapWidth: MAP_WIDTH,
    mapHeight: MAP_HEIGHT,
    collectableGroundSnapDistance: MOVEMENT_SETTINGS.collectableGroundSnapDistance,
    collectablePushStepUpHeight: MOVEMENT_SETTINGS.collectablePushStepUpHeight
});

const {
    isCoroniumExplosionAtCenter,
    getEffectiveDestructibleSettings,
    matchesDestructionSourceRequirement,
    removeDoorEntity,
    removeMapBlockEntity,
    getDestructibleCollisionBounds
} = createGameDestructibleRuntimeHelpers({
    getCollectableEntities: () => collectableEntities,
    isRadioactiveBoulderCollectable,
    isCollectableCollected,
    getEntityCenter,
    getEntityCollisionBounds,
    getDefaultDestructibleEnabled,
    getDefaultDestructibleHealth,
    getDefaultDestructionSource,
    getMapBlocks: () => mapBlocks,
    getDoorEntities: () => doorEntities
});

let applyAstronautBulletImpactBlastRuntime = (_centerX: number, _centerY: number, _damage: number) => {};
const {
    spawnProjectileImpactEffect,
    spawnGrenadeExplosionEffect,
    updateProjectileImpactEffects,
    updateDoorDestructionEffects,
    getProjectileAngleDegrees,
    updateProjectileFlightFrame
} = createProjectileImpactRuntime({
    getProjectileSettings,
    getEntityCollisionBounds,
    getEntityCenter,
    getEntityPositionFromCenter,
    clampToRange,
    projectileImpactEffects,
    doorDestructionEffects,
    bulletImpactParticles,
    bulletImpactParticleColors: BULLET_IMPACT_PARTICLE_COLORS,
    gameAudio,
    getBulletImpactAudioSettings: () => bulletImpactAudioSettings,
    applyAstronautBulletImpactBlast: (centerX, centerY, damage) => {
        applyAstronautBulletImpactBlastRuntime(centerX, centerY, damage);
    }
});

const {
    spawnDestructibleExplosionEffect,
    applyExplosionDamageToDestructibles,
    drawDoorDestructionEffects,
    updateAndDrawBulletImpactParticles
} = createGameDestructionEffects({
    getDoorEntities: () => doorEntities,
    getMapBlocks: () => mapBlocks,
    getDestructibleCollisionBounds,
    getEntityCollisionBounds,
    getEntityCenter,
    spawnGrenadeExplosionEffect,
    doorDestructionEffects,
    bulletImpactParticles,
    removeDoorEntity,
    removeMapBlockEntity,
    afterWorldDataMutated,
    getEffectiveDestructibleSettings,
    matchesDestructionSourceRequirement,
    destructibleDamageByEntity,
    clampToRange,
    getRenderedEntityWorldSprite,
    spriteScale: SPRITE_SCALE,
    canvas
});

function getProjectileSettings(kind: CreatureProjectileKind) {
    return CREATURE_PROJECTILE_SETTINGS[kind];
}

const {
    getCreatureProjectileLaunchSpeed,
    getNextCreatureFireAt,
    hasCreatureLineOfSight,
    getCreatureTargetPoint
} = createGameCreatureTargetingHelpers({
    getProjectileKindForFireMode,
    getProjectileSettings,
    getAstronautVelocity: () => astronaut.velocity,
    clampToRange,
    isSolidAtWorld: (x: number, y: number) => !!getSolidBlockAtWorld(
        x,
        y,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    )
});

const {
    cleanupCollectableReferences,
    removeCollectableEntity
} = createGameCollectableRemovalHelpers({
    getHeldCollectable: () => heldCollectable,
    setHeldCollectable: (collectable: Collectable | null) => { heldCollectable = collectable; },
    getStoredCollectables: () => storedCollectables,
    getInventoryCycleIndex: () => inventoryCycleIndex,
    setInventoryCycleIndex: (index: number) => { inventoryCycleIndex = index; },
    collectableEntities,
    collectedCollectableEntityIds
});

const {
    applyAstronautImpact,
    applyAstronautBulletImpactBlast,
    applyAstronautProjectileImpact
} = createAstronautImpactHelpers({
    astronaut,
    movementSettings: MOVEMENT_SETTINGS,
    getAstronautRect,
    isFacingLeft: () => facingLeft,
    flipAstronaut,
    applyAstronautDamage,
    applyAstronautBulletDaze,
    bulletDazeDurationMs: BULLET_DAZE_DURATION_MS,
    getCreatureProjectilePhysicsSettings,
    getDynamicObjectPushScale,
    gameAudio,
    getNow: () => performance.now(),
    getRandom: () => Math.random()
});
applyAstronautBulletImpactBlastRuntime = applyAstronautBulletImpactBlast;

const spawnCreatureCarryProxy = createSpawnCreatureCarryProxy({
    collectableEntities,
    assignEntityId
});

const {
    resolveAstronautCreatureCollisions,
    updateCreatureSounds
} = createGameCombatHelpers({
    getCreatureEntities: () => creatureEntities,
    getAstronautRect,
    getEntityCollisionBounds,
    getEntityRect,
    getAstronautRenderedWorldSprite,
    getRenderedEntityWorldSprite,
    doRenderedSpritesOverlap,
    gameState,
    astronaut,
    applyAstronautDamage,
    ouchSounds,
    getSoundEnabled,
    creatureManifestSounds,
    getEntityCenter,
    gameAudio
});

const creatureOverlayRenderer = createCreatureOverlayRenderer({
    getCreatureEntities: () => creatureEntities,
    getRenderedEntityWorldSprite,
    getEntityCollisionBounds,
    getEntityRect,
    spriteScale: SPRITE_SCALE
});

const drawCreatureOverlays = creatureOverlayRenderer.drawCreatureOverlays;

const sharedRuntimeContext = createSharedRuntimeContextFromState({
    astronaut,
    movementSettings: MOVEMENT_SETTINGS,
    creatureProjectileSettings: CREATURE_PROJECTILE_SETTINGS,
    spriteScale: SPRITE_SCALE,
    canvas,
    keys,
    getPrevKeys: () => prevKeys,
    getFacingLeft: () => facingLeft,
    getFacingSign,
    getThrowAngleDegrees: () => throwAngleDegrees,
    setThrowAngleDegrees: (degrees: number) => { throwAngleDegrees = degrees; },
    getThrowGuideDots: () => throwGuideDots,
    setThrowGuideDots: (dots: ThrowGuideDot[]) => { throwGuideDots = dots; },
    getThrowGuideDotEmitTimer: () => throwGuideDotEmitTimer,
    setThrowGuideDotEmitTimer: (timer: number) => { throwGuideDotEmitTimer = timer; },
    getCreatureEntities: () => creatureEntities,
    getCollectableEntities: () => collectableEntities,
    getHeldCollectable: () => heldCollectable,
    setHeldCollectable: (collectable: Collectable | null) => { heldCollectable = collectable; },
    getStoredCollectables: () => storedCollectables,
    getInventoryCycleIndex: () => inventoryCycleIndex,
    setInventoryCycleIndex: (index: number) => { inventoryCycleIndex = index; },
    getAstronautPosition: () => astronaut.position,
    getGameState: () => gameState,
    getAstronaut: () => astronaut,
    getDoorCount: () => doorEntities.length,
    getBulletImpactAudioSettings: () => bulletImpactAudioSettings,
    getAstronautRect,
    getAstronautAimPoint,
    getAstronautRenderedWorldSprite,
    getEntityCollisionBounds,
    getEntityCenter,
    getEntityRect,
    getEntityFrontAnchorPoint,
    getEntitySideAnchorPoint,
    getEntityPositionFromCenter,
    getSpriteVisibleBounds,
    isRenderedSpriteOpaqueAtWorld,
    doRenderedSpritesOverlap,
    getRenderedEntityWorldSprite,
    getChunkActivityForEntityPosition,
    shouldRunChunkBandUpdate,
    creatureChunkCadence: CREATURE_CHUNK_CADENCE,
    getCreatureAuthoredType,
    isBirdCreature,
    getStableCreatureAimCenter,
    isTurretLikeCreature,
    hasCreatureLineOfSight,
    getCreatureTargetPoint,
    birdTrackReleaseRangeMultiplier: BIRD_TRACK_RELEASE_RANGE_MULTIPLIER,
    birdTrackReleaseRangePadding: BIRD_TRACK_RELEASE_RANGE_PADDING,
    birdAvoidanceVerticalThreshold: BIRD_AVOIDANCE_VERTICAL_THRESHOLD,
    clampToRange,
    moveCreatureWithEnvironmentCollisions,
    getNextCreatureFireAt,
    getAnimatedBirdSpriteType,
    getTurretFacingRotations,
    spawnCreatureCarryProxy,
    gameAudio,
    heldCollectableHandInset: HELD_COLLECTABLE_HAND_INSET,
    heldCollectableHandOverlap: HELD_COLLECTABLE_HAND_OVERLAP,
    markCollectableCollected,
    isCollectableCollected,
    isGrenadeCollectable,
    setGrenadeCollectableArmedState,
    removeCollectableEntity,
    assignEntityId,
    getSound,
    saveSound,
    isCreatureProjectileCollectable,
    getCollectablePhysicsSettings,
    moveCollectableHorizontally,
    moveCollectableVertically,
    getMushroomBlocks,
    projectileChunkCadence: PROJECTILE_CHUNK_CADENCE,
    collectableChunkCadence: COLLECTABLE_CHUNK_CADENCE,
    mushroomAmbientRange: MUSHROOM_AMBIENT_RANGE,
    mushroomAmbientBaseVolume: MUSHROOM_AMBIENT_BASE_VOLUME,
    mushroomAmbientMinDelayMs: MUSHROOM_AMBIENT_MIN_DELAY_MS,
    mushroomAmbientMaxDelayMs: MUSHROOM_AMBIENT_MAX_DELAY_MS,
    syncGrenadeFuseState,
    getDynamicObjectHeadBounceLaunchSpeed,
    getDynamicObjectPushScale,
    getDynamicObjectPushedVelocity,
    applyDynamicObjectGravity,
    collidesAtSide,
    getFloorSnapAmount,
    applyDynamicObjectBounceRestitution: getDynamicObjectBounceRestitution,
    applyDynamicObjectGroundFriction,
    getEffectiveWindToggles,
    getWindSettings: () => windSettings,
    getWindDebugToggles: () => windDebugToggles,
    getActiveWindEmittersNearAstronaut,
    computeEmitterWindAccelerationAtPoint,
    applySurfaceWindField,
    normalizeWindSettings,
    getSurfaceWindEdgeProximity,
    getSurfaceWindBoundaryOvershoot,
    getProjectileKindForFireMode,
    getProjectileSettings,
    updateProjectileFlightFrame,
    getProjectileAngleDegrees,
    getDefaultGrenadeExplosionPower,
    getGrenadeExplosionRadius,
    getGrenadeExplosionPower,
    getExplosionDamageSource,
    getCreatureProjectilePhysicsSettings,
    spawnProjectileImpactEffect,
    applyAstronautProjectileImpact,
    applyAstronautDamage,
    applyAstronautImpact,
    isCoroniumExplosionAtCenter,
    applyExplosionDamageToDestructibles,
    convertProjectileToEnergyPodCollectable,
    triggerAstronautEmergencyTeleport,
    spawnGrenadeExplosionEffect,
    getSolidBlockAtWorld,
    getSpriteMap: () => spriteMap,
    getMapBlocks: () => mapBlocks,
    getDoorEntities: () => doorEntities,
    getButtonEntities: () => buttonEntities,
    getTeleporterEntities: () => teleporterEntities
});

const runtimeBootstrap = createGameMainRuntimeBootstrapFromContext(sharedRuntimeContext);

const {
    creatureRuntime,
    creatureProjectileRuntime,
    getAimOriginPosition,
    updateHeldCollectablePosition,
    isCollectableOverlappingAstronaut,
    handleCollectableInteractions,
    releaseHeldCollectable,
    updateThrowAngle,
    updateAndDrawThrowGuide,
    resolveAstronautCollectableCollisions,
    updateSingleCollectablePhysics,
    updateCollectablePhysics
} = runtimeBootstrap;

const debugRuntime = (window as any).__exileDebug;
if (debugRuntime) {
    debugRuntime.teleportAstronaut = (x: number, y: number) => {
        astronaut.position.x = x;
        astronaut.position.y = y;
        astronaut.velocity.x = 0;
        astronaut.velocity.y = 0;
    };
    debugRuntime.holdNearestGrenade = () => {
        let best: Collectable | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        for (const collectable of collectableEntities) {
            if ((collectable.type !== 'grenade' && collectable.type !== 'plasma_grenade') || collectable.stored) {
                continue;
            }
            const dx = collectable.x - astronaut.position.x;
            const dy = collectable.y - astronaut.position.y;
            const distance = Math.hypot(dx, dy);
            if (distance < bestDistance) {
                bestDistance = distance;
                best = collectable;
            }
        }
        if (!best) {
            return false;
        }
        best.hold(facingLeft);
        heldCollectable = best;
        updateHeldCollectablePosition();
        return true;
    };
    debugRuntime.getHeldItemDebugSnapshot = () => {
        const held = heldCollectable;
        const target = held ? runtimeBootstrap.runtimeAssemblies.heldItemRuntime.getHeldCollectableTargetPosition() : null;
        const astronautRendered = getAstronautRenderedWorldSprite();
        const astronautVisibleBounds = astronautRendered ? getSpriteVisibleBounds(astronautRendered.canvas) : null;
        const heldRendered = held ? getRenderedEntityWorldSprite(held) : null;
        const heldVisibleBounds = heldRendered ? getSpriteVisibleBounds(heldRendered.canvas) : null;
        const astronautVisibleCenterY = astronautRendered && astronautVisibleBounds
            ? astronautRendered.drawY + (astronautVisibleBounds.minY + (astronautVisibleBounds.maxY - astronautVisibleBounds.minY + 1) / 2) * SPRITE_SCALE
            : null;
        const heldVisibleCenterY = heldRendered && heldVisibleBounds
            ? heldRendered.drawY + (heldVisibleBounds.minY + (heldVisibleBounds.maxY - heldVisibleBounds.minY + 1) / 2) * SPRITE_SCALE
            : null;
        return {
            astronaut: { x: astronaut.position.x, y: astronaut.position.y },
            held: held ? { x: held.x, y: held.y, type: held.type } : null,
            target,
            astronautVisibleCenterY,
            heldVisibleCenterY
        };
    };
}

// --- Show tight bounding boxes toggle ---
let showTightBoundingBoxes = false; // Red sprite-based bounding boxes
let showWorldBoundingBoxes = false; // Green world-coordinate bounding boxes
let showCreatureOverlays = false;
attachGameDebugRuntimeShortcuts({
    isDesignerOpen,
    toggleShowTightBoundingBoxes: () => { showTightBoundingBoxes = !showTightBoundingBoxes; },
    toggleShowWorldBoundingBoxes: () => { showWorldBoundingBoxes = !showWorldBoundingBoxes; },
    toggleDebugMode: () => { gameState.debugMode = !gameState.debugMode; },
    togglePerformanceHud: () => { performanceTracker.toggleHudEnabled(); },
    togglePerformanceConsoleSummary: () => { performanceTracker.toggleConsoleSummaryEnabled(); },
    requestImmediateFrame
});

const extraRuntimeContext = createExtraRuntimeContextFromState({
    CHUNK_SYNC_INTERVAL_FRAMES,
    MAP_HEIGHT,
    MAP_WIDTH,
    MOVEMENT_SETTINGS,
    SPRITE_COL_FLY_DIAGONAL,
    SPRITE_COL_FLY_DOWN,
    SPRITE_COL_FLY_FLOAT,
    SPRITE_COL_FLY_RIGHT,
    SPRITE_COL_STAND,
    SPRITE_COL_WALK_END,
    SPRITE_COL_WALK_RIGHT1,
    SPRITE_COL_WALK_RIGHT2,
    SPRITE_COL_WALK_START,
    SPRITE_ROW,
    SPRITE_SCALE,
    STARFIELD_HEIGHT,
    TELEPORT_ANIM_FRAMES,
    applyButtonTeleporterLinks,
    applyGravity,
    applyLandingMomentum,
    applySurfaceWindCarryToAstronaut,
    astronautRenderer,
    getAstronautSpriteSource: () => astronautSpriteSource,
    bulletImpactParticles,
    projectileImpactEffects,
    windParticles,
    buttonEntities,
    collectableEntities,
    creatureEntities,
    doorEntities,
    buttonOnSound,
    buttonPressTimestamps,
    canAstronautFitCollisionProfile,
    checkAstronautCollisions,
    chunkActivityManager,
    computeAstronautWindAcceleration,
    computeLandingImpactDamage,
    ctx,
    gameState,
    doorCloseSound,
    doorDestructionEffects,
    doorOpenSound,
    drawCreatureOverlays,
    drawDoorDestructionEffects,
    drawEntities,
    drawMap,
    drawTeleporterPads,
    drawWorldBoundingBoxOverlay,
    emitJetpackDots,
    filterTeleporterPadsFromBlocks,
    getAnyBlockAtWorld,
    getAstronautCollisionOffsets,
    getAstronautControlModifiers,
    getAstronautFacingDirectionForFlyPose,
    getBlackBackgroundBlocks,
    getCameraOffset,
    getChunkActivityForWorldPosition,
    getCreatureProjectileCollectables,
    getCurrentAstronautCollisionProfile,
    getDesignerRenderableCollectables,
    getDirectDownTransitionSequence,
    getEffectiveViewportState,
    getHeldMovementModifiers,
    getHorizontalTravelDirection,
    getMapBlocksBehindAstronaut,
    getMapBlocksMaskAstronaut,
    getRenderableCollectables,
    getRenderableMapBlocks,
    getSpriteRectFromMap: spriteSheetRuntime.getSpriteRectFromMap,
    getTeleporterPadKeySet,
    handleAstronautMovement,
    hideBlackBackgroundBlocks,
    getMapLoaded: () => mapLoaded,
    mouseScreen,
    mouseWorld,
    performanceTracker,
    rememberLastFlyPose,
    resetFlyDownAnimationState,
    resetFlySwitchAnimationState,
    resolveAstronautCreatureCollisions,
    scheduleNextFrame,
    setAstronautCollisionProfile,
    showBlackBackgroundBlocks,
    spawnWindParticlesNearAstronaut,
    syncButtonStatesToDoors,
    syncMapChunksForViewport,
    updateAndDrawBulletImpactParticles,
    updateAndDrawJetpackDots,
    updateAndDrawStars,
    updateAndDrawWindParticles,
    updateAstronautEnergyRecovery,
    updateCreatureSounds,
    updateDoorDestructionEffects,
    updateProjectileImpactEffects,
    updateTeleporterPadTeleporting,
    getWalkSpeed: () => walkSpeed,
    isDesignerOpen,
    windDebugToggles,
    windSettings,
    getDownPressed: () => downPressed,
    getFacingLeft: () => facingLeft,
    getLeftPressed: () => leftPressed,
    remappedSpriteSheets,
    getRightPressed: () => rightPressed,
    saveSnapshotInProgress,
    showCreatureOverlays,
    showTightBoundingBoxes,
    showWorldBoundingBoxes,
    getUpPressed: () => upPressed,
    astronautBoundingBoxes,
    blockInstanceRotatedBoundingBoxes,
    getBlockInstanceRotatedBoundingBoxes: () => blockInstanceRotatedBoundingBoxes,
    worldMapBoundingBoxes,
    worldMapRotatedBoundingBoxes,
    drawCustomPalettePreview,
    drawSpritePreview,
    drawSpriteSample,
    ensureMapChunksAroundWorldPosition,
    ensureWorldBounds,
    afterWorldDataMutated,
    clampCamera,
    getAstronautStartPosition,
    getRawWorldData,
    getRawWorldDataForSave,
    getSpriteCatalog,
    getSpriteTypes,
    syncRuntimeMapBounds,
    updateAstronautStartPosition,
    loadAstronautStartPosition,
    loadButtons,
    loadCollectables,
    loadCreatures,
    loadDoors,
    loadMapBlocks,
    loadPalettes,
    loadSpriteMap,
    loadTeleporters,
    loadWindData,
    createWorldDesigner,
    deepClone,
    getSoundEnabled,
    setSoundEnabled,
    setWindDebugToggle,
    makeBlackTransparent,
    normalizeBulletImpactAudioSettings,
    normalizeSpriteSheetColors,
    previewSpriteSheetNormalization,
    replaceRawWorldData,
    calculateAstronautSpriteBoundingBoxes,
    calculateSpriteCollisionBoundingBoxes,
    initStars,
    rebuildBlockInstanceBoundingBoxes,
    rebuildRemappedSpriteSheets,
    resetAstronautToPosition,
    requestImmediateFrame,
    getAstronautBoundingBoxes: () => astronautBoundingBoxes,
    setAstronautBoundingBoxes: (value: any) => { astronautBoundingBoxes = value; },
    setBulletImpactAudioSettings: (value: BulletImpactAudioSettings) => { bulletImpactAudioSettings = value; },
    getCachedWindEmittersFrameKey: () => cachedWindEmittersFrameKey,
    setCachedWindEmittersFrameKey: (value: number) => { cachedWindEmittersFrameKey = value; },
    getShowCreatureOverlays: () => showCreatureOverlays,
    setShowCreatureOverlays: (value: boolean) => { showCreatureOverlays = value; },
    getShowWorldBoundingBoxes: () => showWorldBoundingBoxes,
    setShowWorldBoundingBoxes: (value: boolean) => { showWorldBoundingBoxes = value; },
    getColorAliases: () => colorAliases,
    getPalettes: () => palettes,
    getRawPaletteDefinitions: () => rawPaletteDefinitions,
    getRemappedSpriteSheets: () => remappedSpriteSheets,
    getSpriteMap: () => spriteMap,
    setSpriteMap: (value: any) => { spriteMap = value; },
    getSpriteSheet: () => spriteSheet,
    getWorldDesigner: () => worldDesigner,
    setSpriteSheet: (value: HTMLImageElement) => {
        spriteSheetSetCount += 1;
        lastSetSpriteSheetDefined = !!value;
        lastSetSpriteSheetWidth = value?.width ?? 0;
        spriteSheet = value;
    },
    setWorldDesigner: (value: WorldDesigner | null) => { worldDesigner = value; },
    getWorldMapBoundingBoxes: () => worldMapBoundingBoxes,
    setWorldMapBoundingBoxes: (value: any) => { worldMapBoundingBoxes = value; },
    getWorldMapRotatedBoundingBoxes: () => worldMapRotatedBoundingBoxes,
    setWorldMapRotatedBoundingBoxes: (value: any) => { worldMapRotatedBoundingBoxes = value; }
});

mergeRuntimeContexts({
    sharedRuntimeContext,
    extraRuntimeContext,
    creatureRuntime,
    creatureProjectileRuntime,
    getAimOriginPosition,
    updateHeldCollectablePosition,
    isCollectableOverlappingAstronaut,
    handleCollectableInteractions,
    releaseHeldCollectable,
    updateThrowAngle,
    updateAndDrawThrowGuide,
    resolveAstronautCollectableCollisions,
    updateSingleCollectablePhysics,
    updateCollectablePhysics
});

getLoopRuntimeValues = createGameMainLoopRuntimeValuesProviderFromContext(sharedRuntimeContext);

loopStateAccessors = createLoopStateAccessorsFromState({
    getActiveAstronautCollisionProfile: () => activeAstronautCollisionProfile,
    setActiveAstronautCollisionProfile: (value: any) => { activeAstronautCollisionProfile = value; },
    getChunkSyncFrameCounter: () => chunkSyncFrameCounter,
    setChunkSyncFrameCounter: (value: any) => { chunkSyncFrameCounter = value; },
    getCurrentAstronautChunkActivity: () => currentAstronautChunkActivity,
    setCurrentAstronautChunkActivity: (value: any) => { currentAstronautChunkActivity = value; },
    getCurrentAstronautRenderState: () => currentAstronautRenderState,
    setCurrentAstronautRenderState: (value: any) => { currentAstronautRenderState = value; },
    getFlyDir: () => flyDir,
    setFlyDir: (value: any) => { flyDir = value; },
    getFlyDownFacingLeft: () => flyDownFacingLeft,
    setFlyDownFacingLeft: (value: any) => { flyDownFacingLeft = value; },
    getFlyDownMode: () => flyDownMode,
    setFlyDownMode: (value: any) => { flyDownMode = value; },
    getFlyDownTransitionStep: () => flyDownTransitionStep,
    setFlyDownTransitionStep: (value: any) => { flyDownTransitionStep = value; },
    getFlyDownTransitionTimer: () => flyDownTransitionTimer,
    setFlyDownTransitionTimer: (value: any) => { flyDownTransitionTimer = value; },
    getFlyDownTransitioning: () => flyDownTransitioning,
    setFlyDownTransitioning: (value: any) => { flyDownTransitioning = value; },
    getFlyDownTravelDir: () => flyDownTravelDir,
    setFlyDownTravelDir: (value: any) => { flyDownTravelDir = value; },
    getFlyHoldTimer: () => flyHoldTimer,
    setFlyHoldTimer: (value: any) => { flyHoldTimer = value; },
    getFlySwitchStep: () => flySwitchStep,
    setFlySwitchStep: (value: any) => { flySwitchStep = value; },
    getFlySwitchTimer: () => flySwitchTimer,
    setFlySwitchTimer: (value: any) => { flySwitchTimer = value; },
    getFlySwitching: () => flySwitching,
    setFlySwitching: (value: any) => { flySwitching = value; },
    getIsGameLoopRunning: () => isGameLoopRunning,
    setIsGameLoopRunning: (value: any) => { isGameLoopRunning = value; },
    getLastAstronautWindAcceleration: () => lastAstronautWindAcceleration,
    setLastAstronautWindAcceleration: (value: any) => { lastAstronautWindAcceleration = value; },
    getLastFlyFlipSprite: () => lastFlyFlipSprite,
    setLastFlyFlipSprite: (value: any) => { lastFlyFlipSprite = value; },
    getLastFlySpriteCol: () => lastFlySpriteCol,
    setLastFlySpriteCol: (value: any) => { lastFlySpriteCol = value; },
    getLayDownVerticalFlipToggled: () => layDownVerticalFlipToggled,
    setLayDownVerticalFlipToggled: (value: any) => { layDownVerticalFlipToggled = value; },
    getPrevKeysState: () => prevKeys,
    setPrevKeysState: (value: any) => { prevKeys = value; },
    getProneForcedByGeometry: () => proneForcedByGeometry,
    setProneForcedByGeometry: (value: any) => { proneForcedByGeometry = value; },
    getPronePoseActive: () => pronePoseActive,
    setPronePoseActive: (value: any) => { pronePoseActive = value; },
    getSimulationFrameCounter: () => simulationFrameCounter,
    setSimulationFrameCounter: (value: any) => { simulationFrameCounter = value; },
    getTeleportAnimFrame: () => teleportAnimFrame,
    setTeleportAnimFrame: (value: any) => { teleportAnimFrame = value; },
    getTeleportPhase: () => teleportPhase,
    setTeleportPhase: (value: any) => { teleportPhase = value; },
    getTeleportSlot: () => teleportSlot,
    setTeleportSlot: (value: any) => { teleportSlot = value; },
    getTeleportTarget: () => teleportTarget,
    setTeleportTarget: (value: any) => { teleportTarget = value; },
    getTeleporting: () => teleporting,
    setTeleporting: (value: any) => { teleporting = value; },
    getWalkAnimFrame: () => walkAnimFrame,
    setWalkAnimFrame: (value: any) => { walkAnimFrame = value; },
    getWalkAnimTimer: () => walkAnimTimer,
    setWalkAnimTimer: (value: any) => { walkAnimTimer = value; }
});

const init = createGameMainInitFromContext(sharedRuntimeContext);

init();
