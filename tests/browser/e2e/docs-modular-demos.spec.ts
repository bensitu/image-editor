/**
 * Verifies that each current documentation demo loads and installs its focused modular UMD plan.
 *
 * Image Editor scripts load directly from the repository build so local testing exercises dist.
 * The external Fabric request is fulfilled from node_modules to keep the test deterministic.
 *
 * @module
 */

import { expect, test } from '@playwright/test';

interface DemoBrowser extends Window {
    readonly ImageEditor?: {
        readonly ImageEditorCore?: unknown;
        readonly composePlugins?: unknown;
    };
    readonly ImageEditorFull?: unknown;
    readonly ImageEditorPlugins?: Readonly<Record<string, unknown>>;
}

const fabricLocalPath = '/node_modules/fabric/dist/index.min.js';
const imageEditorLocalPathBase = '/dist/umd';

const demoPlans = [
    {
        name: 'landing',
        path: '/docs/index.html',
        pluginIds: [
            'overlay',
            'annotation',
            'filters',
            'mask',
            'annotation-text',
            'annotation-shape',
        ],
        globals: ['Annotation', 'AnnotationShape', 'AnnotationText', 'Filters', 'Mask', 'Overlay'],
    },
    {
        name: 'basic',
        path: '/docs/basic.html',
        pluginIds: ['overlay', 'transform', 'history', 'filters', 'crop'],
        globals: ['Crop', 'Filters', 'History', 'Overlay', 'Transform'],
    },
    {
        name: 'annotation',
        path: '/docs/annotation.html',
        pluginIds: [
            'overlay',
            'annotation',
            'history',
            'annotation-text',
            'annotation-shape',
            'annotation-draw',
        ],
        globals: [
            'Annotation',
            'AnnotationDraw',
            'AnnotationShape',
            'AnnotationText',
            'History',
            'Overlay',
        ],
    },
    {
        name: 'mask and mosaic',
        path: '/docs/mask-mosaic.html',
        pluginIds: ['overlay', 'mask', 'mosaic'],
        globals: ['Mask', 'Mosaic', 'Overlay'],
    },
    {
        name: 'integrated editor',
        path: '/docs/integrated-editor.html',
        pluginIds: [
            'overlay',
            'annotation',
            'transform',
            'history',
            'mask',
            'annotation-text',
            'annotation-shape',
            'annotation-draw',
        ],
        globals: [
            'Annotation',
            'AnnotationDraw',
            'AnnotationShape',
            'AnnotationText',
            'History',
            'Mask',
            'Overlay',
            'Transform',
        ],
    },
] as const;

for (const plan of demoPlans) {
    test(`${plan.name} demo uses its focused modular UMD plan`, async ({ page }) => {
        const pageErrors: string[] = [];
        const browserSecurityMessages: string[] = [];
        page.on('pageerror', (error) => pageErrors.push(error.message));
        page.on('console', (message) => {
            if (/Content Security Policy|Tracking Prevention/iu.test(message.text())) {
                browserSecurityMessages.push(message.text());
            }
        });

        const response = await page.goto(plan.path);
        expect(response?.ok()).toBe(true);
        await expect.poll(() => page.locator('body').getAttribute('data-demo-ready')).toBe('true');

        const result = await page.evaluate(
            ({ fabricPath, localPathBase }) => {
                const browser = window as unknown as DemoBrowser;
                const scriptUrls = Array.from(document.scripts).map(
                    (script) => new URL(script.src),
                );
                const imageEditorScripts = scriptUrls
                    .map(({ pathname }) => pathname)
                    .filter((pathname) => pathname.startsWith(`${localPathBase}/`));
                return {
                    pluginGlobals: Object.keys(browser.ImageEditorPlugins ?? {}).sort(),
                    coreAvailable:
                        typeof browser.ImageEditor?.ImageEditorCore === 'function' &&
                        typeof browser.ImageEditor?.composePlugins === 'function',
                    fullAbsent: browser.ImageEditorFull === undefined,
                    hasDemoError: document.body.dataset.demoError === 'true',
                    fabricScripts: scriptUrls
                        .map(({ pathname }) => pathname)
                        .filter((pathname) => pathname === fabricPath),
                    imageEditorScripts,
                    externalScripts: scriptUrls
                        .filter(({ origin }) => origin !== window.location.origin)
                        .map(({ href }) => href),
                };
            },
            { fabricPath: fabricLocalPath, localPathBase: imageEditorLocalPathBase },
        );

        expect(result.pluginGlobals).toEqual(plan.globals);
        expect(result.coreAvailable).toBe(true);
        expect(result.fullAbsent).toBe(true);
        expect(result.hasDemoError).toBe(false);
        expect(result.fabricScripts).toEqual([fabricLocalPath]);
        expect(result.imageEditorScripts).toEqual([
            `${imageEditorLocalPathBase}/image-editor.core.umd.min.js`,
            ...plan.pluginIds.map(
                (pluginId) =>
                    `${imageEditorLocalPathBase}/plugins/image-editor.plugin.${pluginId}.umd.min.js`,
            ),
        ]);
        expect(result.externalScripts).toEqual([]);
        expect(pageErrors).toEqual([]);
        expect(browserSecurityMessages).toEqual([]);
    });
}

