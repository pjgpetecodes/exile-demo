import { describe, expect, it } from 'vitest';
import { createCreatureRuntime } from '../../../src/game/creatures/game-creature-runtime.js';

function createBaseRuntimeOptions(creatures: any[]) {
    return {
        getCreatureEntities: () => creatures,
        getAstronautPosition: () => ({ x: -80, y: 500 }),
        getAstronautRect: () => ({ left: -80, right: -80, top: 500, bottom: 500 }),
        getAstronautAimPoint: () => ({ x: -80, y: 500 }),
        getEntityCollisionBounds: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
        getEntityCenter: (x: number, y: number) => ({ x, y }),
        getChunkActivityForEntityPosition: () => 'near',
        shouldRunChunkBandUpdate: () => true,
        creatureChunkCadence: {},
        getCreatureAuthoredType: (type: string, state?: Record<string, unknown>) =>
            (typeof state?.authoredType === 'string' ? state.authoredType : type),
        isBirdCreature: () => false,
        getStableCreatureAimCenter: (entry: { x: number; y: number }) => ({ x: entry.x, y: entry.y }),
        isTurretLikeCreature: () => false,
        hasCreatureLineOfSight: () => true,
        getCreatureTargetPoint: (_creature: any, _origin: any, target: any) => target,
        birdTrackReleaseRangeMultiplier: 1.3,
        birdTrackReleaseRangePadding: 72,
        birdAvoidanceVerticalThreshold: 20,
        clampToRange: (value: number, minimum: number, maximum: number) => Math.max(minimum, Math.min(maximum, value)),
        movementSettings: {
            creatureProjectileGravity: 0.15,
            collectablePickupRange: 64
        },
        moveCreatureWithEnvironmentCollisions: (_creature: any, targetX: number, targetY: number) => ({
            x: targetX,
            y: targetY,
            movedX: targetX,
            movedY: targetY,
            blockedX: false,
            blockedY: false
        }),
        spawnCreatureProjectile: () => undefined,
        getNextCreatureFireAt: (frameNow: number) => frameNow + 1000,
        getAnimatedBirdSpriteType: (authoredType: string) => authoredType,
        getTurretFacingRotations: (authoredRotation: number) => ({
            left: authoredRotation,
            right: authoredRotation,
            authoredFacing: authoredRotation
        }),
        createCreatureCarryProxy: () => undefined,
        gameAudio: {
            playManifestSound: () => undefined
        }
    };
}

