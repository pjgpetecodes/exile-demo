// Centralized keyboard/input normalization for gameplay and designer mode.
export function shouldBlockBrowserShortcut(event: KeyboardEvent) {
    if (!(event.ctrlKey || event.metaKey)) {
        return false;
    }
    const key = event.key.toLowerCase();
    return key === 'p' || key === 'w' || event.code === 'KeyP' || event.code === 'KeyW';
}

export function blockBrowserShortcut(event: KeyboardEvent) {
    if (!shouldBlockBrowserShortcut(event)) {
        return false;
    }
    event.preventDefault();
    event.stopImmediatePropagation();
    return true;
}

export function getInputKey(event: KeyboardEvent) {
    if (event.code === 'Space') {
        return ' ';
    }
    if (event.code === 'ArrowLeft') {
        return 'q';
    }
    if (event.code === 'ArrowRight') {
        return 'w';
    }
    if (event.code === 'Quote' && event.shiftKey) {
        return '@';
    }
    if (event.key.length === 1) {
        return event.key.toLowerCase();
    }
    return event.key;
}

export function shouldPreventGameplayDefault(event: KeyboardEvent, designerOpen: boolean) {
    if (designerOpen) {
        return false;
    }
    const key = getInputKey(event);
    return (
        key === ' ' ||
        key === 'Tab' ||
        key === '@' ||
        key === "'" ||
        key === '/' ||
        key === 'q' ||
        key === 'w' ||
        key === 'p' ||
        key === 'l' ||
        event.code === 'ArrowLeft' ||
        event.code === 'ArrowRight' ||
        event.code === 'Quote' ||
        event.code === 'Slash'
    );
}
