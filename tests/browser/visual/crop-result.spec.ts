import { expect, test } from '@playwright/test';
import { callHarness, expectPreviewScreenshot, openEditor } from '../support/page-helpers';

test('deterministic crop result matches the exported baseline', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image-wide.png');
    await callHarness(page, 'enterCropMode', { aspectRatio: '1:1' });
    await callHarness(page, 'applyCrop');

    const result = await expectPreviewScreenshot(page, 'crop-result.png', {
        fileType: 'png',
        mergeMasks: false,
        mergeAnnotations: false,
    });
    expect(result.width).toBe(120);
    expect(result.height).toBe(120);
});
