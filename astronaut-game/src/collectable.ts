import { MOVEMENT_SETTINGS } from './settings.js';
import {
    CreatureProjectileRuntimeData,
    CreatureSaveData,
    PaletteCycleSettings,
    Position
} from './types/index.js';

export function isGrenadeCollectableType(type: string): type is 'grenade' | 'plasma_grenade' {
    return type === 'grenade' || type === 'plasma_grenade';
}

export function getDefaultGrenadeExplosionPower(type: string) {
    if (type === 'plasma_grenade') {
        return MOVEMENT_SETTINGS.plasmaGrenadeExplosionPower;
    }
    if (type === 'grenade') {
        return MOVEMENT_SETTINGS.grenadeExplosionPower;
    }
    return undefined;
}

function getCurrentTimeMs() {
    return typeof performance !== 'undefined' ? performance.now() : Date.now();
}

export class Collectable {
    x: number;
    y: number;
    type: string;
    palette: number;
    defaultRotation: number;
    rotation: number;
    collected: boolean;
    name: string;
    weight: number;
    pickupEnabled: boolean;
    storable: boolean;
    affectsAstronaut: boolean;
    collision: boolean;
    held: boolean;
    stored: boolean;
    isGrounded: boolean;
    velocity: Position;
    angleDegrees?: number;
    bounciness: number;
    astronautCollisionIgnoreFrames: number;
    entityId?: number;
    paletteCycle?: PaletteCycleSettings;
    ttlFrames?: number;
    ambientSoundKey?: string;
    ambientSoundIntervalMs?: number;
    nextAmbientSoundAt?: number;
    creaturePayload?: CreatureSaveData;
    creatureProjectile?: CreatureProjectileRuntimeData;
    armed: boolean;
    armedAtMs?: number;
    explosionPower?: number;

    constructor(data: any) {
        this.x = data.x;
        this.y = data.y;
        this.type = data.type;
        this.palette = data.palette ?? 0;
        this.defaultRotation = data.rotation ?? 1;
        this.rotation = this.defaultRotation;
        this.collected = data.collected ?? false;
        this.name = data.name ?? "";
        this.weight = data.weight ?? 0;
        this.pickupEnabled = data.pickupEnabled ?? true;
        this.storable = data.storable ?? false;
        this.affectsAstronaut = data.affectsAstronaut ?? true;
        this.collision = data.collision ?? true;
        this.held = data.held ?? false;
        this.stored = data.stored ?? false;
        this.isGrounded = data.isGrounded ?? false;
        this.velocity = data.velocity ?? { x: 0, y: 0 };
        this.angleDegrees = typeof data.angleDegrees === 'number' ? data.angleDegrees : undefined;
        this.bounciness = typeof data.bounciness === 'number' ? Math.max(0, data.bounciness) : 0;
        this.astronautCollisionIgnoreFrames = data.astronautCollisionIgnoreFrames ?? 0;
        this.paletteCycle = data.paletteCycle;
        this.ttlFrames = typeof data.ttlFrames === 'number' ? data.ttlFrames : undefined;
        this.ambientSoundKey = typeof data.ambientSoundKey === 'string' ? data.ambientSoundKey : undefined;
        this.ambientSoundIntervalMs = typeof data.ambientSoundIntervalMs === 'number' ? data.ambientSoundIntervalMs : undefined;
        this.nextAmbientSoundAt = typeof data.nextAmbientSoundAt === 'number' ? data.nextAmbientSoundAt : undefined;
        this.creaturePayload = data.creaturePayload;
        this.creatureProjectile = data.creatureProjectile;
        this.armed = data.armed === true;
        this.armedAtMs = typeof data.armedAtMs === 'number'
            ? data.armedAtMs
            : (this.armed ? getCurrentTimeMs() : undefined);
        this.explosionPower = typeof data.explosionPower === 'number'
            ? data.explosionPower
            : getDefaultGrenadeExplosionPower(this.type);
    }

    collect() {
        this.collected = true;
    }

    setHeldFacing(facingLeft: boolean) {
        this.rotation = facingLeft ? 5 : 1;
    }

    hold(facingLeft: boolean) {
        this.held = true;
        this.stored = false;
        this.velocity = { x: 0, y: 0 };
        this.astronautCollisionIgnoreFrames = 0;
        this.setHeldFacing(facingLeft);
    }

    store() {
        this.held = false;
        this.stored = true;
        this.velocity = { x: 0, y: 0 };
        this.astronautCollisionIgnoreFrames = 0;
    }

    release(x: number, y: number, velocity: Position = { x: 0, y: 0 }, astronautCollisionIgnoreFrames: number = 0) {
        this.held = false;
        this.stored = false;
        this.x = x;
        this.y = y;
        this.velocity = velocity;
        this.isGrounded = false;
        this.astronautCollisionIgnoreFrames = astronautCollisionIgnoreFrames;
    }

    arm(now: number = getCurrentTimeMs()) {
        this.armed = true;
        this.armedAtMs = now;
    }

    disarm() {
        this.armed = false;
        this.armedAtMs = undefined;
    }

    toggleArmed(now: number = getCurrentTimeMs()) {
        if (this.armed) {
            this.disarm();
            return;
        }
        this.arm(now);
    }
}
