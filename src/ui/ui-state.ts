/**
 * @file ui-state.ts
 * @description Disabled-state, aria-state, and toolbar-state helpers used by
 *              {@link ImageEditor}'s `init` and operation handlers. These
 *              helpers share the same `idMap`-driven element-resolution
 *              vocabulary as `dom-bindings.ts` so the orchestrator can speak
 *              one language when wiring or refreshing UI state.
 *
 * ## Owned contracts
 *
 * - Bound DOM controls live in the orchestrator's
 *   bindings registry and are addressed by logical {@link ElementKey}.
 *   These helpers consume the same key vocabulary so toolbar-state updates
 *   stay aligned with what `dom-bindings.ts` originally bound.
 * - Toolbar-state mutation must remain a no-op when
 *   the editor is disposed or when a logical key is unmapped. Each helper
 *   short-circuits on a missing element ID or missing DOM node so
 *   post-`dispose` `_updateUI`-style calls cannot throw or surprise the
 *   host page.
 *
 * ## Why this lives in its own module
 *
 * The v1 orchestrator's `_updateUI` walked the entire `idMap` and toggled
 * each control inline, which mixed toolbar policy (which buttons are
 * enabled when) with low-level DOM state (`disabled`, `aria-disabled`,
 * class toggles). Splitting the low-level DOM state out keeps
 * `image-editor.ts` focused on policy: "if there is no image, disable
 * zoom" stays in the facade, while "set `disabled` on the resolved element
 * by key" lives here and is unit-testable in isolation
 * (`tests/units/ui-state.test.mjs` per the design's Unit Tests table).
 *
 * Like `dom-bindings.ts` and `visibility-state.ts`, this module is imported
 * by `image-editor.ts` only and is intentionally NOT re-exported from
 * `src/index.ts`.
 */

import type { ElementIdMap} from '../core/public-types.js';

/**
 * Logical element-name keys understood by the editor's `idMap`. Matches the
 * `ElementKey` alias exported from `dom-bindings.ts` so the orchestrator's
 * registry and the toolbar-state helpers can be driven from the same
 * lookup function without crossing the public-types boundary.
 */
export type ElementKey = keyof Required<ElementIdMap>;

/**
 * Callback used by every helper in this module to translate a logical
 * {@link ElementKey} to the resolved DOM element ID supplied by the host
 * page through `idMap`. Returning a falsy value (`null`, `undefined`, or
 * empty string) means the host omitted that key — helpers MUST treat that
 * as a no-op rather than a bug.
 */
export type ElementIdResolver = (key: ElementKey) => string | null | undefined;

/**
 * Set the native `disabled` IDL property on a button-like control resolved
 * from `key`. Used by the orchestrator's `_updateUI` policy: each toolbar
 * button maps to one logical key, and the policy decides whether the
 * button is currently usable.
 *
 * Behaviour:
 *
 * - If `resolveElementId(key)` returns a falsy value, the helper returns
 *   without touching the DOM (the integrator chose not to wire that
 *   control;.4).
 * - If `document.getElementById(id)` returns `null`, the helper returns
 *   without throwing. A missing node is a partial-DOM scenario, not a
 *   fatal error.
 * - Otherwise the resolved element's `disabled` property is set to the
 *   requested boolean. Using the IDL property (not `setAttribute`)
 *   matches v1 behaviour and keeps the keyboard/click behaviour the
 *   browser provides "for free" on real `<button>` elements.
 *
 * The element is typed as `HTMLButtonElement` because every key in the
 * documented toolbar set (`zoomInBtn`, `applyCropBtn`, …) resolves to a
 * `<button>`. A non-button host element will still receive the `disabled`
 * assignment via the IDL slot but will not visually reflect it; that is
 * the integrator's responsibility per the public `idMap` contract.
 *
 * @param resolveElementId Resolver from logical key to DOM element ID.
 * @param key              Logical toolbar element key.
 * @param disabled         Target `disabled` value.
 */
export function setDisabled(
    resolveElementId: ElementIdResolver,
    key: ElementKey,
    disabled: boolean,
): void {
    const id = resolveElementId(key);
    if (!id) return;
    const el = document.getElementById(id) as HTMLButtonElement | null;
    if (el) el.disabled = disabled;
}

/**
 * Set the `aria-disabled` attribute on the element resolved from `key`.
 * Useful for non-button toolbar controls (links, custom widgets) that do
 * not honour the native `disabled` IDL property but still need to expose
 * disabled state to assistive technology.
 *
 * Behaviour mirrors {@link setDisabled}: missing key or missing element
 * results in a silent no-op. The attribute value is
 * always the canonical string `'true'` or `'false'` as required by the
 * ARIA spec — never the empty string and never removed entirely, so a
 * subsequent toggle is a single `setAttribute` away.
 *
 * @param resolveElementId Resolver from logical key to DOM element ID.
 * @param key              Logical toolbar element key.
 * @param disabled         Target `aria-disabled` value.
 */
export function setAriaDisabled(
    resolveElementId: ElementIdResolver,
    key: ElementKey,
    disabled: boolean,
): void {
    const id = resolveElementId(key);
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
}

/**
 * Toggle a CSS class on the element resolved from `key`. Used for toolbar
 * state that does not correspond to `disabled` / `aria-disabled` — for
 * example, marking the active mask in the mask list or flipping a button
 * into a "pressed" visual style during crop mode.
 *
 * The helper delegates to `Element.classList.toggle(className, force)`, so
 * the caller's `enabled` flag deterministically adds or removes the class
 * regardless of its current presence. Missing key or missing element is a
 * silent no-op.
 *
 * @param resolveElementId Resolver from logical key to DOM element ID.
 * @param key              Logical toolbar element key.
 * @param className        CSS class name to toggle.
 * @param enabled          `true` to add the class, `false` to remove it.
 */
export function setClass(
    resolveElementId: ElementIdResolver,
    key: ElementKey,
    className: string,
    enabled: boolean,
): void {
    const id = resolveElementId(key);
    if (!id) return;
    const el = document.getElementById(id);
    if (el) el.classList.toggle(className, enabled);
}
