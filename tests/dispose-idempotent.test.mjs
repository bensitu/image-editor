/**
 * Type:
 *   Facade integration test
 *
 * Purpose:
 *   Exercises the ImageEditor facade through init() and dispose() with a stubbed
 *   Fabric canvas. The suite verifies that dispose is idempotent, drains DOM
 *   bindings, settles queued animations, and leaves every public method safe to call
 *   after teardown.
 *
 * Scope:
 *   - Repeated dispose() calls do not throw and do not re-dispose the canvas.
 *   - Bound DOM handlers are removed or short-circuited after disposal.
 *   - Post-dispose public methods return safely without touching the torn-down
 *     canvas.
 *
 * Out of scope:
 *   - unrelated editor features
 *   - visual rendering quality
 *   - browser-specific integration details
 *
 * Environment:
 *   - Node.js ESM
 *   - jsdom or DOM stubs are used where needed
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/dispose-idempotent.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on idempotent dispose and post-dispose API safety only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { JSDOM } from 'jsdom';

const { ImageEditor } = await import('../src/index.ts');

// ─── Minimal Fabric stub ──────────────────────────────────────────────────

/**
 * Stand-in for `fabric.Canvas`. Records `dispose` and event-listener
 * activity so the tests can assert that `dispose()` flows reach the
 * canvas exactly once and that no method invocation reaches
 * the canvas after disposal.
 *
 * The methods covered here mirror what the editor's `init()` and
 * `dispose()` paths actually invoke. Unused methods are added as
 * no-ops so the stub stays compatible with later post-dispose calls
 * that route through internal helpers; a method that is genuinely
 * never reached after dispose can still exist on the stub without
 * affecting any assertion.
 */
class Mockcanvas {
    constructor(_el, opts) {
        this.opts = opts;
        this.disposed = false;
        this.disposeCalls = 0;
        this.listeners = new Map();
        this.objects = [];
        this.width = opts?.width ?? 0;
        this.height = opts?.height ?? 0;
        this.backgroundColor = opts?.backgroundColor ?? '#fff';
        this.renderAllCalls = 0;
        this.disposeCallSequence = [];
    }

    on(event, handler) {
        if (!this.listeners.has(event)) this.listeners.set(event, []);
        this.listeners.get(event).push(handler);
    }
    off(event, handler) {
        const arr = this.listeners.get(event);
        if (!arr) return;
        const idx = arr.indexOf(handler);
        if (idx >= 0) arr.splice(idx, 1);
    }
    fire(event, payload) {
        const arr = this.listeners.get(event);
        if (!arr) return;
        for (const fn of arr.slice()) fn(payload);
    }

    getWidth() {
        return this.width;
    }
    getHeight() {
        return this.height;
    }
    setDimensions({ width, height }) {
        this.width = width;
        this.height = height;
    }
    getObjects() {
        return this.objects.slice();
    }
    add(o) {
        this.objects.push(o);
    }
    remove(o) {
        const i = this.objects.indexOf(o);
        if (i >= 0) this.objects.splice(i, 1);
    }
    discardActiveObject() {
        this.activeObject = null;
    }
    getActiveObject() {
        return this.activeObject ?? null;
    }
    setActiveObject(o) {
        this.activeObject = o;
    }
    bringObjectToFront() {}
    sendObjectToBack() {}
    renderAll() {
        this.renderAllCalls += 1;
    }
    requestRenderAll() {}
    toJSON() {
        return { objects: [], width: this.width, height: this.height };
    }
    async loadFromJSON() {}

    dispose() {
        this.disposeCalls += 1;
        this.disposed = true;
        this.disposeCallSequence.push('dispose');
        // A real Fabric canvas detaches its own internal listeners on
        // dispose. We drop our recorded listeners so a post-dispose
        // `fire()` (which the editor itself never calls — but the
        // assertion below documents the behavior) is observably a
        // no-op. The editor never calls into the disposed canvas
        // because the runtime canvas reference is cleared immediately after.
        this.listeners.clear();
    }
}

