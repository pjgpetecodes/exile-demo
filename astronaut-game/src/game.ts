// Main entry point for the astronaut game
import { Astronaut, GameState } from './types/index.js';
import {
    astronaut, resetAstronaut, handleAstronautMovement,
    walkSpeed, facingLeft, upPressed, downPressed, leftPressed, rightPressed
} from './astronaut.js';
import { applyGravity } from './gravity.js';
import { mapBlocks, mapLoaded, loadMapBlocks, drawMap, getBlockAtWorld } from './map.js';
import { initStars, updateAndDrawStars } from './stars.js';
import { emitJetpackDots, updateAndDrawJetpackDots, resetJetpackDotEmitTimer } from './jetpack.js';
import { Button, Door, Creature, Collectable } from './entities.js';

// Instead of dynamic import, fetch the JSON file at runtime for browser compatibility
let spriteMap: any;

async function loadSpriteMap() {
    const res = await fetch('./src/assets/exile_sprites_map.json');
    spriteMap = await res.json();
}

let palettes: any[] = [];
let remappedSpriteSheets: CanvasImageSource[] = [];
let colorAliases: Record<string, [number, number, number]> = {};

async function loadColorAliases() {
    if (Object.keys(colorAliases).length > 0) return;
    const res = await fetch('./src/assets/colors.json');
    colorAliases = await res.json();
}

function resolveColor(color: string | [number, number, number]): [number, number, number] {
    if (typeof color === "string") {
        return colorAliases[color] || [0, 0, 0];
    }
    return color;
}

async function loadPalettes() {
    await loadColorAliases();
    const res = await fetch('./src/assets/palettes.json');
    const rawPalettes = await res.json();
    // Map aliases to RGB arrays
    palettes = rawPalettes.map((palette: any[]) =>
        palette.map(({ from, to }) => ({
            from: resolveColor(from),
            to: resolveColor(to)
        }))
    );
}

// --- Map size in pixels (constant) ---
const MAP_WIDTH = 10000;  // pixels
const MAP_HEIGHT = 10000; // pixels


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
let astronautSpriteSource: CanvasImageSource; // Use this for astronaut rendering

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

// --- Teleport memory ---
type TeleportLocation = { x: number, y: number };
const teleportLocations: TeleportLocation[] = [];
let teleportSlot = 0;
let teleporting = false;
let teleportAnimFrame = 0;
const TELEPORT_ANIM_FRAMES = 30; // 0.5 seconds at 60fps
let teleportPhase: 'none' | 'out' | 'in' = 'none';
let teleportTarget: TeleportLocation | null = null;
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
const keys: Record<string, boolean> = {};
let prevKeys: Record<string, boolean> = {}

// --- Entity arrays ---
let buttonEntities: Button[] = [];
let doorEntities: Door[] = [];
let creatureEntities: Creature[] = [];
let collectableEntities: Collectable[] = [];

// --- Button press debounce state ---
const buttonPressTimestamps: WeakMap<Button, number> = new WeakMap();

// --- Entity loaders ---
async function loadButtons() {
    const res = await fetch('./src/assets/buttons.json');
    const arr = await res.json();
    buttonEntities = arr.map((data: any) => new Button(data));
}
async function loadDoors() {
    const res = await fetch('./src/assets/doors.json');
    const arr = await res.json();
    doorEntities = arr.map((data: any) => {
        return new Door(data);
    });
}
async function loadCreatures() {
    const res = await fetch('./src/assets/creatures.json');
    const arr = await res.json();
    creatureEntities = arr.map((data: any) => new Creature(data));
}
async function loadCollectables() {
    const res = await fetch('./src/assets/collectables.json');
    const arr = await res.json();
    collectableEntities = arr.map((data: any) => new Collectable(data));
}

