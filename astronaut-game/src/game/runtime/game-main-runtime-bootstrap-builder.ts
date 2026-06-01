import { createGameMainRuntimeBootstrap } from './game-main-runtime-assembly.js';

type ValuePack = Record<string, any>;

export function createGameMainRuntimeBootstrapFromContext(context: ValuePack) {
    return createGameMainRuntimeBootstrap({
        core: {
            astronaut: context.astronaut,
            movementSettings: context.movementSettings,
            creatureProjectileSettings: context.creatureProjectileSettings,
            spriteScale: context.spriteScale,
            canvas: context.canvas
        },
        input: {
            keys: context.keys,
            getPrevKeys: context.getPrevKeys,
            getFacingLeft: context.getFacingLeft,
            getFacingSign: context.getFacingSign
        },
        throwGuide: {
            getThrowAngleDegrees: context.getThrowAngleDegrees,
            setThrowAngleDegrees: context.setThrowAngleDegrees,
            getThrowGuideDots: context.getThrowGuideDots,
            setThrowGuideDots: context.setThrowGuideDots,
            getThrowGuideDotEmitTimer: context.getThrowGuideDotEmitTimer,
            setThrowGuideDotEmitTimer: context.setThrowGuideDotEmitTimer
        },
        entities: {
            getCreatureEntities: context.getCreatureEntities,
            getCollectableEntities: context.getCollectableEntities,
            getHeldCollectable: context.getHeldCollectable,
            setHeldCollectable: context.setHeldCollectable,
            getStoredCollectables: context.getStoredCollectables,
            getInventoryCycleIndex: context.getInventoryCycleIndex,
            setInventoryCycleIndex: context.setInventoryCycleIndex,
            getAstronautPosition: context.getAstronautPosition,
            getGameState: context.getGameState,
            getAstronaut: context.getAstronaut,
            getDoorCount: context.getDoorCount,
            getBulletImpactAudioSettings: context.getBulletImpactAudioSettings
        },
        geometry: {
            getAstronautRect: context.getAstronautRect,
            getAstronautAimPoint: context.getAstronautAimPoint,
            getAstronautRenderedWorldSprite: context.getAstronautRenderedWorldSprite,
            getEntityCollisionBounds: context.getEntityCollisionBounds,
            getEntityCenter: context.getEntityCenter,
            getEntityRect: context.getEntityRect,
            getEntityFrontAnchorPoint: context.getEntityFrontAnchorPoint,
            getEntitySideAnchorPoint: context.getEntitySideAnchorPoint,
            getEntityPositionFromCenter: context.getEntityPositionFromCenter,
            getSpriteVisibleBounds: context.getSpriteVisibleBounds,
            isRenderedSpriteOpaqueAtWorld: context.isRenderedSpriteOpaqueAtWorld,
            doRenderedSpritesOverlap: context.doRenderedSpritesOverlap,
            getRenderedEntityWorldSprite: context.getRenderedEntityWorldSprite
        },
        creatures: {
            getChunkActivityForEntityPosition: context.getChunkActivityForEntityPosition,
            shouldRunChunkBandUpdate: context.shouldRunChunkBandUpdate,
            creatureChunkCadence: context.creatureChunkCadence,
            getCreatureAuthoredType: context.getCreatureAuthoredType,
            isBirdCreature: context.isBirdCreature,
            getStableCreatureAimCenter: context.getStableCreatureAimCenter,
            isTurretLikeCreature: context.isTurretLikeCreature,
            hasCreatureLineOfSight: context.hasCreatureLineOfSight,
            getCreatureTargetPoint: context.getCreatureTargetPoint,
            birdTrackReleaseRangeMultiplier: context.birdTrackReleaseRangeMultiplier,
            birdTrackReleaseRangePadding: context.birdTrackReleaseRangePadding,
            birdAvoidanceVerticalThreshold: context.birdAvoidanceVerticalThreshold,
            clampToRange: context.clampToRange,
            moveCreatureWithEnvironmentCollisions: context.moveCreatureWithEnvironmentCollisions,
            getNextCreatureFireAt: context.getNextCreatureFireAt,
            getAnimatedBirdSpriteType: context.getAnimatedBirdSpriteType,
            getTurretFacingRotations: context.getTurretFacingRotations,
            spawnCreatureCarryProxy: context.spawnCreatureCarryProxy,
            gameAudio: context.gameAudio
        },
        collectables: {
            heldCollectableHandInset: context.heldCollectableHandInset,
            heldCollectableHandOverlap: context.heldCollectableHandOverlap,
            markCollectableCollected: context.markCollectableCollected,
            isCollectableCollected: context.isCollectableCollected,
            isGrenadeCollectable: context.isGrenadeCollectable,
            setGrenadeCollectableArmedState: context.setGrenadeCollectableArmedState,
            removeCollectableEntity: context.removeCollectableEntity,
            assignEntityId: context.assignEntityId,
            getSound: context.getSound,
            saveSound: context.saveSound,
            isCreatureProjectileCollectable: context.isCreatureProjectileCollectable,
            getCollectablePhysicsSettings: context.getCollectablePhysicsSettings,
            moveCollectableHorizontally: context.moveCollectableHorizontally,
            moveCollectableVertically: context.moveCollectableVertically,
            getMushroomBlocks: context.getMushroomBlocks,
            projectileChunkCadence: context.projectileChunkCadence,
            collectableChunkCadence: context.collectableChunkCadence,
            mushroomAmbientRange: context.mushroomAmbientRange,
            mushroomAmbientBaseVolume: context.mushroomAmbientBaseVolume,
            mushroomAmbientMinDelayMs: context.mushroomAmbientMinDelayMs,
            mushroomAmbientMaxDelayMs: context.mushroomAmbientMaxDelayMs,
            syncGrenadeFuseState: context.syncGrenadeFuseState
        },
        physics: {
            getDynamicObjectHeadBounceLaunchSpeed: context.getDynamicObjectHeadBounceLaunchSpeed,
            getDynamicObjectPushScale: context.getDynamicObjectPushScale,
            getDynamicObjectPushedVelocity: context.getDynamicObjectPushedVelocity,
            applyDynamicObjectGravity: context.applyDynamicObjectGravity,
            collidesAtSide: context.collidesAtSide,
            getFloorSnapAmount: context.getFloorSnapAmount,
            applyDynamicObjectBounceRestitution: context.applyDynamicObjectBounceRestitution,
            applyDynamicObjectGroundFriction: context.applyDynamicObjectGroundFriction
        },
        wind: {
            getEffectiveWindToggles: context.getEffectiveWindToggles,
            getWindSettings: context.getWindSettings,
            getWindDebugToggles: context.getWindDebugToggles,
            getActiveWindEmittersNearAstronaut: context.getActiveWindEmittersNearAstronaut,
            computeEmitterWindAccelerationAtPoint: context.computeEmitterWindAccelerationAtPoint,
            applySurfaceWindField: context.applySurfaceWindField,
            normalizeWindSettings: context.normalizeWindSettings,
            getSurfaceWindEdgeProximity: context.getSurfaceWindEdgeProximity,
            getSurfaceWindBoundaryOvershoot: context.getSurfaceWindBoundaryOvershoot
        },
        projectiles: {
            getProjectileKindForFireMode: context.getProjectileKindForFireMode,
            getProjectileSettings: context.getProjectileSettings,
            updateProjectileFlightFrame: context.updateProjectileFlightFrame,
            getProjectileAngleDegrees: context.getProjectileAngleDegrees,
            getDefaultGrenadeExplosionPower: context.getDefaultGrenadeExplosionPower,
            getGrenadeExplosionRadius: context.getGrenadeExplosionRadius,
            getGrenadeExplosionPower: context.getGrenadeExplosionPower,
            getExplosionDamageSource: context.getExplosionDamageSource,
            getCreatureProjectilePhysicsSettings: context.getCreatureProjectilePhysicsSettings
        },
        combat: {
            spawnProjectileImpactEffect: context.spawnProjectileImpactEffect,
            applyAstronautProjectileImpact: context.applyAstronautProjectileImpact,
            applyAstronautDamage: context.applyAstronautDamage,
            applyAstronautImpact: context.applyAstronautImpact,
            isCoroniumExplosionAtCenter: context.isCoroniumExplosionAtCenter,
            applyExplosionDamageToDestructibles: context.applyExplosionDamageToDestructibles,
            convertProjectileToEnergyPodCollectable: context.convertProjectileToEnergyPodCollectable,
            triggerAstronautEmergencyTeleport: context.triggerAstronautEmergencyTeleport,
            spawnGrenadeExplosionEffect: context.spawnGrenadeExplosionEffect
        },
        worldCollision: {
            getSolidBlockAtWorld: context.getSolidBlockAtWorld,
            getSpriteMap: context.getSpriteMap,
            spriteScale: context.spriteScale,
            getMapBlocks: context.getMapBlocks,
            getDoorEntities: context.getDoorEntities,
            getButtonEntities: context.getButtonEntities
        }
    });
}