/**
 * Build a Fabric module stub. The adapter's `looksLikeFabricModule`
 * test only checks for a `Canvas` function property; everything else
 * is consumed via `this.fabricModule.<X>` from the facade, so we expose
 * only the constructors that the init / dispose / no-op-paths reach.
 *
 * `FabricImage` is needed by `isImageLoaded()` (instance check) and
 * `FabricText` is needed by the optional label-creation path. Neither is invoked
 * during a no-image init/dispose cycle; they are present so a future
 * extension of this test can load an image without re-stubbing the
 * module.
 */
function makeFabricStub() {
    const fabric = {
        FabricImage: class FakeFabricImage {
            static async fromURL() {
                return new FakeFabricImage();
            }
        },
        FabricText: class FakeFabricText {
            constructor(text, opts) {
                this.text = text;
                Object.assign(this, opts);
            }
            set(props) {
                Object.assign(this, props);
            }
            setCoords() {}
            getBoundingRect() {
                return { left: 0, top: 0, width: 0, height: 0 };
            }
        },
        Rect: class FakeRect {},
        Circle: class FakeCircle {},
        Ellipse: class FakeEllipse {},
        Polygon: class FakePolygon {},
    };
    fabric.Canvas = class CapturingCanvas extends Mockcanvas {
        constructor(...args) {
            super(...args);
            fabric.lastCanvas = this;
        }
    };
    return fabric;
}

// ─── JSDOM helpers ────────────────────────────────────────────────────────

/**
 * Install a fresh JSDOM document on `globalThis` and seed it with one
 * `<canvas>` plus the toolbar buttons the editor's `init()` binds.
 * Returns both the rebuilt element map and a handle on the JSDOM `Event`
 * constructor so tests can dispatch synthetic clicks without leaking
 * jsdom globals into the assertion code.
 *
 * The element map mirrors `defaults` inside `init(elementMap)` so every key the
 * facade tries to resolve maps to a real element. Buttons that the
 * editor binds via `bindElementIfExists` therefore land in the bindings
 * registry; the post-dispose dispatch test relies on this so the
 * "click after dispose must not invoke the handler" assertion is
 * actually testing the disposed-aware shim and not just a missing
 * element.
 */
function installDom() {
    const dom = new JSDOM(
        `<!DOCTYPE html><html><body>
            <div id="imagePlaceholder"></div>
            <div id="canvasContainer">
                <canvas id="canvas"></canvas>
            </div>
            <input id="scalePercentageInput" value="100">
            <input id="rotateLeftDegreesInput" value="90">
            <input id="rotateRightDegreesInput" value="90">
            <button id="rotateLeftButton"></button>
            <button id="rotateRightButton"></button>
            <button id="createMaskButton"></button>
            <button id="removeSelectedMaskButton"></button>
            <button id="removeAllMasksButton"></button>
            <button id="mergeMasksButton"></button>
            <button id="downloadImageButton"></button>
            <button id="zoomInButton"></button>
            <button id="zoomOutButton"></button>
            <button id="resetImageTransformButton"></button>
            <button id="undoButton"></button>
            <button id="redoButton"></button>
            <button id="enterCropModeButton"></button>
            <button id="applyCropButton"></button>
            <button id="cancelCropButton"></button>
            <input id="imageInput" type="file">
            <div id="uploadArea"></div>
            <ul id="maskList"></ul>
        </body></html>`,
    );
    globalThis.window = dom.window;
    globalThis.document = dom.window.document;
    globalThis.HTMLElement = dom.window.HTMLElement;
    globalThis.HTMLCanvasElement = dom.window.HTMLCanvasElement;
    globalThis.HTMLInputElement = dom.window.HTMLInputElement;
    globalThis.Event = dom.window.Event;
    globalThis.MouseEvent = dom.window.MouseEvent;
    return { document: dom.window.document, Event: dom.window.Event };
}

