import { expect, test, type Page } from '@playwright/test';

const harnessPath = '/tests/browser/pages/basic-editor.html';

async function openHarness(page: Page): Promise<void> {
    await page.goto(harnessPath);
    await page.waitForFunction(() => Boolean(window.__imageEditorTest));
    await page.evaluate(() => window.__imageEditorTest.create());
}

test('root Core lifecycle, load, Transform, History, and export work together', async ({
    page,
}) => {
    await openHarness(page);

    await expect
        .poll(() => page.evaluate(() => window.__imageEditorTest.getState()))
        .toMatchObject({ classIdentity: true, lifecycle: 'initialized' });

    await page.evaluate(() => window.__imageEditorTest.loadFixture('test-image.png'));
    let state = await page.evaluate(() => window.__imageEditorTest.getState());
    expect(state.imageInfo).toMatchObject({ naturalWidth: 160, naturalHeight: 160 });
    expect(state.transform).toMatchObject({ scale: 1, rotationDegrees: 0 });

    await page.evaluate(() => window.__imageEditorTest.zoomIn());
    state = await page.evaluate(() => window.__imageEditorTest.getState());
    expect(state.transform?.scale).toBeGreaterThan(1);
    expect(state.history?.canUndo).toBe(true);

    await page.evaluate(() => window.__imageEditorTest.undo());
    state = await page.evaluate(() => window.__imageEditorTest.getState());
    expect(state.transform?.scale).toBe(1);
    expect(state.history?.canRedo).toBe(true);

    const exported = await page.evaluate(() => window.__imageEditorTest.exportToPreview());
    expect(exported).toEqual({ width: 160, height: 160 });
    await expect(page.locator('#export-preview')).toBeVisible();
});
