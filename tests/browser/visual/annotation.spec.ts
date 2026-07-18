import { expect, test } from '@playwright/test';

test('Text Shape and curved Draw Annotations render together', async ({ page }) => {
    await page.goto('/tests/browser/pages/basic-editor.html');
    await page.waitForFunction(() => Boolean(window.__imageEditorTest));
    await page.evaluate(async () => {
        await window.__imageEditorTest.create();
        await window.__imageEditorTest.loadFixture('test-image.png');
        await window.__imageEditorTest.createAnnotationScene();
        await window.__imageEditorTest.exportToPreview();
    });

    await expect(page.locator('#editor-root')).toHaveScreenshot('annotation-scene.png', {
        animations: 'disabled',
    });
});
