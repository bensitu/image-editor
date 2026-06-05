/**
 * Pure helpers used by `mask/mask-factory.ts` to turn the
 * flexible `MaskNumericProp` and `PolygonPoint` inputs of
 * {@link MaskConfig} into concrete numbers and `{ x, y }`
 * points before a Fabric.js shape is constructed.
 *
 * ## Owned contracts
 *
 * - `MaskConfig` percentage values supplied for
 *   `left`, `width`, `rx`, or `radius` SHALL resolve against the canvas
 *   pixel **width** (axis `'x'`).
 * - `MaskConfig` percentage values supplied for
 *   `top`, `height`, or `ry` SHALL resolve against the canvas pixel
 *   **height** (axis `'y'`).
 * - A `MaskNumericProp` provided as a function
 *   SHALL be invoked with `(canvas, ResolvedOptions)` and the returned
 *   number used directly.
 * - Polygon point items SHALL be accepted in
 *   either `{ x, y }` object form or `[x, y]` tuple form and coerced to
 *   numeric `{ x, y }` internally.
 *
 * ## Why a dedicated module
 *
 * `resolveNumeric` is axis-aware so horizontal values resolve against
 * canvas width and vertical values resolve against canvas height.
 * `coercePoint` lives next to it because both helpers are pure functions
 * consumed by the same mask-factory pipeline.
 *
 * ## Design notes
 *
 * - `resolveNumeric` is total: any input that is not a number, a finite
 *   percentage string, or a function falls through to `fallback` rather
 *   than throwing.
 * - Percentages are floored (`Math.floor`) to keep rendered placement
 *   deterministic across canvas resizes.
 * - The helper does NOT clamp the result against canvas bounds; callers
 *   are responsible for any subsequent clamping (the mask factory may
 *   expand the canvas to accommodate larger placements when
 *   `expandCanvasToImage` is enabled).
 *
 * ## Non-goals
 *
 * - This module does not validate that the supplied `axis` matches the
 *   field being resolved. Routing each `MaskConfig` field to the correct
 *   axis is the mask factory's responsibility.
 * - This module does not coerce or round the output of factory functions
 *   (`(canvas, options) => number`); their return value is used verbatim
 *   so consumers retain full control over sub-pixel placement.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { MaskNumericProp, PolygonPoint, ResolvedOptions } from '../core/public-types.js';
/**
 * Axis selector used by {@link resolveNumeric} to decide which canvas
 * dimension a percentage value resolves against.
 *
 * - `'x'` → `canvas.getWidth`
 * - `'y'` → `canvas.getHeight`
 */
export type Axis = 'x' | 'y';
/**
 * Resolve a {@link MaskNumericProp} into a concrete pixel number.
 *
 * Resolution rules (in order):
 * 1. If `val` is a `number`, return it unchanged.
 * 2. If `val` is a function, invoke it as `val(canvas, options)` and
 *    return the result.
 * 3. If `val` is a string ending in `'%'`, parse the leading number,
 *    multiply by `canvas.getWidth` (axis `'x'`) or
 *    `canvas.getHeight` (axis `'y'`), floor the product, and return
 *    it. Strings that do not parse to a
 *    finite number fall through to `fallback`.
 * 4. Anything else (including `undefined`, `null`, non-percent strings,
 *    booleans, etc.) returns `fallback`.
 *
 * @example
 * ```ts
 * // 50% of an 800px-wide canvas:
 * resolveNumeric('50%', 'x', 0, canvas, options); // → 400
 *
 * // Function form receives the live canvas and ResolvedOptions:
 * resolveNumeric(
 *   (canvas) => canvas.getWidth() - 20,
 *   'x',
 *   0,
 *   canvas,
 *   options,
 * ); // → canvas.getWidth() - 20
 *
 * // Unrecognized input falls back:
 * resolveNumeric(undefined, 'x', 10, canvas, options); // → 10
 * ```
 *
 * @param val - The flexible mask numeric property to resolve.
 * @param axis - Which canvas dimension a percentage resolves against.
 * @param fallback - Value returned when `val` cannot be resolved.
 * @param canvas - Live Fabric.js canvas; only `getWidth`/`getHeight`
 *                 are read here, but the entire canvas is forwarded to
 *                 factory functions.
 * @param options - Fully-resolved editor options forwarded to factory
 *                 functions.
 *
 * @returns The resolved pixel number, or `fallback` when no rule applies.
 */
export declare function resolveNumeric(val: MaskNumericProp | undefined, axis: Axis, fallback: number, canvas: FabricNS.Canvas, options: ResolvedOptions): number;
/**
 * Coerce a {@link PolygonPoint} into the canonical `{ x, y }` numeric
 * shape used by Fabric.js polygon construction.
 *
 * Both input forms are accepted so callers may write polygon points in
 * whichever style is most ergonomic at the call site:
 *
 * ```ts
 * coercePoint({ x: 10, y: 20 }); // → { x: 10, y: 20 }
 * coercePoint([10, 20]); // → { x: 10, y: 20 }
 * ```
 *
 * Values are coerced via `Number(...)` so string-encoded coordinates
 * (e.g. coming straight from a JSON payload) round-trip correctly. Any
 * value that fails to coerce becomes `NaN`, matching the rest of the
 * mask pipeline's tolerant input handling — callers that need stricter
 * validation should perform it before constructing the polygon.
 *
 * @param pt - A polygon vertex in object or tuple form.
 * @returns An `{ x, y }` numeric point.
 */
export declare function coercePoint(pt: PolygonPoint): {
    x: number;
    y: number;
};
//# sourceMappingURL=number.d.ts.map