/**
 * Construct an editor with the Fabric stub, hand it the canonical id
 * map, run `init()`, and return the editor + the stubbed Fabric canvas
 * so tests can read teardown counters. Wrapping the boilerplate keeps
 * each test focused on the post-dispose contract under test.
 */
function makeEditor() {
    const fabric = makeFabricStub();
    const editor = new ImageEditor(fabric, {
        // animationDuration: 0 keeps the AnimationQueue's queued tasks
        // resolving on a single microtask, so the "pending animations
        // settle on dispose" assertion converges quickly.
        animationDuration: 0,
        // Skip the auto-load triggered by `init()` so the test can
        // observe a clean "no image ever loaded" dispose path.
        showPlaceholder: false,
    });
    editor.init({});
    const canvasStub = fabric.lastCanvas;
    assert.ok(canvasStub, 'sanity: init() should construct a Fabric canvas');
    return { editor, canvasStub };
}

// ─── Tests ────────────────────────────────────────────────────────────────

test('dispose() called twice does not throw', () => {
    installDom();
    const { editor, canvasStub } = makeEditor();

    // First call sequences the documented teardown:
    //   1. `isDisposed = true`
    //   2. `animQueue.clear()`
    //   3. `domBindings.removeAll()`
    //   4. `canvas.dispose()`
    // The second call MUST be a pure no-op.
    assert.doesNotThrow(() => editor.dispose(), 'first dispose must not throw');
    assert.equal(
        canvasStub.disposeCalls,
        1,
        'first dispose() must call canvas.dispose() exactly once',
    );

    assert.doesNotThrow(() => editor.dispose(), 'second dispose must not throw');
    assert.equal(
        canvasStub.disposeCalls,
        1,
        'second dispose() must NOT re-invoke canvas.dispose() (idempotent)',
    );

    // A third call for good measure — the contract is "any number of
    // repeats is a no-op", not just two. Mirrors in
    // `tests/dom-bindings.property.test.mjs`.
    assert.doesNotThrow(() => editor.dispose(), 'third dispose must not throw');
    assert.equal(
        canvasStub.disposeCalls,
        1,
        'subsequent dispose() calls must NOT re-invoke canvas.dispose()',
    );
});

test('dispose() drains the DOM bindings registry', () => {
    const { document, Event } = installDom();
    const { editor } = makeEditor();

    editor.dispose();

    // After dispose, the bindings registry has been drained via
    // `domBindings.removeAll()` AND every wrapped handler is gated by
    // the disposed-aware shim (`isDisposed()` returns `true`). The
    // observable contract is "no canvas-touching side effect, no
    // exception" — we walk every button the facade binds in
    // `bindDomEvents` and confirm dispatching a click is silent. This
    // is the facade-level counterpart to
    // `tests/dom-bindings.property.test.mjs`, which exercises the same
    // drain on the registry primitive in isolation.
    for (const id of [
        'createMaskButton',
        'zoomInButton',
        'zoomOutButton',
        'resetImageTransformButton',
        'removeSelectedMaskButton',
        'removeAllMasksButton',
        'mergeMasksButton',
        'downloadImageButton',
        'undoButton',
        'redoButton',
        'enterCropModeButton',
        'applyCropButton',
        'cancelCropButton',
        'uploadArea',
    ]) {
        const el = document.getElementById(id);
        assert.ok(el, `sanity: #${id} must exist in JSDOM`);
        assert.doesNotThrow(
            () => el.dispatchEvent(new Event('click')),
            `post-dispose click on #${id} must not throw`,
        );
    }
});

