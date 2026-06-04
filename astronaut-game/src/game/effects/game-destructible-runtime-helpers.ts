import type { Position } from '../../types/index.js';
import type { Door } from '../../entities/door.js';
import type { MapBlock } from '../../world/map.js';
import type { DestructionSourceRequirement } from '../../entities/destructibles.js';

type CollisionBounds = { left: number; right: number; top: number; bottom: number };

type DestructibleRuntimeEntity = {
    x: number;
    y: number;
    type: string;
    palette?: string | number;
    destructible?: boolean;
    destructionHealth?: number;
    destructionSource?: DestructionSourceRequirement;
};

type CollectableEntity = {
    x: number;
    y: number;
    stored?: boolean;
};

type CreateGameDestructibleRuntimeHelpersOptions = {
    getCollectableEntities: () => CollectableEntity[];
    isRadioactiveBoulderCollectable: (collectable: any) => boolean;
    isCollectableCollected: (collectable: any) => boolean;
    getEntityCenter: (x: number, y: number, bounds: CollisionBounds) => Position;
    getEntityCollisionBounds: (entity: any) => CollisionBounds;
    getDefaultDestructibleEnabled: (category: 'world' | 'doors', type: string) => boolean;
    getDefaultDestructibleHealth: (category: 'world' | 'doors', type: string) => number;
    getDefaultDestructionSource: (
        category: 'world' | 'doors',
        type: string
    ) => DestructionSourceRequirement;
    getMapBlocks: () => MapBlock[];
    getDoorEntities: () => Door[];
};

export function createGameDestructibleRuntimeHelpers(options: CreateGameDestructibleRuntimeHelpersOptions) {
    function isCoroniumExplosionAtCenter(center: Position) {
        const radioactiveBoulderCenters = options.getCollectableEntities()
            .filter((collectable) =>
                options.isRadioactiveBoulderCollectable(collectable) &&
                !options.isCollectableCollected(collectable) &&
                !collectable.stored
            )
            .map((collectable) => options.getEntityCenter(
                collectable.x,
                collectable.y,
                options.getEntityCollisionBounds(collectable)
            ));

        for (let index = 0; index < radioactiveBoulderCenters.length; index++) {
            for (let otherIndex = index + 1; otherIndex < radioactiveBoulderCenters.length; otherIndex++) {
                const a = radioactiveBoulderCenters[index];
                const b = radioactiveBoulderCenters[otherIndex];
                const midpoint = {
                    x: (a.x + b.x) / 2,
                    y: (a.y + b.y) / 2
                };
                const pairDistance = Math.hypot(a.x - b.x, a.y - b.y);
                if (
                    pairDistance <= 120 &&
                    Math.hypot(midpoint.x - center.x, midpoint.y - center.y) <= 28
                ) {
                    return true;
                }
            }
        }

        return false;
    }

    function getEffectiveDestructibleSettings(entity: DestructibleRuntimeEntity, category: 'world' | 'doors') {
        return {
            destructible: typeof entity.destructible === 'boolean'
                ? entity.destructible
                : options.getDefaultDestructibleEnabled(category, entity.type),
            health: typeof entity.destructionHealth === 'number'
                ? Math.max(0.1, entity.destructionHealth)
                : options.getDefaultDestructibleHealth(category, entity.type),
            source: typeof entity.destructionSource === 'string'
                ? entity.destructionSource
                : options.getDefaultDestructionSource(category, entity.type)
        };
    }

    function matchesDestructionSourceRequirement(
        requiredSource: DestructionSourceRequirement,
        source: DestructionSourceRequirement
    ) {
        if (requiredSource === 'any_explosion') {
            return true;
        }
        return requiredSource === source;
    }

    function removeDoorEntity(door: Door) {
        const index = options.getDoorEntities().indexOf(door);
        if (index >= 0) {
            options.getDoorEntities().splice(index, 1);
        }
    }

    function removeMapBlockEntity(block: MapBlock) {
        const index = options.getMapBlocks().indexOf(block);
        if (index >= 0) {
            options.getMapBlocks().splice(index, 1);
        }
    }

    function getDestructibleCollisionBounds(entity: DestructibleRuntimeEntity) {
        return options.getEntityCollisionBounds({
            ...entity,
            palette: typeof entity.palette === 'number' ? entity.palette : 0
        });
    }

    return {
        isCoroniumExplosionAtCenter,
        getEffectiveDestructibleSettings,
        matchesDestructionSourceRequirement,
        removeDoorEntity,
        removeMapBlockEntity,
        getDestructibleCollisionBounds
    };
}
