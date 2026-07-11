import { expect, test } from '@playwright/test';

test('integrated demo preserves the scene while transform following is configured', async ({
    page,
}) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (error) => pageErrors.push(error.message));

    await page.goto('/docs/integrated-editor.html');
    await expect(page.locator('h1')).toHaveText('Integrated Editor Demo');

    const apiSurface = await page.evaluate(() => {
        const namespace = Reflect.get(globalThis, 'ImageEditor') as Record<string, unknown>;
        const Constructor = (namespace.ImageEditor ?? namespace.default) as new (
            options?: Record<string, unknown>,
        ) => Record<string, unknown>;
        const editor = new Constructor();
        return {
            createShapeAnnotation: typeof editor.createShapeAnnotation,
            createTextAnnotation: typeof editor.createTextAnnotation,
        };
    });
    expect(apiSurface).toEqual({
        createShapeAnnotation: 'function',
        createTextAnnotation: 'function',
    });

    const loadSampleButton = page.locator('#loadSampleButton');
    await expect(loadSampleButton).toBeEnabled();
    await loadSampleButton.click();

    await expect(page.locator('#statusImage')).toHaveText('Loaded');
    expect(pageErrors).toEqual([]);
    await expect(page.locator('#statusMasks')).toHaveText('2');
    await expect(page.locator('#statusAnnotations')).toHaveText('2');
    await expect(page.locator('#maskList li')).toHaveCount(2);
    await expect(page.locator('#annotationList li')).toHaveCount(2);
    await expect(page.locator('#bindMasksToImageTransformInput')).toBeChecked();
    await expect(page.locator('#bindAnnotationsToImageTransformInput')).toBeChecked();
    await expect(page.locator('#statusMaskBinding')).toHaveText('Follow');
    await expect(page.locator('#statusAnnotationBinding')).toHaveText('Follow');

    await page.locator('#bindMasksToImageTransformInput').uncheck();
    await expect(page.locator('#statusMaskBinding')).toHaveText('Fixed');
    await expect(page.locator('#statusMasks')).toHaveText('2');
    await expect(page.locator('#statusAnnotations')).toHaveText('2');

    await page.locator('#createMaskButton').click();
    await expect(page.locator('#statusMasks')).toHaveText('3');

    await page.locator('#textValueInput').fill('Combined demo note');
    await page.locator('#createTextAnnotationButton').click();
    await page.locator('#shapeKindSelect').selectOption('arrow');
    await page.locator('#createShapeAnnotationButton').click();
    await expect(page.locator('#statusAnnotations')).toHaveText('4');

    await page.locator('#enterDrawModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('draw');
    await page.locator('#exitDrawModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('None');

    await page.locator('#rotateRightDegreesInput').fill('37');
    await page.locator('#rotateRightButton').click();
    await expect(page.locator('#statusRotation')).toHaveText('37 deg');

    await page.locator('#zoomInButton').click();
    await expect(page.locator('#statusScale')).not.toHaveText('100%');
    const transformedScale = await page.locator('#statusScale').textContent();

    await page.locator('#bindAnnotationsToImageTransformInput').uncheck();
    await expect(page.locator('#statusAnnotationBinding')).toHaveText('Fixed');
    await expect(page.locator('#statusRotation')).toHaveText('37 deg');
    await expect(page.locator('#statusScale')).toHaveText(transformedScale || '105%');
    await expect(page.locator('#statusMasks')).toHaveText('3');
    await expect(page.locator('#statusAnnotations')).toHaveText('4');

    await page.locator('#bindMasksToImageTransformInput').check();
    await expect(page.locator('#statusMaskBinding')).toHaveText('Follow');
    await expect(page.locator('#statusAnnotationBinding')).toHaveText('Fixed');
    await expect(page.locator('#statusRotation')).toHaveText('37 deg');
    await expect(page.locator('#statusScale')).toHaveText(transformedScale || '105%');

    await page.locator('#flipHorizontalButton').click();
    await expect(page.locator('#statusFlipX')).toHaveText('Yes');

    await page.locator('#resetImageTransformButton').click();
    await expect(page.locator('#statusScale')).toHaveText('100%');
    await expect(page.locator('#statusRotation')).toHaveText('0 deg');
    await expect(page.locator('#statusFlipX')).toHaveText('No');
    await expect(page.locator('#statusMasks')).toHaveText('3');
    await expect(page.locator('#statusAnnotations')).toHaveText('4');

    await page.locator('#exportImageButton').click();
    await expect(page.locator('#exportPreview')).toHaveAttribute('src', /^data:image\/png;base64,/);

    expect(pageErrors).toEqual([]);
});
