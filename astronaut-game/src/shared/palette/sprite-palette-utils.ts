// Palette/alpha helpers are isolated so rendering and collision utilities stay focused.
export function makeBlackTransparent(img: HTMLImageElement, callback: (result: HTMLCanvasElement) => void) {
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = img.width;
    tempCanvas.height = img.height;
    const tempCtx = tempCanvas.getContext('2d')!;
    tempCtx.drawImage(img, 0, 0);
    const imageData = tempCtx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        if (data[i] === 0 && data[i + 1] === 0 && data[i + 2] === 0) {
            data[i + 3] = 0;
        }
    }
    tempCtx.putImageData(imageData, 0, 0);
    callback(tempCanvas);
}

export function isSpritePixelTransparent(
    img: HTMLImageElement,
    spriteRect: { x: number; y: number; w: number; h: number },
    px: number,
    py: number
): Promise<boolean> {
    return new Promise((resolve) => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = img.width;
        tempCanvas.height = img.height;
        const tempCtx = tempCanvas.getContext('2d')!;
        tempCtx.drawImage(img, 0, 0);
        const sx = Math.floor(px - spriteRect.x);
        const sy = Math.floor(py - spriteRect.y);
        if (
            sx < 0 || sy < 0 ||
            sx >= spriteRect.w || sy >= spriteRect.h
        ) {
            resolve(true);
            return;
        }
        const imageData = tempCtx.getImageData(spriteRect.x + sx, spriteRect.y + sy, 1, 1).data;
        resolve(imageData[3] === 0);
    });
}

export function remapSpritePalette(
    img: HTMLImageElement,
    colorMap: { from: [number, number, number]; to: [number, number, number] }[]
): HTMLCanvasElement {
    const canvas = document.createElement('canvas');
    canvas.width = img.width;
    canvas.height = img.height;
    const ctx = canvas.getContext('2d')!;
    ctx.drawImage(img, 0, 0);
    const imageData = ctx.getImageData(0, 0, img.width, img.height);
    const data = imageData.data;
    for (let i = 0; i < data.length; i += 4) {
        for (const { from, to } of colorMap) {
            if (
                data[i] === from[0] &&
                data[i + 1] === from[1] &&
                data[i + 2] === from[2]
            ) {
                data[i] = to[0];
                data[i + 1] = to[1];
                data[i + 2] = to[2];
            }
        }
    }
    ctx.putImageData(imageData, 0, 0);
    return canvas;
}
