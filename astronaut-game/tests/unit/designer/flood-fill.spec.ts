import { describe, expect, it } from 'vitest';
import {
    createNoUpwardFromSeedConstraint,
    getHorizontalAndDownNeighbors,
    runFloodFill
} from '../../../src/designer/tools/flood-fill';

describe('reusable flood fill', () => {
    it('fills connected traversable points', () => {
        const traversable = new Set(['0:0', '1:0', '2:0', '2:1', '2:2']);
        const points = runFloodFill({
            seed: { x: 0, y: 0 },
            getNeighbors: (point) => [
                { x: point.x + 1, y: point.y },
                { x: point.x - 1, y: point.y },
                { x: point.x, y: point.y + 1 },
                { x: point.x, y: point.y - 1 }
            ],
            canTraverse: (point) => traversable.has(`${point.x}:${point.y}`)
        });
        const keys = points.map((point) => `${point.x}:${point.y}`).sort();
        expect(keys).toEqual(['0:0', '1:0', '2:0', '2:1', '2:2']);
    });

    it('supports water-style spread: horizontal + down, no upward from seed row', () => {
        const traversable = new Set([
            '0:5', '1:5', '2:5',
            '0:6', '1:6', '2:6',
            '1:4' // should never be visited (upward from seed row)
        ]);
        const canStayAtOrBelowSeedRow = createNoUpwardFromSeedConstraint(5);
        const points = runFloodFill({
            seed: { x: 1, y: 5 },
            getNeighbors: getHorizontalAndDownNeighbors,
            canTraverse: (point) => canStayAtOrBelowSeedRow(point) && traversable.has(`${point.x}:${point.y}`)
        });
        const keys = points.map((point) => `${point.x}:${point.y}`).sort();
        expect(keys).toEqual(['0:5', '0:6', '1:5', '1:6', '2:5', '2:6']);
        expect(keys).not.toContain('1:4');
    });
});
