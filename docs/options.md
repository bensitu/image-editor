# Options Reference

Pass an `ImageEditorOptions` object as the second constructor argument, or as the
only argument when using the UMD global form. Unknown keys are ignored,
unsupported runtime values fall back to documented defaults, and nested
configuration objects are merged with defaults.

```ts
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric, {
    canvasWidth: 960,
    canvasHeight: 640,
    defaultLayoutMode: 'fit',
    exportAreaByDefault: 'image',
    maxHistorySize: 25,
});
```

## Constructor Options

| Option                      | Default           | Description                                                                                                                                                                                                                                                                                   |
| --------------------------- | ----------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canvasWidth`               | `800`             | Initial and hidden-container fallback canvas width in pixels.                                                                                                                                                                                                                                 |
| `canvasHeight`              | `600`             | Initial and hidden-container fallback canvas height in pixels.                                                                                                                                                                                                                                |
| `backgroundColor`           | `'transparent'`   | Fabric canvas background color.                                                                                                                                                                                                                                                               |
| `animationDuration`         | `300`             | Duration of scale and rotate animations (ms).                                                                                                                                                                                                                                                 |
| `minScale`                  | `0.1`             | Minimum scale factor.                                                                                                                                                                                                                                                                         |
| `maxScale`                  | `5.0`             | Maximum scale factor.                                                                                                                                                                                                                                                                         |
| `scaleStep`                 | `0.05`            | Scale delta per zoom step.                                                                                                                                                                                                                                                                    |
| `rotationStep`              | `90`              | Rotation step in degrees.                                                                                                                                                                                                                                                                     |
| `defaultLayoutMode`         | `'expand'`        | Initial layout mode for image loads until changed by `setLayoutMode()`. Use `'fit'`, `'cover'`, or `'expand'`. Invalid runtime values fall back to `'expand'`.                                                                                                                                |
| `downsampleOnLoad`          | `true`            | Downsample large images on load.                                                                                                                                                                                                                                                              |
| `downsampleMaxWidth`        | `4000`            | Max width before downsampling kicks in.                                                                                                                                                                                                                                                       |
| `downsampleMaxHeight`       | `3000`            | Max height before downsampling kicks in.                                                                                                                                                                                                                                                      |
| `downsampleQuality`         | `0.92`            | Lossy quality used when downsampling and exporting.                                                                                                                                                                                                                                           |
| `preserveSourceFormat`      | `true`            | Preserve PNG/WebP MIME through downsampling unless `downsampleMimeType` is set.                                                                                                                                                                                                               |
| `downsampleMimeType`        | `null`            | Explicit downsample MIME type. Overrides `preserveSourceFormat`.                                                                                                                                                                                                                              |
| `autoOrientImage`           | `true`            | Normalize supported JPEG EXIF orientation during file-input loading. Set to `false` to preserve raw encoded orientation.                                                                                                                                                                      |
| `autoOrientImageQuality`    | `null`            | JPEG quality used when `autoOrientImage` re-encodes a rotated or mirrored file-input JPEG. `null` falls back to `downsampleQuality`.                                                                                                                                                          |
| `maxInputBytes`             | `50000000`        | Maximum encoded file bytes or decoded base64 payload bytes accepted before image decode. Invalid values fall back to this default.                                                                                                                                                            |
| `maxInputPixels`            | `50000000`        | Maximum source image pixel count accepted from PNG/JPEG/WebP headers before image decode when dimensions are available. Invalid values fall back to this default.                                                                                                                             |
| `imageLoadTimeoutMs`        | `30000`           | Maximum duration for both decode and Fabric image creation during `loadImage`.                                                                                                                                                                                                                |
| `exportMultiplier`          | `1`               | Output resolution multiplier.                                                                                                                                                                                                                                                                 |
| `maxExportPixels`           | `50000000`        | Maximum output pixel count after applying the export multiplier. Invalid values fall back to this default.                                                                                                                                                                                    |
| `maxExportDimension`        | `16384`           | Maximum output width or height after applying the export multiplier. Guards browser canvas single-dimension limits; invalid values fall back to this default.                                                                                                                                 |
| `maxHistorySize`            | `50`              | Maximum undo-history entries. Snapshots may include full image data URLs, so large images can duplicate memory across history entries. Lower this for memory-constrained pages.                                                                                                               |
| `exportAreaByDefault`       | `'image'`         | Default export region for `exportImageBase64`, `exportImageFile`, and `downloadImage`.                                                                                                                                                                                                        |
| `mergeMasksByDefault`       | `true`            | Default mask rendering behavior for `exportImageBase64`, `exportImageFile`, and `downloadImage`.                                                                                                                                                                                              |
| `mergeAnnotationsByDefault` | `true`            | Default annotation rendering behavior for `exportImageBase64`, `exportImageFile`, and `downloadImage`.                                                                                                                                                                                        |
| `defaultMaskWidth`          | `50`              | Default mask width.                                                                                                                                                                                                                                                                           |
| `defaultMaskHeight`         | `80`              | Default mask height.                                                                                                                                                                                                                                                                          |
| `defaultMaskConfig`         | `{}`              | Defaults applied by `createMask()` after `defaultMaskWidth` / `defaultMaskHeight` and before per-call config. Supports `MaskConfig` fields except `onCreate` and `fabricGenerator`.                                                                                                           |
| `defaultMosaicConfig`       | see source        | Defaults used to initialize the current Mosaic tool config. Supports `brushSize`, `blockSize`, preview circle styling, `outputFileType`, and `outputQuality`. Runtime Mosaic setters update the current config only.                                                                          |
| `defaultTextConfig`         | see source        | Defaults used to initialize the current Text annotation config. Runtime Text setters update the current config only.                                                                                                                                                                          |
| `defaultDrawConfig`         | see source        | Defaults used to initialize the current Draw mode config. Runtime Draw setters update the current config only.                                                                                                                                                                                |
| `defaultEraserConfig`       | see source        | Defaults used to initialize Draw eraser config. Supports eraser `brushSize`, draw-annotation target, and preview styling. Runtime eraser setters update the current config only.                                                                                                              |
| `defaultShapeConfig`        | see source        | Defaults used to initialize Shape annotation config. Supports `rect`, `line`, and `arrow` geometry plus stroke, fill, opacity, arrow head, dash, lock, visibility, and interactivity options. Runtime Shape setters update the current config only.                                           |
| `maskRotatable`             | `false`           | Allow masks to be rotated by the user.                                                                                                                                                                                                                                                        |
| `maskLabelOnSelect`         | `true`            | Show a label above a selected mask.                                                                                                                                                                                                                                                           |
| `maskLabelOffset`           | `3`               | Pixel offset of the label from the mask's top-left corner.                                                                                                                                                                                                                                    |
| `maskName`                  | `'mask'`          | Prefix used for auto-generated mask names.                                                                                                                                                                                                                                                    |
| `textAnnotationName`        | `'text'`          | Prefix used for auto-generated text annotation names.                                                                                                                                                                                                                                         |
| `drawAnnotationName`        | `'draw'`          | Prefix used for auto-generated draw annotation names.                                                                                                                                                                                                                                         |
| `shapeAnnotationName`       | `'shape'`         | Prefix used for auto-generated shape annotation names.                                                                                                                                                                                                                                        |
| `maskListOrder`             | `'front-to-back'` | Mask list DOM order. `'front-to-back'` shows the topmost mask first; `'back-to-front'` preserves Fabric's bottom-to-top object order.                                                                                                                                                         |
| `annotationListOrder`       | `'front-to-back'` | Annotation list DOM order. `'front-to-back'` shows the topmost annotation first; `'back-to-front'` preserves Fabric's bottom-to-top object order.                                                                                                                                             |
| `groupSelection`            | `false`           | Allow Fabric multi-object group selection on the canvas.                                                                                                                                                                                                                                      |
| `showPlaceholder`           | `true`            | Show a placeholder element while no image is loaded.                                                                                                                                                                                                                                          |
| `initialImageBase64`        | `null`            | Base64 data URL auto-loaded after construction.                                                                                                                                                                                                                                               |
| `defaultDownloadFileName`   | `'edited_image'`  | Default filename base used by `exportImageFile()` and `downloadImage()`. The resolved export format supplies or corrects the extension.                                                                                                                                                       |
| `label`                     | see source        | `LabelConfig` for selected-mask labels (`getText`, `textOptions`, `create`).                                                                                                                                                                                                                  |
| `crop`                      | see source        | `CropConfig` (`minWidth`, `minHeight`, `padding`, `aspectRatio`, `hideMasksDuringCrop`, `preserveMasksAfterCrop`, `allowRotationOfCropRect`, `exportFileType`, `exportQuality`). `applyCrop()` preserves the current image format by default (`'source'`) and falls back to PNG when unknown. |

## Callback Options

| Option                 | Signature                                     | Description                                                                                       |
| ---------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `onImageLoadStart`     | `(context)`                                   | Called before a valid image load begins.                                                          |
| `onImageLoaded`        | `(imageInfo, context)`                        | Called once after a successful `loadImage`.                                                       |
| `onImageCleared`       | `(previousImage, context)`                    | Called when a committed image is replaced or cleared.                                             |
| `onImageChanged`       | `(state, context)`                            | Called with a safe editor state snapshot after visible editor state changes.                      |
| `onBusyChange`         | `(isBusy, context)`                           | Called only when the public busy state changes.                                                   |
| `onToolModeChange`     | `(activeToolMode, previousToolMode, context)` | Called only when the active tool mode changes.                                                    |
| `onHistoryChange`      | `({ canUndo, canRedo }, context)`             | Called only when undo/redo availability changes.                                                  |
| `onEditorDisposed`     | `(context)`                                   | Called once when `dispose()` performs teardown.                                                   |
| `onMasksChanged`       | `(masks, context)`                            | Called with a shallow copy of current mask objects after the mask collection changes.             |
| `onAnnotationsChanged` | `(annotations, context)`                      | Called with a shallow copy of current annotation objects after the annotation collection changes. |
| `onSelectionChange`    | `(selection, context)`                        | Called with selected mask and annotation payload after selection changes.                         |
| `onError`              | `(error, message)`                            | Called when the editor reports an error.                                                          |
| `onWarning`            | `(error, message)`                            | Called when the editor reports a recoverable warning.                                             |

```ts
const editor = new ImageEditor(fabric, {
    onToolModeChange(activeToolMode, previousToolMode, context) {
        console.log('tool mode changed', {
            activeToolMode,
            previousToolMode,
            operation: context.operation,
        });
    },
    onHistoryChange(history, context) {
        console.log('history changed', {
            canUndo: history.canUndo,
            canRedo: history.canRedo,
            operation: context.operation,
        });
    },
});
```

Lifecycle callback exceptions are caught and logged so a faulty host callback
does not replace or mask the editor operation. `onError` and `onWarning`
callbacks use the same isolation.

## Notes

`maskListOrder` and `annotationListOrder` affect only the sidebar DOM order. They
do not change canvas z-order, object IDs, history, or export output. Invalid
runtime values fall back to `'front-to-back'`.

`crop.exportFileType` defaults to `'source'`. Supported explicit values are
`'png'`, `'jpeg'`, `'jpg'`, `'webp'`, and full image MIME strings. PNG is
lossless and ignores `crop.exportQuality`; JPEG/WebP use `crop.exportQuality`
when finite, otherwise `downsampleQuality`, otherwise `0.92`. Choose JPEG/WebP
only when smaller intermediate crop output is preferred.

`defaultMosaicConfig.outputFileType` also defaults to `'source'`. Mosaic commits
preserve the current image MIME type when known and fall back to PNG when the
source format cannot be determined. JPEG/WebP commits use
`defaultMosaicConfig.outputQuality` when finite, otherwise `downsampleQuality`.
