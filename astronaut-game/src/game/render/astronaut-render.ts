import { Astronaut, Position } from '../../types/index.js';

export type SpriteRect = { x: number; y: number; w: number; h: number; name?: string };
export type AstronautRenderPose = { spriteCol: number; flipSprite: boolean; flipVertical: boolean };
export type RenderedWorldSprite = { canvas: HTMLCanvasElement; drawX: number; drawY: number };

type AstronautRenderBounds = { minX: number; minY: number; maxX: number; maxY: number };
type RenderedEntitySprite = { canvas: HTMLCanvasElement; offsetX: number; offsetY: number };
type AstronautDrawMetrics = { spriteRect: SpriteRect; drawW: number; drawH: number };

type CreateAstronautRendererOptions = {
    spriteScale: number;
    spriteRow: number;
    damageFlashMinIntervalMs: number;
    damageFlashMaxIntervalMs: number;
    getAstronaut: () => Pick<Astronaut, 'position' | 'energy' | 'maxEnergy'>;
    getSpriteSheet: () => HTMLImageElement | undefined;
    getAstronautSpriteSource: () => CanvasImageSource | undefined;
    getSpriteRectFromMap: (row: number, col: number) => SpriteRect;
    getPronePoseActive: () => boolean;
    getActiveCollisionProfile: () => string;
    getAstronautCollisionOffsets: (profile?: string) => { bottom: number };
    getSpriteVisibleBounds: (canvas: HTMLCanvasElement) => AstronautRenderBounds | null;
    getRenderedEntitySpriteCanvas: (
        sheet: CanvasImageSource,
        spriteRect: SpriteRect,
        options: { rotation?: number }
    ) => RenderedEntitySprite | null;
};

