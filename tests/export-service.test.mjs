/**
 * Type:
 *   Unit test
 *
 * Purpose:
 *   Verifies src/export/export-service.ts public export helpers with lightweight
 *   canvas and DOM stubs. The suite covers readiness checks, option forwarding,
 *   ActiveSelection discard, data URL return values, File construction, and download
 *   link creation.
 *
 * Scope:
 *   - No-image calls report warnings and either return an empty string or throw
 *     ExportNotReadyError as appropriate.
 *   - exportImageBase64 and downloadImage discard the active selection before
 *     exporting.
 *   - exportImageFile uses requested names and falls back to defaultDownloadFileName
 *     when omitted.
 *
 * Out of scope:
 *   - visual pixel-quality comparison
 *   - browser download UI details
 *   - unrelated image loading behavior
 *
 * Environment:
 *   - Node.js ESM
 *   - jsdom or DOM stubs are used where needed
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/export-service.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on export service base64, file, and download behavior
 *     only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { exportImageBase64, exportImageFile, downloadImage } =
    await import('../src/export/export-service.ts');
const { ExportError, ExportNotReadyError } = await import('../src/core/errors.ts');

// ─── Test doubles ───────────────────────────────────────────────────────────

/**
 * Minimal stand-in for `fabric.Canvas`. Records the order of method
 * calls so the test can assert that `discardActiveObject` precedes
 * `toDataURL` per the documented contract.
 */
function makeMockCanvas(stubDataUrl = 'data:image/jpeg;base64,AAAA') {
    const callOrder = [];
    const toDataURLArgs = [];
    return {
        callOrder,
        toDataURLArgs,
        width: 100,
        height: 100,
        getWidth() {
            return this.width;
        },
        getHeight() {
            return this.height;
        },
        // The export style backup/restore bracket reads `getObjects()`
        // through `withMaskStyleBackup` to enumerate masks. These tests
        // exercise format/multiplier/no-image gates rather than the
        // bake-in itself, so an empty list is the right stand-in.
        getObjects() {
            return [];
        },
        discardActiveObject() {
            callOrder.push('discardActiveObject');
            return this;
        },
        toDataURL(options) {
            callOrder.push('toDataURL');
            toDataURLArgs.push(options);
            return stubDataUrl;
        },
        requestRenderAll() {
            callOrder.push('requestRenderAll');
        },
        renderAll() {
            callOrder.push('renderAll');
        },
    };
}

function makeContext(overrides = {}) {
    const canvas = overrides.canvas ?? makeMockCanvas();
    const options = {
        defaultDownloadFileName: 'edited_image',
        downsampleQuality: 0.92,
        exportMultiplier: 1,
        maxExportPixels: 50000000,
        maxExportDimension: 16384,
        exportAreaByDefault: 'image',
        mergeMasksByDefault: true,
        mergeAnnotationsByDefault: true,
        backgroundColor: 'transparent',
        ...(overrides.options ?? {}),
    };
    return {
        canvas,
        options,
        fabric: overrides.fabric ?? {},
        isImageLoaded: overrides.isImageLoaded ?? (() => true),
        getOriginalImage: overrides.getOriginalImage ?? (() => null),
        withSelectionChangeSuppressed:
            overrides.withSelectionChangeSuppressed ??
            (async (callback) => {
                return await callback();
            }),
    };
}

function makeFakeOriginalImage(rect = { left: 10, top: 20, width: 30, height: 40 }) {
    return {
        angle: 0,
        setCoords() {},
        getBoundingRect() {
            return { ...rect };
        },
    };
}

function makeMask() {
    return {
        editorObjectKind: 'mask',
        type: 'rect',
        maskId: 1,
        maskUid: 'mask-1',
        maskName: 'mask1',
        opacity: 0.5,
        fill: '#ff0000',
        stroke: '#00ff00',
        strokeWidth: 2,
        selectable: true,
        lockRotation: false,
        visible: true,
        set(patch) {
            Object.assign(this, patch);
            return this;
        },
        setCoords() {
            return this;
        },
    };
}

function makeAnnotation({ id, hidden = false }) {
    return {
        editorObjectKind: 'annotation',
        annotationId: id,
        annotationType: 'text',
        annotationName: `text${id}`,
        annotationHidden: hidden,
        visible: true,
        set(patch) {
            Object.assign(this, patch);
            return this;
        },
        setCoords() {
            return this;
        },
    };
}

function makeCanvasWithMask({ expectedMaskVisible, expectedBaked }) {
    const mask = makeMask();
    const canvas = {
        ...makeMockCanvas('data:image/png;base64,' + Buffer.from('export').toString('base64')),
        objects: [mask],
        getObjects() {
            return this.objects.slice();
        },
        toDataURL(options) {
            if (expectedMaskVisible !== undefined) {
                assert.equal(mask.visible, expectedMaskVisible, 'mask visibility during render');
            }
            if (expectedBaked) {
                assert.equal(mask.opacity, 1);
                assert.equal(mask.fill, '#000');
                assert.equal(mask.strokeWidth, 0);
                assert.equal(mask.stroke, null);
                assert.equal(mask.selectable, false);
            }
            this.callOrder.push('toDataURL');
            this.toDataURLArgs.push(options);
            const mimeType =
                options?.format === 'jpeg' ? 'image/jpeg' : `image/${options?.format ?? 'png'}`;
            return `data:${mimeType};base64,${Buffer.from('export').toString('base64')}`;
        },
    };
    return { canvas, mask };
}

/** Replace `console.error` for the duration of `fn`. */
async function suppressErrors(fn) {
    const original = console.error;
    const errors = [];
    console.error = (...args) => errors.push(args);
    try {
        await fn();
    } finally {
        console.error = original;
    }
    return errors;
}

