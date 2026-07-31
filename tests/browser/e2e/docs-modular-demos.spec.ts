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
    await page.evaluate(() => {
        const upperCanvas = document.querySelector<HTMLCanvasElement>(
            '#canvasContainer .upper-canvas',
        );
        if (!upperCanvas) throw new Error('Crop canvas is unavailable.');
        window.scrollBy({ top: upperCanvas.getBoundingClientRect().top - 160 });
    });
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

test('mask and mosaic demo updates its dashed brush and preserves the preview through commit', async ({
    page,
}) => {
    await page.goto('/docs/mask-mosaic.html');
    await expect.poll(() => page.locator('body').getAttribute('data-demo-ready')).toBe('true');
    await page.locator('#loadSampleButton').click();
    await expect(page.locator('#enterMosaicModeButton')).toBeEnabled();
    await page.evaluate(() => {
        interface MosaicProbeObject {
            editorObjectKind?: string;
            radius?: number;
            sessionObjectType?: string;
            strokeDashArray?: readonly number[];
            visible?: boolean;
        }
        interface MosaicProbeCanvas {
            getObjects(): MosaicProbeObject[];
        }
        interface MosaicProbe {
            baseAtPreviewRemoval?: MosaicProbeObject;
            canvas?: MosaicProbeCanvas;
            originalBase?: MosaicProbeObject;
            previewCircle?: MosaicProbeObject;
            previewImage?: MosaicProbeObject;
        }
        const browser = window as unknown as {
            fabric?: {
                Canvas?: {
                    prototype?: {
                        add?: (...objects: MosaicProbeObject[]) => unknown;
                        remove?: (...objects: MosaicProbeObject[]) => unknown;
                    };
                };
            };
            __mosaicSessionProbe?: MosaicProbe;
        };
        const prototype = browser.fabric?.Canvas?.prototype;
        const originalAdd = prototype?.add;
        const originalRemove = prototype?.remove;
        if (
            !prototype ||
            typeof originalAdd !== 'function' ||
            typeof originalRemove !== 'function'
        ) {
            throw new Error('Fabric Canvas mutation methods are unavailable.');
        }
        const probe: MosaicProbe = {};
        browser.__mosaicSessionProbe = probe;
        prototype.add = function (this: MosaicProbeCanvas, ...objects: MosaicProbeObject[]) {
            probe.canvas = this;
            for (const object of objects) {
                if (object.sessionObjectType === 'mosaicPreviewImage') {
                    probe.previewImage = object;
                    probe.originalBase = this.getObjects().find(
                        (candidate) => candidate.editorObjectKind === 'baseImage',
                    );
                } else if (object.sessionObjectType === 'mosaicPreviewCircle') {
                    probe.previewCircle = object;
                }
            }
            return Reflect.apply(originalAdd, this, objects);
        };
        prototype.remove = function (this: MosaicProbeCanvas, ...objects: MosaicProbeObject[]) {
            if (probe.previewImage && objects.includes(probe.previewImage)) {
                probe.baseAtPreviewRemoval = this.getObjects().find(
                    (candidate) => candidate.editorObjectKind === 'baseImage',
                );
            }
            return Reflect.apply(originalRemove, this, objects);
        };
    });

    await page.locator('#enterMosaicModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('mosaic');
    const initialPreview = await page.evaluate(() => {
        const probe = (
            window as unknown as {
                __mosaicSessionProbe?: {
                    previewCircle?: {
                        radius?: number;
                        strokeDashArray?: readonly number[];
                        visible?: boolean;
                    };
                    previewImage?: unknown;
                };
            }
        ).__mosaicSessionProbe;
        return {
            hasCircle: Boolean(probe?.previewCircle),
            hasImage: Boolean(probe?.previewImage),
            radius: probe?.previewCircle?.radius,
            strokeDashArray: probe?.previewCircle?.strokeDashArray,
            visible: probe?.previewCircle?.visible,
        };
    });
    expect(initialPreview).toEqual({
        hasCircle: true,
        hasImage: true,
        radius: 24,
        strokeDashArray: [4, 4],
        visible: false,
    });

    await page.locator('#canvasContainer').scrollIntoViewIfNeeded();
    const bounds = await page.locator('#canvasContainer .upper-canvas').boundingBox();
    if (!bounds) throw new Error('Mosaic canvas bounds are unavailable.');
    const center = {
        x: bounds.x + bounds.width / 2,
        y: bounds.y + bounds.height / 2,
    };
    await page.mouse.move(center.x, center.y);
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (
                        window as unknown as {
                            __mosaicSessionProbe?: { previewCircle?: { visible?: boolean } };
                        }
                    ).__mosaicSessionProbe?.previewCircle?.visible,
            ),
        )
        .toBe(true);

    await page.locator('#mosaicBrushSizeInput').fill('80');
    await page.locator('#mosaicBlockSizeInput').fill('18');
    await expect(page.locator('#statusMosaic')).toHaveText('80px / 18px');
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (
                        window as unknown as {
                            __mosaicSessionProbe?: { previewCircle?: { radius?: number } };
                        }
                    ).__mosaicSessionProbe?.previewCircle?.radius,
            ),
        )
        .toBe(40);

    await page.locator('#canvasContainer .upper-canvas').click();
    await expect(page.locator('#statusLastOperation')).toHaveText('mosaic:end-stroke');
    await page.locator('#exitMosaicModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('None');

    const commitProbe = await page.evaluate(() => {
        const probe = (
            window as unknown as {
                __mosaicSessionProbe?: {
                    baseAtPreviewRemoval?: unknown;
                    canvas?: {
                        getObjects(): Array<{
                            editorObjectKind?: string;
                            sessionObjectType?: string;
                        }>;
                    };
                    originalBase?: unknown;
                };
            }
        ).__mosaicSessionProbe;
        const finalBase = probe?.canvas
            ?.getObjects()
            .find((object) => object.editorObjectKind === 'baseImage');
        return {
            baseChangedBeforePreviewRemoval:
                Boolean(probe?.baseAtPreviewRemoval) &&
                probe?.baseAtPreviewRemoval !== probe?.originalBase,
            finalBaseWasReady: probe?.baseAtPreviewRemoval === finalBase,
            remainingSessionObjects:
                probe?.canvas
                    ?.getObjects()
                    .filter((object) => object.editorObjectKind === 'session').length ?? -1,
        };
    });
    expect(commitProbe).toEqual({
        baseChangedBeforePreviewRemoval: true,
        finalBaseWasReady: true,
        remainingSessionObjects: 0,
    });
});

