import { expect, test } from '@playwright/test';
import { callHarness, openEditor } from '../support/page-helpers';

test('crop mode transitions, cancel, aspect ratio, and apply are public-state visible', async ({
    page,
}) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image-wide.png');
    await callHarness(page, 'createMask', { width: 24, height: 24, left: 24, top: 24 });
    await callHarness(page, 'createTextAnnotation', {
        text: 'D',
        left: 64,
        top: 32,
        enterEditing: false,
    });

    await callHarness(page, 'enterCropMode', { aspectRatio: '16:9' });
    expect(await callHarness(page, 'getActiveToolMode')).toBe('crop');
    expect(await callHarness(page, 'getMasks')).toHaveLength(1);
    expect(await callHarness(page, 'getAnnotations')).toHaveLength(1);

    await callHarness(page, 'setCropAspectRatio', '1:1');
    await callHarness(page, 'cancelCrop');
    expect(await callHarness(page, 'getActiveToolMode')).toBeNull();

    await callHarness(page, 'enterCropMode', { aspectRatio: '1:1' });
    await callHarness(page, 'applyCrop');

    const imageInfo = await callHarness(page, 'getImageInfo');
    expect(imageInfo?.width).toBe(120);
    expect(imageInfo?.height).toBe(120);
    expect(await callHarness(page, 'getActiveToolMode')).toBeNull();
    expect((await callHarness(page, 'getState')).canUndo).toBe(true);
});
