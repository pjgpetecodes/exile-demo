import type { Collectable } from '../../entities/collectable.js';

export const FLASK_COLLECTABLE_TYPE = 'pipe_down_half';
export const FLASK_EMPTY_PALETTE = 30;
export const FLASK_FULL_PALETTE = 10;

type FlaskRuntimeState = {
    fillStartedAtMs?: number;
    fillCommitted?: boolean;
    spillFlashUntilMs?: number;
    lastHeldVelocityX?: number;
    lastHeldVelocityY?: number;
};

const flaskRuntimeState = new WeakMap<Collectable, FlaskRuntimeState>();

function getFlaskState(collectable: Collectable) {
    let state = flaskRuntimeState.get(collectable);
    if (!state) {
        state = {};
        flaskRuntimeState.set(collectable, state);
    }
    return state;
}

export function isFlaskCollectable(collectable: Collectable | null | undefined): collectable is Collectable {
    return !!collectable && collectable.type === FLASK_COLLECTABLE_TYPE;
}

export function isFlaskFull(collectable: Collectable) {
    return collectable.palette === FLASK_FULL_PALETTE;
}

export function setFlaskPaletteEmpty(collectable: Collectable) {
    collectable.palette = FLASK_EMPTY_PALETTE;
}

export function setFlaskPaletteFull(collectable: Collectable) {
    collectable.palette = FLASK_FULL_PALETTE;
}

export function getFlaskFillStartedAt(collectable: Collectable) {
    return getFlaskState(collectable).fillStartedAtMs;
}

export function startFlaskFillAttempt(collectable: Collectable, now: number) {
    const state = getFlaskState(collectable);
    if (typeof state.fillStartedAtMs !== 'number') {
        state.fillStartedAtMs = now;
    }
    return state.fillStartedAtMs;
}

export function clearFlaskFillAttempt(collectable: Collectable) {
    getFlaskState(collectable).fillStartedAtMs = undefined;
}

export function isFlaskFillCommitted(collectable: Collectable) {
    return getFlaskState(collectable).fillCommitted === true;
}

export function markFlaskFillCommitted(collectable: Collectable) {
    const state = getFlaskState(collectable);
    state.fillCommitted = true;
    state.fillStartedAtMs = undefined;
}

export function isFlaskSubmergedForFilling(options: {
    rect: { left: number; right: number; top: number; bottom: number };
    getWaterSubmersionRatioForRect: (rect: { left: number; right: number; top: number; bottom: number }) => number;
    minSubmersionRatio: number;
    minTopCoverageRatio: number;
}) {
    const { rect, getWaterSubmersionRatioForRect, minSubmersionRatio, minTopCoverageRatio } = options;
    const height = Math.max(1, rect.bottom - rect.top + 1);
    const topSliceHeight = Math.max(2, Math.floor(height * 0.25));
    const topSliceRect = {
        left: rect.left,
        right: rect.right,
        top: rect.top,
        bottom: rect.top + topSliceHeight - 1
    };
    const submersionRatio = getWaterSubmersionRatioForRect(rect);
    const topCoverageRatio = getWaterSubmersionRatioForRect(topSliceRect);
    return submersionRatio >= minSubmersionRatio && topCoverageRatio >= minTopCoverageRatio;
}

export function triggerFlaskSpillFlash(collectable: Collectable, now: number, flashDurationMs: number) {
    const state = getFlaskState(collectable);
    setFlaskPaletteFull(collectable);
    state.fillStartedAtMs = undefined;
    state.fillCommitted = false;
    state.spillFlashUntilMs = now + Math.max(1, flashDurationMs);
}

export function syncFlaskSpillFlash(collectable: Collectable, now: number) {
    const state = getFlaskState(collectable);
    if (typeof state.spillFlashUntilMs === 'number' && now >= state.spillFlashUntilMs) {
        state.spillFlashUntilMs = undefined;
        setFlaskPaletteEmpty(collectable);
    }
}

export function updateHeldFlaskMotionAndGetDeltaSpeed(
    collectable: Collectable,
    velocity: { x: number; y: number }
) {
    const state = getFlaskState(collectable);
    const lastVX = Number.isFinite(state.lastHeldVelocityX) ? state.lastHeldVelocityX! : velocity.x;
    const lastVY = Number.isFinite(state.lastHeldVelocityY) ? state.lastHeldVelocityY! : velocity.y;
    state.lastHeldVelocityX = velocity.x;
    state.lastHeldVelocityY = velocity.y;
    return Math.hypot(velocity.x - lastVX, velocity.y - lastVY);
}

export function updateHeldFlaskMotionAndGetImpactSpeed(
    collectable: Collectable,
    velocity: { x: number; y: number }
) {
    const state = getFlaskState(collectable);
    const previousVelocityX = Number.isFinite(state.lastHeldVelocityX) ? state.lastHeldVelocityX! : velocity.x;
    const previousVelocityY = Number.isFinite(state.lastHeldVelocityY) ? state.lastHeldVelocityY! : velocity.y;
    state.lastHeldVelocityX = velocity.x;
    state.lastHeldVelocityY = velocity.y;

    const impactSpeedX = Math.max(0, Math.abs(previousVelocityX) - Math.abs(velocity.x));
    const impactSpeedY = Math.max(0, Math.abs(previousVelocityY) - Math.abs(velocity.y));
    const xCollapsed = Math.abs(velocity.x) <= Math.max(0.35, Math.abs(previousVelocityX) * 0.45);
    const yCollapsed = Math.abs(velocity.y) <= Math.max(0.35, Math.abs(previousVelocityY) * 0.45);

    const resolvedImpactSpeed = Math.max(
        xCollapsed ? impactSpeedX : 0,
        yCollapsed ? impactSpeedY : 0
    );
    return resolvedImpactSpeed >= 0.6 ? resolvedImpactSpeed : 0;
}

export function clearHeldFlaskMotion(collectable: Collectable) {
    const state = getFlaskState(collectable);
    state.lastHeldVelocityX = undefined;
    state.lastHeldVelocityY = undefined;
}
