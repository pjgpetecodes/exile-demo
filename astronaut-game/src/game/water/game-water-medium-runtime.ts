import { getMapBlocksNearWorldPoint } from '../../world/map.js';
import type { MapBlock } from '../../world/map.js';
import { isWaterBlock } from '../../world/water-blocks.js';

type WaterRect = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

type WaterBlock = Pick<MapBlock, 'x' | 'y' | 'type' | 'palette' | 'water' | 'waterOnly'>;

function isPointInsideWaterBlock(
    x: number,
    y: number,
    spriteScale: number,
    block: WaterBlock
) {
    const tileW = 32 * spriteScale;
    const tileH = 32 * spriteScale;
    return x >= block.x &&
        x < block.x + tileW &&
        y >= block.y &&
        y < block.y + tileH;
}

function isPointInWater(
    x: number,
    y: number,
    spriteScale: number,
    mapBlocks: MapBlock[]
) {
    const candidates = getMapBlocksNearWorldPoint(x, y, spriteScale, mapBlocks);
    for (const block of candidates) {
        if (!isWaterBlock(block)) {
            continue;
        }
        if (isPointInsideWaterBlock(x, y, spriteScale, block)) {
            return true;
        }
    }
    return false;
}

export function isWorldPointInWater(
    x: number,
    y: number,
    spriteScale: number,
    mapBlocks: MapBlock[]
) {
    if (!Array.isArray(mapBlocks) || mapBlocks.length === 0) {
        return false;
    }
    return isPointInWater(x, y, spriteScale, mapBlocks);
}

export function getWaterSubmersionRatioForRect(
    rect: WaterRect,
    spriteScale: number,
    mapBlocks: MapBlock[],
    sampleColumns = 3,
    sampleRows = 5
) {
    if (!Array.isArray(mapBlocks) || mapBlocks.length === 0) {
        return 0;
    }
    const width = Math.max(1, rect.right - rect.left);
    const height = Math.max(1, rect.bottom - rect.top);
    const columns = Math.max(1, sampleColumns);
    const rows = Math.max(1, sampleRows);
    let submergedSamples = 0;
    let totalSamples = 0;
    for (let row = 0; row < rows; row += 1) {
        const y = Math.round(rect.top + ((row + 0.5) / rows) * height);
        for (let column = 0; column < columns; column += 1) {
            const x = Math.round(rect.left + ((column + 0.5) / columns) * width);
            totalSamples += 1;
            if (isPointInWater(x, y, spriteScale, mapBlocks)) {
                submergedSamples += 1;
            }
        }
    }
    if (totalSamples <= 0) {
        return 0;
    }
    return submergedSamples / totalSamples;
}
