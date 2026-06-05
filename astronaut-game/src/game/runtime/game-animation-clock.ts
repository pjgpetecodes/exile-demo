export type SharedAnimationClock = {
    nowMs: number;
    deltaMs: number;
    frameIndex: number;
};

const DEFAULT_FRAME_DELTA_MS = 1000 / 60;
const MAX_FRAME_DELTA_MS = 250;

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function createOrAdvanceAnimationClock(
    previous: SharedAnimationClock | null | undefined,
    nowMs: number
): SharedAnimationClock {
    if (!previous) {
        return {
            nowMs,
            deltaMs: DEFAULT_FRAME_DELTA_MS,
            frameIndex: 0
        };
    }

    const elapsedMs = clamp(nowMs - previous.nowMs, 0, MAX_FRAME_DELTA_MS);
    return {
        nowMs,
        deltaMs: elapsedMs,
        frameIndex: previous.frameIndex + 1
    };
}
