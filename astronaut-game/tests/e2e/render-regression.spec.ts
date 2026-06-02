import { expect, test, type Page } from '@playwright/test';

async function countVisiblePixelsForRole(page: Page, role: string) {
    return page.evaluate((targetRole: string) => {
        const OVERVIEW_BG = { r: 0x02, g: 0x06, b: 0x17 };
        const MIN_COLOR_DELTA = 24;
        const canvas = document.querySelector(`canvas[data-role="${targetRole}"]`) as HTMLCanvasElement | null;
        if (!canvas) {
            return { found: false, visible: 0, total: 0 };
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return { found: true, visible: 0, total: 0 };
        }
        const { width, height } = canvas;
        const data = ctx.getImageData(0, 0, width, height).data;
        let visible = 0;
        for (let i = 0; i < data.length; i += 4) {
            const alpha = data[i + 3];
            if (alpha === 0) {
                continue;
            }
            const delta =
                Math.abs(data[i] - OVERVIEW_BG.r) +
                Math.abs(data[i + 1] - OVERVIEW_BG.g) +
                Math.abs(data[i + 2] - OVERVIEW_BG.b);
            if (delta >= MIN_COLOR_DELTA) {
                visible += 1;
            }
        }
        return { found: true, visible, total: width * height };
    }, role);
}

test('designer sprite preview and overview render visible pixels', async ({ page }) => {
    const runtimeErrors: string[] = [];
    page.on('pageerror', (error) => {
        const message = String(error?.message ?? error);
        if (!message.includes('play method is not allowed')) {
            runtimeErrors.push(message);
        }
    });

    await page.goto('/');
    await page.waitForTimeout(3000);
    await page.click('body');

    // Open the designer panel if hidden.
    await page.keyboard.press('Backquote');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.worldDesignerActive === true;
    }, { timeout: 15_000 });
    await page.evaluate(() => {
        document.querySelectorAll('details').forEach((element) => {
            (element as HTMLDetailsElement).open = true;
        });
    });
    await page.waitForTimeout(500);

    const spritePreview = await countVisiblePixelsForRole(page, 'sprite-preview');
    const overview = await countVisiblePixelsForRole(page, 'overview');

    expect(spritePreview.found).toBeTruthy();
    expect(overview.found).toBeTruthy();
    expect(spritePreview.visible, 'sprite preview should contain rendered sprite pixels').toBeGreaterThan(150);
    expect(overview.visible, 'overview should contain rendered world pixels').toBeGreaterThan(150);
    expect(runtimeErrors, 'runtime should not throw unexpected page errors').toEqual([]);
});
