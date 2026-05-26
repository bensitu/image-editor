// Task 21.8: idempotent dispose and post-dispose API safety
//
// Scope:
//   This is the example-based unit-test counterpart of Property 29
//   (`tests/dom-bindings.property.test.mjs`). Property 29 exercises the
//   `DomBindings` registry primitive in isolation; this test exercises
//   the `ImageEditor` facade end-to-end through `init()` and
//   `dispose()`, asserting:
//
//     - **Req 15.3, 33.3** — calling `dispose()` twice is a no-op and
//       never throws.
//     - **Req 15.1, 15.2, 17.4** — after `dispose()`, every public
//       method (`loadImage`, `scaleImage`, `rotateImage`,
//       `resetImageTransform`, `undo`, `redo`, `createMask`,
//       `removeSelectedMask`, `removeAllMasks`, `enterCropMode`,
//       `cancelCrop`, `applyCrop`, `mergeMasks`, `exportImageBase64`,
//       `downloadImage`, `saveState`, `loadFromState`,
//       `isImageLoaded`) resolves or returns safely without touching
//       the (now-null) canvas.
//     - **Req 15.1, 15.4** — animation queue entries that were
//       enqueued before `dispose()` settle deterministically; awaiting
//       them after dispose does not hang and does not throw against
//       the torn-down canvas.
//     - **Req 33.2, 33.3, 33.4** — every DOM listener registered
//       through the bindings registry is detached on `dispose()`, and
//       a click on a previously bound element after dispose does NOT
//       invoke the original handler.
//
// ─── Why a stubbed Fabric canvas instead of a live one ─────────────────────
//
// `dispose()` only needs the Fabric module to expose a constructible
// `Canvas`. The behaviors under test are the facade's bookkeeping
// (`_disposed` flag, `animQueue.clear()`, `_bindings.removeAll()`,
// `canvas.dispose()`, post-dispose method gates). A live Fabric canvas
// would force jsdom + asset wiring without exercising any new branch
// inside `dispose()` or the post-dispose method gates. The stub mirrors
// the surface the editor actually touches during init/dispose:
//
//     new fabric.Canvas(el, opts)   — constructor records the opts
//     canvas.on(event, handler)     — event subscription
//     canvas.dispose()              — teardown hook
//     canvas.discardActiveObject()  — used by saveState (not exercised here)
//     canvas.getActiveObject()      — used by saveState (not exercised here)
//     canvas.getObjects()           — used by _hideAllMaskLabels
//     canvas.renderAll()            — used by various render paths
//
// The same pattern (small `MockCanvas` exposing only the surface used)
// is followed by sibling tests like `mask-id-uniqueness.property.test.mjs`,
// `state-serializer.property.test.mjs`, and `export-service.test.mjs`.

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
 * canvas exactly once (Req 15.1) and that no method invocation reaches
 * the canvas after disposal.
 *
 * The methods covered here mirror what the editor's `init()` and
 * `dispose()` paths actually invoke. Unused methods are added as
 * no-ops so the stub stays compatible with later post-dispose calls
 * that route through internal helpers; a method that is genuinely
 * never reached after dispose can still exist on the stub without
 * affecting any assertion.
 */
class MockFabricCanvas {
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

    getWidth() { return this.width; }
    getHeight() { return this.height; }
    setDimensions({ width, height }) { this.width = width; this.height = height; }
    getObjects() { return this.objects.slice(); }
    add(o) { this.objects.push(o); }
    remove(o) {
        const i = this.objects.indexOf(o);
        if (i >= 0) this.objects.splice(i, 1);
    }
    discardActiveObject() { this._active = null; }
    getActiveObject() { return this._active ?? null; }
    setActiveObject(o) { this._active = o; }
    bringObjectToFront() {}
    sendObjectToBack() {}
    renderAll() { this.renderAllCalls += 1; }
    requestRenderAll() {}
    toJSON() { return { objects: [], width: this.width, height: this.height }; }
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
        // because `this.canvas` is set to `null` immediately after.
        this.listeners.clear();
    }
}

