import { Collectable } from '../../entities/collectable.js';
import { Creature, toCreatureSaveData } from '../../entities/creature.js';

type GameCreatureCarryProxyOptions = {
    collectableEntities: Collectable[];
    assignEntityId: <T>(obj: T) => T;
};

export function createSpawnCreatureCarryProxy(options: GameCreatureCarryProxyOptions) {
    return function spawnCreatureCarryProxy(creature: Creature) {
        const proxy = options.assignEntityId(new Collectable({
            x: creature.x,
            y: creature.y,
            type: creature.type,
            palette: creature.palette ?? 0,
            rotation: creature.rotation,
            collected: false,
            name: creature.type,
            weight: 0.3,
            pickupEnabled: true,
            storable: false,
            affectsAstronaut: false,
            collision: false,
            velocity: { x: 0, y: 0 },
            isGrounded: false,
            creaturePayload: toCreatureSaveData(creature)
        }));
        options.collectableEntities.push(proxy);
        return proxy;
    };
}
