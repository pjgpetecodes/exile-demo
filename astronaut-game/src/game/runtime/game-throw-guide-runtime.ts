import type { Position } from '../../types/index.js';

type ThrowGuideDot = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
    hueDrift: number;
    flickerOffset: number;
};

type ThrowGuideRuntimeOptions = {
    keys: Record<string, boolean>;
    movementSettings: {
        throwAngleAdjustDegreesPerFrame: number;
        throwGuideDotEmitIntervalFrames: number;
        throwGuideDotsPerBurst: number;
        throwGuideDotSpeed: number;
        throwGuideDotSize: number;
    };
    canvas: HTMLCanvasElement;
    getFacingSign: () => number;
    getAimOriginPosition: () => Position;
    getThrowAngleDegrees: () => number;
    setThrowAngleDegrees: (degrees: number) => void;
    getThrowGuideDots: () => ThrowGuideDot[];
    setThrowGuideDots: (dots: ThrowGuideDot[]) => void;
    getThrowGuideDotEmitTimer: () => number;
    setThrowGuideDotEmitTimer: (timer: number) => void;
};

export function createGameThrowGuideRuntime(options: ThrowGuideRuntimeOptions) {
    function updateThrowAngle() {
        const raisingThrowAngle = !!options.keys.o;
        const loweringThrowAngle = !!options.keys.k;
        if (raisingThrowAngle === loweringThrowAngle) {
            return;
        }

        const nextAngle = options.getThrowAngleDegrees()
            + (raisingThrowAngle ? 1 : -1) * options.movementSettings.throwAngleAdjustDegreesPerFrame;
        options.setThrowAngleDegrees(Math.max(-90, Math.min(90, nextAngle)));
    }

    function updateAndDrawThrowGuide(context: CanvasRenderingContext2D, camera: Position) {
        const aimingActive = !!options.keys.o || !!options.keys.k;
        if (aimingActive) {
            const nextTimer = options.getThrowGuideDotEmitTimer() + 1;
            options.setThrowGuideDotEmitTimer(nextTimer);
            if (nextTimer % options.movementSettings.throwGuideDotEmitIntervalFrames === 0) {
                const origin = options.getAimOriginPosition();
                const angleRadians = (options.getThrowAngleDegrees() * Math.PI) / 180;
                const directionX = Math.cos(angleRadians) * options.getFacingSign();
                const directionY = -Math.sin(angleRadians);
                const dots = options.getThrowGuideDots();
                for (let index = 0; index < options.movementSettings.throwGuideDotsPerBurst; index++) {
                    const speedJitter = 0.85 + Math.random() * 0.3;
                    dots.push({
                        x: origin.x,
                        y: origin.y,
                        vx: directionX * options.movementSettings.throwGuideDotSpeed * speedJitter,
                        vy: directionY * options.movementSettings.throwGuideDotSpeed * speedJitter,
                        hue: Math.random() * 360,
                        hueDrift: (Math.random() - 0.5) * 16,
                        flickerOffset: Math.random() * Math.PI * 2
                    });
                }
            }
        } else {
            options.setThrowGuideDotEmitTimer(0);
        }

        const animationTime = performance.now() * 0.02;
        const nextThrowGuideDots: ThrowGuideDot[] = [];
        for (const dot of options.getThrowGuideDots()) {
            dot.x += dot.vx;
            dot.y += dot.vy;

            const screenX = dot.x - camera.x;
            const screenY = dot.y - camera.y;
            if (screenX < 0 || screenX > options.canvas.width || screenY < 0 || screenY > options.canvas.height) {
                continue;
            }

            nextThrowGuideDots.push(dot);
            const hue = (dot.hue + animationTime * 120 + dot.hueDrift) % 360;
            const lightness = 58 + (Math.sin(animationTime * 2.3 + dot.flickerOffset) + 1) * 14;
            context.fillStyle = `hsl(${hue}, 100%, ${lightness}%)`;
            context.beginPath();
            context.arc(screenX, screenY, options.movementSettings.throwGuideDotSize, 0, Math.PI * 2);
            context.fill();
        }

        options.setThrowGuideDots(nextThrowGuideDots);
    }

    return {
        updateThrowAngle,
        updateAndDrawThrowGuide
    };
}
