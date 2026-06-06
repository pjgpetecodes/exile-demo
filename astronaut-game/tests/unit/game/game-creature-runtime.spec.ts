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
            getAstronautPosition: () => ({ x: 140, y: 100 }),
            getAstronautRect: () => ({ left: 130, right: 150, top: 90, bottom: 110 }),
            getAstronautAimPoint: () => ({ x: 140, y: 100 }),
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
        expect(spawnedWasps.every((creature) => Math.hypot(creature.homeX - 100, creature.homeY - 100) <= 40)).toBe(true);
    });

    it('keeps nest activation isolated when distant nests share an entity id', () => {
        const creatures: any[] = [];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 140, y: 100 }),
            getAstronautRect: () => ({ left: 130, right: 150, top: 90, bottom: 110 }),
            getAstronautAimPoint: () => ({ x: 140, y: 100 }),
            getMapBlocks: () => [
                { x: 100, y: 100, type: 'beehive', entityId: 7 },
                { x: 1300, y: 1300, type: 'beehive', entityId: 7 }
            ],
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
                    damageOnContact: 1
                } as any;
                creatures.push(wasp);
                return wasp;
            }
        });

        runtime.updateCreatures(0, 1);
        runtime.updateCreatures(1300, 2);

        const spawnedWasps = creatures.filter((creature) => /^wasp/i.test(creature.type));
        expect(spawnedWasps.length).toBeGreaterThan(0);
        expect(spawnedWasps.every((creature) => Math.hypot(creature.homeX - 100, creature.homeY - 100) < 250)).toBe(true);
    });

    it('uses beehive activation distance override for spawning', () => {
        const creatures: any[] = [];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 320, y: 320 }),
            getAstronautRect: () => ({ left: 310, right: 330, top: 310, bottom: 330 }),
            getAstronautAimPoint: () => ({ x: 320, y: 320 }),
            getMapBlocks: () => [{ x: 100, y: 100, type: 'beehive', entityId: 99, waspNestActivationDistance: 50 }],
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
                    damageOnContact: 1
                } as any;
                creatures.push(wasp);
                return wasp;
            }
        });

        runtime.updateCreatures(0, 1);
        const spawnedWasps = creatures.filter((creature) => /^wasp/i.test(creature.type));
        expect(spawnedWasps).toHaveLength(0);
    });

    it('activates a nest only when line of sight is clear', () => {
        const creatures: any[] = [];
        let hasLineOfSight = false;
        const sightTargets: Array<{ x: number; y: number }> = [];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 140, y: 100 }),
            getAstronautRect: () => ({ left: 130, right: 150, top: 90, bottom: 110 }),
            getAstronautAimPoint: () => ({ x: 140, y: 100 }),
            hasCreatureLineOfSight: (_start, target) => {
                sightTargets.push({ x: target.x, y: target.y });
                return hasLineOfSight;
            },
            getMapBlocks: () => [{ x: 100, y: 100, type: 'beehive', entityId: 44 }],
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
                    damageOnContact: 1
                } as any;
                creatures.push(wasp);
                return wasp;
            }
        });

        runtime.updateCreatures(0, 1);
        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(0);

        hasLineOfSight = true;
        runtime.updateCreatures(1300, 2);
        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(1);
        expect(sightTargets.some((target) => Math.hypot(target.x - 100, target.y - 100) > 0.5)).toBe(true);
    });

    it('uses beehive max active, aggression, and damage overrides for spawned wasps', () => {
        const creatures: any[] = [];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 100, y: 100 }),
            getAstronautRect: () => ({ left: 90, right: 110, top: 90, bottom: 110 }),
            getAstronautAimPoint: () => ({ x: 100, y: 100 }),
            getMapBlocks: () => [{
                x: 100,
                y: 100,
                type: 'beehive',
                entityId: 88,
                waspMaxActive: 2,
                waspAggression: 0.9,
                waspDamageOnContact: 2.5
            }],
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
                    damageOnContact: 1
                } as any;
                creatures.push(wasp);
                return wasp;
            }
        });

        runtime.updateCreatures(0, 1);
        runtime.updateCreatures(1300, 2);
        runtime.updateCreatures(2600, 3);

        const spawnedWasps = creatures.filter((creature) => /^wasp/i.test(creature.type));
        expect(spawnedWasps).toHaveLength(2);
        expect(spawnedWasps.every((creature) => creature.damageOnContact === 2.5)).toBe(true);
        expect(spawnedWasps.every((creature) => creature.state.waspAggression === 0.9)).toBe(true);
    });

    it('despawns active nest wasps when astronaut leaves nest deactivation range', () => {
        const creatures: any[] = [];
        let astronautX = 100;
        let astronautY = 100;
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: astronautX, y: astronautY }),
            getAstronautRect: () => ({
                left: astronautX - 10,
                right: astronautX + 10,
                top: astronautY - 10,
                bottom: astronautY + 10
            }),
            getAstronautAimPoint: () => ({ x: astronautX, y: astronautY }),
            getMapBlocks: () => [{
               x: 100,
               y: 100,
               type: 'beehive',
               entityId: 7,
               waspNestActivationDistance: 180,
               waspReturnDistance: 420
            }],
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
                    damageOnContact: 1
                } as any;
                creatures.push(wasp);
                return wasp;
            }
        });

        runtime.updateCreatures(0, 1);
        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(1);

        astronautX = 350;
        astronautY = 100;
        runtime.updateCreatures(300, 2);
        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(1);

        astronautX = 600;
        astronautY = 100;
        runtime.updateCreatures(600, 3);
        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(0);
    });

    it('despawns nest wasps after teleporting beyond deactivation range even if nest is unloaded', () => {
        const creatures: any[] = [];
        let astronautX = 100;
        let astronautY = 100;
        let nestLoaded = true;
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: astronautX, y: astronautY }),
            getAstronautRect: () => ({
                left: astronautX - 10,
                right: astronautX + 10,
                top: astronautY - 10,
                bottom: astronautY + 10
            }),
            getAstronautAimPoint: () => ({ x: astronautX, y: astronautY }),
            getMapBlocks: () => nestLoaded
                ? [{
                    x: 100,
                    y: 100,
                    type: 'beehive',
                    entityId: 8,
                    waspNestActivationDistance: 180,
                    waspReturnDistance: 420
                }]
                : [],
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
                    damageOnContact: 1
                } as any;
                creatures.push(wasp);
                return wasp;
            }
        });

        runtime.updateCreatures(0, 1);
        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(1);

        astronautX = 700;
        astronautY = 700;
        nestLoaded = false;
        runtime.updateCreatures(300, 2);
        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(0);
    });

    it('despawns nest wasps using home fallback when nest key changes', () => {
        const wasp = {
            x: 130,
            y: 90,
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
            homeX: 100,
            homeY: 100,
            collision: true,
            fixed: false,
            fireMode: 'none',
            requiresLineOfSight: false,
            targetRefreshMs: 0,
            state: {
                authoredType: 'wasp1',
                waspNestKey: 'entity:old',
                waspReturnToNestDistance: 420
            },
            previousX: 130,
            previousY: 90,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1
        } as any;
        const creatures = [wasp];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 700, y: 700 }),
            getAstronautRect: () => ({ left: 690, right: 710, top: 690, bottom: 710 }),
            getAstronautAimPoint: () => ({ x: 700, y: 700 }),
            getMapBlocks: () => [{ x: 100, y: 100, type: 'beehive', entityId: 99, waspReturnDistance: 420 }],
            spawnWaspFromNest: () => {
                throw new Error('spawnWaspFromNest should not be called in this test');
            }
        });

        runtime.updateCreatures(300, 2);

        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(0);
    });

    it('despawns orphan wasps when nest registry is empty and source nest is unloaded', () => {
        const wasp = {
            x: 128,
            y: 96,
            type: 'wasp1',
            archetype: 'bee',
            followsAstronaut: true,
            followRange: 200,
            trackRange: 200,
            movementMode: 'hover',
            speed: 1.8,
            patrolMinX: 0,
            patrolMaxX: 256,
            patrolMinY: 0,
            patrolMaxY: 256,
            hoverAmplitude: 8,
            homeX: 128,
            homeY: 96,
            collision: true,
            fixed: false,
            fireMode: 'none',
            requiresLineOfSight: false,
            targetRefreshMs: 0,
            state: {
                authoredType: 'wasp1',
                waspNestKey: 'entity:stale',
                waspNestX: 128,
                waspNestY: 96,
                waspReturnToNestDistance: 200,
                waspBehaviorState: 'attacking',
                waspBehaviorStateStartedAt: 0,
                waspAnimationStateStartedAt: 0
            },
            previousX: 128,
            previousY: 96,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1
        } as any;
        const creatures = [wasp];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 800, y: 800 }),
            getAstronautRect: () => ({ left: 790, right: 810, top: 790, bottom: 810 }),
            getAstronautAimPoint: () => ({ x: 800, y: 800 }),
            getMapBlocks: () => [],
            spawnWaspFromNest: () => {
                throw new Error('spawnWaspFromNest should not be called in this test');
            }
        });

        runtime.updateCreatures(0, 1);

        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(0);
    });

    it('keeps returning animation phase while wasp is settling back at its nest', () => {
        const wasp = {
            x: 70,
            y: 70,
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
            previousX: 70,
            previousY: 70,
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
                waspAnimationStateStartedAt: 0,
                waspAggression: 1
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
                waspAnimationStateStartedAt: 0,
                waspAggression: 1
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

    it('despawns returning wasps at the nest and plays the home sound cue', () => {
        const wasp = {
            x: 101,
            y: 100,
            type: 'wasp1',
            archetype: 'bee',
            followsAstronaut: false,
            followRange: 220,
            trackRange: 220,
            movementMode: 'hover',
            speed: 2,
            patrolMinX: -400,
            patrolMaxX: 400,
            patrolMinY: -400,
            patrolMaxY: 400,
            hoverAmplitude: 8,
            homeX: 100,
            homeY: 100,
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
            previousX: 101,
            previousY: 100,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1
        } as any;
        const creatures = [wasp];
        const soundCalls: Array<{ key: string; volume?: number }> = [];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 520, y: 520 }),
            getAstronautRect: () => ({ left: 510, right: 530, top: 510, bottom: 530 }),
            getAstronautAimPoint: () => ({ x: 520, y: 520 }),
            gameAudio: {
                playManifestSound: (key, volume) => {
                    soundCalls.push({ key, volume });
                }
            }
        });

        runtime.updateCreatures(1000, 1);

        expect(creatures.filter((creature) => /^wasp/i.test(creature.type))).toHaveLength(0);
        expect(soundCalls.some((call) => call.key === 'WaspHome')).toBe(true);
    });

    it('sends only farther low-commitment wasps into retreat while committed wasps keep chasing', () => {
        const lowCommitWasp = {
            x: 140,
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
                waspBehaviorSeed: 0,
                waspAggression: 0.2,
                waspAttackPhaseMs: 0,
                waspSwarmVectorX: 0,
                waspSwarmVectorY: 0,
                waspNextSwarmTurnAt: Number.MAX_SAFE_INTEGER,
                waspReturnToNestDistance: 420
            },
            previousX: 140,
            previousY: 0,
            pickupEnabled: true,
            storable: true,
            killForce: 2,
            damageOnContact: 1
        } as any;
        const committedWasp = {
            ...lowCommitWasp,
            state: {
                ...lowCommitWasp.state,
                waspBehaviorSeed: 1,
                waspAggression: 1
            },
            previousX: 140,
            previousY: 0
        } as any;
        const creatures = [lowCommitWasp, committedWasp];
        const runtime = createCreatureRuntime({
            ...createBaseRuntimeOptions(creatures),
            getAstronautPosition: () => ({ x: 380, y: 0 }),
            getAstronautRect: () => ({ left: 370, right: 390, top: -10, bottom: 10 }),
            getAstronautAimPoint: () => ({ x: 380, y: 0 })
        });

        runtime.updateCreatures(1000, 1);

        expect(lowCommitWasp.state.waspBehaviorState).toBe('returning');
        expect(committedWasp.state.waspBehaviorState).toBe('attacking');
        expect(committedWasp.state.followingAstronaut).toBe(true);
    });

    it('uses beehive return distance override for return behavior', () => {
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
            homeX: 200,
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
                waspReturnToNestDistance: 200
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
            getAstronautPosition: () => ({ x: 260, y: 0 }),
            getAstronautRect: () => ({ left: 250, right: 270, top: -10, bottom: 10 }),
            getAstronautAimPoint: () => ({ x: 260, y: 0 })
        });

        runtime.updateCreatures(1000, 1);

        expect(wasp.state.waspBehaviorState).toBe('returning');
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
                waspAggression: 1,
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

    it('lets low-aggression wasps buzz near the astronaut instead of always hard-chasing', () => {
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
                waspAggression: 0.35,
                waspAttackPhaseMs: 1500,
                waspSwarmVectorX: 1.1,
                waspSwarmVectorY: 0.2,
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
            getAstronautPosition: () => ({ x: 140, y: 0 }),
            getAstronautRect: () => ({ left: 130, right: 150, top: -10, bottom: 10 }),
            getAstronautAimPoint: () => ({ x: 140, y: 0 })
        });

        runtime.updateCreatures(1000, 1);

        expect(wasp.state.followingAstronaut).toBe(false);
        expect(wasp.state.waspBehaviorState).toBe('attacking');
        expect(wasp.x).toBeGreaterThan(0);
    });
});
