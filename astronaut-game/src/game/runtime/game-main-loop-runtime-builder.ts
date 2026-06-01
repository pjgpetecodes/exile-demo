import { createGameLoopRuntimeValuesProvider } from './game-loop-runtime-values-provider.js';
import { createGameLoopRuntimeValuesSource } from './game-main-dependency-builders.js';

type ValuePack = Record<string, any>;

function buildLoopConstants(context: ValuePack) {
    return {
        CHUNK_SYNC_INTERVAL_FRAMES: context.CHUNK_SYNC_INTERVAL_FRAMES,
        MAP_HEIGHT: context.MAP_HEIGHT,
        MAP_WIDTH: context.MAP_WIDTH,
        MOVEMENT_SETTINGS: context.MOVEMENT_SETTINGS,
        SPRITE_COL_FLY_DIAGONAL: context.SPRITE_COL_FLY_DIAGONAL,
        SPRITE_COL_FLY_DOWN: context.SPRITE_COL_FLY_DOWN,
        SPRITE_COL_FLY_FLOAT: context.SPRITE_COL_FLY_FLOAT,
        SPRITE_COL_FLY_RIGHT: context.SPRITE_COL_FLY_RIGHT,
        SPRITE_COL_STAND: context.SPRITE_COL_STAND,
        SPRITE_COL_WALK_END: context.SPRITE_COL_WALK_END,
        SPRITE_COL_WALK_RIGHT1: context.SPRITE_COL_WALK_RIGHT1,
        SPRITE_COL_WALK_RIGHT2: context.SPRITE_COL_WALK_RIGHT2,
        SPRITE_COL_WALK_START: context.SPRITE_COL_WALK_START,
        SPRITE_ROW: context.SPRITE_ROW,
        SPRITE_SCALE: context.SPRITE_SCALE,
        STARFIELD_HEIGHT: context.STARFIELD_HEIGHT,
        TELEPORT_ANIM_FRAMES: context.TELEPORT_ANIM_FRAMES
    };
}

