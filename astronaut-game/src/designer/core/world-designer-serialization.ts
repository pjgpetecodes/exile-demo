import {
    getDefaultDestructibleEnabled,
    getDefaultDestructibleHealth,
    getDefaultDestructionSource
} from '../../entities/destructibles.js';
import { MapBlock, shouldMaskAstronaut } from '../../world/map.js';
import { isWaterBlock } from '../../world/water-blocks.js';
import { toCreatureSaveData } from '../../entities/creature.js';
import { getDefaultGrenadeExplosionPower, isGrenadeCollectableType } from '../../entities/collectable.js';
import type { CreatureSaveData, TeleporterDestinationMode, TeleporterSaveData } from '../../types/index.js';
import { normalizeSpriteTranslation } from '../../shared/utilities.js';
import type {
    ButtonSaveData,
    CollectableSaveData,
    DoorSaveData,
    RawWorldData
} from './world-designer-types.js';

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

function deepClone<T>(value: T): T {
    return JSON.parse(JSON.stringify(value));
}

function normalizeRotation(rotation?: number) {
    if (typeof rotation !== 'number' || Number.isNaN(rotation)) {
        return 1;
    }
    return clamp(Math.round(rotation), 1, 9);
}

function isTeleporterMode(value: unknown): value is TeleporterDestinationMode {
    return value === 'toggle' ||
        value === 'destination_a' ||
        value === 'destination_b' ||
        value === 'toggle_enabled' ||
        value === 'enable' ||
        value === 'disable';
}

export function toMapBlockData(block: MapBlock): MapBlock {
    const hasDestructibleMetadata = typeof block.destructible === 'boolean'
        || typeof block.destructionHealth === 'number'
        || typeof block.destructionSource === 'string';
    const hasWindMetadata = block.windEnabled === true
        || typeof block.windDirectionDegrees === 'number'
        || typeof block.windStrength === 'number'
        || typeof block.windRadius === 'number'
        || typeof block.windMode === 'string'
        || typeof block.windVariabilityHz === 'number'
        || typeof block.windVariabilityAmount === 'number'
        || typeof block.windAffectsAstronaut === 'boolean'
        || typeof block.windAffectsLooseObjects === 'boolean'
        || typeof block.windShowParticles === 'boolean';
    return {
        x: block.x,
        y: block.y,
        type: block.type,
        collision: block.collision !== false,
        maskAstronaut: shouldMaskAstronaut(block),
        palette: typeof block.palette === 'number' ? block.palette : 0,
        rotation: normalizeRotation(block.rotation) as MapBlock['rotation'],
        translation: normalizeSpriteTranslation(block.translation),
        ...(typeof block.teleporterId === 'string' && block.teleporterId.trim().length > 0
            ? { teleporterId: block.teleporterId.trim() }
            : {}),
        ...(typeof block.teleporterEnabled === 'boolean'
            ? { teleporterEnabled: block.teleporterEnabled }
            : {}),
        ...(typeof block.teleporterRequiresKey === 'boolean'
            ? { teleporterRequiresKey: block.teleporterRequiresKey }
            : {}),
        ...(block.teleporterDestinationA
            ? {
                teleporterDestinationA: {
                    x: Math.round(Number(block.teleporterDestinationA.x) || 0),
                    y: Math.round(Number(block.teleporterDestinationA.y) || 0)
                }
            }
            : {}),
        ...(block.teleporterDestinationB
            ? {
                teleporterDestinationB: {
                    x: Math.round(Number(block.teleporterDestinationB.x) || 0),
                    y: Math.round(Number(block.teleporterDestinationB.y) || 0)
                }
            }
            : {}),
        ...(typeof block.teleporterActiveDestinationIndex === 'number'
            ? { teleporterActiveDestinationIndex: block.teleporterActiveDestinationIndex === 1 ? 1 : 0 }
            : {}),
        ...(hasDestructibleMetadata
            ? {
                destructible: typeof block.destructible === 'boolean'
                    ? block.destructible
                    : getDefaultDestructibleEnabled('world', block.type),
                destructionHealth: typeof block.destructionHealth === 'number'
                    ? Math.max(0.1, block.destructionHealth)
                    : getDefaultDestructibleHealth('world', block.type),
                destructionSource: typeof block.destructionSource === 'string'
                    ? block.destructionSource
                    : getDefaultDestructionSource('world', block.type)
            }
            : {}),
        ...(hasWindMetadata
            ? {
                windEnabled: block.windEnabled === true,
                windDirectionDegrees: typeof block.windDirectionDegrees === 'number'
                    ? Number(block.windDirectionDegrees)
                    : 270,
                windStrength: typeof block.windStrength === 'number'
                    ? Math.max(0, Number(block.windStrength))
                    : 0.18,
                windRadius: typeof block.windRadius === 'number'
                    ? Math.max(1, Number(block.windRadius))
                    : 220,
                windMode: block.windMode === 'variable' ? 'variable' : 'constant',
                windVariabilityHz: typeof block.windVariabilityHz === 'number'
                    ? Math.max(0, Number(block.windVariabilityHz))
                    : 1.2,
                windVariabilityAmount: typeof block.windVariabilityAmount === 'number'
                    ? clamp(Number(block.windVariabilityAmount), 0, 1)
                    : 0.45,
                windAffectsAstronaut: block.windAffectsAstronaut !== false,
                windAffectsLooseObjects: block.windAffectsLooseObjects !== false,
                windShowParticles: block.windShowParticles !== false
            }
            : {}),
        ...(block.paletteCycle ? { paletteCycle: deepClone(block.paletteCycle) } : {}),
        ...(isWaterBlock(block) ? { water: true } : {})
    };
}

