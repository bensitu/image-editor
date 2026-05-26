/**
 * @file index.ts
 * @description Canonical public API barrel for the image-editor library.
 *
 * The package surface consists of:
 *   - `ImageEditor` (default and named export) — the only public class.
 *   - `isMaskObject` — runtime type guard for mask objects.
 *   - The documented public types listed below.
 *
 * Internal helpers (animation queue, command, history manager, controllers,
 * services, managers, and utility modules) are intentionally not re-exported;
 * they are implementation details and may change without notice.
 *
 * @example
 * ```ts
 * import * as fabric from 'fabric';
 * import { ImageEditor} from 'image-editor';
 * import type { ImageEditorOptions, MaskConfig, MaskObject} from 'image-editor';
 * ```
 */

import { ImageEditor } from './image-editor.js';

export { ImageEditor };
export default ImageEditor;

export { isMaskObject } from './core/public-types.js';

// ─── Public types ─────────────────────────────────────────────────────────────

export type {
    // Core options
    ImageEditorOptions,
    ResolvedOptions,
    // Sub-configs
    LabelConfig,
    CropConfig,
    // loadImage / removeAllMasks options
    LoadImageOptions,
    RemoveAllMasksOptions,
    // Mask
    MaskConfig,
    MaskObject,
    MaskNumericProp,
    ResolvedMaskConfig,
    // Image format primitives
    ImageMimeType,
    ImageFileType,
    NormalizedImageFormat,
    // Export options
    Base64ExportOptions,
    ImageFileExportOptions,
    // DOM wiring
    ElementIdMap,
    // Fabric module type (for explicit injection)
    FabricModule,
} from './core/public-types.js';
