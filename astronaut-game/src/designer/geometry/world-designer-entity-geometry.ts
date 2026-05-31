import { Button } from '../../entities/button.js';

import type {
    ButtonSaveData,
    CustomSpriteDefinition,
    CustomSpriteInstance,
    DesignerCategory
} from '../core/world-designer-types.js';

type VisibleSpriteRect = { left: number; top: number; width: number; height: number } | null;

type EntityGeometryDependencies = {
    tileSize: number;
    deepClone: <T>(value: T) => T;
    normalizeRotation: (rotation?: number) => number;
    resolveCustomSpriteDefinition: (instance: CustomSpriteInstance) => CustomSpriteDefinition | null;
    getVisibleSpriteRect: (
        type: string,
        palette: number,
        rotation: number,
        translation?: 'center' | 'top' | 'right' | 'bottom' | 'left'
    ) => VisibleSpriteRect;
};

// Geometry helpers are extracted so the world designer orchestration stays easier to follow.
export function createDesignerEntityGeometryHelpers(dependencies: EntityGeometryDependencies) {
    function getRectAtPosition(x: number, y: number, category: DesignerCategory) {
        const width = category === 'buttons'
            ? dependencies.tileSize + 14
            : dependencies.tileSize;
        const height = dependencies.tileSize;
        return {
            left: x,
            top: y,
            right: x + width,
            bottom: y + height,
            width,
            height
        };
    }

    function invertButtonOffset(offsetX: number, offsetY: number, rotation: number) {
        if (rotation >= 1 && rotation <= 4) {
            const angle = -((rotation - 1) * Math.PI) / 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            return {
                x: Math.round(offsetX * cos - offsetY * sin),
                y: Math.round(offsetX * sin + offsetY * cos)
            };
        }

        if (rotation === 5) {
            return { x: -offsetX, y: offsetY };
        }
        if (rotation === 6) {
            return { x: offsetX, y: -offsetY };
        }
        if (rotation === 7) {
            return { x: -offsetX, y: -offsetY };
        }
        if (rotation === 8) {
            return { x: -offsetY, y: -offsetX };
        }
        if (rotation === 9) {
            return { x: offsetY, y: offsetX };
        }

        return { x: offsetX, y: offsetY };
    }

    function getEntityRect(entity: any, category: DesignerCategory): {
        left: number;
        top: number;
        right: number;
        bottom: number;
        width: number;
        height: number;
    } {
        if (category === 'buttons' && entity instanceof Button) {
            const partRects = entity.getRenderParts().map((part) => ({
                left: part.x,
                top: part.y,
                right: part.x + ((part.cropLeftHalf || part.cropRightHalf) ? dependencies.tileSize / 2 : dependencies.tileSize),
                bottom: part.y + dependencies.tileSize
            }));
            const left = Math.min(...partRects.map((rect) => rect.left));
            const top = Math.min(...partRects.map((rect) => rect.top));
            const right = Math.max(...partRects.map((rect) => rect.right));
            const bottom = Math.max(...partRects.map((rect) => rect.bottom));
            return {
                left,
                top,
                right,
                bottom,
                width: right - left,
                height: bottom - top
            };
        }
        if (category === 'custom') {
            const instance = entity as CustomSpriteInstance;
            const definition = dependencies.resolveCustomSpriteDefinition(instance);
            if (!definition || definition.members.length === 0) {
                return getRectAtPosition(instance.x, instance.y, 'world');
            }
            const partRects = definition.members.map((member) => {
                const absoluteX = instance.x + member.offsetX;
                const absoluteY = instance.y + member.offsetY;
                if (member.category === 'buttons') {
                    const button = new Button({
                        ...(dependencies.deepClone(member.data) as ButtonSaveData),
                        x: absoluteX,
                        y: absoluteY
                    });
                    return getEntityRect(button, 'buttons');
                }
                return getRectAtPosition(absoluteX, absoluteY, member.category);
            });
            const left = Math.min(...partRects.map((rect) => rect.left));
            const top = Math.min(...partRects.map((rect) => rect.top));
            const right = Math.max(...partRects.map((rect) => rect.right));
            const bottom = Math.max(...partRects.map((rect) => rect.bottom));
            return {
                left,
                top,
                right,
                bottom,
                width: right - left,
                height: bottom - top
            };
        }
        if (category === 'collectables' && typeof entity.type === 'string') {
            const visibleRect = dependencies.getVisibleSpriteRect(
                entity.type,
                typeof entity.palette === 'number' ? entity.palette : 0,
                dependencies.normalizeRotation('defaultRotation' in entity ? entity.defaultRotation ?? entity.rotation : entity.rotation),
                'center'
            );
            if (visibleRect) {
                const left = entity.x + visibleRect.left;
                const top = entity.y + visibleRect.top;
                const right = left + visibleRect.width;
                const bottom = top + visibleRect.height;
                return {
                    left,
                    top,
                    right,
                    bottom,
                    width: right - left,
                    height: bottom - top
                };
            }
        }
        return getRectAtPosition(entity.x, entity.y, category);
    }

    return {
        getRectAtPosition,
        invertButtonOffset,
        getEntityRect
    };
}
