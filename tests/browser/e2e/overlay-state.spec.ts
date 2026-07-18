import { expect, test } from '@playwright/test';

test('Overlay State round-trips an image-normalized document in the browser', async ({ page }) => {
    await page.goto('/tests/browser/pages/overlay-state.html');
    await page.waitForFunction(() => Boolean(window.__overlayStateTest));

    const result = await page.evaluate(() => window.__overlayStateTest.roundTrip());
    expect(result).toMatchObject({
        schema: 'image-editor.overlay-state',
        version: 1,
        coordinateSpace: 'image-normalized',
        kind: 'mask',
        countAfterRemoval: 0,
        imported: 1,
        skipped: 0,
        attributesMatch: true,
    });
    expect(result.maxCoordinateDelta).toBeLessThan(1e-8);

    await page.evaluate(() => window.__overlayStateTest.dispose());
});