export function toButtonData(button: any): ButtonSaveData {
    const normalizedBoxOffsetX = [8, 4, -8, -12].includes(button.boxOffsetX)
        ? 12
        : (button.boxOffsetX ?? 12);
    const capClosedOffsetX = button.capClosedOffsetX ?? 0;
    const capClosedOffsetY = button.capClosedOffsetY ?? 0;
    const capOpenOffsetX = button.capOpenOffsetX ?? (button.pressOffset ?? 2);
    const capOpenOffsetY = button.capOpenOffsetY ?? 0;
    return {
        x: button.x,
        y: button.y,
        type: button.type,
        palette: button.palette ?? 0,
        boxType: button.boxType,
        boxPalette: button.boxPalette ?? 0,
        rotation: normalizeRotation(button.rotation),
        active: button.defaultActive ?? button.active ?? false,
        linkedDoors: Array.isArray(button.linkedDoors) ? [...button.linkedDoors] : [],
        linkedTeleporters: Array.isArray(button.linkedTeleporters)
            ? button.linkedTeleporters.filter((id: unknown) => typeof id === 'string' && id.trim().length > 0)
            : [],
        teleporterMode: isTeleporterMode(button.teleporterMode)
            ? button.teleporterMode
            : 'toggle',
        collision: button.collision !== false,
        pressOffset: capOpenOffsetX - capClosedOffsetX,
        boxOffsetX: normalizedBoxOffsetX,
        boxOffsetY: button.boxOffsetY ?? 0,
        capClosedOffsetX,
        capClosedOffsetY,
        capOpenOffsetX,
        capOpenOffsetY,
        ...(button.paletteCycle ? { paletteCycle: deepClone(button.paletteCycle) } : {})
    };
}

export function toTeleporterData(teleporter: any): TeleporterSaveData {
    const activeDestinationIndex = teleporter.activeDestinationIndex === 1 ? 1 : 0;
    return {
        id: typeof teleporter.id === 'string' && teleporter.id.trim().length > 0
            ? teleporter.id.trim()
            : `teleporter_${Math.round(Number(teleporter.padX) || 0)}_${Math.round(Number(teleporter.padY) || 0)}`,
        baseX: Math.round(Number(teleporter.baseX) || 0),
        baseY: Math.round(Number(teleporter.baseY) || 0),
        padX: Math.round(Number(teleporter.padX) || 0),
        padY: Math.round(Number(teleporter.padY) || 0),
        enabled: teleporter.enabled !== false,
        requiresKey: teleporter.requiresKey === true,
        destinationA: {
            x: Math.round(Number(teleporter.destinationA?.x) || 0),
            y: Math.round(Number(teleporter.destinationA?.y) || 0)
        },
        destinationB: teleporter.destinationB
            ? {
                x: Math.round(Number(teleporter.destinationB.x) || 0),
                y: Math.round(Number(teleporter.destinationB.y) || 0)
            }
            : null,
        activeDestinationIndex
    };
}

export function toDoorData(door: any): DoorSaveData {
    return {
        x: door.x,
        y: door.y,
        z: door.z ?? 0,
        type: door.type,
        palette: door.palette ?? 0,
        rotation: normalizeRotation(door.rotation),
        translation: normalizeSpriteTranslation(door.translation),
        name: door.name ?? '',
        doorID: door.doorID ?? -1,
        locked: door.defaultLocked ?? door.locked ?? false,
        open: door.defaultOpen ?? door.open ?? false,
        palette_locked: typeof door.palette_locked === 'number' ? door.palette_locked : null,
        palette_unlocked: typeof door.palette_unlocked === 'number' ? door.palette_unlocked : null,
        collision: door.collision !== false,
        destructible: typeof door.destructible === 'boolean'
            ? door.destructible
            : getDefaultDestructibleEnabled('doors', door.type),
        destructionHealth: typeof door.destructionHealth === 'number'
            ? Math.max(0.1, door.destructionHealth)
            : getDefaultDestructibleHealth('doors', door.type),
        destructionSource: typeof door.destructionSource === 'string'
            ? door.destructionSource
            : getDefaultDestructionSource('doors', door.type),
        ...(door.paletteCycle ? { paletteCycle: deepClone(door.paletteCycle) } : {})
    };
}

