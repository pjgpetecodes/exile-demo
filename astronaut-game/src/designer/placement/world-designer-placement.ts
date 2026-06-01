import type {
    CustomSpriteDefinition,
    DesignerCategory,
    DesignerSnapshot,
    DesignerState,
    ObjectSnapGuide,
    ObjectSnapMatch,
    ObjectSnapMode,
    ObjectSnapResolution,
    Rect,
    Selection
} from '../core/world-designer-types.js';
import type { Position } from '../../types/index.js';
import { shouldTreatTypePaletteAsWater } from '../../world/water-blocks.js';
import { getGuideSpan, getRangeGap, snapCoordinateToOffset } from '../core/world-designer-helpers.js';

const OBJECT_SNAP_THRESHOLD = 20;
const OBJECT_SNAP_ALIGNMENT_THRESHOLD = 24;

type StatusTone = 'neutral' | 'success' | 'error';

type WorldDesignerPlacementDeps = {
    state: DesignerState;
    historyLimit: number;
    host: {
        canvas: HTMLCanvasElement;
        clampCamera: (camera: Position) => Position;
        afterWorldDataMutated: () => void;
    };
    getCurrentType: () => string;
    getCategoryArray: (category: DesignerCategory) => any[];
    getRectAtPosition: (x: number, y: number, category: DesignerCategory) => Rect;
    getEntityRect: (entity: any, category: DesignerCategory) => Rect;
    getHitCandidates: () => Array<{ category: DesignerCategory; entity: any }>;
    getSnapshot: () => DesignerSnapshot;
    expandSelectionsWithLinkedTeleporters: (selections: Selection[]) => Selection[];
    applyEntityPositionWithTeleporterSync: (entity: any, x: number, y: number) => void;
    screenToWorld: (x: number, y: number) => Position;
    refreshPanel: () => void;
    updateDirtyState: () => void;
    setStatus: (status: string, tone?: StatusTone) => void;
    snapshotsEqual: (left: DesignerSnapshot, right: DesignerSnapshot) => boolean;
    isTeleporterCompositeType: (type: string) => boolean;
    isButtonCompositeType: (type: string) => boolean;
    createTeleporterCompositeAt: (x: number, y: number) => any;
    createButtonEntity: (config: {
        x: number;
        y: number;
        rotation: number;
        collision: boolean;
        active: boolean;
        linkedDoors: number[];
    }) => any;
    getCustomSpriteDefinitionById: (id: string | null | undefined) => CustomSpriteDefinition | null;
    createCustomSpriteInstance: (definition: CustomSpriteDefinition, x: number, y: number) => any;
    createDoorEntity: (config: {
        x: number;
        y: number;
        palette: number;
        rotation: number;
        translation: any;
        collision: boolean;
    }) => any;
    createCreatureEntity: (config: {
        x: number;
        y: number;
        type: string;
        palette: number;
        rotation: number;
        translation: any;
    }) => any;
    createCollectableEntity: (config: {
        x: number;
        y: number;
        type: string;
        palette: number;
        rotation: number;
        weight: number;
        paletteCycle: any;
    }) => any;
    getDefaultCollectableWeight: (type: string) => number;
    getDefaultCollectablePaletteCycle: (type: string, palette: number, paletteCount: number) => any;
    getPaletteCount: () => number;
    playMushroomPlacementSound: (type: string) => void;
    setSelections: (selections: Selection[], primary?: Selection | null) => void;
};

