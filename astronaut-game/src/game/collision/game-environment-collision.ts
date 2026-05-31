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
    clampToRange: (value: number, minimum: number, maximum: number) => number;
    mapWidth: number;
    mapHeight: number;
    collectableGroundSnapDistance: number;
    collectablePushStepUpHeight: number;
};

// Extracts side-probe collision movement from game runtime to keep orchestration compact.
export function createEnvironmentCollisionHelpers(options: EnvironmentCollisionOptions) {
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

    function collidesAtSide(
        entityX: number,
        entityY: number,
        collisionBounds: CollisionBounds,
        side: 'left' | 'right' | 'top' | 'bottom'
    ) {
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
                if (collidesAtSide(nextX, nextY, collisionBounds, side)) {
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

    function getFloorSnapAmount(entityX: number, entityY: number, collisionBounds: CollisionBounds) {
        for (let distance = 1; distance <= options.collectableGroundSnapDistance; distance++) {
            const samples = getCollectableEdgeSamples(entityX, entityY + distance, collisionBounds, 'bottom');
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
            if (collidesAtSide(nextX, collectable.y, collisionBounds, side)) {
                let steppedUp = false;
                for (let stepHeight = 1; stepHeight <= options.collectablePushStepUpHeight; stepHeight++) {
                    const candidateY = collectable.y - stepHeight;
                    if (collidesAtSide(nextX, candidateY, collisionBounds, side)) {
                        continue;
                    }
                    if (collidesAtSide(nextX, candidateY, collisionBounds, 'top')) {
                        continue;
                    }
                    if (!collidesAtSide(nextX, candidateY, collisionBounds, 'bottom')) {
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
            if (collidesAtSide(collectable.x, nextY, collisionBounds, side)) {
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
