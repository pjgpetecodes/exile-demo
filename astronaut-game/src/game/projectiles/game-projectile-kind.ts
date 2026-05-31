import type { CreatureFireMode, CreatureProjectileKind } from '../../types/index.js';

export function getProjectileKindForFireMode(fireMode: CreatureFireMode): CreatureProjectileKind | null {
    if (fireMode === 'bullets') {
        return 'bullet';
    }
    if (fireMode === 'grenades') {
        return 'grenade';
    }
    if (fireMode === 'plasma_grenades') {
        return 'plasma_grenade';
    }
    if (fireMode === 'energy_pods') {
        return 'energy_pod';
    }
    return null;
}