function buildLoopSystems(context: ValuePack) {
    return {
        applyAstronautDamage: context.applyAstronautDamage,
        applyButtonTeleporterLinks: context.applyButtonTeleporterLinks,
        applyGravity: context.applyGravity,
        applyLandingMomentum: context.applyLandingMomentum,
        applySurfaceWindCarryToAstronaut: context.applySurfaceWindCarryToAstronaut,
        astronaut: context.astronaut,
        astronautRenderer: context.astronautRenderer,
        astronautSpriteSource: context.getAstronautSpriteSource(),
        bulletImpactParticles: context.bulletImpactParticles,
        buttonEntities: typeof context.getButtonEntities === 'function'
            ? context.getButtonEntities()
            : context.buttonEntities,
        buttonOnSound: context.buttonOnSound,
        buttonPressTimestamps: context.buttonPressTimestamps,
        canAstronautFitCollisionProfile: context.canAstronautFitCollisionProfile,
        canvas: context.canvas,
        checkAstronautCollisions: context.checkAstronautCollisions,
        chunkActivityManager: context.chunkActivityManager,
        computeAstronautWindAcceleration: context.computeAstronautWindAcceleration,
        computeLandingImpactDamage: context.computeLandingImpactDamage,
        creatureEntities: typeof context.getCreatureEntities === 'function'
            ? context.getCreatureEntities()
            : context.creatureEntities,
        creatureRuntime: context.creatureRuntime,
        ctx: context.ctx,
        doorCloseSound: context.doorCloseSound,
        doorDestructionEffects: context.doorDestructionEffects,
        doorEntities: typeof context.getDoorEntities === 'function'
            ? context.getDoorEntities()
            : context.doorEntities,
        doorOpenSound: context.doorOpenSound,
        drawCreatureOverlays: context.drawCreatureOverlays,
        drawDoorDestructionEffects: context.drawDoorDestructionEffects,
        drawEntities: context.drawEntities,
        drawMap: context.drawMap,
        drawTeleporterPads: context.drawTeleporterPads,
        drawWorldBoundingBoxOverlay: context.drawWorldBoundingBoxOverlay,
        emitJetpackDots: context.emitJetpackDots,
        filterTeleporterPadsFromBlocks: context.filterTeleporterPadsFromBlocks,
        findSpriteRectByType: context.findSpriteRectByType,
        gameAudio: context.gameAudio,
        gameState: context.gameState,
        getAnyBlockAtWorld: context.getAnyBlockAtWorld,
        getAstronautCollisionOffsets: context.getAstronautCollisionOffsets,
        getAstronautControlModifiers: context.getAstronautControlModifiers,
        getAstronautFacingDirectionForFlyPose: context.getAstronautFacingDirectionForFlyPose,
        getBlackBackgroundBlocks: context.getBlackBackgroundBlocks,
        getCameraOffset: context.getCameraOffset,
        getChunkActivityForEntityPosition: context.getChunkActivityForEntityPosition,
        getChunkActivityForWorldPosition: context.getChunkActivityForWorldPosition,
        getCreatureProjectileCollectables: context.getCreatureProjectileCollectables,
        getCurrentAstronautCollisionProfile: context.getCurrentAstronautCollisionProfile,
        getDesignerRenderableCollectables: context.getDesignerRenderableCollectables,
        getDirectDownTransitionSequence: context.getDirectDownTransitionSequence,
        getEffectiveViewportState: context.getEffectiveViewportState,
        getEffectiveWindToggles: context.getEffectiveWindToggles,
        getEntityPreviewSheet: context.getEntityPreviewSheet,
        getHeldMovementModifiers: context.getHeldMovementModifiers,
        getHorizontalTravelDirection: context.getHorizontalTravelDirection,
        getMapBlocksBehindAstronaut: context.getMapBlocksBehindAstronaut,
        getMapBlocksMaskAstronaut: context.getMapBlocksMaskAstronaut,
        getRenderableCollectables: context.getRenderableCollectables,
        getRenderableMapBlocks: context.getRenderableMapBlocks,
        getSolidBlockAtWorld: context.getSolidBlockAtWorld,
        getSoundEnabled: context.getSoundEnabled,
        getSpriteRectFromMap: context.getSpriteRectFromMap,
        getSpriteTranslationOffset: context.getSpriteTranslationOffset,
        getTeleporterPadKeySet: context.getTeleporterPadKeySet,
        getTransformedSpriteCanvas: context.getTransformedSpriteCanvas,
        handleAstronautMovement: context.handleAstronautMovement,
        handleCollectableInteractions: context.handleCollectableInteractions,
        hideBlackBackgroundBlocks: context.hideBlackBackgroundBlocks,
        keys: context.keys,
        mapBlocks: typeof context.getMapBlocks === 'function' ? context.getMapBlocks() : context.mapBlocks,
        mapLoaded: typeof context.getMapLoaded === 'function' ? context.getMapLoaded() : context.mapLoaded,
        mouseScreen: context.mouseScreen,
        mouseWorld: context.mouseWorld,
        normalizeSpriteTranslation: context.normalizeSpriteTranslation,
        performanceTracker: context.performanceTracker,
        popLatestTeleportLocation: context.popLatestTeleportLocation,
        projectileImpactEffects: context.projectileImpactEffects,
        rememberLastFlyPose: context.rememberLastFlyPose,
        rememberSound: context.rememberSound,
        resetFlyDownAnimationState: context.resetFlyDownAnimationState,
        resetFlySwitchAnimationState: context.resetFlySwitchAnimationState,
        resolveAstronautCollectableCollisions: context.resolveAstronautCollectableCollisions,
        resolveAstronautCreatureCollisions: context.resolveAstronautCreatureCollisions,
        scheduleNextFrame: context.scheduleNextFrame,
        setAstronautCollisionProfile: context.setAstronautCollisionProfile,
        showBlackBackgroundBlocks: context.showBlackBackgroundBlocks,
        spawnWindParticlesNearAstronaut: context.spawnWindParticlesNearAstronaut,
        startTeleportToLocation: context.startTeleportToLocation,
        syncButtonStatesToDoors: context.syncButtonStatesToDoors,
        syncMapChunksForViewport: context.syncMapChunksForViewport,
        teleportFlipSprite: context.teleportFlipSprite,
        teleportFlipVertical: context.teleportFlipVertical,
        teleportLocations: context.teleportLocations,
        teleportSpriteCol: context.teleportSpriteCol,
        teleporterEntities: typeof context.getTeleporterEntities === 'function'
            ? context.getTeleporterEntities()
            : context.teleporterEntities,
        updateAndDrawBulletImpactParticles: context.updateAndDrawBulletImpactParticles,
        updateAndDrawJetpackDots: context.updateAndDrawJetpackDots,
        updateAndDrawStars: context.updateAndDrawStars,
        updateAndDrawThrowGuide: context.updateAndDrawThrowGuide,
        updateAndDrawWindParticles: context.updateAndDrawWindParticles,
        updateAstronautEnergyRecovery: context.updateAstronautEnergyRecovery,
        updateCollectablePhysics: context.updateCollectablePhysics,
        updateCreatureSounds: context.updateCreatureSounds,
        updateDoorDestructionEffects: context.updateDoorDestructionEffects,
        updateHeldCollectablePosition: context.updateHeldCollectablePosition,
        updateProjectileImpactEffects: context.updateProjectileImpactEffects,
        updateTeleporterPadTeleporting: context.updateTeleporterPadTeleporting,
        updateThrowAngle: context.updateThrowAngle,
        getWalkSpeed: context.getWalkSpeed,
        walkSpeed: typeof context.getWalkSpeed === 'function' ? context.getWalkSpeed() : context.walkSpeed,
        windDebugToggles: typeof context.getWindDebugToggles === 'function'
            ? context.getWindDebugToggles()
            : context.windDebugToggles,
        windParticles: context.windParticles,
        windSettings: typeof context.getWindSettings === 'function'
            ? context.getWindSettings()
            : context.windSettings
    };
}

