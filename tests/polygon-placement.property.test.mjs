/**
 * @file polygon-placement.property.test.mjs
 *
 * Type:
 *   Property test
 *
 * Purpose:
 *   Verifies the polygon branch of src/mask/mask-factory.ts and point coercion from
 *   src/utils/number.ts. The suite models Fabric polygon bounding behavior so the
 *   factory's top-left realignment can be asserted without a live Fabric canvas.
 *
 * Scope:
 *   - Polygon points supplied as objects or tuples produce equivalent geometry.
 *   - The visual bounding rectangle lands at the requested left and top.
 *   - The mock exposes only the geometry behavior needed for the placement contract.
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
 *   node --test tests/polygon-placement.property.test.mjs
 *
 * Notes:
 *   - Prefer behavior-level assertions over implementation-detail checks.
 *   - Keep this file focused on polygon bounding-box placement only.
 */

import { register } from 'node:module';

register('./helpers/ts-resolve-hook.mjs', import.meta.url);

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fc from 'fast-check';

const { createMask } = await import('../src/mask/mask-factory.ts');
const { resolveOptions } = await import('../src/core/default-options.ts');

// ─── Mocks ─────────────────────────────────────────────────────────────────

/**
 * Fake Fabric module sufficient to drive `createMask` through the
 * polygon branch.
 *
 * The Polygon constructor mimics Fabric v7's `pathOffset` behavior at
 * the level of detail needs: a polygon constructed without
 * `left` / `top` defaults to `(0, 0)`, and its `getBoundingRect()` is
 * shifted by `(-minX, -minY)` relative to `(this.left, this.top)`. The
 * factory's delta-shift then lands the rendered bounding box at the
 * requested `(left, top)`.
 *
 * The other shape constructors are present only so the module shape
 * matches `FabricModule` — they are not exercised by these tests.
 */
function makeFabric() {
    const noopShape = function (props) {
        Object.assign(this, props);
        this.set = function (p, v) {
            if (typeof p === 'string') this[p] = v;
            else Object.assign(this, p);
        };
        this.setCoords = function () {};
        this.getBoundingRect = function () {
            return {
                left: this.left ?? 0,
                top: this.top ?? 0,
                width: this.width ?? 0,
                height: this.height ?? 0,
            };
        };
        this.on = function () {};
    };

    return {
        Rect: noopShape,
        Circle: noopShape,
        Ellipse: noopShape,
        Polygon: function Polygon(pts, props) {
            // The factory passes pts already coerced to `{ x, y }` via
            // `coercePoint`. Compute the geometry inputs once.
            const xs = pts.map((p) => p.x);
            const ys = pts.map((p) => p.y);
            const minX = Math.min(...xs);
            const maxX = Math.max(...xs);
            const minY = Math.min(...ys);
            const maxY = Math.max(...ys);

            Object.assign(this, { type: 'polygon', points: pts, ...props });
            this._minX = minX;
            this._minY = minY;
            this._width = maxX - minX;
            this._height = maxY - minY;

            this.set = function (p, v) {
                if (typeof p === 'string') this[p] = v;
                else Object.assign(this, p);
            };
            this.setCoords = function () {};
            this.getBoundingRect = function () {
                // Simulate Fabric v7: with no explicit left/top supplied,
                // `this.left` / `this.top` start at 0 and the bounding
                // rect is shifted by (-minX, -minY) from (this.left,
                // this.top). After the factory's delta-shift the
                // bounding rect lands at the requested (left, top).
                return {
                    left: (this.left ?? 0) - this._minX,
                    top: (this.top ?? 0) - this._minY,
                    width: this._width,
                    height: this._height,
                };
            };
            this.on = function () {};
        },
    };
}

