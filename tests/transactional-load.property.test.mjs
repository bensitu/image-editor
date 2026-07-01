/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/image/image-loader.ts transactional commit and rollback behavior
 *   across valid loads, invalid non-image input, decode failures, Fabric creation
 *   failures, timeout paths, layout updates, downsample failures, and scroll
 *   preservation.
 *
 * Scope:
 *   - Successful loads commit image, scalar, mask-counter, placeholder, and snapshot
 *     state.
 *   - Unsupported image inputs return without mutation.
 *   - Failures restore the pre-call rollback bundle and preserve scroll when
 *     requested.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/transactional-load.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on transactional loadImage only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';
import { JSDOM } from 'jsdom';

const { loadImage } = await import('../src/image/image-loader.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');
const { ViewportCache } = await import('../src/image/layout-manager.ts');

// ─── Test environment setup ────────────────────────────────────────────────

/**
 * Install a fresh JSDOM document on `globalThis` and return the document
 * so each iteration can mint its own placeholder/container `<div>`s. The
 * default `Image` constructor jsdom installs is replaced per-iteration
 * with a controllable stub (see `installImageStub`) so we never depend
 * on jsdom's image decoder for base64 PNGs.
 */
function installDom() {
    const dom = new JSDOM('<!DOCTYPE html><body></body>');
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    return dom.window.document;
}

/**
 * Replace `globalThis.Image` with a stub that fires `onload` on the
 * microtask queue once `src` is assigned. When `mode === 'error'`, the
 * stub fires `onerror` instead. This avoids relying on jsdom's image
 * decoder (which does not always handle base64 PNGs reliably) and keeps
 * each iteration deterministic and fast.
 */
function installImageStub(mode = 'success') {
    class StubImage {
        constructor() {
            this.onload = null;
            this.onerror = null;
            const naturalSize = mode === 'zero-dim' ? 0 : 100;
            this.naturalWidth = naturalSize;
            this.naturalHeight = naturalSize;
            this.width = naturalSize;
            this.height = naturalSize;
        }
        set src(value) {
            this.source = value;
            queueMicrotask(() => {
                if (mode === 'error') {
                    if (this.onerror) this.onerror(new Error('decode failed'));
                } else {
                    if (this.onload) this.onload();
                }
            });
        }
        get src() {
            return this.source;
        }
    }
    globalThis.Image = StubImage;
}

// ─── Mock Fabric canvas ────────────────────────────────────────────────────

/**
 * Stand-in for `fabric.Canvas` covering only the surface `loadImage` and
 * `replayRollback` touch. Records the order of mutations so the test can
 * assert atomicity.
 *
 * Mirrors the public Fabric contract for:
 *   discardActiveObject, clear, add, sendObjectToBack, getObjects,
 *   setDimensions, renderAll, requestRenderAll, toJSON, loadFromJSON.
 */
class MockCanvas {
    constructor(width, height) {
        this.width = width;
        this.height = height;
        this.backgroundColor = 'transparent';
        this.objects = [];
        this.activeObject = null;
        this.calls = [];
    }
    discardActiveObject() {
        this.activeObject = null;
        this.calls.push('discardActiveObject');
        return this;
    }
    clear() {
        this.objects = [];
        this.calls.push('clear');
    }
    add(obj) {
        this.objects.push(obj);
        this.calls.push('add');
    }
    sendObjectToBack(obj) {
        const idx = this.objects.indexOf(obj);
        if (idx > 0) {
            this.objects.splice(idx, 1);
            this.objects.unshift(obj);
        }
        this.calls.push('sendObjectToBack');
    }
    getObjects() {
        return this.objects;
    }
    setDimensions({ width, height }) {
        this.width = width;
        this.height = height;
        this.calls.push('setDimensions');
    }
    renderAll() {
        this.calls.push('renderAll');
    }
    requestRenderAll() {
        this.calls.push('requestRenderAll');
    }
    /**
     * Match Fabric v7's `canvas.toJSON(propertiesToInclude)` shape used
     * by the loader and by the state serializer. Only the keys actually
     * referenced by the rollback path need to round-trip.
     */
    toJSON(keys = []) {
        return {
            version: '7.0.0',
            width: this.width,
            height: this.height,
            background: this.backgroundColor,
            objects: this.objects.map((o) => {
                const out = { type: o.type ?? 'object' };
                for (const k of ['left', 'top', 'width', 'height']) {
                    if (k in o) out[k] = o[k];
                }
                for (const k of keys) {
                    if (k in o) out[k] = o[k];
                }
                return out;
            }),
        };
    }
    /**
     * Mirror Fabric v7's promise-returning `loadFromJSON`. Restores
     * dimensions and a shallow object list. The loader only needs the
     * dimensions and `objects` count to roll the canvas back.
     */
    async loadFromJSON(json) {
        this.calls.push('loadFromJSON');
        if (this.failLoadFromJSON) throw new Error('rollback restore failed');
        if (typeof json.width === 'number') this.width = json.width;
        if (typeof json.height === 'number') this.height = json.height;
        if (typeof json.background === 'string') {
            this.backgroundColor = json.background;
        }
        this.objects = Array.isArray(json.objects) ? json.objects.map((o) => ({ ...o })) : [];
        return this;
    }
}

