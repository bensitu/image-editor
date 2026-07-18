import { expect, test, type Page } from '@playwright/test';

const harnessPath = '/tests/browser/pages/basic-editor.html';

async function openHarness(page: Page, fixture: 'test-image.png' | 'test-image-wide.png') {
    await page.goto(harnessPath);
    await page.waitForFunction(() => Boolean(window.__imageEditorTest));
    await page.evaluate(async (name) => {
        await window.__imageEditorTest.create();
        await window.__imageEditorTest.loadFixture(name);
    }, fixture);
}

test('Crop applies real pixels while preserving an Overlay identity', async ({ page }) => {
    await openHarness(page, 'test-image-wide.png');

    const result = await page.evaluate(() => window.__imageEditorTest.applyCropWithOverlay());

    expect(result).toEqual({
        imageWidth: 120,
        imageHeight: 160,
        maskCount: 1,
        maskIdentityPreserved: true,
        persistentIdPreserved: true,
        historyRecords: 1,
    });
});

test('Mosaic commits multiple real-pixel strokes in one History record', async ({ page }) => {
    await openHarness(page, 'test-image.png');

    const result = await page.evaluate(() => window.__imageEditorTest.commitMosaicStrokes());

    expect(result).toEqual({
        outputChanged: true,
        imageWidth: 160,
        imageHeight: 160,
        historyRecords: 1,
    });
});

test('Crop and Mosaic cancellation restore the exact live view', async ({ page }) => {
    await openHarness(page, 'test-image.png');

    const crop = await page.evaluate(() => window.__imageEditorTest.cancelCropPreview());
    const mosaic = await page.evaluate(() => window.__imageEditorTest.cancelMosaicPreview());

    expect(crop).toEqual({ previewChanged: true, restoredExactly: true });
    expect(mosaic).toEqual({ previewChanged: true, restoredExactly: true });
});
