import { describe, expect, it } from 'vitest';
import type { MapBlock } from '../../../src/world/map.js';
import { fillConnectedWorldWater } from '../../../src/designer/water/world-designer-water-fill.js';

function createWorldBlock(x: number, y: number): MapBlock {
    return {
        x,
        y,
        type: 'floor_full',
        collision: true,
        palette: 0
    };
}

describe('world designer water flood-fill', () => {
    it('fills across and down, but never upward from the seed row', () => {
        const tileSize = 32;
        const worldMap: MapBlock[] = [
            createWorldBlock(0, 0),
            createWorldBlock(-tileSize, 0),
            createWorldBlock(tileSize, 0),
            createWorldBlock(0, tileSize),
            createWorldBlock(0, -tileSize)
        ];

        const convertedCount = fillConnectedWorldWater(worldMap, { x: 0, y: 0 }, tileSize);

        expect(convertedCount).toBe(4);
        expect(worldMap.find((block) => block.x === 0 && block.y === 0)?.water).toBe(true);
        expect(worldMap.find((block) => block.x === -tileSize && block.y === 0)?.water).toBe(true);
        expect(worldMap.find((block) => block.x === tileSize && block.y === 0)?.water).toBe(true);
        expect(worldMap.find((block) => block.x === 0 && block.y === tileSize)?.water).toBe(true);
        expect(worldMap.find((block) => block.x === 0 && block.y === -tileSize)?.water).not.toBe(true);
    });

    it('returns zero when the seed tile is not present', () => {
        const worldMap: MapBlock[] = [createWorldBlock(0, 0)];
        const convertedCount = fillConnectedWorldWater(worldMap, { x: 320, y: 320 }, 32);
        expect(convertedCount).toBe(0);
        expect(worldMap[0].water).not.toBe(true);
    });
});
