import { describe, expect, it } from 'vitest';
import { extinguishFireBlocksNearSpill } from '../../../src/game/collectables/game-collectable-physics.js';

describe('extinguishFireBlocksNearSpill', () => {
    it('removes only fire-archetype blocks that overlap spill radius', () => {
        const mapBlocks = [
            { x: 100, y: 100, type: 'explosion', archetype: 'fire', collision: false },
            { x: 180, y: 100, type: 'explosion', archetype: 'fire', collision: false },
            { x: 100, y: 180, type: 'explosion', collision: false }
        ] as any[];

        const removed = extinguishFireBlocksNearSpill({
            mapBlocks: mapBlocks as any,
            spillX: 116,
            spillY: 102,
            extinguishRadius: 20,
            getMapBlockRect: (block: any) => ({
                left: block.x,
                top: block.y,
                right: block.x + 32,
                bottom: block.y + 32
            })
        });

        expect(removed).toBe(1);
        expect(mapBlocks).toHaveLength(2);
        expect(mapBlocks.some((block) => block.archetype === 'fire' && block.x === 180)).toBe(true);
        expect(mapBlocks.some((block) => block.x === 100 && block.y === 180)).toBe(true);
    });
});
