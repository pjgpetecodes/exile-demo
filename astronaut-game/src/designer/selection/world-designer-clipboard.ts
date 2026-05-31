import { Button } from '../../entities/button.js';
import { Door } from '../../entities/door.js';
import { Creature } from '../../entities/creature.js';
import { Collectable } from '../../entities/collectable.js';
import { MapBlock } from '../../world/map.js';
import type { CreatureSaveData, TeleporterSaveData } from '../../types/index.js';
import {
    toButtonData,
    toCollectableData,
    toCreatureData,
    toDoorData,
    toMapBlockData
} from '../core/world-designer-serialization.js';

import type {
    ButtonSaveData,
    ClipboardEntry,
    CollectableSaveData,
    CustomSpriteInstance,
    DesignerCategory,
    DoorSaveData,
    Selection
} from '../core/world-designer-types.js';

type WorldDesignerClipboardDeps = {
    deepClone: <T>(value: T) => T;
    getNextDoorId: () => number;
    getCategoryArray: (category: DesignerCategory) => any[];
    convertTeleporterWorldPair: (base: MapBlock, pad: MapBlock) => void;
    findTeleporterForWorldBlock: (block: MapBlock) => TeleporterSaveData | null;
    getTeleporterById: (id: string) => TeleporterSaveData | null;
    clearTeleporterMetadata: (block: MapBlock) => void;
    applyTeleporterRuntimeToBlocks: (teleporter: TeleporterSaveData, base: MapBlock, pad: MapBlock) => void;
};

export function createWorldDesignerClipboard(deps: WorldDesignerClipboardDeps) {
    const {
        deepClone,
        getNextDoorId,
        getCategoryArray,
        convertTeleporterWorldPair,
        findTeleporterForWorldBlock,
        getTeleporterById,
        clearTeleporterMetadata,
        applyTeleporterRuntimeToBlocks
    } = deps;

    function serializeSelectionEntity(selection: Selection): ClipboardEntry['data'] {
        return deepClone(selection.category === 'custom'
            ? selection.entity
            : selection.category === 'world'
                ? toMapBlockData(selection.entity)
                : selection.category === 'buttons'
                    ? toButtonData(selection.entity)
                    : selection.category === 'doors'
                        ? toDoorData(selection.entity)
                        : selection.category === 'creatures'
                            ? toCreatureData(selection.entity)
                            : toCollectableData(selection.entity));
    }

    function createSelectionEntity(
        category: DesignerCategory,
        data: ClipboardEntry['data']
    ) {
        if (category === 'custom') {
            return deepClone(data as CustomSpriteInstance);
        }
        if (category === 'world') {
            return data as MapBlock;
        }
        if (category === 'buttons') {
            return new Button(data as ButtonSaveData);
        }
        if (category === 'doors') {
            return new Door({ ...(data as DoorSaveData), doorID: getNextDoorId() });
        }
        if (category === 'creatures') {
            return new Creature(data as CreatureSaveData);
        }
        const collectableData = {
            ...(data as CollectableSaveData),
            collected: false,
            held: false,
            stored: false,
            velocity: { x: 0, y: 0 },
            astronautCollisionIgnoreFrames: 0
        };
        return new Collectable(collectableData);
    }

    function createPastedSelections(entries: ClipboardEntry[], offsetX: number, offsetY: number) {
        const pastedSelections: Selection[] = [];
        const groupedTeleporterEntries = new Map<string, { base?: MapBlock; pad?: MapBlock }>();

        for (const entry of entries) {
            const clone = deepClone(entry.data);
            clone.x += offsetX;
            clone.y += offsetY;
            const worldClone = clone as MapBlock;
            if (
                entry.category === 'world' &&
                (worldClone.type === 'teleporter' || worldClone.type === 'teleporter_pad') &&
                typeof worldClone.teleporterId === 'string' &&
                worldClone.teleporterId.trim().length > 0
            ) {
                const teleporterId = worldClone.teleporterId.trim();
                const grouped = groupedTeleporterEntries.get(teleporterId) ?? {};
                if (worldClone.type === 'teleporter') {
                    grouped.base = worldClone;
                } else {
                    grouped.pad = worldClone;
                }
                groupedTeleporterEntries.set(teleporterId, grouped);
                continue;
            }
            const entity = createSelectionEntity(entry.category, clone);
            getCategoryArray(entry.category).push(entity);
            pastedSelections.push({ category: entry.category, entity });
        }

        for (const [sourceTeleporterId, grouped] of groupedTeleporterEntries.entries()) {
            if (!grouped.base || !grouped.pad) {
                if (grouped.base) {
                    clearTeleporterMetadata(grouped.base);
                    getCategoryArray('world').push(grouped.base);
                    pastedSelections.push({ category: 'world', entity: grouped.base });
                }
                if (grouped.pad) {
                    clearTeleporterMetadata(grouped.pad);
                    getCategoryArray('world').push(grouped.pad);
                    pastedSelections.push({ category: 'world', entity: grouped.pad });
                }
                continue;
            }

            const base = grouped.base;
            const pad = grouped.pad;
            clearTeleporterMetadata(base);
            clearTeleporterMetadata(pad);
            getCategoryArray('world').push(base);
            getCategoryArray('world').push(pad);
            convertTeleporterWorldPair(base, pad);

            const pastedTeleporter = findTeleporterForWorldBlock(base);
            const sourceTeleporter = getTeleporterById(sourceTeleporterId);
            if (pastedTeleporter && sourceTeleporter) {
                pastedTeleporter.enabled = sourceTeleporter.enabled !== false;
                pastedTeleporter.requiresKey = sourceTeleporter.requiresKey === true;
                pastedTeleporter.destinationA = {
                    x: Math.round(sourceTeleporter.destinationA.x),
                    y: Math.round(sourceTeleporter.destinationA.y)
                };
                pastedTeleporter.destinationB = sourceTeleporter.destinationB
                    ? {
                        x: Math.round(sourceTeleporter.destinationB.x),
                        y: Math.round(sourceTeleporter.destinationB.y)
                    }
                    : null;
                pastedTeleporter.activeDestinationIndex = sourceTeleporter.activeDestinationIndex === 1 ? 1 : 0;
                applyTeleporterRuntimeToBlocks(pastedTeleporter, base, pad);
            }

            pastedSelections.push({ category: 'world', entity: base });
        }

        return pastedSelections;
    }

    return {
        serializeSelectionEntity,
        createSelectionEntity,
        createPastedSelections
    };
}
