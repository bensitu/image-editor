export function setPlaceholderVisible(placeholderElement, containerElement, show) {
    if (placeholderElement) {
        placeholderElement.hidden = !show;
        placeholderElement.setAttribute('aria-hidden', show ? 'false' : 'true');
    }
    if (containerElement) {
        containerElement.hidden = show;
        containerElement.setAttribute('aria-hidden', show ? 'true' : 'false');
    }
}
//# sourceMappingURL=visibility-state.js.map