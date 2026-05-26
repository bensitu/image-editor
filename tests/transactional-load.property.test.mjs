// Property 2: Transactional loadImage
//
// Property statement (design.md §"Property 2"):
//   For any editor state `S` and any invocation of `loadImage(imageBase64,
//   options)`, the post-call observable state SHALL be either the fully
//   committed new-image state or the pre-call state `S`. Invalid
//   non-image data URLs SHALL return early without mutation; decode,
//   Fabric creation, timeout, layout, and downsample failures SHALL
//   restore the rollback bundle and reject with the original failure.
//   When `preserveScroll` is true, the container scroll position SHALL be
//   preserved across both successful load and rollback paths.
//
// Owner module under test: `src/image/image-loader.ts`.
//
// ─── Scope of this test ─────────────────────────────────────────────────────
//
// `loadImage` integrates Fabric.js, an `<img>` decode, the resampler, the
// layout manager, the visibility helper, and the state serializer. This
// property test isolates the loader by injecting:
//
//   - a `fabric` stub whose `FabricImage.fromURL` is a deterministic
//     in-memory factory or a controlled rejection (Property 2 mocking
//     guidance, design.md §"Test Strategy"),
//   - a `MockCanvas` that records all the loader's mutations and supports
//     `toJSON` / `loadFromJSON` round-trips so the rollback path is
//     observable,
//   - a stubbed `globalThis.Image` whose `src` setter fires `onload` on a
//     microtask (or `onerror` when the test asks for a decode failure),
//     so iterations finish quickly and deterministically and never rely
//     on jsdom's incomplete image decoder for base64 PNGs.
//
// The properties exercised here are the four sub-properties named in the
// task spec for 13.6, plus the early-return invariant for non-data:image
// strings:
//
//   1. Non-data:image strings: zero mutation                  (Req 6.5)
//   2. Success: editor scalar state committed                 (Req 6.4)
//   3. Success: onImageLoaded fires exactly once              (Req 5.1)
//   4. Failure: editor state matches pre-call state (rollback)(Req 6.5)
//   5. Failure: onImageLoaded does NOT fire                   (Req 5.3)
//
// Runtime note: Node 24+ strips TypeScript syntax natively, so this test
// imports the module under test directly from source via the shared
// `ts-resolve-hook`. No build step is required.

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
            this.naturalWidth = 100;
            this.naturalHeight = 100;
            this.width = 100;
            this.height = 100;
        }
        set src(value) {
            this._src = value;
            queueMicrotask(() => {
                if (mode === 'error') {
                    if (this.onerror) this.onerror(new Error('decode failed'));
                } else {
                    if (this.onload) this.onload();
                }
            });
        }
        get src() {
            return this._src;
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
            objects: this.objects.map(o => {
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
        if (typeof json.width === 'number') this.width = json.width;
        if (typeof json.height === 'number') this.height = json.height;
        if (typeof json.background === 'string') {
            this.backgroundColor = json.background;
        }
        this.objects = Array.isArray(json.objects)
            ? json.objects.map(o => ({ ...o }))
            : [];
        return this;
    }
}

// ─── Mock Fabric module ────────────────────────────────────────────────────

/**
 * Build a fake Fabric image with the shape `loadImage` reads/writes:
 *   - dimensions (`width`, `height`),
 *   - scale (via `scale(s)` and `set({ scaleX, scaleY })`),
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
        scale(s) {
            this.scaleX = s;
            this.scaleY = s;
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
        setOriginalImage: v => {
            state.originalImage = v;
        },
        getIsImageLoadedToCanvas: () => state.isImageLoadedToCanvas,
        setIsImageLoadedToCanvas: v => {
            state.isImageLoadedToCanvas = v;
        },
        getLastSnapshot: () => state.lastSnapshot,
        setLastSnapshot: v => {
            state.lastSnapshot = v;
        },
        getMaskCounter: () => state.maskCounter,
        setMaskCounter: v => {
            state.maskCounter = v;
        },
        getCurrentScale: () => state.currentScale,
        setCurrentScale: v => {
            state.currentScale = v;
        },
        getCurrentRotation: () => state.currentRotation,
        setCurrentRotation: v => {
            state.currentRotation = v;
        },
        getBaseImageScale: () => state.baseImageScale,
        setBaseImageScale: v => {
            state.baseImageScale = v;
        },
        setPlaceholderVisible: show => {
            placeholderShows.push(show);
        },
    };
}

/**
 * Build a fully-wired `LoadImageContext` plus a counter for
 * `onImageLoaded` invocations. The context object has the exact
 * interface that `loadImage` consumes; nothing extra.
 */
function makeContext({ failFromUrl = false, onImageLoaded } = {}) {
    const document = installDom();
    const canvas = new MockCanvas(800, 600);
    const containerEl = document.createElement('div');
    const placeholderEl = document.createElement('div');
    document.body.appendChild(containerEl);
    document.body.appendChild(placeholderEl);

    const initial = {
        originalImage: null,
        isImageLoadedToCanvas: false,
        lastSnapshot: null,
        maskCounter: 7, // non-zero so the success path's reset is observable
        currentScale: 1.5, // non-default so the success path's reset is observable
        currentRotation: 45,
        baseImageScale: 0.8,
    };
    const holder = makeStateHolder(initial);

    const options = resolveOptions({
        canvasWidth: 800,
        canvasHeight: 600,
        downsampleOnLoad: false, // skip the resampler; tested elsewhere
        imageLoadTimeoutMs: 5000,
        backgroundColor: 'transparent',
        onImageLoaded: typeof onImageLoaded === 'function' ? onImageLoaded : undefined,
    });

    const ctx = {
        fabric: makeFabric({ failFromUrl }),
        canvas,
        options,
        containerEl,
        placeholderEl,
        viewportCache: new ViewportCache(),
        ...holder,
    };

    return { ctx, holder, initial, canvas, placeholderEl, containerEl };
}

// ─── Arbitraries ────────────────────────────────────────────────────────────

// Tiny 1×1 PNG data URL — used by every success/failure scenario so the
// loader's input-validation branch (Req 6.1) never short-circuits these
// iterations. The actual decode is intercepted by `installImageStub`,
// so the bytes are immaterial as long as the prefix is `data:image/`.
const VALID_PNG_DATA_URL =
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgAAIAAAUAAeImBZsAAAAASUVORK5CYII=';

/** Strings that MUST NOT trigger any mutation (Requirement 6.1). */
const nonDataImageStringArb = fc.oneof(
    fc.constantFrom(
        '',
        'not-a-url',
        'http://example.com/foo.png',
        'https://example.com/foo.png',
        'data:text/plain;base64,SGVsbG8=',
        'data:application/json;base64,e30=',
        'data:image', // missing trailing slash
        'DATA:IMAGE/PNG;base64,xxx', // case-sensitive prefix per Req 6.1
        'file:///tmp/foo.png',
    ),
    fc.string({ minLength: 0, maxLength: 32 }).filter(
        s => !s.startsWith('data:image/'),
    ),
);

const preserveScrollArb = fc.option(fc.boolean(), { nil: undefined });

// ─── Properties ─────────────────────────────────────────────────────────────

test('Property 2.1: non-data:image strings cause zero mutation (Req 6.5)', async () => {
    await fc.assert(
        fc.asyncProperty(
            nonDataImageStringArb,
            preserveScrollArb,
            async (input, preserveScroll) => {
                installImageStub('success');
                const { ctx, holder, initial, canvas, placeholderEl, containerEl } =
                    makeContext();
                // Pre-populate placeholder/container so the test can detect
                // any inadvertent DOM read-then-write.
                placeholderEl.hidden = false;
                containerEl.scrollTop = 12;
                containerEl.scrollLeft = 7;
                containerEl.style.overflow = 'auto';

                let onImageLoadedCalls = 0;
                ctx.options.onImageLoaded = () => {
                    onImageLoadedCalls++;
                };

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
                    'Req 6.5: non-data:image input must not invoke any canvas method',
                );
                assert.deepEqual(
                    holder.placeholderShows,
                    [],
                    'Req 6.5: non-data:image input must not toggle placeholder visibility',
                );
                assert.equal(
                    onImageLoadedCalls,
                    0,
                    'Req 6.5: non-data:image input must not fire onImageLoaded',
                );
                assert.deepEqual(
                    {
                        originalImage: holder.state.originalImage,
                        isImageLoadedToCanvas: holder.state.isImageLoadedToCanvas,
                        lastSnapshot: holder.state.lastSnapshot,
                        maskCounter: holder.state.maskCounter,
                        currentScale: holder.state.currentScale,
                        currentRotation: holder.state.currentRotation,
                        baseImageScale: holder.state.baseImageScale,
                    },
                    initial,
                    'Req 6.5: non-data:image input must leave editor scalar state unchanged',
                );
            },
        ),
        { numRuns: 30 },
    );
});

