import type { RawWorldData } from '../../designer/world-designer.js';

type AssignEntityId = <T>(value: T) => T;

export function createGameWorldDataRuntime(options: {
    assignEntityId: AssignEntityId;
    getMapBlocks: () => any[];
    getButtonEntities: () => any[];
    setButtonEntities: (buttons: any[]) => void;
    getDoorEntities: () => any[];
    setDoorEntities: (doors: any[]) => void;
    getCreatureEntities: () => any[];
    setCreatureEntities: (creatures: any[]) => void;
    getCollectableEntities: () => any[];
    setCollectableEntities: (collectables: any[]) => void;
    getTeleporterEntities: () => any[];
    setTeleporterEntities: (teleporters: any[]) => void;
    getWindEmitters: () => any[];
    setWindEmitters: (emitters: any[]) => void;
    getWindSettings: () => any;
    setWindSettings: (settings: any) => void;
    getAstronautStartPosition: () => { x: number; y: number };
    updateAstronautStartPosition: (position: { x: number; y: number }, applyToAstronaut: boolean) => void;
    normalizeTeleporter: (teleporter: any) => any;
    buildTeleportersFromMapMetadata: (mapBlocks: any[], astronautStart: { x: number; y: number }) => any[];
    normalizeWindEmitter: (emitter: any) => any;
    normalizeWindSettings: (settings: any) => any;
    reconcileTeleporterRuntimePositions: (teleporters: any[], mapBlocks: any[]) => void;
    clearCollectedCollectableEntityIds: () => void;
    createDoor: (door: any) => any;
    createButton: (button: any) => any;
    createCreature: (creature: any) => any;
    createCollectable: (collectable: any) => any;
    materializeAllMapChunksForSave: () => Promise<void>;
    setSaveSnapshotInProgress: (value: boolean) => void;
    afterWorldDataMutated: () => void;
}) {
    function getRawWorldData(): RawWorldData {
        return {
            worldMap: options.getMapBlocks() as RawWorldData['worldMap'],
            buttons: options.getButtonEntities() as RawWorldData['buttons'],
            doors: options.getDoorEntities() as RawWorldData['doors'],
            creatures: options.getCreatureEntities() as RawWorldData['creatures'],
            collectables: options.getCollectableEntities() as RawWorldData['collectables'],
            teleporters: options.getTeleporterEntities() as RawWorldData['teleporters'],
            windEmitters: options.getWindEmitters() as RawWorldData['windEmitters'],
            windSettings: options.getWindSettings() as RawWorldData['windSettings'],
            astronautStart: options.getAstronautStartPosition()
        };
    }

    async function getRawWorldDataForSave(): Promise<RawWorldData> {
        options.setSaveSnapshotInProgress(true);
        try {
            await options.materializeAllMapChunksForSave();
            return getRawWorldData();
        } finally {
            options.setSaveSnapshotInProgress(false);
        }
    }

    function replaceRawWorldData(data: RawWorldData) {
        options.clearCollectedCollectableEntityIds();
        const mapBlocks = options.getMapBlocks();
        mapBlocks.splice(0, mapBlocks.length, ...data.worldMap.map((block) => options.assignEntityId({ ...block })));
        options.setDoorEntities(data.doors.map((door) => options.assignEntityId(options.createDoor(door))));
        options.setButtonEntities(data.buttons.map((button) => options.assignEntityId(options.createButton(button))));
        options.setCreatureEntities(data.creatures.map((creature) => options.assignEntityId(options.createCreature(creature))));
        options.setCollectableEntities(data.collectables.map((collectable) => options.assignEntityId(options.createCollectable(collectable))));

        const teleporters = (data.teleporters ?? []).length > 0
            ? (data.teleporters ?? []).map(options.normalizeTeleporter)
            : options.buildTeleportersFromMapMetadata(mapBlocks, options.getAstronautStartPosition());
        options.setTeleporterEntities(teleporters);
        options.setWindEmitters((data.windEmitters ?? []).map(options.normalizeWindEmitter));
        options.setWindSettings(options.normalizeWindSettings(data.windSettings));
        options.reconcileTeleporterRuntimePositions(teleporters, mapBlocks);
        options.updateAstronautStartPosition(data.astronautStart, true);
        options.afterWorldDataMutated();
    }

    return {
        getRawWorldData,
        getRawWorldDataForSave,
        replaceRawWorldData
    };
}
