import { MapBlock } from '../../world/map.js';
import { createWorldDesignerSelectionOrdering } from './world-designer-selection-ordering.js';

import type { DesignerCategory, Selection } from '../core/world-designer-types.js';
import type { TeleporterSaveData } from '../../types/index.js';

type WorldDesignerSelectionOrderingControllerDeps = {
    getSelectedItems: () => Selection[];
    getCategoryArray: (category: DesignerCategory) => any[];
    getTeleporters: () => TeleporterSaveData[];
    findTeleporterForWorldBlock: (block: MapBlock) => TeleporterSaveData | null;
    getButtons: () => Array<{ linkedTeleporters?: string[] }>;
    runMutation: (message: string, mutate: () => void) => void;
};

export function createWorldDesignerSelectionOrderingController(deps: WorldDesignerSelectionOrderingControllerDeps) {
    let selectionOrderingApi: ReturnType<typeof createWorldDesignerSelectionOrdering> | null = null;

    function ensureSelectionOrderingApi() {
        if (!selectionOrderingApi) {
            selectionOrderingApi = createWorldDesignerSelectionOrdering(deps);
        }
        return selectionOrderingApi;
    }

    function removeTeleportersForSelections(selections: Selection[]) {
        ensureSelectionOrderingApi().removeTeleportersForSelections(selections);
    }

    function removeSelectedFromArray(selections: Selection[] = deps.getSelectedItems()) {
        ensureSelectionOrderingApi().removeSelectedFromArray(selections);
    }

    function reorderSelections(toFront: boolean) {
        ensureSelectionOrderingApi().reorderSelections(toFront);
    }

    return {
        removeTeleportersForSelections,
        removeSelectedFromArray,
        reorderSelections
    };
}
