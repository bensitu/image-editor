# ImageEditor

[![npm](https://img.shields.io/npm/l/image-editor.svg)](https://github.com/bensitu/image-editor)
[![npm](https://img.shields.io/npm/v/@bensitu/image-editor.svg)](https://www.npmjs.com/package/@bensitu/image-editor)
[![](https://data.jsdelivr.com/v1/package/npm/@bensitu/image-editor/badge)](https://www.jsdelivr.com/package/npm/@bensitu/image-editor)

A lightweight JavaScript wrapper around fabric.js that provides image loading, scaling, rotation, cropping, mask management, history, and export helpers.

## Overview

ImageEditor offers:

- Image loading from base64 data URLs or file input
- Zoom in/out and reset transform helpers
- Rotation with custom degrees or step-based controls
- Crop mode with optional mask preservation
- Mask creation, selection, removal, and label support
- Undo/redo history helpers
- Merge, download, base64 export, and `File` export helpers
- Optional DOM/UI binding for common editor controls
- Large-image downsampling to reduce browser memory pressure
- Centralized error and warning callbacks

**Note:** This library uses **fabric.js v5.x**. Bundler and CommonJS entries load Fabric through the peer dependency. Browser global usage needs `window.fabric` available by the time `init()` runs; constructing the editor before Fabric is available is tolerated as long as Fabric is registered before initialization.

## Demo

[https://bensitu.github.io/image-editor/](https://bensitu.github.io/image-editor/)

## Features

- **Fabric.js-powered canvas** - Built on top of fabric.js.
- **Image scaling** - Configurable min/max limits with smooth animation.
- **Image rotation** - Step control and animated transitions.
- **Auto-resizing** - Optional canvas resizing to match the image, fit the viewport, or cover the viewport.
- **Image crop** - Enter a temporary crop mode and apply or cancel the crop.
- **Mask management** - Add, remove, remove all, drag, resize, and optionally rotate masks.
- **Mask labels** - Auto-sync labels with mask movement and scaling.
- **History** - Undo and redo supported editor state changes.
- **Performance optimization** - Downsample large images on load.
- **Export & download** - Export as base64 data URL, `File`, or direct download.
- **DOM/UI binding** - Bind common buttons, inputs, and placeholders by element ID.

## Installation

### npm / pnpm / yarn

```bash
npm i @bensitu/image-editor fabric
# or
pnpm add @bensitu/image-editor fabric
# or
yarn add @bensitu/image-editor fabric
```

### ESM / bundler usage

```javascript
import ImageEditor, {
  ImageEditor as NamedImageEditor,
} from "@bensitu/image-editor";
```

### CommonJS usage

```javascript
const ImageEditor = require("@bensitu/image-editor");

const editor = new ImageEditor();
```

### Browser global usage

Include fabric.js first, then ImageEditor:

```html
<!-- Fabric.js (required) -->
<script src="https://cdn.jsdelivr.net/npm/fabric@5.5.2/dist/fabric.min.js"></script>

<!-- ImageEditor -->
<script src="path/to/dist/image-editor.min.js"></script>
<!-- or -->
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor/dist/image-editor.min.js"></script>
```

Use `dist/image-editor.js` or `dist/image-editor.min.js` for browser global script usage. Use `dist/image-editor.esm.mjs` or `dist/image-editor.esm.min.mjs` for standards-compliant ESM imports. Matching `.js` ESM builds are also generated for browser and bundler compatibility.

## Quick Start

### HTML Structure

```html
<!-- Canvas -->
<canvas id="fabricCanvas"></canvas>

<!-- Optional Controls -->
<button id="zoomInButton">Zoom In</button>
<button id="zoomOutButton">Zoom Out</button>

<button id="rotateLeftButton">Rotate Left</button>
<input id="rotateLeftDegreesInput" type="number" value="90" />

<button id="rotateRightButton">Rotate Right</button>
<input id="rotateRightDegreesInput" type="number" value="90" />

<button id="createMaskButton">Add Mask</button>
<button id="removeSelectedMaskButton">Remove Mask</button>
<button id="removeAllMasksButton">Remove All Masks</button>

<button id="enterCropModeButton">Crop</button>
<button id="applyCropButton">Apply Crop</button>
<button id="cancelCropButton">Cancel Crop</button>

<button id="undoButton">Undo</button>
<button id="redoButton">Redo</button>

<button id="mergeMasksButton">Merge</button>
<button id="resetImageTransformButton">Reset</button>
<button id="downloadImageButton">Download</button>

<input id="imageInput" type="file" accept="image/*" />
```

### JavaScript Implementation

The constructor options are optional. For the smallest setup, create an editor instance and bind it to a canvas element.

```javascript
const editor = new ImageEditor();

editor.init({
  canvas: "fabricCanvas"
});
```

`canvas` is the only required DOM binding when your canvas element does not use the default ID `fabricCanvas`. All other DOM bindings are optional.

#### Optional Configuration

You can pass options to override the built-in defaults.

```javascript
const editor = new ImageEditor({
  canvasWidth: 800,
  canvasHeight: 600,
  backgroundColor: "#ffffff",
  initialImageBase64: null
});
```

These are common optional overrides, not required settings.

#### Demo-style Configuration

The docs demo uses an explicit configuration so the demo behavior is predictable. These options are not required for normal usage.

```javascript
const editor = new ImageEditor({
  // Layout mode. Enable only one layout mode at a time.
  expandCanvasToImage: false,
  fitImageToCanvas: true,
  coverImageToCanvas: false,

  // Image loading / performance.
  downsampleOnLoad: true,
  initialImageBase64: null,

  // Mask behavior.
  maskRotatable: true,
  maskLabelOnSelect: true,
  maskLabelOffset: 5,

  // UI behavior.
  backgroundColor: "transparent",
  showPlaceholder: true,
  animationDuration: 100,

  // Export behavior.
  exportImageAreaByDefault: true
});

editor.init({
  canvas: "fabricCanvas",
  canvasContainer: null,
  imagePlaceholder: "imagePlaceholder",
  scalePercentageInput: "scalePercentageInput",
  rotateLeftButton: "rotateLeftButton",
  rotateRightButton: "rotateRightButton",
  rotateLeftDegreesInput: "rotateLeftDegreesInput",
  rotateRightDegreesInput: "rotateRightDegreesInput",
  createMaskButton: null,
  removeSelectedMaskButton: "removeSelectedMaskButton",
  removeAllMasksButton: "removeAllMasksButton",
  mergeMasksButton: "mergeMasksButton",
  downloadImageButton: "downloadImageButton",
  maskList: "maskList",
  enterCropModeButton: "enterCropModeButton",
  applyCropButton: "applyCropButton",
  cancelCropButton: "cancelCropButton",
  resetImageTransformButton: "resetImageTransformButton",
  imageInput: null,
  uploadArea: null
});
```

The demo binds `createMaskButton`, `imageInput`, and `uploadArea` itself, so it passes `null` for those built-in bindings. Regular integrations can omit those keys to use the default IDs, or pass `null` to disable any optional binding.


### Loading an Image Manually

```javascript
async function loadImageDataUrl(imageBase64) {
  try {
    await editor.loadImage(imageBase64);
  } catch (error) {
    console.error("Image could not be loaded:", error);
  }
}

loadImageDataUrl("data:image/jpeg;base64,...");
```

## Configuration Options

All options are optional. If an option is not provided, the editor uses the default value listed below.

When creating the editor instance, pass an options object to override defaults.

| Option                        | Default                   | Description                                                                                                                                           |
| ----------------------------- | ------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canvasWidth`                 | `800`                     | Initial canvas width in pixels.                                                                                                                       |
| `canvasHeight`                | `600`                     | Initial canvas height in pixels.                                                                                                                      |
| `backgroundColor`             | `transparent`             | Canvas background color.                                                                                                                              |
| `animationDuration`           | `300`                     | Animation duration for scale and rotation operations, in milliseconds.                                                                                |
| `minScale`                    | `0.1`                     | Minimum image scale factor.                                                                                                                           |
| `maxScale`                    | `5.0`                     | Maximum image scale factor.                                                                                                                           |
| `scaleStep`                   | `0.05`                    | Scale increment/decrement used by zoom controls.                                                                                                      |
| `rotationStep`                | `90`                      | Default rotation step in degrees.                                                                                                                     |
| `expandCanvasToImage`         | `true`                    | Expand the canvas to the loaded image size.                                                                                                           |
| `fitImageToCanvas`            | `false`                   | Fit the loaded image inside the visible canvas viewport.                                                                                              |
| `coverImageToCanvas`          | `false`                   | Scale the image to cover the visible canvas viewport, allowing overflow when needed.                                                                  |
| `downsampleOnLoad`            | `true`                    | Downsample large images before rendering.                                                                                                             |
| `downsampleMaxWidth`          | `4000`                    | Maximum source image width before downsampling.                                                                                                       |
| `downsampleMaxHeight`         | `3000`                    | Maximum source image height before downsampling.                                                                                                      |
| `downsampleQuality`           | `0.92`                    | JPEG/WebP quality used when downsampling. `0` is valid and is preserved.                                                                              |
| `preserveSourceFormat`        | `true`                    | Preserve the source image format where possible during downsampling.                                                                                  |
| `downsampleMimeType`          | `null`                    | Optional output MIME type for downsampled images. Supported values include `jpeg`, `jpg`, `png`, `webp`, `image/jpeg`, `image/png`, and `image/webp`. |
| `imageLoadTimeoutMs`          | `30000`                   | Timeout for image decode/load operations.                                                                                                             |
| `exportMultiplier`            | `1`                       | Default scale multiplier for export.                                                                                                                  |
| `maxExportPixels`             | `50000000`                | Maximum output pixel count allowed per export after applying the multiplier.                                                                           |
| `exportImageAreaByDefault`    | `true`                    | Export only the image area by default instead of the full canvas.                                                                                     |
| `defaultMaskWidth`            | `50`                      | Default mask width in pixels.                                                                                                                         |
| `defaultMaskHeight`           | `80`                      | Default mask height in pixels.                                                                                                                        |
| `maskRotatable`               | `false`                   | Whether masks can be rotated.                                                                                                                         |
| `maskLabelOnSelect`           | `true`                    | Show the mask label when a mask is selected.                                                                                                          |
| `maskLabelOffset`             | `3`                       | Offset for mask labels from the mask's top-left corner.                                                                                               |
| `maskName`                    | `mask`                    | Prefix for mask names and labels.                                                                                                                     |
| `groupSelection`              | `false`                   | Whether Fabric can select multiple masks as an active selection.                                                                                      |
| `label.getText`               | `(mask) => mask.maskName` | Callback for custom label text. The second argument is the mask's stable zero-based creation index (`mask.maskId - 1`).                               |
| `showPlaceholder`             | `true`                    | Show a placeholder when no image is loaded.                                                                                                           |
| `initialImageBase64`          | `null`                    | Base64 data URL to auto-load during initialization.                                                                                                   |
| `defaultDownloadFileName`     | `edited_image.jpg`        | Default file name for downloads.                                                                                                                      |
| `crop.minWidth`               | `100`                     | Minimum crop rectangle width, clamped to the current image bounds.                                                                                    |
| `crop.minHeight`              | `100`                     | Minimum crop rectangle height, clamped to the current image bounds.                                                                                   |
| `crop.padding`                | `10`                      | Initial inset from the image bounds when entering crop mode.                                                                                          |
| `crop.hideMasksDuringCrop`    | `true`                    | Hide editable masks while crop mode is active.                                                                                                        |
| `crop.preserveMasksAfterCrop` | `false`                   | Keep masks that intersect the crop area, shifted into the cropped canvas. Merge masks first if they should be baked into the image pixels.            |
| `crop.allowRotationOfCropRect` | `false`                  | Reserved for future rotated crop support. In v1.x, crop rectangles stay axis-aligned; setting this to `true` reports a warning and rotation remains disabled. |
| `onImageLoaded`               | `null`                    | Callback invoked after an image finishes loading.                                                                                                     |
| `onError`                     | `null`                    | Callback invoked for recoverable internal errors.                                                                                                     |
| `onWarning`                   | `null`                    | Callback invoked for recoverable internal warnings.                                                                                                   |

`expandCanvasToImage`, `fitImageToCanvas`, and `coverImageToCanvas` are mutually exclusive layout modes. If more than one is enabled, the editor reports a warning and uses this precedence: `fitImageToCanvas`, then `coverImageToCanvas`, then `expandCanvasToImage`.

## DOM Binding Keys

`init(idMap)` binds editor behavior to DOM elements by ID. All keys are optional when the default IDs are present. Optional bindings can also be set to `null` to disable the built-in listener for that element.

| Key                         | Description                                                    |
| --------------------------- | -------------------------------------------------------------- |
| `canvas`                    | Required canvas element ID.                                    |
| `canvasContainer`           | Optional scrollable viewport/container element ID.             |
| `imagePlaceholder`          | Optional placeholder element shown when no image is loaded.    |
| `scalePercentageInput`      | Optional element used to display the current scale percentage. |
| `rotateLeftDegreesInput`    | Optional input used by the rotate-left button.                 |
| `rotateRightDegreesInput`   | Optional input used by the rotate-right button.                |
| `rotateLeftButton`          | Rotate image left.                                             |
| `rotateRightButton`         | Rotate image right.                                            |
| `createMaskButton`          | Create a new mask.                                             |
| `removeSelectedMaskButton`  | Remove the currently selected mask.                            |
| `removeAllMasksButton`      | Remove all masks.                                              |
| `mergeMasksButton`          | Merge masks into the base image.                               |
| `downloadImageButton`       | Download the edited image.                                     |
| `maskList`                  | Optional mask list container.                                  |
| `zoomInButton`              | Zoom in.                                                       |
| `zoomOutButton`             | Zoom out.                                                      |
| `resetImageTransformButton` | Reset scale and rotation.                                      |
| `undoButton`                | Undo the last state change.                                    |
| `redoButton`                | Redo the next state change.                                    |
| `imageInput`                | File input used to load images.                                |
| `uploadArea`                | Optional clickable upload area that triggers the file input.   |
| `enterCropModeButton`       | Enter crop mode.                                               |
| `applyCropButton`           | Apply the current crop rectangle.                              |
| `cancelCropButton`          | Cancel crop mode.                                              |

### Legacy DOM Binding Keys

The following DOM binding keys remain supported in `1.x` for compatibility, but are deprecated and will be removed in `v2.0.0`.

| Deprecated key       | Use instead                 |
| -------------------- | --------------------------- |
| `imgPlaceholder`     | `imagePlaceholder`          |
| `scaleRate`          | `scalePercentageInput`      |
| `rotationLeftInput`  | `rotateLeftDegreesInput`    |
| `rotationRightInput` | `rotateRightDegreesInput`   |
| `rotateLeftBtn`      | `rotateLeftButton`          |
| `rotateRightBtn`     | `rotateRightButton`         |
| `addMaskBtn`         | `createMaskButton`          |
| `removeMaskBtn`      | `removeSelectedMaskButton`  |
| `removeAllMasksBtn`  | `removeAllMasksButton`      |
| `mergeBtn`           | `mergeMasksButton`          |
| `downloadBtn`        | `downloadImageButton`       |
| `zoomInBtn`          | `zoomInButton`              |
| `zoomOutBtn`         | `zoomOutButton`             |
| `resetBtn`           | `resetImageTransformButton` |
| `undoBtn`            | `undoButton`                |
| `redoBtn`            | `redoButton`                |
| `cropBtn`            | `enterCropModeButton`       |
| `applyCropBtn`       | `applyCropButton`           |
| `cancelCropBtn`      | `cancelCropButton`          |

## API Methods

| Method                            | Returns                 | Description                                                                                                           |
| --------------------------------- | ----------------------- | --------------------------------------------------------------------------------------------------------------------- |
| `init(idMap)`                     | `void`                  | Bind the editor to DOM elements. Pass IDs in an object.                                                               |
| `dispose()`                       | `void`                  | Cleans up and disposes of the canvas and related references.                                                          |
| `loadImage(imageBase64, options)` | `Promise<void>`         | Load an image from a base64 data URL. Resolves after the Fabric image is on the canvas.                               |
| `isImageLoaded()`                 | `boolean`               | Return whether a valid image is loaded on the canvas.                                                                 |
| `isBusy()`                        | `boolean`               | Return whether the editor is loading, animating, cropping, or running another compound operation.                     |
| `scaleImage(factor)`              | `Promise<void>`         | Scale the image to the given factor relative to the base scale.                                                       |
| `rotateImage(degrees)`            | `Promise<void>`         | Rotate the image to the given angle in degrees.                                                                       |
| `resetImageTransform()`           | `Promise<void>`         | Reset scale to `1` and rotation to `0`.                                                                               |
| `undo()`                          | `Promise<void>`         | Undo the last state change. Resolves after the canvas state is restored.                                              |
| `redo()`                          | `Promise<void>`         | Redo the next state change. Resolves after the canvas state is restored.                                              |
| `createMask(config)`              | `fabric.Object \| null` | Create a mask on the canvas. Config can include shape, width, height, color, opacity, position, style, and callbacks. |
| `removeSelectedMask()`            | `void`                  | Remove the currently selected mask or selected masks.                                                                 |
| `removeAllMasks(options)`         | `void`                  | Remove all masks from the canvas.                                                                                     |
| `enterCropMode()`                 | `void`                  | Create a resizable/movable selection rectangle on top of the image.                                                   |
| `cancelCrop()`                    | `void`                  | Cancel crop mode and remove the temporary selection rectangle.                                                        |
| `applyCrop()`                     | `Promise<void>`         | Apply the current crop rectangle to the canvas.                                                                       |
| `mergeMasks()`                    | `Promise<void>`         | Merge masks into the base image on the canvas.                                                                        |
| `downloadImage(fileName)`         | `void`                  | Download the edited image as a file.                                                                                  |
| `exportImageBase64(options)`      | `Promise<string>`       | Export an image data URL. `fileType` can be `jpeg`, `jpg`, `png`, `webp`, or a supported image MIME type.             |
| `exportImageFile(options)`        | `Promise<File>`         | Export the current canvas as a `File` object.                                                                         |
| `saveState()`                     | `void`                  | Save the current editor state to history. Usually called internally after supported edits.                            |
| `loadFromState(serializedState)`  | `Promise<void>`         | Restore the editor from a serialized canvas/editor state.                                                             |

Deprecated method aliases are still available for compatibility and will be removed in `v2.0.0`.

| Deprecated method         | Use instead                  |
| ------------------------- | ---------------------------- |
| `reset()`                 | `resetImageTransform()`      |
| `addMask(config)`         | `createMask(config)`         |
| `merge()`                 | `mergeMasks()`               |
| `getImageBase64(options)` | `exportImageBase64(options)` |

## Mask Configuration

`createMask(config)` accepts an optional configuration object.

Invalid mask configuration, such as non-finite numeric values, non-positive dimensions/radii, malformed polygon points, or custom generators that do not return a Fabric object, is rejected with a warning and returns `null` without mutating the canvas or history.

| Option             | Description                                                                                |
| ------------------ | ------------------------------------------------------------------------------------------ |
| `shape`            | Mask shape. Built-in values include `rect`, `circle`, `ellipse`, and `polygon`.            |
| `width` / `height` | Mask size in pixels, percentage string, or resolver callback.                              |
| `radius`           | Circle radius in pixels, percentage string, or resolver callback.                          |
| `rx` / `ry`        | Ellipse radius or rectangle corner radius.                                                 |
| `points`           | Polygon points as `{ x, y }` objects or `[x, y]` tuples.                                   |
| `left` / `top`     | Mask position in pixels, percentage string, or resolver callback.                          |
| `angle`            | Initial rotation angle in degrees.                                                         |
| `color`            | Fill color.                                                                                |
| `alpha`            | Opacity from `0` to `1`.                                                                   |
| `selectable`       | Whether the mask can be selected.                                                          |
| `hasControls`      | Whether Fabric transform controls are shown.                                               |
| `styles`           | Additional Fabric style properties, such as `stroke`, `strokeWidth`, or `strokeDashArray`. |
| `fabricGenerator`  | Factory callback for creating a custom Fabric object.                                      |
| `onCreate`         | Callback invoked after the mask is added to the canvas.                                    |

Example:

```javascript
const mask = editor.createMask({
  shape: "rect",
  width: 120,
  height: 80,
  left: 20,
  top: 20,
  color: "rgba(0, 0, 0, 0.5)",
  alpha: 0.5,
});
```

## Crop Behavior

By default, applying crop removes unmerged masks.

This is intentional: an unmerged mask is still an editable overlay object, not part of the image pixels. When `crop.preserveMasksAfterCrop` is `false`, applying crop discards unmerged masks instead of trying to keep or partially crop those overlay objects.

Choose the workflow based on the result you want:

- **Crop first, then add masks** when masks should be placed only on the final cropped image.
- **Merge masks before cropping** when masks should become part of the image pixels and appear in the cropped result.
- **Enable `crop.preserveMasksAfterCrop`** when masks should remain editable after crop. Only masks that intersect the crop area are kept and shifted into the cropped canvas.
- **Keep the default `crop.preserveMasksAfterCrop: false`** when unmerged masks should be discarded by crop.

### Preserve editable masks after crop

```javascript
const editor = new ImageEditor({
  crop: {
    preserveMasksAfterCrop: true,
  },
});
```

### Bake masks into the image before crop

```javascript
try {
  await editor.mergeMasks();
  editor.enterCropMode();
  await editor.applyCrop();
} catch (error) {
  console.error("Crop workflow failed:", error);
}
```

## Export Examples

### Export as Base64

```javascript
try {
  const dataUrl = await editor.exportImageBase64({
    fileType: "jpeg",
    quality: 0.92,
    multiplier: 1,
  });

  console.log(dataUrl);
} catch (error) {
  console.error("Export failed:", error);
}
```

### Export as File

```javascript
try {
  const file = await editor.exportImageFile({
    fileName: "edited_image.jpg",
    fileType: "jpeg",
    quality: 0.92,
    mergeMask: true,
  });

  console.log(file);
} catch (error) {
  console.error("File export failed:", error);
}
```

Exports are limited by `maxExportPixels`. Increase that option only when the host page can tolerate the memory cost of larger canvas exports.

```javascript
const editor = new ImageEditor({
  maxExportPixels: 80000000,
});
```

## Error Handling

Some ImageEditor API methods may throw synchronously or reject their returned Promise when the operation cannot be completed.

Recommended usage:

- Wrap initialization and manual API calls in `try...catch`.
- Always `await` Promise-based methods such as `loadImage()`, `scaleImage()`, `rotateImage()`, `resetImageTransform()`, `mergeMasks()`, `applyCrop()`, `undo()`, `redo()`, `exportImageBase64()`, `exportImageFile()`, and `loadFromState()`.
- Use `onError` and `onWarning` for centralized logging or UI notifications.
- Do not rely only on `onError`; manual API calls should still handle thrown errors or rejected Promises at the call site.
- Check `editor.isBusy()` before starting user-triggered operations when needed, especially before loading, cropping, rotating, scaling, merging, undoing, redoing, or exporting.
- Show user-friendly messages in your application instead of exposing raw error text directly.

Example:

```javascript
const editor = new ImageEditor({
  onError: (error, message) => {
    console.error("[ImageEditor]", message, error);
    showEditorMessage("The image editor could not complete the operation.");
  },

  onWarning: (error, message) => {
    console.warn("[ImageEditor]", message, error);
  },
});

async function rotateSafely(degrees) {
  if (editor.isBusy()) {
    return;
  }

  try {
    await editor.rotateImage(degrees);
  } catch (error) {
    console.error("Rotate failed:", error);
    showEditorMessage("Rotation failed. Please try again.");
  }
}

function showEditorMessage(message) {
  // Replace this with your own toast, alert, or inline message UI.
  console.log(message);
}
```

### Common Failure Cases

Common failure cases include:

- fabric.js is not available when `init()` or another canvas operation needs it.
- The configured canvas element cannot be found.
- The image data URL is invalid, unsupported, too large, or times out while loading.
- Another operation is already running, such as image loading, animation, crop, undo, redo, merge, or export.
- The editor has been disposed before the operation completes.
- The requested export exceeds `maxExportPixels`, uses an invalid multiplier, or the browser cannot create a canvas export because of platform, memory, or security restrictions.
- A custom `fabricGenerator`, label callback, or external event handler throws an error.

## Example Workflow

The recommended order depends on whether masks should remain editable, be baked into the image, or be discarded.

### Common workflow: crop first, then add masks

Use this flow when masks are only needed on the final cropped image.

1. **Load an image** - Via file input or base64 data URL.
2. **Adjust positioning** - Zoom in/out, rotate, or reset as needed.
3. **Crop** - Optionally crop the image area.
4. **Add masks** - Highlight or cover specific areas on the cropped image.
5. **Merge result** - Flatten masks into the base image when needed.
6. **Download / export** - Save the final image.

### Alternative workflow: add masks before crop

If masks are added before crop, choose one of these behaviors before applying crop:

- Call `mergeMasks()` before `applyCrop()` if masks should become part of the cropped image pixels.
- Set `crop.preserveMasksAfterCrop: true` if masks should stay editable after crop.
- Keep the default `crop.preserveMasksAfterCrop: false` if unmerged masks should be removed by crop.

Example:

```javascript
// Masks become part of the image pixels before crop.
await editor.mergeMasks();
editor.enterCropMode();
await editor.applyCrop();
```

## Local Build

```bash
npm run build
```

## Tests

```bash
npm test
```

## Browser Support

- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

The package build targets these modern browsers and uses modern DOM and JavaScript features.

IE11 and old mobile Safari are not supported by the distributed build. If you need them, transpile the package and provide any required DOM or JavaScript polyfills in your application.

## Dependencies

- **fabric.js v5.x** — Required peer dependency. Browser global usage needs `window.fabric` available before `init()`.

## License

MIT © 2026 Ben Situ

Fabric.js is licensed under its own MIT license.