test('Property 2.2: success commits the new-image state (Req 6.4)', async () => {
    await fc.assert(
        fc.asyncProperty(preserveScrollArb, async preserveScroll => {
            installImageStub('success');
            const { ctx, holder } = makeContext();

            await loadImage(
                ctx,
                VALID_PNG_DATA_URL,
                preserveScroll === undefined ? undefined : { preserveScroll },
            );

            // Req 6.4 — every scalar listed in the requirement is
            // committed to the new-image value.
            assert.equal(
                holder.state.isImageLoadedToCanvas,
                true,
                'Req 6.4: success must set isImageLoadedToCanvas = true',
            );
            assert.equal(
                holder.state.maskCounter,
                0,
                'Req 6.4: success must reset maskCounter to 0',
            );
            assert.equal(
                holder.state.currentScale,
                1,
                'Req 6.4: success must reset currentScale to 1',
            );
            assert.equal(
                holder.state.currentRotation,
                0,
                'Req 6.4: success must reset currentRotation to 0',
            );
            assert.ok(
                holder.state.lastSnapshot !== null &&
                    typeof holder.state.lastSnapshot === 'string',
                'Req 6.4: success must emit a fresh _lastSnapshot string',
            );
            assert.ok(
                holder.state.originalImage !== null,
                'Req 6.4: success must commit originalImage',
            );
        }),
        { numRuns: 30 },
    );
});

