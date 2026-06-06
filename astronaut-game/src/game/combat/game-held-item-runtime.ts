import type { Position } from '../../types/index.js';
import type { Collectable } from '../../entities/collectable.js';
import {
    clearFlaskFillAttempt,
    clearHeldFlaskMotion,
    getFlaskFillStartedAt,
    isFlaskFillCommitted,
    isFlaskCollectable,
    isFlaskFull,
    markFlaskFillCommitted,
    setFlaskPaletteFull,
    startFlaskFillAttempt,
    syncFlaskSpillFlash,
    triggerFlaskSpillFlash,
    updateHeldFlaskMotionAndGetImpactSpeed
} from '../collectables/game-flask-runtime.js';

type EntityRect = { left: number; right: number; top: number; bottom: number };
type CollisionBounds = EntityRect;

type HeldItemRuntimeOptions = {
    astronaut: { position: Position; velocity: Position };
    movementSettings: {
        heldCollectableVerticalOffset: number;
        droppedCollectableForwardOffset: number;
        heldCollectableForwardOffset: number;
        droppedCollectableMomentumTransfer: number;
        droppedCollectableAstronautIgnoreFrames: number;
        collectablePickupRange: number;
        collectableInventoryLimit: number;
        throwVelocity: number;
        flaskFillDurationMs: number;
        flaskFillMinSubmersionRatio: number;
        flaskFillTopCoverageMinRatio: number;
        flaskSpillFlashMs: number;
        flaskCarryBangDeltaSpeed: number;
        flaskImpactSpillMinSpeed: number;
    };
    heldCollectableHandInset: number;
    heldCollectableHandOverlap: number;
    spriteScale: number;
    keys: Record<string, boolean>;
    getPrevKeys: () => Record<string, boolean>;
    getFacingLeft: () => boolean;
    getFacingSign: () => number;
    getThrowAngleDegrees: () => number;
    getAstronautRect: () => EntityRect;
    getEntityCollisionBounds: (entity: any) => CollisionBounds;
    getEntityRect: (x: number, y: number, bounds: CollisionBounds) => EntityRect;
    getEntityCenter: (x: number, y: number, bounds: CollisionBounds) => Position;
    getWaterSubmersionRatioForRect: (rect: EntityRect) => number;
    getIsWorldPointInWater?: (x: number, y: number) => boolean;
    collidesAtSide?: (
        x: number,
        y: number,
        bounds: CollisionBounds,
        side: 'left' | 'right' | 'top' | 'bottom',
        collectable?: Collectable
    ) => boolean;
    getAstronautRenderedWorldSprite: () => { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null;
    getRenderedEntityWorldSprite: (entity: any) => { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null;
    getSpriteVisibleBounds: (canvas: HTMLCanvasElement | null) => { minX: number; minY: number; maxX: number; maxY: number } | null;
    getCollectableEntities: () => Collectable[];
    getHeldCollectable: () => Collectable | null;
    setHeldCollectable: (collectable: Collectable | null) => void;
    getStoredCollectables: () => Collectable[];
    getInventoryCycleIndex: () => number;
    setInventoryCycleIndex: (index: number) => void;
    creatureRuntime: {
        getNearestPickupCreature: () => any | null;
        removeCreatureEntity: (creature: any) => void;
    };
    spawnCreatureCarryProxy: (creature: any) => Collectable;
    markCollectableCollected: (collectable: Collectable) => void;
    isCollectableCollected: (collectable: Collectable) => boolean;
    isGrenadeCollectable: (collectable: Collectable | null | undefined) => boolean;
    setGrenadeCollectableArmedState: (collectable: Collectable, armed: boolean) => void;
    removeCollectableEntity: (collectable: Collectable) => void;
    restoreCreatureFromPayload: (payload: Record<string, any>, position: Position) => void;
    getSound: HTMLAudioElement;
    saveSound: HTMLAudioElement;
    emitFlaskSpillParticles: (x: number, y: number, count?: number) => void;
};

export function createGameHeldItemRuntime(options: HeldItemRuntimeOptions) {
    const swallowAutoplayRejection = () => {};
    const isWorldPointInWater = typeof options.getIsWorldPointInWater === 'function'
        ? options.getIsWorldPointInWater
        : (x: number, y: number) => options.getWaterSubmersionRatioForRect({
            left: x,
            right: x,
            top: y,
            bottom: y
        }) >= 1;

    function isHeldFlaskFullySubmerged(
        collectable: Collectable,
        heldRect: EntityRect
    ) {
        const rendered = options.getRenderedEntityWorldSprite(collectable);
        if (!rendered) {
            return options.getWaterSubmersionRatioForRect(heldRect) >= 1;
        }
        const spriteContext = rendered.canvas.getContext('2d');
        if (!spriteContext) {
            return options.getWaterSubmersionRatioForRect(heldRect) >= 1;
        }
        const imageData = spriteContext.getImageData(0, 0, rendered.canvas.width, rendered.canvas.height).data;
        let opaquePixelCount = 0;
        for (let y = 0; y < rendered.canvas.height; y += 1) {
            for (let x = 0; x < rendered.canvas.width; x += 1) {
                const alpha = imageData[(y * rendered.canvas.width + x) * 4 + 3];
                if (alpha <= 0) {
                    continue;
                }
                opaquePixelCount += 1;
                const worldX = rendered.drawX + (x + 0.5) * options.spriteScale;
                const worldY = rendered.drawY + (y + 0.5) * options.spriteScale;
                if (!isWorldPointInWater(worldX, worldY)) {
                    return false;
                }
            }
        }
        return opaquePixelCount > 0;
    }

    function getHeldCollectableTargetPosition(): Position {
        const heldCollectable = options.getHeldCollectable();
        if (!heldCollectable) {
            return { x: options.astronaut.position.x, y: options.astronaut.position.y };
        }

        const collectableBounds = options.getEntityCollisionBounds(heldCollectable);
        const renderedAstronaut = options.getAstronautRenderedWorldSprite();
        const visibleBounds = renderedAstronaut ? options.getSpriteVisibleBounds(renderedAstronaut.canvas) : null;
        const renderedHeldCollectable = options.getRenderedEntityWorldSprite(heldCollectable);
        const heldVisibleBounds = renderedHeldCollectable
            ? options.getSpriteVisibleBounds(renderedHeldCollectable.canvas)
            : null;
        const facingLeft = options.getFacingLeft();
        const desiredCenterY = renderedAstronaut && visibleBounds
            ? renderedAstronaut.drawY
                + (visibleBounds.minY + (visibleBounds.maxY - visibleBounds.minY + 1) / 2) * options.spriteScale
            : options.astronaut.position.y + options.movementSettings.heldCollectableVerticalOffset;
        const heldCenterOffsetY = renderedHeldCollectable && heldVisibleBounds
            ? (renderedHeldCollectable.drawY
                + (heldVisibleBounds.minY + (heldVisibleBounds.maxY - heldVisibleBounds.minY + 1) / 2) * options.spriteScale)
                - heldCollectable.y
            : collectableBounds.top + (collectableBounds.bottom - collectableBounds.top + 1) / 2;

        let x: number;
        if (renderedAstronaut && visibleBounds) {
            const visibleLeft = renderedAstronaut.drawX + visibleBounds.minX * options.spriteScale;
            const visibleRight = renderedAstronaut.drawX + (visibleBounds.maxX + 1) * options.spriteScale;
            const handX = facingLeft
                ? visibleLeft + options.heldCollectableHandInset
                : visibleRight - options.heldCollectableHandInset;
            x = facingLeft
                ? handX + options.heldCollectableHandOverlap - collectableBounds.right
                : handX - options.heldCollectableHandOverlap - collectableBounds.left;
        } else {
            const astronautRect = options.getAstronautRect();
            x = facingLeft
                ? astronautRect.left + options.heldCollectableHandInset - collectableBounds.right
                : astronautRect.right - options.heldCollectableHandInset - collectableBounds.left;
        }

        return {
            x,
            y: desiredCenterY - heldCenterOffsetY
        };
    }

    function getAimOriginPosition() {
        const heldCollectable = options.getHeldCollectable();
        if (heldCollectable) {
            const originPosition = getHeldCollectableTargetPosition();
            const heldBounds = options.getEntityCollisionBounds(heldCollectable);
            return options.getEntityCenter(originPosition.x, originPosition.y, heldBounds);
        }

        const renderedAstronaut = options.getAstronautRenderedWorldSprite();
        const visibleBounds = renderedAstronaut
            ? options.getSpriteVisibleBounds(renderedAstronaut.canvas)
            : null;
        if (renderedAstronaut && visibleBounds) {
            const visibleLeft = renderedAstronaut.drawX + visibleBounds.minX * options.spriteScale;
            const visibleRight = renderedAstronaut.drawX + (visibleBounds.maxX + 1) * options.spriteScale;
            const visibleCenterY = renderedAstronaut.drawY
                + (visibleBounds.minY + (visibleBounds.maxY - visibleBounds.minY + 1) / 2) * options.spriteScale;
            return {
                x: options.getFacingLeft() ? visibleLeft - 2 : visibleRight + 2,
                y: visibleCenterY
            };
        }

        const astronautRect = options.getAstronautRect();
        return {
            x: options.getFacingLeft() ? astronautRect.left - 2 : astronautRect.right + 2,
            y: (astronautRect.top + astronautRect.bottom) / 2
        };
    }

    function getReleasedCollectablePosition(thrown: boolean) {
        const heldCollectable = options.getHeldCollectable();
        if (!heldCollectable) {
            return { x: options.astronaut.position.x, y: options.astronaut.position.y };
        }

        const heldPosition = getHeldCollectableTargetPosition();
        return {
            x: thrown
                ? heldPosition.x + options.getFacingSign() * (
                    options.movementSettings.droppedCollectableForwardOffset
                    - options.movementSettings.heldCollectableForwardOffset
                )
                : heldPosition.x,
            y: heldPosition.y
        };
    }

    function getDroppedCollectableReleaseVelocity(): Position {
        const transferredVelocityX = options.astronaut.velocity.x * options.movementSettings.droppedCollectableMomentumTransfer;
        const transferredVelocityY = options.astronaut.velocity.y * options.movementSettings.droppedCollectableMomentumTransfer;
        const dropMinFallSpeed = 1;
        return {
            x: Number.isFinite(transferredVelocityX) ? transferredVelocityX : 0,
            y: Math.max(dropMinFallSpeed, Number.isFinite(transferredVelocityY) ? transferredVelocityY : 0)
        };
    }

    function resolveHeldCollectableSolidOverlap(heldCollectable: Collectable, collisionBounds: CollisionBounds) {
        if (typeof options.collidesAtSide !== 'function') {
            return;
        }

        const blockedSide: 'left' | 'right' = options.getFacingLeft() ? 'left' : 'right';
        if (!options.collidesAtSide(heldCollectable.x, heldCollectable.y, collisionBounds, blockedSide)) {
            return;
        }

        const retreatDirection = options.getFacingLeft() ? 1 : -1;
        const width = Math.max(1, collisionBounds.right - collisionBounds.left + 1);
        const maxRetreat = Math.max(2, Math.ceil(width / 2));
        for (let retreat = 1; retreat <= maxRetreat; retreat++) {
            const candidateX = heldCollectable.x + retreatDirection * retreat;
            if (!options.collidesAtSide(candidateX, heldCollectable.y, collisionBounds, blockedSide)) {
                heldCollectable.x = candidateX;
                return;
            }
        }
    }

    function updateHeldCollectablePosition() {
        const heldCollectable = options.getHeldCollectable();
        if (!heldCollectable) {
            return;
        }
        heldCollectable.setHeldFacing(options.getFacingLeft());
        const heldPosition = getHeldCollectableTargetPosition();
        heldCollectable.x = heldPosition.x;
        heldCollectable.y = heldPosition.y;
        heldCollectable.velocity.x = 0;
        heldCollectable.velocity.y = 0;
        heldCollectable.isGrounded = false;
        const collisionBounds = options.getEntityCollisionBounds(heldCollectable);
        resolveHeldCollectableSolidOverlap(heldCollectable, collisionBounds);

        if (!isFlaskCollectable(heldCollectable)) {
            return;
        }

        const now = performance.now();
        syncFlaskSpillFlash(heldCollectable, now);
        const heldRect = options.getEntityRect(heldCollectable.x, heldCollectable.y, collisionBounds);
        const spillOriginX = Math.round((heldRect.left + heldRect.right) / 2);
        const spillOriginY = heldRect.top;

        const submergedForFill = isHeldFlaskFullySubmerged(heldCollectable, heldRect);
        if (submergedForFill) {
            setFlaskPaletteFull(heldCollectable);
            if (!isFlaskFillCommitted(heldCollectable)) {
                const fillStartedAt = startFlaskFillAttempt(heldCollectable, now);
                if (now - fillStartedAt >= options.movementSettings.flaskFillDurationMs) {
                    markFlaskFillCommitted(heldCollectable);
                }
            }
        } else {
            const fillStartedAt = getFlaskFillStartedAt(heldCollectable);
            if (typeof fillStartedAt === 'number' && !isFlaskFillCommitted(heldCollectable)) {
                clearFlaskFillAttempt(heldCollectable);
                if (now - fillStartedAt < options.movementSettings.flaskFillDurationMs) {
                    triggerFlaskSpillFlash(heldCollectable, now, options.movementSettings.flaskSpillFlashMs);
                    options.emitFlaskSpillParticles(spillOriginX, spillOriginY, 18);
                    return;
                }
            }
        }

        if (isFlaskFull(heldCollectable)) {
            const heldImpactSpeed = updateHeldFlaskMotionAndGetImpactSpeed(heldCollectable, options.astronaut.velocity);
            if (heldImpactSpeed >= options.movementSettings.flaskImpactSpillMinSpeed) {
                triggerFlaskSpillFlash(heldCollectable, now, options.movementSettings.flaskSpillFlashMs);
                options.emitFlaskSpillParticles(spillOriginX, spillOriginY, 20);
                return;
            }
        }
    }

    function isLooseCollectable(collectable: Collectable) {
        return !options.isCollectableCollected(collectable) && !collectable.held && !collectable.stored;
    }

    function isCollectableNearAstronaut(collectable: Collectable) {
        const collectableBounds = options.getEntityCollisionBounds(collectable);
        const collectableRect = options.getEntityRect(collectable.x, collectable.y, collectableBounds);
        const astronautRect = options.getAstronautRect();

        const overlaps =
            collectableRect.right >= astronautRect.left &&
            collectableRect.left <= astronautRect.right &&
            collectableRect.bottom >= astronautRect.top &&
            collectableRect.top <= astronautRect.bottom;
        if (overlaps) {
            return true;
        }

        const collectableCenter = options.getEntityCenter(collectable.x, collectable.y, collectableBounds);
        const dx = collectableCenter.x - options.astronaut.position.x;
        const dy = collectableCenter.y - options.astronaut.position.y;
        return Math.hypot(dx, dy) <= options.movementSettings.collectablePickupRange;
    }

    function isCollectableOverlappingAstronaut(collectable: Collectable) {
        const collectableRect = options.getEntityRect(
            collectable.x,
            collectable.y,
            options.getEntityCollisionBounds(collectable)
        );
        const astronautRect = options.getAstronautRect();
        return (
            collectableRect.right >= astronautRect.left &&
            collectableRect.left <= astronautRect.right &&
            collectableRect.bottom >= astronautRect.top &&
            collectableRect.top <= astronautRect.bottom
        );
    }

    function getNearestPickupCollectable() {
        let bestCollectable: Collectable | null = null;
        let bestDistance = Number.POSITIVE_INFINITY;

        for (const collectable of options.getCollectableEntities()) {
            if (!isLooseCollectable(collectable)) continue;
            if (collectable.type === 'plasma_grenade') continue;
            if (collectable.pickupEnabled === false) continue;
            if (!isCollectableNearAstronaut(collectable)) continue;
            const bounds = options.getEntityCollisionBounds(collectable);
            const collectableCenter = options.getEntityCenter(collectable.x, collectable.y, bounds);
            const distance = Math.hypot(
                collectableCenter.x - options.astronaut.position.x,
                collectableCenter.y - options.astronaut.position.y
            );
            if (distance < bestDistance) {
                bestDistance = distance;
                bestCollectable = collectable;
            }
        }

        return bestCollectable;
    }

    function storeHeldCollectable() {
        const heldCollectable = options.getHeldCollectable();
        const storedCollectables = options.getStoredCollectables();
        if (!heldCollectable || !heldCollectable.storable) return;
        if (options.isGrenadeCollectable(heldCollectable) && heldCollectable.armed) return;
        if (storedCollectables.length >= options.movementSettings.collectableInventoryLimit) return;

        heldCollectable.store();
        storedCollectables.push(heldCollectable);
        options.setInventoryCycleIndex(storedCollectables.length - 1);
        options.setHeldCollectable(null);
        try {
            options.saveSound.currentTime = 0;
            void options.saveSound.play().catch(swallowAutoplayRejection);
        } catch {}
    }

    function cycleStoredCollectable() {
        const storedCollectables = options.getStoredCollectables();
        const heldCollectable = options.getHeldCollectable();
        if (heldCollectable && !heldCollectable.storable) {
            return;
        }

        if (heldCollectable) {
            const previousHeldCollectable = heldCollectable;
            storeHeldCollectable();
            if (options.getHeldCollectable() === previousHeldCollectable) {
                return;
            }
        }

        if (storedCollectables.length === 0) return;
        let inventoryCycleIndex = options.getInventoryCycleIndex();
        if (inventoryCycleIndex < 0 || inventoryCycleIndex >= storedCollectables.length) {
            inventoryCycleIndex = storedCollectables.length - 1;
        }

        const nextCollectable = storedCollectables.splice(inventoryCycleIndex, 1)[0];
        nextCollectable.hold(options.getFacingLeft());
        options.setHeldCollectable(nextCollectable);
        try {
            options.getSound.currentTime = 0;
            void options.getSound.play().catch(swallowAutoplayRejection);
        } catch {}

        if (storedCollectables.length === 0) {
            options.setInventoryCycleIndex(-1);
        } else {
            options.setInventoryCycleIndex((inventoryCycleIndex - 1 + storedCollectables.length) % storedCollectables.length);
        }
    }

    function releaseHeldCollectable(velocity: Position = { x: 0, y: 0 }) {
        const heldCollectable = options.getHeldCollectable();
        if (!heldCollectable) {
            return;
        }

        if (isFlaskCollectable(heldCollectable)) {
            clearFlaskFillAttempt(heldCollectable);
            clearHeldFlaskMotion(heldCollectable);
        }

        const isThrown = velocity.x !== 0 || velocity.y !== 0;
        const releasePosition = getReleasedCollectablePosition(isThrown);
        const safeReleasePosition = {
            x: Number.isFinite(releasePosition.x) ? releasePosition.x : options.astronaut.position.x,
            y: Number.isFinite(releasePosition.y) ? releasePosition.y : options.astronaut.position.y
        };
        const releaseVelocity = isThrown ? velocity : getDroppedCollectableReleaseVelocity();
        const safeReleaseVelocity = {
            x: Number.isFinite(releaseVelocity.x) ? releaseVelocity.x : 0,
            y: Number.isFinite(releaseVelocity.y) ? releaseVelocity.y : 0
        };
        if (heldCollectable.creaturePayload) {
            options.restoreCreatureFromPayload(heldCollectable.creaturePayload, {
                x: Math.round(safeReleasePosition.x),
                y: Math.round(safeReleasePosition.y)
            });
            options.removeCollectableEntity(heldCollectable);
            options.setHeldCollectable(null);
            return;
        }
        heldCollectable.release(
            safeReleasePosition.x,
            safeReleasePosition.y,
            safeReleaseVelocity,
            isThrown ? 0 : options.movementSettings.droppedCollectableAstronautIgnoreFrames
        );
        if (options.isGrenadeCollectable(heldCollectable)) {
            options.setGrenadeCollectableArmedState(heldCollectable, true);
        }
        options.setHeldCollectable(null);
    }

    function handleCollectableInteractions() {
        const prevKeys = options.getPrevKeys();
        const heldCollectable = options.getHeldCollectable();
        if (options.keys[','] && !prevKeys[','] && !heldCollectable) {
            const pickupTarget = getNearestPickupCollectable();
            if (pickupTarget) {
                if (pickupTarget.collected) {
                    options.markCollectableCollected(pickupTarget);
                    try {
                        options.getSound.currentTime = 0;
                        void options.getSound.play().catch(swallowAutoplayRejection);
                    } catch {}
                } else {
                    pickupTarget.hold(options.getFacingLeft());
                    if (isFlaskCollectable(pickupTarget)) {
                        clearHeldFlaskMotion(pickupTarget);
                    }
                    options.setHeldCollectable(pickupTarget);
                }
            } else {
                const pickupCreature = options.creatureRuntime.getNearestPickupCreature();
                if (pickupCreature) {
                    const proxy = options.spawnCreatureCarryProxy(pickupCreature);
                    options.creatureRuntime.removeCreatureEntity(pickupCreature);
                    proxy.hold(options.getFacingLeft());
                    if (isFlaskCollectable(proxy)) {
                        clearHeldFlaskMotion(proxy);
                    }
                    options.setHeldCollectable(proxy);
                }
            }
        }

        if (options.keys.s && !prevKeys.s) {
            storeHeldCollectable();
        }
        if (options.keys.g && !prevKeys.g) {
            cycleStoredCollectable();
        }
        const currentHeldCollectable = options.getHeldCollectable();
        if (options.keys[' '] && !prevKeys[' '] && currentHeldCollectable && options.isGrenadeCollectable(currentHeldCollectable)) {
            options.setGrenadeCollectableArmedState(currentHeldCollectable, !currentHeldCollectable.armed);
        }
        if (options.keys.m && !prevKeys.m) {
            releaseHeldCollectable();
        }
        if (options.keys['.'] && !prevKeys['.'] && options.getHeldCollectable()) {
            const angleRadians = (options.getThrowAngleDegrees() * Math.PI) / 180;
            const horizontalVelocity = Math.cos(angleRadians) * options.movementSettings.throwVelocity * options.getFacingSign();
            const verticalVelocity = -Math.sin(angleRadians) * options.movementSettings.throwVelocity;
            releaseHeldCollectable({ x: horizontalVelocity, y: verticalVelocity });
        }
    }

    return {
        getHeldCollectableTargetPosition,
        getAimOriginPosition,
        updateHeldCollectablePosition,
        isCollectableOverlappingAstronaut,
        handleCollectableInteractions,
        releaseHeldCollectable
    };
}