describe('createCreatureRuntime', () => {
    it('tracks hover followers by horizontal distance even when vertical separation is large', () => {
        const creature = {
            x: 0,
            y: 0,
            type: 'robot3',
            archetype: 'custom',
            followsAstronaut: true,
            followRange: 200,
            trackRange: 200,
            movementMode: 'hover',
            speed: 2,
            patrolMinX: -120,
            patrolMaxX: 120,
            patrolMinY: -32,
            patrolMaxY: 32,
            hoverAmplitude: 0,
            homeX: 0,
            homeY: 0,
            collision: false,
            fixed: false,
            fireMode: 'none',
            requiresLineOfSight: false,
            targetRefreshMs: 0,
            state: {},
            previousX: 0,
            previousY: 0
        } as any;
        const creatures = [creature];
        const runtime = createCreatureRuntime(createBaseRuntimeOptions(creatures));

        runtime.updateCreatures(1000, 1);

        expect(creature.x).toBeLessThan(0);
        expect(creature.y).toBeGreaterThan(0);
    });

    it('spawns up to four wasps per nearby nest', () => {
        const creatures: any[] = [];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 100, y: 100 }),
            getAstronautRect: () => ({ left: 90, right: 110, top: 90, bottom: 110 }),
            getAstronautAimPoint: () => ({ x: 100, y: 100 }),
            getMapBlocks: () => [{ x: 100, y: 100, type: 'beehive', entityId: 12 }],
            spawnWaspFromNest: (x: number, y: number, nestKey: string) => {
                const wasp = {
                    x,
                    y,
                    type: 'wasp1',
                    archetype: 'bee',
                    followsAstronaut: true,
                    followRange: 176,
                    trackRange: 176,
                    movementMode: 'hover',
                    speed: 1.5,
                    patrolMinX: x - 120,
                    patrolMaxX: x + 120,
                    patrolMinY: y - 80,
                    patrolMaxY: y + 80,
                    hoverAmplitude: 8,
                    homeX: x,
                    homeY: y,
                    collision: false,
                    fixed: false,
                    fireMode: 'none',
                    requiresLineOfSight: false,
                    targetRefreshMs: 0,
                    state: {
                        authoredType: 'wasp1',
                        waspNestKey: nestKey
                    },
                    previousX: x,
                    previousY: y,
                    pickupEnabled: true,
                    storable: true,
                    killForce: 2,
                    damageOnContact: 1,
                    sound: {
                        enabled: true,
                        sound: 'WaspBuzz',
                        intervalMs: 400,
                        randomVarianceMs: 0,
                        range: 320,
                        volume: 1
                    }
                } as any;
                creatures.push(wasp);
                return wasp;
            }
        });

        runtime.updateCreatures(0, 1);
        runtime.updateCreatures(1300, 2);
        runtime.updateCreatures(2600, 3);
        runtime.updateCreatures(3900, 4);
        runtime.updateCreatures(5200, 5);

        const spawnedWasps = creatures.filter((creature) => /^wasp/i.test(creature.type));
        expect(spawnedWasps).toHaveLength(4);
    });

    it('keeps returning animation phase while wasp is settling back at its nest', () => {
        const wasp = {
            x: 50,
            y: 50,
            type: 'wasp1',
            archetype: 'bee',
            followsAstronaut: false,
            followRange: 176,
            trackRange: 176,
            movementMode: 'hover',
            speed: 1.5,
            patrolMinX: -100,
            patrolMaxX: 100,
            patrolMinY: -100,
            patrolMaxY: 100,
            hoverAmplitude: 8,
            homeX: 50,
            homeY: 50,
            collision: false,
            fixed: false,
            fireMode: 'none',
            requiresLineOfSight: false,
            targetRefreshMs: 0,
            state: {
                authoredType: 'wasp1',
                waspBehaviorState: 'returning',
                waspBehaviorStateStartedAt: 0,
                waspAnimationStateStartedAt: 0
            },
            previousX: 50,
            previousY: 50,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1,
            sound: {
                enabled: true,
                sound: 'WaspHome',
                intervalMs: 900,
                randomVarianceMs: 0,
                range: 320,
                volume: 1
            }
        } as any;
        const creatures = [wasp];
        const calls: Array<{ behaviorState: 'attacking' | 'returning'; stateStartedAt: number }> = [];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAnimatedWaspSpriteType: (_authoredType, _frameNow, behaviorState, stateStartedAt) => {
                calls.push({ behaviorState, stateStartedAt });
                return 'wasp1';
            }
        });

        runtime.updateCreatures(1000, 1);

        expect(calls).toHaveLength(1);
        expect(calls[0]).toEqual({
            behaviorState: 'returning',
            stateStartedAt: 0
        });
    });

    it('makes attacking wasps chase vertically and use collision movement', () => {
        const wasp = {
            x: 0,
            y: 0,
            type: 'wasp1',
            archetype: 'bee',
            followsAstronaut: true,
            followRange: 260,
            trackRange: 260,
            movementMode: 'hover',
            speed: 2,
            patrolMinX: -200,
            patrolMaxX: 200,
            patrolMinY: -200,
            patrolMaxY: 200,
            hoverAmplitude: 8,
            homeX: 0,
            homeY: 0,
            collision: false,
            fixed: false,
            fireMode: 'none',
            requiresLineOfSight: false,
            targetRefreshMs: 0,
            state: {
                authoredType: 'wasp1',
                waspBehaviorState: 'attacking',
                waspBehaviorStateStartedAt: 0,
                waspAnimationStateStartedAt: 0
            },
            previousX: 0,
            previousY: 0,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1,
            sound: {
                enabled: true,
                sound: 'WaspBuzz',
                intervalMs: 400,
                randomVarianceMs: 0,
                range: 320,
                volume: 1
            }
        } as any;
        const creatures = [wasp];
        const collisionCalls: Array<{ targetX: number; targetY: number }> = [];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 0, y: 120 }),
            getAstronautRect: () => ({ left: -10, right: 10, top: 110, bottom: 130 }),
            getAstronautAimPoint: () => ({ x: 0, y: 120 }),
            moveCreatureWithEnvironmentCollisions: (_creature, targetX, targetY) => {
                collisionCalls.push({ targetX, targetY });
                return {
                    x: targetX,
                    y: targetY,
                    movedX: targetX,
                    movedY: targetY,
                    blockedX: false,
                    blockedY: false
                };
            }
        });

        runtime.updateCreatures(1000, 1);

        expect(collisionCalls.length).toBeGreaterThan(0);
        expect(wasp.collision).toBe(true);
        expect(wasp.y).toBeGreaterThan(0);
    });

    it('re-engages nearby astronaut when wasp is returning', () => {
        const wasp = {
            x: 20,
            y: 20,
            type: 'wasp1',
            archetype: 'bee',
            followsAstronaut: false,
            followRange: 220,
            trackRange: 220,
            movementMode: 'hover',
            speed: 2,
            patrolMinX: -200,
            patrolMaxX: 200,
            patrolMinY: -200,
            patrolMaxY: 200,
            hoverAmplitude: 8,
            homeX: 120,
            homeY: 120,
            collision: true,
            fixed: false,
            fireMode: 'none',
            requiresLineOfSight: false,
            targetRefreshMs: 0,
            state: {
                authoredType: 'wasp1',
                waspBehaviorState: 'returning',
                waspBehaviorStateStartedAt: 0,
                waspAnimationStateStartedAt: 0
            },
            previousX: 20,
            previousY: 20,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1,
            sound: {
                enabled: true,
                sound: 'WaspHome',
                intervalMs: 900,
                randomVarianceMs: 0,
                range: 320,
                volume: 1
            }
        } as any;
        const creatures = [wasp];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 36, y: 36 }),
            getAstronautRect: () => ({ left: 30, right: 42, top: 30, bottom: 42 }),
            getAstronautAimPoint: () => ({ x: 36, y: 36 })
        });

        runtime.updateCreatures(1000, 1);

        expect(wasp.state.waspBehaviorState).toBe('attacking');
        expect(wasp.state.followingAstronaut).toBe(true);
    });

    it('does not clamp attacking wasp chase to patrol bounds', () => {
        const wasp = {
            x: 0,
            y: 0,
            type: 'wasp1',
            archetype: 'bee',
            followsAstronaut: true,
            followRange: 2000,
            trackRange: 2000,
            movementMode: 'hover',
            speed: 2,
            patrolMinX: -5,
            patrolMaxX: 0,
            patrolMinY: -5,
            patrolMaxY: 5,
            hoverAmplitude: 8,
            homeX: 0,
            homeY: 0,
            collision: true,
            fixed: false,
            fireMode: 'none',
            requiresLineOfSight: false,
            targetRefreshMs: 0,
            state: {
                authoredType: 'wasp1',
                waspBehaviorState: 'attacking',
                waspBehaviorStateStartedAt: 0,
                waspAnimationStateStartedAt: 0
            },
            previousX: 0,
            previousY: 0,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1,
            sound: {
                enabled: true,
                sound: 'WaspBuzz',
                intervalMs: 400,
                randomVarianceMs: 0,
                range: 320,
                volume: 1
            }
        } as any;
        const creatures = [wasp];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 200, y: 0 }),
            getAstronautRect: () => ({ left: 190, right: 210, top: -10, bottom: 10 }),
            getAstronautAimPoint: () => ({ x: 200, y: 0 })
        });

        runtime.updateCreatures(1000, 1);

        expect(wasp.x).toBeGreaterThan(0);
    });

    it('sends far attacking wasps back to nest with home sound', () => {
        const wasp = {
            x: 0,
            y: 0,
            type: 'wasp1',
            archetype: 'bee',
            followsAstronaut: true,
            followRange: 220,
            trackRange: 220,
            movementMode: 'hover',
            speed: 2,
            patrolMinX: -400,
            patrolMaxX: 400,
            patrolMinY: -400,
            patrolMaxY: 400,
            hoverAmplitude: 8,
            homeX: 180,
            homeY: 180,
            collision: true,
            fixed: false,
            fireMode: 'none',
            requiresLineOfSight: false,
            targetRefreshMs: 0,
            state: {
                authoredType: 'wasp1',
                waspBehaviorState: 'attacking',
                waspBehaviorStateStartedAt: 0,
                waspAnimationStateStartedAt: 0
            },
            previousX: 0,
            previousY: 0,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1,
            sound: {
                enabled: true,
                sound: 'WaspBuzz',
                intervalMs: 400,
                randomVarianceMs: 0,
                range: 320,
                volume: 1
            }
        } as any;
        const creatures = [wasp];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 520, y: 520 }),
            getAstronautRect: () => ({ left: 510, right: 530, top: 510, bottom: 530 }),
            getAstronautAimPoint: () => ({ x: 520, y: 520 })
        });

        runtime.updateCreatures(1000, 1);

        expect(wasp.state.waspBehaviorState).toBe('returning');
        expect(wasp.sound.sound).toBe('WaspHome');
    });

    it('adds swarm drift to attacking wasp pursuit', () => {
        const wasp = {
            x: 0,
            y: 0,
            type: 'wasp1',
            archetype: 'bee',
            followsAstronaut: true,
            followRange: 260,
            trackRange: 260,
            movementMode: 'hover',
            speed: 2,
            patrolMinX: -400,
            patrolMaxX: 400,
            patrolMinY: -400,
            patrolMaxY: 400,
            hoverAmplitude: 8,
            homeX: 0,
            homeY: 0,
            collision: true,
            fixed: false,
            fireMode: 'none',
            requiresLineOfSight: false,
            targetRefreshMs: 0,
            state: {
                authoredType: 'wasp1',
                waspBehaviorState: 'attacking',
                waspBehaviorStateStartedAt: 0,
                waspAnimationStateStartedAt: 0,
                waspSwarmVectorX: 1.5,
                waspSwarmVectorY: 0,
                waspNextSwarmTurnAt: Number.MAX_SAFE_INTEGER
            },
            previousX: 0,
            previousY: 0,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1,
            sound: {
                enabled: true,
                sound: 'WaspBuzz',
                intervalMs: 400,
                randomVarianceMs: 0,
                range: 320,
                volume: 1
            }
        } as any;
        const creatures = [wasp];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 0, y: 120 }),
            getAstronautRect: () => ({ left: -10, right: 10, top: 110, bottom: 130 }),
            getAstronautAimPoint: () => ({ x: 0, y: 120 })
        });

        runtime.updateCreatures(1000, 1);

        expect(wasp.x).toBeGreaterThan(0);
    });
});
