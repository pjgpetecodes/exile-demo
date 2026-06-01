import { Creature } from '../../entities/creature.js';
import { createGameCollectablePhysics } from '../collectables/game-collectable-physics.js';
import { createGameHeldItemRuntime } from '../combat/game-held-item-runtime.js';
import { createCreatureRuntime } from '../creatures/game-creature-runtime.js';
import { createCreatureProjectileRuntime } from '../projectiles/game-creature-projectile-runtime.js';
import { createGameThrowGuideRuntime } from './game-throw-guide-runtime.js';

type RuntimeInitializerOptions = Record<string, any>;

export function isLooseCollectable(
    collectable: any,
    isCollectableCollected: (collectable: any) => boolean
) {
    return !isCollectableCollected(collectable) && !collectable.held && !collectable.stored;
}

export function initializeGameEntityRuntimes(options: RuntimeInitializerOptions) {
    let creatureProjectileRuntime!: ReturnType<typeof createCreatureProjectileRuntime>;

    const creatureRuntime = createCreatureRuntime({
        getCreatureEntities: options.getCreatureEntities,
        getAstronautPosition: options.getAstronautPosition,
        getAstronautRect: options.getAstronautRect,
        getAstronautAimPoint: options.getAstronautAimPoint,
        getEntityCollisionBounds: options.getEntityCollisionBounds,
        getEntityCenter: options.getEntityCenter,
        getChunkActivityForEntityPosition: options.getChunkActivityForEntityPosition,
        shouldRunChunkBandUpdate: options.shouldRunChunkBandUpdate,
        creatureChunkCadence: options.creatureChunkCadence,
        getCreatureAuthoredType: options.getCreatureAuthoredType,
        isBirdCreature: options.isBirdCreature,
        getStableCreatureAimCenter: options.getStableCreatureAimCenter,
        isTurretLikeCreature: options.isTurretLikeCreature,
        hasCreatureLineOfSight: options.hasCreatureLineOfSight,
        getCreatureTargetPoint: options.getCreatureTargetPoint,
        birdTrackReleaseRangeMultiplier: options.birdTrackReleaseRangeMultiplier,
        birdTrackReleaseRangePadding: options.birdTrackReleaseRangePadding,
        birdAvoidanceVerticalThreshold: options.birdAvoidanceVerticalThreshold,
        clampToRange: options.clampToRange,
        movementSettings: options.creatureRuntimeMovementSettings,
        moveCreatureWithEnvironmentCollisions: options.moveCreatureWithEnvironmentCollisions,
        spawnCreatureProjectile: (creature: any, targetX: number, targetY: number, aimOriginOverride?: any) =>
            creatureProjectileRuntime.spawnCreatureProjectile(creature, targetX, targetY, aimOriginOverride),
        getNextCreatureFireAt: options.getNextCreatureFireAt,
        getAnimatedBirdSpriteType: options.getAnimatedBirdSpriteType,
        getTurretFacingRotations: options.getTurretFacingRotations,
        createCreatureCarryProxy: (creature: any) => {
            const proxy = options.spawnCreatureCarryProxy(creature);
            proxy.ttlFrames = undefined;
            proxy.ambientSoundKey = undefined;
        },
        gameAudio: options.gameAudio
    });

    const heldItemRuntime = createGameHeldItemRuntime({
        astronaut: options.astronaut,
        movementSettings: options.movementSettings,
        heldCollectableHandInset: options.heldCollectableHandInset,
        heldCollectableHandOverlap: options.heldCollectableHandOverlap,
        spriteScale: options.spriteScale,
        keys: options.keys,
        getPrevKeys: options.getPrevKeys,
        getFacingLeft: options.getFacingLeft,
        getFacingSign: options.getFacingSign,
        getThrowAngleDegrees: options.getThrowAngleDegrees,
        getAstronautRect: options.getAstronautRect,
        getEntityCollisionBounds: options.getEntityCollisionBounds,
        getEntityRect: options.getEntityRect,
        getEntityCenter: options.getEntityCenter,
        getAstronautRenderedWorldSprite: options.getAstronautRenderedWorldSprite,
        getRenderedEntityWorldSprite: options.getRenderedEntityWorldSprite,
        getSpriteVisibleBounds: options.getSpriteVisibleBounds,
        getCollectableEntities: options.getCollectableEntities,
        getHeldCollectable: options.getHeldCollectable,
        setHeldCollectable: options.setHeldCollectable,
        getStoredCollectables: options.getStoredCollectables,
        getInventoryCycleIndex: options.getInventoryCycleIndex,
        setInventoryCycleIndex: options.setInventoryCycleIndex,
        creatureRuntime,
        spawnCreatureCarryProxy: options.spawnCreatureCarryProxy,
        markCollectableCollected: options.markCollectableCollected,
        isCollectableCollected: options.isCollectableCollected,
        isGrenadeCollectable: options.isGrenadeCollectable,
        setGrenadeCollectableArmedState: options.setGrenadeCollectableArmedState,
        removeCollectableEntity: options.removeCollectableEntity,
        restoreCreatureFromPayload: (payload: any, position: { x: number; y: number }) => {
            const restoredCreature = options.assignEntityId(new Creature({
                ...(payload as any),
                x: position.x,
                y: position.y
            }));
            options.getCreatureEntities().push(restoredCreature);
        },
        getSound: options.getSound,
        saveSound: options.saveSound
    });

    const throwGuideRuntime = createGameThrowGuideRuntime({
        keys: options.keys,
        movementSettings: options.movementSettings,
        canvas: options.canvas,
        getFacingSign: options.getFacingSign,
        getAimOriginPosition: heldItemRuntime.getAimOriginPosition,
        getThrowAngleDegrees: options.getThrowAngleDegrees,
        setThrowAngleDegrees: options.setThrowAngleDegrees,
        getThrowGuideDots: options.getThrowGuideDots,
        setThrowGuideDots: options.setThrowGuideDots,
        getThrowGuideDotEmitTimer: options.getThrowGuideDotEmitTimer,
        setThrowGuideDotEmitTimer: options.setThrowGuideDotEmitTimer
    });

    const collectablePhysicsRuntime = createGameCollectablePhysics({
        getAstronautRenderedWorldSprite: options.getAstronautRenderedWorldSprite,
        getCollectableEntities: options.getCollectableEntities,
        isLooseCollectable: (collectable: any) =>
            isLooseCollectable(collectable, options.isCollectableCollected),
        isCreatureProjectileCollectable: options.isCreatureProjectileCollectable,
        getAstronautRect: options.getAstronautRect,
        getEntityCollisionBounds: options.getEntityCollisionBounds,
        getEntityRect: options.getEntityRect,
        doRenderedSpritesOverlap: options.doRenderedSpritesOverlap,
        getRenderedEntityWorldSprite: options.getRenderedEntityWorldSprite,
        getCollectablePhysicsSettings: options.getCollectablePhysicsSettings,
        moveCollectableHorizontally: options.moveCollectableHorizontally,
        moveCollectableVertically: options.moveCollectableVertically,
        getGameState: options.getGameState,
        getAstronaut: options.getAstronaut,
        getDynamicObjectHeadBounceLaunchSpeed: options.getDynamicObjectHeadBounceLaunchSpeed,
        getDynamicObjectPushScale: options.getDynamicObjectPushScale,
        getDynamicObjectPushedVelocity: options.getDynamicObjectPushedVelocity,
        applyDynamicObjectGravity: options.applyDynamicObjectGravity,
        getEffectiveWindToggles: options.getEffectiveWindToggles,
        getWindSettings: options.getWindSettings,
        getWindDebugToggles: options.getWindDebugToggles,
        getActiveWindEmittersNearAstronaut: options.getActiveWindEmittersNearAstronaut,
        computeEmitterWindAccelerationAtPoint: options.computeEmitterWindAccelerationAtPoint,
        applySurfaceWindField: options.applySurfaceWindField,
        normalizeWindSettings: options.normalizeWindSettings,
        getSurfaceWindEdgeProximity: options.getSurfaceWindEdgeProximity,
        getSurfaceWindBoundaryOvershoot: options.getSurfaceWindBoundaryOvershoot,
        clampToRange: options.clampToRange,
        movementSettings: options.collectablePhysicsMovementSettings,
        spriteScale: options.spriteScale,
        collidesAtSide: options.collidesAtSide,
        getFloorSnapAmount: options.getFloorSnapAmount,
        applyDynamicObjectBounceRestitution: options.applyDynamicObjectBounceRestitution,
        applyDynamicObjectGroundFriction: options.applyDynamicObjectGroundFriction,
        gameAudio: options.gameAudio,
        astronautPosition: options.getAstronautPosition,
        getMushroomBlocks: options.getMushroomBlocks,
        isGrenadeCollectable: options.isGrenadeCollectable,
        syncGrenadeFuseState: options.syncGrenadeFuseState,
        explodeCollectableGrenade: (collectable: any) =>
            creatureProjectileRuntime.explodeCollectableGrenade(collectable),
        isCollectableOverlappingAstronaut: heldItemRuntime.isCollectableOverlappingAstronaut,
        removeCollectableEntity: options.removeCollectableEntity,
        updateCreatureProjectileCollectable: (projectile: any) =>
            creatureProjectileRuntime.updateCreatureProjectileCollectable(projectile),
        shouldRunChunkBandUpdate: options.shouldRunChunkBandUpdate,
        getChunkActivityForEntityPosition: options.getChunkActivityForEntityPosition,
        projectileChunkCadence: options.projectileChunkCadence,
        collectableChunkCadence: options.collectableChunkCadence
    });

    creatureProjectileRuntime = createCreatureProjectileRuntime({
        spriteScale: options.spriteScale,
        movementSettings: options.creatureProjectileRuntimeMovementSettings,
        creatureProjectileSettings: options.creatureProjectileSettings,
        getCollectableEntities: options.getCollectableEntities,
        getCreatureEntities: options.getCreatureEntities,
        getAstronautRect: options.getAstronautRect,
        getAstronautPosition: options.getAstronautPosition,
        getProjectileKindForFireMode: options.getProjectileKindForFireMode,
        getProjectileSettings: options.getProjectileSettings,
        updateProjectileFlightFrame: options.updateProjectileFlightFrame,
        getTurretFacingRotations: options.getTurretFacingRotations,
        isTurretLikeCreature: options.isTurretLikeCreature,
        getEntityCollisionBounds: options.getEntityCollisionBounds,
        getEntityCenter: options.getEntityCenter,
        getEntityRect: options.getEntityRect,
        getEntityFrontAnchorPoint: options.getEntityFrontAnchorPoint,
        getEntitySideAnchorPoint: options.getEntitySideAnchorPoint,
        getEntityPositionFromCenter: options.getEntityPositionFromCenter,
        getProjectileAngleDegrees: options.getProjectileAngleDegrees,
        assignEntityId: options.assignEntityId,
        syncGrenadeFuseState: options.syncGrenadeFuseState,
        getDefaultGrenadeExplosionPower: options.getDefaultGrenadeExplosionPower,
        getGrenadeExplosionRadius: options.getGrenadeExplosionRadius,
        getGrenadeExplosionPower: options.getGrenadeExplosionPower,
        getExplosionDamageSource: options.getExplosionDamageSource,
        isGrenadeCollectable: options.isGrenadeCollectable,
        removeCollectableEntity: options.removeCollectableEntity,
        updateSingleCollectablePhysics: collectablePhysicsRuntime.updateSingleCollectablePhysics,
        getCreatureProjectilePhysicsSettings: options.getCreatureProjectilePhysicsSettings,
        isSolidAtWorld: options.isSolidAtWorld,
        getRenderedEntityWorldSprite: options.getRenderedEntityWorldSprite,
        getAstronautRenderedWorldSprite: options.getAstronautRenderedWorldSprite,
        isRenderedSpriteOpaqueAtWorld: options.isRenderedSpriteOpaqueAtWorld,
        spawnProjectileImpactEffect: options.spawnProjectileImpactEffect,
        applyDamageToCreature: creatureRuntime.applyDamageToCreature,
        applyAstronautProjectileImpact: options.applyAstronautProjectileImpact,
        applyAstronautDamage: options.applyAstronautDamage,
        applyAstronautImpact: options.applyAstronautImpact,
        isCoroniumExplosionAtCenter: options.isCoroniumExplosionAtCenter,
        applyExplosionDamageToDestructibles: options.applyExplosionDamageToDestructibles,
        getDoorCount: options.getDoorCount,
        gameAudio: options.gameAudio,
        getBulletImpactAudioSettings: options.getBulletImpactAudioSettings,
        convertProjectileToEnergyPodCollectable: options.convertProjectileToEnergyPodCollectable,
        triggerAstronautEmergencyTeleport: options.triggerAstronautEmergencyTeleport,
        isCreatureProjectileCollectable: options.isCreatureProjectileCollectable,
        spawnGrenadeExplosionEffect: options.spawnGrenadeExplosionEffect
    });

    return {
        creatureRuntime,
        creatureProjectileRuntime,
        heldItemRuntime,
        throwGuideRuntime,
        collectablePhysicsRuntime
    };
}
