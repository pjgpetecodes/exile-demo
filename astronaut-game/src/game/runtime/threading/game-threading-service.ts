import { THREADING_SETTINGS } from '../../../config/settings.js';
import {
    preprocessThreadedChunkPayload,
    type
    ThreadedCreatureAnimationInput,
    ThreadedFireInput,
    ThreadedFireOutput,
    ThreadedWaspSwarmInput,
    ThreadedWaspSwarmOutput
} from './game-threading-helpers.js';

type FireResultMessage = {
    type: 'fire-frame-result';
    frameNow: number;
    entries: ThreadedFireOutput[];
};

type CreatureAnimationResultMessage = {
    type: 'creature-animation-frame-result';
    frameNow: number;
    entries: Array<{ key: string; spriteType: string }>;
};

type WaspSwarmResultMessage = {
    type: 'wasp-swarm-frame-result';
    frameNow: number;
    entries: ThreadedWaspSwarmOutput[];
};

type ChunkNormalizeResultMessage = {
    type: 'chunk-normalize-result';
    requestId: number;
    entries: unknown[];
};

type WorkerResultMessage =
    | FireResultMessage
    | CreatureAnimationResultMessage
    | WaspSwarmResultMessage
    | ChunkNormalizeResultMessage;

type FireEntryWithFrame = ThreadedFireOutput & { frameNow: number };
type CreatureAnimationEntryWithFrame = { spriteType: string; frameNow: number };
type WaspSwarmEntryWithFrame = ThreadedWaspSwarmOutput & { frameNow: number };

function canUseThreading() {
    return THREADING_SETTINGS.enabled
        && typeof window !== 'undefined'
        && typeof Worker !== 'undefined';
}

class GameThreadingService {
    private worker: Worker | null = null;

    private failed = false;

    private lastRequestedFireFrame = -1;

    private lastRequestedAnimationFrame = -1;

    private lastRequestedWaspFrame = -1;

    private readonly fireByKey = new Map<string, FireEntryWithFrame>();

    private readonly creatureAnimationByKey = new Map<string, CreatureAnimationEntryWithFrame>();

    private readonly waspSwarmByKey = new Map<string, WaspSwarmEntryWithFrame>();

    private chunkRequestId = 0;

    private readonly pendingChunkNormalizations = new Map<number, {
        resolve: (value: unknown[]) => void;
        reject: (reason?: unknown) => void;
    }>();

    isEnabled() {
        return canUseThreading() && !this.failed;
    }

    private ensureWorker() {
        if (!this.isEnabled()) {
            return null;
        }
        if (this.worker) {
            return this.worker;
        }
        try {
            this.worker = new Worker(
                new URL('./game-threading-worker.js', import.meta.url),
                { type: 'module' }
            );
            this.worker.addEventListener('message', (event: MessageEvent<WorkerResultMessage>) => {
                this.handleWorkerResult(event.data);
            });
            this.worker.addEventListener('error', () => {
                this.failed = true;
                for (const pending of this.pendingChunkNormalizations.values()) {
                    pending.reject(new Error('Threading worker failed while normalizing chunk payload.'));
                }
                this.pendingChunkNormalizations.clear();
            });
        } catch {
            this.failed = true;
            return null;
        }
        return this.worker;
    }

    private handleWorkerResult(message: WorkerResultMessage) {
        if (!message || typeof message !== 'object') {
            return;
        }
        if (message.type === 'fire-frame-result') {
            for (const entry of message.entries) {
                this.fireByKey.set(entry.key, { ...entry, frameNow: message.frameNow });
            }
            return;
        }
        if (message.type === 'creature-animation-frame-result') {
            for (const entry of message.entries) {
                this.creatureAnimationByKey.set(entry.key, {
                    spriteType: entry.spriteType,
                    frameNow: message.frameNow
                });
            }
            return;
        }
        if (message.type === 'wasp-swarm-frame-result') {
            for (const entry of message.entries) {
                this.waspSwarmByKey.set(entry.key, { ...entry, frameNow: message.frameNow });
            }
            return;
        }
        if (message.type === 'chunk-normalize-result') {
            const pending = this.pendingChunkNormalizations.get(message.requestId);
            if (!pending) {
                return;
            }
            this.pendingChunkNormalizations.delete(message.requestId);
            pending.resolve(Array.isArray(message.entries) ? message.entries : []);
        }
    }

    queueFireFrame(frameNow: number, entries: ThreadedFireInput[]) {
        if (!this.isEnabled() || entries.length === 0) {
            return;
        }
        if (frameNow <= this.lastRequestedFireFrame) {
            return;
        }
        this.lastRequestedFireFrame = frameNow;
        this.ensureWorker()?.postMessage({
            type: 'fire-frame',
            frameNow,
            entries
        });
    }

    getFireEntry(key: string): FireEntryWithFrame | null {
        const result = this.fireByKey.get(key);
        return result ?? null;
    }

    queueCreatureAnimationFrame(frameNow: number, entries: ThreadedCreatureAnimationInput[]) {
        if (!this.isEnabled() || entries.length === 0) {
            return;
        }
        if (frameNow <= this.lastRequestedAnimationFrame) {
            return;
        }
        this.lastRequestedAnimationFrame = frameNow;
        this.ensureWorker()?.postMessage({
            type: 'creature-animation-frame',
            frameNow,
            entries
        });
    }

    getCreatureAnimation(key: string): CreatureAnimationEntryWithFrame | null {
        const result = this.creatureAnimationByKey.get(key);
        return result ?? null;
    }

    queueWaspSwarmFrame(frameNow: number, entries: ThreadedWaspSwarmInput[]) {
        if (!this.isEnabled() || entries.length === 0) {
            return;
        }
        if (frameNow <= this.lastRequestedWaspFrame) {
            return;
        }
        this.lastRequestedWaspFrame = frameNow;
        this.ensureWorker()?.postMessage({
            type: 'wasp-swarm-frame',
            frameNow,
            entries
        });
    }

    getWaspSwarm(key: string): WaspSwarmEntryWithFrame | null {
        const result = this.waspSwarmByKey.get(key);
        return result ?? null;
    }

    async normalizeChunkPayload(entries: unknown[]) {
        if (!Array.isArray(entries) || entries.length === 0) {
            return [];
        }
        const worker = this.ensureWorker();
        if (!worker) {
            return preprocessThreadedChunkPayload(entries);
        }
        const requestId = ++this.chunkRequestId;
        return new Promise<unknown[]>((resolve, reject) => {
            this.pendingChunkNormalizations.set(requestId, { resolve, reject });
            worker.postMessage({
                type: 'chunk-normalize',
                requestId,
                entries
            });
        });
    }
}

const threadingService = new GameThreadingService();

export function getGameThreadingService() {
    return threadingService;
}