export function toCreatureData(creature: any): CreatureSaveData {
    return toCreatureSaveData({
        ...creature,
        rotation: normalizeRotation(creature.rotation)
    });
}

export function toCollectableData(collectable: any): CollectableSaveData {
    const grenadeDefaults = isGrenadeCollectableType(collectable.type)
        ? {
            armed: collectable.armed === true,
            explosionPower: typeof collectable.explosionPower === 'number'
                ? collectable.explosionPower
                : getDefaultGrenadeExplosionPower(collectable.type),
            ...(typeof collectable.explosionRadius === 'number'
                ? { explosionRadius: Math.max(1, collectable.explosionRadius) }
                : {})
        }
        : {};
    return {
        x: collectable.x,
        y: collectable.y,
        type: collectable.type,
        palette: collectable.palette ?? 0,
        rotation: normalizeRotation(collectable.defaultRotation ?? collectable.rotation),
        collected: collectable.collected ?? false,
        name: collectable.name ?? '',
        weight: typeof collectable.weight === 'number' ? collectable.weight : 0,
        pickupEnabled: collectable.pickupEnabled ?? true,
        storable: collectable.storable ?? false,
        affectsAstronaut: collectable.affectsAstronaut ?? true,
        collision: collectable.collision !== false,
        held: collectable.held ?? false,
        stored: collectable.stored ?? false,
        isGrounded: collectable.isGrounded ?? false,
        velocity: deepClone(collectable.velocity ?? { x: 0, y: 0 }),
        astronautCollisionIgnoreFrames: collectable.astronautCollisionIgnoreFrames ?? 0,
        ...(collectable.radioactive ? { radioactive: true } : {}),
        ...(collectable.paletteCycle ? { paletteCycle: deepClone(collectable.paletteCycle) } : {}),
        ...grenadeDefaults
    };
}

export function compareNumbers(left: number, right: number) {
    return left - right;
}

export function compareStrings(left: string, right: string) {
    return left.localeCompare(right);
}

export function serializeWorldData(data: RawWorldData): RawWorldData {
    const worldMap = data.worldMap
        .map((block) => toMapBlockData(block))
        .sort((left, right) =>
            compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
            || compareStrings(String(left.palette ?? ''), String(right.palette ?? ''))
            || compareNumbers(left.rotation ?? 0, right.rotation ?? 0)
        );
    const buttons = data.buttons
        .map((button) => toButtonData(button))
        .sort((left, right) =>
            compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
            || compareNumbers(left.palette ?? 0, right.palette ?? 0)
        );
    const doors = data.doors
        .map((door) => toDoorData(door))
        .sort((left, right) =>
            compareNumbers(left.doorID ?? -1, right.doorID ?? -1)
            || compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
        );
    const creatures = data.creatures
        .map((creature) => toCreatureData(creature))
        .sort((left, right) =>
            compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
            || compareNumbers(left.palette ?? 0, right.palette ?? 0)
            || compareNumbers(left.rotation ?? 0, right.rotation ?? 0)
        );
    const collectables = data.collectables
        .filter((collectable) => !('creatureProjectile' in collectable) || !collectable.creatureProjectile)
        .map((collectable) => toCollectableData(collectable))
        .sort((left, right) =>
            compareNumbers(left.y, right.y)
            || compareNumbers(left.x, right.x)
            || compareStrings(left.type, right.type)
            || compareNumbers(left.palette ?? 0, right.palette ?? 0)
            || compareNumbers(left.rotation ?? 0, right.rotation ?? 0)
        );
    const teleporters = (data.teleporters ?? [])
        .map((teleporter) => toTeleporterData(teleporter))
        .sort((left, right) =>
            compareStrings(left.id, right.id)
            || compareNumbers(left.baseY, right.baseY)
            || compareNumbers(left.baseX, right.baseX)
        );

    return {
        worldMap,
        buttons,
        doors,
        creatures,
        collectables,
        teleporters,
        windEmitters: (data.windEmitters ?? []).map((emitter) => ({ ...emitter })),
        windSettings: data.windSettings ? deepClone(data.windSettings) : {},
        astronautStart: {
            x: Math.round(data.astronautStart.x),
            y: Math.round(data.astronautStart.y)
        }
    };
}

export function stableStringify(value: unknown) {
    return JSON.stringify(value, null, 2);
}

export function snapshotsEqual(left: RawWorldData, right: RawWorldData) {
    return stableStringify(left) === stableStringify(right);
}

export function designerSnapshotsEqual(left: unknown, right: unknown) {
    return stableStringify(left) === stableStringify(right);
}
