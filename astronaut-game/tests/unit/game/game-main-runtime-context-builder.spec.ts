import { describe, expect, it, vi } from 'vitest';
import { createExtraRuntimeContextFromState } from '../../../src/game/runtime/game-main-runtime-context-builder.js';

describe('createExtraRuntimeContextFromState', () => {
    it('forwards save APIs for designer host wiring', () => {
        const saveWorldData = vi.fn();
        const savePaletteDefinitions = vi.fn();
        const context = createExtraRuntimeContextFromState({
            saveWorldData,
            savePaletteDefinitions
        });

        expect(context.saveWorldData).toBe(saveWorldData);
        expect(context.savePaletteDefinitions).toBe(savePaletteDefinitions);
    });

    it('forwards teleport runtime fields for remember and teleport flow', () => {
        const teleportLocations = [{ x: 10, y: 20 }];
        const context = createExtraRuntimeContextFromState({
            teleportLocations,
            teleportSpriteCol: 7,
            teleportFlipSprite: true,
            teleportFlipVertical: false
        });

        expect(context.teleportLocations).toBe(teleportLocations);
        expect(context.teleportSpriteCol).toBe(7);
        expect(context.teleportFlipSprite).toBe(true);
        expect(context.teleportFlipVertical).toBe(false);
    });
});