async function withFakeCanvasDom(fn) {
    const previousDocument = globalThis.document;
    const previousImage = globalThis.Image;
    const fills = [];
    const stats = {
        canvasCount: 0,
        getImageDataCalls: 0,
        toDataUrlTypes: [],
    };

    class FakeImage {
        constructor() {
            this.naturalWidth = 2;
            this.naturalHeight = 2;
            this.width = 2;
            this.height = 2;
            this.listeners = {};
        }
        addEventListener(event, handler) {
            this.listeners[event] = handler;
        }
        removeEventListener(event) {
            delete this.listeners[event];
        }
        set src(_value) {
            queueMicrotask(() => this.listeners.load?.());
        }
    }

    function createContext() {
        let fillStyle = '#000000';
        return {
            get fillStyle() {
                return fillStyle;
            },
            set fillStyle(value) {
                const raw = String(value).toLowerCase();
                const accepted = new Set([
                    '#000001',
                    '#000002',
                    '#ffffff',
                    '#ff0000',
                    'rebeccapurple',
                ]);
                if (accepted.has(raw)) fillStyle = raw;
            },
            fillRect() {
                fills.push(fillStyle);
            },
            drawImage() {},
            getImageData() {
                stats.getImageDataCalls += 1;
                return { data: new Uint8ClampedArray(2 * 2 * 4) };
            },
            putImageData() {},
        };
    }

    globalThis.Image = FakeImage;
    globalThis.document = {
        createElement(tag) {
            assert.equal(String(tag).toLowerCase(), 'canvas');
            stats.canvasCount += 1;
            return {
                width: 0,
                height: 0,
                getContext(type) {
                    assert.equal(type, '2d');
                    return createContext();
                },
                toDataURL(type) {
                    stats.toDataUrlTypes.push(type);
                    return `data:${type};base64,${Buffer.from('jpeg').toString('base64')}`;
                },
            };
        },
    };

    try {
        await fn(fills, stats);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
        if (previousImage === undefined) {
            delete globalThis.Image;
        } else {
            globalThis.Image = previousImage;
        }
    }
}

// ─── the documented contract — no-image gates ──────────────────────────────────────

test('exportImageBase64: rejects with ExportNotReadyError and warns when no image is loaded', async () => {
    const warnings = [];
    const ctx = makeContext({
        isImageLoaded: () => false,
        options: {
            onWarning: (error, message) => warnings.push({ error, message }),
        },
    });
    let rejected;
    rejected = await exportImageBase64(ctx).then(
        () => null,
        (err) => err,
    );
    assert.ok(rejected instanceof ExportNotReadyError, 'must reject with ExportNotReadyError');
    assert.equal(warnings.length, 1, 'must emit exactly one onWarning');
    const message = warnings[0].message;
    assert.match(message, /exportImageBase64/, 'warning must name the operation');
    assert.match(message, /no image is loaded/i, 'warning must identify the missing image');
    assert.equal(warnings[0].error, null);
    assert.equal(ctx.canvas.callOrder.length, 0, 'no-image gate must skip every canvas method');
});

test('exportImageFile: rejects with ExportNotReadyError and warns when no image is loaded', async () => {
    const warnings = [];
    const ctx = makeContext({
        isImageLoaded: () => false,
        options: {
            onWarning: (error, message) => warnings.push({ error, message }),
        },
    });
    let rejected;
    rejected = await exportImageFile(ctx).then(
        () => null,
        (err) => err,
    );
    assert.ok(rejected instanceof ExportNotReadyError, 'must reject with ExportNotReadyError');
    assert.equal(warnings.length, 1, 'must emit exactly one onWarning');
    assert.match(warnings[0].message, /exportImageFile/);
    assert.equal(ctx.canvas.callOrder.length, 0);
});

test('downloadImage: returns Promise<void> and warns when no image is loaded', async () => {
    const warnings = [];
    const ctx = makeContext({
        isImageLoaded: () => false,
        options: {
            onWarning: (error, message) => warnings.push({ error, message }),
        },
    });
    const ret = downloadImage(ctx);
    assert.ok(ret instanceof Promise, 'downloadImage returns a promise');
    await ret;
    assert.equal(warnings.length, 1);
    assert.match(warnings[0].message, /downloadImage/);
    assert.equal(ctx.canvas.callOrder.length, 0, 'must touch no canvas method');
});

test('downloadImage: rejects non-object options at runtime', async () => {
    const ctx = makeContext();

    await assert.rejects(
        () => downloadImage(ctx, 'pic.jpg'),
        (error) =>
            error instanceof TypeError &&
            /expects an ImageExportOptions object/.test(error.message),
    );
});

// ─── the documented contract — discard ActiveSelection before render ───────────────

test('exportImageBase64: discards ActiveSelection before toDataURL', async () => {
    const ctx = makeContext();
    await exportImageBase64(ctx);
    const firstDiscard = ctx.canvas.callOrder.indexOf('discardActiveObject');
    const firstRender = ctx.canvas.callOrder.indexOf('toDataURL');
    assert.notEqual(firstDiscard, -1, 'must call discardActiveObject');
    assert.notEqual(firstRender, -1, 'must call toDataURL');
    assert.ok(firstDiscard < firstRender, 'discardActiveObject must precede toDataURL');
});

test('exportImageBase64: restores the active object after rendering', async () => {
    const activeObject = { type: 'activeSelection' };
    const canvas = {
        ...makeMockCanvas(),
        activeObject,
        objects: [activeObject],
        getObjects() {
            return this.objects.slice();
        },
        getActiveObject() {
            return this.activeObject;
        },
        discardActiveObject() {
            this.callOrder.push('discardActiveObject');
            this.activeObject = null;
            return this;
        },
        setActiveObject(object) {
            this.callOrder.push('setActiveObject');
            this.activeObject = object;
            return this;
        },
    };
    const ctx = makeContext({ canvas });

    await exportImageBase64(ctx);

    assert.equal(canvas.activeObject, activeObject, 'active object must be restored');
    assert.ok(
        canvas.callOrder.indexOf('setActiveObject') > canvas.callOrder.indexOf('toDataURL'),
        'selection restore must happen after rendering',
    );
});

test('exportImageBase64: suppresses public selection callbacks while discarding and restoring', async () => {
    let suppressed = false;
    const suppressionStates = [];
    const activeObject = { type: 'activeSelection' };
    const canvas = {
        ...makeMockCanvas(),
        activeObject,
        objects: [activeObject],
        getObjects() {
            return this.objects.slice();
        },
        getActiveObject() {
            return this.activeObject;
        },
        discardActiveObject() {
            suppressionStates.push(['discardActiveObject', suppressed]);
            this.callOrder.push('discardActiveObject');
            this.activeObject = null;
            return this;
        },
        setActiveObject(object) {
            suppressionStates.push(['setActiveObject', suppressed]);
            this.callOrder.push('setActiveObject');
            this.activeObject = object;
            return this;
        },
    };
    const ctx = makeContext({
        canvas,
        withSelectionChangeSuppressed: async (callback) => {
            assert.equal(suppressed, false);
            suppressed = true;
            try {
                return await callback();
            } finally {
                suppressed = false;
            }
        },
    });

    await exportImageBase64(ctx);

    assert.deepEqual(suppressionStates, [
        ['discardActiveObject', true],
        ['setActiveObject', true],
    ]);
    assert.equal(suppressed, false);
});