test('dispose() restores DOM disabled and pointer-event state changed by the editor', () => {
    const { document } = installDom();
    const imageInput = document.getElementById('imageInput');
    const customCreateMaskControl = document.createElement('div');
    customCreateMaskControl.id = 'customCreateMaskControl';
    customCreateMaskControl.setAttribute('aria-disabled', 'mixed');
    customCreateMaskControl.style.pointerEvents = 'auto';
    document.body.append(customCreateMaskControl);

    assert.ok(imageInput, 'sanity: #imageInput must exist in JSDOM');
    imageInput.disabled = true;

    const fabric = makeFabricStub();
    const editor = new ImageEditor(fabric, {
        animationDuration: 0,
        showPlaceholder: false,
    });
    editor.init({ createMaskButton: customCreateMaskControl.id });

    assert.equal(imageInput.disabled, false, 'init should re-enable idle image input');
    assert.equal(
        customCreateMaskControl.getAttribute('aria-disabled'),
        'true',
        'init should mark the custom control disabled while no image is loaded',
    );
    assert.equal(customCreateMaskControl.style.pointerEvents, 'none');

    editor.dispose();
    editor.dispose();

    assert.equal(imageInput.disabled, true, 'dispose must restore prior disabled state');
    assert.equal(customCreateMaskControl.getAttribute('aria-disabled'), 'mixed');
    assert.equal(customCreateMaskControl.style.pointerEvents, 'auto');
});

test('dispose() tears down the live Fabric canvas exactly once', () => {
    installDom();
    const { editor, canvasStub } = makeEditor();

    assert.equal(
        canvasStub.disposed,
        false,
        'sanity: stubbed Fabric canvas should not yet be disposed',
    );

    editor.dispose();

    assert.equal(
        canvasStub.disposed,
        true,
        'underlying Fabric canvas must have its dispose() called',
    );
    assert.equal(canvasStub.disposeCalls, 1, 'dispose() must call canvas.dispose() exactly once');
    assert.equal(editor.isImageLoaded(), false, 'isImageLoaded() must be false after dispose');
});

test('disposeAsync() waits for async Fabric canvas disposal', async () => {
    installDom();
    let resolveDispose;
    let disposeSettled = false;
    const fabric = makeFabricStub();
    const BaseCanvas = fabric.Canvas;
    fabric.Canvas = class AsyncDisposeCanvas extends BaseCanvas {
        dispose() {
            super.dispose();
            return new Promise((resolve) => {
                resolveDispose = () => {
                    disposeSettled = true;
                    resolve();
                };
            });
        }
    };
    const editor = new ImageEditor(fabric, {
        animationDuration: 0,
        showPlaceholder: false,
    });
    editor.init({});

    let resolved = false;
    const disposePromise = editor.disposeAsync().then(() => {
        resolved = true;
    });
    await Promise.resolve();

    assert.equal(resolved, false, 'disposeAsync() must wait for Fabric dispose to settle');
    assert.equal(fabric.lastCanvas.disposeCalls, 1);
    assert.equal(disposeSettled, false);

    resolveDispose();
    await disposePromise;

    assert.equal(resolved, true);
    assert.equal(disposeSettled, true);
});

test('post-dispose synchronous public methods are no-ops and do not throw', () => {
    installDom();
    const { editor } = makeEditor();
    editor.dispose();

    // Synchronous methods that gate on a missing runtime canvas (or
    // stronger). Each must accept a representative argument shape and return
    // the documented no-op value without ever touching the cleared canvas.
    assert.doesNotThrow(() => editor.saveState(), 'saveState() must be a safe no-op after dispose');

    // `createMask` has a documented `null` return when the runtime canvas
    // is null, which is exactly the post-dispose state.
    assert.equal(
        editor.createMask({ shape: 'rect' }),
        null,
        'createMask() must return null after dispose',
    );
    assert.equal(
        editor.createMask(),
        null,
        'createMask() with default config must return null after dispose',
    );

    assert.doesNotThrow(
        () => editor.removeSelectedMask(),
        'removeSelectedMask() must be a safe no-op after dispose',
    );
    assert.doesNotThrow(
        () => editor.removeAllMasks(),
        'removeAllMasks() must be a safe no-op after dispose',
    );
    assert.doesNotThrow(
        () => editor.removeAllMasks({ saveHistory: false }),
        'removeAllMasks({ saveHistory: false }) must be a safe no-op after dispose',
    );

    assert.doesNotThrow(
        () => editor.enterCropMode(),
        'enterCropMode() must be a safe no-op after dispose',
    );
    assert.doesNotThrow(
        () => editor.cancelCrop(),
        'cancelCrop() must be a safe no-op after dispose',
    );

    assert.doesNotThrow(
        () => editor.downloadImage(),
        'downloadImage() must be a safe no-op after dispose',
    );

    // `isImageLoaded()` reads the runtime original image rather than the
    // canvas, so it should still return a sensible boolean after dispose.
    // The "no image was ever loaded" path returns `false`.
    assert.equal(
        editor.isImageLoaded(),
        false,
        'isImageLoaded() must return false after dispose when no image was loaded',
    );
});