// --- Draw generic entity array (same as drawMap but for any array) ---
function drawEntities(
    ctx: CanvasRenderingContext2D,
    camera: { x: number, y: number },
    spriteMap: any,
    spriteSheets: CanvasImageSource[],
    SPRITE_SCALE: number,
    entities: any[]
) {
    // Build rect lookup map once per draw
    const rectMap = (spriteMap instanceof Array)
        ? Object.fromEntries(spriteMap.flat().map((r: any) => [r.name, r]))
        : spriteMap;

    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const minX = camera.x - tileW, maxX = camera.x + ctx.canvas.width + tileW;
    const minY = camera.y - tileH, maxY = camera.y + ctx.canvas.height + tileH;

    for (const entity of entities) {
        if (
            entity.x + tileW < minX || entity.x > maxX ||
            entity.y + tileH < minY || entity.y > maxY
        ) continue;

        const rect = rectMap[entity.type];
        if (!rect) continue;

        let paletteIdx = 0;
        let paletteDebug = "";
        // Use instanceof Door to check for Door entities
        if (entity instanceof Door) {
            if (entity.locked === true && typeof entity.palette_locked === "number") {
                paletteIdx = entity.palette_locked;
                paletteDebug = `DOOR locked: true, using palette_locked (${paletteIdx})`;
            } else if (entity.locked === false && typeof entity.palette_unlocked === "number") {
                paletteIdx = entity.palette_unlocked;
                paletteDebug = `DOOR locked: false, using palette_unlocked (${paletteIdx})`;
            } else if (typeof entity.palette === "number") {
                paletteIdx = entity.palette;
                paletteDebug = `DOOR fallback, using palette (${paletteIdx})`;
            }
        } else if (typeof entity.palette === "number" && entity.palette >= 0 && entity.palette < spriteSheets.length) {
            paletteIdx = entity.palette;
        }
        const sheet = spriteSheets[paletteIdx] || spriteSheets[0];

        // --- DEBUG: Draw palette info above door ---
        if (
            entity instanceof Door &&
            ctx && ctx.canvas && (window as any).DEBUG_DOOR_PALETTE
        ) {
            ctx.save();
            ctx.font = "12px monospace";
            ctx.fillStyle = "#f0f";
            ctx.fillText(
                `locked:${entity.locked} paletteIdx:${paletteIdx}`,
                entity.x - camera.x,
                entity.y - camera.y - 8
            );
            ctx.fillStyle = "#0ff";
            ctx.fillText(
                paletteDebug,
                entity.x - camera.x,
                entity.y - camera.y - 20
            );
            ctx.restore();
        }

        ctx.save();
        const drawX = entity.x - camera.x;
        const drawY = entity.y - camera.y;
        ctx.translate(drawX + tileW / 2, drawY + tileH / 2);
        if (entity.rotation) {
            if (entity.rotation >= 1 && entity.rotation <= 4) {
                ctx.rotate(((entity.rotation - 1) * Math.PI) / 2);
            } else if (entity.rotation === 5) {
                ctx.scale(-1, 1);
            } else if (entity.rotation === 6) {
                ctx.scale(1, -1);
            } else if (entity.rotation === 7) {
                ctx.scale(-1, -1);
            }
        }

        ctx.drawImage(
            sheet,
            rect.x, rect.y, rect.w, rect.h,
            -tileW / 2, -tileH / 2,
            tileW, tileH
        );
        ctx.restore();
    }
}

