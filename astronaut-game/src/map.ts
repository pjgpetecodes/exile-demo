import { assignEntityId } from './game.js';

export type MapBlock = {
    x: number; // tile x
    y: number; // tile y
    type: string; // allow any block type, not just 'floor_grass' | 'floor_plain_half'
    collision: boolean;
    palette?: string | number;
    rotation?: 1 | 2 | 3 | 4 | 5 | 6 | 7;
};

export let mapBlocks: MapBlock[] = [];
export let mapLoaded = false;

// New: Color alias map and loader
let colorAliases: Record<string, [number, number, number]> = {};
let colorAliasesLoaded = false;

async function fetchFreshJson<T>(url: string): Promise<T> {
    const separator = url.includes('?') ? '&' : '?';
    const response = await fetch(`${url}${separator}t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) {
        throw new Error(`Failed to load ${url}: ${response.status} ${response.statusText}`);
    }
    return response.json() as Promise<T>;
}

async function loadColorAliases() {
    if (colorAliasesLoaded) return;
    colorAliases = await fetchFreshJson('./src/assets/colors.json');
    colorAliasesLoaded = true;
}

// Utility: Resolve color alias or return RGB array
function resolveColor(color: string | [number, number, number]): [number, number, number] {
    if (typeof color === "string") {
        return colorAliases[color] || [0, 0, 0];
    }
    return color;
}

export async function loadMapBlocks() {
    await loadColorAliases(); // Ensure color aliases are loaded
    const arr = await fetchFreshJson<any[]>('./src/assets/world_map.json');
    // Assign entityId to each block using global assignEntityId
    mapBlocks = arr.map((block: any) => assignEntityId(block));
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

// Utility: Cache for filtered sprites (black-to-transparent)
const filteredSpriteCache = new Map<string, HTMLCanvasElement>();

// Utility: Build a rect lookup map for fast access
function buildSpriteRectMap(spriteMap: any) {
    const rectMap: Record<string, any> = {};
    if (spriteMap instanceof Array) {
        for (let row = 0; row < spriteMap.length; row++) {
            for (let col = 0; col < spriteMap[row].length; col++) {
                const rect = spriteMap[row][col];
                if (rect && rect.name) rectMap[rect.name] = rect;
            }
        }
    } else {
        Object.assign(rectMap, spriteMap);
    }
    return rectMap;
}

// Draw map blocks
export function drawMap(
    ctx: CanvasRenderingContext2D,
    camera: { x: number, y: number },
    spriteMap: any,
    spriteSheets: CanvasImageSource[],
    SPRITE_SCALE: number,
    blocks?: MapBlock[] // Optional: blocks to draw instead of global mapBlocks
) {
    if (!spriteMap || !mapLoaded) return;

    // Build rect lookup map once per draw
    const rectMap = buildSpriteRectMap(spriteMap);

    // Only draw blocks in camera viewport (+1 tile margin)
    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const minX = camera.x - tileW, maxX = camera.x + ctx.canvas.width + tileW;
    const minY = camera.y - tileH, maxY = camera.y + ctx.canvas.height + tileH;

    // Use provided blocks array or global mapBlocks
    const blocksToDraw = blocks || mapBlocks;

    for (const block of blocksToDraw) {
        // Only draw visible blocks
        if (
            block.x + tileW < minX || block.x > maxX ||
            block.y + tileH < minY || block.y > maxY
        ) continue;

        // Fast rect lookup
        const rect = rectMap[block.type];
        if (!rect) continue;

        let paletteIdx = 0;
        if (typeof block.palette === "number" && block.palette >= 0 && block.palette < spriteSheets.length) {
            paletteIdx = block.palette;
        }
        const sheet = spriteSheets[paletteIdx] || spriteSheets[0];

        ctx.save();
        const drawX = block.x - camera.x;
        const drawY = block.y - camera.y;
        ctx.translate(drawX + tileW / 2, drawY + tileH / 2);
        if (block.rotation) {
            if (block.rotation >= 1 && block.rotation <= 4) {
                ctx.rotate(((block.rotation - 1) * Math.PI) / 2);
            } else if (block.rotation === 5) {
                ctx.scale(-1, 1);
            } else if (block.rotation === 6) {
                ctx.scale(1, -1);
            } else if (block.rotation === 7) {
                ctx.scale(-1, -1);
            }
        }

        // Cache filtered sprite by key: sheet index + rect name
        const cacheKey = `${paletteIdx}:${rect.name || rect.type}`;
        let offCanvas = filteredSpriteCache.get(cacheKey);
        if (!offCanvas) {
            offCanvas = document.createElement('canvas');
            offCanvas.width = rect.w;
            offCanvas.height = rect.h;
            const offCtx = offCanvas.getContext('2d')!;
            offCtx.drawImage(
                sheet,
                rect.x, rect.y, rect.w, rect.h,
                0, 0, rect.w, rect.h
            );
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
            filteredSpriteCache.set(cacheKey, offCanvas);
        }

        ctx.drawImage(
            offCanvas,
            -tileW / 2, -tileH / 2,
            tileW, tileH
        );
        ctx.restore();
    }
}