test('exportImageBase64: rejects browser MIME fallback for unsupported target formats', async () => {
    const canvas = makeMockCanvas('data:image/png;base64,' + Buffer.from('png').toString('base64'));
    const ctx = makeContext({ canvas });

    await assert.rejects(
        () => exportImageBase64(ctx, { fileType: 'webp' }),
        (error) =>
            error instanceof ExportError &&
            /browser encoded image\/png instead of requested image\/webp/.test(error.message),
    );
});

test('exportImageBase64: does not restore an active object removed during rendering', async () => {
    const activeObject = { type: 'rect' };
    const canvas = {
        ...makeMockCanvas(),
        activeObject,
        objects: [activeObject],
        getObjects() {
            return this.objects.slice();
        },
        getActiveObject() {
            return this.activeObject;
        },
        discardActiveObject() {
            this.callOrder.push('discardActiveObject');
            this.activeObject = null;
            return this;
        },
        setActiveObject(object) {
            this.callOrder.push('setActiveObject');
            this.activeObject = object;
            return this;
        },
        toDataURL(options) {
            this.objects = [];
            this.callOrder.push('toDataURL');
            this.toDataURLArgs.push(options);
            return 'data:image/jpeg;base64,AAAA';
        },
    };
    const ctx = makeContext({ canvas });

    await exportImageBase64(ctx);

    assert.equal(canvas.activeObject, null);
    assert.equal(canvas.callOrder.includes('setActiveObject'), false);
});

test('exportImageBase64: hides mask labels during export and restores them afterward', async () => {
    const label = {
        type: 'textbox',
        visible: true,
        set(patch) {
            Object.assign(this, patch);
        },
    };
    const mask = {
        editorObjectKind: 'mask',
        type: 'rect',
        maskId: 1,
        maskUid: 'mask-1',
        maskName: 'mask1',
        labelObject: label,
        set(patch) {
            Object.assign(this, patch);
        },
        setCoords() {},
    };
    const canvas = {
        ...makeMockCanvas(),
        objects: [mask, label],
        getObjects() {
            return this.objects;
        },
        remove(object) {
            this.callOrder.push('remove');
            const index = this.objects.indexOf(object);
            if (index >= 0) this.objects.splice(index, 1);
            return this;
        },
        add(object) {
            this.callOrder.push('add');
            this.objects.push(object);
            return this;
        },
        bringObjectToFront(object) {
            this.callOrder.push('bringObjectToFront');
            const index = this.objects.indexOf(object);
            if (index >= 0) {
                this.objects.splice(index, 1);
                this.objects.push(object);
            }
            return this;
        },
        toDataURL(options) {
            assert.equal(
                this.objects.includes(label),
                false,
                'label overlay must not be on the canvas during render',
            );
            this.callOrder.push('toDataURL');
            this.toDataURLArgs.push(options);
            return 'data:image/jpeg;base64,AAAA';
        },
    };
    const ctx = makeContext({ canvas });

    await exportImageBase64(ctx);

    assert.equal(mask.labelObject, label, 'mask label reference must be restored');
    assert.equal(canvas.objects.includes(label), true, 'label overlay must return to canvas');
    assert.equal(label.visible, true, 'label visibility must be restored');
});

test('downloadImage: discards ActiveSelection before toDataURL', async () => {
    const ctx = makeContext();
    let firstDiscard;
    let firstRender;
    const previousDocument = globalThis.document;
    const previousCreateObjectURL = URL.createObjectURL;
    const previousRevokeObjectURL = URL.revokeObjectURL;
    try {
        const dom = new JSDOM('<!doctype html><body></body>');
        const ownerDocument = dom.window.document;
        const createElement = ownerDocument.createElement.bind(ownerDocument);
        ownerDocument.createElement = (tagName, options) => {
            const element = createElement(tagName, options);
            if (String(tagName).toLowerCase() === 'a') {
                element.click = () => {};
            }
            return element;
        };
        globalThis.document = ownerDocument;
        URL.createObjectURL = () => 'blob:mock';
        URL.revokeObjectURL = () => {};
        await downloadImage(ctx, { fileName: 'pic.jpg' });
        firstDiscard = ctx.canvas.callOrder.indexOf('discardActiveObject');
        firstRender = ctx.canvas.callOrder.indexOf('toDataURL');
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
        URL.createObjectURL = previousCreateObjectURL;
        URL.revokeObjectURL = previousRevokeObjectURL;
    }
    assert.notEqual(firstDiscard, -1, 'must call discardActiveObject');
    assert.notEqual(firstRender, -1, 'must call toDataURL');
    assert.ok(firstDiscard < firstRender, 'discard must precede toDataURL');
});

// ─── the documented contract — exportImageBase64 surface ───────────────────────────

test('exportImageBase64: returns the data URL produced by canvas.toDataURL', async () => {
    const canvas = makeMockCanvas('data:image/png;base64,ZZZZ');
    const ctx = makeContext({ canvas });
    const result = await exportImageBase64(ctx, { fileType: 'png' });
    assert.equal(result, 'data:image/png;base64,ZZZZ');
    assert.equal(canvas.toDataURLArgs.length, 1);
    assert.equal(canvas.toDataURLArgs[0].format, 'png');
    // PNG drops `quality`.
    assert.equal('quality' in canvas.toDataURLArgs[0], false);
});

test('exportImageBase64: accepts `format` as an alias for `fileType`', async () => {
    const canvas = makeMockCanvas();
    const ctx = makeContext({ canvas });
    await exportImageBase64(ctx, { format: 'jpg' });
    assert.equal(canvas.toDataURLArgs[0].format, 'jpeg');
});

