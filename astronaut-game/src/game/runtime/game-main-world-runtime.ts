import type { Position } from '../../types/index.js';

type EntityLists = {
    buttons: any[];
    doors: any[];
    creatures: any[];
    collectables: any[];
    mapBlocks: any[];
};

export function createGameMainWorldRuntime(options: {
    fetchFreshJson: <T>(path: string) => Promise<T>;
    assignEntityId: <T>(value: T) => T;
    createButton: (value: any) => any;
    createDoor: (value: any) => any;
    createCreature: (value: any) => any;
    createCollectable: (value: any) => any;
    getEntityLists: () => EntityLists;
    setButtons: (value: any[]) => void;
    setDoors: (value: any[]) => void;
    setCreatures: (value: any[]) => void;
    setCollectables: (value: any[]) => void;
    getCollectedCollectableEntityIds: () => Set<number>;
    setCollectedCollectableEntityIds: (value: Set<number>) => void;
    getStoredCollectables: () => any[];
    setStoredCollectables: (value: any[]) => void;
    getHeldCollectable: () => any | null;
    setHeldCollectable: (value: any | null) => void;
    setInventoryCycleIndex: (value: number) => void;
    syncGrenadeFuseState: (collectable: any, now?: number) => void;
    isCollectableCollectedRuntime: (collectable: any, ids: Set<number>) => boolean;
    markCollectableCollectedRuntime: (collectable: any, ids: Set<number>) => void;
    getCreatureProjectileCollectablesRuntime: (collectables: any[]) => any[];
    getRenderableCollectablesRuntime: (collectables: any[], ids: Set<number>) => any[];
    getDesignerRenderableCollectablesRuntime: (collectables: any[]) => any[];
    getSavableCollectablesRuntime: (collectables: any[]) => any[];
    getWorldDesigner: () => { isActive: () => boolean; isPreviewMode: () => boolean } | null;
    syncButtonStatesToDoorsHook?: () => void;
    getWorldMapRotatedBoundingBoxes: () => Record<string, Record<number, any>>;
    getWorldMapBoundingBoxes: () => Record<string, any>;
    setBlockInstanceRotatedBoundingBoxes: (value: WeakMap<object, any>) => void;
    getBlockInstanceRotatedBoundingBoxes: () => WeakMap<object, any>;
    findSpriteRectByType: (type: string) => { w: number; h: number } | null;
    getAstronautStartPosition: () => Position;
    mapWidth: number;
    mapHeight: number;
    spriteScale: number;
    worldBoundsPadding: number;
    setMapBounds: (width: number, height: number) => void;
    rebuildMapBlockRenderCache: () => void;
    initStars: (width: number, height: number) => void;
    invalidateTeleporterPadCaches: () => void;
    getCachedWindReset: () => {
        setCachedWindEmittersFrameKey: (value: number) => void;
        setCachedWindEmittersForFrame: (value: any[]) => void;
        setCachedNearbyBlockWindEmitters: (value: any[]) => void;
        setCachedNearbyBlockWindSample: (value: { x: number; y: number; timeMs: number }) => void;
    };
    updateAstronautStartPosition: (position: Position, applyToAstronaut?: boolean) => void;
}) {
    function syncButtonStatesToDoors() {
        const { buttons, doors } = options.getEntityLists();
        const worldDesigner = options.getWorldDesigner();
        for (const button of buttons) {
            if (worldDesigner?.isActive() && !worldDesigner.isPreviewMode()) {
                button.active = button.defaultActive ?? button.active ?? false;
                continue;
            }
            if (!Array.isArray(button.linkedDoors) || button.linkedDoors.length === 0) {
                continue;
            }

            button.active = button.linkedDoors.some((doorID: string) =>
                doors.some((door) => door.doorID === doorID && door.locked)
            );
        }
    }

    function syncCollectableRuntimeState() {
        const { collectables } = options.getEntityLists();
        const currentCollectableIds = new Set(
            collectables
                .map((collectable) => collectable.entityId)
                .filter((entityId): entityId is number => typeof entityId === 'number')
        );
        const collectedIds = options.getCollectedCollectableEntityIds();
        options.setCollectedCollectableEntityIds(new Set(
            [...collectedIds].filter((entityId) => currentCollectableIds.has(entityId))
        ));
        const storedCollectables = collectables.filter((collectable) => collectable.stored);
        options.setStoredCollectables(storedCollectables);
        options.setHeldCollectable(collectables.find((collectable) => collectable.held) ?? null);
        options.setInventoryCycleIndex(storedCollectables.length > 0 ? storedCollectables.length - 1 : -1);
        const now = performance.now();
        for (const collectable of collectables) {
            options.syncGrenadeFuseState(collectable, now);
        }
    }

    async function loadButtons() {
        const arr = await options.fetchFreshJson<any[]>('./src/assets/data/buttons.json');
        options.setButtons(arr.map((data: any) => options.assignEntityId(options.createButton(data))));
        syncButtonStatesToDoors();
    }

    async function loadDoors() {
        const arr = await options.fetchFreshJson<any[]>('./src/assets/data/doors.json');
        options.setDoors(arr.map((data: any) => options.assignEntityId(options.createDoor(data))));
    }

    async function loadCreatures() {
        const arr = await options.fetchFreshJson<any[]>('./src/assets/data/creatures.json');
        options.setCreatures(arr.map((data: any) => options.assignEntityId(options.createCreature(data))));
    }

    async function loadCollectables() {
        const arr = await options.fetchFreshJson<any[]>('./src/assets/data/collectables.json');
        options.setCollectables(arr.map((data: any) => options.assignEntityId(options.createCollectable(data))));
        options.setCollectedCollectableEntityIds(new Set());
        syncCollectableRuntimeState();
    }

    async function loadAstronautStartPosition() {
        const data = await options.fetchFreshJson<Position>('./src/assets/data/astronaut_start.json');
        options.updateAstronautStartPosition(data, true);
    }

    function isCollectableCollected(collectable: any) {
        return options.isCollectableCollectedRuntime(collectable, options.getCollectedCollectableEntityIds());
    }

    function markCollectableCollected(collectable: any) {
        options.markCollectableCollectedRuntime(collectable, options.getCollectedCollectableEntityIds());
    }

    function getCreatureProjectileCollectables() {
        return options.getCreatureProjectileCollectablesRuntime(options.getEntityLists().collectables);
    }

    function getRenderableCollectables() {
        return options.getRenderableCollectablesRuntime(
            options.getEntityLists().collectables,
            options.getCollectedCollectableEntityIds()
        );
    }

    function getDesignerRenderableCollectables() {
        return options.getDesignerRenderableCollectablesRuntime(options.getEntityLists().collectables);
    }

    function getSavableCollectables() {
        return options.getSavableCollectablesRuntime(options.getEntityLists().collectables);
    }

    function assignRotatedBoundingBoxes(arr: any[]) {
        const worldMapRotatedBoundingBoxes = options.getWorldMapRotatedBoundingBoxes();
        const worldMapBoundingBoxes = options.getWorldMapBoundingBoxes();
        const blockInstanceRotatedBoundingBoxes = options.getBlockInstanceRotatedBoundingBoxes();
        for (const entity of arr) {
            const type = entity.type;
            const rotation = typeof entity.rotation === 'number' ? entity.rotation : 0;
            let bbox =
                (worldMapRotatedBoundingBoxes[type] && worldMapRotatedBoundingBoxes[type][rotation]) ||
                worldMapBoundingBoxes[type];
            if (!bbox) {
                const rect = options.findSpriteRectByType(type);
                if (rect) {
                    bbox = {
                        minX: 0,
                        minY: 0,
                        maxX: rect.w - 1,
                        maxY: rect.h - 1,
                        width: rect.w,
                        height: rect.h
                    };
                }
            }
            if (bbox) {
                blockInstanceRotatedBoundingBoxes.set(entity, bbox);
            }
        }
    }

    function rebuildBlockInstanceBoundingBoxes() {
        options.setBlockInstanceRotatedBoundingBoxes(new WeakMap());
        const { mapBlocks, doors, buttons, creatures, collectables } = options.getEntityLists();
        assignRotatedBoundingBoxes(mapBlocks);
        assignRotatedBoundingBoxes(doors);
        assignRotatedBoundingBoxes(buttons);
        assignRotatedBoundingBoxes(creatures);
        assignRotatedBoundingBoxes(collectables);
    }

    function syncRuntimeMapBounds() {
        let maxRight = 0;
        let maxBottom = 0;
        const approximateEntitySpan = Math.ceil(32 * options.spriteScale);
        const considerEntities = (entities: Array<{ x: number; y: number }>) => {
            for (const entity of entities) {
                if (!Number.isFinite(entity.x) || !Number.isFinite(entity.y)) {
                    continue;
                }
                maxRight = Math.max(maxRight, entity.x + approximateEntitySpan);
                maxBottom = Math.max(maxBottom, entity.y + approximateEntitySpan);
            }
        };

        const { mapBlocks, doors, buttons, creatures, collectables } = options.getEntityLists();
        considerEntities(mapBlocks);
        considerEntities(doors);
        considerEntities(buttons);
        considerEntities(creatures);
        considerEntities(collectables);

        const astronautStart = options.getAstronautStartPosition();
        if (Number.isFinite(astronautStart.x) && Number.isFinite(astronautStart.y)) {
            maxRight = Math.max(maxRight, astronautStart.x + approximateEntitySpan);
            maxBottom = Math.max(maxBottom, astronautStart.y + approximateEntitySpan);
        }

        options.setMapBounds(
            Math.max(options.mapWidth, maxRight + options.worldBoundsPadding),
            Math.max(options.mapHeight, maxBottom + options.worldBoundsPadding)
        );
    }

    function ensureWorldBounds(width: number, height: number) {
        options.setMapBounds(
            Math.max(options.mapWidth, Math.round(width)),
            Math.max(options.mapHeight, Math.round(height))
        );
    }

    function afterWorldDataMutated() {
        const windReset = options.getCachedWindReset();
        windReset.setCachedWindEmittersFrameKey(-1);
        windReset.setCachedWindEmittersForFrame([]);
        windReset.setCachedNearbyBlockWindEmitters([]);
        windReset.setCachedNearbyBlockWindSample({ x: Number.NaN, y: Number.NaN, timeMs: Number.NEGATIVE_INFINITY });
        syncButtonStatesToDoors();
        syncCollectableRuntimeState();
        options.rebuildMapBlockRenderCache();
        rebuildBlockInstanceBoundingBoxes();
        syncRuntimeMapBounds();
        options.initStars(options.mapWidth, Math.min(options.mapHeight, 2000));
        options.invalidateTeleporterPadCaches();
    }

    function clampCamera(camera: Position, canvasSize: { width: number; height: number }) {
        return {
            x: Math.max(0, Math.min(camera.x, Math.max(0, options.mapWidth - canvasSize.width))),
            y: Math.max(0, Math.min(camera.y, Math.max(0, options.mapHeight - canvasSize.height)))
        };
    }

    return {
        loadButtons,
        syncButtonStatesToDoors,
        loadDoors,
        loadCreatures,
        loadCollectables,
        loadAstronautStartPosition,
        syncCollectableRuntimeState,
        isCollectableCollected,
        markCollectableCollected,
        getCreatureProjectileCollectables,
        getRenderableCollectables,
        getDesignerRenderableCollectables,
        getSavableCollectables,
        rebuildBlockInstanceBoundingBoxes,
        syncRuntimeMapBounds,
        ensureWorldBounds,
        afterWorldDataMutated,
        clampCamera
    };
}
