import type { Button } from '../../entities/button.js';
import type { Creature } from '../../entities/creature.js';
import type { DestructionSourceRequirement } from '../../entities/destructibles.js';
import type { SpriteTranslation } from '../../shared/utilities.js';
import type {
    ButtonDefaultOverrides,
    ControlRefs,
    CustomSpriteDefinition,
    CustomSpriteInstance,
    DesignerCategory,
    DesignerState,
    Selection,
    WorldDesignerHost
} from '../core/world-designer-types.js';

type InspectorOption = { value: string; label: string };
type MutationRunner = (description: string, mutate: () => void) => void;

type WorldDesignerInspectorPanelContext = {
    refs: ControlRefs;
    state: DesignerState;
    host: WorldDesignerHost;
    paletteCount: number;
    spriteTypes: string[];
    CATEGORY_LABELS: Record<DesignerCategory, string>;
    SPRITE_TRANSLATION_OPTIONS: readonly SpriteTranslation[];
    BUTTON_DEFAULT_PRESS_OFFSET: number;
    BUTTON_DEFAULT_BOX_OFFSET_X: number;
    BUTTON_DEFAULT_BOX_OFFSET_Y: number;
    MOVEMENT_SETTINGS: {
        plasmaGrenadeExplosionRadius: number;
        grenadeExplosionRadius: number;
    };
    DESTRUCTION_SOURCE_OPTIONS: InspectorOption[];
    CREATURE_SOUND_MANIFEST: Array<{ key: string; label: string }>;
    getSelectedItems: () => Selection[];
    getAstronautStartPosition: () => { x: number; y: number };
    getConvertTargetCategories: (selection: Selection) => DesignerCategory[];
    getEffectiveButtonDefaultOverrides: () => Required<ButtonDefaultOverrides>;
    runMutation: MutationRunner;
    clamp: (value: number, min: number, max: number) => number;
    setButtonDefaultOverridesFromButton: (button: Button) => void;
    resetButtonDefaultOverrides: () => void;
    addCheckboxInspector: (
        container: HTMLElement,
        label: string,
        checked: boolean,
        onChange: (checked: boolean) => void
    ) => void;
    addTextInspector: (
        container: HTMLElement,
        label: string,
        value: string,
        onCommit: (value: string) => void,
        multiline?: boolean
    ) => void;
    addNumberInspector: (
        container: HTMLElement,
        label: string,
        value: number,
        onCommit: (value: number) => void,
        step?: number
    ) => void;
    addSelectInspector: (
        container: HTMLElement,
        label: string,
        value: string,
        options: string[],
        onCommit: (value: string) => void
    ) => void;
    addOptionSelectInspector: (
        container: HTMLElement,
        label: string,
        value: string,
        options: InspectorOption[],
        onCommit: (value: string) => void
    ) => void;
    addInspectorAction: (
        container: HTMLElement,
        label: string,
        onClick: () => void
    ) => void;
    getCustomSpriteDefinitionForInstance: (instance: CustomSpriteInstance) => CustomSpriteDefinition | null;
    createCustomSpriteName: () => string;
    renameCustomSpriteDefinition: (definition: CustomSpriteDefinition, nextName: string) => void;
    deleteCustomSpriteSelectionDefinition: () => void;
    applyEntityPositionWithTeleporterSync: (entity: any, x: number, y: number) => void;
    applyEntityRotationWithTeleporterSync: (entity: any, rotation: number) => void;
    normalizeRotation: (value: number | undefined) => number;
    categorySupportsTranslation: (category: DesignerCategory) => boolean;
    normalizeSpriteTranslation: (value: string | undefined) => SpriteTranslation;
    getEffectivePaletteCycle: (
        type: string,
        paletteCycle: any,
        paletteCount: number
    ) => { palettes: number[]; intervalMs: number } | undefined;
    buildDefaultPaletteCycle: (palette: number, paletteCount: number) => { palettes: number[]; intervalMs: number };
    parsePaletteCyclePalettes: (value: string, paletteCount: number) => number[];
    shouldMaskAstronaut: (entity: any) => boolean;
    findTeleporterForWorldBlock: (entity: any) => any;
    convertWorldTeleporterBlock: (entity: any) => void;
    renameTeleporterId: (teleporter: any, value: string) => void;
    setStatus: (message: string, tone?: 'neutral' | 'success' | 'error') => void;
    getDefaultDestructibleEnabled: (category: 'world' | 'doors', type: string) => boolean;
    getDefaultDestructibleHealth: (category: 'world' | 'doors', type: string) => number;
    getDefaultDestructionSource: (category: 'world' | 'doors', type: string) => string;
    parseDoorIds: (value: string) => number[];
    parseStringIds: (value: string) => string[];
    isTeleporterMode: (value: string) => boolean;
    getButtonCapOffsetsRelativeToBox: (entity: any, open: boolean) => { x: number; y: number };
    stableStringify: (value: unknown) => string;
    getDefaultCollectableWeight: (type: string, radioactive: boolean) => number;
    getDefaultCollectablePaletteCycle: (
        type: string,
        palette: number,
        paletteCount: number,
        radioactive: boolean
    ) => unknown;
    isGrenadeCollectableType: (type: string) => boolean;
    getDefaultGrenadeExplosionPower: (type: string) => number | undefined;
};