test('exportImageBase64: clamps quality and falls back to downsampleQuality', async () => {
    const canvas = makeMockCanvas();
    const ctx = makeContext({
        canvas,
        options: { downsampleQuality: 0.5 },
    });
    await exportImageBase64(ctx, { fileType: 'jpeg', quality: 5 });
    assert.equal(canvas.toDataURLArgs[0].quality, 1, 'quality is clamped to 1');

    canvas.toDataURLArgs.length = 0;
    await exportImageBase64(ctx, { fileType: 'jpeg' });
    assert.equal(canvas.toDataURLArgs[0].quality, 0.5, 'quality falls back to downsampleQuality');
});

test('exportImageBase64: resolves multiplier from options and editor defaults', async () => {
    const canvas = makeMockCanvas();
    const ctx = makeContext({
        canvas,
        options: { exportMultiplier: 3 },
    });
    await exportImageBase64(ctx);
    assert.equal(canvas.toDataURLArgs[0].multiplier, 3, 'falls back to exportMultiplier');

    canvas.toDataURLArgs.length = 0;
    await exportImageBase64(ctx, { multiplier: 2 });
    assert.equal(canvas.toDataURLArgs[0].multiplier, 2, 'caller multiplier wins');

    canvas.toDataURLArgs.length = 0;
    await exportImageBase64(ctx, { multiplier: 0 });
    assert.equal(
        canvas.toDataURLArgs[0].multiplier,
        3,
        'falsy/zero multiplier falls through to editor default',
    );
});

test('exportImageBase64: rejects oversized outputs before rendering', async () => {
    const canvas = makeMockCanvas();
    const ctx = makeContext({
        canvas,
        options: { maxExportPixels: 10000 },
    });

    await assert.rejects(
        () => exportImageBase64(ctx, { multiplier: 2 }),
        /maxExportPixels/,
        'oversized export must fail with a clear maxExportPixels error',
    );
    assert.equal(canvas.toDataURLArgs.length, 0, 'oversized export must not render');
});

test('exportImageBase64: rejects outputs beyond the max export dimension before rendering', async () => {
    const canvas = {
        ...makeMockCanvas(),
        width: 20000,
        height: 2500,
    };
    const ctx = makeContext({ canvas });

    await assert.rejects(
        () => exportImageBase64(ctx, { exportArea: 'canvas', fileType: 'png' }),
        /maxExportDimension/,
        'single-axis oversized export must fail with a clear maxExportDimension error',
    );
    assert.equal(canvas.toDataURLArgs.length, 0, 'oversized export must not render');
});

test('exportImageBase64: rejects empty image export regions before rendering', async () => {
    const canvas = makeMockCanvas();
    const ctx = makeContext({
        canvas,
        getOriginalImage: () =>
            makeFakeOriginalImage({ left: 200, top: 200, width: 20, height: 20 }),
    });

    await assert.rejects(
        () => exportImageBase64(ctx, { exportArea: 'image', fileType: 'png' }),
        ExportError,
    );
    assert.equal(canvas.toDataURLArgs.length, 0, 'invalid region must not render');
});

test('exportImageBase64: JPEG background falls back for transparent and invalid colors', async () => {
    const longCommaColor = `rgba(${Array.from({ length: 120 }, (_, index) => index).join(',')}, 0)`;
    for (const backgroundColor of ['transparent', 'rgb(0 0 0 / 0%)', '#ZZZZZZ', longCommaColor]) {
        await withFakeCanvasDom(async (fills) => {
            const canvas = makeMockCanvas(
                'data:image/png;base64,' + Buffer.from('png').toString('base64'),
            );
            const ctx = makeContext({
                canvas,
                options: { backgroundColor },
                getOriginalImage: () => makeFakeOriginalImage(),
            });

            const result = await exportImageBase64(ctx, { exportArea: 'image', fileType: 'jpeg' });

            assert.match(result, /^data:image\/jpeg;base64,/);
            assert.equal(fills.at(-1), '#ffffff');
        });
    }
});

test('exportImageBase64: JPEG background keeps valid canvas colors', async () => {
    await withFakeCanvasDom(async (fills) => {
        const canvas = makeMockCanvas(
            'data:image/png;base64,' + Buffer.from('png').toString('base64'),
        );
        const ctx = makeContext({
            canvas,
            options: { backgroundColor: '#ff0000' },
            getOriginalImage: () => makeFakeOriginalImage(),
        });

        await exportImageBase64(ctx, { exportArea: 'image', fileType: 'jpeg' });

        assert.equal(fills.at(-1), '#ff0000');
    });
});

test('exportImageBase64: JPEG background uses CSS.supports when available', async () => {
    const previousCss = globalThis.CSS;
    try {
        globalThis.CSS = {
            supports(property, value) {
                return property === 'color' && value === 'rebeccapurple';
            },
        };
        await withFakeCanvasDom(async (fills) => {
            const canvas = makeMockCanvas(
                'data:image/png;base64,' + Buffer.from('png').toString('base64'),
            );
            const ctx = makeContext({
                canvas,
                options: { backgroundColor: 'rebeccapurple' },
                getOriginalImage: () => makeFakeOriginalImage(),
            });

            await exportImageBase64(ctx, { exportArea: 'image', fileType: 'jpeg' });

            assert.equal(fills.at(-1), 'rebeccapurple');
        });
    } finally {
        globalThis.CSS = previousCss;
    }
});

test('exportImageBase64: JPEG background rejects CSS.supports invalid colors', async () => {
    const previousCss = globalThis.CSS;
    try {
        globalThis.CSS = {
            supports() {
                return false;
            },
        };
        await withFakeCanvasDom(async (fills) => {
            const canvas = makeMockCanvas(
                'data:image/png;base64,' + Buffer.from('png').toString('base64'),
            );
            const ctx = makeContext({
                canvas,
                options: { backgroundColor: '#ff0000' },
                getOriginalImage: () => makeFakeOriginalImage(),
            });

            await exportImageBase64(ctx, { exportArea: 'image', fileType: 'jpeg' });

            assert.equal(fills.at(-1), '#ffffff');
        });
    } finally {
        globalThis.CSS = previousCss;
    }
});