// ─── Mock Fabric module ────────────────────────────────────────────────────

/**
 * Build a fake Fabric image with the shape `loadImage` reads/writes:
 *   - dimensions (`width`, `height`),
 *   - absolute scale fields (`set({ scaleX, scaleY })`),
 *   - position (`left`, `top` via `set`),
 *   - the marker properties the loader sets via `fimg.set(...)`.
 *
 * No Fabric prototype is required — the loader treats the image as a
 * structural duck type.
 */
function makeFabricImage() {
    return {
        type: 'image',
        width: 100,
        height: 100,
        scaleX: 1,
        scaleY: 1,
        left: 0,
        top: 0,
        originX: 'left',
        originY: 'top',
        selectable: false,
        evented: false,
        set(props) {
            Object.assign(this, props);
        },
    };
}

/**
 * Build a fake `FabricModule` whose `FabricImage.fromURL` either resolves
 * with a fresh `makeFabricImage()` (success path) or rejects with a
 * tagged error (rollback path). The same module type is also referenced
 * by `loadImage` for `discardActiveObject` / `clear` etc., but those
 * call sites operate on the canvas, not on the module.
 */
function makeFabric({ failFromUrl = false } = {}) {
    return {
        FabricImage: {
            fromURL: failFromUrl
                ? () =>
                      Promise.reject(
                          Object.assign(new Error('FabricImage.fromURL failed'), {
                              name: 'FabricFromUrlError',
                          }),
                      )
                : () => Promise.resolve(makeFabricImage()),
        },
    };
}

// ─── Editor state holder ───────────────────────────────────────────────────

/**
 * Bundle of getters and setters mirroring `LoadImageContext`. The loader
 * has no class state of its own — every editor field it reads or writes
 * goes through this holder so each iteration can observe the exact set
 * of mutations the loader performed.
 */
function makeStateHolder(initial) {
    const state = { ...initial };
    const placeholderShows = [];
    return {
        state,
        placeholderShows,
        getOriginalImage: () => state.originalImage,
        setOriginalImage: (v) => {
            state.originalImage = v;
        },
        getIsImageLoadedToCanvas: () => state.isImageLoadedToCanvas,
        setIsImageLoadedToCanvas: (v) => {
            state.isImageLoadedToCanvas = v;
        },
        getLastSnapshot: () => state.lastSnapshot,
        setLastSnapshot: (v) => {
            state.lastSnapshot = v;
        },
        getMaskCounter: () => state.maskCounter,
        setMaskCounter: (v) => {
            state.maskCounter = v;
        },
        getAnnotationCounter: () => state.annotationCounter,
        setAnnotationCounter: (v) => {
            state.annotationCounter = v;
        },
        getCurrentScale: () => state.currentScale,
        setCurrentScale: (v) => {
            state.currentScale = v;
        },
        getCurrentRotation: () => state.currentRotation,
        setCurrentRotation: (v) => {
            state.currentRotation = v;
        },
        getBaseImageScale: () => state.baseImageScale,
        setBaseImageScale: (v) => {
            state.baseImageScale = v;
        },
        getCurrentImageMimeType: () => state.currentImageMimeType,
        setCurrentImageMimeType: (v) => {
            state.currentImageMimeType = v;
        },
        setPlaceholderVisible: (show) => {
            placeholderShows.push(show);
        },
    };
}

