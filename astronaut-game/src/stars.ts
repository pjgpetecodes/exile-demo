// Star background module

export type Star = {
    x: number;
    y: number;
    colorIndex: number;
    twinkleTimer: number;
    twinkleSpeed: number;
    moveTimer: number;
    moveInterval: number;
    worldX: number;
    worldY: number;
};

const STAR_COLORS = [
    '#ffffff', '#ffeedd', '#ffd700', '#ffb3fa', '#00eaff', '#00ffea', '#ff6b6b', '#fffb00',
    '#00ff00', '#00aaff', '#ff9900', '#e0e0ff', '#ff00ff', '#00ffff', '#fffacd', '#f8f8ff'
];
const STAR_COUNT = 40;
let stars: Star[] = [];

function randomStarMoveInterval() {
    return 120 + Math.floor(Math.random() * 240);
}

export function initStars(getAstronautPosition: () => { x: number, y: number }, canvas: HTMLCanvasElement) {
    stars = [];
    const astronaut = getAstronautPosition();
    for (let i = 0; i < STAR_COUNT; i++) {
        const worldX = astronaut.x - canvas.width / 2 + Math.random() * canvas.width;
        const worldY = astronaut.y - canvas.height / 2 + Math.random() * (canvas.height - 80);
        stars.push({
            x: 0, y: 0,
            colorIndex: Math.floor(Math.random() * STAR_COLORS.length),
            twinkleTimer: Math.random() * 2,
            twinkleSpeed: 0.5 + Math.random() * 1.5,
            moveTimer: 0,
            moveInterval: randomStarMoveInterval(),
            worldX,
            worldY
        });
    }
}

function maybeMoveStarsToNewLocations(getAstronautPosition: () => { x: number, y: number }, canvas: HTMLCanvasElement) {
    const astronaut = getAstronautPosition();
    for (let star of stars) {
        star.moveTimer++;
        if (star.moveTimer > star.moveInterval) {
            star.worldX = astronaut.x - canvas.width / 2 + Math.random() * canvas.width;
            star.worldY = astronaut.y - canvas.height / 2 + Math.random() * (canvas.height - 80);
            star.twinkleTimer = Math.random() * 2;
            star.moveTimer = 0;
            star.moveInterval = randomStarMoveInterval();
        }
    }
}

export function updateAndDrawStars(
    ctx: CanvasRenderingContext2D,
    camera: { x: number, y: number },
    getAstronautPosition: () => { x: number, y: number },
    canvas: HTMLCanvasElement,
    floorGrassRect: { h: number } | null,
    SPRITE_SCALE: number,
    MAP_HEIGHT: number
) {
    maybeMoveStarsToNewLocations(getAstronautPosition, canvas);
    const tileH = floorGrassRect ? floorGrassRect.h * SPRITE_SCALE * (2 / 3) * 3 : 32;
    const groundYWorld = (MAP_HEIGHT - 1) * tileH;

    for (let star of stars) {
        star.x = star.worldX - camera.x * 0.7;
        star.y = star.worldY - camera.y * 0.7;
        star.twinkleTimer += star.twinkleSpeed / 60;
        if (star.twinkleTimer > 1.5) {
            let prev = star.colorIndex;
            while (star.colorIndex === prev) {
                star.colorIndex = Math.floor(Math.random() * STAR_COLORS.length);
            }
            star.twinkleTimer = 0;
        }
        if (
            star.x >= 0 && star.x < canvas.width &&
            star.y >= 0 && star.y < canvas.height &&
            star.worldY < groundYWorld
        ) {
            ctx.save();
            ctx.fillStyle = STAR_COLORS[star.colorIndex];
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(star.twinkleTimer * Math.PI);
            ctx.fillRect(Math.round(star.x), Math.round(star.y), 4, 4);
            ctx.restore();
        }
    }
}
