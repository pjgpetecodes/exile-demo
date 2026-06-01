import { expect, test, type Page } from '@playwright/test';

async function countVisiblePixelsForRole(page: Page, role: string) {
    return page.evaluate((targetRole: string) => {
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
            if (data[i + 3] > 0 && (data[i] > 8 || data[i + 1] > 8 || data[i + 2] > 8)) {
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

    // Open the designer panel if hidden.
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(1000);
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
