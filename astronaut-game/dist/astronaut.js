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
