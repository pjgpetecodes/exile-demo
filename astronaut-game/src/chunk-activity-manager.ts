import {
    ChunkActivityBand,
    ChunkActivityRadii,
    ChunkCoordinates,
    Position
} from './types/index.js';

type ChunkActivityViewportInput = {
    camera: Position;
    viewportWidth: number;
    viewportHeight: number;
    zoom?: number;
    now: number;
};

type ChunkActivityManagerConfig = {
    chunkWorldSize: number;
    radiiChunks: ChunkActivityRadii;
    viewportRadiusScale?: ChunkActivityRadii;
    teleportKeepAliveMs?: number;
};

type ChunkActivityManagerConfigUpdate = {
    radiiChunks?: ChunkActivityRadii;
    viewportRadiusScale?: ChunkActivityRadii;
    teleportKeepAliveMs?: number;
};

type ChunkRect = {
    minX: number;
    maxX: number;
    minY: number;
    maxY: number;
};

type ChunkActivityDebugSnapshot = {
    chunkWorldSize: number;
    viewportChunkRect: ChunkRect;
    nearRadiusChunks: number;
    midRadiusChunks: number;
    nearChunkCount: number;
    midChunkCount: number;
    activeTeleportKeepAliveCount: number;
};

function chunkKey(x: number, y: number) {
    return `${x},${y}`;
}

function clampPositiveNumber(value: number, fallback: number) {
    return Number.isFinite(value) && value > 0 ? value : fallback;
}

function distanceFromChunkRect(chunkX: number, chunkY: number, rect: ChunkRect) {
    const dx = chunkX < rect.minX
        ? rect.minX - chunkX
        : (chunkX > rect.maxX ? chunkX - rect.maxX : 0);
    const dy = chunkY < rect.minY
        ? rect.minY - chunkY
        : (chunkY > rect.maxY ? chunkY - rect.maxY : 0);
    return Math.max(dx, dy);
}

export class ChunkActivityManager {
    private readonly chunkWorldSize: number;

    private baseRadii: ChunkActivityRadii;

    private viewportRadiusScale: ChunkActivityRadii;

    private teleportKeepAliveMs: number;

    private lastFrameNow = 0;

    private nearRadiusChunks = 0;

    private midRadiusChunks = 0;

    private viewportChunkRect: ChunkRect = {
        minX: 0,
        maxX: -1,
        minY: 0,
        maxY: -1
    };

    private readonly nearChunks = new Set<string>();

    private readonly midChunks = new Set<string>();

    private readonly teleportKeepAliveExpiries = new Map<string, number>();

    constructor(config: ChunkActivityManagerConfig) {
        const nearRadius = Math.max(0, Math.floor(config.radiiChunks.near));
        const midRadius = Math.max(nearRadius, Math.floor(config.radiiChunks.mid));
        this.chunkWorldSize = clampPositiveNumber(config.chunkWorldSize, 2048);
        this.baseRadii = { near: nearRadius, mid: midRadius };
        this.viewportRadiusScale = {
            near: clampPositiveNumber(config.viewportRadiusScale?.near ?? 1, 1),
            mid: clampPositiveNumber(config.viewportRadiusScale?.mid ?? 1, 1)
        };
        this.teleportKeepAliveMs = Math.max(0, config.teleportKeepAliveMs ?? 0);
    }

    updateConfig(config: ChunkActivityManagerConfigUpdate) {
        if (config.radiiChunks) {
            const nearRadius = Math.max(0, Math.floor(config.radiiChunks.near));
            const midRadius = Math.max(nearRadius, Math.floor(config.radiiChunks.mid));
            this.baseRadii = { near: nearRadius, mid: midRadius };
        }
        if (config.viewportRadiusScale) {
            this.viewportRadiusScale = {
                near: clampPositiveNumber(config.viewportRadiusScale.near, this.viewportRadiusScale.near),
                mid: clampPositiveNumber(config.viewportRadiusScale.mid, this.viewportRadiusScale.mid)
            };
        }
        if (typeof config.teleportKeepAliveMs === 'number') {
            this.teleportKeepAliveMs = Math.max(0, config.teleportKeepAliveMs);
        }
    }

    getConfigSnapshot() {
        return {
            radiiChunks: { ...this.baseRadii },
            viewportRadiusScale: { ...this.viewportRadiusScale },
            teleportKeepAliveMs: this.teleportKeepAliveMs
        };
    }

    worldToChunkCoordinates(position: Position): ChunkCoordinates {
        return {
            x: Math.floor(position.x / this.chunkWorldSize),
            y: Math.floor(position.y / this.chunkWorldSize)
        };
    }

