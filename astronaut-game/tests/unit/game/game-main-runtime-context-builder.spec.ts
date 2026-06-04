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
});
