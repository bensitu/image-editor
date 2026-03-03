"use strict";
/**
 * @file types.ts
 * @description Public interfaces and types for image-editor.
 *
 * All types are re-exported from the library root (index.ts) so consumers
 * can import them directly:
 *
 * ```ts
 * import type { ImageEditorOptions, MaskConfig } from 'image-editor';
 * ```
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.isMaskObject = isMaskObject;
/** Type guard — returns `true` if `obj` is a {@link MaskObject}. */
function isMaskObject(obj) {
    return 'maskId' in obj && typeof obj.maskId === 'number';
}
//# sourceMappingURL=types.js.map