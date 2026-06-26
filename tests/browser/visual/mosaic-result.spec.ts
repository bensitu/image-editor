import { expect, test } from '@playwright/test';
import {
    callHarness,
    clickCanvas,
    expectPreviewScreenshot,
    openEditor,
    waitForCallback,
} from '../support/page-helpers';

test('deterministic Mosaic edit matches the exported baseline', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image-wide.png');
    await callHarness(page, 'setMosaicConfig', { brushSize: 40, blockSize: 12 });
    await callHarness(page, 'enterMosaicMode');
    await clickCanvas(page, 120, 80);
    await waitForCallback(
        page,
        (record) => record.name === 'onImageChanged' && record.operation === 'applyMosaic',
    );
    await callHarness(page, 'exitMosaicMode');

    const result = await expectPreviewScreenshot(page, 'mosaic-result.png', {
        fileType: 'png',
        mergeMasks: false,
        mergeAnnotations: false,
    });
    expect(result.width).toBe(240);
    expect(result.height).toBe(160);
});
