import type { MapBlock } from '../../world/map.js';
import {
    createNoUpwardFromSeedConstraint,
    getHorizontalAndDownNeighbors,
    runFloodFill
} from '../tools/flood-fill.js';

type WorldPoint = { x: number; y: number };

function toGridCoordinate(value: number, tileSize: number) {
    return Math.round(value / tileSize);
}

function toCellKey(gridX: number, gridY: number) {
    return `${gridX}:${gridY}`;
}

export function fillConnectedWorldWater(
    worldMap: MapBlock[],
    seed: WorldPoint,
    tileSize: number
) {
    if (!Array.isArray(worldMap) || worldMap.length === 0 || !Number.isFinite(tileSize) || tileSize <= 0) {
        return 0;
    }
    const blocksByCell = new Map<string, MapBlock[]>();
    for (const block of worldMap) {
        const key = toCellKey(
            toGridCoordinate(block.x, tileSize),
            toGridCoordinate(block.y, tileSize)
        );
        const existing = blocksByCell.get(key);
        if (existing) {
            existing.push(block);
            continue;
        }
        blocksByCell.set(key, [block]);
    }

    const seedGridX = toGridCoordinate(seed.x, tileSize);
    const seedGridY = toGridCoordinate(seed.y, tileSize);
    const seedKey = toCellKey(seedGridX, seedGridY);
    if (!blocksByCell.has(seedKey)) {
        return 0;
    }

    const noUpwardConstraint = createNoUpwardFromSeedConstraint(seedGridY);
    const connectedCells = runFloodFill({
        seed: { x: seedGridX, y: seedGridY },
        getNeighbors: getHorizontalAndDownNeighbors,
        canTraverse: (point) =>
            noUpwardConstraint(point) &&
            blocksByCell.has(toCellKey(point.x, point.y))
    });

    let convertedCount = 0;
    for (const cell of connectedCells) {
        const blocks = blocksByCell.get(toCellKey(cell.x, cell.y)) ?? [];
        for (const block of blocks) {
            if (block.water === true) {
                continue;
            }
            block.water = true;
            convertedCount += 1;
        }
    }
    return convertedCount;
}
