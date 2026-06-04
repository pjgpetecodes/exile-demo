import { Astronaut } from '../../types/index.js';
import { Collectable } from '../../entities/collectable.js';
import { Creature } from '../../entities/creature.js';
import { Door } from '../../entities/door.js';

export function shouldRunGameInteractiveFrameRate(context: {
    isDesignerOpen: () => boolean;
    hasActiveJetpackDots: () => boolean;
    keys: Record<string, boolean>;
    isTeleporting: () => boolean;
    isFlySwitching: () => boolean;
    isFlyDownTransitioning: () => boolean;
    getThrowGuideDotCount: () => number;
    getDoorEntities: () => Door[];
    getCreatureEntities: () => Creature[];
    getCollectableEntities: () => Collectable[];
    isCreatureProjectileCollectable: (collectable: Collectable) => boolean;
    astronaut: Astronaut;
    getWalkSpeed: () => number;
    activeMotionEpsilon: number;
}) {
    const hasPressedKeys = Object.keys(context.keys).some((key) => context.keys[key]);
    if (context.isDesignerOpen()) {
        return true;
    }

    const hasMovingCollectables = context.getCollectableEntities().some((collectable) =>
        !collectable.stored &&
        (
            collectable.armed ||
            collectable.held ||
            !collectable.isGrounded ||
            Math.abs(collectable.velocity.x) > context.activeMotionEpsilon ||
            Math.abs(collectable.velocity.y) > context.activeMotionEpsilon ||
            collectable.astronautCollisionIgnoreFrames > 0
        )
    );
    const hasActiveCreatureWork = context.getCreatureEntities().length > 0
        || context.getCollectableEntities().some(context.isCreatureProjectileCollectable);

    return (
        hasPressedKeys ||
        context.isTeleporting() ||
        context.isFlySwitching() ||
        context.isFlyDownTransitioning() ||
        context.getThrowGuideDotCount() > 0 ||
        context.hasActiveJetpackDots() ||
        context.getDoorEntities().some((door) => door.animating) ||
        hasActiveCreatureWork ||
        hasMovingCollectables ||
        !context.astronaut.isLanded ||
        context.astronaut.energy < context.astronaut.maxEnergy ||
        Math.abs(context.astronaut.velocity.x) > context.activeMotionEpsilon ||
        Math.abs(context.astronaut.velocity.y) > context.activeMotionEpsilon ||
        Math.abs(context.getWalkSpeed()) > context.activeMotionEpsilon
    );
}
