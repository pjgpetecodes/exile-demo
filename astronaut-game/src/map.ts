export type MapBlock = {
    x: number; // tile x
    y: number; // tile y
    type: 'floor_grass' | 'floor_plain_half';
    collision: boolean;
    palette?: string;
    rotation?: 1 | 2 | 3 | 4;
};

export let mapBlocks: MapBlock[] = [];
export let mapLoaded = false;

export async function loadMapBlocks() {
    const res = await fetch('./src/assets/world_map.json');
    mapBlocks = await res.json();
    mapLoaded = true;
}

// Collision detection with blocks
export function getBlockAtWorld(
    x: number,
    y: number,
    spriteMap: any,
    SPRITE_SCALE: number
): MapBlock | undefined {
    for (const b of mapBlocks) {
        // Lookup the sprite rect for this block type
        let rect = null;
        if (spriteMap instanceof Array) {
            outer: for (let row = 0; row < spriteMap.length; row++) {
                for (let col = 0; col < spriteMap[row].length; col++) {
                    if (spriteMap[row][col].name === b.type) {
                        rect = spriteMap[row][col];
                        break outer;
                    }
                }
            }
        } else if (spriteMap[b.type]) {
            rect = spriteMap[b.type];
        }
        if (!rect) continue;

        // Pad to 16x32 before scaling
        const paddedW = Math.max(rect.w, 16);
        const paddedH = Math.max(rect.h, 32);
        const tileW = paddedW * SPRITE_SCALE * (4 / 3) * 3;
        const tileH = paddedH * SPRITE_SCALE * (2 / 3) * 3;
        if (
            x >= b.x && x < b.x + tileW &&
            y >= b.y && y < b.y + tileH &&
            b.collision
        ) {
            return b;
        }
    }
    return undefined;
}

// Draw map blocks
export function drawMap(
    ctx: CanvasRenderingContext2D,
    camera: { x: number, y: number },
    spriteMap: any,
    spriteSheets: CanvasImageSource[],
    SPRITE_SCALE: number
) {
    if (!spriteMap || !mapLoaded) return;

    for (const block of mapBlocks) {
        // Lookup the sprite rect for this block type
        let rect = null;
        if (spriteMap instanceof Array) {
            outer: for (let row = 0; row < spriteMap.length; row++) {
                for (let col = 0; col < spriteMap[row].length; col++) {
                    if (spriteMap[row][col].name === block.type) {
                        rect = spriteMap[row][col];
                        break outer;
                    }
                }
            }
        } else if (spriteMap[block.type]) {
            rect = spriteMap[block.type];
        }
        if (!rect) continue;

        // Determine rotated width/height
        let rotatedW = rect.w;
        let rotatedH = rect.h;
        if (block.rotation && (block.rotation % 2 === 0)) {
            rotatedW = rect.h;
            rotatedH = rect.w;
        }

        // Pad to 16x32 after rotation
        const paddedW = Math.max(rotatedW, 16);
        const paddedH = Math.max(rotatedH, 32);
        const tileW = paddedW * SPRITE_SCALE * (4 / 3) * 3;
        const tileH = paddedH * SPRITE_SCALE * (2 / 3) * 3;

        const drawX = block.x - camera.x;
        const drawY = block.y - camera.y;
        if (
            drawX + tileW < 0 || drawX > ctx.canvas.width ||
            drawY + tileH < 0 || drawY > ctx.canvas.height
        ) continue;

        let paletteIdx = 0;
        if (typeof block.palette === "number" && block.palette >= 0 && block.palette < spriteSheets.length) {
            paletteIdx = block.palette;
        }
        const sheet = spriteSheets[paletteIdx] || spriteSheets[0];

        ctx.save();
        ctx.translate(drawX + tileW / 2, drawY + tileH / 2);
        if (block.rotation) ctx.rotate(((block.rotation - 1) * Math.PI) / 2);
        ctx.scale(1, -1);

        // Draw the sprite at the top-left, pad right/bottom with transparent pixels if needed
        // Center the sprite in the padded area
        const drawW = rect.w * SPRITE_SCALE * (4 / 3) * 3;
        const drawH = rect.h * SPRITE_SCALE * (2 / 3) * 3;
        const offsetX = -tileW / 2 + (paddedW - rotatedW) * SPRITE_SCALE * (4 / 3) * 3 / 2;
        const offsetY = -tileH / 2 + (paddedH - rotatedH) * SPRITE_SCALE * (2 / 3) * 3 / 2;

        ctx.drawImage(
            sheet,
            rect.x, rect.y, rect.w, rect.h,
            offsetX, offsetY, drawW, drawH
        );
        ctx.restore();
    }
}
