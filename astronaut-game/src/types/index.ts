export interface Position {
    x: number;
    y: number;
}

export interface PaletteCycleSettings {
    palettes: number[];
    intervalMs: number;
    offsetMs?: number;
}

export type CreatureMovementMode = 'ground' | 'fly' | 'hover' | 'turret';
export type CreatureFireMode = 'none' | 'bullets' | 'grenades' | 'energy_pods';
export type CreatureArchetype = 'custom' | 'monkey' | 'bird' | 'bee' | 'turret';

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
    projectileSpeed?: number;
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
}

export interface GameState {
    astronaut: Astronaut;
    gravity: number;
    trail: Position[];
    isRunning?: boolean;
}
