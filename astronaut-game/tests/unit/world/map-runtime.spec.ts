import { beforeAll, describe, expect, it } from 'vitest';

let shouldMaskAstronaut: (block: {
    type: string;
    collision: boolean;
    maskAstronaut?: boolean;
    water?: boolean;
    waterOnly?: boolean;
}) => boolean;
let resolveFirePaletteIndex: (
    basePalette: number,
    paletteCount: number,
    now: number,
    seed: number
) => number;
let resolveFireMotion: (now: number, seed: number) => {
    offsetX: number;
    offsetY: number;
    rotationRadians: number;
};
let resolveFireGlobalEmberBudget: () => number;
let getLastFireFrameStats: () => {
    visibleFireBlocks: number;
    renderedEmbers: number;
    emberBudget: number;
};

beforeAll(async () => {
    if (!(globalThis as any).Audio) {
        (globalThis as any).Audio = class {
            currentTime = 0;
            loop = false;
            volume = 1;
            play() {
                return Promise.resolve();
            }
            pause() {}
            cloneNode() {
                return new (globalThis as any).Audio();
            }
        };
    }
    const runtime = await import('../../../src/world/map-runtime.js');
    shouldMaskAstronaut = runtime.shouldMaskAstronaut;
    resolveFirePaletteIndex = runtime.resolveFirePaletteIndex;
    resolveFireMotion = runtime.resolveFireMotion;
    resolveFireGlobalEmberBudget = runtime.resolveFireGlobalEmberBudget;
    getLastFireFrameStats = runtime.getLastFireFrameStats;
});

describe('shouldMaskAstronaut', () => {
    it('never masks for water tiles', () => {
        expect(shouldMaskAstronaut({
            type: 'floor_full',
            collision: false,
            water: true
        })).toBe(false);

        expect(shouldMaskAstronaut({
            type: 'floor_full',
            collision: false,
            waterOnly: true
        })).toBe(false);
    });

    it('masks non-collision non-water tiles by default', () => {
        expect(shouldMaskAstronaut({
            type: 'wall_plant',
            collision: false
        })).toBe(true);
    });
});

describe('resolveFirePaletteIndex', () => {
    it('prefers fire palettes when available', () => {
        const withBoth = resolveFirePaletteIndex(5, 40, 1000, 1234);
        expect([38, 39]).toContain(withBoth);

        const withOne = resolveFirePaletteIndex(5, 39, 1000, 1234);
        expect(withOne).toBe(38);
    });

    it('falls back to base palette when fire palettes are unavailable', () => {
        expect(resolveFirePaletteIndex(4, 10, 500, 1)).toBe(4);
        expect(resolveFirePaletteIndex(99, 10, 500, 1)).toBe(9);
    });
});

describe('resolveFireMotion', () => {
    it('keeps bobbing and rotation within bounded ranges', () => {
        const motion = resolveFireMotion(1750, 8123);
        expect(Math.abs(motion.offsetX)).toBeLessThanOrEqual(3.5);
        expect(Math.abs(motion.offsetY)).toBeLessThanOrEqual(4);
        expect(Math.abs(motion.rotationRadians)).toBeLessThanOrEqual(0.14);
        expect(Math.abs(motion.rotationRadians)).toBeGreaterThan(0.01);
    });
});

describe('fire performance guardrails', () => {
    it('exposes a bounded global ember budget', () => {
        expect(resolveFireGlobalEmberBudget()).toBe(96);
    });

    it('reports frame stats shape for sanity checks', () => {
        const stats = getLastFireFrameStats();
        expect(stats.emberBudget).toBe(96);
        expect(stats.visibleFireBlocks).toBeGreaterThanOrEqual(0);
        expect(stats.renderedEmbers).toBeGreaterThanOrEqual(0);
    });
});
