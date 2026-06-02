import { describe, expect, it } from 'vitest';
import type { RawWorldData } from '../../../src/designer/core/world-designer-types.js';
import { reconcileTeleporterPairsForSave } from '../../../src/designer/teleporters/world-designer-teleporters.js';

function createWorldData(overrides?: Partial<RawWorldData>): RawWorldData {
    return {
        worldMap: [],
        buttons: [],
        doors: [],
        creatures: [],
        collectables: [],
        teleporters: [],
        astronautStart: { x: 0, y: 0 },
        ...overrides
    };
}

describe('reconcileTeleporterPairsForSave', () => {
    it('creates teleporters from orphan base blocks', () => {
        const data = createWorldData({
            worldMap: [
                { x: 100, y: 100, type: 'teleporter', collision: true, teleporterId: 'tp_a' },
                { x: 132, y: 100, type: 'teleporter_pad', collision: true, teleporterId: 'tp_a' }
            ]
        });

        reconcileTeleporterPairsForSave(data, 32);

        expect(data.teleporters).toHaveLength(1);
        expect(data.teleporters[0].baseX).toBe(100);
        expect(data.teleporters[0].baseY).toBe(100);
        expect(data.teleporters[0].padX).toBe(132);
        expect(data.teleporters[0].padY).toBe(100);
        expect(data.teleporters[0].id).toBe('tp_a');
    });

    it('removes pads that are not linked to a teleporter', () => {
        const data = createWorldData({
            worldMap: [
                { x: 200, y: 200, type: 'teleporter', collision: true, teleporterId: 'tp_1' },
                { x: 232, y: 200, type: 'teleporter_pad', collision: true, teleporterId: 'tp_1' },
                { x: 1000, y: 1000, type: 'teleporter_pad', collision: true, teleporterId: 'orphan_pad' }
            ],
            teleporters: [
                {
                    id: 'tp_1',
                    baseX: 200,
                    baseY: 200,
                    padX: 232,
                    padY: 200,
                    destinationA: { x: 0, y: 0 },
                    destinationB: null,
                    activeDestinationIndex: 0
                }
            ]
        });

        reconcileTeleporterPairsForSave(data, 32);

        expect(data.worldMap.some((block) => block.type === 'teleporter_pad' && block.x === 1000 && block.y === 1000)).toBe(false);
        expect(data.worldMap.some((block) => block.type === 'teleporter_pad' && block.x === 232 && block.y === 200)).toBe(true);
    });
});
