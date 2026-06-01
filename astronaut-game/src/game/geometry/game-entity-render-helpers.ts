import type { Position } from '../../types/index.js';

type RuntimeEntity = {
    x?: number;
    y?: number;
    type: string;
    rotation?: number;
    translation?: string | null;
    palette?: number;
    state?: Record<string, unknown>;
    flipAroundVisibleCenter?: boolean;
    angleDegrees?: number;
    cropLeftHalf?: boolean;
    cropRightHalf?: boolean;
    creatureProjectile?: { kind?: string };
};

type RenderedEntitySprite = {
    canvas: HTMLCanvasElement;
    drawX: number;
    drawY: number;
};

type RenderHelperOptions = {
    spriteScale: number;
    findSpriteRectByType: (type: string) => any;
    getEntityPreviewSheet: (entity: { palette?: number }) => CanvasImageSource | null;
    getTransformedSpriteCanvas: (
        spriteSheet: CanvasImageSource,
        spriteRect: any,
        rotation?: number,
        cache?: boolean
    ) => HTMLCanvasElement | null;
    normalizeSpriteTranslation: (translation: string | null | undefined) => any;
    getSpriteTranslationOffset: (
        transformedSprite: HTMLCanvasElement | null,
        translation: any,
        spriteScale: number
    ) => { x: number; y: number };
    getVisibleCenterRotationOffset: (
        spriteSheet: CanvasImageSource,
        spriteRect: any,
        authoredRotation: number,
        renderRotation: number
    ) => { x: number; y: number };
    getRenderedEntitySpriteCanvas: (
        spriteSheet: CanvasImageSource,
        spriteRect: any,
        entity: RuntimeEntity
    ) => { canvas: HTMLCanvasElement; offsetX: number; offsetY: number } | null;
    getSpriteVisibleBounds: (
        canvas: HTMLCanvasElement | null
    ) => { minX: number; minY: number; maxX: number; maxY: number } | null;
    getWorldMapRotatedBoundingBoxes: () => Record<string, Record<number, any>>;
    getBlockInstanceRotatedBoundingBoxes: () => WeakMap<object, any>;
    getWorldMapBoundingBoxes: () => Record<string, any>;
};

export type CollisionBounds = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

