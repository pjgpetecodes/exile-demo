import type { DynamicObjectPhysicsSettings } from '../../physics/object-physics.js';
import type { Collectable } from '../../entities/collectable.js';

type CollectablePhysicsFactoryOptions = {
    getAstronautRenderedWorldSprite: () => { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null;
    getCollectableEntities: () => Collectable[];
    isLooseCollectable: (collectable: Collectable) => boolean;
    isCreatureProjectileCollectable: (collectable: Collectable) => boolean;
    getAstronautRect: () => { left: number; right: number; top: number; bottom: number };
    getEntityCollisionBounds: (entity: any) => { left: number; right: number; top: number; bottom: number };
    getEntityRect: (x: number, y: number, bounds: { left: number; right: number; top: number; bottom: number }) => { left: number; right: number; top: number; bottom: number };
    doRenderedSpritesOverlap: (
        left: { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null,
        right: { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null
    ) => boolean;
    getRenderedEntityWorldSprite: (entity: any) => { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null;
    getCollectablePhysicsSettings: (collectable: Collectable) => DynamicObjectPhysicsSettings;
    moveCollectableHorizontally: (collectable: Collectable, amount: number) => number;
    moveCollectableVertically: (collectable: Collectable, amount: number) => number;
    getGameState: () => any;
    getAstronaut: () => any;
    getDynamicObjectHeadBounceLaunchSpeed: (
        body: Collectable,
        impactSpeed: number,
        settings: DynamicObjectPhysicsSettings
    ) => number;
    getDynamicObjectPushScale: (body: Collectable, settings: DynamicObjectPhysicsSettings) => number;
    getDynamicObjectPushedVelocity: (
        sourceVelocity: number,
        body: Collectable,
        settings: DynamicObjectPhysicsSettings
    ) => number;
    applyDynamicObjectGravity: (body: Collectable, settings: DynamicObjectPhysicsSettings) => void;
    getEffectiveWindToggles: (windSettings: any, windDebugToggles: any) => any;
    getWindSettings: () => any;
    getWindDebugToggles: () => any;
    getActiveWindEmittersNearAstronaut: (now: number, toggles: any) => any[];
    computeEmitterWindAccelerationAtPoint: (
        x: number,
        y: number,
        now: number,
        emitters: any[],
        target: 'astronaut' | 'looseObject'
    ) => { x: number; y: number; activeEmitterCount: number };
    applySurfaceWindField: (x: number, y: number, now: number, settings: any) => { x: number; y: number };
    normalizeWindSettings: (settings: any) => any;
    getSurfaceWindEdgeProximity: (x: number, settings: any) => { edgeProximity: number };
    getSurfaceWindBoundaryOvershoot: (x: number, settings: any) => { maxOvershoot: number };
    clampToRange: (value: number, minimum: number, maximum: number) => number;
    movementSettings: any;
    spriteScale: number;
    collidesAtSide: (
        x: number,
        y: number,
        bounds: { left: number; right: number; top: number; bottom: number },
        side: 'left' | 'right' | 'top' | 'bottom'
    ) => boolean;
    getFloorSnapAmount: (x: number, y: number, bounds: { left: number; right: number; top: number; bottom: number }) => number;
    applyDynamicObjectBounceRestitution: (
        body: Collectable,
        speed: number,
        settings: DynamicObjectPhysicsSettings
    ) => number;
    applyDynamicObjectGroundFriction: (
        body: Collectable,
        settings: DynamicObjectPhysicsSettings,
        threshold?: number
    ) => void;
    gameAudio: {
        playManifestSound: (key: string, volume?: number) => void;
        playPlasmaGrenadeImpactSound: () => void;
        updateGrenadeArmedLoopSound: (collectables: Collectable[], predicate: (collectable: Collectable) => boolean) => void;
        updateMushroomAmbientLoopSound: (options: any) => void;
    };
    astronautPosition: () => { x: number; y: number };
    getMushroomBlocks: () => Array<{ x: number; y: number }>;
    isGrenadeCollectable: (collectable: Collectable | null | undefined) => boolean;
    syncGrenadeFuseState: (collectable: Collectable, now: number) => void;
    explodeCollectableGrenade: (collectable: Collectable) => void;
    isCollectableOverlappingAstronaut: (collectable: Collectable) => boolean;
    removeCollectableEntity: (collectable: Collectable) => void;
    updateCreatureProjectileCollectable: (collectable: any) => void;
    shouldRunChunkBandUpdate: (chunkActivity: any, cadencePolicy: any, simulationFrame: number) => boolean;
    getChunkActivityForEntityPosition: (entity: { x: number; y: number }, now: number) => any;
    projectileChunkCadence: any;
    collectableChunkCadence: any;
};

export function createGameCollectablePhysics(options: CollectablePhysicsFactoryOptions) {
    function resolveAstronautCollectableCollisions(horizontalMovement: number, verticalMovement: number) {
        const astronautRendered = options.getAstronautRenderedWorldSprite();
        for (const collectable of options.getCollectableEntities()) {
            if (!options.isLooseCollectable(collectable)) continue;
            if (options.isCreatureProjectileCollectable(collectable)) continue;
            if (collectable.astronautCollisionIgnoreFrames > 0) continue;

            const astronautRect = options.getAstronautRect();
            const bounds = options.getEntityCollisionBounds(collectable);
            const collectableRect = options.getEntityRect(collectable.x, collectable.y, bounds);
            const overlapX = Math.min(astronautRect.right, collectableRect.right) - Math.max(astronautRect.left, collectableRect.left) + 1;
            const overlapY = Math.min(astronautRect.bottom, collectableRect.bottom) - Math.max(astronautRect.top, collectableRect.top) + 1;
            if (overlapX <= 0 || overlapY <= 0) continue;
            if (!options.doRenderedSpritesOverlap(astronautRendered, options.getRenderedEntityWorldSprite(collectable))) continue;

            const gameState = options.getGameState();
            const astronaut = options.getAstronaut();
            const shouldResolveHorizontally = overlapX <= overlapY;
            if (shouldResolveHorizontally) {
                const horizontalDirection = horizontalMovement !== 0
                    ? Math.sign(horizontalMovement)
                    : ((astronautRect.left + astronautRect.right) / 2) < ((collectableRect.left + collectableRect.right) / 2) ? -1 : 1;
                const pushAmount = Math.ceil(overlapX);
                if (horizontalMovement !== 0) {
                    const physicsSettings = options.getCollectablePhysicsSettings(collectable);
                    const pushScale = options.getDynamicObjectPushScale(collectable, physicsSettings);
                    const requestedPush = Math.max(1, Math.ceil(pushAmount * pushScale));
                    const moved = options.moveCollectableHorizontally(collectable, horizontalDirection * requestedPush);
                    const remaining = pushAmount - Math.abs(moved);
                    if (remaining > 0) {
                        gameState.astronaut.position.x -= horizontalDirection * remaining;
                        astronaut.velocity.x = 0;
                    }
                    collectable.velocity.x = options.getDynamicObjectPushedVelocity(
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
                const physicsSettings = options.getCollectablePhysicsSettings(collectable);
                const launchSpeed = options.getDynamicObjectHeadBounceLaunchSpeed(collectable, impactSpeed, physicsSettings);
                const liftAmount = Math.ceil(overlapY);
                const desiredLift = Math.min(liftAmount, Math.ceil(launchSpeed));
                const movedUp = desiredLift > 0 ? Math.abs(options.moveCollectableVertically(collectable, -desiredLift)) : 0;
                const remaining = liftAmount - movedUp;

                astronaut.velocity.y = Math.max(astronaut.velocity.y, 0);
                if (movedUp > 0) {
                    collectable.isGrounded = false;
                    collectable.velocity.y = Math.min(collectable.velocity.y, -launchSpeed);
                }
                if (remaining > 0) {
                    gameState.astronaut.position.y += remaining;
                }
            }
        }
    }

    function updateSingleCollectablePhysics(
        collectable: Collectable,
        physicsSettings: DynamicObjectPhysicsSettings = options.getCollectablePhysicsSettings(collectable),
        updateOptions: { bounceHorizontally?: boolean; groundFrictionStopThreshold?: number } = {},
        now: number = performance.now()
    ) {
        if (!options.isLooseCollectable(collectable)) {
            return { hitWorld: false, bounced: false, grounded: collectable.isGrounded };
        }
        if (collectable.astronautCollisionIgnoreFrames > 0) {
            collectable.astronautCollisionIgnoreFrames--;
        }

        const collisionBounds = options.getEntityCollisionBounds(collectable);
        const windSettings = options.getWindSettings();
        const windDebugToggles = options.getWindDebugToggles();
        const windToggles = options.getEffectiveWindToggles(windSettings, windDebugToggles);
        if (windToggles.windEnabled && !collectable.creatureProjectile) {
            const allEmitters = options.getActiveWindEmittersNearAstronaut(now, windToggles);
            const emitterWind = windToggles.emittersEnabled
                ? options.computeEmitterWindAccelerationAtPoint(collectable.x, collectable.y, now, allEmitters, 'looseObject')
                : { x: 0, y: 0, activeEmitterCount: 0 };
            const surfaceWind = windToggles.surfaceWindEnabled
                ? options.applySurfaceWindField(collectable.x, collectable.y, now, windSettings)
                : { x: 0, y: 0 };
            const totalWindX = emitterWind.x + surfaceWind.x;
            const totalWindY = emitterWind.y + surfaceWind.y;
            const normalizedSettings = options.normalizeWindSettings(windSettings);
            const surfaceEdgeProximity = windToggles.surfaceWindEnabled ? options.getSurfaceWindEdgeProximity(collectable.x, normalizedSettings).edgeProximity : 0;
            const surfaceOvershoot = windToggles.surfaceWindEnabled ? options.getSurfaceWindBoundaryOvershoot(collectable.x, normalizedSettings).maxOvershoot : 0;
            const maxWindAcceleration = options.movementSettings.windMaxAccelerationPerFrame
                * (1 + Math.pow(surfaceEdgeProximity, 1.8) * 1.5 + Math.min(0.2, surfaceOvershoot / 1200) * 0.5);
            const effectiveWeight = Math.max(0, Number(collectable.weight) || 0);
            const weightResistance = 1 / (1 + effectiveWeight * options.movementSettings.windWeightResistancePerUnit);
            collectable.velocity.x += options.clampToRange(totalWindX * weightResistance, -maxWindAcceleration, maxWindAcceleration);
            collectable.velocity.y += options.clampToRange(totalWindY * weightResistance, -maxWindAcceleration, maxWindAcceleration);
        }
        options.applyDynamicObjectGravity(collectable, physicsSettings);

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
                if (!options.collidesAtSide(stepTargetX, nextY, collisionBounds, horizontalDirection)) {
                    nextX = stepTargetX;
                } else {
                    hitWorld = true;
                    if (updateOptions.bounceHorizontally) {
                        const bounceRestitution = options.applyDynamicObjectBounceRestitution(collectable, Math.abs(collectable.velocity.x), physicsSettings);
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
                if (!options.collidesAtSide(nextX, stepTargetY, collisionBounds, verticalDirection)) {
                    nextY = stepTargetY;
                } else {
                    hitWorld = true;
                    if (verticalDirection === 'bottom') {
                        const impactSpeed = collectable.velocity.y;
                        const bounceRestitution = options.applyDynamicObjectBounceRestitution(collectable, impactSpeed, physicsSettings);
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
            const snapAmount = options.getFloorSnapAmount(nextX, nextY, collisionBounds);
            if (snapAmount > 0) {
                hitWorld = true;
                const snapImpactSpeed = collectable.velocity.y + snapAmount * physicsSettings.gravity * 2;
                const bounceRestitution = options.applyDynamicObjectBounceRestitution(collectable, snapImpactSpeed, physicsSettings);
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
            options.applyDynamicObjectGroundFriction(collectable, physicsSettings, updateOptions.groundFrictionStopThreshold);
        }
        return { hitWorld, bounced, grounded };
    }

    function updateCollectablePhysics(now: number, simulationFrame: number) {
        const collectableEntities = options.getCollectableEntities();
        for (const collectable of [...collectableEntities]) {
            const collectableChunkActivity = options.getChunkActivityForEntityPosition(collectable, now);
            if (options.isCreatureProjectileCollectable(collectable)) {
                if (!options.shouldRunChunkBandUpdate(collectableChunkActivity, options.projectileChunkCadence, simulationFrame)) continue;
                options.updateCreatureProjectileCollectable(collectable);
                continue;
            }
            if (!options.shouldRunChunkBandUpdate(collectableChunkActivity, options.collectableChunkCadence, simulationFrame)) continue;
            options.syncGrenadeFuseState(collectable, now);

            if (typeof collectable.ambientSoundKey === 'string') {
                const nextAmbientSoundAt = typeof collectable.nextAmbientSoundAt === 'number' ? collectable.nextAmbientSoundAt : 0;
                if (now >= nextAmbientSoundAt) {
                    const bounds = options.getEntityCollisionBounds(collectable);
                    const center = options.getEntityRect(collectable.x, collectable.y, bounds);
                    const astronautPosition = options.astronautPosition();
                    const distance = Math.hypot(((center.left + center.right) / 2) - astronautPosition.x, ((center.top + center.bottom) / 2) - astronautPosition.y);
                    const range = 280;
                    if (distance <= range) {
                        options.gameAudio.playManifestSound(collectable.ambientSoundKey, 0.35 * (1 - distance / range));
                    }
                    collectable.nextAmbientSoundAt = now + Math.max(250, collectable.ambientSoundIntervalMs ?? 1000);
                }
            }

            if (typeof collectable.ttlFrames === 'number') {
                collectable.ttlFrames--;
                if (collectable.ttlFrames <= 0) {
                    options.gameAudio.playManifestSound('teleport', 0.45);
                    options.removeCollectableEntity(collectable);
                    continue;
                }
            }

            if (
                options.isGrenadeCollectable(collectable) &&
                collectable.armed &&
                typeof collectable.armedAtMs === 'number' &&
                now - collectable.armedAtMs >= options.movementSettings.grenadeFuseMs
            ) {
                options.explodeCollectableGrenade(collectable);
                continue;
            }

            const surfaceResult = updateSingleCollectablePhysics(collectable, options.getCollectablePhysicsSettings(collectable), {}, now);
            if (
                collectable.type === 'plasma_grenade' &&
                (surfaceResult.hitWorld || options.isCollectableOverlappingAstronaut(collectable))
            ) {
                options.gameAudio.playPlasmaGrenadeImpactSound();
                options.explodeCollectableGrenade(collectable);
                continue;
            }
        }

        options.gameAudio.updateGrenadeArmedLoopSound(
            collectableEntities,
            (collectable) => options.isGrenadeCollectable(collectable) && collectable.armed
        );
        options.gameAudio.updateMushroomAmbientLoopSound({
            astronautPosition: options.astronautPosition(),
            mushrooms: options.getMushroomBlocks(),
            spriteScale: options.spriteScale,
            ambientRange: options.movementSettings.mushroomAmbientRange ?? 360,
            ambientBaseVolume: options.movementSettings.mushroomAmbientBaseVolume ?? 0.6,
            minDelayMs: options.movementSettings.mushroomAmbientMinDelayMs ?? 180,
            maxDelayMs: options.movementSettings.mushroomAmbientMaxDelayMs ?? 420,
            now
        });
    }

    return {
        resolveAstronautCollectableCollisions,
        updateSingleCollectablePhysics,
        updateCollectablePhysics
    };
}
