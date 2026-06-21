/**
 * Keyboard binding and shortcut handling for ImageEditor.
 *
 * The handlers coordinate delete/backspace object removal and Escape-driven
 * mode exits while respecting native and Fabric text editing.
 */

import type * as FabricNS from 'fabric';

import { isTextAnnotationObject } from '../core/public-types.js';

export interface EditorKeyboardBindingAccess {
    getOwnerDocument(): Document;
    getKeyboardDocument(): Document | null;
    getKeyboardHandler(): ((event: KeyboardEvent) => void) | null;
    setKeyboardBinding(
        keyboardDocument: Document,
        keyboardHandler: (event: KeyboardEvent) => void,
    ): void;
    removeKeyboardListener(
        keyboardDocument: Document,
        keyboardHandler: (event: KeyboardEvent) => void,
    ): void;
    handleKeyboardEvent(event: KeyboardEvent): void;
}

export interface EditorKeyboardEventAccess {
    isDisposed(): boolean;
    getCanvas(): FabricNS.Canvas | null;
    getKeyboardDocument(): Document | null;
    hasTextSession(): boolean;
    hasDrawSession(): boolean;
    hasMosaicSession(): boolean;
    hasCropSession(): boolean;
    deleteSelectedObject(): void;
    finalizeActiveTextEditing(commit: boolean): void;
    exitTextMode(): void;
    exitDrawMode(): void;
    exitMosaicMode(): void;
    cancelCrop(): void;
}

export function bindEditorKeyboardEvents(access: EditorKeyboardBindingAccess): void {
    const ownerDocument = access.getOwnerDocument();
    const keyboardDocument = access.getKeyboardDocument();
    const keyboardHandler = access.getKeyboardHandler();
    if (keyboardHandler && keyboardDocument) {
        access.removeKeyboardListener(keyboardDocument, keyboardHandler);
    }
    const handler = (event: KeyboardEvent): void => {
        access.handleKeyboardEvent(event);
    };
    access.setKeyboardBinding(ownerDocument, handler);
    ownerDocument.addEventListener('keydown', handler);
}

export function isNativeTextInputActive(keyboardDocument: Document | null): boolean {
    const activeElement = keyboardDocument?.activeElement;
    if (!activeElement) return false;
    const tagName = activeElement.tagName.toLowerCase();
    return (
        tagName === 'input' ||
        tagName === 'textarea' ||
        tagName === 'select' ||
        (activeElement as HTMLElement).isContentEditable === true
    );
}

export function isFabricTextEditingActive(canvas: FabricNS.Canvas | null): boolean {
    const activeObject = canvas?.getActiveObject();
    return !!(
        activeObject &&
        isTextAnnotationObject(activeObject) &&
        (activeObject as { isEditing?: boolean }).isEditing === true
    );
}

export function handleEditorKeyboardEvent(
    access: EditorKeyboardEventAccess,
    event: KeyboardEvent,
): void {
    if (access.isDisposed()) return;
    const canvas = access.getCanvas();
    if (event.key === 'Delete' || event.key === 'Backspace') {
        if (
            isNativeTextInputActive(access.getKeyboardDocument()) ||
            isFabricTextEditingActive(canvas)
        ) {
            return;
        }
        access.deleteSelectedObject();
        return;
    }

    if (event.key !== 'Escape') return;
    if (isFabricTextEditingActive(canvas) && canvas) {
        access.finalizeActiveTextEditing(false);
        event.preventDefault();
        return;
    }
    if (access.hasTextSession()) {
        access.exitTextMode();
    } else if (access.hasDrawSession()) {
        access.exitDrawMode();
    } else if (access.hasMosaicSession()) {
        access.exitMosaicMode();
    } else if (access.hasCropSession()) {
        access.cancelCrop();
    }
}
