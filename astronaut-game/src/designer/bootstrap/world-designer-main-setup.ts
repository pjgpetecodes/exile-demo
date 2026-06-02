import {
    applyDesignerOverlayZoomCompensation as applyOverlayZoomCompensation,
    attachDraggableSurface
} from '../overlay/world-designer-overlay.js';

import type { WorldDesignerHost } from '../core/world-designer-types.js';

type OverviewWorldTile = { x: number; y: number };
type ChunkedOverviewLike = {
    chunks?: Array<{ count?: number }>;
};

type CreateOverviewWorldTileLoaderContext = {
    host: Pick<WorldDesignerHost, 'getRawWorldData' | 'getRawWorldDataForSave'>;
    getChunkedWorldOverview: () => unknown;
    invalidateOverviewBase: () => void;
};

type InitializeDesignerOverlayDragContext = {
    root: HTMLElement;
    paletteFlyout: HTMLElement;
    panelDragHandle: HTMLElement;
    paletteFlyoutDragHandle: HTMLElement;
    initialDevicePixelRatio: number;
};

export function createOverviewWorldTileLoader({
    host,
    getChunkedWorldOverview,
    invalidateOverviewBase
}: CreateOverviewWorldTileLoaderContext) {
    let overviewWorldTiles: OverviewWorldTile[] | null = null;
    let overviewWorldTilesLoading = false;
    let nextOverviewWorldTilesRetryAtMs = 0;

    function getExpectedWorldTileCount(chunkedOverview: unknown): number | null {
        if (!chunkedOverview || !Array.isArray((chunkedOverview as ChunkedOverviewLike).chunks)) {
            return null;
        }
        let expectedCount = 0;
        for (const chunk of (chunkedOverview as ChunkedOverviewLike).chunks ?? []) {
            const count = Number(chunk?.count);
            if (!Number.isFinite(count) || count < 0) {
                return null;
            }
            expectedCount += Math.floor(count);
        }
        return expectedCount;
    }

    function ensureOverviewWorldTilesLoaded() {
        const chunkedOverview = getChunkedWorldOverview();
        if (!chunkedOverview || overviewWorldTilesLoading) {
            return;
        }
        const expectedWorldTileCount = getExpectedWorldTileCount(chunkedOverview);
        if (
            overviewWorldTiles &&
            overviewWorldTiles.length > 0 &&
            (
                expectedWorldTileCount === null ||
                overviewWorldTiles.length >= expectedWorldTileCount
            )
        ) {
            return;
        }
        if (Date.now() < nextOverviewWorldTilesRetryAtMs) {
            return;
        }
        overviewWorldTilesLoading = true;
        const snapshotPromise = host.getRawWorldDataForSave
            ? host.getRawWorldDataForSave()
            : Promise.resolve(host.getRawWorldData());
        void snapshotPromise
            .then((data) => {
                const worldTiles = data.worldMap.map((block) => ({
                    x: Number(block.x),
                    y: Number(block.y)
                }));
                if (worldTiles.length === 0) {
                    // In chunked mode, avoid caching an empty snapshot during early init.
                    // Keep retrying until the full materialized world map is available.
                    nextOverviewWorldTilesRetryAtMs = Date.now() + 1000;
                    return;
                }
                if (!overviewWorldTiles || worldTiles.length !== overviewWorldTiles.length) {
                    overviewWorldTiles = worldTiles;
                    invalidateOverviewBase();
                } else {
                    overviewWorldTiles = worldTiles;
                }
                if (
                    expectedWorldTileCount !== null &&
                    worldTiles.length < expectedWorldTileCount
                ) {
                    // Snapshot is still partial; keep refreshing so overview fills in progressively.
                    nextOverviewWorldTilesRetryAtMs = Date.now() + 500;
                }
            })
            .catch(() => {
                // Keep the overview usable with currently loaded world data if full snapshot fails.
                nextOverviewWorldTilesRetryAtMs = Date.now() + 1000;
            })
            .finally(() => {
                overviewWorldTilesLoading = false;
            });
    }

    return {
        ensureOverviewWorldTilesLoaded,
        getOverviewWorldTiles: () => overviewWorldTiles
    };
}

export function initializeDesignerOverlayDrag({
    root,
    paletteFlyout,
    panelDragHandle,
    paletteFlyoutDragHandle,
    initialDevicePixelRatio
}: InitializeDesignerOverlayDragContext) {
    const applyDesignerOverlayZoomCompensation = () => {
        applyOverlayZoomCompensation(root, paletteFlyout, initialDevicePixelRatio);
    };

    attachDraggableSurface(root, panelDragHandle);
    attachDraggableSurface(paletteFlyout, paletteFlyoutDragHandle);
    applyDesignerOverlayZoomCompensation();

    return {
        applyDesignerOverlayZoomCompensation
    };
}
