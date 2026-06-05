import type { Creature } from '../../entities/creature.js';
import type { Position } from '../../types/index.js';
import type { AxisMovementResult } from '../collision/game-environment-collision.js';

type MapBlockLike = {
    x: number;
    y: number;
    type: string;
    entityId?: number;
};

const WASP_NEST_TYPE = 'beehive';
const WASP_MAX_ACTIVE_PER_NEST = 4;
const WASP_NEST_ACTIVATION_RANGE = 300;
const WASP_NEST_SPAWN_COOLDOWN_MS = 1250;
const WASP_HOME_PROXIMITY = 20;
const WASP_MAX_PATROL_DRIFT = 172;
const WASP_ATTACK_ENGAGE_DISTANCE_RATIO = 0.55;
const WASP_RETURN_TO_NEST_DISTANCE_RATIO = 0.82;
const WASP_SWARM_TURN_INTERVAL_MIN_MS = 260;
const WASP_SWARM_TURN_INTERVAL_MAX_MS = 900;
const WASP_SWARM_STEP_MIN = 0.35;
const WASP_SWARM_STEP_MAX = 1.25;
const WASP_ATTACK_SWARM_WEIGHT = 0.72;
const WASP_RETURN_SWARM_WEIGHT = 0.88;
const WASP_ATTACK_SOUND = 'WaspBuzz';
const WASP_RETURN_SOUND = 'WaspHome';

type CreatureRuntimeFactoryOptions = {
    getCreatureEntities: () => Creature[];
    getAstronautPosition: () => Position;
    getAstronautRect: () => { left: number; right: number; top: number; bottom: number };
    getAstronautAimPoint: () => Position;
    getEntityCollisionBounds: (entity: Creature) => { left: number; right: number; top: number; bottom: number };
    getEntityCenter: (
        x: number,
        y: number,
        bounds: { left: number; right: number; top: number; bottom: number }
    ) => Position;
    getChunkActivityForEntityPosition: (entity: { x: number; y: number }, now: number) => any;
    shouldRunChunkBandUpdate: (chunkActivity: any, cadencePolicy: any, simulationFrame: number) => boolean;
    creatureChunkCadence: any;
    getCreatureAuthoredType: (type: string, runtimeState: Record<string, unknown>) => string;
    isBirdCreature: (creature: Creature, authoredType?: string) => boolean;
    getStableCreatureAimCenter: (creature: Creature, rotation: number) => Position;
    isTurretLikeCreature: (creature: Creature) => boolean;
    hasCreatureLineOfSight: (start: Position, target: Position) => boolean;
    getCreatureTargetPoint: (creature: Creature, origin: Position, target: Position) => Position;
    birdTrackReleaseRangeMultiplier: number;
    birdTrackReleaseRangePadding: number;
    birdAvoidanceVerticalThreshold: number;
    clampToRange: (value: number, minimum: number, maximum: number) => number;
    movementSettings: {
        creatureProjectileGravity: number;
        collectablePickupRange: number;
    };
    moveCreatureWithEnvironmentCollisions: (creature: Creature, targetX: number, targetY: number) => AxisMovementResult;
    spawnCreatureProjectile: (creature: Creature, targetX: number, targetY: number, aimOriginOverride?: Position) => void;
    getNextCreatureFireAt: (frameNow: number, creature: Creature) => number;
    getAnimatedBirdSpriteType: (authoredType: string, frameNow: number, entityId?: number) => string;
    getAnimatedWaspSpriteType?: (
        authoredType: string,
        frameNow: number,
        behaviorState: 'attacking' | 'returning',
        stateStartedAt: number,
        entityId?: number
    ) => string;
    getTurretFacingRotations: (authoredRotation: number) => { left: number; right: number; authoredFacing: number };
    createCreatureCarryProxy: (creature: Creature) => void;
    getMapBlocks?: () => MapBlockLike[];
    spawnWaspFromNest?: (nestX: number, nestY: number, nestKey: string) => Creature;
    gameAudio: {
        playManifestSound: (key: string, volume?: number) => void;
    };
};

