function recordElementOriginalState(context, key, element) {
    if (!context.originalAriaDisabledMap.has(key)) {
        context.originalAriaDisabledMap.set(key, element.getAttribute('aria-disabled'));
    }
    if (!context.originalPointerEventsMap.has(key)) {
        context.originalPointerEventsMap.set(key, element.style.pointerEvents || '');
    }
    if ('disabled' in element && !context.originalDisabledMap.has(key)) {
        context.originalDisabledMap.set(key, !!element.disabled);
    }
}
export function setEditorControlEnabled(context, key, isEnabled) {
    var _a;
    const controlElement = context.getElement(key);
    if (!controlElement)
        return;
    recordElementOriginalState(context, key, controlElement);
    if ('disabled' in controlElement) {
        const formControl = controlElement;
        const nextDisabled = !isEnabled;
        if (formControl.disabled !== nextDisabled)
            formControl.disabled = nextDisabled;
        return;
    }
    if (!isEnabled) {
        controlElement.setAttribute('aria-disabled', 'true');
        controlElement.style.pointerEvents = 'none';
    }
    else {
        const originalAria = context.originalAriaDisabledMap.get(key);
        if (originalAria === null || originalAria === undefined) {
            controlElement.removeAttribute('aria-disabled');
        }
        else {
            controlElement.setAttribute('aria-disabled', originalAria);
        }
        controlElement.style.pointerEvents = (_a = context.originalPointerEventsMap.get(key)) !== null && _a !== void 0 ? _a : '';
    }
}
export function restoreEditorControlOriginalStates(context) {
    var _a, _b;
    for (const key of Object.keys(context.elements)) {
        const element = context.getElement(key);
        if (!element)
            continue;
        if ('disabled' in element && context.originalDisabledMap.has(key)) {
            element.disabled =
                (_a = context.originalDisabledMap.get(key)) !== null && _a !== void 0 ? _a : false;
        }
        if (context.originalAriaDisabledMap.has(key)) {
            const originalAria = context.originalAriaDisabledMap.get(key);
            if (originalAria === null || originalAria === undefined) {
                element.removeAttribute('aria-disabled');
            }
            else {
                element.setAttribute('aria-disabled', originalAria);
            }
        }
        if (context.originalPointerEventsMap.has(key)) {
            element.style.pointerEvents = (_b = context.originalPointerEventsMap.get(key)) !== null && _b !== void 0 ? _b : '';
        }
    }
    context.originalDisabledMap.clear();
    context.originalAriaDisabledMap.clear();
    context.originalPointerEventsMap.clear();
}
//# sourceMappingURL=editor-control-elements.js.map