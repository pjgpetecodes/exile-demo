import { describe, expect, it, vi } from 'vitest';
import { createCreatureProjectileRuntime } from '../../../src/game/projectiles/game-creature-projectile-runtime';

describe('creature projectile runtime', () => {
    it('does not re-trigger impact effects for an already impacted projectile', () => {
        const spawnProjectileImpactEffect = vi.fn();
        const removeCollectableEntity = vi.fn();
        const projectile = {
            x: 100,
            y: 100,
            velocity: { x: 1, y: 0 },
            bounciness: 0,
            angleDegrees: 0,
            creatureProjectile: {
                kind: 'bullet' as const,
                homing: false,
                remainingFrames: 10,
                damage: 1
            }
        };

        const runtime = createCreatureProjectileRuntime({
            spriteScale: 2,
            movementSettings: { grenadeExplosionPower: 4 },
            creatureProjectileSettings: {
                grenade: { defaultBounciness: 0.42 },
                plasma_grenade: { defaultBounciness: 0.42 }
            },
            getCollectableEntities: () => [projectile as any],
            getCreatureEntities: () => [],
            getAstronautRect: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
            getAstronautPosition: () => ({ x: 0, y: 0 }),
            getProjectileKindForFireMode: () => null,
            getProjectileSettings: () => ({
                spriteType: 'bullet1',
                lifetimeFrames: 60,
                gravityScale: 0.2,
                speedMultiplier: 1,
                launchVerticalBias: 0,
                defaultWeight: 0.08,
                defaultBounciness: 0,
                damageMultiplier: 1,
                directHitDamageMultiplier: 1
            }),
            updateProjectileFlightFrame: () => {},
            getTurretFacingRotations: () => ({ left: 1, right: 1 }),
            isTurretLikeCreature: () => false,
            getEntityCollisionBounds: () => ({ left: 0, right: 1, top: 0, bottom: 1 }),
            getEntityCenter: (x, y) => ({ x, y }),
            getEntityRect: (x, y, bounds) => ({
                left: x + bounds.left,
                right: x + bounds.right,
                top: y + bounds.top,
                bottom: y + bounds.bottom
            }),
            getEntityFrontAnchorPoint: () => null,
            getEntitySideAnchorPoint: () => null,
            getEntityPositionFromCenter: (centerX, centerY) => ({ x: centerX, y: centerY }),
            getProjectileAngleDegrees: () => 0,
            assignEntityId: <T>(entity: T) => entity,
            syncGrenadeFuseState: () => {},
            getDefaultGrenadeExplosionPower: () => 4,
            getGrenadeExplosionRadius: () => 96,
            getGrenadeExplosionPower: () => 4,
            getExplosionDamageSource: () => 'grenade_explosion',
            isGrenadeCollectable: () => false,
            removeCollectableEntity,
            updateSingleCollectablePhysics: () => ({ hitWorld: true }),
            getCreatureProjectilePhysicsSettings: () => ({}),
            isSolidAtWorld: () => true,
            getRenderedEntityWorldSprite: () => null,
            getAstronautRenderedWorldSprite: () => null,
            isRenderedSpriteOpaqueAtWorld: () => false,
            spawnProjectileImpactEffect,
            applyDamageToCreature: () => false,
            applyAstronautProjectileImpact: () => {},
            applyAstronautDamage: () => {},
            applyAstronautImpact: () => {},
            isCoroniumExplosionAtCenter: () => false,
            applyExplosionDamageToDestructibles: () => ({ destroyedDoor: false }),
            getDoorCount: () => 0,
            gameAudio: {
                playExplosionDamageSound: () => {},
                playManifestSound: () => {}
            },
            getBulletImpactAudioSettings: () => ({ volume: 0.8 }),
            convertProjectileToEnergyPodCollectable: () => {},
            triggerAstronautEmergencyTeleport: () => {},
            isCreatureProjectileCollectable: (collectable: any) => !!collectable.creatureProjectile,
            spawnGrenadeExplosionEffect: () => {}
        });

        runtime.updateCreatureProjectileCollectable(projectile as any);
        runtime.updateCreatureProjectileCollectable(projectile as any);

        expect(spawnProjectileImpactEffect).toHaveBeenCalledTimes(1);
    });

    it('processes grenade collectable explosion only once', () => {
        const removeCollectableEntity = vi.fn();
        const spawnGrenadeExplosionEffect = vi.fn();
        const grenade = {
            x: 120,
            y: 90,
            type: 'grenade',
            stored: false,
            palette: 0,
            explosionRadius: 96,
            explosionPower: 4,
            armed: true
        };

        const runtime = createCreatureProjectileRuntime({
            spriteScale: 2,
            movementSettings: { grenadeExplosionPower: 4 },
            creatureProjectileSettings: {
                grenade: { defaultBounciness: 0.42 },
                plasma_grenade: { defaultBounciness: 0.42 }
            },
            getCollectableEntities: () => [grenade as any],
            getCreatureEntities: () => [],
            getAstronautRect: () => ({ left: 0, right: 0, top: 0, bottom: 0 }),
            getAstronautPosition: () => ({ x: 0, y: 0 }),
            getProjectileKindForFireMode: () => null,
            getProjectileSettings: () => ({
                spriteType: 'bullet1',
                lifetimeFrames: 60,
                gravityScale: 0.2,
                speedMultiplier: 1,
                launchVerticalBias: 0,
                defaultWeight: 0.08,
                defaultBounciness: 0,
                damageMultiplier: 1,
                directHitDamageMultiplier: 1
            }),
            updateProjectileFlightFrame: () => {},
            getTurretFacingRotations: () => ({ left: 1, right: 1 }),
            isTurretLikeCreature: () => false,
            getEntityCollisionBounds: () => ({ left: 0, right: 1, top: 0, bottom: 1 }),
            getEntityCenter: (x, y) => ({ x, y }),
            getEntityRect: (x, y, bounds) => ({
                left: x + bounds.left,
                right: x + bounds.right,
                top: y + bounds.top,
                bottom: y + bounds.bottom
            }),
            getEntityFrontAnchorPoint: () => null,
            getEntitySideAnchorPoint: () => null,
            getEntityPositionFromCenter: (centerX, centerY) => ({ x: centerX, y: centerY }),
            getProjectileAngleDegrees: () => 0,
            assignEntityId: <T>(entity: T) => entity,
            syncGrenadeFuseState: () => {},
            getDefaultGrenadeExplosionPower: () => 4,
            getGrenadeExplosionRadius: () => 96,
            getGrenadeExplosionPower: () => 4,
            getExplosionDamageSource: () => 'grenade_explosion',
            isGrenadeCollectable: () => true,
            removeCollectableEntity,
            updateSingleCollectablePhysics: () => ({ hitWorld: true }),
            getCreatureProjectilePhysicsSettings: () => ({}),
            isSolidAtWorld: () => true,
            getRenderedEntityWorldSprite: () => null,
            getAstronautRenderedWorldSprite: () => null,
            isRenderedSpriteOpaqueAtWorld: () => false,
            spawnProjectileImpactEffect: () => {},
            applyDamageToCreature: () => false,
            applyAstronautProjectileImpact: () => {},
            applyAstronautDamage: () => {},
            applyAstronautImpact: () => {},
            isCoroniumExplosionAtCenter: () => false,
            applyExplosionDamageToDestructibles: () => ({ destroyedDoor: false }),
            getDoorCount: () => 0,
            gameAudio: {
                playExplosionDamageSound: () => {},
                playManifestSound: () => {}
            },
            getBulletImpactAudioSettings: () => ({ volume: 0.8 }),
            convertProjectileToEnergyPodCollectable: () => {},
            triggerAstronautEmergencyTeleport: () => {},
            isCreatureProjectileCollectable: (collectable: any) => !!collectable.creatureProjectile,
            spawnGrenadeExplosionEffect
        });

        runtime.explodeCollectableGrenade(grenade as any);
        runtime.explodeCollectableGrenade(grenade as any);

        expect(spawnGrenadeExplosionEffect).toHaveBeenCalledTimes(1);
        expect(removeCollectableEntity).toHaveBeenCalledTimes(1);
    });
});
