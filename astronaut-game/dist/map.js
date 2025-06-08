var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
export let mapBlocks = [];
export let mapLoaded = false;
// New: Color alias map and loader
let colorAliases = {};
let colorAliasesLoaded = false;
function loadColorAliases() {
    return __awaiter(this, void 0, void 0, function* () {
        if (colorAliasesLoaded)
            return;
        const res = yield fetch('./src/assets/colors.json');
        colorAliases = yield res.json();
        colorAliasesLoaded = true;
    });
}
// Utility: Resolve color alias or return RGB array
function resolveColor(color) {
    if (typeof color === "string") {
        return colorAliases[color] || [0, 0, 0];
    }
    return color;
}
export function loadMapBlocks() {
    return __awaiter(this, void 0, void 0, function* () {
        yield loadColorAliases(); // Ensure color aliases are loaded
        const res = yield fetch('./src/assets/world_map.json');
        const arr = yield res.json();
        // Assign entityId to each block
        let nextEntityId = 1;
        mapBlocks = arr.map((block) => {
            block.entityId = nextEntityId++;
            return block;
        });
        mapLoaded = true;
    });
}
// Collision detection with blocks
export function getBlockAtWorld(x, y, spriteMap, SPRITE_SCALE) {
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
        }
        else if (spriteMap[b.type]) {
            rect = spriteMap[b.type];
        }
        if (!rect)
            continue;
        // All sprites are 32x32, scale by SPRITE_SCALE
        const tileW = 32 * SPRITE_SCALE;
        const tileH = 32 * SPRITE_SCALE;
        if (x >= b.x && x < b.x + tileW &&
            y >= b.y && y < b.y + tileH &&
            b.collision) {
            return b;
        }
    }
    return undefined;
}
// Utility: Cache for filtered sprites (black-to-transparent)
const filteredSpriteCache = new Map();
// Utility: Build a rect lookup map for fast access
function buildSpriteRectMap(spriteMap) {
    const rectMap = {};
    if (spriteMap instanceof Array) {
        for (let row = 0; row < spriteMap.length; row++) {
            for (let col = 0; col < spriteMap[row].length; col++) {
                const rect = spriteMap[row][col];
                if (rect && rect.name)
                    rectMap[rect.name] = rect;
            }
        }
    }
    else {
        Object.assign(rectMap, spriteMap);
    }
    return rectMap;
}
// Draw map blocks
export function drawMap(ctx, camera, spriteMap, spriteSheets, SPRITE_SCALE) {
    if (!spriteMap || !mapLoaded)
        return;
    // Build rect lookup map once per draw
    const rectMap = buildSpriteRectMap(spriteMap);
    // Only draw blocks in camera viewport (+1 tile margin)
    const tileW = 32 * SPRITE_SCALE;
    const tileH = 32 * SPRITE_SCALE;
    const minX = camera.x - tileW, maxX = camera.x + ctx.canvas.width + tileW;
    const minY = camera.y - tileH, maxY = camera.y + ctx.canvas.height + tileH;
    for (const block of mapBlocks) {
        // Only draw visible blocks
        if (block.x + tileW < minX || block.x > maxX ||
            block.y + tileH < minY || block.y > maxY)
            continue;
        // Fast rect lookup
        const rect = rectMap[block.type];
        if (!rect)
            continue;
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
            }
            else if (block.rotation === 5) {
                ctx.scale(-1, 1);
            }
            else if (block.rotation === 6) {
                ctx.scale(1, -1);
            }
            else if (block.rotation === 7) {
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
            const offCtx = offCanvas.getContext('2d');
            offCtx.drawImage(sheet, rect.x, rect.y, rect.w, rect.h, 0, 0, rect.w, rect.h);
            const imgData = offCtx.getImageData(0, 0, rect.w, rect.h);
            for (let i = 0; i < imgData.data.length; i += 4) {
                if (imgData.data[i] === 0 &&
                    imgData.data[i + 1] === 0 &&
                    imgData.data[i + 2] === 0) {
                    imgData.data[i + 3] = 0;
                }
            }
            offCtx.putImageData(imgData, 0, 0);
            filteredSpriteCache.set(cacheKey, offCanvas);
        }
        ctx.drawImage(offCanvas, -tileW / 2, -tileH / 2, tileW, tileH);
        ctx.restore();
    }
}
