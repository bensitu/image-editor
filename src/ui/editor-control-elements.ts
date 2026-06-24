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

function recordElementOriginalState(
    context: EditorControlElementContext,
    key: ElementKey,
    element: HTMLElement,
): void {
    if (!context.originalAriaDisabledMap.has(key)) {
        context.originalAriaDisabledMap.set(key, element.getAttribute('aria-disabled'));
    }
    if (!context.originalPointerEventsMap.has(key)) {
        context.originalPointerEventsMap.set(key, element.style.pointerEvents || '');
    }
    if ('disabled' in element && !context.originalDisabledMap.has(key)) {
        context.originalDisabledMap.set(
            key,
            !!(element as HTMLButtonElement | HTMLInputElement).disabled,
        );
    }
}

export function setEditorControlEnabled(
    context: EditorControlElementContext,
    key: ElementKey,
    isEnabled: boolean,
): void {
    const controlElement = context.getElement(key);
    if (!controlElement) return;
    recordElementOriginalState(context, key, controlElement);
    if ('disabled' in controlElement) {
        const formControl = controlElement as HTMLButtonElement | HTMLInputElement;
        const nextDisabled = !isEnabled;
        if (formControl.disabled !== nextDisabled) formControl.disabled = nextDisabled;
        return;
    }
    if (!isEnabled) {
        controlElement.setAttribute('aria-disabled', 'true');
        controlElement.style.pointerEvents = 'none';
    } else {
        const originalAria = context.originalAriaDisabledMap.get(key);
        if (originalAria === null || originalAria === undefined) {
            controlElement.removeAttribute('aria-disabled');
        } else {
            controlElement.setAttribute('aria-disabled', originalAria);
        }
        controlElement.style.pointerEvents = context.originalPointerEventsMap.get(key) ?? '';
    }
}

export function restoreEditorControlOriginalStates(context: EditorControlElementContext): void {
    for (const key of Object.keys(context.elements) as ElementKey[]) {
        const element = context.getElement(key);
        if (!element) continue;
        if ('disabled' in element && context.originalDisabledMap.has(key)) {
            (element as HTMLButtonElement | HTMLInputElement).disabled =
                context.originalDisabledMap.get(key) ?? false;
        }
        if (context.originalAriaDisabledMap.has(key)) {
            const originalAria = context.originalAriaDisabledMap.get(key);
            if (originalAria === null || originalAria === undefined) {
                element.removeAttribute('aria-disabled');
            } else {
                element.setAttribute('aria-disabled', originalAria);
            }
        }
        if (context.originalPointerEventsMap.has(key)) {
            element.style.pointerEvents = context.originalPointerEventsMap.get(key) ?? '';
        }
    }
    context.originalDisabledMap.clear();
    context.originalAriaDisabledMap.clear();
    context.originalPointerEventsMap.clear();
}