/**
 * Minimal stand-in for `fabric.Canvas`. Only the methods the factory
 * touches in the polygon branch are implemented.
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
function makeContext() {
    const canvas = makeCanvas();
    const options = resolveOptions({});
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
 * A polygon vertex in object form. Coordinates are kept inside a
 * conservative window so the resulting bounding box fits well within
 * the 800x600 mock canvas regardless of where it is placed.
 */
const pointObjArb = fc.record({
    x: fc.integer({ min: -200, max: 200 }),
    y: fc.integer({ min: -200, max: 200 }),
});

/**
 * 3 to 6 vertices is enough to cover degenerate-ish (3-vertex) polygons
 * up through the typical concave hexagons users draw with the polygon
 * tool, while keeping the geometry compact.
 */
const polygonPointsArb = fc.array(pointObjArb, { minLength: 3, maxLength: 6 });

/**
 * Target placement coordinates. The window is wide enough to exercise
 * non-trivial deltas vs. the polygon's intrinsic minX/minY but stays
 * inside the mock canvas.
 */
const placementArb = fc.record({
    left: fc.integer({ min: 0, max: 400 }),
    top: fc.integer({ min: 0, max: 300 }),
});

// ─── Properties ─────────────────────────────────────────────────────────────

test(
    "polygon bounding-rect top-left equals requested (left, top)",
    () => {
        fc.assert(
            fc.property(
                polygonPointsArb,
                placementArb,
                (points, { left, top }) => {
                    const ctx = makeContext();
                    const mask = createMask(ctx, {
                        shape: 'polygon',
                        points,
                        left,
                        top,
                    });

                    assert.ok(mask, 'polygon mask must be created');

                    const br = mask.getBoundingRect();
                    assert.equal(
                        br.left,
                        left,
                        `the documented contract: bounding rect left must equal requested left (got ${br.left}, expected ${left})`,
                    );
                    assert.equal(
                        br.top,
                        top,
                        `the documented contract: bounding rect top must equal requested top (got ${br.top}, expected ${top})`,
                    );
                },
            ),
            { numRuns: 30 },
        );
    },
);

test(
    "{x,y} object and [x,y] tuple point forms produce identical polygons",
    () => {
        fc.assert(
            fc.property(
                polygonPointsArb,
                placementArb,
                (points, { left, top }) => {
                    // Same coordinates expressed in the two accepted
                    // input forms.
                    const objectForm = points.map((p) => ({ x: p.x, y: p.y }));
                    const tupleForm = points.map((p) => [p.x, p.y]);

                    const ctxA = makeContext();
                    const ctxB = makeContext();

                    const maskA = createMask(ctxA, {
                        shape: 'polygon',
                        points: objectForm,
                        left,
                        top,
                    });
                    const maskB = createMask(ctxB, {
                        shape: 'polygon',
                        points: tupleForm,
                        left,
                        top,
                    });

                    assert.ok(maskA, 'object-form polygon must be created');
                    assert.ok(maskB, 'tuple-form polygon must be created');

                    // After `coercePoint`, both forms must produce the
                    // same numeric `{ x, y }` vertex list.
                    assert.deepEqual(
                        maskA.points,
                        maskB.points,
                        'the documented contract: coerced polygon points must match',
                    );

                    // The factory's bounding-box realignment must
                    // produce identical rendered geometry for both
                    // input forms.
                    const brA = maskA.getBoundingRect();
                    const brB = maskB.getBoundingRect();
                    assert.deepEqual(
                        brA,
                        brB,
                        'the documented contract: bounding rect must match across input forms',
                    );

                    // The post-shift left/top of the polygon object
                    // itself must also agree, since the delta-shift is
                    // computed from the same coerced geometry.
                    assert.equal(
                        maskA.left,
                        maskB.left,
                        'the documented contract: polygon.left must match across input forms',
                    );
                    assert.equal(
                        maskA.top,
                        maskB.top,
                        'the documented contract: polygon.top must match across input forms',
                    );
                },
            ),
            { numRuns: 30 },
        );
    },
);
