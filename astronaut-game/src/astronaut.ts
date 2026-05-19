import { Astronaut } from './types/index.js';
import { getSolidBlockAtWorld } from './utilities.js';
import { MapBlock } from './map.js';
import { Button } from './button.js';
import { Door } from './door.js';
import { SPRITE_SCALE, SPRITE_COL_STAND, SPRITE_ROW } from './constants.js';
import { MOVEMENT_SETTINGS } from './settings.js';

export let astronaut: Astronaut = {
    position: { x: 400, y: 778 },
    velocity: { x: 0, y: 0 },
    isFlying: false,
    isLanded: true,
};

export function flipAstronaut() {
    facingLeft = !facingLeft;
}

export let walkSpeed = 0;
export let facingLeft = false;

// Animation state (export if needed for animation logic)
export let upPressed = false;
export let downPressed = false;
export let leftPressed = false;
export let rightPressed = false;

// Reset astronaut state
export function resetAstronaut() {
    astronaut.position = { x: 400, y: 778 };
    astronaut.velocity = { x: 0, y: 0 };
    astronaut.isFlying = false;
    astronaut.isLanded = true;
    walkSpeed = 0;
    facingLeft = false;
}

export function applyLandingMomentum(horizontalVelocity: number) {
    const carriedSpeed = Math.abs(horizontalVelocity) * MOVEMENT_SETTINGS.landingMomentumFactor;
    if (carriedSpeed < MOVEMENT_SETTINGS.landingMomentumMinSpeed) {
        walkSpeed = 0;
        return;
    }

    walkSpeed = Math.min(carriedSpeed, MOVEMENT_SETTINGS.walkMaxSpeed);
    facingLeft = horizontalVelocity < 0;
}

// Main movement handler (call this from game.ts)
export function handleAstronautMovement(
    keys: Record<string, boolean>,
    allowWalking: boolean = true
) {
    // Upward (P or ArrowUp)
    if ((keys['p'] || keys['ArrowUp'])) {
        if (astronaut.isLanded) {
            astronaut.position.y -= 1;
            astronaut.isLanded = false;
        }
        upPressed = true;
    } else {
        upPressed = false;
    }

    // Downward (L)
    if (keys['l']) {
        downPressed = true;
    } else {
        downPressed = false;
    }

    // Left (Q)
    leftPressed = false;
    if (keys['q']) {
        leftPressed = true;
        if (astronaut.isLanded) {
            if (walkSpeed === 0) walkSpeed = MOVEMENT_SETTINGS.walkStartSpeed;
            walkSpeed += MOVEMENT_SETTINGS.walkAccel;
            if (walkSpeed > MOVEMENT_SETTINGS.walkMaxSpeed) walkSpeed = MOVEMENT_SETTINGS.walkMaxSpeed;
            if (allowWalking) astronaut.position.x -= walkSpeed;
            facingLeft = true;
        } else {
            astronaut.velocity.x -= MOVEMENT_SETTINGS.flyAccel;
            if (astronaut.velocity.x < -MOVEMENT_SETTINGS.flyMaxSpeed) astronaut.velocity.x = -MOVEMENT_SETTINGS.flyMaxSpeed;
            facingLeft = true;
        }
    }
    // Right (W)
    rightPressed = false;
    if (keys['w']) {
        rightPressed = true;
        if (astronaut.isLanded) {
            if (walkSpeed === 0) walkSpeed = MOVEMENT_SETTINGS.walkStartSpeed;
            walkSpeed += MOVEMENT_SETTINGS.walkAccel;
            if (walkSpeed > MOVEMENT_SETTINGS.walkMaxSpeed) walkSpeed = MOVEMENT_SETTINGS.walkMaxSpeed;
            if (allowWalking) astronaut.position.x += walkSpeed;
            facingLeft = false;
        } else {
            astronaut.velocity.x += MOVEMENT_SETTINGS.flyAccel;
            if (astronaut.velocity.x > MOVEMENT_SETTINGS.flyMaxSpeed) astronaut.velocity.x = MOVEMENT_SETTINGS.flyMaxSpeed;
            facingLeft = false;
        }
    }

    // Walking momentum/friction after landing
    if (
        astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed > 0
    ) {
        if (allowWalking) {
            if (facingLeft) {
                astronaut.position.x -= walkSpeed;
            } else {
                astronaut.position.x += walkSpeed;
            }
        }
        walkSpeed -= MOVEMENT_SETTINGS.walkAccel * 0.5;
        if (walkSpeed < 0) walkSpeed = 0;
    }

    // Only reset walkSpeed if landed and no keys and walkSpeed is 0 (prevents instant cancel)
    if (
        astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed <= 0
    ) {
        walkSpeed = 0;
    }

    // Upward/downward acceleration if up or down is held and astronaut is not landed
    if ((keys['p'] || keys['ArrowUp']) && !astronaut.isLanded) {
        astronaut.velocity.y += MOVEMENT_SETTINGS.upAccel * 0.25;
        if (astronaut.velocity.y < MOVEMENT_SETTINGS.maxUpSpeed) {
            astronaut.velocity.y = MOVEMENT_SETTINGS.maxUpSpeed;
        }
    }
    if (downPressed && !astronaut.isLanded) {
        astronaut.velocity.y += MOVEMENT_SETTINGS.downAccel * 0.5;
        if (astronaut.velocity.y > MOVEMENT_SETTINGS.flyDownTerminalVelocity) {
            astronaut.velocity.y = MOVEMENT_SETTINGS.flyDownTerminalVelocity;
        }
    }

    // Walking momentum/friction after landing (again, for safety)
    if (
        astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed > 0
    ) {
        if (allowWalking) {
            if (facingLeft) {
                astronaut.position.x -= walkSpeed;
            } else {
                astronaut.position.x += walkSpeed;
            }
        }
        walkSpeed -= MOVEMENT_SETTINGS.walkAccel * 0.5;
        if (walkSpeed < 0) walkSpeed = 0;
    }

    if (
        astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed <= 0
    ) {
        walkSpeed = 0;
    }
}

