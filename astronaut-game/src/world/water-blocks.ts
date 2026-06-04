type WaterAwareBlock = {
    type?: unknown;
    palette?: unknown;
    water?: unknown;
};

const LEGACY_WATER_TYPES = new Set([
    'floor_full',
    'floor_diag_full'
]);

const LEGACY_WATER_PALETTE = 14;

function normalizePaletteValue(palette: unknown): number | null {
    if (typeof palette === 'number' && Number.isFinite(palette)) {
        return Math.round(palette);
    }
    if (typeof palette === 'string' && palette.trim().length > 0) {
        const parsed = Number(palette);
        if (Number.isFinite(parsed)) {
            return Math.round(parsed);
        }
    }
    return null;
}

export function shouldTreatTypePaletteAsWater(type: unknown, palette: unknown): boolean {
    if (typeof type !== 'string' || !LEGACY_WATER_TYPES.has(type)) {
        return false;
    }
    return normalizePaletteValue(palette) === LEGACY_WATER_PALETTE;
}

export function isLegacyWaterBlock(block: WaterAwareBlock): boolean {
    return shouldTreatTypePaletteAsWater(block.type, block.palette);
}

export function isWaterBlock(block: WaterAwareBlock): boolean {
    return block.water === true || isLegacyWaterBlock(block);
}

export function normalizeWaterBlock<T extends WaterAwareBlock>(block: T): T {
    if (!isWaterBlock(block)) {
        return block;
    }
    if (block.water === true) {
        return block;
    }
    return {
        ...block,
        water: true
    } as T;
}

export function convertLegacyWaterBlocks<T extends WaterAwareBlock>(blocks: T[]) {
    let converted = 0;
    const normalizedBlocks = blocks.map((block) => {
        const normalized = normalizeWaterBlock(block);
        if (normalized !== block) {
            converted += 1;
        }
        return normalized;
    });
    return {
        blocks: normalizedBlocks,
        converted
    };
}
