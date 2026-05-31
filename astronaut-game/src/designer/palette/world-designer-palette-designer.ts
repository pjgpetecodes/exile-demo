import { clamp, deepClone } from '../core/world-designer-helpers.js';
import { serializeWorldData, stableStringify } from '../core/world-designer-serialization.js';

import type { PaletteDefinition, RawWorldData, WorldDesignerHost } from '../core/world-designer-types.js';

type PaletteDesignerState = {
    palette: number;
    selectedPaletteIndex: number;
    paletteDesignerOpen: boolean;
    active: boolean;
    palettePreviewType: string;
    paletteDefinitions: PaletteDefinition[];
    lastSavedPaletteDefinitions: PaletteDefinition[];
    dirty: boolean;
    selection: unknown | null;
    selectedItems: unknown[];
    lastSavedSnapshot: RawWorldData;
};

type PaletteDesignerRefs = {
    palettePreviewCanvas: HTMLCanvasElement;
    paletteUsage: HTMLDivElement;
    paletteMappings: HTMLDivElement;
    paletteFlyout: HTMLDivElement;
    paletteDesignerToggle: HTMLButtonElement;
    palettePreviewTypeSelect: HTMLSelectElement;
    paletteList: HTMLSelectElement;
    paletteCloneButton: HTMLButtonElement;
    paletteDeleteButton: HTMLButtonElement;
};

type PaletteDesignerHost = Pick<
WorldDesignerHost,
'getRawWorldData' | 'drawCustomPalettePreview' | 'savePaletteDefinitions' | 'replaceRawWorldData'
>;

type PaletteDesignerContext = {
    state: PaletteDesignerState;
    refs: PaletteDesignerRefs;
    host: PaletteDesignerHost;
    colorAliasNames: string[];
    getPaletteCount: () => number;
    setPaletteCount: (value: number) => void;
    getWorldSnapshot: () => RawWorldData;
    refreshSelectOptions: () => void;
    refreshPanel: () => void;
    updateDirtyState: () => void;
    syncEditModeSnapshot: () => void;
    setStatus: (message: string, tone?: 'neutral' | 'success' | 'error') => void;
};

