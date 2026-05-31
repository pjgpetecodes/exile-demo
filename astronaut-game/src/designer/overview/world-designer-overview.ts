import type { DesignerCategory } from '../core/world-designer-types.js';

type Rect = { left: number; top: number; width: number; height: number };

export function redrawOverviewBase(options: {
    overviewBaseCanvas: HTMLCanvasElement;
    overviewCanvas: HTMLCanvasElement;
    mapWidth: number;
    mapHeight: number;
    layerVisibility: Record<DesignerCategory, boolean>;
    getCategoryArray: (category: DesignerCategory) => any[];
    getChunkedWorldOverview: () => any;
    overviewWorldTiles: any[] | null;
    tileSize: number;
    getEntityRect: (entity: any, category: DesignerCategory) => Rect;
    getAstronautStartPosition: () => { x: number; y: number };
}) {
    const {
        overviewBaseCanvas,
        overviewCanvas,
        mapWidth,
        mapHeight,
        layerVisibility,
        getCategoryArray,
        getChunkedWorldOverview,
        overviewWorldTiles,
        tileSize,
        getEntityRect,
        getAstronautStartPosition
    } = options;
    if (
        overviewBaseCanvas.width !== overviewCanvas.width ||
        overviewBaseCanvas.height !== overviewCanvas.height
    ) {
        overviewBaseCanvas.width = overviewCanvas.width;
        overviewBaseCanvas.height = overviewCanvas.height;
    }
    const ctx = overviewBaseCanvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, overviewBaseCanvas.width, overviewBaseCanvas.height);
    ctx.fillStyle = '#020617';
    ctx.fillRect(0, 0, overviewBaseCanvas.width, overviewBaseCanvas.height);

    const scaleX = overviewBaseCanvas.width / mapWidth;
    const scaleY = overviewBaseCanvas.height / mapHeight;
    const colors: Record<DesignerCategory, string> = {
        world: '#38bdf8',
        buttons: '#f59e0b',
        doors: '#ef4444',
        creatures: '#22c55e',
        collectables: '#a855f7',
        custom: '#facc15'
    };
    const chunkedOverview = getChunkedWorldOverview();

    for (const [category, visible] of Object.entries(layerVisibility) as Array<[DesignerCategory, boolean]>) {
        if (!visible) continue;
        const entities = getCategoryArray(category);
        ctx.fillStyle = colors[category];
        if (category === 'world') {
            const worldTiles = chunkedOverview && overviewWorldTiles
                ? overviewWorldTiles
                : entities;
            for (const tile of worldTiles) {
                ctx.fillRect(
                    Number(tile.x) * scaleX,
                    Number(tile.y) * scaleY,
                    Math.max(2, tileSize * scaleX),
                    Math.max(2, tileSize * scaleY)
                );
            }
            continue;
        }
        for (const entity of entities) {
            const rect = getEntityRect(entity, category);
            ctx.fillRect(
                rect.left * scaleX,
                rect.top * scaleY,
                Math.max(2, rect.width * scaleX),
                Math.max(2, rect.height * scaleY)
            );
        }
    }

    const astronautStart = getAstronautStartPosition();
    ctx.fillStyle = '#f97316';
    ctx.beginPath();
    ctx.arc(astronautStart.x * scaleX, astronautStart.y * scaleY, 4, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fed7aa';
    ctx.lineWidth = 1.5;
    ctx.strokeRect(
        astronautStart.x * scaleX - 5,
        astronautStart.y * scaleY - 5,
        10,
        10
    );
}

export function drawOverview(options: {
    overviewCanvas: HTMLCanvasElement;
    overviewBaseCanvas: HTMLCanvasElement;
    state: any;
    hostCanvas: HTMLCanvasElement;
    mapWidth: number;
    mapHeight: number;
    ensureOverviewWorldTilesLoaded: () => void;
    redrawOverviewBase: () => void;
    getSelectionVisuals: (selections: any[]) => Array<{ isPrimary: boolean; rect: Rect }>;
    getSelectedItems: () => any[];
}) {
    const {
        overviewCanvas,
        overviewBaseCanvas,
        state,
        hostCanvas,
        mapWidth,
        mapHeight,
        ensureOverviewWorldTilesLoaded,
        redrawOverviewBase,
        getSelectionVisuals,
        getSelectedItems
    } = options;
    const ctx = overviewCanvas.getContext('2d');
    if (!ctx) return;
    ensureOverviewWorldTilesLoaded();
    redrawOverviewBase();

    ctx.clearRect(0, 0, overviewCanvas.width, overviewCanvas.height);
    ctx.drawImage(overviewBaseCanvas, 0, 0);
    const scaleX = overviewCanvas.width / mapWidth;
    const scaleY = overviewCanvas.height / mapHeight;

    for (const visual of getSelectionVisuals(getSelectedItems())) {
        ctx.strokeStyle = visual.isPrimary ? '#ffffff' : '#93c5fd';
        ctx.lineWidth = visual.isPrimary ? 2 : 1.5;
        ctx.strokeRect(
            visual.rect.left * scaleX,
            visual.rect.top * scaleY,
            Math.max(3, visual.rect.width * scaleX),
            Math.max(3, visual.rect.height * scaleY)
        );
    }

    const currentCameraRect = {
        left: state.camera.x * scaleX,
        top: state.camera.y * scaleY,
        width: hostCanvas.width * scaleX,
        height: hostCanvas.height * scaleY
    };
    ctx.strokeStyle = '#22d3ee';
    ctx.lineWidth = 2;
    ctx.strokeRect(
        currentCameraRect.left,
        currentCameraRect.top,
        currentCameraRect.width,
        currentCameraRect.height
    );

    if (state.overviewHoverWorld) {
        ctx.strokeStyle = '#f8fafc';
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(
            (state.overviewHoverWorld.x - hostCanvas.width / 2) * scaleX,
            (state.overviewHoverWorld.y - hostCanvas.height / 2) * scaleY,
            hostCanvas.width * scaleX,
            hostCanvas.height * scaleY
        );
        ctx.setLineDash([]);
    }
}

export function drawObjectSnapGuide(ctx: CanvasRenderingContext2D, guide: any, camera: { x: number; y: number }) {
    ctx.save();
    ctx.strokeStyle = '#22d3ee';
    ctx.fillStyle = guide.mode === 'align'
        ? 'rgba(167, 139, 250, 0.12)'
        : 'rgba(34, 211, 238, 0.12)';
    ctx.strokeStyle = guide.mode === 'align'
        ? '#a78bfa'
        : '#22d3ee';
    ctx.lineWidth = 2;
    ctx.setLineDash(guide.mode === 'align' ? [2, 4] : [6, 4]);
    ctx.strokeRect(
        guide.targetRect.left - camera.x,
        guide.targetRect.top - camera.y,
        guide.targetRect.width,
        guide.targetRect.height
    );
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(
        guide.line.start.x - camera.x,
        guide.line.start.y - camera.y
    );
    ctx.lineTo(
        guide.line.end.x - camera.x,
        guide.line.end.y - camera.y
    );
    ctx.stroke();
    ctx.restore();
}
