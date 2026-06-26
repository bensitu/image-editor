import { expect, test } from '@playwright/test';
import { callHarness, openEditor } from '../support/page-helpers';

test('editor initializes with an empty public state and disposes idempotently', async ({
    page,
}) => {
    await openEditor(page);

    const state = await callHarness(page, 'getState');
    expect(state.hasImage).toBe(false);
    expect(state.activeToolMode).toBeNull();
    expect(state.canUndo).toBe(false);
    expect(state.canRedo).toBe(false);
    expect(state.canvasWidth).toBe(320);
    expect(state.canvasHeight).toBe(240);

    await callHarness(page, 'dispose');
    await callHarness(page, 'dispose');

    const callbacks = await callHarness(page, 'getCallbackRecords');
    expect(callbacks.filter((record) => record.name === 'onEditorDisposed')).toHaveLength(1);
});

test('editor can be recreated on the same page after dispose', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image.png');
    await callHarness(page, 'dispose');

    await callHarness(page, 'createEditor');
    const state = await callHarness(page, 'getState');
    expect(state.hasImage).toBe(false);
    expect(state.activeToolMode).toBeNull();

    await callHarness(page, 'loadFixture', 'test-image-wide.png');
    const imageInfo = await callHarness(page, 'getImageInfo');
    expect(imageInfo?.width).toBe(240);
    expect(imageInfo?.height).toBe(160);
});
