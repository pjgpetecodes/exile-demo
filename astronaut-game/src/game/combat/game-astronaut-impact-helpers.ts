import type { Astronaut } from '../../types/index.js';
import type { CreatureProjectileCollectable } from '../collectables/game-collectable-runtime.js';

type EntityRect = { left: number; right: number; top: number; bottom: number };

type GameAstronautImpactHelpersOptions = {
    astronaut: Astronaut;
    movementSettings: {
        astronautExplosionSpinMinForce: number;
        astronautExplosionSpinChance: number;
    };
    getAstronautRect: () => EntityRect;
    isFacingLeft: () => boolean;
    flipAstronaut: () => void;
    applyAstronautDamage: (damage: number, now?: number) => void;
    applyAstronautBulletDaze: (now: number, durationMs: number) => void;
    bulletDazeDurationMs: number;
    getCreatureProjectilePhysicsSettings: (projectile: CreatureProjectileCollectable) => any;
    getDynamicObjectPushScale: (projectile: CreatureProjectileCollectable, physicsSettings: any) => number;
    gameAudio: { playAstronautImpactSound: () => void };
    getNow: () => number;
    getRandom: () => number;
};

export function createAstronautImpactHelpers(options: GameAstronautImpactHelpersOptions) {
    function applyAstronautImpact(sourceX: number, sourceY: number, force: number, canSpinFromExplosion = false) {
        const astronautRect = options.getAstronautRect();
        const astronautCenterX = (astronautRect.left + astronautRect.right) / 2;
        const astronautCenterY = (astronautRect.top + astronautRect.bottom) / 2;
        const dx = astronautCenterX - sourceX;
        const dy = astronautCenterY - sourceY;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const wasLanded = options.astronaut.isLanded;
        const horizontalImpulse = (dx / distance) * Math.max(1, force * 1.1);
        let verticalDirection = dy / distance;
        if (wasLanded && verticalDirection > -0.35) {
            verticalDirection = -0.35;
        }

        options.astronaut.isLanded = false;
        options.astronaut.isFlying = true;
        options.astronaut.velocity.x += horizontalImpulse;
        options.astronaut.velocity.y += verticalDirection * Math.max(1.1, force * 0.95);
        if (
            canSpinFromExplosion &&
            force >= options.movementSettings.astronautExplosionSpinMinForce &&
            options.getRandom() < options.movementSettings.astronautExplosionSpinChance
        ) {
            const blastDirection = Math.sign(dx);
            if (blastDirection !== 0) {
                const shouldFaceLeft = blastDirection < 0;
                if (options.isFacingLeft() !== shouldFaceLeft) {
                    options.flipAstronaut();
                }
            }
        }
        options.gameAudio.playAstronautImpactSound();
    }

    function applyAstronautBulletImpactBlast(centerX: number, centerY: number, damage: number) {
        const blastRadius = 34;
        const astronautRect = options.getAstronautRect();
        const astronautCenter = {
            x: (astronautRect.left + astronautRect.right) / 2,
            y: (astronautRect.top + astronautRect.bottom) / 2
        };
        const astronautDistance = Math.hypot(astronautCenter.x - centerX, astronautCenter.y - centerY);
        if (astronautDistance > blastRadius) {
            return;
        }

        const proximity = 1 - astronautDistance / blastRadius;
        options.applyAstronautDamage(
            Math.max(6, damage * (5 + proximity * 7)),
            options.getNow()
        );
        options.applyAstronautBulletDaze(
            options.getNow(),
            options.bulletDazeDurationMs + damage * 90 + proximity * 140
        );
        applyAstronautImpact(
            centerX,
            centerY,
            Math.max(1.6, damage * 0.75 + proximity * 2.6),
            true
        );
    }

    function applyAstronautProjectileImpact(projectile: CreatureProjectileCollectable) {
        if (projectile.creatureProjectile.kind === 'bullet') {
            return;
        }

        const astronautDamage = Math.max(
            5,
            projectile.creatureProjectile.damage * 8
        );
        options.applyAstronautDamage(astronautDamage);

        const speed = Math.hypot(projectile.velocity.x, projectile.velocity.y);
        if (speed < 0.001) {
            applyAstronautImpact(projectile.x, projectile.y, Math.max(0.9, projectile.creatureProjectile.damage));
            return;
        }

        const physicsSettings = options.getCreatureProjectilePhysicsSettings(projectile);
        const pushScale = options.getDynamicObjectPushScale(projectile, physicsSettings);
        const force = Math.max(
            projectile.creatureProjectile.damage * 0.7,
            speed * Math.max(0.45, projectile.weight * 2.4) * pushScale
        );
        options.astronaut.velocity.x += (projectile.velocity.x / speed) * force;
        options.astronaut.velocity.y += (projectile.velocity.y / speed) * Math.max(0.55, force * 0.8);
        options.gameAudio.playAstronautImpactSound();
    }

    return {
        applyAstronautImpact,
        applyAstronautBulletImpactBlast,
        applyAstronautProjectileImpact
    };
}