export function createWorldDesignerInspectorPanel(context: WorldDesignerInspectorPanelContext) {
    const {
        refs,
        state,
        host,
        paletteCount,
        spriteTypes,
        CATEGORY_LABELS,
        SPRITE_TRANSLATION_OPTIONS,
        BUTTON_DEFAULT_PRESS_OFFSET,
        BUTTON_DEFAULT_BOX_OFFSET_X,
        BUTTON_DEFAULT_BOX_OFFSET_Y,
        MOVEMENT_SETTINGS,
        DESTRUCTION_SOURCE_OPTIONS,
        CREATURE_SOUND_MANIFEST,
        getSelectedItems,
        getAstronautStartPosition,
        getConvertTargetCategories,
        getEffectiveButtonDefaultOverrides,
        runMutation,
        clamp,
        setButtonDefaultOverridesFromButton,
        resetButtonDefaultOverrides,
        addCheckboxInspector,
        addTextInspector,
        addNumberInspector,
        addSelectInspector,
        addOptionSelectInspector,
        addInspectorAction,
        getCustomSpriteDefinitionForInstance,
        createCustomSpriteName,
        renameCustomSpriteDefinition,
        deleteCustomSpriteSelectionDefinition,
        applyEntityPositionWithTeleporterSync,
        applyEntityRotationWithTeleporterSync,
        normalizeRotation,
        categorySupportsTranslation,
        normalizeSpriteTranslation,
        getEffectivePaletteCycle,
        buildDefaultPaletteCycle,
        parsePaletteCyclePalettes,
        shouldMaskAstronaut,
        findTeleporterForWorldBlock,
        convertWorldTeleporterBlock,
        renameTeleporterId,
        setStatus,
        getDefaultDestructibleEnabled,
        getDefaultDestructibleHealth,
        getDefaultDestructionSource,
        parseDoorIds,
        parseStringIds,
        isTeleporterMode,
        getButtonCapOffsetsRelativeToBox,
        stableStringify,
        getDefaultCollectableWeight,
        getDefaultCollectablePaletteCycle,
        isGrenadeCollectableType,
        getDefaultGrenadeExplosionPower
    } = context;

    function updateSelectionSummary() {
        const resetConvertControls = () => {
            refs.convertTargetSelect.innerHTML = '';
            const placeholder = document.createElement('option');
            placeholder.value = '';
            placeholder.textContent = 'No conversion available';
            refs.convertTargetSelect.appendChild(placeholder);
            refs.convertTargetSelect.value = '';
            refs.convertTargetSelect.disabled = true;
            refs.convertButton.disabled = true;
            refs.convertButton.textContent = 'Convert';
        };
        const selections = getSelectedItems();
        if (selections.length === 0) {
            const astronautStart = getAstronautStartPosition();
            refs.selectionSummary.textContent = `Nothing selected. Astronaut start: (${astronautStart.x}, ${astronautStart.y})`;
            resetConvertControls();
            refs.deleteButton.disabled = true;
            refs.duplicateButton.disabled = true;
            refs.sendToBackButton.disabled = true;
            refs.bringToFrontButton.disabled = true;
            refs.focusButton.disabled = true;
            return;
        }
        if (selections.length > 1) {
            refs.selectionSummary.textContent = `${selections.length} objects selected. Drag any selected object to move the group, or right-click to group them as a custom sprite.`;
            refs.selectionSummary.textContent = `${selections.length} objects selected. Drag any selected object to move the group, or right-click to group them as a custom sprite.`;
            resetConvertControls();
            refs.deleteButton.disabled = false;
            refs.duplicateButton.disabled = false;
            refs.sendToBackButton.disabled = false;
            refs.bringToFrontButton.disabled = false;
            refs.focusButton.disabled = false;
            return;
        }

        const { category, entity } = state.selection!;
        refs.selectionSummary.textContent = category === 'custom'
            ? `${CATEGORY_LABELS[category]}: ${entity.type} at (${entity.x}, ${entity.y})`
            : `${CATEGORY_LABELS[category]}: ${entity.type} at (${entity.x}, ${entity.y})`;
        const convertTargets = getConvertTargetCategories(state.selection!);
        refs.convertTargetSelect.innerHTML = '';
        for (const target of convertTargets) {
            const option = document.createElement('option');
            option.value = target;
            option.textContent = CATEGORY_LABELS[target].replace(/^[a-z]/, (letter) => letter.toUpperCase());
            refs.convertTargetSelect.appendChild(option);
        }
        refs.convertTargetSelect.disabled = convertTargets.length === 0;
        refs.convertButton.disabled = convertTargets.length === 0;
        refs.convertButton.textContent = 'Convert';
        refs.deleteButton.disabled = false;
        refs.duplicateButton.disabled = false;
        refs.sendToBackButton.disabled = false;
        refs.bringToFrontButton.disabled = false;
        refs.focusButton.disabled = false;
    }

    function renderButtonDefaultsInspector(container: HTMLElement, selectedButton: Button | null) {
        const effectiveDefaults = getEffectiveButtonDefaultOverrides();
        const paletteOptions = Array.from({ length: paletteCount }, (_, index) => ({
            value: String(index),
            label: `Palette ${index}`
        }));
        const accordion = document.createElement('details');
        const accordionSummary = document.createElement('summary');
        accordionSummary.textContent = 'Defaults for new buttons and button conversions';
        accordion.appendChild(accordionSummary);
        const body = document.createElement('div');
        const summary = document.createElement('div');
        summary.className = 'world-designer-summary';
        summary.textContent = 'Existing buttons keep their own values.';
        body.appendChild(summary);
        addOptionSelectInspector(body, 'Default button cap palette', String(effectiveDefaults.capPalette), paletteOptions, (value) => {
            runMutation('Updated default button cap palette.', () => {
                state.buttonDefaults.capPalette = clamp(Math.round(Number(value)), 0, paletteCount - 1);
            });
        });
        addOptionSelectInspector(body, 'Default box palette', String(effectiveDefaults.boxPalette), paletteOptions, (value) => {
            runMutation('Updated default button box palette.', () => {
                state.buttonDefaults.boxPalette = clamp(Math.round(Number(value)), 0, paletteCount - 1);
            });
        });
        addNumberInspector(body, 'Default closed cap offset X (from box)', effectiveDefaults.capClosedOffsetX ?? 0, (value) => {
            runMutation('Updated default closed button cap X.', () => {
                state.buttonDefaults.capClosedOffsetX = Math.round(value);
            });
        });
        addNumberInspector(body, 'Default closed cap offset Y (from box)', effectiveDefaults.capClosedOffsetY ?? 0, (value) => {
            runMutation('Updated default closed button cap Y.', () => {
                state.buttonDefaults.capClosedOffsetY = Math.round(value);
            });
        });
        addNumberInspector(body, 'Default open cap offset X (from box)', effectiveDefaults.capOpenOffsetX ?? 0, (value) => {
            runMutation('Updated default open button cap X.', () => {
                state.buttonDefaults.capOpenOffsetX = Math.round(value);
            });
        });
        addNumberInspector(body, 'Default open cap offset Y (from box)', effectiveDefaults.capOpenOffsetY ?? 0, (value) => {
            runMutation('Updated default open button cap Y.', () => {
                state.buttonDefaults.capOpenOffsetY = Math.round(value);
            });
        });
        if (selectedButton) {
            addInspectorAction(body, 'Use selected button as new-button defaults', () => {
                runMutation('Copied selected button to button defaults.', () => {
                    setButtonDefaultOverridesFromButton(selectedButton);
                });
            });
        }
        addInspectorAction(body, 'Reset button defaults', () => {
            runMutation('Reset button defaults.', () => {
                resetButtonDefaultOverrides();
            });
        });
        accordion.appendChild(body);
        container.appendChild(accordion);
    }

    function refreshInspector() {
        refs.inspector.innerHTML = '';
        updateSelectionSummary();

        const selectedItems = getSelectedItems();
        if (!state.selection) {
            if (state.category === 'buttons') {
                renderButtonDefaultsInspector(refs.inspector, null);
            }
            return;
        }
        if (selectedItems.length > 1) {
            const summary = document.createElement('div');
            summary.className = 'world-designer-summary';
            summary.textContent = 'Multi-selection active. Palette edits apply to all selected sprites.';
            refs.inspector.appendChild(summary);
            if (state.category === 'buttons') {
                renderButtonDefaultsInspector(refs.inspector, null);
            }
            return;
        }

        const { category, entity } = state.selection;
        const container = refs.inspector;

        if (category === 'custom') {
            const definition = getCustomSpriteDefinitionForInstance(entity as CustomSpriteInstance);
            addTextInspector(container, 'Name', definition?.name ?? entity.type, (value) => {
                runMutation('Renamed custom sprite.', () => {
                    const trimmed = value.trim();
                    const nextName = trimmed.length > 0 ? trimmed : createCustomSpriteName();
                    if (definition) {
                        renameCustomSpriteDefinition(definition, nextName);
                    } else {
                        entity.type = nextName;
                    }
                });
            });
            addNumberInspector(container, 'X', entity.x, (value) => {
                runMutation('Updated X position.', () => {
                    applyEntityPositionWithTeleporterSync(entity, value, entity.y);
                });
            });
            addNumberInspector(container, 'Y', entity.y, (value) => {
                runMutation('Updated Y position.', () => {
                    applyEntityPositionWithTeleporterSync(entity, entity.x, value);
                });
            });
            const summary = document.createElement('div');
            summary.className = 'world-designer-summary';
            summary.textContent = definition
                ? `${definition.members.length} part${definition.members.length === 1 ? '' : 's'}. Use Convert to button for a live runtime button, or right-click to ungroup.`
                : 'Missing custom sprite definition.';
            container.appendChild(summary);
            if (definition) {
                addInspectorAction(container, 'Delete custom sprite type', () => {
                    deleteCustomSpriteSelectionDefinition();
                });
            }
            return;
        }

        addSelectInspector(container, 'Type', entity.type, spriteTypes, (value) => {
            runMutation('Updated sprite type.', () => {
                entity.type = value;
                state.typeByCategory[category] = value;
            });
        });
        addNumberInspector(container, 'X', entity.x, (value) => {
            runMutation('Updated X position.', () => {
                applyEntityPositionWithTeleporterSync(entity, value, entity.y);
            });
        });
        addNumberInspector(container, 'Y', entity.y, (value) => {
            runMutation('Updated Y position.', () => {
                applyEntityPositionWithTeleporterSync(entity, entity.x, value);
            });
        });
        addNumberInspector(container, 'Rotation', normalizeRotation(entity.rotation), (value) => {
            runMutation('Updated rotation.', () => {
                applyEntityRotationWithTeleporterSync(entity, value);
                if (category === 'creatures') {
                    entity.state = entity.state ?? {};
                    entity.state.authoredRotation = entity.rotation;
                }
                if ('defaultRotation' in entity) {
                    entity.defaultRotation = entity.rotation;
                }
            });
        });
        if (categorySupportsTranslation(category)) {
            addSelectInspector(
                container,
                'Translation',
                normalizeSpriteTranslation(entity.translation),
                [...SPRITE_TRANSLATION_OPTIONS],
                (value) => {
                    runMutation('Updated translation.', () => {
                        entity.translation = normalizeSpriteTranslation(value);
                    });
                }
            );
        }
        const paletteOptions = Array.from({ length: paletteCount }, (_, index) => ({
            value: String(index),
            label: `Palette ${index}`
        }));
        if (category === 'buttons') {
            addOptionSelectInspector(container, 'Button cap palette', String(entity.palette ?? 0), paletteOptions, (value) => {
                runMutation('Updated palette.', () => {
                    const nextPalette = clamp(Math.round(Number(value)), 0, paletteCount - 1);
                    entity.palette = nextPalette;
                });
            });
        } else {
            addNumberInspector(container, 'Palette', entity.palette ?? 0, (value) => {
                runMutation('Updated palette.', () => {
                    const nextPalette = clamp(Math.round(value), 0, paletteCount - 1);
                    entity.palette = nextPalette;
                });
            });
        }
        const effectivePaletteCycle = getEffectivePaletteCycle(entity.type, entity.paletteCycle, paletteCount);
        if (effectivePaletteCycle) {
            const isTeleporterDefault = entity.type === 'teleporter_pad' && !entity.paletteCycle;
            if (isTeleporterDefault) {
                const summary = document.createElement('div');
                summary.className = 'world-designer-summary';
                summary.textContent = 'Teleporters cycle palettes by default.';
                container.appendChild(summary);
            } else {
                addCheckboxInspector(container, 'Timed palette cycle', !!entity.paletteCycle, (checked) => {
                    runMutation('Updated timed palette cycle.', () => {
                        entity.paletteCycle = checked
                            ? entity.paletteCycle ?? buildDefaultPaletteCycle(entity.palette ?? 0, paletteCount)
                            : undefined;
                    });
                });
            }
            addTextInspector(
                container,
                'Cycle palettes (comma separated)',
                effectivePaletteCycle.palettes.join(', '),
                (value) => {
                    const palettes = parsePaletteCyclePalettes(value, paletteCount);
                    runMutation('Updated palette cycle palettes.', () => {
                        if (palettes.length === 0) {
                            entity.paletteCycle = undefined;
                            return;
                        }
                        entity.paletteCycle = {
                            palettes,
                            intervalMs: entity.paletteCycle?.intervalMs ?? effectivePaletteCycle.intervalMs
                        };
                    });
                }
            );
            addNumberInspector(
                container,
                'Cycle interval (seconds)',
                Number((effectivePaletteCycle.intervalMs / 1000).toFixed(3)),
                (value) => {
                    runMutation('Updated palette cycle interval.', () => {
                        entity.paletteCycle = {
                            palettes: entity.paletteCycle?.palettes ?? effectivePaletteCycle.palettes,
                            intervalMs: Math.max(50, Math.round(Math.max(0.05, value) * 1000))
                        };
                    });
                },
                0.1
            );
        } else {
            addCheckboxInspector(container, 'Timed palette cycle', false, (checked) => {
                if (!checked) return;
                runMutation('Enabled timed palette cycle.', () => {
                    entity.paletteCycle = buildDefaultPaletteCycle(entity.palette ?? 0, paletteCount);
                });
            });
        }
        if ('collision' in entity) {
            addCheckboxInspector(container, 'Collision enabled', entity.collision !== false, (checked) => {
                runMutation('Updated collision flag.', () => {
                    entity.collision = checked;
                    if (category === 'world' && !checked && typeof entity.maskAstronaut !== 'boolean') {
                        entity.maskAstronaut = entity.type === 'black_background' ? false : true;
                    }
                });
            });
        }

        if (category === 'world') {
            addCheckboxInspector(container, 'Mask astronaut', shouldMaskAstronaut(entity), (checked) => {
                runMutation('Updated astronaut masking.', () => {
                    entity.maskAstronaut = checked;
                });
            });

            if (entity.type === 'teleporter' || entity.type === 'teleporter_pad') {
                const linkedTeleporter = findTeleporterForWorldBlock(entity);
                if (!linkedTeleporter) {
                    const summary = document.createElement('div');
                    summary.className = 'world-designer-summary';
                    summary.textContent = 'This teleporter part is not converted yet. Convert to create a linked base+pad mechanism.';
                    container.appendChild(summary);
                    addInspectorAction(container, 'Convert to teleporter', () => {
                        runMutation('Converted world sprites to a teleporter.', () => {
                            convertWorldTeleporterBlock(entity);
                        });
                    });
                } else {
                    addTextInspector(container, 'Teleporter ID', linkedTeleporter.id, (value) => {
                        runMutation('Updated teleporter ID.', () => {
                            renameTeleporterId(linkedTeleporter, value);
                        });
                    });
                    addCheckboxInspector(container, 'Teleporter enabled', linkedTeleporter.enabled !== false, (checked) => {
                        runMutation('Updated teleporter enabled state.', () => {
                            linkedTeleporter.enabled = checked;
                        });
                    });
                    addCheckboxInspector(container, 'Require key hook', linkedTeleporter.requiresKey === true, (checked) => {
                        runMutation('Updated teleporter key requirement.', () => {
                            linkedTeleporter.requiresKey = checked;
                        });
                    });
                    addNumberInspector(container, 'Destination A X', linkedTeleporter.destinationA.x, (value) => {
                        runMutation('Updated teleporter destination A X.', () => {
                            linkedTeleporter.destinationA.x = Math.round(value);
                        });
                    });
                    addNumberInspector(container, 'Destination A Y', linkedTeleporter.destinationA.y, (value) => {
                        runMutation('Updated teleporter destination A Y.', () => {
                            linkedTeleporter.destinationA.y = Math.round(value);
                        });
                    });
                    const hasDestinationB = !!linkedTeleporter.destinationB;
                    addCheckboxInspector(container, 'Enable destination B', hasDestinationB, (checked) => {
                        runMutation('Updated teleporter destination B.', () => {
                            linkedTeleporter.destinationB = checked
                                ? {
                                    x: linkedTeleporter.destinationA.x,
                                    y: linkedTeleporter.destinationA.y
                                }
                                : null;
                            if (!checked && linkedTeleporter.activeDestinationIndex === 1) {
                                linkedTeleporter.activeDestinationIndex = 0;
                            }
                        });
                    });
                    if (linkedTeleporter.destinationB) {
                        addNumberInspector(container, 'Destination B X', linkedTeleporter.destinationB.x, (value) => {
                            runMutation('Updated teleporter destination B X.', () => {
                                if (linkedTeleporter.destinationB) {
                                    linkedTeleporter.destinationB.x = Math.round(value);
                                }
                            });
                        });
                        addNumberInspector(container, 'Destination B Y', linkedTeleporter.destinationB.y, (value) => {
                            runMutation('Updated teleporter destination B Y.', () => {
                                if (linkedTeleporter.destinationB) {
                                    linkedTeleporter.destinationB.y = Math.round(value);
                                }
                            });
                        });
                    }
                    addOptionSelectInspector(
                        container,
                        'Active destination',
                        String(linkedTeleporter.activeDestinationIndex === 1 ? 1 : 0),
                        [
                            { value: '0', label: 'A' },
                            { value: '1', label: 'B' }
                        ],
                        (value) => {
                            runMutation('Updated teleporter active destination.', () => {
                                linkedTeleporter.activeDestinationIndex = value === '1' && linkedTeleporter.destinationB ? 1 : 0;
                            });
                        }
                    );
                    addInspectorAction(container, 'Set destination A to view center', () => {
                        runMutation('Set teleporter destination A to view center.', () => {
                            linkedTeleporter.destinationA = {
                                x: Math.round(state.camera.x + host.canvas.width / 2),
                                y: Math.round(state.camera.y + host.canvas.height / 2)
                            };
                        });
                    });
                    addInspectorAction(container, 'Pick destination A on map', () => {
                        state.teleporterDestinationPick = {
                            teleporterId: linkedTeleporter.id,
                            slot: 'a'
                        };
                        setStatus('Click anywhere in the viewport to set teleporter destination A.', 'neutral');
                    });
                    if (linkedTeleporter.destinationB) {
                        addInspectorAction(container, 'Set destination B to view center', () => {
                            runMutation('Set teleporter destination B to view center.', () => {
                                if (linkedTeleporter.destinationB) {
                                    linkedTeleporter.destinationB = {
                                        x: Math.round(state.camera.x + host.canvas.width / 2),
                                        y: Math.round(state.camera.y + host.canvas.height / 2)
                                    };
                                }
                            });
                        });
                        addInspectorAction(container, 'Pick destination B on map', () => {
                            state.teleporterDestinationPick = {
                                teleporterId: linkedTeleporter.id,
                                slot: 'b'
                            };
                            setStatus('Click anywhere in the viewport to set teleporter destination B.', 'neutral');
                        });
                    }
                    const destinationPickState = state.teleporterDestinationPick;
                    if (destinationPickState && destinationPickState.teleporterId === linkedTeleporter.id) {
                        const pickingSlot = destinationPickState.slot === 'b' ? 'B' : 'A';
                        const pickerSummary = document.createElement('div');
                        pickerSummary.className = 'world-designer-summary';
                        pickerSummary.textContent = `Pick mode is armed for destination ${pickingSlot}.`;
                        container.appendChild(pickerSummary);
                        addInspectorAction(container, 'Cancel destination pick mode', () => {
                            state.teleporterDestinationPick = null;
                            setStatus('Cancelled teleporter destination pick mode.', 'neutral');
                        });
                    }
                }
            }
        }

        if (category === 'world' || category === 'doors') {
            const destructibleCategory = category;
            const resolvedDestructible = typeof entity.destructible === 'boolean'
                ? entity.destructible
                : getDefaultDestructibleEnabled(destructibleCategory, entity.type);
            const resolvedHealth = typeof entity.destructionHealth === 'number'
                ? Math.max(0.1, entity.destructionHealth)
                : getDefaultDestructibleHealth(destructibleCategory, entity.type);
            const resolvedSource = typeof entity.destructionSource === 'string'
                ? entity.destructionSource
                : getDefaultDestructionSource(destructibleCategory, entity.type);

            addCheckboxInspector(container, 'Destructible', resolvedDestructible, (checked) => {
                runMutation('Updated destructible flag.', () => {
                    entity.destructible = checked;
                    if (checked) {
                        entity.destructionHealth = entity.destructionHealth ?? getDefaultDestructibleHealth(destructibleCategory, entity.type);
                        entity.destructionSource = entity.destructionSource ?? getDefaultDestructionSource(destructibleCategory, entity.type);
                    }
                });
            });

            if (resolvedDestructible) {
                addNumberInspector(container, 'Damage required', resolvedHealth, (value) => {
                    runMutation('Updated destruction health.', () => {
                        entity.destructionHealth = Math.max(0.1, value);
                    });
                }, 0.1);
                addOptionSelectInspector(container, 'Damage source', resolvedSource, DESTRUCTION_SOURCE_OPTIONS, (value) => {
                    runMutation('Updated destruction source.', () => {
                        entity.destructionSource = value as DestructionSourceRequirement;
                    });
                });
            }
        }

        if (category === 'world') {
            const windEnabled = entity.windEnabled === true;
            addCheckboxInspector(container, 'Wind source', windEnabled, (checked) => {
                runMutation('Updated wind source flag.', () => {
                    entity.windEnabled = checked;
                    if (!checked) {
                        return;
                    }
                    entity.windDirectionDegrees = typeof entity.windDirectionDegrees === 'number'
                        ? entity.windDirectionDegrees
                        : 270;
                    entity.windStrength = typeof entity.windStrength === 'number'
                        ? entity.windStrength
                        : 0.18;
                    entity.windRadius = typeof entity.windRadius === 'number'
                        ? entity.windRadius
                        : 220;
                    entity.windMode = entity.windMode === 'variable' ? 'variable' : 'constant';
                    entity.windVariabilityHz = typeof entity.windVariabilityHz === 'number'
                        ? entity.windVariabilityHz
                        : 1.2;
                    entity.windVariabilityAmount = typeof entity.windVariabilityAmount === 'number'
                        ? entity.windVariabilityAmount
                        : 0.45;
                    entity.windAffectsAstronaut = entity.windAffectsAstronaut !== false;
                    entity.windAffectsLooseObjects = entity.windAffectsLooseObjects !== false;
                    entity.windShowParticles = entity.windShowParticles !== false;
                });
            });
            if (windEnabled) {
                addOptionSelectInspector(
                    container,
                    'Wind mode',
                    entity.windMode === 'variable' ? 'variable' : 'constant',
                    [
                        { value: 'constant', label: 'Constant' },
                        { value: 'variable', label: 'Variable' }
                    ],
                    (value) => {
                        runMutation('Updated wind mode.', () => {
                            entity.windMode = value === 'variable' ? 'variable' : 'constant';
                        });
                    }
                );
                addNumberInspector(container, 'Wind direction (degrees)', entity.windDirectionDegrees ?? 270, (value) => {
                    runMutation('Updated wind direction.', () => {
                        const normalized = ((value % 360) + 360) % 360;
                        entity.windDirectionDegrees = normalized;
                    });
                }, 1);
                addNumberInspector(container, 'Wind strength', entity.windStrength ?? 0.18, (value) => {
                    runMutation('Updated wind strength.', () => {
                        entity.windStrength = Math.max(0, value);
                    });
                }, 0.01);
                addNumberInspector(container, 'Wind radius', entity.windRadius ?? 220, (value) => {
                    runMutation('Updated wind radius.', () => {
                        entity.windRadius = Math.max(1, value);
                    });
                }, 1);
                if ((entity.windMode ?? 'constant') === 'variable') {
                    addNumberInspector(container, 'Wind variability (Hz)', entity.windVariabilityHz ?? 1.2, (value) => {
                        runMutation('Updated wind variability frequency.', () => {
                            entity.windVariabilityHz = Math.max(0, value);
                        });
                    }, 0.05);
                    addNumberInspector(container, 'Wind variability amount', entity.windVariabilityAmount ?? 0.45, (value) => {
                        runMutation('Updated wind variability amount.', () => {
                            entity.windVariabilityAmount = clamp(value, 0, 1);
                        });
                    }, 0.05);
                }
                addCheckboxInspector(container, 'Affects astronaut', entity.windAffectsAstronaut !== false, (checked) => {
                    runMutation('Updated wind astronaut-affect flag.', () => {
                        entity.windAffectsAstronaut = checked;
                    });
                });
                addCheckboxInspector(container, 'Affects loose objects', entity.windAffectsLooseObjects !== false, (checked) => {
                    runMutation('Updated wind loose-object-affect flag.', () => {
                        entity.windAffectsLooseObjects = checked;
                    });
                });
                addCheckboxInspector(container, 'Show wind particles', entity.windShowParticles !== false, (checked) => {
                    runMutation('Updated wind particle flag.', () => {
                        entity.windShowParticles = checked;
                    });
                });
            }
        }

        if (category === 'buttons') {
            addCheckboxInspector(container, 'Active by default', entity.defaultActive ?? entity.active ?? false, (checked) => {
                runMutation('Updated button default state.', () => {
                    entity.active = checked;
                    entity.defaultActive = checked;
                });
            });
            addTextInspector(container, 'Linked door IDs (comma separated)', (entity.linkedDoors ?? []).join(', '), (value) => {
                runMutation('Updated button linked doors.', () => {
                    entity.linkedDoors = parseDoorIds(value);
                });
            });
            addTextInspector(container, 'Linked teleporter IDs (comma separated)', (entity.linkedTeleporters ?? []).join(', '), (value) => {
                runMutation('Updated button linked teleporters.', () => {
                    entity.linkedTeleporters = parseStringIds(value);
                });
            });
            addOptionSelectInspector(
                container,
                'Teleporter action',
                entity.teleporterMode ?? 'toggle',
                [
                    { value: 'toggle', label: 'Toggle A/B' },
                    { value: 'destination_a', label: 'Set destination A' },
                    { value: 'destination_b', label: 'Set destination B' },
                    { value: 'toggle_enabled', label: 'Toggle enabled' },
                    { value: 'enable', label: 'Enable teleporter' },
                    { value: 'disable', label: 'Disable teleporter' }
                ],
                (value) => {
                    runMutation('Updated button teleporter action.', () => {
                        entity.teleporterMode = isTeleporterMode(value) ? value : 'toggle';
                    });
                }
            );
            addTextInspector(container, 'Box sprite', entity.boxType ?? 'button_box', (value) => {
                runMutation('Updated button box sprite.', () => {
                    entity.boxType = value;
                });
            });
            addOptionSelectInspector(container, 'Box palette', String(entity.boxPalette ?? 0), paletteOptions, (value) => {
                runMutation('Updated button box palette.', () => {
                    entity.boxPalette = clamp(Math.round(Number(value)), 0, paletteCount - 1);
                });
            });
            const closedCapOffset = getButtonCapOffsetsRelativeToBox(entity, false);
            const openCapOffset = getButtonCapOffsetsRelativeToBox(entity, true);
            const buttonDesignerSummary = document.createElement('div');
            buttonDesignerSummary.className = 'world-designer-summary';
            buttonDesignerSummary.textContent = 'Button cap offsets are authored in button-local space relative to the box, then rotated/flipped with the button.';
            container.appendChild(buttonDesignerSummary);
            addNumberInspector(container, 'Closed cap offset X (from box)', closedCapOffset.x, (value) => {
                runMutation('Updated closed button cap X.', () => {
                    entity.capClosedOffsetX = (entity.boxOffsetX ?? BUTTON_DEFAULT_BOX_OFFSET_X) + Math.round(value);
                    entity.pressOffset = (entity.capOpenOffsetX ?? (entity.pressOffset ?? BUTTON_DEFAULT_PRESS_OFFSET))
                        - (entity.capClosedOffsetX ?? 0);
                });
            });
            addNumberInspector(container, 'Closed cap offset Y (from box)', closedCapOffset.y, (value) => {
                runMutation('Updated closed button cap Y.', () => {
                    entity.capClosedOffsetY = (entity.boxOffsetY ?? BUTTON_DEFAULT_BOX_OFFSET_Y) + Math.round(value);
                });
            });
            addNumberInspector(container, 'Open cap offset X (from box)', openCapOffset.x, (value) => {
                runMutation('Updated open button cap X.', () => {
                    entity.capOpenOffsetX = (entity.boxOffsetX ?? BUTTON_DEFAULT_BOX_OFFSET_X) + Math.round(value);
                    entity.pressOffset = (entity.capOpenOffsetX ?? (entity.pressOffset ?? BUTTON_DEFAULT_PRESS_OFFSET))
                        - (entity.capClosedOffsetX ?? 0);
                });
            });
            addNumberInspector(container, 'Open cap offset Y (from box)', openCapOffset.y, (value) => {
                runMutation('Updated open button cap Y.', () => {
                    entity.capOpenOffsetY = (entity.boxOffsetY ?? BUTTON_DEFAULT_BOX_OFFSET_Y) + Math.round(value);
                });
            });
            renderButtonDefaultsInspector(container, entity);
        }

        if (category === 'doors') {
            const paletteOptions = [
                { value: '', label: 'Base palette' },
                ...Array.from({ length: paletteCount }, (_, index) => ({
                    value: String(index),
                    label: `Palette ${index}`
                }))
            ];
            addTextInspector(container, 'Name', entity.name ?? '', (value) => {
                runMutation('Updated door name.', () => {
                    entity.name = value;
                });
            });
            addNumberInspector(container, 'Door ID', entity.doorID ?? 0, (value) => {
                runMutation('Updated door ID.', () => {
                    entity.doorID = Math.round(value);
                });
            });
            addCheckboxInspector(container, 'Locked by default', entity.defaultLocked ?? entity.locked ?? false, (checked) => {
                runMutation('Updated door default state.', () => {
                    entity.locked = checked;
                    entity.defaultLocked = checked;
                });
            });
            addCheckboxInspector(container, 'Open by default', entity.defaultOpen ?? entity.open ?? false, (checked) => {
                runMutation('Updated door open state.', () => {
                    entity.open = checked;
                    entity.defaultOpen = checked;
                });
            });
            addOptionSelectInspector(
                container,
                'Locked palette',
                typeof entity.palette_locked === 'number' ? String(entity.palette_locked) : '',
                paletteOptions,
                (value) => {
                    runMutation('Updated locked palette.', () => {
                        entity.palette_locked = value === ''
                            ? null
                            : clamp(Math.round(Number(value)), 0, paletteCount - 1);
                        if (state.selection?.category === 'doors' && state.selection.entity === entity) {
                            state.palette = entity.palette;
                        }
                    });
                }
            );
            addOptionSelectInspector(
                container,
                'Unlocked palette',
                typeof entity.palette_unlocked === 'number' ? String(entity.palette_unlocked) : '',
                paletteOptions,
                (value) => {
                    runMutation('Updated unlocked palette.', () => {
                        entity.palette_unlocked = value === ''
                            ? null
                            : clamp(Math.round(Number(value)), 0, paletteCount - 1);
                        if (state.selection?.category === 'doors' && state.selection.entity === entity) {
                            state.palette = entity.palette;
                        }
                    });
                }
            );
        }

        if (category === 'creatures') {
            const archetypeOptions = [
                { value: 'custom', label: 'Custom' },
                { value: 'monkey', label: 'Monkey' },
                { value: 'bird', label: 'Bird' },
                { value: 'bee', label: 'Bee / wasp' },
                { value: 'turret', label: 'Turret' }
            ];
            const movementModeOptions = [
                { value: 'ground', label: 'Ground' },
                { value: 'fly', label: 'Fly' },
                { value: 'hover', label: 'Hover' },
                { value: 'turret', label: 'Turret' }
            ];
            const fireModeOptions = [
                { value: 'none', label: 'None' },
                { value: 'bullets', label: 'Bullets' },
                { value: 'grenades', label: 'Grenades' },
                { value: 'plasma_grenades', label: 'Plasma grenades' },
                { value: 'energy_pods', label: 'Energy pods' }
            ];
            const soundOptions = [
                { value: '', label: 'No sound' },
                ...CREATURE_SOUND_MANIFEST.map((entry) => ({
                    value: entry.key,
                    label: entry.label
                }))
            ];
            addOptionSelectInspector(container, 'Archetype', entity.archetype ?? 'custom', archetypeOptions, (value) => {
                runMutation('Updated creature archetype.', () => {
                    entity.archetype = value as Creature['archetype'];
                });
            });
            addCheckboxInspector(container, 'Collision enabled', entity.collision ?? false, (checked) => {
                runMutation('Updated creature collision.', () => {
                    entity.collision = checked;
                });
            });
            addCheckboxInspector(container, 'Hostile', entity.hostile ?? false, (checked) => {
                runMutation('Updated hostile flag.', () => {
                    entity.hostile = checked;
                });
            });
            addNumberInspector(container, 'Damage on contact', entity.damageOnContact ?? 0, (value) => {
                runMutation('Updated contact damage.', () => {
                    entity.damageOnContact = Math.max(0, value);
                });
            }, 0.1);
            addCheckboxInspector(container, 'Follows astronaut', entity.followsAstronaut ?? false, (checked) => {
                runMutation('Updated follow flag.', () => {
                    entity.followsAstronaut = checked;
                });
            });
            addNumberInspector(container, 'Follow range', entity.followRange ?? 160, (value) => {
                runMutation('Updated follow range.', () => {
                    entity.followRange = Math.max(0, value);
                });
            });
            addOptionSelectInspector(container, 'Movement mode', entity.movementMode ?? 'ground', movementModeOptions, (value) => {
                runMutation('Updated movement mode.', () => {
                    entity.movementMode = value as Creature['movementMode'];
                    if (value === 'turret') {
                        entity.fixed = true;
                        entity.speed = 0;
                    }
                });
            });
            addCheckboxInspector(container, 'Fixed in place', entity.fixed ?? false, (checked) => {
                runMutation('Updated fixed flag.', () => {
                    entity.fixed = checked;
                    if (checked) {
                        entity.movementMode = 'turret';
                        entity.speed = 0;
                    } else if (entity.movementMode === 'turret') {
                        entity.movementMode = 'ground';
                    }
                });
            });
            addNumberInspector(container, 'Speed', entity.speed ?? 1.5, (value) => {
                runMutation('Updated creature speed.', () => {
                    entity.speed = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Home X', entity.homeX ?? entity.x, (value) => {
                runMutation('Updated home X.', () => {
                    entity.homeX = value;
                });
            });
            addNumberInspector(container, 'Home Y', entity.homeY ?? entity.y, (value) => {
                runMutation('Updated home Y.', () => {
                    entity.homeY = value;
                });
            });
            addNumberInspector(container, 'Patrol min X', entity.patrolMinX ?? entity.x - 96, (value) => {
                runMutation('Updated patrol min X.', () => {
                    entity.patrolMinX = value;
                });
            });
            addNumberInspector(container, 'Patrol max X', entity.patrolMaxX ?? entity.x + 96, (value) => {
                runMutation('Updated patrol max X.', () => {
                    entity.patrolMaxX = value;
                });
            });
            addNumberInspector(container, 'Patrol min Y', entity.patrolMinY ?? entity.y - 32, (value) => {
                runMutation('Updated patrol min Y.', () => {
                    entity.patrolMinY = value;
                });
            });
            addNumberInspector(container, 'Patrol max Y', entity.patrolMaxY ?? entity.y + 32, (value) => {
                runMutation('Updated patrol max Y.', () => {
                    entity.patrolMaxY = value;
                });
            });
            addNumberInspector(container, 'Hover amplitude', entity.hoverAmplitude ?? 0, (value) => {
                runMutation('Updated hover amplitude.', () => {
                    entity.hoverAmplitude = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Track range', entity.trackRange ?? entity.followRange ?? 160, (value) => {
                runMutation('Updated track range.', () => {
                    entity.trackRange = Math.max(0, value);
                });
            });
            addOptionSelectInspector(container, 'Fire mode', entity.fireMode ?? 'none', fireModeOptions, (value) => {
                runMutation('Updated fire mode.', () => {
                    entity.fireMode = value as Creature['fireMode'];
                });
            });
            addCheckboxInspector(container, 'Homing bullets', entity.homingBullets ?? false, (checked) => {
                runMutation('Updated homing setting.', () => {
                    entity.homingBullets = checked;
                });
            });
            addNumberInspector(container, 'Fire cooldown (ms)', entity.fireCooldownMs ?? 1200, (value) => {
                runMutation('Updated fire cooldown.', () => {
                    entity.fireCooldownMs = Math.max(0, value);
                });
            });
            addNumberInspector(container, 'Fire cooldown variance (ms)', entity.fireCooldownVarianceMs ?? 0, (value) => {
                runMutation('Updated cooldown variance.', () => {
                    entity.fireCooldownVarianceMs = Math.max(0, value);
                });
            });
            addNumberInspector(container, 'Target refresh (ms)', entity.targetRefreshMs ?? 0, (value) => {
                runMutation('Updated target refresh.', () => {
                    entity.targetRefreshMs = Math.max(0, value);
                });
            });
            addNumberInspector(container, 'Aim lead factor', entity.aimLeadFactor ?? 0, (value) => {
                runMutation('Updated aim lead factor.', () => {
                    entity.aimLeadFactor = Math.max(0, value);
                });
            }, 0.05);
            addNumberInspector(container, 'Aim jitter (px)', entity.aimJitterPx ?? 0, (value) => {
                runMutation('Updated aim jitter.', () => {
                    entity.aimJitterPx = Math.max(0, value);
                });
            }, 0.5);
            addCheckboxInspector(container, 'Requires line of sight', entity.requiresLineOfSight ?? false, (checked) => {
                runMutation('Updated line-of-sight gating.', () => {
                    entity.requiresLineOfSight = checked;
                });
            });
            addNumberInspector(container, 'Projectile speed', entity.projectileSpeed ?? 3, (value) => {
                runMutation('Updated projectile speed.', () => {
                    entity.projectileSpeed = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Projectile weight', entity.projectileWeight ?? 0.1, (value) => {
                runMutation('Updated projectile weight.', () => {
                    entity.projectileWeight = Math.max(0, value);
                });
            }, 0.05);
            addNumberInspector(container, 'Projectile bounciness', entity.projectileBounciness ?? 0, (value) => {
                runMutation('Updated projectile bounciness.', () => {
                    entity.projectileBounciness = Math.max(0, value);
                });
            }, 0.05);
            addCheckboxInspector(container, 'Can eat wasps', entity.canEatWasps ?? false, (checked) => {
                runMutation('Updated predator flag.', () => {
                    entity.canEatWasps = checked;
                });
            });
            addCheckboxInspector(container, 'Can jump', entity.canJump ?? false, (checked) => {
                runMutation('Updated jump flag.', () => {
                    entity.canJump = checked;
                });
            });
            addNumberInspector(container, 'Jump strength', entity.jumpStrength ?? 6, (value) => {
                runMutation('Updated jump strength.', () => {
                    entity.jumpStrength = Math.max(0, value);
                });
            }, 0.1);
            addCheckboxInspector(container, 'Teleport home', entity.teleportHome ?? false, (checked) => {
                runMutation('Updated teleport-home flag.', () => {
                    entity.teleportHome = checked;
                });
            });
            addNumberInspector(container, 'Teleport distance', entity.teleportHomeDistance ?? 512, (value) => {
                runMutation('Updated teleport-home distance.', () => {
                    entity.teleportHomeDistance = Math.max(0, value);
                });
            });
            addCheckboxInspector(container, 'Push astronaut', entity.pushAstronaut ?? true, (checked) => {
                runMutation('Updated push flag.', () => {
                    entity.pushAstronaut = checked;
                });
            });
            addCheckboxInspector(container, 'Can be picked up', entity.pickupEnabled ?? false, (checked) => {
                runMutation('Updated pickup flag.', () => {
                    entity.pickupEnabled = checked;
                    if (!checked) {
                        entity.storable = false;
                    }
                });
            });
            addCheckboxInspector(container, 'Storable', entity.storable ?? false, (checked) => {
                runMutation('Updated storable flag.', () => {
                    entity.storable = checked;
                    if (checked) {
                        entity.pickupEnabled = true;
                    }
                });
            });
            addNumberInspector(container, 'Current damage', entity.currentDamage ?? 0, (value) => {
                runMutation('Updated damage state.', () => {
                    entity.currentDamage = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Force required to kill', entity.killForce ?? 3, (value) => {
                runMutation('Updated kill-force threshold.', () => {
                    entity.killForce = Math.max(0, value);
                });
            }, 0.1);
            addNumberInspector(container, 'Visible energy', entity.visibleEnergy ?? 1, (value) => {
                runMutation('Updated visible energy.', () => {
                    entity.visibleEnergy = Math.max(0, value);
                });
            }, 0.1);
            addCheckboxInspector(container, 'Damage flash visible', entity.damageFlash ?? true, (checked) => {
                runMutation('Updated damage flash flag.', () => {
                    entity.damageFlash = checked;
                });
            });
            addCheckboxInspector(container, 'Makes sound', entity.sound?.enabled ?? false, (checked) => {
                runMutation('Updated sound-enabled flag.', () => {
                    entity.sound = {
                        enabled: checked,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: entity.sound?.range ?? 320,
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addOptionSelectInspector(container, 'Sound', entity.sound?.sound ?? '', soundOptions, (value) => {
                runMutation('Updated creature sound.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? value !== '',
                        sound: value,
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: entity.sound?.range ?? 320,
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addNumberInspector(container, 'Sound interval (ms)', entity.sound?.intervalMs ?? 3000, (value) => {
                runMutation('Updated sound interval.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? false,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: Math.max(0, value),
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: entity.sound?.range ?? 320,
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addNumberInspector(container, 'Sound randomness (ms)', entity.sound?.randomVarianceMs ?? 0, (value) => {
                runMutation('Updated sound randomness.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? false,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: Math.max(0, value),
                        range: entity.sound?.range ?? 320,
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addNumberInspector(container, 'Sound range', entity.sound?.range ?? 320, (value) => {
                runMutation('Updated sound range.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? false,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: Math.max(0, value),
                        volume: entity.sound?.volume ?? 1
                    };
                });
            });
            addNumberInspector(container, 'Sound volume', entity.sound?.volume ?? 1, (value) => {
                runMutation('Updated sound volume.', () => {
                    entity.sound = {
                        enabled: entity.sound?.enabled ?? false,
                        sound: entity.sound?.sound ?? '',
                        intervalMs: entity.sound?.intervalMs ?? 3000,
                        randomVarianceMs: entity.sound?.randomVarianceMs ?? 0,
                        range: entity.sound?.range ?? 320,
                        volume: Math.max(0, value)
                    };
                });
            }, 0.1);
            const accordion = document.createElement('details');
            const summary = document.createElement('summary');
            summary.textContent = 'Advanced state JSON';
            accordion.appendChild(summary);
            const advancedBody = document.createElement('div');
            addTextInspector(advancedBody, 'State JSON', stableStringify(entity.state ?? {}), (value) => {
                try {
                    const parsed = value.trim().length === 0 ? {} : JSON.parse(value);
                    runMutation('Updated creature state.', () => {
                        entity.state = parsed;
                    });
                } catch {
                    setStatus('Creature state must be valid JSON.', 'error');
                }
            }, true);
            accordion.appendChild(advancedBody);
            container.appendChild(accordion);
        }

        if (category === 'collectables') {
            addTextInspector(container, 'Name', entity.name ?? '', (value) => {
                runMutation('Updated collectable name.', () => {
                    entity.name = value;
                });
            });
            if (entity.type === 'boulder') {
                addCheckboxInspector(container, 'Radioactive', entity.radioactive === true, (checked) => {
                    runMutation('Updated boulder radioactivity.', () => {
                        const regularWeight = getDefaultCollectableWeight(entity.type, false);
                        const radioactiveWeight = getDefaultCollectableWeight(entity.type, true);
                        const radioactivePaletteCycle = getDefaultCollectablePaletteCycle(
                            entity.type,
                            entity.palette ?? 0,
                            paletteCount,
                            true
                        );
                        entity.radioactive = checked;
                        if (checked) {
                            if (Math.abs((entity.weight ?? regularWeight) - regularWeight) < 0.0001) {
                                entity.weight = radioactiveWeight;
                            }
                            if (!entity.paletteCycle && radioactivePaletteCycle) {
                                entity.paletteCycle = radioactivePaletteCycle;
                            }
                            return;
                        }

                        if (Math.abs((entity.weight ?? radioactiveWeight) - radioactiveWeight) < 0.0001) {
                            entity.weight = regularWeight;
                        }
                        if (
                            radioactivePaletteCycle &&
                            entity.paletteCycle &&
                            stableStringify(entity.paletteCycle) === stableStringify(radioactivePaletteCycle)
                        ) {
                            entity.paletteCycle = undefined;
                        }
                    });
                });
            }
            addNumberInspector(container, 'Weight', entity.weight ?? 0, (value) => {
                runMutation('Updated item weight.', () => {
                    entity.weight = Number.isFinite(value) ? value : 0;
                });
            }, 0.1);
            addCheckboxInspector(container, 'Can be picked up', entity.pickupEnabled ?? true, (checked) => {
                runMutation('Updated pickup-enabled flag.', () => {
                    entity.pickupEnabled = checked;
                    if (!checked) {
                        entity.storable = false;
                        entity.held = false;
                        entity.stored = false;
                    }
                });
            });
            addCheckboxInspector(container, 'Collected by default', entity.collected ?? false, (checked) => {
                runMutation('Updated collectable state.', () => {
                    entity.collected = checked;
                });
            });
            addCheckboxInspector(container, 'Storable', entity.storable ?? false, (checked) => {
                runMutation('Updated storable flag.', () => {
                    entity.storable = checked;
                    if (checked) {
                        entity.pickupEnabled = true;
                    }
                });
            });
            addCheckboxInspector(container, 'Affects astronaut', entity.affectsAstronaut ?? true, (checked) => {
                runMutation('Updated affects-astronaut flag.', () => {
                    entity.affectsAstronaut = checked;
                });
            });
            if (isGrenadeCollectableType(entity.type)) {
                addCheckboxInspector(container, 'Armed', entity.armed ?? false, (checked) => {
                    runMutation('Updated grenade armed state.', () => {
                        if (checked) {
                            entity.arm();
                        } else {
                            entity.disarm();
                        }
                    });
                });
                addNumberInspector(
                    container,
                    'Explosion power',
                    entity.explosionPower ?? getDefaultGrenadeExplosionPower(entity.type) ?? 0,
                    (value) => {
                        runMutation('Updated grenade explosion power.', () => {
                            entity.explosionPower = Math.max(0.5, value);
                        });
                    },
                    0.1
                );
                addNumberInspector(
                    container,
                    'Explosion radius',
                    entity.explosionRadius ?? (entity.type === 'plasma_grenade'
                        ? MOVEMENT_SETTINGS.plasmaGrenadeExplosionRadius
                        : MOVEMENT_SETTINGS.grenadeExplosionRadius),
                    (value) => {
                        runMutation('Updated grenade explosion radius.', () => {
                            entity.explosionRadius = Math.max(1, value);
                        });
                    },
                    1
                );
            }
        }
    }

    return {
        updateSelectionSummary,
        renderButtonDefaultsInspector,
        refreshInspector
    };
}
