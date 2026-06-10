/**
 * Canonical public API barrel for the image-editor library.
 *
 * The package surface consists of:
 * - `ImageEditor` (default and named export) — the only public class.
 * - `isMaskObject` — runtime type guard for mask objects.
 * - The documented public types listed below.
 *
 * Internal helpers (animation queue, command, history manager, controllers,
 * services, managers, and utility modules) are intentionally not re-exported;
 * they are implementation details and may change without notice.
 *
 * @example
 * ```ts
 * import * as fabric from 'fabric';
 * import { ImageEditor } from '@bensitu/image-editor';
 * import type {
 *     ImageEditorOptions,
 *     MaskConfig,
 *     MaskObject,
 * } from '@bensitu/image-editor';
 * ```
 *
 * @module
 */
import { ImageEditor } from './image-editor.js';
export { ImageEditor };
export default ImageEditor;
export { isMaskObject } from './core/public-types.js';
export type { ImageEditorOptions, ResolvedOptions, LayoutMode, LabelConfig, CropConfig, CropExportFileType, MosaicConfig, ResolvedMosaicConfig, MosaicOutputFileType, LoadImageOptions, RemoveAllMasksOptions, DefaultMaskConfig, MaskConfig, MaskObject, MaskNumericProp, ResolvedMaskConfig, ImageMimeType, ImageFileType, NormalizedImageFormat, ExportArea, Base64ExportOptions, ImageFileExportOptions, ImageInfo, ImageEditorState, ImageEditorSelection, ImageEditorCallbackContext, ImageEditorOperation, ElementIdMap, FabricModule, } from './core/public-types.js';
//# sourceMappingURL=index.d.cts.map