import { describe, expect, it } from 'vitest';
import { redrawOverviewBase } from '../../../src/designer/overview/world-designer-overview';

type FillRectCall = { x: number; y: number; width: number; height: number };

function createMockCanvas(width: number, height: number, fillRectCalls: FillRectCall[]) {
    const context = {
        clearRect: () => {},
        fillRect: (x: number, y: number, rectWidth: number, rectHeight: number) => {
            fillRectCalls.push({ x, y, width: rectWidth, height: rectHeight });
        },
        beginPath: () => {},
        arc: () => {},
        fill: () => {},
        strokeRect: () => {},
        setLineDash: () => {}
    };
    return {
        width,
        height,
        getContext: () => context
    } as unknown as HTMLCanvasElement;
}

describe('world designer overview rendering', () => {
    it('does not paint missing chunk regions when a partial tile snapshot exists', () => {
        const fillRectCalls: FillRectCall[] = [];
        const overviewCanvas = createMockCanvas(100, 100, fillRectCalls);
        const overviewBaseCanvas = createMockCanvas(100, 100, fillRectCalls);

        redrawOverviewBase({
            overviewBaseCanvas,
            overviewCanvas,
            mapWidth: 100,
            mapHeight: 100,
            layerVisibility: {
                world: true,
                buttons: false,
                doors: false,
                creatures: false,
                collectables: false,
                custom: false
            },
            getCategoryArray: () => [],
            getChunkedWorldOverview: () => ({
                chunkWorldSize: 10,
                chunks: [
                    { x: 0, y: 0 },
                    { x: 1, y: 0 }
                ]
            }),
            overviewWorldTiles: [
                { x: 2, y: 2 } // covers chunk 0 only
            ],
            tileSize: 1,
            getEntityRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
            getAstronautStartPosition: () => ({ x: 0, y: 0 })
        });

        const drawsMissingChunkRect = fillRectCalls.some((call) =>
            call.x === 10 && call.y === 0 && call.width >= 10 && call.height >= 10
        );
        expect(drawsMissingChunkRect).toBe(false);
    });

    it('paints chunk regions when no tile snapshot is available yet', () => {
        const fillRectCalls: FillRectCall[] = [];
        const overviewCanvas = createMockCanvas(100, 100, fillRectCalls);
        const overviewBaseCanvas = createMockCanvas(100, 100, fillRectCalls);

        redrawOverviewBase({
            overviewBaseCanvas,
            overviewCanvas,
            mapWidth: 100,
            mapHeight: 100,
            layerVisibility: {
                world: true,
                buttons: false,
                doors: false,
                creatures: false,
                collectables: false,
                custom: false
            },
            getCategoryArray: () => [],
            getChunkedWorldOverview: () => ({
                chunkWorldSize: 10,
                chunks: [{ x: 1, y: 0 }]
            }),
            overviewWorldTiles: null,
            tileSize: 1,
            getEntityRect: () => ({ left: 0, top: 0, width: 0, height: 0 }),
            getAstronautStartPosition: () => ({ x: 0, y: 0 })
        });

        const drawsChunkRect = fillRectCalls.some((call) =>
            call.x === 10 && call.y === 0 && call.width >= 10 && call.height >= 10
        );
        expect(drawsChunkRect).toBe(true);
    });
});
