import type { CollisionBounds } from '../collision/game-environment-collision.js';

export function getEntityRect(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds
) {
    return {
        left: entityX + collisionBounds.left,
        right: entityX + collisionBounds.right,
        top: entityY + collisionBounds.top,
        bottom: entityY + collisionBounds.bottom
    };
}

export function getEntityCenter(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds
) {
    const rect = getEntityRect(entityX, entityY, collisionBounds);
    return {
        x: (rect.left + rect.right) / 2,
        y: (rect.top + rect.bottom) / 2
    };
}

export function getEntityPositionFromCenter(
    centerX: number,
    centerY: number,
    collisionBounds: CollisionBounds
) {
    return {
        x: centerX - (collisionBounds.left + collisionBounds.right) / 2,
        y: centerY - (collisionBounds.top + collisionBounds.bottom) / 2
    };
}
