type FocusSetter = (key: string) => void;

export function addCheckboxInspector(
    container: HTMLElement,
    label: string,
    checked: boolean,
    onChange: (checked: boolean) => void,
    setPendingFocusKey: FocusSetter
) {
    const row = document.createElement('label');
    row.className = 'world-designer-checkbox';
    const input = document.createElement('input');
    const focusKey = label;
    input.type = 'checkbox';
    input.checked = checked;
    input.dataset.inspectorKey = focusKey;
    input.addEventListener('change', () => {
        setPendingFocusKey(focusKey);
        onChange(input.checked);
    });
    row.appendChild(input);
    row.append(label);
    container.appendChild(row);
}

export function addTextInspector(
    container: HTMLElement,
    label: string,
    value: string,
    onCommit: (value: string) => void,
    setPendingFocusKey: FocusSetter,
    multiline = false
) {
    const field = document.createElement('label');
    field.className = 'world-designer-field';
    field.textContent = label;
    const input = multiline ? document.createElement('textarea') : document.createElement('input');
    const focusKey = label;
    input.value = value;
    input.dataset.inspectorKey = focusKey;
    input.addEventListener('change', () => {
        setPendingFocusKey(focusKey);
        onCommit(input.value);
    });
    field.appendChild(input);
    container.appendChild(field);
}

export function addNumberInspector(
    container: HTMLElement,
    label: string,
    value: number,
    onCommit: (value: number) => void,
    setPendingFocusKey: FocusSetter,
    step = 1
) {
    const field = document.createElement('label');
    field.className = 'world-designer-field';
    field.textContent = label;
    const input = document.createElement('input');
    const focusKey = label;
    input.type = 'number';
    input.step = String(step);
    input.value = String(value);
    input.dataset.inspectorKey = focusKey;
    input.addEventListener('change', () => {
        setPendingFocusKey(focusKey);
        onCommit(Number(input.value));
    });
    field.appendChild(input);
    container.appendChild(field);
}

export function addSelectInspector(
    container: HTMLElement,
    label: string,
    value: string,
    options: string[],
    onCommit: (value: string) => void,
    setPendingFocusKey: FocusSetter
) {
    const field = document.createElement('label');
    field.className = 'world-designer-field';
    field.textContent = label;
    const select = document.createElement('select');
    const focusKey = label;
    for (const optionValue of options) {
        const option = document.createElement('option');
        option.value = optionValue;
        option.textContent = optionValue;
        select.appendChild(option);
    }
    select.value = value;
    select.dataset.inspectorKey = focusKey;
    select.addEventListener('change', () => {
        setPendingFocusKey(focusKey);
        onCommit(select.value);
    });
    field.appendChild(select);
    container.appendChild(field);
}

export function addOptionSelectInspector(
    container: HTMLElement,
    label: string,
    value: string,
    options: Array<{ value: string; label: string }>,
    onCommit: (value: string) => void,
    setPendingFocusKey: FocusSetter
) {
    const field = document.createElement('label');
    field.className = 'world-designer-field';
    field.textContent = label;
    const select = document.createElement('select');
    const focusKey = label;
    for (const optionValue of options) {
        const option = document.createElement('option');
        option.value = optionValue.value;
        option.textContent = optionValue.label;
        select.appendChild(option);
    }
    select.value = value;
    select.dataset.inspectorKey = focusKey;
    select.addEventListener('change', () => {
        setPendingFocusKey(focusKey);
        onCommit(select.value);
    });
    field.appendChild(select);
    container.appendChild(field);
}

export function restorePendingInspectorFocus(container: HTMLElement, pendingInspectorFocusKey: string | null) {
    if (!pendingInspectorFocusKey) {
        return pendingInspectorFocusKey;
    }
    const selector = `[data-inspector-key="${CSS.escape(pendingInspectorFocusKey)}"]`;
    const field = container.querySelector(selector);
    if (!(field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement || field instanceof HTMLSelectElement)) {
        return null;
    }
    if (field.disabled) {
        return null;
    }
    field.focus();
    if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
        field.select();
    }
    return null;
}

export function addInspectorAction(
    container: HTMLElement,
    label: string,
    onClick: () => void
) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    button.addEventListener('click', onClick);
    container.appendChild(button);
}
