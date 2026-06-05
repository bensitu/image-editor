export function setDisabled(resolveElementId, key, disabled) {
    const id = resolveElementId(key);
    if (!id)
        return;
    const element = document.getElementById(id);
    if (element)
        element.disabled = disabled;
}
export function setAriaDisabled(resolveElementId, key, disabled) {
    const id = resolveElementId(key);
    if (!id)
        return;
    const element = document.getElementById(id);
    if (element)
        element.setAttribute('aria-disabled', disabled ? 'true' : 'false');
}
export function setClass(resolveElementId, key, className, enabled) {
    const id = resolveElementId(key);
    if (!id)
        return;
    const element = document.getElementById(id);
    if (element)
        element.classList.toggle(className, enabled);
}
//# sourceMappingURL=ui-state.js.map