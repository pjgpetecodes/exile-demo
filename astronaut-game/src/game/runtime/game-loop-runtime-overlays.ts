type RotationEntity = { rotation?: number };

type BoundingBox = {
    minX: number;
    minY: number;
    width: number;
    height: number;
};

function applyEntityRotationTransform(
    ctx: CanvasRenderingContext2D,
    entity: RotationEntity
) {
    if (!entity.rotation) {
        return;
    }
    if (entity.rotation >= 1 && entity.rotation <= 4) {
        ctx.rotate(((entity.rotation - 1) * Math.PI) / 2);
    } else if (entity.rotation === 5) {
        ctx.scale(-1, 1);
    } else if (entity.rotation === 6) {
        ctx.scale(1, -1);
    } else if (entity.rotation === 7) {
        ctx.scale(-1, -1);
    } else if (entity.rotation === 8) {
        ctx.rotate(Math.PI / 2);
        ctx.scale(-1, 1);
    } else if (entity.rotation === 9) {
        ctx.rotate((3 * Math.PI) / 2);
        ctx.scale(-1, 1);
    }
}

export function drawBlackBackgroundHighlights(options: {
    ctx: CanvasRenderingContext2D;
    camera: { x: number; y: number };
    blocks: Array<{ type?: string; x: number; y: number; rotation?: number }>;
    boundingBoxes: Map<unknown, BoundingBox>;
    spriteScale: number;
}) {
    const { ctx, camera, blocks, boundingBoxes, spriteScale } = options;
    ctx.save();
    ctx.strokeStyle = 'cyan';
    ctx.lineWidth = 2;
    for (const block of blocks) {
        if (block.type !== 'black_background') {
            continue;
        }
        const bbox = boundingBoxes.get(block);
        const tileW = 32 * spriteScale;
        const tileH = 32 * spriteScale;
        const drawX = block.x - camera.x + tileW / 2;
        const drawY = block.y - camera.y + tileH / 2;
        ctx.save();
        ctx.translate(drawX, drawY);
        applyEntityRotationTransform(ctx, block);
        if (bbox) {
            const x = -tileW / 2 + bbox.minX * spriteScale;
            const y = -tileH / 2 + bbox.minY * spriteScale;
            const w = bbox.width * spriteScale;
            const h = bbox.height * spriteScale;
            ctx.strokeRect(x, y, w, h);
        } else {
            ctx.strokeRect(-tileW / 2, -tileH / 2, tileW, tileH);
        }
        ctx.restore();
    }
    ctx.restore();
}

export function drawWorldEntityTightBoundingBoxes(options: {
    ctx: CanvasRenderingContext2D;
    camera: { x: number; y: number };
    entities: Array<{ type?: string; x: number; y: number; rotation?: number; collision?: boolean; palette?: number; translation?: string }>;
    spriteScale: number;
    blockInstanceRotatedBoundingBoxes: Map<unknown, BoundingBox>;
    worldMapBoundingBoxes: Record<string, BoundingBox | undefined>;
    worldMapRotatedBoundingBoxes: Record<string, Record<number, BoundingBox | undefined> | undefined>;
    findSpriteRectByType: (type: string) => any;
    getEntityPreviewSheet: (entity: { palette?: number }) => any;
    getTransformedSpriteCanvas: (sheet: any, rect: any, rotation: number) => any;
    getSpriteTranslationOffset: (sprite: any, translation: any, scale: number) => { x: number; y: number };
    normalizeSpriteTranslation: (value: string | undefined) => any;
}) {
    const {
        ctx,
        camera,
        entities,
        spriteScale,
        blockInstanceRotatedBoundingBoxes,
        worldMapBoundingBoxes,
        worldMapRotatedBoundingBoxes,
        findSpriteRectByType,
        getEntityPreviewSheet,
        getTransformedSpriteCanvas,
        getSpriteTranslationOffset,
        normalizeSpriteTranslation
    } = options;
    const tileW = 32 * spriteScale;
    const tileH = 32 * spriteScale;
    for (const entity of entities) {
        if (!entity.collision || !entity.type) {
            continue;
        }
        let bbox = blockInstanceRotatedBoundingBoxes.get(entity);
        if (!bbox) {
            const rotation = typeof entity.rotation === 'number' ? entity.rotation : 0;
            bbox = worldMapRotatedBoundingBoxes[entity.type]?.[rotation] ?? worldMapBoundingBoxes[entity.type];
        }
        if (!bbox) {
            continue;
        }
        ctx.save();
        const drawX = entity.x - camera.x + tileW / 2;
        const drawY = entity.y - camera.y + tileH / 2;
        ctx.translate(drawX, drawY);
        applyEntityRotationTransform(ctx, entity);
        const rect = findSpriteRectByType(entity.type);
        const previewSheet = getEntityPreviewSheet(entity);
        const transformedSprite = rect && previewSheet
            ? getTransformedSpriteCanvas(
                previewSheet,
                rect,
                typeof entity.rotation === 'number' ? entity.rotation : 1
            )
            : null;
        const translationOffset = getSpriteTranslationOffset(
            transformedSprite,
            normalizeSpriteTranslation(entity.translation),
            spriteScale
        );
        const x = -tileW / 2 + translationOffset.x + bbox.minX * spriteScale;
        const y = -tileH / 2 + translationOffset.y + bbox.minY * spriteScale;
        const w = bbox.width * spriteScale;
        const h = bbox.height * spriteScale;
        ctx.strokeStyle = 'red';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, w, h);
        ctx.restore();
    }
}

export function drawMutedSoundIndicator(ctx: CanvasRenderingContext2D, canvas: HTMLCanvasElement) {
    ctx.save();
    ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#020617';
    ctx.strokeStyle = '#f8fafc';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.roundRect(canvas.width - 62, 14, 48, 36, 8);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = '#f8fafc';
    ctx.beginPath();
    ctx.moveTo(canvas.width - 50, 31);
    ctx.lineTo(canvas.width - 42, 31);
    ctx.lineTo(canvas.width - 34, 23);
    ctx.lineTo(canvas.width - 34, 41);
    ctx.lineTo(canvas.width - 42, 33);
    ctx.lineTo(canvas.width - 50, 33);
    ctx.closePath();
    ctx.fill();

    ctx.beginPath();
    ctx.moveTo(canvas.width - 28, 22);
    ctx.lineTo(canvas.width - 16, 42);
    ctx.moveTo(canvas.width - 16, 22);
    ctx.lineTo(canvas.width - 28, 42);
    ctx.stroke();
    ctx.restore();
}
