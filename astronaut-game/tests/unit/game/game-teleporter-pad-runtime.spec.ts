import { describe, expect, it } from 'vitest';
import type { MapBlock } from '../../../src/world/map.js';
import type { TeleporterRuntime } from '../../../src/game/teleporter/game-teleporter-runtime.js';
import { createTeleporterPadRuntime } from '../../../src/game/teleporter/game-teleporter-pad-runtime.js';

describe('createTeleporterPadRuntime', () => {
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
});
