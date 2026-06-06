import { describe, expect, it } from 'vitest';

describe('world designer serialization', () => {
    it('strips transient collectable runtime flags from saved world data', async () => {
        (globalThis as any).Audio = class AudioMock { };
        const { serializeWorldData } = await import('../../../src/designer/core/world-designer-serialization.js');
        const result = serializeWorldData({
            worldMap: [],
            buttons: [],
            doors: [],
            creatures: [],
            collectables: [
                {
                    x: 10,
                    y: 20,
                    type: 'pipe_down_half',
                    palette: 10,
                    rotation: 5,
                    held: true,
                    stored: true,
                    collected: true,
                    isGrounded: true,
                    velocity: { x: 4, y: -3 },
                    astronautCollisionIgnoreFrames: 12
                }
            ],
            teleporters: [],
            windEmitters: [],
            windSettings: {},
            astronautStart: { x: 0, y: 0 }
        } as any);

        expect(result.collectables).toHaveLength(1);
        expect(result.collectables[0].type).toBe('pipe_down_half');
        expect(result.collectables[0].held).toBe(false);
        expect(result.collectables[0].stored).toBe(false);
        expect(result.collectables[0].collected).toBe(false);
        expect(result.collectables[0].isGrounded).toBe(false);
        expect(result.collectables[0].velocity).toEqual({ x: 0, y: 0 });
        expect(result.collectables[0].astronautCollisionIgnoreFrames).toBe(0);
    });

    it('preserves world block archetype when serializing', async () => {
        (globalThis as any).Audio = class AudioMock { };
        const { serializeWorldData } = await import('../../../src/designer/core/world-designer-serialization.js');
        const result = serializeWorldData({
            worldMap: [
                {
                    x: 128,
                    y: 256,
                    type: 'explosion',
                    palette: 0,
                    collision: false,
                    maskAstronaut: false,
                    archetype: 'fire'
                }
            ],
            buttons: [],
            doors: [],
            creatures: [],
            collectables: [],
            teleporters: [],
            windEmitters: [],
            windSettings: {},
            astronautStart: { x: 0, y: 0 }
        } as any);

        expect(result.worldMap).toHaveLength(1);
        expect(result.worldMap[0].archetype).toBe('fire');
    });

    it('preserves beehive wasp distance tuning when serializing', async () => {
        (globalThis as any).Audio = class AudioMock { };
        const { serializeWorldData } = await import('../../../src/designer/core/world-designer-serialization.js');
        const result = serializeWorldData({
            worldMap: [
                {
                    x: 96,
                    y: 160,
                    type: 'beehive',
                    palette: 0,
                    collision: true,
                    maskAstronaut: false,
                    waspNestActivationDistance: 480,
                    waspReturnDistance: 640
                }
            ],
            buttons: [],
            doors: [],
            creatures: [],
            collectables: [],
            teleporters: [],
            windEmitters: [],
            windSettings: {},
            astronautStart: { x: 0, y: 0 }
        } as any);

        expect(result.worldMap).toHaveLength(1);
        expect(result.worldMap[0].waspNestActivationDistance).toBe(480);
        expect(result.worldMap[0].waspReturnDistance).toBe(640);
    });
});
