import type { Position } from '../../types/index.js';

type LayerVisibilityState = {
    world: boolean;
    doors: boolean;
    buttons: boolean;
    creatures: boolean;
    collectables: boolean;
};

type BoundsEntity = { x: number; y: number; collision?: boolean };

export function createWorldBoundingBoxOverlayDrawer(options: {
    getEntityCollisionBounds: (entity: any) => { left: number; right: number; top: number; bottom: number };
    getMapBlocks: () => any[];
    getDoorEntities: () => any[];
    getButtonEntities: () => any[];
    getCreatureEntities: () => any[];
    getCreatureProjectileCollectables: () => any[];
    getDesignerRenderableCollectables: () => any[];
    getRenderableCollectables: () => any[];
    getWorldDesigner: () => { isActive: () => boolean; isPreviewMode: () => boolean } | null;
    getHideBlackBackgroundBlocks: () => boolean;
}) {
    return function drawWorldBoundingBoxOverlay(
        context: CanvasRenderingContext2D,
        camera: Position,
        layerVisibility: LayerVisibilityState
    ) {
        context.save();
        context.strokeStyle = 'lime';
        context.lineWidth = 2;

        const drawWorldBBox = (entity: BoundsEntity) => {
            if (!entity.collision) return;
            const bounds = options.getEntityCollisionBounds(entity);
            context.strokeRect(
                entity.x - camera.x + bounds.left,
                entity.y - camera.y + bounds.top,
                bounds.right - bounds.left + 1,
                bounds.bottom - bounds.top + 1
            );
        };

        const mapBlocksToDraw = !layerVisibility.world
            ? []
            : options.getHideBlackBackgroundBlocks()
                ? options.getMapBlocks().filter((block) => block.type !== 'black_background')
                : options.getMapBlocks();
        const worldDesigner = options.getWorldDesigner();
        const collectablesToDraw = worldDesigner?.isActive() && !worldDesigner.isPreviewMode()
            ? options.getDesignerRenderableCollectables()
            : options.getRenderableCollectables();
        mapBlocksToDraw.forEach(drawWorldBBox);
        if (layerVisibility.doors) options.getDoorEntities().forEach(drawWorldBBox);
        if (layerVisibility.buttons) options.getButtonEntities().forEach(drawWorldBBox);
        if (layerVisibility.creatures) {
            options.getCreatureEntities().forEach(drawWorldBBox);
            options.getCreatureProjectileCollectables().forEach(drawWorldBBox);
        }
        if (layerVisibility.collectables) {
            collectablesToDraw.forEach(drawWorldBBox);
        }
        context.restore();
    };
}
