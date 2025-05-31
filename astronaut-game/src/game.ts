// Main entry point for the astronaut game
import { Astronaut, GameState } from './types/index.js';
import { applyGravity } from './gravity.js';
import { handleControls } from './controls.js';
import { createTrail } from './trail.js';
import { mapBlocks, mapLoaded, loadMapBlocks, drawMap, getBlockAtWorld } from './map.js';
import { initStars, updateAndDrawStars } from './stars.js';
import { emitJetpackDots, updateAndDrawJetpackDots, resetJetpackDotEmitTimer } from './jetpack.js';

// Instead of dynamic import, fetch the JSON file at runtime for browser compatibility
let spriteMap: any;

async function loadSpriteMap() {
    const res = await fetch('./src/assets/exile_sprites_map.json');
    spriteMap = await res.json();

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
}

// --- Map setup ---
// type MapBlock = { ... } // Move to types/index.js if not already there
// let mapBlocks: MapBlock[] = [];
// let mapLoaded = false;

// --- Map size in pixels (constant) ---
const MAP_WIDTH = 10000;  // pixels
const MAP_HEIGHT = 10000; // pixels
let mapTiles: { type: 'floor_grass' | 'floor_plain_half' }[][] = [];

// --- Astronaut world position ---
let astronaut: Astronaut = {
    position: { x: 400, y: 778 }, // start at 0,0
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

const canvas = document.getElementById('gameCanvas') as HTMLCanvasElement;
const ctx = canvas.getContext('2d');

if (!canvas || !ctx) {
    throw new Error('Canvas or 2D context not found');
}

let gameState: GameState & { debugMode: boolean } = {
    astronaut,
    gravity: 0.04, // reduced gravity from 0.09 to 0.04 for gentler fall
    trail: [],
    isRunning: true,
    debugMode: true
};

let spriteSheet: HTMLImageElement;

// Store ground tile info after loading sprite map
let floorGrassRect: { x: number, y: number, w: number, h: number } | null = null;
let floorPlainHalfRect: { x: number, y: number, w: number, h: number } | null = null;
let groundTiles: { x: number, y: number }[] = [];

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
let flyDir: 'left' | 'right' | null = null;
let flySwitching = false;
let flySwitchStep = 0;
let flySwitchTimer = 0;

// Add fly down transition state variables
let flyDownTransitioning = false;
let flyDownTransitionStep = 0;
let flyDownTransitionTimer = 0;
let lastFlySpriteCol = SPRITE_COL_FLY_RIGHT; // Track last flying sprite col

// Move all control and movement state variables back above gameLoop so they are in scope
let upPressed = false;
let downPressed = false;
let leftPressed = false;
let rightPressed = false;
let walkSpeed = 0;
let facingLeft = false;
const keys: Record<string, boolean> = {};
const UP_ACCEL = -0.3;
const DOWN_ACCEL = 0.3;
const MAX_UP_SPEED = -4;
const MAX_DOWN_SPEED = 4;
const WALK_ACCEL = 0.3;
const WALK_MAX_SPEED = 4;
const WALK_START_SPEED = 1;

// Reduce flying acceleration and max speeds further for more control
const FLY_ACCEL = 0.28; // was 0.12, increased for faster horizontal flying
const FLY_MAX_SPEED = 2.8; // was 1.5, increased for faster horizontal flying

// Initialize the game
async function init() {
    await loadSpriteMap();
    await loadMapBlocks();
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
}

init();

function getSpriteRectFromMap(row: number, col: number) {
    return spriteMap[row][col];
}

// When drawing the sprite, ensure the canvas is cleared with a transparent background
async function gameLoop() {
    if (!gameState.isRunning || !mapLoaded) return;

    ctx!.imageSmoothingEnabled = false;
    ctx!.clearRect(0, 0, canvas.width, canvas.height);

    const camera = getCameraOffset();

    // --- Draw twinkling stars ---
    updateAndDrawStars(
        ctx!,
        camera,
        () => astronaut.position,
        canvas,
        floorGrassRect,
        SPRITE_SCALE,
        MAP_HEIGHT
    );

    // --- Draw map blocks ---
    if (spriteSheet && spriteSheet.complete && floorGrassRect && floorPlainHalfRect) {
        drawMap(ctx!, camera, floorGrassRect, floorPlainHalfRect, spriteSheet, SPRITE_SCALE);
    }

    // --- Controls: Upward and horizontal movement ---
    // Upward (P or ArrowUp)
    if ((keys['p'] || keys['ArrowUp'])) {
        if (gameState.astronaut.isLanded) {
            // Move astronaut up by 1 pixel and start flying
            gameState.astronaut.position.y -= 1;
            gameState.astronaut.isLanded = false;
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
        if (gameState.astronaut.isLanded) {
            // Only update position directly for walking, do NOT touch velocity
            if (walkSpeed === 0) walkSpeed = WALK_START_SPEED;
            walkSpeed += WALK_ACCEL;
            if (walkSpeed > WALK_MAX_SPEED) walkSpeed = WALK_MAX_SPEED;
            gameState.astronaut.position.x -= walkSpeed;
            // Do NOT set astronaut.velocity.x here!
            facingLeft = true;
        } else {
            gameState.astronaut.velocity.x -= FLY_ACCEL;
            if (gameState.astronaut.velocity.x < -FLY_MAX_SPEED) gameState.astronaut.velocity.x = -FLY_MAX_SPEED;
            facingLeft = true;
        }
    }
    // Right (W)
    rightPressed = false;
    if (keys['w']) {
        rightPressed = true;
        if (gameState.astronaut.isLanded) {
            // Only update position directly for walking, do NOT touch velocity
            if (walkSpeed === 0) walkSpeed = WALK_START_SPEED;
            walkSpeed += WALK_ACCEL;
            if (walkSpeed > WALK_MAX_SPEED) walkSpeed = WALK_MAX_SPEED;
            gameState.astronaut.position.x += walkSpeed;
            // Do NOT set astronaut.velocity.x here!
            facingLeft = false;
        } else {
            gameState.astronaut.velocity.x += FLY_ACCEL;
            if (gameState.astronaut.velocity.x > FLY_MAX_SPEED) gameState.astronaut.velocity.x = FLY_MAX_SPEED;
            facingLeft = false;
        }
    }

    // --- Walking momentum/friction after landing ---
    // Only reset walkSpeed if landed and not moving due to momentum or keys
    if (
        gameState.astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed > 0
    ) {
        // Continue walking out momentum
        if (facingLeft) {
            gameState.astronaut.position.x -= walkSpeed;
        } else {
            gameState.astronaut.position.x += walkSpeed;
        }
        // Apply friction
        walkSpeed -= WALK_ACCEL * 0.5;
        if (walkSpeed < 0) walkSpeed = 0;
    }

    // Only reset walkSpeed if landed and no keys and walkSpeed is 0 (prevents instant cancel)
    if (
        gameState.astronaut.isLanded &&
        !leftPressed && !rightPressed &&
        walkSpeed <= 0
    ) {
        walkSpeed = 0;
    }

    // --- Upward/downward acceleration if up or down is held and astronaut is not landed ---
    if ((keys['p'] || keys['ArrowUp']) && !gameState.astronaut.isLanded) {
        // Gradual upward acceleration (like flying)
        gameState.astronaut.velocity.y += UP_ACCEL * 0.25;
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
    } else if (astronaut.velocity.y < 0) {
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
        } else {
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
    updateAndDrawJetpackDots(ctx!, camera, MAP_HEIGHT);

    // --- Sprite selection logic (animation, flipping, flying, walking) ---
    let spriteCol = SPRITE_COL_STAND;
    let flipSprite = facingLeft;
    let flipVertical = false; // <-- add this

    // Debug: Log key and state info for animation selection
    if (gameState.debugMode) {
        ctx!.save();
        ctx!.font = '12px monospace';
        ctx!.fillStyle = '#ff0';
        let debugY = 16;
        ctx!.fillText(
            `Astronaut position: (${gameState.astronaut.position.x.toFixed(2)}, ${gameState.astronaut.position.y.toFixed(2)})`,
            10, debugY
        )
        debugY += 16;
        ctx!.fillText(
            `isLanded: ${gameState.astronaut.isLanded} | leftPressed: ${leftPressed} | rightPressed: ${rightPressed} | walkSpeed: ${walkSpeed.toFixed(2)}`,
            10, debugY
        );
        debugY += 16;
        ctx!.fillText(
            `upPressed: ${upPressed} | keys[q]: ${!!keys['q']} | keys[w]: ${!!keys['w']} | spriteCol: ${spriteCol}`,
            10, debugY
        );
        debugY += 16;
        ctx!.fillText(
            `walkAnimFrame: ${walkAnimFrame} | walkAnimTimer: ${walkAnimTimer.toFixed(2)} | flyHoldTimer: ${flyHoldTimer.toFixed(2)}`,
            10, debugY
        );
        debugY += 16;
        ctx!.fillText(
            `flyDir: ${flyDir} | flySwitching: ${flySwitching} | flySwitchStep: ${flySwitchStep}`,
            10, debugY
        );
        ctx!.restore();
    }

    // --- Animate transition to fly_down if flying and down + (q or w) pressed ---
    if (
        !gameState.astronaut.isLanded &&
        downPressed &&
        (keys['q'] || keys['w'])
    ) {
        // Determine direction
        const goingLeft = !!keys['q'];
        // If not already transitioning, start from current flying sprite
        if (!flyDownTransitioning) {
            // Determine which flying sprite we're currently on
            if (lastFlySpriteCol === SPRITE_COL_FLY_DIAGONAL) {
                flyDownTransitionStep = 0;
            } else if (lastFlySpriteCol === SPRITE_COL_FLY_RIGHT) {
                flyDownTransitionStep = 1;
            } else {
                // Default: start from fly_diagonal
                flyDownTransitionStep = 0;
            }
            flyDownTransitioning = true;
            flyDownTransitionTimer = 0;
        }

        // Animation sequence: fly_diagonal -> fly_right -> fly_down
        const flyDownSeq = [
            { col: SPRITE_COL_FLY_DIAGONAL, flip: goingLeft },
            { col: SPRITE_COL_FLY_RIGHT,    flip: goingLeft },
            { col: SPRITE_COL_FLY_DOWN,     flip: !goingLeft }
        ];

        spriteCol = flyDownSeq[flyDownTransitionStep].col;
        flipSprite = flyDownSeq[flyDownTransitionStep].flip;

        flyDownTransitionTimer += 1 / 60;
        if (flyDownTransitionStep < flyDownSeq.length - 1 && flyDownTransitionTimer > 0.08) {
            flyDownTransitionStep++;
            flyDownTransitionTimer = 0;
        }

        // When finished, stay on fly_down
        if (flyDownTransitionStep === flyDownSeq.length - 1) {
            flyDownTransitioning = true;
        }

        // Reset all other flying animation state
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
        lastFlySpriteCol = spriteCol;
    }
    // --- Fly down with no left/right: show stand sprite vertically flipped ---
    else if (
        !gameState.astronaut.isLanded &&
        downPressed &&
        !keys['q'] && !keys['w']
    ) {
        spriteCol = SPRITE_COL_STAND;
        flipSprite = facingLeft;
        flipVertical = true; // flip vertically for "down"
        // Reset all other flying animation state
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
        lastFlySpriteCol = spriteCol;
    }
    // --- Walking animation ---
    // Show walking animation if landed and walkSpeed > 0 (even if no keys are pressed)
    else if (
        gameState.astronaut.isLanded &&
        walkSpeed > 0
    ) {
        // Debug: Show walking branch taken (momentum or key)
        if (gameState.debugMode) {
            console.log('WALKING: isLanded && walkSpeed > 0');
        }
        walkAnimTimer += 1 / 60;
        if (walkAnimTimer > 0.16) { // slower frame rate
            walkAnimFrame++;
            if (walkAnimFrame > SPRITE_COL_WALK_END) walkAnimFrame = SPRITE_COL_WALK_START;
            walkAnimTimer = 0;
        }
        spriteCol = walkAnimFrame;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
    } else if (gameState.astronaut.isLanded) {
        spriteCol = SPRITE_COL_STAND;
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
    } else if (!gameState.astronaut.isLanded && (keys['q'] || keys['w'])) {
        // --- Regular flying logic ---
        // Only reset flyDownTransition if not holding down
        if (!downPressed) {
            flyDownTransitioning = false;
            flyDownTransitionStep = 0;
            flyDownTransitionTimer = 0;
        }
        // Debug: Show flying branch taken
        if (gameState.debugMode) {
            console.log('FLYING: !gameState.astronaut.isLanded && (keys[q] || keys[w])');
        }
        let currentDir: 'left' | 'right' = keys['w'] ? 'right' : 'left';

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
            lastFlySpriteCol = SPRITE_COL_FLY_DIAGONAL;
        } else {
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
                    { col: SPRITE_COL_FLY_DIAGONAL, flip: flyDir === 'left' }, // step 0
                    { col: SPRITE_COL_FLY_FLOAT, flip: flyDir === 'left' },    // step 1
                    { col: SPRITE_COL_FLY_FLOAT, flip: flyDir === 'right' },   // step 2 (flipped)
                    { col: SPRITE_COL_FLY_DIAGONAL, flip: flyDir === 'right' },// step 3 (flipped)
                    { col: SPRITE_COL_FLY_RIGHT, flip: flyDir === 'right' }    // step 4 (flipped)
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
            } else {
                // If flyHoldTimer is less than 0.25s, keep showing fly_diagonal (sprite 1)
                flyHoldTimer += 1 / 60;
                if (flyHoldTimer <= 0.25) {
                    spriteCol = SPRITE_COL_FLY_DIAGONAL;
                    flipSprite = flyDir === 'left';
                    lastFlySpriteCol = SPRITE_COL_FLY_DIAGONAL;
                } else {
                    spriteCol = SPRITE_COL_FLY_RIGHT;
                    flipSprite = flyDir === 'left';
                    lastFlySpriteCol = SPRITE_COL_FLY_RIGHT;
                }
                walkAnimFrame = SPRITE_COL_WALK_START;
                walkAnimTimer = 0;
            }
        }
    } else if (
        !gameState.astronaut.isLanded &&
        !keys['q'] && !keys['w'] &&
        Math.abs(gameState.astronaut.velocity.x) > 0.01
    ) {
        // Show fly_float sprite if flying with sideways momentum and no q/w pressed
        spriteCol = SPRITE_COL_FLY_FLOAT;
        flipSprite = facingLeft; // use last direction key pressed
        walkAnimFrame = SPRITE_COL_WALK_START;
        walkAnimTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
        lastFlySpriteCol = SPRITE_COL_FLY_FLOAT;
    } else {
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
    const blockTouchingFeet = getBlockAtWorld(
        astronaut.position.x,
        astronautFeetY + 1, // +1 to ensure overlap
        floorGrassRect,
        SPRITE_SCALE
    );

    if (blockTouchingFeet) {
        gameState.astronaut.isLanded = true;
        // Snap to top of block if slightly inside
        gameState.astronaut.position.y = blockTouchingFeet.y - tileHDraw / 2;
        gameState.astronaut.velocity.y = 0;

        // --- Carry over horizontal momentum into walking ---
        if (Math.abs(gameState.astronaut.velocity.x) > 0.01) {
            walkSpeed = Math.abs(gameState.astronaut.velocity.x);
            if (walkSpeed > WALK_MAX_SPEED) walkSpeed = WALK_MAX_SPEED;
            facingLeft = gameState.astronaut.velocity.x < 0;
            // Do NOT move astronaut.x here; let walking logic handle it
        }
        gameState.astronaut.velocity.x = 0; // zero horizontal velocity on landing
    } else {
        gameState.astronaut.isLanded = false;
    }

    // Prevent flying above the top of the map
    if (gameState.astronaut.position.y < 0) {
        gameState.astronaut.position.y = 0;
        gameState.astronaut.velocity.y = 0;
    }
    // Prevent moving off the left/right/top/bottom edges of the map
    if (gameState.astronaut.position.x < 0) gameState.astronaut.position.x = 0;
    if (gameState.astronaut.position.x > MAP_WIDTH) gameState.astronaut.position.x = MAP_WIDTH;
    if (gameState.astronaut.position.y > MAP_HEIGHT) gameState.astronaut.position.y = MAP_HEIGHT;

    // --- Render astronaut at center of screen with correct animation ---
    if (spriteSheet && spriteSheet.complete) {
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, spriteCol);
        const SPRITE_W = spriteRect.w;
        const SPRITE_H = spriteRect.h;
        const drawW = SPRITE_W * SPRITE_SCALE * (4 / 3) * 3;
        const drawH = SPRITE_H * SPRITE_SCALE * (2 / 3) * 3;
        ctx!.save();
        ctx!.translate(canvas.width / 2, canvas.height / 2);
        if (flipSprite) ctx!.scale(-1, 1);
        if (flipVertical) ctx!.scale(1, -1);
        ctx!.drawImage(
            spriteSheet,
            spriteRect.x, spriteRect.y, SPRITE_W, SPRITE_H,
            (flipSprite ? -drawW / 2 : -drawW / 2),
            (flipVertical ? -drawH / 2 : -drawH / 2),
            drawW, drawH
        );
        ctx!.restore();
    }

    // --- Render trail (draw relative to camera) ---
    gameState.trail.forEach((dot: { x: number; y: number }) => {
        ctx!.fillStyle = 'black';
        ctx!.fillRect(dot.x - camera.x, dot.y - camera.y, 2, 2);
    });

    requestAnimationFrame(gameLoop);
}

// After loading the sprite sheet, convert black pixels to transparent
function makeBlackTransparent(img: HTMLImageElement, callback: (result: HTMLCanvasElement) => void) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d')!;
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

// Utility: Check if a pixel in the sprite sheet is transparent
function isSpritePixelTransparent(
    img: HTMLImageElement,
    spriteRect: { x: number, y: number, w: number, h: number },
    px: number,
    py: number
): Promise<boolean> {
    return new Promise((resolve) => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.drawImage(img, 0, 0);
        const sx = Math.floor(px - spriteRect.x);
        const sy = Math.floor(py - spriteRect.y);
        if (
            sx < 0 || sy < 0 ||
            sx >= spriteRect.w || sy >= spriteRect.h
        ) {
            resolve(true);
            return;
        }
        const imageData = tempCtx.getImageData(spriteRect.x + sx, spriteRect.y + sy, 1, 1).data;
        resolve(imageData[3] === 0);
    });
}

// Enhanced collision: Only collide with non-transparent pixels
async function isSolidAtWorld(
    worldX: number,
    worldY: number,
    spriteSheet: HTMLImageElement,
    spriteMap: any,
    floorRect: { x: number, y: number, w: number, h: number } | null,
    scale: number
): Promise<boolean> {
    // Find which block (if any) is at this world position
    const block = getBlockAtWorld(worldX, worldY, floorRect, scale);
    if (!block || !floorRect) return false;

    // Calculate pixel in the sprite sheet for this block
    const localX = Math.floor((worldX - block.x) / scale);
    const localY = Math.floor((worldY - block.y) / scale);

    // Use the correct sprite for this block type
    let spriteRect = floorRect;
    // If you have multiple block types, select the correct rect here

    // Check if the pixel is transparent
    return !(await isSpritePixelTransparent(spriteSheet, spriteRect, spriteRect.x + localX, spriteRect.y + localY));
}

window.addEventListener('keydown', (event) => {
    keys[event.key] = true;
});

window.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});