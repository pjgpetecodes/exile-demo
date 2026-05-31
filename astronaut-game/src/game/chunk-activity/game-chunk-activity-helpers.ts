import type { Position, ChunkActivityBand } from '../../types/index.js';

export function createChunkActivityHelpers(options: {
    getChunkActivityForWorldPosition: (position: Position, now: number) => ChunkActivityBand;
}) {
    function getChunkActivityForEntityPosition(entity: Pick<Position, 'x' | 'y'>, now: number): ChunkActivityBand {
        return options.getChunkActivityForWorldPosition({ x: entity.x, y: entity.y }, now);
    }

    function shouldRunChunkBandUpdate(
        chunkActivity: ChunkActivityBand,
        cadencePolicy: Record<ChunkActivityBand, number>,
        frameCounter: number
    ) {
        const cadenceFrames = Math.max(0, Math.floor(cadencePolicy[chunkActivity]));
        if (cadenceFrames <= 0) {
            return false;
        }
        if (cadenceFrames <= 1) {
            return true;
        }
        return frameCounter % cadenceFrames === 0;
    }

    return {
        getChunkActivityForEntityPosition,
        shouldRunChunkBandUpdate
    };
}
