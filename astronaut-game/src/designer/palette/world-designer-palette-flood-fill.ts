type PaletteFillEntity = {
    x: number;
    y: number;
    type: string;
    palette?: number;
};

type FillConnectedPaletteOptions<T extends PaletteFillEntity> = {
    items: T[];
    seed: T;
    tileSize: number;
    toPalette: number;
};

type GridPoint = { x: number; y: number };

function toGridCoordinate(value: number, tileSize: number) {
    return Math.round(value / tileSize);
}

function toCellKey(point: GridPoint) {
    return `${point.x}:${point.y}`;
}

function getOrthogonalNeighbors(point: GridPoint): GridPoint[] {
    return [
        { x: point.x - 1, y: point.y },
        { x: point.x + 1, y: point.y },
        { x: point.x, y: point.y - 1 },
        { x: point.x, y: point.y + 1 }
    ];
}

export function fillConnectedPalette<T extends PaletteFillEntity>(options: FillConnectedPaletteOptions<T>) {
    const { items, seed, tileSize, toPalette } = options;
    if (!Array.isArray(items) || items.length === 0 || !Number.isFinite(tileSize) || tileSize <= 0) {
        return 0;
    }

    const sourcePalette = typeof seed.palette === 'number' ? seed.palette : 0;
    const candidateIndexesByCell = new Map<string, number[]>();
    for (let index = 0; index < items.length; index += 1) {
        const item = items[index];
        const itemPalette = typeof item.palette === 'number' ? item.palette : 0;
        if (item.type !== seed.type || itemPalette !== sourcePalette) {
            continue;
        }
        const cell = {
            x: toGridCoordinate(item.x, tileSize),
            y: toGridCoordinate(item.y, tileSize)
        };
        const key = toCellKey(cell);
        const existingIndexes = candidateIndexesByCell.get(key);
        if (existingIndexes) {
            existingIndexes.push(index);
            continue;
        }
        candidateIndexesByCell.set(key, [index]);
    }

    const seedCell = {
        x: toGridCoordinate(seed.x, tileSize),
        y: toGridCoordinate(seed.y, tileSize)
    };
    if (!candidateIndexesByCell.has(toCellKey(seedCell))) {
        return 0;
    }

    const queue: GridPoint[] = [seedCell];
    const visited = new Set<string>();
    let changedCount = 0;

    while (queue.length > 0) {
        const point = queue.shift()!;
        const key = toCellKey(point);
        if (visited.has(key)) {
            continue;
        }
        visited.add(key);

        const matchingIndexes = candidateIndexesByCell.get(key);
        if (!matchingIndexes || matchingIndexes.length === 0) {
            continue;
        }

        for (const index of matchingIndexes) {
            if (items[index].palette !== toPalette) {
                items[index].palette = toPalette;
                changedCount += 1;
            }
        }

        for (const neighbor of getOrthogonalNeighbors(point)) {
            const neighborKey = toCellKey(neighbor);
            if (!visited.has(neighborKey) && candidateIndexesByCell.has(neighborKey)) {
                queue.push(neighbor);
            }
        }
    }

    return changedCount;
}
