import { createWorldDesignerSpritePreviewRendering } from './world-designer-sprite-preview-rendering.js';

import type { CustomSpriteDefinition } from '../core/world-designer-types.js';

type WorldDesignerPreviewRenderingControllerDeps = Parameters<typeof createWorldDesignerSpritePreviewRendering>[0];

export function createWorldDesignerPreviewRenderingController(deps: WorldDesignerPreviewRenderingControllerDeps) {
    let spritePreviewRenderingApi: ReturnType<typeof createWorldDesignerSpritePreviewRendering> | null = null;

    function ensureSpritePreviewRenderingApi() {
        if (!spritePreviewRenderingApi) {
            spritePreviewRenderingApi = createWorldDesignerSpritePreviewRendering(deps);
        }
        return spritePreviewRenderingApi;
    }

    function drawCustomSpriteDefinitionAt(
        ctx: CanvasRenderingContext2D,
        definition: CustomSpriteDefinition,
        screenX: number,
        screenY: number
    ) {
        return ensureSpritePreviewRenderingApi().drawCustomSpriteDefinitionAt(ctx, definition, screenX, screenY);
    }

    function renderCustomSpritePreviewCanvas(
        canvas: HTMLCanvasElement,
        definition: CustomSpriteDefinition | null
    ) {
        return ensureSpritePreviewRenderingApi().renderCustomSpritePreviewCanvas(canvas, definition);
    }

    function renderCurrentSpritePreview() {
        ensureSpritePreviewRenderingApi().renderCurrentSpritePreview();
    }

    return {
        drawCustomSpriteDefinitionAt,
        renderCustomSpritePreviewCanvas,
        renderCurrentSpritePreview
    };
}