test('annotation demo preserves v2 Text and Shape mode interaction semantics', async ({ page }) => {
    await page.goto('/docs/annotation.html');
    await expect.poll(() => page.locator('body').getAttribute('data-demo-ready')).toBe('true');
    await page.evaluate(() => {
        interface AnnotationProbeObject {
            editorAnnotationPreviewOwner?: string;
            editorOverlayId?: string;
            editorShapeKind?: string;
            fill?: unknown;
            fontSize?: number;
            getCenterPoint?: () => { x: number; y: number };
            stroke?: unknown;
            strokeWidth?: number;
            text?: string;
            visible?: boolean;
        }
        interface AnnotationProbeCanvas {
            getHeight(): number;
            getObjects(): AnnotationProbeObject[];
            getWidth(): number;
        }
        const browser = window as unknown as {
            fabric?: {
                Canvas?: {
                    prototype?: {
                        add?: (...objects: AnnotationProbeObject[]) => unknown;
                    };
                };
            };
            __annotationModeProbe?: { canvas?: AnnotationProbeCanvas };
        };
        const prototype = browser.fabric?.Canvas?.prototype;
        const originalAdd = prototype?.add;
        if (!prototype || typeof originalAdd !== 'function') {
            throw new Error('Fabric Canvas mutation methods are unavailable.');
        }
        const probe: { canvas?: AnnotationProbeCanvas } = {};
        browser.__annotationModeProbe = probe;
        prototype.add = function (
            this: AnnotationProbeCanvas,
            ...objects: AnnotationProbeObject[]
        ) {
            probe.canvas = this;
            return Reflect.apply(originalAdd, this, objects);
        };
    });
    await page.locator('#loadSampleButton').click();
    await expect(page.locator('#statusAnnotations')).toHaveText('0');
    await expect(page.locator('#enterTextModeButton')).toBeEnabled();
    await expect(page.locator('#canvasContainer')).toBeVisible();
    await page.locator('#canvasContainer').scrollIntoViewIfNeeded();
    const bounds = await page.locator('#canvasContainer .upper-canvas').boundingBox();
    if (!bounds) throw new Error('Annotation canvas bounds are unavailable.');

    await page.locator('#enterTextModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('text');
    await expect(page.locator('#statusAnnotations')).toHaveText('0');
    const textPoint = {
        x: bounds.x + bounds.width * 0.42,
        y: bounds.y + bounds.height * 0.36,
    };
    await page.mouse.click(textPoint.x, textPoint.y);
    await expect(page.locator('#statusAnnotations')).toHaveText('1');
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (
                        window as unknown as {
                            __annotationModeProbe?: {
                                canvas?: {
                                    getObjects(): Array<{
                                        editorAnnotationPreviewOwner?: string;
                                    }>;
                                };
                            };
                        }
                    ).__annotationModeProbe?.canvas
                        ?.getObjects()
                        .filter(
                            (object) => object.editorAnnotationPreviewOwner === 'annotation:text',
                        ).length ?? 0,
            ),
        )
        .toBe(1);

    await page.locator('#textValueInput').fill('Live review');
    await page.locator('#textColorInput').evaluate((input) => {
        const control = input as HTMLInputElement;
        control.value = '#0066ff';
        control.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#textFontSizeInput').fill('48');
    await expect
        .poll(() =>
            page.evaluate(() => {
                const objects = (
                    window as unknown as {
                        __annotationModeProbe?: {
                            canvas?: {
                                getObjects(): Array<{
                                    editorAnnotationPreviewOwner?: string;
                                    fill?: unknown;
                                    fontSize?: number;
                                    text?: string;
                                }>;
                            };
                        };
                    }
                ).__annotationModeProbe?.canvas?.getObjects();
                const preview = objects?.find(
                    (object) => object.editorAnnotationPreviewOwner === 'annotation:text',
                );
                return preview
                    ? { fill: preview.fill, fontSize: preview.fontSize, text: preview.text }
                    : null;
            }),
        )
        .toEqual({ fill: '#0066ff', fontSize: 48, text: 'Live review' });

    await page.evaluate(() => {
        const objects = (
            window as unknown as {
                __annotationModeProbe?: {
                    canvas?: {
                        getObjects(): Array<{
                            editorAnnotationPreviewOwner?: string;
                            hiddenTextarea?: HTMLTextAreaElement | null;
                        }>;
                    };
                };
            }
        ).__annotationModeProbe?.canvas?.getObjects();
        const preview = objects?.find(
            (object) => object.editorAnnotationPreviewOwner === 'annotation:text',
        );
        if (!preview?.hiddenTextarea) throw new Error('Text editing input is unavailable.');
        preview.hiddenTextarea.value = 'Canvas edit';
        preview.hiddenTextarea.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const objects = (
                    window as unknown as {
                        __annotationModeProbe?: {
                            canvas?: {
                                getObjects(): Array<{
                                    editorAnnotationPreviewOwner?: string;
                                    text?: string;
                                }>;
                            };
                        };
                    }
                ).__annotationModeProbe?.canvas?.getObjects();
                return objects?.find(
                    (object) => object.editorAnnotationPreviewOwner === 'annotation:text',
                )?.text;
            }),
        )
        .toBe('Canvas edit');
    await page.locator('#textColorInput').evaluate((input) => {
        const control = input as HTMLInputElement;
        control.value = '#aa00cc';
        control.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const objects = (
                    window as unknown as {
                        __annotationModeProbe?: {
                            canvas?: {
                                getObjects(): Array<{
                                    editorAnnotationPreviewOwner?: string;
                                    fill?: unknown;
                                    text?: string;
                                }>;
                            };
                        };
                    }
                ).__annotationModeProbe?.canvas?.getObjects();
                const preview = objects?.find(
                    (object) => object.editorAnnotationPreviewOwner === 'annotation:text',
                );
                return preview ? { fill: preview.fill, text: preview.text } : null;
            }),
        )
        .toEqual({ fill: '#aa00cc', text: 'Canvas edit' });

    await page.locator('#exitTextModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('None');
    const committedText = await page.evaluate(() => {
        const probe = (
            window as unknown as {
                __annotationModeProbe?: {
                    canvas?: {
                        getHeight(): number;
                        getObjects(): Array<{
                            editorAnnotationPreviewOwner?: string;
                            editorOverlayId?: string;
                            fill?: unknown;
                            fontSize?: number;
                            getCenterPoint?: () => { x: number; y: number };
                            text?: string;
                            visible?: boolean;
                        }>;
                        getWidth(): number;
                    };
                };
            }
        ).__annotationModeProbe;
        const object = probe?.canvas
            ?.getObjects()
            .find(
                (candidate) => candidate.editorOverlayId && !candidate.editorAnnotationPreviewOwner,
            );
        const center = object?.getCenterPoint?.();
        if (!probe?.canvas || !object || !center) throw new Error('Committed Text is unavailable.');
        return {
            canvasHeight: probe.canvas.getHeight(),
            canvasWidth: probe.canvas.getWidth(),
            center,
            fill: object.fill,
            fontSize: object.fontSize,
            text: object.text,
            visible: object.visible,
        };
    });
    expect(committedText).toMatchObject({
        fill: '#aa00cc',
        fontSize: 48,
        text: 'Canvas edit',
        visible: true,
    });

    await page.locator('#enterTextModeButton').click();
    const existingTextBounds = await page.locator('#canvasContainer .upper-canvas').boundingBox();
    if (!existingTextBounds) throw new Error('Text canvas bounds are unavailable.');
    await page.mouse.click(
        existingTextBounds.x +
            (committedText.center.x / committedText.canvasWidth) * existingTextBounds.width,
        existingTextBounds.y +
            (committedText.center.y / committedText.canvasHeight) * existingTextBounds.height,
    );
    await expect(page.locator('#statusAnnotations')).toHaveText('1');
    await expect
        .poll(() =>
            page.evaluate(
                () =>
                    (
                        window as unknown as {
                            __annotationModeProbe?: {
                                canvas?: {
                                    getObjects(): Array<{
                                        editorAnnotationPreviewOwner?: string;
                                    }>;
                                };
                            };
                        }
                    ).__annotationModeProbe?.canvas
                        ?.getObjects()
                        .filter(
                            (object) => object.editorAnnotationPreviewOwner === 'annotation:text',
                        ).length ?? 0,
            ),
        )
        .toBe(1);
    await page.locator('#exitTextModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('None');

    await page.locator('#textColorInput').evaluate((input) => {
        const control = input as HTMLInputElement;
        control.value = '#157f3b';
        control.dispatchEvent(new Event('input', { bubbles: true }));
    });
    await page.locator('#textFontSizeInput').fill('36');
    await expect
        .poll(() =>
            page.evaluate(() => {
                const objects = (
                    window as unknown as {
                        __annotationModeProbe?: {
                            canvas?: {
                                getObjects(): Array<{
                                    editorAnnotationPreviewOwner?: string;
                                    editorOverlayId?: string;
                                    fill?: unknown;
                                    fontSize?: number;
                                    text?: string;
                                }>;
                            };
                        };
                    }
                ).__annotationModeProbe?.canvas?.getObjects();
                const text = objects?.find(
                    (object) =>
                        object.editorOverlayId &&
                        !object.editorAnnotationPreviewOwner &&
                        typeof object.text === 'string',
                );
                return text ? { fill: text.fill, fontSize: text.fontSize } : null;
            }),
        )
        .toEqual({ fill: '#157f3b', fontSize: 36 });
    await expect(page.locator('#statusTool')).toHaveText('None');

    await page.locator('#enterShapeModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('shape');
    await page.locator('#canvasContainer').scrollIntoViewIfNeeded();
    const shapeBounds = await page.locator('#canvasContainer .upper-canvas').boundingBox();
    if (!shapeBounds) throw new Error('Shape canvas bounds are unavailable.');
    const shapeStart = {
        x: shapeBounds.x + shapeBounds.width * 0.3,
        y: shapeBounds.y + shapeBounds.height * 0.55,
    };
    const shapeEnd = {
        x: shapeBounds.x + shapeBounds.width * 0.58,
        y: shapeBounds.y + shapeBounds.height * 0.72,
    };
    await page.mouse.move(shapeStart.x, shapeStart.y);
    await page.mouse.down();
    await page.mouse.move(shapeEnd.x, shapeEnd.y, { steps: 4 });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const objects = (
                    window as unknown as {
                        __annotationModeProbe?: {
                            canvas?: {
                                getObjects(): Array<{
                                    editorAnnotationPreviewOwner?: string;
                                    editorShapeKind?: string;
                                }>;
                            };
                        };
                    }
                ).__annotationModeProbe?.canvas?.getObjects();
                return objects?.find(
                    (object) => object.editorAnnotationPreviewOwner === 'annotation:shape',
                )?.editorShapeKind;
            }),
        )
        .toBe('rect');

    await page.evaluate(() => {
        const values = {
            shapeFillInput: '#0066ff',
            shapeStrokeInput: '#008844',
            shapeStrokeWidthInput: '11',
        } as const;
        for (const [id, value] of Object.entries(values)) {
            const input = document.getElementById(id) as HTMLInputElement | null;
            if (!input) throw new Error(`Shape control "${id}" is missing.`);
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const objects = (
                    window as unknown as {
                        __annotationModeProbe?: {
                            canvas?: {
                                getObjects(): Array<{
                                    editorAnnotationPreviewOwner?: string;
                                    fill?: unknown;
                                    stroke?: unknown;
                                    strokeWidth?: number;
                                }>;
                            };
                        };
                    }
                ).__annotationModeProbe?.canvas?.getObjects();
                const preview = objects?.find(
                    (object) => object.editorAnnotationPreviewOwner === 'annotation:shape',
                );
                return preview
                    ? {
                          fill: preview.fill,
                          stroke: preview.stroke,
                          strokeWidth: preview.strokeWidth,
                      }
                    : null;
            }),
        )
        .toEqual({ fill: 'rgba(0,102,255,0.16)', stroke: '#008844', strokeWidth: 11 });
    await page.mouse.up();
    await expect(page.locator('#statusAnnotations')).toHaveText('2');
    await expect(page.locator('#statusTool')).toHaveText('shape');

    await page.locator('#shapeKindSelect').selectOption('arrow');
    await expect(page.locator('#statusTool')).toHaveText('shape');
    await page.mouse.move(shapeStart.x + 40, shapeStart.y - 80);
    await page.mouse.down();
    await page.mouse.move(shapeEnd.x + 40, shapeEnd.y - 100, { steps: 4 });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const objects = (
                    window as unknown as {
                        __annotationModeProbe?: {
                            canvas?: {
                                getObjects(): Array<{
                                    editorAnnotationPreviewOwner?: string;
                                    editorShapeKind?: string;
                                }>;
                            };
                        };
                    }
                ).__annotationModeProbe?.canvas?.getObjects();
                return objects?.find(
                    (object) => object.editorAnnotationPreviewOwner === 'annotation:shape',
                )?.editorShapeKind;
            }),
        )
        .toBe('arrow');
    await page.mouse.up();
    await expect(page.locator('#statusAnnotations')).toHaveText('3');
    await expect(page.locator('#statusTool')).toHaveText('shape');
    await page.locator('#exitShapeModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('None');

    await page.evaluate(() => {
        const values = {
            shapeStrokeInput: '#c026d3',
            shapeStrokeWidthInput: '7',
        } as const;
        for (const [id, value] of Object.entries(values)) {
            const input = document.getElementById(id) as HTMLInputElement | null;
            if (!input) throw new Error(`Shape control "${id}" is missing.`);
            input.value = value;
            input.dispatchEvent(new Event('input', { bubbles: true }));
        }
    });
    await expect
        .poll(() =>
            page.evaluate(() => {
                const objects = (
                    window as unknown as {
                        __annotationModeProbe?: {
                            canvas?: {
                                getObjects(): Array<{
                                    editorAnnotationPreviewOwner?: string;
                                    editorShapeKind?: string;
                                    stroke?: unknown;
                                    strokeWidth?: number;
                                }>;
                            };
                        };
                    }
                ).__annotationModeProbe?.canvas?.getObjects();
                const arrow = objects?.find(
                    (object) =>
                        object.editorShapeKind === 'arrow' && !object.editorAnnotationPreviewOwner,
                );
                return arrow ? { stroke: arrow.stroke, strokeWidth: arrow.strokeWidth } : null;
            }),
        )
        .toEqual({ stroke: '#c026d3', strokeWidth: 7 });
    await expect(page.locator('#statusTool')).toHaveText('None');
});