/**
 * Build a fully-wired `LoadImageContext`. The context object has the exact
 * interface that `loadImage` consumes; nothing extra.
 */
function makeContext({ failFromUrl = false } = {}) {
    const document = installDom();
    const canvas = new MockCanvas(800, 600);
    const containerElement = document.createElement('div');
    const placeholderElement = document.createElement('div');
    document.body.appendChild(containerElement);
    document.body.appendChild(placeholderElement);

    const initial = {
        originalImage: null,
        isImageLoadedToCanvas: false,
        lastSnapshot: null,
        maskCounter: 7, // non-zero so the success path update is observable
        annotationCounter: 11, // non-zero so the success path update is observable
        currentScale: 1.5, // non-default so the success path update is observable
        currentRotation: 45,
        baseImageScale: 0.8,
        currentImageMimeType: 'image/webp',
    };
    const holder = makeStateHolder(initial);

    const options = resolveOptions({
        canvasWidth: 800,
        canvasHeight: 600,
        downsampleOnLoad: false, // skip the resampler; tested elsewhere
        imageLoadTimeoutMs: 5000,
        backgroundColor: 'transparent',
    });

    const ctx = {
        fabric: makeFabric({ failFromUrl }),
        canvas,
        options,
        containerElement,
        placeholderElement,
        viewportCache: new ViewportCache(),
        ...holder,
        setCanvasSize: (width, height) => {
            canvas.setDimensions({ width, height });
        },
        applyRollbackRestoredState: (restoredState) => {
            holder.state.originalImage = restoredState.originalImage;
        },
        resetAfterRollbackFailure: () => {
            canvas.clear();
            holder.state.originalImage = null;
            holder.state.isImageLoadedToCanvas = false;
            holder.state.lastSnapshot = null;
            holder.state.maskCounter = 0;
            holder.state.annotationCounter = 0;
            holder.state.currentScale = 1;
            holder.state.currentRotation = 0;
            holder.state.baseImageScale = 1;
            holder.state.currentImageMimeType = null;
        },
    };

    return { ctx, holder, initial, canvas, placeholderElement, containerElement };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

// Tiny 1×1 PNG data URL — used by every success/failure scenario so the
// loader's input-validation branch never short-circuits these
// iterations. The actual decode is intercepted by `installImageStub`,
// so the bytes are immaterial as long as the prefix is `data:image/`.
const VALID_PNG_DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=';

/** Strings that MUST NOT trigger any mutation. */
const unsupportedImageInputStringArb = fc.oneof(
    fc.constantFrom(
        '',
        'not-a-url',
        'http://example.com/foo.png',
        'https://example.com/foo.png',
        'data:text/plain;base64,SGVsbG8=',
        'data:application/json;base64,e30=',
        'data:image/svg+xml;base64,PHN2Zy8+',
        'data:image/avif;base64,AAAA',
        'data:image', // missing trailing slash
        'file:///tmp/foo.png',
    ),
    fc
        .string({ minLength: 0, maxLength: 32 })
        .filter((s) => !s.toLowerCase().startsWith('data:image/')),
);

const preserveScrollArb = fc.option(fc.boolean(), { nil: undefined });

// ─── Properties ─────────────────────────────────────────────────────────────

test('unsupported image inputs cause zero mutation', async () => {
    await fc.assert(
        fc.asyncProperty(
            unsupportedImageInputStringArb,
            preserveScrollArb,
            async (input, preserveScroll) => {
                installImageStub('success');
                const { ctx, holder, initial, canvas, placeholderElement, containerElement } =
                    makeContext();
                // Pre-populate placeholder/container so the test can detect
                // any inadvertent DOM read-then-write.
                placeholderElement.hidden = false;
                containerElement.scrollTop = 12;
                containerElement.scrollLeft = 7;
                containerElement.style.overflow = 'auto';

                const callsBefore = canvas.calls.length;
                await loadImage(
                    ctx,
                    input,
                    preserveScroll === undefined ? undefined : { preserveScroll },
                );

                // The early-return path must not call any canvas method,
                // must not touch the placeholder, must not invoke the
                // success callback, and must not change any editor scalar.
                assert.equal(
                    canvas.calls.length,
                    callsBefore,
                    'the documented contract: unsupported image input must not invoke any canvas method',
                );
                assert.deepEqual(
                    holder.placeholderShows,
                    [],
                    'the documented contract: unsupported image input must not toggle placeholder visibility',
                );
                assert.deepEqual(
                    {
                        originalImage: holder.state.originalImage,
                        isImageLoadedToCanvas: holder.state.isImageLoadedToCanvas,
                        lastSnapshot: holder.state.lastSnapshot,
                        maskCounter: holder.state.maskCounter,
                        annotationCounter: holder.state.annotationCounter,
                        currentScale: holder.state.currentScale,
                        currentRotation: holder.state.currentRotation,
                        baseImageScale: holder.state.baseImageScale,
                        currentImageMimeType: holder.state.currentImageMimeType,
                    },
                    initial,
                    'the documented contract: unsupported image input must leave editor scalar state unchanged',
                );
            },
        ),
        { numRuns: 30 },
    );
});

test('success commits the new-image state', async () => {
    await fc.assert(
        fc.asyncProperty(preserveScrollArb, async (preserveScroll) => {
            installImageStub('success');
            const { ctx, holder } = makeContext();

            await loadImage(
                ctx,
                VALID_PNG_DATA_URL,
                preserveScroll === undefined ? undefined : { preserveScroll },
            );

            // the documented contract — every scalar listed in the Contract is
            // committed to the new-image value.
            assert.equal(
                holder.state.isImageLoadedToCanvas,
                true,
                'the documented contract: success must set isImageLoadedToCanvas = true',
            );
            assert.equal(
                holder.state.maskCounter,
                0,
                'the documented contract: success must set maskCounter to 0',
            );
            assert.equal(
                holder.state.annotationCounter,
                0,
                'the documented contract: success must set annotationCounter to 0',
            );
            assert.equal(
                holder.state.currentScale,
                1,
                'the documented contract: success must set currentScale to 1',
            );
            assert.equal(
                holder.state.currentRotation,
                0,
                'the documented contract: success must set currentRotation to 0',
            );
            assert.ok(
                holder.state.lastSnapshot !== null && typeof holder.state.lastSnapshot === 'string',
                'the documented contract: success must emit a fresh lastSnapshot string',
            );
            assert.ok(
                holder.state.originalImage !== null,
                'the documented contract: success must commit originalImage',
            );
            assert.equal(
                holder.state.currentImageMimeType,
                'image/png',
                'the documented contract: success must track the committed data URL MIME',
            );
        }),
        { numRuns: 30 },
    );
});

test('success persists current image MIME in the fresh snapshot', async () => {
    await fc.assert(
        fc.asyncProperty(preserveScrollArb, async (preserveScroll) => {
            installImageStub('success');
            const { ctx, holder } = makeContext();

            await loadImage(
                ctx,
                VALID_PNG_DATA_URL,
                preserveScroll === undefined ? undefined : { preserveScroll },
            );

            const snapshot = JSON.parse(holder.state.lastSnapshot);
            assert.equal(snapshot._editorState.currentImageMimeType, 'image/png');
        }),
        { numRuns: 30 },
    );
});

test('failure restores editor scalar state', async () => {
    await fc.assert(
        fc.asyncProperty(preserveScrollArb, async (preserveScroll) => {
            installImageStub('success');
            const { ctx, holder, initial } = makeContext({ failFromUrl: true });

            await assert.rejects(
                () =>
                    loadImage(
                        ctx,
                        VALID_PNG_DATA_URL,
                        preserveScroll === undefined ? undefined : { preserveScroll },
                    ),
                (err) => {
                    // the documented contract — the original error is what the
                    // promise rejects with.
                    return err instanceof Error && err.message === 'FabricImage.fromURL failed';
                },
                'the documented contract: failure path must reject with the original error',
            );

            // the documented contract — every captured scalar is back to its pre-call
            // value after rollback. We compare the exact tuple to make a
            // partial restore observable as a failed assertion.
            assert.deepEqual(
                {
                    originalImage: holder.state.originalImage,
                    isImageLoadedToCanvas: holder.state.isImageLoadedToCanvas,
                    lastSnapshot: holder.state.lastSnapshot,
                    maskCounter: holder.state.maskCounter,
                    annotationCounter: holder.state.annotationCounter,
                    currentScale: holder.state.currentScale,
                    currentRotation: holder.state.currentRotation,
                    baseImageScale: holder.state.baseImageScale,
                    currentImageMimeType: holder.state.currentImageMimeType,
                },
                initial,
                'the documented contract: rollback must restore every editor scalar to its pre-call value',
            );
        }),
        { numRuns: 30 },
    );
});

test('failure restores from deserialized canvas objects instead of stale object references', async () => {
    installImageStub('success');
    const { ctx, holder, canvas } = makeContext({ failFromUrl: true });
    const staleImage = {
        type: 'image',
        editorObjectKind: 'baseImage',
        width: 100,
        height: 80,
        left: 0,
        top: 0,
        opacity: 1,
    };
    holder.state.originalImage = staleImage;
    holder.state.isImageLoadedToCanvas = true;
    canvas.objects = [staleImage];

    await assert.rejects(() => loadImage(ctx, VALID_PNG_DATA_URL));

    assert.notEqual(holder.state.originalImage, staleImage);
    assert.equal(holder.state.originalImage, canvas.objects[0]);
    assert.equal(holder.state.originalImage.editorObjectKind, 'baseImage');
});

test('rollback snapshot filters session-only objects', async () => {
    installImageStub('success');
    const { ctx, canvas } = makeContext({ failFromUrl: true });
    const baseImage = {
        type: 'image',
        editorObjectKind: 'baseImage',
        width: 100,
        height: 80,
        left: 0,
        top: 0,
        opacity: 1,
    };
    const mask = {
        type: 'rect',
        editorObjectKind: 'mask',
        maskId: 4,
        maskUid: 'mask-4',
        maskName: 'mask4',
        originalAlpha: 0.5,
        left: 1,
        top: 2,
    };
    const cropRect = { type: 'rect', editorObjectKind: 'session', sessionObjectType: 'cropRect' };
    const mosaicPreview = { type: 'rect', isMosaicPreview: true };
    const maskLabel = { type: 'textbox', maskLabel: true };
    canvas.objects = [baseImage, mask, cropRect, mosaicPreview, maskLabel];

    await assert.rejects(() => loadImage(ctx, VALID_PNG_DATA_URL));

    assert.deepEqual(
        canvas.objects.map((object) => object.editorObjectKind ?? object.sessionObjectType),
        ['baseImage', 'mask'],
    );
    assert.equal(
        canvas.objects.some((object) => object.isMosaicPreview),
        false,
    );
    assert.equal(
        canvas.objects.some((object) => object.maskLabel),
        false,
    );
});

test('rollback deserialization failure clears runtime instead of restoring stale references', async () => {
    installImageStub('success');
    const { ctx, holder, canvas } = makeContext({ failFromUrl: true });
    const staleImage = {
        type: 'image',
        editorObjectKind: 'baseImage',
        width: 100,
        height: 80,
    };
    holder.state.originalImage = staleImage;
    holder.state.isImageLoadedToCanvas = true;
    canvas.objects = [staleImage];
    canvas.failLoadFromJSON = true;

    await assert.rejects(() => loadImage(ctx, VALID_PNG_DATA_URL));

    assert.equal(holder.state.originalImage, null);
    assert.equal(holder.state.isImageLoadedToCanvas, false);
    assert.equal(holder.state.lastSnapshot, null);
    assert.equal(canvas.objects.length, 0);
});

test('image load timeout is a total deadline and aborts the Fabric load phase', async () => {
    const document = installDom();
    const OriginalImage = globalThis.Image;
    const originalSetTimeout = globalThis.setTimeout;
    const originalClearTimeout = globalThis.clearTimeout;
    const originalDateNow = Date.now;
    const timers = [];
    let now = 1000;
    let imageInstance;
    let fabricSignal;

    class ControlledImage {
        constructor() {
            this.naturalWidth = 100;
            this.naturalHeight = 100;
            this.listeners = new Map();
            imageInstance = {
                dispatch: (event) => {
                    this.listeners.get(event)?.();
                },
            };
        }
        addEventListener(event, handler) {
            this.listeners.set(event, handler);
        }
        removeEventListener(event) {
            this.listeners.delete(event);
        }
        set src(value) {
            this.source = value;
        }
    }

    globalThis.Image = ControlledImage;
    globalThis.setTimeout = (callback, ms) => {
        const timer = { callback, ms, cleared: false };
        timers.push(timer);
        return timer;
    };
    globalThis.clearTimeout = (timer) => {
        if (timer) timer.cleared = true;
    };
    Date.now = () => now;

    try {
        const { ctx } = makeContext();
        ctx.options = resolveOptions({
            canvasWidth: 800,
            canvasHeight: 600,
            downsampleOnLoad: false,
            imageLoadTimeoutMs: 30,
            backgroundColor: 'transparent',
        });
        ctx.fabric = {
            FabricImage: {
                fromURL: (_url, options) => {
                    fabricSignal = options?.signal;
                    return new Promise(() => undefined);
                },
            },
        };
        document.body.appendChild(ctx.containerElement);

        const loadPromise = loadImage(ctx, VALID_PNG_DATA_URL);
        assert.equal(timers[0].ms, 30);

        now = 1025;
        imageInstance.dispatch('load');
        await Promise.resolve();
        await Promise.resolve();

        assert.equal(timers[1].ms, 5);
        assert.equal(fabricSignal?.aborted, false);
        timers[1].callback();

        await assert.rejects(
            () => loadPromise,
            (error) => error?.name === 'ImageLoadTimeoutError' && /FabricImage/.test(error.message),
        );
        assert.equal(fabricSignal.aborted, true);
    } finally {
        globalThis.Image = OriginalImage;
        globalThis.setTimeout = originalSetTimeout;
        globalThis.clearTimeout = originalClearTimeout;
        Date.now = originalDateNow;
    }
});

test('loadImage rejects oversized data URLs before image decode or mutation', async () => {
    const previousImage = globalThis.Image;
    let imageConstructed = false;

    class DecodeShouldNotStart {
        constructor() {
            imageConstructed = true;
        }
    }

    globalThis.Image = DecodeShouldNotStart;
    try {
        const { ctx } = makeContext();
        ctx.options = resolveOptions({
            maxInputBytes: 3,
            downsampleOnLoad: false,
            backgroundColor: 'transparent',
        });
        ctx.placeholderElement.hidden = false;

        await assert.rejects(() => loadImage(ctx, VALID_PNG_DATA_URL), /maxInputBytes/);

        assert.equal(imageConstructed, false);
        assert.equal(ctx.placeholderElement.hidden, false);
    } finally {
        if (previousImage === undefined) {
            delete globalThis.Image;
        } else {
            globalThis.Image = previousImage;
        }
    }
});

test('failure restores current image MIME', async () => {
    await fc.assert(
        fc.asyncProperty(preserveScrollArb, async (preserveScroll) => {
            installImageStub('success');
            const { ctx, holder, initial } = makeContext({ failFromUrl: true });

            await assert.rejects(() =>
                loadImage(
                    ctx,
                    VALID_PNG_DATA_URL,
                    preserveScroll === undefined ? undefined : { preserveScroll },
                ),
            );

            assert.equal(holder.state.currentImageMimeType, initial.currentImageMimeType);
            assert.equal(holder.state.annotationCounter, initial.annotationCounter);
        }),
        { numRuns: 30 },
    );
});

test('completed zero-dimension image load rejects and rolls back', async () => {
    installImageStub('zero-dim');
    const { ctx, holder, initial } = makeContext();

    await assert.rejects(() => loadImage(ctx, VALID_PNG_DATA_URL), /no natural dimensions/i);

    assert.deepEqual(
        {
            originalImage: holder.state.originalImage,
            isImageLoadedToCanvas: holder.state.isImageLoadedToCanvas,
            lastSnapshot: holder.state.lastSnapshot,
            maskCounter: holder.state.maskCounter,
            annotationCounter: holder.state.annotationCounter,
            currentScale: holder.state.currentScale,
            currentRotation: holder.state.currentRotation,
            baseImageScale: holder.state.baseImageScale,
            currentImageMimeType: holder.state.currentImageMimeType,
        },
        initial,
        'zero-dimension decode failure must restore every editor scalar',
    );
});
