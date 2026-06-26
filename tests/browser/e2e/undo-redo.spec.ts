import { expect, test } from '@playwright/test';
import { callHarness, openEditor, waitForHistory } from '../support/page-helpers';

test('undo and redo update public state and clear redo after a new operation', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image.png');

    await callHarness(page, 'createMask', { width: 24, height: 24, left: 20, top: 20 });
    await waitForHistory(page, { canUndo: true, canRedo: false });
    expect(await callHarness(page, 'getMasks')).toHaveLength(1);

    await callHarness(page, 'undo');
    await waitForHistory(page, { canUndo: false, canRedo: true });
    expect(await callHarness(page, 'getMasks')).toHaveLength(0);

    await callHarness(page, 'redo');
    await waitForHistory(page, { canUndo: true, canRedo: false });
    expect(await callHarness(page, 'getMasks')).toHaveLength(1);

    await callHarness(page, 'undo');
    await waitForHistory(page, { canUndo: false, canRedo: true });

    await callHarness(page, 'createMask', { width: 28, height: 28, left: 56, top: 56 });
    await waitForHistory(page, { canUndo: true, canRedo: false });
    expect(await callHarness(page, 'getMasks')).toHaveLength(1);
});