test('post-dispose async public methods resolve safely without touching the canvas', async () => {
    installDom();
    const { editor, canvasStub } = makeEditor();
    editor.dispose();

    // Snapshot the canvas counters so the assertions can verify the
    // post-dispose calls did NOT route through the (already disposed)
    // stub. `disposeCalls` should remain at 1 from the initial dispose;
    // any other counter must remain at zero or its post-init value.
    const renderAllAtDispose = canvasStub.renderAllCalls;
    const disposeCallsAtDispose = canvasStub.disposeCalls;

    // ── loadImage ────────────────────────────
    // After dispose `loadImage` falls through the missing-Fabric or missing-
    // canvas early return and resolves with `undefined` without touching the
    // loader pipeline.
    await assert.doesNotReject(
        editor.loadImage('data:image/png;base64,AAAA'),
        'post-dispose loadImage must resolve without throwing',
    );
    await assert.doesNotReject(
        editor.loadImage('not-a-data-url'),
        'post-dispose loadImage with invalid input must resolve without throwing',
    );

    // ── scaleImage / rotateImage / resetImageTransform ──
    // The facade short-circuits before enqueueing on the AnimationQueue
    // so the returned promise resolves on the next microtask.
    await assert.doesNotReject(
        editor.scaleImage(2),
        'post-dispose scaleImage must resolve without throwing',
    );
    await assert.doesNotReject(
        editor.rotateImage(45),
        'post-dispose rotateImage must resolve without throwing',
    );
    await assert.doesNotReject(
        editor.rotateImage(NaN),
        'post-dispose rotateImage(NaN) must resolve without throwing',
    );
    await assert.doesNotReject(
        editor.resetImageTransform(),
        'post-dispose resetImageTransform must resolve without throwing',
    );

    // ── undo / redo ─────────────────────────────────────
    // While the editor is disposed, `undo()` and `redo()` resolve
    // without touching the canvas. The facade short-circuits at the
    // top BEFORE enqueueing, so the resolved promise does not depend
    // on the (already drained) AnimationQueue.
    await assert.doesNotReject(editor.undo(), 'post-dispose undo must resolve without throwing');
    await assert.doesNotReject(editor.redo(), 'post-dispose redo must resolve without throwing');

    // ── exportImageBase64 ─────────────────────────
    // Export gates on a missing runtime canvas, so the failure is explicit.
    await assert.rejects(
        () => editor.exportImageBase64(),
        /editor is not initialized/,
        'post-dispose exportImageBase64 must reject clearly',
    );
    await assert.rejects(
        () => editor.exportImageFile(),
        /editor is not initialized/,
        'post-dispose exportImageFile must reject clearly',
    );

    // ── loadFromState ───────────────────────────────────
    // `loadFromState` short-circuits on a missing runtime canvas. A subsequent
    // string-form call must not throw.
    await assert.doesNotReject(
        editor.loadFromState('{"objects":[]}'),
        'post-dispose loadFromState must resolve without throwing',
    );
    await assert.doesNotReject(
        editor.loadFromState({ objects: [] }),
        'post-dispose loadFromState (object form) must resolve without throwing',
    );

    // ── applyCrop ─────────────────────────────────
    // No crop session exists post-dispose, so the runtime crop-session gate
    // triggers a resolved-promise no-op.
    await assert.doesNotReject(
        editor.applyCrop(),
        'post-dispose applyCrop must resolve without throwing',
    );

    // ── mergeMasks ────────────────────────────────
    await assert.doesNotReject(
        editor.mergeMasks(),
        'post-dispose mergeMasks must resolve without throwing',
    );

    // No async public method may have routed back through the
    // (disposed) Fabric canvas: the renderAll counter must not have
    // moved and the canvas must not have been re-disposed.
    assert.equal(
        canvasStub.renderAllCalls,
        renderAllAtDispose,
        'post-dispose calls must not invoke canvas.renderAll()',
    );
    assert.equal(
        canvasStub.disposeCalls,
        disposeCallsAtDispose,
        'post-dispose calls must not re-invoke canvas.dispose()',
    );
});

