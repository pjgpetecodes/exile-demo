import { describe, expect, it } from 'vitest';
import { createWorldDesignerSelectionGeometry } from '../../../src/designer/selection/world-designer-selection-geometry.js';

describe('world designer selection geometry', () => {
    it('supports Alt visible-pixel picking for overlapping entities', () => {
        const collectable = { id: 'collectable-top' };
        const worldBlock = { id: 'world-under' };
        const geometry = createWorldDesignerSelectionGeometry({
            host: {
                getRawWorldData: () => ({
                    worldMap: [worldBlock],
                    buttons: [],
                    doors: [],
                    creatures: [],
                    collectables: [collectable]
                })
            },
            getCustomSpriteInstances: () => [],
            getLayerVisibility: () => ({
                world: true,
                buttons: true,
                doors: true,
                creatures: true,
                collectables: true,
                custom: true
            }),
            getEntityRect: (entity: unknown) => {
                if (entity === collectable) {
                    return { left: 0, top: 0, right: 32, bottom: 32 };
                }
                return { left: 0, top: 0, right: 32, bottom: 32 };
            },
            getEntityVisibleRect: (entity: unknown) => {
                if (entity === collectable) {
                    return { left: 24, top: 24, right: 32, bottom: 32 };
                }
                if (entity === worldBlock) {
                    return { left: 0, top: 0, right: 20, bottom: 20 };
                }
                return null;
            },
            findWorldBlockByExactPosition: () => null,
            findTeleporterForWorldBlock: () => null,
            getPrimarySelection: () => null,
            areSameSelection: () => false,
            normalizeRect: (start: { x: number; y: number }, end: { x: number; y: number }) => ({
                left: Math.min(start.x, end.x),
                right: Math.max(start.x, end.x),
                top: Math.min(start.y, end.y),
                bottom: Math.max(start.y, end.y)
            }),
            rectsIntersect: () => false
        });

        const defaultHit = geometry.getEntityAt(10, 10, false);
        const visibleHit = geometry.getEntityAt(10, 10, true);

        expect(defaultHit?.entity).toBe(collectable);
        expect(visibleHit?.entity).toBe(worldBlock);
    });
});
