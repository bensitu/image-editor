import { expect, test } from '@playwright/test';
import { callHarness, openEditor } from '../support/page-helpers';

test('mask creation, selection, removal, and history work in the browser', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image.png');

    const firstMask = await callHarness(page, 'createMask');
    expect(firstMask?.maskId).toBe(1);

    const secondMask = await callHarness(page, 'createMask', {
        shape: 'ellipse',
        width: 42,
        height: 30,
        left: 72,
        top: 48,
        color: '#000000',
        alpha: 0.8,
        styles: {
            stroke: '#ffffff',
            strokeWidth: 0,
        },
    });
    expect(secondMask?.maskId).toBe(2);

    expect(await callHarness(page, 'getMasks')).toHaveLength(2);
    expect(await callHarness(page, 'getSelection')).toMatchObject({
        selectedObjectKind: 'mask',
        selectedMaskId: 2,
    });

    await callHarness(page, 'removeSelectedMask');
    expect(await callHarness(page, 'getMasks')).toHaveLength(1);
    expect((await callHarness(page, 'getState')).canUndo).toBe(true);

    const records = await callHarness(page, 'getCallbackRecords');
    expect(
        records.some((record) => record.name === 'onMasksChanged' && record.maskCount === 2),
    ).toBe(true);
    expect(
        records.some((record) => record.name === 'onMasksChanged' && record.maskCount === 1),
    ).toBe(true);
});
