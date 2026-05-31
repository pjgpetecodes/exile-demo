import type { Position } from '../../types/index.js';
import type { Collectable } from '../../entities/collectable.js';
import type { SpriteTranslation } from '../../shared/utilities.js';
import type {
    ClipboardEntry,
    ControlRefs,
    CustomSpriteInstance,
    DesignerCategory,
    DesignerState,
    Selection,
    WorldDesignerHost
} from '../core/world-designer-types.js';

type StatusTone = 'neutral' | 'success' | 'error';

type ContextMenuTeleporterPair = {
    base: any;
    pad: any;
};

type WorldDesignerContextMenuDeps = {
    state: DesignerState;
    refs: Pick<ControlRefs, 'contextMenu' | 'contextMenuBody'>;
    paletteCount: number;
    clipboardEntries: ClipboardEntry[];
    host: Pick<WorldDesignerHost, 'setAstronautStartPosition' | 'resetAstronautToPosition'>;
    clamp: (value: number, min: number, max: number) => number;
    normalizeRotation: (rotation: number) => number;
    normalizeSpriteTranslation: (translation?: SpriteTranslation) => SpriteTranslation;
    renderSpritePreviewCanvas: (
        canvas: HTMLCanvasElement,
        type: string,
        palette: number,
        rotation: number,
        translation: SpriteTranslation
    ) => void;
    runMutation: (message: string, mutate: () => void) => void;
    updateSelectionFromInspectorState: () => void;
    setStatus: (status: string, tone?: StatusTone) => void;
    screenToWorld: (x: number, y: number) => Position;
    getCanvasPoint: (event: MouseEvent) => Position;
    getSelectedItems: () => Selection[];
    areSameSelection: (left: Selection, right: Selection) => boolean;
    setSelections: (selections: Selection[], primary?: Selection | null) => void;
    getCurrentType: () => string;
    rotateSelection: () => void;
    reorderSelections: (toFront: boolean) => void;
    copySelection: () => void;
    duplicateSelection: () => void;
    deleteSelection: () => void;
    focusSelection: () => void;
    canGroupSelections: (selections: Selection[]) => boolean;
    groupSelectionsAsCustomSprite: () => void;
    ungroupCustomSpriteSelection: () => void;
    deleteCustomSpriteSelectionDefinition: () => void;
    shouldMaskAstronaut: (entity: any) => boolean;
    convertSelectionToCategory: (selection: Selection, targetCategory: DesignerCategory) => void;
    getContextMenuSelectedTeleporterPair: () => ContextMenuTeleporterPair | null;
    convertTeleporterWorldPair: (base: any, pad: any) => void;
    canConvertCustomSpriteToButton: (instance: CustomSpriteInstance) => boolean;
    resolvePlacementPosition: (worldX: number, worldY: number) => Position;
    createPastedSelections: (entries: ClipboardEntry[], offsetX: number, offsetY: number) => Selection[];
};

type WorldDesignerContextMenuApi = {
    closeContextMenu: () => void;
    positionContextMenu: () => void;
    getContextMenuWorldPosition: () => Position | null;
    getContextMenuActionSelections: () => Selection[];
    openContextMenu: (selection: Selection, event: MouseEvent) => void;
    openEmptyContextMenu: (event: MouseEvent, world: Position) => void;
};

