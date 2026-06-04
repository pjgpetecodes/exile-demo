type WorldDesignerLifecycleControllerDeps = {
    state: {
        viewportExpanded: boolean;
        active: boolean;
        mode: 'edit' | 'preview';
        liveResumeSnapshot: unknown;
        hasOpenedOnce: boolean;
        camera: { x: number; y: number };
    };
    host: {
        canvas: HTMLCanvasElement;
        clampCamera: (camera: { x: number; y: number }) => { x: number; y: number };
    };
    initialCanvasStyle: {
        position: string;
        inset: string;
        width: string;
        height: string;
        margin: string;
        zIndex: string;
    };
    initialCanvasSize: {
        width: number;
        height: number;
    };
    initialBodyOverflow: string;
    setStatus: (message: string, tone?: 'neutral' | 'success' | 'error') => void;
    refreshPanel: () => void;
    syncEditModeSnapshot: () => void;
    focusOnCurrentWorldPosition: () => void;
    closeContextMenu: () => void;
    closeModal: () => void;
};

export function createWorldDesignerLifecycleController(deps: WorldDesignerLifecycleControllerDeps) {
    const {
        state,
        host,
        initialCanvasStyle,
        initialCanvasSize,
        initialBodyOverflow,
        setStatus,
        refreshPanel,
        syncEditModeSnapshot,
        focusOnCurrentWorldPosition,
        closeContextMenu,
        closeModal
    } = deps;

    function applyViewportSize(width: number, height: number) {
        const currentCenter = {
            x: state.camera.x + host.canvas.width / 2,
            y: state.camera.y + host.canvas.height / 2
        };
        host.canvas.width = Math.max(1, Math.round(width));
        host.canvas.height = Math.max(1, Math.round(height));
        state.camera = host.clampCamera({
            x: currentCenter.x - host.canvas.width / 2,
            y: currentCenter.y - host.canvas.height / 2
        });
    }

    function resizeExpandedViewport() {
        if (!state.viewportExpanded) return;
        applyViewportSize(window.innerWidth, window.innerHeight);
        host.canvas.style.width = `${window.innerWidth}px`;
        host.canvas.style.height = `${window.innerHeight}px`;
    }

    function setViewportExpanded(expanded: boolean) {
        if (state.viewportExpanded === expanded) {
            return;
        }

        state.viewportExpanded = expanded;
        if (expanded) {
            host.canvas.style.position = 'fixed';
            host.canvas.style.inset = '0';
            host.canvas.style.margin = '0';
            host.canvas.style.zIndex = '9000';
            document.body.style.overflow = 'hidden';
            resizeExpandedViewport();
            setStatus('Expanded the game viewport to fill the window for designer work.', 'neutral');
        } else {
            host.canvas.style.position = initialCanvasStyle.position;
            host.canvas.style.inset = initialCanvasStyle.inset;
            host.canvas.style.width = initialCanvasStyle.width;
            host.canvas.style.height = initialCanvasStyle.height;
            host.canvas.style.margin = initialCanvasStyle.margin;
            host.canvas.style.zIndex = initialCanvasStyle.zIndex;
            document.body.style.overflow = initialBodyOverflow;
            applyViewportSize(initialCanvasSize.width, initialCanvasSize.height);
            setStatus('Restored the game viewport to its normal size.', 'neutral');
        }

        refreshPanel();
    }

    function setDesignerActive(nextActive: boolean) {
        if (state.active === nextActive) return;
        state.active = nextActive;
        closeContextMenu();
        if (!state.active) {
            closeModal();
            state.liveResumeSnapshot = null;
            refreshPanel();
            return;
        }
        if (state.mode === 'edit') {
            syncEditModeSnapshot();
        }
        focusOnCurrentWorldPosition();
        state.hasOpenedOnce = true;
        refreshPanel();
    }

    return {
        applyViewportSize,
        resizeExpandedViewport,
        setViewportExpanded,
        setDesignerActive
    };
}
