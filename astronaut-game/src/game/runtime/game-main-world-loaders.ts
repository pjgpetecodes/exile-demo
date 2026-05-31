import type { TeleporterRuntime } from '../teleporter/game-teleporter-runtime.js';
import type { WindEmitterRuntime } from '../wind/game-wind-runtime.js';
import type { MapBlock } from '../../world/map.js';
import type { Position } from '../../types/index.js';

type GameMainWorldLoadersOptions = {
    fetchFreshJson: <T>(url: string) => Promise<T>;
    normalizeTeleporter: (value: any) => TeleporterRuntime;
    buildTeleportersFromMapMetadata: (mapBlocks: MapBlock[], astronautStartPosition: Position) => TeleporterRuntime[];
    reconcileTeleporterRuntimePositions: (teleporters: TeleporterRuntime[], mapBlocks: MapBlock[]) => void;
    normalizeWindEmitter: (value: any) => WindEmitterRuntime;
    normalizeWindSettings: (value: any) => any;
    getMapBlocks: () => MapBlock[];
    getAstronautStartPosition: () => Position;
    setTeleporterEntities: (value: TeleporterRuntime[]) => void;
    setWindEmitters: (value: WindEmitterRuntime[]) => void;
    setWindSettings: (value: any) => void;
    resetWindCaches: () => void;
    invalidateTeleporterPadCaches: () => void;
};

export function createGameMainWorldLoaders(options: GameMainWorldLoadersOptions) {
    async function loadTeleporters() {
        const arr = await options.fetchFreshJson<any[]>('./src/assets/data/teleporters.json');
        const teleporters = arr.length > 0
            ? arr.map(options.normalizeTeleporter)
            : options.buildTeleportersFromMapMetadata(options.getMapBlocks(), options.getAstronautStartPosition());
        options.reconcileTeleporterRuntimePositions(teleporters, options.getMapBlocks());
        options.setTeleporterEntities(teleporters);
        options.invalidateTeleporterPadCaches();
    }

    async function loadWindData() {
        let emitterPayload: any[] = [];
        try {
            emitterPayload = await options.fetchFreshJson<any[]>('./src/assets/data/wind_emitters.json');
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('wind_emitters.json: 404')) {
                throw error;
            }
        }

        let settingsPayload: any = {};
        try {
            settingsPayload = await options.fetchFreshJson<Record<string, unknown>>('./src/assets/data/wind_settings.json');
        } catch (error) {
            if (!(error instanceof Error) || !error.message.includes('wind_settings.json: 404')) {
                throw error;
            }
        }

        options.setWindEmitters(Array.isArray(emitterPayload) ? emitterPayload.map(options.normalizeWindEmitter) : []);
        options.setWindSettings(options.normalizeWindSettings(settingsPayload));
        options.resetWindCaches();
    }

    return {
        loadTeleporters,
        loadWindData
    };
}
