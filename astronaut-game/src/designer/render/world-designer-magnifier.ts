type WorldDesignerMagnifierDeps = {
    state: {
        active: boolean;
        magnifierEnabled: boolean;
        lastPointerCanvas: { x: number; y: number } | null;
    };
    host: {
        canvas: HTMLCanvasElement;
    };
    magnifierCanvas: HTMLCanvasElement;
    magnifierSize: number;
    magnifierZoom: number;
    magnifierCursorOffset: number;
    clamp: (value: number, min: number, max: number) => number;
};

export function createWorldDesignerMagnifier(deps: WorldDesignerMagnifierDeps) {
    const {
        state,
        host,
        magnifierCanvas,
        magnifierSize,
        magnifierZoom,
        magnifierCursorOffset,
        clamp
    } = deps;

    function drawMagnifier(ctx: CanvasRenderingContext2D) {
        if (!state.active || !state.magnifierEnabled || !state.lastPointerCanvas) {
            return;
        }

        const sampleWidth = magnifierCanvas.width;
        const sampleHeight = magnifierCanvas.height;
        const sourceX = clamp(
            Math.round(state.lastPointerCanvas.x - sampleWidth / 2),
            0,
            Math.max(0, host.canvas.width - sampleWidth)
        );
        const sourceY = clamp(
            Math.round(state.lastPointerCanvas.y - sampleHeight / 2),
            0,
            Math.max(0, host.canvas.height - sampleHeight)
        );

        const magnifierCtx = magnifierCanvas.getContext('2d');
        if (!magnifierCtx) {
            return;
        }
        magnifierCtx.clearRect(0, 0, magnifierCanvas.width, magnifierCanvas.height);
        magnifierCtx.imageSmoothingEnabled = false;
        magnifierCtx.drawImage(
            host.canvas,
            sourceX,
            sourceY,
            sampleWidth,
            sampleHeight,
            0,
            0,
            magnifierCanvas.width,
            magnifierCanvas.height
        );

        const radius = magnifierSize / 2;
        const lensX = clamp(
            state.lastPointerCanvas.x + magnifierCursorOffset,
            radius + 8,
            host.canvas.width - radius - 8
        );
        const lensY = clamp(
            state.lastPointerCanvas.y + magnifierCursorOffset,
            radius + 8,
            host.canvas.height - radius - 8
        );

        ctx.save();
        ctx.beginPath();
        ctx.arc(lensX, lensY, radius, 0, Math.PI * 2);
        ctx.closePath();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.92)';
        ctx.fill();
        ctx.clip();
        ctx.imageSmoothingEnabled = false;
        ctx.drawImage(
            magnifierCanvas,
            0,
            0,
            magnifierCanvas.width,
            magnifierCanvas.height,
            lensX - radius,
            lensY - radius,
            magnifierSize,
            magnifierSize
        );
        ctx.restore();

        ctx.save();
        ctx.strokeStyle = '#f8fafc';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(lensX, lensY, radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.strokeStyle = 'rgba(56, 189, 248, 0.95)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(lensX - 12, lensY);
        ctx.lineTo(lensX + 12, lensY);
        ctx.moveTo(lensX, lensY - 12);
        ctx.lineTo(lensX, lensY + 12);
        ctx.stroke();
        ctx.fillStyle = 'rgba(15, 23, 42, 0.78)';
        ctx.fillRect(lensX - radius, lensY + radius - 22, 72, 20);
        ctx.fillStyle = '#e2e8f0';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(`${magnifierZoom}x`, lensX - radius + 8, lensY + radius - 8);
        ctx.restore();
    }

    return {
        drawMagnifier
    };
}
