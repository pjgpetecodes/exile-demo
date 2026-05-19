// Main entry point for the astronaut game
import { Astronaut, GameState, Position } from './types/index.js';
import {
    astronaut, resetAstronaut, flipAstronaut, handleAstronautMovement, applyLandingMomentum, getAstronautCollisionOffsets, setAstronautCollisionProfile,
    getAstronautStartPosition, setAstronautStartPosition,
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
import { MOVEMENT_SETTINGS } from './settings.js';
import {
    SPRITE_ROW, SPRITE_COL_STAND, SPRITE_COL_FLY_RIGHT, SPRITE_COL_FLY_DIAGONAL,
    SPRITE_COL_FLY_FLOAT, SPRITE_COL_FLY_DOWN, SPRITE_COL_WALK_START, SPRITE_COL_WALK_RIGHT1,
    SPRITE_COL_WALK_RIGHT2, SPRITE_COL_WALK_END, TELEPORT_ANIM_FRAMES, MAP_WIDTH, MAP_HEIGHT,
    SPRITE_SCALE, rememberSound, teleportSound, buttonOnSound, doorOpenSound, doorCloseSound, getSound, saveSound, ouchSounds
} from './constants.js';
import { createWorldDesigner, LayerVisibility, RawWorldData, SpriteCatalogEntry, WorldDesigner } from './world-designer.js';

// Instead of dynamic import, fetch the JSON file at runtime for browser compatibility
let spriteMap: any;

async function loadSpriteMap() {
    const res = await fetch('./src/assets/exile_sprites_map.json');
    spriteMap = await res.json();
}

let palettes: any[] = [];
let remappedSpriteSheets: CanvasImageSource[] = [];
let colorAliases: Record<string, [number, number, number]> = {};

async function fetchFreshJson<T>(url: string): Promise<T> {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

async function loadColorAliases() {
    if (Object.keys(colorAliases).length > 0) return;
    colorAliases = await fetchFreshJson('./src/assets/colors.json');
}

function resolveColor(color: string | [number, number, number]): [number, number, number] {
    if (typeof color === "string") {
        return colorAliases[color] || [0, 0, 0];
    }
    return color;
}

async function loadPalettes() {
    await loadColorAliases();
    const rawPalettes = await fetchFreshJson<any[]>('./src/assets/palettes.json');
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

window.addEventListener('keydown', (e) => {
    if (e.key === "Tab") {
        e.preventDefault(); // Prevent tab from bubbling to browser
        flipAstronaut();
    }
});

// --- Camera ---
function getCameraOffset() {
    if (worldDesigner?.isActive()) {
        return worldDesigner.getCamera();
    }
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
    gravity: MOVEMENT_SETTINGS.gravity,
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

// --- Black background block toggles ---
let showBlackBackgroundBlocks = false; // c key
let hideBlackBackgroundBlocks = false; // v key

window.addEventListener('keydown', (e) => {
    if (e.key === 'c' && !prevKeys['c']) {
        showBlackBackgroundBlocks = !showBlackBackgroundBlocks;
    }
    if (e.key === 'v' && !prevKeys['v']) {
        hideBlackBackgroundBlocks = !hideBlackBackgroundBlocks;
    }
});

// --- Entity arrays ---
let buttonEntities: Button[] = [];
let doorEntities: Door[] = [];
let creatureEntities: Creature[] = [];
let collectableEntities: Collectable[] = [];
let heldCollectable: Collectable | null = null;
let storedCollectables: Collectable[] = [];
let inventoryCycleIndex = -1;
let throwAngleDegrees = 20;
type ThrowGuideDot = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
    hueDrift: number;
    flickerOffset: number;
};
let throwGuideDots: ThrowGuideDot[] = [];
let throwGuideDotEmitTimer = 0;
let worldDesigner: WorldDesigner | null = null;
const STARFIELD_HEIGHT = Math.min(MAP_HEIGHT, 2000);

function getCurrentAstronautCollisionProfile() {
    if (astronaut.isLanded) {
        return 'stand';
    }

    if (downPressed && (leftPressed || rightPressed)) {
        return 'fly_down';
    }
    if (leftPressed || rightPressed) {
        return upPressed ? 'fly_diagonal' : 'fly_right';
    }
    if (Math.abs(astronaut.velocity.x) > 0.01) {
        return 'fly_float';
    }

    return upPressed ? 'fly_diagonal' : 'fly_float';
}

// --- Button press debounce state ---
const buttonPressTimestamps: WeakMap<Button, number> = new WeakMap();

// --- Entity loaders ---
export let nextEntityId = 1;
export function assignEntityId(obj: any) {
    obj.entityId = nextEntityId++;
    return obj;
}

async function loadButtons() {
    const arr = await fetchFreshJson<any[]>('./src/assets/buttons.json');
    buttonEntities = arr.map((data: any) => assignEntityId(new Button(data)));
    syncButtonStatesToDoors();
}

function syncButtonStatesToDoors() {
    for (const button of buttonEntities) {
        if (!Array.isArray(button.linkedDoors) || button.linkedDoors.length === 0) {
            continue;
        }

        button.active = button.linkedDoors.some((doorID) =>
            doorEntities.some((door) => door.doorID === doorID && door.locked)
        );
    }
}
async function loadDoors() {
    const arr = await fetchFreshJson<any[]>('./src/assets/doors.json');
    doorEntities = arr.map((data: any) => assignEntityId(new Door(data)));
}
async function loadCreatures() {
    const arr = await fetchFreshJson<any[]>('./src/assets/creatures.json');
    creatureEntities = arr.map((data: any) => assignEntityId(new Creature(data)));
}
async function loadCollectables() {
    const arr = await fetchFreshJson<any[]>('./src/assets/collectables.json');
    collectableEntities = arr.map((data: any) => assignEntityId(new Collectable(data)));
    syncCollectableRuntimeState();
}

async function loadAstronautStartPosition() {
    const data = await fetchFreshJson<Position>('./src/assets/astronaut_start.json');
    setAstronautStartPosition(data, true);
}

function syncCollectableRuntimeState() {
    storedCollectables = collectableEntities.filter(collectable => collectable.stored);
    heldCollectable = collectableEntities.find(collectable => collectable.held) ?? null;
    inventoryCycleIndex = storedCollectables.length > 0 ? storedCollectables.length - 1 : -1;
}

function findSpriteRectByType(type: string) {
    if (!spriteMap) return null;
    if (spriteMap instanceof Array) {
        for (const row of spriteMap) {
            for (const sprite of row) {
                if (sprite.name === type) {
                    return sprite;
                }
            }
        }
        return null;
    }
    return spriteMap[type] || null;
}

function assignRotatedBoundingBoxes(arr: any[]) {
    for (const entity of arr) {
        const type = entity.type;
        const rotation = typeof entity.rotation === "number" ? entity.rotation : 0;
        let bbox =
            (worldMapRotatedBoundingBoxes[type] && worldMapRotatedBoundingBoxes[type][rotation]) ||
            worldMapBoundingBoxes[type];
        if (!bbox) {
            const rect = findSpriteRectByType(type);
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

function rebuildBlockInstanceBoundingBoxes() {
    blockInstanceRotatedBoundingBoxes = new WeakMap();
    assignRotatedBoundingBoxes(mapBlocks);
    assignRotatedBoundingBoxes(doorEntities);
    assignRotatedBoundingBoxes(buttonEntities);
    assignRotatedBoundingBoxes(creatureEntities);
    assignRotatedBoundingBoxes(collectableEntities);
}

function afterWorldDataMutated() {
    syncButtonStatesToDoors();
    syncCollectableRuntimeState();
    rebuildBlockInstanceBoundingBoxes();
}

function clampCamera(camera: Position) {
    return {
        x: Math.max(0, Math.min(camera.x, Math.max(0, MAP_WIDTH - canvas.width))),
        y: Math.max(0, Math.min(camera.y, Math.max(0, MAP_HEIGHT - canvas.height)))
    };
}

function drawWorldBoundingBoxOverlay(
    context: CanvasRenderingContext2D,
    camera: Position,
    layerVisibility: LayerVisibility = {
        world: true,
        buttons: true,
        doors: true,
        creatures: true,
        collectables: true
    }
) {
    context.save();
    context.strokeStyle = 'lime';
    context.lineWidth = 2;

    const drawWorldBBox = (entity: any) => {
        if (!entity.collision) return;
        const bbox = blockInstanceRotatedBoundingBoxes.get(entity);
        if (!bbox) return;
        const scale = SPRITE_SCALE;
        const tileW = 32 * scale;
        const tileH = 32 * scale;
        const drawX = entity.x - camera.x + tileW / 2;
        const drawY = entity.y - camera.y + tileH / 2;
        context.save();
        context.translate(drawX, drawY);
        if (entity.rotation) {
            if (entity.rotation >= 1 && entity.rotation <= 4) {
                context.rotate(((entity.rotation - 1) * Math.PI) / 2);
            } else if (entity.rotation === 5) {
                context.scale(-1, 1);
            } else if (entity.rotation === 6) {
                context.scale(1, -1);
            } else if (entity.rotation === 7) {
                context.scale(-1, -1);
            }
        }
        const x = -tileW / 2 + bbox.minX * scale;
        const y = -tileH / 2 + bbox.minY * scale;
        const w = bbox.width * scale;
        const h = bbox.height * scale;
        context.strokeRect(x, y, w, h);
        context.restore();
    };

    const mapBlocksToDraw = !layerVisibility.world
        ? []
        : hideBlackBackgroundBlocks
            ? mapBlocks.filter((b) => b.type !== 'black_background')
            : mapBlocks;
    mapBlocksToDraw.forEach(drawWorldBBox);
    if (layerVisibility.doors) doorEntities.forEach(drawWorldBBox);
    if (layerVisibility.buttons) buttonEntities.forEach(drawWorldBBox);
    if (layerVisibility.creatures) creatureEntities.forEach(drawWorldBBox);
    if (layerVisibility.collectables) {
        collectableEntities
            .filter((collectable) => !collectable.stored && !collectable.collected)
            .forEach(drawWorldBBox);
    }
    context.restore();
}

function getRawWorldData(): RawWorldData {
    return {
        worldMap: mapBlocks as RawWorldData['worldMap'],
        buttons: buttonEntities as RawWorldData['buttons'],
        doors: doorEntities as RawWorldData['doors'],
        creatures: creatureEntities as RawWorldData['creatures'],
        collectables: collectableEntities as RawWorldData['collectables'],
        astronautStart: getAstronautStartPosition()
    };
}

function replaceRawWorldData(data: RawWorldData) {
    mapBlocks.splice(0, mapBlocks.length, ...data.worldMap.map((block) => assignEntityId({ ...block })));
    doorEntities = data.doors.map((door) => assignEntityId(new Door(door)));
    buttonEntities = data.buttons.map((button) => assignEntityId(new Button(button)));
    creatureEntities = data.creatures.map((creature) => assignEntityId(new Creature(creature)));
    collectableEntities = data.collectables.map((collectable) => assignEntityId(new Collectable(collectable)));
    setAstronautStartPosition(data.astronautStart, true);
    afterWorldDataMutated();
}

function getSpriteTypes() {
    if (!spriteMap) return [];
    if (spriteMap instanceof Array) {
        return spriteMap.flat().map((entry: any) => entry.name).filter(Boolean);
    }
    return Object.keys(spriteMap);
}

function getSpriteCatalog(): SpriteCatalogEntry[] {
    if (!spriteMap) return [];
    if (spriteMap instanceof Array) {
        return spriteMap.flat()
            .filter((entry: any) => entry?.name)
            .map((entry: any) => ({
                name: entry.name,
                palette: typeof entry.palette === 'number' ? entry.palette : 0
            }));
    }
    return Object.entries(spriteMap).map(([name, entry]: [string, any]) => ({
        name,
        palette: typeof entry?.palette === 'number' ? entry.palette : 0
    }));
}

function drawSpritePreview(
    context: CanvasRenderingContext2D,
    type: string,
    palette: number,
    rotation: number = 1,
    clearFirst: boolean = true,
    targetSize?: number
) {
    const rect = findSpriteRectByType(type);
    if (!rect || remappedSpriteSheets.length === 0) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }

    const paletteIndex = Number.isFinite(palette) && palette >= 0 && palette < remappedSpriteSheets.length
        ? palette
        : (typeof rect.palette === 'number' ? rect.palette : 0);
    const sheet = remappedSpriteSheets[paletteIndex] || remappedSpriteSheets[0];
    if (!sheet) {
        if (clearFirst) {
            context.clearRect(0, 0, context.canvas.width, context.canvas.height);
        }
        return false;
    }

    const padding = 8;
    const previewWidth = targetSize ?? context.canvas.width;
    const previewHeight = targetSize ?? context.canvas.height;
    const maxWidth = Math.max(1, previewWidth - padding * 2);
    const maxHeight = Math.max(1, previewHeight - padding * 2);
    const scale = Math.max(1, Math.min(
        maxWidth / rect.w,
        maxHeight / rect.h
    ));
    const drawW = rect.w * scale;
    const drawH = rect.h * scale;

    context.save();
    if (clearFirst) {
        context.clearRect(0, 0, context.canvas.width, context.canvas.height);
    }
    context.imageSmoothingEnabled = false;
    context.translate(context.canvas.width / 2, context.canvas.height / 2);
    if (rotation >= 1 && rotation <= 4) {
        context.rotate(((rotation - 1) * Math.PI) / 2);
    } else if (rotation === 5) {
        context.scale(-1, 1);
    } else if (rotation === 6) {
        context.scale(1, -1);
    } else if (rotation === 7) {
        context.scale(-1, -1);
    }
    context.drawImage(
        sheet,
        rect.x,
        rect.y,
        rect.w,
        rect.h,
        -drawW / 2,
        -drawH / 2,
        drawW,
        drawH
    );
    context.restore();
    return true;
}

async function saveWorldData(data: RawWorldData) {
    const res = await fetch('http://localhost:3001/save-world-data', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const payload = await res.text();
        throw new Error(payload || 'Failed to save world data.');
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
    await loadAstronautStartPosition();
    initStars(MAP_WIDTH, STARFIELD_HEIGHT);
    const img = new Image();
    img.src = './src/assets/sprite_sheet.png';
    img.onload = () => {
        makeBlackTransparent(img, async (canvasWithTransparency) => {
            spriteSheet = new Image();
            spriteSheet.src = canvasWithTransparency.toDataURL();
            spriteSheet.onload = async () => {
                // Make spriteSheet globally accessible for pixel-perfect collision
                (window as any).spriteSheet = spriteSheet;
                // Also create and store a 2D context for pixel access
                const tempCanvas = document.createElement('canvas');
                tempCanvas.width = spriteSheet.width;
                tempCanvas.height = spriteSheet.height;
                const tempCtx = tempCanvas.getContext('2d');
                tempCtx!.drawImage(spriteSheet, 0, 0);
                (window as any)._spriteSheetCtx = tempCtx;
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
                    buttonEntities,
                    creatureEntities,
                    collectableEntities
                );
                worldMapBoundingBoxes = boundingBoxes;

                // --- Calculate rotated bounding boxes for each type and rotation ---
                worldMapRotatedBoundingBoxes = {};
                const getSpriteRectForType = (type: string) => {
                    if (spriteMap instanceof Array) {
                        for (const row of spriteMap) {
                            for (const sprite of row) {
                                if (sprite.name === type) {
                                    return sprite;
                                }
                            }
                        }
                        return null;
                    }
                    return spriteMap[type] || null;
                };
                for (const [type, bbox] of Object.entries(worldMapBoundingBoxes)) {
                    const spriteRect = getSpriteRectForType(type);
                    if (!spriteRect) {
                        continue;
                    }
                    worldMapRotatedBoundingBoxes[type] = {};
                    for (let rot = 0; rot <= 7; rot++) {
                        // Corners relative to (0,0)
                        let corners = [
                            { x: bbox.minX, y: bbox.minY },
                            { x: bbox.maxX, y: bbox.minY },
                            { x: bbox.maxX, y: bbox.maxY },
                            { x: bbox.minX, y: bbox.maxY }
                        ];
                        // Match draw-time transforms by rotating/flipping around the full sprite center.
                        const cx = (spriteRect.w - 1) / 2;
                        const cy = (spriteRect.h - 1) / 2;
                        let rotated: { x: number, y: number }[];
                        if (rot >= 1 && rot <= 4) {
                            const angle = (rot - 1) * (Math.PI / 2);
                            rotated = corners.map(pt => {
                                const dx = pt.x - cx;
                                const dy = pt.y - cy;
                                return {
                                    x: Math.round(cx + dx * Math.cos(angle) - dy * Math.sin(angle)),
                                    y: Math.round(cy + dx * Math.sin(angle) + dy * Math.cos(angle))
                                };
                            });
                        } else if (rot === 5) {
                            // flip X
                            rotated = corners.map(pt => ({ x: Math.round(2 * cx - pt.x), y: pt.y }));
                        } else if (rot === 6) {
                            // flip Y
                            rotated = corners.map(pt => ({ x: pt.x, y: Math.round(2 * cy - pt.y) }));
                        } else if (rot === 7) {
                            // flip X and Y
                            rotated = corners.map(pt => ({ x: Math.round(2 * cx - pt.x), y: Math.round(2 * cy - pt.y) }));
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

                rebuildBlockInstanceBoundingBoxes();

                // --- Calculate astronaut sprite bounding boxes at startup ---
                astronautBoundingBoxes = await calculateAstronautSpriteBoundingBoxes(
                    spriteSheet,
                    spriteMap
                );
                worldDesigner = createWorldDesigner({
                    canvas,
                    getRawWorldData,
                    replaceRawWorldData,
                    afterWorldDataMutated,
                    getFocusWorldPosition: () => ({
                        x: astronaut.position.x,
                        y: astronaut.position.y
                    }),
                    setAstronautStartPosition,
                    getShowSpriteOutlines: () => showWorldBoundingBoxes,
                    setShowSpriteOutlines: (value: boolean) => {
                        showWorldBoundingBoxes = value;
                    },
                    drawSpriteOutlineOverlay: drawWorldBoundingBoxOverlay,
                    getSpriteTypes,
                    getSpriteCatalog,
                    drawSpritePreview,
                    getPaletteCount: () => Math.max(remappedSpriteSheets.length, palettes.length, 1),
                    clampCamera,
                    saveWorldData
                });
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

function drawAstronautInWorld(
    context: CanvasRenderingContext2D,
    camera: Position,
    spriteCol: number,
    flipSprite: boolean,
    flipVertical: boolean
) {
    if (!(astronautSpriteSource || spriteSheet) || !(spriteSheet && spriteSheet.complete)) {
        return;
    }

    const spriteRect = getSpriteRectFromMap(SPRITE_ROW, spriteCol);
    const drawW = 32 * SPRITE_SCALE;
    const drawH = 32 * SPRITE_SCALE;

    context.save();
    context.translate(
        astronaut.position.x - camera.x,
        astronaut.position.y - camera.y
    );
    if (flipSprite) context.scale(-1, 1);
    if (flipVertical) context.scale(1, -1);
    context.drawImage(
        astronautSpriteSource || spriteSheet,
        spriteRect.x, spriteRect.y, spriteRect.w, spriteRect.h,
        -drawW / 2,
        -drawH / 2,
        drawW, drawH
    );
    context.restore();
}

// When drawing the sprite, ensure the canvas is cleared with a transparent background
async function gameLoop() {
    if (!gameState.isRunning || !mapLoaded) return;

    ctx!.imageSmoothingEnabled = false;
    ctx!.clearRect(0, 0, canvas.width, canvas.height);

    const camera = getCameraOffset();

    // Update mouse world position
    mouseWorld.x = Math.round(mouseScreen.x + camera.x);
    mouseWorld.y = Math.round(mouseScreen.y + camera.y);

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
    updateAndDrawStars(
        ctx!,
        camera,
        canvas,
        MAP_WIDTH,
        STARFIELD_HEIGHT
    );

    // --- Draw map blocks ---
    const layerVisibility = worldDesigner?.isActive()
        ? worldDesigner.getLayerVisibility()
        : {
            world: true,
            buttons: true,
            doors: true,
            creatures: true,
            collectables: true
        };
    if (spriteSheet && spriteSheet.complete) {
        if (layerVisibility.doors) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, doorEntities);
        }
        // Use a filtered array for drawing if hiding black_background blocks
        const mapBlocksToDraw = !layerVisibility.world
            ? []
            : hideBlackBackgroundBlocks
                ? mapBlocks.filter(b => b.type !== 'black_background')
                : mapBlocks;
        // Draw map blocks (replace mapBlocks with mapBlocksToDraw in overlays below as well)
        // Patch: temporarily override mapBlocks for drawMap by monkey-patching global (not ideal, but drawMap uses global)
        // Instead, draw overlays and highlights using mapBlocksToDraw, but call drawMap as usual
        // --- Draw overlays and highlights using mapBlocksToDraw ---
        // --- Highlight all black_background blocks if enabled ---
        if (showBlackBackgroundBlocks) {
            ctx!.save();
            ctx!.strokeStyle = 'cyan';
            ctx!.lineWidth = 2;
            for (const block of mapBlocksToDraw) {
                if (block.type === 'black_background') {
                    const bbox = blockInstanceRotatedBoundingBoxes.get(block);
                    const scale = SPRITE_SCALE;
                    const tileW = 32 * scale;
                    const tileH = 32 * scale;
                    // Center of the sprite
                    const drawX = block.x - camera.x + tileW / 2;
                    const drawY = block.y - camera.y + tileH / 2;
                    ctx!.save();
                    ctx!.translate(drawX, drawY);
                    // Apply rotation if present
                    if (block.rotation) {
                        if (block.rotation >= 1 && block.rotation <= 4) {
                            ctx!.rotate(((block.rotation - 1) * Math.PI) / 2);
                        } else if (block.rotation === 5) {
                            ctx!.scale(-1, 1);
                        } else if (block.rotation === 6) {
                            ctx!.scale(1, -1);
                        } else if (block.rotation === 7) {
                            ctx!.scale(-1, -1);
                        }
                    }
                    // Draw bbox relative to sprite center
                    if (bbox) {
                        const x = -tileW / 2 + bbox.minX * scale;
                        const y = -tileH / 2 + bbox.minY * scale;
                        const w = bbox.width * scale;
                        const h = bbox.height * scale;
                        ctx!.strokeRect(x, y, w, h);
                    } else {
                        // fallback: draw full tile
                        ctx!.strokeRect(-tileW / 2, -tileH / 2, tileW, tileH);
                    }
                    ctx!.restore();
                }
            }
            ctx!.restore();
        }
        // Draw map blocks (drawMap uses global mapBlocks, so black_background blocks will be hidden only if not present in mapBlocks)
        // To hide, we need to patch drawMap to accept a blocks array, or temporarily monkey-patch global. For now, just draw overlays using mapBlocksToDraw.
        drawMap(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, mapBlocksToDraw);
        if (layerVisibility.buttons) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, buttonEntities);
        }
        if (layerVisibility.creatures) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, creatureEntities);
        }
        if (layerVisibility.collectables) {
            drawEntities(
                ctx!,
                camera,
                spriteMap,
                remappedSpriteSheets,
                SPRITE_SCALE,
                collectableEntities.filter(collectable => !collectable.stored && !collectable.held && !collectable.collected)
            );
        }
    }

    if (worldDesigner?.isActive()) {
        drawAstronautInWorld(ctx!, camera, spriteCol, flipSprite, flipVertical);
        if (heldCollectable) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, [heldCollectable]);
        }
        worldDesigner.render(ctx!);
        prevKeys = { ...keys };
        requestAnimationFrame(gameLoop);
        return;
    }

    // --- Controls: Upward and horizontal movement ---
    const movementStartX = gameState.astronaut.position.x;
    const movementStartY = gameState.astronaut.position.y;
    const movementModifiers = getHeldMovementModifiers();
    handleAstronautMovement(keys, true, {
        walkSpeedScale: movementModifiers.walkSpeedScale,
        flightControlScale: movementModifiers.flightControlScale
    });
    const movementTargetX = astronaut.position.x;
    const movementTargetY = astronaut.position.y;
    astronaut.position.x = movementStartX;
    astronaut.position.y = movementStartY;
    setAstronautCollisionProfile(getCurrentAstronautCollisionProfile());

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
    applyGravity(
        astronaut,
        gameState.gravity * movementModifiers.gravityScale,
        (downPressed ? MOVEMENT_SETTINGS.flyDownTerminalVelocity : MOVEMENT_SETTINGS.fallTerminalVelocity) * movementModifiers.terminalVelocityScale
    );
    const wasLanded = gameState.astronaut.isLanded;
    const horizontalVelocityBeforeResolution = astronaut.velocity.x;

    // --- Move astronaut by velocity with collision detection ---
    let nextX = movementTargetX;
    let nextY = movementTargetY;
    if (!gameState.astronaut.isLanded) {
        nextX += astronaut.velocity.x;
        nextY += astronaut.velocity.y;
    }

    const collisionState = checkAstronautCollisions(
        buttonEntities,
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        movementStartX,
        movementStartY,
        nextX,
        nextY,
        gameState
    );

    gameState.astronaut.position.x = collisionState.nextX;
    gameState.astronaut.position.y = collisionState.nextY;
    astronaut.velocity.x = collisionState.velocityX;
    astronaut.velocity.y = collisionState.velocityY;
    gameState.astronaut.isLanded = collisionState.isLanded;
    gameState.astronaut.isFlying = !collisionState.isLanded;
    if (!wasLanded && collisionState.isLanded) {
        const carriedHorizontalMotion = collisionState.nextX - movementStartX;
        const landingMomentumSource = Math.abs(carriedHorizontalMotion) > Math.abs(horizontalVelocityBeforeResolution)
            ? carriedHorizontalMotion
            : horizontalVelocityBeforeResolution;
        applyLandingMomentum(landingMomentumSource);
        astronaut.velocity.x = 0;
        astronaut.velocity.y = 0;
        flyDownTransitioning = false;
        flyDownTransitionStep = 0;
        flyDownTransitionTimer = 0;
        flyHoldTimer = 0;
        flyDir = null;
        flySwitching = false;
        flySwitchStep = 0;
        flySwitchTimer = 0;
        lastFlySpriteCol = SPRITE_COL_STAND;
    }

    const collidedButton = collisionState.touchedButton;
    const doorCollision = collisionState.touchedDoor;

    if (collidedButton && Array.isArray(collidedButton.linkedDoors)) {
        const now = performance.now();
        const lastPress = buttonPressTimestamps.get(collidedButton) || 0;
        if (now - lastPress > 500) {
            for (const doorID of collidedButton.linkedDoors) {
                const door = doorEntities.find(d => d.doorID === doorID);
                if (door) {
                    door.locked = !door.locked;
                }
            }
            syncButtonStatesToDoors();
            buttonPressTimestamps.set(collidedButton, now);
            try { buttonOnSound.currentTime = 0; buttonOnSound.play(); } catch {}
        }
    }

    if (
        doorCollision &&
        doorCollision.type === "door_horizontal" &&
        !doorCollision.locked &&
        !doorCollision.animating
    ) {
        doorCollision.animating = true;
        if (typeof (doorCollision as any)._originalX === "undefined") {
            (doorCollision as any)._originalX = doorCollision.x;
        }
        (doorCollision as any)._animationDirection = "open";
        (doorCollision as any)._animationTimer = 0;
        (doorCollision as any)._closeDelay = 0;
    }

    updateThrowAngle();
    handleCollectableInteractions();
    updateHeldCollectablePosition();
    resolveAstronautCollectableCollisions(
        gameState.astronaut.position.x - movementStartX,
        gameState.astronaut.position.y - movementStartY
    );
    updateCollectablePhysics();
    updateHeldCollectablePosition();

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
        let block: any = null;
        if (hideBlackBackgroundBlocks) {
            // Find the topmost non-black_background block under the mouse
            const blocksUnderMouse = mapBlocks.filter(b => {
                const tileW = 32 * SPRITE_SCALE;
                const tileH = 32 * SPRITE_SCALE;
                return (
                    mouseWorld.x >= b.x && mouseWorld.x < b.x + tileW &&
                    mouseWorld.y >= b.y && mouseWorld.y < b.y + tileH
                );
            });
            block = blocksUnderMouse.find(b => b.type !== 'black_background');
            // If not found, fall back to doors/buttons/creatures
            if (!block) {
                block = getAnyBlockAtWorld(mouseWorld.x, mouseWorld.y, SPRITE_SCALE, [], doorEntities, buttonEntities, creatureEntities);
            }
        } else {
            block = getAnyBlockAtWorld(mouseWorld.x, mouseWorld.y, SPRITE_SCALE, mapBlocks, doorEntities, buttonEntities, creatureEntities);
        }
        if (block) {
            ctx!.fillText(
                `Block under cursor: ${block.type} (${block.x},${block.y}) id: ${block.entityId ?? 'n/a'} palette: ${block.palette ?? 0} rotation: ${block.rotation ?? 0}` +
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
            // Show tight bounding box world min/max if available
            const bbox = blockInstanceRotatedBoundingBoxes.get(block);
            if (bbox) {
                // Calculate transformed corners (with rotation/flip)
                const scale = SPRITE_SCALE;
                const tileW = 32 * scale;
                const tileH = 32 * scale;
                const cx = block.x + tileW / 2;
                const cy = block.y + tileH / 2;
                // Corners relative to sprite center
                let corners = [
                    { x: -tileW / 2 + bbox.minX * scale, y: -tileH / 2 + bbox.minY * scale },
                    { x: -tileW / 2 + bbox.maxX * scale, y: -tileH / 2 + bbox.minY * scale },
                    { x: -tileW / 2 + bbox.maxX * scale, y: -tileH / 2 + bbox.maxY * scale },
                    { x: -tileW / 2 + bbox.minX * scale, y: -tileH / 2 + bbox.maxY * scale }
                ];
                // Apply rotation/flip
                let rot = block.rotation || 0;
                corners = corners.map(pt => {
                    let { x, y } = pt;
                    // Rotation (1-4 = 0,90,180,270 deg)
                    if (rot >= 1 && rot <= 4) {
                        const angle = ((rot - 1) * Math.PI) / 2;
                        const cos = Math.cos(angle);
                        const sin = Math.sin(angle);
                        const nx = x * cos - y * sin;
                        const ny = x * sin + y * cos;
                        x = nx; y = ny;
                    } else if (rot === 5) {
                        x = -x;
                    } else if (rot === 6) {
                        y = -y;
                    } else if (rot === 7) {
                        x = -x; y = -y;
                    }
                    // Translate to world
                    return { x: cx + x, y: cy + y };
                });
                const xs = corners.map(pt => pt.x);
                const ys = corners.map(pt => pt.y);
                const worldMinX = Math.round(Math.min(...xs));
                const worldMinY = Math.round(Math.min(...ys));
                const worldMaxX = Math.round(Math.max(...xs));
                const worldMaxY = Math.round(Math.max(...ys));
                ctx!.fillText(
                    `Tight bbox: worldMin=(${worldMinX},${worldMinY}) worldMax=(${worldMaxX},${worldMaxY})`,
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
    // --- Draw world coordinate bounding boxes for each block in green if enabled ---
    if (showWorldBoundingBoxes) {
        drawWorldBoundingBoxOverlay(ctx!, camera);
    }

    // --- Highlight all black_background blocks if enabled ---
    if (showBlackBackgroundBlocks) {
        ctx!.save();
        ctx!.strokeStyle = 'cyan';
        ctx!.lineWidth = 2;
        for (const block of mapBlocks) {
            if (block.type === 'black_background') {
                const bbox = blockInstanceRotatedBoundingBoxes.get(block);
                const scale = SPRITE_SCALE;
                const tileW = 32 * scale;
                const tileH = 32 * scale;
                // Center of the sprite
                const drawX = block.x - camera.x + tileW / 2;
                const drawY = block.y - camera.y + tileH / 2;
                ctx!.save();
                ctx!.translate(drawX, drawY);
                // Apply rotation if present
                if (block.rotation) {
                    if (block.rotation >= 1 && block.rotation <= 4) {
                        ctx!.rotate(((block.rotation - 1) * Math.PI) / 2);
                    } else if (block.rotation === 5) {
                        ctx!.scale(-1, 1);
                    } else if (block.rotation === 6) {
                        ctx!.scale(1, -1);
                    } else if (block.rotation === 7) {
                        ctx!.scale(-1, -1);
                    }
                }
                // Draw bbox relative to sprite center
                if (bbox) {
                    const x = -tileW / 2 + bbox.minX * scale;
                    const y = -tileH / 2 + bbox.minY * scale;
                    const w = bbox.width * scale;
                    const h = bbox.height * scale;
                    ctx!.strokeRect(x, y, w, h);
                } else {
                    // fallback: draw full tile
                    ctx!.strokeRect(-tileW / 2, -tileH / 2, tileW, tileH);
                }
                ctx!.restore();
            }
        }
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
                const astronautOffsets = getAstronautCollisionOffsets();
                const feetY = teleportTarget.y + astronautOffsets.bottom;
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
        updateAndDrawThrowGuide(ctx!, camera);
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
                    [SPRITE_COL_WALK_RIGHT2]: "walk_right3"
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

        if (heldCollectable) {
            drawEntities(ctx!, camera, spriteMap, remappedSpriteSheets, SPRITE_SCALE, [heldCollectable]);
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

type CollisionBounds = {
    left: number;
    right: number;
    top: number;
    bottom: number;
};

function getEntityCollisionBounds(entity: { type: string, rotation?: number }) {
    const tileSize = 32 * SPRITE_SCALE;
    const rotation = typeof entity.rotation === "number" ? entity.rotation : 0;
    const bbox =
        worldMapRotatedBoundingBoxes[entity.type]?.[rotation] ||
        blockInstanceRotatedBoundingBoxes.get(entity as object) ||
        worldMapBoundingBoxes[entity.type];
    if (bbox) {
        return {
            left: bbox.minX * SPRITE_SCALE,
            right: (bbox.maxX + 1) * SPRITE_SCALE - 1,
            top: bbox.minY * SPRITE_SCALE,
            bottom: (bbox.maxY + 1) * SPRITE_SCALE - 1
        };
    }

    return {
        left: 0,
        right: tileSize - 1,
        top: 0,
        bottom: tileSize - 1
    };
}

function getHeldMovementModifiers() {
    if (!heldCollectable || heldCollectable.stored || !heldCollectable.affectsAstronaut) {
        return {
            effectiveWeight: 0,
            walkSpeedScale: 1,
            flightControlScale: 1,
            gravityScale: 1,
            terminalVelocityScale: 1
        };
    }

    const effectiveWeight = heldCollectable.weight < MOVEMENT_SETTINGS.heldWeightIgnoreThreshold
        ? 0
        : heldCollectable.weight;
    if (effectiveWeight === 0) {
        return {
            effectiveWeight,
            walkSpeedScale: 1,
            flightControlScale: 1,
            gravityScale: 1,
            terminalVelocityScale: 1
        };
    }

    const walkSpeedScale = Math.max(
        MOVEMENT_SETTINGS.heldWeightMinScale,
        1 - effectiveWeight * MOVEMENT_SETTINGS.heldWeightWalkPenaltyPerUnit
    );
    const flightControlScale = Math.max(
        MOVEMENT_SETTINGS.heldWeightMinScale,
        1 - effectiveWeight * MOVEMENT_SETTINGS.heldWeightFlyPenaltyPerUnit
    );

    return {
        effectiveWeight,
        walkSpeedScale,
        flightControlScale,
        gravityScale: 1 + effectiveWeight * MOVEMENT_SETTINGS.heldWeightGravityBonusPerUnit,
        terminalVelocityScale: 1 + effectiveWeight * MOVEMENT_SETTINGS.heldWeightTerminalVelocityBonusPerUnit
    };
}

function getFacingSign() {
    return facingLeft ? -1 : 1;
}

function getAstronautRect() {
    const astronautOffsets = getAstronautCollisionOffsets();
    return {
        left: astronaut.position.x + astronautOffsets.left,
        right: astronaut.position.x + astronautOffsets.right,
        top: astronaut.position.y + astronautOffsets.top,
        bottom: astronaut.position.y + astronautOffsets.bottom
    };
}

function getEntityRect(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds
) {
    return {
        left: entityX + collisionBounds.left,
        right: entityX + collisionBounds.right,
        top: entityY + collisionBounds.top,
        bottom: entityY + collisionBounds.bottom
    };
}

function getEntityCenter(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds
) {
    const rect = getEntityRect(entityX, entityY, collisionBounds);
    return {
        x: (rect.left + rect.right) / 2,
        y: (rect.top + rect.bottom) / 2
    };
}

function getHeldCollectableTargetPosition(): Position {
    if (!heldCollectable) {
        return {
            x: astronaut.position.x,
            y: astronaut.position.y
        };
    }

    const astronautRect = getAstronautRect();
    const collectableBounds = getEntityCollisionBounds(heldCollectable);
    const collectableHalfHeight = (collectableBounds.bottom - collectableBounds.top + 1) / 2;
    const desiredCenterY = astronaut.position.y + MOVEMENT_SETTINGS.heldCollectableVerticalOffset;

    const x = facingLeft
        ? astronautRect.left - 2 - collectableBounds.right
        : astronautRect.right + 2 - collectableBounds.left;

    return {
        x,
        y: desiredCenterY - collectableBounds.top - collectableHalfHeight
    };
}

function getAimOriginPosition() {
    if (heldCollectable) {
        const originPosition = getHeldCollectableTargetPosition();
        const heldBounds = getEntityCollisionBounds(heldCollectable);
        return getEntityCenter(originPosition.x, originPosition.y, heldBounds);
    }

    const astronautRect = getAstronautRect();
    return {
        x: facingLeft ? astronautRect.left - 2 : astronautRect.right + 2,
        y: astronaut.position.y + MOVEMENT_SETTINGS.heldCollectableVerticalOffset
    };
}

function getReleasedCollectablePosition(thrown: boolean) {
    if (!heldCollectable) {
        return {
            x: astronaut.position.x,
            y: astronaut.position.y
        };
    }

    const heldPosition = getHeldCollectableTargetPosition();
    return {
        x: thrown
            ? heldPosition.x + getFacingSign() * (MOVEMENT_SETTINGS.droppedCollectableForwardOffset - MOVEMENT_SETTINGS.heldCollectableForwardOffset)
            : heldPosition.x,
        y: heldPosition.y
    };
}

function getDroppedCollectableReleaseVelocity(): Position {
    return {
        x: astronaut.velocity.x * MOVEMENT_SETTINGS.droppedCollectableMomentumTransfer,
        y: astronaut.velocity.y * MOVEMENT_SETTINGS.droppedCollectableMomentumTransfer
    };
}

function updateHeldCollectablePosition() {
    if (!heldCollectable) return;
    heldCollectable.setHeldFacing(facingLeft);
    const heldPosition = getHeldCollectableTargetPosition();
    heldCollectable.x = heldPosition.x;
    heldCollectable.y = heldPosition.y;
    heldCollectable.velocity.x = 0;
    heldCollectable.velocity.y = 0;
    heldCollectable.isGrounded = false;
}

function isLooseCollectable(collectable: Collectable) {
    return !collectable.collected && !collectable.held && !collectable.stored;
}

function getEntityOverlapBounds(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds
) {
    return getEntityRect(entityX, entityY, collisionBounds);
}

function isCollectableNearAstronaut(collectable: Collectable) {
    const collectableBounds = getEntityCollisionBounds(collectable);
    const collectableRect = getEntityOverlapBounds(collectable.x, collectable.y, collectableBounds);
    const astronautRect = getAstronautRect();

    const overlaps =
        collectableRect.right >= astronautRect.left &&
        collectableRect.left <= astronautRect.right &&
        collectableRect.bottom >= astronautRect.top &&
        collectableRect.top <= astronautRect.bottom;
    if (overlaps) return true;

    const collectableCenter = getEntityCenter(collectable.x, collectable.y, collectableBounds);
    const dx = collectableCenter.x - astronaut.position.x;
    const dy = collectableCenter.y - astronaut.position.y;
    return Math.hypot(dx, dy) <= MOVEMENT_SETTINGS.collectablePickupRange;
}

function getNearestPickupCollectable() {
    let bestCollectable: Collectable | null = null;
    let bestDistance = Number.POSITIVE_INFINITY;

    for (const collectable of collectableEntities) {
        if (!isLooseCollectable(collectable)) continue;
        if (!isCollectableNearAstronaut(collectable)) continue;
        const bounds = getEntityCollisionBounds(collectable);
        const collectableCenter = getEntityCenter(collectable.x, collectable.y, bounds);
        const distance = Math.hypot(collectableCenter.x - astronaut.position.x, collectableCenter.y - astronaut.position.y);
        if (distance < bestDistance) {
            bestDistance = distance;
            bestCollectable = collectable;
        }
    }

    return bestCollectable;
}

function storeHeldCollectable() {
    if (!heldCollectable || !heldCollectable.storable) return;
    if (storedCollectables.length >= MOVEMENT_SETTINGS.collectableInventoryLimit) return;

    heldCollectable.store();
    storedCollectables.push(heldCollectable);
    inventoryCycleIndex = storedCollectables.length - 1;
    heldCollectable = null;
    try { saveSound.currentTime = 0; saveSound.play(); } catch {}
}

function cycleStoredCollectable() {
    if (heldCollectable && !heldCollectable.storable) {
        return;
    }

    if (heldCollectable) {
        const previousHeldCollectable = heldCollectable;
        storeHeldCollectable();
        if (heldCollectable === previousHeldCollectable) {
            return;
        }
    }

    if (storedCollectables.length === 0) return;
    if (inventoryCycleIndex < 0 || inventoryCycleIndex >= storedCollectables.length) {
        inventoryCycleIndex = storedCollectables.length - 1;
    }

    const nextCollectable = storedCollectables.splice(inventoryCycleIndex, 1)[0];
    nextCollectable.hold(facingLeft);
    heldCollectable = nextCollectable;
    try { getSound.currentTime = 0; getSound.play(); } catch {}

    if (storedCollectables.length === 0) {
        inventoryCycleIndex = -1;
    } else {
        inventoryCycleIndex = (inventoryCycleIndex - 1 + storedCollectables.length) % storedCollectables.length;
    }
}

function releaseHeldCollectable(velocity: Position = { x: 0, y: 0 }) {
    if (!heldCollectable) return;
    const isThrown = velocity.x !== 0 || velocity.y !== 0;
    const releasePosition = getReleasedCollectablePosition(isThrown);
    const releaseVelocity = isThrown ? velocity : getDroppedCollectableReleaseVelocity();
    heldCollectable.release(
        releasePosition.x,
        releasePosition.y,
        releaseVelocity,
        isThrown ? 0 : MOVEMENT_SETTINGS.droppedCollectableAstronautIgnoreFrames
    );
    heldCollectable = null;
}

function handleCollectableInteractions() {
    if (keys[','] && !prevKeys[','] && !heldCollectable) {
        const pickupTarget = getNearestPickupCollectable();
        if (pickupTarget) {
            pickupTarget.hold(facingLeft);
            heldCollectable = pickupTarget;
        }
    }

    if (keys['s'] && !prevKeys['s']) {
        storeHeldCollectable();
    }

    if (keys['g'] && !prevKeys['g']) {
        cycleStoredCollectable();
    }

    if (keys['m'] && !prevKeys['m']) {
        releaseHeldCollectable();
    }

    if (keys['.'] && !prevKeys['.'] && heldCollectable) {
        const angleRadians = (throwAngleDegrees * Math.PI) / 180;
        const horizontalVelocity = Math.cos(angleRadians) * MOVEMENT_SETTINGS.throwVelocity * getFacingSign();
        const verticalVelocity = -Math.sin(angleRadians) * MOVEMENT_SETTINGS.throwVelocity;
        releaseHeldCollectable({ x: horizontalVelocity, y: verticalVelocity });
    }
}

function updateThrowAngle() {
    const raisingThrowAngle = !!keys['o'];
    const loweringThrowAngle = !!keys['k'];
    if (raisingThrowAngle === loweringThrowAngle) return;

    const nextAngle = throwAngleDegrees + (raisingThrowAngle ? 1 : -1) * MOVEMENT_SETTINGS.throwAngleAdjustDegreesPerFrame;
    throwAngleDegrees = Math.max(-90, Math.min(90, nextAngle));
}

function getCollectableEdgeSamples(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds,
    side: 'left' | 'right' | 'top' | 'bottom'
) {
    const left = entityX + collisionBounds.left;
    const right = entityX + collisionBounds.right;
    const top = entityY + collisionBounds.top;
    const bottom = entityY + collisionBounds.bottom;
    const sampleEdge = (start: number, end: number, segments = 6) => {
        if (start >= end) {
            return [start];
        }

        const points: number[] = [];
        for (let index = 0; index <= segments; index++) {
            points.push(start + ((end - start) * index) / segments);
        }
        return points;
    };

    if (side === 'left' || side === 'right') {
        const x = side === 'left' ? left : right;
        return sampleEdge(top + 1, bottom - 1).map((y) => ({ x, y }));
    }

    const y = side === 'top' ? top : bottom;
    return sampleEdge(left + 1, right - 1).map((x) => ({ x, y }));
}

function collidesAtSide(
    entityX: number,
    entityY: number,
    collisionBounds: CollisionBounds,
    side: 'left' | 'right' | 'top' | 'bottom'
) {
    const samples = getCollectableEdgeSamples(entityX, entityY, collisionBounds, side);
    const probeOffset = side === 'right' || side === 'bottom' ? 1 : -1;
    return samples.some(sample => !!getSolidBlockAtWorld(
        sample.x + (side === 'left' || side === 'right' ? probeOffset : 0),
        sample.y + (side === 'top' || side === 'bottom' ? probeOffset : 0),
        spriteMap,
        SPRITE_SCALE,
        mapBlocks,
        doorEntities,
        buttonEntities
    ));
}

function getFloorSnapAmount(entityX: number, entityY: number, collisionBounds: CollisionBounds) {
    for (let distance = 1; distance <= MOVEMENT_SETTINGS.collectableGroundSnapDistance; distance++) {
        const samples = getCollectableEdgeSamples(entityX, entityY + distance, collisionBounds, 'bottom');
        const supported = samples.some(sample => !!getSolidBlockAtWorld(
            sample.x,
            sample.y + 1,
            spriteMap,
            SPRITE_SCALE,
            mapBlocks,
            doorEntities,
            buttonEntities
        ));
        if (supported) return distance;
    }

    return 0;
}

function moveCollectableHorizontally(collectable: Collectable, amount: number) {
    if (amount === 0) return 0;

    const direction = amount > 0 ? 1 : -1;
    const collisionBounds = getEntityCollisionBounds(collectable);
    const side = direction > 0 ? 'right' : 'left';
    let moved = 0;

    for (let step = 0; step < Math.abs(amount); step++) {
        const nextX = collectable.x + direction;
        if (collidesAtSide(nextX, collectable.y, collisionBounds, side)) {
            break;
        }
        collectable.x = nextX;
        moved += direction;
    }

    return moved;
}

function getCollectablePushScale(collectable: Collectable) {
    return Math.max(
        MOVEMENT_SETTINGS.collectablePushMinScale,
        1 - collectable.weight * MOVEMENT_SETTINGS.collectablePushResistancePerUnit
    );
}

function getCollectableBounceRestitution(collectable: Collectable, impactSpeed: number) {
    if (
        impactSpeed < MOVEMENT_SETTINGS.collectableBounceMinImpactSpeed ||
        MOVEMENT_SETTINGS.collectableBounceRestitution <= 0
    ) {
        return 0;
    }

    const weightScale = Math.max(
        0,
        1 - collectable.weight * MOVEMENT_SETTINGS.collectableBounceWeightPenaltyPerUnit
    );
    if (weightScale === 0) {
        return 0;
    }

    const impactScale = Math.max(
        0,
        Math.min(
            1,
            (impactSpeed - MOVEMENT_SETTINGS.collectableBounceMinImpactSpeed) /
            Math.max(0.001, MOVEMENT_SETTINGS.collectableTerminalVelocity - MOVEMENT_SETTINGS.collectableBounceMinImpactSpeed)
        )
    );

    return MOVEMENT_SETTINGS.collectableBounceRestitution * weightScale * (0.75 + impactScale * 0.25);
}

function resolveAstronautCollectableCollisions(horizontalMovement: number, verticalMovement: number) {
    const astronautRect = getAstronautRect();

    for (const collectable of collectableEntities) {
        if (!isLooseCollectable(collectable)) continue;
        if (collectable.astronautCollisionIgnoreFrames > 0) continue;

        const bounds = getEntityCollisionBounds(collectable);
        const collectableRect = getEntityRect(collectable.x, collectable.y, bounds);
        const overlapX = Math.min(astronautRect.right, collectableRect.right) - Math.max(astronautRect.left, collectableRect.left) + 1;
        const overlapY = Math.min(astronautRect.bottom, collectableRect.bottom) - Math.max(astronautRect.top, collectableRect.top) + 1;

        if (overlapX <= 0 || overlapY <= 0) {
            continue;
        }

        if (horizontalMovement !== 0 && Math.abs(horizontalMovement) >= Math.abs(verticalMovement)) {
            const pushAmount = Math.ceil(overlapX);
            const pushScale = getCollectablePushScale(collectable);
            const requestedPush = Math.max(1, Math.ceil(pushAmount * pushScale));
            const moved = moveCollectableHorizontally(collectable, Math.sign(horizontalMovement) * requestedPush);
            const remaining = pushAmount - Math.abs(moved);
            if (remaining > 0) {
                gameState.astronaut.position.x -= Math.sign(horizontalMovement) * remaining;
                astronaut.velocity.x = 0;
            }

            const pushedVelocity = Math.max(
                -MOVEMENT_SETTINGS.collectablePushMaxSpeed,
                Math.min(
                    MOVEMENT_SETTINGS.collectablePushMaxSpeed,
                    horizontalMovement * MOVEMENT_SETTINGS.collectablePushVelocityMultiplier * pushScale
                )
            );
            collectable.velocity.x = pushedVelocity;
        } else if (verticalMovement > 0) {
            gameState.astronaut.position.y -= Math.ceil(overlapY);
            astronaut.velocity.y = 0;
            gameState.astronaut.isLanded = true;
        } else if (verticalMovement < 0) {
            gameState.astronaut.position.y += Math.ceil(overlapY);
            astronaut.velocity.y = 0;
        }
    }
}

function updateSingleCollectablePhysics(collectable: Collectable) {
    if (!isLooseCollectable(collectable)) return;

    if (collectable.astronautCollisionIgnoreFrames > 0) {
        collectable.astronautCollisionIgnoreFrames--;
    }

    const collisionBounds = getEntityCollisionBounds(collectable);
    collectable.velocity.y = Math.min(
        collectable.velocity.y + MOVEMENT_SETTINGS.collectableGravity,
        MOVEMENT_SETTINGS.collectableTerminalVelocity
    );

    const targetX = collectable.x + collectable.velocity.x;
    const targetY = collectable.y + collectable.velocity.y;
    const steps = Math.max(1, Math.ceil(Math.max(Math.abs(targetX - collectable.x), Math.abs(targetY - collectable.y))));
    let nextX = collectable.x;
    let nextY = collectable.y;
    let grounded = false;
    let bounced = false;

    for (let step = 0; step < steps; step++) {
        const stepTargetX = collectable.x + ((targetX - collectable.x) * (step + 1)) / steps;
        const stepTargetY = collectable.y + ((targetY - collectable.y) * (step + 1)) / steps;

        if (stepTargetX !== nextX) {
            const horizontalDirection = stepTargetX > nextX ? 'right' : 'left';
            if (!collidesAtSide(stepTargetX, nextY, collisionBounds, horizontalDirection)) {
                nextX = stepTargetX;
            } else {
                collectable.velocity.x = 0;
            }
        }

        if (stepTargetY !== nextY) {
            const verticalDirection = stepTargetY > nextY ? 'bottom' : 'top';
            if (!collidesAtSide(nextX, stepTargetY, collisionBounds, verticalDirection)) {
                nextY = stepTargetY;
            } else {
                if (verticalDirection === 'bottom') {
                    const impactSpeed = collectable.velocity.y;
                    const bounceRestitution = getCollectableBounceRestitution(collectable, impactSpeed);
                    if (bounceRestitution > 0) {
                        collectable.velocity.y = -impactSpeed * bounceRestitution;
                        bounced = true;
                    } else {
                        grounded = true;
                        collectable.velocity.y = 0;
                    }
                    break;
                } else {
                    collectable.velocity.y = 0;
                    break;
                }
            }
        }
    }

    if (!grounded && !bounced && collectable.velocity.y >= 0) {
        const snapAmount = getFloorSnapAmount(nextX, nextY, collisionBounds);
        if (snapAmount > 0) {
            const snapImpactSpeed = collectable.velocity.y + snapAmount * MOVEMENT_SETTINGS.collectableGravity * 2;
            const bounceRestitution = getCollectableBounceRestitution(collectable, snapImpactSpeed);
            nextY += snapAmount;
            if (bounceRestitution > 0) {
                collectable.velocity.y = -snapImpactSpeed * bounceRestitution;
                bounced = true;
            } else {
                grounded = true;
                collectable.velocity.y = 0;
            }
        }
    }

    collectable.x = Math.round(nextX);
    collectable.y = Math.round(nextY);
    collectable.isGrounded = grounded;

    if (grounded) {
        collectable.velocity.x *= 1 - MOVEMENT_SETTINGS.collectableGroundFriction;
        if (Math.abs(collectable.velocity.x) < 0.05) {
            collectable.velocity.x = 0;
        }
    }
}

function updateCollectablePhysics() {
    for (const collectable of collectableEntities) {
        updateSingleCollectablePhysics(collectable);
    }
}

function updateAndDrawThrowGuide(context: CanvasRenderingContext2D, camera: Position) {
    const aimingActive = !!keys['o'] || !!keys['k'];
    if (aimingActive) {
        throwGuideDotEmitTimer++;
        if (throwGuideDotEmitTimer % MOVEMENT_SETTINGS.throwGuideDotEmitIntervalFrames === 0) {
            const origin = getAimOriginPosition();
            const angleRadians = (throwAngleDegrees * Math.PI) / 180;
            const directionX = Math.cos(angleRadians) * getFacingSign();
            const directionY = -Math.sin(angleRadians);
            for (let index = 0; index < MOVEMENT_SETTINGS.throwGuideDotsPerBurst; index++) {
                const speedJitter = 0.85 + Math.random() * 0.3;
                throwGuideDots.push({
                    x: origin.x,
                    y: origin.y,
                    vx: directionX * MOVEMENT_SETTINGS.throwGuideDotSpeed * speedJitter,
                    vy: directionY * MOVEMENT_SETTINGS.throwGuideDotSpeed * speedJitter,
                    hue: Math.random() * 360,
                    hueDrift: (Math.random() - 0.5) * 16,
                    flickerOffset: Math.random() * Math.PI * 2
                });
            }
        }
    } else {
        throwGuideDotEmitTimer = 0;
    }

    const animationTime = performance.now() * 0.02;
    const nextThrowGuideDots: ThrowGuideDot[] = [];

    for (const dot of throwGuideDots) {
        dot.x += dot.vx;
        dot.y += dot.vy;

        const screenX = dot.x - camera.x;
        const screenY = dot.y - camera.y;
        if (screenX < 0 || screenX > canvas.width || screenY < 0 || screenY > canvas.height) {
            continue;
        }

        nextThrowGuideDots.push(dot);
        const hue = (dot.hue + animationTime * 120 + dot.hueDrift) % 360;
        const lightness = 58 + (Math.sin(animationTime * 2.3 + dot.flickerOffset) + 1) * 14;
        context.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
        context.beginPath();
        context.arc(screenX, screenY, MOVEMENT_SETTINGS.throwGuideDotSize, 0, Math.PI * 2);
        context.fill();
    }

    throwGuideDots = nextThrowGuideDots;
}

// --- Show tight bounding boxes toggle ---
let showTightBoundingBoxes = false; // Red sprite-based bounding boxes
let showWorldBoundingBoxes = false; // Green world-coordinate bounding boxes
window.addEventListener('keydown', (e) => {
    if (e.key === 'b') showTightBoundingBoxes = !showTightBoundingBoxes;
    if (e.key === 'f') showWorldBoundingBoxes = !showWorldBoundingBoxes;
    if (e.key === 'd') gameState.debugMode = !gameState.debugMode;
});
