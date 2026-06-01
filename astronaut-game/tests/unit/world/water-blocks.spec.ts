import { describe, expect, it } from 'vitest';
import {
    convertLegacyWaterBlocks,
    isLegacyWaterBlock,
    isWaterBlock,
    normalizeWaterBlock,
    shouldTreatTypePaletteAsWater
} from '../../../src/world/water-blocks';

describe('water block normalization', () => {
    it('recognizes legacy floor_full palette 14 blocks as water', () => {
        expect(shouldTreatTypePaletteAsWater('floor_full', 14)).toBe(true);
        expect(shouldTreatTypePaletteAsWater('floor_diag_full', 14)).toBe(true);
        expect(shouldTreatTypePaletteAsWater('floor_full', 13)).toBe(false);
    });

    it('normalizes legacy water metadata to explicit water=true', () => {
        const legacyBlock = {
            x: 64,
            y: 96,
            type: 'floor_full',
            palette: 14,
            collision: true
        };
        expect(isLegacyWaterBlock(legacyBlock)).toBe(true);

        const normalized = normalizeWaterBlock(legacyBlock);
        expect(normalized).toEqual({
            ...legacyBlock,
            water: true
        });
        expect(isWaterBlock(normalized)).toBe(true);
    });

    it('converts only legacy entries when batch-converting', () => {
        const source = [
            { type: 'floor_full', palette: 14, collision: true },
            { type: 'floor_diag_full', palette: 14, collision: true },
            { type: 'floor_full', palette: 3, collision: true },
            { type: 'ship_1', palette: 14, collision: true, water: true }
        ];
        const result = convertLegacyWaterBlocks(source);
        expect(result.converted).toBe(2);
        expect(result.blocks[0].water).toBe(true);
        expect(result.blocks[1].water).toBe(true);
        expect(result.blocks[2].water).toBeUndefined();
        expect(result.blocks[3].water).toBe(true);
    });
});
