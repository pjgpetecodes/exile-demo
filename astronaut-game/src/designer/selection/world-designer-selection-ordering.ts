import { MapBlock } from '../../world/map.js';
import type { DesignerCategory, Selection } from '../core/world-designer-types.js';
import type { TeleporterSaveData } from '../../types/index.js';

type WorldDesignerSelectionOrderingDeps = {
    getSelectedItems: () => Selection[];
    getCategoryArray: (category: DesignerCategory) => any[];
    getTeleporters: () => TeleporterSaveData[];
    findTeleporterForWorldBlock: (block: MapBlock) => TeleporterSaveData | null;
    getButtons: () => Array<{ linkedTeleporters?: string[] }>;
    runMutation: (message: string, mutate: () => void) => void;
};

export function createWorldDesignerSelectionOrdering(deps: WorldDesignerSelectionOrderingDeps) {
    const {
        getSelectedItems,
        getCategoryArray,
        getTeleporters,
        findTeleporterForWorldBlock,
        getButtons,
        runMutation
    } = deps;

    function removeTeleportersForSelections(selections: Selection[]) {
        const teleporterIdsToRemove = new Set<string>();
        for (const selection of selections) {
            if (selection.category !== 'world') {
                continue;
            }
            const block = selection.entity as MapBlock;
            if (block.type !== 'teleporter' && block.type !== 'teleporter_pad') {
                continue;
            }
            const teleporter = findTeleporterForWorldBlock(block);
            if (teleporter?.id) {
                teleporterIdsToRemove.add(teleporter.id);
            }
        }
        if (teleporterIdsToRemove.size === 0) {
            return;
        }
        const teleporters = getTeleporters();
        for (let index = teleporters.length - 1; index >= 0; index -= 1) {
            if (teleporterIdsToRemove.has(teleporters[index].id)) {
                teleporters.splice(index, 1);
            }
        }
        for (const button of getButtons()) {
            if (!Array.isArray(button.linkedTeleporters) || button.linkedTeleporters.length === 0) {
                continue;
            }
            button.linkedTeleporters = button.linkedTeleporters.filter((id) => !teleporterIdsToRemove.has(id));
        }
    }

    function removeSelectedFromArray(selections: Selection[] = getSelectedItems()) {
        for (const selection of selections) {
            const arr = getCategoryArray(selection.category);
            const index = arr.indexOf(selection.entity);
            if (index >= 0) {
                arr.splice(index, 1);
            }
        }
    }

    function reorderSelections(toFront: boolean) {
        const selections = getSelectedItems();
        if (selections.length === 0) {
            return;
        }

        runMutation(toFront ? 'Brought selection to front.' : 'Sent selection to back.', () => {
            const selectedByCategory = new Map<DesignerCategory, Set<any>>();
            for (const selection of selections) {
                let categorySet = selectedByCategory.get(selection.category);
                if (!categorySet) {
                    categorySet = new Set<any>();
                    selectedByCategory.set(selection.category, categorySet);
                }
                categorySet.add(selection.entity);
            }

            for (const [category, selectedEntities] of selectedByCategory) {
                const arr = getCategoryArray(category);
                const selectedInOrder = arr.filter((entity) => selectedEntities.has(entity));
                if (selectedInOrder.length === 0 || selectedInOrder.length === arr.length) {
                    continue;
                }
                const unselectedInOrder = arr.filter((entity) => !selectedEntities.has(entity));
                arr.splice(
                    0,
                    arr.length,
                    ...(toFront
                        ? [...unselectedInOrder, ...selectedInOrder]
                        : [...selectedInOrder, ...unselectedInOrder])
                );
            }
        });
    }

    return {
        removeTeleportersForSelections,
        removeSelectedFromArray,
        reorderSelections
    };
}
