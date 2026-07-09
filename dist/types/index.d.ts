/**
 * Canonical public API barrel for the image-editor library.
 *
 * The package surface consists of:
 * - `ImageEditor` (default and named export) — the only public class.
 * - Editor object runtime type guards.
 * - The documented public types listed below.
 *
 * Read-only integration helpers on `ImageEditor` include `getEditorState()`,
 * `getImageInfo()`, `getMasks()`, `getSelection()`, and
 * `getActiveToolMode()`. Lifecycle options include `onToolModeChange` and
 * `onHistoryChange`.
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
export { ImageEditor, ImageEditor as default } from './image-editor.js';
export { isAnnotationObject, isBaseImageObject, isDrawAnnotationObject, isEditableOverlayObject, isMaskObject, isSessionObject, isShapeAnnotationObject, isTextAnnotationObject, } from './core/public-types.js';
export type { ImageEditorOptions, ResolvedOptions, LayoutMode, EditorObjectKind, EditorToolMode, OverlayListOrder, AnnotationType, SessionObjectType, EditorObjectMeta, LabelConfig, CropConfig, CropAspectRatioPreset, CropAspectRatio, CropModeOptions, CropExportFileType, MosaicConfig, ResolvedMosaicConfig, MosaicOutputFileType, ImageFilterConfig, ResolvedImageFilterConfig, TextAnnotationConfig, ResolvedTextAnnotationConfig, DrawConfig, ResolvedDrawConfig, DrawSubMode, EraserConfig, ResolvedEraserConfig, ShapeAnnotationConfig, ResolvedShapeAnnotationConfig, ShapeAnnotationKind, OverlayNumericProp, LoadImageOptions, RemoveAllMasksOptions, RemoveAllAnnotationsOptions, DefaultMaskConfig, MaskConfig, MaskObject, MaskNumericProp, MaskShapeKind, ResolvedMaskConfig, BaseImageObject, SessionObject, AnnotationObject, TextAnnotationObject, DrawAnnotationObject, ShapeAnnotationObject, AnnotationUpdateConfig, ImageMimeType, ImageFileType, NormalizedImageFormat, ExportArea, ImageExportOptions, ImageInfo, ImageEditorState, ImageEditorSelection, ImageEditorCallbackContext, ImageEditorOperation, ElementTarget, ElementMap, ElementIdMap, ResizeToContainerOptions, RelayoutOptions, FabricModule, } from './core/public-types.js';
export type { ExportOverlayStateOptions, ImportOverlayStateOptions, ImportOverlayStateResult, OverlayBaseImageTransform, OverlayExportContext, OverlayImageInfo, OverlayImportContext, OverlayImportWarning, OverlayMetadata, OverlayMigrationResult, OverlaySerializerRegistryEntry, OverlayState, OverlayValidationError, OverlayValidationOptions, OverlayValidationResult, SerializedCustomOverlay, SerializedDrawAnnotationOverlay, SerializedDrawBrush, SerializedDrawPoint, SerializedDrawStroke, SerializedEllipseMaskGeometry, SerializedMaskGeometry, SerializedMaskOverlay, SerializedMaskStyle, SerializedOverlay, SerializedOverlayBase, SerializedPolygonMaskGeometry, SerializedRectMaskGeometry, SerializedShapeAnnotationOverlay, SerializedShapeArrowGeometry, SerializedShapeGeometry, SerializedShapeLineGeometry, SerializedShapeRectGeometry, SerializedShapeStyle, SerializedTextAnnotationOverlay, SerializedTextContent, SerializedTextGeometry, SerializedTextStyle, } from './overlay/overlay-state-types.js';
