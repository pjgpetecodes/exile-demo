export interface Position {
    x: number;
    y: number;
}

export type WindEmitterMode = 'constant' | 'variable';

export interface WindEmitterSaveData {
    id: string;
    x: number;
    y: number;
    enabled?: boolean;
    directionDegrees?: number;
    strength?: number;
    radius?: number;
    mode?: WindEmitterMode;
    variabilityHz?: number;
    variabilityAmount?: number;
    affectsAstronaut?: boolean;
    showParticles?: boolean;
}

export interface WindGlobalSettings {
    windEnabled?: boolean;
    emittersEnabled?: boolean;
    surfaceWindEnabled?: boolean;
    windVfxEnabled?: boolean;
    surfaceWindMaxY?: number;
    surfaceWindCenterX?: number;
    surfaceWindDeadzone?: number;
    surfaceWindStrength?: number;
}

export type TeleporterDestinationMode =
    | 'toggle'
    | 'destination_a'
    | 'destination_b'
    | 'toggle_enabled'
    | 'enable'
    | 'disable';

export interface PaletteCycleSettings {
    palettes: number[];
    intervalMs: number;
    offsetMs?: number;
}

export type CreatureMovementMode = 'ground' | 'fly' | 'hover' | 'turret';
export type CreatureFireMode = 'none' | 'bullets' | 'grenades' | 'plasma_grenades' | 'energy_pods';
export type CreatureProjectileKind = 'bullet' | 'grenade' | 'plasma_grenade' | 'energy_pod';
export type CreatureArchetype = 'custom' | 'monkey' | 'bird' | 'bee' | 'turret';

export interface ProjectileImpactAnimationSettings {
    frames: string[];
    frameDurationFrames: number;
    paletteSource?: 'projectile' | 'default';
}

export interface CreatureProjectileSettings {
    spriteType: string;
    lifetimeFrames: number;
    gravityScale: number;
    speedMultiplier: number;
    launchVerticalBias: number;
    defaultWeight: number;
    defaultBounciness: number;
    damageMultiplier: number;
    directHitDamageMultiplier: number;
    angleMatchesVelocity?: boolean;
    supportsHoming?: boolean;
    flightAnimation?: ProjectileImpactAnimationSettings;
    impactAnimation?: ProjectileImpactAnimationSettings;
    splashRadius?: number;
    splashDamageMultiplier?: number;
    minimumSplashDamage?: number;
    spawnsCollectableOnImpact?: boolean;
    spawnsCollectableOnExpire?: boolean;
}

export interface CreatureProjectileRuntimeData {
    kind: CreatureProjectileKind;
    homing: boolean;
    remainingFrames: number;
    damage: number;
    sourceEntityId?: number;
}

export interface CreatureSoundSettings {
    enabled?: boolean;
    sound?: string;
    intervalMs?: number;
    randomVarianceMs?: number;
    range?: number;
    volume?: number;
}

export interface CreatureSaveData {
    x: number;
    y: number;
    type: string;
    palette?: number;
    rotation?: number;
    translation?: string;
    archetype?: CreatureArchetype;
    collision?: boolean;
    hostile?: boolean;
    damageOnContact?: number;
    followsAstronaut?: boolean;
    followRange?: number;
    movementMode?: CreatureMovementMode;
    fixed?: boolean;
    homeX?: number;
    homeY?: number;
    patrolMinX?: number;
    patrolMaxX?: number;
    patrolMinY?: number;
    patrolMaxY?: number;
    hoverAmplitude?: number;
    trackRange?: number;
    fireMode?: CreatureFireMode;
    homingBullets?: boolean;
    fireCooldownMs?: number;
    fireCooldownVarianceMs?: number;
    targetRefreshMs?: number;
    aimLeadFactor?: number;
    aimJitterPx?: number;
    requiresLineOfSight?: boolean;
    projectileSpeed?: number;
    projectileWeight?: number;
    projectileBounciness?: number;
    canEatWasps?: boolean;
    canJump?: boolean;
    jumpStrength?: number;
    currentDamage?: number;
    killForce?: number;
    speed?: number;
    teleportHome?: boolean;
    teleportHomeDistance?: number;
    visibleEnergy?: number;
    damageFlash?: boolean;
    pickupEnabled?: boolean;
    storable?: boolean;
    pushAstronaut?: boolean;
    sound?: CreatureSoundSettings;
    state?: Record<string, unknown>;
    paletteCycle?: PaletteCycleSettings;
}

export interface Astronaut {
    position: Position;
    isFlying: boolean;
    isLanded: boolean;
    velocity: Position;
    energy: number;
    maxEnergy: number;
    controlDazeUntilMs?: number;
    nextEnergyRegenAtMs?: number;
}

export interface GameState {
    astronaut: Astronaut;
    gravity: number;
    trail: Position[];
    isRunning?: boolean;
}

export interface TeleporterSaveData {
    id: string;
    baseX: number;
    baseY: number;
    padX: number;
    padY: number;
    enabled?: boolean;
    requiresKey?: boolean;
    destinationA: Position;
    destinationB?: Position | null;
    activeDestinationIndex?: 0 | 1;
}

export type ChunkActivityBand = 'near' | 'mid' | 'far';

export interface ChunkCoordinates {
    x: number;
    y: number;
}

export interface ChunkActivityRadii {
    near: number;
    mid: number;
}
