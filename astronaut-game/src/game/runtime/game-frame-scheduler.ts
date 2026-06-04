// Frame scheduler chooses rAF vs throttled timeout based on visibility and simulation activity.
type ScheduledFrameMode = 'raf' | 'timeout' | null;

type GameFrameSchedulerOptions = {
    idleFrameDelayMs: number;
    hiddenFrameDelayMs: number;
    shouldRunInteractiveFrameRate: () => boolean;
    canRunFrames: () => boolean;
    runFrame: () => void;
};

export function createGameFrameScheduler(options: GameFrameSchedulerOptions) {
    let scheduledFrameMode: ScheduledFrameMode = null;
    let scheduledFrameHandle: number | null = null;

    function clearScheduledFrame() {
        if (scheduledFrameMode === 'raf' && scheduledFrameHandle !== null) {
            window.cancelAnimationFrame(scheduledFrameHandle);
        } else if (scheduledFrameMode === 'timeout' && scheduledFrameHandle !== null) {
            window.clearTimeout(scheduledFrameHandle);
        }

        scheduledFrameMode = null;
        scheduledFrameHandle = null;
    }

    function requestImmediateFrame() {
        if (!options.canRunFrames() || scheduledFrameMode === 'raf') {
            return;
        }

        if (scheduledFrameMode === 'timeout') {
            clearScheduledFrame();
        }

        scheduledFrameMode = 'raf';
        scheduledFrameHandle = window.requestAnimationFrame(() => {
            scheduledFrameMode = null;
            scheduledFrameHandle = null;
            options.runFrame();
        });
    }

    function scheduleNextFrame() {
        if (!options.canRunFrames() || scheduledFrameMode !== null) {
            return;
        }

        const delayMs = document.visibilityState === 'hidden'
            ? options.hiddenFrameDelayMs
            : (options.shouldRunInteractiveFrameRate() ? 0 : options.idleFrameDelayMs);

        if (delayMs === 0) {
            requestImmediateFrame();
            return;
        }

        scheduledFrameMode = 'timeout';
        scheduledFrameHandle = window.setTimeout(() => {
            scheduledFrameMode = null;
            scheduledFrameHandle = null;
            requestImmediateFrame();
        }, delayMs);
    }

    return {
        clearScheduledFrame,
        requestImmediateFrame,
        scheduleNextFrame
    };
}
