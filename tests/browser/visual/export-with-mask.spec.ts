import { expect, test } from '@playwright/test';
import { callHarness, expectPreviewScreenshot, openEditor } from '../support/page-helpers';

test('export with merged mask matches the deterministic baseline', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image.png');
    await callHarness(page, 'createMask', {
        width: 56,
        height: 48,
        left: 52,
        top: 56,
        color: '#000000',
        alpha: 1,
        styles: {
            strokeWidth: 0,
        },
    });

    const result = await expectPreviewScreenshot(page, 'export-with-mask.png', {
        fileType: 'png',
        mergeMasks: true,
        mergeAnnotations: false,
    });
    expect(result.width).toBe(160);
    expect(result.height).toBe(160);
});
