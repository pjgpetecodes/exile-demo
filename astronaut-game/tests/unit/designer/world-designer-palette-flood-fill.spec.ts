import { describe, expect, it } from 'vitest';
import { fillConnectedPalette } from '../../../src/designer/palette/world-designer-palette-flood-fill.js';

type PaletteEntity = {
    x: number;
    y: number;
    type: string;
    palette: number;
};

function createEntity(x: number, y: number, palette: number, type = 'floor_full'): PaletteEntity {
    return { x, y, type, palette };
}

describe('world designer palette flood fill', () => {
    it('flood-fills touching same-type, same-palette entities', () => {
        const tileSize = 32;
        const entities: PaletteEntity[] = [
            createEntity(0, 0, 1),
            createEntity(tileSize, 0, 1),
            createEntity(tileSize * 2, 0, 1),
            createEntity(0, tileSize, 2),
            createEntity(tileSize, tileSize, 1)
        ];

        const changed = fillConnectedPalette({
            items: entities,
            seed: entities[0],
            tileSize,
            toPalette: 3
        });

        expect(changed).toBe(4);
        expect(entities[0].palette).toBe(3);
        expect(entities[1].palette).toBe(3);
        expect(entities[2].palette).toBe(3);
        expect(entities[4].palette).toBe(3);
        expect(entities[3].palette).toBe(2);
    });

    it('does not cross through an adjoining different palette', () => {
        const tileSize = 32;
        const entities: PaletteEntity[] = [
            createEntity(0, 0, 1),
            createEntity(tileSize, 0, 2),
            createEntity(tileSize * 2, 0, 1)
        ];

        const changed = fillConnectedPalette({
            items: entities,
            seed: entities[0],
            tileSize,
            toPalette: 4
        });

        expect(changed).toBe(1);
        expect(entities[0].palette).toBe(4);
        expect(entities[1].palette).toBe(2);
        expect(entities[2].palette).toBe(1);
    });

    it('does not cross to a different sprite type', () => {
        const tileSize = 32;
        const entities: PaletteEntity[] = [
            createEntity(0, 0, 1, 'floor_full'),
            createEntity(tileSize, 0, 1, 'floor_diag_full')
        ];

        const changed = fillConnectedPalette({
            items: entities,
            seed: entities[0],
            tileSize,
            toPalette: 5
        });

        expect(changed).toBe(1);
        expect(entities[0].palette).toBe(5);
        expect(entities[1].palette).toBe(1);
    });
});
