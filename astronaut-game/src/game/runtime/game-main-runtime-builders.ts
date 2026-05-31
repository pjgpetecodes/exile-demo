import { createGameInitRuntimeContext } from './game-init-context.js';
import { createGameLoopRuntimeContext } from './game-loop-context.js';

type RuntimeStateAccessor = {
    get: () => any;
    set?: (value: any) => void;
};

type RuntimeStateAccessors = Record<string, RuntimeStateAccessor>;

const INIT_RUNTIME_KEYS = [
    'MAP_WIDTH',
    'STARFIELD_HEIGHT',
    'astronaut',
    'buttonEntities',
    'calculateAstronautSpriteBoundingBoxes',
    'calculateSpriteCollisionBoundingBoxes',
    'collectableEntities',
    'createWorldDesigner',
    'creatureEntities',
    'deepClone',
    'doorEntities',
    'drawWorldBoundingBoxOverlay',
    'drawCustomPalettePreview',
    'drawSpritePreview',
    'drawSpriteSample',
    'ensureMapChunksAroundWorldPosition',
    'ensureWorldBounds',
    'afterWorldDataMutated',
    'canvas',
    'clampCamera',
    'getAstronautStartPosition',
    'getEffectiveWindToggles',
    'getRawWorldData',
    'getRawWorldDataForSave',
    'getSoundEnabled',
    'getSpriteCatalog',
    'getSpriteTypes',
    'initStars',
    'loadAstronautStartPosition',
    'loadButtons',
    'loadCollectables',
    'loadCreatures',
    'loadDoors',
    'loadMapBlocks',
    'loadPalettes',
    'loadSpriteMap',
    'loadTeleporters',
    'loadWindData',
    'makeBlackTransparent',
    'normalizeBulletImpactAudioSettings',
    'performanceTracker',
    'previewSpriteSheetNormalization',
    'rebuildBlockInstanceBoundingBoxes',
    'rebuildRemappedSpriteSheets',
    'replaceRawWorldData',
    'resetAstronautToPosition',
    'requestImmediateFrame',
    'savePaletteDefinitions',
    'saveWorldData',
    'setSoundEnabled',
    'setWindDebugToggle',
    'syncRuntimeMapBounds',
    'updateAstronautStartPosition',
    'windDebugToggles',
    'windSettings',
    'normalizeSpriteSheetColors'
] as const;

