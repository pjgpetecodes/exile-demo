import { Button } from '../../entities/button.js';
import { clearPreviewCanvas } from '../core/world-designer-helpers.js';

import type { SpriteTranslation } from '../../shared/utilities.js';
import type { WorldDesignerHost } from '../core/world-designer-types.js';

type CreateButtonEntityConfig = {
    x: number;
    y: number;
    palette?: number;
    rotation?: number;
    collision?: boolean;
    active?: boolean;
    linkedDoors?: number[];
};

type SpritePreviewCanvasContext = {
    host: Pick<WorldDesignerHost, 'drawSpritePreview' | 'drawSpriteSample'>;
    createButtonEntity: (config: CreateButtonEntityConfig) => Button;
    getPalette: () => number;
    getRotation: () => number;
};

export function createWorldDesignerSpritePreviewCanvasHelpers(context: SpritePreviewCanvasContext) {
    const { host } = context;

    function renderSpritePreviewCanvas(
        canvas: HTMLCanvasElement,
        type: string,
        palette: number,
        rotation: number,
        translation: SpriteTranslation = 'center'
    ) {
        clearPreviewCanvas(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;
        return host.drawSpritePreview(ctx, type, palette, rotation, false, undefined, translation);
    }

    function renderButtonCompositePreviewCanvas(
        canvas: HTMLCanvasElement,
        button?: Button
    ) {
        clearPreviewCanvas(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return false;

        const previewButton = button ?? context.createButtonEntity({
            x: 0,
            y: 0,
            palette: context.getPalette(),
            rotation: context.getRotation(),
            collision: true,
            active: false,
            linkedDoors: []
        });
        const parts = previewButton.getRenderParts();
        const sourceTileSize = 32;
        const sourceRects = parts.map((part) => ({
            part,
            left: part.x,
            top: part.y,
            width: (part.cropLeftHalf || part.cropRightHalf) ? Math.floor(sourceTileSize / 2) : sourceTileSize,
            height: sourceTileSize
        }));
        const boxRect = sourceRects.find((rect) => rect.part.type === previewButton.boxType) ?? sourceRects[sourceRects.length - 1];
        if (!boxRect) {
            return false;
        }
        const boxCenterX = boxRect.left + boxRect.width / 2;
        const boxCenterY = boxRect.top + boxRect.height / 2;
        const minX = Math.min(...sourceRects.map((rect) => rect.left - boxCenterX));
        const minY = Math.min(...sourceRects.map((rect) => rect.top - boxCenterY));
        const maxX = Math.max(...sourceRects.map((rect) => rect.left + rect.width - boxCenterX));
        const maxY = Math.max(...sourceRects.map((rect) => rect.top + rect.height - boxCenterY));
        const padding = 8;
        const availableWidth = Math.max(1, canvas.width - padding * 2);
        const availableHeight = Math.max(1, canvas.height - padding * 2);
        const fixedPreviewSpan = sourceTileSize * 3.5;
        const fittedScale = Math.min(
            availableWidth / Math.max(1, maxX - minX),
            availableHeight / Math.max(1, maxY - minY)
        );
        const scale = Math.max(
            1,
            Math.min(
                fittedScale,
                Math.min(availableWidth, availableHeight) / fixedPreviewSpan
            )
        );
        const drawTileSize = Math.max(1, Math.round(sourceTileSize * scale));
        const anchorX = canvas.width / 2;
        const anchorY = canvas.height / 2;

        for (const rect of sourceRects) {
            const partCanvas = document.createElement('canvas');
            partCanvas.width = drawTileSize;
            partCanvas.height = drawTileSize;
            const partCtx = partCanvas.getContext('2d');
            if (!partCtx) {
                continue;
            }
            host.drawSpriteSample(
                partCtx,
                rect.part.type,
                rect.part.palette,
                rect.part.rotation,
                true,
                drawTileSize
            );
            const sourceWidth = (rect.part.cropLeftHalf || rect.part.cropRightHalf)
                ? Math.max(1, Math.floor(partCanvas.width / 2))
                : partCanvas.width;
            const sourceStartX = rect.part.cropRightHalf
                ? Math.max(0, partCanvas.width - sourceWidth)
                : 0;
            const destinationWidth = Math.max(1, Math.round(rect.width * scale));
            const destinationHeight = Math.max(1, Math.round(rect.height * scale));
            ctx.drawImage(
                partCanvas,
                sourceStartX,
                0,
                sourceWidth,
                partCanvas.height,
                Math.round(anchorX + (rect.left - boxCenterX) * scale),
                Math.round(anchorY + (rect.top - boxCenterY) * scale),
                destinationWidth,
                destinationHeight
            );
        }

        return true;
    }

    return {
        renderSpritePreviewCanvas,
        renderButtonCompositePreviewCanvas
    };
}
