/**
 * Tool-mode operation policy for ImageEditor.
 *
 * The policy defines which public operations may run while Crop, Mosaic,
 * Text, Draw, or Shape mode owns editor interaction.
 */
import type { EditorToolMode, ImageEditorOperation } from '../core/public-types.js';
export interface EditorToolModeSnapshot {
    hasCropSession: boolean;
    hasMosaicSession: boolean;
    hasTextSession: boolean;
    hasDrawSession: boolean;
    hasShapeSession: boolean;
}
export declare function getActiveToolMode(snapshot: EditorToolModeSnapshot): EditorToolMode | null;
export declare function isToolModeActive(snapshot: EditorToolModeSnapshot): boolean;
export declare function getAllowedOperationsForToolMode(mode: EditorToolMode): ReadonlySet<string>;
export declare function canRunOperationInToolMode(activeMode: EditorToolMode | null, operationName: string): boolean;
export declare function isImageEditorOperation(value: string | null): value is ImageEditorOperation;
