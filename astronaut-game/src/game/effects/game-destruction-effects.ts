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

type DoorDestructionEffect = {
    x: number;
    y: number;
    type: string;
    palette: number;
    rotation: number;
    translation?: string | null;
    state?: Record<string, unknown>;
    flipAroundVisibleCenter?: boolean;
    angleDegrees: number;
    vx: number;
    vy: number;
    spinVelocity: number;
    life: number;
    maxLife: number;
};

type BulletImpactParticle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    life: number;
    maxLife: number;
};

type GameDestructionEffectsOptions = {
    getDoorEntities: () => Door[];
    getMapBlocks: () => MapBlock[];
    getDestructibleCollisionBounds: (entity: DestructibleRuntimeEntity) => CollisionBounds;
    getEntityCollisionBounds: (entity: any) => CollisionBounds;
    getEntityCenter: (x: number, y: number, bounds: CollisionBounds) => Position;
    spawnGrenadeExplosionEffect: (
        type: 'grenade' | 'plasma_grenade',
        palette: number,
        centerX: number,
        centerY: number
    ) => void;
    doorDestructionEffects: DoorDestructionEffect[];
    bulletImpactParticles: BulletImpactParticle[];
    removeDoorEntity: (door: Door) => void;
    removeMapBlockEntity: (block: MapBlock) => void;
    afterWorldDataMutated: () => void;
    getEffectiveDestructibleSettings: (
        entity: DestructibleRuntimeEntity,
        category: 'world' | 'doors'
    ) => {
        destructible: boolean;
        health: number;
        source: DestructionSourceRequirement;
    };
    matchesDestructionSourceRequirement: (
        requiredSource: DestructionSourceRequirement,
        source: DestructionSourceRequirement
    ) => boolean;
    destructibleDamageByEntity: WeakMap<object, number>;
    clampToRange: (value: number, minimum: number, maximum: number) => number;
    getRenderedEntityWorldSprite: (entity: any) => { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null;
    spriteScale: number;
    canvas: HTMLCanvasElement;
};

export function createGameDestructionEffects(options: GameDestructionEffectsOptions) {
    function spawnDestructibleExplosionEffect(
        entity: DestructibleRuntimeEntity,
        category: 'world' | 'doors',
        source: DestructionSourceRequirement,
        centerX: number,
        centerY: number,
        blastCenter?: Position
    ) {
        const palette = typeof entity.palette === 'number' ? entity.palette : 0;
        const explosionType = source === 'plasma_grenade_explosion' || source === 'coronium_explosion'
            ? 'plasma_grenade'
            : 'grenade';
        options.spawnGrenadeExplosionEffect(explosionType, palette, centerX, centerY);
        if (category !== 'doors') {
            return;
        }

        const sourceCenter = blastCenter ?? { x: centerX, y: centerY };
        const horizontalDirection = centerX >= sourceCenter.x ? 1 : -1;
        const verticalDirection = centerY - sourceCenter.y;
        const distance = Math.hypot(centerX - sourceCenter.x, verticalDirection);
        const normalizedDirection = distance > 0.001
            ? {
                x: (centerX - sourceCenter.x) / distance,
                y: verticalDirection / distance
            }
            : {
                x: horizontalDirection,
                y: -0.35
            };
        const liftBias = Math.min(-0.25, normalizedDirection.y - 0.35);
        options.doorDestructionEffects.push({
            x: entity.x,
            y: entity.y,
            type: entity.type,
            palette,
            rotation: typeof (entity as { rotation?: unknown }).rotation === 'number'
                ? Math.round(Number((entity as { rotation?: unknown }).rotation))
                : 1,
            translation: typeof (entity as { translation?: unknown }).translation === 'string'
                ? String((entity as { translation?: unknown }).translation)
                : undefined,
            state: typeof (entity as { state?: unknown }).state === 'object' && (entity as { state?: unknown }).state
                ? { ...((entity as { state?: Record<string, unknown> }).state ?? {}) }
                : undefined,
            flipAroundVisibleCenter: (entity as { flipAroundVisibleCenter?: unknown }).flipAroundVisibleCenter === true,
            angleDegrees: 0,
            vx: normalizedDirection.x * 8.5,
            vy: liftBias * 6.4,
            spinVelocity: horizontalDirection * 28,
            life: 24,
            maxLife: 24
        });
    }

    function damageDestructibleEntity(
        entity: DestructibleRuntimeEntity,
        category: 'world' | 'doors',
        damage: number,
        source: DestructionSourceRequirement,
        blastCenter?: Position
    ) {
        const settings = options.getEffectiveDestructibleSettings(entity, category);
        if (
            !settings.destructible ||
            damage <= 0 ||
            !options.matchesDestructionSourceRequirement(settings.source, source)
        ) {
            return false;
        }

        const accumulatedDamage = (options.destructibleDamageByEntity.get(entity as object) ?? 0) + damage;
        if (accumulatedDamage < settings.health) {
            options.destructibleDamageByEntity.set(entity as object, accumulatedDamage);
            return false;
        }

        const bounds = options.getDestructibleCollisionBounds(entity);
        const center = options.getEntityCenter(entity.x, entity.y, bounds);
        spawnDestructibleExplosionEffect(entity, category, source, center.x, center.y, blastCenter);
        options.destructibleDamageByEntity.delete(entity as object);
        if (category === 'doors') {
            options.removeDoorEntity(entity as Door);
        } else {
            options.removeMapBlockEntity(entity as MapBlock);
        }
        return true;
    }

    function applyExplosionDamageToDestructibles(
        center: Position,
        radius: number,
        maxDamage: number,
        source: DestructionSourceRequirement
    ) {
        let destroyedAny = false;
        let destroyedDoor = false;

        for (const door of [...options.getDoorEntities()]) {
            const bounds = options.getEntityCollisionBounds(door);
            const entityCenter = options.getEntityCenter(door.x, door.y, bounds);
            const distance = Math.hypot(entityCenter.x - center.x, entityCenter.y - center.y);
            if (distance > radius) {
                continue;
            }
            const scaledDamage = maxDamage * (1 - distance / radius);
            if (damageDestructibleEntity(door, 'doors', scaledDamage, source, center)) {
                destroyedAny = true;
                destroyedDoor = true;
            }
        }

        for (const block of [...options.getMapBlocks()]) {
            const bounds = options.getDestructibleCollisionBounds(block);
            const entityCenter = options.getEntityCenter(block.x, block.y, bounds);
            const distance = Math.hypot(entityCenter.x - center.x, entityCenter.y - center.y);
            if (distance > radius) {
                continue;
            }
            const scaledDamage = maxDamage * (1 - distance / radius);
            if (damageDestructibleEntity(block, 'world', scaledDamage, source, center)) {
                destroyedAny = true;
            }
        }

        if (destroyedAny) {
            options.afterWorldDataMutated();
        }

        return { destroyedAny, destroyedDoor };
    }

    function drawDoorDestructionEffects(context: CanvasRenderingContext2D, camera: Position) {
        for (const effect of options.doorDestructionEffects) {
            const rendered = options.getRenderedEntityWorldSprite(effect);
            if (!rendered) {
                continue;
            }
            const age = effect.maxLife - effect.life;
            const fadeAlpha = options.clampToRange(effect.life / effect.maxLife, 0, 1);
            const alpha = Math.max(0.2, fadeAlpha);
            if (alpha <= 0.02) {
                continue;
            }
            const drawX = rendered.drawX - camera.x;
            const drawY = rendered.drawY - camera.y;
            const drawWidth = rendered.canvas.width * options.spriteScale;
            const drawHeight = rendered.canvas.height * options.spriteScale;
            const flashProgress = age < 6 ? 1 - age / 6 : 0;
            context.save();
            context.globalAlpha = alpha;
            context.drawImage(rendered.canvas, drawX, drawY, drawWidth, drawHeight);
            if (flashProgress > 0) {
                const flashScale = 1 + flashProgress * 0.24;
                const flashWidth = drawWidth * flashScale;
                const flashHeight = drawHeight * flashScale;
                context.globalCompositeOperation = 'lighter';
                context.globalAlpha = 0.55 * flashProgress;
                context.drawImage(
                    rendered.canvas,
                    drawX - (flashWidth - drawWidth) / 2,
                    drawY - (flashHeight - drawHeight) / 2,
                    flashWidth,
                    flashHeight
                );
            }
            context.restore();
        }
    }

    function updateAndDrawBulletImpactParticles(context: CanvasRenderingContext2D | null, camera: Position) {
        const nextParticles: BulletImpactParticle[] = [];
        for (const particle of options.bulletImpactParticles) {
            particle.x += particle.vx;
            particle.y += particle.vy;
            particle.vy += 0.08;
            particle.vx *= 0.97;
            particle.life--;

            if (particle.life <= 0) {
                continue;
            }

            const screenX = Math.round(particle.x - camera.x);
            const screenY = Math.round(particle.y - camera.y);
            if (
                screenX + particle.size < 0 ||
                screenX > options.canvas.width ||
                screenY + particle.size < 0 ||
                screenY > options.canvas.height
            ) {
                continue;
            }

            nextParticles.push(particle);
            if (context) {
                context.save();
                context.globalAlpha = Math.max(0.45, particle.life / particle.maxLife);
                context.fillStyle = particle.color;
                context.fillRect(screenX, screenY, particle.size, particle.size);
                context.restore();
            }
        }

        options.bulletImpactParticles.length = 0;
        options.bulletImpactParticles.push(...nextParticles);
    }

    return {
        spawnDestructibleExplosionEffect,
        applyExplosionDamageToDestructibles,
        drawDoorDestructionEffects,
        updateAndDrawBulletImpactParticles
    };
}
