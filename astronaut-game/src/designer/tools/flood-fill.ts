export type FillPoint = {
    x: number;
    y: number;
};

type FloodFillOptions = {
    seed: FillPoint;
    getNeighbors: (point: FillPoint) => FillPoint[];
    canTraverse: (point: FillPoint) => boolean;
    makeKey?: (point: FillPoint) => string;
    maxVisited?: number;
};

const DEFAULT_MAX_VISITED = 100_000;

function defaultPointKey(point: FillPoint) {
    return `${point.x}:${point.y}`;
}

export function runFloodFill(options: FloodFillOptions): FillPoint[] {
    const {
        seed,
        getNeighbors,
        canTraverse,
        makeKey = defaultPointKey,
        maxVisited = DEFAULT_MAX_VISITED
    } = options;
    const queue: FillPoint[] = [seed];
    const visited = new Set<string>();
    const accepted: FillPoint[] = [];

    while (queue.length > 0) {
        const point = queue.shift()!;
        const key = makeKey(point);
        if (visited.has(key)) {
            continue;
        }
        visited.add(key);
        if (visited.size > maxVisited) {
            break;
        }
        if (!canTraverse(point)) {
            continue;
        }
        accepted.push(point);
        for (const next of getNeighbors(point)) {
            if (!visited.has(makeKey(next))) {
                queue.push(next);
            }
        }
    }

    return accepted;
}

export function getHorizontalAndDownNeighbors(point: FillPoint): FillPoint[] {
    return [
        { x: point.x - 1, y: point.y },
        { x: point.x + 1, y: point.y },
        { x: point.x, y: point.y + 1 }
    ];
}

export function createNoUpwardFromSeedConstraint(seedY: number) {
    return (point: FillPoint) => point.y >= seedY;
}
