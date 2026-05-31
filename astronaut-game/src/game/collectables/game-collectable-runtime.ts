import { Collectable, getDefaultGrenadeExplosionPower, isGrenadeCollectableType } from '../../entities/collectable.js';
import type { DestructionSourceRequirement } from '../../entities/destructibles.js';
import { MOVEMENT_SETTINGS } from '../../config/settings.js';
import type { CreatureProjectileRuntimeData } from '../../types/index.js';

// Collectable and grenade runtime logic is extracted from game.ts for clearer AI-sized modules.

export type CreatureProjectileCollectable = Collectable & {
    creatureProjectile: CreatureProjectileRuntimeData;
};

export function isCreatureProjectileCollectable(collectable: Collectable): collectable is CreatureProjectileCollectable {
    return !!collectable.creatureProjectile;
}

export function isCollectableCollected(collectable: Collectable, collectedEntityIds: Set<number>) {
    return typeof collectable.entityId === 'number' && collectedEntityIds.has(collectable.entityId);
}

export function markCollectableCollected(collectable: Collectable, collectedEntityIds: Set<number>) {
    if (typeof collectable.entityId === 'number') {
        collectedEntityIds.add(collectable.entityId);
    }
}

export function syncGrenadeFuseState(collectable: Collectable, now: number = performance.now()) {
    if (!isGrenadeCollectable(collectable)) {
        return;
    }
    if (collectable.armed) {
        if (typeof collectable.armedAtMs !== 'number') {
            collectable.armedAtMs = now;
        }
    } else {
        collectable.armedAtMs = undefined;
    }
}

export function setGrenadeCollectableArmedState(collectable: Collectable, armed: boolean, now: number = performance.now()) {
    if (!isGrenadeCollectable(collectable)) {
        return;
    }
    if (armed) {
        collectable.arm(now);
    } else {
        collectable.disarm();
    }
}

export function isGrenadeCollectable(collectable: Collectable | null | undefined): collectable is Collectable {
    return !!collectable && isGrenadeCollectableType(collectable.type);
}

export function getGrenadeExplosionRadius(type: string, explosionRadius?: number) {
    const fallbackRadius = type === 'plasma_grenade'
        ? MOVEMENT_SETTINGS.plasmaGrenadeExplosionRadius
        : MOVEMENT_SETTINGS.grenadeExplosionRadius;
    return typeof explosionRadius === 'number'
        ? Math.max(1, explosionRadius)
        : fallbackRadius;
}

function clampToRange(value: number, minimum: number, maximum: number) {
    return Math.max(minimum, Math.min(maximum, value));
}

export function getGrenadeExplosionPower(type: string, explosionPower?: number) {
    const fallbackPower = getDefaultGrenadeExplosionPower(type) ?? MOVEMENT_SETTINGS.grenadeExplosionPower;
    const resolvedPower = typeof explosionPower === 'number' ? explosionPower : fallbackPower;
    return clampToRange(resolvedPower, 0.5, MOVEMENT_SETTINGS.grenadeMaxExplosionPower);
}

export function getExplosionDamageSource(type: 'grenade' | 'plasma_grenade' | 'coronium'): DestructionSourceRequirement {
    if (type === 'plasma_grenade') {
        return 'plasma_grenade_explosion';
    }
    if (type === 'coronium') {
        return 'coronium_explosion';
    }
    return 'grenade_explosion';
}

export function isRadioactiveBoulderCollectable(collectable: Collectable) {
    return collectable.type === 'boulder' && collectable.radioactive === true;
}

export function getCreatureProjectileCollectables(collectables: Collectable[]) {
    return collectables.filter(isCreatureProjectileCollectable);
}

export function getRenderableCollectables(
    collectables: Collectable[],
    collectedEntityIds: Set<number>
) {
    return collectables.filter((collectable) =>
        !isCreatureProjectileCollectable(collectable) &&
        !isCollectableCollected(collectable, collectedEntityIds) &&
        !collectable.stored &&
        !collectable.held
    );
}

export function getDesignerRenderableCollectables(collectables: Collectable[]) {
    return collectables.filter((collectable) =>
        !isCreatureProjectileCollectable(collectable) &&
        !collectable.held
    );
}

export function getSavableCollectables(collectables: Collectable[]) {
    return collectables.filter((collectable) => !isCreatureProjectileCollectable(collectable));
}
