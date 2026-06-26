import { expect, test } from '@playwright/test';
import { callHarness, openEditor } from '../support/page-helpers';

test('public state accessors expose current browser editor state', async ({ page }) => {
    await openEditor(page);

    expect(await callHarness(page, 'getImageInfo')).toBeNull();
    expect(await callHarness(page, 'getActiveToolMode')).toBeNull();
    expect(await callHarness(page, 'getMasks')).toEqual([]);
    expect(await callHarness(page, 'getAnnotations')).toEqual([]);
    expect(await callHarness(page, 'getSelection')).toEqual({
        selectedObjectKind: null,
        selectedMaskId: null,
        selectedMaskIds: [],
        selectedAnnotationId: null,
        selectedAnnotationIds: [],
    });
    expect(await callHarness(page, 'isBusy')).toBe(false);
    expect(await callHarness(page, 'isProcessing')).toBe(false);

    await callHarness(page, 'loadFixture', 'test-image.png');
    const mask = await callHarness(page, 'createMask', {
        width: 32,
        height: 28,
        left: 24,
        top: 36,
        color: '#000000',
        alpha: 0.6,
    });
    expect(mask?.maskId).toBe(1);

    const selection = await callHarness(page, 'getSelection');
    expect(selection.selectedObjectKind).toBe('mask');
    expect(selection.selectedMaskId).toBe(1);

    const annotation = await callHarness(page, 'createTextAnnotation', {
        text: 'B',
        left: 72,
        top: 40,
        fontSize: 24,
        enterEditing: false,
    });
    expect(annotation?.annotationId).toBe(1);

    const state = await callHarness(page, 'getState');
    expect(state.hasImage).toBe(true);
    expect(state.maskCount).toBe(1);
    expect(state.annotationCount).toBe(1);
    expect(state.canUndo).toBe(true);

    await callHarness(page, 'enterCropMode', { aspectRatio: '1:1' });
    expect(await callHarness(page, 'getActiveToolMode')).toBe('crop');
    expect((await callHarness(page, 'getState')).isBusy).toBe(true);
    expect(await callHarness(page, 'isProcessing')).toBe(false);
    await callHarness(page, 'cancelCrop');

    await callHarness(page, 'enterMosaicMode');
    expect(await callHarness(page, 'getActiveToolMode')).toBe('mosaic');
    await callHarness(page, 'exitMosaicMode');
    expect(await callHarness(page, 'getActiveToolMode')).toBeNull();
});
