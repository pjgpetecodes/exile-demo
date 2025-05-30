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
let mapBlocks = [];
let mapLoaded = false;
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
    gravity: 0.09,
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
let jetpackDots = [];
let jetpackDotEmitTimer = 0;
let upPressed = false;
let downPressed = false;
const UP_ACCEL = -0.3; // stronger upward acceleration per frame (must be > gravity)
const DOWN_ACCEL = 0.3; // downward acceleration per frame (should be > gravity)
const MAX_UP_SPEED = -4; // max upward velocity
const MAX_DOWN_SPEED = 4; // max downward velocity
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
const STAR_COLORS = [
    '#ffffff',
    '#ffeedd',
    '#ffd700',
    '#ffb3fa',
    '#00eaff',
    '#00ffea',
    '#ff6b6b',
    '#fffb00',
    '#00ff00',
    '#00aaff',
    '#ff9900',
    '#e0e0ff',
    '#ff00ff',
    '#00ffff',
    '#fffacd',
    '#f8f8ff', // ghost white
];
const STAR_COUNT = 40;
let stars = [];
// Random star move interval: Move every 2-6 seconds (120-360 frames)
function randomStarMoveInterval() {
    return 120 + Math.floor(Math.random() * 240);
}
// Initialize stars randomly across the sky
function initStars() {
    stars = [];
    for (let i = 0; i < STAR_COUNT; i++) {
        // Place stars in world coordinates, covering a large area
        const worldX = astronaut.position.x - canvas.width / 2 + Math.random() * canvas.width;
        const worldY = astronaut.position.y - canvas.height / 2 + Math.random() * (canvas.height - 80);
        stars.push({
            x: 0, y: 0,
            colorIndex: Math.floor(Math.random() * STAR_COLORS.length),
            twinkleTimer: Math.random() * 2,
            twinkleSpeed: 0.5 + Math.random() * 1.5,
            moveTimer: 0,
            moveInterval: randomStarMoveInterval(),
            worldX,
            worldY
        });
    }
}
// Each star moves independently at its own random interval
function maybeMoveStarsToNewLocations() {
    for (let star of stars) {
        star.moveTimer++;
        if (star.moveTimer > star.moveInterval) {
            // Move to a new world location within the visible area
            star.worldX = astronaut.position.x - canvas.width / 2 + Math.random() * canvas.width;
            star.worldY = astronaut.position.y - canvas.height / 2 + Math.random() * (canvas.height - 80);
            star.twinkleTimer = Math.random() * 2;
            star.moveTimer = 0;
            star.moveInterval = randomStarMoveInterval();
        }
    }
}
function updateAndDrawStars(ctx, camera) {
    maybeMoveStarsToNewLocations();
    // Calculate the ground Y in world coordinates (top of the ground row)
    const tileH = floorGrassRect ? floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3 : 32;
    const groundYWorld = (MAP_HEIGHT - 1) * tileH;
    for (let star of stars) {
        // Parallax: move stars at 0.7x camera speed for depth
        star.x = star.worldX - camera.x * 0.7;
        star.y = star.worldY - camera.y * 0.7;
        star.twinkleTimer += star.twinkleSpeed / 60;
        if (star.twinkleTimer > 1.5) {
            let prev = star.colorIndex;
            while (star.colorIndex === prev) {
                star.colorIndex = Math.floor(Math.random() * STAR_COLORS.length);
            }
            star.twinkleTimer = 0;
        }
        // Only draw if on screen and above the ground blocks
        if (star.x >= 0 && star.x < canvas.width &&
            star.y >= 0 && star.y < canvas.height &&
            star.worldY < groundYWorld) {
            ctx.save();
            ctx.fillStyle = STAR_COLORS[star.colorIndex];
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(star.twinkleTimer * Math.PI);
            ctx.fillRect(Math.round(star.x), Math.round(star.y), 4, 4);
            ctx.restore();
        }
    }
}
// --- Draw map tiles ---
function drawMap(ctx, camera) {
    if (!floorGrassRect || !floorPlainHalfRect || !mapLoaded)
        return;
    const tileW = floorGrassRect.w * SPRITE_SCALE * (4 / 3) * 3;
    const tileH = floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3;
    for (const block of mapBlocks) {
        // Treat block.x and block.y as pixel coordinates
        const drawX = block.x - camera.x;
        const drawY = block.y - camera.y;
        if (drawX + tileW < 0 || drawX > canvas.width ||
            drawY + tileH < 0 || drawY > canvas.height)
            continue;
        let rect = block.type === 'floor_grass' ? floorGrassRect : floorPlainHalfRect;
        ctx.save();
        ctx.translate(drawX + tileW / 2, drawY + tileH / 2);
        if (block.rotation)
            ctx.rotate(((block.rotation - 1) * Math.PI) / 2);
        ctx.scale(1, -1);
        ctx.drawImage(spriteSheet, rect.x, rect.y, rect.w, rect.h, -tileW / 2, -tileH / 2, tileW, tileH);
        ctx.restore();
    }
}
// --- Collision detection with blocks ---
function getBlockAtWorld(x, y) {
    const tileW = floorGrassRect ? floorGrassRect.w * SPRITE_SCALE * (4 / 3) * 3 : 32;
    const tileH = floorGrassRect ? floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3 : 32;
    // Find block whose pixel rect contains (x, y)
    return mapBlocks.find(b => x >= b.x && x < b.x + tileW &&
        y >= b.y && y < b.y + tileH &&
        b.collision);
}
// When drawing the sprite, ensure the canvas is cleared with a transparent background
function gameLoop() {
    if (!gameState.isRunning || !mapLoaded)
        return;
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const camera = getCameraOffset();
    // --- Draw twinkling stars ---
    updateAndDrawStars(ctx, camera);
    // --- Draw map blocks ---
    if (spriteSheet && spriteSheet.complete && floorGrassRect && floorPlainHalfRect) {
        drawMap(ctx, camera);
    }
    // --- Debug: astronaut coordinates ---
    if (gameState.debugMode) {
        ctx.save();
        ctx.font = '16px monospace';
        ctx.fillStyle = '#fff';
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 3;
        const coordText = `x: ${astronaut.position.x.toFixed(2)}  y: ${astronaut.position.y.toFixed(2)}`;
        ctx.strokeText(coordText, 10, 22);
        ctx.fillText(coordText, 10, 22);
        ctx.restore();
    }
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
    // Downward (L)
    if (keys['l']) {
        downPressed = true;
    }
    else {
        downPressed = false;
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
            astronaut.velocity.x -= 0.35; // increased from 0.18 for faster flying
            if (astronaut.velocity.x < -4)
                astronaut.velocity.x = -4; // increased max speed
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
            astronaut.velocity.x += 0.35; // increased from 0.18 for faster flying
            if (astronaut.velocity.x > 4)
                astronaut.velocity.x = 4; // increased max speed
            facingLeft = false;
        }
    }
    // Reset walk speed if not walking or not landed
    if ((!leftPressed && !rightPressed) || !astronaut.isLanded) {
        walkSpeed = 0;
    }
    // --- Upward/downward acceleration if up or down is held and astronaut is not landed ---
    if ((keys['p'] || keys['ArrowUp']) && !astronaut.isLanded) {
        astronaut.velocity.y += UP_ACCEL;
        if (astronaut.velocity.y < MAX_UP_SPEED) {
            astronaut.velocity.y = MAX_UP_SPEED;
        }
    }
    if (downPressed && !astronaut.isLanded) {
        astronaut.velocity.y += DOWN_ACCEL;
        if (astronaut.velocity.y > MAX_DOWN_SPEED) {
            astronaut.velocity.y = MAX_DOWN_SPEED;
        }
    }
    // --- Jetpack dots emission (world coordinates) ---
    jetpackDotEmitTimer++;
    if ((upPressed || downPressed || leftPressed || rightPressed) &&
        jetpackDotEmitTimer % 4 === 0 &&
        spriteSheet && spriteSheet.complete) {
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, SPRITE_COL_STAND);
        const SPRITE_W = spriteRect.w;
        const SPRITE_H = spriteRect.h;
        const drawW = SPRITE_W * SPRITE_SCALE * (4 / 3) * 3;
        const drawH = SPRITE_H * SPRITE_SCALE * (2 / 3) * 3;
        const offset = 10;
        let jetpackX = facingLeft
            ? astronaut.position.x + drawW / 2 - offset
            : astronaut.position.x - drawW / 2 + offset;
        let jetpackY = astronaut.position.y;
        if (!astronaut.isLanded && ((upPressed && (leftPressed || rightPressed)) || (downPressed && (leftPressed || rightPressed)))) {
            let vy = 0;
            if (upPressed)
                vy = 3 + Math.random() * 2;
            else if (downPressed)
                vy = -(3 + Math.random() * 2);
            jetpackDots.push({
                x: jetpackX,
                y: jetpackY,
                vy,
                alpha: 1
            });
        }
        else if (upPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: jetpackX,
                y: jetpackY,
                vy: 3 + Math.random() * 2,
                alpha: 1
            });
        }
        else if (downPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: jetpackX,
                y: jetpackY,
                vy: -(3 + Math.random() * 2),
                alpha: 1
            });
        }
        else if (leftPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: astronaut.position.x - offset,
                y: astronaut.position.y + drawH / 2 - offset,
                vy: 3 + Math.random() * 2,
                alpha: 1
            });
        }
        else if (rightPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: astronaut.position.x + offset,
                y: astronaut.position.y - drawH / 2 + offset,
                vy: 3 + Math.random() * 2,
                alpha: 1
            });
        }
    }
    if (!(upPressed || downPressed || leftPressed || rightPressed)) {
        jetpackDotEmitTimer = 0;
    }
    applyGravity(astronaut, gameState.gravity);
    createTrail(astronaut, gameState.trail);
    // --- Jetpack dots update and render (draw relative to camera) ---
    jetpackDots.forEach(dot => {
        dot.y += dot.vy;
        dot.alpha -= 0.025;
    });
    jetpackDots = jetpackDots.filter(dot => dot.y < MAP_HEIGHT && dot.alpha > 0);
    jetpackDots.forEach(dot => {
        ctx.save();
        ctx.globalAlpha = dot.alpha;
        ctx.fillStyle = '#fff'; // brighter white for jetpack trails
        ctx.fillRect(dot.x - camera.x, dot.y - camera.y, 4, 4);
        ctx.restore();
    });
    // --- Sprite selection logic (animation, flipping, flying, walking) ---
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
    // --- Ground collision and landing logic ---
    // Fix: Use blockBelow.y directly (it's already in pixels)
    const tileW = floorGrassRect ? floorGrassRect.w * SPRITE_SCALE * (4 / 3) * 3 : 32;
    const tileH = floorGrassRect ? floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3 : 32;
    const astronautFeetY = astronaut.position.y + tileH / 2;
    const blockBelow = getBlockAtWorld(astronaut.position.x, astronautFeetY);
    if (blockBelow) {
        const groundY = blockBelow.y;
        astronaut.position.y = groundY - tileH / 2;
        astronaut.velocity.y = 0;
        astronaut.velocity.x = 0; // zero horizontal velocity on landing
        astronaut.isLanded = true;
    }
    else {
        astronaut.isLanded = false;
    }
    // Prevent flying above the top of the map
    if (astronaut.position.y < 0) {
        astronaut.position.y = 0;
        astronaut.velocity.y = 0;
    }
    // Prevent moving off the left/right/top/bottom edges of the map
    if (astronaut.position.x < 0)
        astronaut.position.x = 0;
    if (astronaut.position.x > MAP_WIDTH)
        astronaut.position.x = MAP_WIDTH;
    if (astronaut.position.y > MAP_HEIGHT)
        astronaut.position.y = MAP_HEIGHT;
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
function loadMapBlocks() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch('./src/assets/world_map.json');
        mapBlocks = yield res.json();
        mapLoaded = true;
    });
}
// Initialize the game
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadSpriteMap();
        yield loadMapBlocks();
        initStars();
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
