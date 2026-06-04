type FlightPoseTransitionFrame = {
    col: number;
    flip: boolean;
    flipVertical: boolean;
};

type AstronautFlightHelperOptions = {
    getLastFlySpriteCol: () => number;
    getLastFlyFlipSprite: () => boolean;
    getAstronautVelocityX: () => number;
    getFacingLeft: () => boolean;
    getLeftPressed: () => boolean;
    getRightPressed: () => boolean;
    spriteCols: {
        stand: number;
        flyRight: number;
        flyDiagonal: number;
        flyDown: number;
        flyFloat: number;
    };
};

export function createAstronautFlightHelpers(options: AstronautFlightHelperOptions) {
    function getDirectDownTransitionSequence(targetFacingLeft: boolean): FlightPoseTransitionFrame[] {
        const lastFlySpriteCol = options.getLastFlySpriteCol();
        const lastFlyFlipSprite = options.getLastFlyFlipSprite();
        const startCol =
            lastFlySpriteCol === options.spriteCols.flyRight ||
            lastFlySpriteCol === options.spriteCols.flyDiagonal ||
            lastFlySpriteCol === options.spriteCols.flyDown ||
            lastFlySpriteCol === options.spriteCols.flyFloat
                ? lastFlySpriteCol
                : options.spriteCols.stand;

        const startFlip =
            startCol === options.spriteCols.flyDown
                ? lastFlyFlipSprite
                : startCol === options.spriteCols.stand
                    ? targetFacingLeft
                    : lastFlyFlipSprite;

        if (
            startCol === options.spriteCols.flyRight ||
            startCol === options.spriteCols.flyDiagonal ||
            startCol === options.spriteCols.flyFloat
        ) {
            return [
                { col: startCol, flip: startFlip, flipVertical: false },
                { col: options.spriteCols.flyDown, flip: targetFacingLeft, flipVertical: false },
                { col: options.spriteCols.stand, flip: targetFacingLeft, flipVertical: true }
            ];
        }

        return [
            { col: startCol, flip: startFlip, flipVertical: false },
            { col: options.spriteCols.stand, flip: targetFacingLeft, flipVertical: true }
        ];
    }

    function getHorizontalTravelDirection(keys: Record<string, boolean>): 'left' | 'right' | null {
        if (keys.q && !keys.w) {
            return 'left';
        }
        if (keys.w && !keys.q) {
            return 'right';
        }
        if (Math.abs(options.getAstronautVelocityX()) > 0.01) {
            return options.getAstronautVelocityX() < 0 ? 'left' : 'right';
        }
        if (options.getLeftPressed() !== options.getRightPressed()) {
            return options.getLeftPressed() ? 'left' : 'right';
        }
        return null;
    }

    function getAstronautFacingDirectionForFlyPose(keys: Record<string, boolean>): 'left' | 'right' {
        const travelDirection = getHorizontalTravelDirection(keys);
        if (travelDirection) {
            return travelDirection;
        }
        if (Math.abs(options.getAstronautVelocityX()) > 0.01) {
            return options.getAstronautVelocityX() < 0 ? 'left' : 'right';
        }
        return options.getFacingLeft() ? 'left' : 'right';
    }

    return {
        getDirectDownTransitionSequence,
        getHorizontalTravelDirection,
        getAstronautFacingDirectionForFlyPose
    };
}
