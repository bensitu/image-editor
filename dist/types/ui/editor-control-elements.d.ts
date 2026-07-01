/**
 * DOM control state mutation and restoration helpers.
 *
 * These helpers preserve original disabled, aria-disabled, and pointer-event
 * values before the editor temporarily enables or disables controls.
 */
import type { ElementKey, ResolvedElementMap } from '../core/editor-elements.js';
export interface EditorControlElementContext {
    elements: ResolvedElementMap;
    originalDisabledMap: Map<ElementKey, boolean>;
    originalAriaDisabledMap: Map<ElementKey, string | null>;
    originalPointerEventsMap: Map<ElementKey, string>;
    getElement(key: ElementKey): HTMLElement | null;
}
export declare function setEditorControlEnabled(context: EditorControlElementContext, key: ElementKey, isEnabled: boolean): void;
export declare function restoreEditorControlOriginalStates(context: EditorControlElementContext): void;
