/**
 * Mask list DOM rendering and click-to-select behavior.
 *
 * The ImageEditor facade owns canvas selection state; this module rebuilds
 * the list from the current canvas objects and reports user selection through
 * {@link MaskListContext}.
 *
 * ## Owned contracts
 *
 * - When the mask list DOM container is bound,
 *   {@link renderMaskList} renders exactly one `<li>` per mask currently on
 *   the canvas, in canvas object order. The list is rebuilt from scratch on
 *   every call so it stays in sync with `canvas.getObjects` after creates,
 *   removals, undo/redo, and JSON restores.
 *
 * - Every `<li>` carries a `data-mask-id` attribute
 *   (via `dataset.maskId`) equal to the mask's `maskId`. Clients keying off
 *   the list (the click handler below, the test suite under
 *   `tests/mask-list-dom.property.test.mjs`) MUST use this attribute and
 *   never the visible label text — the label may be rewritten by the
 *   integrator via `options.label.getText`, so it is NOT a stable key.
 *
 * - Clicking a list item selects the mask whose
 *   `maskId` equals the clicked item's `data-mask-id`, regardless of where
 *   the item currently sits in the list. The click handler does NOT use the
 *   item's array index, so reordering the canvas (e.g. via Fabric layering)
 *   does not break selection.
 *
 * ## Out of scope (handled by sibling modules)
 *
 * - Label text generation and `mask.maskId - 1` index — see
 *   `mask/mask-label-manager.ts`.
 * - Mask creation, removal, and the post-create `updateMaskList` call — see
 *   `mask/mask-factory.ts`. The factory
 *   invokes the orchestrator's `updateMaskList` callback, which delegates
 *   here.
 * - Hover/selection appearance on the canvas — see `mask/mask-style.ts`.
 *
 * ## Implementation notes
 *
 * - The orchestrator (`src/image-editor.ts`) owns the canvas reference, the
 *   resolved `elements` table, and the selection callback. The helpers in
 *   this module receive those slots through a {@link MaskListContext} so the
 *   module is independent of the `ImageEditor` class shape and can be unit
 *   tested in isolation against a stub Fabric environment plus a JSDOM
 *   container.
 * - The DOM contract — `<li class="list-group-item mask-item">` with a
 *   `dataset.maskId` — is stable so existing CSS, theme overrides, and
 *   integrator selectors continue to work unchanged.
 * - Each render replaces the container's `innerHTML`. That is intentional:
 *   it guarantees the DOM mirrors `canvas.getObjects` exactly, and the
 *   Fabric event handlers (`object:added`, `object:removed`, `selection:*`)
 *   already fire often enough that an incremental diff is not justified.
 *   `innerHTML = ''` also detaches every prior `onclick` handler we attached
 *   below, so there is no need to track listeners separately.
 *
 * @module
 */
import type * as FabricNS from 'fabric';
import type { MaskObject } from '../core/public-types.js';
/**
 * State the mask-list helpers read from the `ImageEditor` orchestrator.
 *
 * The module does NOT own any of these slots — it only reads them so
 * ownership of the canvas, the resolved DOM element ID map, and the
 * selection-changed pipeline stays on the orchestrator.
 */
export interface MaskListContext {
    /**
     * The live Fabric canvas the list mirrors. May be `null` after
     * `dispose` or before `init` has run; the helpers no-op in that
     * case.
     */
    canvas: FabricNS.Canvas | null;
    /**
     * Returns the resolved DOM element ID for the mask list container, or a
     * falsy value when the integrator omitted `maskList` from the `idMap`.
     * The orchestrator's `elements.maskList` slot fills this role.
     */
    getListElementId(): string | null | undefined;
    /**
     * Invoked by the click handler after `setActiveObject(mask)` has run,
     * so the orchestrator can drive its selection-changed pipeline (label
     * overlay, hover/selection styling, list highlight) the same way it
     * does for canvas-originated selections.
     */
    onMaskSelected(mask: MaskObject): void;
}
/**
 * Re-render the mask list DOM from `canvas.getObjects`.
 *
 * No-op when the canvas is unset, the integrator did not supply a
 * `maskList` element ID, or the configured element does not exist in the
 * document. Tolerating partial DOM is intentional — the editor supports
 * being driven from code without any sidebar UI (the editor's
 * tolerated-bindings contract).
 *
 * Steps:
 *
 * 1. Resolve the list element via `context.getListElementId`. Bail out if
 *    missing.
 * 2. Clear the container with `innerHTML = ''`. This also detaches every
 *    `onclick` handler attached on the previous render, so there is no
 *    listener bookkeeping to track separately.
 * 3. For each {@link MaskObject} returned by `canvas.getObjects` (in
 *    canvas object order), build a fresh `<li>`:
 *      - class `list-group-item mask-item` (part of the stable DOM
 *        contract so existing CSS keeps working);
 *      - `textContent` set to `mask.maskName` (the label-text contract
 *        owned by `mask/mask-label-manager.ts`; this list shows the same
 *        identifier);
 *      - `dataset.maskId` set to `String(mask.maskId)` so the click
 *        handler and tests can key off a stable identifier;
 *      - an `onclick` handler that looks up the mask by `maskId` —
 *        regardless of the item's current position in the list — calls
 *        `setActiveObject` on the canvas, and
 *        forwards to `context.onMaskSelected(mask)` so the orchestrator's
 *        selection-changed pipeline runs.
 *
 * @param context - Orchestration context — see {@link MaskListContext}.
 */
export declare function renderMaskList(context: MaskListContext): void;
/**
 * Toggle the `active` CSS class on every `<li class="mask-item">` so the
 * one whose `data-mask-id` matches `selectedMask.maskId` is highlighted.
 *
 * Matches legacy's `updateMaskListSelection` behavior except that selection is
 * keyed off `data-mask-id` instead of the list-item text content. legacy used
 * the visible name (`textContent === selectedMask.maskName`), which broke
 * when an integrator overrode `options.label.getText` to render anything
 * other than `maskName`. Keying off `data-mask-id` keeps the highlight in
 * lock-step with the stable `data-mask-id` identifier and tolerates any
 * label-text customization.
 *
 * No-op when the integrator did not supply a `maskList` element ID or the
 * configured element does not exist in the document.
 *
 * @param context - Orchestration context — see {@link MaskListContext}.
 * @param selectedMask - The currently selected mask, or `null` to clear the
 *                      highlight.
 */
export declare function updateMaskListSelection(context: MaskListContext, selectedMask: MaskObject | null): void;
//# sourceMappingURL=mask-list.d.ts.map