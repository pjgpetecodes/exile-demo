import type { Creature } from '../../entities/creature.js';
import { WASP_SETTINGS } from '../../config/settings.js';
import type { Position } from '../../types/index.js';
import type { AxisMovementResult } from '../collision/game-environment-collision.js';
import { getGameThreadingService } from '../runtime/threading/game-threading-service.js';

type MapBlockLike = {
    x: number;
    y: number;
    type: string;
    entityId?: number;
    waspNestActivationDistance?: number;
    waspReturnDistance?: number;
    waspMaxActive?: number;
    waspAggression?: number;
    waspDamageOnContact?: number;
};

const WASP_NEST_TYPE = 'beehive';
const WASP_NEST_SPAWN_COOLDOWN_MS = 1250;
const WASP_NEST_SPAWN_FORWARD_OFFSET_X = 28;
const WASP_NEST_SPAWN_FORWARD_OFFSET_Y = 20;
const WASP_NEST_SPAWN_JITTER_X = 4;
const WASP_NEST_SPAWN_JITTER_Y = 3;
const WASP_NEST_DEACTIVATION_CHECK_INTERVAL_MS = 300;
const WASP_HOME_PROXIMITY = 20;
const WASP_MAX_PATROL_DRIFT = 172;
const WASP_ATTACK_ENGAGE_DISTANCE_RATIO = 0.55;
const WASP_SWARM_TURN_INTERVAL_MIN_MS = 260;
const WASP_SWARM_TURN_INTERVAL_MAX_MS = 900;
const WASP_SWARM_STEP_MIN = 0.35;
const WASP_SWARM_STEP_MAX = 1.25;
const WASP_ATTACK_SWARM_WEIGHT = 0.72;
const WASP_RETURN_SWARM_WEIGHT = 0.88;
const WASP_BUZZ_SWARM_WEIGHT = 1.08;
const WASP_BUZZ_ANCHOR_MIN_BLEND = 0.42;
const WASP_BUZZ_ANCHOR_MAX_BLEND = 0.7;
const WASP_BUZZ_PATROL_DRIFT_MULTIPLIER = 1.35;
const WASP_CHASE_LEASH_MIN_RATIO = 0.44;
const WASP_CHASE_LEASH_MAX_RATIO = 0.86;
const WASP_CHASE_REENGAGE_PADDING = 22;
const WASP_ATTACK_SOUND = 'WaspBuzz';
const WASP_RETURN_SOUND = 'WaspHome';
const threadingService = getGameThreadingService();

function getPositiveFiniteOrNull(value: unknown) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue) || numberValue <= 0) {
        return null;
    }
    return numberValue;
}

function getFiniteOrNull(value: unknown) {
    const numberValue = Number(value);
    if (!Number.isFinite(numberValue)) {
        return null;
    }
    return numberValue;
}

