import { describe, expect, it, vi } from 'vitest';
import { createGameCombatHelpers } from '../../../src/game/combat/game-combat-helpers';

function createTestCreature(overrides: Record<string, unknown> = {}) {
    return {
        x: 108,
        y: 100,
        previousX: 107,
        previousY: 100,
        collision: true,
        pushAstronaut: true,
        damageOnContact: 0,
        archetype: 'bird',
        type: 'bird1',
        state: {},
        ...overrides
    };
}

describe('creature combat collisions', () => {
    it('requires opaque pixel overlap for bird collisions', () => {
        const creature = createTestCreature({ archetype: 'bird', type: 'bird2' });
        const gameState = { astronaut: { position: { x: 100, y: 100 } } };
        const astronaut = { velocity: { x: 2, y: 0 } };

        const helpers = createGameCombatHelpers({
            getCreatureEntities: () => [creature],
            getAstronautRect: () => ({ left: 100, right: 116, top: 100, bottom: 116 }),
            getEntityCollisionBounds: () => ({ left: 0, right: 16, top: 0, bottom: 16 }),
            getEntityRect: (x, y, bounds) => ({
                left: x + bounds.left,
                right: x + bounds.right,
                top: y + bounds.top,
                bottom: y + bounds.bottom
            }),
            getAstronautRenderedWorldSprite: () => ({ canvas: {} as HTMLCanvasElement, drawX: 0, drawY: 0 }),
            getRenderedEntityWorldSprite: () => ({ canvas: {} as HTMLCanvasElement, drawX: 0, drawY: 0 }),
            doRenderedSpritesOverlap: vi.fn(() => false),
            gameState,
            astronaut,
            applyAstronautDamage: vi.fn(),
            ouchSounds: [],
            getSoundEnabled: () => false,
            creatureManifestSounds: {},
            getEntityCenter: () => ({ x: 0, y: 0 }),
            gameAudio: { playRuntimeSound: vi.fn() }
        });

        helpers.resolveAstronautCreatureCollisions();

        expect(gameState.astronaut.position.x).toBe(100);
        expect(gameState.astronaut.position.y).toBe(100);
        expect(astronaut.velocity.x).toBe(2);
    });

    it('keeps non-bird collision behavior unchanged', () => {
        const creature = createTestCreature({ archetype: 'monkey', type: 'monkey1' });
        const gameState = { astronaut: { position: { x: 100, y: 100 } } };
        const astronaut = { velocity: { x: 2, y: 0 } };

        const helpers = createGameCombatHelpers({
            getCreatureEntities: () => [creature],
            getAstronautRect: () => ({ left: 100, right: 116, top: 100, bottom: 116 }),
            getEntityCollisionBounds: () => ({ left: 0, right: 16, top: 0, bottom: 16 }),
            getEntityRect: (x, y, bounds) => ({
                left: x + bounds.left,
                right: x + bounds.right,
                top: y + bounds.top,
                bottom: y + bounds.bottom
            }),
            getAstronautRenderedWorldSprite: () => null,
            getRenderedEntityWorldSprite: () => null,
            doRenderedSpritesOverlap: vi.fn(() => false),
            gameState,
            astronaut,
            applyAstronautDamage: vi.fn(),
            ouchSounds: [],
            getSoundEnabled: () => false,
            creatureManifestSounds: {},
            getEntityCenter: () => ({ x: 0, y: 0 }),
            gameAudio: { playRuntimeSound: vi.fn() }
        });

        helpers.resolveAstronautCreatureCollisions();

        expect(gameState.astronaut.position.x).toBeGreaterThan(100);
        expect(astronaut.velocity.x).toBe(0);
    });

    it('requires four consecutive wasp touches before applying teleport damage and applies touch damage each time', () => {
        const creature = createTestCreature({
            archetype: 'bee',
            type: 'wasp1',
            damageOnContact: 1.2
        });
        const gameState = { astronaut: { position: { x: 100, y: 100 } } };
        const astronaut = { velocity: { x: 2, y: 0 } };
        const applyAstronautDamage = vi.fn();
        const nowSpy = vi.spyOn(performance, 'now');

        const helpers = createGameCombatHelpers({
            getCreatureEntities: () => [creature],
            getAstronautRect: () => ({ left: 100, right: 116, top: 100, bottom: 116 }),
            getEntityCollisionBounds: () => ({ left: 0, right: 16, top: 0, bottom: 16 }),
            getEntityRect: (x, y, bounds) => ({
                left: x + bounds.left,
                right: x + bounds.right,
                top: y + bounds.top,
                bottom: y + bounds.bottom
            }),
            getAstronautRenderedWorldSprite: () => null,
            getRenderedEntityWorldSprite: () => null,
            doRenderedSpritesOverlap: vi.fn(() => true),
            gameState,
            astronaut,
            applyAstronautDamage,
            ouchSounds: [],
            getSoundEnabled: () => false,
            creatureManifestSounds: {},
            getEntityCenter: () => ({ x: 0, y: 0 }),
            gameAudio: { playRuntimeSound: vi.fn() }
        });

        nowSpy.mockReturnValue(0);
        helpers.resolveAstronautCreatureCollisions();
        nowSpy.mockReturnValue(500);
        helpers.resolveAstronautCreatureCollisions();
        nowSpy.mockReturnValue(1000);
        helpers.resolveAstronautCreatureCollisions();
        expect(applyAstronautDamage).toHaveBeenCalledTimes(3);
        expect(applyAstronautDamage).toHaveBeenNthCalledWith(1, 1.2, 0);
        expect(applyAstronautDamage).toHaveBeenNthCalledWith(2, 1.2, 500);
        expect(applyAstronautDamage).toHaveBeenNthCalledWith(3, 1.2, 1000);

        nowSpy.mockReturnValue(1500);
        helpers.resolveAstronautCreatureCollisions();
        expect(applyAstronautDamage).toHaveBeenCalledTimes(5);
        expect(applyAstronautDamage).toHaveBeenNthCalledWith(4, 1.2, 1500);
        expect(applyAstronautDamage).toHaveBeenNthCalledWith(5, 999, 1500);

        nowSpy.mockRestore();
    });
});
