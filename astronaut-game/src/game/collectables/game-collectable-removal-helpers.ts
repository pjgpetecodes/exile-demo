import type { Collectable } from '../../entities/collectable.js';

type GameCollectableRemovalHelpersOptions = {
    getHeldCollectable: () => Collectable | null;
    setHeldCollectable: (collectable: Collectable | null) => void;
    getStoredCollectables: () => Collectable[];
    getInventoryCycleIndex: () => number;
    setInventoryCycleIndex: (index: number) => void;
    collectableEntities: Collectable[];
    collectedCollectableEntityIds: Set<number>;
};

export function createGameCollectableRemovalHelpers(options: GameCollectableRemovalHelpersOptions) {
    function cleanupCollectableReferences(collectable: Collectable) {
        if (options.getHeldCollectable() === collectable) {
            options.setHeldCollectable(null);
        }
        const storedCollectables = options.getStoredCollectables();
        const storedIndex = storedCollectables.indexOf(collectable);
        if (storedIndex >= 0) {
            storedCollectables.splice(storedIndex, 1);
            if (storedCollectables.length === 0) {
                options.setInventoryCycleIndex(-1);
            } else if (options.getInventoryCycleIndex() >= storedCollectables.length) {
                options.setInventoryCycleIndex(storedCollectables.length - 1);
            }
        }
    }

    function removeCollectableEntity(collectable: Collectable) {
        cleanupCollectableReferences(collectable);
        if (typeof collectable.entityId === 'number') {
            options.collectedCollectableEntityIds.delete(collectable.entityId);
        }
        const index = options.collectableEntities.indexOf(collectable);
        if (index >= 0) {
            options.collectableEntities.splice(index, 1);
        }
    }

    return {
        cleanupCollectableReferences,
        removeCollectableEntity
    };
}
