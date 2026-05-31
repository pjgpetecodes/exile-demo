// Tracks rolling frame/update/draw costs for HUD and periodic perf console summaries.
type PerformanceSample = {
    frameTimeMs: number;
    updateWorkMs: number;
    mapDrawMs: number;
    entityEffectsDrawMs: number;
    totalFrameMs: number;
};

type PerformanceAccumulator = {
    frameTimeSum: number;
    updateTimeSum: number;
    mapDrawTimeSum: number;
    entityDrawTimeSum: number;
    totalFrameTimeSum: number;
};

type PerformanceWorst = {
    frame: number;
    update: number;
    map: number;
    entities: number;
    total: number;
};

export type PerformanceSnapshot = {
    sampleCount: number;
    sums: PerformanceAccumulator;
    worst: PerformanceWorst;
};

type PerformanceTrackerOptions = {
    windowSize: number;
    consoleSummaryIntervalMs: number;
};

export function createGamePerformanceTracker(options: PerformanceTrackerOptions) {
    const perfFrameTimes = new Float32Array(options.windowSize);
    const perfUpdateTimes = new Float32Array(options.windowSize);
    const perfMapDrawTimes = new Float32Array(options.windowSize);
    const perfEntityDrawTimes = new Float32Array(options.windowSize);
    const perfTotalFrameTimes = new Float32Array(options.windowSize);

    let showPerformanceHud = false;
    let showPerformanceConsoleSummary = false;
    let lastPerformanceConsoleSummaryAt = 0;
    let perfSampleCount = 0;
    let perfSampleIndex = 0;
    let lastFrameTimestamp: number | null = null;
    let sums: PerformanceAccumulator = {
        frameTimeSum: 0,
        updateTimeSum: 0,
        mapDrawTimeSum: 0,
        entityDrawTimeSum: 0,
        totalFrameTimeSum: 0
    };
    let worst: PerformanceWorst = {
        frame: 0,
        update: 0,
        map: 0,
        entities: 0,
        total: 0
    };

    function isEnabled() {
        return showPerformanceHud || showPerformanceConsoleSummary;
    }

    function recomputeWorstPerformanceSample(buffer: Float32Array) {
        let highest = 0;
        for (let index = 0; index < perfSampleCount; index++) {
            if (buffer[index] > highest) {
                highest = buffer[index];
            }
        }
        return highest;
    }

    function formatSummaryLine(label: string, averageMs: number, worstMs: number) {
        return `${label} ${averageMs.toFixed(2)}ms avg / ${worstMs.toFixed(2)}ms worst`;
    }

    function formatFpsFromFrameTime(frameTimeMs: number) {
        if (!Number.isFinite(frameTimeMs) || frameTimeMs <= 0) {
            return 'n/a';
        }
        return (1000 / frameTimeMs).toFixed(1);
    }

    function setHudEnabled(enabled: boolean) {
        showPerformanceHud = enabled;
        if (!isEnabled()) {
            lastFrameTimestamp = null;
        }
    }

    function toggleHudEnabled() {
        setHudEnabled(!showPerformanceHud);
    }

    function getHudEnabled() {
        return showPerformanceHud;
    }

    function setConsoleSummaryEnabled(enabled: boolean) {
        showPerformanceConsoleSummary = enabled;
        if (enabled) {
            lastPerformanceConsoleSummaryAt = 0;
        } else if (!isEnabled()) {
            lastFrameTimestamp = null;
        }
    }

    function toggleConsoleSummaryEnabled() {
        setConsoleSummaryEnabled(!showPerformanceConsoleSummary);
    }

    function startFrame(frameNow: number) {
        const enabled = isEnabled();
        const frameTimeMs = (enabled && lastFrameTimestamp !== null)
            ? frameNow - lastFrameTimestamp
            : 0;
        if (enabled) {
            lastFrameTimestamp = frameNow;
        }
        return {
            enabled,
            frameStartMs: frameNow,
            frameTimeMs
        };
    }

    function recordSample(sample: PerformanceSample, frameNow: number) {
        const replacingExistingSample = perfSampleCount === options.windowSize;
        const replaceIndex = perfSampleIndex;
        const replacedFrameTime = perfFrameTimes[replaceIndex];
        const replacedUpdateTime = perfUpdateTimes[replaceIndex];
        const replacedMapDrawTime = perfMapDrawTimes[replaceIndex];
        const replacedEntityDrawTime = perfEntityDrawTimes[replaceIndex];
        const replacedTotalFrameTime = perfTotalFrameTimes[replaceIndex];

        // Keep rolling sums in sync with the fixed-size ring buffer to avoid rescanning every frame.
        if (replacingExistingSample) {
            sums.frameTimeSum -= replacedFrameTime;
            sums.updateTimeSum -= replacedUpdateTime;
            sums.mapDrawTimeSum -= replacedMapDrawTime;
            sums.entityDrawTimeSum -= replacedEntityDrawTime;
            sums.totalFrameTimeSum -= replacedTotalFrameTime;
        } else {
            perfSampleCount++;
        }

        perfFrameTimes[replaceIndex] = sample.frameTimeMs;
        perfUpdateTimes[replaceIndex] = sample.updateWorkMs;
        perfMapDrawTimes[replaceIndex] = sample.mapDrawMs;
        perfEntityDrawTimes[replaceIndex] = sample.entityEffectsDrawMs;
        perfTotalFrameTimes[replaceIndex] = sample.totalFrameMs;
        sums.frameTimeSum += sample.frameTimeMs;
        sums.updateTimeSum += sample.updateWorkMs;
        sums.mapDrawTimeSum += sample.mapDrawMs;
        sums.entityDrawTimeSum += sample.entityEffectsDrawMs;
        sums.totalFrameTimeSum += sample.totalFrameMs;

        if (sample.frameTimeMs >= worst.frame) {
            worst.frame = sample.frameTimeMs;
        } else if (replacingExistingSample && replacedFrameTime >= worst.frame) {
            worst.frame = recomputeWorstPerformanceSample(perfFrameTimes);
        }

        if (sample.updateWorkMs >= worst.update) {
            worst.update = sample.updateWorkMs;
        } else if (replacingExistingSample && replacedUpdateTime >= worst.update) {
            worst.update = recomputeWorstPerformanceSample(perfUpdateTimes);
        }

        if (sample.mapDrawMs >= worst.map) {
            worst.map = sample.mapDrawMs;
        } else if (replacingExistingSample && replacedMapDrawTime >= worst.map) {
            worst.map = recomputeWorstPerformanceSample(perfMapDrawTimes);
        }

        if (sample.entityEffectsDrawMs >= worst.entities) {
            worst.entities = sample.entityEffectsDrawMs;
        } else if (replacingExistingSample && replacedEntityDrawTime >= worst.entities) {
            worst.entities = recomputeWorstPerformanceSample(perfEntityDrawTimes);
        }

        if (sample.totalFrameMs >= worst.total) {
            worst.total = sample.totalFrameMs;
        } else if (replacingExistingSample && replacedTotalFrameTime >= worst.total) {
            worst.total = recomputeWorstPerformanceSample(perfTotalFrameTimes);
        }

        perfSampleIndex = (perfSampleIndex + 1) % options.windowSize;

        if (
            showPerformanceConsoleSummary &&
            frameNow - lastPerformanceConsoleSummaryAt >= options.consoleSummaryIntervalMs
        ) {
            const sampleCount = Math.max(perfSampleCount, 1);
            const browserLabel = navigator.userAgent.includes('Firefox')
                ? 'Firefox'
                : (navigator.userAgent.includes('Edg') ? 'Edge' : 'Other');
            console.info(
                `[perf][${browserLabel}] ` +
                `${formatSummaryLine('frame', sums.frameTimeSum / sampleCount, worst.frame)} | ` +
                `${formatSummaryLine('update', sums.updateTimeSum / sampleCount, worst.update)} | ` +
                `${formatSummaryLine('map', sums.mapDrawTimeSum / sampleCount, worst.map)} | ` +
                `${formatSummaryLine('entities', sums.entityDrawTimeSum / sampleCount, worst.entities)} | ` +
                `${formatSummaryLine('total', sums.totalFrameTimeSum / sampleCount, worst.total)}`
            );
            lastPerformanceConsoleSummaryAt = frameNow;
        }
    }

    function finalizeFrame(
        frameNow: number,
        frameStartMs: number,
        frameTimeMs: number,
        updateWorkMs: number,
        mapDrawMs: number,
        drawPhaseMs: number
    ) {
        if (!isEnabled()) {
            return;
        }

        const entityEffectsDrawMs = Math.max(0, drawPhaseMs - mapDrawMs);
        const totalFrameMs = performance.now() - frameStartMs;
        recordSample(
            {
                frameTimeMs,
                updateWorkMs,
                mapDrawMs,
                entityEffectsDrawMs,
                totalFrameMs
            },
            frameNow
        );
    }

    function getSnapshot(): PerformanceSnapshot {
        return {
            sampleCount: perfSampleCount,
            sums: { ...sums },
            worst: { ...worst }
        };
    }

    return {
        isEnabled,
        getHudEnabled,
        setHudEnabled,
        toggleHudEnabled,
        setConsoleSummaryEnabled,
        toggleConsoleSummaryEnabled,
        startFrame,
        finalizeFrame,
        getSnapshot,
        formatSummaryLine,
        formatFpsFromFrameTime
    };
}
