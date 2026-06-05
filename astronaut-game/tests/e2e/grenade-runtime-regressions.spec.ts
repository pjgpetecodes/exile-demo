import { expect, test } from '@playwright/test';

test('teleport key without remembered slots does not throw', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => {
        pageErrors.push(error.message);
    });

    await page.goto('/');
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true;
    }, { timeout: 20_000 });

    await page.keyboard.press('t');
    await page.waitForTimeout(500);

    expect(pageErrors.some((message) => message.includes('popLatestTeleportLocation'))).toBe(false);
});

test('remember and teleport keys return astronaut to remembered position', async ({ page }) => {
    await page.goto('/');
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true;
    }, { timeout: 20_000 });

    await page.evaluate(() => {
        const debug = (window as any).__exileDebug;
        debug.teleportAstronaut(8526, 2101);
    });

    await page.click('body');
    await page.keyboard.press('r');
    await page.waitForTimeout(120);
    const afterRemember = await page.evaluate(() => (window as any).__exileDebug.getTeleportMemoryDebug());
    expect(afterRemember.teleportLocations.length, JSON.stringify(afterRemember)).toBeGreaterThan(0);
    const remembered = afterRemember.teleportLocations[afterRemember.teleportLocations.length - 1];

    await page.evaluate(() => {
        const debug = (window as any).__exileDebug;
        debug.teleportAstronaut(9000, 1800);
    });
    await page.waitForTimeout(120);

    await page.click('body');
    await page.keyboard.press('t');

    const teleportStarted = await page.waitForFunction(
        () => {
            const state = (window as any).__exileDebug.getTeleportDebugState();
            return state.teleporting || !!state.teleportTarget;
        },
        { timeout: 8_000 }
    );
    expect(await teleportStarted.jsonValue()).toBe(true);

    const stateAfterTrigger = await page.evaluate(() => (window as any).__exileDebug.getTeleportDebugState());
    const target = stateAfterTrigger.teleportTarget;
    const targetingRemembered = !!target
        && Math.abs(target.x - remembered.x) <= 2
        && Math.abs(target.y - remembered.y) <= 2;
    const alreadyAtRemembered = Math.abs(stateAfterTrigger.astronautPosition.x - remembered.x) <= 2
        && Math.abs(stateAfterTrigger.astronautPosition.y - remembered.y) <= 2;

    expect(
        targetingRemembered || alreadyAtRemembered,
        JSON.stringify({ stateAfterTrigger, remembered, afterRemember })
    ).toBe(true);
});

test('dropped grenades fall and exploded grenades are removed', async ({ page }) => {
    await page.goto('/');
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true;
    }, { timeout: 20_000 });

    const heldResult = await page.evaluate(() => {
        const debug = (window as any).__exileDebug;
        debug.teleportAstronaut(8526, 2101);
        const held = debug.holdNearestGrenade();
        const snapshot = debug.getNearestGrenadeDebugSnapshot();
        return { held, snapshot };
    });
    expect(heldResult.held).toBe(true);
    const trackedEntityId = heldResult.snapshot?.entityId ?? null;
    expect(typeof trackedEntityId).toBe('number');
    const dropped = await page.evaluate(() => (window as any).__exileDebug.dropHeldCollectableUnarmed());
    expect(dropped).toBe(true);

    const droppedSnapshot = await page.evaluate((entityId) => (window as any).__exileDebug.getCollectableDebugSnapshot(entityId), trackedEntityId);
    const startY = droppedSnapshot?.y ?? 0;
    const ySamples: number[] = [];
    for (let i = 0; i < 6; i += 1) {
        await page.waitForTimeout(60);
        const snapshot = await page.evaluate((entityId) => (window as any).__exileDebug.getCollectableDebugSnapshot(entityId), trackedEntityId);
        if (snapshot) {
            ySamples.push(snapshot.y);
        }
    }
    expect(ySamples.length).toBeGreaterThan(2);
    expect(Math.max(...ySamples) - Math.min(...ySamples)).toBeGreaterThan(0);
    expect(ySamples.some((y) => y > startY)).toBe(true);

    const explodeResult = await page.evaluate((entityId) => (window as any).__exileDebug.explodeCollectableByEntityId(entityId), trackedEntityId);
    expect(explodeResult.ok || explodeResult.reason === 'missing-collectable').toBe(true);
});

