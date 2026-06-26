import { expect, test } from '@playwright/test';
import {
    callHarness,
    dragCanvas,
    expectPreviewScreenshot,
    openEditor,
    waitForCallback,
} from '../support/page-helpers';

test('export with merged draw annotation matches the deterministic baseline', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image.png');
    await callHarness(page, 'setDrawConfig', {
        brushSize: 8,
        color: '#111827',
        opacity: 1,
    });
    await callHarness(page, 'enterDrawMode');
    await dragCanvas(page, [
        { x: 32, y: 128 },
        { x: 56, y: 104 },
        { x: 88, y: 116 },
        { x: 120, y: 72 },
    ]);
    await waitForCallback(
        page,
        (record) => record.name === 'onAnnotationsChanged' && record.annotationCount === 1,
    );
    await callHarness(page, 'exitDrawMode');

    const result = await expectPreviewScreenshot(page, 'export-with-annotation.png', {
        fileType: 'png',
        mergeMasks: false,
        mergeAnnotations: true,
    });
    expect(result.width).toBe(160);
    expect(result.height).toBe(160);
});
