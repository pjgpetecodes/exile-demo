import { getSpriteVisibleBounds, SpriteTranslation } from '../../shared/utilities.js';
import { getVisibleSpriteRectCached } from '../geometry/world-designer-visible-sprite-cache.js';

import type { WorldDesignerHost } from '../core/world-designer-types.js';

type VisibleSpriteRect = { left: number; top: number; width: number; height: number };

const visibleSpriteRectCache = new Map<string, VisibleSpriteRect | null>();
let visibleSpriteRectResolver: ((
    type: string,
    palette: number,
    rotation: number,
    translation?: SpriteTranslation
) => VisibleSpriteRect | null) | null = null;

export function getVisibleSpriteRect(
    type: string,
    palette: number,
    rotation: number,
    translation: SpriteTranslation = 'center'
) {
    return getVisibleSpriteRectCached(
        visibleSpriteRectCache,
        visibleSpriteRectResolver,
        type,
        palette,
        rotation,
        translation
    );
}

export function configureVisibleSpriteRectResolver(
    host: Pick<WorldDesignerHost, 'drawSpriteSample'>,
    tileSize: number
) {
    visibleSpriteRectResolver = (type, palette, rotation, translation = 'center') => {
        const spriteCanvas = document.createElement('canvas');
        spriteCanvas.width = tileSize;
        spriteCanvas.height = tileSize;
        const spriteCtx = spriteCanvas.getContext('2d');
        if (!spriteCtx) {
            return null;
        }
        const rendered = host.drawSpriteSample(
            spriteCtx,
            type,
            palette,
            rotation,
            true,
            tileSize,
            translation
        );
        if (!rendered) {
            return null;
        }
        const visibleBounds = getSpriteVisibleBounds(spriteCanvas);
        if (!visibleBounds) {
            return null;
        }
        return {
            left: visibleBounds.minX,
            top: visibleBounds.minY,
            width: visibleBounds.width,
            height: visibleBounds.height
        };
    };
}

export function resetVisibleSpriteRectResolverCache() {
    visibleSpriteRectResolver = null;
    visibleSpriteRectCache.clear();
}
