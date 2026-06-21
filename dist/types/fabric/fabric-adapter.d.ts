/**
 * Detects the Fabric.js v7 module from the constructor's
 * first argument or from `globalThis.fabric`, and reports
 * whether a usable module was found.
 *
 * Two delivery channels share the same source tree:
 *
 *  1. **ESM consumers** pass the imported Fabric module explicitly:
 *   `new ImageEditor(fabric, options)`. Detected by `Canvas` being a
 *   function on the first argument.
 *
 *  2. **UMD / CDN consumers** rely on `<script>` tags exposing
 *   `window.fabric`, and call `new ImageEditor(options)` with no module
 *   argument. The adapter reads `globalScope.fabric` and treats the
 *   first argument as options.
 *
 * If neither channel produces a Fabric module with a `Canvas` constructor,
 * the adapter returns `{ fabric: null, isFabricLoaded: false}`. The caller
 * (the {@link ImageEditor} constructor) is then expected to make `init`
 * and `loadImage` no-ops that resolve to `undefined`.
 *
 * Wrapping policy: this adapter does NOT proxy or normalize Fabric APIs.
 * Callers MUST only invoke Fabric v7-compatible APIs directly:
 * - `FabricImage.fromURL(...)` returning a Promise
 * - `canvas.loadFromJSON(...)` returning a Promise
 * - `canvas.setDimensions({ width, height})`
 * - `canvas.bringObjectToFront(object)` / `canvas.sendObjectToBack(object)`
 * - `canvas.backgroundColor` as a plain property (no setter callback)
 * - `object.animate(...)` returning `Animation[]` (wrap with a Promise)
 *   (Fabric v7 surface only.)
 *
 * @module
 */
import type { FabricModule, ImageEditorOptions } from '../core/public-types.js';
/**
 * Result of {@link detectFabric}. The caller should:
 *   - store `fabric` and `isFabricLoaded` in the editor runtime,
 *   - use `options` as the ImageEditorOptions partial to feed into
 *     `core/default-options.ts`.
 *
 * `isFabricLoaded === false` means no usable Fabric module was found and
 * `fabric` is `null`. The constructor SHALL guard `init` and
 * `loadImage` accordingly.
 */
export interface FabricDetectionResult {
    /** The detected Fabric module, or `null` when no module is available. */
    fabric: FabricModule | null;
    /** `true` iff `fabric` is non-null and `fabric.Canvas` is a function. */
    isFabricLoaded: boolean;
    /** The options partial extracted from the constructor arguments. */
    options: ImageEditorOptions;
}
/**
 * Detects whether the constructor's first argument is the Fabric module or
 * an `ImageEditorOptions` object, and finds Fabric in the appropriate place.
 *
 * Behavior matrix:
 *
 * | First arg                                         | Result                                                       |
 * | ------------------------------------------------- | ------------------------------------------------------------ |
 * | Has `Canvas` function property                    | `{ fabric: arg, isFabricLoaded: true, options: maybeOptions}` |
 * | Lacks `Canvas`, `globalScope.fabric.Canvas` is callback | `{ fabric: globalScope.fabric, isFabricLoaded: true, options: arg}` |
 * | Lacks `Canvas`, no usable global                  | `{ fabric: null, isFabricLoaded: false, options: arg}` + single `console.error` |
 *
 * `null` / `undefined` first argument is normalized to an empty options
 * object before being returned.
 *
 * @param fabricOrOptions - Constructor's first argument: either a Fabric module or an options partial.
 * @param maybeOptions - Constructor's second argument, only consulted in the explicit-module form.
 * @param globalScope - Global scope to consult for the UMD fallback. Defaults to `globalThis`; a custom scope is accepted to keep the adapter unit-testable.
 *
 */
export declare function detectFabric(fabricOrOptions: FabricModule | ImageEditorOptions | null | undefined, maybeOptions: ImageEditorOptions | undefined, globalScope?: typeof globalThis): FabricDetectionResult;
//# sourceMappingURL=fabric-adapter.d.ts.map