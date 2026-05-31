import type { Position } from '../../types/index.js';
import type {
    DesignerCategory,
    DesignerState,
    Selection
} from '../core/world-designer-types.js';

type StatusTone = 'neutral' | 'success' | 'error';

type WorldDesignerInteractionHandlersDeps = {
    state: DesignerState;
    refs: {
        overviewCanvas: HTMLCanvasElement;
        contextMenu: HTMLElement;
        modal: HTMLElement;
    };
    host: {
        canvas: HTMLCanvasElement;
        clampCamera: (camera: Position) => Position;
    };
    mapWidth: number;
    mapHeight: number;
    clamp: (value: number, min: number, max: number) => number;
    isFormTarget: (target: EventTarget | null) => boolean;
    getCanvasPoint: (event: MouseEvent) => Position;
    closeContextMenu: () => void;
    screenToWorld: (x: number, y: number) => Position;
    getTeleporterById: (id: any) => any;
    runMutation: (message: string, mutate: () => void) => void;
    setStatus: (status: string, tone?: StatusTone) => void;
    getEntityAt: (x: number, y: number) => Selection | null;
    isSelected: (selection: Selection) => boolean;
    getSelectedItems: () => Selection[];
    setSelections: (selections: Selection[], primary?: Selection | null) => void;
    removeSelection: (existing: Selection[], target: Selection) => Selection[];
    areSameSelection: (left: Selection, right: Selection) => boolean;
    mergeSelections: (existing: Selection[], incoming: Selection[]) => Selection[];
    updateModifierSnapMode: (ctrlKey: boolean, altKey: boolean) => void;
    placeAtWorld: (x: number, y: number, objectSnapMode?: any) => void;
    updateSelectionFromInspectorState: () => void;
    categoryLabels: Record<DesignerCategory, string>;
    beginDrag: (world: Position, dragSelections: Selection[]) => void;
    updateDraggedItems: (point: Position, autoPan?: boolean) => void;
    placeDraggedPickerSprite: (point: Position) => void;
    clearPickerDrag: () => void;
    persistDesignerUiState: () => void;
    getSelectionsInRect: (from: Position, to: Position) => Selection[];
    completeDrag: () => void;
    setDesignerActive: (nextActive: boolean) => void;
    refreshModifierSnapInteraction: () => void;
    closeModal: () => void;
    openSavePreview: () => void;
    undo: () => void;
    redo: () => void;
    duplicateSelection: () => void;
    copySelection: () => void;
    pasteSelection: () => void;
    refreshPanel: () => void;
    restoreEditModeSnapshot: () => boolean;
    deleteSelection: () => void;
    rotateSelection: () => void;
    nudgeSelection: (dx: number, dy: number) => void;
};

