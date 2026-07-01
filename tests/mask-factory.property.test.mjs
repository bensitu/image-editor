/**
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies src/mask/mask-factory.ts createMask behavior for shape origins, style
 *   propagation, selectable controls, stroke defaults, and selection styling. The
 *   suite uses structural Fabric shape mocks instead of a live canvas.
 *
 * Scope:
 *   - Rect, circle, and ellipse masks use left/top origin placement.
 *   - Explicit falsy styles and control flags are preserved.
 *   - Custom stroke values survive select and unselect styling transitions.
 *
 * Out of scope:
 *   - visual rendering quality
 *   - unrelated crop or export behavior
 *   - browser-specific pointer interaction details
 *
 * Environment:
 *   - Node.js ESM
 *   - fast-check generated cases where applicable
 *   - Fabric/canvas behavior is mocked where needed
 *
 * Run:
 *   node --test tests/mask-factory.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on mask factory shape defaults and falsy option
 *     preservation only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { createMask, removeAllMasks } = await import('../src/mask/mask-factory.ts');
const { applyMaskSelectedStyle, applyMaskUnselectedStyle } =
    await import('../src/mask/mask-style.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

// ─── Mocks ─────────────────────────────────────────────────────────────────

/**
 * Build a fake Fabric module. Each shape constructor returns a plain
 * object with the supplied props copied straight onto `this` so
 * `originX`, `originY`, `fill`, and the spread-out `styles` block flow
 * through to the resulting mask. A minimal `set` / `setCoords` /
 * `getBoundingRect` / `on` surface satisfies the post-construct calls
 * `mask-factory.ts` makes (hover binding via `on`, polygon
 * bounding-box realignment via `setCoords` / `getBoundingRect`).
 */
function makeFabric() {
    const makeShape = (type) =>
        function Shape(props) {
            Object.assign(this, { type, ...props });
            this.set = function (p, v) {
                if (typeof p === 'string') this[p] = v;
                else Object.assign(this, p);
            };
            this.setCoords = function () {};
            this.getBoundingRect = function () {
                return {
                    left: this.left ?? 0,
                    top: this.top ?? 0,
                    width: this.width ?? 50,
                    height: this.height ?? 50,
                };
            };
            this.__listeners = {};
            this.on = function (event, handler) {
                (this.__listeners[event] ??= []).push(handler);
            };
            this.off = function (event, handler) {
                const handlers = this.__listeners[event] ?? [];
                this.__listeners[event] = handlers.filter((candidate) => candidate !== handler);
            };
        };

    return {
        Rect: makeShape('rect'),
        Circle: makeShape('circle'),
        Ellipse: makeShape('ellipse'),
        Polygon: function Polygon(pts, props) {
            Object.assign(this, { type: 'polygon', points: pts, ...props });
            this.set = function (p, v) {
                if (typeof p === 'string') this[p] = v;
                else Object.assign(this, p);
            };
            this.setCoords = function () {};
            this.getBoundingRect = function () {
                const xs = pts.map((p) => p.x);
                const ys = pts.map((p) => p.y);
                return {
                    left: Math.min(...xs),
                    top: Math.min(...ys),
                    width: Math.max(...xs) - Math.min(...xs),
                    height: Math.max(...ys) - Math.min(...ys),
                };
            };
            this.__listeners = {};
            this.on = function (event, handler) {
                (this.__listeners[event] ??= []).push(handler);
            };
            this.off = function (event, handler) {
                const handlers = this.__listeners[event] ?? [];
                this.__listeners[event] = handlers.filter((candidate) => candidate !== handler);
            };
        },
    };
}

/**
 * Minimal stand-in for `fabric.Canvas`. The factory reads
 * `getWidth()` / `getHeight()` for placement math and may call
 * `setDimensions`, `add`, `bringObjectToFront`, `setActiveObject`,
 * `discardActiveObject`, and `renderAll` / `requestRenderAll` along the
 * post-construct path.
 */
function makeCanvas() {
    let width = 800;
    let height = 600;
    return {
        objects: [],
        getWidth() {
            return width;
        },
        getHeight() {
            return height;
        },
        add(o) {
            this.objects.push(o);
        },
        remove(o) {
            this.objects = this.objects.filter((candidate) => candidate !== o);
        },
        getObjects() {
            return [...this.objects];
        },
        bringObjectToFront() {},
        setActiveObject() {},
        discardActiveObject() {},
        setDimensions(nextDimensions) {
            if (typeof nextDimensions.width === 'number') width = nextDimensions.width;
            if (typeof nextDimensions.height === 'number') height = nextDimensions.height;
        },
        renderAll() {},
        requestRenderAll() {},
    };
}

