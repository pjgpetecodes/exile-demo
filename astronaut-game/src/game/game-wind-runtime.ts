import type { MapBlock } from '../world/map.js';
import { MOVEMENT_SETTINGS } from '../config/settings.js';
import type { WindGlobalSettings } from '../types/index.js';

// Wind-field computations are kept in a dedicated module for easier testing and context loading.

export type WindEmitterRuntime = {
    id: string;
    x: number;
    y: number;
    enabled: boolean;
    directionDegrees: number;
    strength: number;
    radius: number;
    mode: 'constant' | 'variable';
    variabilityHz: number;
    variabilityAmount: number;
    affectsAstronaut: boolean;
    affectsLooseObjects: boolean;
    showParticles: boolean;
};

export type WindRuntimeToggles = {
    windEnabled: boolean;
    emittersEnabled: boolean;
    surfaceWindEnabled: boolean;
    windVfxEnabled: boolean;
};

function clampToRange(value: number, minimum: number, maximum: number) {
    return Math.max(minimum, Math.min(maximum, value));
}

export function normalizeWindEmitter(data: any): WindEmitterRuntime {
    const numericIdFallback = Math.round(Number(data?.x) || 0);
    return {
        id: typeof data?.id === 'string' && data.id.trim().length > 0
            ? data.id.trim()
            : `wind_${numericIdFallback}_${Math.round(Number(data?.y) || 0)}`,
        x: Math.round(Number(data?.x) || 0),
        y: Math.round(Number(data?.y) || 0),
        enabled: data?.enabled !== false,
        directionDegrees: Number.isFinite(Number(data?.directionDegrees))
            ? ((Number(data.directionDegrees) % 360) + 360) % 360
            : 270,
        strength: Math.max(0, Number(data?.strength ?? MOVEMENT_SETTINGS.windEmitterDefaultStrength)),
        radius: Math.max(1, Number(data?.radius ?? MOVEMENT_SETTINGS.windEmitterDefaultRadius)),
        mode: data?.mode === 'variable' ? 'variable' : 'constant',
        variabilityHz: Math.max(0, Number(data?.variabilityHz ?? MOVEMENT_SETTINGS.windEmitterVariableDefaultHz)),
        variabilityAmount: clampToRange(
            Number(data?.variabilityAmount ?? MOVEMENT_SETTINGS.windEmitterVariableDefaultAmount),
            0,
            1
        ),
        affectsAstronaut: data?.affectsAstronaut !== false,
        affectsLooseObjects: data?.affectsLooseObjects !== false,
        showParticles: data?.showParticles !== false
    };
}

