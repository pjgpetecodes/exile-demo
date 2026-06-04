import type { MapBlock } from '../../world/map.js';
import type { Position, TeleporterDestinationMode, TeleporterSaveData } from '../../types/index.js';

// Teleporter state normalization/reconciliation helpers used by game.ts and designer save flows.

export type TeleporterRuntime = Required<Omit<TeleporterSaveData, 'destinationB'>> & {
    destinationB: Position | null;
    activeDestinationIndex: 0 | 1;
};

export function normalizeTeleporter(data: any): TeleporterRuntime {
    const destinationA = {
        x: Math.round(Number(data?.destinationA?.x) || 0),
        y: Math.round(Number(data?.destinationA?.y) || 0)
    };
    const destinationB = data?.destinationB
        ? {
            x: Math.round(Number(data.destinationB.x) || 0),
            y: Math.round(Number(data.destinationB.y) || 0)
        }
        : null;
    const activeDestinationIndex = data?.activeDestinationIndex === 1 && destinationB ? 1 : 0;
    return {
        id: typeof data?.id === 'string' && data.id.trim().length > 0
            ? data.id.trim()
            : `teleporter_${Math.round(Number(data?.padX) || 0)}_${Math.round(Number(data?.padY) || 0)}`,
        baseX: Math.round(Number(data?.baseX) || 0),
        baseY: Math.round(Number(data?.baseY) || 0),
        padX: Math.round(Number(data?.padX) || 0),
        padY: Math.round(Number(data?.padY) || 0),
        enabled: data?.enabled !== false,
        requiresKey: data?.requiresKey === true,
        destinationA,
        destinationB,
        activeDestinationIndex
    };
}

function toRoundedPosition(value: any, fallback: Position) {
    const x = Math.round(Number(value?.x));
    const y = Math.round(Number(value?.y));
    if (!Number.isFinite(x) || !Number.isFinite(y)) {
        return { x: Math.round(fallback.x), y: Math.round(fallback.y) };
    }
    return { x, y };
}

export function buildTeleportersFromMapMetadata(
    blocks: MapBlock[],
    fallbackDestination: Position
) {
    const grouped = new Map<string, { base?: MapBlock; pad?: MapBlock }>();
    for (const block of blocks) {
        if ((block.type !== 'teleporter' && block.type !== 'teleporter_pad') || !block.teleporterId) {
            continue;
        }
        const id = String(block.teleporterId).trim();
        if (!id) {
            continue;
        }
        const entry = grouped.get(id) ?? {};
        if (block.type === 'teleporter') {
            entry.base = block;
        } else {
            entry.pad = block;
        }
        grouped.set(id, entry);
    }
    const reconstructed: TeleporterRuntime[] = [];
    for (const [id, parts] of grouped.entries()) {
        if (!parts.base || !parts.pad) {
            continue;
        }
        const base = parts.base;
        const pad = parts.pad;
        const destinationA = toRoundedPosition(
            base.teleporterDestinationA ?? pad.teleporterDestinationA,
            fallbackDestination
        );
        const destinationBSource = base.teleporterDestinationB ?? pad.teleporterDestinationB;
        const destinationB = destinationBSource
            ? toRoundedPosition(destinationBSource, destinationA)
            : null;
        const activeDestinationIndex = (base.teleporterActiveDestinationIndex ?? pad.teleporterActiveDestinationIndex) === 1 && destinationB
            ? 1
            : 0;
        reconstructed.push(normalizeTeleporter({
            id,
            baseX: base.x,
            baseY: base.y,
            padX: pad.x,
            padY: pad.y,
            enabled: (base.teleporterEnabled ?? pad.teleporterEnabled) !== false,
            requiresKey: (base.teleporterRequiresKey ?? pad.teleporterRequiresKey) === true,
            destinationA,
            destinationB,
            activeDestinationIndex
        }));
    }
    return reconstructed;
}

function findNearestMapBlockByType(
    blocks: MapBlock[],
    type: 'teleporter' | 'teleporter_pad',
    targetX: number,
    targetY: number,
    maxDistance: number
) {
    const maxDistanceSquared = maxDistance * maxDistance;
    let best: MapBlock | null = null;
    let bestDistanceSquared = Number.POSITIVE_INFINITY;
    for (const block of blocks) {
        if (block.type !== type) {
            continue;
        }
        const dx = targetX - block.x;
        const dy = targetY - block.y;
        const distanceSquared = dx * dx + dy * dy;
        if (distanceSquared <= maxDistanceSquared && distanceSquared < bestDistanceSquared) {
            best = block;
            bestDistanceSquared = distanceSquared;
        }
    }
    return best;
}

function findMapBlockByTeleporterId(
    blocks: MapBlock[],
    type: 'teleporter' | 'teleporter_pad',
    teleporterId: string,
    targetX: number,
    targetY: number
) {
    const candidates = blocks.filter((block) =>
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

export function reconcileTeleporterRuntimePositions(
    teleporters: TeleporterRuntime[],
    blocks: MapBlock[]
) {
    const correctionDistancePx = 32 * 1.5;
    for (const teleporter of teleporters) {
        const baseById = findMapBlockByTeleporterId(blocks, 'teleporter', teleporter.id, teleporter.baseX, teleporter.baseY);
        const padById = findMapBlockByTeleporterId(blocks, 'teleporter_pad', teleporter.id, teleporter.padX, teleporter.padY);
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
        const hasBaseAtPosition = blocks.some((block) =>
            block.type === 'teleporter' &&
            block.x === teleporter.baseX &&
            block.y === teleporter.baseY
        );
        if (!hasBaseAtPosition) {
            const correctedBase = findNearestMapBlockByType(
                blocks,
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

        const hasPadAtPosition = blocks.some((block) =>
            block.type === 'teleporter_pad' &&
            block.x === teleporter.padX &&
            block.y === teleporter.padY
        );
        if (!hasPadAtPosition) {
            const correctedPad = findNearestMapBlockByType(
                blocks,
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
    }
}

function applyButtonTeleporterMode(teleporter: TeleporterRuntime, mode: TeleporterDestinationMode) {
    if (mode === 'enable') {
        teleporter.enabled = true;
        return;
    }
    if (mode === 'disable') {
        teleporter.enabled = false;
        return;
    }
    if (mode === 'toggle_enabled') {
        teleporter.enabled = teleporter.enabled === false;
        return;
    }
    if (mode === 'destination_a') {
        teleporter.activeDestinationIndex = 0;
        return;
    }
    if (mode === 'destination_b') {
        if (teleporter.destinationB) {
            teleporter.activeDestinationIndex = 1;
        }
        return;
    }
    if (teleporter.destinationB) {
        teleporter.activeDestinationIndex = teleporter.activeDestinationIndex === 0 ? 1 : 0;
    } else {
        teleporter.activeDestinationIndex = 0;
    }
}

export function applyButtonTeleporterLinks(
    teleporterEntities: TeleporterRuntime[],
    linkedTeleporters: string[] | undefined,
    teleporterMode: TeleporterDestinationMode | undefined
) {
    if (!Array.isArray(linkedTeleporters) || linkedTeleporters.length === 0) {
        return;
    }
    const mode: TeleporterDestinationMode = teleporterMode ?? 'toggle';
    for (const teleporterId of linkedTeleporters) {
        const teleporter = teleporterEntities.find((entry) => entry.id === teleporterId);
        if (teleporter) {
            applyButtonTeleporterMode(teleporter, mode);
        }
    }
}
