import type { Collectable } from '../../entities/collectable.js';
import type { Creature } from '../../entities/creature.js';

export type CollisionBounds = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

export type AxisMovementResult = {
    x: number;
    y: number;
    movedX: number;
    movedY: number;
    blockedX: boolean;
    blockedY: boolean;
};

type EnvironmentCollisionOptions = {
    getEntityCollisionBounds: (entity: Collectable | Creature) => CollisionBounds;
    isSolidAtWorld: (x: number, y: number) => boolean;
    getSolidEntityAtWorld?: (x: number, y: number) => { type?: string } | null;
    shouldIgnoreSolidCollisionForCreature?: (
        creature: Creature,
        solidEntity: { type?: string } | null
    ) => boolean;
    getRenderedEntityWorldSprite?: (
        entity: Collectable | Creature
    ) => { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null;
    getRenderedSpriteOpaqueSamples?: (canvas: HTMLCanvasElement) => Array<{ x: number; y: number }>;
    spriteScale?: number;
    clampToRange: (value: number, minimum: number, maximum: number) => number;
    mapWidth: number;
    mapHeight: number;
    collectableGroundSnapDistance: number;
    collectablePushStepUpHeight: number;
};

// Extracts side-probe collision movement from game runtime to keep orchestration compact.
export function createEnvironmentCollisionHelpers(options: EnvironmentCollisionOptions) {
    const opaqueEdgeSampleCache = new WeakMap<
        HTMLCanvasElement,
        {
            left: Array<{ x: number; y: number }>;
            right: Array<{ x: number; y: number }>;
            top: Array<{ x: number; y: number }>;
            bottom: Array<{ x: number; y: number }>;
        }
    >();

    function getCollectableEdgeSamples(
        entityX: number,
        entityY: number,
        collisionBounds: CollisionBounds,
        side: 'left' | 'right' | 'top' | 'bottom'
    ) {
        const left = entityX + collisionBounds.left;
        const right = entityX + collisionBounds.right;
        const top = entityY + collisionBounds.top;
        const bottom = entityY + collisionBounds.bottom;
        const sampleEdge = (start: number, end: number, segments = 6) => {
            if (start >= end) {
                return [start];
            }

            const points: number[] = [];
            for (let index = 0; index <= segments; index++) {
                points.push(start + ((end - start) * index) / segments);
            }
            return points;
        };

        if (side === 'left' || side === 'right') {
            const x = side === 'left' ? left : right;
            return sampleEdge(top + 1, bottom - 1).map((y) => ({ x, y }));
        }

        const y = side === 'top' ? top : bottom;
        return sampleEdge(left + 1, right - 1).map((x) => ({ x, y }));
    }

    function getOpaqueEdgeSamples(canvas: HTMLCanvasElement) {
        const cached = opaqueEdgeSampleCache.get(canvas);
        if (cached) {
            return cached;
        }
        if (!options.getRenderedSpriteOpaqueSamples) {
            return null;
        }
        const points = options.getRenderedSpriteOpaqueSamples(canvas);
        if (!points.length) {
            return null;
        }

        const leftByRow = new Map<number, number>();
        const rightByRow = new Map<number, number>();
        const topByColumn = new Map<number, number>();
        const bottomByColumn = new Map<number, number>();
        for (const point of points) {
            const existingLeft = leftByRow.get(point.y);
            if (typeof existingLeft !== 'number' || point.x < existingLeft) {
                leftByRow.set(point.y, point.x);
            }
            const existingRight = rightByRow.get(point.y);
            if (typeof existingRight !== 'number' || point.x > existingRight) {
                rightByRow.set(point.y, point.x);
            }
            const existingTop = topByColumn.get(point.x);
            if (typeof existingTop !== 'number' || point.y < existingTop) {
                topByColumn.set(point.x, point.y);
            }
            const existingBottom = bottomByColumn.get(point.x);
            if (typeof existingBottom !== 'number' || point.y > existingBottom) {
                bottomByColumn.set(point.x, point.y);
            }
        }

        const edges = {
            left: [...leftByRow.entries()]
                .map(([y, x]) => ({ x, y }))
                .sort((a, b) => a.y - b.y),
            right: [...rightByRow.entries()]
                .map(([y, x]) => ({ x, y }))
                .sort((a, b) => a.y - b.y),
            top: [...topByColumn.entries()]
                .map(([x, y]) => ({ x, y }))
                .sort((a, b) => a.x - b.x),
            bottom: [...bottomByColumn.entries()]
                .map(([x, y]) => ({ x, y }))
                .sort((a, b) => a.x - b.x)
        };
        opaqueEdgeSampleCache.set(canvas, edges);
        return edges;
    }

    function compactSamples(samples: Array<{ x: number; y: number }>, maxSamples: number) {
        if (samples.length <= maxSamples) {
            return samples;
        }
        const stride = Math.ceil(samples.length / maxSamples);
        const compacted: Array<{ x: number; y: number }> = [];
        for (let index = 0; index < samples.length; index += stride) {
            compacted.push(samples[index]);
        }
        return compacted;
    }

    function getRenderedCollectableSideSamples(
        collectable: Collectable,
        entityX: number,
        entityY: number,
        collisionBounds: CollisionBounds,
        side: 'left' | 'right' | 'top' | 'bottom'
    ) {
        const rendered = options.getRenderedEntityWorldSprite?.(collectable) ?? null;
        if (!rendered) {
            return getCollectableEdgeSamples(entityX, entityY, collisionBounds, side);
        }
        const opaqueEdges = getOpaqueEdgeSamples(rendered.canvas);
        if (!opaqueEdges) {
            return getCollectableEdgeSamples(entityX, entityY, collisionBounds, side);
        }
        const spriteScale = options.spriteScale ?? 1;
        const deltaX = entityX - collectable.x;
        const deltaY = entityY - collectable.y;
        return compactSamples(opaqueEdges[side], 24).map((point) => ({
            x: rendered.drawX + deltaX + (point.x + 0.5) * spriteScale,
            y: rendered.drawY + deltaY + (point.y + 0.5) * spriteScale
        }));
    }

    function getRenderedWaspCollisionBounds(
        creature: Creature,
        entityX: number,
        entityY: number,
        fallbackBounds: CollisionBounds
    ) {
        if (!/^wasp/i.test(creature.type)) {
            return fallbackBounds;
        }
        const rendered = options.getRenderedEntityWorldSprite?.(creature) ?? null;
        if (!rendered) {
            return fallbackBounds;
        }
        const opaqueEdges = getOpaqueEdgeSamples(rendered.canvas);
        if (!opaqueEdges || opaqueEdges.top.length === 0 || opaqueEdges.left.length === 0) {
            return fallbackBounds;
        }
        const spriteScale = options.spriteScale ?? 1;
        const minOpaqueX = opaqueEdges.top[0].x;
        const maxOpaqueX = opaqueEdges.top[opaqueEdges.top.length - 1].x;
        const minOpaqueY = opaqueEdges.left[0].y;
        const maxOpaqueY = opaqueEdges.left[opaqueEdges.left.length - 1].y;
        const deltaX = entityX - creature.x;
        const deltaY = entityY - creature.y;
        const worldMinX = rendered.drawX + deltaX + minOpaqueX * spriteScale;
        const worldMinY = rendered.drawY + deltaY + minOpaqueY * spriteScale;
        const worldMaxXExclusive = rendered.drawX + deltaX + (maxOpaqueX + 1) * spriteScale;
        const worldMaxYExclusive = rendered.drawY + deltaY + (maxOpaqueY + 1) * spriteScale;
        const left = Math.floor(worldMinX - entityX);
        const right = Math.ceil(worldMaxXExclusive - entityX) - 1;
        const top = Math.floor(worldMinY - entityY);
        const bottom = Math.ceil(worldMaxYExclusive - entityY) - 1;
        if (left > right || top > bottom) {
            return fallbackBounds;
        }
        return { left, right, top, bottom };
    }

    function collidesCollectableAtSide(
        collectable: Collectable,
        entityX: number,
        entityY: number,
        collisionBounds: CollisionBounds,
        side: 'left' | 'right' | 'top' | 'bottom'
    ) {
        const samples = getRenderedCollectableSideSamples(collectable, entityX, entityY, collisionBounds, side);
        const probeOffset = side === 'right' || side === 'bottom' ? 1 : -1;
        return samples.some((sample) => options.isSolidAtWorld(
            sample.x + (side === 'left' || side === 'right' ? probeOffset : 0),
            sample.y + (side === 'top' || side === 'bottom' ? probeOffset : 0)
        ));
    }

    function collidesCreatureAtSide(
        creature: Creature,
        entityX: number,
        entityY: number,
        collisionBounds: CollisionBounds,
        side: 'left' | 'right' | 'top' | 'bottom'
    ) {
        const effectiveBounds = getRenderedWaspCollisionBounds(creature, entityX, entityY, collisionBounds);
        const samples = getCollectableEdgeSamples(entityX, entityY, effectiveBounds, side);
        const probeOffset = side === 'right' || side === 'bottom' ? 1 : -1;
        const useEntityAwareSolids = !!options.getSolidEntityAtWorld
            && !!options.shouldIgnoreSolidCollisionForCreature
            && options.shouldIgnoreSolidCollisionForCreature(creature, null);
        if (!useEntityAwareSolids) {
            return samples.some((sample) => options.isSolidAtWorld(
                sample.x + (side === 'left' || side === 'right' ? probeOffset : 0),
                sample.y + (side === 'top' || side === 'bottom' ? probeOffset : 0)
            ));
        }
        return samples.some((sample) => {
            const probeX = sample.x + (side === 'left' || side === 'right' ? probeOffset : 0);
            const probeY = sample.y + (side === 'top' || side === 'bottom' ? probeOffset : 0);
            const solidEntity = options.getSolidEntityAtWorld!(probeX, probeY);
            if (!solidEntity) {
                return false;
            }
            return !options.shouldIgnoreSolidCollisionForCreature!(creature, solidEntity);
        });
    }

    function collidesAtSide(
        entityX: number,
        entityY: number,
        collisionBounds: CollisionBounds,
        side: 'left' | 'right' | 'top' | 'bottom',
        collectable?: Collectable,
        creature?: Creature
    ) {
        if (collectable) {
            return collidesCollectableAtSide(collectable, entityX, entityY, collisionBounds, side);
        }
        if (creature) {
            return collidesCreatureAtSide(creature, entityX, entityY, collisionBounds, side);
        }
        const samples = getCollectableEdgeSamples(entityX, entityY, collisionBounds, side);
        const probeOffset = side === 'right' || side === 'bottom' ? 1 : -1;
        return samples.some((sample) => options.isSolidAtWorld(
            sample.x + (side === 'left' || side === 'right' ? probeOffset : 0),
            sample.y + (side === 'top' || side === 'bottom' ? probeOffset : 0)
        ));
    }

    function simulateCreatureAxisMovement(
        creature: Creature,
        collisionBounds: CollisionBounds,
        targetX: number,
        targetY: number,
        axisOrder: Array<'x' | 'y'>
    ): AxisMovementResult {
        let x = creature.x;
        let y = creature.y;
        let movedX = 0;
        let movedY = 0;
        let blockedX = false;
        let blockedY = false;

        for (const axis of axisOrder) {
            const target = axis === 'x' ? targetX : targetY;
            const current = axis === 'x' ? x : y;
            const amount = target - current;
            const direction = Math.sign(amount);
            if (direction === 0) {
                continue;
            }

            const side = axis === 'x'
                ? (direction > 0 ? 'right' : 'left')
                : (direction > 0 ? 'bottom' : 'top');
            let moved = 0;

            for (let step = 0; step < Math.abs(amount); step++) {
                const nextX = axis === 'x' ? x + direction : x;
                const nextY = axis === 'y' ? y + direction : y;
                if (collidesAtSide(nextX, nextY, collisionBounds, side, undefined, creature)) {
                    if (axis === 'x') {
                        blockedX = true;
                    } else {
                        blockedY = true;
                    }
                    break;
                }

                if (axis === 'x') {
                    x = nextX;
                } else {
                    y = nextY;
                }
                moved += direction;
            }

            if (axis === 'x') {
                movedX = moved;
                if (moved !== amount) {
                    blockedX = true;
                }
            } else {
                movedY = moved;
                if (moved !== amount) {
                    blockedY = true;
                }
            }
        }

        return { x, y, movedX, movedY, blockedX, blockedY };
    }

    function moveCreatureWithEnvironmentCollisions(creature: Creature, targetX: number, targetY: number): AxisMovementResult {
        const collisionBounds = options.getEntityCollisionBounds(creature);
        const clampedTargetX = Math.round(options.clampToRange(targetX, 0, options.mapWidth));
        const clampedTargetY = Math.round(options.clampToRange(targetY, 0, options.mapHeight));
        const horizontalFirst = simulateCreatureAxisMovement(creature, collisionBounds, clampedTargetX, clampedTargetY, ['x', 'y']);
        const verticalFirst = simulateCreatureAxisMovement(creature, collisionBounds, clampedTargetX, clampedTargetY, ['y', 'x']);
        const horizontalError = Math.abs(clampedTargetX - horizontalFirst.x) + Math.abs(clampedTargetY - horizontalFirst.y);
        const verticalError = Math.abs(clampedTargetX - verticalFirst.x) + Math.abs(clampedTargetY - verticalFirst.y);
        const bestResult = verticalError < horizontalError
            ? verticalFirst
            : verticalError > horizontalError
                ? horizontalFirst
                : (Math.abs(verticalFirst.movedX) + Math.abs(verticalFirst.movedY)) > (Math.abs(horizontalFirst.movedX) + Math.abs(horizontalFirst.movedY))
                    ? verticalFirst
                    : horizontalFirst;
        creature.x = bestResult.x;
        creature.y = bestResult.y;
        return bestResult;
    }

    function getFloorSnapAmount(
        entityX: number,
        entityY: number,
        collisionBounds: CollisionBounds,
        collectable?: Collectable
    ) {
        for (let distance = 1; distance <= options.collectableGroundSnapDistance; distance++) {
            const samples = collectable
                ? getRenderedCollectableSideSamples(collectable, entityX, entityY + distance, collisionBounds, 'bottom')
                : getCollectableEdgeSamples(entityX, entityY + distance, collisionBounds, 'bottom');
            const supported = samples.some((sample) => options.isSolidAtWorld(sample.x, sample.y + 1));
            if (supported) {
                return distance;
            }
        }
        return 0;
    }

    function moveCollectableHorizontally(collectable: Collectable, amount: number) {
        if (amount === 0) {
            return 0;
        }

        const direction = amount > 0 ? 1 : -1;
        const collisionBounds = options.getEntityCollisionBounds(collectable);
        const side = direction > 0 ? 'right' : 'left';
        let moved = 0;

        for (let step = 0; step < Math.abs(amount); step++) {
            const nextX = collectable.x + direction;
            if (collidesCollectableAtSide(collectable, nextX, collectable.y, collisionBounds, side)) {
                let steppedUp = false;
                for (let stepHeight = 1; stepHeight <= options.collectablePushStepUpHeight; stepHeight++) {
                    const candidateY = collectable.y - stepHeight;
                    if (collidesCollectableAtSide(collectable, nextX, candidateY, collisionBounds, side)) {
                        continue;
                    }
                    if (collidesCollectableAtSide(collectable, nextX, candidateY, collisionBounds, 'top')) {
                        continue;
                    }
                    if (!collidesCollectableAtSide(collectable, nextX, candidateY, collisionBounds, 'bottom')) {
                        continue;
                    }

                    collectable.x = nextX;
                    collectable.y = candidateY;
                    collectable.isGrounded = true;
                    moved += direction;
                    steppedUp = true;
                    break;
                }

                if (!steppedUp) {
                    break;
                }
                continue;
            }
            collectable.x = nextX;
            moved += direction;
        }

        return moved;
    }

    function moveCollectableVertically(collectable: Collectable, amount: number) {
        if (amount === 0) {
            return 0;
        }

        const direction = amount > 0 ? 1 : -1;
        const collisionBounds = options.getEntityCollisionBounds(collectable);
        const side = direction > 0 ? 'bottom' : 'top';
        let moved = 0;

        for (let step = 0; step < Math.abs(amount); step++) {
            const nextY = collectable.y + direction;
            if (collidesCollectableAtSide(collectable, collectable.x, nextY, collisionBounds, side)) {
                break;
            }
            collectable.y = nextY;
            moved += direction;
        }

        return moved;
    }

    return {
        collidesAtSide,
        getFloorSnapAmount,
        moveCollectableHorizontally,
        moveCollectableVertically,
        moveCreatureWithEnvironmentCollisions
    };
}
