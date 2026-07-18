import { expect, test } from '@playwright/test';

test.use({ deviceScaleFactor: 2 });

test('Crop and Mosaic keep natural-pixel geometry under high-DPI fractional presentation', async ({
    page,
}) => {
    await page.goto('/tests/browser/pages/basic-editor.html');
    await page.waitForFunction(() => Boolean(window.__imageEditorTest));
    await page.evaluate(async () => {
        await window.__imageEditorTest.create();
        await window.__imageEditorTest.loadFixture('test-image-wide.png');
        await window.__imageEditorTest.zoomIn();
    });

    expect(await page.evaluate(() => window.devicePixelRatio)).toBe(2);
    const crop = await page.evaluate(() => window.__imageEditorTest.applyCropWithOverlay());
    expect(crop).toMatchObject({ imageWidth: 120, imageHeight: 160, maskCount: 1 });
    const mosaic = await page.evaluate(() => window.__imageEditorTest.commitMosaicStrokes());
    expect(mosaic).toMatchObject({
        outputChanged: true,
        imageWidth: 120,
        imageHeight: 160,
        historyRecords: 1,
    });
});
