// Main entry point for the astronaut game
import { Astronaut, GameState } from './types/index.js';
import {
    astronaut, resetAstronaut, handleAstronautMovement,
    walkSpeed, facingLeft, upPressed, downPressed, leftPressed, rightPressed,
    checkAstronautCollisions
} from './astronaut.js';
import { applyGravity } from './gravity.js';
import { mapBlocks, mapLoaded, loadMapBlocks, drawMap, getBlockAtWorld } from './map.js';
import { initStars, updateAndDrawStars } from './stars.js';
import { emitJetpackDots, updateAndDrawJetpackDots, resetJetpackDotEmitTimer } from './jetpack.js';
import { Button } from './button.js';
import { Door } from './door.js';
import { Creature } from './creature.js';
import { Collectable } from './collectable.js';
import { makeBlackTransparent, remapSpritePalette, calculateSpriteCollisionBoundingBoxes, 
    calculateAstronautSpriteBoundingBoxes, getSolidBlockAtWorld, getAnyBlockAtWorld, 
    drawEntities } from './utilities.js';
import {
    SPRITE_ROW, SPRITE_COL_STAND, SPRITE_COL_FLY_RIGHT, SPRITE_COL_FLY_DIAGONAL,
    SPRITE_COL_FLY_FLOAT, SPRITE_COL_FLY_DOWN, SPRITE_COL_WALK_START, SPRITE_COL_WALK_RIGHT1,
    SPRITE_COL_WALK_RIGHT2, SPRITE_COL_WALK_END, TELEPORT_ANIM_FRAMES, MAP_WIDTH, MAP_HEIGHT,
    SPRITE_SCALE, rememberSound, teleportSound, buttonOnSound, doorOpenSound, doorCloseSound, ouchSounds
} from './constants.js';

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
    debugMode: false
};

