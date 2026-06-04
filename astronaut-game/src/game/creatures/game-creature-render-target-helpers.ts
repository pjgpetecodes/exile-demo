import type { Position } from '../../types/index.js';
import type { Creature } from '../../entities/creature.js';

export function createGameCreatureRenderTargetHelpers(options: {
    birdAnimationFrames: readonly string[];
    birdAnimationFrameDurationMs: number;
    spriteScale: number;
    getCreatureAuthoredType: (type: string, state?: Record<string, unknown>) => string;
    findSpriteRectByType: (type: string) => { x: number; y: number; w: number; h: number } | null;
    getEntityPreviewSheet: (entity: { palette?: number }) => CanvasImageSource | null;
    getEntityCollisionBounds: (entity: any) => { left: number; right: number; top: number; bottom: number };
    getEntityCenter: (x: number, y: number, bounds: { left: number; right: number; top: number; bottom: number }) => Position;
    getTransformedSpriteCanvas: (
        spriteSheet: CanvasImageSource,
        rect: { x: number; y: number; w: number; h: number },
        rotation?: number,
        flipAroundVisibleCenter?: boolean
    ) => HTMLCanvasElement | null;
    getSpriteVisibleBounds: (canvas: HTMLCanvasElement | null) => { minX: number; minY: number; maxX: number; maxY: number } | null;
    getEntityRenderOffset: (entity: any) => { x: number; y: number };
}) {
    function getStableCreatureAimCenter(creature: Creature, rotation: number) {
        const spriteRect = options.findSpriteRectByType(creature.type);
        const previewSheet = options.getEntityPreviewSheet(creature);
        if (!spriteRect || !previewSheet) {
            const bounds = options.getEntityCollisionBounds(creature);
            return options.getEntityCenter(creature.x, creature.y, bounds);
        }
        const transformedSprite = options.getTransformedSpriteCanvas(previewSheet, spriteRect, rotation, false);
        const visibleBounds = options.getSpriteVisibleBounds(transformedSprite);
        const renderOffset = options.getEntityRenderOffset({
            ...creature,
            rotation
        });
        if (!visibleBounds) {
            return {
                x: creature.x + renderOffset.x + (spriteRect.w * options.spriteScale) / 2,
                y: creature.y + renderOffset.y + (spriteRect.h * options.spriteScale) / 2
            };
        }

        return {
            x: creature.x + renderOffset.x + ((visibleBounds.minX + visibleBounds.maxX + 1) / 2) * options.spriteScale,
            y: creature.y + renderOffset.y + ((visibleBounds.minY + visibleBounds.maxY + 1) / 2) * options.spriteScale
        };
    }

    function getTurretFacingRotations(authoredRotation: number) {
        const normalizedRotation = typeof authoredRotation === 'number'
            ? Math.round(authoredRotation)
            : 1;

        switch (normalizedRotation) {
            case 5:
                return { left: 5, right: 1, authoredFacing: -1 };
            case 2:
                return { left: 4, right: 2, authoredFacing: 1 };
            case 4:
                return { left: 4, right: 2, authoredFacing: -1 };
            case 3:
                return { left: 3, right: 6, authoredFacing: -1 };
            case 6:
                return { left: 3, right: 6, authoredFacing: 1 };
            case 7:
                return { left: 7, right: 6, authoredFacing: -1 };
            case 1:
            default:
                return { left: 5, right: 1, authoredFacing: 1 };
        }
    }

    function isTurretLikeCreature(creature: Creature) {
        return creature.archetype === 'turret' || creature.movementMode === 'turret';
    }

    function isBirdCreature(creature: Creature, authoredType = options.getCreatureAuthoredType(creature.type, creature.state)) {
        return creature.archetype === 'bird' || /^bird/i.test(authoredType);
    }

    function getBirdSpriteFrameOffset(type: string) {
        const match = /^bird(\d+)$/i.exec(type);
        if (!match) {
            return 0;
        }
        return (Math.max(1, Number(match[1])) - 1) % options.birdAnimationFrames.length;
    }

    function getAnimatedBirdSpriteType(authoredType: string, frameNow: number, entityId?: number) {
        const frameOffset = getBirdSpriteFrameOffset(authoredType);
        const entityOffset = typeof entityId === 'number'
            ? Math.abs(entityId) % options.birdAnimationFrames.length
            : 0;
        const frameIndex = (
            Math.floor(frameNow / options.birdAnimationFrameDurationMs) + frameOffset + entityOffset
        ) % options.birdAnimationFrames.length;
        return options.birdAnimationFrames[frameIndex];
    }

    return {
        getStableCreatureAimCenter,
        getTurretFacingRotations,
        isTurretLikeCreature,
        isBirdCreature,
        getAnimatedBirdSpriteType
    };
}
