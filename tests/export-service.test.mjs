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
 *   - No-image calls warn and either return an empty string or throw
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
        defaultDownloadFileName: 'edited_image.jpg',
        downsampleQuality: 0.92,
        exportMultiplier: 1,
        maxExportPixels: 50000000,
        exportAreaByDefault: 'image',
        mergeMaskByDefault: true,
        backgroundColor: 'transparent',
        ...(overrides.options ?? {}),
    };
    return {
        canvas,
        options,
        fabric: overrides.fabric ?? {},
        isImageLoaded: overrides.isImageLoaded ?? (() => true),
        getOriginalImage: overrides.getOriginalImage ?? (() => null),
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
        type: 'rect',
        maskId: 1,
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

function makeCanvasWithMask({ expectedMaskVisible, expectedBaked }) {
    const mask = makeMask();
    const canvas = {
        ...makeMockCanvas('data:image/jpeg;base64,' + Buffer.from('export').toString('base64')),
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
            return 'data:image/jpeg;base64,' + Buffer.from('export').toString('base64');
        },
    };
    return { canvas, mask };
}

/** Replace `console.warn` for the duration of `fn` and return captured calls. */
async function captureWarnings(fn) {
    const original = console.warn;
    const warnings = [];
    console.warn = (...args) => warnings.push(args);
    try {
        await fn();
    } finally {
        console.warn = original;
    }
    return warnings;
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
                const accepted = new Set(['#000001', '#000002', '#ffffff', '#ff0000']);
                if (accepted.has(raw)) fillStyle = raw;
            },
            fillRect() {
                fills.push(fillStyle);
            },
            drawImage() {},
            getImageData() {
                return { data: new Uint8ClampedArray(2 * 2 * 4) };
            },
            putImageData() {},
        };
    }

    globalThis.Image = FakeImage;
    globalThis.document = {
        createElement(tag) {
            assert.equal(String(tag).toLowerCase(), 'canvas');
            return {
                width: 0,
                height: 0,
                getContext(type) {
                    assert.equal(type, '2d');
                    return createContext();
                },
                toDataURL(type) {
                    return `data:${type};base64,${Buffer.from('jpeg').toString('base64')}`;
                },
            };
        },
    };

    try {
        await fn(fills);
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

test('exportImageBase64: resolves to "" and warns when no image is loaded', async () => {
    const ctx = makeContext({ isImageLoaded: () => false });
    let result;
    const warnings = await captureWarnings(async () => {
        result = await exportImageBase64(ctx);
    });
    assert.equal(result, '', 'must resolve to an empty string');
    assert.equal(warnings.length, 1, 'must emit exactly one console.warn');
    const message = String(warnings[0][0] ?? '');
    assert.match(message, /exportImageBase64/, 'warning must name the operation');
    assert.match(message, /no image is loaded/i, 'warning must identify the missing image');
    assert.equal(ctx.canvas.callOrder.length, 0, 'no-image gate must skip every canvas method');
});

test('exportImageFile: rejects with ExportNotReadyError and warns when no image is loaded', async () => {
    const ctx = makeContext({ isImageLoaded: () => false });
    let rejected;
    const warnings = await captureWarnings(async () => {
        rejected = await exportImageFile(ctx).then(
            () => null,
            (err) => err,
        );
    });
    assert.ok(rejected instanceof ExportNotReadyError, 'must reject with ExportNotReadyError');
    assert.equal(warnings.length, 1, 'must emit exactly one console.warn');
    assert.match(String(warnings[0][0] ?? ''), /exportImageFile/);
    assert.equal(ctx.canvas.callOrder.length, 0);
});

test('downloadImage: returns void and warns when no image is loaded', async () => {
    const ctx = makeContext({ isImageLoaded: () => false });
    const warnings = await captureWarnings(async () => {
        const ret = downloadImage(ctx);
        assert.equal(ret, undefined, 'downloadImage returns void');
    });
    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][0] ?? ''), /downloadImage/);
    assert.equal(ctx.canvas.callOrder.length, 0, 'must touch no canvas method');
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

test('exportImageBase64: hides mask labels during export and restores them afterward', async () => {
    const label = {
        type: 'textbox',
        visible: true,
        set(patch) {
            Object.assign(this, patch);
        },
    };
    const mask = {
        type: 'rect',
        maskId: 1,
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
    // The DOM wiring (document.createElement('a'), appendChild, …) is
    // outside the scope of the documented contract and not available under node:test.
    // Suppress the resulting `console.error` from the internal catch
    // handler so the assertion noise stays focused on the call order.
    await suppressErrors(async () => {
        // downloadImage is fire-and-forget; yield to the microtask queue
        // so the awaited `exportImageBase64` inside `downloadImage`
        // completes before we read `callOrder`.
        downloadImage(ctx, 'pic.jpg');
        await new Promise((resolve) => setImmediate(resolve));
        firstDiscard = ctx.canvas.callOrder.indexOf('discardActiveObject');
        firstRender = ctx.canvas.callOrder.indexOf('toDataURL');
    });
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
    for (const backgroundColor of ['transparent', 'rgb(0 0 0 / 0%)', '#ZZZZZZ']) {
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

test('exportImageBase64: exportArea and mergeMask are independent', async () => {
    const cases = [
        {
            options: { exportArea: 'image', mergeMask: true, fileType: 'png' },
            hasRegion: true,
            expectedMaskVisible: true,
            expectedBaked: true,
        },
        {
            options: { exportArea: 'image', mergeMask: false, fileType: 'png' },
            hasRegion: true,
            expectedMaskVisible: false,
            expectedBaked: false,
        },
        {
            options: { exportArea: 'canvas', mergeMask: true, fileType: 'png' },
            hasRegion: false,
            expectedMaskVisible: true,
            expectedBaked: true,
        },
        {
            options: { exportArea: 'canvas', mergeMask: false, fileType: 'png' },
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
        options: { defaultDownloadFileName: 'fallback.jpg' },
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

test('exportImageFile: forwards exportArea and mergeMask independently', async () => {
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
        mergeMask: false,
        fileType: 'jpeg',
        fileName: 'canvas.jpg',
    });

    assert.equal(file.name, 'canvas.jpg');
    assert.equal(file.type, 'image/jpeg');
    assert.equal('left' in canvas.toDataURLArgs[0], false);
    assert.equal(mask.visible, true, 'mask visibility must be restored after File export');
});

test('downloadImage reports asynchronous export failures through onError', async () => {
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
        downloadImage(ctx, 'pic.jpg');
        await new Promise((resolve) => setImmediate(resolve));
    });

    assert.equal(errors.length, 1);
    assert.match(errors[0].message, /downloadImage failed/);
    assert.match(String(errors[0].error?.message ?? ''), /render failed/);
});
