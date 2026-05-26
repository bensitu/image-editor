/**
 * @file dom-bindings.ts
 * @description Managed registry of DOM event listeners owned by the
 *              {@link ImageEditor} facade. Records every listener it adds so
 *              `dispose` can detach them all idempotently.
 *
 * ## Owned contracts
 *
 * - `bindIfExists(key, event, handler)` records the
 *   `{ elementKey, eventType, handler}` triple in an internal registry as
 *   the listener is attached.
 * - `removeAll` iterates the registry, calls
 *   `removeEventListener` for every recorded entry, and clears the registry
 *   afterwards.
 * - Every `removeEventListener` call is wrapped in
 *   `try/catch` so a second `dispose` (or a listener that has already been
 *   detached by other means) never throws. `removeAll` is idempotent.
 * - Every bound handler is wrapped so it consults the
 *   editor's `_disposed` flag (via the `isDisposed` callback supplied to the
 *   constructor) and exits early without touching the canvas while disposed.
 *
 * ## Why this lives in its own module
 *
 * The orchestrator's `dispose` path (see the design's "Idempotent dispose
 * with bindings registry" section) needs to detach DOM listeners without
 * caring about which logical key originally owned each one. Co-locating the
 * registry here keeps the orchestrator free of bookkeeping and lets unit
 * tests exercise the bindings registry without instantiating a full editor
 * (`tests/units/dom-bindings.test.mjs` per the design's Unit Tests table).
 *
 * Owner module references (per the design's "Mapping requirements to
 * modules" table): this module is imported by `image-editor.ts` only and is
 * intentionally NOT re-exported from `src/index.ts`.
 */
import type { ElementIdMap } from '../core/public-types.js';
/**
 * Logical element-name keys understood by the editor's `idMap`. Mirrors the
 * `ElementKey` alias used internally by `image-editor.ts` so callers can
 * speak the same vocabulary without crossing the public-types boundary.
 */
export type ElementKey = keyof Required<ElementIdMap>;
/**
 * Lightweight registry of DOM event listeners owned by an editor instance.
 *
 * The class is intentionally small: it does not know about Fabric, the
 * animation queue, or the operation guard — it only knows how to look up an
 * element ID for a key and how to add/remove a listener. Disposed-state
 * awareness comes in via the `isDisposed` callback so the guard can stay the
 * single source of truth for the `_disposed` flag (see
 * `core/operation-guard.ts`).
 *
 * Usage:
 *
 * ```ts
 * const bindings = new DomBindings(
 *   (key) => this.elements[key],
 *    => this.guard.isDisposed,
 *);
 * bindings.bindIfExists('zoomInBtn', 'click',   => this.scaleImage(s + step));
 * //..
 * bindings.removeAll; // called from dispose
 * ```
 */
export declare class DomBindings {
    /**
     * @param resolveElementId
     *   Returns the resolved DOM element ID for a given logical key, or a
     *   falsy value when the integrator omitted that key from the `idMap`.
     *   The orchestrator's `elements` table fills this role.
     * @param isDisposed
     *   Returns the editor's current `_disposed` flag. Bound handlers
     *   consult this on every dispatch and exit early when it returns
     *   `true`.
     */
    constructor(resolveElementId: (key: ElementKey) => string | null | undefined, isDisposed: () => boolean);
    /**
     * Look up the element registered under `key`. If it exists, attach
     * `handler` for `eventType` and record the binding so `removeAll` can
     * detach it later. The handler is wrapped to short-circuit when the
     * editor has been disposed.
     *
     * Missing keys and missing elements are silently ignored — the editor
     * tolerates partial DOM as documented under {@link ElementIdMap}.
     *
     * @returns `true` if the listener was attached, `false` if the element
     *          could not be resolved.
     */
    bindIfExists(key: ElementKey, eventType: string, handler: EventListener): boolean;
    /**
     * Detach every recorded listener and clear the registry. Each
     * `removeEventListener` call is wrapped in `try/catch` so an
     * already-detached listener (for example because the host page swapped
     * out the DOM node) does not abort the cleanup loop. Calling `removeAll`
     * a second time is a no-op.
     */
    removeAll(): void;
    /**
     * Number of currently-registered listeners. Exposed for diagnostics and
     * for the unit tests under `tests/units/dom-bindings.test.mjs`.
     */
    size(): number;
}
//# sourceMappingURL=dom-bindings.d.ts.map