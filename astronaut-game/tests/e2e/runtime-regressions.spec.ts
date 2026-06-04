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

async function countPaintedPixelsForRole(page: Page, role: string): Promise<number> {
    return page.evaluate((targetRole: string) => {
        const OVERVIEW_BG = { r: 0x02, g: 0x06, b: 0x17 };
        const MIN_COLOR_DELTA = 24;
        const canvas = document.querySelector(`canvas[data-role="${targetRole}"]`) as HTMLCanvasElement | null;
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
        return visible;
    }, role);
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

    const overviewPixels = await countPaintedPixelsForRole(page, 'overview');

    expect(overviewPixels).toBeGreaterThan(150);
});

test('designer recovers when persisted world layer is hidden', async ({ page }) => {
    await page.addInitScript(() => {
        window.localStorage.setItem('exile.world-designer-state.v1', JSON.stringify({
            active: true,
            mode: 'edit',
            layerVisibility: {
                world: false,
                buttons: true,
                doors: true,
                creatures: true,
                collectables: true,
                custom: true
            }
        }));
    });

    await page.goto('/');
    await page.waitForTimeout(5000);
    await page.waitForFunction(() => (window as any).__exileDebug?.getRuntimeSnapshot?.()?.worldDesignerActive === true, { timeout: 15_000 });

    const overviewPixels = await countPaintedPixelsForRole(page, 'overview');

    expect(overviewPixels).toBeGreaterThan(150);
});

test('designer overview paints while hidden by default', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot
            && snapshot.mapLoaded === true
            && snapshot.worldDesignerExists === true
            && snapshot.worldDesignerActive === false;
    }, { timeout: 20_000 });
    await page.waitForTimeout(500);

    const overviewPixels = await countPaintedPixelsForRole(page, 'overview');
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

test('designer overview can navigate to bottom map regions', async ({ page }) => {
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

    await page.mouse.move(overviewBox.x + overviewBox.width * 0.5, overviewBox.y + overviewBox.height * 0.98);
    await page.mouse.down();
    await page.waitForTimeout(200);
    await page.mouse.up();
    await page.waitForTimeout(400);

    const viewport = await page.evaluate(() => {
        const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement | null;
        return canvas ? { width: canvas.width, height: canvas.height } : { width: 0, height: 0 };
    });
    const after = await getRuntimeSnapshot(page);
    expect(after.designerCamera).not.toBeNull();
    expect(before.designerCamera).not.toBeNull();
    expect(after.designerCamera!.y).toBeGreaterThan(before.designerCamera!.y + 500);
    const expectedBottomCameraY = Math.max(0, after.mapHeight - viewport.height);
    expect(after.designerCamera!.y).toBeGreaterThan(expectedBottomCameraY - 500);
});

test('designer view remains visible after grenade drop flow', async ({ page }) => {
    await page.goto('/');
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true;
    }, { timeout: 20_000 });

    await page.evaluate(() => {
        const debug = (window as any).__exileDebug;
        debug.teleportAstronaut(8526, 1800);
        debug.holdNearestGrenade();
    });
    await page.keyboard.press('m');
    await page.waitForTimeout(300);
    const beforeDesigner = await getRuntimeSnapshot(page);
    expect(Number.isFinite(beforeDesigner.astronautPosition.x)).toBe(true);
    expect(Number.isFinite(beforeDesigner.astronautPosition.y)).toBe(true);
    expect(Number.isFinite(beforeDesigner.mapHeight)).toBe(true);
    expect(Number.isFinite(beforeDesigner.mapWidth)).toBe(true);
    await page.waitForTimeout(1000);
    const beforeOpenWait = await getRuntimeSnapshot(page);
    expect(Number.isFinite(beforeOpenWait.astronautPosition.y)).toBe(true);
    await page.keyboard.press('Backquote');
    await page.waitForTimeout(1000);

    const gameVisiblePixels = await page.evaluate(() => {
        const canvas = document.querySelector('#gameCanvas') as HTMLCanvasElement | null;
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

    const snapshot = await getRuntimeSnapshot(page);
    expect(Number.isFinite(snapshot.designerCamera?.x)).toBe(true);
    expect(Number.isFinite(snapshot.designerCamera?.y)).toBe(true);
    expect(gameVisiblePixels).toBeGreaterThan(300);
});

