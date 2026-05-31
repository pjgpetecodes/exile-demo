import { PaletteCycleSettings } from '../types/index.js';

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function buildDefaultTeleporterPaletteCycle(paletteCount: number): PaletteCycleSettings {
    return {
        palettes: Array.from({ length: Math.max(1, paletteCount) }, (_, index) => index),
        intervalMs: 333
    };
}

export function buildDefaultPaletteCycle(basePalette: number, paletteCount: number): PaletteCycleSettings {
    const start = clamp(Math.round(basePalette), 0, Math.max(0, paletteCount - 1));
    const count = Math.max(2, Math.min(paletteCount, 4));
    return {
        palettes: Array.from({ length: count }, (_, index) => (start + index) % Math.max(1, paletteCount)),
        intervalMs: 333
    };
}

export function normalizePaletteCycle(
    cycle: PaletteCycleSettings | null | undefined,
    paletteCount: number
): PaletteCycleSettings | undefined {
    if (!cycle) return undefined;

    const palettes = Array.isArray(cycle.palettes)
        ? [...new Set(
            cycle.palettes
                .map((palette) => Math.round(palette))
                .filter((palette) => Number.isFinite(palette) && palette >= 0 && palette < paletteCount)
        )]
        : [];

    if (palettes.length === 0) {
        return undefined;
    }

    return {
        palettes,
        intervalMs: Number.isFinite(cycle.intervalMs) ? Math.max(50, Math.round(cycle.intervalMs)) : 333,
        offsetMs: Number.isFinite(cycle.offsetMs) ? Math.round(cycle.offsetMs!) : 0
    };
}

export function getEffectivePaletteCycle(
    type: string,
    cycle: PaletteCycleSettings | null | undefined,
    paletteCount: number
): PaletteCycleSettings | undefined {
    const normalized = normalizePaletteCycle(cycle, paletteCount);
    if (normalized) {
        return normalized;
    }

    if (type === 'teleporter_pad') {
        return buildDefaultTeleporterPaletteCycle(paletteCount);
    }

    return undefined;
}

export function resolveAnimatedPaletteIndex(
    type: string,
    cycle: PaletteCycleSettings | null | undefined,
    basePalette: number,
    paletteCount: number,
    now: number = typeof performance !== 'undefined' ? performance.now() : Date.now()
): number {
    const fallbackPalette = clamp(Math.round(basePalette), 0, Math.max(0, paletteCount - 1));
    const effectiveCycle = getEffectivePaletteCycle(type, cycle, paletteCount);
    if (!effectiveCycle) {
        return fallbackPalette;
    }

    const frame = Math.floor((Math.max(0, now + (effectiveCycle.offsetMs ?? 0))) / effectiveCycle.intervalMs);
    return effectiveCycle.palettes[frame % effectiveCycle.palettes.length] ?? fallbackPalette;
}
