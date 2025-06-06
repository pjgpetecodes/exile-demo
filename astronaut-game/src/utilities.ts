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
export async function calculateSpriteCollisionBoundingBoxes(
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
    return boundingBoxes;
}