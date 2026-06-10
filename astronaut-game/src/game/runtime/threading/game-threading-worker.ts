import {
    ThreadedCreatureAnimationInput,
    ThreadedFireInput,
    ThreadedWaspSwarmInput,
    preprocessThreadedChunkPayload,
    resolveThreadedCreatureAnimations,
    resolveThreadedFireFrame,
    resolveThreadedWaspSwarmTurns
} from './game-threading-helpers.js';

type RequestMessage =
    | { type: 'fire-frame'; frameNow: number; entries: ThreadedFireInput[] }
    | { type: 'creature-animation-frame'; frameNow: number; entries: ThreadedCreatureAnimationInput[] }
    | { type: 'wasp-swarm-frame'; frameNow: number; entries: ThreadedWaspSwarmInput[] }
    | { type: 'chunk-normalize'; requestId: number; entries: unknown[] };

self.addEventListener('message', (event: MessageEvent<RequestMessage>) => {
    const payload = event.data;
    if (!payload || typeof payload !== 'object') {
        return;
    }

    if (payload.type === 'fire-frame') {
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        self.postMessage({
            type: 'fire-frame-result',
            frameNow: payload.frameNow,
            entries: resolveThreadedFireFrame(entries)
        });
        return;
    }

    if (payload.type === 'creature-animation-frame') {
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        self.postMessage({
            type: 'creature-animation-frame-result',
            frameNow: payload.frameNow,
            entries: resolveThreadedCreatureAnimations(entries)
        });
        return;
    }

    if (payload.type === 'wasp-swarm-frame') {
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        self.postMessage({
            type: 'wasp-swarm-frame-result',
            frameNow: payload.frameNow,
            entries: resolveThreadedWaspSwarmTurns(entries)
        });
        return;
    }

    if (payload.type === 'chunk-normalize') {
        const entries = Array.isArray(payload.entries) ? payload.entries : [];
        self.postMessage({
            type: 'chunk-normalize-result',
            requestId: payload.requestId,
            entries: preprocessThreadedChunkPayload(entries)
        });
    }
});