function buildLoopFrameState(context: ValuePack) {
    const remappedSheets = typeof context.getRemappedSpriteSheets === 'function'
        ? context.getRemappedSpriteSheets()
        : context.remappedSpriteSheets;
    const fallbackSpriteSheet = typeof context.getSpriteSheet === 'function'
        ? context.getSpriteSheet()
        : context.spriteSheet;
    return {
        downPressed: typeof context.getDownPressed === 'function' ? context.getDownPressed() : context.downPressed,
        facingLeft: typeof context.getFacingLeft === 'function' ? context.getFacingLeft() : context.facingLeft,
        heldCollectable: typeof context.getHeldCollectable === 'function'
            ? context.getHeldCollectable()
            : context.heldCollectable,
        isDesignerOpen: context.isDesignerOpen,
        leftPressed: typeof context.getLeftPressed === 'function' ? context.getLeftPressed() : context.leftPressed,
        remappedSpriteSheets: (Array.isArray(remappedSheets) && remappedSheets.length > 0)
            ? remappedSheets
            : (fallbackSpriteSheet ? [fallbackSpriteSheet] : []),
        rightPressed: typeof context.getRightPressed === 'function' ? context.getRightPressed() : context.rightPressed,
        saveSnapshotInProgress: context.saveSnapshotInProgress,
        showCreatureOverlays: typeof context.getShowCreatureOverlays === 'function'
            ? context.getShowCreatureOverlays()
            : context.showCreatureOverlays,
        showTightBoundingBoxes: context.showTightBoundingBoxes,
        showWorldBoundingBoxes: typeof context.getShowWorldBoundingBoxes === 'function'
            ? context.getShowWorldBoundingBoxes()
            : context.showWorldBoundingBoxes,
        upPressed: typeof context.getUpPressed === 'function' ? context.getUpPressed() : context.upPressed
    };
}

