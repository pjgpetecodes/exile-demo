var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
import { astronaut, handleAstronautMovement, walkSpeed, facingLeft, upPressed, downPressed, leftPressed, rightPressed } from './astronaut.js';
import { applyGravity } from './gravity.js';
import { mapBlocks, mapLoaded, loadMapBlocks, drawMap } from './map.js';
import { initStars, updateAndDrawStars } from './stars.js';
import { emitJetpackDots, updateAndDrawJetpackDots } from './jetpack.js';
import { Button, Door, Creature, Collectable } from './entities.js';
import { makeBlackTransparent, remapSpritePalette, calculateSpriteCollisionBoundingBoxes, calculateAstronautSpriteBoundingBoxes, getSolidBlockAtWorld, getAnyBlockAtWorld, drawEntities } from './utilities.js';
// Instead of dynamic import, fetch the JSON file at runtime for browser compatibility
let spriteMap;
function loadSpriteMap() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch('./src/assets/exile_sprites_map.json');
        spriteMap = yield res.json();
    });
}
let palettes = [];
let remappedSpriteSheets = [];
let colorAliases = {};
function loadColorAliases() {
    return __awaiter(this, void 0, void 0, function* () {
        if (Object.keys(colorAliases).length > 0)
            return;
        const res = yield fetch('./src/assets/colors.json');
        colorAliases = yield res.json();
    });
}
function resolveColor(color) {
    if (typeof color === "string") {
        return colorAliases[color] || [0, 0, 0];
    }
    return color;
}
function loadPalettes() {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadColorAliases();
        const res = yield fetch('./src/assets/palettes.json');
        const rawPalettes = yield res.json();
        // Map aliases to RGB arrays
        palettes = rawPalettes.map((palette) => palette.map(({ from, to }) => ({
            from: resolveColor(from),
            to: resolveColor(to)
        })));
    });
}
// --- Map size in pixels (constant) ---
const MAP_WIDTH = 10000; // pixels
const MAP_HEIGHT = 10000; // pixels
window.addEventListener('keydown', (event) => {
    keys[event.key] = true;
});
window.addEventListener('keyup', (event) => {
    keys[event.key] = false;
});
// --- Mouse tracking for debug ---
let mouseScreen = { x: 0, y: 0 };
let mouseWorld = { x: 0, y: 0 };
window.addEventListener('mousemove', (e) => {
    const rect = canvas.getBoundingClientRect();
    mouseScreen.x = e.clientX - rect.left;
    mouseScreen.y = e.clientY - rect.top;
});
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
let astronautSpriteSource; // Use this for astronaut rendering
// Sprite scaling factor (adjust as needed)
const SPRITE_SCALE = 2.2;
// Sprite columns
const SPRITE_ROW = 0; // top row
const SPRITE_COL_STAND = 4;
const SPRITE_COL_FLY_RIGHT = 0;
const SPRITE_COL_FLY_DIAGONAL = 1;
const SPRITE_COL_FLY_FLOAT = 2;
const SPRITE_COL_FLY_DOWN = 3;
const SPRITE_COL_WALK_START = 4;
const SPRITE_COL_WALK_RIGHT1 = 5;
const SPRITE_COL_WALK_RIGHT2 = 6;
const SPRITE_COL_WALK_END = 7;
let walkAnimFrame = SPRITE_COL_WALK_START;
let walkAnimTimer = 0;
// Flying direction change animation state
let flyHoldTimer = 0;
let flyDir = null;
let flySwitching = false;
let flySwitchStep = 0;
let flySwitchTimer = 0;
// Add fly down transition state variables
let flyDownTransitioning = false;
let flyDownTransitionStep = 0;
let flyDownTransitionTimer = 0;
let lastFlySpriteCol = SPRITE_COL_FLY_RIGHT; // Track last flying sprite col
const teleportLocations = [];
let teleportSlot = 0;
let teleporting = false;
let teleportAnimFrame = 0;
const TELEPORT_ANIM_FRAMES = 30; // 0.5 seconds at 60fps
let teleportPhase = 'none';
let teleportTarget = null;
let teleportSpriteCol = SPRITE_COL_STAND;
let teleportFlipSprite = false;
let teleportFlipVertical = false;
// --- Sound effects ---
const rememberSound = new Audio('./src/assets/remember.wav');
const teleportSound = new Audio('./src/assets/teleport.wav');
const buttonOnSound = new Audio('./src/assets/button_on.wav');
const doorOpenSound = new Audio('./src/assets/door_open.wav');
const doorCloseSound = new Audio('./src/assets/door_close.wav');
const ouchSounds = [
    new Audio('./src/assets/ouch_1.wav'),
    new Audio('./src/assets/ouch_2.wav')
];
// --- Input state ---
const keys = {};
let prevKeys = {};
// --- Entity arrays ---
let buttonEntities = [];
let doorEntities = [];
let creatureEntities = [];
let collectableEntities = [];
// --- Button press debounce state ---
const buttonPressTimestamps = new WeakMap();
// --- Entity loaders ---
function loadButtons() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch('./src/assets/buttons.json');
        const arr = yield res.json();
        buttonEntities = arr.map((data) => new Button(data));
    });
}
function loadDoors() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch('./src/assets/doors.json');
        const arr = yield res.json();
        doorEntities = arr.map((data) => {
            return new Door(data);
        });
    });
}
function loadCreatures() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch('./src/assets/creatures.json');
        const arr = yield res.json();
        creatureEntities = arr.map((data) => new Creature(data));
    });
}
function loadCollectables() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch('./src/assets/collectables.json');
        const arr = yield res.json();
        collectableEntities = arr.map((data) => new Collectable(data));
    });
}
// --- Map rendering and update logic ---
function init() {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadSpriteMap();
        yield loadPalettes();
        yield loadMapBlocks();
        yield loadDoors();
        yield loadButtons();
        yield loadCreatures();
        yield loadCollectables();
        initStars(() => astronaut.position, canvas);
        const img = new Image();
        img.src = './src/assets/sprite_sheet.png';
        img.onload = () => {
            makeBlackTransparent(img, (canvasWithTransparency) => __awaiter(this, void 0, void 0, function* () {
                spriteSheet = new Image();
                spriteSheet.src = canvasWithTransparency.toDataURL();
                spriteSheet.onload = () => __awaiter(this, void 0, void 0, function* () {
                    // Generate remapped sprite sheets for each palette
                    remappedSpriteSheets = palettes.map((palette, idx) => idx === 0
                        ? spriteSheet // Palette 0: always original
                        : remapSpritePalette(spriteSheet, palette));
                    // Use palettes[1] for astronaut, fallback to original if not present
                    astronautSpriteSource = remappedSpriteSheets[1] || spriteSheet;
                    // --- Calculate tightest collision bounding boxes at startup ---
                    yield calculateSpriteCollisionBoundingBoxes(spriteSheet, spriteMap, mapBlocks, doorEntities, buttonEntities);
                    // --- Calculate astronaut sprite bounding boxes at startup ---
                    astronautBoundingBoxes = yield calculateAstronautSpriteBoundingBoxes(spriteSheet, spriteMap);
                    gameLoop();
                });
            }));
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
    var _a, _b;
    return __awaiter(this, void 0, void 0, function* () {
        if (!gameState.isRunning || !mapLoaded)
            return;
        ctx.imageSmoothingEnabled = false;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const camera = getCameraOffset();
        // Update mouse world position
        mouseWorld.x = mouseScreen.x + camera.x;
        mouseWorld.y = mouseScreen.y + camera.y;
        // --- Sprite selection logic (animation, flipping, flying, walking) ---
        // Declare spriteCol/flipSprite/flipVertical only ONCE at the top of gameLoop
        let spriteCol = SPRITE_COL_STAND;
        let flipSprite = facingLeft;
        let flipVertical = false;
        // --- Teleport memory logic ---
        if (keys['r'] && !prevKeys['r']) {
            // Save up to 6 locations, overwrite oldest if full
            if (teleportLocations.length < 6) {
                teleportLocations.push({ x: astronaut.position.x, y: astronaut.position.y });
            }
            else {
                teleportLocations[teleportSlot] = { x: astronaut.position.x, y: astronaut.position.y };
            }
            teleportSlot = (teleportSlot + 1) % 6;
            // Play remember sound
            try {
                rememberSound.currentTime = 0;
                rememberSound.play();
            }
            catch (_c) { }
        }
        if (keys['t'] && !prevKeys['t']) {
            let loc = null;
            if (teleportLocations.length > 0) {
                // Use the most recent (last) location
                loc = teleportLocations.pop();
                if (teleportSlot > teleportLocations.length)
                    teleportSlot = teleportLocations.length;
            }
            else {
                loc = { x: 222, y: 845 };
            }
            if (loc && !teleporting) {
                teleporting = true;
                teleportPhase = 'out';
                teleportAnimFrame = 0;
                teleportTarget = loc;
                teleportSpriteCol = spriteCol;
                teleportFlipSprite = flipSprite;
                teleportFlipVertical = flipVertical;
                // Play teleport sound
                try {
                    teleportSound.currentTime = 0;
                    teleportSound.play();
                }
                catch (_d) { }
            }
        }
        // --- Draw twinkling stars ---
        // Use a fixed y cutoff for stars (700px)
        const tileHeight = 700;
        updateAndDrawStars(ctx, camera, () => astronaut.position, canvas, tileHeight, MAP_HEIGHT);
        // --- Draw map blocks ---
        if (spriteSheet && spriteSheet.complete) {
            drawEntities(ctx, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, doorEntities);
            drawMap(ctx, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE);
            drawEntities(ctx, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, buttonEntities);
            drawEntities(ctx, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureEntities);
            drawEntities(ctx, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, collectableEntities);
        }
        // --- Controls: Upward and horizontal movement ---
        // Determine if walking should be allowed (block if button collision or door collision)
        let allowWalking = true;
        let collidedButton = undefined;
        let collidedDoor = undefined;
        let doorCollision = undefined; // Track any door collision for opening
        if (gameState.astronaut.isLanded && walkSpeed > 0) {
            // Use astronaut's tightest bounding box for collision
            const spriteRect = getSpriteRectFromMap(SPRITE_ROW, SPRITE_COL_STAND);
            const bbox = astronautBoundingBoxes["stand"] || { minX: 0, minY: 0, maxX: spriteRect.w - 1, maxY: spriteRect.h - 1, width: spriteRect.w, height: spriteRect.h };
            const astroW = bbox.width * SPRITE_SCALE;
            const astroH = bbox.height * SPRITE_SCALE;
            let intendedX = gameState.astronaut.position.x;
            if (leftPressed)
                intendedX -= walkSpeed;
            if (rightPressed)
                intendedX += walkSpeed;
            let intendedY = gameState.astronaut.position.y;
            // --- Rotation-aware bounding box calculation ---
            // Assume astronaut.rotation is 0 (no rotation) unless you have a rotation property.
            // If you have a rotation property, use it here. For now, we use 0.
            const rotation = gameState.astronaut.rotation || 0;
            // Calculate the four corners of the bounding box before rotation
            const cx = intendedX;
            const cy = intendedY;
            const halfW = astroW / 2;
            const halfH = astroH / 2;
            let corners = [
                { x: cx - halfW, y: cy - halfH },
                { x: cx + halfW, y: cy - halfH },
                { x: cx + halfW, y: cy + halfH },
                { x: cx - halfW, y: cy + halfH }
            ];
            // Apply rotation if needed (in radians)
            if (rotation !== 0) {
                const angle = rotation * (Math.PI / 2); // 1=90deg, 2=180deg, etc.
                corners = corners.map(pt => {
                    const dx = pt.x - cx;
                    const dy = pt.y - cy;
                    return {
                        x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
                        y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
                    };
                });
            }
            // Compute AABB of rotated bounding box for collision checks
            const xs = corners.map(pt => pt.x);
            const ys = corners.map(pt => pt.y);
            const astroLeft = Math.min(...xs);
            const astroRight = Math.max(...xs);
            const astroTop = Math.min(...ys);
            const astroBottom = Math.max(...ys);
            // Check for button collision
            for (const b of buttonEntities) {
                const tileW = 32 * SPRITE_SCALE;
                const tileH = 32 * SPRITE_SCALE;
                const btnLeft = b.x;
                const btnRight = b.x + tileW;
                const btnTop = b.y;
                const btnBottom = b.y + tileH;
                if (astroLeft < btnRight &&
                    astroRight > btnLeft &&
                    astroTop < btnBottom &&
                    astroBottom > btnTop) {
                    allowWalking = false;
                    collidedButton = b;
                    break;
                }
            }
            // Check for door collision (horizontal doors only, unlocked)
            for (const d of doorEntities) {
                if (d.type === "door_horizontal" && !d.locked) {
                    const tileW = 32 * SPRITE_SCALE;
                    const tileH = 32 * SPRITE_SCALE;
                    const doorLeft = d.x;
                    const doorRight = d.x + tileW;
                    const doorTop = d.y;
                    const doorBottom = d.y + tileH;
                    if (astroLeft < doorRight &&
                        astroRight > doorLeft &&
                        astroTop < doorBottom &&
                        astroBottom > doorTop) {
                        collidedDoor = d;
                        doorCollision = d;
                        break;
                    }
                }
            }
        }
        else {
            // Also check for door collision while flying or not walking
            // Use astronaut's tightest bounding box at current position
            const spriteRect = getSpriteRectFromMap(SPRITE_ROW, SPRITE_COL_STAND);
            const bbox = astronautBoundingBoxes["stand"] || { minX: 0, minY: 0, maxX: spriteRect.w - 1, maxY: spriteRect.h - 1, width: spriteRect.w, height: spriteRect.h };
            const astroW = bbox.width * SPRITE_SCALE;
            const astroH = bbox.height * SPRITE_SCALE;
            // --- Rotation-aware bounding box calculation for flying ---
            const rotation = gameState.astronaut.rotation || 0;
            const cx = gameState.astronaut.position.x;
            const cy = gameState.astronaut.position.y;
            const halfW = astroW / 2;
            const halfH = astroH / 2;
            let corners = [
                { x: cx - halfW, y: cy - halfH },
                { x: cx + halfW, y: cy - halfH },
                { x: cx + halfW, y: cy + halfH },
                { x: cx - halfW, y: cy + halfH }
            ];
            if (rotation !== 0) {
                const angle = rotation * (Math.PI / 2);
                corners = corners.map(pt => {
                    const dx = pt.x - cx;
                    const dy = pt.y - cy;
                    return {
                        x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
                        y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
                    };
                });
            }
            const xs = corners.map(pt => pt.x);
            const ys = corners.map(pt => pt.y);
            const astroLeft = Math.min(...xs);
            const astroRight = Math.max(...xs);
            const astroTop = Math.min(...ys);
            const astroBottom = Math.max(...ys);
            for (const d of doorEntities) {
                if (d.type === "door_horizontal" && !d.locked) {
                    const tileW = 32 * SPRITE_SCALE;
                    const tileH = 32 * SPRITE_SCALE;
                    const doorLeft = d.x;
                    const doorRight = d.x + tileW;
                    const doorTop = d.y;
                    const doorBottom = d.y + tileH;
                    if (astroLeft < doorRight &&
                        astroRight > doorLeft &&
                        astroTop < doorBottom &&
                        astroBottom > doorTop) {
                        doorCollision = d;
                        break;
                    }
                }
            }
        }
        handleAstronautMovement(keys, allowWalking);
        // --- Button logic: toggle linked doors if collision occurred ---
        if (collidedButton && Array.isArray(collidedButton.linkedDoors)) {
            const now = performance.now();
            const lastPress = buttonPressTimestamps.get(collidedButton) || 0;
            if (now - lastPress > 500) { // 0.5 seconds debounce
                for (const doorID of collidedButton.linkedDoors) {
                    const door = doorEntities.find(d => d.doorID === doorID);
                    if (door) {
                        door.locked = !door.locked;
                    }
                }
                buttonPressTimestamps.set(collidedButton, now);
                // Play button_on sound
                try {
                    buttonOnSound.currentTime = 0;
                    buttonOnSound.play();
                }
                catch (_e) { }
            }
        }
        // --- Door animation logic for walking ---
        // Open door if collided (landed or flying) and not already animating
        if (doorCollision && !doorCollision.animating) {
            doorCollision.animating = true;
            if (typeof doorCollision._originalX === "undefined") {
                doorCollision._originalX = doorCollision.x;
            }
            doorCollision._animationDirection = "open";
            doorCollision._animationTimer = 0;
            doorCollision._closeDelay = 0;
        }
        // --- Door animation update ---
        for (const door of doorEntities) {
            if (door.animating && door.type === "door_horizontal" && !door.locked) {
                // Initialize animation state if needed
                if (typeof door._originalX === "undefined") {
                    door._originalX = door.x;
                }
                if (typeof door._animationDirection === "undefined") {
                    door._animationDirection = "open";
                }
                if (typeof door._closeDelay === "undefined") {
                    door._closeDelay = 0;
                }
                if (!('animationOffset' in door)) {
                    door.animationOffset = 0;
                }
                // Animate open (slide left)
                if (door._animationDirection === "open") {
                    if (door.animationOffset > -70) {
                        door.animationOffset -= 1.5;
                        door.x = door._originalX + door.animationOffset;
                        // Play door open sound at the start of opening
                        if (door.animationOffset === -1.5) {
                            try {
                                doorOpenSound.currentTime = 0;
                                doorOpenSound.play();
                            }
                            catch (_f) { }
                        }
                    }
                    else {
                        // Fully open, start close delay
                        door._animationDirection = "wait";
                        door._closeDelay = 0;
                    }
                }
                // Wait before closing
                else if (door._animationDirection === "wait") {
                    door._closeDelay += 1 / 60;
                    if (door._closeDelay >= 2) { // 2 seconds
                        door._animationDirection = "close";
                    }
                }
                // Animate close (slide right)
                else if (door._animationDirection === "close") {
                    if (door.animationOffset < 0) {
                        // Play door close sound at the start of closing
                        if (door.animationOffset === -69) {
                            try {
                                doorCloseSound.currentTime = 0;
                                doorCloseSound.play();
                            }
                            catch (_g) { }
                        }
                        door.animationOffset += 1.5;
                        if (door.animationOffset > 0)
                            door.animationOffset = 0;
                        door.x = door._originalX + door.animationOffset;
                    }
                    else {
                        // Done closing
                        door.animating = false;
                        door.animationOffset = 0;
                        door.x = door._originalX;
                        // Clean up animation state
                        delete door._animationDirection;
                        delete door._closeDelay;
                        delete door._originalX;
                    }
                }
            }
        }
        // Clear all velocities if landed and not walking
        if (gameState.astronaut.isLanded &&
            walkSpeed === 0) {
            astronaut.velocity.x = 0;
            astronaut.velocity.y = 0;
        }
        // Prevent diagonal takeoff: if landed and only up is pressed, clear horizontal velocity
        if (gameState.astronaut.isLanded &&
            upPressed &&
            !leftPressed &&
            !rightPressed) {
            astronaut.velocity.x = 0;
        }
        // --- Gravity ---
        applyGravity(astronaut, gameState.gravity);
        // --- Move astronaut by velocity with collision detection ---
        // Only apply velocity if NOT landed
        let nextX = gameState.astronaut.position.x;
        let nextY = gameState.astronaut.position.y;
        let hitBlock = false;
        let hitVelocity = 0;
        let preVX = astronaut.velocity.x;
        let preVY = astronaut.velocity.y;
        let hitType = null;
        let touchedDoor = undefined;
        if (!gameState.astronaut.isLanded) {
            nextX += astronaut.velocity.x;
            nextY += astronaut.velocity.y;
        }
        // Use unique variable names for collision bounding box
        const tileWCol = 32; // Default/fallback, not used for block lookup anymore
        const tileHCol = 32;
        const halfW = tileWCol / 2;
        const halfH = tileHCol / 2;
        // Check for collision at next position (feet, head, left, right)
        let blockedX = false;
        let blockedY = false;
        // --- Button collision detection and logging ---
        function checkButtonCollision(x, y, SPRITE_SCALE) {
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
        // Check vertical movement (feet and head)
        if (astronaut.velocity.y > 0) {
            // Moving down: check feet
            const blockBelow = getSolidBlockAtWorld(nextX, nextY + halfH, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
            // --- Button collision logging ---
            const btn = checkButtonCollision(nextX, nextY + halfH, SPRITE_SCALE);
            if (btn) {
                console.log(`Astronaut collided with button at (${btn.x},${btn.y}) while ${gameState.astronaut.isLanded ? "walking" : "flying"}`);
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
                blockedY = true;
            }
        }
        else if (astronaut.velocity.y < 0) {
            // Moving up: check head
            const blockAbove = getSolidBlockAtWorld(nextX, nextY - halfH, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
            // --- Button collision logging ---
            const btn = checkButtonCollision(nextX, nextY - halfH, SPRITE_SCALE);
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
                blockedY = true;
                hitBlock = true;
                hitType = 'head';
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
                const btn1 = checkButtonCollision(nextX + halfW, sideY1, SPRITE_SCALE);
                const btn2 = checkButtonCollision(nextX + halfW, sideY2, SPRITE_SCALE);
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
                        touchedDoor = blockSide;
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
                    blockedX = true;
                    hitBlock = true;
                    hitType = 'side';
                }
            }
            else {
                // Moving left
                blockSide = getSolidBlockAtWorld(nextX - halfW, sideY1, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities) ||
                    getSolidBlockAtWorld(nextX - halfW, sideY2, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
                // --- Button collision logging ---
                const btn1 = checkButtonCollision(nextX - halfW, sideY1, SPRITE_SCALE);
                const btn2 = checkButtonCollision(nextX - halfW, sideY2, SPRITE_SCALE);
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
                        touchedDoor = blockSide;
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
                    blockedX = true;
                    hitBlock = true;
                    hitType = 'side';
                }
            }
        }
        // --- Door animation update ---
        for (const door of doorEntities) {
            if (door.animating && door.type === "door_horizontal" && !door.locked) {
                // Initialize animation state if needed
                if (typeof door._originalX === "undefined") {
                    door._originalX = door.x;
                }
                if (typeof door._animationDirection === "undefined") {
                    door._animationDirection = "open";
                }
                if (typeof door._closeDelay === "undefined") {
                    door._closeDelay = 0;
                }
                if (!('animationOffset' in door)) {
                    door.animationOffset = 0;
                }
                // Animate open (slide left)
                if (door._animationDirection === "open") {
                    if (door.animationOffset > -70) {
                        door.animationOffset -= 1.5;
                        door.x = door._originalX + door.animationOffset;
                        // Play door open sound at the start of opening
                        if (door.animationOffset === -1.5) {
                            try {
                                doorOpenSound.currentTime = 0;
                                doorOpenSound.play();
                            }
                            catch (_h) { }
                        }
                    }
                    else {
                        // Fully open, start close delay
                        door._animationDirection = "wait";
                        door._closeDelay = 0;
                    }
                }
                // Wait before closing
                else if (door._animationDirection === "wait") {
                    door._closeDelay += 1 / 60;
                    if (door._closeDelay >= 2) { // 2 seconds
                        door._animationDirection = "close";
                    }
                }
                // Animate close (slide right)
                else if (door._animationDirection === "close") {
                    if (door.animationOffset < 0) {
                        // Play door close sound at the start of closing
                        if (door.animationOffset === -70) {
                            try {
                                doorCloseSound.currentTime = 0;
                                doorCloseSound.play();
                            }
                            catch (_j) { }
                        }
                        door.animationOffset += 1.5;
                        if (door.animationOffset > 0)
                            door.animationOffset = 0;
                        door.x = door._originalX + door.animationOffset;
                    }
                    else {
                        // Done closing
                        door.animating = false;
                        door.animationOffset = 0;
                        door.x = door._originalX;
                        // Clean up animation state
                        delete door._animationDirection;
                        delete door._closeDelay;
                        delete door._originalX;
                    }
                }
            }
        }
        // If not blocked vertically, not landed
        //if (!blockedY) gameState.astronaut.isLanded = false;
        gameState.astronaut.position.x = nextX;
        gameState.astronaut.position.y = nextY;
        // Ensure astronaut position is always integer pixels
        gameState.astronaut.position.x = Math.round(gameState.astronaut.position.x);
        gameState.astronaut.position.y = Math.round(gameState.astronaut.position.y);
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
            walkAnimFrame,
            walkAnimTimer,
            canvas
        });
        // --- Jetpack dots update and render (draw relative to camera) ---
        updateAndDrawJetpackDots(ctx, camera, MAP_HEIGHT);
        // --- Sprite selection logic (animation, flipping, flying, walking) ---
        // REMOVE this duplicate declaration:
        // let spriteCol = SPRITE_COL_STAND;
        // let flipSprite = facingLeft;
        // let flipVertical = false; // <-- add this
        // Debug: Log key and state info for animation selection
        if (gameState.debugMode) {
            ctx.save();
            ctx.font = '12px monospace';
            ctx.fillStyle = '#ff0';
            let debugY = 16;
            ctx.fillText(`Astronaut position: (${gameState.astronaut.position.x.toFixed(2)}, ${gameState.astronaut.position.y.toFixed(2)})`, 10, debugY);
            debugY += 16;
            ctx.fillText(`leftPressed: ${leftPressed} | rightPressed: ${rightPressed} | upPressed: ${upPressed} | downPressed: ${downPressed}`, 10, debugY);
            debugY += 16;
            ctx.fillText(`isLanded: ${gameState.astronaut.isLanded} | walkSpeed: ${walkSpeed.toFixed(2)} | spriteCol: ${spriteCol}`, 10, debugY);
            debugY += 16;
            ctx.fillText(`walkAnimFrame: ${walkAnimFrame} | walkAnimTimer: ${walkAnimTimer.toFixed(2)} | flyHoldTimer: ${flyHoldTimer.toFixed(2)}`, 10, debugY);
            debugY += 16;
            ctx.fillText(`flyDir: ${flyDir} | flySwitching: ${flySwitching} | flySwitchStep: ${flySwitchStep}`, 10, debugY);
            debugY += 16;
            // --- Show block under mouse cursor with palette and rotation ---
            const block = getAnyBlockAtWorld(mouseWorld.x, mouseWorld.y, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities, creatureEntities);
            if (block) {
                ctx.fillText(`Block under cursor: ${block.type} (${block.x},${block.y}) palette: ${(_a = block.palette) !== null && _a !== void 0 ? _a : 0} rotation: ${(_b = block.rotation) !== null && _b !== void 0 ? _b : 0}` +
                    (typeof block.locked !== "undefined" ? ` locked: ${block.locked}` : ""), 10, debugY);
                // Extra: If it's a door, show palette_locked/palette_unlocked
                if (block.type && block.type.startsWith("door")) {
                    ctx.fillText(`palette_locked: ${block.palette_locked} palette_unlocked: ${block.palette_unlocked}`, 10, debugY + 16);
                    debugY += 16;
                }
            }
            else {
                ctx.fillText(`Block under cursor: (none)`, 10, debugY);
            }
            debugY += 16;
            ctx.fillText(`Mouse world: (${mouseWorld.x.toFixed(1)}, ${mouseWorld.y.toFixed(1)})`, 10, debugY);
            ctx.restore();
        }
        // --- Animate transition to fly_down if flying and down + (q or w) pressed ---
        if (!gameState.astronaut.isLanded &&
            downPressed &&
            (keys['q'] || keys['w'])) {
            // Determine direction
            const goingLeft = !!keys['q'];
            // If not already transitioning, start from current flying sprite
            if (!flyDownTransitioning) {
                // Determine which flying sprite we're currently on
                if (lastFlySpriteCol === SPRITE_COL_FLY_DIAGONAL) {
                    flyDownTransitionStep = 0;
                }
                else if (lastFlySpriteCol === SPRITE_COL_FLY_RIGHT) {
                    flyDownTransitionStep = 1;
                }
                else {
                    // Default: start from fly_diagonal
                    flyDownTransitionStep = 0;
                }
                flyDownTransitioning = true;
                flyDownTransitionTimer = 0;
            }
            // Animation sequence: fly_diagonal -> fly_right -> fly_down
            const flyDownSeq = [
                { col: SPRITE_COL_FLY_DIAGONAL, flip: goingLeft },
                { col: SPRITE_COL_FLY_RIGHT, flip: goingLeft },
                { col: SPRITE_COL_FLY_DOWN, flip: !goingLeft }
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
        // --- Walking animation ---
        // Show walking animation if landed and walkSpeed > 0 (even if no keys are pressed)
        else if (gameState.astronaut.isLanded &&
            walkSpeed > 0) {
            // Check if there is a block below the astronaut's feet
            const tileHDraw = 32; // Not used for block lookup
            const feetY = gameState.astronaut.position.y + tileHDraw / 2;
            // --- Use up-to-date door positions for collision ---
            const blockBelow = getSolidBlockAtWorld(gameState.astronaut.position.x, feetY + 1, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
            if (!blockBelow) {
                // No block below: set to flying
                gameState.astronaut.isLanded = false;
                gameState.astronaut.isFlying = true;
            }
            else {
                // Debug: Show walking branch taken (momentum or key)
                if (gameState.debugMode) {
                    //console.log('WALKING: isLanded && walkSpeed > 0');
                }
                walkAnimTimer += 1 / 60;
                if (walkAnimTimer > 0.05) { // slower frame rate
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
        }
        else if (gameState.astronaut.isLanded) {
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
            // --- Regular flying logic ---
            // Only reset flyDownTransition if not holding down
            if (!downPressed) {
                flyDownTransitioning = false;
                flyDownTransitionStep = 0;
                flyDownTransitionTimer = 0;
            }
            // Debug: Show flying branch taken
            if (gameState.debugMode) {
                //console.log('FLYING: !gameState.astronaut.isLanded && (keys[q] || keys[w])');
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
                lastFlySpriteCol = SPRITE_COL_FLY_DIAGONAL;
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
                        lastFlySpriteCol = SPRITE_COL_FLY_DIAGONAL;
                    }
                    else {
                        spriteCol = SPRITE_COL_FLY_RIGHT;
                        flipSprite = flyDir === 'left';
                        lastFlySpriteCol = SPRITE_COL_FLY_RIGHT;
                    }
                    walkAnimFrame = SPRITE_COL_WALK_START;
                    walkAnimTimer = 0;
                }
            }
        }
        else if (!gameState.astronaut.isLanded &&
            !keys['q'] && !keys['w'] &&
            Math.abs(gameState.astronaut.velocity.x) > 0.01) {
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
        }
        else {
            // Debug: Show fallback branch taken
            if (gameState.debugMode) {
                //console.log('FALLBACK: no animation branch matched');
            }
            walkAnimFrame = SPRITE_COL_WALK_START;
            walkAnimTimer = 0;
            flyHoldTimer = 0;
            flyDir = null;
            flySwitching = false;
            flySwitchStep = 0;
            flySwitchTimer = 0;
        }
        // --- Teleport animation rendering ---
        if (teleporting && spriteSheet && spriteSheet.complete) {
            const spriteRect = getSpriteRectFromMap(SPRITE_ROW, teleportSpriteCol);
            const SPRITE_W = spriteRect.w;
            const SPRITE_H = spriteRect.h;
            const drawW = 32 * SPRITE_SCALE;
            const drawH = 32 * SPRITE_SCALE;
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            if (teleportFlipSprite)
                ctx.scale(-1, 1);
            if (teleportFlipVertical)
                ctx.scale(1, -1);
            // Render random bits of the sprite for a more "teleport" effect
            const totalBits = 32; // number of random bits per frame
            let visibleBits = totalBits;
            if (teleportPhase === 'out') {
                visibleBits = Math.max(2, Math.floor(totalBits * (1 - teleportAnimFrame / TELEPORT_ANIM_FRAMES)));
            }
            else if (teleportPhase === 'in') {
                visibleBits = Math.max(2, Math.floor(totalBits * (teleportAnimFrame / TELEPORT_ANIM_FRAMES)));
            }
            for (let i = 0; i < visibleBits; ++i) {
                // Randomly pick a region of the sprite
                const bitW = SPRITE_W / 8;
                const bitH = SPRITE_H / 8;
                const sx = spriteRect.x + Math.floor(Math.random() * (SPRITE_W - bitW));
                const sy = spriteRect.y + Math.floor(Math.random() * (SPRITE_H - bitH));
                const dx = -drawW / 2 + ((sx - spriteRect.x) / SPRITE_W) * drawW;
                const dy = -drawH / 2 + ((sy - spriteRect.y) / SPRITE_H) * drawH;
                ctx.drawImage(spriteSheet, sx, sy, bitW, bitH, dx, dy, bitW * SPRITE_SCALE, bitH * SPRITE_SCALE);
            }
            ctx.restore();
            teleportAnimFrame++;
            if (teleportPhase === 'out' && teleportAnimFrame >= TELEPORT_ANIM_FRAMES) {
                // Move astronaut after 0.5 second
                if (teleportTarget) {
                    astronaut.position.x = teleportTarget.x;
                    astronaut.position.y = teleportTarget.y;
                    astronaut.velocity.x = 0; // Clear velocity on teleport
                    astronaut.velocity.y = 0; // Clear velocity on teleport
                    // If teleporting into the air (not on ground), set isFlying so gravity applies
                    // We'll check for ground below the feet
                    const tileHDraw = 32;
                    const feetY = teleportTarget.y + tileHDraw / 2;
                    const blockBelow = getSolidBlockAtWorld(teleportTarget.x, feetY + 1, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities);
                    if (!blockBelow) {
                        astronaut.isLanded = false;
                        astronaut.isFlying = true;
                    }
                }
                teleportPhase = 'in';
                teleportAnimFrame = 0;
            }
            else if (teleportPhase === 'in' && teleportAnimFrame >= TELEPORT_ANIM_FRAMES) {
                teleporting = false;
                teleportPhase = 'none';
                teleportTarget = null;
            }
            prevKeys = Object.assign({}, keys);
            requestAnimationFrame(gameLoop);
            return;
        }
        // --- Render astronaut at center of screen with correct animation ---
        if ((astronautSpriteSource || spriteSheet) && (spriteSheet && spriteSheet.complete)) {
            const spriteRect = getSpriteRectFromMap(SPRITE_ROW, spriteCol);
            const SPRITE_W = spriteRect.w;
            const SPRITE_H = spriteRect.h;
            const drawW = 32 * SPRITE_SCALE;
            const drawH = 32 * SPRITE_SCALE;
            ctx.save();
            ctx.translate(canvas.width / 2, canvas.height / 2);
            if (flipSprite)
                ctx.scale(-1, 1);
            if (flipVertical)
                ctx.scale(1, -1);
            ctx.drawImage(astronautSpriteSource || spriteSheet, spriteRect.x, spriteRect.y, SPRITE_W, SPRITE_H, -drawW / 2, -drawH / 2, drawW, drawH);
            // --- Draw tight bounding box for astronaut (with transforms) ---
            if (showTightBoundingBoxes) {
                let spriteName = spriteRect.name;
                if (!astronautBoundingBoxes[spriteName]) {
                    const colToName = {
                        [SPRITE_COL_FLY_RIGHT]: "fly_right",
                        [SPRITE_COL_FLY_DIAGONAL]: "fly_diagonal",
                        [SPRITE_COL_FLY_FLOAT]: "fly_float",
                        [SPRITE_COL_FLY_DOWN]: "fly_down",
                        [SPRITE_COL_STAND]: "stand",
                        [SPRITE_COL_WALK_START]: "walk_right1",
                        [SPRITE_COL_WALK_RIGHT1]: "walk_right2",
                        [SPRITE_COL_WALK_END]: "walk_right3"
                    };
                    spriteName = colToName[spriteCol];
                }
                const bbox = astronautBoundingBoxes[spriteName];
                if (bbox) {
                    ctx.save();
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 2;
                    // The context is already translated and scaled as for the sprite.
                    const scale = SPRITE_SCALE;
                    const x = -drawW / 2 + bbox.minX * scale;
                    const y = -drawH / 2 + bbox.minY * scale;
                    const w = bbox.width * scale;
                    const h = bbox.height * scale;
                    ctx.strokeRect(x, y, w, h);
                    ctx.restore();
                }
            }
            ctx.restore();
            // --- Draw tight bounding boxes for world map sprites with collision ---
            if (showTightBoundingBoxes && spriteSheet && spriteSheet.complete) {
                // Draw for mapBlocks, doorEntities, buttonEntities with collision=true
                const drawBBox = (entity) => {
                    if (!entity.collision)
                        return;
                    // Find bounding box for this type
                    let rect = null;
                    if (spriteMap instanceof Array) {
                        outer: for (let row = 0; row < spriteMap.length; row++) {
                            for (let col = 0; col < spriteMap[row].length; col++) {
                                if (spriteMap[row][col].name === entity.type) {
                                    rect = spriteMap[row][col];
                                    break outer;
                                }
                            }
                        }
                    }
                    else if (spriteMap[entity.type]) {
                        rect = spriteMap[entity.type];
                    }
                    if (!rect)
                        return;
                    const boundingBoxes = window._spriteBoundingBoxes;
                    let bbox = undefined;
                    if (boundingBoxes && boundingBoxes[entity.type]) {
                        bbox = boundingBoxes[entity.type];
                    }
                    else {
                        bbox = { minX: 0, minY: 0, width: rect.w, height: rect.h };
                    }
                    const scale = SPRITE_SCALE;
                    const tileW = 32 * scale;
                    const tileH = 32 * scale;
                    // Draw after applying the same transforms as the sprite
                    ctx.save();
                    // Center of the sprite
                    const drawX = entity.x - camera.x + tileW / 2;
                    const drawY = entity.y - camera.y + tileH / 2;
                    ctx.translate(drawX, drawY);
                    // Apply rotation if present
                    if (entity.rotation) {
                        if (entity.rotation >= 1 && entity.rotation <= 4) {
                            ctx.rotate(((entity.rotation - 1) * Math.PI) / 2);
                        }
                        else if (entity.rotation === 5) {
                            ctx.scale(-1, 1);
                        }
                        else if (entity.rotation === 6) {
                            ctx.scale(1, -1);
                        }
                        else if (entity.rotation === 7) {
                            ctx.scale(-1, -1);
                        }
                    }
                    ctx.strokeStyle = 'red';
                    ctx.lineWidth = 2;
                    // Draw bbox relative to sprite center
                    const x = -tileW / 2 + bbox.minX * scale;
                    const y = -tileH / 2 + bbox.minY * scale;
                    const w = bbox.width * scale;
                    const h = bbox.height * scale;
                    ctx.strokeRect(x, y, w, h);
                    ctx.restore();
                };
                // Try to get boundingBoxes from calculateSpriteCollisionBoundingBoxes
                // If not present, call it and store in window._spriteBoundingBoxes
                if (!window._spriteBoundingBoxes) {
                    calculateSpriteCollisionBoundingBoxes(spriteSheet, spriteMap, mapBlocks, doorEntities, buttonEntities).then(boundingBoxes => {
                        window._spriteBoundingBoxes = boundingBoxes;
                    });
                }
                mapBlocks.forEach(drawBBox);
                doorEntities.forEach(drawBBox);
                buttonEntities.forEach(drawBBox);
            }
        }
        prevKeys = Object.assign({}, keys);
        requestAnimationFrame(gameLoop);
    });
}
// --- Bounding boxes for astronaut sprites (populated after calculation) ---
let astronautBoundingBoxes = {};
// --- Show tight bounding boxes toggle ---
let showTightBoundingBoxes = false;
window.addEventListener('keydown', (e) => {
    if (e.key === 'b')
        showTightBoundingBoxes = !showTightBoundingBoxes;
});
