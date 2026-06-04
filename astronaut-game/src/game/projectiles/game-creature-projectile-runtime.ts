import type { Collectable } from '../../entities/collectable.js';
import { Collectable as CollectableEntity } from '../../entities/collectable.js';
import type { Creature } from '../../entities/creature.js';
import type {
    CreatureFireMode,
    CreatureProjectileKind,
    CreatureProjectileSettings,
    Position
} from '../../types/index.js';
import type { CreatureProjectileCollectable } from '../collectables/game-collectable-runtime.js';

type Rect = { left: number; right: number; top: number; bottom: number };

type ProjectileRuntimeFactoryOptions = {
    spriteScale: number;
    movementSettings: {
        grenadeExplosionPower: number;
    };
    creatureProjectileSettings: Record<'grenade' | 'plasma_grenade', { defaultBounciness: number }>;
    getCollectableEntities: () => Collectable[];
    getCreatureEntities: () => Creature[];
    getAstronautRect: () => Rect;
    getAstronautPosition: () => Position;
    getProjectileKindForFireMode: (fireMode: CreatureFireMode) => CreatureProjectileKind | null;
    getProjectileSettings: (kind: CreatureProjectileKind) => CreatureProjectileSettings;
    updateProjectileFlightFrame: (projectile: CreatureProjectileCollectable, projectileSettings: CreatureProjectileSettings) => void;
    getTurretFacingRotations: (authoredRotation: number) => { left: number; right: number };
    isTurretLikeCreature: (creature: Creature) => boolean;
    getEntityCollisionBounds: (entity: any) => Rect;
    getEntityCenter: (x: number, y: number, bounds: Rect) => Position;
    getEntityRect: (x: number, y: number, bounds: Rect) => Rect;
    getEntityFrontAnchorPoint: (entity: any, direction: Position) => Position | null;
    getEntitySideAnchorPoint: (entity: any, side: 'left' | 'right') => Position | null;
    getEntityPositionFromCenter: (centerX: number, centerY: number, bounds: Rect) => Position;
    getProjectileAngleDegrees: (velocity: Position) => number;
    assignEntityId: <T>(entity: T) => T;
    syncGrenadeFuseState: (collectable: Collectable) => void;
    getDefaultGrenadeExplosionPower: (kind: 'grenade' | 'plasma_grenade') => number | undefined;
    getGrenadeExplosionRadius: (kind: 'grenade' | 'plasma_grenade', value?: number) => number;
    getGrenadeExplosionPower: (kind: 'grenade' | 'plasma_grenade', value?: number) => number;
    getExplosionDamageSource: (source: 'coronium' | 'grenade' | 'plasma_grenade') => any;
    isGrenadeCollectable: (collectable: Collectable | null | undefined) => boolean;
    removeCollectableEntity: (collectable: Collectable) => void;
    updateSingleCollectablePhysics: (collectable: Collectable, physicsSettings: any, options?: any) => { hitWorld: boolean };
    getCreatureProjectilePhysicsSettings: (collectable: Pick<Collectable, 'bounciness' | 'creatureProjectile'>) => any;
    isSolidAtWorld: (x: number, y: number) => boolean;
    getRenderedEntityWorldSprite: (entity: any) => { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null;
    getAstronautRenderedWorldSprite: () => { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null;
    isRenderedSpriteOpaqueAtWorld: (
        renderedSprite: { canvas: HTMLCanvasElement; drawX: number; drawY: number } | null,
        worldX: number,
        worldY: number
    ) => boolean;
    spawnProjectileImpactEffect: (
        projectile: CreatureProjectileCollectable,
        entityX: number,
        entityY: number,
        impactPoint?: Position
    ) => void;
    applyDamageToCreature: (creature: Creature, damage: number) => boolean;
    applyAstronautProjectileImpact: (projectile: CreatureProjectileCollectable) => void;
    applyAstronautDamage: (damage: number) => void;
    applyAstronautImpact: (sourceX: number, sourceY: number, force: number, canSpinFromExplosion?: boolean) => void;
    isCoroniumExplosionAtCenter: (center: Position) => boolean;
    applyExplosionDamageToDestructibles: (
        center: Position,
        radius: number,
        damage: number,
        destructionSource: any
    ) => { destroyedDoor: boolean };
    getDoorCount: () => number;
    gameAudio: {
        playExplosionDamageSound: (destroyedDoor: boolean, volume: number) => void;
        playManifestSound: (key: string, volume?: number) => void;
    };
    getBulletImpactAudioSettings: () => { volume: number };
    convertProjectileToEnergyPodCollectable: (projectile: CreatureProjectileCollectable) => void;
    triggerAstronautEmergencyTeleport: () => void;
    isCreatureProjectileCollectable: (collectable: Collectable) => collectable is CreatureProjectileCollectable;
    spawnGrenadeExplosionEffect: (kind: 'grenade' | 'plasma_grenade', palette: number, x: number, y: number) => void;
};

export function createCreatureProjectileRuntime(options: ProjectileRuntimeFactoryOptions) {
    const processedGrenadeExplosions = new WeakSet<Collectable>();

    function removeCollectableFromWorld(collectable: Collectable) {
        options.removeCollectableEntity(collectable);
        const entities = options.getCollectableEntities();
        const index = entities.indexOf(collectable);
        if (index >= 0) {
            entities.splice(index, 1);
        }
    }

    function markProjectileExpired(projectile: CreatureProjectileCollectable) {
        // Guard against repeated impact/explosion processing if a projectile lingers for any reason.
        projectile.creatureProjectile.impacted = true;
        if (options.isCreatureProjectileCollectable(projectile)) {
            removeCollectableFromWorld(projectile);
        }
    }

    function projectileOverlapsCreature(projectile: CreatureProjectileCollectable, creature: Creature) {
        const projectileBounds = options.getEntityCollisionBounds(projectile);
        const projectileRect = options.getEntityRect(projectile.x, projectile.y, projectileBounds);
        const creatureBounds = options.getEntityCollisionBounds(creature);
        const creatureRect = options.getEntityRect(creature.x, creature.y, creatureBounds);
        return (
            projectileRect.right >= creatureRect.left &&
            projectileRect.left <= creatureRect.right &&
            projectileRect.bottom >= creatureRect.top &&
            projectileRect.top <= creatureRect.bottom
        );
    }

    function explodeProjectile(projectile: CreatureProjectileCollectable, entityX = projectile.x, entityY = projectile.y) {
        const settings = options.getProjectileSettings(projectile.creatureProjectile.kind);
        const radius = settings.splashRadius;
        if (!radius) {
            options.spawnProjectileImpactEffect(projectile, entityX, entityY);
            return;
        }
        const bounds = options.getEntityCollisionBounds(projectile);
        const center = options.getEntityCenter(entityX, entityY, bounds);
        options.spawnProjectileImpactEffect(projectile, entityX, entityY);
        const destructionSource = options.isCoroniumExplosionAtCenter(center)
            ? options.getExplosionDamageSource('coronium')
            : projectile.creatureProjectile.kind === 'plasma_grenade'
                ? options.getExplosionDamageSource('plasma_grenade')
                : options.getExplosionDamageSource('grenade');
        const doorCountBeforeExplosion = options.getDoorCount();
        const destructibleDamageResult = options.applyExplosionDamageToDestructibles(
            center,
            radius,
            Math.max(
                6,
                projectile.creatureProjectile.damage * 12 * (settings.splashDamageMultiplier ?? 1)
            ),
            destructionSource
        );
        options.gameAudio.playExplosionDamageSound(
            destructibleDamageResult.destroyedDoor || options.getDoorCount() < doorCountBeforeExplosion,
            options.getBulletImpactAudioSettings().volume
        );
        for (const creature of [...options.getCreatureEntities()]) {
            if (creature.entityId === projectile.creatureProjectile.sourceEntityId) {
                continue;
            }
            const creatureBounds = options.getEntityCollisionBounds(creature);
            const creatureCenter = options.getEntityCenter(creature.x, creature.y, creatureBounds);
            const distance = Math.hypot(creatureCenter.x - center.x, creatureCenter.y - center.y);
            if (distance > radius) {
                continue;
            }
            const damage = Math.max(
                settings.minimumSplashDamage ?? 0.5,
                projectile.creatureProjectile.damage * (settings.splashDamageMultiplier ?? 1) * (1 - distance / radius)
            );
            options.applyDamageToCreature(creature, damage);
        }

        const astronautRect = options.getAstronautRect();
        const astronautCenter = {
            x: (astronautRect.left + astronautRect.right) / 2,
            y: (astronautRect.top + astronautRect.bottom) / 2
        };
        const astronautDistance = Math.hypot(astronautCenter.x - center.x, astronautCenter.y - center.y);
        if (astronautDistance <= radius) {
            options.applyAstronautDamage(
                Math.max(
                    8,
                    projectile.creatureProjectile.damage * 10 * (1 - astronautDistance / radius)
                )
            );
            options.applyAstronautImpact(
                center.x,
                center.y,
                Math.max(0.8, projectile.creatureProjectile.damage * (settings.splashDamageMultiplier ?? 1) * (1 - astronautDistance / radius)),
                true
            );
        }
    }

    function explodeCollectableGrenade(collectable: Collectable) {
        if (!options.isGrenadeCollectable(collectable)) {
            return;
        }
        if (processedGrenadeExplosions.has(collectable)) {
            return;
        }
        processedGrenadeExplosions.add(collectable);

        const center = collectable.stored
            ? options.getAstronautPosition()
            : options.getEntityCenter(collectable.x, collectable.y, options.getEntityCollisionBounds(collectable));
        const grenadeType = collectable.type === 'plasma_grenade' ? 'plasma_grenade' : 'grenade';
        const radius = options.getGrenadeExplosionRadius(grenadeType, collectable.explosionRadius);
        const power = options.getGrenadeExplosionPower(grenadeType, collectable.explosionPower);
        const destructionSource = options.isCoroniumExplosionAtCenter(center)
            ? options.getExplosionDamageSource('coronium')
            : options.getExplosionDamageSource(grenadeType);
        options.spawnGrenadeExplosionEffect(grenadeType, collectable.palette ?? 0, center.x, center.y);
        const doorCountBeforeExplosion = options.getDoorCount();
        const destructibleDamageResult = options.applyExplosionDamageToDestructibles(
            center,
            radius,
            power * 6,
            destructionSource
        );
        options.gameAudio.playExplosionDamageSound(
            destructibleDamageResult.destroyedDoor || options.getDoorCount() < doorCountBeforeExplosion,
            0.9
        );

        for (const creature of [...options.getCreatureEntities()]) {
            const creatureBounds = options.getEntityCollisionBounds(creature);
            const creatureCenter = options.getEntityCenter(creature.x, creature.y, creatureBounds);
            const distance = Math.hypot(creatureCenter.x - center.x, creatureCenter.y - center.y);
            if (distance > radius) {
                continue;
            }
            const damage = Math.max(0.75, power * 1.35 * (1 - distance / radius));
            options.applyDamageToCreature(creature, damage);
        }

        const astronautRect = options.getAstronautRect();
        const astronautCenter = {
            x: (astronautRect.left + astronautRect.right) / 2,
            y: (astronautRect.top + astronautRect.bottom) / 2
        };
        const astronautDistance = Math.hypot(astronautCenter.x - center.x, astronautCenter.y - center.y);
        if (astronautDistance <= radius) {
            const scaledBlast = 1 - astronautDistance / radius;
            options.applyAstronautDamage(Math.max(10, power * 4 * scaledBlast));
            options.applyAstronautImpact(
                center.x,
                center.y,
                Math.max(1, power * scaledBlast),
                true
            );
            if (grenadeType === 'plasma_grenade') {
                options.triggerAstronautEmergencyTeleport();
            }
        }

        removeCollectableFromWorld(collectable);
    }

    function spawnCreatureGrenadeCollectable(
        creature: Creature,
        kind: 'grenade' | 'plasma_grenade',
        spawnPosition: Position,
        velocity: Position,
        rotation: number
    ) {
        const defaultPower = options.getDefaultGrenadeExplosionPower(kind) ?? options.movementSettings.grenadeExplosionPower;
        const grenade = options.assignEntityId(new CollectableEntity({
            x: spawnPosition.x,
            y: spawnPosition.y,
            type: kind,
            palette: creature.palette ?? 0,
            rotation,
            collected: false,
            name: kind,
            weight: Math.max(0.1, creature.projectileWeight ?? 0.2),
            bounciness: Math.max(0, creature.projectileBounciness ?? options.creatureProjectileSettings[kind].defaultBounciness),
            pickupEnabled: kind !== 'plasma_grenade',
            storable: kind !== 'plasma_grenade',
            affectsAstronaut: false,
            collision: true,
            velocity,
            isGrounded: false,
            armed: true,
            explosionPower: options.getGrenadeExplosionPower(
                kind,
                defaultPower * Math.max(0.5, creature.damageOnContact ?? 1)
            )
        }));
        options.syncGrenadeFuseState(grenade);
        options.getCollectableEntities().push(grenade);
    }

    function spawnCreatureProjectile(
        creature: Creature,
        targetX: number,
        targetY: number,
        aimOriginOverride?: Position
    ) {
        const kind = options.getProjectileKindForFireMode(creature.fireMode);
        if (!kind) {
            return;
        }

        const projectileSettings = options.getProjectileSettings(kind);
        const projectilePalette = kind === 'bullet' ? 0 : (creature.palette ?? 0);
        const bounds = options.getEntityCollisionBounds(creature);
        const creatureCenter = options.getEntityCenter(creature.x, creature.y, bounds);
        const creatureRect = options.getEntityRect(creature.x, creature.y, bounds);
        const aimOrigin = aimOriginOverride ?? creatureCenter;
        const speed = Math.max(1, creature.projectileSpeed) * projectileSettings.speedMultiplier;
        const turretFacingRotations = options.getTurretFacingRotations(
            typeof creature.state?.authoredRotation === 'number'
                ? Number(creature.state.authoredRotation)
                : creature.rotation
        );
        let launchDirectionX = targetX - aimOrigin.x;
        let launchDirectionY = targetY - aimOrigin.y;
        let launchDistance = Math.max(1, Math.hypot(launchDirectionX, launchDirectionY));
        let directionX = launchDirectionX / launchDistance;
        let directionY = launchDirectionY / launchDistance;
        let projectileRotation = directionX < 0 ? 5 : 1;
        const muzzleSourceEntity = options.isTurretLikeCreature(creature)
            ? {
                ...creature,
                rotation: directionX < 0 ? turretFacingRotations.left : turretFacingRotations.right
            }
            : creature;
        let muzzleAnchor = options.getEntityFrontAnchorPoint(
            muzzleSourceEntity,
            { x: directionX, y: directionY }
        ) ?? options.getEntitySideAnchorPoint(
            muzzleSourceEntity,
            directionX < 0 ? 'left' : 'right'
        );
        if (muzzleAnchor) {
            launchDirectionX = targetX - muzzleAnchor.x;
            launchDirectionY = targetY - muzzleAnchor.y;
            launchDistance = Math.max(1, Math.hypot(launchDirectionX, launchDirectionY));
            directionX = launchDirectionX / launchDistance;
            directionY = launchDirectionY / launchDistance;
            const refinedProjectileRotation = directionX < 0 ? 5 : 1;
            if (refinedProjectileRotation !== projectileRotation && options.isTurretLikeCreature(creature)) {
                projectileRotation = refinedProjectileRotation;
                muzzleAnchor = options.getEntityFrontAnchorPoint(
                    {
                        ...creature,
                        rotation: directionX < 0 ? turretFacingRotations.left : turretFacingRotations.right
                    },
                    { x: directionX, y: directionY }
                ) ?? options.getEntitySideAnchorPoint(
                    {
                        ...creature,
                        rotation: directionX < 0 ? turretFacingRotations.left : turretFacingRotations.right
                    },
                    directionX < 0 ? 'left' : 'right'
                );
                if (muzzleAnchor) {
                    launchDirectionX = targetX - muzzleAnchor.x;
                    launchDirectionY = targetY - muzzleAnchor.y;
                    launchDistance = Math.max(1, Math.hypot(launchDirectionX, launchDirectionY));
                    directionX = launchDirectionX / launchDistance;
                    directionY = launchDirectionY / launchDistance;
                }
            } else {
                projectileRotation = refinedProjectileRotation;
            }
        }
        const baseVelocity = {
            x: directionX * speed,
            y: directionY * speed + projectileSettings.launchVerticalBias
        };
        const projectileTemplate = {
            type: projectileSettings.spriteType,
            rotation: projectileRotation,
            palette: projectilePalette,
            angleDegrees: projectileSettings.angleMatchesVelocity ? options.getProjectileAngleDegrees(baseVelocity) : undefined,
            creatureProjectile: { kind }
        };
        const projectileBounds = options.getEntityCollisionBounds(projectileTemplate);
        const projectileRearOffset = options.getEntityFrontAnchorPoint(
            {
                ...projectileTemplate,
                x: 0,
                y: 0
            },
            {
                x: -baseVelocity.x,
                y: -baseVelocity.y
            }
        );
        const muzzlePadding = 2 * options.spriteScale;
        const projectileSpawnPosition = muzzleAnchor && projectileRearOffset
            ? {
                x: muzzleAnchor.x + directionX * muzzlePadding - projectileRearOffset.x,
                y: muzzleAnchor.y + directionY * muzzlePadding - projectileRearOffset.y
            }
            : options.getEntityPositionFromCenter(
                creatureCenter.x + directionX * (
                    Math.min(
                        Number.POSITIVE_INFINITY,
                        directionX === 0 ? Number.POSITIVE_INFINITY : (creatureRect.right - creatureRect.left + 1) / 2 / Math.max(0.001, Math.abs(directionX)),
                        directionY === 0 ? Number.POSITIVE_INFINITY : (creatureRect.bottom - creatureRect.top + 1) / 2 / Math.max(0.001, Math.abs(directionY))
                    ) + Math.max(
                        (projectileBounds.right - projectileBounds.left + 1) / 2,
                        (projectileBounds.bottom - projectileBounds.top + 1) / 2
                    ) + 2
                ),
                creatureCenter.y + directionY * (
                    Math.min(
                        Number.POSITIVE_INFINITY,
                        directionX === 0 ? Number.POSITIVE_INFINITY : (creatureRect.right - creatureRect.left + 1) / 2 / Math.max(0.001, Math.abs(directionX)),
                        directionY === 0 ? Number.POSITIVE_INFINITY : (creatureRect.bottom - creatureRect.top + 1) / 2 / Math.max(0.001, Math.abs(directionY))
                    ) + Math.max(
                        (projectileBounds.right - projectileBounds.left + 1) / 2,
                        (projectileBounds.bottom - projectileBounds.top + 1) / 2
                    ) + 2
                ),
                projectileBounds
            );

        if (kind === 'grenade' || kind === 'plasma_grenade') {
            spawnCreatureGrenadeCollectable(
                creature,
                kind,
                projectileSpawnPosition,
                baseVelocity,
                projectileRotation
            );
            return;
        }

        const projectile = options.assignEntityId(new CollectableEntity({
            x: projectileSpawnPosition.x,
            y: projectileSpawnPosition.y,
            type: projectileSettings.spriteType,
            palette: projectilePalette,
            rotation: projectileRotation,
            collected: false,
            name: kind,
            weight: Math.max(0, creature.projectileWeight ?? projectileSettings.defaultWeight),
            pickupEnabled: false,
            storable: false,
            affectsAstronaut: false,
            collision: true,
            velocity: baseVelocity,
            angleDegrees: projectileSettings.angleMatchesVelocity ? options.getProjectileAngleDegrees(baseVelocity) : undefined,
            bounciness: Math.max(0, creature.projectileBounciness ?? projectileSettings.defaultBounciness),
            isGrounded: false,
            creatureProjectile: {
                kind,
                homing: creature.homingBullets && projectileSettings.supportsHoming === true,
                remainingFrames: projectileSettings.lifetimeFrames,
                damage: Math.max(1, creature.damageOnContact || 1) * projectileSettings.damageMultiplier,
                sourceEntityId: creature.entityId
            }
        }));
        options.getCollectableEntities().push(projectile);
    }

    function getProjectileImpactPointAgainstWorld(
        projectile: CreatureProjectileCollectable,
        previousPosition: Position,
        previousVelocity: Position,
        previousAngleDegrees: number | undefined
    ) {
        const direction = Math.hypot(previousVelocity.x, previousVelocity.y) > 0.001
            ? previousVelocity
            : { x: projectile.x - previousPosition.x, y: projectile.y - previousPosition.y };
        const previousFront = options.getEntityFrontAnchorPoint(
            {
                ...projectile,
                x: previousPosition.x,
                y: previousPosition.y,
                angleDegrees: previousAngleDegrees
            },
            direction
        );
        const currentFront = options.getEntityFrontAnchorPoint(
            {
                ...projectile,
                angleDegrees: projectile.angleDegrees
            },
            direction
        );
        if (!previousFront || !currentFront) {
            return null;
        }

        const magnitude = Math.hypot(direction.x, direction.y);
        const normalizedDirection = magnitude > 0.001
            ? { x: direction.x / magnitude, y: direction.y / magnitude }
            : { x: 1, y: 0 };
        const endPoint = {
            x: currentFront.x + normalizedDirection.x * options.spriteScale,
            y: currentFront.y + normalizedDirection.y * options.spriteScale
        };
        const steps = Math.max(2, Math.ceil(Math.hypot(endPoint.x - previousFront.x, endPoint.y - previousFront.y)));
        for (let index = 0; index <= steps; index++) {
            const progress = index / steps;
            const sampleX = previousFront.x + (endPoint.x - previousFront.x) * progress;
            const sampleY = previousFront.y + (endPoint.y - previousFront.y) * progress;
            if (options.isSolidAtWorld(sampleX, sampleY)) {
                return { x: sampleX, y: sampleY };
            }
        }

        return currentFront;
    }

    function getProjectileImpactPointAgainstOpaquePixels(
        projectile: CreatureProjectileCollectable,
        previousPosition: Position,
        previousVelocity: Position,
        previousAngleDegrees: number | undefined,
        hitTest: (worldX: number, worldY: number) => boolean
    ) {
        const direction = Math.hypot(previousVelocity.x, previousVelocity.y) > 0.001
            ? previousVelocity
            : { x: projectile.x - previousPosition.x, y: projectile.y - previousPosition.y };
        const previousFront = options.getEntityFrontAnchorPoint(
            {
                ...projectile,
                x: previousPosition.x,
                y: previousPosition.y,
                angleDegrees: previousAngleDegrees
            },
            direction
        );
        const currentFront = options.getEntityFrontAnchorPoint(
            {
                ...projectile,
                angleDegrees: projectile.angleDegrees
            },
            direction
        );
        if (!previousFront || !currentFront) {
            return null;
        }

        const steps = Math.max(2, Math.ceil(Math.hypot(currentFront.x - previousFront.x, currentFront.y - previousFront.y)));
        for (let index = 0; index <= steps; index++) {
            const progress = index / steps;
            const sampleX = previousFront.x + (currentFront.x - previousFront.x) * progress;
            const sampleY = previousFront.y + (currentFront.y - previousFront.y) * progress;
            if (hitTest(sampleX, sampleY)) {
                return { x: sampleX, y: sampleY };
            }
        }

        return null;
    }

    function updateSingleCreatureProjectilePhysics(projectile: CreatureProjectileCollectable) {
        const surfaceResult = options.updateSingleCollectablePhysics(
            projectile,
            options.getCreatureProjectilePhysicsSettings(projectile),
            {
                bounceHorizontally: true,
                groundFrictionStopThreshold: 0.01
            }
        );
        if (options.getProjectileSettings(projectile.creatureProjectile.kind).angleMatchesVelocity) {
            projectile.angleDegrees = options.getProjectileAngleDegrees(projectile.velocity);
        }
        return surfaceResult;
    }

    function projectileOverlapsAstronaut(projectile: CreatureProjectileCollectable) {
        const bounds = options.getEntityCollisionBounds(projectile);
        const projectileRect = options.getEntityRect(projectile.x, projectile.y, bounds);
        const astronautRect = options.getAstronautRect();
        return (
            projectileRect.right >= astronautRect.left &&
            projectileRect.left <= astronautRect.right &&
            projectileRect.bottom >= astronautRect.top &&
            projectileRect.top <= astronautRect.bottom
        );
    }

    function updateProjectileHomingVelocity(projectile: CreatureProjectileCollectable) {
        const bounds = options.getEntityCollisionBounds(projectile);
        const projectileCenter = options.getEntityCenter(projectile.x, projectile.y, bounds);
        const astronautRect = options.getAstronautRect();
        const astronautCenter = {
            x: (astronautRect.left + astronautRect.right) / 2,
            y: (astronautRect.top + astronautRect.bottom) / 2
        };
        const dx = astronautCenter.x - projectileCenter.x;
        const dy = astronautCenter.y - projectileCenter.y;
        const distance = Math.max(1, Math.hypot(dx, dy));
        const speed = Math.max(1, Math.hypot(projectile.velocity.x, projectile.velocity.y));
        const targetVx = (dx / distance) * speed;
        const targetVy = (dy / distance) * speed;
        projectile.velocity.x += (targetVx - projectile.velocity.x) * 0.08;
        projectile.velocity.y += (targetVy - projectile.velocity.y) * 0.08;
    }

    function updateCreatureProjectileCollectable(projectile: CreatureProjectileCollectable) {
        let expired = false;
        const projectileRuntime = projectile.creatureProjectile;
        if (projectileRuntime.impacted === true) {
            markProjectileExpired(projectile);
            return;
        }
        const previousPosition = {
            x: projectile.x,
            y: projectile.y
        };
        const previousVelocity = {
            x: projectile.velocity.x,
            y: projectile.velocity.y
        };
        const previousAngleDegrees = projectile.angleDegrees;

        if (projectileRuntime.homing) {
            updateProjectileHomingVelocity(projectile);
        }

        const projectileSettings = options.getProjectileSettings(projectileRuntime.kind);
        options.updateProjectileFlightFrame(projectile, projectileSettings);
        const usePreciseHitTest = projectileRuntime.kind === 'bullet' || projectileSettings.angleMatchesVelocity === true;

        const surfaceResult = updateSingleCreatureProjectilePhysics(projectile);
        if (surfaceResult.hitWorld && projectile.bounciness <= 0) {
            const impactPoint = getProjectileImpactPointAgainstWorld(
                projectile,
                previousPosition,
                previousVelocity,
                previousAngleDegrees
            );
            if (projectileSettings.splashRadius) {
                explodeProjectile(projectile);
            } else if (projectileSettings.spawnsCollectableOnImpact) {
                options.convertProjectileToEnergyPodCollectable(projectile);
            } else {
                options.spawnProjectileImpactEffect(projectile, projectile.x, projectile.y, impactPoint ?? undefined);
                options.removeCollectableEntity(projectile);
            }
            expired = true;
        }
        if (expired) {
            markProjectileExpired(projectile);
            return;
        }

        for (const creature of [...options.getCreatureEntities()]) {
            if (creature.entityId === projectileRuntime.sourceEntityId) {
                continue;
            }
            const creatureRendered = options.getRenderedEntityWorldSprite(creature);
            const creatureImpactPoint = usePreciseHitTest
                ? getProjectileImpactPointAgainstOpaquePixels(
                    projectile,
                    previousPosition,
                    previousVelocity,
                    previousAngleDegrees,
                    (worldX, worldY) => options.isRenderedSpriteOpaqueAtWorld(creatureRendered, worldX, worldY)
                )
                : null;
            if (usePreciseHitTest ? !creatureImpactPoint : !projectileOverlapsCreature(projectile, creature)) {
                continue;
            }
            const wasRemoved = options.applyDamageToCreature(
                creature,
                projectileRuntime.damage * projectileSettings.directHitDamageMultiplier
            );
            if (projectileSettings.spawnsCollectableOnImpact) {
                options.convertProjectileToEnergyPodCollectable(projectile);
            }
            if (projectileSettings.splashRadius) {
                explodeProjectile(projectile);
            } else if (!projectileSettings.spawnsCollectableOnImpact) {
                options.spawnProjectileImpactEffect(projectile, projectile.x, projectile.y, creatureImpactPoint ?? undefined);
                options.removeCollectableEntity(projectile);
            }
            expired = true;
            if (wasRemoved) {
                options.gameAudio.playManifestSound('get', 0.55);
            }
            break;
        }
        if (expired) {
            markProjectileExpired(projectile);
            return;
        }

        const astronautRendered = options.getAstronautRenderedWorldSprite();
        const astronautImpactPoint = usePreciseHitTest
            ? getProjectileImpactPointAgainstOpaquePixels(
                projectile,
                previousPosition,
                previousVelocity,
                previousAngleDegrees,
                (worldX, worldY) => options.isRenderedSpriteOpaqueAtWorld(astronautRendered, worldX, worldY)
            )
            : null;
        if (usePreciseHitTest ? !!astronautImpactPoint : projectileOverlapsAstronaut(projectile)) {
            options.applyAstronautProjectileImpact(projectile);
            if (projectileSettings.splashRadius) {
                explodeProjectile(projectile);
            } else {
                options.spawnProjectileImpactEffect(projectile, projectile.x, projectile.y, astronautImpactPoint ?? undefined);
                options.removeCollectableEntity(projectile);
            }
            expired = true;
        }

        projectileRuntime.remainingFrames--;
        if (projectileRuntime.remainingFrames <= 0) {
            if (projectileSettings.splashRadius) {
                explodeProjectile(projectile);
            } else if (projectileSettings.spawnsCollectableOnExpire) {
                options.convertProjectileToEnergyPodCollectable(projectile);
            } else {
                options.removeCollectableEntity(projectile);
            }
            expired = true;
        }
        if (expired) {
            markProjectileExpired(projectile);
        }
    }

    return {
        spawnCreatureProjectile,
        updateCreatureProjectileCollectable,
        explodeCollectableGrenade
    };
}