test('exportImageBase64: JPEG image-area partial-edge post-processing uses one offscreen encode', async () => {
    await withFakeCanvasDom(async (_fills, stats) => {
        const canvas = makeMockCanvas(
            'data:image/png;base64,' + Buffer.from('png').toString('base64'),
        );
        const ctx = makeContext({
            canvas,
            options: { backgroundColor: 'transparent' },
            getOriginalImage: () =>
                makeFakeOriginalImage({ left: 10.25, top: 20, width: 30, height: 40 }),
        });

        const result = await exportImageBase64(ctx, { exportArea: 'image', fileType: 'jpeg' });

        assert.match(result, /^data:image\/jpeg;base64,/);
        assert.equal(stats.canvasCount, 1);
        assert.equal(stats.getImageDataCalls, 1);
        assert.deepEqual(stats.toDataUrlTypes, ['image/jpeg']);
    });
});

test('exportImageBase64: WebP image-area edge sealing preserves WebP output', async () => {
    await withFakeCanvasDom(async () => {
        const canvas = makeMockCanvas(
            'data:image/webp;base64,' + Buffer.from('webp').toString('base64'),
        );
        const ctx = makeContext({
            canvas,
            getOriginalImage: () =>
                makeFakeOriginalImage({ left: 10.25, top: 20, width: 30, height: 40 }),
        });

        const result = await exportImageBase64(ctx, { exportArea: 'image', fileType: 'webp' });

        assert.match(result, /^data:image\/webp;base64,/);
    });
});

test('exportImageBase64: exportArea and mergeMasks are independent', async () => {
    const cases = [
        {
            options: { exportArea: 'image', mergeMasks: true, fileType: 'png' },
            hasRegion: true,
            expectedMaskVisible: true,
            expectedBaked: true,
        },
        {
            options: { exportArea: 'image', mergeMasks: false, fileType: 'png' },
            hasRegion: true,
            expectedMaskVisible: false,
            expectedBaked: false,
        },
        {
            options: { exportArea: 'canvas', mergeMasks: true, fileType: 'png' },
            hasRegion: false,
            expectedMaskVisible: true,
            expectedBaked: true,
        },
        {
            options: { exportArea: 'canvas', mergeMasks: false, fileType: 'png' },
            hasRegion: false,
            expectedMaskVisible: false,
            expectedBaked: false,
        },
    ];

    for (const testCase of cases) {
        const { canvas, mask } = makeCanvasWithMask(testCase);
        const ctx = makeContext({
            canvas,
            getOriginalImage: () => makeFakeOriginalImage(),
        });

        await exportImageBase64(ctx, testCase.options);

        const args = canvas.toDataURLArgs[0];
        assert.equal('left' in args, testCase.hasRegion);
        assert.equal('top' in args, testCase.hasRegion);
        assert.equal('width' in args, testCase.hasRegion);
        assert.equal('height' in args, testCase.hasRegion);
        assert.equal(mask.visible, true, 'mask visibility must be restored');
        assert.equal(mask.opacity, 0.5, 'mask opacity must be restored');
        assert.equal(mask.fill, '#ff0000', 'mask fill must be restored');
        assert.equal(mask.stroke, '#00ff00', 'mask stroke must be restored');
        assert.equal(mask.strokeWidth, 2, 'mask strokeWidth must be restored');
        assert.equal(mask.selectable, true, 'mask selectable must be restored');
    }
});

test('exportImageBase64: mergeMasks and mergeAnnotations independently control rendered overlays', async () => {
    const cases = [
        {
            options: { mergeMasks: true, mergeAnnotations: true },
            maskVisible: true,
            visibleAnnotation: true,
        },
        {
            options: { mergeMasks: false, mergeAnnotations: true },
            maskVisible: false,
            visibleAnnotation: true,
        },
        {
            options: { mergeMasks: true, mergeAnnotations: false },
            maskVisible: true,
            visibleAnnotation: false,
        },
        {
            options: { mergeMasks: false, mergeAnnotations: false },
            maskVisible: false,
            visibleAnnotation: false,
        },
    ];

    for (const testCase of cases) {
        const mask = makeMask();
        const visibleAnnotation = makeAnnotation({ id: 1 });
        const hiddenAnnotation = makeAnnotation({ id: 2, hidden: true });
        const session = {
            editorObjectKind: 'session',
            sessionObjectType: 'cropRect',
            visible: true,
            set(patch) {
                Object.assign(this, patch);
            },
        };
        const canvas = {
            ...makeMockCanvas(),
            objects: [mask, visibleAnnotation, hiddenAnnotation, session],
            getObjects() {
                return this.objects;
            },
            toDataURL(options) {
                assert.equal(mask.visible, testCase.maskVisible, 'mask visibility during render');
                assert.equal(
                    visibleAnnotation.visible,
                    testCase.visibleAnnotation,
                    'annotation visibility during render',
                );
                assert.equal(hiddenAnnotation.visible, false, 'hidden annotation stays hidden');
                assert.equal(session.visible, false, 'session object is never rendered');
                this.callOrder.push('toDataURL');
                this.toDataURLArgs.push(options);
                return 'data:image/png;base64,' + Buffer.from('export').toString('base64');
            },
        };
        const ctx = makeContext({
            canvas,
            getOriginalImage: () => makeFakeOriginalImage(),
        });

        await exportImageBase64(ctx, {
            exportArea: 'canvas',
            fileType: 'png',
            ...testCase.options,
        });

        assert.equal(mask.visible, true);
        assert.equal(visibleAnnotation.visible, true);
        assert.equal(hiddenAnnotation.visible, true);
        assert.equal(session.visible, true);
    }
});

test('exportImageBase64: hidden overlay backup restores undefined visible as true', async () => {
    const mask = makeMask();
    delete mask.visible;
    const annotation = makeAnnotation({ id: 1 });
    delete annotation.visible;
    const canvas = {
        ...makeMockCanvas(),
        objects: [mask, annotation],
        getObjects() {
            return this.objects;
        },
        toDataURL(options) {
            assert.equal(mask.visible, false, 'mask is hidden during render');
            assert.equal(annotation.visible, false, 'annotation is hidden during render');
            this.toDataURLArgs.push(options);
            return 'data:image/png;base64,' + Buffer.from('export').toString('base64');
        },
    };
    const ctx = makeContext({
        canvas,
        getOriginalImage: () => makeFakeOriginalImage(),
    });

    await exportImageBase64(ctx, {
        fileType: 'png',
        mergeMasks: false,
        mergeAnnotations: false,
    });

    assert.equal(mask.visible, true, 'undefined mask visibility restores to Fabric default true');
    assert.equal(
        annotation.visible,
        true,
        'undefined annotation visibility restores to Fabric default true',
    );
    assert.equal(annotation.annotationHidden, false, 'business hidden flag is not mutated');
    assert.equal(canvas.objects.length, 2, 'export does not add or remove overlays');
});
// ─── the documented contract — exportImageFile surface ─────────────────────────────

