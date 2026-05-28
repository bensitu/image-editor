/**
 * @file fabric-adapter.ts
 * @description Detects the Fabric.js v7 module from the constructor's
 *              first argument or from `globalThis.fabric`, and reports
 *              whether a usable module was found.
 *
 * Two delivery channels share the same source tree:
 *
 *  1. **ESM consumers** pass the imported Fabric module explicitly:
 *     `new ImageEditor(fabric, options)`. Detected by `Canvas` being a
 *     function on the first argument.
 *
 *  2. **UMD / CDN consumers** rely on `<script>` tags exposing
 *     `window.fabric`, and call `new ImageEditor(options)` with no module
 *     argument. The adapter reads `globalScope.fabric` and treats the
 *     first argument as options.
 *
 * If neither channel produces a Fabric module with a `Canvas` constructor,
 * the adapter returns `{ fabric: null, _fabricLoaded: false}`. The caller
 * (the {@link ImageEditor} constructor) is then expected to make `init`
 * and `loadImage` no-ops that resolve to `undefined`.
 *
 * Wrapping policy: this adapter does NOT proxy or normalize Fabric APIs.
 * Callers MUST only invoke Fabric v7-compatible APIs directly:
 *   - `FabricImage.fromURL(...)` returning a Promise
 *   - `canvas.loadFromJSON(...)` returning a Promise
 *   - `canvas.setDimensions({ width, height})`
 *   - `canvas.bringObjectToFront(obj)` / `canvas.sendObjectToBack(obj)`
 *   - `canvas.backgroundColor` as a plain property (no setter callback)
 *   - `obj.animate(...)` returning `Animation[]` (wrap with a Promise)
 * (Fabric v7 surface only.)
 */

import type { FabricModule, ImageEditorOptions } from '../core/public-types.js';

// ─── Public result shape ──────────────────────────────────────────────────────

/**
 * Result of {@link detectFabric}. The caller should:
 *   - assign `fabric` and `_fabricLoaded` to private fields on the editor,
 *   - use `options` as the ImageEditorOptions partial to feed into
 *     `core/default-options.ts`.
 *
 * `_fabricLoaded === false` means no usable Fabric module was found and
 * `fabric` is `null`. The constructor SHALL guard `init` and
 * `loadImage` accordingly.
 */
export interface FabricDetectionResult {
    /** The detected Fabric module, or `null` when no module is available. */
    fabric: FabricModule | null;
    /** `true` iff `fabric` is non-null and `fabric.Canvas` is a function. */
    _fabricLoaded: boolean;
    /** The options partial extracted from the constructor arguments. */
    options: ImageEditorOptions;
}

// ─── Internal helpers ─────────────────────────────────────────────────────────

/**
 * Returns `true` when `value` is a non-null object whose `Canvas` property
 * is a function. This is the structural check that distinguishes a Fabric
 * module from an `ImageEditorOptions` partial.
 *
 * The check is intentionally narrow: every Fabric.js v7 module exposes
 * `Canvas` as a constructor function, while no documented option key on
 * `ImageEditorOptions` is named `Canvas`.
 */
function looksLikeFabricModule(value: unknown): value is FabricModule {
    if (value === null || typeof value !== 'object') return false;
    const candidate = (value as { Canvas?: unknown }).Canvas;
    return typeof candidate === 'function';
}

/**
 * Reads `globalScope.fabric` without tripping `noUncheckedIndexedAccess`.
 * Returns the value as-is so the caller can run it through
 * {@link looksLikeFabricModule}. The cast is contained here so the rest of
 * the adapter works in plain typed terms.
 */
function readGlobalFabric(globalScope: typeof globalThis): unknown {
    // `globalThis.fabric` is the documented UMD attachment point. We keep
    // this read defensive because consumers may be running in environments
    // where `globalThis` lacks the property entirely.
    return (globalScope as unknown as { fabric?: unknown }).fabric;
}

// ─── Public detection function ────────────────────────────────────────────────

/**
 * Detects whether the constructor's first argument is the Fabric module or
 * an `ImageEditorOptions` object, and finds Fabric in the appropriate place.
 *
 * Behavior matrix:
 *
 * | First arg                                         | Result                                                       |
 * | ------------------------------------------------- | ------------------------------------------------------------ |
 * | Has `Canvas` function property                    | `{ fabric: arg, _fabricLoaded: true, options: maybeOptions}` |
 * | Lacks `Canvas`, `globalScope.fabric.Canvas` is fn | `{ fabric: globalScope.fabric, _fabricLoaded: true, options: arg}` |
 * | Lacks `Canvas`, no usable global                  | `{ fabric: null, _fabricLoaded: false, options: arg}` + single `console.error` |
 *
 * `null` / `undefined` first argument is normalized to an empty options
 * object before being returned.
 *
 * @param fabricOrOptions  Constructor's first argument: either a Fabric module or an options partial.
 * @param maybeOptions     Constructor's second argument, only consulted in the explicit-module form.
 * @param globalScope      Global scope to consult for the UMD fallback. Defaults to `globalThis`; a custom scope is accepted to keep the adapter unit-testable.
 *
 */
export function detectFabric(
    fabricOrOptions: FabricModule | ImageEditorOptions | null | undefined,
    maybeOptions: ImageEditorOptions | undefined,
    globalScope: typeof globalThis = globalThis,
): FabricDetectionResult {
    // ── Branch 1: explicit module form ───────────────────
    if (looksLikeFabricModule(fabricOrOptions)) {
        return {
            fabric: fabricOrOptions,
            _fabricLoaded: true,
            options: maybeOptions ?? {},
        };
    }

    // ── Branch 2: UMD / global form ────────────────
    // The first argument is treated as options (or empty when null/undefined),
    // and the Fabric module is looked up on `globalScope.fabric`.
    const options: ImageEditorOptions =
        (fabricOrOptions as ImageEditorOptions | null | undefined) ?? {};
    const globalFabric = readGlobalFabric(globalScope);

    if (looksLikeFabricModule(globalFabric)) {
        return {
            fabric: globalFabric,
            _fabricLoaded: true,
            options,
        };
    }

    // ── Branch 3: miss — log once and return a no-op marker ────────────────
    // The constructor calls `detectFabric` exactly once per ImageEditor
    // instance, so logging here yields one descriptive console.error per
    // construction. Subsequent guarded calls on the same
    // instance — `init`, `loadImage` — early-return without re-logging.
    console.error(
        '[ImageEditor] fabric.js v7 is not available. ' +
            'Pass it as the first constructor argument (ESM) or ' +
            'load it as a global <script> before instantiation.',
    );

    return {
        fabric: null,
        _fabricLoaded: false,
        options,
    };
}
