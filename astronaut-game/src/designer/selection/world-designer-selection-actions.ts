import { MapBlock } from '../../world/map.js';
import type { SpriteTranslation } from '../../shared/utilities.js';
import type {
    ClipboardEntry,
    DesignerCategory,
    DesignerSnapshot,
    DesignerState,
    RuntimeDesignerCategory,
    Selection
} from '../core/world-designer-types.js';

type StatusTone = 'neutral' | 'success' | 'error';

type WorldDesignerSelectionActionsDeps = {
    state: DesignerState;
    host: {
        canvas: HTMLCanvasElement;
        clampCamera: (camera: { x: number; y: number }) => { x: number; y: number };
        replaceRawWorldData: (data: DesignerSnapshot['worldData']) => void;
    };
    spriteTypes: string[];
    normalizeRotation: (rotation: number) => number;
    normalizeSpriteTranslation: (translation?: SpriteTranslation) => SpriteTranslation;
    categorySupportsTranslation: (category: DesignerCategory) => boolean;
    refreshPanel: () => void;
    persistDesignerUiState: () => void;
    setStatus: (status: string, tone?: StatusTone) => void;
    getSelectionBounds: (selections: Selection[]) => {
        left: number;
        top: number;
        width: number;
        height: number;
    };
    getCategoryArray: (category: DesignerCategory) => any[];
    findTeleporterForWorldBlock: (block: MapBlock) => any | null;
    findWorldBlockByExactPosition: (x: number, y: number, type: string) => MapBlock | null;
    serializeSelectionEntity: (selection: Selection) => ClipboardEntry['data'];
    createPastedSelections: (entries: ClipboardEntry[], offsetX: number, offsetY: number) => Selection[];
    runMutation: (message: string, mutate: () => void) => void;
    removeTeleportersForSelections: (selections: Selection[]) => void;
    removeSelectedFromArray: (selections?: Selection[]) => void;
    applyEntityRotationWithTeleporterSync: (entity: any, rotation: number) => void;
    applyEntityPositionWithTeleporterSync: (entity: any, x: number, y: number) => void;
    getClipboardEntries: () => ClipboardEntry[];
    setClipboardEntries: (entries: ClipboardEntry[]) => void;
    getSnapshot: () => DesignerSnapshot;
    deepClone: <T>(value: T) => T;
    getCustomSpriteDefinitionById: (id: string | null | undefined) => any;
    invalidateOverviewBase: () => void;
    updateDirtyState: () => void;
    syncEditModeSnapshot: () => void;
};