export const LOOP_RUNTIME_KEYS = [
    'CHUNK_SYNC_INTERVAL_FRAMES',
    'MAP_HEIGHT',
    'MAP_WIDTH',
    'MOVEMENT_SETTINGS',
    'SPRITE_COL_FLY_DIAGONAL',
    'SPRITE_COL_FLY_DOWN',
    'SPRITE_COL_FLY_FLOAT',
    'SPRITE_COL_FLY_RIGHT',
    'SPRITE_COL_STAND',
    'SPRITE_COL_WALK_END',
    'SPRITE_COL_WALK_RIGHT1',
    'SPRITE_COL_WALK_RIGHT2',
    'SPRITE_COL_WALK_START',
    'SPRITE_ROW',
    'SPRITE_SCALE',
    'STARFIELD_HEIGHT',
    'TELEPORT_ANIM_FRAMES',
    'applyAstronautDamage',
    'applyButtonTeleporterLinks',
    'applyGravity',
    'applyLandingMomentum',
    'applySurfaceWindCarryToAstronaut',
    'astronaut',
    'astronautBoundingBoxes',
    'astronautRenderer',
    'astronautSpriteSource',
    'blockInstanceRotatedBoundingBoxes',
    'bulletImpactParticles',
    'buttonEntities',
    'buttonOnSound',
    'buttonPressTimestamps',
    'canAstronautFitCollisionProfile',
    'canvas',
    'checkAstronautCollisions',
    'chunkActivityManager',
    'computeAstronautWindAcceleration',
    'computeLandingImpactDamage',
    'creatureEntities',
    'creatureRuntime',
    'ctx',
    'doorCloseSound',
    'doorDestructionEffects',
    'doorEntities',
    'doorOpenSound',
    'downPressed',
    'drawCreatureOverlays',
    'drawDoorDestructionEffects',
    'drawEntities',
    'drawMap',
    'drawTeleporterPads',
    'drawWorldBoundingBoxOverlay',
    'emitJetpackDots',
    'facingLeft',
    'filterTeleporterPadsFromBlocks',
    'findSpriteRectByType',
    'gameAudio',
    'gameState',
    'getAnyBlockAtWorld',
    'getAstronautCollisionOffsets',
    'getAstronautControlModifiers',
    'getAstronautFacingDirectionForFlyPose',
    'getBlackBackgroundBlocks',
    'getCameraOffset',
    'getChunkActivityForEntityPosition',
    'getChunkActivityForWorldPosition',
    'getCreatureProjectileCollectables',
    'getCurrentAstronautCollisionProfile',
    'getDesignerRenderableCollectables',
    'getDirectDownTransitionSequence',
    'getEffectiveViewportState',
    'getEffectiveWindToggles',
    'getEntityPreviewSheet',
    'getHeldMovementModifiers',
    'getHorizontalTravelDirection',
    'getMapBlocksBehindAstronaut',
    'getMapBlocksMaskAstronaut',
    'getRenderableCollectables',
    'getRenderableMapBlocks',
    'getSolidBlockAtWorld',
    'getSoundEnabled',
    'getSpriteRectFromMap',
    'getSpriteTranslationOffset',
    'getTeleporterPadKeySet',
    'getTransformedSpriteCanvas',
    'handleAstronautMovement',
    'handleCollectableInteractions',
    'heldCollectable',
    'hideBlackBackgroundBlocks',
    'isDesignerOpen',
    'keys',
    'leftPressed',
    'mapBlocks',
    'mapLoaded',
    'mouseScreen',
    'mouseWorld',
    'normalizeSpriteTranslation',
    'performanceTracker',
    'popLatestTeleportLocation',
    'projectileImpactEffects',
    'remappedSpriteSheets',
    'rememberLastFlyPose',
    'rememberSound',
    'resetFlyDownAnimationState',
    'resetFlySwitchAnimationState',
    'resolveAstronautCollectableCollisions',
    'resolveAstronautCreatureCollisions',
    'rightPressed',
    'saveSnapshotInProgress',
    'scheduleNextFrame',
    'setAstronautCollisionProfile',
    'showBlackBackgroundBlocks',
    'showCreatureOverlays',
    'showTightBoundingBoxes',
    'showWorldBoundingBoxes',
    'spawnWindParticlesNearAstronaut',
    'spriteMap',
    'spriteSheet',
    'startTeleportToLocation',
    'syncButtonStatesToDoors',
    'syncMapChunksForViewport',
    'teleportFlipSprite',
    'teleportFlipVertical',
    'teleportLocations',
    'teleportSpriteCol',
    'teleporterEntities',
    'upPressed',
    'updateAndDrawBulletImpactParticles',
    'updateAndDrawJetpackDots',
    'updateAndDrawStars',
    'updateAndDrawThrowGuide',
    'updateAndDrawWindParticles',
    'updateAstronautEnergyRecovery',
    'updateCollectablePhysics',
    'updateCreatureSounds',
    'updateDoorDestructionEffects',
    'updateHeldCollectablePosition',
    'updateProjectileImpactEffects',
    'updateTeleporterPadTeleporting',
    'updateThrowAngle',
    'walkSpeed',
    'windDebugToggles',
    'windParticles',
    'windSettings',
    'worldDesigner',
    'worldMapBoundingBoxes',
    'worldMapRotatedBoundingBoxes'
] as const;

function pickRuntimeValues(source: Record<string, any>, keys: readonly string[]) {
    const picked: Record<string, any> = {};
    for (const key of keys) {
        picked[key] = source[key];
    }
    return picked;
}

function toRuntimeStateBindings(accessors: RuntimeStateAccessors) {
    const bindings: Record<string, any> = {};
    for (const [name, accessor] of Object.entries(accessors)) {
        const bindingName = `${name.charAt(0).toUpperCase()}${name.slice(1)}`;
        bindings[`get${bindingName}`] = accessor.get;
        if (accessor.set) {
            bindings[`set${bindingName}`] = accessor.set;
        }
    }
    return bindings;
}

export function buildGameInitRuntimeContext(
    runtimeValues: Record<string, any>,
    stateAccessors: RuntimeStateAccessors
) {
    return createGameInitRuntimeContext(
        pickRuntimeValues(runtimeValues, INIT_RUNTIME_KEYS),
        toRuntimeStateBindings(stateAccessors) as any
    );
}

export function buildGameLoopRuntimeContext(
    runtimeValues: Record<string, any>,
    stateAccessors: RuntimeStateAccessors
) {
    return createGameLoopRuntimeContext(
        pickRuntimeValues(runtimeValues, LOOP_RUNTIME_KEYS),
        toRuntimeStateBindings(stateAccessors) as any
    );
}
