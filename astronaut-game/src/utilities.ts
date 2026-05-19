import { Door } from './door.js';

function getSpriteRectByType(spriteMap: any, type: string) {
    if (spriteMap instanceof Array) {
        for (let row = 0; row < spriteMap.length; row++) {
            for (let col = 0; col < spriteMap[row].length; col++) {
                if (spriteMap[row][col].name === type) {
                    return spriteMap[row][col];
                }
            }
        }
        return null;
    }
    return spriteMap[type] || null;
}

function getEntityRotation(entity: any): number {
    if (typeof entity.rotation !== 'number') {
        return 1;
    }
    return entity.rotation;
}

function isEntitySolid(entity: any): boolean {
    if (entity.collision === false) {
        return false;
    }
    if (entity instanceof Door && entity.open) {
        return false;
    }
    return true;
}

function isSolidSpritePixelAtWorld(
    x: number,
    y: number,
    entity: any,
    rect: { x: number; y: number; w: number; h: number },
    SPRITE_SCALE: number,
    spriteSheetCtx?: CanvasRenderingContext2D
): boolean {
    const tileW = rect.w * SPRITE_SCALE;
    const tileH = rect.h * SPRITE_SCALE;
    const centerX = entity.x + tileW / 2;
    const centerY = entity.y + tileH / 2;

    let localX = x - centerX;
    let localY = y - centerY;
    const rotation = getEntityRotation(entity);

    if (rotation >= 2 && rotation <= 4) {
        const angle = -((rotation - 1) * Math.PI / 2);
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        const rotatedX = localX * cos - localY * sin;
        const rotatedY = localX * sin + localY * cos;
        localX = rotatedX;
        localY = rotatedY;
    } else if (rotation === 5) {
        localX = -localX;
    } else if (rotation === 6) {
        localY = -localY;
    } else if (rotation === 7) {
        localX = -localX;
        localY = -localY;
    }

    const drawX = localX + tileW / 2;
    const drawY = localY + tileH / 2;
    if (
        drawX < 0 ||
        drawX >= tileW ||
        drawY < 0 ||
        drawY >= tileH
    ) {
        return false;
    }

    const pixelX = Math.floor(drawX / SPRITE_SCALE);
    const pixelY = Math.floor(drawY / SPRITE_SCALE);
    if (
        pixelX < 0 ||
        pixelX >= rect.w ||
        pixelY < 0 ||
        pixelY >= rect.h
    ) {
        return false;
    }

    if (!spriteSheetCtx) {
        return true;
    }

    const alpha = spriteSheetCtx.getImageData(rect.x + pixelX, rect.y + pixelY, 1, 1).data[3];
    return alpha > 0;
}

