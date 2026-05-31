import type { ControlRefs } from '../core/world-designer-types.js';

type CreateWorldDesignerDomOptions = {
    magnifierSize: number;
    magnifierZoom: number;
};

type WorldDesignerDom = {
    refs: ControlRefs;
    panelDragHandle: HTMLDivElement;
    paletteFlyoutDragHandle: HTMLDivElement;
    magnifierCanvas: HTMLCanvasElement;
    sectionAccordions: HTMLDetailsElement[];
};

type WorldDesignerDomTemplates = {
    panel: string;
    modal: string;
    contextMenu: string;
    paletteFlyout: string;
};

const WORLD_DESIGNER_DOM_TEMPLATE_URL = './src/designer/dom/world-designer-dom.html';
let worldDesignerDomTemplatesCache: WorldDesignerDomTemplates | null = null;

function getTemplateInnerHtml(doc: Document, templateId: string) {
    const template = doc.getElementById(templateId);
    if (!(template instanceof HTMLTemplateElement)) {
        throw new Error(`Missing HTML template: ${templateId}`);
    }
    return template.innerHTML;
}

function loadWorldDesignerDomTemplates() {
    if (worldDesignerDomTemplatesCache) {
        return worldDesignerDomTemplatesCache;
    }

    // Designer DOM creation is synchronous today, so load and parse the template synchronously once.
    const request = new XMLHttpRequest();
    request.open('GET', `${WORLD_DESIGNER_DOM_TEMPLATE_URL}?t=${Date.now()}`, false);
    request.send();
    if (request.status < 200 || request.status >= 300) {
        throw new Error(`Failed to load world designer DOM template: ${request.status} ${request.statusText}`);
    }

    const parser = new DOMParser();
    const documentNode = parser.parseFromString(request.responseText, 'text/html');
    worldDesignerDomTemplatesCache = {
        panel: getTemplateInnerHtml(documentNode, 'world-designer-panel-template'),
        modal: getTemplateInnerHtml(documentNode, 'world-designer-modal-template'),
        contextMenu: getTemplateInnerHtml(documentNode, 'world-designer-context-menu-template'),
        paletteFlyout: getTemplateInnerHtml(documentNode, 'world-designer-palette-flyout-template')
    };
    return worldDesignerDomTemplatesCache;
}

