import type { Position, CreatureProjectileKind } from '../../types/index.js';
import type { BulletImpactAudioSettings } from '../../config/settings.js';
import { Collectable } from '../../entities/collectable.js';
import type { CreatureProjectileCollectable } from '../collectables/game-collectable-runtime.js';
import type {
    ProjectileImpactEffect,
    DoorDestructionEffect,
    BulletImpactParticle
} from '../runtime/game-main-effect-types.js';

type CollisionBounds = { left: number; right: number; top: number; bottom: number };

type ProjectileSettings = {
    spriteType: string;
    impactAnimation?: {
        frames: string[];
        frameDurationFrames: number;
        paletteSource?: 'projectile' | 'default';
    };
    flightAnimation?: {
        frames: string[];
        frameDurationFrames: number;
    };
    lifetimeFrames: number;
};

export function createProjectileImpactRuntime(options: {
    getProjectileSettings: (kind: CreatureProjectileKind) => ProjectileSettings;
    getEntityCollisionBounds: (entity: any) => CollisionBounds;
    getEntityCenter: (x: number, y: number, bounds: CollisionBounds) => Position;
    getEntityPositionFromCenter: (x: number, y: number, bounds: CollisionBounds) => Position;
    clampToRange: (value: number, minimum: number, maximum: number) => number;
    projectileImpactEffects: ProjectileImpactEffect[];
    doorDestructionEffects: DoorDestructionEffect[];
    bulletImpactParticles: BulletImpactParticle[];
    bulletImpactParticleColors: string[];
    gameAudio: { playBulletImpactSound: (volume: number) => void };
    getBulletImpactAudioSettings: () => BulletImpactAudioSettings;
    applyAstronautBulletImpactBlast: (centerX: number, centerY: number, damage: number) => void;
}) {
    function updateProjectileImpactEffectFrame(effect: ProjectileImpactEffect) {
        const nextType = effect.frames[options.clampToRange(effect.frameIndex, 0, effect.frames.length - 1)];
        const bounds = options.getEntityCollisionBounds({
            type: nextType,
            rotation: effect.rotation
        });
        const position = options.getEntityPositionFromCenter(effect.centerX, effect.centerY, bounds);
        effect.type = nextType;
        effect.x = position.x;
        effect.y = position.y;
    }

    function spawnBulletImpactParticles(centerX: number, centerY: number) {
        const particleCount = 28 + Math.floor(Math.random() * 9);
        for (let index = 0; index < particleCount; index++) {
            const angle = Math.random() * Math.PI * 2;
            const launchRadius = 2 + Math.random() * 6;
            const speed = 1.4 + Math.random() * 4.6;
            const life = 18 + Math.floor(Math.random() * 10);
            options.bulletImpactParticles.push({
                x: centerX + Math.cos(angle) * launchRadius,
                y: centerY + Math.sin(angle) * launchRadius,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed - Math.random() * 1.2,
                color: options.bulletImpactParticleColors[Math.floor(Math.random() * options.bulletImpactParticleColors.length)],
                size: Math.random() < 0.4 ? 4 : 3,
                life,
                maxLife: life
            });
        }
    }

    function spawnProjectileImpactEffect(
        projectile: CreatureProjectileCollectable,
        entityX = projectile.x,
        entityY = projectile.y,
        centerOverride?: Position
    ) {
        const settings = options.getProjectileSettings(projectile.creatureProjectile.kind);
        const impactAnimation = settings.impactAnimation;
        if (!impactAnimation || impactAnimation.frames.length === 0) {
            return;
        }
        const bounds = options.getEntityCollisionBounds(projectile);
        const center = centerOverride ?? options.getEntityCenter(entityX, entityY, bounds);
        const effect: ProjectileImpactEffect = {
            x: entityX,
            y: entityY,
            centerX: center.x,
            centerY: center.y,
            type: impactAnimation.frames[0],
            palette: impactAnimation.paletteSource === 'projectile' ? projectile.palette ?? 0 : 0,
            rotation: 1,
            frameIndex: 0,
            frameTimer: 0,
            frames: [...impactAnimation.frames],
            frameDurationFrames: Math.max(1, impactAnimation.frameDurationFrames)
        };
        updateProjectileImpactEffectFrame(effect);
        options.projectileImpactEffects.push(effect);

        if (projectile.creatureProjectile.kind === 'bullet') {
            options.gameAudio.playBulletImpactSound(options.getBulletImpactAudioSettings().volume);
            spawnBulletImpactParticles(effect.centerX, effect.centerY);
            options.applyAstronautBulletImpactBlast(effect.centerX, effect.centerY, projectile.creatureProjectile.damage);
        }
    }

    function spawnGrenadeExplosionEffect(
        type: 'grenade' | 'plasma_grenade',
        palette: number,
        centerX: number,
        centerY: number
    ) {
        const settings = options.getProjectileSettings(type);
        const effectBounds = options.getEntityCollisionBounds({
            type: settings.spriteType,
            rotation: 1
        });
        const effectPosition = options.getEntityPositionFromCenter(centerX, centerY, effectBounds);
        spawnProjectileImpactEffect(new Collectable({
            x: effectPosition.x,
            y: effectPosition.y,
            type: settings.spriteType,
            palette,
            rotation: 1,
            pickupEnabled: false,
            storable: false,
            affectsAstronaut: false,
            collision: false,
            velocity: { x: 0, y: 0 },
            weight: 0,
            bounciness: 0,
            isGrounded: false,
            creatureProjectile: {
                kind: type,
                homing: false,
                remainingFrames: 0,
                damage: 0
            }
        }) as CreatureProjectileCollectable);
    }

    function updateProjectileImpactEffects() {
        const nextEffects: ProjectileImpactEffect[] = [];
        for (const effect of options.projectileImpactEffects) {
            effect.frameTimer++;
            if (effect.frameTimer >= effect.frameDurationFrames) {
                effect.frameTimer = 0;
                effect.frameIndex++;
                if (effect.frameIndex >= effect.frames.length) {
                    continue;
                }
                updateProjectileImpactEffectFrame(effect);
            }
            nextEffects.push(effect);
        }
        options.projectileImpactEffects.length = 0;
        options.projectileImpactEffects.push(...nextEffects);
    }

    function updateDoorDestructionEffects() {
        const nextEffects: DoorDestructionEffect[] = [];
        for (const effect of options.doorDestructionEffects) {
            effect.x += effect.vx;
            effect.y += effect.vy;
            effect.vy += 0.22;
            effect.vx *= 0.97;
            effect.angleDegrees += effect.spinVelocity;
            effect.spinVelocity *= 0.92;
            effect.life--;
            if (effect.life <= 0) {
                continue;
            }
            nextEffects.push(effect);
        }
        options.doorDestructionEffects.length = 0;
        options.doorDestructionEffects.push(...nextEffects);
    }

    function getProjectileAngleDegrees(velocity: Position) {
        if (!Number.isFinite(velocity.x) || !Number.isFinite(velocity.y)) {
            return 0;
        }
        if (Math.abs(velocity.x) < 0.001 && Math.abs(velocity.y) < 0.001) {
            return 0;
        }
        return (Math.atan2(velocity.y, velocity.x) * 180) / Math.PI;
    }

    function updateProjectileFlightFrame(
        projectile: CreatureProjectileCollectable,
        projectileSettings: ProjectileSettings
    ) {
        const flightAnimation = projectileSettings.flightAnimation;
        if (!flightAnimation || flightAnimation.frames.length === 0) {
            projectile.type = projectileSettings.spriteType;
            return;
        }

        const ageFrames = Math.max(0, projectileSettings.lifetimeFrames - projectile.creatureProjectile.remainingFrames);
        const frameDurationFrames = Math.max(1, flightAnimation.frameDurationFrames);
        if (projectile.creatureProjectile.kind === 'bullet' && flightAnimation.frames.length > 1) {
            const velocity = projectile.velocity;
            const speed = Math.hypot(velocity.x, velocity.y);
            if (speed <= 0.001) {
                projectile.type = flightAnimation.frames[0];
                return;
            }
            const angle = Math.atan2(Math.abs(velocity.y), Math.abs(velocity.x));
            const angleRatio = options.clampToRange(angle / (Math.PI / 2), 0, 1);
            const frameIndex = Math.min(
                flightAnimation.frames.length - 1,
                Math.round(angleRatio * (flightAnimation.frames.length - 1))
            );
            projectile.type = flightAnimation.frames[frameIndex];
            return;
        }

        const frameIndex = Math.floor(ageFrames / frameDurationFrames) % flightAnimation.frames.length;
        projectile.type = flightAnimation.frames[frameIndex];
    }

    return {
        spawnProjectileImpactEffect,
        spawnGrenadeExplosionEffect,
        updateProjectileImpactEffects,
        updateDoorDestructionEffects,
        getProjectileAngleDegrees,
        updateProjectileFlightFrame
    };
}
