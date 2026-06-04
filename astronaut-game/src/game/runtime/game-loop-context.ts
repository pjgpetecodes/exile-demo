type RuntimeLoopStateBindings = {
    getActiveAstronautCollisionProfile: () => any;
    setActiveAstronautCollisionProfile: (value: any) => void;
    getChunkSyncFrameCounter: () => number;
    setChunkSyncFrameCounter: (value: number) => void;
    getCurrentAstronautChunkActivity: () => any;
    setCurrentAstronautChunkActivity: (value: any) => void;
    getCurrentAstronautRenderState: () => any;
    setCurrentAstronautRenderState: (value: any) => void;
    getFlyDir: () => any;
    setFlyDir: (value: any) => void;
    getFlyDownFacingLeft: () => any;
    setFlyDownFacingLeft: (value: any) => void;
    getFlyDownMode: () => any;
    setFlyDownMode: (value: any) => void;
    getFlyDownTransitionStep: () => any;
    setFlyDownTransitionStep: (value: any) => void;
    getFlyDownTransitionTimer: () => number;
    setFlyDownTransitionTimer: (value: number) => void;
    getFlyDownTransitioning: () => boolean;
    setFlyDownTransitioning: (value: boolean) => void;
    getFlyDownTravelDir: () => any;
    setFlyDownTravelDir: (value: any) => void;
    getFlyHoldTimer: () => number;
    setFlyHoldTimer: (value: number) => void;
    getFlySwitchStep: () => any;
    setFlySwitchStep: (value: any) => void;
    getFlySwitchTimer: () => number;
    setFlySwitchTimer: (value: number) => void;
    getFlySwitching: () => boolean;
    setFlySwitching: (value: boolean) => void;
    getIsGameLoopRunning: () => boolean;
    setIsGameLoopRunning: (value: boolean) => void;
    getLastAstronautWindAcceleration: () => any;
    setLastAstronautWindAcceleration: (value: any) => void;
    getLastFlyFlipSprite: () => boolean;
    setLastFlyFlipSprite: (value: boolean) => void;
    getLastFlySpriteCol: () => number;
    setLastFlySpriteCol: (value: number) => void;
    getLayDownVerticalFlipToggled: () => boolean;
    setLayDownVerticalFlipToggled: (value: boolean) => void;
    getPrevKeys: () => Record<string, boolean>;
    setPrevKeys: (value: Record<string, boolean>) => void;
    getProneForcedByGeometry: () => boolean;
    setProneForcedByGeometry: (value: boolean) => void;
    getPronePoseActive: () => boolean;
    setPronePoseActive: (value: boolean) => void;
    getSimulationFrameCounter: () => number;
    setSimulationFrameCounter: (value: number) => void;
    getTeleportAnimFrame: () => number;
    setTeleportAnimFrame: (value: number) => void;
    getTeleportPhase: () => any;
    setTeleportPhase: (value: any) => void;
    getTeleportSlot: () => number;
    setTeleportSlot: (value: number) => void;
    getTeleportTarget: () => any;
    setTeleportTarget: (value: any) => void;
    getTeleporting: () => boolean;
    setTeleporting: (value: boolean) => void;
    getWalkAnimFrame: () => number;
    setWalkAnimFrame: (value: number) => void;
    getWalkAnimTimer: () => number;
    setWalkAnimTimer: (value: number) => void;
};

