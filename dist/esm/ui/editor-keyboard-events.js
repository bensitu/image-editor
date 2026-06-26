import { isTextAnnotationObject } from '../core/public-types.js';
export function bindEditorKeyboardEvents(access) {
    const ownerDocument = access.getOwnerDocument();
    const keyboardDocument = access.getKeyboardDocument();
    const keyboardHandler = access.getKeyboardHandler();
    if (keyboardHandler && keyboardDocument) {
        access.removeKeyboardListener(keyboardDocument, keyboardHandler);
    }
    const handler = (event) => {
        access.handleKeyboardEvent(event);
    };
    access.setKeyboardBinding(ownerDocument, handler);
    ownerDocument.addEventListener('keydown', handler);
}
function isNativeEditableElement(element) {
    var _a;
    if (!element)
        return false;
    const activeElement = element;
    const tagName = String((_a = activeElement.tagName) !== null && _a !== void 0 ? _a : '').toLowerCase();
    return (tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        activeElement.isContentEditable === true);
}
function getDeepActiveElement(root) {
    var _a, _b;
    let activeElement = (_a = root === null || root === void 0 ? void 0 : root.activeElement) !== null && _a !== void 0 ? _a : null;
    while ((_b = activeElement === null || activeElement === void 0 ? void 0 : activeElement.shadowRoot) === null || _b === void 0 ? void 0 : _b.activeElement) {
        activeElement = activeElement.shadowRoot.activeElement;
    }
    return activeElement;
}
export function isNativeTextInputActive(keyboardDocument, event) {
    const composedPath = typeof (event === null || event === void 0 ? void 0 : event.composedPath) === 'function' ? event.composedPath() : undefined;
    if (composedPath === null || composedPath === void 0 ? void 0 : composedPath.some(isNativeEditableElement))
        return true;
    return isNativeEditableElement(getDeepActiveElement(keyboardDocument));
}
export function isFabricTextEditingActive(canvas) {
    const activeObject = canvas === null || canvas === void 0 ? void 0 : canvas.getActiveObject();
    return !!(activeObject &&
        isTextAnnotationObject(activeObject) &&
        activeObject.isEditing === true);
}
export function handleEditorKeyboardEvent(access, event) {
    if (access.isDisposed())
        return;
    const canvas = access.getCanvas();
    if (event.key === 'Delete' || event.key === 'Backspace') {
        if (isNativeTextInputActive(access.getKeyboardDocument(), event) ||
            isFabricTextEditingActive(canvas)) {
            return;
        }
        access.deleteSelectedObject();
        return;
    }
    if (event.key !== 'Escape')
        return;
    if (isFabricTextEditingActive(canvas) && canvas) {
        access.finalizeActiveTextEditing(false);
        event.preventDefault();
        return;
    }
    if (access.hasTextSession()) {
        access.exitTextMode();
    }
    else if (access.hasDrawSession()) {
        access.exitDrawMode();
    }
    else if (access.hasMosaicSession()) {
        access.exitMosaicMode();
    }
    else if (access.hasCropSession()) {
        access.cancelCrop();
    }
}
//# sourceMappingURL=editor-keyboard-events.js.map