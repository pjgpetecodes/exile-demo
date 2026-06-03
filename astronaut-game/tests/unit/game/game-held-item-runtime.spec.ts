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

describe('held flask fill and spill behavior', () => {
    it('switches to full palette immediately on submersion and spills if removed too soon', () => {
        const flask = {
            type: 'pipe_down_half',
            palette: 30,
            x: 0,
            y: 0,
            velocity: { x: 0, y: 0 },
            setHeldFacing: vi.fn()
        };
        let now = 1000;
        const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
        let waterRatio = 0;
        const emitSpill = vi.fn();
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
                throwVelocity: 5.6,
                flaskFillDurationMs: 2000,
                flaskFillMinSubmersionRatio: 0.8,
                flaskFillTopCoverageMinRatio: 0.35,
                flaskSpillFlashMs: 180,
                flaskCarryBangDeltaSpeed: 10,
                flaskImpactSpillMinSpeed: 1.9
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
            getWaterSubmersionRatioForRect: () => waterRatio,
            getAstronautRenderedWorldSprite: () => null,
            getRenderedEntityWorldSprite: () => null,
            getSpriteVisibleBounds: () => null,
            getCollectableEntities: () => [flask as any],
            getHeldCollectable: () => flask as any,
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
            saveSound: { currentTime: 0, play: vi.fn(() => Promise.resolve()) } as any,
            emitFlaskSpillParticles: emitSpill
        });

        waterRatio = 0.4;
        runtime.updateHeldCollectablePosition();
        expect(flask.palette).toBe(10);

        now += 800;
        waterRatio = 0;
        runtime.updateHeldCollectablePosition();
        expect(emitSpill).toHaveBeenCalledTimes(1);
        nowSpy.mockRestore();
    });

    it('keeps full palette when leaving water after 2 seconds', () => {
        const flask = {
            type: 'pipe_down_half',
            palette: 30,
            x: 0,
            y: 0,
            velocity: { x: 0, y: 0 },
            setHeldFacing: vi.fn()
        };
        let now = 500;
        const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
        let waterRatio = 0;
        const emitSpill = vi.fn();
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
                throwVelocity: 5.6,
                flaskFillDurationMs: 2000,
                flaskFillMinSubmersionRatio: 0.8,
                flaskFillTopCoverageMinRatio: 0.35,
                flaskSpillFlashMs: 180,
                flaskCarryBangDeltaSpeed: 10,
                flaskImpactSpillMinSpeed: 1.9
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
            getWaterSubmersionRatioForRect: () => waterRatio,
            getAstronautRenderedWorldSprite: () => null,
            getRenderedEntityWorldSprite: () => null,
            getSpriteVisibleBounds: () => null,
            getCollectableEntities: () => [flask as any],
            getHeldCollectable: () => flask as any,
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
            saveSound: { currentTime: 0, play: vi.fn(() => Promise.resolve()) } as any,
            emitFlaskSpillParticles: emitSpill
        });

        waterRatio = 0.5;
        runtime.updateHeldCollectablePosition();
        now += 2200;
        runtime.updateHeldCollectablePosition();
        // Temporary non-water overlap after commitment must not spill.
        now += 30;
        waterRatio = 0;
        runtime.updateHeldCollectablePosition();
        expect(flask.palette).toBe(10);
        expect(emitSpill).not.toHaveBeenCalled();
        // Re-entering water should not restart a spill-prone timer.
        now += 30;
        waterRatio = 0.5;
        runtime.updateHeldCollectablePosition();
        waterRatio = 0;
        now += 10;
        runtime.updateHeldCollectablePosition();

        expect(flask.palette).toBe(10);
        expect(emitSpill).not.toHaveBeenCalled();
        nowSpy.mockRestore();
    });

    it('does not spill immediately when dropping a full flask', () => {
        const flask = {
            type: 'pipe_down_half',
            palette: 10,
            x: 0,
            y: 0,
            velocity: { x: 0, y: 0 },
            setHeldFacing: vi.fn(),
            release: vi.fn()
        };
        const emitSpill = vi.fn();
        let held: any = flask;
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
                throwVelocity: 5.6,
                flaskFillDurationMs: 2000,
                flaskFillMinSubmersionRatio: 0.8,
                flaskFillTopCoverageMinRatio: 0.35,
                flaskSpillFlashMs: 180,
                flaskCarryBangDeltaSpeed: 10,
                flaskImpactSpillMinSpeed: 1.9
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
            getWaterSubmersionRatioForRect: () => 0,
            getAstronautRenderedWorldSprite: () => null,
            getRenderedEntityWorldSprite: () => null,
            getSpriteVisibleBounds: () => null,
            getCollectableEntities: () => [flask as any],
            getHeldCollectable: () => held,
            setHeldCollectable: (value) => { held = value; },
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
            saveSound: { currentTime: 0, play: vi.fn(() => Promise.resolve()) } as any,
            emitFlaskSpillParticles: emitSpill
        });

        runtime.releaseHeldCollectable();
        expect(emitSpill).not.toHaveBeenCalled();
    });

    it('spills while held only when impact speed exceeds threshold', () => {
        const flask = {
            type: 'pipe_down_half',
            palette: 10,
            x: 0,
            y: 0,
            velocity: { x: 0, y: 0 },
            setHeldFacing: vi.fn()
        };
        const astronautVelocity = { x: 4.2, y: 0 };
        const emitSpill = vi.fn();
        const runtime = createGameHeldItemRuntime({
            astronaut: { position: { x: 100, y: 120 }, velocity: astronautVelocity },
            movementSettings: {
                heldCollectableVerticalOffset: -6,
                droppedCollectableForwardOffset: 24,
                heldCollectableForwardOffset: 28,
                droppedCollectableMomentumTransfer: 0.75,
                droppedCollectableAstronautIgnoreFrames: 18,
                collectablePickupRange: 52,
                collectableInventoryLimit: 5,
                throwVelocity: 5.6,
                flaskFillDurationMs: 2000,
                flaskFillMinSubmersionRatio: 0.8,
                flaskFillTopCoverageMinRatio: 0.35,
                flaskSpillFlashMs: 180,
                flaskCarryBangDeltaSpeed: 10,
                flaskImpactSpillMinSpeed: 1.9
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
            getWaterSubmersionRatioForRect: () => 0,
            getAstronautRenderedWorldSprite: () => null,
            getRenderedEntityWorldSprite: () => null,
            getSpriteVisibleBounds: () => null,
            getCollectableEntities: () => [flask as any],
            getHeldCollectable: () => flask as any,
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
            saveSound: { currentTime: 0, play: vi.fn(() => Promise.resolve()) } as any,
            emitFlaskSpillParticles: emitSpill
        });

        runtime.updateHeldCollectablePosition();
        astronautVelocity.x = 3.4;
        runtime.updateHeldCollectablePosition();
        expect(emitSpill).toHaveBeenCalledTimes(0);

        astronautVelocity.x = 0;
        runtime.updateHeldCollectablePosition();
        expect(emitSpill).toHaveBeenCalledTimes(1);
    });

    it('fills only when all opaque flask pixels are underwater and spills if any exit before 2s', () => {
        const flask = {
            type: 'pipe_down_half',
            palette: 30,
            x: 0,
            y: 0,
            velocity: { x: 0, y: 0 },
            setHeldFacing: vi.fn()
        };
        let now = 100;
        const nowSpy = vi.spyOn(performance, 'now').mockImplementation(() => now);
        let waterMode: 'partial' | 'full' = 'partial';
        const canvas = {
            width: 2,
            height: 1,
            getContext: () => ({
                getImageData: () => ({
                    data: new Uint8ClampedArray([
                        0, 0, 0, 255,
                        0, 0, 0, 255
                    ])
                })
            })
        } as unknown as HTMLCanvasElement;
        const emitSpill = vi.fn();
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
                throwVelocity: 5.6,
                flaskFillDurationMs: 2000,
                flaskFillMinSubmersionRatio: 0.8,
                flaskFillTopCoverageMinRatio: 0.35,
                flaskSpillFlashMs: 180,
                flaskCarryBangDeltaSpeed: 10,
                flaskImpactSpillMinSpeed: 1.9
            },
            heldCollectableHandInset: 8,
            heldCollectableHandOverlap: -12,
            spriteScale: 1,
            keys: {},
            getPrevKeys: () => ({}),
            getFacingLeft: () => false,
            getFacingSign: () => 1,
            getThrowAngleDegrees: () => 20,
            getAstronautRect: () => ({ left: 80, right: 120, top: 90, bottom: 130 }),
            getEntityCollisionBounds: () => ({ left: -8, right: 8, top: -8, bottom: 8 }),
            getEntityRect: (x, y, bounds) => ({ left: x + bounds.left, right: x + bounds.right, top: y + bounds.top, bottom: y + bounds.bottom }),
            getEntityCenter: (x, y, bounds) => ({ x: x + (bounds.left + bounds.right) / 2, y: y + (bounds.top + bounds.bottom) / 2 }),
            getWaterSubmersionRatioForRect: () => 1,
            getIsWorldPointInWater: (x) => waterMode === 'full' || x < 1,
            getAstronautRenderedWorldSprite: () => null,
            getRenderedEntityWorldSprite: () => ({ canvas, drawX: 0, drawY: 0 }),
            getSpriteVisibleBounds: () => null,
            getCollectableEntities: () => [flask as any],
            getHeldCollectable: () => flask as any,
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
            saveSound: { currentTime: 0, play: vi.fn(() => Promise.resolve()) } as any,
            emitFlaskSpillParticles: emitSpill
        });

        runtime.updateHeldCollectablePosition();
        expect(flask.palette).toBe(30);

        waterMode = 'full';
        runtime.updateHeldCollectablePosition();
        expect(flask.palette).toBe(10);

        now += 500;
        waterMode = 'partial';
        runtime.updateHeldCollectablePosition();
        expect(emitSpill).toHaveBeenCalledTimes(1);
        nowSpy.mockRestore();
    });
});
