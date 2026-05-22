import {
    CreatureArchetype,
    CreatureFireMode,
    CreatureMovementMode,
    CreatureSaveData,
    CreatureSoundSettings,
    PaletteCycleSettings
} from './types/index.js';
import { normalizeSpriteTranslation, SpriteTranslation } from './utilities.js';

export const DEFAULT_CREATURE_SOUND_SETTINGS: Required<CreatureSoundSettings> = {
    enabled: false,
    sound: '',
    intervalMs: 3000,
    randomVarianceMs: 0,
    range: 320,
    volume: 1
};

export const DEFAULT_CREATURE_MOVEMENT_MODE: CreatureMovementMode = 'ground';
export const DEFAULT_CREATURE_FIRE_MODE: CreatureFireMode = 'none';

export function inferCreatureArchetype(type: string): CreatureArchetype {
    if (/^monkey/i.test(type)) {
        return 'monkey';
    }
    if (/^bird/i.test(type)) {
        return 'bird';
    }
    if (/^(bee|wasp)/i.test(type)) {
        return 'bee';
    }
    if (/^turret/i.test(type)) {
        return 'turret';
    }
    return 'custom';
}

function clonePaletteCycle(paletteCycle?: PaletteCycleSettings): PaletteCycleSettings | undefined {
    if (!paletteCycle) {
        return undefined;
    }
    return {
        palettes: [...paletteCycle.palettes],
        intervalMs: paletteCycle.intervalMs,
        ...(typeof paletteCycle.offsetMs === 'number' ? { offsetMs: paletteCycle.offsetMs } : {})
    };
}

function cloneSoundSettings(sound?: CreatureSoundSettings): Required<CreatureSoundSettings> {
    return {
        enabled: sound?.enabled === true,
        sound: typeof sound?.sound === 'string' ? sound.sound : '',
        intervalMs: Number.isFinite(sound?.intervalMs) ? Math.max(0, Number(sound!.intervalMs)) : DEFAULT_CREATURE_SOUND_SETTINGS.intervalMs,
        randomVarianceMs: Number.isFinite(sound?.randomVarianceMs) ? Math.max(0, Number(sound!.randomVarianceMs)) : DEFAULT_CREATURE_SOUND_SETTINGS.randomVarianceMs,
        range: Number.isFinite(sound?.range) ? Math.max(0, Number(sound!.range)) : DEFAULT_CREATURE_SOUND_SETTINGS.range,
        volume: Number.isFinite(sound?.volume) ? Math.max(0, Number(sound!.volume)) : DEFAULT_CREATURE_SOUND_SETTINGS.volume
    };
}

function normalizeNumber(value: unknown, fallback: number, minimum?: number) {
    const normalized = Number(value);
    if (!Number.isFinite(normalized)) {
        return fallback;
    }
    if (typeof minimum === 'number') {
        return Math.max(minimum, normalized);
    }
    return normalized;
}

function normalizeMovementMode(value: unknown): CreatureMovementMode {
    return value === 'fly' || value === 'hover' || value === 'turret' ? value : DEFAULT_CREATURE_MOVEMENT_MODE;
}

function normalizeFireMode(value: unknown): CreatureFireMode {
    return value === 'bullets' || value === 'grenades' || value === 'energy_pods' ? value : DEFAULT_CREATURE_FIRE_MODE;
}

