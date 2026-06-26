import { expect, test } from '@playwright/test';
import { callHarness, openEditor } from '../support/page-helpers';

test('tool-mode and history callbacks report public transition shapes', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image.png');
    await callHarness(page, 'clearCallbacks');

    await callHarness(page, 'enterCropMode');
    await callHarness(page, 'cancelCrop');
    await callHarness(page, 'enterMosaicMode');
    await callHarness(page, 'exitMosaicMode');
    await callHarness(page, 'createMask', { width: 24, height: 24, left: 16, top: 16 });
    await callHarness(page, 'undo');
    await callHarness(page, 'redo');

    const records = await callHarness(page, 'getCallbackRecords');
    const toolTransitions = records
        .filter((record) => record.name === 'onToolModeChange')
        .map((record) => [record.previousToolMode, record.activeToolMode, record.operation]);
    expect(toolTransitions).toEqual([
        [null, 'crop', 'enterCropMode'],
        ['crop', null, 'cancelCrop'],
        [null, 'mosaic', 'enterMosaicMode'],
        ['mosaic', null, 'exitMosaicMode'],
    ]);

    const historyTransitions = records
        .filter((record) => record.name === 'onHistoryChange')
        .map((record) => [record.operation, record.history?.canUndo, record.history?.canRedo]);
    expect(historyTransitions).toEqual([
        ['createMask', true, false],
        ['undo', false, true],
        ['redo', true, false],
    ]);
});

test('error, warning, selection, mask, and annotation callbacks fire in browser', async ({
    page,
}) => {
    await openEditor(page);
    await expect(callHarness(page, 'loadBrokenPng')).rejects.toThrow();
    await callHarness(page, 'loadInvalidImage');
    await callHarness(page, 'loadFixture', 'test-image.png');
    await callHarness(page, 'createMask', { width: 20, height: 20, left: 20, top: 20 });
    await callHarness(page, 'createTextAnnotation', {
        text: 'C',
        left: 48,
        top: 48,
        enterEditing: false,
    });

    const records = await callHarness(page, 'getCallbackRecords');
    expect(records.some((record) => record.name === 'onError')).toBe(true);
    expect(records.some((record) => record.name === 'onWarning')).toBe(true);
    expect(
        records.some((record) => record.name === 'onMasksChanged' && record.maskCount === 1),
    ).toBe(true);
    expect(
        records.some(
            (record) => record.name === 'onAnnotationsChanged' && record.annotationCount === 1,
        ),
    ).toBe(true);
    expect(
        records.some(
            (record) =>
                record.name === 'onSelectionChange' &&
                record.selection?.selectedObjectKind === 'mask',
        ),
    ).toBe(true);
});

test('callback exceptions are isolated from editor operations', async ({ page }) => {
    await openEditor(page, {
        throwingCallbacks: ['onToolModeChange', 'onHistoryChange'],
    });
    await callHarness(page, 'loadFixture', 'test-image.png');

    await callHarness(page, 'enterCropMode');
    expect(await callHarness(page, 'getActiveToolMode')).toBe('crop');
    await callHarness(page, 'cancelCrop');
    expect(await callHarness(page, 'getActiveToolMode')).toBeNull();

    const mask = await callHarness(page, 'createMask', {
        width: 20,
        height: 20,
        left: 30,
        top: 30,
    });
    expect(mask?.maskId).toBe(1);
    expect((await callHarness(page, 'getState')).canUndo).toBe(true);
});