export function normalizeWindSettings(data: any): WindGlobalSettings {
    const leftStartX = Number.isFinite(Number(data?.surfaceWindLeftStartX))
        ? Number(data.surfaceWindLeftStartX)
        : MOVEMENT_SETTINGS.surfaceWindDefaultLeftStartX;
    const leftLimitX = Number.isFinite(Number(data?.surfaceWindLeftLimitX))
        ? Number(data.surfaceWindLeftLimitX)
        : MOVEMENT_SETTINGS.surfaceWindDefaultLeftLimitX;
    const rightStartX = Number.isFinite(Number(data?.surfaceWindRightStartX))
        ? Number(data.surfaceWindRightStartX)
        : MOVEMENT_SETTINGS.surfaceWindDefaultRightStartX;
    const rightLimitX = Number.isFinite(Number(data?.surfaceWindRightLimitX))
        ? Number(data.surfaceWindRightLimitX)
        : MOVEMENT_SETTINGS.surfaceWindDefaultRightLimitX;
    return {
        windEnabled: data?.windEnabled !== false,
        emittersEnabled: data?.emittersEnabled !== false,
        surfaceWindEnabled: data?.surfaceWindEnabled === true
            ? true
            : MOVEMENT_SETTINGS.surfaceWindDefaultEnabled,
        windVfxEnabled: data?.windVfxEnabled !== false,
        surfaceWindMaxY: Number.isFinite(Number(data?.surfaceWindMaxY))
            ? Math.max(0, Number(data.surfaceWindMaxY))
            : MOVEMENT_SETTINGS.surfaceWindDefaultMaxY,
        surfaceWindCenterX: Number.isFinite(Number(data?.surfaceWindCenterX))
            ? Number(data.surfaceWindCenterX)
            : MOVEMENT_SETTINGS.surfaceWindDefaultCenterX,
        surfaceWindDeadzone: Number.isFinite(Number(data?.surfaceWindDeadzone))
            ? Math.max(0, Number(data.surfaceWindDeadzone))
            : MOVEMENT_SETTINGS.surfaceWindDefaultDeadzone,
        surfaceWindStrength: Number.isFinite(Number(data?.surfaceWindStrength))
            ? Math.max(0, Number(data.surfaceWindStrength))
            : MOVEMENT_SETTINGS.surfaceWindDefaultStrength,
        surfaceWindEdgeBand: Number.isFinite(Number(data?.surfaceWindEdgeBand))
            ? Math.max(1, Number(data.surfaceWindEdgeBand))
            : MOVEMENT_SETTINGS.surfaceWindDefaultEdgeBand,
        surfaceWindBuffetHz: Number.isFinite(Number(data?.surfaceWindBuffetHz))
            ? Math.max(0, Number(data.surfaceWindBuffetHz))
            : MOVEMENT_SETTINGS.surfaceWindDefaultBuffetHz,
        surfaceWindBuffetStrength: Number.isFinite(Number(data?.surfaceWindBuffetStrength))
            ? clampToRange(Number(data.surfaceWindBuffetStrength), 0, 1)
            : MOVEMENT_SETTINGS.surfaceWindDefaultBuffetStrength,
        surfaceWindLeftStartX: Math.max(leftStartX, leftLimitX + 1),
        surfaceWindLeftLimitX: Math.min(leftLimitX, leftStartX - 1),
        surfaceWindRightStartX: Math.min(rightStartX, rightLimitX - 1),
        surfaceWindRightLimitX: Math.max(rightLimitX, rightStartX + 1)
    };
}

export function setWindDebugToggle(
    windDebugToggles: Partial<WindRuntimeToggles>,
    key: keyof WindRuntimeToggles,
    enabled: boolean | null
) {
    if (enabled === null) {
        delete windDebugToggles[key];
        return;
    }
    windDebugToggles[key] = enabled;
}

export function getEffectiveWindToggles(
    windSettings: WindGlobalSettings,
    windDebugToggles: Partial<WindRuntimeToggles>
): WindRuntimeToggles {
    const normalizedSettings = normalizeWindSettings(windSettings);
    return {
        windEnabled: windDebugToggles.windEnabled ?? (normalizedSettings.windEnabled !== false),
        emittersEnabled: windDebugToggles.emittersEnabled ?? (normalizedSettings.emittersEnabled !== false),
        surfaceWindEnabled: windDebugToggles.surfaceWindEnabled ?? (normalizedSettings.surfaceWindEnabled === true),
        windVfxEnabled: windDebugToggles.windVfxEnabled ?? (normalizedSettings.windVfxEnabled !== false)
    };
}

