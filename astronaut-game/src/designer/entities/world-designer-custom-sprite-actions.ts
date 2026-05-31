import { MapBlock } from '../../world/map.js';
import type { CreatureSaveData } from '../../types/index.js';

import type {
    ButtonSaveData,
    CollectableSaveData,
    CustomSpriteDefinition,
    CustomSpriteInstance,
    DoorSaveData,
    RuntimeDesignerCategory,
    Selection
} from '../core/world-designer-types.js';

type WorldDesignerCustomSpriteActionsDeps = {
    state: {
        selection: Selection | null;
        typeByCategory: { custom: string };
        customSpriteDefinitions: CustomSpriteDefinition[];
        customSpriteInstances: CustomSpriteInstance[];
    };
    setSelections: (selections: Selection[], primary?: Selection | null) => void;
    getSelectedItems: () => Selection[];
    getSelectionsInDrawOrder: (selections: Selection[]) => Selection[];
    setStatus: (message: string, tone?: 'neutral' | 'success' | 'error') => void;
    runMutation: (message: string, mutate: () => void) => void;
    serializeSelectionEntity: (selection: Selection) => any;
    removeSelectedFromArray: (selections?: Selection[]) => void;
    createSelectionEntity: (category: RuntimeDesignerCategory, data: any) => any;
    getCategoryArray: (category: RuntimeDesignerCategory | 'custom') => any[];
    deepClone: <T>(value: T) => T;
    createCustomSpriteInstance: (definition: CustomSpriteDefinition, x: number, y: number) => CustomSpriteInstance;
};

export function createWorldDesignerCustomSpriteActions(deps: WorldDesignerCustomSpriteActionsDeps) {
    const {
        state,
        setSelections,
        getSelectedItems,
        getSelectionsInDrawOrder,
        setStatus,
        runMutation,
        serializeSelectionEntity,
        removeSelectedFromArray,
        createSelectionEntity,
        getCategoryArray,
        deepClone,
        createCustomSpriteInstance
    } = deps;

    function getCustomSpriteDefinitionById(id: string | null | undefined) {
        if (!id) {
            return null;
        }
        return state.customSpriteDefinitions.find((definition) => definition.id === id) ?? null;
    }

    function getCustomSpriteDefinitionForInstance(instance: CustomSpriteInstance) {
        return getCustomSpriteDefinitionById(instance.customSpriteId);
    }

    function createCustomSpriteName() {
        let index = state.customSpriteDefinitions.length + 1;
        let candidate = `Custom sprite ${index}`;
        const existing = new Set(state.customSpriteDefinitions.map((definition) => definition.name));
        while (existing.has(candidate)) {
            index += 1;
            candidate = `Custom sprite ${index}`;
        }
        return candidate;
    }

    function renameCustomSpriteDefinition(definition: CustomSpriteDefinition, nextName: string) {
        definition.name = nextName;
        for (const instance of state.customSpriteInstances) {
            if (instance.customSpriteId === definition.id) {
                instance.type = nextName;
            }
        }
    }

    function deleteCustomSpriteDefinition(definitionId: string) {
        state.customSpriteDefinitions = state.customSpriteDefinitions.filter((definition) => definition.id !== definitionId);
        state.customSpriteInstances = state.customSpriteInstances.filter((instance) => instance.customSpriteId !== definitionId);
        if (state.typeByCategory.custom === definitionId) {
            state.typeByCategory.custom = state.customSpriteDefinitions[0]?.id ?? '';
        }
        if (state.selection?.category === 'custom' && state.selection.entity.customSpriteId === definitionId) {
            setSelections([]);
        }
    }

    function canGroupSelections(selections = getSelectedItems()) {
        return selections.length > 1 && selections.every((selection) => selection.category !== 'custom');
    }

    function groupSelectionsAsCustomSprite() {
        const selections = getSelectionsInDrawOrder(getSelectedItems());
        if (!canGroupSelections(selections)) {
            setStatus('Select at least two non-custom objects to group them into a custom sprite.', 'error');
            return;
        }
        runMutation('Grouped selection as a custom sprite.', () => {
            const anchorX = Math.min(...selections.map((selection) => Math.round(selection.entity.x)));
            const anchorY = Math.min(...selections.map((selection) => Math.round(selection.entity.y)));
            const definition: CustomSpriteDefinition = {
                id: `custom-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
                name: createCustomSpriteName(),
                members: selections.map((selection) => ({
                    category: selection.category as RuntimeDesignerCategory,
                    offsetX: Math.round(selection.entity.x) - anchorX,
                    offsetY: Math.round(selection.entity.y) - anchorY,
                    data: serializeSelectionEntity(selection) as MapBlock | ButtonSaveData | DoorSaveData | CreatureSaveData | CollectableSaveData
                }))
            };
            state.customSpriteDefinitions.push(definition);
            removeSelectedFromArray();
            const instance = createCustomSpriteInstance(definition, anchorX, anchorY);
            state.customSpriteInstances.push(instance);
            state.typeByCategory.custom = definition.id;
            setSelections([{ category: 'custom', entity: instance }]);
        });
    }

    function ungroupCustomSpriteSelection() {
        if (!state.selection || state.selection.category !== 'custom') {
            setStatus('Select a custom sprite to ungroup it.', 'error');
            return;
        }
        const instance = state.selection.entity as CustomSpriteInstance;
        const definition = getCustomSpriteDefinitionForInstance(instance);
        if (!definition) {
            setStatus('This custom sprite definition is missing.', 'error');
            return;
        }
        runMutation('Ungrouped custom sprite.', () => {
            const customInstances = getCategoryArray('custom');
            const instanceIndex = customInstances.indexOf(instance);
            if (instanceIndex >= 0) {
                customInstances.splice(instanceIndex, 1);
            }
            const restoredSelections: Selection[] = [];
            for (const member of definition.members) {
                const clone = deepClone(member.data);
                clone.x = Math.round(instance.x + member.offsetX);
                clone.y = Math.round(instance.y + member.offsetY);
                const entity = createSelectionEntity(member.category, clone);
                getCategoryArray(member.category).push(entity);
                restoredSelections.push({ category: member.category, entity });
            }
            setSelections(restoredSelections, restoredSelections[0] ?? null);
        });
    }

    function deleteCustomSpriteSelectionDefinition() {
        if (!state.selection || state.selection.category !== 'custom') {
            setStatus('Select a custom sprite to delete its saved type.', 'error');
            return;
        }
        const instance = state.selection.entity as CustomSpriteInstance;
        const definition = getCustomSpriteDefinitionForInstance(instance);
        if (!definition) {
            setStatus('This custom sprite definition is missing.', 'error');
            return;
        }
        runMutation('Deleted custom sprite type.', () => {
            deleteCustomSpriteDefinition(definition.id);
        });
    }

    return {
        getCustomSpriteDefinitionById,
        getCustomSpriteDefinitionForInstance,
        createCustomSpriteName,
        renameCustomSpriteDefinition,
        canGroupSelections,
        groupSelectionsAsCustomSprite,
        ungroupCustomSpriteSelection,
        deleteCustomSpriteSelectionDefinition
    };
}
