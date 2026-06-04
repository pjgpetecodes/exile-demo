import {
    ChunkActivityBand,
    ChunkActivityRadii
} from '../../types/index.js';

type ChunkSimulationCadencePolicy = Record<ChunkActivityBand, number>;
type ChunkActivityCadenceGroup = {
    creatures: ChunkSimulationCadencePolicy;
    collectables: ChunkSimulationCadencePolicy;
    projectiles: ChunkSimulationCadencePolicy;
    teleporters: ChunkSimulationCadencePolicy;
};

type ChunkActivityTuningSnapshot = {
    radiiChunks: ChunkActivityRadii;
    viewportRadiusScale: ChunkActivityRadii;
    teleportKeepAliveMs: number;
    simulationCadenceFrames: ChunkActivityCadenceGroup;
};

type ChunkActivityCadenceUpdate = Partial<Record<ChunkActivityBand, number>>;

export type ChunkActivityTuningUpdate = {
    radiiChunks?: Partial<ChunkActivityRadii>;
    viewportRadiusScale?: Partial<ChunkActivityRadii>;
    teleportKeepAliveMs?: number;
    simulationCadenceFrames?: {
        creatures?: ChunkActivityCadenceUpdate;
        collectables?: ChunkActivityCadenceUpdate;
        projectiles?: ChunkActivityCadenceUpdate;
        teleporters?: ChunkActivityCadenceUpdate;
    };
};

type ChunkActivityManagerSnapshot = {
    radiiChunks: ChunkActivityRadii;
    viewportRadiusScale: ChunkActivityRadii;
    teleportKeepAliveMs: number;
};

type ChunkActivityManagerApi = {
    updateConfig: (config: ChunkActivityManagerSnapshot) => void;
    getConfigSnapshot: () => ChunkActivityManagerSnapshot;
};

type CreateChunkActivityTuningControllerOptions = {
    manager: ChunkActivityManagerApi;
    deepClone: <T>(value: T) => T;
    defaults: ChunkActivityTuningSnapshot;
};

function sanitizeChunkBandRadius(value: number, fallback: number) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function sanitizeViewportRadiusScale(value: number, fallback: number) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function sanitizeCadenceFrames(value: number, fallback: number) {
    return Number.isFinite(value) ? Math.max(0, Math.floor(value)) : fallback;
}

function applyCadenceUpdate(
    targetCadence: ChunkSimulationCadencePolicy,
    updateCadence: ChunkActivityCadenceUpdate | undefined
) {
    if (!updateCadence) {
        return;
    }
    targetCadence.near = sanitizeCadenceFrames(updateCadence.near ?? targetCadence.near, targetCadence.near);
    targetCadence.mid = sanitizeCadenceFrames(updateCadence.mid ?? targetCadence.mid, targetCadence.mid);
    targetCadence.far = sanitizeCadenceFrames(updateCadence.far ?? targetCadence.far, targetCadence.far);
}

