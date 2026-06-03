import { describe, expect, it } from 'vitest';
import { createCreatureRuntime } from '../../../src/game/creatures/game-creature-runtime.js';

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
        const runtime = createCreatureRuntime({
            getCreatureEntities: () => creatures,
            getAstronautPosition: () => ({ x: -80, y: 500 }),
            getAstronautRect: () => ({ left: -80, right: -80, top: 500, bottom: 500 }),
            getAstronautAimPoint: () => ({ x: -80, y: 500 }),
            getEntityCollisionBounds: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
            getEntityCenter: (x, y) => ({ x, y }),
            getChunkActivityForEntityPosition: () => 'near',
            shouldRunChunkBandUpdate: () => true,
            creatureChunkCadence: {},
            getCreatureAuthoredType: (type) => type,
            isBirdCreature: () => false,
            getStableCreatureAimCenter: (entry) => ({ x: entry.x, y: entry.y }),
            isTurretLikeCreature: () => false,
            hasCreatureLineOfSight: () => true,
            getCreatureTargetPoint: (_creature, _origin, target) => target,
            birdTrackReleaseRangeMultiplier: 1.3,
            birdTrackReleaseRangePadding: 72,
            birdAvoidanceVerticalThreshold: 20,
            clampToRange: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)),
            movementSettings: {
                creatureProjectileGravity: 0.15,
                collectablePickupRange: 64
            },
            moveCreatureWithEnvironmentCollisions: (_creature, targetX, targetY) => ({
                x: targetX,
                y: targetY,
                movedX: targetX,
                movedY: targetY,
                blockedX: false,
                blockedY: false
            }),
            spawnCreatureProjectile: () => undefined,
            getNextCreatureFireAt: (frameNow) => frameNow + 1000,
            getAnimatedBirdSpriteType: (authoredType) => authoredType,
            getTurretFacingRotations: (authoredRotation) => ({
                left: authoredRotation,
                right: authoredRotation,
                authoredFacing: authoredRotation
            }),
            createCreatureCarryProxy: () => undefined,
            gameAudio: {
                playManifestSound: () => undefined
            }
        });

        runtime.updateCreatures(1000, 1);

        expect(creature.x).toBeLessThan(0);
        expect(creature.y).toBeGreaterThan(0);
    });
});
