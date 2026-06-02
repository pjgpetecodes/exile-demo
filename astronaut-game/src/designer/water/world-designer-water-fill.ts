import type { MapBlock } from '../../world/map.js';
import {
    createNoUpwardFromSeedConstraint,
    getHorizontalAndDownNeighbors,
    runFloodFill
} from '../tools/flood-fill.js';

type WorldPoint = { x: number; y: number };
type GridPoint = { x: number; y: number };

const DEFAULT_WATER_BLOCK_TYPE = 'floor_full';
const DEFAULT_WATER_PALETTE = 14;

function toGridCoordinate(value: number, tileSize: number) {
    return Math.round(value / tileSize);
}

function toCellKey(gridX: number, gridY: number) {
    return `${gridX}:${gridY}`;
}

function hasNonWaterBlock(blocks: MapBlock[] | undefined) {
    return (blocks ?? []).some((block) => block.water !== true);
}

function isLikelyTransparentEdgeTerrain(block: MapBlock) {
    const type = typeof block.type === 'string' ? block.type.toLowerCase() : '';
    return type.includes('diag') || type.includes('half');
}

function createWaterBlockAtGrid(grid: GridPoint, tileSize: number): MapBlock {
    return {
        x: grid.x * tileSize,
        y: grid.y * tileSize,
        type: DEFAULT_WATER_BLOCK_TYPE,
        collision: false,
        palette: DEFAULT_WATER_PALETTE,
        water: true,
        waterOnly: true
    };
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
    const noUpwardConstraint = createNoUpwardFromSeedConstraint(seedGridY);
    const seedBlocks = blocksByCell.get(seedKey) ?? [];
    const hasSeedWorldBlocks = hasNonWaterBlock(seedBlocks);

    const connectedCells = hasSeedWorldBlocks
        ? runFloodFill({
            seed: { x: seedGridX, y: seedGridY },
            getNeighbors: getHorizontalAndDownNeighbors,
            canTraverse: (point) =>
                noUpwardConstraint(point) &&
                hasNonWaterBlock(blocksByCell.get(toCellKey(point.x, point.y)))
        })
        : (() => {
            const solidCellPoints = [...blocksByCell.entries()]
                .filter(([, blocks]) => hasNonWaterBlock(blocks))
                .map(([key]) => {
                    const [x, y] = key.split(':').map((value) => Number(value));
                    return { x, y };
                })
                .filter((point) => Number.isFinite(point.x) && Number.isFinite(point.y));
            if (solidCellPoints.length === 0) {
                return [];
            }
            const xs = solidCellPoints.map((point) => point.x);
            const ys = solidCellPoints.map((point) => point.y);
            const minX = Math.min(...xs) - 1;
            const maxX = Math.max(...xs) + 1;
            const maxY = Math.max(...ys) + 1;

            return runFloodFill({
                seed: { x: seedGridX, y: seedGridY },
                getNeighbors: getHorizontalAndDownNeighbors,
                canTraverse: (point) => {
                    if (!noUpwardConstraint(point)) {
                        return false;
                    }
                    if (point.x < minX || point.x > maxX || point.y > maxY) {
                        return false;
                    }
                    return !hasNonWaterBlock(blocksByCell.get(toCellKey(point.x, point.y)));
                }
            });
        })();

    let convertedCount = 0;
    for (const cell of connectedCells) {
        const blocks = blocksByCell.get(toCellKey(cell.x, cell.y)) ?? [];
        if (hasSeedWorldBlocks) {
            for (const block of blocks) {
                if (block.water === true) {
                    continue;
                }
                block.water = true;
                convertedCount += 1;
            }
            continue;
        }
        if (blocks.length === 0) {
            const newWaterBlock = createWaterBlockAtGrid(cell, tileSize);
            worldMap.push(newWaterBlock);
            blocksByCell.set(toCellKey(cell.x, cell.y), [newWaterBlock]);
            convertedCount += 1;
        }
    }

    if (!hasSeedWorldBlocks) {
        for (const cell of connectedCells) {
            for (const neighbor of getHorizontalAndDownNeighbors(cell)) {
                if (neighbor.y < seedGridY) {
                    continue;
                }
                const neighborBlocks = blocksByCell.get(toCellKey(neighbor.x, neighbor.y)) ?? [];
                for (const block of neighborBlocks) {
                    if (block.water === true || !isLikelyTransparentEdgeTerrain(block)) {
                        continue;
                    }
                    block.water = true;
                    convertedCount += 1;
                }
            }
        }
    }
    return convertedCount;
}
