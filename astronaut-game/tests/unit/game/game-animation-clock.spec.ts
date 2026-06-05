import { describe, expect, it } from 'vitest';
import { createOrAdvanceAnimationClock } from '../../../src/game/runtime/game-animation-clock.js';

describe('game animation clock', () => {
    it('creates an initial clock snapshot', () => {
        const clock = createOrAdvanceAnimationClock(null, 1000);
        expect(clock.nowMs).toBe(1000);
        expect(clock.frameIndex).toBe(0);
        expect(clock.deltaMs).toBeCloseTo(1000 / 60, 6);
    });

    it('advances frame index and clamps delta', () => {
        const start = createOrAdvanceAnimationClock(null, 1000);
        const next = createOrAdvanceAnimationClock(start, 1008);
        const clamped = createOrAdvanceAnimationClock(next, 2000);

        expect(next.frameIndex).toBe(1);
        expect(next.deltaMs).toBe(8);
        expect(clamped.frameIndex).toBe(2);
        expect(clamped.deltaMs).toBe(250);
    });
});
