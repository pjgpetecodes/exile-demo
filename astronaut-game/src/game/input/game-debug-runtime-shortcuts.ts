type GameDebugRuntimeShortcutsOptions = {
    isDesignerOpen: () => boolean;
    toggleShowTightBoundingBoxes: () => void;
    toggleShowWorldBoundingBoxes: () => void;
    toggleDebugMode: () => void;
    togglePerformanceHud: () => void;
    togglePerformanceConsoleSummary: () => void;
    requestImmediateFrame: () => void;
};

export function attachGameDebugRuntimeShortcuts(options: GameDebugRuntimeShortcutsOptions) {
    window.addEventListener('keydown', (event) => {
        if (options.isDesignerOpen()) {
            return;
        }
        if (event.key === 'b') {
            options.toggleShowTightBoundingBoxes();
        }
        if (event.key === 'f') {
            options.toggleShowWorldBoundingBoxes();
        }
        if (event.key === 'd') {
            options.toggleDebugMode();
        }
        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'h') {
            event.preventDefault();
            options.togglePerformanceHud();
            options.requestImmediateFrame();
        }
        if (event.ctrlKey && event.shiftKey && event.key.toLowerCase() === 'j') {
            event.preventDefault();
            options.togglePerformanceConsoleSummary();
            options.requestImmediateFrame();
        }
    });
}
