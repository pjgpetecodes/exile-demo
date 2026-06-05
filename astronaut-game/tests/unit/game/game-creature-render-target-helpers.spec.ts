import { describe, expect, it } from 'vitest';
import { createGameCreatureRenderTargetHelpers } from '../../../src/game/creatures/game-creature-render-target-helpers.js';

describe('creature render target helpers wasp animation', () => {
    it('uses state-based cadence and supports resettable phase starts', () => {
        const helpers = createGameCreatureRenderTargetHelpers({
            birdAnimationFrames: ['bird1', 'bird2', 'bird3', 'bird4'],
            birdAnimationFrameDurationMs: 90,
            waspAnimationFrames: ['wasp1', 'wasp2', 'wasp3'],
            waspAttackAnimationFrameDurationMs: 60,
            waspReturnAnimationFrameDurationMs: 120,
            spriteScale: 1,
            getCreatureAuthoredType: (type: string) => type,
            findSpriteRectByType: () => null,
            getEntityPreviewSheet: () => null,
            getEntityCollisionBounds: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
            getEntityCenter: (x: number, y: number) => ({ x, y }),
            getTransformedSpriteCanvas: () => null,
            getSpriteVisibleBounds: () => null,
            getEntityRenderOffset: () => ({ x: 0, y: 0 })
        });

        expect(helpers.getAnimatedWaspSpriteType('wasp1', 120, 'attacking', 0, 0)).toBe('wasp3');
        expect(helpers.getAnimatedWaspSpriteType('wasp1', 120, 'returning', 0, 0)).toBe('wasp2');
        expect(helpers.getAnimatedWaspSpriteType('wasp1', 120, 'attacking', 120, 0)).toBe('wasp1');
    });
});
