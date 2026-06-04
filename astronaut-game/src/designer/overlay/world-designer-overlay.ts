type OverlayViewportBounds = {
    left: number;
    top: number;
    width: number;
    height: number;
};

function clamp(value: number, min: number, max: number) {
    return Math.min(Math.max(value, min), max);
}

export function getOverlayViewportBounds(): OverlayViewportBounds {
    const viewport = window.visualViewport;
    if (
        viewport &&
        Number.isFinite(viewport.width) &&
        Number.isFinite(viewport.height) &&
        viewport.width > 0 &&
        viewport.height > 0
    ) {
        return {
            left: Number.isFinite(viewport.offsetLeft) ? viewport.offsetLeft : 0,
            top: Number.isFinite(viewport.offsetTop) ? viewport.offsetTop : 0,
            width: viewport.width,
            height: viewport.height
        };
    }
    return {
        left: 0,
        top: 0,
        width: window.innerWidth,
        height: window.innerHeight
    };
}

export function clampOverlayPosition(element: HTMLElement, left: number, top: number) {
    const rect = element.getBoundingClientRect();
    const viewport = getOverlayViewportBounds();
    const minLeft = viewport.left + 8;
    const minTop = viewport.top + 8;
    const maxLeft = Math.max(minLeft, viewport.left + viewport.width - rect.width - 8);
    const maxTop = Math.max(minTop, viewport.top + viewport.height - rect.height - 8);
    return {
        left: clamp(left, minLeft, maxLeft),
        top: clamp(top, minTop, maxTop)
    };
}

export function getBrowserZoomScale(initialDevicePixelRatio: number) {
    const currentDevicePixelRatio = Number.isFinite(window.devicePixelRatio) && window.devicePixelRatio > 0
        ? window.devicePixelRatio
        : initialDevicePixelRatio;
    const devicePixelRatioScale = currentDevicePixelRatio / initialDevicePixelRatio;
    const visualViewportScale = window.visualViewport && Number.isFinite(window.visualViewport.scale) && window.visualViewport.scale > 0
        ? window.visualViewport.scale
        : 1;
    const zoomScale = devicePixelRatioScale * visualViewportScale;
    if (!Number.isFinite(zoomScale) || zoomScale <= 0) {
        return 1;
    }
    return zoomScale;
}

export function applyDesignerOverlayZoomCompensation(
    root: HTMLElement,
    paletteFlyout: HTMLElement,
    initialDevicePixelRatio: number
) {
    const zoomScale = getBrowserZoomScale(initialDevicePixelRatio);
    const inverseScale = 1 / zoomScale;
    const transformValue = Math.abs(inverseScale - 1) < 0.001
        ? ''
        : `scale(${inverseScale})`;
    const viewport = getOverlayViewportBounds();
    const maxHeight = `${Math.max(120, viewport.height - 16)}px`;

    root.style.transformOrigin = 'top right';
    root.style.transform = transformValue;
    root.style.maxHeight = maxHeight;

    paletteFlyout.style.transformOrigin = 'top right';
    paletteFlyout.style.transform = transformValue;
    paletteFlyout.style.maxHeight = maxHeight;

    const clampDraggedOverlay = (element: HTMLElement) => {
        if (!element.style.left && !element.style.top) {
            return;
        }
        const rect = element.getBoundingClientRect();
        const currentLeft = Number.parseFloat(element.style.left);
        const currentTop = Number.parseFloat(element.style.top);
        const next = clampOverlayPosition(
            element,
            Number.isFinite(currentLeft) ? currentLeft : rect.left,
            Number.isFinite(currentTop) ? currentTop : rect.top
        );
        element.style.left = `${next.left}px`;
        element.style.top = `${next.top}px`;
        element.style.right = 'auto';
    };
    clampDraggedOverlay(root);
    clampDraggedOverlay(paletteFlyout);
}

export function attachDraggableSurface(element: HTMLElement, handle: HTMLElement) {
    let dragPointerId: number | null = null;
    let dragOffsetX = 0;
    let dragOffsetY = 0;
    handle.addEventListener('pointerdown', (event) => {
        const target = event.target as HTMLElement | null;
        if (!target || target.closest('button, input, select, textarea, label, summary, canvas, a')) {
            return;
        }
        const rect = element.getBoundingClientRect();
        dragPointerId = event.pointerId;
        dragOffsetX = event.clientX - rect.left;
        dragOffsetY = event.clientY - rect.top;
        element.style.left = `${rect.left}px`;
        element.style.top = `${rect.top}px`;
        element.style.right = 'auto';
        element.classList.add('world-designer-drag-active');
        handle.setPointerCapture(event.pointerId);
        event.preventDefault();
    });
    handle.addEventListener('pointermove', (event) => {
        if (dragPointerId !== event.pointerId) {
            return;
        }
        const next = clampOverlayPosition(element, event.clientX - dragOffsetX, event.clientY - dragOffsetY);
        element.style.left = `${next.left}px`;
        element.style.top = `${next.top}px`;
    });
    const stopDrag = (event: PointerEvent) => {
        if (dragPointerId !== event.pointerId) {
            return;
        }
        dragPointerId = null;
        element.classList.remove('world-designer-drag-active');
        if (handle.hasPointerCapture(event.pointerId)) {
            handle.releasePointerCapture(event.pointerId);
        }
    };
    handle.addEventListener('pointerup', stopDrag);
    handle.addEventListener('pointercancel', stopDrag);
}
