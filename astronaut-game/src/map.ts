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
    floorGrassRect: { w: number; h: number } | null,
    SPRITE_SCALE: number
): MapBlock | undefined {
    if (!floorGrassRect) return undefined;
    const tileW = floorGrassRect.w * SPRITE_SCALE * (4 / 3) * 3;
    const tileH = floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3;
    return mapBlocks.find(b =>
        x >= b.x && x < b.x + tileW &&
        y >= b.y && y < b.y + tileH &&
        b.collision
    );
}

// Draw map blocks
export function drawMap(
    ctx: CanvasRenderingContext2D,
    camera: { x: number, y: number },
    floorGrassRect: any,
    floorPlainHalfRect: any,
    spriteSheets: CanvasImageSource[], // <-- now expects array of remapped sheets
    SPRITE_SCALE: number
) {
    if (!floorGrassRect || !floorPlainHalfRect || !mapLoaded) return;
    const tileW = floorGrassRect.w * SPRITE_SCALE * (4 / 3) * 3;
    const tileH = floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3;

    for (const block of mapBlocks) {
        const drawX = block.x - camera.x;
        const drawY = block.y - camera.y;
        if (
            drawX + tileW < 0 || drawX > ctx.canvas.width ||
            drawY + tileH < 0 || drawY > ctx.canvas.height
        ) continue;

        let rect = block.type === 'floor_grass' ? floorGrassRect : floorPlainHalfRect;
        // Use block.palette (number) if present, else 0
        let paletteIdx = 0;
        if (typeof block.palette === "number" && block.palette >= 0 && block.palette < spriteSheets.length) {
            paletteIdx = block.palette;
        }
        const sheet = spriteSheets[paletteIdx] || spriteSheets[0];

        ctx.save();
        ctx.translate(drawX + tileW / 2, drawY + tileH / 2);
        if (block.rotation) ctx.rotate(((block.rotation - 1) * Math.PI) / 2);
        ctx.scale(1, -1);
        ctx.drawImage(
            sheet,
            rect.x, rect.y, rect.w, rect.h,
            -tileW / 2, -tileH / 2, tileW, tileH
        );
        ctx.restore();
    }
}
