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
export function loadMapBlocks() {
    return __awaiter(this, void 0, void 0, function* () {
        const res = yield fetch('./src/assets/world_map.json');
        mapBlocks = yield res.json();
        mapLoaded = true;
    });
}
// Collision detection with blocks
export function getBlockAtWorld(x, y, spriteMap, SPRITE_SCALE) {
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
        const tileW = rect.w * SPRITE_SCALE * (4 / 3) * 3;
        const tileH = rect.h * SPRITE_SCALE * (2 / 3) * 3;
        if (x >= b.x && x < b.x + tileW &&
            y >= b.y && y < b.y + tileH &&
            b.collision) {
            return b;
        }
    }
    return undefined;
}
// Draw map blocks
export function drawMap(ctx, camera, spriteMap, spriteSheets, SPRITE_SCALE) {
    if (!spriteMap || !mapLoaded)
        return;
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
        }
        else if (spriteMap[block.type]) {
            rect = spriteMap[block.type];
        }
        if (!rect)
            continue;
        // Restore the original scaling logic for block drawing
        const tileW = rect.w * SPRITE_SCALE * (4 / 3) * 3;
        const tileH = rect.h * SPRITE_SCALE * (2 / 3) * 3;
        const drawX = block.x - camera.x;
        const drawY = block.y - camera.y;
        if (drawX + tileW < 0 || drawX > ctx.canvas.width ||
            drawY + tileH < 0 || drawY > ctx.canvas.height)
            continue;
        let paletteIdx = 0;
        if (typeof block.palette === "number" && block.palette >= 0 && block.palette < spriteSheets.length) {
            paletteIdx = block.palette;
        }
        const sheet = spriteSheets[paletteIdx] || spriteSheets[0];
        ctx.save();
        ctx.translate(drawX + tileW / 2, drawY + tileH / 2);
        if (block.rotation)
            ctx.rotate(((block.rotation - 1) * Math.PI) / 2);
        ctx.scale(1, -1);
        ctx.drawImage(sheet, rect.x, rect.y, rect.w, rect.h, -tileW / 2, -tileH / 2, tileW, tileH);
        ctx.restore();
    }
}
