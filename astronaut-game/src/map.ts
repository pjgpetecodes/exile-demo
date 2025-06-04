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
    x = Math.round(x);
    y = Math.round(y);

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

        // All sprites are 32x32, scale by SPRITE_SCALE
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;
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

        // All sprites are 32x32, scale by SPRITE_SCALE
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;

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
        if (block.rotation) {
            // 1 = 0°, 2 = 90°, 3 = 180°, 4 = 270° clockwise
            ctx.rotate(((block.rotation - 1) * Math.PI) / 2);
        }
        
        // Draw the sprite centered, scaled, with black treated as transparent
        // Create an offscreen canvas to filter black to transparent
        const offCanvas = document.createElement('canvas');
        offCanvas.width = rect.w;
        offCanvas.height = rect.h;
        const offCtx = offCanvas.getContext('2d')!;
        offCtx.drawImage(
            sheet,
            rect.x, rect.y, rect.w, rect.h,
            0, 0, rect.w, rect.h
        );
        // Replace black with transparent
        const imgData = offCtx.getImageData(0, 0, rect.w, rect.h);
        for (let i = 0; i < imgData.data.length; i += 4) {
            if (
                imgData.data[i] === 0 &&
                imgData.data[i + 1] === 0 &&
                imgData.data[i + 2] === 0
            ) {
                imgData.data[i + 3] = 0;
            }
        }
        offCtx.putImageData(imgData, 0, 0);

        ctx.drawImage(
            offCanvas,
            -tileW / 2, -tileH / 2,
            tileW, tileH
        );
        ctx.restore();
    }
}
