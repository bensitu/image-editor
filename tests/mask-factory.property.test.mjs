// Mask creation per-shape origin and falsy styles
//
//   For any supported mask shape (`rect`, `circle`, `ellipse`, `polygon`)
//   or custom `fabricGenerator`, the created mask SHALL use
//   `originX: 'left'` and `originY: 'top'` when placement uses top-left
//   coordinates. Falsy style values such as `0`, empty string, or
//   `false` SHALL be preserved through creation instead of being
//   replaced by defaults.
//
// Owner module under test: `src/mask/mask-factory.ts`.
//
// ─── Scope of this test ─────────────────────────────────────────────────────
//
// This test isolates `createMask` from a real Fabric module so we can
// observe the exact properties that land on the constructed mask object.
//
// Behavior preserved by the mask factory:
//
//   - For `'rect' | 'circle' | 'ellipse'`, the factory passes
//     `originX: 'left'` and `originY: 'top'` into the Fabric shape
//     constructor.
//   - The `'foo' in config` membership check on `hasControls`,
//     `selectable`, `transparentCorners`, and `strokeUniform` preserves
//     an explicit `false` instead of falling back to the default (Contract
//     22.2).
//   - The `'stroke' in styles` / `'strokeWidth' in styles` membership
//     check pulls falsy values (`0`, `null`, `''`) out of the user's
//     `styles` block verbatim.
//
// Mocked Fabric shapes are plain objects whose constructors assign the
// supplied props (so `originX`, `originY`, and `styles` flow through to
// the result object); the canvas mock implements only the methods the
// factory calls.
//
// `numRuns: 30` matches the surrounding mask-factory property tests
// (see scale-clamp / reset-transform). Each iteration constructs a
// fresh context and exercises the full `createMask` pipeline.

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { createMask } = await import('../src/mask/mask-factory.ts');
const { applyMaskSelectedStyle, applyMaskUnselectedStyle } = await import(
    '../src/mask/mask-style.ts'
);
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
            this.on = function () {};
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
            this.on = function () {};
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
    return {
        objects: [],
        getWidth() {
            return 800;
        },
        getHeight() {
            return 600;
        },
        add(o) {
            this.objects.push(o);
        },
        bringObjectToFront() {},
        setActiveObject() {},
        discardActiveObject() {},
        setDimensions() {},
        renderAll() {},
        requestRenderAll() {},
    };
}

/**
 * Build a fully wired `CreateMaskContext` over the mocks above. The
 * counter and `_lastMask` slots are owned here (mirroring the
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
    };
}

// ─── Arbitraries ───────────────────────────────────────────────────────────

/**
 * Shapes covered by 's per-shape origin clause. Polygon
 * placement is covered by its own dedicated property (19); the
 * factory's polygon path reads `originX: 'left'` / `originY: 'top'`
 * from the same `originProps` literal so the rect/circle/ellipse
 * sample is sufficient to validate the the documented contract contract here.
 */
const shapeArb = fc.constantFrom('rect', 'circle', 'ellipse');

/**
 * `strokeWidth` values that the factory MUST preserve verbatim (Contract
 * 22.1). `0` is the canonical falsy sample; finite positive numbers
 * round-trip too so the same property covers both branches.
 */
const strokeWidthArb = fc.constantFrom(0, 1, 5, null);

/**
 * `stroke` values that exercise the falsy-style preservation contract.
 * `null` and `''` MUST NOT be replaced by the `'#ccc'` fallback (Contract
 * 22.1).
 */
const strokeArb = fc.constantFrom('red', null, '', '#fff');

// ─── Properties ─────────────────────────────────────────────────────────────

test(
    'per-shape origin is left/top for rect, circle, ellipse',
    () => {
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
    },
);

test(
    'falsy styles in config.styles are preserved verbatim',
    () => {
        fc.assert(
            fc.property(
                shapeArb,
                strokeWidthArb,
                strokeArb,
                (shape, strokeWidth, stroke) => {
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
                },
            ),
            { numRuns: 30 },
        );
    },
);

test(
    'explicit false on hasControls/selectable is preserved',
    () => {
        fc.assert(
            fc.property(
                shapeArb,
                fc.boolean(),
                fc.boolean(),
                (shape, hasControls, selectable) => {
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
                },
            ),
            { numRuns: 30 },
        );
    },
);

test(
    'transparentCorners and strokeUniform falsy values preserved with documented defaults',
    () => {
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
                    const expectedTC =
                        transparentCorners === undefined
                            ? false
                            : transparentCorners;
                    const expectedSU =
                        strokeUniform === undefined ? true : strokeUniform;

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
    },
);

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
