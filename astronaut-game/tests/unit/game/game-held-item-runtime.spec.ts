import { describe, expect, it, vi } from 'vitest';
import { createGameHeldItemRuntime } from '../../../src/game/combat/game-held-item-runtime';

describe('held item runtime positioning', () => {
    it('keeps held collectable in front when turning direction', () => {
        const heldCollectable = { x: 0, y: 0, velocity: { x: 0, y: 0 }, setHeldFacing: vi.fn() };
        let facingLeft = false;
        const runtime = createGameHeldItemRuntime({
            astronaut: { position: { x: 100, y: 120 }, velocity: { x: 0, y: 0 } },
            movementSettings: {
                heldCollectableVerticalOffset: -6,
                droppedCollectableForwardOffset: 24,
                heldCollectableForwardOffset: 28,
                droppedCollectableMomentumTransfer: 0.75,
                droppedCollectableAstronautIgnoreFrames: 18,
                collectablePickupRange: 52,
                collectableInventoryLimit: 5,
                throwVelocity: 5.6
            },
            heldCollectableHandInset: 8,
            heldCollectableHandOverlap: -12,
            spriteScale: 2,
            keys: {},
            getPrevKeys: () => ({}),
            getFacingLeft: () => facingLeft,
            getFacingSign: () => (facingLeft ? -1 : 1),
            getThrowAngleDegrees: () => 20,
            getAstronautRect: () => ({ left: 80, right: 120, top: 90, bottom: 130 }),
            getEntityCollisionBounds: () => ({ left: -8, right: 8, top: -8, bottom: 8 }),
            getEntityRect: (x, y, bounds) => ({ left: x + bounds.left, right: x + bounds.right, top: y + bounds.top, bottom: y + bounds.bottom }),
            getEntityCenter: (x, y, bounds) => ({ x: x + (bounds.left + bounds.right) / 2, y: y + (bounds.top + bounds.bottom) / 2 }),
            getAstronautRenderedWorldSprite: () => null,
            getRenderedEntityWorldSprite: () => null,
            getSpriteVisibleBounds: () => null,
            getCollectableEntities: () => [heldCollectable as any],
            getHeldCollectable: () => heldCollectable as any,
            setHeldCollectable: () => {},
            getStoredCollectables: () => [],
            getInventoryCycleIndex: () => -1,
            setInventoryCycleIndex: () => {},
            creatureRuntime: {
                getNearestPickupCreature: () => null,
                removeCreatureEntity: () => {}
            },
            spawnCreatureCarryProxy: () => ({} as any),
            markCollectableCollected: () => {},
            isCollectableCollected: () => false,
            isGrenadeCollectable: () => false,
            setGrenadeCollectableArmedState: () => {},
            removeCollectableEntity: () => {},
            restoreCreatureFromPayload: () => {},
            getSound: { currentTime: 0, play: vi.fn(() => Promise.resolve()) } as any,
            saveSound: { currentTime: 0, play: vi.fn(() => Promise.resolve()) } as any
        });

        const facingRightTarget = runtime.getHeldCollectableTargetPosition();
        facingLeft = true;
        const facingLeftTarget = runtime.getHeldCollectableTargetPosition();

        expect(facingRightTarget.y).toBe(113.5);
        expect(facingLeftTarget.y).toBe(113.5);
        expect(facingRightTarget.x).toBeGreaterThan(100);
        expect(facingLeftTarget.x).toBeLessThan(100);
    });

    it('uses rendered sprite hand-level anchor for vertical placement', () => {
        const heldCollectable = { x: 0, y: 0, velocity: { x: 0, y: 0 }, setHeldFacing: vi.fn() };
        const astronautCanvas = {} as HTMLCanvasElement;
        const heldCanvas = {} as HTMLCanvasElement;
        const runtime = createGameHeldItemRuntime({
            astronaut: { position: { x: 100, y: 120 }, velocity: { x: 0, y: 0 } },
            movementSettings: {
                heldCollectableVerticalOffset: -6,
                droppedCollectableForwardOffset: 24,
                heldCollectableForwardOffset: 28,
                droppedCollectableMomentumTransfer: 0.75,
                droppedCollectableAstronautIgnoreFrames: 18,
                collectablePickupRange: 52,
                collectableInventoryLimit: 5,
                throwVelocity: 5.6
            },
            heldCollectableHandInset: 8,
            heldCollectableHandOverlap: -12,
            spriteScale: 2,
            keys: {},
            getPrevKeys: () => ({}),
            getFacingLeft: () => false,
            getFacingSign: () => 1,
            getThrowAngleDegrees: () => 20,
            getAstronautRect: () => ({ left: 80, right: 120, top: 90, bottom: 130 }),
            getEntityCollisionBounds: () => ({ left: -8, right: 8, top: -8, bottom: 8 }),
            getEntityRect: (x, y, bounds) => ({ left: x + bounds.left, right: x + bounds.right, top: y + bounds.top, bottom: y + bounds.bottom }),
            getEntityCenter: (x, y, bounds) => ({ x: x + (bounds.left + bounds.right) / 2, y: y + (bounds.top + bounds.bottom) / 2 }),
            getAstronautRenderedWorldSprite: () => ({ canvas: astronautCanvas, drawX: 70, drawY: 80 }),
            getRenderedEntityWorldSprite: (entity) => (entity === heldCollectable
                ? { canvas: heldCanvas, drawX: 120, drawY: entity.y + 20 }
                : null),
            getSpriteVisibleBounds: (canvas) => {
                if (canvas === astronautCanvas) {
                    return { minX: 4, minY: 4, maxX: 19, maxY: 27 };
                }
                if (canvas === heldCanvas) {
                    return { minX: 2, minY: 2, maxX: 5, maxY: 5 };
                }
                return null;
            },
            getCollectableEntities: () => [heldCollectable as any],
            getHeldCollectable: () => heldCollectable as any,
            setHeldCollectable: () => {},
            getStoredCollectables: () => [],
            getInventoryCycleIndex: () => -1,
            setInventoryCycleIndex: () => {},
            creatureRuntime: {
                getNearestPickupCreature: () => null,
                removeCreatureEntity: () => {}
            },
            spawnCreatureCarryProxy: () => ({} as any),
            markCollectableCollected: () => {},
            isCollectableCollected: () => false,
            isGrenadeCollectable: () => false,
            setGrenadeCollectableArmedState: () => {},
            removeCollectableEntity: () => {},
            restoreCreatureFromPayload: () => {},
            getSound: { currentTime: 0, play: vi.fn(() => Promise.resolve()) } as any,
            saveSound: { currentTime: 0, play: vi.fn(() => Promise.resolve()) } as any
        });

        const target = runtime.getHeldCollectableTargetPosition();
        expect(target.y).toBe(84);
        expect(target.x).toBeGreaterThan(100);
    });
});
