import { expect, test } from '@playwright/test';

test('DOM Controls synchronize actions, programmatic changes, and keyboard history', async ({
    page,
}) => {
    await page.goto('/tests/browser/pages/dom-controls.html');
    await page.waitForFunction(() => Boolean(window.__domControlsTest));
    await page.evaluate(() => window.__domControlsTest.create());
    await page.evaluate(() => window.__domControlsTest.load());

    await expect
        .poll(() => page.evaluate(() => window.__domControlsTest.state()))
        .toMatchObject({
            bound: true,
            inputValue: '1',
            scale: 1,
        });

    await page.evaluate(() => window.__domControlsTest.scale(1.5));
    await expect
        .poll(() => page.evaluate(() => window.__domControlsTest.state()))
        .toMatchObject({
            canUndo: true,
            inputValue: '1.5',
            scale: 1.5,
        });

    await page.keyboard.press('Control+z');
    await expect
        .poll(() => page.evaluate(() => window.__domControlsTest.state()))
        .toMatchObject({
            canRedo: true,
            inputValue: '1',
            scale: 1,
        });

    await page.evaluate(() => window.__domControlsTest.dispose());
});
