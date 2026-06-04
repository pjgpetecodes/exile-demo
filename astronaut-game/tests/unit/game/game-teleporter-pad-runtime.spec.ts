import { describe, expect, it } from 'vitest';
import type { MapBlock } from '../../../src/world/map.js';
import type { TeleporterRuntime } from '../../../src/game/teleporter/game-teleporter-runtime.js';
import { createTeleporterPadRuntime } from '../../../src/game/teleporter/game-teleporter-pad-runtime.js';

describe('createTeleporterPadRuntime', () => {
    it('adopts nearby unclaimed pad/base blocks when teleporter runtime coordinates are stale', () => {
        const teleporter: TeleporterRuntime = {
            id: 'teleporter_stale',
            baseX: 99,
            baseY: 100,
            padX: 99,
            padY: 100,
            enabled: true,
            requiresKey: false,
            destinationA: { x: 0, y: 0 },
            destinationB: null,
            activeDestinationIndex: 0
        };
        const mapBlocks: MapBlock[] = [
            {
                x: 100,
                y: 100,
                type: 'teleporter',
                rotation: 5,
                palette: 1,
                translation: 'center',
                collision: true,
                maskAstronaut: false
            },
            {
                x: 100,
                y: 100,
                type: 'teleporter_pad',
                rotation: 3,
                palette: 2,
                translation: 'center',
                collision: false,
                maskAstronaut: false
            }
        ];
        const runtime = createTeleporterPadRuntime({
            spriteScale: 1,
            getMapBlocks: () => mapBlocks,
            getTeleporters: () => [teleporter],
            getCanvasSize: () => ({ width: 640, height: 480 }),
            getRenderedEntityWorldSprite: () => null,
            normalizeSpriteTranslation: (translation) => (translation ?? 'center'),
            getSpriteVisibleBounds: () => null,
            drawEntities: () => undefined
        });

        const [pad] = runtime.getRenderPads(0, { activeOnly: true, fixedProgress: 1, ignoreKeyRequirement: true });

        expect(teleporter.baseX).toBe(100);
        expect(teleporter.baseY).toBe(100);
        expect(teleporter.padX).toBe(100);
        expect(teleporter.padY).toBe(100);
        expect(mapBlocks[0].teleporterId).toBe('teleporter_stale');
        expect(mapBlocks[1].teleporterId).toBe('teleporter_stale');
        expect(pad.rotation).toBe(3);
        expect(pad.palette).toBe(2);
        const padKeys = runtime.getTeleporterPadKeySet();
        expect(padKeys.has('100,100')).toBe(true);
        expect(padKeys.has('99,100')).toBe(false);
    });

    it('animates rotation 3 pads even when the primary up-sweep span collapses', () => {
        const teleporter: TeleporterRuntime = {
            id: 'teleporter_1',
            baseX: 100,
            baseY: 100,
            padX: 100,
            padY: 100,
            enabled: true,
            requiresKey: false,
            destinationA: { x: 0, y: 0 },
            destinationB: null,
            activeDestinationIndex: 0
        };
        const mapBlocks: MapBlock[] = [
            {
                x: 100,
                y: 100,
                type: 'teleporter',
                rotation: 5,
                palette: 1,
                translation: 'center',
                collision: true,
                maskAstronaut: false,
                teleporterId: teleporter.id
            },
            {
                x: 100,
                y: 100,
                type: 'teleporter_pad',
                rotation: 3,
                palette: 1,
                translation: 'center',
                collision: false,
                maskAstronaut: false,
                teleporterId: teleporter.id
            }
        ];

        const baseCanvas = {} as HTMLCanvasElement;
        const padCanvas = {} as HTMLCanvasElement;
        const runtime = createTeleporterPadRuntime({
            spriteScale: 1,
            getMapBlocks: () => mapBlocks,
            getTeleporters: () => [teleporter],
            getCanvasSize: () => ({ width: 640, height: 480 }),
            getRenderedEntityWorldSprite: (entity) => {
                if (entity.type === 'teleporter') {
                    return { canvas: baseCanvas, drawX: 100, drawY: 100 };
                }
                return { canvas: padCanvas, drawX: 100, drawY: 100 };
            },
            normalizeSpriteTranslation: (translation) => (translation ?? 'center'),
            getSpriteVisibleBounds: (canvas) => {
                if (canvas === baseCanvas) {
                    return { minX: 0, minY: 20, maxX: 31, maxY: 31 };
                }
                return { minX: 0, minY: 15, maxX: 31, maxY: 16 };
            },
            drawEntities: () => undefined
        });

        const start = runtime.getRenderPads(0, { activeOnly: true, fixedProgress: 0, ignoreKeyRequirement: true });
        const end = runtime.getRenderPads(0, { activeOnly: true, fixedProgress: 1, ignoreKeyRequirement: true });

        expect(start).toHaveLength(1);
        expect(end).toHaveLength(1);
        expect(end[0].y).toBeLessThan(start[0].y);
        expect(start[0].y - end[0].y).toBeGreaterThan(8);
        expect(end[0].y).toBeGreaterThanOrEqual(84);
        expect(end[0].y).toBeLessThanOrEqual(115);
    });

    it('keeps rotation 3 pad sweep in transparent area above base pixels', () => {
        const teleporter: TeleporterRuntime = {
            id: 'teleporter_2',
            baseX: 100,
            baseY: 100,
            padX: 100,
            padY: 100,
            enabled: true,
            requiresKey: false,
            destinationA: { x: 0, y: 0 },
            destinationB: null,
            activeDestinationIndex: 0
        };
        const mapBlocks: MapBlock[] = [
            {
                x: 100,
                y: 100,
                type: 'teleporter',
                rotation: 5,
                palette: 1,
                translation: 'center',
                collision: true,
                maskAstronaut: false,
                teleporterId: teleporter.id
            },
            {
                x: 100,
                y: 100,
                type: 'teleporter_pad',
                rotation: 3,
                palette: 1,
                translation: 'center',
                collision: false,
                maskAstronaut: false,
                teleporterId: teleporter.id
            }
        ];

        const baseCanvas = {} as HTMLCanvasElement;
        const padCanvas = {} as HTMLCanvasElement;
        const runtime = createTeleporterPadRuntime({
            spriteScale: 1,
            getMapBlocks: () => mapBlocks,
            getTeleporters: () => [teleporter],
            getCanvasSize: () => ({ width: 640, height: 480 }),
            getRenderedEntityWorldSprite: (entity) => {
                if (entity.type === 'teleporter') {
                    return { canvas: baseCanvas, drawX: 100, drawY: 100 };
                }
                return { canvas: padCanvas, drawX: 100, drawY: 100 };
            },
            normalizeSpriteTranslation: (translation) => (translation ?? 'center'),
            getSpriteVisibleBounds: (canvas) => {
                if (canvas === baseCanvas) {
                    // Base occupies only the lower stripe of its 32x32 tile.
                    return { minX: 0, minY: 20, maxX: 31, maxY: 31 };
                }
                // Pad visible pixels are a thin horizontal line.
                return { minX: 0, minY: 15, maxX: 31, maxY: 16 };
            },
            drawEntities: () => undefined
        });

        const pads = runtime.getRenderPads(0, { activeOnly: true, ignoreKeyRequirement: true });
        expect(pads).toHaveLength(1);
        const pad = pads[0];
        const padVisibleBottom = pad.y + 17;
        const baseVisibleTop = 120;

        expect(padVisibleBottom).toBeLessThanOrEqual(baseVisibleTop);
    });

    it('parks disabled pads at the sweep start near the base', () => {
        const teleporter: TeleporterRuntime = {
            id: 'teleporter_disabled',
            baseX: 100,
            baseY: 100,
            padX: 100,
            padY: 100,
            enabled: true,
            requiresKey: false,
            destinationA: { x: 0, y: 0 },
            destinationB: null,
            activeDestinationIndex: 0
        };
        const mapBlocks: MapBlock[] = [
            {
                x: 100,
                y: 100,
                type: 'teleporter',
                rotation: 5,
                palette: 1,
                translation: 'center',
                collision: true,
                maskAstronaut: false,
                teleporterId: teleporter.id
            },
            {
                x: 100,
                y: 100,
                type: 'teleporter_pad',
                rotation: 3,
                palette: 1,
                translation: 'center',
                collision: false,
                maskAstronaut: false,
                teleporterId: teleporter.id
            }
        ];

        const baseCanvas = {} as HTMLCanvasElement;
        const padCanvas = {} as HTMLCanvasElement;
        const runtime = createTeleporterPadRuntime({
            spriteScale: 1,
            getMapBlocks: () => mapBlocks,
            getTeleporters: () => [teleporter],
            getCanvasSize: () => ({ width: 640, height: 480 }),
            getRenderedEntityWorldSprite: (entity) => {
                if (entity.type === 'teleporter') {
                    return { canvas: baseCanvas, drawX: 100, drawY: 100 };
                }
                return { canvas: padCanvas, drawX: 100, drawY: 100 };
            },
            normalizeSpriteTranslation: (translation) => (translation ?? 'center'),
            getSpriteVisibleBounds: (canvas) => {
                if (canvas === baseCanvas) {
                    return { minX: 0, minY: 20, maxX: 31, maxY: 31 };
                }
                return { minX: 0, minY: 15, maxX: 31, maxY: 16 };
            },
            drawEntities: () => undefined
        });

        const [enabledStart] = runtime.getRenderPads(0, { activeOnly: true, fixedProgress: 0, ignoreKeyRequirement: true });
        teleporter.enabled = false;
        const [disabledPad] = runtime.getRenderPads(0, { inactiveOnly: true, ignoreKeyRequirement: true });

        expect(disabledPad.y).toBe(enabledStart.y);
    });

    it('prefers pad at teleporter coordinates over farther duplicate blocks with the same id', () => {
        const teleporter: TeleporterRuntime = {
            id: 'teleporter_duplicate',
            baseX: 100,
            baseY: 100,
            padX: 100,
            padY: 100,
            enabled: true,
            requiresKey: false,
            destinationA: { x: 0, y: 0 },
            destinationB: null,
            activeDestinationIndex: 0
        };
        const mapBlocks: MapBlock[] = [
            {
                x: 100,
                y: 100,
                type: 'teleporter',
                rotation: 5,
                palette: 1,
                translation: 'center',
                collision: true,
                maskAstronaut: false,
                teleporterId: teleporter.id
            },
            {
                x: 100,
                y: 100,
                type: 'teleporter_pad',
                rotation: 1,
                palette: 2,
                translation: 'center',
                collision: false,
                maskAstronaut: false,
                teleporterId: teleporter.id
            },
            {
                x: 450,
                y: 450,
                type: 'teleporter_pad',
                rotation: 2,
                palette: 3,
                translation: 'left',
                collision: false,
                maskAstronaut: false,
                teleporterId: teleporter.id
            }
        ];
        const runtime = createTeleporterPadRuntime({
            spriteScale: 1,
            getMapBlocks: () => mapBlocks,
            getTeleporters: () => [teleporter],
            getCanvasSize: () => ({ width: 640, height: 480 }),
            getRenderedEntityWorldSprite: () => null,
            normalizeSpriteTranslation: (translation) => (translation ?? 'center'),
            getSpriteVisibleBounds: () => null,
            drawEntities: () => undefined
        });

        const [pad] = runtime.getRenderPads(0, { activeOnly: true, fixedProgress: 1, ignoreKeyRequirement: true });
        const padKeys = runtime.getTeleporterPadKeySet();

        expect(pad.rotation).toBe(1);
        expect(pad.palette).toBe(2);
        expect(padKeys.has('100,100')).toBe(true);
        expect(padKeys.has('450,450')).toBe(false);
    });

    it('prefers non-masking centered pad when duplicate pads overlap at same coordinates', () => {
        const teleporter: TeleporterRuntime = {
            id: 'teleporter_overlap',
            baseX: 100,
            baseY: 100,
            padX: 100,
            padY: 100,
            enabled: false,
            requiresKey: false,
            destinationA: { x: 0, y: 0 },
            destinationB: null,
            activeDestinationIndex: 0
        };
        const mapBlocks: MapBlock[] = [
            {
                x: 100,
                y: 100,
                type: 'teleporter',
                rotation: 6,
                palette: 2,
                translation: 'center',
                collision: true,
                maskAstronaut: false,
                teleporterId: teleporter.id
            },
            {
                x: 100,
                y: 100,
                type: 'teleporter_pad',
                rotation: 1,
                palette: 2,
                translation: 'center',
                collision: false,
                maskAstronaut: false,
                teleporterId: teleporter.id
            },
            {
                x: 100,
                y: 100,
                type: 'teleporter_pad',
                rotation: 2,
                palette: 1,
                translation: 'left',
                collision: false,
                maskAstronaut: true,
                teleporterId: teleporter.id
            }
        ];
        const runtime = createTeleporterPadRuntime({
            spriteScale: 1,
            getMapBlocks: () => mapBlocks,
            getTeleporters: () => [teleporter],
            getCanvasSize: () => ({ width: 640, height: 480 }),
            getRenderedEntityWorldSprite: () => null,
            normalizeSpriteTranslation: (translation) => (translation ?? 'center'),
            getSpriteVisibleBounds: () => null,
            drawEntities: () => undefined
        });

        const [pad] = runtime.getRenderPads(0, { inactiveOnly: true, ignoreKeyRequirement: true });

        expect(pad.rotation).toBe(1);
        expect(pad.translation).toBe('center');
        expect(pad.palette).toBe(2);
    });

    it('normalizes sideways pad rotations (2/8) to up-facing render rotation', () => {
        for (const sidewaysRotation of [2, 8]) {
            const teleporter: TeleporterRuntime = {
                id: `teleporter_sideways_${sidewaysRotation}`,
                baseX: 100,
                baseY: 100,
                padX: 100,
                padY: 100,
                enabled: true,
                requiresKey: false,
                destinationA: { x: 0, y: 0 },
                destinationB: null,
                activeDestinationIndex: 0
            };
            const mapBlocks: MapBlock[] = [
                {
                    x: 100,
                    y: 100,
                    type: 'teleporter',
                    rotation: 6,
                    palette: 2,
                    translation: 'center',
                    collision: true,
                    maskAstronaut: false,
                    teleporterId: teleporter.id
                },
                {
                    x: 100,
                    y: 100,
                    type: 'teleporter_pad',
                    rotation: sidewaysRotation as MapBlock['rotation'],
                    palette: 2,
                    translation: 'center',
                    collision: false,
                    maskAstronaut: false,
                    teleporterId: teleporter.id
                }
            ];
            const runtime = createTeleporterPadRuntime({
                spriteScale: 1,
                getMapBlocks: () => mapBlocks,
                getTeleporters: () => [teleporter],
                getCanvasSize: () => ({ width: 640, height: 480 }),
                getRenderedEntityWorldSprite: () => null,
                normalizeSpriteTranslation: (translation) => (translation ?? 'center'),
                getSpriteVisibleBounds: () => null,
                drawEntities: () => undefined
            });

            const [pad] = runtime.getRenderPads(0, { activeOnly: true, fixedProgress: 1, ignoreKeyRequirement: true });
            expect(pad.rotation).toBe(1);
        }
    });

});