export function createWorldDesignerInteractionHandlers(deps: WorldDesignerInteractionHandlersDeps) {
    const {
        state,
        refs,
        host,
        mapWidth,
        mapHeight,
        clamp,
        isFormTarget,
        getCanvasPoint,
        closeContextMenu,
        screenToWorld,
        getTeleporterById,
        runMutation,
        setStatus,
        getEntityAt,
        isSelected,
        getSelectedItems,
        setSelections,
        removeSelection,
        areSameSelection,
        mergeSelections,
        updateModifierSnapMode,
        placeAtWorld,
        updateSelectionFromInspectorState,
        categoryLabels,
        beginDrag,
        updateDraggedItems,
        placeDraggedPickerSprite,
        clearPickerDrag,
        persistDesignerUiState,
        getSelectionsInRect,
        completeDrag,
        setDesignerActive,
        refreshModifierSnapInteraction,
        closeModal,
        openSavePreview,
        undo,
        redo,
        duplicateSelection,
        copySelection,
        pasteSelection,
        refreshPanel,
        restoreEditModeSnapshot,
        deleteSelection,
        rotateSelection,
        nudgeSelection
    } = deps;

    function isEventOverCanvas(event: MouseEvent) {
        const rect = host.canvas.getBoundingClientRect();
        return (
            event.clientX >= rect.left &&
            event.clientX <= rect.right &&
            event.clientY >= rect.top &&
            event.clientY <= rect.bottom
        );
    }

    function moveCameraToWorldCenter(worldX: number, worldY: number) {
        state.camera = host.clampCamera({
            x: worldX - host.canvas.width / 2,
            y: worldY - host.canvas.height / 2
        });
    }

    function handleCanvasMouseDown(event: MouseEvent) {
        if (!state.active || state.mode !== 'edit') return;
        if (state.pickerDrag) return;
        const point = getCanvasPoint(event);
        state.lastPointerCanvas = point;
        closeContextMenu();

        const world = screenToWorld(point.x, point.y);

        if (state.teleporterDestinationPick) {
            if (event.button === 2) {
                state.teleporterDestinationPick = null;
                setStatus('Cancelled teleporter destination pick mode.', 'neutral');
                event.preventDefault();
                return;
            }
            if (event.button !== 0) {
                return;
            }
            const pickState = state.teleporterDestinationPick;
            const slotLabel = pickState.slot === 'b' ? 'B' : 'A';
            runMutation(`Set teleporter destination ${slotLabel} from map pick.`, () => {
                const teleporter = getTeleporterById(pickState.teleporterId);
                if (!teleporter) {
                    throw new Error(`Teleporter "${pickState.teleporterId}" no longer exists.`);
                }
                const destination = {
                    x: Math.round(world.x),
                    y: Math.round(world.y)
                };
                if (pickState.slot === 'b') {
                    teleporter.destinationB = destination;
                } else {
                    teleporter.destinationA = destination;
                }
            });
            state.teleporterDestinationPick = null;
            setStatus(`Set teleporter destination ${slotLabel} to (${Math.round(world.x)}, ${Math.round(world.y)}).`, 'success');
            return;
        }

        if (event.button === 2) {
            const hit = getEntityAt(world.x, world.y);
            if (hit) {
                state.suppressContextMenuOnce = false;
                const menuSelections = isSelected(hit) ? getSelectedItems() : [hit];
                setSelections(menuSelections, hit);
                event.preventDefault();
                return;
            }
            state.pendingRightPan = true;
            state.panningView = false;
            state.panStartCanvas = point;
            state.panStartCamera = { ...state.camera };
            return;
        }

        if (event.button !== 0) return;
        if (state.tool === 'place') {
            updateModifierSnapMode(event.ctrlKey, event.altKey);
            runMutation(`Placed new ${categoryLabels[state.category].toLowerCase()}.`, () => {
                placeAtWorld(world.x, world.y, state.activeObjectSnapMode);
            });
            updateSelectionFromInspectorState();
            return;
        }

        const hit = getEntityAt(world.x, world.y);
        if (!hit) {
            state.marqueeSelecting = true;
            state.marqueeStartWorld = world;
            state.marqueeCurrentWorld = world;
            state.marqueeAdditive = event.shiftKey;
            return;
        }

        if (event.shiftKey) {
            const currentSelections = getSelectedItems();
            if (isSelected(hit)) {
                const remainingSelections = removeSelection(currentSelections, hit);
                const nextPrimary = state.selection && areSameSelection(state.selection, hit)
                    ? (remainingSelections[remainingSelections.length - 1] ?? null)
                    : state.selection;
                setSelections(remainingSelections, nextPrimary);
                setStatus(
                    remainingSelections.length > 0
                        ? `Removed object from selection. ${remainingSelections.length} selected.`
                        : 'Selection cleared.',
                    'neutral'
                );
            } else {
                const mergedSelections = mergeSelections(currentSelections, [hit]);
                setSelections(mergedSelections, hit);
                setStatus(`Added object to selection. ${mergedSelections.length} selected.`, 'neutral');
            }
            return;
        }

        const dragSelections = isSelected(hit) ? getSelectedItems() : [hit];
        setSelections(dragSelections, hit);
        updateModifierSnapMode(event.ctrlKey, event.altKey);
        beginDrag(world, dragSelections);
    }

    function handleCanvasMouseMove(event: MouseEvent) {
        if (!state.active) return;
        const isOverCanvas = isEventOverCanvas(event);
        if (state.pickerDrag) {
            state.pickerDragCanvas = isOverCanvas ? getCanvasPoint(event) : null;
            return;
        }
        if (!isOverCanvas && !state.dragging && !state.panningView && !state.pendingRightPan) {
            state.lastPointerCanvas = null;
            return;
        }
        const point = getCanvasPoint(event);
        state.lastPointerCanvas = point;
        updateModifierSnapMode(event.ctrlKey, event.altKey);
        if (state.mode !== 'edit') return;

        if (state.panningView && state.panStartCanvas && state.panStartCamera) {
            state.camera = host.clampCamera({
                x: state.panStartCamera.x - (point.x - state.panStartCanvas.x),
                y: state.panStartCamera.y - (point.y - state.panStartCanvas.y)
            });
            return;
        }

        if (state.pendingRightPan && state.panStartCanvas) {
            const deltaX = point.x - state.panStartCanvas.x;
            const deltaY = point.y - state.panStartCanvas.y;
            if (Math.hypot(deltaX, deltaY) >= 6) {
                state.pendingRightPan = false;
                state.suppressContextMenuOnce = true;
                state.panningView = true;
                setStatus('Panning editor view.', 'neutral');
            }
            return;
        }

        const world = screenToWorld(point.x, point.y);

        if (state.marqueeSelecting) {
            state.marqueeCurrentWorld = world;
            return;
        }

        if (state.dragging) {
            updateDraggedItems(point);
        }
    }

    function handleCanvasMouseLeave() {
        if (state.dragging || state.panningView || state.pendingRightPan || state.pickerDrag) {
            return;
        }
        state.lastPointerCanvas = null;
        state.objectSnapGuides = [];
    }

    function handleCanvasMouseUp(event?: MouseEvent) {
        if (state.pickerDrag) {
            updateModifierSnapMode(event?.ctrlKey ?? false, event?.altKey ?? false);
            if (event && isEventOverCanvas(event)) {
                placeDraggedPickerSprite(getCanvasPoint(event));
            }
            clearPickerDrag();
            return;
        }

        if (state.panningView) {
            state.panningView = false;
            state.pendingRightPan = false;
            state.panStartCanvas = null;
            state.panStartCamera = null;
            state.lastPointerCanvas = null;
            persistDesignerUiState();
            setStatus('Moved camera by right-dragging.', 'neutral');
            return;
        }

        if (state.pendingRightPan) {
            state.pendingRightPan = false;
            state.panStartCanvas = null;
            state.panStartCamera = null;
        }

        if (state.marqueeSelecting && state.marqueeStartWorld && state.marqueeCurrentWorld) {
            const selections = getSelectionsInRect(state.marqueeStartWorld, state.marqueeCurrentWorld);
            const nextSelections = state.marqueeAdditive
                ? mergeSelections(getSelectedItems(), selections)
                : selections;
            state.marqueeSelecting = false;
            state.marqueeStartWorld = null;
            state.marqueeCurrentWorld = null;
            state.marqueeAdditive = false;
            setSelections(nextSelections, selections[0] ?? nextSelections[0] ?? null);
            setStatus(
                nextSelections.length > 0
                    ? `Selected ${nextSelections.length} object${nextSelections.length === 1 ? '' : 's'}.`
                    : 'Nothing selected.',
                'neutral'
            );
            return;
        }

        if (!state.dragging) return;
        completeDrag();
    }

    function updateOverviewHover(event: MouseEvent) {
        const rect = refs.overviewCanvas.getBoundingClientRect();
        const cssWidth = rect.width > 0 ? rect.width : refs.overviewCanvas.width;
        const cssHeight = rect.height > 0 ? rect.height : refs.overviewCanvas.height;
        const x = clamp(event.clientX - rect.left, 0, cssWidth);
        const y = clamp(event.clientY - rect.top, 0, cssHeight);
        const normalizedX = cssWidth > 0 ? x / cssWidth : 0;
        const normalizedY = cssHeight > 0 ? y / cssHeight : 0;
        const worldX = clamp(normalizedX * mapWidth, 0, mapWidth);
        const worldY = clamp(normalizedY * mapHeight, 0, mapHeight);
        state.overviewHoverWorld = { x: worldX, y: worldY };
    }

    function handleOverviewMouseMove(event: MouseEvent) {
        updateOverviewHover(event);
        if (state.overviewDragging) {
            moveCameraToWorldCenter(state.overviewHoverWorld!.x, state.overviewHoverWorld!.y);
        }
    }

    function handleOverviewMouseDown(event: MouseEvent) {
        if (event.button !== 0) return;
        closeContextMenu();
        updateOverviewHover(event);
        state.overviewDragging = true;
        moveCameraToWorldCenter(state.overviewHoverWorld!.x, state.overviewHoverWorld!.y);
        setStatus('Dragging overview navigator.', 'neutral');
    }

    function handleOverviewMouseUp() {
        if (!state.overviewDragging) return;
        state.overviewDragging = false;
        if (!state.overviewHoverWorld) return;
        persistDesignerUiState();
        setStatus('Moved camera from the overview navigator.', 'neutral');
    }

    function handleKeyDown(event: KeyboardEvent) {
        if (event.key === '`') {
            setDesignerActive(!state.active);
            setStatus(state.active ? 'Designer panel restored.' : 'Designer panel hidden. Press ` to restore.', 'neutral');
            return;
        }

        if (!state.active) return;
        if (isFormTarget(event.target)) return;

        if (event.key === 'Control' || event.key === 'Alt') {
            updateModifierSnapMode(event.ctrlKey, event.altKey);
            refreshModifierSnapInteraction();
        }

        if (event.key === 'Escape') {
            if (refs.modal.classList.contains('open')) {
                closeModal();
                event.preventDefault();
                return;
            }
            closeContextMenu();
        }

        if (event.ctrlKey && event.key.toLowerCase() === 's') {
            event.preventDefault();
            openSavePreview();
            return;
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'z' && !event.shiftKey) {
            event.preventDefault();
            undo();
            return;
        }
        if (
            (event.ctrlKey && event.key.toLowerCase() === 'y') ||
            (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'z')
        ) {
            event.preventDefault();
            redo();
            return;
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'd') {
            event.preventDefault();
            duplicateSelection();
            return;
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'c') {
            event.preventDefault();
            copySelection();
            return;
        }
        if (event.ctrlKey && event.key.toLowerCase() === 'v') {
            event.preventDefault();
            pasteSelection();
            return;
        }

        switch (event.key) {
            case '1':
                state.tool = 'select';
                refreshPanel();
                event.preventDefault();
                return;
            case '2':
                state.tool = 'place';
                refreshPanel();
                event.preventDefault();
                return;
            case 'm':
            case 'M':
                state.mode = state.mode === 'edit' ? 'preview' : 'edit';
                if (state.mode === 'edit' && restoreEditModeSnapshot()) {
                    setStatus('Restored the authored world state for editing.', 'neutral');
                }
                state.liveResumeSnapshot = null;
                refreshPanel();
                event.preventDefault();
                return;
            case 'g':
            case 'G':
                state.snapToGrid = !state.snapToGrid;
                refreshPanel();
                event.preventDefault();
                return;
            case 'x':
            case 'X':
                state.magnifierEnabled = !state.magnifierEnabled;
                if (!state.magnifierEnabled) {
                    state.lastPointerCanvas = null;
                }
                refreshPanel();
                event.preventDefault();
                return;
            case 'Delete':
            case 'Backspace':
                deleteSelection();
                event.preventDefault();
                return;
            case 'r':
            case 'R':
                rotateSelection();
                event.preventDefault();
                return;
            case 'ArrowLeft':
            case 'ArrowRight':
            case 'ArrowUp':
            case 'ArrowDown': {
                const step = event.shiftKey ? state.nudgeAmount * 10 : state.nudgeAmount;
                const delta = {
                    ArrowLeft: { x: -step, y: 0 },
                    ArrowRight: { x: step, y: 0 },
                    ArrowUp: { x: 0, y: -step },
                    ArrowDown: { x: 0, y: step }
                }[event.key];
                nudgeSelection(delta.x, delta.y);
                event.preventDefault();
                return;
            }
        }
    }

    function handleKeyUp(event: KeyboardEvent) {
        if (!state.active || isFormTarget(event.target)) return;
        if (event.key !== 'Control' && event.key !== 'Alt') return;
        updateModifierSnapMode(event.ctrlKey, event.altKey);
        refreshModifierSnapInteraction();
    }

    function handleWindowMouseDown(event: MouseEvent) {
        if (!refs.contextMenu.classList.contains('open')) return;
        if (!(event.target instanceof Node) || !refs.contextMenu.contains(event.target)) {
            closeContextMenu();
        }
    }

    function handleWindowBeforeUnload(event: BeforeUnloadEvent) {
        persistDesignerUiState();
        if (!state.dirty) {
            return;
        }
        event.preventDefault();
        // Browsers ignore custom text and show a generic confirmation message.
        event.returnValue = '';
    }

    return {
        moveCameraToWorldCenter,
        handleCanvasMouseDown,
        handleCanvasMouseMove,
        handleCanvasMouseLeave,
        handleCanvasMouseUp,
        updateOverviewHover,
        handleOverviewMouseMove,
        handleOverviewMouseDown,
        handleOverviewMouseUp,
        handleKeyDown,
        handleKeyUp,
        handleWindowMouseDown,
        handleWindowBeforeUnload
    };
}
