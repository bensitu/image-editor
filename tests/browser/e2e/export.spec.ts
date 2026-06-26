import { expect, test } from '@playwright/test';
import { callHarness, openEditor } from '../support/page-helpers';

test('exportImageBase64 returns browser data URLs for supported formats', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image-transparent.png');

    const png = await callHarness(page, 'exportImageBase64', { fileType: 'png' });
    expect(png).toMatch(/^data:image\/png;base64,/);

    const jpeg = await callHarness(page, 'exportImageBase64', {
        fileType: 'jpeg',
        quality: 0.86,
    });
    expect(jpeg).toMatch(/^data:image\/jpeg;base64,/);

    const webp = await callHarness(page, 'exportImageBase64', {
        fileType: 'webp',
        quality: 0.86,
    });
    expect(webp).toMatch(/^data:image\/webp;base64,/);
});

test('exports support merged and unmerged masks and annotations', async ({ page }) => {
    await openEditor(page);
    await callHarness(page, 'loadFixture', 'test-image.png');
    await callHarness(page, 'createMask', {
        width: 48,
        height: 48,
        left: 40,
        top: 40,
        color: '#000000',
        alpha: 1,
        styles: { strokeWidth: 0 },
    });
    await callHarness(page, 'createTextAnnotation', {
        text: 'E',
        left: 96,
        top: 48,
        fontSize: 28,
        enterEditing: false,
    });

    const merged = await callHarness(page, 'exportToPreview', {
        fileType: 'png',
        mergeMasks: true,
        mergeAnnotations: true,
    });
    expect(merged.width).toBe(160);
    expect(merged.height).toBe(160);

    const unmerged = await callHarness(page, 'exportToPreview', {
        fileType: 'png',
        mergeMasks: false,
        mergeAnnotations: false,
    });
    expect(unmerged.width).toBe(160);
    expect(unmerged.height).toBe(160);
});

test('export rejects when no image is loaded', async ({ page }) => {
    await openEditor(page);
    await expect(callHarness(page, 'exportImageBase64', { fileType: 'png' })).rejects.toThrow();
});
