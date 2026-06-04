import { describe, expect, it, vi } from 'vitest';

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
});
