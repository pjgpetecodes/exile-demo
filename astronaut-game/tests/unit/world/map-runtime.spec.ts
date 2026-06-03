import { beforeAll, describe, expect, it } from 'vitest';

let shouldMaskAstronaut: (block: {
    type: string;
    collision: boolean;
    maskAstronaut?: boolean;
    water?: boolean;
    waterOnly?: boolean;
}) => boolean;

beforeAll(async () => {
    if (!(globalThis as any).Audio) {
        (globalThis as any).Audio = class {
            currentTime = 0;
            loop = false;
            volume = 1;
            play() {
                return Promise.resolve();
            }
            pause() {}
            cloneNode() {
                return new (globalThis as any).Audio();
            }
        };
    }
    const runtime = await import('../../../src/world/map-runtime.js');
    shouldMaskAstronaut = runtime.shouldMaskAstronaut;
});

describe('shouldMaskAstronaut', () => {
    it('never masks for water tiles', () => {
        expect(shouldMaskAstronaut({
            type: 'floor_full',
            collision: false,
            water: true
        })).toBe(false);

        expect(shouldMaskAstronaut({
            type: 'floor_full',
            collision: false,
            waterOnly: true
        })).toBe(false);
    });

    it('masks non-collision non-water tiles by default', () => {
        expect(shouldMaskAstronaut({
            type: 'wall_plant',
            collision: false
        })).toBe(true);
    });
});
