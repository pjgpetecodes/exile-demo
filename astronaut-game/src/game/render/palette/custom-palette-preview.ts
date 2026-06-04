import { PaletteDefinition } from '../../../designer/world-designer.js';

type DrawSpritePreviewWithSheet = (
    context: CanvasRenderingContext2D,
    type: string,
    sheet: CanvasImageSource,
    rotation?: number,
    clearFirst?: boolean,
    targetSize?: number
) => boolean;

type CreateCustomPalettePreviewRendererOptions = {
    getSpriteSheet: () => HTMLImageElement | undefined;
    resolveColor: (color: string | [number, number, number]) => [number, number, number];
    remapSpritePalette: (
        sheet: HTMLImageElement,
        palette: Array<{ from: [number, number, number]; to: [number, number, number] }>
    ) => HTMLCanvasElement;
    drawSpritePreviewWithSheet: DrawSpritePreviewWithSheet;
};

export function createCustomPalettePreviewRenderer(options: CreateCustomPalettePreviewRendererOptions) {
    const customPalettePreviewCache = new Map<string, CanvasImageSource>();

    function clearCache() {
        customPalettePreviewCache.clear();
    }

    function drawCustomPalettePreview(
        context: CanvasRenderingContext2D,
        type: string,
        paletteDefinition: PaletteDefinition,
        rotation: number = 1,
        clearFirst: boolean = true,
        targetSize?: number
    ) {
        const spriteSheet = options.getSpriteSheet();
        if (!spriteSheet) {
            if (clearFirst) {
                context.clearRect(0, 0, context.canvas.width, context.canvas.height);
            }
            return false;
        }
        const cacheKey = JSON.stringify(paletteDefinition);
        let sheet = customPalettePreviewCache.get(cacheKey);
        if (!sheet) {
            const resolvedPalette = paletteDefinition.map(({ from, to }) => ({
                from: options.resolveColor(from),
                to: options.resolveColor(to)
            }));
            sheet = options.remapSpritePalette(spriteSheet, resolvedPalette);
            customPalettePreviewCache.set(cacheKey, sheet);
        }
        return options.drawSpritePreviewWithSheet(context, type, sheet, rotation, clearFirst, targetSize);
    }

    return {
        clearCache,
        drawCustomPalettePreview
    };
}
