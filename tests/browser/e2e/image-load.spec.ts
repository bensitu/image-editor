import { expect, test } from '@playwright/test';
import { callHarness, openEditor } from '../support/page-helpers';

test('loading a valid fixture fires lifecycle callbacks and updates image state', async ({
    page,
}) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image.png');

    const imageInfo = await callHarness(page, 'getImageInfo');
    expect(imageInfo).toMatchObject({
        width: 160,
        height: 160,
        canvasWidth: 320,
        canvasHeight: 240,
    });

    const state = await callHarness(page, 'getState');
    expect(state.hasImage).toBe(true);
    expect(state.image?.width).toBe(160);
    expect(state.image?.height).toBe(160);

    const callbackNames = (await callHarness(page, 'getCallbackRecords')).map(
        (record) => record.name,
    );
    expect(callbackNames).toContain('onImageLoadStart');
    expect(callbackNames).toContain('onImageLoaded');
    expect(callbackNames).toContain('onImageChanged');
    expect(callbackNames).toContain('onBusyChange');
});

test('unsupported image input is reported as a warning without mutation', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadInvalidImage');

    const state = await callHarness(page, 'getState');
    expect(state.hasImage).toBe(false);

    const warning = (await callHarness(page, 'getCallbackRecords')).find(
        (record) => record.name === 'onWarning',
    );
    expect(warning?.message).toContain('not a supported PNG, JPEG, or WebP Data URL');
});