export function createWorldDesignerContextMenu(deps: WorldDesignerContextMenuDeps): WorldDesignerContextMenuApi {
    const {
        state,
        refs,
        paletteCount,
        clipboardEntries,
        host,
        clamp,
        normalizeRotation,
        normalizeSpriteTranslation,
        renderSpritePreviewCanvas,
        runMutation,
        updateSelectionFromInspectorState,
        setStatus,
        screenToWorld,
        getCanvasPoint,
        getSelectedItems,
        areSameSelection,
        setSelections,
        getCurrentType,
        rotateSelection,
        reorderSelections,
        copySelection,
        duplicateSelection,
        deleteSelection,
        focusSelection,
        canGroupSelections,
        groupSelectionsAsCustomSprite,
        ungroupCustomSpriteSelection,
        deleteCustomSpriteSelectionDefinition,
        shouldMaskAstronaut,
        convertSelectionToCategory,
        getContextMenuSelectedTeleporterPair,
        convertTeleporterWorldPair,
        canConvertCustomSpriteToButton,
        resolvePlacementPosition,
        createPastedSelections
    } = deps;

    function closeContextMenu() {
        state.contextMenu.screen = null;
        state.contextMenu.world = null;
        state.contextMenu.primarySelection = null;
        refs.contextMenu.classList.remove('open');
        refs.contextMenuBody.innerHTML = '';
    }

    function positionContextMenu() {
        if (!state.contextMenu.screen) return;
        const viewportPadding = 12;
        const rect = refs.contextMenu.getBoundingClientRect();
        const left = Math.min(
            state.contextMenu.screen.x,
            window.innerWidth - rect.width - viewportPadding
        );
        const top = Math.min(
            state.contextMenu.screen.y,
            window.innerHeight - rect.height - viewportPadding
        );
        refs.contextMenu.style.left = `${Math.max(viewportPadding, left)}px`;
        refs.contextMenu.style.top = `${Math.max(viewportPadding, top)}px`;
    }

    function addContextMenuAction(label: string, onClick: () => void, disabled = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener('click', () => {
            if (disabled) return;
            onClick();
            closeContextMenu();
        });
        refs.contextMenuBody.appendChild(button);
    }

    function addContextMenuDivider() {
        refs.contextMenuBody.appendChild(document.createElement('hr'));
    }

    function addContextMenuSubmenu(
        label: string,
        renderBody: (body: HTMLDivElement) => void,
        disabled = false
    ) {
        const details = document.createElement('details');
        details.className = 'world-designer-context-submenu';
        details.open = false;

        const summary = document.createElement('summary');
        summary.textContent = label;
        if (disabled) {
            summary.style.opacity = '0.45';
            summary.style.cursor = 'default';
        }
        details.appendChild(summary);

        if (!disabled) {
            const body = document.createElement('div');
            body.className = 'world-designer-context-submenu-body';
            renderBody(body);
            details.appendChild(body);
        }

        refs.contextMenuBody.appendChild(details);
    }

    function addContextMenuActionToContainer(container: HTMLElement, label: string, onClick: () => void, disabled = false) {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.disabled = disabled;
        button.addEventListener('click', () => {
            if (disabled) return;
            onClick();
            closeContextMenu();
        });
        container.appendChild(button);
    }

    function addContextMenuToggleActionToContainer(
        container: HTMLElement,
        label: string,
        checked: boolean,
        onClick: () => void,
        disabled = false
    ) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = 'world-designer-context-toggle-action';
        button.disabled = disabled;

        const check = document.createElement('span');
        check.className = 'world-designer-context-toggle-check';
        check.textContent = checked ? '✓' : '';
        button.appendChild(check);

        const text = document.createElement('span');
        text.textContent = label;
        button.appendChild(text);

        button.addEventListener('click', () => {
            if (disabled) return;
            onClick();
            closeContextMenu();
        });
        container.appendChild(button);
    }

    function getContextMenuWorldPosition() {
        return state.contextMenu.world;
    }

    function getContextMenuTargetSelection() {
        return state.contextMenu.primarySelection;
    }

    function getContextMenuActionSelections() {
        const primary = getContextMenuTargetSelection();
        if (!primary) {
            return [];
        }
        const selected = getSelectedItems();
        return selected.some((item) => areSameSelection(item, primary))
            ? selected
            : [primary];
    }

    function activateContextMenuSelections() {
        const primary = getContextMenuTargetSelection();
        const selections = getContextMenuActionSelections();
        if (!primary || selections.length === 0) {
            return;
        }
        setSelections(selections, primary);
    }

    function setPaletteSelection(palette: number) {
        const selections = getSelectedItems();
        if (selections.length === 0) return;
        const clampedPalette = clamp(palette, 0, paletteCount - 1);
        runMutation(`Set palette to ${clampedPalette}.`, () => {
            for (const selection of selections) {
                if (!('palette' in selection.entity)) continue;
                selection.entity.palette = clampedPalette;
            }
        });
        updateSelectionFromInspectorState();
    }

    function setWorldAstronautMask(maskAstronaut: boolean) {
        const worldSelections = getSelectedItems().filter((selection) => selection.category === 'world');
        if (worldSelections.length === 0) return;
        runMutation(`Updated astronaut masking${maskAstronaut ? '' : ' off'}.`, () => {
            for (const selection of worldSelections) {
                selection.entity.maskAstronaut = maskAstronaut;
            }
        });
    }

    function setContextMenuWorldAstronautMask(maskAstronaut: boolean) {
        const selection = getContextMenuTargetSelection();
        if (!selection || selection.category !== 'world') return;
        runMutation(`Updated astronaut masking${maskAstronaut ? '' : ' off'}.`, () => {
            selection.entity.maskAstronaut = maskAstronaut;
        });
    }

    function addContextMenuPaletteSubmenu(disabled = false) {
        const selection = state.contextMenu.primarySelection;
        const currentPalette = selection && 'palette' in selection.entity && typeof selection.entity.palette === 'number'
            ? selection.entity.palette
            : 0;
        const previewType = selection?.entity.type ?? getCurrentType();
        const previewRotation = selection?.entity.rotation ?? state.rotation;
        const previewTranslation = selection?.category === 'world'
            ? normalizeSpriteTranslation(selection.entity.translation)
            : (state.category === 'world' ? state.translation : 'center');

        addContextMenuSubmenu(`Palette (${currentPalette})`, (body) => {
            for (let palette = 0; palette < paletteCount; palette += 1) {
                const button = document.createElement('button');
                button.type = 'button';
                button.className = 'world-designer-context-palette-option';
                if (palette === currentPalette) {
                    button.classList.add('selected');
                }

                const canvas = document.createElement('canvas');
                canvas.className = 'world-designer-context-palette-canvas';
                canvas.width = 36;
                canvas.height = 36;
                renderSpritePreviewCanvas(
                    canvas,
                    previewType,
                    palette,
                    normalizeRotation(previewRotation),
                    previewTranslation
                );
                button.appendChild(canvas);

                const label = document.createElement('span');
                label.className = 'world-designer-context-palette-label';
                label.textContent = `Palette ${palette}`;
                button.appendChild(label);

                button.addEventListener('click', () => {
                    activateContextMenuSelections();
                    closeContextMenu();
                    setPaletteSelection(palette);
                });
                body.appendChild(button);
            }
        }, disabled);
    }

    function setContextMenuSelectionCollision(enabled: boolean) {
        const selection = getContextMenuTargetSelection();
        if (!selection || !('collision' in selection.entity)) return;
        runMutation(`Updated ${selection.category} collision.`, () => {
            selection.entity.collision = enabled;
            if (selection.category === 'world' && !enabled && typeof selection.entity.maskAstronaut !== 'boolean') {
                selection.entity.maskAstronaut = selection.entity.type === 'black_background' ? false : true;
            }
        });
    }

    function setContextMenuCollectableFlag(
        message: string,
        mutate: (entity: Collectable) => void
    ) {
        const selection = getContextMenuTargetSelection();
        if (!selection || selection.category !== 'collectables') return;
        runMutation(message, () => {
            mutate(selection.entity as Collectable);
        });
    }

    function convertPrimarySelectionToCategory(targetCategory: DesignerCategory, message: string) {
        const selection = getContextMenuTargetSelection();
        if (!selection || selection.category === targetCategory) return;
        runMutation(message, () => {
            convertSelectionToCategory(selection, targetCategory);
        });
    }

    function pasteSelectionAtWorld(world: Position) {
        if (clipboardEntries.length === 0) {
            setStatus('Nothing copied yet.', 'neutral');
            return;
        }
        const target = resolvePlacementPosition(world.x, world.y);
        const xs = clipboardEntries.map((entry) => entry.data.x);
        const ys = clipboardEntries.map((entry) => entry.data.y);
        const sourceCenter = {
            x: (Math.min(...xs) + Math.max(...xs)) / 2,
            y: (Math.min(...ys) + Math.max(...ys)) / 2
        };
        runMutation('Pasted selection at cursor.', () => {
            const pastedSelections = createPastedSelections(
                clipboardEntries,
                target.x - sourceCenter.x,
                target.y - sourceCenter.y
            );
            setSelections(pastedSelections);
        });
    }

    function setAstronautStartAtWorldPosition(world: Position) {
        const target = resolvePlacementPosition(world.x, world.y);
        runMutation('Updated astronaut start position.', () => {
            host.setAstronautStartPosition(target);
        });
    }

    function moveLiveAstronautToWorldPosition(world: Position) {
        const target = {
            x: Math.round(world.x),
            y: Math.round(world.y)
        };
        host.resetAstronautToPosition(target);
        if (state.liveResumeSnapshot) {
            state.liveResumeSnapshot.astronautPosition = target;
        }
        setStatus('Moved the live astronaut to the clicked position.', 'success');
    }

    function toggleDoorLockedDefault() {
        const selection = state.contextMenu.primarySelection;
        if (!selection || selection.category !== 'doors') return;
        runMutation('Toggled door locked default.', () => {
            const nextLocked = !(selection.entity.defaultLocked ?? selection.entity.locked ?? false);
            selection.entity.defaultLocked = nextLocked;
            selection.entity.locked = nextLocked;
        });
    }

    function toggleDoorOpenDefault() {
        const selection = state.contextMenu.primarySelection;
        if (!selection || selection.category !== 'doors') return;
        runMutation('Toggled door open default.', () => {
            const nextOpen = !(selection.entity.defaultOpen ?? selection.entity.open ?? false);
            selection.entity.defaultOpen = nextOpen;
            selection.entity.open = nextOpen;
        });
    }

    function toggleButtonActiveDefault() {
        const selection = state.contextMenu.primarySelection;
        if (!selection || selection.category !== 'buttons') return;
        runMutation('Toggled button active default.', () => {
            const nextActive = !(selection.entity.defaultActive ?? selection.entity.active ?? false);
            selection.entity.defaultActive = nextActive;
            selection.entity.active = nextActive;
        });
    }

    function openContextMenu(selection: Selection, event: MouseEvent) {
        state.contextMenu.primarySelection = selection;
        state.contextMenu.screen = {
            x: event.clientX,
            y: event.clientY
        };
        const point = getCanvasPoint(event);
        state.contextMenu.world = screenToWorld(point.x, point.y);
        refs.contextMenuBody.innerHTML = '';

        const selectedItems = getSelectedItems();
        addContextMenuSubmenu('Edit', (body) => {
            addContextMenuActionToContainer(body, 'Rotate', () => {
                activateContextMenuSelections();
                rotateSelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Send to back', () => {
                activateContextMenuSelections();
                reorderSelections(false);
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Bring to front', () => {
                activateContextMenuSelections();
                reorderSelections(true);
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Copy', () => {
                activateContextMenuSelections();
                copySelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Duplicate', () => {
                activateContextMenuSelections();
                duplicateSelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Delete', () => {
                activateContextMenuSelections();
                deleteSelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Focus selection', () => {
                activateContextMenuSelections();
                focusSelection();
            }, selectedItems.length === 0 && !selection);
            addContextMenuActionToContainer(body, 'Group as custom sprite', () => {
                activateContextMenuSelections();
                groupSelectionsAsCustomSprite();
            }, !canGroupSelections(selectedItems.length > 0 ? selectedItems : selection ? [selection] : []));
            addContextMenuActionToContainer(body, 'Ungroup custom sprite', () => {
                activateContextMenuSelections();
                ungroupCustomSpriteSelection();
            }, selection.category !== 'custom');
            addContextMenuActionToContainer(body, 'Delete custom sprite type', () => {
                activateContextMenuSelections();
                deleteCustomSpriteSelectionDefinition();
            }, selection.category !== 'custom');
        }, !selection);

        addContextMenuPaletteSubmenu(selectedItems.length === 0 || selection.category === 'custom');

        if ('collision' in selection.entity || selection.category === 'world') {
            addContextMenuSubmenu('Properties', (body) => {
                if ('collision' in selection.entity) {
                    addContextMenuToggleActionToContainer(
                        body,
                        'Collision enabled',
                        selection.entity.collision !== false,
                        () => setContextMenuSelectionCollision(selection.entity.collision === false)
                    );
                }
                if (selection.category === 'world') {
                    addContextMenuToggleActionToContainer(
                        body,
                        'Mask astronaut',
                        shouldMaskAstronaut(selection.entity),
                        () => setContextMenuWorldAstronautMask(!shouldMaskAstronaut(selection.entity))
                    );
                }
            });
        }

        if (selection.category === 'collectables') {
            addContextMenuSubmenu('Collectable', (body) => {
                addContextMenuToggleActionToContainer(
                    body,
                    'Can be picked up',
                    selection.entity.pickupEnabled ?? true,
                    () => setContextMenuCollectableFlag('Updated pickup flag.', (entity) => {
                        entity.pickupEnabled = !(entity.pickupEnabled ?? true);
                        if (entity.pickupEnabled === false) {
                            entity.storable = false;
                            entity.stored = false;
                        }
                    })
                );
                addContextMenuToggleActionToContainer(
                    body,
                    'Storable',
                    selection.entity.storable ?? false,
                    () => setContextMenuCollectableFlag('Updated storable flag.', (entity) => {
                        entity.storable = !(entity.storable ?? false);
                        if (entity.storable) {
                            entity.pickupEnabled = true;
                        }
                    })
                );
                addContextMenuToggleActionToContainer(
                    body,
                    'Collected by default',
                    selection.entity.collected ?? false,
                    () => setContextMenuCollectableFlag('Updated collected flag.', (entity) => {
                        entity.collected = !(entity.collected ?? false);
                    })
                );
                addContextMenuToggleActionToContainer(
                    body,
                    'Affects astronaut',
                    selection.entity.affectsAstronaut ?? true,
                    () => setContextMenuCollectableFlag('Updated affects astronaut flag.', (entity) => {
                        entity.affectsAstronaut = !(entity.affectsAstronaut ?? true);
                    })
                );
            });
        }

        if (
            selection.category === 'world' ||
            selection.category === 'collectables' ||
            selection.category === 'buttons' ||
            selection.category === 'doors' ||
            selection.category === 'creatures' ||
            selection.category === 'custom'
        ) {
            addContextMenuSubmenu('Convert', (body) => {
                if (selection.category === 'world') {
                    const teleporterPair = getContextMenuSelectedTeleporterPair();
                    addContextMenuActionToContainer(body, 'Convert selected base+pad to teleporter', () => {
                        if (!teleporterPair) {
                            return;
                        }
                        runMutation('Converted selected teleporter base+pad to a teleporter.', () => {
                            convertTeleporterWorldPair(teleporterPair.base, teleporterPair.pad);
                        });
                    }, !teleporterPair);
                    addContextMenuActionToContainer(body, 'Convert to collectable', () => {
                        convertPrimarySelectionToCategory('collectables', 'Converted world item to collectable.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to creature', () => {
                        convertPrimarySelectionToCategory('creatures', 'Converted world item to creature.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to button', () => {
                        convertPrimarySelectionToCategory('buttons', 'Converted world item to button.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to door', () => {
                        convertPrimarySelectionToCategory('doors', 'Converted world item to door.');
                    });
                } else if (selection.category === 'collectables') {
                    addContextMenuActionToContainer(body, 'Convert to world item', () => {
                        convertPrimarySelectionToCategory('world', 'Converted collectable to world item.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to creature', () => {
                        convertPrimarySelectionToCategory('creatures', 'Converted collectable to creature.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to button', () => {
                        convertPrimarySelectionToCategory('buttons', 'Converted collectable to button.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to door', () => {
                        convertPrimarySelectionToCategory('doors', 'Converted collectable to door.');
                    });
                } else if (selection.category === 'buttons') {
                    addContextMenuActionToContainer(body, 'Convert to world item', () => {
                        convertPrimarySelectionToCategory('world', 'Converted button to world item.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to collectable', () => {
                        convertPrimarySelectionToCategory('collectables', 'Converted button to collectable.');
                    });
                } else if (selection.category === 'doors') {
                    addContextMenuActionToContainer(body, 'Convert to world item', () => {
                        convertPrimarySelectionToCategory('world', 'Converted door to world item.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to collectable', () => {
                        convertPrimarySelectionToCategory('collectables', 'Converted door to collectable.');
                    });
                } else if (selection.category === 'creatures') {
                    addContextMenuActionToContainer(body, 'Convert to world item', () => {
                        convertPrimarySelectionToCategory('world', 'Converted creature to world item.');
                    });
                    addContextMenuActionToContainer(body, 'Convert to collectable', () => {
                        convertPrimarySelectionToCategory('collectables', 'Converted creature to collectable.');
                    });
                } else if (selection.category === 'custom') {
                    addContextMenuActionToContainer(body, 'Convert to button', () => {
                        convertPrimarySelectionToCategory('buttons', 'Converted custom sprite to button.');
                    }, !canConvertCustomSpriteToButton(selection.entity as CustomSpriteInstance));
                }
            });
        }

        if (selection.category === 'doors' || selection.category === 'buttons') {
            addContextMenuSubmenu('Defaults', (body) => {
                if (selection.category === 'doors') {
                    addContextMenuToggleActionToContainer(
                        body,
                        'Locked by default',
                        selection.entity.defaultLocked ?? selection.entity.locked ?? false,
                        toggleDoorLockedDefault
                    );
                    addContextMenuToggleActionToContainer(
                        body,
                        'Open by default',
                        selection.entity.defaultOpen ?? selection.entity.open ?? false,
                        toggleDoorOpenDefault
                    );
                } else {
                    addContextMenuToggleActionToContainer(
                        body,
                        'Active by default',
                        selection.entity.defaultActive ?? selection.entity.active ?? false,
                        toggleButtonActiveDefault
                    );
                }
            });
        }

        refs.contextMenu.classList.add('open');
        positionContextMenu();
    }

    function openEmptyContextMenu(event: MouseEvent, world: Position) {
        state.contextMenu.primarySelection = null;
        state.contextMenu.screen = {
            x: event.clientX,
            y: event.clientY
        };
        state.contextMenu.world = world;
        refs.contextMenuBody.innerHTML = '';
        addContextMenuAction('Paste copied selection here', () => {
            const target = getContextMenuWorldPosition();
            if (!target) return;
            pasteSelectionAtWorld(target);
        }, clipboardEntries.length === 0);
        addContextMenuDivider();
        addContextMenuAction('Set astronaut start here', () => {
            const target = getContextMenuWorldPosition();
            if (!target) return;
            setAstronautStartAtWorldPosition(target);
        });
        addContextMenuAction('Move live astronaut here', () => {
            const target = getContextMenuWorldPosition();
            if (!target) return;
            moveLiveAstronautToWorldPosition(target);
        });
        refs.contextMenu.classList.add('open');
        positionContextMenu();
    }

    return {
        closeContextMenu,
        positionContextMenu,
        getContextMenuWorldPosition,
        getContextMenuActionSelections,
        openContextMenu,
        openEmptyContextMenu
    };
}
