import { CreatureProjectileKind, CreatureProjectileSettings } from './types/index.js';

export type BulletImpactAudioKey = 'bulletExplosion' | 'bulletExplosion2';
export type BulletImpactAudioSettings = {
    primary: BulletImpactAudioKey;
    alternate: BulletImpactAudioKey;
    alternateChance: number;
    volume: number;
};

export const MOVEMENT_SETTINGS = {
    gravity: 0.035,
    groundedTakeoffImpulse: -0.8,
    headBounceRestitution: 0.35,
    headBounceMinImpactSpeed: 0.9,
    headBounceSlopeThreshold: 0.2,
    upAccel: -0.3,
    downAccel: 0.3,
    maxUpSpeed: -4,
    fallTerminalVelocity: 5.5,
    flyDownTerminalVelocity: 7.25,
    walkAccel: 0.3,
    walkMaxSpeed: 3,
    walkStartSpeed: 1,
    flyAccel: 0.28,
    flyMaxSpeed: 5.6,
    jetpackBoosterMultiplier: 1.85,
    jetpackBoosterEnergyCostPerFrame: 0.22,
    landingMomentumFactor: 0.65,
    landingMomentumMinSpeed: 0.35,
    walkStepUpHeight: 6,
    proneStepUpHeight: 2,
    collectablePushStepUpHeight: 10,
    heldWeightIgnoreThreshold: 0.3,
    heldWeightWalkPenaltyPerUnit: 0.12,
    heldWeightFlyPenaltyPerUnit: 0.1,
    heldWeightGravityBonusPerUnit: 0.08,
    heldWeightTerminalVelocityBonusPerUnit: 0.12,
    heldWeightMinScale: 0.45,
    collectableGravity: 0.05,
    collectableTerminalVelocity: 6,
    collectableGroundSnapDistance: 3,
    collectableGroundFriction: 0.18,
    collectableBounceRestitution: 0.48,
    collectableBounceMinImpactSpeed: 0.35,
    collectableBounceWeightPenaltyPerUnit: 0.25,
    collectableHeadBounceMaxLaunchSpeed: 2.6,
    collectablePushVelocityMultiplier: 1.1,
    collectablePushMaxSpeed: 5,
    collectablePushResistancePerUnit: 0.5,
    collectablePushMinScale: 0.2,
    collectablePickupRange: 52,
    collectableInventoryLimit: 5,
    creatureProjectileGravity: 0.05,
    creatureProjectileTerminalVelocity: 6,
    creatureProjectileLifetimeFrames: 180,
    creatureEnergyPodLifetimeFrames: 300,
    creatureGrenadeBounceRestitution: 0.42,
    grenadeFuseMs: 5000,
    grenadeExplosionPower: 4,
    plasmaGrenadeExplosionPower: 6,
    grenadeMaxExplosionPower: 6,
    grenadeExplosionRadius: 96,
    plasmaGrenadeExplosionRadius: 144,
    heldCollectableForwardOffset: 28,
    heldCollectableVerticalOffset: -6,
    droppedCollectableForwardOffset: 24,
    droppedCollectableAstronautIgnoreFrames: 18,
    droppedCollectableMomentumTransfer: 0.75,
    throwAngleAdjustDegreesPerFrame: 2.4,
    throwVelocity: 5.6,
    throwGuideDotSpeed: 14,
    throwGuideDotEmitIntervalFrames: 2,
    throwGuideDotsPerBurst: 2,
    throwGuideDotSize: 2.2,
    astronautMaxEnergy: 64,
    astronautDamageIntakeMultiplier: 2.5,
    astronautEmergencyTeleportEnergy: 1,
    astronautEnergyRegenAmount: 1,
    astronautEnergyRegenIntervalMs: 320,
    astronautDamageFlashMinIntervalMs: 55,
    astronautDamageFlashMaxIntervalMs: 210,
    astronautExplosionSpinChance: 0.08,
    astronautExplosionSpinMinForce: 1.2,
    windEmitterDefaultStrength: 0.18,
    windEmitterDefaultRadius: 220,
    windEmitterVariableDefaultHz: 1.2,
    windEmitterVariableDefaultAmount: 0.45,
    windMaxAccelerationPerFrame: 0.28,
    windWeightResistancePerUnit: 0.75,
    windParticlePerEmitterMaxPerFrame: 2,
    surfaceWindDefaultEnabled: false,
    surfaceWindDefaultMaxY: 3600,
    surfaceWindDefaultCenterX: 5200,
    surfaceWindDefaultDeadzone: 240,
    surfaceWindDefaultStrength: 0.09
} as const;