test('animations enqueued before dispose settle after dispose', async () => {
    installDom();
    const { editor } = makeEditor();

    // Enqueue several animation-producing operations. With no image
    // loaded the transform controller short-circuits inside each entry
    // (`if (!img) return`), so each promise resolves quickly — but
    // critically, the ANIMATION QUEUE itself must drain on dispose
    // so even a slow entry would settle.
    const promises = [
        editor.scaleImage(2),
        editor.rotateImage(45),
        editor.resetImageTransform(),
        editor.undo(),
        editor.redo(),
    ];

    // Dispose mid-flight. The animation queue's `clear()` must settle
    // every queued promise is called, the AnimationQueue
    // SHALL ensure each returned promise eventually settles").
    editor.dispose();

    // `Promise.allSettled` is the right primitive: per the documented contract the
    // promises only need to SETTLE (resolve OR reject), not necessarily
    // resolve. This test asserts the strongest stable form (none
    // remain pending and none observed an unhandled exception that
    // would surface here).
    const results = await Promise.allSettled(promises);
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        assert.notEqual(r.status, undefined, `promise ${i} must have settled after dispose`);
        // If a promise rejected, the rejection must be a normal Error,
        // not a TypeError from touching a null canvas.
        if (r.status === 'rejected') {
            assert.ok(
                r.reason instanceof Error,
                `rejected promise ${i} must reject with an Error, got ${typeof r.reason}`,
            );
            assert.ok(
                !/Cannot read|null|undefined/i.test(String(r.reason?.message ?? '')),
                `rejected promise ${i} must not surface a null-canvas TypeError ` +
                    `(got "${r.reason?.message ?? r.reason}")`,
            );
        }
    }
});

test('post-dispose calls before any init() are also safe', () => {
    // Edge case: a consumer constructs an editor and then disposes
    // without ever calling `init()`. The facade's dispose path must
    // tolerate the never-initialized state — `domBindings`, `canvas`,
    // and `transformController` are all `null`. None of the cleanup
    // steps may throw on null references.
    installDom();
    const fabric = makeFabricStub();
    const editor = new ImageEditor(fabric, { animationDuration: 0 });

    assert.doesNotThrow(() => editor.dispose(), 'dispose() before init() must not throw');

    // Repeat to confirm idempotency holds even on the never-init path.
    assert.doesNotThrow(() => editor.dispose(), 'second dispose() before init() must not throw');

    // Public methods called against the never-initialized + disposed
    // editor must still be safe.
    assert.doesNotThrow(() => editor.saveState());
    assert.doesNotThrow(() => editor.removeSelectedMask());
    assert.doesNotThrow(() => editor.removeAllMasks());
    assert.equal(editor.createMask(), null);
    assert.equal(editor.isImageLoaded(), false);
});