    updateFrame(input: ChunkActivityViewportInput) {
        const zoom = clampPositiveNumber(input.zoom ?? 1, 1);
        const viewportWidthWorld = Math.max(1, input.viewportWidth / zoom);
        const viewportHeightWorld = Math.max(1, input.viewportHeight / zoom);
        const minX = Math.floor(input.camera.x / this.chunkWorldSize);
        const maxX = Math.floor((input.camera.x + viewportWidthWorld - 1) / this.chunkWorldSize);
        const minY = Math.floor(input.camera.y / this.chunkWorldSize);
        const maxY = Math.floor((input.camera.y + viewportHeightWorld - 1) / this.chunkWorldSize);
        const viewportChunkRadius = Math.max(
            0,
            Math.ceil(
                Math.max(viewportWidthWorld, viewportHeightWorld)
                / this.chunkWorldSize
                / 2
            )
        );
        const nearRadiusChunks = this.baseRadii.near + Math.ceil(viewportChunkRadius * this.viewportRadiusScale.near);
        const midRadiusChunks = Math.max(
            nearRadiusChunks,
            this.baseRadii.mid + Math.ceil(viewportChunkRadius * this.viewportRadiusScale.mid)
        );

        this.lastFrameNow = input.now;
        this.viewportChunkRect = { minX, maxX, minY, maxY };
        this.nearRadiusChunks = nearRadiusChunks;
        this.midRadiusChunks = midRadiusChunks;

        this.nearChunks.clear();
        this.midChunks.clear();
        this.pruneTeleportKeepAlive(input.now);

        for (let chunkY = minY - midRadiusChunks; chunkY <= maxY + midRadiusChunks; chunkY++) {
            for (let chunkX = minX - midRadiusChunks; chunkX <= maxX + midRadiusChunks; chunkX++) {
                const distance = distanceFromChunkRect(chunkX, chunkY, this.viewportChunkRect);
                const key = chunkKey(chunkX, chunkY);
                if (distance <= nearRadiusChunks) {
                    this.nearChunks.add(key);
                } else if (distance <= midRadiusChunks) {
                    this.midChunks.add(key);
                }
            }
        }
    }

    markTeleportKeepAlive(
        sourceWorldPosition: Position,
        destinationWorldPosition: Position,
        now: number,
        keepAliveMs: number = this.teleportKeepAliveMs
    ) {
        const expiry = now + Math.max(0, keepAliveMs);
        const sourceChunk = this.worldToChunkCoordinates(sourceWorldPosition);
        const destinationChunk = this.worldToChunkCoordinates(destinationWorldPosition);
        this.setTeleportKeepAliveExpiry(sourceChunk.x, sourceChunk.y, expiry);
        this.setTeleportKeepAliveExpiry(destinationChunk.x, destinationChunk.y, expiry);
    }

    getChunkActivityForWorldPosition(position: Position, now: number = this.lastFrameNow): ChunkActivityBand {
        const chunk = this.worldToChunkCoordinates(position);
        return this.getChunkActivityForChunk(chunk.x, chunk.y, now);
    }

    getChunkActivityForChunk(chunkX: number, chunkY: number, now: number = this.lastFrameNow): ChunkActivityBand {
        const key = chunkKey(chunkX, chunkY);
        const keepAliveExpiry = this.teleportKeepAliveExpiries.get(key);
        if (typeof keepAliveExpiry === 'number' && keepAliveExpiry > now) {
            return 'near';
        }
        if (this.nearChunks.has(key)) {
            return 'near';
        }
        if (this.midChunks.has(key)) {
            return 'mid';
        }
        return 'far';
    }

    getDebugSnapshot(now: number = this.lastFrameNow): ChunkActivityDebugSnapshot {
        this.pruneTeleportKeepAlive(now);
        return {
            chunkWorldSize: this.chunkWorldSize,
            viewportChunkRect: { ...this.viewportChunkRect },
            nearRadiusChunks: this.nearRadiusChunks,
            midRadiusChunks: this.midRadiusChunks,
            nearChunkCount: this.nearChunks.size,
            midChunkCount: this.midChunks.size,
            activeTeleportKeepAliveCount: this.teleportKeepAliveExpiries.size
        };
    }

    private setTeleportKeepAliveExpiry(chunkX: number, chunkY: number, expiry: number) {
        const key = chunkKey(chunkX, chunkY);
        const existing = this.teleportKeepAliveExpiries.get(key);
        if (typeof existing === 'number' && existing >= expiry) {
            return;
        }
        this.teleportKeepAliveExpiries.set(key, expiry);
    }

    private pruneTeleportKeepAlive(now: number) {
        for (const [key, expiry] of this.teleportKeepAliveExpiries.entries()) {
            if (expiry <= now) {
                this.teleportKeepAliveExpiries.delete(key);
            }
        }
    }
}