test('annotation demo safely removes Text while its editing session is active', async ({
    page,
}) => {
    await page.goto('/docs/annotation.html');
    await expect.poll(() => page.locator('body').getAttribute('data-demo-ready')).toBe('true');
    await page.locator('#loadSampleButton').click();

    const addTextInMode = async () => {
        await page.locator('#canvasContainer').scrollIntoViewIfNeeded();
        const bounds = await page.locator('#canvasContainer .upper-canvas').boundingBox();
        if (!bounds) throw new Error('Annotation canvas bounds are unavailable.');
        await page.mouse.click(bounds.x + bounds.width * 0.48, bounds.y + bounds.height * 0.48);
        await expect(page.locator('#statusAnnotations')).toHaveText('1');
    };

    await page.locator('#enterTextModeButton').click();
    await addTextInMode();
    await expect(page.locator('#removeSelectedAnnotationButton')).toBeEnabled();
    await page.locator('#removeSelectedAnnotationButton').click();
    await expect(page.locator('#statusAnnotations')).toHaveText('0');
    await page.locator('#exitTextModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('None');
    await expect(page.locator('#demoMessage')).toHaveAttribute('data-tone', 'success');

    await page.locator('#enterTextModeButton').click();
    await addTextInMode();
    await expect(page.locator('#removeAllAnnotationsButton')).toBeEnabled();
    await page.locator('#removeAllAnnotationsButton').click();
    await expect(page.locator('#statusAnnotations')).toHaveText('0');
    await page.locator('#exitTextModeButton').click();
    await expect(page.locator('#statusTool')).toHaveText('None');
    await expect(page.locator('#demoMessage')).toHaveAttribute('data-tone', 'success');
});
