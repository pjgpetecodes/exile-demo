import { expect, test, type Page } from '@playwright/test';

type RuntimeSnapshot = {
    mapWidth: number;
    mapHeight: number;
    astronautPosition: { x: number; y: number };
    astronautVelocity: { x: number; y: number };
    astronautIsLanded: boolean;
    walkAnimFrame: number;
    walkAnimTimer: number;
    designerCamera: { x: number; y: number } | null;
};

async function getRuntimeSnapshot(page: Page): Promise<RuntimeSnapshot> {
    return page.evaluate(() => (window as any).__exileDebug.getRuntimeSnapshot());
}

test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.removeItem('exile.world-designer-state.v1');
    });
});

test('walking stays grounded and moves horizontally', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true && snapshot.astronautIsLanded === true;
    }, { timeout: 20_000 });

    const before = await getRuntimeSnapshot(page);

    await page.keyboard.down('ArrowRight');
    const walkFramesWhileMoving: number[] = [];
    const walkTimersWhileMoving: number[] = [];
    for (let i = 0; i < 12; i += 1) {
        await page.waitForTimeout(100);
        const snapshot = await getRuntimeSnapshot(page);
        walkFramesWhileMoving.push(snapshot.walkAnimFrame);
        walkTimersWhileMoving.push(snapshot.walkAnimTimer);
    }
    await page.keyboard.up('ArrowRight');
    await page.waitForTimeout(200);
    const afterRight = await getRuntimeSnapshot(page);

    await page.keyboard.down('ArrowLeft');
    await page.waitForTimeout(700);
    await page.keyboard.up('ArrowLeft');
    await page.waitForTimeout(200);
    const afterLeft = await getRuntimeSnapshot(page);

    const rightDelta = Math.abs(afterRight.astronautPosition.x - before.astronautPosition.x);
    const leftDelta = Math.abs(afterLeft.astronautPosition.x - afterRight.astronautPosition.x);
    const maxHorizontalDelta = Math.max(rightDelta, leftDelta);
    const distinctWalkFrames = new Set(walkFramesWhileMoving);
    const walkTimerDelta = Math.max(...walkTimersWhileMoving) - Math.min(...walkTimersWhileMoving);

    expect(maxHorizontalDelta).toBeGreaterThan(12);
    expect(Math.abs(afterRight.astronautPosition.y - before.astronautPosition.y)).toBeLessThan(70);
    expect(afterRight.astronautIsLanded).toBe(true);
    expect(distinctWalkFrames.size).toBeGreaterThan(1);
    expect(walkTimerDelta).toBeGreaterThan(0.02);
});

test('designer recovers from persisted hidden layer visibility', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('exile.world-designer-state.v1', JSON.stringify({
            active: true,
            mode: 'edit',
            layerVisibility: {
                world: false,
                buttons: false,
                doors: false,
                creatures: false,
                collectables: false,
                custom: false
            }
        }));
    });

    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.waitForFunction(() => (window as any).__exileDebug?.getRuntimeSnapshot?.()?.worldDesignerActive === true, { timeout: 15_000 });

    const overviewPixels = await page.evaluate(() => {
        const canvas = document.querySelector('canvas[data-role="overview"]') as HTMLCanvasElement | null;
        if (!canvas) {
            return 0;
        }
        const ctx = canvas.getContext('2d');
        if (!ctx) {
            return 0;
        }
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        let visible = 0;
        for (let i = 0; i < data.length; i += 4) {
            if (data[i + 3] > 0 && (data[i] > 8 || data[i + 1] > 8 || data[i + 2] > 8)) {
                visible += 1;
            }
        }
        return visible;
    });

    expect(overviewPixels).toBeGreaterThan(150);
});

test('designer overview can navigate far right map regions', async ({ page }) => {
    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(1000);
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.worldDesignerActive === true && snapshot.designerCamera !== null;
    }, { timeout: 15_000 });
    await page.evaluate(() => {
        document.querySelectorAll('details').forEach((element) => {
            (element as HTMLDetailsElement).open = true;
        });
    });

    const before = await getRuntimeSnapshot(page);
    const overview = page.locator('canvas[data-role="overview"]');
    const overviewBox = await overview.boundingBox();
    expect(overviewBox).not.toBeNull();
    if (!overviewBox) {
        return;
    }

    await page.mouse.move(overviewBox.x + overviewBox.width * 0.98, overviewBox.y + overviewBox.height * 0.5);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const after = await getRuntimeSnapshot(page);
    expect(after.designerCamera).not.toBeNull();
    expect(before.designerCamera).not.toBeNull();
    expect(after.designerCamera!.x).toBeGreaterThan(before.designerCamera!.x + 500);
    expect(after.designerCamera!.x).toBeGreaterThan((after.mapWidth - 2000) * 0.5);
});
