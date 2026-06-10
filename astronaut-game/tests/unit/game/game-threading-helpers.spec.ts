import { describe, expect, it } from 'vitest';
import {
    resolveThreadedCreatureAnimation,
    resolveThreadedFireMotion,
    resolveThreadedFirePaletteIndex,
    resolveThreadedWaspSwarmTurn
} from '../../../src/game/runtime/threading/game-threading-helpers.js';

describe('resolveThreadedFirePaletteIndex', () => {
    it('matches fire palette constraints', () => {
        const selected = resolveThreadedFirePaletteIndex(5, 40, 1000, 1234);
        expect([38, 39]).toContain(selected);
        expect(resolveThreadedFirePaletteIndex(99, 10, 500, 1)).toBe(9);
    });
});

describe('resolveThreadedFireMotion', () => {
    it('returns bounded offsets and rotation', () => {
        const motion = resolveThreadedFireMotion(1750, 8123);
        expect(Math.abs(motion.offsetX)).toBeLessThanOrEqual(3.5);
        expect(Math.abs(motion.offsetY)).toBeLessThanOrEqual(4);
        expect(Math.abs(motion.rotationRadians)).toBeLessThanOrEqual(0.14);
    });
});

describe('resolveThreadedCreatureAnimation', () => {
    it('resolves bird and wasp frames', () => {
        const bird = resolveThreadedCreatureAnimation({
            key: 'bird-1',
            kind: 'bird',
            authoredType: 'bird2',
            frameNow: 450,
            entityId: 7
        });
        const wasp = resolveThreadedCreatureAnimation({
            key: 'wasp-1',
            kind: 'wasp',
            authoredType: 'wasp1',
            frameNow: 450,
            behaviorState: 'returning',
            stateStartedAt: 150,
            entityId: 5
        });
        expect(/^bird\d$/.test(bird)).toBe(true);
        expect(/^wasp\d$/.test(wasp)).toBe(true);
    });
});

describe('resolveThreadedWaspSwarmTurn', () => {
    it('is deterministic for the same input', () => {
        const input = { key: 'wasp:1', frameNow: 1000, behaviorSeed: 0.42 };
        const first = resolveThreadedWaspSwarmTurn(input);
        const second = resolveThreadedWaspSwarmTurn(input);
        expect(second).toEqual(first);
        expect(first.nextSwarmTurnAt).toBeGreaterThan(1000);
    });
});
