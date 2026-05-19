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
let stars: Star[] = [];
const STAR_DENSITY_DIVISOR = 30000;
const MIN_STAR_COUNT = 200;
const MAX_STAR_COUNT = 1000;

function getStarCount(worldWidth: number, starfieldHeight: number) {
    return Math.max(
        MIN_STAR_COUNT,
        Math.min(MAX_STAR_COUNT, Math.round((worldWidth * starfieldHeight) / STAR_DENSITY_DIVISOR))
    );
}

function randomStarWorldPosition(worldWidth: number, starfieldHeight: number) {
    return {
        x: Math.random() * worldWidth,
        y: Math.random() * starfieldHeight
    };
}

function randomStarMoveInterval() {
    return 120 + Math.floor(Math.random() * 240);
}

export function initStars(worldWidth: number, starfieldHeight: number) {
    stars = [];
    const starCount = getStarCount(worldWidth, starfieldHeight);
    for (let i = 0; i < starCount; i++) {
        const position = randomStarWorldPosition(worldWidth, starfieldHeight);
        stars.push({
            x: 0, y: 0,
            colorIndex: Math.floor(Math.random() * STAR_COLORS.length),
            twinkleTimer: Math.random() * 2,
            twinkleSpeed: 0.5 + Math.random() * 1.5,
            moveTimer: 0,
            moveInterval: randomStarMoveInterval(),
            worldX: position.x,
            worldY: position.y
        });
    }
}

function maybeMoveStarsToNewLocations(worldWidth: number, starfieldHeight: number) {
    for (let star of stars) {
        star.moveTimer++;
        if (star.moveTimer > star.moveInterval) {
            const position = randomStarWorldPosition(worldWidth, starfieldHeight);
            star.worldX = position.x;
            star.worldY = position.y;
            star.twinkleTimer = Math.random() * 2;
            star.moveTimer = 0;
            star.moveInterval = randomStarMoveInterval();
        }
    }
}

export function updateAndDrawStars(
    ctx: CanvasRenderingContext2D,
    camera: { x: number, y: number },
    canvas: HTMLCanvasElement,
    worldWidth: number,
    starfieldHeight: number
) {
    maybeMoveStarsToNewLocations(worldWidth, starfieldHeight);

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
            star.worldY < starfieldHeight
        ) {
            ctx.save();
            ctx.fillStyle = STAR_COLORS[star.colorIndex];
            ctx.globalAlpha = 0.7 + 0.3 * Math.sin(star.twinkleTimer * Math.PI);
            ctx.fillRect(Math.round(star.x), Math.round(star.y), 4, 4);
            ctx.restore();
        }
    }
}