function buildLoopAssetState(context: ValuePack) {
    return {
        astronautBoundingBoxes: typeof context.getAstronautBoundingBoxes === 'function'
            ? context.getAstronautBoundingBoxes()
            : context.astronautBoundingBoxes,
        blockInstanceRotatedBoundingBoxes: typeof context.getBlockInstanceRotatedBoundingBoxes === 'function'
            ? context.getBlockInstanceRotatedBoundingBoxes()
            : context.blockInstanceRotatedBoundingBoxes,
        spriteMap: typeof context.getSpriteMap === 'function' ? context.getSpriteMap() : context.spriteMap,
        spriteSheet: context.getSpriteSheet()
    };
}

function buildLoopWorldState(context: ValuePack) {
    return {
        worldDesigner: typeof context.getWorldDesigner === 'function'
            ? context.getWorldDesigner()
            : context.worldDesigner,
        worldMapBoundingBoxes: typeof context.getWorldMapBoundingBoxes === 'function'
            ? context.getWorldMapBoundingBoxes()
            : context.worldMapBoundingBoxes,
        worldMapRotatedBoundingBoxes: typeof context.getWorldMapRotatedBoundingBoxes === 'function'
            ? context.getWorldMapRotatedBoundingBoxes()
            : context.worldMapRotatedBoundingBoxes
    };
}

export function createGameMainLoopRuntimeValuesProviderFromContext(context: ValuePack) {
    return createGameLoopRuntimeValuesProvider(createGameLoopRuntimeValuesSource({
        getConstants: () => buildLoopConstants(context),
        getSystems: () => buildLoopSystems(context),
        getFrameState: () => buildLoopFrameState(context),
        getAssetState: () => buildLoopAssetState(context),
        getWorldState: () => buildLoopWorldState(context)
    }));
}

export function buildGameMainLoopStateAccessors(context: ValuePack) {
    return {
        activeAstronautCollisionProfile: context.activeAstronautCollisionProfile,
        chunkSyncFrameCounter: context.chunkSyncFrameCounter,
        currentAstronautChunkActivity: context.currentAstronautChunkActivity,
        currentAstronautRenderState: context.currentAstronautRenderState,
        flyDir: context.flyDir,
        flyDownFacingLeft: context.flyDownFacingLeft,
        flyDownMode: context.flyDownMode,
        flyDownTransitionStep: context.flyDownTransitionStep,
        flyDownTransitionTimer: context.flyDownTransitionTimer,
        flyDownTransitioning: context.flyDownTransitioning,
        flyDownTravelDir: context.flyDownTravelDir,
        flyHoldTimer: context.flyHoldTimer,
        flySwitchStep: context.flySwitchStep,
        flySwitchTimer: context.flySwitchTimer,
        flySwitching: context.flySwitching,
        isGameLoopRunning: context.isGameLoopRunning,
        lastAstronautWindAcceleration: context.lastAstronautWindAcceleration,
        lastFlyFlipSprite: context.lastFlyFlipSprite,
        lastFlySpriteCol: context.lastFlySpriteCol,
        layDownVerticalFlipToggled: context.layDownVerticalFlipToggled,
        prevKeys: context.prevKeys,
        proneForcedByGeometry: context.proneForcedByGeometry,
        pronePoseActive: context.pronePoseActive,
        simulationFrameCounter: context.simulationFrameCounter,
        teleportAnimFrame: context.teleportAnimFrame,
        teleportPhase: context.teleportPhase,
        teleportSlot: context.teleportSlot,
        teleportTarget: context.teleportTarget,
        teleporting: context.teleporting,
        walkAnimFrame: context.walkAnimFrame,
        walkAnimTimer: context.walkAnimTimer
    };
}
