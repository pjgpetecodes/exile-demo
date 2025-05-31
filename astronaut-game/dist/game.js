var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { applyGravity } from './gravity.js';
import { mapLoaded, loadMapBlocks, drawMap, getBlockAtWorld } from './map.js';
import { initStars, updateAndDrawStars } from './stars.js';
import { emitJetpackDots, updateAndDrawJetpackDots } from './jetpack.js';
// Instead of dynamic import, fetch the JSON file at runtime for browser compatibility
let spriteMap;
function loadSpriteMap() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch('./src/assets/exile_sprites_map.json');
        spriteMap = yield res.json();
        // Find the floor_grass and floor_plain_half sprites in the map (by name)
        for (let row = 0; row < spriteMap.length; row++) {
            for (let col = 0; col < spriteMap[row].length; col++) {
                if (spriteMap[row][col].name === 'floor_grass') {
                    floorGrassRect = spriteMap[row][col];
                }
                if (spriteMap[row][col].name === 'floor_plain_half') {
                    floorPlainHalfRect = spriteMap[row][col];
                }
            }
        }
    });
}
// --- Map setup ---
// type MapBlock = { ... } // Move to types/index.js if not already there
// let mapBlocks: MapBlock[] = [];
// let mapLoaded = false;
// --- Map size in pixels (constant) ---
const MAP_WIDTH = 10000; // pixels
const MAP_HEIGHT = 10000; // pixels
let mapTiles = [];
// --- Astronaut world position ---
let astronaut = {
    position: { x: 400, y: 778 },
    velocity: { x: 0, y: 0 },
    isFlying: false,
    isLanded: true,
};
// --- Camera ---
function getCameraOffset() {
    // Center astronaut on screen
    return {
        x: astronaut.position.x - canvas.width / 2,
        y: astronaut.position.y - canvas.height / 2
    };
}
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
if (!canvas || !ctx) {
    throw new Error('Canvas or 2D context not found');
}
let gameState = {
    astronaut,
    gravity: 0.04,
    trail: [],
    isRunning: true,
    debugMode: true
};
let spriteSheet;
// Store ground tile info after loading sprite map
let floorGrassRect = null;
let floorPlainHalfRect = null;
let groundTiles = [];
// Sprite scaling factor (adjust as needed)
const SPRITE_SCALE = 1.2;
// Sprite columns
const SPRITE_ROW = 0; // top row
const SPRITE_COL_STAND = 4;
const SPRITE_COL_FLY_RIGHT = 0;
const SPRITE_COL_FLY_DIAGONAL = 1;
const SPRITE_COL_FLY_FLOAT = 2;
const SPRITE_COL_FLY_DOWN = 3;
const SPRITE_COL_WALK_START = 5;
const SPRITE_COL_WALK_END = 7;
let walkAnimFrame = SPRITE_COL_WALK_START;
let walkAnimTimer = 0;
// Flying direction change animation state
let flyHoldTimer = 0;
let flyDir = null;
let flySwitching = false;
let flySwitchStep = 0;
let flySwitchTimer = 0;
// Move all control and movement state variables back above gameLoop so they are in scope
let upPressed = false;
let downPressed = false;
let leftPressed = false;
let rightPressed = false;
let walkSpeed = 0;
let facingLeft = false;
const keys = {};
const UP_ACCEL = -0.3;
const DOWN_ACCEL = 0.3;
const MAX_UP_SPEED = -4;
const MAX_DOWN_SPEED = 4;
const WALK_ACCEL = 0.3;
const WALK_MAX_SPEED = 4;
const WALK_START_SPEED = 1;
// Reduce flying acceleration and max speeds further for more control
const FLY_ACCEL = 0.12; // was 0.22
const FLY_MAX_SPEED = 1.5; // was 2.5
// --- Map generation ---
/*
function generateMap() {
    mapTiles = [];
    for (let y = 0; y < MAP_HEIGHT; y++) {
        const row: { type: 'floor_grass' | 'floor_plain_half' }[] = [];
        for (let x = 0; x < MAP_WIDTH; x++) {
            // Only fill bottom row with ground, rest empty for now
            if (y === MAP_HEIGHT - 1) {
                row.push({
                    type: Math.random() < 0.5 ? 'floor_grass' : 'floor_plain_half'
                });
            } else {
                row.push(null as any); // empty space
            }
        }
        mapTiles.push(row);
    }
}
*/
// --- Load map from JSON file ---
// (REMOVE the following local function if still present)
// async function loadMapBlocks() {
//     const res = await fetch('./src/assets/world_map.json');
//     mapBlocks = await res.json();
//     mapLoaded = true;
// }
// Initialize the game
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadSpriteMap();
        yield loadMapBlocks();
        initStars(() => astronaut.position, canvas);
        const img = new Image();
        img.src = './src/assets/exile_sprites.png';
        img.onload = () => {
            makeBlackTransparent(img, (canvasWithTransparency) => {
                spriteSheet = new Image();
                spriteSheet.src = canvasWithTransparency.toDataURL();
                spriteSheet.onload = () => {
                    gameLoop();
                };
            });
        };
        img.onerror = () => {
            alert('Sprite sheet not found at ./src/assets/exile_sprites.png');
        };
    });
}
init();
function getSpriteRectFromMap(row, col) {
    return spriteMap[row][col];
}
// When drawing the sprite, ensure the canvas is cleared with a transparent background
function gameLoop() {
    if (!gameState.isRunning || !mapLoaded)
        return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const camera = getCameraOffset();
    // --- Draw twinkling stars ---
    updateAndDrawStars(ctx, camera, () => astronaut.position, canvas, floorGrassRect, SPRITE_SCALE, MAP_HEIGHT);
    // --- Draw map blocks ---
    if (spriteSheet && spriteSheet.complete && floorGrassRect && floorPlainHalfRect) {
        drawMap(ctx, camera, floorGrassRect, floorPlainHalfRect, spriteSheet, SPRITE_SCALE);
    }
    // --- Controls: Upward and horizontal movement ---
    // Upward (P or ArrowUp)
    if ((keys['p'] || keys['ArrowUp'])) {
        if (gameState.astronaut.isLanded) {
            gameState.astronaut.velocity.y = -2;
            gameState.astronaut.isLanded = false;
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
        if (gameState.astronaut.isLanded) {
            // Only update position directly for walking, do NOT touch velocity
            if (walkSpeed === 0)
                walkSpeed = WALK_START_SPEED;
            walkSpeed += WALK_ACCEL;
            if (walkSpeed > WALK_MAX_SPEED)
                walkSpeed = WALK_MAX_SPEED;
            gameState.astronaut.position.x -= walkSpeed;
            // Do NOT set astronaut.velocity.x here!
            facingLeft = true;
        }
        else {
            gameState.astronaut.velocity.x -= FLY_ACCEL;
            if (gameState.astronaut.velocity.x < -FLY_MAX_SPEED)
                gameState.astronaut.velocity.x = -FLY_MAX_SPEED;
            facingLeft = true;
        }
    }
    // Right (W)
    rightPressed = false;
    if (keys['w']) {
        rightPressed = true;
        if (gameState.astronaut.isLanded) {
            // Only update position directly for walking, do NOT touch velocity
            if (walkSpeed === 0)
                walkSpeed = WALK_START_SPEED;
            walkSpeed += WALK_ACCEL;
            if (walkSpeed > WALK_MAX_SPEED)
                walkSpeed = WALK_MAX_SPEED;
            gameState.astronaut.position.x += walkSpeed;
            // Do NOT set astronaut.velocity.x here!
            facingLeft = false;
        }
        else {
            gameState.astronaut.velocity.x += FLY_ACCEL;
            if (gameState.astronaut.velocity.x > FLY_MAX_SPEED)
                gameState.astronaut.velocity.x = FLY_MAX_SPEED;
            facingLeft = false;
        }
    }
    // Reset walk speed if not walking or not landed
    if ((!leftPressed && !rightPressed) || !gameState.astronaut.isLanded) {
        walkSpeed = 0;
    }
    // --- Upward/downward acceleration if up or down is held and astronaut is not landed ---
    if ((keys['p'] || keys['ArrowUp']) && !gameState.astronaut.isLanded) {
        gameState.astronaut.velocity.y += UP_ACCEL * 0.25; // reduce upward flying acceleration further
        if (gameState.astronaut.velocity.y < MAX_UP_SPEED) {
            gameState.astronaut.velocity.y = MAX_UP_SPEED;
        }
    }
    if (downPressed && !gameState.astronaut.isLanded) {
        gameState.astronaut.velocity.y += DOWN_ACCEL * 0.5; // reduce downward flying acceleration further
        if (gameState.astronaut.velocity.y > MAX_DOWN_SPEED) {
            gameState.astronaut.velocity.y = MAX_DOWN_SPEED;
        }
    }
    // --- Gravity ---
    applyGravity(astronaut, gameState.gravity);
    // --- Move astronaut by velocity with collision detection ---
    // Only apply velocity if NOT landed
    let nextX = gameState.astronaut.position.x;
    let nextY = gameState.astronaut.position.y;
    if (!gameState.astronaut.isLanded) {
        nextX += gameState.astronaut.velocity.x;
        nextY += gameState.astronaut.velocity.y;
    }
    // Use unique variable names for collision bounding box
    const tileWCol = floorGrassRect ? floorGrassRect.w * SPRITE_SCALE * (4 / 3) * 3 : 32;
    const tileHCol = floorGrassRect ? floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3 : 32;
    const halfW = tileWCol / 2;
    const halfH = tileHCol / 2;
    // Check for collision at next position (feet, head, left, right)
    let blockedX = false;
    let blockedY = false;
    // Check vertical movement (feet and head)
    if (astronaut.velocity.y > 0) {
        // Moving down: check feet
        const blockBelow = getBlockAtWorld(nextX, nextY + halfH, floorGrassRect, SPRITE_SCALE);
        if (blockBelow) {
            nextY = blockBelow.y - halfH;
            astronaut.velocity.y = 0;
            gameState.astronaut.isLanded = true;
            blockedY = true;
        }
    }
    else if (astronaut.velocity.y < 0) {
        // Moving up: check head
        const blockAbove = getBlockAtWorld(nextX, nextY - halfH, floorGrassRect, SPRITE_SCALE);
        if (blockAbove) {
            nextY = blockAbove.y + tileHCol + halfH;
            astronaut.velocity.y = 0;
            blockedY = true;
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
            blockSide = getBlockAtWorld(nextX + halfW, sideY1, floorGrassRect, SPRITE_SCALE) ||
                getBlockAtWorld(nextX + halfW, sideY2, floorGrassRect, SPRITE_SCALE);
            if (blockSide) {
                nextX = blockSide.x - halfW;
                astronaut.velocity.x = 0;
                blockedX = true;
            }
        }
        else {
            // Moving left
            blockSide = getBlockAtWorld(nextX - halfW, sideY1, floorGrassRect, SPRITE_SCALE) ||
                getBlockAtWorld(nextX - halfW, sideY2, floorGrassRect, SPRITE_SCALE);
            if (blockSide) {
                nextX = blockSide.x + tileWCol + halfW;
                astronaut.velocity.x = 0;
                blockedX = true;
            }
        }
    }
    // If not blocked vertically, not landed
    //if (!blockedY) gameState.astronaut.isLanded = false;
    gameState.astronaut.position.x = nextX;
    gameState.astronaut.position.y = nextY;
    // --- Jetpack dots emission (world coordinates) ---
    emitJetpackDots({
        upPressed,
        downPressed,
        leftPressed,
        rightPressed,
        facingLeft,
        astronaut,
        spriteSheet,
        spriteMap,
        SPRITE_ROW,
        SPRITE_COL_STAND,
        SPRITE_SCALE,
        floorGrassRect,
        floorPlainHalfRect,
        walkAnimFrame,
        walkAnimTimer,
        canvas
    });
    // --- Jetpack dots update and render (draw relative to camera) ---
    updateAndDrawJetpackDots(ctx, camera, MAP_HEIGHT);
    // --- Sprite selection logic (animation, flipping, flying, walking) ---
    let spriteCol = SPRITE_COL_STAND;
    let flipSprite = facingLeft;
    // Debug: Log key and state info for animation selection
    if (gameState.debugMode) {
        ctx.save();
        ctx.font = '12px monospace';
        ctx.fillStyle = '#ff0';
        let debugY = 16;
        ctx.fillText(`Astronaut position: (${gameState.astronaut.position.x.toFixed(2)}, ${gameState.astronaut.position.y.toFixed(2)})`, 10, debugY);
        debugY += 16;
        ctx.fillText(`isLanded: ${gameState.astronaut.isLanded} | leftPressed: ${leftPressed} | rightPressed: ${rightPressed} | walkSpeed: ${walkSpeed.toFixed(2)}`, 10, debugY);
        debugY += 16;
        ctx.fillText(`upPressed: ${upPressed} | keys[q]: ${!!keys['q']} | keys[w]: ${!!keys['w']} | spriteCol: ${spriteCol}`, 10, debugY);
        debugY += 16;
        ctx.fillText(`walkAnimFrame: ${walkAnimFrame} | walkAnimTimer: ${walkAnimTimer.toFixed(2)} | flyHoldTimer: ${flyHoldTimer.toFixed(2)}`, 10, debugY);
        debugY += 16;
        ctx.fillText(`flyDir: ${flyDir} | flySwitching: ${flySwitching} | flySwitchStep: ${flySwitchStep}`, 10, debugY);
        ctx.restore();
    }
    // Walking animation (cycle walk_right1, walk_right2, walk_right3 when walking left/right on ground)
    if (gameState.astronaut.isLanded &&
        (leftPressed || rightPressed) &&
        walkSpeed > 0) {
        // Debug: Show walking branch taken
        if (gameState.debugMode) {
            console.log('WALKING: isLanded && (leftPressed || rightPressed) && walkSpeed > 0');
        }
        walkAnimTimer += 1 / 60;
        if (walkAnimTimer > 0.20) {
            walkAnimFrame++;
            if (walkAnimFrame > SPRITE_COL_WALK_END)
                walkAnimFrame = SPRITE_COL_WALK_START;
        }
        spriteCol = walkAnimFrame;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
    }
    else if (gameState.astronaut.isLanded) {
        // Debug: Show standing branch taken
        if (gameState.debugMode) {
            console.log('STANDING: gameState.astronaut.isLanded');
        }
        spriteCol = SPRITE_COL_STAND;
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
    }
    else if (!gameState.astronaut.isLanded && (keys['q'] || keys['w'])) {
        // Debug: Show flying branch taken
        if (gameState.debugMode) {
            console.log('FLYING: !gameState.astronaut.isLanded && (keys[q] || keys[w])');
        }
        let currentDir = keys['w'] ? 'right' : 'left';
        // If holding up and q/w, always show fly_diagonal (sprite 1), flipped if left
        if (upPressed) {
            spriteCol = SPRITE_COL_FLY_DIAGONAL;
            flipSprite = currentDir === 'left';
            // Do not reset flyHoldTimer here, so it continues after up is released
            flySwitching = false;
            flySwitchStep = 0;
            flySwitchTimer = 0;
            walkAnimFrame = SPRITE_COL_WALK_START;
            walkAnimTimer = 0;
        }
        else {
            // Direction change animation (when not holding up)
            if (flyDir && flyDir !== currentDir) {
                flySwitching = true;
                flySwitchStep = 0;
                flySwitchTimer = 0;
            }
            flyDir = currentDir;
            if (flySwitching) {
                // Sequence: fly_diagonal, fly_float, flipped fly_float, flipped fly_diagonal, flipped fly_right
                const switchSeq = [
                    { col: SPRITE_COL_FLY_DIAGONAL, flip: flyDir === 'left' },
                    { col: SPRITE_COL_FLY_FLOAT, flip: flyDir === 'left' },
                    { col: SPRITE_COL_FLY_FLOAT, flip: flyDir === 'right' },
                    { col: SPRITE_COL_FLY_DIAGONAL, flip: flyDir === 'right' },
                    { col: SPRITE_COL_FLY_RIGHT, flip: flyDir === 'right' } // step 4 (flipped)
                ];
                spriteCol = switchSeq[flySwitchStep].col;
                flipSprite = switchSeq[flySwitchStep].flip;
                flySwitchTimer += 1 / 60;
                if (flySwitchTimer > 0.05) {
                    flySwitchStep++;
                    flySwitchTimer = 0;
                }
                if (flySwitchStep >= switchSeq.length) {
                    flySwitching = false;
                    flyHoldTimer = 0;
                }
                walkAnimFrame = SPRITE_COL_WALK_START;
                walkAnimTimer = 0;
            }
            else {
                // If flyHoldTimer is less than 0.25s, keep showing fly_diagonal (sprite 1)
                flyHoldTimer += 1 / 60;
                if (flyHoldTimer <= 0.25) {
                    spriteCol = SPRITE_COL_FLY_DIAGONAL;
                    flipSprite = flyDir === 'left';
                }
                else {
                    spriteCol = SPRITE_COL_FLY_RIGHT;
                    flipSprite = flyDir === 'left';
                }
                walkAnimFrame = SPRITE_COL_WALK_START;
                walkAnimTimer = 0;
            }
        }
    }
    else {
        // Debug: Show fallback branch taken
        if (gameState.debugMode) {
            console.log('FALLBACK: no animation branch matched');
        }
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
    }
    // Get sprite rect from JSON map
    const spriteRect = getSpriteRectFromMap(SPRITE_ROW, spriteCol);
    const SPRITE_X = spriteRect.x;
    const SPRITE_Y = spriteRect.y;
    const SPRITE_W = spriteRect.w;
    const SPRITE_H = spriteRect.h;
    // --- Ground collision and landing logic ---
    // Determine "landed" state by checking if the astronaut's feet are touching any block
    const tileWDraw = floorGrassRect ? floorGrassRect.w * SPRITE_SCALE * (4 / 3) * 3 : 32;
    const tileHDraw = floorGrassRect ? floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3 : 32;
    const astronautFeetY = astronaut.position.y + tileHDraw / 2;
    const blockTouchingFeet = getBlockAtWorld(astronaut.position.x, astronautFeetY + 1, // +1 to ensure overlap
    floorGrassRect, SPRITE_SCALE);
    if (blockTouchingFeet) {
        gameState.astronaut.isLanded = true;
        // Snap to top of block if slightly inside
        gameState.astronaut.position.y = blockTouchingFeet.y - tileHDraw / 2;
        gameState.astronaut.velocity.y = 0;
        gameState.astronaut.velocity.x = 0; // zero horizontal velocity on landing
    }
    else {
        gameState.astronaut.isLanded = false;
    }
    // Prevent flying above the top of the map
    if (gameState.astronaut.position.y < 0) {
        gameState.astronaut.position.y = 0;
        gameState.astronaut.velocity.y = 0;
    }
    // Prevent moving off the left/right/top/bottom edges of the map
    if (gameState.astronaut.position.x < 0)
        gameState.astronaut.position.x = 0;
    if (gameState.astronaut.position.x > MAP_WIDTH)
        gameState.astronaut.position.x = MAP_WIDTH;
    if (gameState.astronaut.position.y > MAP_HEIGHT)
        gameState.astronaut.position.y = MAP_HEIGHT;
    // --- Render astronaut at center of screen with correct animation ---
    if (spriteSheet && spriteSheet.complete) {
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, spriteCol);
        const SPRITE_W = spriteRect.w;
        const SPRITE_H = spriteRect.h;
        const drawW = SPRITE_W * SPRITE_SCALE * (4 / 3) * 3;
        const drawH = SPRITE_H * SPRITE_SCALE * (2 / 3) * 3;
        ctx.save();
        if (flipSprite) {
            ctx.translate(canvas.width / 2, canvas.height / 2);
            ctx.scale(-1, 1);
            ctx.drawImage(spriteSheet, spriteRect.x, spriteRect.y, SPRITE_W, SPRITE_H, -drawW / 2, -drawH / 2, drawW, drawH);
        }
        else {
            ctx.drawImage(spriteSheet, spriteRect.x, spriteRect.y, SPRITE_W, SPRITE_H, canvas.width / 2 - drawW / 2, canvas.height / 2 - drawH / 2, drawW, drawH);
        }
        ctx.restore();
    }
    // --- Render trail (draw relative to camera) ---
    gameState.trail.forEach((dot) => {
        ctx.fillStyle = 'black';
        ctx.fillRect(dot.x - camera.x, dot.y - camera.y, 2, 2);
    });
    requestAnimationFrame(gameLoop);
}
// After loading the sprite sheet, convert black pixels to transparent
function makeBlackTransparent(img, callback) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d');
    tempCtx.drawImage(img, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        // If pixel is black (0,0,0), set alpha to 0
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
            data[i + 3] = 0;
        }
    }
    tempCtx.putImageData(imageData, 0, 0);
    callback(tempCanvas);
}
window.addEventListener('keydown', (event) => {
    keys[event.key] = true;
});
window.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});