// --- Map rendering and update logic ---
async function init() {
    await loadSpriteMap();
    await loadPalettes();
    await loadMapBlocks();
    await loadDoors();
    await loadButtons();
    await loadCreatures();
    await loadCollectables();
    initStars(() => astronaut.position, canvas);
    const img = new Image();
    img.src = './src/assets/sprite_sheet.png';
    img.onload = () => {
        makeBlackTransparent(img, async (canvasWithTransparency) => {
            spriteSheet = new Image();
            spriteSheet.src = canvasWithTransparency.toDataURL();
            spriteSheet.onload = async () => {
                // Generate remapped sprite sheets for each palette
                remappedSpriteSheets = palettes.map((palette: any, idx: number) =>
                    idx === 0
                        ? spriteSheet // Palette 0: always original
                        : remapSpritePalette(spriteSheet, palette)
                );
                // Use palettes[1] for astronaut, fallback to original if not present
                astronautSpriteSource = remappedSpriteSheets[1] || spriteSheet;

                // --- Calculate tightest collision bounding boxes at startup ---
                await calculateSpriteCollisionBoundingBoxes(
                    spriteSheet,
                    spriteMap,
                    mapBlocks,
                    doorEntities,
                    buttonEntities
                );

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
        } else {
            teleportLocations[teleportSlot] = { x: astronaut.position.x, y: astronaut.position.y };
        }
        teleportSlot = (teleportSlot + 1) % 6;
        // Play remember sound
        try { rememberSound.currentTime = 0; rememberSound.play(); } catch {}
    }
    if (keys['t'] && !prevKeys['t']) {
        let loc: TeleportLocation | null = null;
        if (teleportLocations.length > 0) {
            // Use the most recent (last) location
            loc = teleportLocations.pop()!;
            if (teleportSlot > teleportLocations.length) teleportSlot = teleportLocations.length;
        } else {
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
            try { teleportSound.currentTime = 0; teleportSound.play(); } catch {}
        }
    }

    // --- Draw twinkling stars ---
    // Use a fixed y cutoff for stars (700px)
    const tileHeight = 700;
    updateAndDrawStars(
        ctx!,
        camera,
        () => astronaut.position,
        canvas,
        tileHeight,
        MAP_HEIGHT
    );

    // --- Draw map blocks ---
    if (spriteSheet && spriteSheet.complete) {
        drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, doorEntities);
        drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE);
        drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, buttonEntities);
        drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureEntities);
        drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, collectableEntities);
    }

    // --- Controls: Upward and horizontal movement ---
    // Determine if walking should be allowed (block if button collision or door collision)
    let allowWalking = true;
    let collidedButton: Button | undefined = undefined;
    let collidedDoor: Door | undefined = undefined;
    let doorCollision: Door | undefined = undefined; // Track any door collision for opening

    if (gameState.astronaut.isLanded && walkSpeed > 0) {
        // Use astronaut's bounding box for collision
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, SPRITE_COL_STAND);
        const astroW = spriteRect.w * SPRITE_SCALE;
        const astroH = spriteRect.h * SPRITE_SCALE;
        let intendedX = gameState.astronaut.position.x;
        if (leftPressed) intendedX -= walkSpeed;
        if (rightPressed) intendedX += walkSpeed;
        let intendedY = gameState.astronaut.position.y;
        const astroLeft = intendedX - astroW / 2;
        const astroRight = intendedX + astroW / 2;
        const astroTop = intendedY - astroH / 2;
        const astroBottom = intendedY + astroH / 2;

        // Check for button collision
        for (const b of buttonEntities) {
            const tileW = 32 * SPRITE_SCALE;
            const tileH = 32 * SPRITE_SCALE;
            const btnLeft = b.x;
            const btnRight = b.x + tileW;
            const btnTop = b.y;
            const btnBottom = b.y + tileH;
            if (
                astroLeft < btnRight &&
                astroRight > btnLeft &&
                astroTop < btnBottom &&
                astroBottom > btnTop
            ) {
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
                if (
                    astroLeft < doorRight &&
                    astroRight > doorLeft &&
                    astroTop < doorBottom &&
                    astroBottom > doorTop
                ) {
                    collidedDoor = d;
                    doorCollision = d;
                    break;
                }
            }
        }
    } else {
        // Also check for door collision while flying or not walking
        // Use astronaut's bounding box at current position
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, SPRITE_COL_STAND);
        const astroW = spriteRect.w * SPRITE_SCALE;
        const astroH = spriteRect.h * SPRITE_SCALE;
        const astroLeft = gameState.astronaut.position.x - astroW / 2;
        const astroRight = gameState.astronaut.position.x + astroW / 2;
        const astroTop = gameState.astronaut.position.y - astroH / 2;
        const astroBottom = gameState.astronaut.position.y + astroH / 2;
        for (const d of doorEntities) {
            if (d.type === "door_horizontal" && !d.locked) {
                const tileW = 32 * SPRITE_SCALE;
                const tileH = 32 * SPRITE_SCALE;
                const doorLeft = d.x;
                const doorRight = d.x + tileW;
                const doorTop = d.y;
                const doorBottom = d.y + tileH;
                if (
                    astroLeft < doorRight &&
                    astroRight > doorLeft &&
                    astroTop < doorBottom &&
                    astroBottom > doorTop
                ) {
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
            try { buttonOnSound.currentTime = 0; buttonOnSound.play(); } catch {}
        }
    }

    // --- Door animation logic for walking ---
    // Open door if collided (landed or flying) and not already animating
    if (doorCollision && !doorCollision.animating) {
        doorCollision.animating = true;
        if (typeof (doorCollision as any)._originalX === "undefined") {
            (doorCollision as any)._originalX = doorCollision.x;
        }
        (doorCollision as any)._animationDirection = "open";
        (doorCollision as any)._animationTimer = 0;
        (doorCollision as any)._closeDelay = 0;
    }

    // --- Door animation update ---
    for (const door of doorEntities) {
        if (door.animating && door.type === "door_horizontal" && !door.locked) {
            // Initialize animation state if needed
            if (typeof (door as any)._originalX === "undefined") {
                (door as any)._originalX = door.x;
            }
            if (typeof (door as any)._animationDirection === "undefined") {
                (door as any)._animationDirection = "open";
            }
            if (typeof (door as any)._closeDelay === "undefined") {
                (door as any)._closeDelay = 0;
            }
            if (!('animationOffset' in door)) {
                (door as any).animationOffset = 0;
            }

            // Animate open (slide left)
            if ((door as any)._animationDirection === "open") {
                if ((door as any).animationOffset > -70) {
                    (door as any).animationOffset -= 1.5;
                    door.x = (door as any)._originalX + (door as any).animationOffset;
                    // Play door open sound at the start of opening
                    if ((door as any).animationOffset === -1.5) {
                        try { doorOpenSound.currentTime = 0; doorOpenSound.play(); } catch {}
                    }
                } else {
                    // Fully open, start close delay
                    (door as any)._animationDirection = "wait";
                    (door as any)._closeDelay = 0;
                }
            }
            // Wait before closing
            else if ((door as any)._animationDirection === "wait") {
                (door as any)._closeDelay += 1 / 60;
                if ((door as any)._closeDelay >= 2) { // 2 seconds
                    (door as any)._animationDirection = "close";
                }
            }
            // Animate close (slide right)
            else if ((door as any)._animationDirection === "close") {
                if ((door as any).animationOffset < 0) {
                    // Play door close sound at the start of closing
                    if ((door as any).animationOffset === -69) {
                        try { doorCloseSound.currentTime = 0; doorCloseSound.play(); } catch {}
                    }
                    (door as any).animationOffset += 1.5;
                    if ((door as any).animationOffset > 0) (door as any).animationOffset = 0;
                    door.x = (door as any)._originalX + (door as any).animationOffset;
                } else {
                    // Done closing
                    door.animating = false;
                    (door as any).animationOffset = 0;
                    door.x = (door as any)._originalX;
                    // Clean up animation state
                    delete (door as any)._animationDirection;
                    delete (door as any)._closeDelay;
                    delete (door as any)._originalX;
                }
            }
        }
    }

    // Clear all velocities if landed and not walking
    if (
        gameState.astronaut.isLanded &&
        walkSpeed === 0
    ) {
        astronaut.velocity.x = 0;
        astronaut.velocity.y = 0;
    }

    // Prevent diagonal takeoff: if landed and only up is pressed, clear horizontal velocity
    if (
        gameState.astronaut.isLanded &&
        upPressed &&
        !leftPressed &&
        !rightPressed
    ) {
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
    let hitType: 'side' | 'head' | null = null;
    let touchedDoor: Door | undefined = undefined;
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
    function checkButtonCollision(x: number, y: number, SPRITE_SCALE: number): Button | undefined {
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

    // Check vertical movement (feet and head)
    if (astronaut.velocity.y > 0) {
        // Moving down: check feet
        const blockBelow = getSolidBlockAtWorld(nextX, nextY + halfH, spriteMap, SPRITE_SCALE);
        // --- Button collision logging ---
        const btn = checkButtonCollision(nextX, nextY + halfH, SPRITE_SCALE);
        if (btn) {
            console.log(
                `Astronaut collided with button at (${btn.x},${btn.y}) while ${gameState.astronaut.isLanded ? "walking" : "flying"}`
            );
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
            } else if (spriteMap[blockBelow.type]) {
                rect = spriteMap[blockBelow.type];
            }
            // Use 32 * SPRITE_SCALE for tile height
            const tileH = 32 * SPRITE_SCALE;
            nextY = blockBelow.y - halfH;
            astronaut.velocity.y = 0;
            gameState.astronaut.isLanded = true;
            blockedY = true;
        }
    } else if (astronaut.velocity.y < 0) {
        // Moving up: check head
        const blockAbove = getSolidBlockAtWorld(nextX, nextY - halfH, spriteMap, SPRITE_SCALE);
        // --- Button collision logging ---
        const btn = checkButtonCollision(nextX, nextY - halfH, SPRITE_SCALE);
        if (btn) {
            console.log(
                `Astronaut collided with button at (${btn.x},${btn.y}) while ${gameState.astronaut.isLanded ? "walking" : "flying"}`
            );
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
            } else if (spriteMap[blockAbove.type]) {
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
            blockSide = getSolidBlockAtWorld(nextX + halfW, sideY1, spriteMap, SPRITE_SCALE) ||
                        getSolidBlockAtWorld(nextX + halfW, sideY2, spriteMap, SPRITE_SCALE);
            // --- Button collision logging ---
            const btn1 = checkButtonCollision(nextX + halfW, sideY1, SPRITE_SCALE);
            const btn2 = checkButtonCollision(nextX + halfW, sideY2, SPRITE_SCALE);
            if (btn1 || btn2) {
                const btn = btn1 ?? btn2;
                if (btn) {
                    console.log(
                        `Astronaut collided with button at (${btn.x},${btn.y}) while ${gameState.astronaut.isLanded ? "walking" : "flying"}`
                    );
                }
            }
            if (blockSide) {
                // --- Door animation logic ---
                if (
                    blockSide instanceof Door &&
                    blockSide.type === "door_horizontal" &&
                    !blockSide.locked &&
                    !blockSide.animating
                ) {
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
                } else if (spriteMap[blockSide.type]) {
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
        } else {
            // Moving left
            blockSide = getSolidBlockAtWorld(nextX - halfW, sideY1, spriteMap, SPRITE_SCALE) ||
                        getSolidBlockAtWorld(nextX - halfW, sideY2, spriteMap, SPRITE_SCALE);
            // --- Button collision logging ---
            const btn1 = checkButtonCollision(nextX - halfW, sideY1, SPRITE_SCALE);
            const btn2 = checkButtonCollision(nextX - halfW, sideY2, SPRITE_SCALE);
            if (btn1 || btn2) {
                const btn = btn1 ?? btn2;
                if (btn) {
                    console.log(
                        `Astronaut collided with button at (${btn.x},${btn.y}) while ${gameState.astronaut.isLanded ? "walking" : "flying"}`
                    );
                }
            }
            if (blockSide) {
                // --- Door animation logic ---
                if (
                    blockSide instanceof Door &&
                    blockSide.type === "door_horizontal" &&
                    !blockSide.locked &&
                    !blockSide.animating
                ) {
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
                } else if (spriteMap[blockSide.type]) {
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
            if (typeof (door as any)._originalX === "undefined") {
                (door as any)._originalX = door.x;
            }
            if (typeof (door as any)._animationDirection === "undefined") {
                (door as any)._animationDirection = "open";
            }
            if (typeof (door as any)._closeDelay === "undefined") {
                (door as any)._closeDelay = 0;
            }
            if (!('animationOffset' in door)) {
                (door as any).animationOffset = 0;
            }

            // Animate open (slide left)
            if ((door as any)._animationDirection === "open") {
                if ((door as any).animationOffset > -70) {
                    (door as any).animationOffset -= 1.5;
                    door.x = (door as any)._originalX + (door as any).animationOffset;
                    // Play door open sound at the start of opening
                    if ((door as any).animationOffset === -1.5) {
                        try { doorOpenSound.currentTime = 0; doorOpenSound.play(); } catch {}
                    }
                } else {
                    // Fully open, start close delay
                    (door as any)._animationDirection = "wait";
                    (door as any)._closeDelay = 0;
                }
            }
            // Wait before closing
            else if ((door as any)._animationDirection === "wait") {
                (door as any)._closeDelay += 1 / 60;
                if ((door as any)._closeDelay >= 2) { // 2 seconds
                    (door as any)._animationDirection = "close";
                }
            }
            // Animate close (slide right)
            else if ((door as any)._animationDirection === "close") {
                if ((door as any).animationOffset < 0) {
                    // Play door close sound at the start of closing
                    if ((door as any).animationOffset === -70) {
                        try { doorCloseSound.currentTime = 0; doorCloseSound.play(); } catch {}
                    }
                    (door as any).animationOffset += 1.5;
                    if ((door as any).animationOffset > 0) (door as any).animationOffset = 0;
                    door.x = (door as any)._originalX + (door as any).animationOffset;
                } else {
                    // Done closing
                    door.animating = false;
                    (door as any).animationOffset = 0;
                    door.x = (door as any)._originalX;
                    // Clean up animation state
                    delete (door as any)._animationDirection;
                    delete (door as any)._closeDelay;
                    delete (door as any)._originalX;
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
    updateAndDrawJetpackDots(ctx!, camera, MAP_HEIGHT);

    // --- Sprite selection logic (animation, flipping, flying, walking) ---
    // REMOVE this duplicate declaration:
    // let spriteCol = SPRITE_COL_STAND;
    // let flipSprite = facingLeft;
    // let flipVertical = false; // <-- add this

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
            `leftPressed: ${leftPressed} | rightPressed: ${rightPressed} | upPressed: ${upPressed} | downPressed: ${downPressed}`,
            10, debugY
        );
        debugY += 16;
        ctx!.fillText(
            `isLanded: ${gameState.astronaut.isLanded} | walkSpeed: ${walkSpeed.toFixed(2)} | spriteCol: ${spriteCol}`,
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
        debugY += 16;
        // --- Show block under mouse cursor with palette and rotation ---
        const block = getAnyBlockAtWorld(mouseWorld.x, mouseWorld.y, SPRITE_SCALE);
        if (block) {
            ctx!.fillText(
                `Block under cursor: ${block.type} (${block.x},${block.y}) palette: ${block.palette ?? 0} rotation: ${block.rotation ?? 0}` +
                (typeof block.locked !== "undefined" ? ` locked: ${block.locked}` : ""),
                10, debugY
            );
            // Extra: If it's a door, show palette_locked/palette_unlocked
            if (block.type && block.type.startsWith("door")) {
                ctx!.fillText(
                    `palette_locked: ${block.palette_locked} palette_unlocked: ${block.palette_unlocked}`,
                    10, debugY + 16
                );
                debugY += 16;
            }
        } else {
            ctx!.fillText(
                `Block under cursor: (none)`,
                10, debugY
            );
        }
        debugY += 16;
        ctx!.fillText(
            `Mouse world: (${mouseWorld.x.toFixed(1)}, ${mouseWorld.y.toFixed(1)})`,
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
    // --- Walking animation ---
    // Show walking animation if landed and walkSpeed > 0 (even if no keys are pressed)
    else if (
        gameState.astronaut.isLanded &&
        walkSpeed > 0
    ) {
        // Check if there is a block below the astronaut's feet
        const tileHDraw = 32; // Not used for block lookup
        const feetY = gameState.astronaut.position.y + tileHDraw / 2;
        // --- Use up-to-date door positions for collision ---
        const blockBelow = getSolidBlockAtWorld(
            gameState.astronaut.position.x,
            feetY + 1,
            spriteMap,
            SPRITE_SCALE
        );
        if (!blockBelow) {
            // No block below: set to flying
            gameState.astronaut.isLanded = false;
            gameState.astronaut.isFlying = true;
        } else {
            // Debug: Show walking branch taken (momentum or key)
            if (gameState.debugMode) {
                //console.log('WALKING: isLanded && walkSpeed > 0');
            }
            walkAnimTimer += 1 / 60;
            if (walkAnimTimer > 0.05) { // slower frame rate
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
        }
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
            //console.log('FLYING: !gameState.astronaut.isLanded && (keys[q] || keys[w])');
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
        ctx!.save();
        ctx!.translate(canvas.width / 2, canvas.height / 2);
        if (teleportFlipSprite) ctx!.scale(-1, 1);
        if (teleportFlipVertical) ctx!.scale(1, -1);

        // Render random bits of the sprite for a more "teleport" effect
        const totalBits = 32; // number of random bits per frame
        let visibleBits = totalBits;
        if (teleportPhase === 'out') {
            visibleBits = Math.max(2, Math.floor(totalBits * (1 - teleportAnimFrame / TELEPORT_ANIM_FRAMES)));
        } else if (teleportPhase === 'in') {
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
            ctx!.drawImage(
                spriteSheet,
                sx, sy, bitW, bitH,
                dx, dy, bitW * SPRITE_SCALE, bitH * SPRITE_SCALE
            );
        }
        ctx!.restore();
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
                const blockBelow = getSolidBlockAtWorld(
                    teleportTarget.x,
                    feetY + 1,
                    spriteMap,
                    SPRITE_SCALE
                );
                if (!blockBelow) {
                    astronaut.isLanded = false;
                    astronaut.isFlying = true;
                }
            }
            teleportPhase = 'in';
            teleportAnimFrame = 0;
        } else if (teleportPhase === 'in' && teleportAnimFrame >= TELEPORT_ANIM_FRAMES) {
            teleporting = false;
            teleportPhase = 'none';
            teleportTarget = null;
        }

        prevKeys = { ...keys };
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
        ctx!.save();
        ctx!.translate(canvas.width / 2, canvas.height / 2);
        if (flipSprite) ctx!.scale(-1, 1);
        if (flipVertical) ctx!.scale(1, -1);
        ctx!.drawImage(
            astronautSpriteSource || spriteSheet,
            spriteRect.x, spriteRect.y, SPRITE_W, SPRITE_H,
            -drawW / 2,
            -drawH / 2,
            drawW, drawH
        );
        ctx!.restore();
    }

    // --- Render trail (draw relative to camera) ---
    gameState.trail.forEach((dot: { x: number; y: number }) => {
        ctx!.fillStyle = 'black';
        ctx!.fillRect(dot.x - camera.x, dot.y - camera.y, 2, 2);
    });

    prevKeys = { ...keys };
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

/**
 * Remap the palette of a sprite image.
 * @param img The source image.
 * @param colorMap An array of {from: [r,g,b], to: [r,g,b]} mappings.
 * @returns A new HTMLCanvasElement with remapped colors.
 */
function remapSpritePalette(
    img: HTMLImageElement,
    colorMap: { from: [number, number, number], to: [number, number, number] }[]
): HTMLCanvasElement {
    // This function allows for any number of color mappings.
    // Each entry in colorMap will be applied to the image.
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        for (const { from, to } of colorMap) {
            if (
                data[i] === from[0] &&
                data[i + 1] === from[1] &&
                data[i + 2] === from[2]
            ) {
                data[i] = to[0];
                data[i + 1] = to[1];
                data[i + 2] = to[2];
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}

// Example usage after loading the sprite sheet:
// Replace pure red (255,0,0) with Magenta (143,0,255), and pure green (0,255,0) with white (255,255,255)
// const remappedCanvas = remapSpritePalette(spriteSheet, [
//     { from: [255, 0, 0], to: [143, 0, 255] },    // red -> Magenta
//     { from: [0, 255, 0], to: [255, 255, 255] }   // green -> white
// ]);
// Use remappedCanvas as your sprite source

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

// Utility: Get any block at world position (ignores collision)
function getAnyBlockAtWorld(
    x: number,
    y: number,
    SPRITE_SCALE: number
): any {
    x = Math.round(x);
    y = Math.round(y);
    // Check map blocks
    for (const b of mapBlocks) {
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;
        if (
            x >= b.x && x < b.x + tileW &&
            y >= b.y && y < b.y + tileH
        ) {
            return b;
        }
    }
    // Check doors
    for (const d of doorEntities) {
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;
        if (
            x >= d.x && x < d.x + tileW &&
            y >= d.y && y < d.y + tileH
        ) {
            return d;
        }
    }
    // Check buttons
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
    // Check creatures
    for (const c of creatureEntities) {
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;
        if (
            x >= c.x && x < c.x + tileW &&
            y >= c.y && y < c.y + tileH
        ) {
            return c;
        }
    }
    return undefined;
}

// Utility: Get any solid block (map, door, button) at world position
function getSolidBlockAtWorld(
    x: number,
    y: number,
    spriteMap: any,
    SPRITE_SCALE: number
): any {
    x = Math.round(x);
    y = Math.round(y);
    // Check map blocks
    for (const b of mapBlocks) {
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;
        if (
            x >= b.x && x < b.x + tileW &&
            y >= b.y && y < b.y + tileH
        ) {
            // Only treat as solid if collision is not explicitly false
            if (b.collision !== false) {
                return b;
            }
        }
    }
    // Check doors
    for (const d of doorEntities) {
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;
        if (
            x >= d.x && x < d.x + tileW &&
            y >= d.y && y < d.y + tileH
        ) {
            // Only collide if door is closed (assume open property)
            if (!d.open) return d;
        }
    }
    // Check buttons (treat as solid)
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

// --- After all assets are loaded, calculate tightest collision bounding boxes ---
// Now includes mapBlocks, doorEntities, and buttonEntities
async function calculateSpriteCollisionBoundingBoxes(
    spriteSheet: HTMLImageElement,
    spriteMap: any,
    mapBlocks: any[],
    doorEntities: any[],
    buttonEntities: any[]
) {
    // Gather all entities with collision = true
    const allEntities = [
        ...mapBlocks.filter(b => b.collision === true),
        ...doorEntities.filter(d => d.collision === true),
        ...buttonEntities.filter(b => b.collision === true)
    ];
    // Find all unique sprite types with collision = true
    const typesWithCollision = new Set(allEntities.map(e => e.type));
    const boundingBoxes: Record<string, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }> = {};

    // Helper to check if a pixel is transparent in the sprite sheet
    function isPixelTransparent(imgData: Uint8ClampedArray, imgW: number, x: number, y: number): boolean {
        const idx = (y * imgW + x) * 4;
        return imgData[idx + 3] === 0;
    }

    // Get image data once for efficiency
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = spriteSheet.width;
    tempCanvas.height = spriteSheet.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(spriteSheet, 0, 0);
    const imgData = tempCtx.getImageData(0, 0, spriteSheet.width, spriteSheet.height).data;

    for (const type of typesWithCollision) {
        // Find the sprite rect for this type
        let rect = null;
        if (spriteMap instanceof Array) {
            outer: for (let row = 0; row < spriteMap.length; row++) {
                for (let col = 0; col < spriteMap[row].length; col++) {
                    if (spriteMap[row][col].name === type) {
                        rect = spriteMap[row][col];
                        break outer;
                    }
                }
            }
        } else if (spriteMap[type]) {
            rect = spriteMap[type];
        }
        if (!rect) continue;

        let minX = rect.w, minY = rect.h, maxX = -1, maxY = -1;
        for (let y = 0; y < rect.h; y++) {
            for (let x = 0; x < rect.w; x++) {
                const sx = rect.x + x;
                const sy = rect.y + y;
                if (!isPixelTransparent(imgData, spriteSheet.width, sx, sy)) {
                    if (x < minX) minX = x;
                    if (y < minY) minY = y;
                    if (x > maxX) maxX = x;
                    if (y > maxY) maxY = y;
                }
            }
        }
        if (maxX >= minX && maxY >= minY) {
            boundingBoxes[type] = {
                minX, minY, maxX, maxY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            };
        }
    }
    console.log("Tightest collision bounding boxes for sprites with collision=true (map, doors, buttons):", boundingBoxes);
    return boundingBoxes;
}