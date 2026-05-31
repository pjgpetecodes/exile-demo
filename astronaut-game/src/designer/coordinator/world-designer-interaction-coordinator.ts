import { createWorldDesignerContextMenu } from '../context-menu/world-designer-context-menu.js';
import { createWorldDesignerPlacement } from '../placement/world-designer-placement.js';
import { createWorldDesignerSelectionActions } from '../selection/world-designer-selection-actions.js';
import { createWorldDesignerSelectionOrderingController } from '../selection/world-designer-selection-ordering-controller.js';
import type {
    DesignerCategory,
    DesignerSnapshot,
    ObjectSnapMode,
    Selection
} from '../core/world-designer-types.js';
import type { Position } from '../../types/index.js';

export function createWorldDesignerInteractionCoordinator(deps: any) {
    const {
        selectionOrderingDeps,
        selectionActionsDeps,
        placementDeps,
        contextMenuDeps
    } = deps;

    let selectionActions: ReturnType<typeof createWorldDesignerSelectionActions>;

    function areSameSelection(left: Selection, right: Selection) {
        return selectionActions.areSameSelection(left, right);
    }

    function getSelectedItems() {
        return selectionActions.getSelectedItems();
    }

    function isSelected(selection: Selection) {
        return getSelectedItems().some((item) => areSameSelection(item, selection));
    }

    function setSelections(selections: Selection[], primary: Selection | null = selections[0] ?? null) {
        selectionActions.setSelections(selections, primary);
    }

    function removeTeleportersForSelections(selections: Selection[]) {
        selectionOrderingController.removeTeleportersForSelections(selections);
    }

    function removeSelectedFromArray(selections: Selection[] = getSelectedItems()) {
        selectionOrderingController.removeSelectedFromArray(selections);
    }

    function reorderSelections(toFront: boolean) {
        selectionOrderingController.reorderSelections(toFront);
    }

    const selectionOrderingController = createWorldDesignerSelectionOrderingController({
        ...selectionOrderingDeps,
        getSelectedItems
    });

    selectionActions = createWorldDesignerSelectionActions({
        ...selectionActionsDeps,
        removeTeleportersForSelections,
        removeSelectedFromArray
    });

    const placementApi = createWorldDesignerPlacement({
        ...placementDeps,
        expandSelectionsWithLinkedTeleporters: (selections: Selection[]) => (
            selectionActions.expandSelectionsWithLinkedTeleporters(selections)
        ),
        setSelections
    });

    const contextMenuApi = createWorldDesignerContextMenu({
        ...contextMenuDeps,
        getSelectedItems,
        areSameSelection,
        setSelections,
        resolvePlacementPosition: (
            worldX: number,
            worldY: number,
            category: DesignerCategory,
            snapMode: ObjectSnapMode
        ) => placementApi.resolvePlacementPosition(worldX, worldY, category, snapMode),
        rotateSelection: () => {
            selectionActions.rotateSelection();
        },
        reorderSelections,
        copySelection: () => {
            selectionActions.copySelection();
        },
        duplicateSelection: () => {
            selectionActions.duplicateSelection();
        },
        deleteSelection: () => {
            selectionActions.deleteSelection();
        },
        focusSelection: () => {
            selectionActions.focusSelection();
        }
    });

    function getObjectSnapMode(ctrlKey: boolean, altKey: boolean): ObjectSnapMode {
        return placementApi.getObjectSnapMode(ctrlKey, altKey);
    }

    function resolvePlacementPosition(
        worldX: number,
        worldY: number,
        category: DesignerCategory,
        snapMode: ObjectSnapMode
    ) {
        return placementApi.resolvePlacementPosition(worldX, worldY, category, snapMode);
    }

    function placeAtWorld(worldX: number, worldY: number, snapMode?: ObjectSnapMode) {
        placementApi.placeAtWorld(worldX, worldY, snapMode);
    }

    function beginDrag(world: Position, selections: Selection[]) {
        placementApi.beginDrag(world, selections);
    }

    function getAutoPanDelta(point: Position) {
        return placementApi.getAutoPanDelta(point);
    }

    function updateDraggedItems(point: Position, refreshUi = false) {
        placementApi.updateDraggedItems(point, refreshUi);
    }

    function completeDrag() {
        placementApi.completeDrag();
    }

    function closeContextMenu() {
        contextMenuApi.closeContextMenu();
    }

    function positionContextMenu() {
        contextMenuApi.positionContextMenu();
    }

    function getContextMenuWorldPosition() {
        return contextMenuApi.getContextMenuWorldPosition();
    }

    function getContextMenuActionSelections() {
        return contextMenuApi.getContextMenuActionSelections();
    }

    function openContextMenu(selection: Selection, event: MouseEvent) {
        contextMenuApi.openContextMenu(selection, event);
    }

    function openEmptyContextMenu(event: MouseEvent, world: Position) {
        contextMenuApi.openEmptyContextMenu(event, world);
    }

    return {
        getObjectSnapMode,
        resolvePlacementPosition,
        areSameSelection,
        getSelectedItems,
        isSelected,
        setSelections,
        mergeSelections: (existing: Selection[], incoming: Selection[]) => (
            selectionActions.mergeSelections(existing, incoming)
        ),
        removeSelection: (existing: Selection[], target: Selection) => (
            selectionActions.removeSelection(existing, target)
        ),
        expandSelectionsWithLinkedTeleporters: (selections: Selection[]) => (
            selectionActions.expandSelectionsWithLinkedTeleporters(selections)
        ),
        getSelectionsInDrawOrder: (selections: Selection[]) => selectionActions.getSelectionsInDrawOrder(selections),
        removeTeleportersForSelections,
        removeSelectedFromArray,
        reorderSelections,
        placeAtWorld,
        beginDrag,
        getAutoPanDelta,
        updateDraggedItems,
        completeDrag,
        focusSelection: () => {
            selectionActions.focusSelection();
        },
        duplicateSelection: () => {
            selectionActions.duplicateSelection();
        },
        copySelection: () => {
            selectionActions.copySelection();
        },
        pasteSelection: () => {
            selectionActions.pasteSelection();
        },
        deleteSelection: () => {
            selectionActions.deleteSelection();
        },
        rotateSelection: () => {
            selectionActions.rotateSelection();
        },
        nudgeSelection: (dx: number, dy: number) => {
            selectionActions.nudgeSelection(dx, dy);
        },
        setSelection: (selection: Selection | null) => {
            selectionActions.setSelection(selection);
        },
        restoreSnapshot: (snapshot: DesignerSnapshot, message: string) => {
            selectionActions.restoreSnapshot(snapshot, message);
        },
        undo: () => {
            selectionActions.undo();
        },
        redo: () => {
            selectionActions.redo();
        },
        closeContextMenu,
        positionContextMenu,
        getContextMenuWorldPosition,
        getContextMenuActionSelections,
        openContextMenu,
        openEmptyContextMenu
    };
}