export function createAstronautRenderer(options: CreateAstronautRendererOptions) {
    const astronautSpriteFrameCache = new Map<string, HTMLCanvasElement>();

    function getAstronautSpriteFrameCanvas(spriteRect: SpriteRect) {
        const spriteSource = options.getAstronautSpriteSource() || options.getSpriteSheet();
        if (!spriteSource) {
            return null;
        }
        const cacheKey = `${spriteRect.x},${spriteRect.y},${spriteRect.w},${spriteRect.h}`;
        const cached = astronautSpriteFrameCache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const frameCanvas = document.createElement('canvas');
        frameCanvas.width = Math.max(1, spriteRect.w);
        frameCanvas.height = Math.max(1, spriteRect.h);
        const frameContext = frameCanvas.getContext('2d');
        if (!frameContext) {
            return null;
        }
        frameContext.imageSmoothingEnabled = false;
        frameContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
        frameContext.drawImage(
            spriteSource,
            spriteRect.x, spriteRect.y, spriteRect.w, spriteRect.h,
            0, 0, frameCanvas.width, frameCanvas.height
        );
        astronautSpriteFrameCache.set(cacheKey, frameCanvas);
        return frameCanvas;
    }

    function getAstronautInjuryRatio() {
        const astronaut = options.getAstronaut();
        if (astronaut.maxEnergy <= 0) {
            return 0;
        }
        return Math.max(0, 1 - astronaut.energy / astronaut.maxEnergy);
    }

    function isAstronautDamageFlashVisible(now: number) {
        const injuryRatio = getAstronautInjuryRatio();
        if (injuryRatio <= 0) {
            return false;
        }
        const flashIntervalMs = options.damageFlashMaxIntervalMs - injuryRatio * (
            options.damageFlashMaxIntervalMs - options.damageFlashMinIntervalMs
        );
        return Math.floor(now / flashIntervalMs) % 2 === 0;
    }

    function drawAstronautSprite(
        context: CanvasRenderingContext2D,
        spriteRect: SpriteRect,
        drawW: number,
        drawH: number,
        now: number
    ) {
        const frameCanvas = getAstronautSpriteFrameCanvas(spriteRect);
        if (!frameCanvas) {
            return;
        }
        context.imageSmoothingEnabled = false;

        if (!isAstronautDamageFlashVisible(now)) {
            context.drawImage(frameCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
            return;
        }

        const flashCanvas = document.createElement('canvas');
        flashCanvas.width = Math.max(1, Math.round(drawW));
        flashCanvas.height = Math.max(1, Math.round(drawH));
        const flashContext = flashCanvas.getContext('2d');
        if (!flashContext) {
            context.drawImage(frameCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
            return;
        }

        flashContext.imageSmoothingEnabled = false;
        flashContext.drawImage(frameCanvas, 0, 0, flashCanvas.width, flashCanvas.height);
        flashContext.globalCompositeOperation = 'source-atop';
        flashContext.fillStyle = 'rgba(255, 255, 255, 0.85)';
        flashContext.fillRect(0, 0, flashCanvas.width, flashCanvas.height);
        context.drawImage(flashCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
    }

    function getProneRenderAnchorOffset(spriteRect: SpriteRect, flipVertical: boolean) {
        if (!options.getPronePoseActive()) {
            return 0;
        }
        const frameCanvas = getAstronautSpriteFrameCanvas(spriteRect);
        if (!frameCanvas) {
            return 0;
        }
        const visibleBounds = options.getSpriteVisibleBounds(frameCanvas);
        if (!visibleBounds) {
            return 0;
        }

        const visibleBottomPixel = flipVertical
            ? (spriteRect.h - 1 - visibleBounds.minY)
            : visibleBounds.maxY;
        const visibleBottomOffset = -16 * options.spriteScale + (visibleBottomPixel + 1) * options.spriteScale - 1;
        const collisionBottomOffset = options.getAstronautCollisionOffsets(options.getActiveCollisionProfile()).bottom;
        return collisionBottomOffset - visibleBottomOffset;
    }

    function drawWithAnchor(
        context: CanvasRenderingContext2D,
        anchor: Position,
        pose: AstronautRenderPose,
        now: number,
        drawCallback?: (ctx: CanvasRenderingContext2D, metrics: AstronautDrawMetrics) => void
    ) {
        const spriteRect = options.getSpriteRectFromMap(options.spriteRow, pose.spriteCol);
        const drawW = 32 * options.spriteScale;
        const drawH = 32 * options.spriteScale;
        const proneRenderYOffset = getProneRenderAnchorOffset(spriteRect, pose.flipVertical);

        context.save();
        context.translate(Math.round(anchor.x), Math.round(anchor.y + proneRenderYOffset));
        if (pose.flipSprite) context.scale(-1, 1);
        if (pose.flipVertical) context.scale(1, -1);
        drawAstronautSprite(context, spriteRect, drawW, drawH, now);
        if (drawCallback) {
            drawCallback(context, { spriteRect, drawW, drawH });
        }
        context.restore();
        return { spriteRect, drawW, drawH };
    }

    function canRenderAstronaut() {
        const spriteSheet = options.getSpriteSheet();
        return !!(options.getAstronautSpriteSource() || spriteSheet) && !!(spriteSheet && spriteSheet.complete);
    }

    function drawAstronautInWorld(
        context: CanvasRenderingContext2D,
        camera: Position,
        pose: AstronautRenderPose
    ) {
        if (!canRenderAstronaut()) {
            return null;
        }
        const astronaut = options.getAstronaut();
        return drawWithAnchor(
            context,
            {
                x: astronaut.position.x - camera.x,
                y: astronaut.position.y - camera.y
            },
            pose,
            performance.now()
        );
    }

    function drawAstronautAtScreenCenter(
        context: CanvasRenderingContext2D,
        canvasWidth: number,
        canvasHeight: number,
        pose: AstronautRenderPose,
        now: number,
        drawCallback?: (ctx: CanvasRenderingContext2D, metrics: AstronautDrawMetrics) => void
    ) {
        if (!canRenderAstronaut()) {
            return null;
        }
        return drawWithAnchor(
            context,
            {
                x: canvasWidth / 2,
                y: canvasHeight / 2
            },
            pose,
            now,
            drawCallback
        );
    }

    function getAstronautRenderedWorldSprite(pose: AstronautRenderPose): RenderedWorldSprite | null {
        if (!canRenderAstronaut()) {
            return null;
        }
        const spriteRect = options.getSpriteRectFromMap(options.spriteRow, pose.spriteCol);
        let rotation = 1;
        if (pose.flipSprite && pose.flipVertical) {
            rotation = 7;
        } else if (pose.flipSprite) {
            rotation = 5;
        } else if (pose.flipVertical) {
            rotation = 6;
        }

        const spriteSource = options.getAstronautSpriteSource() || options.getSpriteSheet();
        if (!spriteSource) {
            return null;
        }
        const renderedSprite = options.getRenderedEntitySpriteCanvas(
            spriteSource,
            spriteRect,
            { rotation }
        );
        if (!renderedSprite) {
            return null;
        }

        const astronaut = options.getAstronaut();
        return {
            canvas: renderedSprite.canvas,
            drawX: astronaut.position.x - (spriteRect.w * options.spriteScale) / 2 + renderedSprite.offsetX * options.spriteScale,
            drawY: astronaut.position.y - (spriteRect.h * options.spriteScale) / 2 + renderedSprite.offsetY * options.spriteScale
        };
    }

    return {
        drawAstronautInWorld,
        drawAstronautAtScreenCenter,
        getAstronautRenderedWorldSprite
    };
}
