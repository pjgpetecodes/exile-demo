import { DestructionSourceRequirement } from '../../entities/destructibles.js';

export type ThrowGuideDot = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    hue: number;
    hueDrift: number;
    flickerOffset: number;
};

export type ProjectileImpactEffect = {
    x: number;
    y: number;
    centerX: number;
    centerY: number;
    type: string;
    palette: number;
    rotation: number;
    frameIndex: number;
    frameTimer: number;
    frames: string[];
    frameDurationFrames: number;
};

export type DoorDestructionEffect = {
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

export type BulletImpactParticle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    color: string;
    size: number;
    life: number;
    maxLife: number;
};

export type WindParticle = {
    x: number;
    y: number;
    vx: number;
    vy: number;
    life: number;
    maxLife: number;
    size: number;
    hue: number;
    color?: string;
};

export type DestructibleRuntimeEntity = {
    x: number;
    y: number;
    type: string;
    palette?: string | number;
    destructible?: boolean;
    destructionHealth?: number;
    destructionSource?: DestructionSourceRequirement;
};