test('exportImageFile: produces a File whose name matches options.fileName', async () => {
    // Use a JPEG data URL whose MIME prefix matches the requested type so
    // the service skips the offscreen-canvas reencode path (which would
    // require jsdom to satisfy `document.createElement` + `Image`).
    const canvas = makeMockCanvas(
        'data:image/jpeg;base64,' + Buffer.from('hello').toString('base64'),
    );
    const ctx = makeContext({ canvas });
    const file = await exportImageFile(ctx, { fileName: 'snapshot.jpg', fileType: 'jpeg' });
    assert.ok(file instanceof File, 'must resolve to a File instance');
    assert.equal(file.name, 'snapshot.jpg');
    assert.equal(file.type, 'image/jpeg');
    assert.ok(file.size > 0, 'File must contain decoded bytes');
});

test('exportImageFile: resolves file extension from requested format', async () => {
    const pngCanvas = makeMockCanvas(
        'data:image/png;base64,' + Buffer.from('png').toString('base64'),
    );
    const pngCtx = makeContext({ canvas: pngCanvas });
    const pngFile = await exportImageFile(pngCtx, { fileType: 'png', fileName: 'cover' });
    assert.equal(pngFile.name, 'cover.png');
    assert.equal(pngFile.type, 'image/png');

    const jpegCanvas = makeMockCanvas(
        'data:image/jpeg;base64,' + Buffer.from('jpeg').toString('base64'),
    );
    const jpegCtx = makeContext({ canvas: jpegCanvas });
    const jpegFile = await exportImageFile(jpegCtx, {
        fileType: 'jpeg',
        fileName: 'cover.png',
    });
    assert.equal(jpegFile.name, 'cover.jpg');
    assert.equal(jpegFile.type, 'image/jpeg');
});

test('exportImageFile: sanitizes unsafe file names before creating the File', async () => {
    const canvas = makeMockCanvas('data:image/png;base64,' + Buffer.from('png').toString('base64'));
    const ctx = makeContext({ canvas });

    const file = await exportImageFile(ctx, {
        fileType: 'png',
        fileName: '../unsafe\\..\u0000report.webp',
    });

    assert.equal(file.name.includes('/'), false);
    assert.equal(file.name.includes('\\'), false);
    assert.equal(file.name.includes('\u0000'), false);
    assert.equal(file.name.includes('..'), false);
    assert.equal(file.name.endsWith('.png'), true);
});

test('exportImageFile: reencode uses the Fabric canvas ownerDocument', async () => {
    const previousDocument = globalThis.document;
    const previousImage = globalThis.Image;
    let ownerCanvasCount = 0;

    class FakeImage {
        constructor() {
            this.naturalWidth = 2;
            this.naturalHeight = 2;
            this.width = 2;
            this.height = 2;
            this.listeners = {};
        }
        addEventListener(event, handler) {
            this.listeners[event] = handler;
        }
        removeEventListener(event) {
            delete this.listeners[event];
        }
        set src(_value) {
            queueMicrotask(() => this.listeners.load?.());
        }
    }

    const ownerDocument = {
        createElement(tagName) {
            assert.equal(String(tagName).toLowerCase(), 'canvas');
            ownerCanvasCount += 1;
            return {
                width: 0,
                height: 0,
                getContext(type) {
                    assert.equal(type, '2d');
                    return {
                        drawImage() {},
                    };
                },
                toDataURL(type) {
                    return `data:${type};base64,${Buffer.from('owner-doc').toString('base64')}`;
                },
            };
        },
    };

    try {
        globalThis.Image = FakeImage;
        globalThis.document = {
            createElement() {
                throw new Error('global document must not create export canvases');
            },
        };

        const canvas = makeMockCanvas(
            'data:image/jpeg;base64,' + Buffer.from('source').toString('base64'),
        );
        canvas.getElement = () => ({ ownerDocument });
        const ctx = makeContext({ canvas });

        const file = await exportImageFile(ctx, { fileType: 'png', fileName: 'owner.png' });

        assert.equal(file.type, 'image/png');
        assert.equal(await file.text(), 'owner-doc');
        assert.equal(ownerCanvasCount, 1);
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
        if (previousImage === undefined) {
            delete globalThis.Image;
        } else {
            globalThis.Image = previousImage;
        }
    }
});

test('exportImageFile: rejects offscreen MIME fallback instead of mismatching File metadata', async () => {
    const previousDocument = globalThis.document;
    const previousImage = globalThis.Image;

    class FakeImage {
        constructor() {
            this.naturalWidth = 2;
            this.naturalHeight = 2;
            this.width = 2;
            this.height = 2;
            this.listeners = {};
        }
        addEventListener(event, handler) {
            this.listeners[event] = handler;
        }
        removeEventListener(event) {
            delete this.listeners[event];
        }
        set src(_value) {
            queueMicrotask(() => this.listeners.load?.());
        }
    }

    const ownerDocument = {
        createElement(tagName) {
            assert.equal(String(tagName).toLowerCase(), 'canvas');
            return {
                width: 0,
                height: 0,
                getContext(type) {
                    assert.equal(type, '2d');
                    return {
                        drawImage() {},
                    };
                },
                toDataURL() {
                    return `data:image/png;base64,${Buffer.from('fallback').toString('base64')}`;
                },
            };
        },
    };

    try {
        globalThis.Image = FakeImage;
        globalThis.document = ownerDocument;
        const canvas = makeMockCanvas(
            'data:image/jpeg;base64,' + Buffer.from('source').toString('base64'),
        );
        canvas.getElement = () => ({ ownerDocument });
        const ctx = makeContext({ canvas });

        await assert.rejects(
            () => exportImageFile(ctx, { fileType: 'webp', fileName: 'fallback.webp' }),
            (error) =>
                error instanceof ExportError &&
                /browser encoded image\/png instead of requested image\/webp/.test(error.message),
        );
    } finally {
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
        if (previousImage === undefined) {
            delete globalThis.Image;
        } else {
            globalThis.Image = previousImage;
        }
    }
});

