# API Reference

`ImageEditor` is the only public class. The package root re-exports it as both
the default export and a named export, alongside editor object guards and public
types.

```ts
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';
import type { ImageEditorOptions, MaskConfig } from '@bensitu/image-editor';
```

Internal controllers, action modules, runtime state, history management, Fabric
adapters, and UI binding utilities are implementation details and are not part
of the public package surface.

## Object Model

The editor owns all Fabric objects it creates. Base images, masks, annotations,
and transient session objects are tagged with editor metadata so the runtime can
separate persistent editing state from temporary UI state such as crop
rectangles, mask labels, previews, selections, and transform handles.

| Kind         | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `baseImage`  | The committed image at the bottom of the stack.                          |
| `mask`       | Editable mask overlay with required `maskId`, `maskUid`, and `maskName`. |
| `annotation` | Editable Text, Shape, or Draw overlay. Masks are not annotations.        |
| `session`    | Internal crop labels, mask labels, Mosaic previews, and tool previews.   |

Session objects are never persisted, exported, or user-deletable. Strict type
guards reject legacy mask-like objects that do not carry `editorObjectKind`.

## Constructor

```ts
new ImageEditor(fabric: FabricModule, options?: ImageEditorOptions)
new ImageEditor(options?: ImageEditorOptions) // UMD: reads globalThis.fabric
```

## Lifecycle

| Method              | Description                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `init(elementMap?)` | Bind the editor to DOM elements. Pass string IDs, HTMLElement refs, or `null` for unmanaged optional controls. |
| `dispose()`         | Tear down the editor, drain DOM bindings, and dispose the Fabric canvas. Idempotent.                           |
| `disposeAsync()`    | Same teardown as `dispose()`, resolving after Fabric canvas disposal settles. Idempotent.                      |

`dispose()` is synchronous and starts Fabric canvas teardown. If an integration
must immediately create another editor on the same `<canvas>` element, wait for
the next microtask or animation frame before reusing that element, or call
`await disposeAsync()`.

## Image Loading and Layout

