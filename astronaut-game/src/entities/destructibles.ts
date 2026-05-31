export type DestructionSourceRequirement =
    | 'any_explosion'
    | 'grenade_explosion'
    | 'plasma_grenade_explosion'
    | 'coronium_explosion';

export type DestructibleCategory = 'world' | 'doors';

export const DESTRUCTION_SOURCE_OPTIONS: Array<{ value: DestructionSourceRequirement; label: string }> = [
    { value: 'any_explosion', label: 'Any explosion' },
    { value: 'grenade_explosion', label: 'Grenade explosion' },
    { value: 'plasma_grenade_explosion', label: 'Plasma grenade explosion' },
    { value: 'coronium_explosion', label: 'Coronium explosion only' }
];

export function isSpecialStoneDoorType(type: string) {
    return type === 'wall_left_quarter';
}

export function getDefaultDestructibleEnabled(category: DestructibleCategory, type: string) {
    return category === 'doors' || isSpecialStoneDoorType(type);
}

export function getDefaultDestructibleHealth(category: DestructibleCategory, type: string) {
    if (isSpecialStoneDoorType(type)) {
        return 64;
    }
    if (category === 'doors') {
        return 24;
    }
    return 16;
}

export function getDefaultDestructionSource(category: DestructibleCategory, type: string): DestructionSourceRequirement {
    if (isSpecialStoneDoorType(type)) {
        return 'coronium_explosion';
    }
    return 'any_explosion';
}
