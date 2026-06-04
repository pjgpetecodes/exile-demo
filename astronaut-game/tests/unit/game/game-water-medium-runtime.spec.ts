import { beforeAll, describe, expect, it } from 'vitest';

let getWaterSubmersionRatioForRect: typeof import('../../../src/game/water/game-water-medium-runtime.js')['getWaterSubmersionRatioForRect'];

beforeAll(async () => {
    (globalThis as any).Audio = class AudioMock { };
    const module = await import('../../../src/game/water/game-water-medium-runtime.js');
    getWaterSubmersionRatioForRect = module.getWaterSubmersionRatioForRect;
});

describe('game water medium runtime', () => {
    it('returns zero submersion when no water blocks intersect', () => {
        const ratio = getWaterSubmersionRatioForRect(
            { left: 0, top: 0, right: 31, bottom: 31 },
            1,
            [{ x: 64, y: 64, type: 'floor_full', palette: 0 }]
        );
        expect(ratio).toBe(0);
    });

    it('returns full submersion when entirely inside a water block', () => {
        const ratio = getWaterSubmersionRatioForRect(
            { left: 0, top: 0, right: 31, bottom: 31 },
            1,
            [{ x: 0, y: 0, type: 'floor_full', palette: 0, water: true }]
        );
        expect(ratio).toBe(1);
    });

    it('detects legacy water blocks by type and palette', () => {
        const ratio = getWaterSubmersionRatioForRect(
            { left: 0, top: 0, right: 31, bottom: 31 },
            1,
            [{ x: 0, y: 0, type: 'floor_full', palette: 14 }]
        );
        expect(ratio).toBe(1);
    });
});