function hashWindSourceSeed(id: string, x: number, y: number) {
    let hash = 2166136261;
    const input = `${id}:${x}:${y}`;
    for (let index = 0; index < input.length; index++) {
        hash ^= input.charCodeAt(index);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function toWindEmitterFromBlock(block: MapBlock): WindEmitterRuntime | null {
    if (block.windEnabled !== true) {
        return null;
    }
    const blockWithId = block as MapBlock & { entityId?: number };
    return {
        id: `block_${blockWithId.entityId ?? `${Math.round(block.x)}_${Math.round(block.y)}`}`,
        x: Math.round(block.x),
        y: Math.round(block.y),
        enabled: true,
        directionDegrees: ((Number(block.windDirectionDegrees ?? 270) % 360) + 360) % 360,
        strength: Math.max(0, Number(block.windStrength ?? MOVEMENT_SETTINGS.windEmitterDefaultStrength)),
        radius: Math.max(1, Number(block.windRadius ?? MOVEMENT_SETTINGS.windEmitterDefaultRadius)),
        mode: block.windMode === 'variable' ? 'variable' : 'constant',
        variabilityHz: Math.max(0, Number(block.windVariabilityHz ?? MOVEMENT_SETTINGS.windEmitterVariableDefaultHz)),
        variabilityAmount: clampToRange(
            Number(block.windVariabilityAmount ?? MOVEMENT_SETTINGS.windEmitterVariableDefaultAmount),
            0,
            1
        ),
        affectsAstronaut: block.windAffectsAstronaut !== false,
        affectsLooseObjects: block.windAffectsLooseObjects !== false,
        showParticles: block.windShowParticles !== false
    };
}

export function resolveEmitterMagnitude(emitter: WindEmitterRuntime, now: number) {
    if (emitter.mode !== 'variable') {
        return emitter.strength;
    }
    const seed = hashWindSourceSeed(emitter.id, emitter.x, emitter.y);
    const seedPhase = (seed % 360) * (Math.PI / 180);
    const oscillation = Math.sin(now * 0.001 * Math.PI * 2 * emitter.variabilityHz + seedPhase);
    const variability = clampToRange(emitter.variabilityAmount, 0, 1);
    const scale = 1 - variability + ((oscillation + 1) * 0.5) * variability;
    return emitter.strength * scale;
}

export function computeEmitterWindAccelerationAtPoint(
    worldX: number,
    worldY: number,
    now: number,
    emitters: WindEmitterRuntime[],
    target: 'astronaut' | 'looseObject'
) {
    let totalX = 0;
    let totalY = 0;
    let activeEmitterCount = 0;
    for (const emitter of emitters) {
        if (target === 'astronaut' && !emitter.affectsAstronaut) {
            continue;
        }
        if (target === 'looseObject' && !emitter.affectsLooseObjects) {
            continue;
        }
        const dx = worldX - emitter.x;
        const dy = worldY - emitter.y;
        const distance = Math.hypot(dx, dy);
        if (distance > emitter.radius) {
            continue;
        }
        const radialFalloff = 1 - distance / emitter.radius;
        const magnitude = resolveEmitterMagnitude(emitter, now) * radialFalloff;
        const directionRadians = (emitter.directionDegrees * Math.PI) / 180;
        totalX += Math.cos(directionRadians) * magnitude;
        totalY += Math.sin(directionRadians) * magnitude;
        activeEmitterCount++;
    }
    return {
        x: totalX,
        y: totalY,
        activeEmitterCount
    };
}

function getSurfaceWindBounds(settings: WindGlobalSettings) {
    const leftStartX = Number(settings.surfaceWindLeftStartX ?? MOVEMENT_SETTINGS.surfaceWindDefaultLeftStartX);
    const leftLimitX = Number(settings.surfaceWindLeftLimitX ?? MOVEMENT_SETTINGS.surfaceWindDefaultLeftLimitX);
    const rightStartX = Number(settings.surfaceWindRightStartX ?? MOVEMENT_SETTINGS.surfaceWindDefaultRightStartX);
    const rightLimitX = Number(settings.surfaceWindRightLimitX ?? MOVEMENT_SETTINGS.surfaceWindDefaultRightLimitX);
    return {
        leftStartX: Math.max(leftStartX, leftLimitX + 1),
        leftLimitX: Math.min(leftLimitX, leftStartX - 1),
        rightStartX: Math.min(rightStartX, rightLimitX - 1),
        rightLimitX: Math.max(rightLimitX, rightStartX + 1)
    };
}

export function getSurfaceWindEdgeProximity(worldX: number, settings: WindGlobalSettings) {
    const { leftStartX, leftLimitX, rightStartX, rightLimitX } = getSurfaceWindBounds(settings);
    const leftProximity = worldX < leftStartX
        ? clampToRange((leftStartX - worldX) / Math.max(1, leftStartX - leftLimitX), 0, 1)
        : 0;
    const rightProximity = worldX > rightStartX
        ? clampToRange((worldX - rightStartX) / Math.max(1, rightLimitX - rightStartX), 0, 1)
        : 0;
    return {
        leftProximity,
        rightProximity,
        edgeProximity: Math.max(leftProximity, rightProximity)
    };
}

export function getSurfaceWindBoundaryOvershoot(worldX: number, settings: WindGlobalSettings) {
    const { leftLimitX, rightLimitX } = getSurfaceWindBounds(settings);
    const leftOvershoot = Math.max(0, leftLimitX - worldX);
    const rightOvershoot = Math.max(0, worldX - rightLimitX);
    return {
        leftOvershoot,
        rightOvershoot,
        maxOvershoot: Math.max(leftOvershoot, rightOvershoot)
    };
}

export function applySurfaceWindField(
    worldX: number,
    worldY: number,
    now: number,
    windSettings: WindGlobalSettings
) {
    const normalizedSettings = normalizeWindSettings(windSettings);
    const maxY = Number(normalizedSettings.surfaceWindMaxY ?? MOVEMENT_SETTINGS.surfaceWindDefaultMaxY);
    if (worldY > maxY) {
        return { x: 0, y: 0 };
    }
    const strength = Math.max(0, Number(normalizedSettings.surfaceWindStrength ?? MOVEMENT_SETTINGS.surfaceWindDefaultStrength));
    const { leftProximity, rightProximity, edgeProximity } = getSurfaceWindEdgeProximity(worldX, normalizedSettings);
    const { leftOvershoot, rightOvershoot, maxOvershoot } = getSurfaceWindBoundaryOvershoot(worldX, normalizedSettings);
    if (edgeProximity <= 0 && maxOvershoot <= 0) {
        return { x: 0, y: 0 };
    }
    const buffetHz = Math.max(0, Number(normalizedSettings.surfaceWindBuffetHz ?? MOVEMENT_SETTINGS.surfaceWindDefaultBuffetHz));
    const buffetStrength = clampToRange(
        Number(normalizedSettings.surfaceWindBuffetStrength ?? MOVEMENT_SETTINGS.surfaceWindDefaultBuffetStrength),
        0,
        1
    );
    let baseLeft = Math.pow(leftProximity, 1.35) + Math.pow(leftProximity, 4.2) * 2.8;
    let baseRight = Math.pow(rightProximity, 1.35) + Math.pow(rightProximity, 4.2) * 2.8;
    if (leftOvershoot > 0) {
        const overshootRamp = leftOvershoot / (leftOvershoot + 900);
        baseLeft = Math.max(1, baseLeft) * (1 + overshootRamp * 0.12);
    }
    if (rightOvershoot > 0) {
        const overshootRamp = rightOvershoot / (rightOvershoot + 900);
        baseRight = Math.max(1, baseRight) * (1 + overshootRamp * 0.12);
    }
    const edgeBuffetScale = 0.18 + edgeProximity * 0.22;
    const baseX = strength * (baseLeft - baseRight);
    const phase = now * 0.001 * Math.PI * 2 * buffetHz + worldX * 0.0021 + worldY * 0.0013;
    const gustScale = clampToRange(1 + Math.sin(phase) * buffetStrength * edgeBuffetScale, 0.78, 1.34);
    const crosswindY = Math.cos(phase * 1.7) * strength * 0.45 * buffetStrength * (0.2 + edgeProximity * 0.8);
    return {
        x: baseX * gustScale,
        y: crosswindY
    };
}
