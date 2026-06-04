import { describe, expect, it } from 'vitest';
import { createEnvironmentCollisionHelpers } from '../../../src/game/collision/game-environment-collision.js';

describe('environment collision helpers', () => {
    it('uses rendered opaque edge pixels for loose collectable vertical collisions', () => {
        const helpers = createEnvironmentCollisionHelpers({
            getEntityCollisionBounds: () => ({ left: -2, right: 2, top: -2, bottom: 2 }),
            isSolidAtWorld: (x, y) => Math.round(x) === 9 && Math.round(y) === 14,
            getRenderedEntityWorldSprite: (entity) => ({
                canvas: {} as HTMLCanvasElement,
                drawX: entity.x - 2,
                drawY: entity.y - 2
            }),
            getRenderedSpriteOpaqueSamples: () => [{ x: 2, y: 4 }],
            spriteScale: 1,
            clampToRange: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)),
            mapWidth: 1000,
            mapHeight: 1000,
            collectableGroundSnapDistance: 2,
            collectablePushStepUpHeight: 2
        });

        const collectable = { x: 10, y: 10, isGrounded: false } as any;
        const moved = helpers.moveCollectableVertically(collectable, 1);

        expect(moved).toBe(1);
        expect(collectable.y).toBe(11);
    });

    it('falls back to collision bounds when rendered sprite samples are unavailable', () => {
        const helpers = createEnvironmentCollisionHelpers({
            getEntityCollisionBounds: () => ({ left: -2, right: 2, top: -2, bottom: 2 }),
            isSolidAtWorld: (x, y) => Math.round(x) === 9 && Math.round(y) === 14,
            clampToRange: (value, minimum, maximum) => Math.max(minimum, Math.min(maximum, value)),
            mapWidth: 1000,
            mapHeight: 1000,
            collectableGroundSnapDistance: 2,
            collectablePushStepUpHeight: 2
        });

        const collectable = { x: 10, y: 10, isGrounded: false } as any;
        const moved = helpers.moveCollectableVertically(collectable, 1);

        expect(moved).toBe(0);
        expect(collectable.y).toBe(10);
    });
});