// --- Button collision detection and logging ---
function checkButtonCollision(x: number, y: number, SPRITE_SCALE: number, 
    buttonEntities: Button[]): Button | undefined {
    for (const btn of buttonEntities) {
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;
        if (
            x >= btn.x && x < btn.x + tileW &&
            y >= btn.y && y < btn.y + tileH
        ) {
            return btn;
        }
    }
    return undefined;
}

type CollisionState = {
    nextX: number;
    nextY: number;
    velocityX: number;
    velocityY: number;
    isLanded: boolean;
    touchedButton?: Button;
    touchedDoor?: Door;
};

export function getAstronautCollisionOffsets() {
    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const bbox = (window as any).astronautWorldBoundingBoxes?.stand;
    if (!bbox) {
        return {
            left: -tileW / 2,
            right: tileW / 2 - 1,
            top: -tileH / 2,
            bottom: tileH / 2 - 1
        };
    }

    return {
        left: -tileW / 2 + bbox.worldMinX * SPRITE_SCALE,
        right: -tileW / 2 + (bbox.worldMaxX + 1) * SPRITE_SCALE - 1,
        top: -tileH / 2 + bbox.worldMinY * SPRITE_SCALE,
        bottom: -tileH / 2 + (bbox.worldMaxY + 1) * SPRITE_SCALE - 1
    };
}

function sampleEdge(start: number, end: number, segments = 4) {
    if (start === end) {
        return [start];
    }

    const values: number[] = [];
    for (let i = 0; i <= segments; i++) {
        values.push(start + ((end - start) * i) / segments);
    }
    return values;
}

function getSideProbePoints(
    centerX: number,
    centerY: number,
    side: 'down' | 'up' | 'left' | 'right'
) {
    const offsets = getAstronautCollisionOffsets();
    if (side === 'down' || side === 'up') {
        const y = centerY + (side === 'down' ? offsets.bottom : offsets.top);
        return sampleEdge(centerX + offsets.left + 1, centerX + offsets.right - 1).map((x) => ({ x, y }));
    }

    const x = centerX + (side === 'right' ? offsets.right : offsets.left);
    return sampleEdge(centerY + offsets.top + 1, centerY + offsets.bottom - 1).map((y) => ({ x, y }));
}

function collidesOnSide(
    centerX: number,
    centerY: number,
    side: 'down' | 'up' | 'left' | 'right',
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    const probeOffset = side === 'right' || side === 'down' ? 1 : -1;

    for (const point of getSideProbePoints(centerX, centerY, side)) {
        const hit = getSolidBlockAtWorld(
            point.x + (side === 'left' || side === 'right' ? probeOffset : 0),
            point.y + (side === 'up' || side === 'down' ? probeOffset : 0),
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );
        if (hit) {
            return hit;
        }
    }

    return undefined;
}

