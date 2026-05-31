import { Position } from '../../types/index.js';

type ViewportDesigner = {
    isActive: () => boolean;
    isViewportExpanded: () => boolean;
    getCamera: () => Position;
};

type EffectiveViewportSettings = {
    minZoom: number;
    maxZoom: number;
    defaultZoom: number;
    expandedViewZoom: number;
};

type ChunkResidencySettings = {
    viewportChunkRadiusBaseline: number;
    expandedViewExtraRadiusChunks: number;
    maxPrefetchRadiusChunks: number;
    basePrefetchRadiusChunks: number;
    viewportExpansionRadiusScale: number;
};

export type EffectiveViewportState = {
    width: number;
    height: number;
    zoom: number;
    prefetchRadiusChunks: number;
};

export function createGameMainCameraViewportHelpers(context: {
    getWorldDesigner: () => ViewportDesigner | null;
    getAstronautPosition: () => Position;
    getCanvasSize: () => { width: number; height: number };
    chunkWorldSize: number;
    effectiveViewport: EffectiveViewportSettings;
    chunkResidency: ChunkResidencySettings;
}) {
    function clampViewportZoom(value: number) {
        return Math.min(context.effectiveViewport.maxZoom, Math.max(context.effectiveViewport.minZoom, value));
    }

    function getCameraOffset() {
        const designer = context.getWorldDesigner();
        if (designer?.isActive()) {
            return designer.getCamera();
        }

        const { width, height } = context.getCanvasSize();
        const astronautPosition = context.getAstronautPosition();
        return {
            x: astronautPosition.x - width / 2,
            y: astronautPosition.y - height / 2
        };
    }

    function getEffectiveViewportState(): EffectiveViewportState {
        const { width: rawWidth, height: rawHeight } = context.getCanvasSize();
        const width = Math.max(1, rawWidth);
        const height = Math.max(1, rawHeight);
        const designer = context.getWorldDesigner();
        const expandedViewActive = designer?.isActive() === true && designer.isViewportExpanded();
        const configuredZoom = expandedViewActive
            ? context.effectiveViewport.expandedViewZoom
            : context.effectiveViewport.defaultZoom;
        const zoom = clampViewportZoom(configuredZoom);
        const viewportWidthWorld = Math.max(1, width / zoom);
        const viewportHeightWorld = Math.max(1, height / zoom);
        const viewportChunkRadius = Math.max(
            0,
            Math.ceil(Math.max(viewportWidthWorld, viewportHeightWorld) / context.chunkWorldSize / 2)
        );
        const viewportExpansionChunks = Math.max(
            0,
            viewportChunkRadius - context.chunkResidency.viewportChunkRadiusBaseline
        );
        const expandedViewExtraChunks = expandedViewActive
            ? context.chunkResidency.expandedViewExtraRadiusChunks
            : 0;
        const prefetchRadiusChunks = Math.min(
            context.chunkResidency.maxPrefetchRadiusChunks,
            Math.max(
                0,
                context.chunkResidency.basePrefetchRadiusChunks
                + Math.ceil(viewportExpansionChunks * context.chunkResidency.viewportExpansionRadiusScale)
                + expandedViewExtraChunks
            )
        );

        return { width, height, zoom, prefetchRadiusChunks };
    }

    return {
        getCameraOffset,
        getEffectiveViewportState
    };
}
