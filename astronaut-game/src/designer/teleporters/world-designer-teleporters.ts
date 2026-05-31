import { MapBlock } from '../../world/map.js';
import type { TeleporterSaveData } from '../../types/index.js';
import type { RawWorldData } from '../core/world-designer-types.js';

function findNearestWorldBlockByType(
    worldMap: MapBlock[],
    type: 'teleporter' | 'teleporter_pad',
    targetX: number,
    targetY: number,
    maxDistance: number
) {
    let bestPart: MapBlock | null = null;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    const maxDistanceSquared = maxDistance * maxDistance;
    for (const part of worldMap) {
        if (part.type !== type) {
            continue;
        }
        const dx = targetX - part.x;
        const dy = targetY - part.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= maxDistanceSquared && distanceSquared < bestDistanceSquared) {
            bestPart = part;
            bestDistanceSquared = distanceSquared;
        }
    }
    return bestPart;
}

function findWorldTeleporterPartById(
    worldMap: MapBlock[],
    type: 'teleporter' | 'teleporter_pad',
    teleporterId: string,
    targetX: number,
    targetY: number
) {
    const candidates = worldMap.filter((block) =>
        block.type === type &&
        block.teleporterId === teleporterId
    );
    if (candidates.length === 0) {
        return null;
    }
    let best = candidates[0];
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const candidate of candidates) {
        const dx = targetX - candidate.x;
        const dy = targetY - candidate.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared < bestDistanceSquared) {
            best = candidate;
            bestDistanceSquared = distanceSquared;
        }
    }
    return best;
}

function syncTeleporterMetadataToWorldBlocks(data: RawWorldData) {
    for (const teleporter of data.teleporters ?? []) {
        const base = data.worldMap.find((block) =>
            block.type === 'teleporter' &&
            (block.teleporterId === teleporter.id || (block.x === teleporter.baseX && block.y === teleporter.baseY))
        ) ?? null;
        const pad = data.worldMap.find((block) =>
            block.type === 'teleporter_pad' &&
            (block.teleporterId === teleporter.id || (block.x === teleporter.padX && block.y === teleporter.padY))
        ) ?? null;
        for (const part of [base, pad]) {
            if (!part) {
                continue;
            }
            part.teleporterId = teleporter.id;
            part.teleporterEnabled = teleporter.enabled !== false;
            part.teleporterRequiresKey = teleporter.requiresKey === true;
            part.teleporterDestinationA = {
                x: Math.round(teleporter.destinationA.x),
                y: Math.round(teleporter.destinationA.y)
            };
            part.teleporterDestinationB = teleporter.destinationB
                ? {
                    x: Math.round(teleporter.destinationB.x),
                    y: Math.round(teleporter.destinationB.y)
                }
                : null;
            part.teleporterActiveDestinationIndex = teleporter.activeDestinationIndex === 1 ? 1 : 0;
        }
    }
}

