import { Astronaut, Position } from './types/index.js';
import { getSolidBlockAtWorld } from './utilities.js';
import { MapBlock } from './map.js';
import { Button } from './button.js';
import { Door } from './door.js';
import { SPRITE_SCALE, SPRITE_COL_STAND, SPRITE_ROW } from './constants.js';
import { MOVEMENT_SETTINGS } from './settings.js';

const DEFAULT_ASTRONAUT_START_POSITION: Position = { x: 400, y: 778 };
let astronautStartPosition: Position = { ...DEFAULT_ASTRONAUT_START_POSITION };

export let astronaut: Astronaut = {
    position: { ...DEFAULT_ASTRONAUT_START_POSITION },
    velocity: { x: 0, y: 0 },
    isFlying: false,
    isLanded: true,
    energy: MOVEMENT_SETTINGS.astronautMaxEnergy,
    maxEnergy: MOVEMENT_SETTINGS.astronautMaxEnergy,
    nextEnergyRegenAtMs: 0,
    controlDazeUntilMs: 0
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
let currentCollisionProfile = 'stand';
const PRONE_COLLISION_BOUNDS: Record<string, { worldMinX: number; worldMaxX: number; worldMinY: number; worldMaxY: number }> = {
    // Tuned for floor-flush prone contact and narrow-gap crawling.
    prone_down: { worldMinX: 5, worldMaxX: 26, worldMinY: 19, worldMaxY: 31 },
    prone_up: { worldMinX: 5, worldMaxX: 26, worldMinY: 19, worldMaxY: 31 }
};

function getDerivedProneCollisionBounds(profile: string) {
    if (profile !== 'prone_down' && profile !== 'prone_up') {
        return null;
    }
    return PRONE_COLLISION_BOUNDS[profile];
}

type MovementModifiers = {
    walkSpeedScale?: number;
    flightControlScale?: number;
};

// Reset astronaut state
export function resetAstronaut() {
    astronaut.position = { ...astronautStartPosition };
    astronaut.velocity = { x: 0, y: 0 };
    astronaut.isFlying = false;
    astronaut.isLanded = true;
    astronaut.energy = astronaut.maxEnergy;
    astronaut.nextEnergyRegenAtMs = 0;
    astronaut.controlDazeUntilMs = 0;
    walkSpeed = 0;
    facingLeft = false;
    currentCollisionProfile = 'stand';
}

export function resetAstronautToPosition(position: Position) {
    astronaut.position = {
        x: Math.round(position.x),
        y: Math.round(position.y)
    };
    astronaut.velocity = { x: 0, y: 0 };
    astronaut.isFlying = false;
    astronaut.isLanded = true;
    astronaut.energy = astronaut.maxEnergy;
    astronaut.nextEnergyRegenAtMs = 0;
    astronaut.controlDazeUntilMs = 0;
    walkSpeed = 0;
    facingLeft = false;
    currentCollisionProfile = 'stand';
}

export function getAstronautStartPosition() {
    return { ...astronautStartPosition };
}

export function setAstronautStartPosition(position: Position, applyToAstronaut: boolean = false) {
    astronautStartPosition = {
        x: Math.round(position.x),
        y: Math.round(position.y)
    };

    if (applyToAstronaut) {
        resetAstronaut();
    }
}

export function setAstronautCollisionProfile(profile: string) {
    currentCollisionProfile = profile;
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
    allowWalking: boolean = true,
    modifiers: MovementModifiers = {}
) {
    const walkSpeedScale = modifiers.walkSpeedScale ?? 1;
    const flightControlScale = modifiers.flightControlScale ?? 1;
    if (astronaut.isLanded && !allowWalking) {
        walkSpeed = 0;
    }
    // Upward (P or ArrowUp)
    if ((keys['p'] || keys['ArrowUp'])) {
        if (astronaut.isLanded) {
            astronaut.position.y -= 1;
            astronaut.isLanded = false;
            astronaut.velocity.y = Math.min(
                astronaut.velocity.y,
                MOVEMENT_SETTINGS.groundedTakeoffImpulse * flightControlScale
            );
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
        if (astronaut.isLanded && allowWalking) {
            const walkStartSpeed = MOVEMENT_SETTINGS.walkStartSpeed * walkSpeedScale;
            const walkAccel = MOVEMENT_SETTINGS.walkAccel * walkSpeedScale;
            const walkMaxSpeed = MOVEMENT_SETTINGS.walkMaxSpeed * walkSpeedScale;
            if (walkSpeed === 0) walkSpeed = walkStartSpeed;
            walkSpeed += walkAccel;
            if (walkSpeed > walkMaxSpeed) walkSpeed = walkMaxSpeed;
            if (allowWalking) astronaut.position.x -= walkSpeed;
            facingLeft = true;
        } else if (astronaut.isLanded) {
            astronaut.velocity.x -= MOVEMENT_SETTINGS.flyAccel * flightControlScale;
            if (astronaut.velocity.x < -(MOVEMENT_SETTINGS.flyMaxSpeed * flightControlScale)) {
                astronaut.velocity.x = -(MOVEMENT_SETTINGS.flyMaxSpeed * flightControlScale);
            }
            astronaut.position.x += astronaut.velocity.x;
            facingLeft = true;
        } else {
            astronaut.velocity.x -= MOVEMENT_SETTINGS.flyAccel * flightControlScale;
            if (astronaut.velocity.x < -(MOVEMENT_SETTINGS.flyMaxSpeed * flightControlScale)) astronaut.velocity.x = -(MOVEMENT_SETTINGS.flyMaxSpeed * flightControlScale);
            facingLeft = true;
        }
    }
    // Right (W)
    rightPressed = false;
    if (keys['w']) {
        rightPressed = true;
        if (astronaut.isLanded && allowWalking) {
            const walkStartSpeed = MOVEMENT_SETTINGS.walkStartSpeed * walkSpeedScale;
            const walkAccel = MOVEMENT_SETTINGS.walkAccel * walkSpeedScale;
            const walkMaxSpeed = MOVEMENT_SETTINGS.walkMaxSpeed * walkSpeedScale;
            if (walkSpeed === 0) walkSpeed = walkStartSpeed;
            walkSpeed += walkAccel;
            if (walkSpeed > walkMaxSpeed) walkSpeed = walkMaxSpeed;
            if (allowWalking) astronaut.position.x += walkSpeed;
            facingLeft = false;
        } else if (astronaut.isLanded) {
            astronaut.velocity.x += MOVEMENT_SETTINGS.flyAccel * flightControlScale;
            if (astronaut.velocity.x > MOVEMENT_SETTINGS.flyMaxSpeed * flightControlScale) {
                astronaut.velocity.x = MOVEMENT_SETTINGS.flyMaxSpeed * flightControlScale;
            }
            astronaut.position.x += astronaut.velocity.x;
            facingLeft = false;
        } else {
            astronaut.velocity.x += MOVEMENT_SETTINGS.flyAccel * flightControlScale;
            if (astronaut.velocity.x > MOVEMENT_SETTINGS.flyMaxSpeed * flightControlScale) astronaut.velocity.x = MOVEMENT_SETTINGS.flyMaxSpeed * flightControlScale;
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
        walkSpeed -= MOVEMENT_SETTINGS.walkAccel * walkSpeedScale * 0.5;
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

    if (astronaut.isLanded && !allowWalking && !leftPressed && !rightPressed) {
        astronaut.velocity.x *= 0.75;
        if (Math.abs(astronaut.velocity.x) < 0.01) {
            astronaut.velocity.x = 0;
        }
    }

    // Upward/downward acceleration if up or down is held and astronaut is not landed
    if ((keys['p'] || keys['ArrowUp']) && !astronaut.isLanded) {
        astronaut.velocity.y += MOVEMENT_SETTINGS.upAccel * flightControlScale * 0.25;
        if (astronaut.velocity.y < MOVEMENT_SETTINGS.maxUpSpeed) {
            astronaut.velocity.y = MOVEMENT_SETTINGS.maxUpSpeed;
        }
    }
    if (downPressed && !astronaut.isLanded) {
        astronaut.velocity.y += MOVEMENT_SETTINGS.downAccel * flightControlScale * 0.5;
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
        walkSpeed -= MOVEMENT_SETTINGS.walkAccel * walkSpeedScale * 0.5;
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

export function getAstronautCollisionOffsets(profile: string = currentCollisionProfile) {
    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const customBounds = getDerivedProneCollisionBounds(profile);
    if (customBounds) {
        return {
            left: -tileW / 2 + customBounds.worldMinX * SPRITE_SCALE,
            right: -tileW / 2 + (customBounds.worldMaxX + 1) * SPRITE_SCALE - 1,
            top: -tileH / 2 + customBounds.worldMinY * SPRITE_SCALE,
            bottom: -tileH / 2 + (customBounds.worldMaxY + 1) * SPRITE_SCALE - 1
        };
    }
    const astronautWorldBoundingBoxes = (window as any).astronautWorldBoundingBoxes;
    const bbox = astronautWorldBoundingBoxes?.[profile];
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
    const collision = findCollisionOnSide(
        centerX,
        centerY,
        side,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    );
    return collision?.hit;
}

type SideCollisionSummary = {
    totalProbes: number;
    hitProbes: number;
    firstCollision?: {
        hit: unknown;
        point: { x: number; y: number };
    };
};

function summarizeSideCollisions(
    centerX: number,
    centerY: number,
    side: 'down' | 'up' | 'left' | 'right',
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
): SideCollisionSummary {
    const probeOffset = side === 'right' || side === 'down' ? 1 : -1;
    let totalProbes = 0;
    let hitProbes = 0;
    let firstCollision: SideCollisionSummary['firstCollision'];

    for (const point of getSideProbePoints(centerX, centerY, side)) {
        totalProbes += 1;
        const probeX = point.x + (side === 'left' || side === 'right' ? probeOffset : 0);
        const probeY = point.y + (side === 'up' || side === 'down' ? probeOffset : 0);
        const hit = getSolidBlockAtWorld(
            probeX,
            probeY,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );
        if (hit) {
            hitProbes += 1;
            if (!firstCollision) {
                firstCollision = {
                    hit,
                    point: { x: probeX, y: probeY }
                };
            }
        }
    }

    return { totalProbes, hitProbes, firstCollision };
}

function summarizeProneSqueezeSideCollisions(
    centerX: number,
    centerY: number,
    side: 'left' | 'right',
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
): SideCollisionSummary {
    const probeOffset = side === 'right' ? 1 : -1;
    const points = getSideProbePoints(centerX, centerY, side);
    let totalProbes = 0;
    let hitProbes = 0;
    let firstCollision: SideCollisionSummary['firstCollision'];

    for (let i = 0; i < points.length; i++) {
        // Ignore extreme top/bottom edge probes for prone squeeze so floor/ceiling lips
        // don't instantly hard-block the horizontal ratchet.
        if (i === 0 || i === points.length - 1) {
            continue;
        }
        totalProbes += 1;
        const probeX = points[i].x + probeOffset;
        const probeY = points[i].y;
        const hit = getSolidBlockAtWorld(
            probeX,
            probeY,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );
        if (hit) {
            hitProbes += 1;
            if (!firstCollision) {
                firstCollision = {
                    hit,
                    point: { x: probeX, y: probeY }
                };
            }
        }
    }

    return { totalProbes, hitProbes, firstCollision };
}

function findCollisionOnSide(
    centerX: number,
    centerY: number,
    side: 'down' | 'up' | 'left' | 'right',
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    return summarizeSideCollisions(
        centerX,
        centerY,
        side,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    ).firstCollision;
}

function estimateCeilingSlope(
    hitEntity: unknown,
    collisionPoint: { x: number; y: number },
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    const samples: { x: number; y: number }[] = [];
    const horizontalRadius = 8;
    const verticalRadius = 8;

    for (let offsetX = -horizontalRadius; offsetX <= horizontalRadius; offsetX++) {
        const sampleX = collisionPoint.x + offsetX;
        let boundaryY: number | undefined;
        for (let sampleY = collisionPoint.y - verticalRadius; sampleY <= collisionPoint.y + verticalRadius; sampleY++) {
            const hit = getSolidBlockAtWorld(
                sampleX,
                sampleY,
                spriteMap,
                SPRITE_SCALE,
                mapBlocks,
                doorEntities,
                buttonEntities
            );
            if (hit === hitEntity) {
                boundaryY = sampleY;
            }
        }

        if (boundaryY !== undefined) {
            samples.push({ x: sampleX, y: boundaryY });
        }
    }

    if (samples.length < 3) {
        return undefined;
    }

    const meanX = samples.reduce((sum, sample) => sum + sample.x, 0) / samples.length;
    const meanY = samples.reduce((sum, sample) => sum + sample.y, 0) / samples.length;
    let numerator = 0;
    let denominator = 0;

    for (const sample of samples) {
        const dx = sample.x - meanX;
        numerator += dx * (sample.y - meanY);
        denominator += dx * dx;
    }

    if (denominator === 0) {
        return undefined;
    }

    return numerator / denominator;
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
    const maxStepUpHeight = currentCollisionProfile.startsWith('prone_')
        ? MOVEMENT_SETTINGS.proneStepUpHeight
        : MOVEMENT_SETTINGS.walkStepUpHeight;
    for (let stepHeight = 1; stepHeight <= maxStepUpHeight; stepHeight++) {
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
            maxStepUpHeight,
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

function getSolidOverlapRatioForProfile(
    profile: string,
    centerX: number,
    centerY: number,
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    const offsets = getAstronautCollisionOffsets(profile);
    const sampleXs = sampleEdge(centerX + offsets.left + 1, centerX + offsets.right - 1, 8);
    const sampleYs = sampleEdge(centerY + offsets.top + 1, centerY + offsets.bottom - 1, 8);
    let solidHits = 0;
    let sampleCount = 0;

    for (const sampleY of sampleYs) {
        for (const sampleX of sampleXs) {
            sampleCount += 1;
            const hit = getSolidBlockAtWorld(
                sampleX,
                sampleY,
                spriteMap,
                SPRITE_SCALE,
                mapBlocks,
                doorEntities,
                buttonEntities
            );
            if (hit) {
                solidHits += 1;
            }
        }
    }

    return sampleCount === 0 ? 0 : solidHits / sampleCount;
}

function tryProneSqueezeMove(
    targetX: number,
    currentY: number,
    side: 'left' | 'right',
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
): { snappedY: number; supportHit: unknown; isGrounded: boolean } | undefined {
    if (!currentCollisionProfile.startsWith('prone_')) {
        return undefined;
    }

    const maxSideProbeHitRatio = 0.55;
    const maxInteriorOverlapRatio = 0.3;
    const verticalOffsets = [0, -1, 1, -2, 2, -3, 3, -4, 4, -5, 5, -6, 6];
    const maxSnapDistance = Math.max(3, MOVEMENT_SETTINGS.proneStepUpHeight + 3);
    for (const verticalOffset of verticalOffsets) {
        const candidateY = currentY + verticalOffset;
        const sideSummary = summarizeProneSqueezeSideCollisions(
            targetX,
            candidateY,
            side,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );
        const sideHitRatio = sideSummary.totalProbes === 0 ? 0 : sideSummary.hitProbes / sideSummary.totalProbes;
        if (sideHitRatio > maxSideProbeHitRatio) {
            continue;
        }
        const overlapRatio = getSolidOverlapRatioForProfile(
            currentCollisionProfile,
            targetX,
            candidateY,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );
        if (overlapRatio > maxInteriorOverlapRatio) {
            continue;
        }

        const support = findGroundSupport(
            targetX,
            candidateY,
            maxSnapDistance,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        );
        if (support) {
            const resolvedY = verticalOffset < 0 ? candidateY : support.snappedY;
            return {
                snappedY: resolvedY,
                supportHit: support.hit,
                isGrounded: Math.abs(support.snappedY - resolvedY) <= 1
            };
        }
    }

    return undefined;
}

function isAstronautOverlappingSolidForProfile(
    profile: string,
    centerX: number,
    centerY: number,
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    const offsets = getAstronautCollisionOffsets(profile);
    const sampleXs = sampleEdge(centerX + offsets.left + 1, centerX + offsets.right - 1, 6);
    const sampleYs = sampleEdge(centerY + offsets.top + 1, centerY + offsets.bottom - 1, 6);

    for (const sampleY of sampleYs) {
        for (const sampleX of sampleXs) {
            const hit = getSolidBlockAtWorld(
                sampleX,
                sampleY,
                spriteMap,
                SPRITE_SCALE,
                mapBlocks,
                doorEntities,
                buttonEntities
            );
            if (hit) {
                return true;
            }
        }
    }

    return false;
}

function isAstronautOverlappingSolid(
    centerX: number,
    centerY: number,
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    return isAstronautOverlappingSolidForProfile(
        currentCollisionProfile,
        centerX,
        centerY,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    );
}

export function canAstronautFitCollisionProfile(
    profile: string,
    centerX: number,
    centerY: number,
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    return !isAstronautOverlappingSolidForProfile(
        profile,
        centerX,
        centerY,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    );
}

function resolveAstronautOverlap(
    centerX: number,
    centerY: number,
    deltaX: number,
    deltaY: number,
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: MapBlock[],
    doorEntities: Door[],
    buttonEntities: Button[]
) {
    if (!isAstronautOverlappingSolid(centerX, centerY, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities)) {
        return { x: centerX, y: centerY };
    }

    const preferredDirections = [
        { x: -Math.sign(deltaX || 0), y: 0 },
        { x: 0, y: -Math.sign(deltaY || 0) },
        { x: 0, y: -1 },
        { x: Math.sign(deltaX || 1), y: 0 },
        { x: 0, y: 1 },
        { x: -1, y: 0 },
        { x: 1, y: 0 }
    ].filter((direction, index, directions) =>
        !(direction.x === 0 && direction.y === 0) &&
        directions.findIndex(other => other.x === direction.x && other.y === direction.y) === index
    );

    for (let distance = 1; distance <= 24; distance++) {
        const candidates: { x: number; y: number; score: number }[] = [];

        for (const direction of preferredDirections) {
            candidates.push({
                x: centerX + direction.x * distance,
                y: centerY + direction.y * distance,
                score: Math.abs(direction.x * distance) + Math.abs(direction.y * distance)
            });
        }

        for (let offsetX = -distance; offsetX <= distance; offsetX++) {
            candidates.push({
                x: centerX + offsetX,
                y: centerY - distance,
                score: Math.abs(offsetX) + distance
            });
            candidates.push({
                x: centerX + offsetX,
                y: centerY + distance,
                score: Math.abs(offsetX) + distance
            });
        }

        for (let offsetY = -distance + 1; offsetY <= distance - 1; offsetY++) {
            candidates.push({
                x: centerX - distance,
                y: centerY + offsetY,
                score: Math.abs(offsetY) + distance
            });
            candidates.push({
                x: centerX + distance,
                y: centerY + offsetY,
                score: Math.abs(offsetY) + distance
            });
        }

        candidates.sort((left, right) => left.score - right.score);

        for (const candidate of candidates) {
            if (!isAstronautOverlappingSolid(candidate.x, candidate.y, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities)) {
                return candidate;
            }
        }
    }

    return { x: centerX, y: centerY };
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
        if (stepY !== 0) {
            const attemptY = resolvedY + stepY;
            const side = stepY > 0 ? 'down' : 'up';
            const verticalCollision = findCollisionOnSide(
                resolvedX,
                attemptY,
                side,
                spriteMap,
                SPRITE_SCALE,
                mapBlocks,
                doorEntities,
                buttonEntities
            );
            const verticalHit = verticalCollision?.hit;

            if (verticalHit) {
                recordTriggerEntity(verticalHit);
                if (stepY > 0) {
                    velocityY = 0;
                    isLanded = true;
                } else {
                    const impactSpeed = Math.abs(velocityY);
                    const reboundSpeed = impactSpeed >= MOVEMENT_SETTINGS.headBounceMinImpactSpeed
                        ? impactSpeed * MOVEMENT_SETTINGS.headBounceRestitution
                        : 0;
                    const ceilingSlope = verticalCollision
                        ? estimateCeilingSlope(
                            verticalHit,
                            verticalCollision.point,
                            spriteMap,
                            SPRITE_SCALE,
                            mapBlocks,
                            doorEntities,
                            buttonEntities
                        )
                        : undefined;

                    const hasHorizontalTravel = Math.abs(stepX) > 0.001;
                    if (
                        reboundSpeed > 0 &&
                        hasHorizontalTravel &&
                        ceilingSlope !== undefined &&
                        Math.abs(ceilingSlope) >= MOVEMENT_SETTINGS.headBounceSlopeThreshold
                    ) {
                        let tangentX = 1;
                        let tangentY = ceilingSlope;
                        if (tangentY > 0) {
                            tangentX *= -1;
                            tangentY *= -1;
                        }
                        const tangentLength = Math.hypot(tangentX, tangentY);
                        velocityX = (tangentX / tangentLength) * reboundSpeed;
                        velocityY = (tangentY / tangentLength) * reboundSpeed;
                    } else {
                        velocityY = reboundSpeed;
                    }
                    isLanded = false;
                }
            } else {
                resolvedY = attemptY;
                if (stepY < 0) {
                    isLanded = false;
                }
            }
        }

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
                const canAttemptProneSqueeze: boolean = currentCollisionProfile.startsWith('prone_')
                    && (gameState.astronaut.isLanded || isLanded || Math.abs(stepY) <= 1);
                const proneSqueezeMove: { snappedY: number; supportHit: unknown; isGrounded: boolean } | undefined = canAttemptProneSqueeze
                    ? tryProneSqueezeMove(
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

                if (proneSqueezeMove) {
                    resolvedX = attemptX;
                    resolvedY = proneSqueezeMove.snappedY;
                    isLanded = proneSqueezeMove.isGrounded;
                    recordTriggerEntity(proneSqueezeMove.supportHit);
                } else if (stepUp) {
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

    const depenetratedPosition = resolveAstronautOverlap(
        resolvedX,
        resolvedY,
        deltaX,
        deltaY,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    );
    resolvedX = depenetratedPosition.x;
    resolvedY = depenetratedPosition.y;

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
