type GameWindowInputOptions = {
    blockBrowserShortcut: (event: KeyboardEvent) => boolean;
    shouldPreventGameplayDefault: (event: KeyboardEvent, designerOpen: boolean) => boolean;
    getInputKey: (event: KeyboardEvent) => string;
    isDesignerOpen: () => boolean;
    requestImmediateFrame: () => void;
    onInputKeyChanged: (key: string, pressed: boolean) => void;
    onMouseMoved: (x: number, y: number) => void;
    getCanvas: () => HTMLCanvasElement;
    isDebugModeEnabled: () => boolean;
    onTabPressed: () => void;
};

// Browser input wiring is isolated from game.ts so orchestration logic stays easier to scan.
export function attachGameWindowInput(options: GameWindowInputOptions) {
    document.addEventListener('keydown', (event) => {
        if (options.blockBrowserShortcut(event) || options.shouldPreventGameplayDefault(event, options.isDesignerOpen())) {
            event.preventDefault();
        }
    }, { capture: true });

    window.addEventListener('keydown', (event) => {
        if (options.blockBrowserShortcut(event)) {
            event.preventDefault();
            return;
        }
        const key = options.getInputKey(event);
        if (options.shouldPreventGameplayDefault(event, options.isDesignerOpen())) {
            event.preventDefault();
        }
        options.onInputKeyChanged(key, true);
        options.requestImmediateFrame();
    });

    window.addEventListener('keyup', (event) => {
        const key = options.getInputKey(event);
        if (options.shouldPreventGameplayDefault(event, options.isDesignerOpen())) {
            event.preventDefault();
        }
        options.onInputKeyChanged(key, false);
        options.requestImmediateFrame();
    });

    window.addEventListener('mousemove', (event) => {
        const rect = options.getCanvas().getBoundingClientRect();
        options.onMouseMoved(event.clientX - rect.left, event.clientY - rect.top);
        if (options.isDebugModeEnabled()) {
            options.requestImmediateFrame();
        }
    });

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            options.requestImmediateFrame();
        }
    });

    window.addEventListener('keydown', (event) => {
        if (options.isDesignerOpen()) {
            return;
        }
        if (event.key === 'Tab') {
            event.preventDefault();
            options.onTabPressed();
            options.requestImmediateFrame();
        }
    });
}