test('keyboard grenade drop releases hold and falls', async ({ page }) => {
    await page.goto('/');
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true;
    }, { timeout: 20_000 });

    const heldResult = await page.evaluate(() => {
        const debug = (window as any).__exileDebug;
        debug.teleportAstronaut(8526, 1800);
        const held = debug.holdNearestGrenade();
        const snapshot = debug.getNearestGrenadeDebugSnapshot();
        return { held, snapshot };
    });
    expect(heldResult.held).toBe(true);
    const trackedEntityId = heldResult.snapshot?.entityId ?? null;
    expect(typeof trackedEntityId).toBe('number');

    let releasedSnapshot: { held: boolean; y: number } | null = null;
    for (let attempt = 0; attempt < 5; attempt += 1) {
        await page.click('body');
        await page.keyboard.press('m');
        await page.waitForTimeout(120);
        const snapshot = await page.evaluate((entityId) => (window as any).__exileDebug.getCollectableDebugSnapshot(entityId), trackedEntityId) as { held?: boolean; y?: number } | null;
        if (snapshot && snapshot.held === false && typeof snapshot.y === 'number') {
            releasedSnapshot = { held: false, y: snapshot.y };
            break;
        }
    }

    expect(releasedSnapshot).not.toBeNull();
    const releaseY = releasedSnapshot?.y ?? 0;
    const settledAfterRelease = await page.waitForFunction(
        ({ entityId, baselineY }) => {
            const snapshot = (window as any).__exileDebug.getCollectableDebugSnapshot(entityId) as { held?: boolean; y?: number; isGrounded?: boolean } | null;
            if (!snapshot || snapshot.held !== false || typeof snapshot.y !== 'number') {
                return false;
            }
            return snapshot.y > baselineY || snapshot.isGrounded === true;
        },
        { entityId: trackedEntityId, baselineY: releaseY },
        { timeout: 30_000 }
    );
    expect(await settledAfterRelease.jsonValue()).toBe(true);
});

test('grounded grenade has visible-pixel support beneath it', async ({ page }) => {
    await page.goto('/');
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true;
    }, { timeout: 20_000 });

    const heldResult = await page.evaluate(() => {
        const debug = (window as any).__exileDebug;
        debug.teleportAstronaut(8526, 2101);
        const held = debug.holdNearestGrenade();
        const snapshot = debug.getNearestGrenadeDebugSnapshot();
        return { held, snapshot };
    });
    expect(heldResult.held).toBe(true);
    const trackedEntityId = heldResult.snapshot?.entityId ?? null;
    expect(typeof trackedEntityId).toBe('number');
    const dropped = await page.evaluate(() => (window as any).__exileDebug.dropHeldCollectableUnarmed());
    expect(dropped).toBe(true);

    let groundedSupportCheck: { supportHits: number } | null = null;
    let latestSnapshot: any = null;
    let vanished = false;
    for (let i = 0; i < 80; i += 1) {
        await page.waitForTimeout(100);
        const snapshot = await page.evaluate((entityId) => (window as any).__exileDebug.getCollectableDebugSnapshot(entityId), trackedEntityId);
        latestSnapshot = snapshot;
        if (!snapshot) {
            vanished = true;
            break;
        }
        if (snapshot.isGrounded === true) {
            groundedSupportCheck = await page.evaluate((entityId) => (window as any).__exileDebug.getCollectableSupportDebug(entityId), trackedEntityId);
            break;
        }
    }

    expect(groundedSupportCheck, JSON.stringify({ latestSnapshot, vanished })).not.toBeNull();
    expect(groundedSupportCheck!.supportHits, JSON.stringify(groundedSupportCheck)).toBeGreaterThan(0);
});

test('damage emergency teleport falls back to astronaut start with no remembered locations', async ({ page }) => {
    await page.goto('/');
    await page.click('body');
    await page.waitForFunction(() => {
        const snapshot = (window as any).__exileDebug?.getRuntimeSnapshot?.();
        return !!snapshot && snapshot.mapLoaded === true;
    }, { timeout: 20_000 });

    const setup = await page.evaluate(() => {
        const debug = (window as any).__exileDebug;
        const start = debug.getAstronautStartPosition();
        debug.clearTeleportLocations();
        debug.teleportAstronaut(start.x + 420, start.y + 280);
        return { start };
    });

    await page.evaluate(() => {
        (window as any).__exileDebug.applyAstronautDamage(999);
    });

    let reachedStart = false;
    let finishedTeleport = false;
    let latestState: any = null;
    for (let i = 0; i < 120; i += 1) {
        await page.waitForTimeout(100);
        latestState = await page.evaluate(() => (window as any).__exileDebug.getTeleportDebugState());
        const atStart = Math.abs(latestState.astronautPosition.x - setup.start.x) <= 2
            && Math.abs(latestState.astronautPosition.y - setup.start.y) <= 2;
        if (atStart) {
            reachedStart = true;
        }
        if (atStart && !latestState.teleporting) {
            finishedTeleport = true;
            break;
        }
    }

    expect(reachedStart, JSON.stringify(latestState)).toBe(true);
    expect(finishedTeleport, JSON.stringify(latestState)).toBe(true);
});
