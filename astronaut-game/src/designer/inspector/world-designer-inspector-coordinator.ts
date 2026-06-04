import {
    addCheckboxInspector as addCheckboxInspectorControl,
    addInspectorAction as addInspectorActionControl,
    addNumberInspector as addNumberInspectorControl,
    addOptionSelectInspector as addOptionSelectInspectorControl,
    addSelectInspector as addSelectInspectorControl,
    addTextInspector as addTextInspectorControl,
    restorePendingInspectorFocus as restorePendingInspectorFocusControl
} from './world-designer-inspector-controls.js';
import { createWorldDesignerInspectorPanel } from './world-designer-inspector-panel.js';

type PendingInspectorFocusRef = {
    get: () => string | null;
    set: (value: string | null) => void;
};

export function createWorldDesignerInspectorCoordinator(deps: {
    panelDeps: any;
    inspectorRoot: HTMLElement;
    pendingInspectorFocusRef: PendingInspectorFocusRef;
}) {
    const {
        panelDeps,
        inspectorRoot,
        pendingInspectorFocusRef
    } = deps;

    function addCheckboxInspector(
        container: HTMLElement,
        label: string,
        checked: boolean,
        onChange: (checked: boolean) => void
    ) {
        addCheckboxInspectorControl(container, label, checked, onChange, (focusKey) => {
            pendingInspectorFocusRef.set(focusKey);
        });
    }

    function addTextInspector(
        container: HTMLElement,
        label: string,
        value: string,
        onCommit: (value: string) => void,
        multiline = false
    ) {
        addTextInspectorControl(container, label, value, onCommit, (focusKey) => {
            pendingInspectorFocusRef.set(focusKey);
        }, multiline);
    }

    function addNumberInspector(
        container: HTMLElement,
        label: string,
        value: number,
        onCommit: (value: number) => void,
        step = 1
    ) {
        addNumberInspectorControl(container, label, value, onCommit, (focusKey) => {
            pendingInspectorFocusRef.set(focusKey);
        }, step);
    }

    function addSelectInspector(
        container: HTMLElement,
        label: string,
        value: string,
        options: string[],
        onCommit: (value: string) => void
    ) {
        addSelectInspectorControl(container, label, value, options, onCommit, (focusKey) => {
            pendingInspectorFocusRef.set(focusKey);
        });
    }

    function addOptionSelectInspector(
        container: HTMLElement,
        label: string,
        value: string,
        options: Array<{ value: string; label: string }>,
        onCommit: (value: string) => void
    ) {
        addOptionSelectInspectorControl(container, label, value, options, onCommit, (focusKey) => {
            pendingInspectorFocusRef.set(focusKey);
        });
    }

    function restorePendingInspectorFocus() {
        pendingInspectorFocusRef.set(
            restorePendingInspectorFocusControl(inspectorRoot, pendingInspectorFocusRef.get())
        );
    }

    function addInspectorAction(
        container: HTMLElement,
        label: string,
        onClick: () => void
    ) {
        addInspectorActionControl(container, label, onClick);
    }

    const inspectorPanel = createWorldDesignerInspectorPanel({
        ...panelDeps,
        addCheckboxInspector,
        addTextInspector,
        addNumberInspector,
        addSelectInspector,
        addOptionSelectInspector,
        addInspectorAction
    });

    return {
        addCheckboxInspector,
        addTextInspector,
        addNumberInspector,
        addSelectInspector,
        addOptionSelectInspector,
        restorePendingInspectorFocus,
        addInspectorAction,
        updateSelectionSummary: () => {
            inspectorPanel.updateSelectionSummary();
        },
        renderButtonDefaultsInspector: (container: HTMLElement, selectedButton: any) => {
            inspectorPanel.renderButtonDefaultsInspector(container, selectedButton);
        },
        refreshInspector: () => {
            inspectorPanel.refreshInspector();
        }
    };
}