export function createWorldDesignerSelectionActions(deps: WorldDesignerSelectionActionsDeps) {
    const {
        state,
        host,
        spriteTypes,
        normalizeRotation,
        normalizeSpriteTranslation,
        categorySupportsTranslation,
        refreshPanel,
        persistDesignerUiState,
        setStatus,
        getSelectionBounds,
        getCategoryArray,
        findTeleporterForWorldBlock,
        findWorldBlockByExactPosition,
        serializeSelectionEntity,
        createPastedSelections,
        runMutation,
        removeTeleportersForSelections,
        removeSelectedFromArray,
        applyEntityRotationWithTeleporterSync,
        applyEntityPositionWithTeleporterSync,
        getClipboardEntries,
        setClipboardEntries,
        getSnapshot,
        deepClone,
        getCustomSpriteDefinitionById,
        invalidateOverviewBase,
        updateDirtyState,
        syncEditModeSnapshot
    } = deps;

    function areSameSelection(left: Selection, right: Selection) {
        return left.category === right.category && left.entity === right.entity;
    }

    function getSelectedItems() {
        return state.selectedItems.length > 0
            ? state.selectedItems
            : state.selection
                ? [state.selection]
                : [];
    }

    function syncPalettePreviewTypeFromSelection(selection: Selection | null) {
        if (!state.paletteDesignerOpen || !selection) {
            return;
        }
        if (spriteTypes.includes(selection.entity.type)) {
            state.palettePreviewType = selection.entity.type;
        }
    }

    function setSelections(selections: Selection[], primary: Selection | null = selections[0] ?? null) {
        state.selectedItems = selections;
        state.selection = primary;
        if (primary) {
            state.category = primary.category;
            state.rotation = normalizeRotation(primary.entity.rotation);
            state.translation = categorySupportsTranslation(primary.category)
                ? normalizeSpriteTranslation(primary.entity.translation)
                : 'center';
            state.palette = primary.entity.palette ?? 0;
            state.typeByCategory[primary.category] = primary.entity.type;
        }
        syncPalettePreviewTypeFromSelection(primary);
        refreshPanel();
    }

    function mergeSelections(existing: Selection[], incoming: Selection[]) {
        const merged = [...existing];
        for (const selection of incoming) {
            if (!merged.some((item) => areSameSelection(item, selection))) {
                merged.push(selection);
            }
        }
        return merged;
    }

    function removeSelection(existing: Selection[], target: Selection) {
        return existing.filter((item) => !areSameSelection(item, target));
    }

    function getLinkedTeleporterSelection(selection: Selection): Selection | null {
        if (selection.category !== 'world') {
            return null;
        }
        const block = selection.entity as MapBlock;
        if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
            return null;
        }
        const teleporter = findTeleporterForWorldBlock(block);
        if (!teleporter) {
            return null;
        }
        const counterpart = block.type === 'teleporter'
            ? findWorldBlockByExactPosition(teleporter.padX, teleporter.padY, 'teleporter_pad')
            : findWorldBlockByExactPosition(teleporter.baseX, teleporter.baseY, 'teleporter');
        return counterpart ? { category: 'world', entity: counterpart } : null;
    }

    function expandSelectionsWithLinkedTeleporters(selections: Selection[]) {
        let expanded = [...selections];
        for (const selection of selections) {
            const linkedSelection = getLinkedTeleporterSelection(selection);
            if (linkedSelection) {
                expanded = mergeSelections(expanded, [linkedSelection]);
            }
        }
        return expanded;
    }

    function getSelectionDrawOrder(selection: Selection) {
        const categoryOrder: Record<RuntimeDesignerCategory, number> = {
            world: 0,
            doors: 1,
            buttons: 2,
            creatures: 3,
            collectables: 4
        };
        const category = selection.category as RuntimeDesignerCategory;
        const categoryRank = categoryOrder[category] ?? 0;
        const indexInCategory = getCategoryArray(selection.category).indexOf(selection.entity);
        return {
            categoryRank,
            indexInCategory
        };
    }

    function getSelectionsInDrawOrder(selections: Selection[]) {
        return [...selections].sort((left, right) => {
            const leftOrder = getSelectionDrawOrder(left);
            const rightOrder = getSelectionDrawOrder(right);
            if (leftOrder.categoryRank !== rightOrder.categoryRank) {
                return leftOrder.categoryRank - rightOrder.categoryRank;
            }
            return leftOrder.indexInCategory - rightOrder.indexInCategory;
        });
    }

    function focusSelection() {
        const selections = getSelectedItems();
        if (selections.length === 0) return;
        const rect = getSelectionBounds(selections);
        state.camera = host.clampCamera({
            x: rect.left - host.canvas.width / 2 + rect.width / 2,
            y: rect.top - host.canvas.height / 2 + rect.height / 2
        });
        persistDesignerUiState();
        setStatus('Camera centered on selection.', 'neutral');
    }

    function duplicateSelection() {
        const selections = getSelectionsInDrawOrder(
            expandSelectionsWithLinkedTeleporters(getSelectedItems())
        );
        if (selections.length === 0) return;
        runMutation('Duplicated selection.', () => {
            const duplicatedSelections = createPastedSelections(
                selections.map((selection) => ({
                    category: selection.category,
                    data: serializeSelectionEntity(selection)
                })),
                12,
                12
            );
            setSelections(duplicatedSelections);
        });
    }

    function copySelection() {
        const selections = getSelectionsInDrawOrder(
            expandSelectionsWithLinkedTeleporters(getSelectedItems())
        );
        if (selections.length === 0) {
            setStatus('Nothing selected to copy.', 'neutral');
            return;
        }
        const clipboardEntries = selections.map((selection) => ({
            category: selection.category,
            data: serializeSelectionEntity(selection)
        }));
        setClipboardEntries(clipboardEntries);
        setStatus(`Copied ${clipboardEntries.length} object${clipboardEntries.length === 1 ? '' : 's'}.`, 'neutral');
    }

    function pasteSelection() {
        const clipboardEntries = getClipboardEntries();
        if (clipboardEntries.length === 0) {
            setStatus('Nothing copied yet.', 'neutral');
            return;
        }
        runMutation('Pasted selection.', () => {
            const pastedSelections = createPastedSelections(clipboardEntries, 12, 12);
            setSelections(pastedSelections);
        });
    }

    function deleteSelection() {
        const selections = expandSelectionsWithLinkedTeleporters(getSelectedItems());
        if (selections.length === 0) return;
        runMutation('Deleted selection.', () => {
            removeTeleportersForSelections(selections);
            removeSelectedFromArray(selections);
            setSelections([]);
        });
    }

    function rotateSelection() {
        const selections = expandSelectionsWithLinkedTeleporters(getSelectedItems());
        if (selections.length === 0) return;
        if (selections.some((selection) => selection.category === 'custom')) {
            setStatus('Custom sprites keep the rotation authored into their grouped parts.', 'neutral');
            return;
        }
        runMutation('Rotated selection.', () => {
            for (const selection of selections) {
                const nextRotation = ((normalizeRotation(selection.entity.rotation) % 9) + 1);
                applyEntityRotationWithTeleporterSync(selection.entity, nextRotation);
                if (selection.category === 'creatures') {
                    selection.entity.state = selection.entity.state ?? {};
                    selection.entity.state.authoredRotation = selection.entity.rotation;
                }
                if (selection.category === 'collectables' && 'defaultRotation' in selection.entity) {
                    selection.entity.defaultRotation = selection.entity.rotation;
                }
            }
        });
    }

    function nudgeSelection(dx: number, dy: number) {
        const selections = expandSelectionsWithLinkedTeleporters(getSelectedItems());
        if (selections.length === 0) return;
        runMutation('Nudged selection.', () => {
            for (const selection of selections) {
                applyEntityPositionWithTeleporterSync(
                    selection.entity,
                    selection.entity.x + dx,
                    selection.entity.y + dy
                );
            }
        });
    }

    function setSelection(selection: Selection | null) {
        setSelections(selection ? [selection] : [], selection);
    }

    function restoreSnapshot(snapshot: DesignerSnapshot, message: string) {
        host.replaceRawWorldData(snapshot.worldData);
        state.customSpriteDefinitions = deepClone(snapshot.customSpriteDefinitions);
        state.customSpriteInstances = deepClone(snapshot.customSpriteInstances);
        if (!getCustomSpriteDefinitionById(state.typeByCategory.custom)) {
            state.typeByCategory.custom = state.customSpriteDefinitions[0]?.id ?? '';
        }
        state.selection = null;
        state.selectedItems = [];
        invalidateOverviewBase();
        updateDirtyState();
        syncEditModeSnapshot();
        refreshPanel();
        setStatus(message, 'neutral');
    }

    function undo() {
        const previous = state.undoStack.pop();
        if (!previous) return;
        state.redoStack.push(getSnapshot());
        restoreSnapshot(previous, 'Undid last change.');
    }

    function redo() {
        const next = state.redoStack.pop();
        if (!next) return;
        state.undoStack.push(getSnapshot());
        restoreSnapshot(next, 'Redid change.');
    }

    return {
        areSameSelection,
        getSelectedItems,
        setSelections,
        mergeSelections,
        removeSelection,
        expandSelectionsWithLinkedTeleporters,
        getSelectionsInDrawOrder,
        focusSelection,
        duplicateSelection,
        copySelection,
        pasteSelection,
        deleteSelection,
        rotateSelection,
        nudgeSelection,
        setSelection,
        restoreSnapshot,
        undo,
        redo
    };
}
