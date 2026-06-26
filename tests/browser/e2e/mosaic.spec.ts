import { expect, test } from '@playwright/test';
import { callHarness, clickCanvas, openEditor, waitForCallback } from '../support/page-helpers';

test('Mosaic mode applies a deterministic browser pointer edit', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image-wide.png');
    await callHarness(page, 'clearCallbacks');

    await callHarness(page, 'setMosaicConfig', { brushSize: 36, blockSize: 12 });
    await callHarness(page, 'enterMosaicMode');
    expect(await callHarness(page, 'getActiveToolMode')).toBe('mosaic');

    await clickCanvas(page, 120, 80);
    await waitForCallback(
        page,
        (record) => record.name === 'onImageChanged' && record.operation === 'applyMosaic',
    );
    expect((await callHarness(page, 'getState')).canUndo).toBe(true);

    await callHarness(page, 'exitMosaicMode');
    expect(await callHarness(page, 'getActiveToolMode')).toBeNull();
});