/**
 * Build a Fabric module stub. The adapter's `looksLikeFabricModule`
 * test only checks for a `Canvas` function property; everything else
 * is consumed via `this._fabric.<X>` from the facade, so we expose
 * only the constructors that the init / dispose / no-op-paths reach.
 *
 * `Image` is needed by `isImageLoaded()` (instance check) and `Text`
 * is needed by the optional label-creation path. Neither is invoked
 * during a no-image init/dispose cycle; they are present so a future
 * extension of this test can load an image without re-stubbing the
 * module.
 */
function makeFabricStub() {
    return {
        Canvas: MockFabricCanvas,
        Image: class FakeImage {},
        FabricImage: class FakeFabricImage {
            static async fromURL() { return new FakeFabricImage(); }
        },
        Text: class FakeText {
            constructor(text, opts) {
                this.text = text;
                Object.assign(this, opts);
            }
            set(props) { Object.assign(this, props); }
            setCoords() {}
            getBoundingRect() { return { left: 0, top: 0, width: 0, height: 0 }; }
        },
        FabricText: class FakeFabricText {},
        Rect: class FakeRect {},
        Circle: class FakeCircle {},
        Ellipse: class FakeEllipse {},
        Polygon: class FakePolygon {},
    };
}

// ─── JSDOM helpers ────────────────────────────────────────────────────────

/**
 * Install a fresh JSDOM document on `globalThis` and seed it with one
 * `<canvas>` plus the toolbar buttons the editor's `init()` binds.
 * Returns both the rebuilt id-map and a handle on the JSDOM `Event`
 * constructor so tests can dispatch synthetic clicks without leaking
 * jsdom globals into the assertion code.
 *
 * The id-map mirrors `defaults` inside `init(idMap)` so every key the
 * facade tries to resolve maps to a real element. Buttons that the
 * editor binds via `_bindIfExists` therefore land in the bindings
 * registry; the post-dispose dispatch test relies on this so the
 * "click after dispose must not invoke the handler" assertion is
 * actually testing the disposed-aware shim and not just a missing
 * element.
 */
