import { describe, expect, it } from 'vitest';
import type { MapBlock } from '../../../src/world/map.js';
import {
    clearSingleWaterTile,
    fillConnectedWorldWater,
    setSingleWaterTile
} from '../../../src/designer/water/world-designer-water-fill.js';

function createWorldBlock(x: number, y: number): MapBlock {
    return {
        x,
        y,
        type: 'floor_full',
        collision: true,
        palette: 0
    };
}

function createDiagonalWorldBlock(x: number, y: number): MapBlock {
    return {
        x,
        y,
        type: 'floor_diag_full',
        collision: true,
        palette: 0
    };
}

function createBackgroundBlock(x: number, y: number): MapBlock {
    return {
        x,
        y,
        type: 'black_background',
        collision: false,
        palette: 0
    };
}

function createWallHalfBlock(x: number, y: number): MapBlock {
    return {
        x,
        y,
        type: 'wall_half',
        collision: true,
        palette: 13
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

    it('fills connected transparent tiles from an empty seed by creating water blocks', () => {
        const tileSize = 32;
        const worldMap: MapBlock[] = [
            createWorldBlock(-tileSize, 0),
            createWorldBlock(0, 0),
            createWorldBlock(tileSize, 0),
            createWorldBlock(-tileSize, tileSize),
            createWorldBlock(tileSize, tileSize),
            createWorldBlock(-tileSize, tileSize * 2),
            createWorldBlock(0, tileSize * 2),
            createWorldBlock(tileSize, tileSize * 2)
        ];

        const convertedCount = fillConnectedWorldWater(worldMap, { x: 0, y: tileSize }, tileSize);

        expect(convertedCount).toBe(1);
        const filledCell = worldMap.find((block) => block.x === 0 && block.y === tileSize && block.water === true);
        expect(filledCell).toBeDefined();
        expect(filledCell?.collision).toBe(false);
        expect(filledCell?.type).toBe('floor_full');
        expect(filledCell?.palette).toBe(14);
        expect(filledCell?.waterOnly).toBe(true);
    });

    it('marks adjacent diagonal terrain as water to avoid transparent-edge gaps', () => {
        const tileSize = 32;
        const worldMap: MapBlock[] = [
            createDiagonalWorldBlock(tileSize, 0),
            createWorldBlock(tileSize * 2, 0),
            createWorldBlock(tileSize, tileSize),
            createWorldBlock(tileSize * 2, tileSize)
        ];

        const convertedCount = fillConnectedWorldWater(worldMap, { x: 0, y: 0 }, tileSize);

        expect(convertedCount).toBeGreaterThanOrEqual(2);
        const waterSeed = worldMap.find((block) => block.x === 0 && block.y === 0);
        expect(waterSeed?.waterOnly).toBe(true);
        const diagonalBoundary = worldMap.find((block) => block.x === tileSize && block.y === 0);
        expect(diagonalBoundary?.water).toBe(true);
        expect(diagonalBoundary?.waterOnly).not.toBe(true);
    });

    it('does not mark diagonal edge terrain above the seed row as water', () => {
        const tileSize = 32;
        const worldMap: MapBlock[] = [
            createDiagonalWorldBlock(tileSize, -tileSize),
            createWorldBlock(tileSize, 0),
            createWorldBlock(tileSize * 2, 0),
            createWorldBlock(tileSize, tileSize),
            createWorldBlock(tileSize * 2, tileSize)
        ];

        const convertedCount = fillConnectedWorldWater(worldMap, { x: 0, y: 0 }, tileSize);

        expect(convertedCount).toBeGreaterThanOrEqual(1);
        const aboveDiagonal = worldMap.find((block) => block.x === tileSize && block.y === -tileSize);
        expect(aboveDiagonal?.water).not.toBe(true);
    });

    it('does not treat non-diagonal half blocks as transparent-edge terrain', () => {
        const tileSize = 32;
        const wallHalf = createWallHalfBlock(tileSize, 0);
        const worldMap: MapBlock[] = [
            wallHalf,
            createWorldBlock(tileSize, tileSize),
            createWorldBlock(tileSize * 2, tileSize)
        ];

        fillConnectedWorldWater(worldMap, { x: 0, y: 0 }, tileSize, { mode: 'transparent' });

        expect(wallHalf.water).not.toBe(true);
    });

    it('treats water-marked terrain as solid for transparent-cell flood traversal', () => {
        const tileSize = 32;
        const centerBarrier = createWorldBlock(tileSize, 0);
        centerBarrier.water = true;
        const worldMap: MapBlock[] = [
            centerBarrier,
            createWorldBlock(tileSize, tileSize),
            createWorldBlock(tileSize, -tileSize)
        ];

        const convertedCount = fillConnectedWorldWater(worldMap, { x: 0, y: 0 }, tileSize);

        expect(convertedCount).toBeGreaterThanOrEqual(1);
        const leftSeed = worldMap.find((block) => block.x === 0 && block.y === 0 && block.waterOnly === true);
        expect(leftSeed).toBeDefined();
        const rightLeaked = worldMap.find((block) => block.x === tileSize * 2 && block.y === 0 && block.waterOnly === true);
        expect(rightLeaked).toBeUndefined();
    });

    it('supports transparent fill mode when the clicked seed cell contains diagonal terrain', () => {
        const tileSize = 32;
        const worldMap: MapBlock[] = [
            createDiagonalWorldBlock(tileSize, 0),
            createWorldBlock(0, tileSize),
            createWorldBlock(tileSize, tileSize),
            createWorldBlock(tileSize * 2, tileSize)
        ];

        const convertedCount = fillConnectedWorldWater(
            worldMap,
            { x: tileSize, y: 0 },
            tileSize,
            { mode: 'transparent' }
        );

        expect(convertedCount).toBeGreaterThanOrEqual(1);
        const adjacentTransparentCell = worldMap.find((block) => block.x === 0 && block.y === 0 && block.waterOnly === true);
        expect(adjacentTransparentCell).toBeDefined();
    });

    it('treats non-collision background tiles as traversable for transparent flood fill', () => {
        const tileSize = 32;
        const worldMap: MapBlock[] = [
            createWorldBlock(-tileSize, 0),
            createWorldBlock(tileSize * 3, 0),
            createWorldBlock(-tileSize, tileSize),
            createWorldBlock(0, tileSize),
            createWorldBlock(tileSize, tileSize),
            createWorldBlock(tileSize * 2, tileSize),
            createWorldBlock(tileSize * 3, tileSize),
            createBackgroundBlock(0, 0),
            createBackgroundBlock(tileSize, 0)
        ];

        const convertedCount = fillConnectedWorldWater(worldMap, { x: 0, y: 0 }, tileSize, { mode: 'transparent' });

        expect(convertedCount).toBeGreaterThanOrEqual(1);
        expect(worldMap.some((block) => block.x === tileSize * 2 && block.y === 0 && block.waterOnly === true)).toBe(true);
    });

    it('fills one empty tile with a water-only block', () => {
        const tileSize = 32;
        const worldMap: MapBlock[] = [createWorldBlock(0, tileSize)];

        const changedCount = setSingleWaterTile(worldMap, { x: 0, y: 0 }, tileSize);

        expect(changedCount).toBe(1);
        const waterBlock = worldMap.find((block) => block.x === 0 && block.y === 0);
        expect(waterBlock?.water).toBe(true);
        expect(waterBlock?.waterOnly).toBe(true);
        expect(waterBlock?.collision).toBe(false);
    });

    it('marks one terrain tile as water without creating a water-only tile', () => {
        const tileSize = 32;
        const worldMap: MapBlock[] = [createDiagonalWorldBlock(tileSize, 0)];

        const changedCount = setSingleWaterTile(worldMap, { x: tileSize, y: 0 }, tileSize);

        expect(changedCount).toBe(1);
        expect(worldMap[0].water).toBe(true);
        expect(worldMap[0].waterOnly).not.toBe(true);
    });

    it('clears one water-only tile and clears water flag from terrain in that cell', () => {
        const tileSize = 32;
        const terrain = createDiagonalWorldBlock(tileSize, 0);
        terrain.water = true;
        const worldMap: MapBlock[] = [
            terrain,
            {
                x: tileSize,
                y: 0,
                type: 'floor_full',
                collision: false,
                palette: 14,
                water: true,
                waterOnly: true
            }
        ];

        const changedCount = clearSingleWaterTile(worldMap, { x: tileSize, y: 0 }, tileSize);

        expect(changedCount).toBe(2);
        expect(worldMap).toHaveLength(1);
        expect(worldMap[0].water).toBeUndefined();
    });
});