export function createCreatureSaveData(data: Partial<CreatureSaveData> & Pick<CreatureSaveData, 'x' | 'y' | 'type'>): CreatureSaveData {
    const archetype = data.archetype ?? inferCreatureArchetype(data.type);
    const defaultMovementMode = archetype === 'bird'
        ? 'fly'
        : archetype === 'bee'
            ? 'hover'
            : archetype === 'turret'
                ? 'turret'
                : DEFAULT_CREATURE_MOVEMENT_MODE;
    const movementMode = normalizeMovementMode(data.movementMode ?? defaultMovementMode);
    const defaultCollision = archetype === 'monkey' || archetype === 'turret';
    const defaultTrackRange = archetype === 'turret' ? 224 : archetype === 'bee' ? 96 : 160;
    const defaultPatrolHorizontal = archetype === 'bird' ? 128 : 96;
    const defaultPatrolVertical = archetype === 'bird' ? 48 : 32;
    const sound = cloneSoundSettings(data.sound);
    return {
        x: normalizeNumber(data.x, 0),
        y: normalizeNumber(data.y, 0),
        type: data.type,
        palette: normalizeNumber(data.palette, 0),
        rotation: normalizeNumber(data.rotation, 1),
        translation: normalizeSpriteTranslation(data.translation),
        archetype,
        collision: data.collision ?? defaultCollision,
        hostile: data.hostile === true,
        damageOnContact: normalizeNumber(data.damageOnContact, 0, 0),
        followsAstronaut: data.followsAstronaut === true,
        followRange: normalizeNumber(data.followRange, defaultTrackRange, 0),
        movementMode,
        fixed: data.fixed === true || movementMode === 'turret',
        homeX: normalizeNumber(data.homeX, data.x),
        homeY: normalizeNumber(data.homeY, data.y),
        patrolMinX: normalizeNumber(data.patrolMinX, data.x - defaultPatrolHorizontal),
        patrolMaxX: normalizeNumber(data.patrolMaxX, data.x + defaultPatrolHorizontal),
        patrolMinY: normalizeNumber(data.patrolMinY, data.y - defaultPatrolVertical),
        patrolMaxY: normalizeNumber(data.patrolMaxY, data.y + defaultPatrolVertical),
        hoverAmplitude: normalizeNumber(data.hoverAmplitude, archetype === 'bee' ? 8 : 0, 0),
        trackRange: normalizeNumber(data.trackRange, defaultTrackRange, 0),
        fireMode: normalizeFireMode(data.fireMode),
        homingBullets: data.homingBullets === true,
        fireCooldownMs: normalizeNumber(data.fireCooldownMs, 1200, 0),
        projectileSpeed: normalizeNumber(data.projectileSpeed, 3, 0),
        canEatWasps: data.canEatWasps === true,
        canJump: data.canJump === true,
        jumpStrength: normalizeNumber(data.jumpStrength, 6, 0),
        currentDamage: normalizeNumber(data.currentDamage, 0, 0),
        killForce: normalizeNumber(data.killForce, 3, 0),
        speed: normalizeNumber(data.speed, movementMode === 'turret' ? 0 : 1.5, 0),
        teleportHome: data.teleportHome === true,
        teleportHomeDistance: normalizeNumber(data.teleportHomeDistance, 512, 0),
        visibleEnergy: normalizeNumber(data.visibleEnergy, 1, 0),
        damageFlash: data.damageFlash !== false,
        pickupEnabled: data.pickupEnabled === true,
        storable: data.storable === true,
        pushAstronaut: data.pushAstronaut !== false,
        sound,
        state: data.state ? { ...data.state } : {},
        ...(data.paletteCycle ? { paletteCycle: clonePaletteCycle(data.paletteCycle) } : {})
    };
}

export function toCreatureSaveData(creature: Partial<CreatureSaveData> & Pick<CreatureSaveData, 'x' | 'y' | 'type'>): CreatureSaveData {
    return createCreatureSaveData(creature);
}

