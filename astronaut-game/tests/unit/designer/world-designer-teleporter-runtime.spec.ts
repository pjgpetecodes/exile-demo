import { describe, expect, it } from 'vitest';
import type { RawWorldData } from '../../../src/designer/core/world-designer-types.js';
import { createWorldDesignerTeleporterRuntime } from '../../../src/designer/teleporters/world-designer-teleporter-runtime.js';

function createRawWorldData(): RawWorldData {
    return {
        worldMap: [],
        buttons: [],
        doors: [],
        creatures: [],
        collectables: [],
        teleporters: [],
        astronautStart: { x: 0, y: 0 }
    };
}

describe('createWorldDesignerTeleporterRuntime', () => {
    it('maps pad rotation 1 to the same base rotation as rotation 3', () => {
        const rawWorldData = createRawWorldData();
        const runtime = createWorldDesignerTeleporterRuntime({
            host: { getRawWorldData: () => rawWorldData },
            state: { palette: 0, rotation: 0 },
            tileSize: 32,
            normalizeRotation: (rotation) => rotation,
            applyPosition: () => undefined,
            getWorldBlocks: () => [],
            getContextMenuActionSelections: () => []
        });

        expect(runtime.getTeleporterBaseRotationForPadRotation(1)).toBe(5);
        expect(runtime.getTeleporterBaseRotationForPadRotation(3)).toBe(5);
    });
});
