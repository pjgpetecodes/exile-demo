import { SpriteTranslation } from '../../../shared/utilities.js';
import { GameSpriteMapEntry } from './game-sprite-sheet-runtime.js';

type CreateGameSpritePreviewRuntimeOptions = {
    findSpriteRectByType: (type: string) => GameSpriteMapEntry | null;
    getPaletteSheet: (palette: number, fallbackPalette?: number) => CanvasImageSource | null;
    getRemappedSpriteSheets: () => CanvasImageSource[];
    getTransformedSpriteCanvas: (
        spriteSheet: CanvasImageSource,
        rect: { x: number; y: number; w: number; h: number },
        rotation?: number
    ) => HTMLCanvasElement | null;
    getSpriteTranslationOffset: (
        transformedSprite: HTMLCanvasElement,
        translation: SpriteTranslation,
        scaleX: number,
        scaleY?: number
    ) => { x: number; y: number };
};

export function createGameSpritePreviewRuntime(options: CreateGameSpritePreviewRuntimeOptions) {
    function drawSpritePreviewWithSheet(
        context: CanvasRenderingContext2D,
        type: string,
        sheet: CanvasImageSource,
        rotation: number = 1,
        clearFirst: boolean = true,
        targetSize?: number,
        translation: SpriteTranslation = 'center'
    ) {
        const rect = options.findSpriteRectByType(type);
        if (!rect) {
            if (clearFirst) {
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            }
            return false;
        }

        const padding = 8;
        const previewWidth = targetSize ?? context.canvas.width;
        const previewHeight = targetSize ?? context.canvas.height;
        const maxWidth = Math.max(1, previewWidth - padding * 2);
        const maxHeight = Math.max(1, previewHeight - padding * 2);
        const transformedSprite = options.getTransformedSpriteCanvas(sheet, rect, rotation);
        if (!transformedSprite) {
            if (clearFirst) {
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            }
            return false;
        }
        const scale = Math.max(1, Math.min(
            maxWidth / transformedSprite.width,
            maxHeight / transformedSprite.height
        ));
        const drawW = transformedSprite.width * scale;
        const drawH = transformedSprite.height * scale;
        const translationOffset = options.getSpriteTranslationOffset(transformedSprite, translation, scale);

        context.save();
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        context.imageSmoothingEnabled = false;
        context.translate(context.canvas.width / 2, context.canvas.height / 2);
        context.drawImage(
            transformedSprite,
            -drawW / 2 + translationOffset.x,
            -drawH / 2 + translationOffset.y,
            drawW,
            drawH
        );
        context.restore();
        return true;
    }

    function drawSpritePreview(
        context: CanvasRenderingContext2D,
        type: string,
        palette: number,
        rotation: number = 1,
        clearFirst: boolean = true,
        targetSize?: number,
        translation: SpriteTranslation = 'center'
    ) {
        const rect = options.findSpriteRectByType(type);
        if (!rect || options.getRemappedSpriteSheets().length === 0) {
            if (clearFirst) {
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            }
            return false;
        }

        const sheet = options.getPaletteSheet(palette, typeof rect.palette === 'number' ? rect.palette : 0);
        if (!sheet) {
            if (clearFirst) {
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            }
            return false;
        }

        return drawSpritePreviewWithSheet(context, type, sheet, rotation, clearFirst, targetSize, translation);
    }

    function drawSpriteSample(
        context: CanvasRenderingContext2D,
        type: string,
        palette: number,
        rotation: number = 1,
        clearFirst: boolean = true,
        targetSize?: number,
        translation: SpriteTranslation = 'center'
    ) {
        const rect = options.findSpriteRectByType(type);
        if (!rect || options.getRemappedSpriteSheets().length === 0) {
            if (clearFirst) {
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            }
            return false;
        }

        const sheet = options.getPaletteSheet(palette, typeof rect.palette === 'number' ? rect.palette : 0);
        if (!sheet) {
            if (clearFirst) {
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            }
            return false;
        }

        const transformedSprite = options.getTransformedSpriteCanvas(sheet, rect, rotation);
        if (!transformedSprite) {
            if (clearFirst) {
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            }
            return false;
        }

        const drawSize = targetSize ?? Math.min(context.canvas.width, context.canvas.height);
        context.save();
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        context.imageSmoothingEnabled = false;
        const translationOffset = options.getSpriteTranslationOffset(
            transformedSprite,
            translation,
            drawSize / transformedSprite.width,
            drawSize / transformedSprite.height
        );
        context.drawImage(
            transformedSprite,
            translationOffset.x,
            translationOffset.y,
            drawSize,
            drawSize
        );
        context.restore();
        return true;
    }

    return {
        drawSpritePreview,
        drawSpriteSample,
        drawSpritePreviewWithSheet
    };
}
