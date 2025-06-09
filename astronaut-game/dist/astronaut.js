import { getSolidBlockAtWorld } from './utilities.js';
import { Door } from './door.js';
export let astronaut = {
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
    var _a, _b;
    // Use unique variable names for collision bounding box
    const tileWCol = 32; // Default/fallback, not used for block lookup anymore
    const tileHCol = 32;
    const halfW = tileWCol / 2;
    const halfH = tileHCol / 2;
    // --- DEBUG: Log astronaut position and velocity before collision checks ---
    console.log('[DEBUG] Astronaut collision check:', {
        nextX, nextY, velocity: Object.assign({}, astronaut.velocity), isLanded: astronaut.isLanded
    });
    // Check vertical movement (feet and head)
    if (astronaut.velocity.y > 0) {
        // Moving down: check feet
        const testX = nextX;
        const testY = nextY + halfH;
        console.log('[DEBUG] Checking feet collision at', { x: testX, y: testY });
        // --- GREEN BBOX DEBUG: Check global green bounding boxes ---
        const greenBoxes = window.spriteWorldBoundingBoxes;
        let greenHit = null;
        if (greenBoxes) {
            for (const type in greenBoxes) {
                for (const box of greenBoxes[type]) {
                    const inside = testX >= box.worldMinX && testX < box.worldMaxX && testY >= box.worldMinY && testY < box.worldMaxY;
                    if (inside) {
                        greenHit = box;
                        console.log('[DEBUG][greenBBox] HIT', box.type, 'entityId', box.entityId, 'at', { x: testX, y: testY }, 'box:', box);
                    }
                    else {
                        console.log('[DEBUG][greenBBox] MISS', box.type, 'entityId', box.entityId, 'at', { x: testX, y: testY }, 'box:', box);
                    }
                }
            }
            if (!greenHit) {
                console.log('[DEBUG][greenBBox] No green bounding box hit for feet at', { x: testX, y: testY });
            }
        }
        else {
            console.log('[DEBUG][greenBBox] No global green bounding boxes found');
        }
        // --- Button collision logging ---
        const btn = checkButtonCollision(nextX, nextY + halfH, SPRITE_SCALE, buttonEntities);
        if (btn) {
            console.log(`Astronaut collided with button at (${btn.x},${btn.y})`);
        }
        // --- Use green bounding box for landing logic ---
        if (greenHit) {
            // Try to find the corresponding tile block for this entityId for comparison
            let blockBelow = null;
            for (const b of mapBlocks) {
                if (b.entityId && b.entityId === greenHit.entityId) {
                    blockBelow = b;
                    break;
                }
            }
            if (blockBelow) {
                // Log both green box and tile box for comparison
                const tileW = 32 * SPRITE_SCALE;
                const tileH = 32 * SPRITE_SCALE;
                console.log('[DEBUG][compare] Landing on greenBBox entityId', greenHit.entityId, 'greenBBox:', greenHit, 'tileBox:', {
                    x: blockBelow.x, y: blockBelow.y, w: (_a = blockBelow.width) !== null && _a !== void 0 ? _a : tileW, h: (_b = blockBelow.height) !== null && _b !== void 0 ? _b : tileH
                });
            }
            // --- PIXEL PERFECT COLLISION CHECK ---
            let pixelSolid = true;
            try {
                // Get spriteSheet from window (must be set in game.ts)
                const spriteSheet = window.spriteSheet;
                const spriteRects = window.spriteRects || spriteMap; // fallback to spriteMap if not set
                if (spriteSheet && spriteRects) {
                    // Find the sprite rect for this block type
                    let rect = null;
                    if (spriteRects instanceof Array) {
                        outer: for (let row = 0; row < spriteRects.length; row++) {
                            for (let col = 0; col < spriteRects[row].length; col++) {
                                if (spriteRects[row][col].name === greenHit.type) {
                                    rect = spriteRects[row][col];
                                    break outer;
                                }
                            }
                        }
                    }
                    else if (spriteRects[greenHit.type]) {
                        rect = spriteRects[greenHit.type];
                    }
                    if (rect) {
                        // Calculate astronaut's feet position in block local coordinates
                        const localX = Math.floor((nextX - greenHit.worldMinX) / SPRITE_SCALE);
                        const localY = Math.floor((greenHit.worldMaxY - (nextY + halfH)) / SPRITE_SCALE); // feet at bottom
                        // Clamp to sprite rect
                        const px = Math.max(0, Math.min(rect.w - 1, localX));
                        const py = Math.max(0, Math.min(rect.h - 1, localY));
                        // Get pixel data
                        const ctx = window._spriteSheetCtx;
                        if (ctx) {
                            const imageData = ctx.getImageData(rect.x + px, rect.y + py, 1, 1).data;
                            const alpha = imageData[3];
                            pixelSolid = alpha > 0;
                            console.log('[DEBUG][pixelPerfect] Checking pixel at', { px, py, alpha, pixelSolid });
                        }
                        else {
                            // If no ctx, fallback to green box only
                            console.warn('[DEBUG][pixelPerfect] No _spriteSheetCtx found on window, skipping pixel check');
                        }
                    }
                    else {
                        console.warn('[DEBUG][pixelPerfect] No sprite rect found for', greenHit.type);
                    }
                }
                else {
                    console.warn('[DEBUG][pixelPerfect] spriteSheet or spriteRects not found on window');
                }
            }
            catch (e) {
                console.error('[DEBUG][pixelPerfect] Error during pixel-perfect check:', e);
            }
            if (pixelSolid) {
                // Use green bounding box for landing
                // Place astronaut just above the green box
                nextY = greenHit.worldMinY - halfH;
                astronaut.velocity.y = 0;
                gameState.astronaut.isLanded = true;
                console.log('[DEBUG] Astronaut landed on greenBBox. Velocity set to 0, isLanded = true');
            }
            else {
                // Not solid at pixel, keep falling
                console.log('[DEBUG][pixelPerfect] Pixel not solid, ignoring greenBBox for landing');
            }
        }
        // ...do not use old tile collision for landing anymore...
    }
    else if (astronaut.velocity.y < 0) {
        // Moving up: check head
        console.log('[DEBUG] Checking head collision at', { x: nextX, y: nextY - halfH });
        const blockAbove = getSolidBlockAtWorld(nextX, nextY - halfH, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
        if (blockAbove) {
            // --- DEBUG: Log blockAbove details and bounding box ---
            console.log('[DEBUG] blockAbove found:', blockAbove);
            if (blockAbove.greenBBox) {
                console.log('[DEBUG] blockAbove greenBBox:', blockAbove.greenBBox);
            }
        }
        else {
            console.log('[DEBUG] No blockAbove found at', { x: nextX, y: nextY - halfH });
        }
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
            // --- DEBUG: Log collision resolution ---
            console.log('[DEBUG] Hitting head on blockAbove. Setting nextY:', blockAbove.y + tileH + halfH);
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
            console.log('[DEBUG] Checking right side collision at', { x: nextX + halfW, y1: sideY1, y2: sideY2 });
            blockSide = getSolidBlockAtWorld(nextX + halfW, sideY1, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities) ||
                getSolidBlockAtWorld(nextX + halfW, sideY2, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
            if (blockSide) {
                console.log('[DEBUG] blockSide (right) found:', blockSide);
                if (blockSide.greenBBox) {
                    console.log('[DEBUG] blockSide greenBBox:', blockSide.greenBBox);
                }
            }
            else {
                console.log('[DEBUG] No blockSide (right) found at', { x: nextX + halfW, y1: sideY1, y2: sideY2 });
            }
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
                // --- DEBUG: Log collision resolution ---
                console.log('[DEBUG] Collided with right blockSide. Setting nextX:', blockSide.x - halfW);
                nextX = blockSide.x - halfW;
                astronaut.velocity.x = 0;
            }
        }
        else {
            // Moving left
            console.log('[DEBUG] Checking left side collision at', { x: nextX - halfW, y1: sideY1, y2: sideY2 });
            blockSide = getSolidBlockAtWorld(nextX - halfW, sideY1, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities) ||
                getSolidBlockAtWorld(nextX - halfW, sideY2, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
            if (blockSide) {
                console.log('[DEBUG] blockSide (left) found:', blockSide);
                if (blockSide.greenBBox) {
                    console.log('[DEBUG] blockSide greenBBox:', blockSide.greenBBox);
                }
            }
            else {
                console.log('[DEBUG] No blockSide (left) found at', { x: nextX - halfW, y1: sideY1, y2: sideY2 });
            }
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
                // --- DEBUG: Log collision resolution ---
                console.log('[DEBUG] Collided with left blockSide. Setting nextX:', blockSide.x + tileW + halfW);
                nextX = blockSide.x + tileW + halfW;
                astronaut.velocity.x = 0;
            }
        }
    }
    // --- DEBUG: Log astronaut state after collision checks ---
    console.log('[DEBUG] Astronaut after collision:', {
        nextX, nextY, velocity: Object.assign({}, astronaut.velocity), isLanded: astronaut.isLanded
    });
}
