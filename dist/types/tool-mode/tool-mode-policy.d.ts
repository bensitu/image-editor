import type { EditorToolMode, ImageEditorOperation } from '../core/public-types.js';
export interface EditorToolModeSnapshot {
    hasCropSession: boolean;
    hasMosaicSession: boolean;
    hasTextSession: boolean;
    hasDrawSession: boolean;
}
export declare function getActiveToolMode(snapshot: EditorToolModeSnapshot): EditorToolMode | null;
export declare function isToolModeActive(snapshot: EditorToolModeSnapshot): boolean;
export declare function getAllowedOperationsForToolMode(mode: EditorToolMode): ReadonlySet<string>;
export declare function canRunOperationInToolMode(activeMode: EditorToolMode | null, operationName: string): boolean;
export declare function isImageEditorOperation(value: string | null): value is ImageEditorOperation;
//# sourceMappingURL=tool-mode-policy.d.ts.map