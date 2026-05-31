import { Button } from '../../entities/button.js';
import { MapBlock } from '../../world/map.js';
import { getSpriteVisibleBounds } from '../../shared/utilities.js';
import { clearPreviewCanvas } from '../core/world-designer-helpers.js';

import type { SpriteTranslation } from '../../shared/utilities.js';
import type { CreatureSaveData } from '../../types/index.js';
import type {
    ButtonSaveData,
    CollectableSaveData,
    CustomSpriteDefinition,
    DesignerCategory,
    DesignerState,
    DoorSaveData
} from '../core/world-designer-types.js';

type SpritePreviewRenderingDeps = {
    tileSize: number;
    host: {
        drawSpriteSample: (
            ctx: CanvasRenderingContext2D,
            type: string,
            palette: number,
            rotation?: number,
            clearFirst?: boolean,
            targetSize?: number,
            translation?: SpriteTranslation
        ) => boolean;
    };
    refs: {
        spritePreviewCanvas: HTMLCanvasElement;
        spritePreviewMeta: HTMLElement;
    };
    state: Pick<DesignerState, 'selection' | 'category' | 'rotation' | 'palette' | 'translation'>;
    getSelectedItems: () => Array<{ category: DesignerCategory; entity: any }>;
    getCurrentType: () => string;
    isButtonCompositeType: (type: string) => boolean;
    isTeleporterCompositeType: (type: string) => boolean;
    createButtonEntity: (config: {
        x: number;
        y: number;
        rotation?: number;
        collision?: boolean;
        active?: boolean;
        linkedDoors?: number[];
    }) => Button;
    getCustomSpriteDefinitionById: (id: string | null | undefined) => CustomSpriteDefinition | null;
    getPlacementPreviewType: (type: string) => string;
    categorySupportsTranslation: (category: DesignerCategory) => boolean;
    formatSpriteTranslation: (value: SpriteTranslation) => string;
    normalizeRotation: (rotation?: number) => number;
    normalizeSpriteTranslation: (translation?: SpriteTranslation) => SpriteTranslation;
    getEntityRect: (entity: any, category: DesignerCategory) => {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
    getRectAtPosition: (x: number, y: number, category: DesignerCategory) => {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    };
    deepClone: <T>(value: T) => T;
    renderSpritePreviewCanvas: (
        canvas: HTMLCanvasElement,
        type: string,
        palette: number,
        rotation: number,
        translation?: SpriteTranslation
    ) => boolean;
    renderButtonCompositePreviewCanvas: (canvas: HTMLCanvasElement, button?: Button) => boolean;
};

export function createWorldDesignerSpritePreviewRendering(deps: SpritePreviewRenderingDeps) {
    const {
        tileSize,
        host,
        refs,
        state,
        getSelectedItems,
        getCurrentType,
        isButtonCompositeType,
        isTeleporterCompositeType,
        createButtonEntity,
        getCustomSpriteDefinitionById,
        getPlacementPreviewType,
        categorySupportsTranslation,
        formatSpriteTranslation,
        normalizeRotation,
        normalizeSpriteTranslation,
        getEntityRect,
        getRectAtPosition,
        deepClone,
        renderSpritePreviewCanvas,
        renderButtonCompositePreviewCanvas
    } = deps;

    function drawSpriteAt(
        ctx: CanvasRenderingContext2D,
        x: number,
        y: number,
        type: string,
        palette: number,
        rotation: number,
        translation: SpriteTranslation = 'center'
    ) {
        const spriteCanvas = document.createElement('canvas');
        spriteCanvas.width = tileSize;
        spriteCanvas.height = tileSize;
        const spriteCtx = spriteCanvas.getContext('2d');
        if (!spriteCtx) {
            return false;
        }
        const rendered = host.drawSpriteSample(
            spriteCtx,
            type,
            palette,
            rotation,
            true,
            tileSize,
            translation
        );
        if (!rendered) {
            return false;
        }
        ctx.drawImage(spriteCanvas, Math.round(x), Math.round(y));
        return true;
    }

    function drawButtonEntityAt(
        ctx: CanvasRenderingContext2D,
        button: Button,
        screenX: number,
        screenY: number
    ) {
        let rendered = false;
        for (const part of button.getRenderParts()) {
            const partCanvas = document.createElement('canvas');
            partCanvas.width = tileSize;
            partCanvas.height = tileSize;
            const partCtx = partCanvas.getContext('2d');
            if (!partCtx) {
                continue;
            }
            const partRendered = host.drawSpriteSample(
                partCtx,
                part.type,
                part.palette,
                part.rotation,
                true,
                tileSize
            );
            if (!partRendered) {
                continue;
            }
            rendered = true;
            const sourceWidth = (part.cropLeftHalf || part.cropRightHalf)
                ? Math.max(1, Math.floor(partCanvas.width / 2))
                : partCanvas.width;
            const sourceStartX = part.cropRightHalf
                ? Math.max(0, partCanvas.width - sourceWidth)
                : 0;
            const destinationWidth = (part.cropLeftHalf || part.cropRightHalf)
                ? Math.max(1, Math.floor(tileSize / 2))
                : tileSize;
            ctx.drawImage(
                partCanvas,
                sourceStartX,
                0,
                sourceWidth,
                partCanvas.height,
                Math.round(screenX + (part.x - button.x)),
                Math.round(screenY + (part.y - button.y)),
                destinationWidth,
                tileSize
            );
        }
        return rendered;
    }

    function getCustomSpriteDefinitionBounds(definition: CustomSpriteDefinition) {
        if (definition.members.length === 0) {
            return { left: 0, top: 0, right: tileSize, bottom: tileSize, width: tileSize, height: tileSize };
        }
        const rects = definition.members.map((member) => {
            if (member.category === 'buttons') {
                return getEntityRect(new Button({
                    ...(deepClone(member.data) as ButtonSaveData),
                    x: member.offsetX,
                    y: member.offsetY
                }), 'buttons');
            }
            return getRectAtPosition(member.offsetX, member.offsetY, member.category);
        });
        const left = Math.min(...rects.map((rect) => rect.left));
        const top = Math.min(...rects.map((rect) => rect.top));
        const right = Math.max(...rects.map((rect) => rect.right));
        const bottom = Math.max(...rects.map((rect) => rect.bottom));
        return {
            left,
            top,
            right,
            bottom,
            width: right - left,
            height: bottom - top
        };
    }

    function drawCustomSpriteDefinitionAt(
        ctx: CanvasRenderingContext2D,
        definition: CustomSpriteDefinition,
        screenX: number,
        screenY: number
    ) {
        let rendered = false;
        for (const member of definition.members) {
            const memberX = screenX + member.offsetX;
            const memberY = screenY + member.offsetY;
            if (member.category === 'buttons') {
                rendered = drawButtonEntityAt(
                    ctx,
                    new Button({
                        ...(deepClone(member.data) as ButtonSaveData),
                        x: memberX,
                        y: memberY
                    }),
                    memberX,
                    memberY
                ) || rendered;
                continue;
            }
            const data = member.data as MapBlock | DoorSaveData | CreatureSaveData | CollectableSaveData;
            rendered = drawSpriteAt(
                ctx,
                memberX,
                memberY,
                data.type,
                typeof data.palette === 'number' ? data.palette : 0,
                normalizeRotation((data as MapBlock).rotation),
                member.category === 'world'
                    ? normalizeSpriteTranslation((data as MapBlock).translation)
                    : 'center'
            ) || rendered;
        }
        return rendered;
    }

    function renderCustomSpritePreviewCanvas(
        canvas: HTMLCanvasElement,
        definition: CustomSpriteDefinition | null
    ) {
        clearPreviewCanvas(canvas);
        if (!definition) {
            return false;
        }
        const bounds = getCustomSpriteDefinitionBounds(definition);
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = Math.max(1, Math.ceil(bounds.width));
        tempCanvas.height = Math.max(1, Math.ceil(bounds.height));
        const tempCtx = tempCanvas.getContext('2d');
        if (!tempCtx) {
            return false;
        }
        const rendered = drawCustomSpriteDefinitionAt(tempCtx, definition, -bounds.left, -bounds.top);
        if (!rendered) {
            return false;
        }
        const visibleBounds = getSpriteVisibleBounds(tempCanvas);
        if (!visibleBounds) {
            return false;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return false;
        }
        const padding = 8;
        const availableWidth = Math.max(1, canvas.width - padding * 2);
        const availableHeight = Math.max(1, canvas.height - padding * 2);
        const scale = Math.min(
            availableWidth / Math.max(1, visibleBounds.width),
            availableHeight / Math.max(1, visibleBounds.height)
        );
        const drawWidth = Math.max(1, Math.round(visibleBounds.width * scale));
        const drawHeight = Math.max(1, Math.round(visibleBounds.height * scale));
        ctx.drawImage(
            tempCanvas,
            visibleBounds.minX,
            visibleBounds.minY,
            visibleBounds.width,
            visibleBounds.height,
            Math.round((canvas.width - drawWidth) / 2),
            Math.round((canvas.height - drawHeight) / 2),
            drawWidth,
            drawHeight
        );
        return true;
    }

    function renderCurrentSpritePreview() {
        const selectedButton = state.selection?.category === 'buttons' && getSelectedItems().length === 1
            ? state.selection.entity as Button
            : null;
        const selectedType = getCurrentType();
        const compositeButtonPreview = !selectedButton && state.category === 'buttons' && isButtonCompositeType(selectedType)
            ? createButtonEntity({
                x: 0,
                y: 0,
                rotation: state.rotation,
                collision: true,
                active: false,
                linkedDoors: []
            })
            : null;
        const customDefinition = state.category === 'custom'
            ? getCustomSpriteDefinitionById(getCurrentType())
            : null;
        const previewType = getPlacementPreviewType(selectedType);
        const type = state.category === 'buttons'
            ? selectedType
            : state.category === 'custom'
                ? (customDefinition?.name ?? 'Custom sprite')
                : previewType;
        const previewTranslation = (
            state.category === 'world' &&
            isTeleporterCompositeType(selectedType)
        )
            ? 'center'
            : (categorySupportsTranslation(state.category) ? state.translation : 'center');
        const rendered = selectedButton
            ? renderButtonCompositePreviewCanvas(refs.spritePreviewCanvas, selectedButton)
            : compositeButtonPreview
                ? renderButtonCompositePreviewCanvas(refs.spritePreviewCanvas, compositeButtonPreview)
                : state.category === 'buttons'
                    ? renderSpritePreviewCanvas(
                        refs.spritePreviewCanvas,
                        previewType,
                        state.palette,
                        state.rotation,
                        'center'
                    )
                    : state.category === 'custom'
                        ? renderCustomSpritePreviewCanvas(refs.spritePreviewCanvas, customDefinition)
                        : renderSpritePreviewCanvas(
                            refs.spritePreviewCanvas,
                            type,
                            state.palette,
                            state.rotation,
                            previewTranslation
                        );
        refs.spritePreviewMeta.textContent = rendered
            ? selectedButton
                ? `${selectedButton.type} + ${selectedButton.boxType} — ${selectedButton.active ? 'open' : 'closed'} preview`
                : compositeButtonPreview
                    ? 'button (composite) — one drop places a full live button (cap + box)'
                    : state.category === 'world' && isTeleporterCompositeType(selectedType)
                        ? 'teleporter (composite) — one drop places base + pad + linked teleporter mechanism'
                        : categorySupportsTranslation(state.category)
                            ? `${type} — palette ${state.palette}, rotation ${state.rotation}, translation ${formatSpriteTranslation(state.translation)}`
                            : state.category === 'buttons'
                                ? `${type} — place button/button_box sprites manually, then group and convert to make a live button`
                                : state.category === 'custom'
                                    ? customDefinition
                                        ? `${customDefinition.name} — ${customDefinition.members.length} part${customDefinition.members.length === 1 ? '' : 's'}`
                                        : 'No custom sprites yet'
                                    : `${type} — palette ${state.palette}, rotation ${state.rotation}`
            : `${type} — preview unavailable`;
    }

    return {
        drawCustomSpriteDefinitionAt,
        renderCustomSpritePreviewCanvas,
        renderCurrentSpritePreview
    };
}
