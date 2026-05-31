// Jetpack dot logic module

type JetpackDot = { x: number; y: number; vy: number; alpha: number };
let jetpackDots: JetpackDot[] = [];
let jetpackDotEmitTimer = 0;

export function emitJetpackDots(params: {
    upPressed: boolean;
    downPressed: boolean;
    leftPressed: boolean;
    rightPressed: boolean;
    facingLeft: boolean;
    astronaut: { position: { x: number; y: number }, isLanded: boolean };
    spriteSheet: HTMLImageElement;
    spriteMap: any;
    SPRITE_ROW: number;
    SPRITE_COL_STAND: number;
    SPRITE_SCALE: number;
    walkAnimFrame: number;
    walkAnimTimer: number;
    canvas: HTMLCanvasElement;
}) {
    jetpackDotEmitTimer++;
    const {
        upPressed, downPressed, leftPressed, rightPressed, facingLeft,
        astronaut, spriteSheet, spriteMap, SPRITE_ROW, SPRITE_COL_STAND, SPRITE_SCALE
    } = params;

    if (
        (upPressed || downPressed || leftPressed || rightPressed) &&
        jetpackDotEmitTimer % 4 === 0 &&
        spriteSheet && spriteSheet.complete
    ) {
        const spriteRect = spriteMap[SPRITE_ROW][SPRITE_COL_STAND];
        const SPRITE_W = spriteRect.w;
        const SPRITE_H = spriteRect.h;
        const drawW = SPRITE_W * SPRITE_SCALE;
        const drawH = SPRITE_H * SPRITE_SCALE;
        const offset = 21;
        let jetpackX = facingLeft
            ? astronaut.position.x + drawW / 2 - offset
            : astronaut.position.x - drawW / 2 + offset;
        let jetpackY = astronaut.position.y;

        if (!astronaut.isLanded && ((upPressed && (leftPressed || rightPressed)) || (downPressed && (leftPressed || rightPressed)))) {
            let vy = 0;
            if (upPressed) vy = 3 + Math.random() * 2;
            else if (downPressed) vy = -(3 + Math.random() * 2);

            jetpackDots.push({
                x: jetpackX,
                y: jetpackY,
                vy,
                alpha: 1
            });
        } else if (upPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: jetpackX,
                y: jetpackY,
                vy: 3 + Math.random() * 2,
                alpha: 1
            });
        } else if (downPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: jetpackX,
                y: jetpackY,
                vy: -(3 + Math.random() * 2),
                alpha: 1
            });
        } else if (leftPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: astronaut.position.x - offset,
                y: astronaut.position.y + drawH / 2 - offset,
                vy: 3 + Math.random() * 2,
                alpha: 1
            });
        } else if (rightPressed && !astronaut.isLanded) {
            jetpackDots.push({
                x: astronaut.position.x + offset,
                y: astronaut.position.y - drawH / 2 + offset,
                vy: 3 + Math.random() * 2,
                alpha: 1
            });
        }
    }
}

export function updateAndDrawJetpackDots(
    ctx: CanvasRenderingContext2D,
    camera: { x: number, y: number },
    MAP_HEIGHT: number
) {
    jetpackDots.forEach(dot => {
        dot.y += dot.vy;
        dot.alpha -= 0.025;
    });
    jetpackDots = jetpackDots.filter(dot => dot.y < MAP_HEIGHT && dot.alpha > 0);

    jetpackDots.forEach(dot => {
        ctx.save();
        ctx.globalAlpha = dot.alpha;
        ctx.fillStyle = '#fff';
        ctx.fillRect(dot.x - camera.x, dot.y - camera.y, 4, 4);
        ctx.restore();
    });
}

export function hasActiveJetpackDots() {
    return jetpackDots.length > 0;
}

export function resetJetpackDotEmitTimer() {
    jetpackDotEmitTimer = 0;
}
