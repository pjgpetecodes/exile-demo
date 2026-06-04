type PerformanceSnapshot = {
    sampleCount: number;
    sums: {
        frameTimeSum: number;
        updateTimeSum: number;
        mapDrawTimeSum: number;
        entityDrawTimeSum: number;
        totalFrameTimeSum: number;
    };
    worst: {
        frame: number;
        update: number;
        map: number;
        entities: number;
        total: number;
    };
};

type PerformanceTracker = {
    getHudEnabled: () => boolean;
    formatSummaryLine: (label: string, average: number, worst: number) => string;
    formatFpsFromFrameTime: (frameTime: number) => string;
};

type DebugBlock = {
    type?: string;
    x: number;
    y: number;
    entityId?: string | number;
    palette?: number;
    rotation?: number;
    locked?: boolean;
    palette_locked?: number;
    palette_unlocked?: number;
};

function drawCompactPerformanceHud(options: {
    ctx: CanvasRenderingContext2D;
    performanceTracker: PerformanceTracker;
    performanceSnapshot: PerformanceSnapshot;
}) {
    const { ctx, performanceTracker, performanceSnapshot } = options;
    if (!performanceTracker.getHudEnabled() || performanceSnapshot.sampleCount <= 0) {
        return;
    }
    const sampleCount = Math.max(performanceSnapshot.sampleCount, 1);
    const averageFrameTime = performanceSnapshot.sums.frameTimeSum / sampleCount;
    ctx.save();
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ff0';
    ctx.fillText(`FPS ${performanceTracker.formatFpsFromFrameTime(averageFrameTime)}`, 10, 16);
    ctx.fillText(
        performanceTracker.formatSummaryLine('Frame', averageFrameTime, performanceSnapshot.worst.frame),
        10,
        32
    );
    ctx.restore();
}

function getWorldBoundsForRotatedBoundingBox(options: {
    block: DebugBlock;
    bbox: { minX: number; minY: number; maxX: number; maxY: number };
    spriteScale: number;
}) {
    const { block, bbox, spriteScale } = options;
    const tileW = 32 * spriteScale;
    const tileH = 32 * spriteScale;
    const cx = block.x + tileW / 2;
    const cy = block.y + tileH / 2;
    const rotation = block.rotation || 0;
    let corners = [
        { x: -tileW / 2 + bbox.minX * spriteScale, y: -tileH / 2 + bbox.minY * spriteScale },
        { x: -tileW / 2 + bbox.maxX * spriteScale, y: -tileH / 2 + bbox.minY * spriteScale },
        { x: -tileW / 2 + bbox.maxX * spriteScale, y: -tileH / 2 + bbox.maxY * spriteScale },
        { x: -tileW / 2 + bbox.minX * spriteScale, y: -tileH / 2 + bbox.maxY * spriteScale }
    ];
    corners = corners.map((point) => {
        let { x, y } = point;
        if (rotation >= 1 && rotation <= 4) {
            const angle = ((rotation - 1) * Math.PI) / 2;
            const cos = Math.cos(angle);
            const sin = Math.sin(angle);
            const nextX = x * cos - y * sin;
            const nextY = x * sin + y * cos;
            x = nextX;
            y = nextY;
        } else if (rotation === 5) {
            x = -x;
        } else if (rotation === 6) {
            y = -y;
        } else if (rotation === 7) {
            x = -x;
            y = -y;
        }
        return { x: cx + x, y: cy + y };
    });
    const xs = corners.map((corner) => corner.x);
    const ys = corners.map((corner) => corner.y);
    return {
        minX: Math.round(Math.min(...xs)),
        minY: Math.round(Math.min(...ys)),
        maxX: Math.round(Math.max(...xs)),
        maxY: Math.round(Math.max(...ys))
    };
}