// After loading the sprite sheet, convert black pixels to transparent
export function makeBlackTransparent(img: HTMLImageElement, callback: (result: HTMLCanvasElement) => void) {
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
export function isSpritePixelTransparent(
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
export function remapSpritePalette(
    img: HTMLImageElement,
    colorMap: { from: [number, number, number], to: [number, number, number] }[]
): HTMLCanvasElement {
    // This export function allows for any number of color mappings.
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

// Utility: Get any block at world position (ignores collision)
export function getAnyBlockAtWorld(
    x: number,
    y: number,
    SPRITE_SCALE: number,
    mapBlocks: any[],
    doorEntities: any[],
    buttonEntities: any[],
    creatureEntities: any[]
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
export function getSolidBlockAtWorld(
    x: number,
    y: number,
    spriteMap: any,
    SPRITE_SCALE: number,
    mapBlocks: any[],
    doorEntities: any[],
    buttonEntities: any[]
): any {
    x = Math.round(x);
    y = Math.round(y);
    const spriteSheetCtx = (window as any)._spriteSheetCtx as CanvasRenderingContext2D | undefined;
    // Check map blocks
    for (const b of mapBlocks) {
        if (!isEntitySolid(b)) {
            continue;
        }
        const rect = getSpriteRectByType(spriteMap, b.type);
        if (rect && isSolidSpritePixelAtWorld(x, y, b, rect, SPRITE_SCALE, spriteSheetCtx)) {
            return b;
        }
    }
    // Check doors
    for (const d of doorEntities) {
        if (!isEntitySolid(d)) {
            continue;
        }
        const rect = getSpriteRectByType(spriteMap, d.type);
        if (rect && isSolidSpritePixelAtWorld(x, y, d, rect, SPRITE_SCALE, spriteSheetCtx)) {
            return d;
        }
    }
    // Check buttons (treat as solid)
    for (const btn of buttonEntities) {
        if (!isEntitySolid(btn)) {
            continue;
        }
        const rect = getSpriteRectByType(spriteMap, btn.type);
        if (rect && isSolidSpritePixelAtWorld(x, y, btn, rect, SPRITE_SCALE, spriteSheetCtx)) {
            return btn;
        }
    }
    return undefined;
}

// --- After all assets are loaded, calculate tightest collision bounding boxes ---
export async function calculateSpriteCollisionBoundingBoxes(
    spriteSheet: HTMLImageElement,
    spriteMap: any,
    mapBlocks: any[],
    doorEntities: any[],
    buttonEntities: any[],
    creatureEntities: any[] = [],
    collectableEntities: any[] = []
) {
    // Gather all entities with collision = true
    const allEntities = [
        ...mapBlocks.filter(b => b.collision === true),
        ...doorEntities.filter(d => d.collision === true),
        ...buttonEntities.filter(b => b.collision === true),
        ...creatureEntities.filter(c => c.collision === true),
        ...collectableEntities.filter(c => c.collision === true)
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

    // --- Calculate and store world coordinate bounding boxes ---
    // Use SPRITE_SCALE for all world bounding box calculations
    const { SPRITE_SCALE } = await import('./constants.js');
    const worldBoundingBoxes: Record<string, any[]> = {};
    for (const entity of allEntities) {
        const type = entity.type;
        const box = boundingBoxes[type];
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
        if (!box || !rect) continue;
        const scale = SPRITE_SCALE;
        const tileW = 32 * scale;
        const tileH = 32 * scale;
        // Center of the sprite in world coordinates
        const cx = entity.x + tileW / 2;
        const cy = entity.y + tileH / 2;
        // Corners relative to sprite center
        let corners = [
            { x: -tileW / 2 + box.minX * scale, y: -tileH / 2 + box.minY * scale },
            { x: -tileW / 2 + box.maxX * scale, y: -tileH / 2 + box.minY * scale },
            { x: -tileW / 2 + box.maxX * scale, y: -tileH / 2 + box.maxY * scale },
            { x: -tileW / 2 + box.minX * scale, y: -tileH / 2 + box.maxY * scale }
        ];
        // Apply rotation/flip
        let rot = entity.rotation || 0;
        corners = corners.map(pt => {
            let { x, y } = pt;
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
        const width = worldMaxX - worldMinX + 1;
        const height = worldMaxY - worldMinY + 1;
        const worldBox = {
            entityId: entity.entityId, // always use entity.entityId
            type,
            worldMinX,
            worldMinY,
            worldMaxX,
            worldMaxY,
            width,
            height
        };
        if (!worldBoundingBoxes[type]) worldBoundingBoxes[type] = [];
        worldBoundingBoxes[type].push(worldBox);
    }
    // Store globally
    (window as any).spriteWorldBoundingBoxes = worldBoundingBoxes;
    console.log("World coordinate bounding boxes for sprites with collision=true (map, doors, buttons):", worldBoundingBoxes);
    return boundingBoxes;
}

// --- Calculate tightest bounding boxes for astronaut sprites by name ---
export async function calculateAstronautSpriteBoundingBoxes(
    spriteSheet: HTMLImageElement,
    spriteMap: any
) {
    // List of astronaut sprite names to check
    const astronautSpriteNames = [
        "fly_right",
        "fly_diagonal",
        "fly_float",
        "fly_down",
        "stand",
        "walk_right1",
        "walk_right2",
        "walk_right3"
    ];
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

    for (const name of astronautSpriteNames) {
        // Find the sprite rect for this name
        let rect = null;
        if (spriteMap instanceof Array) {
            outer: for (let row = 0; row < spriteMap.length; row++) {
                for (let col = 0; col < spriteMap[row].length; col++) {
                    if (spriteMap[row][col].name === name) {
                        rect = spriteMap[row][col];
                        break outer;
                    }
                }
            }
        } else if (spriteMap[name]) {
            rect = spriteMap[name];
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
            boundingBoxes[name] = {
                minX, minY, maxX, maxY,
                width: maxX - minX + 1,
                height: maxY - minY + 1
            };
        }
    }
    console.log("Tightest collision bounding boxes for astronaut sprites:", boundingBoxes);

    // --- Calculate and store world coordinate bounding boxes for astronauts ---
    // This function does not have entity positions, so just store the bounding boxes at (0,0) for each sprite name
    const worldBoundingBoxes: Record<string, any> = {};
    for (const name of astronautSpriteNames) {
        const box = boundingBoxes[name];
        if (!box) continue;
        worldBoundingBoxes[name] = {
            worldMinX: box.minX,
            worldMinY: box.minY,
            worldMaxX: box.maxX,
            worldMaxY: box.maxY,
            width: box.width,
            height: box.height
        };
    }
    (window as any).astronautWorldBoundingBoxes = worldBoundingBoxes;
    console.log("World coordinate bounding boxes for astronaut sprites:", worldBoundingBoxes);
    return boundingBoxes;
}

// --- Draw generic entity array (same as drawMap but for any array) ---
export function drawEntities(
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
