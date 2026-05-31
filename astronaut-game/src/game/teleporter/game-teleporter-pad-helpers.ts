import type { Position, ChunkActivityBand } from '../../types/index.js';
import type { MapBlock } from '../../world/map.js';
import type { TeleporterRuntime } from './game-teleporter-runtime.js';

type ChunkSimulationCadencePolicy = Record<ChunkActivityBand, number>;

export function createTeleporterPadHelpers(options: {
    teleporterTileSize: number;
    teleporterChunkCadence: ChunkSimulationCadencePolicy;
    getAstronautPosition: () => Position;
    getTeleporterTouchCooldownUntilMs: () => number;
    setTeleporterTouchCooldownUntilMs: (value: number) => void;
    isDesignerOpen: () => boolean;
    isTeleporting: () => boolean;
    getAstronautRect: () => { left: number; right: number; top: number; bottom: number };
    startTeleportToLocation: (location: Position) => boolean;
    getChunkActivityForWorldPosition: (position: Position, now: number) => ChunkActivityBand;
    shouldRunChunkBandUpdate: (
        chunkActivity: ChunkActivityBand,
        cadencePolicy: ChunkSimulationCadencePolicy,
        frameCounter: number
    ) => boolean;
    teleporterPadRuntime: {
        invalidateCaches: () => void;
        getTeleporterActiveDestination: (teleporter: TeleporterRuntime) => Position;
        getTeleporterPadKeySet: () => Set<string>;
        filterTeleporterPadsFromBlocks: (blocks: MapBlock[], keys: Set<string>) => MapBlock[];
        drawTeleporterPads: (
            context: CanvasRenderingContext2D,
            camera: Position,
            now: number,
            renderOptions?: { ignoreKeyRequirement?: boolean }
        ) => void;
        getRenderPads: (
            now: number,
            options: {
                activeOnly: boolean;
                proximity: { x: number; y: number; radius: number };
            }
        ) => Array<{ x: number; y: number; teleporter: TeleporterRuntime }>;
    };
}) {
    function invalidateTeleporterPadCaches() {
        options.teleporterPadRuntime.invalidateCaches();
    }

    function canUseKeyLockedTeleporter(_teleporter: TeleporterRuntime) {
        return false;
    }

    function isTeleporterActive(teleporter: TeleporterRuntime, renderOptions?: { ignoreKeyRequirement?: boolean }) {
        if (teleporter.enabled === false) {
            return false;
        }
        if (!renderOptions?.ignoreKeyRequirement && teleporter.requiresKey && !canUseKeyLockedTeleporter(teleporter)) {
            return false;
        }
        return true;
    }

    function getTeleporterActiveDestination(teleporter: TeleporterRuntime) {
        return options.teleporterPadRuntime.getTeleporterActiveDestination(teleporter);
    }

    function getTeleporterPadKeySet() {
        return options.teleporterPadRuntime.getTeleporterPadKeySet();
    }

    function filterTeleporterPadsFromBlocks(blocks: MapBlock[], teleporterPadKeys: Set<string>) {
        return options.teleporterPadRuntime.filterTeleporterPadsFromBlocks(blocks, teleporterPadKeys);
    }

    function drawTeleporterPads(
        context: CanvasRenderingContext2D,
        camera: Position,
        now: number,
        renderOptions?: { ignoreKeyRequirement?: boolean }
    ) {
        options.teleporterPadRuntime.drawTeleporterPads(context, camera, now, renderOptions);
    }

    function updateTeleporterPadTeleporting(now: number, simulationFrame: number) {
        if (options.isDesignerOpen() || options.isTeleporting() || now < options.getTeleporterTouchCooldownUntilMs()) {
            return;
        }
        const astronautRect = options.getAstronautRect();
        const astronautPosition = options.getAstronautPosition();
        for (const activePad of options.teleporterPadRuntime.getRenderPads(now, {
            activeOnly: true,
            proximity: {
                x: astronautPosition.x + options.teleporterTileSize / 2,
                y: astronautPosition.y + options.teleporterTileSize / 2,
                radius: options.teleporterTileSize * 8
            }
        })) {
            const teleporterChunkActivity = options.getChunkActivityForWorldPosition(
                { x: activePad.x, y: activePad.y },
                now
            );
            if (!options.shouldRunChunkBandUpdate(teleporterChunkActivity, options.teleporterChunkCadence, simulationFrame)) {
                continue;
            }
            const padLeft = activePad.x;
            const padTop = activePad.y;
            const padRight = padLeft + options.teleporterTileSize;
            const padBottom = padTop + options.teleporterTileSize;
            const overlapsPad = !(
                astronautRect.right < padLeft ||
                astronautRect.left > padRight ||
                astronautRect.bottom < padTop ||
                astronautRect.top > padBottom
            );
            if (!overlapsPad) {
                continue;
            }
            if (options.startTeleportToLocation(getTeleporterActiveDestination(activePad.teleporter))) {
                options.setTeleporterTouchCooldownUntilMs(now + 700);
            }
            break;
        }
    }

    return {
        invalidateTeleporterPadCaches,
        canUseKeyLockedTeleporter,
        isTeleporterActive,
        getTeleporterActiveDestination,
        getTeleporterPadKeySet,
        filterTeleporterPadsFromBlocks,
        drawTeleporterPads,
        updateTeleporterPadTeleporting
    };
}