export function drawGameLoopDebugHud(options: {
    ctx: CanvasRenderingContext2D;
    gameState: { debugMode: boolean; astronaut: { position: { x: number; y: number }; isLanded: boolean } };
    controlState: {
        leftPressed: boolean;
        rightPressed: boolean;
        upPressed: boolean;
        downPressed: boolean;
        walkSpeed: number;
        spriteCol: number;
        walkAnimFrame: number;
        walkAnimTimer: number;
        flyHoldTimer: number;
        flyDir: string | null;
        flySwitching: boolean;
        flySwitchStep: number;
    };
    worldState: {
        mapBlocks: unknown[];
        mouseWorld: { x: number; y: number };
        frameNow: number;
        currentAstronautChunkActivity: unknown;
        hideBlackBackgroundBlocks: boolean;
        lastAstronautWindAcceleration: { x: number; y: number; activeEmitterCount: number };
    };
    dependencies: {
        spriteScale: number;
        blockInstanceRotatedBoundingBoxes: Map<unknown, { minX: number; minY: number; maxX: number; maxY: number }>;
        getRenderableMapBlocks: (hideBlackBackgroundBlocks: boolean) => unknown[];
        getAnyBlockAtWorld: (
            x: number,
            y: number,
            scale: number,
            mapBlocks: unknown[],
            doorEntities: unknown[],
            buttonEntities: unknown[],
            creatureEntities: unknown[]
        ) => DebugBlock | null;
        getEffectiveWindToggles: (windSettings: unknown, windDebugToggles: unknown) => {
            windEnabled: boolean;
            emittersEnabled: boolean;
            surfaceWindEnabled: boolean;
            windVfxEnabled: boolean;
        };
        chunkActivityManager: {
            worldToChunkCoordinates: (position: { x: number; y: number }) => { x: number; y: number };
            getDebugSnapshot: (now: number) => { nearRadiusChunks: number; midRadiusChunks: number; activeTeleportKeepAliveCount: number };
        };
        getChunkActivityForEntityPosition: (position: { x: number; y: number }, now: number) => unknown;
        windSettings: unknown;
        windDebugToggles: unknown;
        doorEntities: unknown[];
        buttonEntities: unknown[];
        creatureEntities: unknown[];
        performanceTracker: PerformanceTracker;
        performanceSnapshot: PerformanceSnapshot;
    };
}) {
    const { ctx, gameState, controlState, worldState, dependencies } = options;
    if (!gameState.debugMode) {
        drawCompactPerformanceHud({
            ctx,
            performanceTracker: dependencies.performanceTracker,
            performanceSnapshot: dependencies.performanceSnapshot
        });
        return;
    }

    ctx.save();
    ctx.font = '12px monospace';
    ctx.fillStyle = '#ff0';
    let debugY = 16;
    ctx.fillText(
        `Astronaut position: (${gameState.astronaut.position.x.toFixed(2)}, ${gameState.astronaut.position.y.toFixed(2)})`,
        10,
        debugY
    );
    debugY += 16;
    ctx.fillText(
        `leftPressed: ${controlState.leftPressed} | rightPressed: ${controlState.rightPressed} | upPressed: ${controlState.upPressed} | downPressed: ${controlState.downPressed}`,
        10,
        debugY
    );
    debugY += 16;
    ctx.fillText(
        `isLanded: ${gameState.astronaut.isLanded} | walkSpeed: ${controlState.walkSpeed.toFixed(2)} | spriteCol: ${controlState.spriteCol}`,
        10,
        debugY
    );
    debugY += 16;
    ctx.fillText(
        `walkAnimFrame: ${controlState.walkAnimFrame} | walkAnimTimer: ${controlState.walkAnimTimer.toFixed(2)} | flyHoldTimer: ${controlState.flyHoldTimer.toFixed(2)}`,
        10,
        debugY
    );
    debugY += 16;
    ctx.fillText(
        `flyDir: ${controlState.flyDir} | flySwitching: ${controlState.flySwitching} | flySwitchStep: ${controlState.flySwitchStep}`,
        10,
        debugY
    );
    debugY += 16;

    const astronautChunk = dependencies.chunkActivityManager.worldToChunkCoordinates(gameState.astronaut.position);
    const mouseChunk = dependencies.chunkActivityManager.worldToChunkCoordinates(worldState.mouseWorld);
    const mouseChunkActivity = dependencies.getChunkActivityForEntityPosition(worldState.mouseWorld, worldState.frameNow);
    const chunkActivitySnapshot = dependencies.chunkActivityManager.getDebugSnapshot(worldState.frameNow);
    ctx.fillText(
        `Chunk activity: astronaut=${worldState.currentAstronautChunkActivity} @ (${astronautChunk.x},${astronautChunk.y}) | mouse=${mouseChunkActivity} @ (${mouseChunk.x},${mouseChunk.y})`,
        10,
        debugY
    );
    debugY += 16;
    ctx.fillText(
        `Chunk radii near=${chunkActivitySnapshot.nearRadiusChunks} mid=${chunkActivitySnapshot.midRadiusChunks} keepAlive=${chunkActivitySnapshot.activeTeleportKeepAliveCount}`,
        10,
        debugY
    );
    debugY += 16;

    const windToggleState = dependencies.getEffectiveWindToggles(
        dependencies.windSettings,
        dependencies.windDebugToggles
    );
    ctx.fillText(
        `Wind: enabled=${windToggleState.windEnabled} emitters=${windToggleState.emittersEnabled} surface=${windToggleState.surfaceWindEnabled} vfx=${windToggleState.windVfxEnabled} accel=(${worldState.lastAstronautWindAcceleration.x.toFixed(3)}, ${worldState.lastAstronautWindAcceleration.y.toFixed(3)}) sources=${worldState.lastAstronautWindAcceleration.activeEmitterCount}`,
        10,
        debugY
    );
    debugY += 16;

    const inspectableMapBlocks = worldState.hideBlackBackgroundBlocks
        ? dependencies.getRenderableMapBlocks(true)
        : worldState.mapBlocks;
    const block = dependencies.getAnyBlockAtWorld(
        worldState.mouseWorld.x,
        worldState.mouseWorld.y,
        dependencies.spriteScale,
        inspectableMapBlocks,
        dependencies.doorEntities,
        dependencies.buttonEntities,
        dependencies.creatureEntities
    );
    if (block) {
        ctx.fillText(
            `Block under cursor: ${block.type} (${block.x},${block.y}) id: ${block.entityId ?? 'n/a'} palette: ${block.palette ?? 0} rotation: ${block.rotation ?? 0}`
            + (typeof block.locked !== 'undefined' ? ` locked: ${block.locked}` : ''),
            10,
            debugY
        );
        if (block.type && block.type.startsWith('door')) {
            ctx.fillText(
                `palette_locked: ${block.palette_locked} palette_unlocked: ${block.palette_unlocked}`,
                10,
                debugY + 16
            );
            debugY += 16;
        }
        const bbox = dependencies.blockInstanceRotatedBoundingBoxes.get(block);
        if (bbox) {
            const worldBounds = getWorldBoundsForRotatedBoundingBox({
                block,
                bbox,
                spriteScale: dependencies.spriteScale
            });
            ctx.fillText(
                `Tight bbox: worldMin=(${worldBounds.minX},${worldBounds.minY}) worldMax=(${worldBounds.maxX},${worldBounds.maxY})`,
                10,
                debugY + 16
            );
            debugY += 16;
        }
    } else {
        ctx.fillText('Block under cursor: (none)', 10, debugY);
    }
    debugY += 16;
    ctx.fillText(
        `Mouse world: (${worldState.mouseWorld.x.toFixed(1)}, ${worldState.mouseWorld.y.toFixed(1)})`,
        10,
        debugY
    );

    if (dependencies.performanceTracker.getHudEnabled() && dependencies.performanceSnapshot.sampleCount > 0) {
        const sampleCount = Math.max(dependencies.performanceSnapshot.sampleCount, 1);
        debugY += 16;
        ctx.fillText(
            dependencies.performanceTracker.formatSummaryLine(
                'Frame',
                dependencies.performanceSnapshot.sums.frameTimeSum / sampleCount,
                dependencies.performanceSnapshot.worst.frame
            ),
            10,
            debugY
        );
        debugY += 16;
        ctx.fillText(
            dependencies.performanceTracker.formatSummaryLine(
                'Update',
                dependencies.performanceSnapshot.sums.updateTimeSum / sampleCount,
                dependencies.performanceSnapshot.worst.update
            ),
            10,
            debugY
        );
        debugY += 16;
        ctx.fillText(
            dependencies.performanceTracker.formatSummaryLine(
                'Map',
                dependencies.performanceSnapshot.sums.mapDrawTimeSum / sampleCount,
                dependencies.performanceSnapshot.worst.map
            ),
            10,
            debugY
        );
        debugY += 16;
        ctx.fillText(
            dependencies.performanceTracker.formatSummaryLine(
                'Entities',
                dependencies.performanceSnapshot.sums.entityDrawTimeSum / sampleCount,
                dependencies.performanceSnapshot.worst.entities
            ),
            10,
            debugY
        );
        debugY += 16;
        ctx.fillText(
            dependencies.performanceTracker.formatSummaryLine(
                'Total',
                dependencies.performanceSnapshot.sums.totalFrameTimeSum / sampleCount,
                dependencies.performanceSnapshot.worst.total
            ),
            10,
            debugY
        );
    }
    ctx.restore();
}