export function reconcileTeleporterPairsForSave(data: RawWorldData, tileSize: number) {
    const teleporters = data.teleporters ?? [];
    const taggedTeleporterParts = new Map<string, { base?: MapBlock; pad?: MapBlock }>();
    for (const block of data.worldMap) {
        if ((block.type !== 'teleporter' && block.type !== 'teleporter_pad') || !block.teleporterId) {
            continue;
        }
        const id = String(block.teleporterId).trim();
        if (!id) {
            continue;
        }
        const existing = taggedTeleporterParts.get(id) ?? {};
        if (block.type === 'teleporter') {
            existing.base = block;
        } else {
            existing.pad = block;
        }
        taggedTeleporterParts.set(id, existing);
    }
    if (taggedTeleporterParts.size > 0) {
        const byId = new Map<string, TeleporterSaveData>();
        for (const teleporter of teleporters) {
            byId.set(teleporter.id, teleporter);
        }
        const startX = Math.round(data.astronautStart.x);
        const startY = Math.round(data.astronautStart.y);
        const toPositionOrNull = (value: unknown) => {
            if (!value || typeof value !== 'object') {
                return null;
            }
            const x = Math.round(Number((value as { x?: number }).x));
            const y = Math.round(Number((value as { y?: number }).y));
            if (!Number.isFinite(x) || !Number.isFinite(y)) {
                return null;
            }
            return { x, y };
        };
        for (const [id, parts] of taggedTeleporterParts.entries()) {
            if (!parts.base || !parts.pad) {
                continue;
            }
            const existing = byId.get(id)
                ?? teleporters.find((teleporter) =>
                    teleporter.baseX === parts.base!.x &&
                    teleporter.baseY === parts.base!.y &&
                    teleporter.padX === parts.pad!.x &&
                    teleporter.padY === parts.pad!.y
                );
            if (existing) {
                existing.baseX = parts.base.x;
                existing.baseY = parts.base.y;
                existing.padX = parts.pad.x;
                existing.padY = parts.pad.y;
                parts.base.teleporterId = existing.id;
                parts.pad.teleporterId = existing.id;
            } else {
                const destinationA = toPositionOrNull(parts.base.teleporterDestinationA)
                    ?? toPositionOrNull(parts.pad.teleporterDestinationA)
                    ?? { x: startX, y: startY };
                const destinationB = toPositionOrNull(parts.base.teleporterDestinationB)
                    ?? toPositionOrNull(parts.pad.teleporterDestinationB);
                data.teleporters.push({
                    id,
                    baseX: parts.base.x,
                    baseY: parts.base.y,
                    padX: parts.pad.x,
                    padY: parts.pad.y,
                    enabled: (parts.base.teleporterEnabled ?? parts.pad.teleporterEnabled) !== false,
                    requiresKey: (parts.base.teleporterRequiresKey ?? parts.pad.teleporterRequiresKey) === true,
                    destinationA,
                    destinationB,
                    activeDestinationIndex:
                        ((parts.base.teleporterActiveDestinationIndex ?? parts.pad.teleporterActiveDestinationIndex) === 1 && destinationB)
                            ? 1
                            : 0
                });
            }
        }
    }
    if (teleporters.length === 0) {
        return;
    }
    const correctionDistancePx = tileSize * 1.5;
    teleporters.forEach((teleporter) => {
        teleporter.baseX = Math.round(teleporter.baseX);
        teleporter.baseY = Math.round(teleporter.baseY);
        teleporter.padX = Math.round(teleporter.padX);
        teleporter.padY = Math.round(teleporter.padY);
        const baseById = findWorldTeleporterPartById(
            data.worldMap,
            'teleporter',
            teleporter.id,
            teleporter.baseX,
            teleporter.baseY
        );
        const padById = findWorldTeleporterPartById(
            data.worldMap,
            'teleporter_pad',
            teleporter.id,
            teleporter.padX,
            teleporter.padY
        );
        if (baseById) {
            teleporter.baseX = baseById.x;
            teleporter.baseY = baseById.y;
            baseById.teleporterId = teleporter.id;
        }
        if (padById) {
            teleporter.padX = padById.x;
            teleporter.padY = padById.y;
            padById.teleporterId = teleporter.id;
        }
        const hasBaseAtPosition = data.worldMap.some((block) =>
            block.type === 'teleporter' &&
            block.x === teleporter.baseX &&
            block.y === teleporter.baseY
        );
        if (!hasBaseAtPosition) {
            const correctedBase = findNearestWorldBlockByType(
                data.worldMap,
                'teleporter',
                teleporter.baseX,
                teleporter.baseY,
                correctionDistancePx
            );
            if (correctedBase) {
                teleporter.baseX = correctedBase.x;
                teleporter.baseY = correctedBase.y;
                correctedBase.teleporterId = teleporter.id;
            }
        }
        const hasPadAtPosition = data.worldMap.some((block) =>
            block.type === 'teleporter_pad' &&
            block.x === teleporter.padX &&
            block.y === teleporter.padY
        );
        if (!hasPadAtPosition) {
            const correctedPad = findNearestWorldBlockByType(
                data.worldMap,
                'teleporter_pad',
                teleporter.padX,
                teleporter.padY,
                correctionDistancePx
            );
            if (correctedPad) {
                teleporter.padX = correctedPad.x;
                teleporter.padY = correctedPad.y;
                correctedPad.teleporterId = teleporter.id;
            }
        }
    });
    syncTeleporterMetadataToWorldBlocks(data);
}