test('exportImageFile: rejects empty image data URLs', async () => {
    const canvas = makeMockCanvas('data:image/jpeg;base64,');
    const ctx = makeContext({ canvas });

    await assert.rejects(
        () => exportImageFile(ctx, { fileType: 'jpeg' }),
        (error) =>
            error instanceof ExportError &&
            /decode rendered data URL/.test(error.message) &&
            /malformed or empty/.test(String(error.originalError?.message ?? '')),
    );
});

test('exportImageFile: rejects image data URLs with whitespace in base64 payload', async () => {
    const canvas = makeMockCanvas('data:image/jpeg;base64,aGVs bG8=');
    const ctx = makeContext({ canvas });

    await assert.rejects(
        () => exportImageFile(ctx, { fileType: 'jpeg' }),
        (error) =>
            error instanceof ExportError &&
            /decode rendered data URL/.test(error.message) &&
            /malformed or empty/.test(String(error.originalError?.message ?? '')),
    );
});

test('exportImageFile: wraps atob decode failures in ExportError', async () => {
    const originalAtob = globalThis.atob;
    try {
        globalThis.atob = () => {
            throw new DOMException('bad base64', 'InvalidCharacterError');
        };
        const canvas = makeMockCanvas('data:image/jpeg;base64,AAAA');
        const ctx = makeContext({ canvas });

        await assert.rejects(
            () => exportImageFile(ctx, { fileType: 'jpeg' }),
            (error) =>
                error instanceof ExportError &&
                error.originalError instanceof DOMException &&
                error.originalError.name === 'InvalidCharacterError',
        );
    } finally {
        globalThis.atob = originalAtob;
    }
});

test('exportImageFile: falls back to Buffer when global atob is unavailable', async () => {
    const originalAtob = globalThis.atob;
    try {
        globalThis.atob = undefined;
        const canvas = makeMockCanvas(
            'data:image/jpeg;base64,' + Buffer.from('no-atob').toString('base64'),
        );
        const ctx = makeContext({ canvas });
        const file = await exportImageFile(ctx, { fileType: 'jpeg' });

        assert.equal(await file.text(), 'no-atob');
    } finally {
        globalThis.atob = originalAtob;
    }
});

test('exportImageFile: falls back to defaultDownloadFileName when fileName is omitted', async () => {
    const canvas = makeMockCanvas('data:image/jpeg;base64,' + Buffer.from('hi').toString('base64'));
    const ctx = makeContext({
        canvas,
        options: { defaultDownloadFileName: 'fallback' },
    });
    const file = await exportImageFile(ctx, { fileType: 'jpeg' });
    assert.equal(file.name, 'fallback.jpg');
});

test('exportImageFile: discards ActiveSelection before toDataURL', async () => {
    const canvas = makeMockCanvas('data:image/jpeg;base64,' + Buffer.from('a').toString('base64'));
    const ctx = makeContext({ canvas });
    await exportImageFile(ctx, { fileType: 'jpeg' });
    const firstDiscard = canvas.callOrder.indexOf('discardActiveObject');
    const firstRender = canvas.callOrder.indexOf('toDataURL');
    assert.notEqual(firstDiscard, -1);
    assert.ok(firstDiscard < firstRender);
});

test('exportImageFile: forwards exportArea and mergeMasks independently', async () => {
    const { canvas, mask } = makeCanvasWithMask({
        expectedMaskVisible: false,
        expectedBaked: false,
    });
    const ctx = makeContext({
        canvas,
        getOriginalImage: () => makeFakeOriginalImage(),
    });

    const file = await exportImageFile(ctx, {
        exportArea: 'canvas',
        mergeMasks: false,
        fileType: 'jpeg',
        fileName: 'canvas.jpg',
    });

    assert.equal(file.name, 'canvas.jpg');
    assert.equal(file.type, 'image/jpeg');
    assert.equal('left' in canvas.toDataURLArgs[0], false);
    assert.equal(mask.visible, true, 'mask visibility must be restored after File export');
});

test('downloadImage rejects export failures without duplicate error reporting', async () => {
    const errors = [];
    const canvas = makeMockCanvas();
    canvas.toDataURL = () => {
        throw new Error('render failed');
    };
    const ctx = makeContext({
        canvas,
        options: {
            onError: (error, message) => errors.push({ error, message }),
        },
    });

    await suppressErrors(async () => {
        await assert.rejects(() => downloadImage(ctx, { fileName: 'pic.jpg' }), /render failed/);
    });

    assert.deepEqual(errors, []);
});

test('downloadImage appends the anchor to the canvas ownerDocument', async () => {
    const previousDocument = globalThis.document;
    const previousCreateObjectURL = URL.createObjectURL;
    const previousRevokeObjectURL = URL.revokeObjectURL;
    const previousSetTimeout = globalThis.setTimeout;
    const globalDom = new JSDOM('<!doctype html><body></body>');
    const ownerDom = new JSDOM('<!doctype html><body><canvas id="c"></canvas></body>');
    globalThis.document = globalDom.window.document;

    const ownerDocument = ownerDom.window.document;
    const canvasElement = ownerDocument.getElementById('c');
    const clicked = [];
    const objectUrls = [];
    const revokedUrls = [];
    const timers = [];
    const createElement = ownerDocument.createElement.bind(ownerDocument);
    ownerDocument.createElement = (tagName, options) => {
        const element = createElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
            element.click = () => clicked.push(element);
        }
        return element;
    };

    try {
        URL.createObjectURL = (file) => {
            objectUrls.push({ url: 'blob:owner-doc', file });
            return 'blob:owner-doc';
        };
        URL.revokeObjectURL = (url) => {
            revokedUrls.push(url);
        };
        globalThis.setTimeout = (callback, ms) => {
            const timer = {
                callback,
                ms,
                unrefCalled: false,
                unref() {
                    this.unrefCalled = true;
                },
            };
            timers.push(timer);
            return timer;
        };
        const canvas = makeMockCanvas(
            'data:image/jpeg;base64,' + Buffer.from('download').toString('base64'),
        );
        canvas.getElement = () => canvasElement;
        const ctx = makeContext({ canvas });

        await downloadImage(ctx, { fileName: 'owner-doc.jpg' });

        assert.equal(clicked.length, 1);
        assert.equal(clicked[0].ownerDocument, ownerDocument);
        assert.equal(clicked[0].download, 'owner-doc.jpg');
        assert.equal(clicked[0].href, 'blob:owner-doc');
        assert.equal(objectUrls.length, 1);
        assert.equal(objectUrls[0].file.name, 'owner-doc.jpg');
        assert.deepEqual(revokedUrls, []);
        assert.equal(timers.length, 1);
        assert.equal(timers[0].ms, 30000);
        assert.equal(timers[0].unrefCalled, true);

        timers[0].callback();
        assert.deepEqual(revokedUrls, ['blob:owner-doc']);
        assert.equal(ownerDocument.body.querySelectorAll('a').length, 0);
        assert.equal(globalThis.document.body.querySelectorAll('a').length, 0);
    } finally {
        URL.createObjectURL = previousCreateObjectURL;
        URL.revokeObjectURL = previousRevokeObjectURL;
        globalThis.setTimeout = previousSetTimeout;
        if (previousDocument === undefined) {
            delete globalThis.document;
        } else {
            globalThis.document = previousDocument;
        }
    }
});

