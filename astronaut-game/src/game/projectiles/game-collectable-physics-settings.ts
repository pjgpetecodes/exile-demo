import type { Collectable } from '../../entities/collectable.js';
import type { CreatureProjectileKind } from '../../types/index.js';

type PhysicsSettings = {
    gravity: number;
    terminalVelocity: number;
    bounceRestitution: number;
    bounceMinImpactSpeed: number;
    bounceWeightPenaltyPerUnit: number;
    groundFriction: number;
    pushVelocityMultiplier: number;
    pushMaxSpeed: number;
    pushResistancePerUnit: number;
    pushMinScale: number;
    headBounceMinImpactSpeed: number;
    headBounceMaxLaunchSpeed: number;
};

type CreatureProjectileSettings = {
    gravityScale?: number;
};

type CollectablePhysicsRuntimeOptions = {
    movementSettings: {
        collectableGravity: number;
        collectableTerminalVelocity: number;
        collectableBounceRestitution: number;
        collectableBounceMinImpactSpeed: number;
        collectableBounceWeightPenaltyPerUnit: number;
        collectableGroundFriction: number;
        collectablePushVelocityMultiplier: number;
        collectablePushMaxSpeed: number;
        collectablePushResistancePerUnit: number;
        collectablePushMinScale: number;
        headBounceMinImpactSpeed: number;
        collectableHeadBounceMaxLaunchSpeed: number;
        creatureProjectileGravity: number;
        creatureProjectileTerminalVelocity: number;
    };
    getProjectileSettings: (kind: CreatureProjectileKind) => CreatureProjectileSettings;
};

export function createCollectablePhysicsRuntime(options: CollectablePhysicsRuntimeOptions) {
    const COLLECTABLE_PHYSICS_SETTINGS = {
        gravity: options.movementSettings.collectableGravity,
        terminalVelocity: options.movementSettings.collectableTerminalVelocity,
        bounceRestitution: options.movementSettings.collectableBounceRestitution,
        bounceMinImpactSpeed: options.movementSettings.collectableBounceMinImpactSpeed,
        bounceWeightPenaltyPerUnit: options.movementSettings.collectableBounceWeightPenaltyPerUnit,
        groundFriction: options.movementSettings.collectableGroundFriction,
        pushVelocityMultiplier: options.movementSettings.collectablePushVelocityMultiplier,
        pushMaxSpeed: options.movementSettings.collectablePushMaxSpeed,
        pushResistancePerUnit: options.movementSettings.collectablePushResistancePerUnit,
        pushMinScale: options.movementSettings.collectablePushMinScale,
        headBounceMinImpactSpeed: options.movementSettings.headBounceMinImpactSpeed,
        headBounceMaxLaunchSpeed: options.movementSettings.collectableHeadBounceMaxLaunchSpeed
    } as const;

    function getCreatureProjectilePhysicsSettings(collectable: Pick<Collectable, 'bounciness' | 'creatureProjectile'>) {
        const projectileKind = collectable.creatureProjectile?.kind;
        const projectileSettings = projectileKind ? options.getProjectileSettings(projectileKind) : null;
        return {
            ...COLLECTABLE_PHYSICS_SETTINGS,
            gravity: options.movementSettings.creatureProjectileGravity * (projectileSettings?.gravityScale ?? 1),
            terminalVelocity: options.movementSettings.creatureProjectileTerminalVelocity,
            bounceRestitution: Math.max(0, collectable.bounciness),
            headBounceMaxLaunchSpeed: 0
        } as const;
    }

    function getCollectablePhysicsSettings(collectable: Pick<Collectable, 'bounciness' | 'creatureProjectile'>) {
        return collectable.creatureProjectile
            ? getCreatureProjectilePhysicsSettings(collectable)
            : COLLECTABLE_PHYSICS_SETTINGS;
    }

    return {
        COLLECTABLE_PHYSICS_SETTINGS,
        getCreatureProjectilePhysicsSettings,
        getCollectablePhysicsSettings
    };
}
