import { expect, test, type Page } from '@playwright/test';

async function openHarness(page: Page, fixture: 'test-image.png' | 'test-image-wide.png') {
    await page.goto('/tests/browser/pages/basic-editor.html');
    await page.waitForFunction(() => Boolean(window.__imageEditorTest));
    await page.evaluate(async (name) => {
        await window.__imageEditorTest.create();
        await window.__imageEditorTest.loadFixture(name);
    }, fixture);
}

test('Crop renders a preserved Overlay after apply', async ({ page }) => {
    await openHarness(page, 'test-image-wide.png');
    await page.evaluate(async () => {
        await window.__imageEditorTest.applyCropWithOverlay();
        await window.__imageEditorTest.exportToPreview();
    });

    await expect(page.locator('#editor-root')).toHaveScreenshot('crop-overlay.png', {
        animations: 'disabled',
    });
});

test('Mosaic renders multiple committed brush strokes', async ({ page }) => {
    await openHarness(page, 'test-image.png');
    await page.evaluate(async () => {
        await window.__imageEditorTest.commitMosaicStrokes();
        await window.__imageEditorTest.exportToPreview();
    });

    await expect(page.locator('#editor-root')).toHaveScreenshot('mosaic-strokes.png', {
        animations: 'disabled',
    });
});

test('cancelled previews leave the original rendering', async ({ page }) => {
    await openHarness(page, 'test-image.png');
    await page.evaluate(async () => {
        await window.__imageEditorTest.cancelCropPreview();
        await window.__imageEditorTest.cancelMosaicPreview();
        await window.__imageEditorTest.exportToPreview();
    });

    await expect(page.locator('#editor-root')).toHaveScreenshot('cancelled-previews.png', {
        animations: 'disabled',
    });
});