test('downloadImage delayed URL cleanup ignores missing revokeObjectURL', async () => {
    const previousCreateObjectURL = URL.createObjectURL;
    const previousRevokeObjectURL = URL.revokeObjectURL;
    const previousSetTimeout = globalThis.setTimeout;
    const ownerDom = new JSDOM('<!doctype html><body><canvas id="c"></canvas></body>');
    const ownerDocument = ownerDom.window.document;
    const canvasElement = ownerDocument.getElementById('c');
    const timers = [];
    const createElement = ownerDocument.createElement.bind(ownerDocument);
    ownerDocument.createElement = (tagName, options) => {
        const element = createElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
            element.click = () => {};
        }
        return element;
    };

    try {
        URL.createObjectURL = () => 'blob:no-revoke';
        URL.revokeObjectURL = undefined;
        globalThis.setTimeout = (callback, ms) => {
            const timer = { callback, ms, unref() {} };
            timers.push(timer);
            return timer;
        };
        const canvas = makeMockCanvas(
            'data:image/jpeg;base64,' + Buffer.from('download').toString('base64'),
        );
        canvas.getElement = () => canvasElement;
        const ctx = makeContext({ canvas });

        await downloadImage(ctx, { fileName: 'no-revoke.jpg' });

        assert.equal(timers.length, 1);
        assert.doesNotThrow(() => timers[0].callback());
    } finally {
        URL.createObjectURL = previousCreateObjectURL;
        URL.revokeObjectURL = previousRevokeObjectURL;
        globalThis.setTimeout = previousSetTimeout;
    }
});

test('downloadImage falls back to documentElement when ownerDocument.body is unavailable', async () => {
    const previousCreateObjectURL = URL.createObjectURL;
    const previousRevokeObjectURL = URL.revokeObjectURL;
    const ownerDom = new JSDOM('<!doctype html><html><body><canvas id="c"></canvas></body></html>');
    const ownerDocument = ownerDom.window.document;
    const canvasElement = ownerDocument.getElementById('c');
    const clicked = [];
    const createElement = ownerDocument.createElement.bind(ownerDocument);
    ownerDocument.createElement = (tagName, options) => {
        const element = createElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
            element.click = () => clicked.push(element);
        }
        return element;
    };
    Object.defineProperty(ownerDocument, 'body', {
        configurable: true,
        value: null,
    });

    try {
        URL.createObjectURL = () => 'blob:owner-doc';
        URL.revokeObjectURL = () => {};
        const canvas = makeMockCanvas(
            'data:image/jpeg;base64,' + Buffer.from('download').toString('base64'),
        );
        canvas.getElement = () => canvasElement;
        const ctx = makeContext({ canvas });

        await downloadImage(ctx, { fileName: 'owner-doc.jpg' });

        assert.equal(clicked.length, 1);
        assert.equal(ownerDocument.documentElement.querySelectorAll('a').length, 0);
    } finally {
        URL.createObjectURL = previousCreateObjectURL;
        URL.revokeObjectURL = previousRevokeObjectURL;
    }
});

test('downloadImage forwards mergeMasks and mergeAnnotations to the shared Base64 export path', async () => {
    const previousCreateObjectURL = URL.createObjectURL;
    const previousRevokeObjectURL = URL.revokeObjectURL;
    const ownerDom = new JSDOM('<!doctype html><body><canvas id="c"></canvas></body>');
    const ownerDocument = ownerDom.window.document;
    const canvasElement = ownerDocument.getElementById('c');
    const clicked = [];
    const createElement = ownerDocument.createElement.bind(ownerDocument);
    ownerDocument.createElement = (tagName, options) => {
        const element = createElement(tagName, options);
        if (String(tagName).toLowerCase() === 'a') {
            element.click = () => clicked.push(element);
        }
        return element;
    };

    const mask = makeMask();
    const annotation = makeAnnotation({ id: 1 });
    const canvas = {
        ...makeMockCanvas('data:image/jpeg;base64,' + Buffer.from('download').toString('base64')),
        objects: [mask, annotation],
        getElement: () => canvasElement,
        getObjects() {
            return this.objects;
        },
        toDataURL(options) {
            assert.equal(mask.visible, false, 'mask is hidden during download render');
            assert.equal(annotation.visible, false, 'annotation is hidden during download render');
            this.callOrder.push('toDataURL');
            this.toDataURLArgs.push(options);
            return 'data:image/jpeg;base64,' + Buffer.from('download').toString('base64');
        },
    };
    const ctx = makeContext({ canvas });

    try {
        URL.createObjectURL = () => 'blob:filtered';
        URL.revokeObjectURL = () => {};
        await downloadImage(ctx, {
            fileName: 'filtered.jpg',
            mergeMasks: false,
            mergeAnnotations: false,
        });

        assert.equal(clicked.length, 1);
        assert.equal(clicked[0].download, 'filtered.jpg');
        assert.equal(mask.visible, true, 'mask visibility is restored after download render');
        assert.equal(
            annotation.visible,
            true,
            'annotation visibility is restored after download render',
        );
    } finally {
        URL.createObjectURL = previousCreateObjectURL;
        URL.revokeObjectURL = previousRevokeObjectURL;
    }
});