test('basic demo keeps the image painted throughout animated zoom controls', async ({ page }) => {
    await page.goto('/docs/basic.html');
    await expect.poll(() => page.locator('body').getAttribute('data-demo-ready')).toBe('true');
    await page.locator('#loadSampleButton').click();
    await expect(page.locator('#canvasContainer')).toBeVisible();
    await expect(page.locator('#zoomInButton')).toBeEnabled();

    const captureZoomFrames = async (buttonSelector: string) =>
        page.evaluate(async (selector) => {
            const canvas = document.querySelector<HTMLCanvasElement>(
                '#canvasContainer .lower-canvas',
            );
            const zoomButton = document.querySelector<HTMLButtonElement>(selector);
            const context = canvas?.getContext('2d', { willReadFrequently: true });
            if (!canvas || !zoomButton || !context)
                throw new Error('Zoom frame probe is unavailable.');

            const frameSamples: Array<Readonly<{ alpha: number; height: number; width: number }>> =
                [];
            const dimensionSamples: Array<
                Readonly<{ alpha: number; height: number; width: number }>
            > = [];
            const startedAt = performance.now();
            const readSample = (): Readonly<{ alpha: number; height: number; width: number }> => {
                const x = Math.max(0, Math.floor(canvas.width / 2));
                const y = Math.max(0, Math.floor(canvas.height / 2));
                return Object.freeze({
                    alpha: context.getImageData(x, y, 1, 1).data[3] ?? 0,
                    height: canvas.height,
                    width: canvas.width,
                });
            };
            const dimensionObserver = new MutationObserver(() => {
                dimensionSamples.push(readSample());
            });
            dimensionObserver.observe(canvas, {
                attributeFilter: ['height', 'width'],
                attributes: true,
            });

            return new Promise<
                Readonly<{
                    dimensionSamples: typeof dimensionSamples;
                    frameSamples: typeof frameSamples;
                }>
            >((resolve, reject) => {
                let operationStarted = false;
                const sampleFrame = (): void => {
                    frameSamples.push(readSample());
                    operationStarted ||= zoomButton.disabled;
                    if (operationStarted && !zoomButton.disabled) {
                        dimensionObserver.disconnect();
                        resolve(Object.freeze({ dimensionSamples, frameSamples }));
                        return;
                    }
                    if (performance.now() - startedAt >= 5_000) {
                        dimensionObserver.disconnect();
                        reject(new Error('Animated zoom did not settle within five seconds.'));
                        return;
                    }
                    requestAnimationFrame(sampleFrame);
                };
                requestAnimationFrame(sampleFrame);
                zoomButton.click();
                operationStarted = zoomButton.disabled;
            });
        }, buttonSelector);

    for (const buttonSelector of ['#zoomInButton', '#zoomOutButton']) {
        const probe = await captureZoomFrames(buttonSelector);
        expect(probe.frameSamples.length).toBeGreaterThan(0);
        expect(probe.frameSamples[0]?.alpha).toBeGreaterThan(0);
        expect(probe.frameSamples.filter(({ alpha }) => alpha === 0)).toEqual([]);
        expect(probe.dimensionSamples.length).toBeGreaterThan(0);
        expect(probe.dimensionSamples.filter(({ alpha }) => alpha === 0)).toEqual([]);
    }
});