let spriteSheet: HTMLImageElement;
let astronautSpriteSource: CanvasImageSource; // Use this for astronaut rendering
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
let teleportPhase: 'none' | 'out' | 'in' = 'none';
let teleportTarget: TeleportLocation | null = null;
let teleportSpriteCol = SPRITE_COL_STAND;
let teleportFlipSprite = false;
let teleportFlipVertical = false;

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
                const boundingBoxes = await calculateSpriteCollisionBoundingBoxes(
                    spriteSheet,
                    spriteMap,
                    mapBlocks,
                    doorEntities,
                    buttonEntities
                );
                worldMapBoundingBoxes = boundingBoxes;

                // --- Calculate rotated bounding boxes for each type and rotation ---
                worldMapRotatedBoundingBoxes = {};
                for (const [type, bbox] of Object.entries(worldMapBoundingBoxes)) {
                    worldMapRotatedBoundingBoxes[type] = {};
                    for (let rot = 0; rot <= 7; rot++) {
                        // Compute rotated bounding box corners
                        const w = bbox.width;
                        const h = bbox.height;
                        // Corners relative to (0,0)
                        let corners = [
                            { x: bbox.minX, y: bbox.minY },
                            { x: bbox.maxX, y: bbox.minY },
                            { x: bbox.maxX, y: bbox.maxY },
                            { x: bbox.minX, y: bbox.maxY }
                        ];
                        // Center for rotation
                        const cx = bbox.minX + w / 2;
                        const cy = bbox.minY + h / 2;
                        let rotated: { x: number, y: number }[];
                        if (rot >= 1 && rot <= 4) {
                            // 1=90deg, 2=180deg, 3=270deg, 4=360deg
                            const angle = (rot - 1) * (Math.PI / 2);
                            rotated = corners.map(pt => {
                                const dx = pt.x - cx;
                                const dy = pt.y - cy;
                                return {
                                    x: cx + dx * Math.cos(angle) - dy * Math.sin(angle),
                                    y: cy + dx * Math.sin(angle) + dy * Math.cos(angle)
                                };
                            });
                        } else if (rot === 5) {
                            // flip X
                            rotated = corners.map(pt => ({ x: 2 * cx - pt.x, y: pt.y }));
                        } else if (rot === 6) {
                            // flip Y
                            rotated = corners.map(pt => ({ x: pt.x, y: 2 * cy - pt.y }));
                        } else if (rot === 7) {
                            // flip X and Y
                            rotated = corners.map(pt => ({ x: 2 * cx - pt.x, y: 2 * cy - pt.y }));
                        } else {
                            // rot == 0, no rotation
                            rotated = corners;
                        }
                        const xs = rotated.map(pt => pt.x);
                        const ys = rotated.map(pt => pt.y);
                        const minX = Math.min(...xs);
                        const maxX = Math.max(...xs);
                        const minY = Math.min(...ys);
                        const maxY = Math.max(...ys);
                        worldMapRotatedBoundingBoxes[type][rot] = {
                            minX,
                            minY,
                            maxX,
                            maxY,
                            width: maxX - minX + 1,
                            height: maxY - minY + 1
                        };
                    }
                }

                // --- Store rotated bounding boxes for each block instance ---
                // Helper to assign bounding box for a list of entities/blocks
                function assignRotatedBoundingBoxes(arr: any[]) {
                    for (const entity of arr) {
                        const type = entity.type;
                        // Default to 0 if not present
                        const rotation = typeof entity.rotation === "number" ? entity.rotation : 0;
                        let bbox =
                            (worldMapRotatedBoundingBoxes[type] && worldMapRotatedBoundingBoxes[type][rotation]) ||
                            worldMapBoundingBoxes[type];
                        // Fallback to default rect if not found
                        if (!bbox) {
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
                            if (rect) {
                                bbox = {
                                    minX: 0,
                                    minY: 0,
                                    maxX: rect.w - 1,
                                    maxY: rect.h - 1,
                                    width: rect.w,
                                    height: rect.h
                                };
                            }
                        }
                        if (bbox) {
                            blockInstanceRotatedBoundingBoxes.set(entity, bbox);
                        }
                    }
                }
                assignRotatedBoundingBoxes(mapBlocks);
                assignRotatedBoundingBoxes(doorEntities);
                assignRotatedBoundingBoxes(buttonEntities);
                assignRotatedBoundingBoxes(creatureEntities);
                assignRotatedBoundingBoxes(collectableEntities);

                // --- Calculate astronaut sprite bounding boxes at startup ---
                astronautBoundingBoxes = await calculateAstronautSpriteBoundingBoxes(
                    spriteSheet,
                    spriteMap
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
        // Use astronaut's tightest bounding box for collision
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, SPRITE_COL_STAND);
        const bbox = astronautBoundingBoxes["stand"] || { minX: 0, minY: 0, maxX: spriteRect.w - 1, maxY: spriteRect.h - 1, width: spriteRect.w, height: spriteRect.h };
        const astroW = bbox.width * SPRITE_SCALE;
        const astroH = bbox.height * SPRITE_SCALE;
        let intendedX = gameState.astronaut.position.x;
        if (leftPressed) intendedX -= walkSpeed;
        if (rightPressed) intendedX += walkSpeed;
        let intendedY = gameState.astronaut.position.y;

        // --- Rotation-aware bounding box calculation ---
        // Assume astronaut.rotation is 0 (no rotation) unless you have a rotation property.
        // If you have a rotation property, use it here. For now, we use 0.
        const rotation = (gameState.astronaut as any).rotation || 0;

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
        // Use astronaut's tightest bounding box at current position
        const spriteRect = getSpriteRectFromMap(SPRITE_ROW, SPRITE_COL_STAND);
        const bbox = astronautBoundingBoxes["stand"] || { minX: 0, minY: 0, maxX: spriteRect.w - 1, maxY: spriteRect.h - 1, width: spriteRect.w, height: spriteRect.h };
        const astroW = bbox.width * SPRITE_SCALE;
        const astroH = bbox.height * SPRITE_SCALE;
        // --- Rotation-aware bounding box calculation for flying ---
        const rotation = (gameState.astronaut as any).rotation || 0;
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
        door.updateAnimation(doorOpenSound, doorCloseSound);
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
    if (!gameState.astronaut.isLanded) {
        nextX += astronaut.velocity.x;
        nextY += astronaut.velocity.y;
    }

    checkAstronautCollisions(buttonEntities, spriteMap, SPRITE_SCALE, mapBlocks, doorEntities, nextX, nextY, gameState);

    // --- Door animation update ---
    for (const door of doorEntities) {
        door.updateAnimation(doorOpenSound, doorCloseSound);
    }

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
        const block = getAnyBlockAtWorld(mouseWorld.x, mouseWorld.y, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities, creatureEntities);
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
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
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
                    SPRITE_SCALE,
                    mapBlocks,
                    doorEntities,
                    buttonEntities
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

        // --- Draw tight bounding box for astronaut (with transforms) ---
        if (showTightBoundingBoxes) {
            let spriteName = spriteRect.name;
            if (!astronautBoundingBoxes[spriteName]) {
                const colToName: Record<number, string> = {
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
                ctx!.save();
                ctx!.strokeStyle = 'red';
                ctx!.lineWidth = 2;
                // The context is already translated and scaled as for the sprite.
                const scale = SPRITE_SCALE;
                const x = -drawW / 2 + bbox.minX * scale;
                const y = -drawH / 2 + bbox.minY * scale;
                const w = bbox.width * scale;
                const h = bbox.height * scale;
                ctx!.strokeRect(x, y, w, h);
                ctx!.restore();
            }
        }
        ctx!.restore();

        // --- Draw tight bounding boxes for world map sprites with collision ---
        if (showTightBoundingBoxes && spriteSheet && spriteSheet.complete) {
            // Draw for mapBlocks, doorEntities, buttonEntities with collision=true
            const drawBBox = (entity: any) => {
                if (!entity.collision) return;
                // Use precomputed bounding box for this instance
                let bbox = blockInstanceRotatedBoundingBoxes.get(entity);
                // Fallback if not found
                if (!bbox) {
                    let type = entity.type;
                    let rotation = typeof entity.rotation === "number" ? entity.rotation : 0;
                    bbox =
                        (worldMapRotatedBoundingBoxes[type] && worldMapRotatedBoundingBoxes[type][rotation]) ||
                        worldMapBoundingBoxes[type];
                }
                if (!bbox) return;
                const scale = SPRITE_SCALE;
                const tileW = 32 * scale;
                const tileH = 32 * scale;
                ctx!.save();
                // Center of the sprite
                const drawX = entity.x - camera.x + tileW / 2;
                const drawY = entity.y - camera.y + tileH / 2;
                ctx!.translate(drawX, drawY);
                // Apply rotation if present
                if (entity.rotation) {
                    if (entity.rotation >= 1 && entity.rotation <= 4) {
                        ctx!.rotate(((entity.rotation - 1) * Math.PI) / 2);
                    } else if (entity.rotation === 5) {
                        ctx!.scale(-1, 1);
                    } else if (entity.rotation === 6) {
                        ctx!.scale(1, -1);
                    } else if (entity.rotation === 7) {
                        ctx!.scale(-1, -1);
                    }
                }
                ctx!.strokeStyle = 'red';
                ctx!.lineWidth = 2;
                // Draw bbox relative to sprite center
                const x = -tileW / 2 + bbox.minX * scale;
                const y = -tileH / 2 + bbox.minY * scale;
                const w = bbox.width * scale;
                const h = bbox.height * scale;
                ctx!.strokeRect(x, y, w, h);
                ctx!.restore();
            };
            mapBlocks.forEach(drawBBox);
            doorEntities.forEach(drawBBox);
            buttonEntities.forEach(drawBBox);
        }
    }

    prevKeys = { ...keys };
    requestAnimationFrame(gameLoop);
}

// --- Bounding boxes for astronaut sprites (populated after calculation) ---
let astronautBoundingBoxes: Record<string, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }> = {};
// --- Bounding boxes for world map sprites (populated after calculation) ---
let worldMapBoundingBoxes: Record<string, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }> = {};
// --- Rotated bounding boxes for world map sprites (by type and rotation) ---
let worldMapRotatedBoundingBoxes: Record<string, Record<number, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }>> = {};
// --- Rotated bounding boxes for each block instance (populated after map/entities load) ---
let blockInstanceRotatedBoundingBoxes: WeakMap<object, { minX: number, minY: number, maxX: number, maxY: number, width: number, height: number }> = new WeakMap();

// --- Show tight bounding boxes toggle ---
let showTightBoundingBoxes = false;
window.addEventListener('keydown', (e) => {
    if (e.key === 'b') showTightBoundingBoxes = !showTightBoundingBoxes;
    if (e.key === 'd') gameState.debugMode = !gameState.debugMode;
});