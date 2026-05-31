import type { SpriteTranslation } from '../../shared/utilities.js';

type VisibleSpriteRect = { left: number; top: number; width: number; height: number } | null;

export function getVisibleSpriteRectCached(
    cache: Map<string, VisibleSpriteRect>,
    resolver: ((
        type: string,
        palette: number,
        rotation: number,
        translation?: SpriteTranslation
    ) => VisibleSpriteRect) | null,
    type: string,
    palette: number,
    rotation: number,
    translation: SpriteTranslation = 'center'
) {
    if (!resolver) {
        return null;
    }
    const cacheKey = `${type}|${palette}|${rotation}|${translation}`;
    if (cache.has(cacheKey)) {
        return cache.get(cacheKey) ?? null;
    }

    const rect = resolver(type, palette, rotation, translation);
    cache.set(cacheKey, rect);
    return rect;
}