export function createChunkActivityTuningController(options: CreateChunkActivityTuningControllerOptions) {
    const defaultTuning = options.deepClone(options.defaults);
    const chunkActivityTuning: ChunkActivityTuningSnapshot = options.deepClone(defaultTuning);
    const creatureChunkCadence: ChunkSimulationCadencePolicy = {
        near: chunkActivityTuning.simulationCadenceFrames.creatures.near,
        mid: chunkActivityTuning.simulationCadenceFrames.creatures.mid,
        far: chunkActivityTuning.simulationCadenceFrames.creatures.far
    };
    const collectableChunkCadence: ChunkSimulationCadencePolicy = {
        near: chunkActivityTuning.simulationCadenceFrames.collectables.near,
        mid: chunkActivityTuning.simulationCadenceFrames.collectables.mid,
        far: chunkActivityTuning.simulationCadenceFrames.collectables.far
    };
    const projectileChunkCadence: ChunkSimulationCadencePolicy = {
        near: chunkActivityTuning.simulationCadenceFrames.projectiles.near,
        mid: chunkActivityTuning.simulationCadenceFrames.projectiles.mid,
        far: chunkActivityTuning.simulationCadenceFrames.projectiles.far
    };
    const teleporterChunkCadence: ChunkSimulationCadencePolicy = {
        near: chunkActivityTuning.simulationCadenceFrames.teleporters.near,
        mid: chunkActivityTuning.simulationCadenceFrames.teleporters.mid,
        far: chunkActivityTuning.simulationCadenceFrames.teleporters.far
    };

    function applyTuning(update: ChunkActivityTuningUpdate) {
        if (update.radiiChunks) {
            const near = sanitizeChunkBandRadius(
                update.radiiChunks.near ?? chunkActivityTuning.radiiChunks.near,
                chunkActivityTuning.radiiChunks.near
            );
            const mid = Math.max(
                near,
                sanitizeChunkBandRadius(
                    update.radiiChunks.mid ?? chunkActivityTuning.radiiChunks.mid,
                    chunkActivityTuning.radiiChunks.mid
                )
            );
            chunkActivityTuning.radiiChunks = { near, mid };
        }
        if (update.viewportRadiusScale) {
            chunkActivityTuning.viewportRadiusScale = {
                near: sanitizeViewportRadiusScale(
                    update.viewportRadiusScale.near ?? chunkActivityTuning.viewportRadiusScale.near,
                    chunkActivityTuning.viewportRadiusScale.near
                ),
                mid: sanitizeViewportRadiusScale(
                    update.viewportRadiusScale.mid ?? chunkActivityTuning.viewportRadiusScale.mid,
                    chunkActivityTuning.viewportRadiusScale.mid
                )
            };
        }
        if (typeof update.teleportKeepAliveMs === 'number') {
            chunkActivityTuning.teleportKeepAliveMs = Math.max(0, Math.floor(update.teleportKeepAliveMs));
        }
        if (update.simulationCadenceFrames) {
            applyCadenceUpdate(chunkActivityTuning.simulationCadenceFrames.creatures, update.simulationCadenceFrames.creatures);
            applyCadenceUpdate(chunkActivityTuning.simulationCadenceFrames.collectables, update.simulationCadenceFrames.collectables);
            applyCadenceUpdate(chunkActivityTuning.simulationCadenceFrames.projectiles, update.simulationCadenceFrames.projectiles);
            applyCadenceUpdate(chunkActivityTuning.simulationCadenceFrames.teleporters, update.simulationCadenceFrames.teleporters);
        }

        options.manager.updateConfig({
            radiiChunks: chunkActivityTuning.radiiChunks,
            viewportRadiusScale: chunkActivityTuning.viewportRadiusScale,
            teleportKeepAliveMs: chunkActivityTuning.teleportKeepAliveMs
        });
        Object.assign(creatureChunkCadence, chunkActivityTuning.simulationCadenceFrames.creatures);
        Object.assign(collectableChunkCadence, chunkActivityTuning.simulationCadenceFrames.collectables);
        Object.assign(projectileChunkCadence, chunkActivityTuning.simulationCadenceFrames.projectiles);
        Object.assign(teleporterChunkCadence, chunkActivityTuning.simulationCadenceFrames.teleporters);
    }

    function resetTuning() {
        chunkActivityTuning.radiiChunks = options.deepClone(defaultTuning.radiiChunks);
        chunkActivityTuning.viewportRadiusScale = options.deepClone(defaultTuning.viewportRadiusScale);
        chunkActivityTuning.teleportKeepAliveMs = defaultTuning.teleportKeepAliveMs;
        chunkActivityTuning.simulationCadenceFrames = options.deepClone(defaultTuning.simulationCadenceFrames);
        applyTuning({});
    }

    function getTuningSnapshot() {
        return {
            ...options.deepClone(chunkActivityTuning),
            manager: options.manager.getConfigSnapshot()
        };
    }

    return {
        creatureChunkCadence,
        collectableChunkCadence,
        projectileChunkCadence,
        teleporterChunkCadence,
        applyChunkActivityTuning: applyTuning,
        resetChunkActivityTuning: resetTuning,
        getChunkActivityTuningSnapshot: getTuningSnapshot
    };
}
