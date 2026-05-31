import {
    applyDesignerOverlayZoomCompensation as applyOverlayZoomCompensation,
    attachDraggableSurface
} from '../overlay/world-designer-overlay.js';

import type { WorldDesignerHost } from '../core/world-designer-types.js';

type OverviewWorldTile = { x: number; y: number };

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

    function ensureOverviewWorldTilesLoaded() {
        if (overviewWorldTiles || overviewWorldTilesLoading || !getChunkedWorldOverview()) {
            return;
        }
        overviewWorldTilesLoading = true;
        const snapshotPromise = host.getRawWorldDataForSave
            ? host.getRawWorldDataForSave()
            : Promise.resolve(host.getRawWorldData());
        void snapshotPromise
            .then((data) => {
                overviewWorldTiles = data.worldMap.map((block) => ({
                    x: Number(block.x),
                    y: Number(block.y)
                }));
                invalidateOverviewBase();
            })
            .catch(() => {
                // Keep the overview usable with currently loaded world data if full snapshot fails.
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
