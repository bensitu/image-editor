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
export function isNativeTextInputActive(keyboardDocument) {
    const activeElement = keyboardDocument === null || keyboardDocument === void 0 ? void 0 : keyboardDocument.activeElement;
    if (!activeElement)
        return false;
    const tagName = activeElement.tagName.toLowerCase();
    return (tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        activeElement.isContentEditable === true);
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
        if (isNativeTextInputActive(access.getKeyboardDocument()) ||
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