function getDeterministicWaspSeed(runtimeState: Record<string, unknown>, creature: Creature) {
    const existingSeed = Number(runtimeState.waspBehaviorSeed);
    if (Number.isFinite(existingSeed) && existingSeed >= 0 && existingSeed <= 1) {
        return existingSeed;
    }
    const nestKey = typeof runtimeState.waspNestKey === 'string' ? runtimeState.waspNestKey : '';
    const base = `${nestKey}|${creature.entityId ?? ''}|${Math.round(creature.homeX)}|${Math.round(creature.homeY)}`;
    let hash = 2166136261;
    for (let index = 0; index < base.length; index += 1) {
        hash ^= base.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    const seed = (hash >>> 0) / 0xffffffff;
    runtimeState.waspBehaviorSeed = seed;
    return seed;
}

function getThreadingCreatureKey(creature: Creature, index: number) {
    if (typeof creature.entityId === 'number') {
        return `entity:${creature.entityId}`;
    }
    return `index:${index}`;
}

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

type ActiveWaspNestState = {
    nestX: number;
    nestY: number;
    activationDistance: number;
    deactivationDistance: number;
    maxActive: number;
    aggression: number;
    damageOnContact: number;
    nextSpawnAt: number;
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

    function getNestKeyFromPosition(x: number, y: number) {
        return `nest:${Math.round(x)}:${Math.round(y)}`;
    }

    function getNestKey(nest: MapBlockLike) {
        return getNestKeyFromPosition(nest.x, nest.y);
    }

    const activeWaspNestsByKey = new Map<string, ActiveWaspNestState>();
    let nextWaspNestDeactivationCheckAt = 0;

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

    function removeActiveWaspsForNestKey(creatures: Creature[], nestKey: string) {
        for (let index = creatures.length - 1; index >= 0; index -= 1) {
            const creature = creatures[index];
            const runtimeState = creature.state ?? {};
            const authoredType = options.getCreatureAuthoredType(creature.type, runtimeState);
            if (!isWaspType(authoredType)) {
                continue;
            }
            if (runtimeState.waspNestKey === nestKey) {
                creatures.splice(index, 1);
            }
        }
    }

    function removeWaspsAnchoredToNestPosition(creatures: Creature[], nestX: number, nestY: number) {
        for (let index = creatures.length - 1; index >= 0; index -= 1) {
            const creature = creatures[index];
            const runtimeState = creature.state ?? {};
            const authoredType = options.getCreatureAuthoredType(creature.type, runtimeState);
            if (!isWaspType(authoredType)) {
                continue;
            }
            const waspNestX = Number.isFinite(Number(runtimeState.waspNestX))
                ? Number(runtimeState.waspNestX)
                : Number(creature.homeX);
            const waspNestY = Number.isFinite(Number(runtimeState.waspNestY))
                ? Number(runtimeState.waspNestY)
                : Number(creature.homeY);
            if (!Number.isFinite(waspNestX) || !Number.isFinite(waspNestY)) {
                continue;
            }
            if (Math.abs(waspNestX - nestX) <= 1 && Math.abs(waspNestY - nestY) <= 1) {
                creatures.splice(index, 1);
            }
        }
    }

    function runActiveNestDeactivationSweep(
        frameNow: number,
        astronautCenter: Position,
        creatures: Creature[]
    ) {
        if (activeWaspNestsByKey.size === 0) {
            let hasAnyWasp = false;
            for (const creature of creatures) {
                const runtimeState = creature.state ?? {};
                const authoredType = options.getCreatureAuthoredType(creature.type, runtimeState);
                if (isWaspType(authoredType)) {
                    hasAnyWasp = true;
                    break;
                }
            }
            if (!hasAnyWasp) {
                return;
            }
        }
        if (frameNow < nextWaspNestDeactivationCheckAt) {
            return;
        }
        nextWaspNestDeactivationCheckAt = frameNow + WASP_NEST_DEACTIVATION_CHECK_INTERVAL_MS;

        for (const creature of creatures) {
            const runtimeState = creature.state ?? {};
            const authoredType = options.getCreatureAuthoredType(creature.type, runtimeState);
            if (!isWaspType(authoredType)) {
                continue;
            }
            const nestX = Number.isFinite(Number(runtimeState.waspNestX))
                ? Number(runtimeState.waspNestX)
                : Number(creature.homeX);
            const nestY = Number.isFinite(Number(runtimeState.waspNestY))
                ? Number(runtimeState.waspNestY)
                : Number(creature.homeY);
            if (!Number.isFinite(nestX) || !Number.isFinite(nestY)) {
                continue;
            }
            const nestKey = getNestKeyFromPosition(nestX, nestY);
            if (runtimeState.waspNestKey !== nestKey) {
                runtimeState.waspNestKey = nestKey;
                creature.state = runtimeState;
            }
            if (activeWaspNestsByKey.has(nestKey)) {
                continue;
            }
            activeWaspNestsByKey.set(nestKey, {
                nestX,
                nestY,
                activationDistance: WASP_SETTINGS.nestActivationDistance,
                deactivationDistance: getPositiveFiniteOrNull(runtimeState.waspReturnToNestDistance)
                    ?? WASP_SETTINGS.returnToNestDistance,
                maxActive: Math.max(
                    1,
                    Math.round(getPositiveFiniteOrNull(runtimeState.waspNestMaxActive) ?? WASP_SETTINGS.maxActivePerNest)
                ),
                aggression: Math.max(
                    0,
                    Math.min(1, getFiniteOrNull(runtimeState.waspAggression) ?? WASP_SETTINGS.aggression)
                ),
                damageOnContact: Math.max(
                    0.1,
                    getPositiveFiniteOrNull(runtimeState.waspDamageOnContact) ?? WASP_SETTINGS.damageOnContact
                ),
                nextSpawnAt: Number.isFinite(Number(runtimeState.waspNestNextSpawnAt))
                    ? Number(runtimeState.waspNestNextSpawnAt)
                    : 0
            });
        }

        for (const [nestKey, nestState] of [...activeWaspNestsByKey.entries()]) {
            if (Math.hypot(astronautCenter.x - nestState.nestX, astronautCenter.y - nestState.nestY) <= nestState.deactivationDistance) {
                continue;
            }
            removeActiveWaspsForNestKey(creatures, nestKey);
            activeWaspNestsByKey.delete(nestKey);
        }
    }

    function updateCreatures(frameNow: number, simulationFrame: number) {
        const creatureEntities = options.getCreatureEntities();
        const waspsToDespawnAtNest: Creature[] = [];
        const astronautRect = options.getAstronautRect();
        const astronautCenter = {
            x: (astronautRect.left + astronautRect.right) / 2,
            y: (astronautRect.top + astronautRect.bottom) / 2
        };
        const astronautAimPoint = options.getAstronautAimPoint();
        runActiveNestDeactivationSweep(frameNow, astronautCenter, creatureEntities);
        const threadedAnimationRequests: Array<{
            key: string;
            kind: 'bird' | 'wasp';
            authoredType: string;
            frameNow: number;
            entityId?: number;
            behaviorState?: 'attacking' | 'returning';
            stateStartedAt?: number;
        }> = [];
        const threadedWaspSwarmRequests: Array<{
            key: string;
            frameNow: number;
            behaviorSeed: number;
        }> = [];

        if (typeof options.getMapBlocks === 'function' && typeof options.spawnWaspFromNest === 'function') {
            const nests = options.getMapBlocks().filter((block) => block.type === WASP_NEST_TYPE);
            for (const nest of nests) {
                const nestKey = getNestKey(nest);
                const nestState = activeWaspNestsByKey.get(nestKey) ?? {
                    nestX: nest.x,
                    nestY: nest.y,
                    activationDistance: WASP_SETTINGS.nestActivationDistance,
                    deactivationDistance: WASP_SETTINGS.returnToNestDistance,
                    maxActive: WASP_SETTINGS.maxActivePerNest,
                    aggression: WASP_SETTINGS.aggression,
                    damageOnContact: WASP_SETTINGS.damageOnContact,
                    nextSpawnAt: 0
                };
                const activeNestWasps = creatureEntities.filter((creature) => {
                    const state = creature.state ?? {};
                    const authoredType = options.getCreatureAuthoredType(creature.type, state);
                    return isWaspType(authoredType) && state.waspNestKey === nestKey;
                });
                nestState.nestX = nest.x;
                nestState.nestY = nest.y;
                nestState.activationDistance = getPositiveFiniteOrNull(nest.waspNestActivationDistance)
                    ?? WASP_SETTINGS.nestActivationDistance;
                nestState.deactivationDistance = getPositiveFiniteOrNull(nest.waspReturnDistance)
                    ?? WASP_SETTINGS.returnToNestDistance;
                nestState.maxActive = Math.max(
                    1,
                    Math.round(getPositiveFiniteOrNull(nest.waspMaxActive) ?? WASP_SETTINGS.maxActivePerNest)
                );
                nestState.aggression = Math.max(
                    0,
                    Math.min(1, getFiniteOrNull(nest.waspAggression) ?? WASP_SETTINGS.aggression)
                );
                nestState.damageOnContact = Math.max(
                    0.1,
                    getPositiveFiniteOrNull(nest.waspDamageOnContact) ?? WASP_SETTINGS.damageOnContact
                );
                const astronautDistanceFromNest = Math.hypot(
                    astronautCenter.x - nest.x,
                    astronautCenter.y - nest.y
                );
                const nestToAstronautX = astronautCenter.x - nest.x;
                const nestToAstronautY = astronautCenter.y - nest.y;
                const nestToAstronautDistance = Math.max(1, astronautDistanceFromNest);
                const spawnDirectionX = nestToAstronautX / nestToAstronautDistance;
                const spawnDirectionY = nestToAstronautY / nestToAstronautDistance;
                if (astronautDistanceFromNest > nestState.deactivationDistance) {
                    removeActiveWaspsForNestKey(creatureEntities, nestKey);
                    removeWaspsAnchoredToNestPosition(creatureEntities, nest.x, nest.y);
                    activeWaspNestsByKey.delete(nestKey);
                    continue;
                }
                if (astronautDistanceFromNest > nestState.activationDistance) {
                    continue;
                }
                if (!activeWaspNestsByKey.has(nestKey)) {
                    const nestSightTarget = {
                        x: nest.x + spawnDirectionX * 16,
                        y: nest.y + spawnDirectionY * 16
                    };
                    const hasSightToNest = options.hasCreatureLineOfSight(astronautCenter, nestSightTarget);
                    if (!hasSightToNest) {
                        continue;
                    }
                    activeWaspNestsByKey.set(nestKey, nestState);
                }
                if (activeNestWasps.length >= nestState.maxActive) {
                    continue;
                }
                if (frameNow < nestState.nextSpawnAt) {
                    continue;
                }
                const spawnX = nest.x
                    + spawnDirectionX * WASP_NEST_SPAWN_FORWARD_OFFSET_X
                    + (Math.random() * 2 - 1) * WASP_NEST_SPAWN_JITTER_X;
                const spawnY = nest.y
                    + spawnDirectionY * WASP_NEST_SPAWN_FORWARD_OFFSET_Y
                    + (Math.random() * 2 - 1) * WASP_NEST_SPAWN_JITTER_Y;
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
                nestState.nextSpawnAt = frameNow + WASP_NEST_SPAWN_COOLDOWN_MS;
                spawnState.waspNestNextSpawnAt = nestState.nextSpawnAt;
                spawnState.waspNestX = nest.x;
                spawnState.waspNestY = nest.y;
                spawnState.waspReturnToNestDistance = nestState.deactivationDistance;
                spawnState.waspNestMaxActive = nestState.maxActive;
                spawnState.waspAggression = nestState.aggression;
                spawnState.waspDamageOnContact = nestState.damageOnContact;
                spawned.damageOnContact = nestState.damageOnContact;
                spawned.state = spawnState;
            }
        }

        for (let index = 0; index < creatureEntities.length; index += 1) {
            const creature = creatureEntities[index];
            const runtimeState = creature.state ?? {};
            const authoredType = options.getCreatureAuthoredType(creature.type, runtimeState);
            const bird = options.isBirdCreature(creature, authoredType);
            const wasp = isWaspType(authoredType);
            if (bird || wasp) {
                const key = getThreadingCreatureKey(creature, index);
                threadedAnimationRequests.push({
                    key,
                    kind: bird ? 'bird' : 'wasp',
                    authoredType,
                    frameNow,
                    entityId: creature.entityId,
                    behaviorState: runtimeState.waspBehaviorState === 'returning' ? 'returning' : 'attacking',
                    stateStartedAt: Number(runtimeState.waspAnimationStateStartedAt)
                });
            }
            if (wasp) {
                const nextSwarmTurnAt = Number.isFinite(Number(runtimeState.waspNextSwarmTurnAt))
                    ? Number(runtimeState.waspNextSwarmTurnAt)
                    : 0;
                if (frameNow >= nextSwarmTurnAt) {
                    threadedWaspSwarmRequests.push({
                        key: getThreadingCreatureKey(creature, index),
                        frameNow,
                        behaviorSeed: getDeterministicWaspSeed(runtimeState, creature)
                    });
                }
            }
        }
        threadingService.queueCreatureAnimationFrame(frameNow, threadedAnimationRequests);
        threadingService.queueWaspSwarmFrame(frameNow, threadedWaspSwarmRequests);

        for (let creatureIndex = 0; creatureIndex < creatureEntities.length; creatureIndex += 1) {
            const creature = creatureEntities[creatureIndex];
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
                const configuredDamageOnContact = getPositiveFiniteOrNull(runtimeState.waspDamageOnContact)
                    ?? getPositiveFiniteOrNull(creature.damageOnContact)
                    ?? WASP_SETTINGS.damageOnContact;
                creature.damageOnContact = Math.max(0.1, configuredDamageOnContact);
                const stateStartedAt = Number.isFinite(Number(runtimeState.waspBehaviorStateStartedAt))
                    ? Number(runtimeState.waspBehaviorStateStartedAt)
                    : frameNow;
                const behaviorState = runtimeState.waspBehaviorState === 'returning'
                    ? 'returning'
                    : 'attacking';
                runtimeState.waspBehaviorState = behaviorState;
                runtimeState.waspBehaviorStateStartedAt = stateStartedAt;
                const behaviorSeed = getDeterministicWaspSeed(runtimeState, creature);
                const waspAggression = Math.max(
                    0,
                    Math.min(1, getFiniteOrNull(runtimeState.waspAggression) ?? (0.35 + behaviorSeed * 0.65))
                );
                runtimeState.waspAggression = waspAggression;
                const waspAttackPhaseMs = Number.isFinite(Number(runtimeState.waspAttackPhaseMs))
                    ? Number(runtimeState.waspAttackPhaseMs)
                    : Math.round(420 + behaviorSeed * 1320);
                runtimeState.waspAttackPhaseMs = waspAttackPhaseMs;
                runtimeState.waspAnimationStateStartedAt = Number.isFinite(Number(runtimeState.waspAnimationStateStartedAt))
                    ? Number(runtimeState.waspAnimationStateStartedAt)
                    : stateStartedAt;
                const homeDistance = Math.hypot(creature.x - nestX, creature.y - nestY);
                const attackEngageDistance = Math.max(88, trackRange * WASP_ATTACK_ENGAGE_DISTANCE_RATIO);
                const configuredReturnToNestDistance = getPositiveFiniteOrNull(runtimeState.waspReturnToNestDistance)
                    ?? WASP_SETTINGS.returnToNestDistance;
                const returnToNestDistance = Math.max(148, configuredReturnToNestDistance);
                const chaseLeashRatio = Math.min(
                    0.96,
                    (WASP_CHASE_LEASH_MIN_RATIO + (behaviorSeed * (WASP_CHASE_LEASH_MAX_RATIO - WASP_CHASE_LEASH_MIN_RATIO)))
                    + (waspAggression * 0.16)
                );
                const chaseLeashDistance = Math.max(
                    attackEngageDistance + WASP_CHASE_REENGAGE_PADDING,
                    returnToNestDistance * chaseLeashRatio
                );
                const nextSwarmTurnAt = Number.isFinite(Number(runtimeState.waspNextSwarmTurnAt))
                    ? Number(runtimeState.waspNextSwarmTurnAt)
                    : 0;
                if (frameNow >= nextSwarmTurnAt) {
                    const swarmKey = getThreadingCreatureKey(creature, creatureIndex);
                    const threadedWaspSwarm = threadingService.getWaspSwarm(swarmKey);
                    if (threadedWaspSwarm && threadedWaspSwarm.frameNow <= frameNow) {
                        runtimeState.waspSwarmVectorX = threadedWaspSwarm.swarmVectorX;
                        runtimeState.waspSwarmVectorY = threadedWaspSwarm.swarmVectorY;
                        runtimeState.waspNextSwarmTurnAt = threadedWaspSwarm.nextSwarmTurnAt;
                    } else {
                        const heading = Math.random() * Math.PI * 2;
                        const stepMagnitude = WASP_SWARM_STEP_MIN + Math.random() * (WASP_SWARM_STEP_MAX - WASP_SWARM_STEP_MIN);
                        runtimeState.waspSwarmVectorX = Math.cos(heading) * stepMagnitude;
                        runtimeState.waspSwarmVectorY = Math.sin(heading) * stepMagnitude;
                        runtimeState.waspNextSwarmTurnAt = frameNow + Math.round(
                            WASP_SWARM_TURN_INTERVAL_MIN_MS +
                            Math.random() * (WASP_SWARM_TURN_INTERVAL_MAX_MS - WASP_SWARM_TURN_INTERVAL_MIN_MS)
                        );
                    }
                }

                if (behaviorState === 'returning') {
                    if (homeDistance <= WASP_HOME_PROXIMITY) {
                        options.gameAudio.playManifestSound(WASP_RETURN_SOUND, 0.72);
                        waspsToDespawnAtNest.push(creature);
                        creature.state = runtimeState;
                        continue;
                    }
                    if (distanceToAstronaut <= attackEngageDistance) {
                        setWaspBehaviorState(runtimeState, 'attacking', frameNow);
                        shouldTrackAstronaut = true;
                        creature.followsAstronaut = true;
                    } else {
                        shouldTrackAstronaut = false;
                        creature.followsAstronaut = false;
                    }
                } else {
                    const closeThreatDistance = Math.max(64, attackEngageDistance * 0.72);
                    const persistentChaser = waspAggression >= 0.78;
                    const proximityPressure = Math.max(
                        0,
                        1 - (distanceToAstronaut / Math.max(closeThreatDistance + 1, returnToNestDistance))
                    );
                    const attackPressureWave = (Math.sin((frameNow + waspAttackPhaseMs) / 640) + 1) * 0.5;
                    const pressureScore = (waspAggression * 0.68) + (attackPressureWave * 0.6) + (proximityPressure * 0.34);
                    const pursuingAstronaut = distanceToAstronaut <= closeThreatDistance
                        || (
                            distanceToAstronaut <= Math.max(
                                closeThreatDistance * 1.8,
                                Math.min(trackRange * 1.15, chaseLeashDistance + 48)
                            )
                            && pressureScore >= (persistentChaser ? 0.58 : 0.9)
                        );
                    creature.followsAstronaut = pursuingAstronaut;
                    shouldTrackAstronaut = pursuingAstronaut;
                    if (distanceToAstronaut >= returnToNestDistance && homeDistance > WASP_HOME_PROXIMITY) {
                        setWaspBehaviorState(runtimeState, 'returning', frameNow);
                        shouldTrackAstronaut = false;
                        creature.followsAstronaut = false;
                    } else if (distanceToAstronaut >= chaseLeashDistance && homeDistance > WASP_HOME_PROXIMITY) {
                        setWaspBehaviorState(runtimeState, 'returning', frameNow);
                        shouldTrackAstronaut = false;
                        creature.followsAstronaut = false;
                    } else if (
                        !pursuingAstronaut
                        && distanceToAstronaut > attackEngageDistance
                        && attackPressureWave < 0.18
                        && homeDistance > WASP_HOME_PROXIMITY
                    ) {
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
                } else if (wasp && runtimeState.waspBehaviorState === 'attacking') {
                    const aggression = Math.max(0, Math.min(1, getFiniteOrNull(runtimeState.waspAggression) ?? 0.5));
                    const anchorBlend = WASP_BUZZ_ANCHOR_MIN_BLEND
                        + aggression * (WASP_BUZZ_ANCHOR_MAX_BLEND - WASP_BUZZ_ANCHOR_MIN_BLEND);
                    const buzzAnchorX = (astronautCenter.x * anchorBlend) + (creature.homeX * (1 - anchorBlend));
                    const buzzAnchorY = (astronautCenter.y * anchorBlend) + (creature.homeY * (1 - anchorBlend));
                    const toAnchorX = buzzAnchorX - creature.x;
                    const toAnchorY = buzzAnchorY - creature.y;
                    const anchorDistance = Math.max(1, Math.hypot(toAnchorX, toAnchorY));
                    const driftRange = WASP_MAX_PATROL_DRIFT * WASP_BUZZ_PATROL_DRIFT_MULTIPLIER;
                    nextX = options.clampToRange(
                        creature.x + (toAnchorX / anchorDistance) * Math.max(0.45, speed * 0.52) + waspSwarmVectorX * WASP_BUZZ_SWARM_WEIGHT,
                        creature.homeX - driftRange,
                        creature.homeX + driftRange
                    );
                    nextY = options.clampToRange(
                        creature.y + (toAnchorY / anchorDistance) * Math.max(0.45, speed * 0.52) + waspSwarmVectorY * WASP_BUZZ_SWARM_WEIGHT,
                        creature.homeY - driftRange,
                        creature.homeY + driftRange
                    );
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
                const animationKey = getThreadingCreatureKey(creature, creatureIndex);
                const threadedAnimation = threadingService.getCreatureAnimation(animationKey);
                if (threadedAnimation && threadedAnimation.frameNow <= frameNow) {
                    creature.type = threadedAnimation.spriteType;
                } else {
                    creature.type = options.getAnimatedBirdSpriteType(authoredType, frameNow, creature.entityId);
                }
            } else if (wasp && options.getAnimatedWaspSpriteType) {
                const behaviorState = runtimeState.waspBehaviorState === 'returning' ? 'returning' : 'attacking';
                const stateStartedAt = Number.isFinite(Number(runtimeState.waspAnimationStateStartedAt))
                    ? Number(runtimeState.waspAnimationStateStartedAt)
                    : frameNow;
                runtimeState.waspAnimationStateStartedAt = stateStartedAt;
                const animationKey = getThreadingCreatureKey(creature, creatureIndex);
                const threadedAnimation = threadingService.getCreatureAnimation(animationKey);
                if (threadedAnimation && threadedAnimation.frameNow <= frameNow) {
                    creature.type = threadedAnimation.spriteType;
                } else {
                    creature.type = options.getAnimatedWaspSpriteType(
                        authoredType,
                        frameNow,
                        behaviorState,
                        stateStartedAt,
                        creature.entityId
                    );
                }
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

        for (const wasp of waspsToDespawnAtNest) {
            removeCreatureEntity(wasp);
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
