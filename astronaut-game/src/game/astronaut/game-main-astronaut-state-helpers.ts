type CollisionProfile = 'stand' | 'fly_right' | 'fly_diagonal' | 'fly_down' | 'fly_float' | 'prone_up' | 'prone_down';

type CurrentCollisionProfileOptions = {
    getLayDownVerticalFlipToggled: () => boolean;
    getShiftPressed: () => boolean;
    isAstronautLanded: () => boolean;
    getProneForcedByGeometry: () => boolean;
    getDownPressed: () => boolean;
    getQPressed: () => boolean;
    getWPressed: () => boolean;
    getLeftPressed: () => boolean;
    getRightPressed: () => boolean;
    getUpPressed: () => boolean;
    getAstronautVelocityX: () => number;
};

type FlyAnimationStateOptions = {
    setFlySwitching: (value: boolean) => void;
    setFlySwitchStep: (value: number) => void;
    setFlySwitchTimer: (value: number) => void;
    setFlyDownTransitioning: (value: boolean) => void;
    setFlyDownTransitionStep: (value: number) => void;
    setFlyDownTransitionTimer: (value: number) => void;
    setFlyDownTravelDir: (value: 'left' | 'right' | null) => void;
    setFlyDownMode: (value: 'direct' | 'diagonal' | null) => void;
    setLastFlySpriteCol: (value: number) => void;
    setLastFlyFlipSprite: (value: boolean) => void;
};

export function createCurrentAstronautCollisionProfileGetter(options: CurrentCollisionProfileOptions) {
    return function getCurrentAstronautCollisionProfile(): CollisionProfile {
        const proneCollisionProfile = options.getLayDownVerticalFlipToggled() ? 'prone_up' : 'prone_down';
        if (options.getShiftPressed()) {
            return proneCollisionProfile;
        }
        if (!options.isAstronautLanded() && options.getProneForcedByGeometry()) {
            return proneCollisionProfile;
        }
        if (options.isAstronautLanded()) {
            return 'stand';
        }

        if (options.getDownPressed() && !options.getQPressed() && !options.getWPressed()) {
            return 'stand';
        }
        if (options.getDownPressed() && (options.getQPressed() || options.getWPressed())) {
            return 'fly_down';
        }
        if (options.getLeftPressed() || options.getRightPressed()) {
            return options.getUpPressed() ? 'fly_diagonal' : 'fly_right';
        }
        if (Math.abs(options.getAstronautVelocityX()) > 0.01) {
            return 'fly_float';
        }

        return options.getUpPressed() ? 'fly_diagonal' : 'fly_float';
    };
}

export function createFlyAnimationStateHelpers(options: FlyAnimationStateOptions) {
    function resetFlySwitchAnimationState() {
        options.setFlySwitching(false);
        options.setFlySwitchStep(0);
        options.setFlySwitchTimer(0);
    }

    function resetFlyDownAnimationState() {
        options.setFlyDownTransitioning(false);
        options.setFlyDownTransitionStep(0);
        options.setFlyDownTransitionTimer(0);
        options.setFlyDownTravelDir(null);
        options.setFlyDownMode(null);
    }

    function rememberLastFlyPose(col: number, flip: boolean) {
        options.setLastFlySpriteCol(col);
        options.setLastFlyFlipSprite(flip);
    }

    return {
        resetFlySwitchAnimationState,
        resetFlyDownAnimationState,
        rememberLastFlyPose
    };
}
