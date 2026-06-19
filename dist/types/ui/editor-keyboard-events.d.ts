import type * as FabricNS from 'fabric';
export interface EditorKeyboardBindingAccess {
    getOwnerDocument(): Document;
    getKeyboardDocument(): Document | null;
    getKeyboardHandler(): ((event: KeyboardEvent) => void) | null;
    setKeyboardBinding(keyboardDocument: Document, keyboardHandler: (event: KeyboardEvent) => void): void;
    removeKeyboardListener(keyboardDocument: Document, keyboardHandler: (event: KeyboardEvent) => void): void;
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
export declare function bindEditorKeyboardEvents(access: EditorKeyboardBindingAccess): void;
export declare function isNativeTextInputActive(keyboardDocument: Document | null): boolean;
export declare function isFabricTextEditingActive(canvas: FabricNS.Canvas | null): boolean;
export declare function handleEditorKeyboardEvent(access: EditorKeyboardEventAccess, event: KeyboardEvent): void;
//# sourceMappingURL=editor-keyboard-events.d.ts.map