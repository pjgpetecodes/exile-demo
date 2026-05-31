import { MOVEMENT_SETTINGS } from '../../config/settings.js';
import { Collectable } from '../../entities/collectable.js';
import { type CreatureProjectileCollectable } from '../collectables/game-collectable-runtime.js';

export function convertProjectileToEnergyPodCollectable(projectile: CreatureProjectileCollectable) {
    projectile.type = 'energy_pod2';
    projectile.name = 'energy_pod';
    projectile.weight = 0.1;
    projectile.pickupEnabled = true;
    projectile.storable = false;
    projectile.affectsAstronaut = false;
    projectile.collision = false;
    projectile.velocity = { x: 0, y: 0 };
    projectile.isGrounded = false;
    projectile.ttlFrames = MOVEMENT_SETTINGS.creatureEnergyPodLifetimeFrames;
    projectile.ambientSoundKey = 'get';
    projectile.ambientSoundIntervalMs = 900;
    projectile.nextAmbientSoundAt = undefined;
    projectile.angleDegrees = undefined;
    projectile.bounciness = 0;
    delete (projectile as Collectable).creatureProjectile;
}
