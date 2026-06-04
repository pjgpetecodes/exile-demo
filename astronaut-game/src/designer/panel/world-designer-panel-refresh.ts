import { SPRITE_TRANSLATION_OPTIONS } from '../../shared/utilities.js';

import type {
    DesignerCategory,
    DesignerState,
    PlacementTypeOption
} from '../core/world-designer-types.js';

type WorldDesignerPanelRefreshDeps = {
    refs: any;
    state: DesignerState;
    host: {
        getSoundEnabled: () => boolean;
        getBulletImpactAudioSettings: () => {
            primary: string;
            alternate: string;
            alternateChance: number;
            volume: number;
        };
        getWindRuntimeToggles: () => {
            windEnabled: boolean;
            emittersEnabled: boolean;
            surfaceWindEnabled: boolean;
            windVfxEnabled: boolean;
        };
        getShowCreatureOverlays: () => boolean;
        getShowSpriteOutlines: () => boolean;
        getPerformanceHudEnabled: () => boolean;
    };
    paletteCount: () => number;
    spriteTypes: string[];
    getSingleEditableSelection: () => any;
    getPlacementTypeOptions: (category: DesignerCategory, includeComposite: boolean) => PlacementTypeOption[];
    formatSpriteTranslation: (value: any) => string;
    categorySupportsTranslation: (category: DesignerCategory) => boolean;
    getCurrentType: () => string;
    setCurrentType: (type: string) => void;
    renderCurrentSpritePreview: () => void;
    renderSpritePickerGrid: () => void;
    updateSelectionSummary: () => void;
    refreshInspector: () => void;
    restorePendingInspectorFocus: () => void;
    refreshPaletteDesigner: () => void;
    refreshStatus: () => void;
    persistDesignerUiState: () => void;
};

