import { expect, test } from '@playwright/test';

test('held grenade sits at astronaut visible midpoint', async ({ page }, testInfo) => {
    await page.goto('/');
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true;
    }, { timeout: 20_000 });

    const held = await page.evaluate(() => {
        const debug = (window as any).__exileDebug;
        debug.teleportAstronaut(8526, 2101);
        return debug.holdNearestGrenade();
    });
    expect(held).toBe(true);

    await page.waitForTimeout(150);
    const snapshot = await page.evaluate(() => (window as any).__exileDebug.getHeldItemDebugSnapshot());

    await page.screenshot({
        path: testInfo.outputPath('grenade-hold-placement.png'),
        fullPage: true
    });

    expect(snapshot.held).not.toBeNull();
    expect(snapshot.target).not.toBeNull();
    expect(snapshot.astronautVisibleCenterY).not.toBeNull();
    expect(snapshot.heldVisibleCenterY).not.toBeNull();
    // Visible centers are derived from sprite bounds scaled by 2.2, so a one-step quantization delta is expected.
    expect(Math.abs(snapshot.heldVisibleCenterY - snapshot.astronautVisibleCenterY)).toBeLessThanOrEqual(2.25);
});