export function createWorldDesignerPlacement(deps: WorldDesignerPlacementDeps) {
    const {
        state,
        historyLimit,
        host,
        getCurrentType,
        getCategoryArray,
        getRectAtPosition,
        getEntityRect,
        getHitCandidates,
        getSnapshot,
        expandSelectionsWithLinkedTeleporters,
        applyEntityPositionWithTeleporterSync,
        screenToWorld,
        refreshPanel,
        updateDirtyState,
        setStatus,
        snapshotsEqual,
        isTeleporterCompositeType,
        isButtonCompositeType,
        createTeleporterCompositeAt,
        createButtonEntity,
        getCustomSpriteDefinitionById,
        createCustomSpriteInstance,
        createDoorEntity,
        createCreatureEntity,
        createCollectableEntity,
        getDefaultCollectableWeight,
        getDefaultCollectablePaletteCycle,
        getPaletteCount,
        playMushroomPlacementSound,
        setSelections
    } = deps;

    function buildObjectSnapGuide(
        axis: 'x' | 'y',
        mode: 'dock' | 'align',
        movingRect: Rect,
        targetRect: Rect,
        targetEdge: 'left' | 'right' | 'top' | 'bottom'
    ): ObjectSnapGuide {
        if (axis === 'x') {
            const span = getGuideSpan(movingRect.top, movingRect.bottom, targetRect.top, targetRect.bottom);
            const x = targetEdge === 'left' ? targetRect.left : targetRect.right;
            return {
                axis,
                mode,
                targetRect,
                line: {
                    start: { x, y: span.start },
                    end: { x, y: span.end }
                }
            };
        }

        const span = getGuideSpan(movingRect.left, movingRect.right, targetRect.left, targetRect.right);
        const y = targetEdge === 'top' ? targetRect.top : targetRect.bottom;
        return {
            axis,
            mode,
            targetRect,
            line: {
                start: { x: span.start, y },
                end: { x: span.end, y }
            }
        };
    }

    function getObjectSnapMode(ctrlKey: boolean, altKey: boolean): ObjectSnapMode {
        if (ctrlKey && altKey) {
            return 'both';
        }
        if (ctrlKey) {
            return 'dock';
        }
        if (altKey) {
            return 'align';
        }
        return state.objectSnapEnabled ? 'dock' : 'none';
    }

    function isObjectSnapModeEnabled(mode: ObjectSnapMode, type: 'dock' | 'align') {
        return mode === 'both' || mode === type;
    }

    function findObjectSnapMatch(
        movingRect: Rect,
        snapMode: ObjectSnapMode,
        excludedEntities: Set<any> = new Set<any>()
    ): ObjectSnapResolution {
        if (snapMode === 'none') {
            return {
                x: null,
                y: null,
                guides: []
            };
        }

        let bestXMatch: ObjectSnapMatch | null = null;
        let bestYMatch: ObjectSnapMatch | null = null;
        const movingCenterX = movingRect.left + movingRect.width / 2;
        const movingCenterY = movingRect.top + movingRect.height / 2;

        function shouldReplaceSnapMatch(current: ObjectSnapMatch | null, next: ObjectSnapMatch) {
            return !current ||
                next.distance < current.distance ||
                (next.distance === current.distance && next.alignmentGap < current.alignmentGap) ||
                (
                    next.distance === current.distance &&
                    next.alignmentGap === current.alignmentGap &&
                    next.mode === 'dock' &&
                    current.mode === 'align'
                );
        }

        for (const candidate of getHitCandidates()) {
            if (!state.layerVisibility[candidate.category] || excludedEntities.has(candidate.entity)) {
                continue;
            }

            const targetRect = getEntityRect(candidate.entity, candidate.category);
            const targetCenterX = targetRect.left + targetRect.width / 2;
            const targetCenterY = targetRect.top + targetRect.height / 2;
            const horizontalAlignmentGap = getRangeGap(movingRect.left, movingRect.right, targetRect.left, targetRect.right);
            const verticalAlignmentGap = getRangeGap(movingRect.top, movingRect.bottom, targetRect.top, targetRect.bottom);
            const candidates: ObjectSnapMatch[] = [];

            if (isObjectSnapModeEnabled(snapMode, 'dock') && horizontalAlignmentGap <= OBJECT_SNAP_ALIGNMENT_THRESHOLD) {
                const snapAboveTarget = movingCenterY <= targetCenterY;
                const delta = snapAboveTarget
                    ? targetRect.top - movingRect.bottom
                    : targetRect.bottom - movingRect.top;
                const snappedRect = {
                    ...movingRect,
                    top: movingRect.top + delta,
                    bottom: movingRect.bottom + delta
                };
                const distance = Math.abs(delta);
                if (distance <= OBJECT_SNAP_THRESHOLD) {
                    candidates.push({
                        axis: 'y',
                        mode: 'dock',
                        delta,
                        distance,
                        alignmentGap: horizontalAlignmentGap,
                        guide: buildObjectSnapGuide(
                            'y',
                            'dock',
                            snappedRect,
                            targetRect,
                            snapAboveTarget ? 'top' : 'bottom'
                        )
                    });
                }
            }

            if (isObjectSnapModeEnabled(snapMode, 'dock') && verticalAlignmentGap <= OBJECT_SNAP_ALIGNMENT_THRESHOLD) {
                const snapLeftOfTarget = movingCenterX <= targetCenterX;
                const delta = snapLeftOfTarget
                    ? targetRect.left - movingRect.right
                    : targetRect.right - movingRect.left;
                const snappedRect = {
                    ...movingRect,
                    left: movingRect.left + delta,
                    right: movingRect.right + delta
                };
                const distance = Math.abs(delta);
                if (distance <= OBJECT_SNAP_THRESHOLD) {
                    candidates.push({
                        axis: 'x',
                        mode: 'dock',
                        delta,
                        distance,
                        alignmentGap: verticalAlignmentGap,
                        guide: buildObjectSnapGuide(
                            'x',
                            'dock',
                            snappedRect,
                            targetRect,
                            snapLeftOfTarget ? 'left' : 'right'
                        )
                    });
                }
            }

            if (isObjectSnapModeEnabled(snapMode, 'align') && horizontalAlignmentGap <= OBJECT_SNAP_ALIGNMENT_THRESHOLD) {
                const alignToTop = Math.abs(movingRect.top - targetRect.top) <= Math.abs(movingRect.bottom - targetRect.bottom);
                const delta = alignToTop
                    ? targetRect.top - movingRect.top
                    : targetRect.bottom - movingRect.bottom;
                const snappedRect = {
                    ...movingRect,
                    top: movingRect.top + delta,
                    bottom: movingRect.bottom + delta
                };
                const distance = Math.abs(delta);
                if (distance <= OBJECT_SNAP_THRESHOLD) {
                    candidates.push({
                        axis: 'y',
                        mode: 'align',
                        delta,
                        distance,
                        alignmentGap: horizontalAlignmentGap,
                        guide: buildObjectSnapGuide(
                            'y',
                            'align',
                            snappedRect,
                            targetRect,
                            alignToTop ? 'top' : 'bottom'
                        )
                    });
                }
            }

            if (isObjectSnapModeEnabled(snapMode, 'align') && verticalAlignmentGap <= OBJECT_SNAP_ALIGNMENT_THRESHOLD) {
                const alignToLeft = Math.abs(movingRect.left - targetRect.left) <= Math.abs(movingRect.right - targetRect.right);
                const delta = alignToLeft
                    ? targetRect.left - movingRect.left
                    : targetRect.right - movingRect.right;
                const snappedRect = {
                    ...movingRect,
                    left: movingRect.left + delta,
                    right: movingRect.right + delta
                };
                const distance = Math.abs(delta);
                if (distance <= OBJECT_SNAP_THRESHOLD) {
                    candidates.push({
                        axis: 'x',
                        mode: 'align',
                        delta,
                        distance,
                        alignmentGap: verticalAlignmentGap,
                        guide: buildObjectSnapGuide(
                            'x',
                            'align',
                            snappedRect,
                            targetRect,
                            alignToLeft ? 'left' : 'right'
                        )
                    });
                }
            }

            for (const candidateMatch of candidates) {
                if (candidateMatch.axis === 'x') {
                    if (shouldReplaceSnapMatch(bestXMatch, candidateMatch)) {
                        bestXMatch = candidateMatch;
                    }
                } else if (shouldReplaceSnapMatch(bestYMatch, candidateMatch)) {
                    bestYMatch = candidateMatch;
                }
            }
        }

        return {
            x: bestXMatch,
            y: bestYMatch,
            guides: [
                ...(bestXMatch ? [bestXMatch.guide] : []),
                ...(bestYMatch ? [bestYMatch.guide] : [])
            ]
        };
    }

    function resolvePlacementPosition(
        worldX: number,
        worldY: number,
        category: DesignerCategory = state.category,
        snapMode: ObjectSnapMode = state.activeObjectSnapMode
    ) {
        const baseX = state.snapToGrid ? snapCoordinateToOffset(worldX, state.snapOffsetX) : Math.round(worldX);
        const baseY = state.snapToGrid ? snapCoordinateToOffset(worldY, state.snapOffsetY) : Math.round(worldY);
        const movingRect = getRectAtPosition(baseX, baseY, category);
        const objectSnap = findObjectSnapMatch(movingRect, snapMode);
        return {
            x: baseX + (objectSnap.x?.delta ?? 0),
            y: baseY + (objectSnap.y?.delta ?? 0),
            guides: objectSnap.guides
        };
    }

    function placeAtWorld(worldX: number, worldY: number, snapMode: ObjectSnapMode = state.activeObjectSnapMode) {
        const { x, y } = resolvePlacementPosition(worldX, worldY, state.category, snapMode);
        const type = getCurrentType();

        if (state.category === 'world') {
            if (isTeleporterCompositeType(type)) {
                const teleporterBase = createTeleporterCompositeAt(x, y);
                setSelections([{ category: 'world', entity: teleporterBase }]);
                return;
            }
            const entity = {
                x,
                y,
                type,
                collision: true,
                maskAstronaut: false,
                palette: state.palette,
                rotation: state.rotation,
                translation: state.translation,
                ...(shouldTreatTypePaletteAsWater(type, state.palette) ? { water: true } : {})
            };
            getCategoryArray('world').push(entity);
            playMushroomPlacementSound(type);
            setSelections([{ category: 'world', entity }]);
            return;
        }

        if (state.category === 'buttons') {
            if (isButtonCompositeType(type)) {
                const button = createButtonEntity({
                    x,
                    y,
                    rotation: state.rotation,
                    collision: true,
                    active: false,
                    linkedDoors: []
                });
                getCategoryArray('buttons').push(button);
                setSelections([{ category: 'buttons', entity: button }]);
                return;
            }
            const entity = {
                x,
                y,
                type,
                collision: true,
                maskAstronaut: false,
                palette: state.palette,
                rotation: state.rotation,
                translation: 'center'
            };
            getCategoryArray('world').push(entity);
            playMushroomPlacementSound(type);
            setSelections([{ category: 'world', entity }]);
            return;
        }

        if (state.category === 'custom') {
            const definition = getCustomSpriteDefinitionById(type);
            if (!definition) {
                setStatus('Create a custom sprite by grouping placed items first.', 'error');
                return;
            }
            const entity = createCustomSpriteInstance(definition, x, y);
            getCategoryArray('custom').push(entity);
            setSelections([{ category: 'custom', entity }]);
            return;
        }

        if (state.category === 'doors') {
            const entity = createDoorEntity({
                x,
                y,
                palette: state.palette,
                rotation: state.rotation,
                translation: state.translation,
                collision: true
            });
            getCategoryArray('doors').push(entity);
            setSelections([{ category: 'doors', entity }]);
            return;
        }

        if (state.category === 'creatures') {
            const entity = createCreatureEntity({
                x,
                y,
                type,
                palette: state.palette,
                rotation: state.rotation,
                translation: state.translation
            });
            getCategoryArray('creatures').push(entity);
            setSelections([{ category: 'creatures', entity }]);
            return;
        }

        const entity = createCollectableEntity({
            x,
            y,
            type,
            palette: state.palette,
            rotation: state.rotation,
            weight: getDefaultCollectableWeight(type),
            paletteCycle: getDefaultCollectablePaletteCycle(type, state.palette, getPaletteCount())
        });
        getCategoryArray('collectables').push(entity);
        setSelections([{ category: 'collectables', entity }]);
    }

    function beginDrag(world: Position, selections: Selection[]) {
        const dragSelections = expandSelectionsWithLinkedTeleporters(selections);
        state.dragging = true;
        state.dragAnchorWorld = world;
        state.dragItems = dragSelections.map((selection) => ({
            selection,
            startX: selection.entity.x,
            startY: selection.entity.y
        }));
        state.dragStartSnapshot = getSnapshot();
    }

    function getAutoPanDelta(point: Position) {
        const edgeThreshold = 48;
        const panSpeed = 10;
        return {
            x: point.x <= edgeThreshold
                ? -panSpeed
                : point.x >= host.canvas.width - edgeThreshold
                    ? panSpeed
                    : 0,
            y: point.y <= edgeThreshold
                ? -panSpeed
                : point.y >= host.canvas.height - edgeThreshold
                    ? panSpeed
                    : 0
        };
    }

    function getBoundsFromRects(rects: Rect[]): Rect {
        return {
            left: Math.min(...rects.map((rect) => rect.left)),
            top: Math.min(...rects.map((rect) => rect.top)),
            right: Math.max(...rects.map((rect) => rect.right)),
            bottom: Math.max(...rects.map((rect) => rect.bottom)),
            width: Math.max(...rects.map((rect) => rect.right)) - Math.min(...rects.map((rect) => rect.left)),
            height: Math.max(...rects.map((rect) => rect.bottom)) - Math.min(...rects.map((rect) => rect.top))
        };
    }

    function updateDraggedItems(point: Position, refreshUi = false) {
        if (!state.dragging || !state.dragAnchorWorld) return;

        const autoPan = getAutoPanDelta(point);
        if (autoPan.x !== 0 || autoPan.y !== 0) {
            state.camera = host.clampCamera({
                x: state.camera.x + autoPan.x,
                y: state.camera.y + autoPan.y
            });
        }

        const world = screenToWorld(point.x, point.y);
        const deltaX = world.x - state.dragAnchorWorld.x;
        const deltaY = world.y - state.dragAnchorWorld.y;
        const dragTargets = state.dragItems.map((dragItem) => {
            const x = state.snapToGrid
                ? snapCoordinateToOffset(dragItem.startX + deltaX, state.snapOffsetX)
                : dragItem.startX + deltaX;
            const y = state.snapToGrid
                ? snapCoordinateToOffset(dragItem.startY + deltaY, state.snapOffsetY)
                : dragItem.startY + deltaY;
            return {
                dragItem,
                x,
                y,
                rect: getRectAtPosition(x, y, dragItem.selection.category)
            };
        });
        const excludedEntities = new Set(state.dragItems.map((dragItem) => dragItem.selection.entity));
        const objectSnap = dragTargets.length > 0
            ? findObjectSnapMatch(getBoundsFromRects(dragTargets.map((entry) => entry.rect)), state.activeObjectSnapMode, excludedEntities)
            : { x: null, y: null, guides: [] };
        const snapDeltaX = objectSnap.x?.delta ?? 0;
        const snapDeltaY = objectSnap.y?.delta ?? 0;
        state.objectSnapGuides = objectSnap.guides;

        for (const target of dragTargets) {
            applyEntityPositionWithTeleporterSync(
                target.dragItem.selection.entity,
                target.x + snapDeltaX,
                target.y + snapDeltaY
            );
        }
        if (refreshUi) {
            refreshPanel();
        }
    }

    function completeDrag() {
        if (!state.dragging) {
            return;
        }
        state.dragging = false;
        state.dragItems = [];
        state.dragAnchorWorld = null;
        state.objectSnapGuides = [];
        state.activeObjectSnapMode = state.objectSnapEnabled ? 'dock' : 'none';
        state.lastPointerCanvas = null;

        if (!state.dragStartSnapshot) {
            return;
        }

        const before = state.dragStartSnapshot;
        state.dragStartSnapshot = null;
        const after = getSnapshot();
        if (snapshotsEqual(before, after)) {
            host.afterWorldDataMutated();
            updateDirtyState();
            refreshPanel();
            return;
        }

        state.undoStack.push(before);
        if (state.undoStack.length > historyLimit) {
            state.undoStack.shift();
        }
        state.redoStack = [];
        host.afterWorldDataMutated();
        updateDirtyState();
        refreshPanel();
        setStatus('Moved selected objects with the mouse. Use arrow keys for precise nudging.', 'neutral');
    }

    return {
        getObjectSnapMode,
        resolvePlacementPosition,
        placeAtWorld,
        beginDrag,
        getAutoPanDelta,
        updateDraggedItems,
        completeDrag
    };
}
