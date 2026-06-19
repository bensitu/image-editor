import type * as FabricNS from 'fabric';
export declare function safelyRemoveKeyboardListener(keyboardDocument: Document | null, keyboardHandler: ((event: KeyboardEvent) => void) | null): void;
export declare function safelyDisposeCanvas(canvas: FabricNS.Canvas | null): void;
export declare function safelyExitActiveSession(hasSession: boolean, canvas: FabricNS.Canvas | null, exitSession: () => void, clearSession: () => void): void;
//# sourceMappingURL=editor-dispose.d.ts.map