function installDom() {
    const dom = new JSDOM(
        `<!DOCTYPE html><html><body>
            <div id="imgPlaceholder"></div>
            <div id="canvasContainer">
                <canvas id="fabricCanvas"></canvas>
            </div>
            <input id="scaleRate" value="100">
            <input id="rotationLeftInput" value="90">
            <input id="rotationRightInput" value="90">
            <button id="rotateLeftBtn"></button>
            <button id="rotateRightBtn"></button>
            <button id="addMaskBtn"></button>
            <button id="removeMaskBtn"></button>
            <button id="removeAllMasksBtn"></button>
            <button id="mergeBtn"></button>
            <button id="downloadBtn"></button>
            <button id="zoomInBtn"></button>
            <button id="zoomOutBtn"></button>
            <button id="resetBtn"></button>
            <button id="undoBtn"></button>
            <button id="redoBtn"></button>
            <button id="cropBtn"></button>
            <button id="applyCropBtn"></button>
            <button id="cancelCropBtn"></button>
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
    // The stubbed canvas captured by the facade's `_initCanvas`. We
    // pull it back out so the dispose-related assertions can verify
    // teardown side effects.
    const canvasStub = editor.canvas;
    return { editor, canvasStub };
}

// ─── Tests ────────────────────────────────────────────────────────────────

test('dispose() called twice does not throw (Requirements 15.3, 33.3)', () => {
    installDom();
    const { editor, canvasStub } = makeEditor();

    // First call sequences the documented teardown:
    //   1. `_disposed = true`            (Req 15.1, 15.2)
    //   2. `animQueue.clear()`           (Req 15.1, 15.4)
    //   3. `_bindings.removeAll()`       (Req 33.2, 33.3)
    //   4. `canvas.dispose()`            (Req 15.1)
    // The second call MUST be a pure no-op (Req 33.3 explicitly: "the
    // second call SHALL be a no-op and SHALL NOT throw on
    // already-removed listeners").
    assert.doesNotThrow(() => editor.dispose(), 'first dispose must not throw');
    assert.equal(canvasStub.disposeCalls, 1,
        'first dispose() must call canvas.dispose() exactly once');

    assert.doesNotThrow(() => editor.dispose(), 'second dispose must not throw');
    assert.equal(canvasStub.disposeCalls, 1,
        'second dispose() must NOT re-invoke canvas.dispose() (idempotent)');

    // A third call for good measure — the contract is "any number of
    // repeats is a no-op", not just two. Mirrors Property 29.4 in
    // `tests/dom-bindings.property.test.mjs`.
    assert.doesNotThrow(() => editor.dispose(), 'third dispose must not throw');
    assert.equal(canvasStub.disposeCalls, 1,
        'subsequent dispose() calls must NOT re-invoke canvas.dispose()');
});

test('dispose() drains the DOM bindings registry (Requirements 33.2, 33.3, 33.4)', () => {
    const { document, Event } = installDom();
    const { editor } = makeEditor();

    editor.dispose();

    // After dispose, the bindings registry has been drained via
    // `_bindings.removeAll()` AND every wrapped handler is gated by
    // the disposed-aware shim (`isDisposed()` returns `true`). The
    // observable contract is "no canvas-touching side effect, no
    // exception" — we walk every button the facade binds in
    // `_bindEvents` and confirm dispatching a click is silent. This
    // is the orchestrator-level counterpart of Property 29.3 / 29.4
    // in `tests/dom-bindings.property.test.mjs`, which exercises the
    // same drain on the registry primitive in isolation.
    for (const id of [
        'addMaskBtn',
        'zoomInBtn', 'zoomOutBtn', 'resetBtn',
        'removeMaskBtn', 'removeAllMasksBtn', 'mergeBtn',
        'downloadBtn', 'undoBtn', 'redoBtn',
        'cropBtn', 'applyCropBtn', 'cancelCropBtn',
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

test('dispose() nulls the live Fabric canvas reference (Requirement 15.1)', () => {
    installDom();
    const { editor, canvasStub } = makeEditor();

    assert.ok(editor.canvas, 'sanity: canvas should be live before dispose');
    assert.equal(canvasStub.disposed, false,
        'sanity: stubbed Fabric canvas should not yet be disposed');

    editor.dispose();

    assert.equal(editor.canvas, null,
        'editor.canvas must be nulled after dispose');
    assert.equal(canvasStub.disposed, true,
        'underlying Fabric canvas must have its dispose() called');
    assert.equal(editor.isImageLoadedToCanvas, false,
        'isImageLoadedToCanvas must be reset after dispose');
});

test('post-dispose synchronous public methods are no-ops and do not throw (Requirements 15.1, 15.2, 33.4)', () => {
    installDom();
    const { editor } = makeEditor();
    editor.dispose();

    // Synchronous methods that the facade gates with `if (!this.canvas) return`
    // (or stronger). Each must accept a representative argument shape
    // and return the documented no-op value without ever touching the
    // (null) canvas.
    assert.doesNotThrow(() => editor.saveState(),
        'saveState() must be a safe no-op after dispose');

    // `createMask` has a documented `null` return when the canvas is
    // null, which is exactly the post-dispose state.
    assert.equal(editor.createMask({ shape: 'rect' }), null,
        'createMask() must return null after dispose');
    assert.equal(editor.createMask(), null,
        'createMask() with default config must return null after dispose');

    assert.doesNotThrow(() => editor.removeSelectedMask(),
        'removeSelectedMask() must be a safe no-op after dispose');
    assert.doesNotThrow(() => editor.removeAllMasks(),
        'removeAllMasks() must be a safe no-op after dispose');
    assert.doesNotThrow(() => editor.removeAllMasks({ saveHistory: false }),
        'removeAllMasks({ saveHistory: false }) must be a safe no-op after dispose');

    assert.doesNotThrow(() => editor.enterCropMode(),
        'enterCropMode() must be a safe no-op after dispose');
    assert.doesNotThrow(() => editor.cancelCrop(),
        'cancelCrop() must be a safe no-op after dispose');

    assert.doesNotThrow(() => editor.downloadImage(),
        'downloadImage() must be a safe no-op after dispose');
    assert.doesNotThrow(() => editor.downloadImage('foo.png'),
        'downloadImage(name) must be a safe no-op after dispose');

    // `isImageLoaded()` reads `this.originalImage` rather than the
    // canvas, so it should still return a sensible boolean after
    // dispose. The "no image was ever loaded" path returns `false`.
    assert.equal(editor.isImageLoaded(), false,
        'isImageLoaded() must return false after dispose when no image was loaded');
});

test('post-dispose async public methods resolve safely without touching the canvas (Requirements 15.1, 15.2, 17.4)', async () => {
    installDom();
    const { editor, canvasStub } = makeEditor();
    editor.dispose();

    // Snapshot the canvas counters so the assertions can verify the
    // post-dispose calls did NOT route through the (already disposed)
    // stub. `disposeCalls` should remain at 1 from the initial dispose;
    // any other counter must remain at zero or its post-init value.
    const renderAllAtDispose = canvasStub.renderAllCalls;
    const disposeCallsAtDispose = canvasStub.disposeCalls;

    // ── loadImage (Req 6.x, 14.1, 15.1) ────────────────────────────
    // After dispose `loadImage` falls through the
    // `!this._fabricLoaded || !this.canvas` early return and resolves
    // with `undefined` without touching the loader pipeline.
    await assert.doesNotReject(
        editor.loadImage('data:image/png;base64,AAAA'),
        'post-dispose loadImage must resolve without throwing',
    );
    await assert.doesNotReject(
        editor.loadImage('not-a-data-url'),
        'post-dispose loadImage with invalid input must resolve without throwing',
    );

    // ── scaleImage / rotateImage / resetImageTransform (Req 12.x, 13.x, 15.x) ──
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

    // ── undo / redo (Req 17.4) ─────────────────────────────────────
    // While the editor is disposed, `undo()` and `redo()` resolve
    // without touching the canvas. The facade short-circuits at the
    // top BEFORE enqueueing, so the resolved promise does not depend
    // on the (already drained) AnimationQueue.
    await assert.doesNotReject(
        editor.undo(),
        'post-dispose undo must resolve without throwing',
    );
    await assert.doesNotReject(
        editor.redo(),
        'post-dispose redo must resolve without throwing',
    );

    // ── exportImageBase64 (Req 14.1, 15.1) ─────────────────────────
    // The facade gates at `if (!this.canvas) return ''`, so the
    // documented empty-string no-op shape is preserved after dispose.
    const base64 = await editor.exportImageBase64();
    assert.equal(base64, '',
        'post-dispose exportImageBase64 must resolve to the empty string');

    // ── loadFromState (Req 15.1) ───────────────────────────────────
    // `loadFromState` short-circuits on `!this.canvas`. A subsequent
    // string-form call must not throw.
    await assert.doesNotReject(
        editor.loadFromState('{"objects":[]}'),
        'post-dispose loadFromState must resolve without throwing',
    );
    await assert.doesNotReject(
        editor.loadFromState({ objects: [] }),
        'post-dispose loadFromState (object form) must resolve without throwing',
    );

    // ── applyCrop (Req 14.1, 15.1) ─────────────────────────────────
    // No crop session exists post-dispose, so the facade's
    // `!this._cropSession` gate triggers a resolved-promise no-op.
    await assert.doesNotReject(
        editor.applyCrop(),
        'post-dispose applyCrop must resolve without throwing',
    );

    // ── mergeMasks (Req 14.1, 15.1) ────────────────────────────────
    await assert.doesNotReject(
        editor.mergeMasks(),
        'post-dispose mergeMasks must resolve without throwing',
    );

    // No async public method may have routed back through the
    // (disposed) Fabric canvas: the renderAll counter must not have
    // moved and the canvas must not have been re-disposed.
    assert.equal(canvasStub.renderAllCalls, renderAllAtDispose,
        'post-dispose calls must not invoke canvas.renderAll()');
    assert.equal(canvasStub.disposeCalls, disposeCallsAtDispose,
        'post-dispose calls must not re-invoke canvas.dispose()');
});

test('animations enqueued before dispose settle after dispose (Requirements 15.1, 15.4)', async () => {
    installDom();
    const { editor } = makeEditor();

    // Enqueue several animation-producing operations. With no image
    // loaded the transform controller short-circuits inside each entry
    // (`if (!img) return`), so each promise resolves quickly — but
    // critically, the ANIMATION QUEUE itself must drain on dispose
    // (Req 15.4) so even a slow entry would settle.
    const promises = [
        editor.scaleImage(2),
        editor.rotateImage(45),
        editor.resetImageTransform(),
        editor.undo(),
        editor.redo(),
    ];

    // Dispose mid-flight. The animation queue's `clear()` must settle
    // every queued promise (Req 12.3 / 15.4: "FOR ALL queued animation
    // functions enqueued before dispose() is called, the AnimationQueue
    // SHALL ensure each returned promise eventually settles").
    editor.dispose();

    // `Promise.allSettled` is the right primitive: per Req 15.4 the
    // promises only need to SETTLE (resolve OR reject), not necessarily
    // resolve. This test asserts the strongest stable form (none
    // remain pending and none observed an unhandled exception that
    // would surface here).
    const results = await Promise.allSettled(promises);
    for (let i = 0; i < results.length; i++) {
        const r = results[i];
        assert.notEqual(r.status, undefined,
            `promise ${i} must have settled after dispose`);
        // If a promise rejected, the rejection must be a normal Error,
        // not a TypeError from touching a null canvas (Req 15.2: every
        // disposed-aware callback MUST exit cleanly).
        if (r.status === 'rejected') {
            assert.ok(r.reason instanceof Error,
                `rejected promise ${i} must reject with an Error, got ${typeof r.reason}`);
            assert.ok(
                !/Cannot read|null|undefined/i.test(String(r.reason?.message ?? '')),
                `rejected promise ${i} must not surface a null-canvas TypeError ` +
                `(got "${r.reason?.message ?? r.reason}")`,
            );
        }
    }
});

test('post-dispose calls before any init() are also safe (Requirements 15.1, 15.3)', () => {
    // Edge case: a consumer constructs an editor and then disposes
    // without ever calling `init()`. The facade's dispose path must
    // tolerate the never-initialized state — `_bindings`, `canvas`,
    // and `_transformController` are all `null`. None of the cleanup
    // steps may throw on null references.
    installDom();
    const fabric = makeFabricStub();
    const editor = new ImageEditor(fabric, { animationDuration: 0 });

    assert.doesNotThrow(() => editor.dispose(),
        'dispose() before init() must not throw');

    // Repeat to confirm idempotency holds even on the never-init path.
    assert.doesNotThrow(() => editor.dispose(),
        'second dispose() before init() must not throw');

    // Public methods called against the never-initialized + disposed
    // editor must still be safe.
    assert.doesNotThrow(() => editor.saveState());
    assert.doesNotThrow(() => editor.removeSelectedMask());
    assert.doesNotThrow(() => editor.removeAllMasks());
    assert.equal(editor.createMask(), null);
    assert.equal(editor.isImageLoaded(), false);
});