export function createWorldDesignerPanelRefresh(deps: WorldDesignerPanelRefreshDeps) {
    const {
        refs,
        state,
        host,
        paletteCount,
        spriteTypes,
        getSingleEditableSelection,
        getPlacementTypeOptions,
        formatSpriteTranslation,
        categorySupportsTranslation,
        getCurrentType,
        setCurrentType,
        renderCurrentSpritePreview,
        renderSpritePickerGrid,
        updateSelectionSummary,
        refreshInspector,
        restorePendingInspectorFocus,
        refreshPaletteDesigner,
        refreshStatus,
        persistDesignerUiState
    } = deps;

    function refreshSelectOptions() {
        const editingSelection = getSingleEditableSelection();
        const placementTypeOptions = getPlacementTypeOptions(state.category, !editingSelection);
        const selectableTypes = state.category === 'custom'
            ? state.customSpriteDefinitions.map((definition) => definition.id)
            : placementTypeOptions.map((option) => option.value);
        refs.typeSelect.innerHTML = state.category === 'custom'
            ? state.customSpriteDefinitions
                .map((definition: any) => `<option value="${definition.id}">${definition.name}</option>`)
                .join('')
            : placementTypeOptions
                .map((option) => `<option value="${option.value}">${option.label}</option>`)
                .join('');
        refs.palettePreviewTypeSelect.innerHTML = spriteTypes
            .map((type) => `<option value="${type}">${type}</option>`)
            .join('');
        refs.rotationSelect.innerHTML = Array.from({ length: 9 }, (_, index) => {
            const value = index + 1;
            return `<option value="${value}">${value}</option>`;
        }).join('');
        refs.translationSelect.innerHTML = SPRITE_TRANSLATION_OPTIONS
            .map((value) => `<option value="${value}">${formatSpriteTranslation(value)}</option>`)
            .join('');
        refs.paletteSelect.innerHTML = Array.from({ length: paletteCount() }, (_, index) => {
            return `<option value="${index}">${index}</option>`;
        }).join('');
        refs.spritePickerCategoryFilter.innerHTML = [
            ['all', 'All sprites'],
            ['world', 'World items'],
            ['buttons', 'Buttons'],
            ['doors', 'Doors'],
            ['creatures', 'Creatures'],
            ['collectables', 'Collectables'],
            ['custom', 'Custom sprites']
        ].map(([value, label]) => `<option value="${value}">${label}</option>`).join('');
        if (state.category === 'custom' && !selectableTypes.includes(state.typeByCategory.custom)) {
            state.typeByCategory.custom = selectableTypes[0] ?? '';
        }
        if (state.category !== 'custom' && !selectableTypes.includes(state.typeByCategory[state.category])) {
            state.typeByCategory[state.category] = selectableTypes[0] ?? '';
        }
    }

    function refreshPanel() {
        refreshSelectOptions();
        refs.root.classList.toggle('world-designer-hidden', !state.active);
        refs.activeToggle.textContent = state.active ? 'Hide panel' : 'Show panel';
        refs.expandViewportCheckbox.checked = state.viewportExpanded;
        refs.soundEnabledCheckbox.checked = host.getSoundEnabled();
        const bulletImpactAudioSettings = host.getBulletImpactAudioSettings();
        refs.bulletImpactPrimarySelect.value = bulletImpactAudioSettings.primary;
        refs.bulletImpactAlternateSelect.value = bulletImpactAudioSettings.alternate;
        refs.bulletImpactAlternateChanceInput.value = bulletImpactAudioSettings.alternateChance.toFixed(2);
        refs.bulletImpactVolumeInput.value = bulletImpactAudioSettings.volume.toFixed(2);
        const windToggles = host.getWindRuntimeToggles();
        refs.windEnabledCheckbox.checked = windToggles.windEnabled;
        refs.windEmittersEnabledCheckbox.checked = windToggles.emittersEnabled;
        refs.windSurfaceEnabledCheckbox.checked = windToggles.surfaceWindEnabled;
        refs.windVfxEnabledCheckbox.checked = windToggles.windVfxEnabled;
        refs.modeSelect.value = state.mode;
        refs.toolSelect.value = state.tool;
        refs.categorySelect.value = state.category;
        refs.rotationSelect.value = String(state.rotation);
        refs.translationSelect.value = state.translation;
        refs.paletteSelect.value = String(state.palette);
        refs.translationSelect.disabled = !categorySupportsTranslation(state.category) && !categorySupportsTranslation(state.selection?.category ?? 'custom');
        refs.rotationSelect.disabled = state.category === 'custom';
        refs.paletteSelect.disabled = state.category === 'custom';
        refs.snapCheckbox.checked = state.snapToGrid;
        refs.objectSnapCheckbox.checked = state.objectSnapEnabled;
        refs.snapOffsetXInput.value = String(state.snapOffsetX);
        refs.snapOffsetYInput.value = String(state.snapOffsetY);
        refs.nudgeInput.value = String(state.nudgeAmount);
        refs.showCollisionCheckbox.checked = state.showCollisionOverlay;
        refs.showCreatureOverlaysCheckbox.checked = host.getShowCreatureOverlays();
        refs.showSpriteOutlineCheckbox.checked = host.getShowSpriteOutlines();
        refs.showPerformanceHudCheckbox.checked = host.getPerformanceHudEnabled();
        refs.magnifierCheckbox.checked = state.magnifierEnabled;
        refs.disablePreviewCollisionCheckbox.checked = state.disableCollisionInPreview;
        refs.disablePreviewCollisionCheckbox.disabled = state.mode !== 'preview';
        refs.spritePicker.open = state.spritePickerOpen;
        refs.spritePickerFilter.value = state.spritePickerFilter;
        refs.spritePickerCategoryFilter.value = state.spritePickerCategoryFilter;
        refs.spritePickerCategoryFilter.disabled = state.spritePickerFilter.trim().length > 0;

        for (const [category, checkbox] of Object.entries(refs.layerCheckboxes) as Array<[DesignerCategory, HTMLInputElement]>) {
            checkbox.checked = state.layerVisibility[category];
        }

        setCurrentType(getCurrentType());
        renderCurrentSpritePreview();
        renderSpritePickerGrid();
        updateSelectionSummary();
        refreshInspector();
        restorePendingInspectorFocus();
        refreshPaletteDesigner();
        refreshStatus();
        persistDesignerUiState();
    }

    return {
        refreshSelectOptions,
        refreshPanel
    };
}