| Method                         | Description                                                                                                                                                                             |
| ------------------------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadImage(base64, options?)`  | Load a supported raster image data URL (`png`, `jpeg`, or `webp`). Returns `Promise<void>`. Transactional: any failure restores the prior canvas, scroll, overflow, and snapshot state. |
| `isImageLoaded()`              | Returns `true` if a valid image is currently loaded on the canvas.                                                                                                                      |
| `isBusy()`                     | Returns `true` while the editor is loading, animating, or in Crop, Mosaic, Text, Shape, or Draw mode.                                                                                   |
| `isProcessing()`               | Returns `true` while an async load, export/merge transaction, or animation is active, excluding tool modes.                                                                             |
| `setLayoutMode(mode)`          | Select the layout strategy for future image loads. `mode` is `'fit'`, `'cover'`, or `'expand'`.                                                                                         |
| `setCanvasSize(width, height)` | Resize the Fabric canvas to explicit positive pixel dimensions. Invalid values warn and no-op.                                                                                          |
| `resizeToContainer(options?)`  | Resize the canvas to `canvasContainer.clientWidth/clientHeight`, optionally using fallback dimensions for hidden containers.                                                            |
| `relayout(options?)`           | Re-measure the host layout and refresh canvas geometry without reloading the current image or dropping overlays.                                                                        |

`LoadImageOptions` currently includes `preserveScroll?: boolean` for preserving
the container's scroll position across both successful loads and rollback paths.

File-input loading normalizes supported JPEG EXIF orientation by default, so
phone photos with sideways encoded pixels are displayed upright. Set
`autoOrientImage: false` to preserve the raw encoded orientation. Non-identity
orientations are normalized through a canvas and re-encoded as JPEG; set
`autoOrientImageQuality` to control that JPEG quality independently, or leave it
`null` to use `downsampleQuality`. This applies only to JPEG files loaded
through the file-input path; PNG/WebP files and `loadImage(dataUrl)` use the
existing path, and arbitrary EXIF metadata is not preserved.

Input size guards run before browser image decode. `maxInputBytes` limits the
encoded file size or decoded base64 payload size, and `maxInputPixels` rejects
PNG/JPEG/WebP files whose header dimensions exceed the configured source-pixel
budget when those dimensions can be read cheaply.

## Read-only State

| Method                | Description                                                                      |
| --------------------- | -------------------------------------------------------------------------------- |
| `getEditorState()`    | Return a safe snapshot of image, transform, tool-mode, busy, and history state.  |
| `getImageInfo()`      | Return committed image dimensions/display geometry, or `null` before image load. |
| `getMasks()`          | Return a shallow array snapshot of current live mask objects in canvas order.    |
| `getAnnotations()`    | Return a shallow array snapshot of current live annotation objects.              |
| `getSelection()`      | Return the current selected masks/annotations in the `onSelectionChange` shape.  |
| `getActiveToolMode()` | Return `'crop'`, `'mosaic'`, `'text'`, `'shape'`, `'draw'`, or `null`.           |

```ts
const state = editor.getEditorState();
const imageInfo = editor.getImageInfo();
const masks = editor.getMasks();
const selection = editor.getSelection();
const activeToolMode = editor.getActiveToolMode();
```

`getEditorState()` and `getImageInfo()` return defensive data snapshots.
`getMasks()`, `getAnnotations()`, and object references inside `getSelection()`
or lifecycle callbacks are different: they return new arrays or payload objects,
but the mask and annotation elements are the live Fabric objects on the canvas.
Treat those objects as read-only from integration code. Direct mutations such as
`mask.set(...)` or `annotation.set(...)` bypass editor history, metadata
synchronization, and change callbacks.

## Transforms

| Method                  | Description                                                                                                                                              |
| ----------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `scaleImage(factor)`    | Scale to `factor` (clamped to `[minScale, maxScale]`). Non-finite values are no-ops. Animated. Enabled bound overlays snap to the final image transform. |
| `rotateImage(degrees)`  | Rotate to `degrees`. Non-finite values resolve without changing canvas state. Animated. Enabled bound overlays snap to the final image transform.        |
| `flipHorizontal()`      | Toggle horizontal flip on the base image. Enabled bound masks and annotations follow; session overlays are not mirrored. Returns `Promise<void>`.        |
| `flipVertical()`        | Toggle vertical flip on the base image. Enabled bound masks and annotations follow; session overlays are not mirrored. Returns `Promise<void>`.          |
| `resetImageTransform()` | Animate to scale 1, rotation 0, and an unflipped state. Records exactly one history entry and applies one final delta to enabled bound overlays.         |

Overlay transform binding is disabled by default. See
[Overlay Transform Binding](./overlay-transform-binding.md) for constructor
options and Text reflection behavior.

## Image Filters

Image adjustments use Fabric's `FabricImage.filters` pipeline for live preview.
The editor's normalized filter config is the canonical state; Fabric filter
instances are the rendering projection and are not reverse-parsed by public
APIs.

| Method                         | Description                                                                                           |
| ------------------------------ | ----------------------------------------------------------------------------------------------------- |
| `setImageFilterConfig(config)` | Patch the current preview filter config and update the visible base image without pushing history.    |
| `getImageFilterConfig()`       | Return a defensive copy of the current resolved filter config.                                        |
| `resetImageFilterConfig()`     | Restore the preview to the last committed filter config without pushing history.                      |
| `clearImageFilters()`          | Set all filters to neutral values and commit that cleared state when it differs from committed state. |
| `commitImageFilters()`         | Make the current preview filter config undoable with one history entry when it changed.               |

Numeric ranges are `brightness`, `contrast`, and `saturation` from `-1` to `1`;
`blur` and `sharpen` from `0` to `1`. `grayscale`, `sepia`, and `vintage` are
booleans. `vintage` uses Fabric's native Vintage filter when available.
`sharpen` is implemented through a deterministic Fabric convolution kernel.

## Masks

| Method                     | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `createMask(config?)`      | The single mask-creation entry point. Returns the new `MaskObject` or `null`. |
| `removeSelectedMask()`     | Remove the currently selected mask and push one history entry.                |
| `removeAllMasks(options?)` | Remove every mask. `options.saveHistory` defaults to `true`.                  |

`MaskConfig` supports rect, circle, ellipse, polygon, and custom
`fabricGenerator` masks. Custom shape strings are passed through to
`fabricGenerator`; unsupported shape strings without a generator warn and fall
back to the historical rectangle behavior. Falsy values in `styles` (`0`,
`false`, `null`, `''`, `NaN`) are applied verbatim. Every mask is marked as
`editorObjectKind: 'mask'` and includes required `maskId`, `maskUid`, and
`maskName` metadata.

Use `defaultMaskConfig` to define constructor-level defaults for masks created
through either `createMask()` or the built-in `createMaskButton`. Per-call
`createMask(config)` values override `defaultMaskConfig`.

## Crop

| Method                      | Description                                                                          |
| --------------------------- | ------------------------------------------------------------------------------------ |
| `enterCropMode(options?)`   | Add an interactive crop rectangle on top of the image.                               |
| `setCropAspectRatio(ratio)` | Update the active crop rectangle ratio while crop mode is open.                      |
| `applyCrop()`               | Apply the current crop region. Atomic: failure rolls back to the pre-crop snapshot.  |
| `cancelCrop()`              | Cancel crop mode and restore the prior canvas state without pushing a history entry. |

`enterCropMode({ aspectRatio })` locks the crop rectangle to a preset or custom
ratio. Supported preset strings are `'free'`, `'1:1'`, `'3:4'`, `'4:3'`,
`'3:2'`, `'2:3'`, `'16:9'`, and `'9:16'`. Custom ratios use
`{ width, height }`. Per-call options override `crop.aspectRatio` from the
constructor.

When `cropAspectRatioSelect` is bound through `init(elementMap)`, the built-in
Crop button uses the select's current value and changing the select while crop
mode is open calls `setCropAspectRatio()` to resize the active crop rectangle.

## Mosaic Mode

| Method                     | Description                                                            |
| -------------------------- | ---------------------------------------------------------------------- |
| `enterMosaicMode()`        | Enter circular-brush Mosaic mode and show the hover preview on canvas. |
| `exitMosaicMode()`         | Leave Mosaic mode and remove preview/session handlers.                 |
| `isMosaicMode()`           | Returns `true` while a Mosaic session is active.                       |
| `getMosaicConfig()`        | Returns a defensive copy of the current runtime Mosaic config.         |
| `setMosaicConfig(config)`  | Patch current Mosaic config without creating a history entry.          |
| `resetMosaicConfig()`      | Restore current Mosaic config from constructor defaults.               |
| `setMosaicBrushSize(size)` | Set brush diameter in canvas pixels.                                   |
| `setMosaicBlockSize(size)` | Set source-pixel block size; values are floored to integers.           |

`brushSize` is the circular brush diameter in canvas pixels. `blockSize` is the
source-image pixel block size; larger values produce chunkier pixelation.
Clicking outside the image is a no-op. Each successful Mosaic click bakes the
pixelated region into the base image and creates exactly one undo step. Because
Mosaic edits replace base image pixels rather than adding Fabric overlay
objects, exported images include the Mosaic naturally while the preview circle
is never exported or saved in history.

## Text, Shape, and Draw Annotations

Tool modes are mutually exclusive: Crop, Mosaic, Text, Shape, and Draw cannot be
active at the same time. `getEditorState()` reports `activeToolMode` plus
`isCropMode`, `isMosaicMode`, `isTextMode`, `isShapeMode`, and `isDrawMode`.

While Text, Shape, or Draw mode is active, unrelated image operations are
blocked: export, merge, undo/redo, delete, transform, `loadImage`, and
`loadFromState` no-op through the normal guard. Exit the active mode before
running those operations.

| Method                               | Description                                                                                 |
| ------------------------------------ | ------------------------------------------------------------------------------------------- |
| `getAnnotations()`                   | Return a shallow array snapshot of current live annotation objects. Masks are not included. |
| `enterTextMode()` / `exitTextMode()` | Click empty canvas space to create editable text annotations.                               |
| `isTextMode()`                       | Returns `true` while Text mode is active.                                                   |
| `createTextAnnotation(config?)`      | Create a text annotation directly and return it.                                            |
| `getTextConfig()`                    | Return a defensive copy of the current Text config.                                         |
| `setTextConfig(config)`              | Patch current Text config without history.                                                  |
| `resetTextConfig()`                  | Restore Text config from constructor defaults.                                              |
| `setTextColor(color)`                | Convenience setter for text fill color.                                                     |
| `setTextFontSize(size)`              | Convenience setter for text font size.                                                      |
| `createShapeAnnotation(config?)`     | Create a rectangle, line, or arrow annotation directly and return it.                       |
| `enterShapeMode(shape?)`             | Draw the selected shape interactively, or switch the active shape while Shape mode is open. |
| `exitShapeMode()`                    | Leave Shape mode and remove the preview object.                                             |
| `isShapeMode()`                      | Returns `true` while Shape mode is active.                                                  |
| `getShapeConfig()`                   | Return a defensive copy of the current Shape config.                                        |
| `setShapeConfig(config)`             | Patch current Shape config without history.                                                 |
| `resetShapeConfig()`                 | Restore Shape config from constructor defaults.                                             |
| `enterDrawMode()` / `exitDrawMode()` | Use Fabric free drawing; each stroke becomes a Draw annotation.                             |
| `isDrawMode()`                       | Returns `true` while Draw mode is active.                                                   |
| `getDrawConfig()`                    | Return a defensive copy of the current Draw config.                                         |
| `setDrawConfig(config)`              | Patch current Draw config without history.                                                  |
| `resetDrawConfig()`                  | Restore Draw config from constructor defaults.                                              |
| `setDrawColor(color)`                | Convenience setter for brush color.                                                         |
| `setDrawBrushSize(size)`             | Convenience setter for brush size.                                                          |
| `setDrawSubMode(mode)`               | Switch active Draw mode between `'brush'` and `'erase'`.                                    |
| `getDrawSubMode()`                   | Return `'brush'`, `'erase'`, or `null` when Draw mode is inactive.                          |
| `getEraserConfig()`                  | Return a defensive copy of the current eraser config.                                       |
| `setEraserConfig(config)`            | Patch eraser config without history.                                                        |
| `resetEraserConfig()`                | Restore eraser config from constructor defaults.                                            |
| `updateAnnotation(id, config)`       | Update an annotation by id.                                                                 |
| `updateSelectedAnnotation(config)`   | Update selected annotation objects.                                                         |
| `removeSelectedAnnotation()`         | Remove selected unlocked annotations.                                                       |
| `removeAllAnnotations(options?)`     | Remove annotations only. Masks are preserved.                                               |
| `deleteSelectedObject()`             | Convenience deletion for selected masks and unlocked annotations.                           |

Annotations carry `annotationHidden` and `annotationLocked` metadata. Hidden
annotations remain in state and annotation lists, but are not visible or
rendered during export until shown again. Locked annotations are non-interactive
and are skipped by selected-annotation update/delete operations unless an API
explicitly opts into forced removal.

Shape annotations are ordinary annotation overlays, not masks. They are included
in `getAnnotations()`, selection payloads, export, merge, history, undo/redo,
and `saveState()` / `loadFromState()`. Their `shapeAnnotationKind` metadata is
one of `'rect'`, `'line'`, or `'arrow'`.

The eraser is a Draw sub-mode, not a top-level editor mode. It targets Draw
annotations only and removes intersected Draw strokes as whole annotation
objects. It does not erase base-image pixels, masks, text annotations, shape
annotations, or session previews.

## Layer Operations

Editable overlays include masks and annotations. Layer operations keep the base
image below overlays and session objects above overlays.

| Method                         | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| `bringSelectedObjectForward()` | Move selected editable overlays one step up.      |
| `sendSelectedObjectBackward()` | Move selected editable overlays one step down.    |
| `bringSelectedObjectToFront()` | Move selected editable overlays to overlay front. |
| `sendSelectedObjectToBack()`   | Move selected editable overlays to overlay back.  |

## Merge and Export

| Method                        | Description                                                                                       |
| ----------------------------- | ------------------------------------------------------------------------------------------------- |
| `mergeMasks()`                | Bake masks into the base image atomically. Returns `Promise<void>`.                               |
| `mergeAnnotations()`          | Bake annotations into the base image atomically. Returns `Promise<void>`.                         |
| `exportImageBase64(options?)` | Returns `Promise<string>` (data URL). Rejects when no image is loaded or the editor is not ready. |
| `exportImageFile(options?)`   | Returns `Promise<File>`. Rejects when no image is loaded.                                         |
| `downloadImage(options?)`     | Returns `Promise<void>` and triggers a browser download. No-op when no image is loaded.           |

All export APIs use the same `ImageExportOptions` shape:

| Option             | Default   | Description                                                                       |
| ------------------ | --------- | --------------------------------------------------------------------------------- |
| `mergeMasks`       | `true`    | Render masks into exported pixels. Mask labels are never exported.                |
| `mergeAnnotations` | `true`    | Render non-hidden annotations into exported pixels.                               |
| `exportArea`       | `'image'` | `'image'` clips to the image bounding box; `'canvas'` exports the canvas.         |
| `fileType`         | `'jpeg'`  | `'png'`, `'jpeg'`, `'jpg'`, `'webp'`, or matching full MIME strings.              |
| `format`           | `'jpeg'`  | Alias for `fileType` on all export APIs; `fileType` wins when both set.           |
| `quality`          | `0.92`    | Lossy quality clamped to `[0, 1]`; ignored for PNG.                               |
| `multiplier`       | `1`       | Output resolution multiplier.                                                     |
| `fileName`         | option    | `exportImageFile()` and `downloadImage()`. Defaults to `defaultDownloadFileName`. |

Unknown runtime `fileType` / `format` values preserve the compatibility fallback
to JPEG. If the browser cannot encode the resolved target MIME type and
`canvas.toDataURL()` falls back to another MIME such as PNG, export rejects
instead of returning mismatched Base64/File metadata.

`mergeMasks` and `mergeAnnotations` in export options affect the rendered output
only. They do not mutate editor state, remove objects, or push history entries.
State-mutating merge APIs are `mergeMasks()` and `mergeAnnotations()`.
`mergeMasks()` preserves annotations; `mergeAnnotations()` preserves masks.

## State and History

| Method                    | Description                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `saveState()`             | Capture a snapshot of the canvas plus editor metadata into the history stack.         |
| `loadFromState(snapshot)` | Restore canvas, masks, and editor metadata from a snapshot. Returns `Promise<void>`.  |
| `undo()`                  | Undo the last state change. Routed through the animation queue. No-op while disposed. |
| `redo()`                  | Redo the next state change. Routed through the animation queue. No-op while disposed. |

`loadFromState()` is designed for snapshots produced by this editor's
`saveState()`. If snapshots come from external storage or user-controlled input,
validate or reject untrusted JSON before passing it to the editor.

## Overlay Persistence

Use `exportOverlayState()`, `validateOverlayState()`, and
`importOverlayState()` when the application needs to store the original image
and editable overlays separately. See [Overlay State](./overlay-state.md).

## Public Types

Public types are re-exported from the package root. Import the types you need
directly from `@bensitu/image-editor`; the generated declaration file
`dist/types/index.d.ts` is the full source of truth for the exported type names.
