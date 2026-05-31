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
    return {
        ...runtimeContext,
        get activeAstronautCollisionProfile() { return state.getActiveAstronautCollisionProfile(); },
        set activeAstronautCollisionProfile(value) { state.setActiveAstronautCollisionProfile(value); },
        get chunkSyncFrameCounter() { return state.getChunkSyncFrameCounter(); },
        set chunkSyncFrameCounter(value) { state.setChunkSyncFrameCounter(value); },
        get currentAstronautChunkActivity() { return state.getCurrentAstronautChunkActivity(); },
        set currentAstronautChunkActivity(value) { state.setCurrentAstronautChunkActivity(value); },
        get currentAstronautRenderState() { return state.getCurrentAstronautRenderState(); },
        set currentAstronautRenderState(value) { state.setCurrentAstronautRenderState(value); },
        get flyDir() { return state.getFlyDir(); },
        set flyDir(value) { state.setFlyDir(value); },
        get flyDownFacingLeft() { return state.getFlyDownFacingLeft(); },
        set flyDownFacingLeft(value) { state.setFlyDownFacingLeft(value); },
        get flyDownMode() { return state.getFlyDownMode(); },
        set flyDownMode(value) { state.setFlyDownMode(value); },
        get flyDownTransitionStep() { return state.getFlyDownTransitionStep(); },
        set flyDownTransitionStep(value) { state.setFlyDownTransitionStep(value); },
        get flyDownTransitionTimer() { return state.getFlyDownTransitionTimer(); },
        set flyDownTransitionTimer(value) { state.setFlyDownTransitionTimer(value); },
        get flyDownTransitioning() { return state.getFlyDownTransitioning(); },
        set flyDownTransitioning(value) { state.setFlyDownTransitioning(value); },
        get flyDownTravelDir() { return state.getFlyDownTravelDir(); },
        set flyDownTravelDir(value) { state.setFlyDownTravelDir(value); },
        get flyHoldTimer() { return state.getFlyHoldTimer(); },
        set flyHoldTimer(value) { state.setFlyHoldTimer(value); },
        get flySwitchStep() { return state.getFlySwitchStep(); },
        set flySwitchStep(value) { state.setFlySwitchStep(value); },
        get flySwitchTimer() { return state.getFlySwitchTimer(); },
        set flySwitchTimer(value) { state.setFlySwitchTimer(value); },
        get flySwitching() { return state.getFlySwitching(); },
        set flySwitching(value) { state.setFlySwitching(value); },
        get isGameLoopRunning() { return state.getIsGameLoopRunning(); },
        set isGameLoopRunning(value) { state.setIsGameLoopRunning(value); },
        get lastAstronautWindAcceleration() { return state.getLastAstronautWindAcceleration(); },
        set lastAstronautWindAcceleration(value) { state.setLastAstronautWindAcceleration(value); },
        get lastFlyFlipSprite() { return state.getLastFlyFlipSprite(); },
        set lastFlyFlipSprite(value) { state.setLastFlyFlipSprite(value); },
        get lastFlySpriteCol() { return state.getLastFlySpriteCol(); },
        set lastFlySpriteCol(value) { state.setLastFlySpriteCol(value); },
        get layDownVerticalFlipToggled() { return state.getLayDownVerticalFlipToggled(); },
        set layDownVerticalFlipToggled(value) { state.setLayDownVerticalFlipToggled(value); },
        get prevKeys() { return state.getPrevKeys(); },
        set prevKeys(value) { state.setPrevKeys(value); },
        get proneForcedByGeometry() { return state.getProneForcedByGeometry(); },
        set proneForcedByGeometry(value) { state.setProneForcedByGeometry(value); },
        get pronePoseActive() { return state.getPronePoseActive(); },
        set pronePoseActive(value) { state.setPronePoseActive(value); },
        get simulationFrameCounter() { return state.getSimulationFrameCounter(); },
        set simulationFrameCounter(value) { state.setSimulationFrameCounter(value); },
        get teleportAnimFrame() { return state.getTeleportAnimFrame(); },
        set teleportAnimFrame(value) { state.setTeleportAnimFrame(value); },
        get teleportPhase() { return state.getTeleportPhase(); },
        set teleportPhase(value) { state.setTeleportPhase(value); },
        get teleportSlot() { return state.getTeleportSlot(); },
        set teleportSlot(value) { state.setTeleportSlot(value); },
        get teleportTarget() { return state.getTeleportTarget(); },
        set teleportTarget(value) { state.setTeleportTarget(value); },
        get teleporting() { return state.getTeleporting(); },
        set teleporting(value) { state.setTeleporting(value); },
        get walkAnimFrame() { return state.getWalkAnimFrame(); },
        set walkAnimFrame(value) { state.setWalkAnimFrame(value); },
        get walkAnimTimer() { return state.getWalkAnimTimer(); },
        set walkAnimTimer(value) { state.setWalkAnimTimer(value); }
    };
}