function findGroundSupport(
    centerX: number,
    centerY: number,
    maxSnapDistance: number,
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    for (let offset = 0; offset <= maxSnapDistance; offset++) {
        const hit = collidesOnSide(
            centerX,
            centerY + offset,
            'down',
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );

        if (hit) {
            return {
                hit,
                snappedY: centerY + offset
            };
        }
    }

    return undefined;
}

function tryStepUp(
    targetX: number,
    currentY: number,
    side: 'left' | 'right',
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    for (let stepHeight = 1; stepHeight <= MOVEMENT_SETTINGS.walkStepUpHeight; stepHeight++) {
        const candidateY = currentY - stepHeight;
        const sideHit = collidesOnSide(
            targetX,
            candidateY,
            side,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );

        if (sideHit) {
            continue;
        }

        const support = findGroundSupport(
            targetX,
            candidateY,
            MOVEMENT_SETTINGS.walkStepUpHeight,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );

        if (support) {
            return {
                snappedY: support.snappedY,
                supportHit: support.hit
            };
        }
    }

    return undefined;
}

export function checkAstronautCollisions(buttonEntities: Button[], 
    spriteMap: any, SPRITE_SCALE: number, 
    mapBlocks: MapBlock[], 
    doorEntities: Door[],
    startX: number,
    startY: number,
    nextX: number, 
    nextY: number,
    gameState: any): CollisionState {
    const standRect = spriteMap[SPRITE_ROW]?.[SPRITE_COL_STAND];
    if (!standRect) {
        return {
            nextX,
            nextY,
            velocityX: astronaut.velocity.x,
            velocityY: astronaut.velocity.y,
            isLanded: gameState.astronaut.isLanded
        };
    }

    let resolvedX = startX;
    let resolvedY = startY;
    let velocityX = astronaut.velocity.x;
    let velocityY = astronaut.velocity.y;
    let isLanded = false;
    let touchedButton: Button | undefined;
    let touchedDoor: Door | undefined;

    function recordTriggerEntity(entity: unknown) {
        if (entity instanceof Button) {
            touchedButton = entity;
        } else if (entity instanceof Door) {
            touchedDoor = entity;
        }
    }

    const deltaX = nextX - startX;
    const deltaY = nextY - startY;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(deltaX), Math.abs(deltaY))));
    const stepX = deltaX / steps;
    const stepY = deltaY / steps;

    for (let i = 0; i < steps; i++) {
        if (stepX !== 0) {
            const attemptX = resolvedX + stepX;
            const side = stepX > 0 ? 'right' : 'left';
            const sideHit = collidesOnSide(
                attemptX,
                resolvedY,
                side,
                spriteMap,
                SPRITE_SCALE,
                mapBlocks,
                doorEntities,
                buttonEntities
            );

            if (sideHit) {
                const canStepUp = (gameState.astronaut.isLanded || isLanded) && stepY === 0;
                const stepUp = canStepUp
                    ? tryStepUp(
                        attemptX,
                        resolvedY,
                        side,
                        spriteMap,
                        SPRITE_SCALE,
                        mapBlocks,
                        doorEntities,
                        buttonEntities
                    )
                    : undefined;

                if (stepUp) {
                    resolvedX = attemptX;
                    resolvedY = stepUp.snappedY;
                    isLanded = true;
                    recordTriggerEntity(stepUp.supportHit);
                } else {
                    recordTriggerEntity(sideHit);
                    velocityX = 0;
                }
            } else {
                resolvedX = attemptX;
            }
        }

        if (stepY !== 0) {
            const attemptY = resolvedY + stepY;
            const side = stepY > 0 ? 'down' : 'up';
            const verticalHit = collidesOnSide(
                resolvedX,
                attemptY,
                side,
                spriteMap,
                SPRITE_SCALE,
                mapBlocks,
                doorEntities,
                buttonEntities
            );

            if (verticalHit) {
                recordTriggerEntity(verticalHit);
                velocityY = 0;
                if (stepY > 0) {
                    isLanded = true;
                }
            } else {
                resolvedY = attemptY;
                if (stepY < 0) {
                    isLanded = false;
                }
            }
        }
    }

    const support = findGroundSupport(
        resolvedX,
        resolvedY,
        gameState.astronaut.isLanded && deltaY === 0 ? 3 : 1,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    );
    if (support && velocityY >= 0) {
        recordTriggerEntity(support.hit);
        isLanded = true;
        velocityY = 0;
        resolvedY = support.snappedY;
    }

    return {
        nextX: resolvedX,
        nextY: resolvedY,
        velocityX,
        velocityY,
        isLanded,
        touchedButton,
        touchedDoor
    };
}
