import { expect, test } from '@playwright/test';
import { callHarness, openEditor } from '../support/page-helpers';

test('dispose is safe across empty, loaded, and active-tool states', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'dispose');
    await callHarness(page, 'dispose');

    await callHarness(page, 'createEditor');
    await callHarness(page, 'loadFixture', 'test-image.png');
    await callHarness(page, 'dispose');
    await callHarness(page, 'dispose');

    await callHarness(page, 'createEditor');
    await callHarness(page, 'loadFixture', 'test-image.png');
    await callHarness(page, 'enterCropMode');
    expect(await callHarness(page, 'getActiveToolMode')).toBe('crop');
    await callHarness(page, 'dispose');
    await callHarness(page, 'dispose');

    await callHarness(page, 'createEditor');
    expect((await callHarness(page, 'getState')).hasImage).toBe(false);
    await callHarness(page, 'loadFixture', 'test-image-wide.png');
    expect((await callHarness(page, 'getImageInfo'))?.width).toBe(240);
});
