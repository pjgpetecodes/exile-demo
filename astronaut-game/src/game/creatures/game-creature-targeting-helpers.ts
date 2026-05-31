import type { Position, CreatureProjectileKind } from '../../types/index.js';
import type { Creature } from '../../entities/creature.js';

export function createGameCreatureTargetingHelpers(options: {
    getProjectileKindForFireMode: (fireMode: Creature['fireMode']) => CreatureProjectileKind | null;
    getProjectileSettings: (kind: CreatureProjectileKind) => { speedMultiplier?: number };
    getAstronautVelocity: () => Position;
    clampToRange: (value: number, minimum: number, maximum: number) => number;
    isSolidAtWorld: (x: number, y: number) => boolean;
}) {
    function getCreatureProjectileLaunchSpeed(creature: Creature) {
        const kind = options.getProjectileKindForFireMode(creature.fireMode);
        const projectileSettings = kind ? options.getProjectileSettings(kind) : null;
        return Math.max(1, creature.projectileSpeed) * (projectileSettings?.speedMultiplier ?? 1);
    }

    function getNextCreatureFireAt(frameNow: number, creature: Creature) {
        const baseCooldown = Math.max(250, creature.fireCooldownMs);
        const variance = Math.max(0, creature.fireCooldownVarianceMs ?? 0);
        const offset = variance > 0 ? (Math.random() * 2 - 1) * variance : 0;
        return frameNow + Math.max(250, baseCooldown + offset);
    }

    function hasCreatureLineOfSight(start: Position, target: Position) {
        const dx = target.x - start.x;
        const dy = target.y - start.y;
        const distance = Math.hypot(dx, dy);
        if (distance < 8) {
            return true;
        }

        const steps = Math.max(2, Math.ceil(distance / 6));
        for (let index = 1; index < steps; index++) {
            const progress = index / steps;
            const sampleX = start.x + dx * progress;
            const sampleY = start.y + dy * progress;
            if (options.isSolidAtWorld(sampleX, sampleY)) {
                return false;
            }
        }

        return true;
    }

    function getCreatureTargetPoint(
        creature: Creature,
        aimOrigin: Position,
        targetCenter: Position
    ) {
        const astronautVelocity = options.getAstronautVelocity();
        const leadFactor = Math.max(0, creature.aimLeadFactor ?? 0);
        const astronautSpeed = Math.hypot(astronautVelocity.x, astronautVelocity.y);
        const jitterScale = options.clampToRange(astronautSpeed / 2.5, 0, 1);
        const jitterRadius = Math.max(0, creature.aimJitterPx ?? 0) * jitterScale;
        const projectileTravelFrames = Math.max(
            1,
            Math.hypot(targetCenter.x - aimOrigin.x, targetCenter.y - aimOrigin.y) /
                Math.max(1, getCreatureProjectileLaunchSpeed(creature))
        );
        const jitterAngle = Math.random() * Math.PI * 2;
        const jitterDistance = Math.random() * jitterRadius;

        return {
            x: targetCenter.x + astronautVelocity.x * projectileTravelFrames * leadFactor + Math.cos(jitterAngle) * jitterDistance,
            y: targetCenter.y + astronautVelocity.y * projectileTravelFrames * leadFactor + Math.sin(jitterAngle) * jitterDistance
        };
    }

    return {
        getCreatureProjectileLaunchSpeed,
        getNextCreatureFireAt,
        hasCreatureLineOfSight,
        getCreatureTargetPoint
    };
}