export function createCreatureRuntime(options: CreatureRuntimeFactoryOptions) {
    function removeCreatureEntity(creature: Creature) {
        const entities = options.getCreatureEntities();
        const index = entities.indexOf(creature);
        if (index >= 0) {
            entities.splice(index, 1);
        }
    }

    function markCreatureDamaged(creature: Creature, damage: number) {
        creature.currentDamage = Math.max(0, (creature.currentDamage ?? 0) + damage);
        const runtimeState = creature.state ?? {};
        runtimeState.damageFlashUntil = performance.now() + 180;
        creature.state = runtimeState;
    }

    function handleCreatureDeath(creature: Creature) {
        removeCreatureEntity(creature);
        if (creature.pickupEnabled) {
            options.createCreatureCarryProxy(creature);
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

    function getNearestPickupCreature() {
        let bestCreature: Creature | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;
        const astronautPosition = options.getAstronautPosition();

        for (const creature of options.getCreatureEntities()) {
            if (!creature.pickupEnabled || creature.fixed) continue;
            const bounds = options.getEntityCollisionBounds(creature);
            const creatureCenter = options.getEntityCenter(creature.x, creature.y, bounds);
            const distance = Math.hypot(creatureCenter.x - astronautPosition.x, creatureCenter.y - astronautPosition.y);
            if (distance > options.movementSettings.collectablePickupRange) continue;
            if (distance < bestDistance) {
                bestDistance = distance;
                bestCreature = creature;
            }
        }

        return bestCreature;
    }

    function isWaspType(type: string) {
        return /^wasp/i.test(type);
    }

    function getNestKey(nest: MapBlockLike) {
        if (typeof nest.entityId === 'number') {
            return `entity:${nest.entityId}`;
        }
        return `${Math.round(nest.x)}:${Math.round(nest.y)}`;
    }

    function setWaspBehaviorState(
        runtimeState: Record<string, unknown>,
        nextState: 'attacking' | 'returning',
        frameNow: number
    ) {
        if (runtimeState.waspBehaviorState !== nextState) {
            runtimeState.waspBehaviorState = nextState;
            runtimeState.waspBehaviorStateStartedAt = frameNow;
            runtimeState.waspAnimationStateStartedAt = frameNow;
        }
    }

    function updateCreatures(frameNow: number, simulationFrame: number) {
        const creatureEntities = options.getCreatureEntities();
        const astronautRect = options.getAstronautRect();
        const astronautCenter = {
            x: (astronautRect.left + astronautRect.right) / 2,
            y: (astronautRect.top + astronautRect.bottom) / 2
        };
        const astronautAimPoint = options.getAstronautAimPoint();

        if (typeof options.getMapBlocks === 'function' && typeof options.spawnWaspFromNest === 'function') {
            const nests = options.getMapBlocks().filter((block) => block.type === WASP_NEST_TYPE);
            for (const nest of nests) {
                const nestKey = getNestKey(nest);
                const activeNestWasps = creatureEntities.filter((creature) => {
                    const state = creature.state ?? {};
                    const authoredType = options.getCreatureAuthoredType(creature.type, state);
                    return isWaspType(authoredType) && state.waspNestKey === nestKey;
                });
                if (activeNestWasps.length >= WASP_MAX_ACTIVE_PER_NEST) {
                    continue;
                }
                if (Math.hypot(astronautCenter.x - nest.x, astronautCenter.y - nest.y) > WASP_NEST_ACTIVATION_RANGE) {
                    continue;
                }
                const nextSpawnAt = activeNestWasps.reduce((latest, creature) => {
                    const value = Number((creature.state ?? {}).waspNestNextSpawnAt);
                    return Number.isFinite(value) ? Math.max(latest, value) : latest;
                }, 0);
                if (frameNow < nextSpawnAt) {
                    continue;
                }
                const nestToAstronautX = astronautCenter.x - nest.x;
                const nestToAstronautY = astronautCenter.y - nest.y;
                const nestToAstronautDistance = Math.max(1, Math.hypot(nestToAstronautX, nestToAstronautY));
                const spawnDirectionX = nestToAstronautX / nestToAstronautDistance;
                const spawnDirectionY = nestToAstronautY / nestToAstronautDistance;
                const spawnX = nest.x + spawnDirectionX * 72 + (Math.random() * 2 - 1) * 10;
                const spawnY = nest.y + spawnDirectionY * 52 + (Math.random() * 2 - 1) * 8;
                const spawned = options.spawnWaspFromNest(
                    spawnX,
                    spawnY,
                    nestKey
                );
                const spawnState = spawned.state ?? {};
                spawnState.waspNestKey = nestKey;
                spawnState.waspBehaviorState = 'attacking';
                spawnState.waspBehaviorStateStartedAt = frameNow;
                spawnState.waspAnimationStateStartedAt = frameNow;
                spawnState.waspNestNextSpawnAt = frameNow + WASP_NEST_SPAWN_COOLDOWN_MS;
                spawned.state = spawnState;
            }
        }

        for (const creature of creatureEntities) {
            creature.previousX = creature.x;
            creature.previousY = creature.y;
            const creatureChunkActivity = options.getChunkActivityForEntityPosition(creature, frameNow);
            if (!options.shouldRunChunkBandUpdate(creatureChunkActivity, options.creatureChunkCadence, simulationFrame)) {
                continue;
            }

            const runtimeState = creature.state ?? {};
            const authoredType = options.getCreatureAuthoredType(creature.type, runtimeState);
            runtimeState.authoredType = authoredType;
            const robotLike = creature.archetype === 'robot' || /^robot/i.test(authoredType);
            const bird = options.isBirdCreature(creature, authoredType);
            const wasp = isWaspType(authoredType);
            const authoredRotation = typeof runtimeState.authoredRotation === 'number'
                ? Math.round(Number(runtimeState.authoredRotation))
                : (runtimeState.authoredRotation = creature.rotation);
            const turretAimCenter = options.getStableCreatureAimCenter(creature, authoredRotation);
            const bounds = options.getEntityCollisionBounds(creature);
            const creatureCenter = options.getEntityCenter(creature.x, creature.y, bounds);
            const dx = astronautCenter.x - creatureCenter.x;
            const dy = astronautCenter.y - creatureCenter.y;
            const distanceToAstronaut = Math.hypot(dx, dy);
            const trackRange = Math.max(creature.trackRange ?? 0, creature.followRange ?? 0);
            const trackingDistance = creature.movementMode === 'hover' && !wasp
                ? Math.abs(dx)
                : distanceToAstronaut;
            const wasTrackingAstronaut = runtimeState.followingAstronaut === true;
            const baseShouldTrackAstronaut = trackingDistance <= trackRange || (
                bird &&
                wasTrackingAstronaut &&
                distanceToAstronaut <= Math.max(
                    trackRange * options.birdTrackReleaseRangeMultiplier,
                    trackRange + options.birdTrackReleaseRangePadding
                )
            );
            let shouldTrackAstronaut = baseShouldTrackAstronaut;
            if (wasp) {
                const nestX = Number.isFinite(Number(runtimeState.waspNestX)) ? Number(runtimeState.waspNestX) : creature.homeX;
                const nestY = Number.isFinite(Number(runtimeState.waspNestY)) ? Number(runtimeState.waspNestY) : creature.homeY;
                runtimeState.waspNestX = nestX;
                runtimeState.waspNestY = nestY;
                creature.homeX = nestX;
                creature.homeY = nestY;
                creature.hostile = true;
                creature.pickupEnabled = true;
                creature.storable = true;
                creature.collision = true;
                creature.damageOnContact = Math.max(0.8, creature.damageOnContact ?? 0);
                const stateStartedAt = Number.isFinite(Number(runtimeState.waspBehaviorStateStartedAt))
                    ? Number(runtimeState.waspBehaviorStateStartedAt)
                    : frameNow;
                const behaviorState = runtimeState.waspBehaviorState === 'returning'
                    ? 'returning'
                    : 'attacking';
                runtimeState.waspBehaviorState = behaviorState;
                runtimeState.waspBehaviorStateStartedAt = stateStartedAt;
                runtimeState.waspAnimationStateStartedAt = Number.isFinite(Number(runtimeState.waspAnimationStateStartedAt))
                    ? Number(runtimeState.waspAnimationStateStartedAt)
                    : stateStartedAt;
                const homeDistance = Math.hypot(creature.x - nestX, creature.y - nestY);
                const attackEngageDistance = Math.max(88, trackRange * WASP_ATTACK_ENGAGE_DISTANCE_RATIO);
                const returnToNestDistance = Math.max(148, trackRange * WASP_RETURN_TO_NEST_DISTANCE_RATIO);
                const nextSwarmTurnAt = Number.isFinite(Number(runtimeState.waspNextSwarmTurnAt))
                    ? Number(runtimeState.waspNextSwarmTurnAt)
                    : 0;
                if (frameNow >= nextSwarmTurnAt) {
                    const heading = Math.random() * Math.PI * 2;
                    const stepMagnitude = WASP_SWARM_STEP_MIN + Math.random() * (WASP_SWARM_STEP_MAX - WASP_SWARM_STEP_MIN);
                    runtimeState.waspSwarmVectorX = Math.cos(heading) * stepMagnitude;
                    runtimeState.waspSwarmVectorY = Math.sin(heading) * stepMagnitude;
                    runtimeState.waspNextSwarmTurnAt = frameNow + Math.round(
                        WASP_SWARM_TURN_INTERVAL_MIN_MS +
                        Math.random() * (WASP_SWARM_TURN_INTERVAL_MAX_MS - WASP_SWARM_TURN_INTERVAL_MIN_MS)
                    );
                }

                if (behaviorState === 'returning') {
                    if (distanceToAstronaut <= attackEngageDistance) {
                        setWaspBehaviorState(runtimeState, 'attacking', frameNow);
                        shouldTrackAstronaut = true;
                        creature.followsAstronaut = true;
                    } else {
                        shouldTrackAstronaut = false;
                        creature.followsAstronaut = false;
                    }
                } else {
                    creature.followsAstronaut = true;
                    if (distanceToAstronaut >= returnToNestDistance && homeDistance > WASP_HOME_PROXIMITY) {
                        setWaspBehaviorState(runtimeState, 'returning', frameNow);
                        shouldTrackAstronaut = false;
                        creature.followsAstronaut = false;
                    } else if (distanceToAstronaut > attackEngageDistance && Math.random() < 0.06) {
                        setWaspBehaviorState(runtimeState, 'returning', frameNow);
                        shouldTrackAstronaut = false;
                        creature.followsAstronaut = false;
                    }
                }
            }
            const isTurret = options.isTurretLikeCreature(creature);
            const hasSightToAstronaut = !creature.requiresLineOfSight || options.hasCreatureLineOfSight(turretAimCenter, astronautCenter);
            const homeDistance = Math.hypot(creature.x - creature.homeX, creature.y - creature.homeY);
            let aimTarget = astronautAimPoint;
            let hasFiringTarget = shouldTrackAstronaut && hasSightToAstronaut;
            let hasAimTarget = shouldTrackAstronaut;

            if (isTurret) {
                const nextTargetRefreshAt = typeof runtimeState.nextTargetRefreshAt === 'number'
                    ? Number(runtimeState.nextTargetRefreshAt)
                    : 0;
                const hasCachedTarget = typeof runtimeState.targetX === 'number' && typeof runtimeState.targetY === 'number';
                if (!hasCachedTarget || frameNow >= nextTargetRefreshAt) {
                    if (shouldTrackAstronaut && hasSightToAstronaut) {
                        const refreshedTarget = options.getCreatureTargetPoint(creature, turretAimCenter, astronautAimPoint);
                        runtimeState.targetX = refreshedTarget.x;
                        runtimeState.targetY = refreshedTarget.y;
                        runtimeState.hasTarget = true;
                        runtimeState.nextTargetRefreshAt = frameNow + Math.max(0, creature.targetRefreshMs ?? 0);
                    } else {
                        delete runtimeState.targetX;
                        delete runtimeState.targetY;
                        runtimeState.hasTarget = false;
                        runtimeState.nextTargetRefreshAt = frameNow + Math.min(
                            80,
                            Math.max(0, creature.targetRefreshMs ?? 0) || 80
                        );
                    }
                }

                if (runtimeState.hasTarget === true && typeof runtimeState.targetX === 'number' && typeof runtimeState.targetY === 'number') {
                    aimTarget = {
                        x: Number(runtimeState.targetX),
                        y: Number(runtimeState.targetY)
                    };
                    hasAimTarget = true;
                    hasFiringTarget = shouldTrackAstronaut && hasSightToAstronaut;
                } else {
                    hasAimTarget = false;
                    hasFiringTarget = false;
                }
            }

            const turretAimDx = aimTarget.x - turretAimCenter.x;
            const shouldAutoAim = hasAimTarget && (creature.followsAstronaut || creature.fireMode !== 'none');

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
                nextX = options.clampToRange(
                    creature.x + horizontalDirection * speed,
                    creature.patrolMinX,
                    creature.patrolMaxX
                );
                if (jumpVelocity !== 0) {
                    nextY = creature.y + jumpVelocity;
                    const updatedJumpVelocity = jumpVelocity + options.movementSettings.creatureProjectileGravity * 7;
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
                const hoverRobotTracking = creature.movementMode === 'hover' &&
                    robotLike &&
                    creature.followsAstronaut &&
                    shouldTrackAstronaut;
                const waspSwarmVectorX = Number.isFinite(Number(runtimeState.waspSwarmVectorX))
                    ? Number(runtimeState.waspSwarmVectorX)
                    : 0;
                const waspSwarmVectorY = Number.isFinite(Number(runtimeState.waspSwarmVectorY))
                    ? Number(runtimeState.waspSwarmVectorY)
                    : 0;
                if (wasp && runtimeState.waspBehaviorState === 'returning') {
                    const toHomeX = creature.homeX - creature.x;
                    const toHomeY = creature.homeY - creature.y;
                    const homeDistance = Math.max(1, Math.hypot(toHomeX, toHomeY));
                    nextX = options.clampToRange(
                        creature.x + (toHomeX / homeDistance) * Math.max(0.7, speed * 0.82) + waspSwarmVectorX * WASP_RETURN_SWARM_WEIGHT,
                        creature.homeX - WASP_MAX_PATROL_DRIFT,
                        creature.homeX + WASP_MAX_PATROL_DRIFT
                    );
                    nextY = options.clampToRange(
                        creature.y + (toHomeY / homeDistance) * Math.max(0.7, speed * 0.82) + waspSwarmVectorY * WASP_RETURN_SWARM_WEIGHT,
                        creature.homeY - WASP_MAX_PATROL_DRIFT,
                        creature.homeY + WASP_MAX_PATROL_DRIFT
                    );
                } else if (wasp && creature.followsAstronaut && shouldTrackAstronaut) {
                    const normalizedDistance = distanceToAstronaut > 0.001 ? distanceToAstronaut : 1;
                    nextX = creature.x + (dx / normalizedDistance) * Math.max(0.9, speed) + waspSwarmVectorX * WASP_ATTACK_SWARM_WEIGHT;
                    nextY = creature.y + (dy / normalizedDistance) * Math.max(0.8, speed) + waspSwarmVectorY * WASP_ATTACK_SWARM_WEIGHT;
                } else if (creature.followsAstronaut && shouldTrackAstronaut) {
                    if (bird) {
                        const normalizedDistance = distanceToAstronaut > 0.001 ? distanceToAstronaut : 1;
                        nextX = creature.x + (dx / normalizedDistance) * Math.max(1, speed);
                        if (creature.movementMode === 'fly') {
                            nextY = creature.y + (dy / normalizedDistance) * Math.max(0.9, speed);
                        }
                    } else {
                        nextX = options.clampToRange(
                            creature.x + (Math.sign(dx) || 0) * speed,
                            creature.patrolMinX,
                            creature.patrolMaxX
                        );
                        if (creature.movementMode === 'fly' || hoverRobotTracking) {
                            nextY = options.clampToRange(
                                creature.y + (Math.sign(dy) || 0) * Math.max(0.5, speed * 0.75),
                                creature.patrolMinY,
                                creature.patrolMaxY
                            );
                        }
                    }
                } else {
                    if (creature.x <= creature.patrolMinX) {
                        horizontalDirection = 1;
                    } else if (creature.x >= creature.patrolMaxX) {
                        horizontalDirection = -1;
                    }
                    nextX = options.clampToRange(
                        creature.x + horizontalDirection * speed,
                        creature.patrolMinX,
                        creature.patrolMaxX
                    );
                }

                if (!wasp) {
                    const hoverPhase = typeof runtimeState.hoverPhase === 'number'
                        ? Number(runtimeState.hoverPhase)
                        : (frameNow / 180);
                    const nextHoverPhase = hoverPhase + Math.max(0.02, speed * 0.04);
                    runtimeState.hoverPhase = nextHoverPhase;

                    if (creature.movementMode === 'hover' && !hoverRobotTracking) {
                        nextY = options.clampToRange(
                            creature.homeY + Math.sin(nextHoverPhase) * creature.hoverAmplitude,
                            creature.patrolMinY,
                            creature.patrolMaxY
                        );
                    } else if (!creature.followsAstronaut || !shouldTrackAstronaut) {
                        const midY = (creature.patrolMinY + creature.patrolMaxY) / 2;
                        const amplitude = Math.max(2, (creature.patrolMaxY - creature.patrolMinY) / 2);
                        nextY = options.clampToRange(
                            midY + Math.sin(nextHoverPhase) * amplitude,
                            creature.patrolMinY,
                            creature.patrolMaxY
                        );
                    }
                }
            }

            runtimeState.patrolDirection = horizontalDirection;
            runtimeState.followingAstronaut = creature.followsAstronaut && shouldTrackAstronaut;
            if (wasp) {
                const behaviorState = runtimeState.waspBehaviorState === 'returning' ? 'returning' : 'attacking';
                creature.sound = {
                    ...(creature.sound ?? {}),
                    enabled: true,
                    sound: behaviorState === 'returning' ? WASP_RETURN_SOUND : WASP_ATTACK_SOUND,
                    intervalMs: behaviorState === 'returning' ? 980 : 420,
                    randomVarianceMs: behaviorState === 'returning' ? 220 : 110,
                    range: Math.max(220, creature.sound?.range ?? 0),
                    volume: behaviorState === 'returning' ? 0.86 : 0.72
                };
            }
            if (creature.fireMode !== 'none' && hasFiringTarget) {
                const nextFireAt = typeof runtimeState.nextFireAt === 'number'
                    ? Number(runtimeState.nextFireAt)
                    : 0;
                if (frameNow >= nextFireAt) {
                    options.spawnCreatureProjectile(creature, aimTarget.x, aimTarget.y, isTurret ? turretAimCenter : undefined);
                    runtimeState.nextFireAt = options.getNextCreatureFireAt(frameNow, creature);
                }
            }

            let birdChasingAstronaut = false;
            if (bird && creature.movementMode === 'fly') {
                birdChasingAstronaut = runtimeState.followingAstronaut === true;
                if (birdChasingAstronaut && Math.abs(dy) < options.birdAvoidanceVerticalThreshold) {
                    const avoidanceDirection = typeof runtimeState.birdAvoidanceDirection === 'number'
                        ? Math.sign(Number(runtimeState.birdAvoidanceDirection)) || 1
                        : (Math.sign(dx) || 1);
                    runtimeState.birdAvoidanceDirection = avoidanceDirection;
                    nextY += avoidanceDirection * Math.max(1, speed * 0.8);
                } else if (!birdChasingAstronaut) {
                    delete runtimeState.birdAvoidanceDirection;
                }
            }

            let movementResult: AxisMovementResult | null = null;
            if (creature.collision && !creature.fixed && creature.movementMode !== 'turret') {
                movementResult = options.moveCreatureWithEnvironmentCollisions(creature, nextX, nextY);
                nextX = movementResult.x;
                nextY = movementResult.y;
            }

            if (bird && creature.movementMode === 'fly' && movementResult) {
                if (birdChasingAstronaut) {
                    if (movementResult.movedY !== 0) {
                        runtimeState.birdAvoidanceDirection = Math.sign(movementResult.movedY) || runtimeState.birdAvoidanceDirection;
                    }
                    if (movementResult.blockedX && movementResult.blockedY) {
                        const currentAvoidance = typeof runtimeState.birdAvoidanceDirection === 'number'
                            ? Math.sign(Number(runtimeState.birdAvoidanceDirection)) || 1
                            : 1;
                        runtimeState.birdAvoidanceDirection = -currentAvoidance;
                    }
                }
            }

            creature.state = runtimeState;
            if (!bird || creature.movementMode !== 'fly') {
                creature.x = Math.round(nextX);
                creature.y = Math.round(nextY);
            }
            if (bird) {
                creature.type = options.getAnimatedBirdSpriteType(authoredType, frameNow, creature.entityId);
            } else if (wasp && options.getAnimatedWaspSpriteType) {
                const behaviorState = runtimeState.waspBehaviorState === 'returning' ? 'returning' : 'attacking';
                const stateStartedAt = Number.isFinite(Number(runtimeState.waspAnimationStateStartedAt))
                    ? Number(runtimeState.waspAnimationStateStartedAt)
                    : frameNow;
                runtimeState.waspAnimationStateStartedAt = stateStartedAt;
                creature.type = options.getAnimatedWaspSpriteType(
                    authoredType,
                    frameNow,
                    behaviorState,
                    stateStartedAt,
                    creature.entityId
                );
            }

            const shouldUseTurretAutoAim = shouldAutoAim && (
                creature.fixed ||
                creature.movementMode === 'turret' ||
                authoredRotation === 1 ||
                authoredRotation === 5
            );
            if (shouldUseTurretAutoAim) {
                const aimDeadZone = 4;
                const facingRotations = options.getTurretFacingRotations(authoredRotation);
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
            } else if (
                bird &&
                (authoredRotation === 1 || authoredRotation === 5) &&
                creature.x !== creature.previousX
            ) {
                creature.rotation = creature.x < creature.previousX ? 5 : 1;
            } else if (
                wasp &&
                (authoredRotation === 1 || authoredRotation === 5) &&
                creature.x !== creature.previousX
            ) {
                creature.rotation = creature.x < creature.previousX ? 5 : 1;
            } else {
                creature.rotation = authoredRotation;
            }
        }

        for (const predator of [...creatureEntities]) {
            if (!predator.canEatWasps) {
                continue;
            }
            const predatorChunkActivity = options.getChunkActivityForEntityPosition(predator, frameNow);
            if (!options.shouldRunChunkBandUpdate(predatorChunkActivity, options.creatureChunkCadence, simulationFrame)) {
                continue;
            }
            const predatorBounds = options.getEntityCollisionBounds(predator);
            const predatorCenter = options.getEntityCenter(predator.x, predator.y, predatorBounds);
            const prey = creatureEntities.find((candidate) =>
                candidate !== predator &&
                /^wasp/i.test(candidate.type) &&
                Math.hypot(
                    options.getEntityCenter(candidate.x, candidate.y, options.getEntityCollisionBounds(candidate)).x - predatorCenter.x,
                    options.getEntityCenter(candidate.x, candidate.y, options.getEntityCollisionBounds(candidate)).y - predatorCenter.y
                ) <= 42
            );
            if (!prey) {
                continue;
            }
            removeCreatureEntity(prey);
            predator.currentDamage = Math.max(0, predator.currentDamage - 0.5);
            options.gameAudio.playManifestSound('get', 0.5);
        }
    }

    return {
        removeCreatureEntity,
        applyDamageToCreature,
        getNearestPickupCreature,
        updateCreatures
    };
}
