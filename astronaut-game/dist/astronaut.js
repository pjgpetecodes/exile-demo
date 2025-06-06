import { getSolidBlockAtWorld } from './utilities.js';
import { Door } from './door.js';
export let astronaut = {
    position: { x: 400, y: 778 },
    velocity: { x: 0, y: 0 },
    isFlying: false,
    isLanded: true,
};
export let walkSpeed = 0;
export let facingLeft = false;
// Animation state (export if needed for animation logic)
export let upPressed = false;
export let downPressed = false;
export let leftPressed = false;
export let rightPressed = false;
// Constants
export const UP_ACCEL = -0.3;
export const DOWN_ACCEL = 0.3;
export const MAX_UP_SPEED = -4;
export const MAX_DOWN_SPEED = 4;
export const WALK_ACCEL = 0.3;
export const WALK_MAX_SPEED = 3;
export const WALK_START_SPEED = 1;
export const FLY_ACCEL = 0.28;
export const FLY_MAX_SPEED = 2.8;
// Reset astronaut state
export function resetAstronaut() {
    astronaut.position = { x: 400, y: 778 };
    astronaut.velocity = { x: 0, y: 0 };
    astronaut.isFlying = false;
    astronaut.isLanded = true;
    walkSpeed = 0;
    facingLeft = false;
}
// Main movement handler (call this from game.ts)
export function handleAstronautMovement(keys, allowWalking = true) {
    // Upward (P or ArrowUp)
    if ((keys['p'] || keys['ArrowUp'])) {
        if (astronaut.isLanded) {
            astronaut.position.y -= 1;
            astronaut.isLanded = false;
        }
        upPressed = true;
    }
    else {
        upPressed = false;
    }
    // Downward (L)
    if (keys['l']) {
        downPressed = true;
    }
    else {
        downPressed = false;
    }
    // Left (Q)
    leftPressed = false;
    if (keys['q']) {
        leftPressed = true;
        if (astronaut.isLanded) {
            if (walkSpeed === 0)
                walkSpeed = WALK_START_SPEED;
            walkSpeed += WALK_ACCEL;
            if (walkSpeed > WALK_MAX_SPEED)
                walkSpeed = WALK_MAX_SPEED;
            if (allowWalking)
                astronaut.position.x -= walkSpeed;
            facingLeft = true;
        }
        else {
            astronaut.velocity.x -= FLY_ACCEL;
            if (astronaut.velocity.x < -FLY_MAX_SPEED)
                astronaut.velocity.x = -FLY_MAX_SPEED;
            facingLeft = true;
        }
    }
    // Right (W)
    rightPressed = false;
    if (keys['w']) {
        rightPressed = true;
        if (astronaut.isLanded) {
            if (walkSpeed === 0)
                walkSpeed = WALK_START_SPEED;
            walkSpeed += WALK_ACCEL;
            if (walkSpeed > WALK_MAX_SPEED)
                walkSpeed = WALK_MAX_SPEED;
            if (allowWalking)
                astronaut.position.x += walkSpeed;
            facingLeft = false;
        }
        else {
            astronaut.velocity.x += FLY_ACCEL;
            if (astronaut.velocity.x > FLY_MAX_SPEED)
                astronaut.velocity.x = FLY_MAX_SPEED;
            facingLeft = false;
        }
    }
    // Walking momentum/friction after landing
    if (astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed > 0) {
        if (allowWalking) {
            if (facingLeft) {
                astronaut.position.x -= walkSpeed;
            }
            else {
                astronaut.position.x += walkSpeed;
            }
        }
        walkSpeed -= WALK_ACCEL * 0.5;
        if (walkSpeed < 0)
            walkSpeed = 0;
    }
    // Only reset walkSpeed if landed and no keys and walkSpeed is 0 (prevents instant cancel)
    if (astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed <= 0) {
        walkSpeed = 0;
    }
    // Upward/downward acceleration if up or down is held and astronaut is not landed
    if ((keys['p'] || keys['ArrowUp']) && !astronaut.isLanded) {
        astronaut.velocity.y += UP_ACCEL * 0.25;
        if (astronaut.velocity.y < MAX_UP_SPEED) {
            astronaut.velocity.y = MAX_UP_SPEED;
        }
    }
    if (downPressed && !astronaut.isLanded) {
        astronaut.velocity.y += DOWN_ACCEL * 0.5;
        if (astronaut.velocity.y > MAX_DOWN_SPEED) {
            astronaut.velocity.y = MAX_DOWN_SPEED;
        }
    }
    // --- Carry over horizontal momentum into walking on landing ---
    if (typeof handleAstronautMovement._wasLanded === 'undefined') {
        handleAstronautMovement._wasLanded = astronaut.isLanded;
    }
    const wasLanded = handleAstronautMovement._wasLanded;
    if (!wasLanded && astronaut.isLanded) {
        // Just landed from flying
        if (Math.abs(handleAstronautMovement._lastVX || 0) > 0.01) {
            walkSpeed = Math.abs(handleAstronautMovement._lastVX);
            if (walkSpeed > WALK_MAX_SPEED)
                walkSpeed = WALK_MAX_SPEED;
            facingLeft = handleAstronautMovement._lastVX < 0;
        }
    }
    handleAstronautMovement._lastVX = astronaut.velocity.x;
    handleAstronautMovement._wasLanded = astronaut.isLanded;
    // Walking momentum/friction after landing (again, for safety)
    if (astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed > 0) {
        if (allowWalking) {
            if (facingLeft) {
                astronaut.position.x -= walkSpeed;
            }
            else {
                astronaut.position.x += walkSpeed;
            }
        }
        walkSpeed -= WALK_ACCEL * 0.5;
        if (walkSpeed < 0)
            walkSpeed = 0;
    }
    if (astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed <= 0) {
        walkSpeed = 0;
    }
}
// --- Button collision detection and logging ---
function checkButtonCollision(x, y, SPRITE_SCALE, buttonEntities) {
    for (const btn of buttonEntities) {
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;
        if (x >= btn.x && x < btn.x + tileW &&
            y >= btn.y && y < btn.y + tileH) {
            return btn;
        }
    }
    return undefined;
}
export function checkAstronautCollisions(buttonEntities, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, nextX, nextY, gameState) {
    // Use unique variable names for collision bounding box
    const tileWCol = 32; // Default/fallback, not used for block lookup anymore
    const tileHCol = 32;
    const halfW = tileWCol / 2;
    const halfH = tileHCol / 2;
    // Check vertical movement (feet and head)
    if (astronaut.velocity.y > 0) {
        // Moving down: check feet
        const blockBelow = getSolidBlockAtWorld(nextX, nextY + halfH, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
        // --- Button collision logging ---
        const btn = checkButtonCollision(nextX, nextY + halfH, SPRITE_SCALE, buttonEntities);
        if (btn) {
            console.log(`Astronaut collided with button at (${btn.x},${btn.y})`);
        }
        // Fix: Only access blockBelow.type if blockBelow is defined
        let rect = null;
        if (blockBelow) {
            if (spriteMap instanceof Array) {
                outer: for (let row = 0; row < spriteMap.length; row++) {
                    for (let col = 0; col < spriteMap[row].length; col++) {
                        if (spriteMap[row][col].name === blockBelow.type) {
                            rect = spriteMap[row][col];
                            break outer;
                        }
                    }
                }
            }
            else if (spriteMap[blockBelow.type]) {
                rect = spriteMap[blockBelow.type];
            }
            // Use 32 * SPRITE_SCALE for tile height
            const tileH = 32 * SPRITE_SCALE;
            nextY = blockBelow.y - halfH;
            astronaut.velocity.y = 0;
            gameState.astronaut.isLanded = true;
        }
    }
    else if (astronaut.velocity.y < 0) {
        // Moving up: check head
        const blockAbove = getSolidBlockAtWorld(nextX, nextY - halfH, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
        // --- Button collision logging ---
        const btn = checkButtonCollision(nextX, nextY - halfH, SPRITE_SCALE, buttonEntities);
        if (btn) {
            console.log(`Astronaut collided with button at (${btn.x},${btn.y}) while ${gameState.astronaut.isLanded ? "walking" : "flying"}`);
        }
        let rect = null;
        if (blockAbove) {
            if (spriteMap instanceof Array) {
                outer: for (let row = 0; row < spriteMap.length; row++) {
                    for (let col = 0; col < spriteMap[row].length; col++) {
                        if (spriteMap[row][col].name === blockAbove.type) {
                            rect = spriteMap[row][col];
                            break outer;
                        }
                    }
                }
            }
            else if (spriteMap[blockAbove.type]) {
                rect = spriteMap[blockAbove.type];
            }
            // Use 32 * SPRITE_SCALE for tile height
            const tileH = 32 * SPRITE_SCALE;
            nextY = blockAbove.y + tileH + halfH;
            astronaut.velocity.y = 0;
        }
    }
    // Check horizontal movement (left/right sides)
    if (astronaut.velocity.x !== 0) {
        // Check both top and bottom corners for side collision
        const sideY1 = nextY - halfH + 2;
        const sideY2 = nextY + halfH - 2;
        let blockSide = null;
        if (astronaut.velocity.x > 0) {
            // Moving right
            blockSide = getSolidBlockAtWorld(nextX + halfW, sideY1, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities) ||
                getSolidBlockAtWorld(nextX + halfW, sideY2, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
            // --- Button collision logging ---
            const btn1 = checkButtonCollision(nextX + halfW, sideY1, SPRITE_SCALE, buttonEntities);
            const btn2 = checkButtonCollision(nextX + halfW, sideY2, SPRITE_SCALE, buttonEntities);
            if (btn1 || btn2) {
                const btn = btn1 !== null && btn1 !== void 0 ? btn1 : btn2;
                if (btn) {
                    console.log(`Astronaut collided with button at (${btn.x},${btn.y}) while ${gameState.astronaut.isLanded ? "walking" : "flying"}`);
                }
            }
            if (blockSide) {
                // --- Door animation logic ---
                if (blockSide instanceof Door &&
                    blockSide.type === "door_horizontal" &&
                    !blockSide.locked &&
                    !blockSide.animating) {
                    blockSide.animating = true;
                }
                // ...existing code for collision response...
                let rect = null;
                if (spriteMap instanceof Array) {
                    outer: for (let row = 0; row < spriteMap.length; row++) {
                        for (let col = 0; col < spriteMap[row].length; col++) {
                            if (spriteMap[row][col].name === blockSide.type) {
                                rect = spriteMap[row][col];
                                break outer;
                            }
                        }
                    }
                }
                else if (spriteMap[blockSide.type]) {
                    rect = spriteMap[blockSide.type];
                }
                // Use 32 * SPRITE_SCALE for tile width
                const tileW = 32 * SPRITE_SCALE;
                nextX = blockSide.x - halfW;
                astronaut.velocity.x = 0;
            }
        }
        else {
            // Moving left
            blockSide = getSolidBlockAtWorld(nextX - halfW, sideY1, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities) ||
                getSolidBlockAtWorld(nextX - halfW, sideY2, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
            // --- Button collision logging ---
            const btn1 = checkButtonCollision(nextX - halfW, sideY1, SPRITE_SCALE, buttonEntities);
            const btn2 = checkButtonCollision(nextX - halfW, sideY2, SPRITE_SCALE, buttonEntities);
            if (btn1 || btn2) {
                const btn = btn1 !== null && btn1 !== void 0 ? btn1 : btn2;
                if (btn) {
                    console.log(`Astronaut collided with button at (${btn.x},${btn.y}) while ${gameState.astronaut.isLanded ? "walking" : "flying"}`);
                }
            }
            if (blockSide) {
                // --- Door animation logic ---
                if (blockSide instanceof Door &&
                    blockSide.type === "door_horizontal" &&
                    !blockSide.locked &&
                    !blockSide.animating) {
                    blockSide.animating = true;
                }
                // ...existing code for collision response...
                let rect = null;
                if (spriteMap instanceof Array) {
                    outer: for (let row = 0; row < spriteMap.length; row++) {
                        for (let col = 0; col < spriteMap[row].length; col++) {
                            if (spriteMap[row][col].name === blockSide.type) {
                                rect = spriteMap[row][col];
                                break outer;
                            }
                        }
                    }
                }
                else if (spriteMap[blockSide.type]) {
                    rect = spriteMap[blockSide.type];
                }
                // Use 32 * SPRITE_SCALE for tile width
                const tileW = 32 * SPRITE_SCALE;
                nextX = blockSide.x + tileW + halfW;
                astronaut.velocity.x = 0;
            }
        }
    }
}
