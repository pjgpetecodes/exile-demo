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
export function getBlockAtWorld(x, y, floorGrassRect, SPRITE_SCALE) {
    if (!floorGrassRect)
        return undefined;
    const tileW = floorGrassRect.w * SPRITE_SCALE * (4 / 3) * 3;
    const tileH = floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3;
    return mapBlocks.find(b => x >= b.x && x < b.x + tileW &&
        y >= b.y && y < b.y + tileH &&
        b.collision);
}
// Draw map blocks
export function drawMap(ctx, camera, floorGrassRect, floorPlainHalfRect, spriteSheet, SPRITE_SCALE) {
    if (!floorGrassRect || !floorPlainHalfRect || !mapLoaded)
        return;
    const tileW = floorGrassRect.w * SPRITE_SCALE * (4 / 3) * 3;
    const tileH = floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3;
    for (const block of mapBlocks) {
        const drawX = block.x - camera.x;
        const drawY = block.y - camera.y;
        if (drawX + tileW < 0 || drawX > ctx.canvas.width ||
            drawY + tileH < 0 || drawY > ctx.canvas.height)
            continue;
        let rect = block.type === 'floor_grass' ? floorGrassRect : floorPlainHalfRect;
        ctx.save();
        ctx.translate(drawX + tileW / 2, drawY + tileH / 2);
        if (block.rotation)
            ctx.rotate(((block.rotation - 1) * Math.PI) / 2);
        ctx.scale(1, -1);
        ctx.drawImage(spriteSheet, rect.x, rect.y, rect.w, rect.h, -tileW / 2, -tileH / 2, tileW, tileH);
        ctx.restore();
    }
}