export function createWorldDesignerPaletteDesigner(context: PaletteDesignerContext) {
    const { state, refs, host } = context;

    function syncPaletteCount() {
        const paletteCount = Math.max(state.paletteDefinitions.length, 1);
        context.setPaletteCount(paletteCount);
        state.palette = clamp(state.palette, 0, paletteCount - 1);
        state.selectedPaletteIndex = clamp(state.selectedPaletteIndex, 0, paletteCount - 1);
    }

    function paletteDefinitionsEqual(left: PaletteDefinition[], right: PaletteDefinition[]) {
        return stableStringify(left) === stableStringify(right);
    }

    function getPaletteUsageCounts() {
        const usageCounts = Array.from({ length: context.getPaletteCount() }, () => 0);
        const addUsage = (value?: number | null) => {
            if (typeof value !== 'number' || value < 0 || value >= usageCounts.length) return;
            usageCounts[value] += 1;
        };
        const data = host.getRawWorldData();
        for (const block of data.worldMap) addUsage(typeof block.palette === 'number' ? block.palette : 0);
        for (const button of data.buttons) {
            addUsage(typeof button.palette === 'number' ? button.palette : 0);
            addUsage(typeof button.boxPalette === 'number' ? button.boxPalette : null);
        }
        for (const door of data.doors) {
            addUsage(typeof door.palette === 'number' ? door.palette : 0);
            addUsage(typeof door.palette_locked === 'number' ? door.palette_locked : null);
            addUsage(typeof door.palette_unlocked === 'number' ? door.palette_unlocked : null);
        }
        for (const creature of data.creatures) addUsage(typeof creature.palette === 'number' ? creature.palette : 0);
        for (const collectable of data.collectables) addUsage(typeof collectable.palette === 'number' ? collectable.palette : 0);
        return usageCounts;
    }

    function shiftPaletteReferences(snapshot: RawWorldData, removedIndex: number) {
        const adjust = (value?: number | null) => {
            if (typeof value !== 'number') return value;
            return value > removedIndex ? value - 1 : value;
        };
        const nextSnapshot = deepClone(snapshot);
        nextSnapshot.worldMap.forEach((block) => {
            if (typeof block.palette === 'number') {
                block.palette = adjust(block.palette) as number;
            }
        });
        nextSnapshot.buttons.forEach((button) => {
            if (typeof button.palette === 'number') button.palette = adjust(button.palette) as number;
            if (typeof button.boxPalette === 'number') button.boxPalette = adjust(button.boxPalette) as number;
        });
        nextSnapshot.doors.forEach((door) => {
            if (typeof door.palette === 'number') door.palette = adjust(door.palette) as number;
            if (typeof door.palette_locked === 'number') door.palette_locked = adjust(door.palette_locked) as number;
            if (typeof door.palette_unlocked === 'number') door.palette_unlocked = adjust(door.palette_unlocked) as number;
        });
        nextSnapshot.creatures.forEach((creature) => {
            if (typeof creature.palette === 'number') creature.palette = adjust(creature.palette) as number;
        });
        nextSnapshot.collectables.forEach((collectable) => {
            if (typeof collectable.palette === 'number') collectable.palette = adjust(collectable.palette) as number;
        });
        return nextSnapshot;
    }

    function renderPalettePreview() {
        const paletteDefinition = state.paletteDefinitions[state.selectedPaletteIndex] ?? [];
        const ctx = refs.palettePreviewCanvas.getContext('2d');
        if (!ctx) return;
        host.drawCustomPalettePreview(ctx, state.palettePreviewType, paletteDefinition, 1, true);
    }

    function updatePaletteUsageSummary() {
        const usageCounts = getPaletteUsageCounts();
        const selectedUsage = usageCounts[state.selectedPaletteIndex] ?? 0;
        refs.paletteUsage.textContent = `Palette ${state.selectedPaletteIndex} — ${selectedUsage} object${selectedUsage === 1 ? '' : 's'} currently use this index.${paletteDefinitionsEqual(state.paletteDefinitions, state.lastSavedPaletteDefinitions) ? '' : ' Unsaved palette changes.'}`;
    }

    function renderPaletteMappings() {
        refs.paletteMappings.innerHTML = '';
        const paletteDefinition = state.paletteDefinitions[state.selectedPaletteIndex] ?? [];
        for (const [index, entry] of paletteDefinition.entries()) {
            const row = document.createElement('div');
            row.className = 'world-designer-palette-row';

            const fromField = document.createElement('label');
            fromField.className = 'world-designer-field';
            fromField.textContent = 'Base color';
            const fromSelect = document.createElement('select');
            fromSelect.innerHTML = context.colorAliasNames.map((name) => `<option value="${name}">${name}</option>`).join('');
            fromSelect.value = entry.from;
            fromSelect.addEventListener('change', () => {
                paletteDefinition[index].from = fromSelect.value;
                renderPalettePreview();
                updatePaletteUsageSummary();
            });
            fromField.appendChild(fromSelect);

            const toField = document.createElement('label');
            toField.className = 'world-designer-field';
            toField.textContent = 'New color';
            const toSelect = document.createElement('select');
            toSelect.innerHTML = context.colorAliasNames.map((name) => `<option value="${name}">${name}</option>`).join('');
            toSelect.value = entry.to;
            toSelect.addEventListener('change', () => {
                paletteDefinition[index].to = toSelect.value;
                renderPalettePreview();
                updatePaletteUsageSummary();
            });
            toField.appendChild(toSelect);

            const removeButton = document.createElement('button');
            removeButton.type = 'button';
            removeButton.textContent = 'Remove';
            removeButton.addEventListener('click', () => {
                paletteDefinition.splice(index, 1);
                refreshPaletteDesigner();
            });

            row.appendChild(fromField);
            row.appendChild(toField);
            row.appendChild(removeButton);
            refs.paletteMappings.appendChild(row);
        }
    }

    function refreshPaletteDesigner() {
        syncPaletteCount();
        const usageCounts = getPaletteUsageCounts();
        refs.paletteFlyout.classList.toggle('world-designer-flyout-hidden', !state.paletteDesignerOpen || !state.active);
        refs.paletteDesignerToggle.textContent = state.paletteDesignerOpen ? 'Palettes ✓' : 'Palettes';
        refs.palettePreviewTypeSelect.value = state.palettePreviewType;
        refs.paletteList.innerHTML = state.paletteDefinitions
            .map((_, index) => `<option value="${index}">Palette ${index} (${usageCounts[index] ?? 0} use${(usageCounts[index] ?? 0) === 1 ? '' : 's'})</option>`)
            .join('');
        refs.paletteList.value = String(state.selectedPaletteIndex);
        refs.paletteCloneButton.disabled = state.paletteDefinitions.length === 0;
        refs.paletteDeleteButton.disabled = state.paletteDefinitions.length <= 1;
        renderPaletteMappings();
        renderPalettePreview();
        updatePaletteUsageSummary();
    }

    function createNewPalette() {
        state.paletteDefinitions.push([]);
        syncPaletteCount();
        state.selectedPaletteIndex = state.paletteDefinitions.length - 1;
        state.palette = clamp(state.palette, 0, context.getPaletteCount() - 1);
        context.refreshSelectOptions();
        refreshPaletteDesigner();
        context.refreshPanel();
    }

    function cloneSelectedPalette() {
        const paletteDefinition = state.paletteDefinitions[state.selectedPaletteIndex];
        if (!paletteDefinition) return;
        state.paletteDefinitions.push(deepClone(paletteDefinition));
        syncPaletteCount();
        state.selectedPaletteIndex = state.paletteDefinitions.length - 1;
        context.refreshSelectOptions();
        refreshPaletteDesigner();
        context.refreshPanel();
    }

    async function deleteSelectedPalette() {
        if (state.paletteDefinitions.length <= 1) {
            context.setStatus('At least one palette must remain.', 'error');
            return;
        }
        const usageCounts = getPaletteUsageCounts();
        const removedIndex = state.selectedPaletteIndex;
        if ((usageCounts[removedIndex] ?? 0) > 0) {
            context.setStatus('Cannot delete a palette that is currently in use.', 'error');
            return;
        }

        let worldDataToSave: RawWorldData | undefined;
        if (removedIndex < state.paletteDefinitions.length - 1) {
            if (state.dirty) {
                context.setStatus('Save world changes before deleting a middle palette.', 'error');
                return;
            }
            worldDataToSave = shiftPaletteReferences(context.getWorldSnapshot(), removedIndex);
        }

        const nextPaletteDefinitions = state.paletteDefinitions.filter((_, index) => index !== removedIndex);
        try {
            context.setStatus('Saving palette changes...', 'neutral');
            await host.savePaletteDefinitions(nextPaletteDefinitions, worldDataToSave);
            state.paletteDefinitions = deepClone(nextPaletteDefinitions);
            state.lastSavedPaletteDefinitions = deepClone(nextPaletteDefinitions);
            if (worldDataToSave) {
                host.replaceRawWorldData(worldDataToSave);
                state.selection = null;
                state.selectedItems = [];
                state.lastSavedSnapshot = serializeWorldData(worldDataToSave);
                context.updateDirtyState();
                context.syncEditModeSnapshot();
            }
            syncPaletteCount();
            state.selectedPaletteIndex = clamp(state.selectedPaletteIndex, 0, context.getPaletteCount() - 1);
            context.refreshSelectOptions();
            refreshPaletteDesigner();
            context.refreshPanel();
            context.setStatus('Deleted palette and saved palette assets.', 'success');
        } catch (error) {
            context.setStatus(
                error instanceof Error ? error.message : 'Failed to delete palette.',
                'error'
            );
        }
    }

    async function savePaletteDesigner() {
        try {
            context.setStatus('Saving palette definitions...', 'neutral');
            await host.savePaletteDefinitions(state.paletteDefinitions);
            state.lastSavedPaletteDefinitions = deepClone(state.paletteDefinitions);
            syncPaletteCount();
            context.refreshSelectOptions();
            refreshPaletteDesigner();
            context.refreshPanel();
            context.setStatus('Saved palette definitions.', 'success');
        } catch (error) {
            context.setStatus(
                error instanceof Error ? error.message : 'Failed to save palette definitions.',
                'error'
            );
        }
    }

    return {
        syncPaletteCount,
        paletteDefinitionsEqual,
        getPaletteUsageCounts,
        renderPalettePreview,
        renderPaletteMappings,
        refreshPaletteDesigner,
        createNewPalette,
        cloneSelectedPalette,
        deleteSelectedPalette,
        savePaletteDesigner
    };
}
