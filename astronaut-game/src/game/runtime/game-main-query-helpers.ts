import type { Position, ChunkActivityBand } from '../../types/index.js';
import type { LayerVisibility } from '../../designer/world-designer.js';

type CollisionBounds = { left: number; right: number; top: number; bottom: number };

type QueryHelpersOptions = {
    findSpriteRectByType: (type: string) => any;
    getPaletteSheet: (palette: number, fallbackPalette?: number) => CanvasImageSource;
    getEntityPreviewSheet: (entity: { palette?: number }) => CanvasImageSource;
    drawWorldBoundingBoxOverlayRuntime: (
        context: CanvasRenderingContext2D,
        camera: Position,
        layerVisibility: LayerVisibility
    ) => void;
    getChunkActivityForWorldPosition: (position: Position, now: number) => ChunkActivityBand;
    getAstronautRenderedWorldSprite: () => any;
    getRenderedSpriteWorldCenter: (renderedSprite: any) => Position | null;
    getAstronautRect: () => CollisionBounds;
};

export function createGameMainQueryHelpers(options: QueryHelpersOptions) {
    function findSpriteRectByType(type: string) {
        return options.findSpriteRectByType(type);
    }

    function getPaletteSheet(palette: number, fallbackPalette?: number) {
        return options.getPaletteSheet(palette, fallbackPalette);
    }

    function getEntityPreviewSheet(entity: { palette?: number }) {
        return options.getEntityPreviewSheet(entity);
    }

    function drawWorldBoundingBoxOverlay(
        context: CanvasRenderingContext2D,
        camera: Position,
        layerVisibility: LayerVisibility = {
            world: true,
            buttons: true,
            doors: true,
            creatures: true,
            collectables: true,
            custom: true
        }
    ) {
        options.drawWorldBoundingBoxOverlayRuntime(context, camera, layerVisibility);
    }

    function getChunkActivity(position: Position, now: number): ChunkActivityBand {
        return options.getChunkActivityForWorldPosition(position, now);
    }

    function getAstronautAimPoint() {
        const renderedCenter = options.getRenderedSpriteWorldCenter(
            options.getAstronautRenderedWorldSprite()
        );
        if (renderedCenter) {
            return renderedCenter;
        }

        const astronautRect = options.getAstronautRect();
        return {
            x: (astronautRect.left + astronautRect.right) / 2,
            y: (astronautRect.top + astronautRect.bottom) / 2
        };
    }

    function clampToRange(value: number, minimum: number, maximum: number) {
        return Math.max(minimum, Math.min(maximum, value));
    }

    return {
        findSpriteRectByType,
        getPaletteSheet,
        getEntityPreviewSheet,
        drawWorldBoundingBoxOverlay,
        getChunkActivityForWorldPosition: getChunkActivity,
        getAstronautAimPoint,
        clampToRange
    };
}
