import type { MapBlock } from '../../world/map.js';

export function createWorldDesignerTeleporterDelegates(context: any) {
    const getTeleporters = () => context.teleporterRuntime.getTeleporters();

    const getTeleporterById = (id: string) => context.teleporterRuntime.getTeleporterById(id);

    const findTeleporterByPartPosition = (
        type: 'teleporter' | 'teleporter_pad',
        x: number,
        y: number,
        maxDistance: number = context.tileSize * 1.5
    ) => context.teleporterRuntime.findTeleporterByPartPosition(type, x, y, maxDistance);

    const applyEntityPositionWithTeleporterSync = (entity: any, x: number, y: number) => {
        context.teleporterRuntime.applyEntityPositionWithTeleporterSync(entity, x, y);
    };

    const getTeleporterBaseRotationForPadRotation = (padRotation: number) =>
        context.teleporterRuntime.getTeleporterBaseRotationForPadRotation(padRotation);

    const getTeleporterPartBlock = (teleporter: any, type: 'teleporter' | 'teleporter_pad') =>
        context.teleporterRuntime.getTeleporterPartBlock(teleporter, type);

    const renameTeleporterId = (teleporter: any, requestedId: string) => {
        context.teleporterRuntime.renameTeleporterId(teleporter, requestedId);
    };

    const applyEntityRotationWithTeleporterSync = (entity: any, rotation: number) => {
        context.teleporterRuntime.applyEntityRotationWithTeleporterSync(entity, rotation);
    };

    const getNextTeleporterId = () => context.teleporterRuntime.getNextTeleporterId();

    const findWorldBlockByExactPosition = (x: number, y: number, type: string) => {
        return context.host.getRawWorldData().worldMap.find((block: MapBlock) =>
            block.x === x &&
            block.y === y &&
            block.type === type
        ) ?? null;
    };

    const findTeleporterForWorldBlock = (block: MapBlock) =>
        context.teleporterRuntime.findTeleporterForWorldBlock(block);

    const findClosestTeleporterCounterpart = (sourceBlock: MapBlock) =>
        context.teleporterRuntime.findClosestTeleporterCounterpart(sourceBlock);

    const convertWorldTeleporterBlock = (block: MapBlock) => {
        context.teleporterRuntime.convertWorldTeleporterBlock(block);
    };

    const convertTeleporterWorldPair = (base: MapBlock, pad: MapBlock) => {
        context.teleporterRuntime.convertTeleporterWorldPair(base, pad);
    };

    const createTeleporterCompositeAt = (x: number, y: number) =>
        context.teleporterRuntime.createTeleporterCompositeAt(x, y);

    const getContextMenuSelectedTeleporterPair = () =>
        context.teleporterRuntime.getContextMenuSelectedTeleporterPair();

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
        findWorldBlockByExactPosition,
        findTeleporterForWorldBlock,
        findClosestTeleporterCounterpart,
        convertWorldTeleporterBlock,
        convertTeleporterWorldPair,
        createTeleporterCompositeAt,
        getContextMenuSelectedTeleporterPair
    };
}
