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
import { createTrail } from './trail.js';
// Instead of dynamic import, fetch the JSON file at runtime for browser compatibility
let spriteMap;
function loadSpriteMap() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch('./src/assets/exile_sprites_map.json');
        spriteMap = yield res.json();
    });
}
const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
if (!canvas || !ctx) {
    throw new Error('Canvas or 2D context not found');
}
let astronaut = {
    position: { x: canvas.width / 2, y: canvas.height - 50 },
    velocity: { x: 0, y: 0 },
    isFlying: false,
    isLanded: true,
};
let gameState = {
    astronaut,
    gravity: 0.12,
    trail: [],
    isRunning: true,
};
let spriteSheet;
// Sprite scaling factor (adjust as needed)
const SPRITE_SCALE = 2;
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
let jetpackDots = [];
let jetpackDotEmitTimer = 0;
let upPressed = false;
const UP_ACCEL = -0.3; // stronger upward acceleration per frame (must be > gravity)
const MAX_UP_SPEED = -4; // max upward velocity
// Walking speed parameters
const WALK_ACCEL = 0.3; // acceleration per frame when walking
const WALK_MAX_SPEED = 4; // max walking speed
const WALK_START_SPEED = 1; // initial walking speed
let walkSpeed = 0;
// Track multiple key states
const keys = {};
window.addEventListener('keydown', (event) => {
    keys[event.key] = true;
});
window.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});
let facingLeft = false;
// When drawing the sprite, ensure the canvas is cleared with a transparent background
function gameLoop() {
    if (!gameState.isRunning)
        return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    // --- Controls: Upward and horizontal movement ---
    // Upward (P or ArrowUp)
    if ((keys['p'] || keys['ArrowUp'])) {
        if (astronaut.isLanded) {
            astronaut.velocity.y = -2;
            astronaut.isLanded = false;
        }
        upPressed = true;
    }
    else {
        upPressed = false;
    }
    // Left (Q)
    let leftPressed = false;
    if (keys['q']) {
        leftPressed = true;
        if (astronaut.isLanded) {
            // Accelerate walk speed up to max
            if (walkSpeed === 0)
                walkSpeed = WALK_START_SPEED;
            walkSpeed += WALK_ACCEL;
            if (walkSpeed > WALK_MAX_SPEED)
                walkSpeed = WALK_MAX_SPEED;
            astronaut.position.x -= walkSpeed;
            astronaut.velocity.x = 0;
            facingLeft = true;
        }
        else {
            astronaut.velocity.x -= 0.18;
            if (astronaut.velocity.x < -2)
                astronaut.velocity.x = -2;
            facingLeft = true;
        }
    }
    // Right (W)
    let rightPressed = false;
    if (keys['w']) {
        rightPressed = true;
        if (astronaut.isLanded) {
            // Accelerate walk speed up to max
            if (walkSpeed === 0)
                walkSpeed = WALK_START_SPEED;
            walkSpeed += WALK_ACCEL;
            if (walkSpeed > WALK_MAX_SPEED)
                walkSpeed = WALK_MAX_SPEED;
            astronaut.position.x += walkSpeed;
            astronaut.velocity.x = 0;
            facingLeft = false;
        }
        else {
            astronaut.velocity.x += 0.18;
            if (astronaut.velocity.x > 2)
                astronaut.velocity.x = 2;
            facingLeft = false;
        }
    }
    // Reset walk speed if not walking or not landed
    if ((!leftPressed && !rightPressed) || !astronaut.isLanded) {
        walkSpeed = 0;
    }
    // --- Upward acceleration if up is held and astronaut is not landed ---
    if ((keys['p'] || keys['ArrowUp']) && !astronaut.isLanded) {
        astronaut.velocity.y += UP_ACCEL;
        if (astronaut.velocity.y < MAX_UP_SPEED) {
            astronaut.velocity.y = MAX_UP_SPEED;
        }
    }
    // Emit jetpack dots for up, left, right
    jetpackDotEmitTimer++;
    if ((upPressed || leftPressed || rightPressed) &&
        jetpackDotEmitTimer % 4 === 0 &&
        spriteSheet && spriteSheet.complete) {
        // Get sprite rect from JSON map for accurate width/height
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, SPRITE_COL_STAND);
        const SPRITE_W = spriteRect.w;
        const SPRITE_H = spriteRect.h;
        // Use the actual drawn sprite size and position for accurate jetpack dot emission
        const drawW = SPRITE_W * SPRITE_SCALE * (4 / 3) * 3;
        const drawH = SPRITE_H * SPRITE_SCALE * (2 / 3) * 3;
        // For flipping, calculate leftX based on facingLeft
        // Move jetpack dots 4px closer to the sprite
        const offset = 10;
        const leftX = facingLeft
            ? astronaut.position.x + drawW / 2 - offset
            : astronaut.position.x - drawW / 2 + offset;
        const midY = astronaut.position.y;
        // Up
        if (upPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: leftX,
                y: midY,
                vy: 3 + Math.random() * 2,
                alpha: 1
            });
        }
        // Left
        if (leftPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: astronaut.position.x - offset,
                y: astronaut.position.y + drawH / 2 - offset,
                vy: 3 + Math.random() * 2,
                alpha: 1
            });
        }
        // Right
        if (rightPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: astronaut.position.x + offset,
                y: astronaut.position.y - drawH / 2 + offset,
                vy: 3 + Math.random() * 2,
                alpha: 1
            });
        }
    }
    if (!(upPressed || leftPressed || rightPressed)) {
        jetpackDotEmitTimer = 0;
    }
    applyGravity(astronaut, gameState.gravity);
    createTrail(astronaut, gameState.trail);
    // Jetpack dots update and render
    jetpackDots.forEach(dot => {
        dot.y += dot.vy;
        dot.alpha -= 0.025;
    });
    jetpackDots = jetpackDots.filter(dot => dot.y < canvas.height && dot.alpha > 0);
    // Render jetpack dots as small white squares (pixel art look) with fade
    jetpackDots.forEach(dot => {
        ctx.save();
        ctx.globalAlpha = dot.alpha;
        ctx.fillStyle = 'white';
        ctx.fillRect(dot.x, dot.y, 4, 4);
        ctx.restore();
    });
    // --- Ground collision and landing logic ---
    const groundY = canvas.height - 80; // 80px above bottom, adjust for astronaut image
    if (astronaut.position.y >= groundY) {
        astronaut.position.y = groundY;
        astronaut.velocity.y = 0;
        astronaut.isLanded = true;
    }
    else {
        astronaut.isLanded = false;
    }
    // Prevent flying above the top of the canvas
    if (astronaut.position.y < 0) {
        astronaut.position.y = 0;
        astronaut.velocity.y = 0;
    }
    // Apply horizontal velocity if in air
    if (!astronaut.isLanded) {
        astronaut.position.x += astronaut.velocity.x;
        // Apply friction in air for gradual slow down
        astronaut.velocity.x *= 0.98;
        if (Math.abs(astronaut.velocity.x) < 0.05)
            astronaut.velocity.x = 0;
    }
    else {
        astronaut.velocity.x = 0; // stop horizontal movement when landed
    }
    // Prevent moving off the left/right edges
    if (astronaut.position.x < 0)
        astronaut.position.x = 0;
    if (astronaut.position.x > canvas.width)
        astronaut.position.x = canvas.width;
    // --- Sprite selection logic ---
    let spriteCol = SPRITE_COL_STAND;
    let flipSprite = facingLeft;
    // Walking animation (cycle columns 5,6,7 when walking right on ground, not flying)
    if (astronaut.isLanded && !keys['p'] && !keys['ArrowUp'] && (keys['q'] || keys['w'])) {
        walkAnimTimer += 1 / 60;
        if (walkAnimTimer > 0.05) {
            walkAnimFrame++;
            if (walkAnimFrame > SPRITE_COL_WALK_END)
                walkAnimFrame = SPRITE_COL_WALK_START;
            walkAnimTimer = 0;
        }
        spriteCol = walkAnimFrame;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
    }
    else if (!astronaut.isLanded && (keys['q'] || keys['w'])) {
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
    // Render astronaut (center image on position), flip if facing left
    if (spriteSheet && spriteSheet.complete) {
        // Use SPRITE_W and SPRITE_H from the JSON, apply scaling and aspect ratio fix
        const drawW = SPRITE_W * SPRITE_SCALE * (4 / 3) * 3;
        const drawH = SPRITE_H * SPRITE_SCALE * (2 / 3) * 3;
        ctx.save();
        if (facingLeft) {
            ctx.translate(astronaut.position.x, astronaut.position.y);
            ctx.scale(-1, 1);
            ctx.drawImage(spriteSheet, SPRITE_X, SPRITE_Y, SPRITE_W, SPRITE_H, -drawW / 2, -drawH / 2, drawW, drawH);
        }
        else {
            ctx.drawImage(spriteSheet, SPRITE_X, SPRITE_Y, SPRITE_W, SPRITE_H, astronaut.position.x - drawW / 2, astronaut.position.y - drawH / 2, drawW, drawH);
        }
        ctx.restore();
    }
    // Render trail
    gameState.trail.forEach((dot) => {
        ctx.fillStyle = 'black';
        ctx.fillRect(dot.x, dot.y, 2, 2);
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
// Initialize the game
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadSpriteMap();
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
