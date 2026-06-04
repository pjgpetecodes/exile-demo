import { describe, expect, it } from 'vitest';
import {
    FLASK_EMPTY_PALETTE,
    FLASK_FULL_PALETTE,
    clearFlaskFillAttempt,
    getFlaskFillStartedAt,
    isFlaskSubmergedForFilling,
    setFlaskPaletteEmpty,
    startFlaskFillAttempt,
    syncFlaskSpillFlash,
    triggerFlaskSpillFlash
} from '../../../src/game/collectables/game-flask-runtime.js';
import type { Collectable } from '../../../src/entities/collectable.js';

function createFlask(): Collectable {
    return { type: 'pipe_down_half', palette: FLASK_EMPTY_PALETTE } as Collectable;
}

describe('game flask runtime', () => {
    it('tracks fill start and clears it', () => {
        const flask = createFlask();
        expect(getFlaskFillStartedAt(flask)).toBeUndefined();
        startFlaskFillAttempt(flask, 100);
        expect(getFlaskFillStartedAt(flask)).toBe(100);
        clearFlaskFillAttempt(flask);
        expect(getFlaskFillStartedAt(flask)).toBeUndefined();
    });

    it('flashes full then returns empty after spill duration', () => {
        const flask = createFlask();
        triggerFlaskSpillFlash(flask, 1000, 150);
        expect(flask.palette).toBe(FLASK_FULL_PALETTE);
        syncFlaskSpillFlash(flask, 1100);
        expect(flask.palette).toBe(FLASK_FULL_PALETTE);
        syncFlaskSpillFlash(flask, 1150);
        expect(flask.palette).toBe(FLASK_EMPTY_PALETTE);
    });

    it('requires deep enough and top-covered water to allow filling', () => {
        const flask = createFlask();
        setFlaskPaletteEmpty(flask);
        const rect = { left: 0, right: 31, top: 0, bottom: 31 };
        const ratios = [
            { top: 0.2, full: 0.9 },
            { top: 0.4, full: 0.65 },
            { top: 0.45, full: 0.85 }
        ];
        const result = ratios.map((sample) =>
            isFlaskSubmergedForFilling({
                rect,
                getWaterSubmersionRatioForRect: (targetRect) => targetRect.bottom <= 7 ? sample.top : sample.full,
                minSubmersionRatio: 0.8,
                minTopCoverageRatio: 0.35
            })
        );
        expect(result).toEqual([false, false, true]);
    });
});
