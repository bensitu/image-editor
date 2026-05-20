/**
 * @file index.ts
 * @description Public API barrel for the image-editor library.
 *
 * @example
 * ```ts
 * import * as fabric from 'fabric';
 * import { ImageEditor } from 'image-editor';
 * import type { ImageEditorOptions, MaskConfig, MaskObject } from 'image-editor';
 * ```
 */
export { ImageEditor } from './image-editor.js';
export { AnimationQueue } from './animation-queue.js';
export { Command, HistoryManager } from './history.js';
export type { ImageEditorOptions, ElementIdMap, MaskConfig, MaskObject, MaskNumericProp, ResolvedMaskConfig, LabelConfig, CropConfig, ExportOptions, ExportFileOptions, FabricModule, ResolvedOptions, } from './types.js';
export { isMaskObject } from './types.js';
//# sourceMappingURL=index.d.ts.map