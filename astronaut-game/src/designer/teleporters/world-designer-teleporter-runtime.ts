import { MapBlock } from '../../world/map.js';
import type { TeleporterSaveData } from '../../types/index.js';
import type { SpriteTranslation } from '../../shared/utilities.js';
import type { DesignerState, Selection, WorldDesignerHost } from '../core/world-designer-types.js';

type TeleporterPartType = 'teleporter' | 'teleporter_pad';

type WorldDesignerTeleporterRuntimeDeps = {
    host: Pick<WorldDesignerHost, 'getRawWorldData'>;
    state: Pick<DesignerState, 'palette' | 'rotation'>;
    tileSize: number;
    normalizeRotation: (rotation: number) => number;
    applyPosition: (entity: any, x: number, y: number) => void;
    getWorldBlocks: () => MapBlock[];
    getContextMenuActionSelections: () => Selection[];
};

export function createWorldDesignerTeleporterRuntime(deps: WorldDesignerTeleporterRuntimeDeps) {
    const {
        host,
        state,
        tileSize,
        normalizeRotation,
        applyPosition,
        getWorldBlocks,
        getContextMenuActionSelections
    } = deps;

    function getTeleporters() {
        return host.getRawWorldData().teleporters;
    }

    function getTeleporterById(id: string) {
        return getTeleporters().find((teleporter) => teleporter.id === id) ?? null;
    }

    function findTeleporterByPartPosition(
        type: TeleporterPartType,
        x: number,
        y: number,
        maxDistance: number = tileSize * 1.5
    ) {
        const targetX = Math.round(x);
        const targetY = Math.round(y);
        const exact = getTeleporters().find((entry) =>
            type === 'teleporter'
                ? entry.baseX === targetX && entry.baseY === targetY
                : entry.padX === targetX && entry.padY === targetY
        );
        if (exact) {
            return exact;
        }
        const maxDistanceSquared = maxDistance * maxDistance;
        let best: { teleporter: TeleporterSaveData; distanceSquared: number } | null = null;
        for (const entry of getTeleporters()) {
            const partX = type === 'teleporter' ? entry.baseX : entry.padX;
            const partY = type === 'teleporter' ? entry.baseY : entry.padY;
            const dx = partX - targetX;
            const dy = partY - targetY;
            const distanceSquared = dx * dx + dy * dy;
            if (distanceSquared > maxDistanceSquared) {
                continue;
            }
            if (!best || distanceSquared < best.distanceSquared) {
                best = { teleporter: entry, distanceSquared };
            }
        }
        return best?.teleporter ?? null;
    }

    function applyEntityPositionWithTeleporterSync(entity: any, x: number, y: number) {
        const nextX = Math.round(x);
        const nextY = Math.round(y);
        if (entity?.type === 'teleporter' || entity?.type === 'teleporter_pad') {
            const teleporter = typeof entity.teleporterId === 'string' && entity.teleporterId.trim().length > 0
                ? getTeleporterById(entity.teleporterId)
                : findTeleporterByPartPosition(entity.type, entity.x, entity.y);
            if (teleporter) {
                if (entity.type === 'teleporter') {
                    teleporter.baseX = nextX;
                    teleporter.baseY = nextY;
                } else {
                    teleporter.padX = nextX;
                    teleporter.padY = nextY;
                }
                entity.teleporterId = teleporter.id;
            }
        }
        applyPosition(entity, nextX, nextY);
    }

    function getTeleporterBaseRotationForPadRotation(padRotation: number) {
        const normalizedPadRotation = normalizeRotation(padRotation);
        if (normalizedPadRotation === 1) {
            return 6;
        }
        if (normalizedPadRotation === 3) {
            return 5;
        }
        if (normalizedPadRotation === 5) {
            return 3;
        }
        if (normalizedPadRotation === 6) {
            return 6;
        }
        return normalizedPadRotation;
    }

    function getTeleporterPartBlock(teleporter: TeleporterSaveData, type: TeleporterPartType) {
        const x = type === 'teleporter' ? teleporter.baseX : teleporter.padX;
        const y = type === 'teleporter' ? teleporter.baseY : teleporter.padY;
        const worldMap = getWorldBlocks();
        const byId = worldMap.find((block) =>
            block.type === type &&
            block.teleporterId === teleporter.id
        );
        if (byId) {
            return byId;
        }
        return worldMap.find((block) =>
            block.type === type &&
            block.x === x &&
            block.y === y
        ) ?? null;
    }

    function renameTeleporterId(teleporter: TeleporterSaveData, requestedId: string) {
        const nextId = requestedId.trim();
        if (!nextId || nextId === teleporter.id) {
            return;
        }
        if (getTeleporters().some((entry) => entry !== teleporter && entry.id === nextId)) {
            return;
        }
        const previousId = teleporter.id;
        teleporter.id = nextId;
        const base = getTeleporterPartBlock(teleporter, 'teleporter');
        const pad = getTeleporterPartBlock(teleporter, 'teleporter_pad');
        if (base) {
            base.teleporterId = nextId;
        }
        if (pad) {
            pad.teleporterId = nextId;
        }
        for (const button of host.getRawWorldData().buttons) {
            if (!Array.isArray(button.linkedTeleporters) || button.linkedTeleporters.length === 0) {
                continue;
            }
            button.linkedTeleporters = button.linkedTeleporters.map((id) => id === previousId ? nextId : id);
        }
    }

    function applyEntityRotationWithTeleporterSync(entity: any, rotation: number) {
        const nextRotation = normalizeRotation(rotation);
        if (entity?.type === 'teleporter' || entity?.type === 'teleporter_pad') {
            const teleporter = typeof entity.teleporterId === 'string' && entity.teleporterId.trim().length > 0
                ? getTeleporterById(entity.teleporterId)
                : findTeleporterByPartPosition(entity.type, entity.x, entity.y);
            if (teleporter) {
                const base = getTeleporterPartBlock(teleporter, 'teleporter');
                const pad = getTeleporterPartBlock(teleporter, 'teleporter_pad');
                const nextPadRotation = nextRotation;
                const nextBaseRotation = getTeleporterBaseRotationForPadRotation(nextPadRotation);
                if (base) {
                    base.rotation = nextBaseRotation as MapBlock['rotation'];
                    base.teleporterId = teleporter.id;
                }
                if (pad) {
                    pad.rotation = nextPadRotation as MapBlock['rotation'];
                    pad.teleporterId = teleporter.id;
                }
                entity.teleporterId = teleporter.id;
            }
        }
        entity.rotation = nextRotation;
    }

    function getNextTeleporterId() {
        const existingIds = new Set(getTeleporters().map((teleporter) => teleporter.id));
        let index = 1;
        while (existingIds.has(`teleporter_${index}`)) {
            index += 1;
        }
        return `teleporter_${index}`;
    }

    function findTeleporterForWorldBlock(block: MapBlock) {
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            return null;
        }
        if (typeof block.teleporterId === 'string' && block.teleporterId.trim().length > 0) {
            const byId = getTeleporterById(block.teleporterId);
            if (byId) {
                return byId;
            }
        }
        return findTeleporterByPartPosition(block.type, block.x, block.y, 0);
    }

    function findClosestTeleporterCounterpart(sourceBlock: MapBlock) {
        const counterpartType = sourceBlock.type === 'teleporter' ? 'teleporter_pad' : 'teleporter';
        const sourceCenterX = sourceBlock.x + tileSize / 2;
        const sourceCenterY = sourceBlock.y + tileSize / 2;
        let best: { block: MapBlock; distanceSquared: number } | null = null;
        for (const block of getWorldBlocks()) {
            if (block === sourceBlock || block.type !== counterpartType) {
                continue;
            }
            const dx = sourceCenterX - (block.x + tileSize / 2);
            const dy = sourceCenterY - (block.y + tileSize / 2);
            const distanceSquared = dx * dx + dy * dy;
            if (!best || distanceSquared < best.distanceSquared) {
                best = { block, distanceSquared };
            }
        }
        return best?.block ?? null;
    }

    function clearTeleporterMetadata(block: MapBlock) {
        delete block.teleporterId;
        delete block.teleporterEnabled;
        delete block.teleporterRequiresKey;
        delete block.teleporterDestinationA;
        delete block.teleporterDestinationB;
        delete block.teleporterActiveDestinationIndex;
    }

    function applyTeleporterRuntimeToBlocks(teleporter: TeleporterSaveData, base: MapBlock, pad: MapBlock) {
        const activeDestinationIndex = teleporter.activeDestinationIndex === 1 ? 1 : 0;
        const destinationA = {
            x: Math.round(teleporter.destinationA.x),
            y: Math.round(teleporter.destinationA.y)
        };
        const destinationB = teleporter.destinationB
            ? {
                x: Math.round(teleporter.destinationB.x),
                y: Math.round(teleporter.destinationB.y)
            }
            : null;
        const enabled = teleporter.enabled !== false;
        const requiresKey = teleporter.requiresKey === true;

        for (const block of [base, pad]) {
            block.teleporterId = teleporter.id;
            block.teleporterEnabled = enabled;
            block.teleporterRequiresKey = requiresKey;
            block.teleporterDestinationA = { ...destinationA };
            block.teleporterDestinationB = destinationB ? { ...destinationB } : null;
            block.teleporterActiveDestinationIndex = activeDestinationIndex;
        }
    }

    function convertTeleporterWorldPair(base: MapBlock, pad: MapBlock) {
        if (findTeleporterForWorldBlock(base) || findTeleporterForWorldBlock(pad)) {
            throw new Error('One of the selected teleporter parts is already paired.');
        }
        const astronautStart = host.getRawWorldData().astronautStart;
        const teleporterId = getNextTeleporterId();
        base.teleporterId = teleporterId;
        pad.teleporterId = teleporterId;
        const teleporter: TeleporterSaveData = {
            id: teleporterId,
            baseX: base.x,
            baseY: base.y,
            padX: pad.x,
            padY: pad.y,
            enabled: true,
            requiresKey: false,
            destinationA: {
                x: Math.round(astronautStart.x),
                y: Math.round(astronautStart.y)
            },
            destinationB: null,
            activeDestinationIndex: 0
        };
        getTeleporters().push(teleporter);
        base.teleporterEnabled = true;
        pad.teleporterEnabled = true;
        base.teleporterRequiresKey = false;
        pad.teleporterRequiresKey = false;
        base.teleporterDestinationA = { ...teleporter.destinationA };
        pad.teleporterDestinationA = { ...teleporter.destinationA };
        base.teleporterDestinationB = null;
        pad.teleporterDestinationB = null;
        base.teleporterActiveDestinationIndex = 0;
        pad.teleporterActiveDestinationIndex = 0;
    }

    function convertWorldTeleporterBlock(block: MapBlock) {
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            throw new Error('Select a teleporter base or teleporter pad world item first.');
        }
        if (findTeleporterForWorldBlock(block)) {
            throw new Error('This world item is already part of a teleporter.');
        }
        const counterpart = findClosestTeleporterCounterpart(block);
        if (!counterpart) {
            throw new Error(`No nearby "${block.type === 'teleporter' ? 'teleporter_pad' : 'teleporter'}" world item found to pair with.`);
        }
        if (findTeleporterForWorldBlock(counterpart)) {
            throw new Error('The nearest matching teleporter part is already paired.');
        }

        const base = block.type === 'teleporter' ? block : counterpart;
        const pad = block.type === 'teleporter_pad' ? block : counterpart;
        convertTeleporterWorldPair(base, pad);
    }

    function createTeleporterCompositeAt(x: number, y: number) {
        const palette = state.palette;
        const padRotation = normalizeRotation(state.rotation);
        const baseRotation = getTeleporterBaseRotationForPadRotation(padRotation);
        const translation: SpriteTranslation = 'center';
        const base: MapBlock = {
            x,
            y,
            type: 'teleporter',
            collision: true,
            maskAstronaut: false,
            palette,
            rotation: baseRotation as MapBlock['rotation'],
            translation
        };
        const pad: MapBlock = {
            x,
            y,
            type: 'teleporter_pad',
            collision: false,
            maskAstronaut: false,
            palette,
            rotation: padRotation as MapBlock['rotation'],
            translation
        };
        const worldMap = getWorldBlocks();
        worldMap.push(base);
        worldMap.push(pad);
        convertTeleporterWorldPair(base, pad);
        return base;
    }

    function getContextMenuSelectedTeleporterPair() {
        const selections = getContextMenuActionSelections();
        if (selections.length !== 2 || !selections.every((entry) => entry.category === 'world')) {
            return null;
        }
        const worldBlocks = selections.map((entry) => entry.entity as MapBlock);
        const base = worldBlocks.find((block) => block.type === 'teleporter') ?? null;
        const pad = worldBlocks.find((block) => block.type === 'teleporter_pad') ?? null;
        if (!base || !pad) {
            return null;
        }
        return { base, pad };
    }

    return {
        getTeleporters,
        getTeleporterById,
        findTeleporterByPartPosition,
        applyEntityPositionWithTeleporterSync,
        getTeleporterBaseRotationForPadRotation,
        getTeleporterPartBlock,
        renameTeleporterId,
        applyEntityRotationWithTeleporterSync,
        getNextTeleporterId,
        findTeleporterForWorldBlock,
        findClosestTeleporterCounterpart,
        clearTeleporterMetadata,
        applyTeleporterRuntimeToBlocks,
        convertWorldTeleporterBlock,
        convertTeleporterWorldPair,
        createTeleporterCompositeAt,
        getContextMenuSelectedTeleporterPair
    };
}
