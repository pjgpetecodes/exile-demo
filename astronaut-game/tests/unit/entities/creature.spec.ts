import { beforeAll, describe, expect, it } from 'vitest';

let creatureModule: Awaited<typeof import('../../../src/entities/creature.js')>;

describe('creature archetypes', () => {
    beforeAll(async () => {
        (globalThis as any).Audio = class AudioMock { };
        creatureModule = await import('../../../src/entities/creature.js');
    }, 20_000);

    it('infers robot archetype from robot sprite type', () => {
        expect(creatureModule.inferCreatureArchetype('robot3')).toBe('robot');
    }, 20_000);

    it('applies robot defaults for movement, collision, and tracking range', () => {
        const creature = creatureModule.createCreatureSaveData({
            x: 100,
            y: 200,
            type: 'robot2'
        });

        expect(creature.archetype).toBe('robot');
        expect(creature.movementMode).toBe('hover');
        expect(creature.collision).toBe(true);
        expect(creature.followRange).toBe(192);
        expect(creature.trackRange).toBe(192);
    });
});