test('basic demo shows Fabric controls for the active Crop preview', async ({ page }) => {
    await page.goto('/docs/basic.html');
    await expect.poll(() => page.locator('body').getAttribute('data-demo-ready')).toBe('true');
    await page.locator('#loadSampleButton').click();
    await expect(page.locator('#enterCropModeButton')).toBeEnabled();
    await page.evaluate(() => {
        const browser = window as unknown as {
            fabric?: {
                Canvas?: {
                    prototype?: {
                        setActiveObject?: (object: unknown, event?: unknown) => unknown;
                    };
                };
            };
            __cropControlProbe?: Readonly<{ canvas: unknown; object: unknown }>;
        };
        const prototype = browser.fabric?.Canvas?.prototype;
        const setActiveObject = prototype?.setActiveObject;
        if (!prototype || typeof setActiveObject !== 'function') {
            throw new Error('Fabric Canvas activation is unavailable.');
        }
        prototype.setActiveObject = function (object: unknown, event?: unknown) {
            browser.__cropControlProbe = Object.freeze({ canvas: this, object });
            return Reflect.apply(setActiveObject, this, [object, event]);
        };
    });

    await page.locator('#enterCropModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('crop');
    await expect(page.locator('#applyCropButton')).toBeEnabled();
    await page.locator('#canvasContainer').scrollIntoViewIfNeeded();
    const probe = await page.evaluate(() => {
        const browser = window as unknown as {
            __cropControlProbe?: {
                canvas: {
                    getActiveObject(): unknown;
                    getWidth(): number;
                    getHeight(): number;
                };
                object: {
                    evented?: boolean;
                    getCoords(): Array<{ x: number; y: number }>;
                    hasControls?: boolean;
                    height?: number;
                    isControlVisible(key: string): boolean;
                    oCoords?: Readonly<Record<string, Readonly<{ x: number; y: number }>>>;
                    selectable?: boolean;
                    width?: number;
                };
            };
        };
        const captured = browser.__cropControlProbe;
        const upperCanvas = document.querySelector<HTMLCanvasElement>(
            '#canvasContainer .upper-canvas',
        );
        if (!captured || !upperCanvas) throw new Error('Crop control activation was not captured.');
        const bounds = upperCanvas.getBoundingClientRect();
        const topLeft = captured.object.oCoords?.tl ?? captured.object.getCoords()[0];
        if (!topLeft) throw new Error('Crop control coordinates are unavailable.');
        return {
            active: captured.canvas.getActiveObject() === captured.object,
            evented: captured.object.evented,
            hasControls: captured.object.hasControls,
            rotationControlVisible: captured.object.isControlVisible('mtr'),
            selectable: captured.object.selectable,
            size: { height: captured.object.height, width: captured.object.width },
            topLeft: {
                x: bounds.left + (topLeft.x / captured.canvas.getWidth()) * bounds.width,
                y: bounds.top + (topLeft.y / captured.canvas.getHeight()) * bounds.height,
            },
        };
    });
    expect(probe).toMatchObject({
        active: true,
        evented: true,
        hasControls: true,
        rotationControlVisible: false,
        selectable: true,
    });

    await page.mouse.move(probe.topLeft.x, probe.topLeft.y);
    await page.mouse.down();
    await page.mouse.move(probe.topLeft.x + 80, probe.topLeft.y + 60, { steps: 4 });
    await page.mouse.up();
    const resized = await page.evaluate(() => {
        const browser = window as unknown as {
            __cropControlProbe?: {
                object: { height?: number; scaleX?: number; scaleY?: number; width?: number };
            };
        };
        const object = browser.__cropControlProbe?.object;
        if (!object) throw new Error('Crop control activation was not captured.');
        return {
            height: Number(object.height),
            width: Number(object.width),
        };
    });
    const resizeDiagnostic = JSON.stringify({ probe, resized });
    expect(resized.width, resizeDiagnostic).toBeLessThan(Number(probe.size.width) - 40);
    expect(resized.height, resizeDiagnostic).toBeLessThan(Number(probe.size.height) - 20);
    await page.locator('#applyCropButton').click();
    await expect(page.locator('#statusTool')).toHaveText('None');
    await page.locator('#exportImageButton').click();
    await expect
        .poll(() =>
            page
                .locator('#exportPreview')
                .evaluate((image) => (image as HTMLImageElement).naturalWidth),
        )
        .toBeGreaterThan(0);
    const exportedSize = await page.locator('#exportPreview').evaluate((image) => ({
        height: (image as HTMLImageElement).naturalHeight,
        width: (image as HTMLImageElement).naturalWidth,
    }));
    expect(exportedSize.width).toBeLessThan(Number(probe.size.width) - 40);
    expect(exportedSize.height).toBeLessThan(Number(probe.size.height) - 20);
    expect(Math.abs(exportedSize.width - resized.width)).toBeLessThanOrEqual(2);
    expect(Math.abs(exportedSize.height - resized.height)).toBeLessThanOrEqual(2);
});
