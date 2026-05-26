// Task 18.2 — base/file/download in
// `src/export/export-service.ts`.
//
// Scope of this test:
//
//   23.2  Every export entry point SHALL discard any active Fabric
//         `ActiveSelection` before computing the export region.
//   25.1  `exportImageBase64` resolves to a `Promise<string>`.
//   25.2  `exportImageFile` resolves to a `Promise<File>` whose name uses
//         `options.fileName` or the editor's `defaultDownloadFileName`.
//   25.3  `downloadImage` triggers a browser download with the resolved
//         filename and returns `void`.
//   25.4  When `isImageLoaded()` is `false`:
//           - `exportImageBase64` resolves to `''`
//           - `exportImageFile`   rejects with `ExportNotReadyError`
//           - `downloadImage`     is a no-op
//         and each path emits a single `console.warn` naming the missing
//         image.
//
// ─── Why a canvas mock instead of a live Fabric.Canvas ──────────────────────
//
// The export service interacts with the canvas through exactly two
// methods relevant to this task:
//
//   discardActiveObject()  — the Req 23.2 call site
//   toDataURL(options)      — the rendering step
//
// Both are easy to instrument with a small mock; spinning up a real
// Fabric canvas would add jsdom plumbing without exercising any new
// branch inside the service. The same approach is used by
// `tests/active-selection-discard.property.test.mjs`.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';

const { exportImageBase64, exportImageFile, downloadImage } = await import(
    '../src/export/export-service.ts'
);
const { ExportNotReadyError } = await import('../src/core/errors.ts');

// ─── Test doubles ───────────────────────────────────────────────────────────

/**
 * Minimal stand-in for `fabric.Canvas`. Records the order of method
 * calls so the test can assert that `discardActiveObject` precedes
 * `toDataURL` per Requirement 23.2.
 */
function makeMockCanvas(stubDataUrl = 'data:image/jpeg;base64,AAAA') {
    const callOrder = [];
    const toDataURLArgs = [];
    return {
        callOrder,
        toDataURLArgs,
        // The bake-in/restore bracket (Task 18.4) reads `getObjects()`
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
    };
}

function makeContext(overrides = {}) {
    const canvas = overrides.canvas ?? makeMockCanvas();
    const options = {
        defaultDownloadFileName: 'edited_image.jpg',
        downsampleQuality: 0.92,
        exportMultiplier: 1,
        exportImageAreaByDefault: true,
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

// ─── Requirement 25.4 — no-image gates ──────────────────────────────────────

test('exportImageBase64: resolves to "" and warns when no image is loaded (Req 25.4)', async () => {
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
    assert.equal(
        ctx.canvas.callOrder.length,
        0,
        'no-image gate must skip every canvas method',
    );
});

test('exportImageFile: rejects with ExportNotReadyError and warns when no image is loaded (Req 25.4)', async () => {
    const ctx = makeContext({ isImageLoaded: () => false });
    let rejected;
    const warnings = await captureWarnings(async () => {
        rejected = await exportImageFile(ctx).then(
            () => null,
            (err) => err,
        );
    });
    assert.ok(
        rejected instanceof ExportNotReadyError,
        'must reject with ExportNotReadyError',
    );
    assert.equal(warnings.length, 1, 'must emit exactly one console.warn');
    assert.match(String(warnings[0][0] ?? ''), /exportImageFile/);
    assert.equal(ctx.canvas.callOrder.length, 0);
});

test('downloadImage: returns void and warns when no image is loaded (Req 25.4)', async () => {
    const ctx = makeContext({ isImageLoaded: () => false });
    const warnings = await captureWarnings(async () => {
        const ret = downloadImage(ctx);
        assert.equal(ret, undefined, 'downloadImage returns void');
    });
    assert.equal(warnings.length, 1);
    assert.match(String(warnings[0][0] ?? ''), /downloadImage/);
    assert.equal(ctx.canvas.callOrder.length, 0, 'must touch no canvas method');
});

// ─── Requirement 23.2 — discard ActiveSelection before render ───────────────

test('exportImageBase64: discards ActiveSelection before toDataURL (Req 23.2)', async () => {
    const ctx = makeContext();
    await exportImageBase64(ctx);
    const firstDiscard = ctx.canvas.callOrder.indexOf('discardActiveObject');
    const firstRender = ctx.canvas.callOrder.indexOf('toDataURL');
    assert.notEqual(firstDiscard, -1, 'must call discardActiveObject');
    assert.notEqual(firstRender, -1, 'must call toDataURL');
    assert.ok(
        firstDiscard < firstRender,
        'discardActiveObject must precede toDataURL',
    );
});

test('downloadImage: discards ActiveSelection before toDataURL (Req 23.2)', async () => {
    const ctx = makeContext();
    let firstDiscard;
    let firstRender;
    // The DOM wiring (document.createElement('a'), appendChild, …) is
    // outside the scope of Req 23.2 and not available under node:test.
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

// ─── Requirement 25.1 — exportImageBase64 surface ───────────────────────────

test('exportImageBase64: returns the data URL produced by canvas.toDataURL (Req 25.1)', async () => {
    const canvas = makeMockCanvas('data:image/png;base64,ZZZZ');
    const ctx = makeContext({ canvas });
    const result = await exportImageBase64(ctx, { fileType: 'png' });
    assert.equal(result, 'data:image/png;base64,ZZZZ');
    assert.equal(canvas.toDataURLArgs.length, 1);
    assert.equal(canvas.toDataURLArgs[0].format, 'png');
    // PNG drops `quality` (Requirement 26.3).
    assert.equal('quality' in canvas.toDataURLArgs[0], false);
});

test('exportImageBase64: accepts `format` as an alias for `fileType` (Req 26.1, 25.1)', async () => {
    const canvas = makeMockCanvas();
    const ctx = makeContext({ canvas });
    await exportImageBase64(ctx, { format: 'jpg' });
    assert.equal(canvas.toDataURLArgs[0].format, 'jpeg');
});

test('exportImageBase64: clamps quality and falls back to downsampleQuality (Req 26.2, 26.4)', async () => {
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

// ─── Requirement 25.2 — exportImageFile surface ─────────────────────────────

test('exportImageFile: produces a File whose name matches options.fileName (Req 25.2)', async () => {
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

test('exportImageFile: falls back to defaultDownloadFileName when fileName is omitted (Req 25.2)', async () => {
    const canvas = makeMockCanvas(
        'data:image/jpeg;base64,' + Buffer.from('hi').toString('base64'),
    );
    const ctx = makeContext({
        canvas,
        options: { defaultDownloadFileName: 'fallback.jpg' },
    });
    const file = await exportImageFile(ctx, { fileType: 'jpeg' });
    assert.equal(file.name, 'fallback.jpg');
});

test('exportImageFile: discards ActiveSelection before toDataURL (Req 23.2)', async () => {
    const canvas = makeMockCanvas(
        'data:image/jpeg;base64,' + Buffer.from('a').toString('base64'),
    );
    const ctx = makeContext({ canvas });
    await exportImageFile(ctx, { fileType: 'jpeg' });
    const firstDiscard = canvas.callOrder.indexOf('discardActiveObject');
    const firstRender = canvas.callOrder.indexOf('toDataURL');
    assert.notEqual(firstDiscard, -1);
    assert.ok(firstDiscard < firstRender);
});