test('Property 2.3: success fires onImageLoaded exactly once (Req 5.1)', async () => {
    await fc.assert(
        fc.asyncProperty(preserveScrollArb, async preserveScroll => {
            installImageStub('success');
            let onImageLoadedCalls = 0;
            const { ctx } = makeContext({
                onImageLoaded: () => {
                    onImageLoadedCalls++;
                },
            });

            await loadImage(
                ctx,
                VALID_PNG_DATA_URL,
                preserveScroll === undefined ? undefined : { preserveScroll },
            );

            assert.equal(
                onImageLoadedCalls,
                1,
                'Req 5.1: onImageLoaded must fire exactly once on success',
            );
        }),
        { numRuns: 30 },
    );
});

test('Property 2.4: failure restores editor scalar state (Req 6.5)', async () => {
    await fc.assert(
        fc.asyncProperty(preserveScrollArb, async preserveScroll => {
            installImageStub('success');
            const { ctx, holder, initial } = makeContext({ failFromUrl: true });

            await assert.rejects(
                () =>
                    loadImage(
                        ctx,
                        VALID_PNG_DATA_URL,
                        preserveScroll === undefined ? undefined : { preserveScroll },
                    ),
                err => {
                    // Requirement 6.3 — the original error is what the
                    // promise rejects with.
                    return (
                        err instanceof Error &&
                        err.message === 'FabricImage.fromURL failed'
                    );
                },
                'Req 6.3: failure path must reject with the original error',
            );

            // Req 6.5 — every captured scalar is back to its pre-call
            // value after rollback. We compare the exact tuple to make a
            // partial restore observable as a failed assertion.
            assert.deepEqual(
                {
                    originalImage: holder.state.originalImage,
                    isImageLoadedToCanvas: holder.state.isImageLoadedToCanvas,
                    lastSnapshot: holder.state.lastSnapshot,
                    maskCounter: holder.state.maskCounter,
                    currentScale: holder.state.currentScale,
                    currentRotation: holder.state.currentRotation,
                    baseImageScale: holder.state.baseImageScale,
                },
                initial,
                'Req 6.5: rollback must restore every editor scalar to its pre-call value',
            );
        }),
        { numRuns: 30 },
    );
});

test('Property 2.5: failure does NOT fire onImageLoaded (Req 5.3)', async () => {
    await fc.assert(
        fc.asyncProperty(preserveScrollArb, async preserveScroll => {
            installImageStub('success');
            let onImageLoadedCalls = 0;
            const { ctx } = makeContext({
                failFromUrl: true,
                onImageLoaded: () => {
                    onImageLoadedCalls++;
                },
            });

            await assert.rejects(() =>
                loadImage(
                    ctx,
                    VALID_PNG_DATA_URL,
                    preserveScroll === undefined ? undefined : { preserveScroll },
                ),
            );

            assert.equal(
                onImageLoadedCalls,
                0,
                'Req 5.3: onImageLoaded must not fire on rollback',
            );
        }),
        { numRuns: 30 },
    );
});