export function createWorldDesignerDom({ magnifierSize, magnifierZoom }: CreateWorldDesignerDomOptions): WorldDesignerDom {
    const templates = loadWorldDesignerDomTemplates();

    const root = document.createElement('div');
    root.className = 'world-designer-panel world-designer-hidden';
    root.innerHTML = templates.panel;
    document.body.appendChild(root);

    const modal = document.createElement('div');
    modal.className = 'world-designer-modal';
    modal.innerHTML = templates.modal;
    document.body.appendChild(modal);

    const contextMenu = document.createElement('div');
    contextMenu.className = 'world-designer-context-menu';
    contextMenu.innerHTML = templates.contextMenu;
    document.body.appendChild(contextMenu);

    const paletteFlyout = document.createElement('div');
    paletteFlyout.className = 'world-designer-flyout world-designer-flyout-hidden';
    paletteFlyout.innerHTML = templates.paletteFlyout;
    document.body.appendChild(paletteFlyout);

    const panelDragHandle = root.querySelector('[data-role="panel-drag-handle"]') as HTMLDivElement;
    const paletteFlyoutDragHandle = paletteFlyout.querySelector('[data-role="palette-flyout-drag-handle"]') as HTMLDivElement;
    const magnifierCanvas = document.createElement('canvas');
    magnifierCanvas.width = Math.max(1, Math.round(magnifierSize / magnifierZoom));
    magnifierCanvas.height = Math.max(1, Math.round(magnifierSize / magnifierZoom));

    const refs: ControlRefs = {
        root,
        modeSelect: root.querySelector('[data-role="mode"]') as HTMLSelectElement,
        toolSelect: root.querySelector('[data-role="tool"]') as HTMLSelectElement,
        categorySelect: root.querySelector('[data-role="category"]') as HTMLSelectElement,
        typeSelect: root.querySelector('[data-role="type"]') as HTMLSelectElement,
        spritePreviewCanvas: root.querySelector('[data-role="sprite-preview"]') as HTMLCanvasElement,
        spritePreviewMeta: root.querySelector('[data-role="sprite-preview-meta"]') as HTMLDivElement,
        spritePicker: root.querySelector('[data-role="sprite-picker"]') as HTMLDetailsElement,
        spritePickerFilter: root.querySelector('[data-role="sprite-picker-filter"]') as HTMLInputElement,
        spritePickerCategoryFilter: root.querySelector('[data-role="sprite-picker-category-filter"]') as HTMLSelectElement,
        spritePickerGrid: root.querySelector('[data-role="sprite-picker-grid"]') as HTMLDivElement,
        rotationSelect: root.querySelector('[data-role="rotation"]') as HTMLSelectElement,
        translationSelect: root.querySelector('[data-role="translation"]') as HTMLSelectElement,
        paletteSelect: root.querySelector('[data-role="palette"]') as HTMLSelectElement,
        snapCheckbox: root.querySelector('[data-role="snap"]') as HTMLInputElement,
        objectSnapCheckbox: root.querySelector('[data-role="object-snap"]') as HTMLInputElement,
        snapOffsetXInput: root.querySelector('[data-role="snap-offset-x"]') as HTMLInputElement,
        snapOffsetYInput: root.querySelector('[data-role="snap-offset-y"]') as HTMLInputElement,
        snapOffsetCaptureButton: root.querySelector('[data-role="snap-offset-capture"]') as HTMLButtonElement,
        nudgeInput: root.querySelector('[data-role="nudge"]') as HTMLInputElement,
        status: root.querySelector('[data-role="status"]') as HTMLDivElement,
        selectionSummary: root.querySelector('[data-role="selection-summary"]') as HTMLDivElement,
        inspector: root.querySelector('[data-role="inspector"]') as HTMLDivElement,
        overviewCanvas: root.querySelector('[data-role="overview"]') as HTMLCanvasElement,
        activeToggle: root.querySelector('[data-role="active-toggle"]') as HTMLButtonElement,
        paletteDesignerToggle: root.querySelector('[data-role="palette-designer-toggle"]') as HTMLButtonElement,
        pngImportButton: root.querySelector('[data-role="png-import"]') as HTMLButtonElement,
        savePreviewButton: root.querySelector('[data-role="save-preview"]') as HTMLButtonElement,
        normalizeSpriteSheetButton: root.querySelector('[data-role="normalize-sprite-sheet"]') as HTMLButtonElement,
        deleteButton: root.querySelector('[data-role="delete"]') as HTMLButtonElement,
        duplicateButton: root.querySelector('[data-role="duplicate"]') as HTMLButtonElement,
        sendToBackButton: root.querySelector('[data-role="send-to-back"]') as HTMLButtonElement,
        bringToFrontButton: root.querySelector('[data-role="bring-to-front"]') as HTMLButtonElement,
        focusButton: root.querySelector('[data-role="focus"]') as HTMLButtonElement,
        convertTargetSelect: root.querySelector('[data-role="convert-target"]') as HTMLSelectElement,
        convertButton: root.querySelector('[data-role="convert"]') as HTMLButtonElement,
        focusAstronautButton: root.querySelector('[data-role="focus-astronaut"]') as HTMLButtonElement,
        moveAstronautButton: root.querySelector('[data-role="move-astronaut"]') as HTMLButtonElement,
        expandViewportCheckbox: root.querySelector('[data-role="expand-viewport"]') as HTMLInputElement,
        soundEnabledCheckbox: root.querySelector('[data-role="sound-enabled"]') as HTMLInputElement,
        bulletImpactPrimarySelect: root.querySelector('[data-role="bullet-impact-primary"]') as HTMLSelectElement,
        bulletImpactAlternateSelect: root.querySelector('[data-role="bullet-impact-alternate"]') as HTMLSelectElement,
        bulletImpactAlternateChanceInput: root.querySelector('[data-role="bullet-impact-alternate-chance"]') as HTMLInputElement,
        bulletImpactVolumeInput: root.querySelector('[data-role="bullet-impact-volume"]') as HTMLInputElement,
        windEnabledCheckbox: root.querySelector('[data-role="wind-enabled"]') as HTMLInputElement,
        windEmittersEnabledCheckbox: root.querySelector('[data-role="wind-emitters-enabled"]') as HTMLInputElement,
        windSurfaceEnabledCheckbox: root.querySelector('[data-role="wind-surface-enabled"]') as HTMLInputElement,
        windVfxEnabledCheckbox: root.querySelector('[data-role="wind-vfx-enabled"]') as HTMLInputElement,
        addAtCenterButton: root.querySelector('[data-role="add-center"]') as HTMLButtonElement,
        setAstronautStartButton: root.querySelector('[data-role="set-start"]') as HTMLButtonElement,
        showCollisionCheckbox: root.querySelector('[data-role="show-collision"]') as HTMLInputElement,
        showCreatureOverlaysCheckbox: root.querySelector('[data-role="show-creature-overlays"]') as HTMLInputElement,
        showSpriteOutlineCheckbox: root.querySelector('[data-role="show-sprite-outlines"]') as HTMLInputElement,
        showPerformanceHudCheckbox: root.querySelector('[data-role="show-performance-hud"]') as HTMLInputElement,
        magnifierCheckbox: root.querySelector('[data-role="magnifier-enabled"]') as HTMLInputElement,
        disablePreviewCollisionCheckbox: root.querySelector('[data-role="disable-preview-collision"]') as HTMLInputElement,
        layerCheckboxes: {
            world: root.querySelector('[data-layer="world"]') as HTMLInputElement,
            buttons: root.querySelector('[data-layer="buttons"]') as HTMLInputElement,
            doors: root.querySelector('[data-layer="doors"]') as HTMLInputElement,
            creatures: root.querySelector('[data-layer="creatures"]') as HTMLInputElement,
            collectables: root.querySelector('[data-layer="collectables"]') as HTMLInputElement,
            custom: root.querySelector('[data-layer="custom"]') as HTMLInputElement
        },
        modal,
        modalTitle: modal.querySelector('[data-role="modal-title"]') as HTMLHeadingElement,
        modalBody: modal.querySelector('[data-role="modal-body"]') as HTMLDivElement,
        modalClose: modal.querySelector('[data-role="modal-close"]') as HTMLButtonElement,
        modalConfirm: modal.querySelector('[data-role="modal-confirm"]') as HTMLButtonElement,
        contextMenu,
        contextMenuBody: contextMenu.querySelector('[data-role="context-menu-body"]') as HTMLDivElement,
        paletteFlyout,
        paletteFlyoutClose: paletteFlyout.querySelector('[data-role="palette-flyout-close"]') as HTMLButtonElement,
        paletteList: paletteFlyout.querySelector('[data-role="palette-list"]') as HTMLSelectElement,
        paletteUsage: paletteFlyout.querySelector('[data-role="palette-usage"]') as HTMLDivElement,
        palettePreviewCanvas: paletteFlyout.querySelector('[data-role="palette-preview-canvas"]') as HTMLCanvasElement,
        palettePreviewTypeSelect: paletteFlyout.querySelector('[data-role="palette-preview-type"]') as HTMLSelectElement,
        paletteMappings: paletteFlyout.querySelector('[data-role="palette-mappings"]') as HTMLDivElement,
        paletteNewButton: paletteFlyout.querySelector('[data-role="palette-new"]') as HTMLButtonElement,
        paletteCloneButton: paletteFlyout.querySelector('[data-role="palette-clone"]') as HTMLButtonElement,
        paletteDeleteButton: paletteFlyout.querySelector('[data-role="palette-delete"]') as HTMLButtonElement,
        paletteAddMappingButton: paletteFlyout.querySelector('[data-role="palette-add-mapping"]') as HTMLButtonElement,
        paletteSaveButton: paletteFlyout.querySelector('[data-role="palette-save"]') as HTMLButtonElement
    };

    const sectionAccordions = [
        ...Array.from(root.querySelectorAll('[data-section-id]')),
        ...Array.from(paletteFlyout.querySelectorAll('[data-section-id]'))
    ] as HTMLDetailsElement[];

    return {
        refs,
        panelDragHandle,
        paletteFlyoutDragHandle,
        magnifierCanvas,
        sectionAccordions
    };
}
