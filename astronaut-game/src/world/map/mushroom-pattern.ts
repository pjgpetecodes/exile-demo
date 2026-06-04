import type { MapBlock } from '../map.js';

export const MUSHROOM_PATTERN_COLORS = ['#2ad850', '#5ef57d', '#f8eb40', '#ef4f58', '#72c9ff', '#ffffff'];

export function hashStringToSeed(value: string) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
        hash ^= value.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function nextSeed(seed: number) {
    return (Math.imul(seed, 1664525) + 1013904223) >>> 0;
}

export function isMushroomType(type: string) {
    return type === 'mushrooms' || type === 'mushroom';
}

export function getMushroomPatternKey(block: MapBlock) {
    const palette = typeof block.palette === 'number' ? block.palette : 0;
    return `${block.x}:${block.y}:${palette}:${block.rotation ?? 1}`;
}