test('designer water flood-fill marks connected world tiles without filling upward', async ({ page }) => {
    await page.goto('/');
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true;
    }, { timeout: 20_000 });

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

    await page.locator('[data-role="mode"]').selectOption('edit');
    await page.locator('[data-role="tool"]').selectOption('place');
    await page.locator('[data-role="category"]').selectOption('world');
    await page.locator('[data-role="type"]').selectOption('floor_full');
    await page.locator('[data-role="palette"]').selectOption('0');

    const canvas = page.locator('#gameCanvas');
    const canvasBox = await canvas.boundingBox();
    expect(canvasBox).not.toBeNull();
    if (!canvasBox) {
        return;
    }

    const placed: Array<{ x: number; y: number }> = [];
    const step = 40;
    const placeAndCapture = async (offsetX: number, offsetY: number) => {
        await page.mouse.click(
            canvasBox.x + canvasBox.width / 2 + offsetX,
            canvasBox.y + canvasBox.height / 2 + offsetY
        );
        await page.waitForTimeout(80);
        const selection = await page.evaluate(() => (window as any).__exileDebug.getSelectedDesignerSelection());
        expect(selection?.category).toBe('world');
        placed.push({ x: Number(selection.entity.x), y: Number(selection.entity.y) });
    };

    await placeAndCapture(-step, 0); // left
    await placeAndCapture(step, 0); // right
    await placeAndCapture(0, step); // down
    await placeAndCapture(0, -step); // up (should remain non-water)
    await placeAndCapture(0, 0); // center seed (selected)

    const [, , down, , center] = placed;
    const countWaterExact = (
        worldMap: Array<{ x: number; y: number; water?: boolean }>,
        point: { x: number; y: number }
    ) => (
        worldMap.filter((block) =>
            block.x === point.x &&
            block.y === point.y &&
            block.water === true
        ).length
    );
    const readWorldMapFromPreview = async () => {
        await page.locator('[data-role="save-preview"]').click();
        await page.waitForSelector('.world-designer-modal h3');
        const worldMapJson = await page.evaluate(() => {
            const headings = Array.from(document.querySelectorAll('.world-designer-modal h3'));
            for (const heading of headings) {
                if (heading.textContent?.includes('world_chunks/manifest.json')) {
                    return (heading.nextElementSibling as HTMLElement | null)?.textContent ?? null;
                }
            }
            return null;
        });
        expect(worldMapJson).not.toBeNull();
        if (!worldMapJson) {
            return [] as Array<{ x: number; y: number; water?: boolean }>;
        }
        const worldMap = JSON.parse(worldMapJson) as Array<{ x: number; y: number; water?: boolean }>;
        await page.locator('[data-role="modal-close"]').click();
        await page.waitForTimeout(100);
        return worldMap;
    };

    const beforeWorldMap = await readWorldMapFromPreview();
    const countWaterByCell = (worldMap: Array<{ x: number; y: number; water?: boolean }>) => {
        const counts = new Map<string, number>();
        for (const block of worldMap) {
            if (block.water !== true) {
                continue;
            }
            const key = `${block.x}:${block.y}`;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        return counts;
    };
    const beforeWaterCounts = countWaterByCell(beforeWorldMap);

    await page.locator('[data-role="fill-water"]').click();
    await page.waitForTimeout(100);
    const statusText = await page.locator('[data-role="status"]').innerText();
    expect(statusText).toContain('Flood-filled connected world tiles with water');

    const worldMap = await readWorldMapFromPreview();
    const afterCenterWaterCount = countWaterExact(worldMap, center);
    const afterWaterCounts = countWaterByCell(worldMap);
    const upwardThresholdY = Math.min(center.y, down.y);
    let addedWaterAboveSeed = 0;
    for (const [key, afterCount] of afterWaterCounts.entries()) {
        const [, yText] = key.split(':');
        const y = Number(yText);
        if (!Number.isFinite(y) || y >= upwardThresholdY) {
            continue;
        }
        const beforeCount = beforeWaterCounts.get(key) ?? 0;
        if (afterCount > beforeCount) {
            addedWaterAboveSeed += afterCount - beforeCount;
        }
    }

    expect(afterCenterWaterCount).toBeGreaterThan(0);
    expect(addedWaterAboveSeed).toBe(0);
});