export function createGameLoopRuntimeContext(runtimeContext: Record<string, any>, state: RuntimeLoopStateBindings) {
    const context: Record<string, any> = {};
    Object.assign(context, runtimeContext);
    Object.defineProperties(context, {
        activeAstronautCollisionProfile: { enumerable: true, get: () => state.getActiveAstronautCollisionProfile(), set: (value) => { state.setActiveAstronautCollisionProfile(value); } },
        chunkSyncFrameCounter: { enumerable: true, get: () => state.getChunkSyncFrameCounter(), set: (value) => { state.setChunkSyncFrameCounter(value); } },
        currentAstronautChunkActivity: { enumerable: true, get: () => state.getCurrentAstronautChunkActivity(), set: (value) => { state.setCurrentAstronautChunkActivity(value); } },
        currentAstronautRenderState: { enumerable: true, get: () => state.getCurrentAstronautRenderState(), set: (value) => { state.setCurrentAstronautRenderState(value); } },
        flyDir: { enumerable: true, get: () => state.getFlyDir(), set: (value) => { state.setFlyDir(value); } },
        flyDownFacingLeft: { enumerable: true, get: () => state.getFlyDownFacingLeft(), set: (value) => { state.setFlyDownFacingLeft(value); } },
        flyDownMode: { enumerable: true, get: () => state.getFlyDownMode(), set: (value) => { state.setFlyDownMode(value); } },
        flyDownTransitionStep: { enumerable: true, get: () => state.getFlyDownTransitionStep(), set: (value) => { state.setFlyDownTransitionStep(value); } },
        flyDownTransitionTimer: { enumerable: true, get: () => state.getFlyDownTransitionTimer(), set: (value) => { state.setFlyDownTransitionTimer(value); } },
        flyDownTransitioning: { enumerable: true, get: () => state.getFlyDownTransitioning(), set: (value) => { state.setFlyDownTransitioning(value); } },
        flyDownTravelDir: { enumerable: true, get: () => state.getFlyDownTravelDir(), set: (value) => { state.setFlyDownTravelDir(value); } },
        flyHoldTimer: { enumerable: true, get: () => state.getFlyHoldTimer(), set: (value) => { state.setFlyHoldTimer(value); } },
        flySwitchStep: { enumerable: true, get: () => state.getFlySwitchStep(), set: (value) => { state.setFlySwitchStep(value); } },
        flySwitchTimer: { enumerable: true, get: () => state.getFlySwitchTimer(), set: (value) => { state.setFlySwitchTimer(value); } },
        flySwitching: { enumerable: true, get: () => state.getFlySwitching(), set: (value) => { state.setFlySwitching(value); } },
        isGameLoopRunning: { enumerable: true, get: () => state.getIsGameLoopRunning(), set: (value) => { state.setIsGameLoopRunning(value); } },
        lastAstronautWindAcceleration: { enumerable: true, get: () => state.getLastAstronautWindAcceleration(), set: (value) => { state.setLastAstronautWindAcceleration(value); } },
        lastFlyFlipSprite: { enumerable: true, get: () => state.getLastFlyFlipSprite(), set: (value) => { state.setLastFlyFlipSprite(value); } },
        lastFlySpriteCol: { enumerable: true, get: () => state.getLastFlySpriteCol(), set: (value) => { state.setLastFlySpriteCol(value); } },
        layDownVerticalFlipToggled: { enumerable: true, get: () => state.getLayDownVerticalFlipToggled(), set: (value) => { state.setLayDownVerticalFlipToggled(value); } },
        prevKeys: { enumerable: true, get: () => state.getPrevKeys(), set: (value) => { state.setPrevKeys(value); } },
        proneForcedByGeometry: { enumerable: true, get: () => state.getProneForcedByGeometry(), set: (value) => { state.setProneForcedByGeometry(value); } },
        pronePoseActive: { enumerable: true, get: () => state.getPronePoseActive(), set: (value) => { state.setPronePoseActive(value); } },
        simulationFrameCounter: { enumerable: true, get: () => state.getSimulationFrameCounter(), set: (value) => { state.setSimulationFrameCounter(value); } },
        teleportAnimFrame: { enumerable: true, get: () => state.getTeleportAnimFrame(), set: (value) => { state.setTeleportAnimFrame(value); } },
        teleportPhase: { enumerable: true, get: () => state.getTeleportPhase(), set: (value) => { state.setTeleportPhase(value); } },
        teleportSlot: { enumerable: true, get: () => state.getTeleportSlot(), set: (value) => { state.setTeleportSlot(value); } },
        teleportTarget: { enumerable: true, get: () => state.getTeleportTarget(), set: (value) => { state.setTeleportTarget(value); } },
        teleporting: { enumerable: true, get: () => state.getTeleporting(), set: (value) => { state.setTeleporting(value); } },
        walkAnimFrame: { enumerable: true, get: () => state.getWalkAnimFrame(), set: (value) => { state.setWalkAnimFrame(value); } },
        walkAnimTimer: { enumerable: true, get: () => state.getWalkAnimTimer(), set: (value) => { state.setWalkAnimTimer(value); } }
    });
    return context;
}