export class Creature {
    x: number;
    y: number;
    flipAroundVisibleCenter = true;
    type: string;
    palette: number;
    rotation: number;
    translation: SpriteTranslation;
    archetype: CreatureArchetype;
    collision: boolean;
    hostile: boolean;
    damageOnContact: number;
    followsAstronaut: boolean;
    followRange: number;
    movementMode: CreatureMovementMode;
    fixed: boolean;
    homeX: number;
    homeY: number;
    patrolMinX: number;
    patrolMaxX: number;
    patrolMinY: number;
    patrolMaxY: number;
    hoverAmplitude: number;
    trackRange: number;
    fireMode: CreatureFireMode;
    homingBullets: boolean;
    fireCooldownMs: number;
    projectileSpeed: number;
    canEatWasps: boolean;
    canJump: boolean;
    jumpStrength: number;
    currentDamage: number;
    killForce: number;
    speed: number;
    teleportHome: boolean;
    teleportHomeDistance: number;
    visibleEnergy: number;
    damageFlash: boolean;
    pickupEnabled: boolean;
    storable: boolean;
    pushAstronaut: boolean;
    sound: Required<CreatureSoundSettings>;
    state: Record<string, unknown>;
    paletteCycle?: PaletteCycleSettings;
    previousX: number;
    previousY: number;
    entityId?: number;

    constructor(data: Partial<CreatureSaveData> & Pick<CreatureSaveData, 'x' | 'y' | 'type'>) {
        const normalized = createCreatureSaveData(data);
        this.x = normalized.x;
        this.y = normalized.y;
        this.type = normalized.type;
        this.palette = normalized.palette ?? 0;
        this.rotation = normalized.rotation ?? 1;
        this.translation = normalizeSpriteTranslation(normalized.translation);
        this.archetype = normalized.archetype ?? inferCreatureArchetype(normalized.type);
        this.collision = normalized.collision ?? false;
        this.hostile = normalized.hostile ?? false;
        this.damageOnContact = normalized.damageOnContact ?? 0;
        this.followsAstronaut = normalized.followsAstronaut ?? false;
        this.followRange = normalized.followRange ?? 160;
        this.movementMode = normalized.movementMode ?? DEFAULT_CREATURE_MOVEMENT_MODE;
        this.fixed = normalized.fixed ?? false;
        this.homeX = normalized.homeX ?? this.x;
        this.homeY = normalized.homeY ?? this.y;
        this.patrolMinX = normalized.patrolMinX ?? this.x - 96;
        this.patrolMaxX = normalized.patrolMaxX ?? this.x + 96;
        this.patrolMinY = normalized.patrolMinY ?? this.y - 32;
        this.patrolMaxY = normalized.patrolMaxY ?? this.y + 32;
        this.hoverAmplitude = normalized.hoverAmplitude ?? 0;
        this.trackRange = normalized.trackRange ?? this.followRange;
        this.fireMode = normalized.fireMode ?? DEFAULT_CREATURE_FIRE_MODE;
        this.homingBullets = normalized.homingBullets ?? false;
        this.fireCooldownMs = normalized.fireCooldownMs ?? 1200;
        this.projectileSpeed = normalized.projectileSpeed ?? 3;
        this.canEatWasps = normalized.canEatWasps ?? false;
        this.canJump = normalized.canJump ?? false;
        this.jumpStrength = normalized.jumpStrength ?? 6;
        this.currentDamage = normalized.currentDamage ?? 0;
        this.killForce = normalized.killForce ?? 3;
        this.speed = normalized.speed ?? 1.5;
        this.teleportHome = normalized.teleportHome ?? false;
        this.teleportHomeDistance = normalized.teleportHomeDistance ?? 512;
        this.visibleEnergy = normalized.visibleEnergy ?? 1;
        this.damageFlash = normalized.damageFlash ?? true;
        this.pickupEnabled = normalized.pickupEnabled ?? false;
        this.storable = normalized.storable ?? false;
        this.pushAstronaut = normalized.pushAstronaut ?? true;
        this.sound = cloneSoundSettings(normalized.sound);
        this.state = normalized.state ? { ...normalized.state } : {};
        if (typeof this.state.authoredRotation !== 'number') {
            this.state.authoredRotation = this.rotation;
        }
        this.paletteCycle = clonePaletteCycle(normalized.paletteCycle);
        this.previousX = this.x;
        this.previousY = this.y;
    }
}