/**
 * Build a fully wired `CreateMaskContext` over the mocks above. The
 * counter and `lastMask` slots are owned here (mirroring the
 * orchestrator's ownership in `image-editor.ts`) so each iteration
 * starts from a clean state.
 */
function makeContext(overrides = {}) {
    const canvas = makeCanvas();
    const options = resolveOptions(overrides.options ?? {});
    const state = { counter: 0, lastMask: null };
    return {
        fabric: makeFabric(),
        canvas,
        options,
        getLastMask: () => state.lastMask,
        setLastMask: (m) => {
            state.lastMask = m;
        },
        getMaskCounter: () => state.counter,
        setMaskCounter: (n) => {
            state.counter = n;
        },
        updateMaskList: () => {},
        saveCanvasState: () => {},
        removeLabelForMask: () => {},
    };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

/**
 * Shapes covered by the per-shape origin contract. Polygon placement
 * has its own dedicated property; the factory's polygon path reads
 * `originX: 'left'` / `originY: 'top'` from the same `originProps`
 * literal, so the rect/circle/ellipse sample is sufficient here.
 */
const shapeArb = fc.constantFrom('rect', 'circle', 'ellipse');

/**
 * `strokeWidth` values that the factory MUST preserve verbatim. `0` is
 * the canonical falsy sample; finite positive numbers round-trip too so
 * the same property covers both branches.
 */
const strokeWidthArb = fc.constantFrom(0, 1, 5, null);

/**
 * `stroke` values that exercise the falsy-style preservation contract.
 * `null` and `''` MUST NOT be replaced by the `'#ccc'` fallback.
 */
const strokeArb = fc.constantFrom('red', null, '', '#fff');

// ─── Properties ─────────────────────────────────────────────────────────────

test('maskUid is derived from editor-owned maskId instead of process-global state', () => {
    const firstContext = makeContext();
    const first = createMask(firstContext, { shape: 'rect' });
    const second = createMask(firstContext, { shape: 'rect' });

    const secondContext = makeContext();
    const isolated = createMask(secondContext, { shape: 'rect' });

    assert.equal(first.maskUid, 'mask-1');
    assert.equal(second.maskUid, 'mask-2');
    assert.equal(isolated.maskUid, 'mask-1');
});

test('invalid fabricGenerator result is rejected without canvas or history writes', () => {
    const warnings = [];
    const ctx = makeContext({
        options: {
            onWarning: (error, message) => {
                warnings.push({ error, message });
            },
        },
    });
    let counter = 0;
    let counterWrites = 0;
    let listUpdates = 0;
    let saveCalls = 0;
    ctx.getMaskCounter = () => counter;
    ctx.setMaskCounter = (next) => {
        counter = next;
        counterWrites += 1;
    };
    ctx.updateMaskList = () => {
        listUpdates += 1;
    };
    ctx.saveCanvasState = () => {
        saveCalls += 1;
    };

    const result = createMask(ctx, { fabricGenerator: () => null });

    assert.equal(result, null, 'invalid custom generator result must be rejected');
    assert.equal(ctx.canvas.objects.length, 0, 'no invalid mask must be added');
    assert.equal(counter, 0, 'mask counter must remain unchanged');
    assert.equal(counterWrites, 0, 'mask counter setter must not run');
    assert.equal(listUpdates, 0, 'mask list must not update');
    assert.equal(saveCalls, 0, 'history must not be saved');
    assert.equal(warnings.length, 1, 'invalid generator must emit one warning');
    assert.match(warnings[0].message, /fabricGenerator/);
});

test('throwing fabricGenerator warns and rolls back expand sizing before returning null', () => {
    const warnings = [];
    const ctx = makeContext({
        options: {
            onWarning: (error, message) => {
                warnings.push({ error, message });
            },
        },
    });
    const initialWidth = ctx.canvas.getWidth();
    const initialHeight = ctx.canvas.getHeight();

    const result = createMask(ctx, {
        left: initialWidth - 5,
        width: 50,
        fabricGenerator: () => {
            throw new Error('generator failed');
        },
    });

    assert.equal(result, null, 'throwing custom generator must abort mask creation');
    assert.equal(ctx.canvas.objects.length, 0, 'no mask must be added after generator failure');
    assert.equal(ctx.canvas.getWidth(), initialWidth, 'failed generator must roll back width');
    assert.equal(ctx.canvas.getHeight(), initialHeight, 'failed generator must roll back height');
    assert.equal(warnings.length, 1, 'throwing generator must emit one warning');
    assert.match(warnings[0].message, /fabricGenerator threw/);
    assert.equal(warnings[0].error.message, 'generator failed');
});

test('invalid mask configs are rejected without canvas, counter, list, or history writes', () => {
    const cases = [
        { width: 'abc' },
        { width: -1 },
        { left: () => Infinity },
        {
            left: () => {
                throw new Error('left failed');
            },
        },
        { shape: 'polygon', points: [] },
        {
            shape: 'polygon',
            points: [
                [0, 0],
                [10, 10],
                [20, 20],
            ],
        },
        {
            shape: 'polygon',
            points: [
                [5, 5],
                [5, 5],
                [5, 5],
            ],
        },
        {
            shape: 'polygon',
            points: [
                [0, 0],
                ['x', 1],
                [2, 2],
            ],
        },
        { shape: 'circle', radius: Number.NaN },
        { fabricGenerator: () => ({}) },
    ];

    for (const config of cases) {
        const warnings = [];
        const ctx = makeContext({
            options: {
                onWarning: (error, message) => {
                    warnings.push({ error, message });
                },
            },
        });
        let counter = 0;
        let counterWrites = 0;
        let listUpdates = 0;
        let saveCalls = 0;
        ctx.getMaskCounter = () => counter;
        ctx.setMaskCounter = (next) => {
            counter = next;
            counterWrites += 1;
        };
        ctx.updateMaskList = () => {
            listUpdates += 1;
        };
        ctx.saveCanvasState = () => {
            saveCalls += 1;
        };

        const result = createMask(ctx, config);

        assert.equal(result, null, `invalid config must be rejected: ${JSON.stringify(config)}`);
        assert.equal(ctx.canvas.objects.length, 0, 'invalid mask must not be added');
        assert.equal(counter, 0, 'mask counter must remain unchanged');
        assert.equal(counterWrites, 0, 'mask counter setter must not run');
        assert.equal(listUpdates, 0, 'mask list must not update');
        assert.equal(saveCalls, 0, 'history must not be saved');
        assert.equal(warnings.length, 1, 'invalid config must emit one warning');
    }
});

test('per-shape origin is left/top for rect, circle, ellipse', () => {
    fc.assert(
        fc.property(shapeArb, (shape) => {
            const ctx = makeContext();
            const mask = createMask(ctx, { shape });

            assert.ok(mask, 'mask must be created');
            assert.equal(
                mask.originX,
                'left',
                `the documented contract: ${shape} mask must use originX='left'`,
            );
            assert.equal(
                mask.originY,
                'top',
                `the documented contract: ${shape} mask must use originY='top'`,
            );
        }),
        { numRuns: 30 },
    );
});

test('falsy styles in config.styles are preserved verbatim', () => {
    fc.assert(
        fc.property(shapeArb, strokeWidthArb, strokeArb, (shape, strokeWidth, stroke) => {
            const ctx = makeContext();
            // Only include keys that were generated as defined so
            // that the absence of a key tests the default branch
            // and the presence (even with falsy values) tests the
            // verbatim-pass-through branch.
            const styles = {};
            if (strokeWidth !== undefined) {
                styles.strokeWidth = strokeWidth;
            }
            if (stroke !== undefined) {
                styles.stroke = stroke;
            }

            const mask = createMask(ctx, { shape, styles });

            assert.ok(mask, 'mask must be created');
            // `Object.is` so `0`, `''`, `null`, and `NaN` compare
            // by identity rather than coercion.
            assert.ok(
                Object.is(mask.strokeWidth, strokeWidth),
                `the documented contract: strokeWidth must round-trip verbatim (got ${
                    mask.strokeWidth
                }, expected ${strokeWidth})`,
            );
            assert.ok(
                Object.is(mask.stroke, stroke),
                `the documented contract: stroke must round-trip verbatim (got ${
                    mask.stroke
                }, expected ${stroke})`,
            );
        }),
        { numRuns: 30 },
    );
});

test('explicit false on hasControls/selectable is preserved', () => {
    fc.assert(
        fc.property(shapeArb, fc.boolean(), fc.boolean(), (shape, hasControls, selectable) => {
            const ctx = makeContext();
            const mask = createMask(ctx, {
                shape,
                hasControls,
                selectable,
            });

            assert.ok(mask, 'mask must be created');
            assert.equal(
                mask.hasControls,
                hasControls,
                `the documented contract: hasControls=${hasControls} must be preserved`,
            );
            assert.equal(
                mask.selectable,
                selectable,
                `the documented contract: selectable=${selectable} must be preserved`,
            );
        }),
        { numRuns: 30 },
    );
});

test('evented option is applied with documented defaults', () => {
    for (const expected of [undefined, true, false]) {
        const ctx = makeContext();
        const config = { shape: 'rect' };
        if (expected !== undefined) config.evented = expected;

        const mask = createMask(ctx, config);

        assert.ok(mask, 'mask must be created');
        assert.equal(
            mask.evented,
            expected === undefined ? true : expected,
            `evented=${expected} must resolve to the documented runtime value`,
        );
    }
});

test('defaultMaskConfig color and alpha are applied to createMask()', () => {
    const ctx = makeContext({
        options: {
            defaultMaskConfig: {
                color: 'rgba(255, 0, 0, 0.35)',
                alpha: 0.35,
            },
        },
    });

    const mask = createMask(ctx);

    assert.ok(mask, 'mask must be created');
    assert.equal(mask.fill, 'rgba(255, 0, 0, 0.35)');
    assert.equal(mask.opacity, 0.35);
    assert.equal(mask.originalAlpha, 0.35);
});

test('defaultMaskConfig styles are applied to createMask()', () => {
    const ctx = makeContext({
        options: {
            defaultMaskConfig: {
                styles: {
                    stroke: '#ff0000',
                    strokeWidth: 2,
                    strokeDashArray: [6, 4],
                },
            },
        },
    });

    const mask = createMask(ctx);

    assert.ok(mask, 'mask must be created');
    assert.equal(mask.stroke, '#ff0000');
    assert.equal(mask.strokeWidth, 2);
    assert.deepEqual(mask.strokeDashArray, [6, 4]);
});

test('per-call createMask config overrides defaultMaskConfig', () => {
    const ctx = makeContext({
        options: {
            defaultMaskConfig: {
                color: 'rgba(255, 0, 0, 0.35)',
                width: 120,
                height: 90,
                styles: {
                    stroke: '#ff0000',
                    strokeWidth: 2,
                },
            },
        },
    });

    const mask = createMask(ctx, {
        color: 'rgba(0, 128, 255, 0.35)',
        width: 200,
        styles: {
            stroke: '#0080ff',
        },
    });

    assert.ok(mask, 'mask must be created');
    assert.equal(mask.fill, 'rgba(0, 128, 255, 0.35)');
    assert.equal(mask.width, 200);
    assert.equal(mask.height, 90);
    assert.equal(mask.stroke, '#0080ff');
    assert.equal(mask.strokeWidth, 2);
});

test('legacy defaultMaskWidth and defaultMaskHeight still set mask size', () => {
    const ctx = makeContext({
        options: {
            defaultMaskWidth: 51,
            defaultMaskHeight: 82,
        },
    });

    const mask = createMask(ctx);

    assert.ok(mask, 'mask must be created');
    assert.equal(mask.width, 51);
    assert.equal(mask.height, 82);
});

test('defaultMaskConfig width and height override legacy mask size options', () => {
    const ctx = makeContext({
        options: {
            defaultMaskWidth: 50,
            defaultMaskHeight: 80,
            defaultMaskConfig: {
                width: 120,
                height: 90,
            },
        },
    });

    const mask = createMask(ctx);

    assert.ok(mask, 'mask must be created');
    assert.equal(mask.width, 120);
    assert.equal(mask.height, 90);
});

test('defaultMaskConfig preserves explicit falsy flags and styles', () => {
    const ctx = makeContext({
        options: {
            defaultMaskConfig: {
                selectable: false,
                evented: false,
                hasControls: false,
                transparentCorners: false,
                strokeUniform: false,
                styles: {
                    stroke: null,
                    strokeWidth: 0,
                    strokeDashArray: [],
                },
            },
        },
    });

    const mask = createMask(ctx);

    assert.ok(mask, 'mask must be created');
    assert.equal(mask.selectable, false);
    assert.equal(mask.evented, false);
    assert.equal(mask.hasControls, false);
    assert.equal(mask.transparentCorners, false);
    assert.equal(mask.strokeUniform, false);
    assert.equal(mask.stroke, null);
    assert.equal(mask.strokeWidth, 0);
    assert.deepEqual(mask.strokeDashArray, []);
});

test('throwing onCreate callback is isolated after committed mask creation', () => {
    const callbackError = new Error('onCreate failed');
    const warnings = [];
    const ctx = makeContext({
        options: {
            onWarning: (error, message) => {
                warnings.push({ error, message });
            },
        },
    });
    let saveCalls = 0;
    ctx.saveCanvasState = () => {
        saveCalls += 1;
    };

    const mask = createMask(ctx, {
        shape: 'rect',
        onCreate: () => {
            throw callbackError;
        },
    });

    assert.ok(mask, 'mask must still be returned');
    assert.equal(ctx.canvas.objects.includes(mask), true, 'mask must remain on the canvas');
    assert.equal(saveCalls, 1, 'history save must still happen before onCreate');
    assert.equal(warnings.length, 1, 'throwing onCreate must report one warning');
    assert.equal(warnings[0].error, callbackError);
    assert.match(warnings[0].message, /onCreate/);
});

test('transparentCorners and strokeUniform falsy values preserved with documented defaults', () => {
    fc.assert(
        fc.property(
            shapeArb,
            // `undefined` exercises the "not in config" branch which
            // must fall back to the documented default (false for
            // transparentCorners, true for strokeUniform). `true` /
            // `false` exercise the explicit-pass-through branch.
            fc.constantFrom(undefined, true, false),
            fc.constantFrom(undefined, true, false),
            (shape, transparentCorners, strokeUniform) => {
                const ctx = makeContext();
                const config = { shape };
                if (transparentCorners !== undefined) {
                    config.transparentCorners = transparentCorners;
                }
                if (strokeUniform !== undefined) {
                    config.strokeUniform = strokeUniform;
                }

                const mask = createMask(ctx, config);

                assert.ok(mask, 'mask must be created');

                // Documented defaults from `mask-factory.ts`:
                //   - transparentCorners → false when omitted.
                //   - strokeUniform → true when omitted.
                const expectedTC = transparentCorners === undefined ? false : transparentCorners;
                const expectedSU = strokeUniform === undefined ? true : strokeUniform;

                assert.equal(
                    mask.transparentCorners,
                    expectedTC,
                    `the documented contract: transparentCorners=${transparentCorners} → ${expectedTC}`,
                );
                assert.equal(
                    mask.strokeUniform,
                    expectedSU,
                    `the documented contract: strokeUniform=${strokeUniform} → ${expectedSU}`,
                );
            },
        ),
        { numRuns: 30 },
    );
});

test('createMask preserves custom stroke through select and unselect styling', () => {
    const ctx = makeContext();
    const mask = createMask(ctx, {
        shape: 'rect',
        styles: {
            stroke: '#123456',
            strokeWidth: 4,
        },
    });

    assert.ok(mask, 'mask must be created');
    assert.equal(mask.originalStroke, '#123456');
    assert.equal(mask.originalStrokeWidth, 4);

    applyMaskSelectedStyle(mask);
    assert.equal(mask.stroke, '#ff0000');
    assert.equal(mask.strokeWidth, 1);

    applyMaskUnselectedStyle(mask);
    assert.equal(mask.stroke, '#123456');
    assert.equal(mask.strokeWidth, 4);
});

test('removeAllMasks detaches hover handlers from removed mask objects', () => {
    const ctx = makeContext();
    const mask = createMask(ctx, { shape: 'rect' });

    assert.ok(mask, 'mask must be created');
    assert.equal(mask.__listeners.mouseover.length, 1);
    assert.equal(mask.__listeners.mouseout.length, 1);
    assert.ok(mask.imageEditorMaskHandlers, 'hover handler tag must be attached');

    removeAllMasks(ctx, { saveHistory: false });

    assert.equal(ctx.canvas.objects.length, 0, 'mask must be removed from the canvas');
    assert.equal(mask.__listeners.mouseover.length, 0, 'mouseover handler must be detached');
    assert.equal(mask.__listeners.mouseout.length, 0, 'mouseout handler must be detached');
    assert.equal(mask.imageEditorMaskHandlers, undefined, 'hover handler tag must be cleared');
});
