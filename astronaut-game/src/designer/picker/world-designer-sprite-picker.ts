type PickerEntry = {
    key: string;
    name: string;
    label: string;
    category: string;
    previewType?: string;
};

export function renderWorldDesignerSpritePickerGrid(context: {
    state: any;
    host: any;
    refs: any;
    spriteTypes: string[];
    spriteCatalog: Array<{ name: string }>;
    spritePickerButtons: Map<string, HTMLButtonElement>;
    teleporterCompositeType: string;
    buttonCompositeType: string;
    getCurrentType: () => string;
    setCurrentType: (type: string) => void;
    refreshPanel: () => void;
    setStatus: (message: string, tone?: 'neutral' | 'success' | 'error') => void;
    isTeleporterCompositeType: (type: string) => boolean;
    renderCustomSpritePreviewCanvas: (canvas: HTMLCanvasElement, definition: any) => void;
    getCustomSpriteDefinitionById: (id: string) => any;
    renderSpritePreviewCanvas: (
        canvas: HTMLCanvasElement,
        type: string,
        palette: number,
        rotation: number,
        translation?: any
    ) => boolean;
}) {
    const {
        state,
        host,
        refs,
        spriteTypes,
        spriteCatalog,
        spritePickerButtons,
        teleporterCompositeType,
        buttonCompositeType,
        getCurrentType,
        setCurrentType,
        refreshPanel,
        setStatus,
        isTeleporterCompositeType,
        renderCustomSpritePreviewCanvas,
        getCustomSpriteDefinitionById,
        renderSpritePreviewCanvas
    } = context;

    const currentType = getCurrentType();
    const filter = state.spritePickerFilter.trim().toLowerCase();
    const activeCategoryFilter = filter.length > 0 ? 'all' : state.spritePickerCategoryFilter;
    const compositePickerEntries: PickerEntry[] = [];
    if (
        state.category === 'world' ||
        activeCategoryFilter === 'all' ||
        activeCategoryFilter === 'world'
    ) {
        compositePickerEntries.push({
            key: `sprite:${teleporterCompositeType}`,
            name: teleporterCompositeType,
            label: 'teleporter (composite)',
            category: 'world',
            previewType: 'teleporter'
        });
    }
    if (
        state.category === 'buttons' ||
        activeCategoryFilter === 'all' ||
        activeCategoryFilter === 'buttons'
    ) {
        compositePickerEntries.push({
            key: `sprite:${buttonCompositeType}`,
            name: buttonCompositeType,
            label: 'button (composite)',
            category: 'buttons',
            previewType: 'button'
        });
    }
    const spriteCategorySets = (() => {
        const data = host.getRawWorldData();
        const buttons = new Set<string>(['button', 'button_box']);
        for (const button of data.buttons) {
            if (button.type) buttons.add(button.type);
            if (button.boxType) buttons.add(button.boxType);
        }
        const doors = new Set<string>(data.doors.map((door: any) => door.type));
        const creatures = new Set<string>(data.creatures.map((creature: any) => creature.type));
        const collectables = new Set<string>(data.collectables.map((collectable: any) => collectable.type));
        const world = new Set<string>(spriteTypes.filter((type) =>
            !buttons.has(type) &&
            !doors.has(type) &&
            !creatures.has(type) &&
            !collectables.has(type)
        ));
        return { world, buttons, doors, creatures, collectables };
    })();
    const pickerEntries: PickerEntry[] = state.category === 'custom' || activeCategoryFilter === 'custom'
        ? state.customSpriteDefinitions.map((definition: any) => ({
            key: `custom:${definition.id}`,
            name: definition.id,
            label: definition.name,
            category: 'custom'
        }))
        : [
            ...compositePickerEntries,
            ...spriteCatalog.map((entry) => ({
                key: `sprite:${entry.name}`,
                name: entry.name,
                label: entry.name,
                category: state.category
            }))
        ];
    const activeKeys = new Set(pickerEntries.map((entry) => entry.key));

    for (const entry of pickerEntries) {
        let button = spritePickerButtons.get(entry.key);
        if (!button) {
            button = document.createElement('button');
            button.type = 'button';
            button.className = 'world-designer-sprite-option';
            button.dataset.spriteType = entry.name;

            const canvas = document.createElement('canvas');
            canvas.className = 'world-designer-sprite-canvas';
            canvas.width = 56;
            canvas.height = 56;
            button.appendChild(canvas);

            const label = document.createElement('div');
            label.className = 'world-designer-sprite-option-label';
            label.textContent = entry.label;
            button.appendChild(label);

            button.addEventListener('click', () => {
                state.category = entry.category;
                setCurrentType(entry.name);
                state.spritePickerOpen = false;
                refreshPanel();
            });
            button.addEventListener('mousedown', (event) => {
                if (event.button !== 0) return;
                event.preventDefault();
                state.category = entry.category;
                setCurrentType(entry.name);
                const dragTranslation = (
                    entry.category === 'world' &&
                    isTeleporterCompositeType(entry.name)
                )
                    ? 'center'
                    : state.translation;
                state.pickerDrag = {
                    category: entry.category,
                    type: entry.name,
                    palette: state.palette,
                    rotation: state.rotation,
                    translation: dragTranslation
                };
                state.pickerDragCanvas = null;
                button!.classList.add('dragging');
                setStatus(`Dragging ${entry.label} onto the world to place it.`, 'neutral');
            });

            spritePickerButtons.set(entry.key, button);
            refs.spritePickerGrid.appendChild(button);
        }

        const matchesFilter = filter.length === 0 || entry.label.toLowerCase().includes(filter);
        const categorySet = (spriteCategorySets as Record<string, Set<string>>)[activeCategoryFilter];
        const matchesCategory = state.category === 'custom' ||
            activeCategoryFilter === 'all' ||
            activeCategoryFilter === 'custom' ||
            (entry.name === teleporterCompositeType && activeCategoryFilter === 'world') ||
            (entry.name === buttonCompositeType && activeCategoryFilter === 'buttons') ||
            categorySet?.has(entry.name) === true;
        button.hidden = !matchesFilter;
        button.style.display = matchesFilter && matchesCategory ? '' : 'none';
        button.hidden = !(matchesFilter && matchesCategory);
        button.classList.toggle('selected', entry.name === currentType);
        button.classList.toggle('dragging', state.pickerDrag?.type === entry.name);
        const label = button.querySelector('.world-designer-sprite-option-label');
        if (label instanceof HTMLDivElement) {
            label.textContent = entry.label;
        }
        const canvas = button.querySelector('canvas');
        if (canvas instanceof HTMLCanvasElement) {
            if (entry.category === 'custom') {
                renderCustomSpritePreviewCanvas(canvas, getCustomSpriteDefinitionById(entry.name));
            } else {
                renderSpritePreviewCanvas(
                    canvas,
                    entry.previewType ?? entry.name,
                    state.palette,
                    1,
                    entry.category === 'world' && !isTeleporterCompositeType(entry.name)
                        ? state.translation
                        : 'center'
                );
            }
        }
    }

    for (const [key, button] of spritePickerButtons.entries()) {
        if (activeKeys.has(key)) {
            continue;
        }
        button.style.display = 'none';
        button.hidden = true;
    }
}
