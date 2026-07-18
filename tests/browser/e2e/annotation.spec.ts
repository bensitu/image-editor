import { expect, test, type Page } from '@playwright/test';

async function openHarness(page: Page) {
    await page.goto('/tests/browser/pages/basic-editor.html');
    await page.waitForFunction(() => Boolean(window.__imageEditorTest));
    await page.evaluate(async () => {
        await window.__imageEditorTest.create();
        await window.__imageEditorTest.loadFixture('test-image.png');
    });
}

test('Text editing commits once and reflection behavior remains explicit', async ({ page }) => {
    await openHarness(page);

    const result = await page.evaluate(() => window.__imageEditorTest.exerciseTextAnnotation());

    expect(result).toEqual({
        editedText: 'Edited in browser',
        preserveReadableDeterminantPositive: true,
        mirrorDeterminantNegative: true,
        historyRecords: 1,
    });
});

test('rect line arrow and curved Draw paths render as independent Annotation kinds', async ({
    page,
}) => {
    await openHarness(page);

    const result = await page.evaluate(() => window.__imageEditorTest.createAnnotationScene());

    expect(result).toEqual({
        annotationCount: 6,
        kinds: [
            'annotation:draw',
            'annotation:draw',
            'annotation:shape',
            'annotation:shape',
            'annotation:shape',
            'annotation:text',
        ],
        shapeKinds: ['arrow', 'line', 'rect'],
        drawCount: 2,
        curvedDraw: true,
    });
});

test('Draw Eraser removes one intersected Draw object and mutates no other kind', async ({
    page,
}) => {
    await openHarness(page);

    const result = await page.evaluate(() => window.__imageEditorTest.eraseDrawStroke());

    expect(result).toEqual({
        beforeDrawCount: 2,
        afterDrawCount: 1,
        nonDrawMutations: 0,
        historyRecords: 1,
    });
});

test('Annotation state survives Crop and default flatten preserves hidden objects and Mask', async ({
    page,
}) => {
    await openHarness(page);

    const result = await page.evaluate(() =>
        window.__imageEditorTest.exerciseAnnotationLifecycle(),
    );

    expect(result).toEqual({
        cropPreservedCount: 6,
        hiddenPreservedByDefaultFlatten: true,
        lockedRestored: true,
        layerRestored: true,
        maskPreserved: true,
        remainingAfterDefaultFlatten: 1,
        remainingAfterInclusiveFlatten: 0,
        exportWidth: 150,
        exportHeight: 150,
    });
});
