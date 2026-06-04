export type LoopAnimationState = {
    spriteCol: number;
    flipSprite: boolean;
    flipVertical: boolean;
    pronePoseActive: boolean;
    walkAnimFrame: number;
    walkAnimTimer: number;
    flyHoldTimer: number;
    flyDir: 'left' | 'right' | null;
    flySwitching: boolean;
    flySwitchStep: number;
    flySwitchTimer: number;
    flyDownTransitioning: boolean;
    flyDownTransitionStep: number;
    flyDownTransitionTimer: number;
    flyDownTravelDir: 'left' | 'right' | null;
    flyDownFacingLeft: boolean;
    flyDownMode: 'direct' | 'diagonal' | null;
};

export function resolveAstronautAnimationPose(options: {
    state: LoopAnimationState;
    gameState: { astronaut: { isLanded: boolean; velocity: { x: number; y: number } }; debugMode: boolean };
    keys: Record<string, boolean>;
    controls: {
        downPressed: boolean;
        upPressed: boolean;
        walkSpeed: number;
        facingLeft: boolean;
        proneForcedByGeometry: boolean;
        layDownVerticalFlipToggled: boolean;
    };
    constants: {
        SPRITE_COL_FLY_RIGHT: number;
        SPRITE_COL_FLY_DIAGONAL: number;
        SPRITE_COL_FLY_FLOAT: number;
        SPRITE_COL_FLY_DOWN: number;
        SPRITE_COL_STAND: number;
        SPRITE_COL_WALK_START: number;
        SPRITE_COL_WALK_END: number;
    };
    helpers: {
        getHorizontalTravelDirection: (keys: Record<string, boolean>) => 'left' | 'right' | null;
        getDirectDownTransitionSequence: (facingLeft: boolean) => Array<{ col: number; flip: boolean; flipVertical: boolean }>;
        getAstronautFacingDirectionForFlyPose: (keys: Record<string, boolean>) => 'left' | 'right';
        resetFlyDownAnimationState: () => void;
        resetFlySwitchAnimationState: () => void;
        rememberLastFlyPose: (spriteCol: number, flipSprite: boolean) => void;
    };
}) {
    const { state, gameState, keys, controls, constants, helpers } = options;
    const horizontalTravelDir = helpers.getHorizontalTravelDirection(keys);
    const diagonalDownPressed = !!(
        !gameState.astronaut.isLanded &&
        controls.downPressed &&
        horizontalTravelDir &&
        (keys['q'] || keys['w'])
    );
    const directDownPressed = !gameState.astronaut.isLanded && controls.downPressed && !keys['q'] && !keys['w'];

    if (diagonalDownPressed) {
        helpers.resetFlyDownAnimationState();
        state.spriteCol = constants.SPRITE_COL_FLY_DOWN;
        state.flipSprite = horizontalTravelDir === 'right';
        state.flyDownMode = 'diagonal';
        state.flyDownTravelDir = horizontalTravelDir;
        state.flyDownFacingLeft = horizontalTravelDir === 'left';
        state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
        state.walkAnimTimer = 0;
        state.flyHoldTimer = 0;
        state.flyDir = null;
        helpers.resetFlySwitchAnimationState();
        helpers.rememberLastFlyPose(state.spriteCol, state.flipSprite);
    } else if (directDownPressed) {
        const directDownFacingLeft = horizontalTravelDir ? horizontalTravelDir === 'right' : controls.facingLeft;
        const flyDownSeq = helpers.getDirectDownTransitionSequence(directDownFacingLeft);
        if (
            !state.flyDownTransitioning ||
            state.flyDownMode !== 'direct' ||
            state.flyDownFacingLeft !== directDownFacingLeft ||
            state.flyDownTravelDir !== horizontalTravelDir
        ) {
            state.flyDownMode = 'direct';
            state.flyDownTravelDir = horizontalTravelDir;
            state.flyDownFacingLeft = directDownFacingLeft;
            state.flyDownTransitionStep = 0;
            state.flyDownTransitioning = true;
            state.flyDownTransitionTimer = 0;
        }
        state.spriteCol = flyDownSeq[state.flyDownTransitionStep].col;
        state.flipSprite = flyDownSeq[state.flyDownTransitionStep].flip;
        state.flipVertical = flyDownSeq[state.flyDownTransitionStep].flipVertical;
        state.flyDownTransitionTimer += 1 / 60;
        if (state.flyDownTransitionStep < flyDownSeq.length - 1 && state.flyDownTransitionTimer > 0.08) {
            state.flyDownTransitionStep += 1;
            state.flyDownTransitionTimer = 0;
        }
        state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
        state.walkAnimTimer = 0;
        state.flyHoldTimer = 0;
        state.flyDir = null;
        helpers.resetFlySwitchAnimationState();
        helpers.rememberLastFlyPose(state.spriteCol, state.flipSprite);
    } else if (gameState.astronaut.isLanded && controls.walkSpeed > 0 && !keys['Shift']) {
        if (gameState.debugMode) {
            // Intentionally retained for parity with existing debug branch behavior.
        }
        state.walkAnimTimer += 1 / 60;
        if (state.walkAnimTimer > 0.05) {
            state.walkAnimFrame += 1;
            if (state.walkAnimFrame > constants.SPRITE_COL_WALK_END) {
                state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
            }
            state.walkAnimTimer = 0;
        }
        state.spriteCol = state.walkAnimFrame;
        helpers.resetFlyDownAnimationState();
        state.flyHoldTimer = 0;
        state.flyDir = null;
        helpers.resetFlySwitchAnimationState();
    } else if (gameState.astronaut.isLanded) {
        state.spriteCol = constants.SPRITE_COL_STAND;
        state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
        state.walkAnimTimer = 0;
        helpers.resetFlyDownAnimationState();
        state.flyHoldTimer = 0;
        state.flyDir = null;
        helpers.resetFlySwitchAnimationState();
    } else if (!gameState.astronaut.isLanded && (keys['q'] || keys['w'])) {
        helpers.resetFlyDownAnimationState();
        let currentDir: 'left' | 'right' = keys['w'] ? 'right' : 'left';
        if (controls.upPressed) {
            state.spriteCol = constants.SPRITE_COL_FLY_DIAGONAL;
            state.flipSprite = currentDir === 'left';
            helpers.resetFlySwitchAnimationState();
            state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
            state.walkAnimTimer = 0;
            helpers.rememberLastFlyPose(state.spriteCol, state.flipSprite);
        } else {
            if (state.flyDir && state.flyDir !== currentDir) {
                state.flySwitching = true;
                state.flySwitchStep = 0;
                state.flySwitchTimer = 0;
            }
            state.flyDir = currentDir;
            if (state.flySwitching) {
                const switchSeq = [
                    { col: constants.SPRITE_COL_FLY_DIAGONAL, flip: state.flyDir === 'left' },
                    { col: constants.SPRITE_COL_FLY_FLOAT, flip: state.flyDir === 'left' },
                    { col: constants.SPRITE_COL_FLY_FLOAT, flip: state.flyDir === 'right' },
                    { col: constants.SPRITE_COL_FLY_DIAGONAL, flip: state.flyDir === 'right' },
                    { col: constants.SPRITE_COL_FLY_RIGHT, flip: state.flyDir === 'right' }
                ];
                state.spriteCol = switchSeq[state.flySwitchStep].col;
                state.flipSprite = switchSeq[state.flySwitchStep].flip;
                helpers.rememberLastFlyPose(state.spriteCol, state.flipSprite);
                state.flySwitchTimer += 1 / 60;
                if (state.flySwitchTimer > 0.05) {
                    state.flySwitchStep += 1;
                    state.flySwitchTimer = 0;
                }
                if (state.flySwitchStep >= switchSeq.length) {
                    state.flySwitching = false;
                    state.flyHoldTimer = 0;
                }
                state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
                state.walkAnimTimer = 0;
            } else {
                state.flyHoldTimer += 1 / 60;
                if (state.flyHoldTimer <= 0.25) {
                    state.spriteCol = constants.SPRITE_COL_FLY_DIAGONAL;
                    state.flipSprite = state.flyDir === 'left';
                } else {
                    state.spriteCol = constants.SPRITE_COL_FLY_RIGHT;
                    state.flipSprite = state.flyDir === 'left';
                }
                helpers.rememberLastFlyPose(state.spriteCol, state.flipSprite);
                state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
                state.walkAnimTimer = 0;
            }
        }
    } else if (
        !gameState.astronaut.isLanded &&
        !keys['q'] &&
        !keys['w'] &&
        gameState.astronaut.velocity.y < -0.01 &&
        Math.abs(gameState.astronaut.velocity.x) <= 0.01
    ) {
        state.spriteCol = constants.SPRITE_COL_STAND;
        state.flipSprite = controls.facingLeft;
        helpers.resetFlyDownAnimationState();
        state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
        state.walkAnimTimer = 0;
        state.flyHoldTimer = 0;
        state.flyDir = null;
        helpers.resetFlySwitchAnimationState();
        helpers.rememberLastFlyPose(state.spriteCol, state.flipSprite);
    } else if (
        !gameState.astronaut.isLanded &&
        !keys['q'] &&
        !keys['w'] &&
        Math.abs(gameState.astronaut.velocity.x) > 0.01
    ) {
        state.spriteCol = constants.SPRITE_COL_FLY_FLOAT;
        state.flipSprite = controls.facingLeft;
        helpers.resetFlyDownAnimationState();
        state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
        state.walkAnimTimer = 0;
        state.flyHoldTimer = 0;
        state.flyDir = null;
        helpers.resetFlySwitchAnimationState();
        helpers.rememberLastFlyPose(state.spriteCol, state.flipSprite);
    } else {
        if (gameState.debugMode) {
            // Intentionally retained for parity with existing debug branch behavior.
        }
        state.walkAnimFrame = constants.SPRITE_COL_WALK_START;
        state.walkAnimTimer = 0;
        helpers.resetFlyDownAnimationState();
        state.flyHoldTimer = 0;
        state.flyDir = null;
        helpers.resetFlySwitchAnimationState();
    }

    if (keys['Shift'] || (!gameState.astronaut.isLanded && controls.proneForcedByGeometry)) {
        state.spriteCol = constants.SPRITE_COL_FLY_RIGHT;
        state.flipSprite = helpers.getAstronautFacingDirectionForFlyPose(keys) === 'left';
        state.flipVertical = controls.layDownVerticalFlipToggled;
        state.pronePoseActive = true;
        helpers.rememberLastFlyPose(state.spriteCol, state.flipSprite);
    }

    return state;
}