export const VIEWPORT_SETTINGS = {
    defaultWidth: 1000,
    defaultHeight: 675
} as const;

export const CHUNK_ACTIVITY_SETTINGS = {
    chunkWorldSize: 2048,
    radiiChunks: {
        near: 1,
        mid: 3
    },
    viewportRadiusScale: {
        near: 1,
        mid: 1.5
    },
    effectiveViewport: {
        defaultZoom: 1,
        expandedViewZoom: 1,
        minZoom: 0.5,
        maxZoom: 2
    },
    chunkResidency: {
        basePrefetchRadiusChunks: 1,
        viewportChunkRadiusBaseline: 1,
        viewportExpansionRadiusScale: 1,
        expandedViewExtraRadiusChunks: 0,
        maxPrefetchRadiusChunks: 6
    },
    teleportKeepAliveMs: 1400,
    simulationCadenceFrames: {
        creatures: {
            near: 1,
            mid: 2,
            far: 0
        },
        collectables: {
            near: 1,
            mid: 2,
            far: 0
        },
        projectiles: {
            near: 1,
            mid: 2,
            far: 0
        },
        teleporters: {
            near: 1,
            mid: 2,
            far: 0
        }
    }
} as const;

export const BULLET_IMPACT_AUDIO_SETTINGS: BulletImpactAudioSettings = {
    primary: 'bulletExplosion',
    alternate: 'bulletExplosion2',
    alternateChance: 1 / 20,
    volume: 0.8
};

export const CREATURE_PROJECTILE_SETTINGS: Record<CreatureProjectileKind, CreatureProjectileSettings> = {
    bullet: {
        spriteType: 'bullet1',
        lifetimeFrames: MOVEMENT_SETTINGS.creatureProjectileLifetimeFrames,
        gravityScale: 0.2,
        speedMultiplier: 1,
        launchVerticalBias: 0,
        defaultWeight: 0.08,
        defaultBounciness: 0,
        damageMultiplier: 1,
        directHitDamageMultiplier: 1,
        angleMatchesVelocity: true,
        supportsHoming: true,
        flightAnimation: {
            frames: ['bullet1', 'bullet2', 'bullet3', 'bullet4', 'bullet5', 'bullet6'],
            frameDurationFrames: 2,
            paletteSource: 'projectile'
        },
        impactAnimation: {
            frames: ['explosion_half', 'explosion', 'explosion_half'],
            frameDurationFrames: 2,
            paletteSource: 'projectile'
        }
    },
    grenade: {
        spriteType: 'grenade',
        lifetimeFrames: MOVEMENT_SETTINGS.creatureProjectileLifetimeFrames,
        gravityScale: 1,
        speedMultiplier: 1,
        launchVerticalBias: -1.2,
        defaultWeight: 0.35,
        defaultBounciness: MOVEMENT_SETTINGS.creatureGrenadeBounceRestitution,
        damageMultiplier: 1,
        directHitDamageMultiplier: 1.5,
        splashRadius: 96,
        splashDamageMultiplier: 1,
        minimumSplashDamage: 0.5,
        impactAnimation: {
            frames: ['explosion_half', 'explosion', 'explosion'],
            frameDurationFrames: 3,
            paletteSource: 'projectile'
        }
    },
    plasma_grenade: {
        spriteType: 'fireball',
        lifetimeFrames: MOVEMENT_SETTINGS.creatureProjectileLifetimeFrames,
        gravityScale: 1,
        speedMultiplier: 0.95,
        launchVerticalBias: -1.35,
        defaultWeight: 0.42,
        defaultBounciness: MOVEMENT_SETTINGS.creatureGrenadeBounceRestitution * 0.95,
        damageMultiplier: 1.75,
        directHitDamageMultiplier: 2.1,
        splashRadius: 128,
        splashDamageMultiplier: 1.35,
        minimumSplashDamage: 0.9,
        impactAnimation: {
            frames: ['explosion_half', 'explosion', 'explosion', 'explosion_half'],
            frameDurationFrames: 3,
            paletteSource: 'projectile'
        }
    },
    energy_pod: {
        spriteType: 'energy_pod2',
        lifetimeFrames: MOVEMENT_SETTINGS.creatureEnergyPodLifetimeFrames,
        gravityScale: 1,
        speedMultiplier: 0.85,
        launchVerticalBias: -0.5,
        defaultWeight: 0.18,
        defaultBounciness: 0,
        damageMultiplier: 1,
        directHitDamageMultiplier: 1,
        spawnsCollectableOnImpact: true,
        spawnsCollectableOnExpire: true
    }
};
