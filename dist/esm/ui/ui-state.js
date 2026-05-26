export function setDisabled(resolveElementId, key, disabled) {
    const id = resolveElementId(key);
    if (!id)
        return;
    const el = document.getElementById(id);
    if (el)
        el.disabled = disabled;
}
export function setAriaDisabled(resolveElementId, key, disabled) {
    const id = resolveElementId(key);
    if (!id)
        return;
    const el = document.getElementById(id);
    if (el)
        el.setAttribute('aria-disabled', disabled ? 'true' : 'false');
}
export function setClass(resolveElementId, key, className, enabled) {
    const id = resolveElementId(key);
    if (!id)
        return;
    const el = document.getElementById(id);
    if (el)
        el.classList.toggle(className, enabled);
}
//# sourceMappingURL=ui-state.js.map