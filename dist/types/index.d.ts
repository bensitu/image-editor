/**
 * Canonical public API barrel for the image-editor library.
 *
 * The package surface consists of:
 * - `ImageEditor` (default and named export) — the only public class.
 * - Editor object runtime type guards.
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
export { isAnnotationObject, isBaseImageObject, isDrawAnnotationObject, isEditableOverlayObject, isMaskObject, isSessionObject, isTextAnnotationObject, } from './core/public-types.js';
export type { ImageEditorOptions, ResolvedOptions, LayoutMode, EditorObjectKind, EditorToolMode, OverlayListOrder, AnnotationType, SessionObjectType, EditorObjectMeta, LabelConfig, CropConfig, CropAspectRatioPreset, CropAspectRatio, CropModeOptions, CropExportFileType, MosaicConfig, ResolvedMosaicConfig, MosaicOutputFileType, TextAnnotationConfig, ResolvedTextAnnotationConfig, DrawConfig, ResolvedDrawConfig, LoadImageOptions, RemoveAllMasksOptions, RemoveAllAnnotationsOptions, DefaultMaskConfig, MaskConfig, MaskObject, MaskNumericProp, ResolvedMaskConfig, BaseImageObject, SessionObject, AnnotationObject, TextAnnotationObject, DrawAnnotationObject, AnnotationUpdateConfig, ImageMimeType, ImageFileType, NormalizedImageFormat, ExportArea, ImageExportOptions, ImageInfo, ImageEditorState, ImageEditorSelection, ImageEditorCallbackContext, ImageEditorOperation, ElementTarget, ElementMap, ElementIdMap, ResizeToContainerOptions, RelayoutOptions, FabricModule, } from './core/public-types.js';
//# sourceMappingURL=index.d.ts.map