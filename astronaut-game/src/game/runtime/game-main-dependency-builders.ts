type ValuePack = Record<string, any>;

function mergePacks(...packs: Array<ValuePack | undefined>) {
    return Object.assign({}, ...packs.filter(Boolean));
}

export function buildGameInitRuntimeValues(context: {
    dimensions: ValuePack;
    entities: ValuePack;
    rendering: ValuePack;
    world: ValuePack;
    loading: ValuePack;
    persistence: ValuePack;
    wind: ValuePack;
    initialization: ValuePack;
}) {
    return mergePacks(
        context.dimensions,
        context.entities,
        context.rendering,
        context.world,
        context.loading,
        context.persistence,
        context.wind,
        context.initialization
    );
}

export function buildGameInitStateAccessors(context: {
    gameplay: ValuePack;
    resources: ValuePack;
    world: ValuePack;
}) {
    return mergePacks(
        context.gameplay,
        context.resources,
        context.world
    );
}

export function createGameLoopRuntimeValuesSource(context: {
    getConstants: () => ValuePack;
    getSystems: () => ValuePack;
    getFrameState: () => ValuePack;
    getAssetState: () => ValuePack;
    getWorldState: () => ValuePack;
}) {
    return () => mergePacks(
        context.getConstants(),
        context.getSystems(),
        context.getFrameState(),
        context.getAssetState(),
        context.getWorldState()
    );
}

export function buildGameEntityRuntimeBootstrapOptions(context: {
    core: ValuePack;
    input: ValuePack;
    throwGuide: ValuePack;
    entities: ValuePack;
    geometry: ValuePack;
    creatures: ValuePack;
    collectables: ValuePack;
    physics: ValuePack;
    wind: ValuePack;
    projectiles: ValuePack;
    combat: ValuePack;
    worldCollision: {
        getSolidBlockAtWorld: (...args: any[]) => any;
        getSpriteMap: () => any;
        spriteScale: number;
        getMapBlocks: () => any;
        getDoorEntities: () => any;
        getButtonEntities: () => any;
    };
}) {
    return {
        ...context.core,
        ...context.input,
        ...context.throwGuide,
        ...context.entities,
        ...context.geometry,
        ...context.creatures,
        ...context.collectables,
        ...context.physics,
        ...context.wind,
        ...context.projectiles,
        ...context.combat,
        creatureRuntimeMovementSettings: {
            creatureProjectileGravity: context.core.movementSettings.creatureProjectileGravity,
            collectablePickupRange: context.core.movementSettings.collectablePickupRange
        },
        collectablePhysicsMovementSettings: {
            ...context.core.movementSettings,
            mushroomAmbientRange: context.collectables.mushroomAmbientRange,
            mushroomAmbientBaseVolume: context.collectables.mushroomAmbientBaseVolume,
            mushroomAmbientMinDelayMs: context.collectables.mushroomAmbientMinDelayMs,
            mushroomAmbientMaxDelayMs: context.collectables.mushroomAmbientMaxDelayMs
        },
        creatureProjectileRuntimeMovementSettings: {
            grenadeExplosionPower: context.core.movementSettings.grenadeExplosionPower
        },
        isSolidAtWorld: (x: number, y: number) => !!context.worldCollision.getSolidBlockAtWorld(
            x,
            y,
            context.worldCollision.getSpriteMap(),
            context.worldCollision.spriteScale,
            context.worldCollision.getMapBlocks(),
            context.worldCollision.getDoorEntities(),
            context.worldCollision.getButtonEntities()
        )
    };
}