export function createGameEntityRenderHelpers(options: RenderHelperOptions) {
    function getEntityRenderOffset(entity: RuntimeEntity) {
        const rotation = typeof entity.rotation === 'number' ? Math.round(entity.rotation) : 0;
        const spriteRect = options.findSpriteRectByType(entity.type);
        const previewSheet = options.getEntityPreviewSheet(entity);
        const transformedSprite = spriteRect && previewSheet
            ? options.getTransformedSpriteCanvas(previewSheet, spriteRect, rotation)
            : null;
        const translationOffset = options.getSpriteTranslationOffset(
            transformedSprite,
            options.normalizeSpriteTranslation(entity.translation),
            options.spriteScale
        );
        const authoredRotation = typeof entity.state?.authoredRotation === 'number'
            ? Math.round(Number(entity.state.authoredRotation))
            : rotation;
        const visibleCenterOffset = entity.flipAroundVisibleCenter === true && spriteRect && previewSheet
            ? options.getVisibleCenterRotationOffset(previewSheet, spriteRect, authoredRotation, rotation)
            : { x: 0, y: 0 };

        return {
            x: translationOffset.x + visibleCenterOffset.x * options.spriteScale,
            y: translationOffset.y + visibleCenterOffset.y * options.spriteScale
        };
    }

    function getEntityCollisionBounds(entity: RuntimeEntity): CollisionBounds {
        const tileSize = 32 * options.spriteScale;
        const rotation = typeof entity.rotation === 'number' ? entity.rotation : 0;
        const renderOffset = getEntityRenderOffset(entity);
        const spriteRect = options.findSpriteRectByType(entity.type);
        const previewSheet = options.getEntityPreviewSheet(entity as { palette?: number });

        if (
            Number.isFinite(entity.angleDegrees) &&
            spriteRect &&
            previewSheet &&
            entity.creatureProjectile?.kind !== 'bullet'
        ) {
            const renderedSprite = options.getRenderedEntitySpriteCanvas(previewSheet, spriteRect, entity);
            const renderedBounds = options.getSpriteVisibleBounds(renderedSprite?.canvas ?? null);
            if (renderedSprite && renderedBounds) {
                return {
                    left: renderOffset.x + renderedSprite.offsetX * options.spriteScale + renderedBounds.minX * options.spriteScale,
                    right: renderOffset.x + renderedSprite.offsetX * options.spriteScale + (renderedBounds.maxX + 1) * options.spriteScale - 1,
                    top: renderOffset.y + renderedSprite.offsetY * options.spriteScale + renderedBounds.minY * options.spriteScale,
                    bottom: renderOffset.y + renderedSprite.offsetY * options.spriteScale + (renderedBounds.maxY + 1) * options.spriteScale - 1
                };
            }
        }

        const worldMapRotatedBoundingBoxes = options.getWorldMapRotatedBoundingBoxes();
        const blockInstanceRotatedBoundingBoxes = options.getBlockInstanceRotatedBoundingBoxes();
        const worldMapBoundingBoxes = options.getWorldMapBoundingBoxes();
        const bbox =
            worldMapRotatedBoundingBoxes[entity.type]?.[rotation] ||
            blockInstanceRotatedBoundingBoxes.get(entity as object) ||
            worldMapBoundingBoxes[entity.type];
        if (bbox) {
            return {
                left: renderOffset.x + bbox.minX * options.spriteScale,
                right: renderOffset.x + (bbox.maxX + 1) * options.spriteScale - 1,
                top: renderOffset.y + bbox.minY * options.spriteScale,
                bottom: renderOffset.y + (bbox.maxY + 1) * options.spriteScale - 1
            };
        }

        const transformedSprite = spriteRect && previewSheet
            ? options.getTransformedSpriteCanvas(previewSheet, spriteRect, rotation)
            : null;
        const visibleBounds = options.getSpriteVisibleBounds(transformedSprite);
        if (visibleBounds) {
            return {
                left: renderOffset.x + visibleBounds.minX * options.spriteScale,
                right: renderOffset.x + (visibleBounds.maxX + 1) * options.spriteScale - 1,
                top: renderOffset.y + visibleBounds.minY * options.spriteScale,
                bottom: renderOffset.y + (visibleBounds.maxY + 1) * options.spriteScale - 1
            };
        }

        return {
            left: 0,
            right: tileSize - 1,
            top: 0,
            bottom: tileSize - 1
        };
    }

    function getRenderedEntityWorldSprite(entity: RuntimeEntity): RenderedEntitySprite | null {
        if (typeof entity.x !== 'number' || typeof entity.y !== 'number') {
            return null;
        }
        const spriteRect = options.findSpriteRectByType(entity.type);
        const previewSheet = options.getEntityPreviewSheet(entity);
        if (!spriteRect || !previewSheet) {
            return null;
        }

        const renderedSprite = options.getRenderedEntitySpriteCanvas(previewSheet, spriteRect, entity);
        if (!renderedSprite) {
            return null;
        }

        const translationOffset = options.getSpriteTranslationOffset(
            renderedSprite.canvas,
            options.normalizeSpriteTranslation(entity.translation),
            options.spriteScale
        );
        const authoredRotation = typeof entity.state?.authoredRotation === 'number'
            ? Math.round(Number(entity.state.authoredRotation))
            : (typeof entity.rotation === 'number' ? Math.round(entity.rotation) : 1);
        const visibleCenterFlipOffset = entity.flipAroundVisibleCenter === true
            ? options.getVisibleCenterRotationOffset(previewSheet, spriteRect, authoredRotation, entity.rotation ?? 1)
            : { x: 0, y: 0 };

        return {
            canvas: renderedSprite.canvas,
            drawX: entity.x
                + renderedSprite.offsetX * options.spriteScale
                + translationOffset.x
                + visibleCenterFlipOffset.x * options.spriteScale,
            drawY: entity.y
                + renderedSprite.offsetY * options.spriteScale
                + translationOffset.y
                + visibleCenterFlipOffset.y * options.spriteScale
        };
    }

    function getRenderedSpriteOpaqueSamples(canvas: HTMLCanvasElement) {
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return [] as Array<{ x: number; y: number }>;
        }
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        const points: Array<{ x: number; y: number }> = [];
        for (let y = 0; y < canvas.height; y++) {
            for (let x = 0; x < canvas.width; x++) {
                if (imageData[(y * canvas.width + x) * 4 + 3] > 0) {
                    points.push({ x, y });
                }
            }
        }
        return points;
    }

    function isRenderedSpriteOpaqueAtWorld(
        rendered: RenderedEntitySprite | null,
        worldX: number,
        worldY: number
    ) {
        if (!rendered) {
            return false;
        }

        const localX = Math.floor((worldX - rendered.drawX) / options.spriteScale);
        const localY = Math.floor((worldY - rendered.drawY) / options.spriteScale);
        if (
            localX < 0 ||
            localY < 0 ||
            localX >= rendered.canvas.width ||
            localY >= rendered.canvas.height
        ) {
            return false;
        }

        const ctx = rendered.canvas.getContext('2d');
        if (!ctx) {
            return false;
        }
        return ctx.getImageData(localX, localY, 1, 1).data[3] > 0;
    }

    function doRenderedSpritesOverlap(
        first: RenderedEntitySprite | null,
        second: RenderedEntitySprite | null
    ) {
        if (!first || !second) {
            return false;
        }
        const firstCtx = first.canvas.getContext('2d');
        const secondCtx = second.canvas.getContext('2d');
        if (!firstCtx || !secondCtx) {
            return false;
        }
        const firstAlpha = firstCtx.getImageData(0, 0, first.canvas.width, first.canvas.height).data;
        const secondAlpha = secondCtx.getImageData(0, 0, second.canvas.width, second.canvas.height).data;

        const overlapLeft = Math.max(first.drawX, second.drawX);
        const overlapTop = Math.max(first.drawY, second.drawY);
        const overlapRight = Math.min(
            first.drawX + first.canvas.width * options.spriteScale,
            second.drawX + second.canvas.width * options.spriteScale
        );
        const overlapBottom = Math.min(
            first.drawY + first.canvas.height * options.spriteScale,
            second.drawY + second.canvas.height * options.spriteScale
        );

        if (overlapRight <= overlapLeft || overlapBottom <= overlapTop) {
            return false;
        }

        const scale = options.spriteScale;
        const startLocalX = Math.max(0, Math.floor((overlapLeft - first.drawX) / scale));
        const endLocalX = Math.min(first.canvas.width - 1, Math.ceil((overlapRight - first.drawX) / scale) - 1);
        const startLocalY = Math.max(0, Math.floor((overlapTop - first.drawY) / scale));
        const endLocalY = Math.min(first.canvas.height - 1, Math.ceil((overlapBottom - first.drawY) / scale) - 1);

        for (let localY = startLocalY; localY <= endLocalY; localY++) {
            for (let localX = startLocalX; localX <= endLocalX; localX++) {
                const firstAlphaIndex = (localY * first.canvas.width + localX) * 4 + 3;
                if (firstAlpha[firstAlphaIndex] === 0) {
                    continue;
                }
                const worldX = first.drawX + (localX + 0.5) * scale;
                const worldY = first.drawY + (localY + 0.5) * scale;
                const secondLocalX = Math.floor((worldX - second.drawX) / scale);
                const secondLocalY = Math.floor((worldY - second.drawY) / scale);
                if (
                    secondLocalX < 0 ||
                    secondLocalY < 0 ||
                    secondLocalX >= second.canvas.width ||
                    secondLocalY >= second.canvas.height
                ) {
                    continue;
                }
                const secondAlphaIndex = (secondLocalY * second.canvas.width + secondLocalX) * 4 + 3;
                if (secondAlpha[secondAlphaIndex] > 0) {
                    return true;
                }
            }
        }

        return false;
    }

    function getRenderedSpriteWorldCenter(
        rendered: RenderedEntitySprite | null
    ): Position | null {
        if (!rendered) {
            return null;
        }

        const visibleBounds = options.getSpriteVisibleBounds(rendered.canvas);
        if (visibleBounds) {
            const width = visibleBounds.maxX - visibleBounds.minX + 1;
            const height = visibleBounds.maxY - visibleBounds.minY + 1;
            return {
                x: rendered.drawX + (visibleBounds.minX + width / 2) * options.spriteScale,
                y: rendered.drawY + (visibleBounds.minY + height / 2) * options.spriteScale
            };
        }

        return {
            x: rendered.drawX + (rendered.canvas.width * options.spriteScale) / 2,
            y: rendered.drawY + (rendered.canvas.height * options.spriteScale) / 2
        };
    }

    function getEntitySideAnchorPoint(entity: RuntimeEntity, side: 'left' | 'right') {
        const rendered = getRenderedEntityWorldSprite(entity);
        if (!rendered) {
            return null;
        }

        const opaquePoints = getRenderedSpriteOpaqueSamples(rendered.canvas);
        if (opaquePoints.length === 0) {
            return null;
        }

        const edgeX = side === 'left'
            ? Math.min(...opaquePoints.map((point) => point.x))
            : Math.max(...opaquePoints.map((point) => point.x));
        const edgePoints = opaquePoints.filter((point) => point.x === edgeX);
        const averageY = edgePoints.reduce((sum, point) => sum + point.y + 0.5, 0) / edgePoints.length;

        return {
            x: rendered.drawX + (edgeX + 0.5) * options.spriteScale,
            y: rendered.drawY + averageY * options.spriteScale
        };
    }

    function getEntityFrontAnchorPoint(entity: RuntimeEntity, direction: Position) {
        const rendered = getRenderedEntityWorldSprite(entity);
        if (!rendered) {
            return null;
        }

        const opaquePoints = getRenderedSpriteOpaqueSamples(rendered.canvas);
        if (opaquePoints.length === 0) {
            return null;
        }

        const magnitude = Math.hypot(direction.x, direction.y);
        const normalizedDirection = magnitude > 0.001
            ? { x: direction.x / magnitude, y: direction.y / magnitude }
            : { x: 1, y: 0 };
        let bestPoint = opaquePoints[0];
        let bestScore = Number.NEGATIVE_INFINITY;
        for (const point of opaquePoints) {
            const score = (point.x + 0.5) * normalizedDirection.x + (point.y + 0.5) * normalizedDirection.y;
            if (score > bestScore) {
                bestScore = score;
                bestPoint = point;
            }
        }

        return {
            x: rendered.drawX + (bestPoint.x + 0.5) * options.spriteScale,
            y: rendered.drawY + (bestPoint.y + 0.5) * options.spriteScale
        };
    }

    return {
        getEntityRenderOffset,
        getEntityCollisionBounds,
        getRenderedEntityWorldSprite,
        getRenderedSpriteOpaqueSamples,
        isRenderedSpriteOpaqueAtWorld,
        doRenderedSpritesOverlap,
        getRenderedSpriteWorldCenter,
        getEntitySideAnchorPoint,
        getEntityFrontAnchorPoint
    };
}
