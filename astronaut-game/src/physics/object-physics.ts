import { Position } from '../types/index.js';

export interface DynamicPhysicsBody {
    weight: number;
    velocity: Position;
    isGrounded: boolean;
}

export interface DynamicObjectPhysicsSettings {
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
}

export function applyDynamicObjectGravity(
    body: DynamicPhysicsBody,
    settings: DynamicObjectPhysicsSettings
) {
    body.velocity.y = Math.min(
        body.velocity.y + settings.gravity,
        settings.terminalVelocity
    );
}

export function getDynamicObjectPushScale(
    body: Pick<DynamicPhysicsBody, 'weight'>,
    settings: DynamicObjectPhysicsSettings
) {
    return getDynamicObjectWeightResponseScale(body, settings);
}

export function getDynamicObjectWeightResponseScale(
    body: Pick<DynamicPhysicsBody, 'weight'>,
    settings: DynamicObjectPhysicsSettings
) {
    return Math.max(
        settings.pushMinScale,
        1 - body.weight * settings.pushResistancePerUnit
    );
}

export function getDynamicObjectBounceRestitution(
    body: Pick<DynamicPhysicsBody, 'weight'>,
    impactSpeed: number,
    settings: DynamicObjectPhysicsSettings
) {
    if (
        impactSpeed < settings.bounceMinImpactSpeed ||
        settings.bounceRestitution <= 0
    ) {
        return 0;
    }

    const weightScale = Math.max(
        settings.pushMinScale,
        1 - body.weight * settings.bounceWeightPenaltyPerUnit
    );
    if (weightScale === 0) {
        return 0;
    }

    const impactScale = Math.max(
        0,
        Math.min(
            1,
            (impactSpeed - settings.bounceMinImpactSpeed) /
            Math.max(0.001, settings.terminalVelocity - settings.bounceMinImpactSpeed)
        )
    );

    return settings.bounceRestitution * weightScale * (0.75 + impactScale * 0.25);
}

export function getDynamicObjectHeadBounceLaunchSpeed(
    body: Pick<DynamicPhysicsBody, 'weight'>,
    impactSpeed: number,
    settings: DynamicObjectPhysicsSettings
) {
    if (impactSpeed < settings.headBounceMinImpactSpeed) {
        return 0;
    }

    const bounceRestitution = getDynamicObjectBounceRestitution(body, impactSpeed, settings);
    if (bounceRestitution <= 0) {
        return 0;
    }

    return Math.min(
        settings.headBounceMaxLaunchSpeed,
        impactSpeed * bounceRestitution
    );
}

export function getDynamicObjectPushedVelocity(
    horizontalMovement: number,
    body: Pick<DynamicPhysicsBody, 'weight'>,
    settings: DynamicObjectPhysicsSettings
) {
    const pushScale = getDynamicObjectPushScale(body, settings);
    return Math.max(
        -settings.pushMaxSpeed,
        Math.min(
            settings.pushMaxSpeed,
            horizontalMovement * settings.pushVelocityMultiplier * pushScale
        )
    );
}

export function applyDynamicObjectGroundFriction(
    body: Pick<DynamicPhysicsBody, 'velocity'>,
    settings: DynamicObjectPhysicsSettings,
    stopThreshold = 0.05
) {
    body.velocity.x *= 1 - settings.groundFriction;
    if (Math.abs(body.velocity.x) < stopThreshold) {
        body.velocity.x = 0;
    }
}
