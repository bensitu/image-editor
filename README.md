# @bensitu/image-editor

[![npm](https://img.shields.io/npm/l/@bensitu/image-editor.svg)](https://github.com/bensitu/image-editor)
[![npm](https://img.shields.io/npm/v/@bensitu/image-editor.svg)](https://www.npmjs.com/package/@bensitu/image-editor)
[![](https://data.jsdelivr.com/v1/package/npm/@bensitu/image-editor/badge)](https://www.jsdelivr.com/package/npm/@bensitu/image-editor)

A lightweight, TypeScript-first canvas image editor built on top of
[Fabric.js](https://fabricjs.com/) v7. `ImageEditor` wraps a Fabric canvas
with image loading, scale and rotation, mask creation, image adjustments, Text,
Shape, and Draw annotations, crop, Mosaic mode, base-image flips, history
(undo/redo), layer operations, and base64/file export — exposed as a single
canonical class with a stable public surface.

## Demo

- [Demo landing page](https://bensitu.github.io/image-editor/)

## Features

- TypeScript source with `.d.ts` declarations published alongside the runtime
- Single canonical class `ImageEditor` exported as both default and named
- Fabric.js v7 declared as a peer dependency (no bundled Fabric copy)
- Multi-format publish: ESM (`import`), CommonJS (`require`), UMD (`<script>`),
  TypeScript declarations (`types`)
- Transactional `loadImage` with rollback on decode, Fabric, downsample, or
  timeout failures
- Animation queue serializes `scaleImage`, `rotateImage`,
  `resetImageTransform`, `undo`, and `redo` so concurrent clicks never
  interleave
- Bounded history stack with idempotent dispose
- Crop session with mask preservation toggle and atomic apply/cancel
- Fabric-backed image filters for brightness, contrast, saturation, blur,
  sharpen, grayscale, sepia, and vintage tone
- Mosaic mode with circular brush preview, runtime brush/block controls, and
  one undo step per successful pixelation click
- Unified editor-owned object model for base images, masks, annotations, and
  session overlays
- Text annotations, Shape annotations, Draw mode with stroke erasing,
  annotation update/delete APIs, and layer operations
- Base64 and `File` exports with PNG/JPEG/WebP support, configurable
  multiplier, independent mask/annotation rendering toggles, and state-mutating
  mask/annotation merge APIs
- Non-destructive overlay persistence with stable JSON export, validation, and
  async import for masks and annotations stored separately from image pixels

## Requirements

- **Node.js**: `>= 20` for development / building from source
- **Fabric.js**: peer dependency `>=7.4.0 <8` (must be installed by the consumer)
- **Browsers**: modern evergreen (Chrome, Firefox, Safari, Edge). The library
  ships ES2019-targeted JavaScript and uses the Fabric v7 promise-based API.
- **TypeScript**: strict consumers that compile dependencies with
  `skipLibCheck: false` should include the ES2019 and DOM libraries in
  `tsconfig.json`.
  Fabric v7.4 declarations also reference `jsdom` types, so install
  `@types/jsdom` when your project type-checks Fabric's declaration files.

## Installation

```bash
npm install @bensitu/image-editor fabric
# or
pnpm add @bensitu/image-editor fabric
# or
yarn add @bensitu/image-editor fabric
```

`fabric@>=7.4.0 <8` is a peer dependency: install it explicitly so the editor
resolves the exact version your application uses.

## Module formats and entry points

The package ships a single public entry, resolved by tooling via the
`exports` map in `package.json`:

| Consumer                              | Resolves to                    |
| ------------------------------------- | ------------------------------ |
| ESM (`import`)                        | `dist/esm/index.js`            |
| CommonJS (`require`)                  | `dist/cjs/index.cjs`           |
| TypeScript (`types`)                  | `dist/types/index.d.ts`        |
| UMD (`<script>`, `unpkg`, `jsdelivr`) | `dist/umd/image-editor.umd.js` |
| `default` fallback                    | `dist/esm/index.js`            |

The UMD bundle exposes a global named `ImageEditor` and treats `fabric` as an
external global named `fabric`.

## Framework integration

The core editor is framework-agnostic and can be mounted with string IDs or
HTMLElement refs. React, Vue, Next.js, Nuxt, and other frameworks should create
and dispose the editor inside client-side lifecycle hooks.

- [React integration](docs/frameworks/react.md)
- [Vue integration](docs/frameworks/vue.md)
- [SSR / Next.js / Nuxt](docs/frameworks/ssr.md)

Runnable examples:

- [React basic example](examples/react-basic)
- [Vue basic example](examples/vue-basic)
- [Next.js client-only example](examples/next-client-only)

## Dual entry-point convention

`ImageEditor`'s constructor accepts the Fabric module either explicitly (ESM
consumers) or via `globalThis.fabric` (UMD consumers). The same source ships
in all four formats:

- **Explicit module form** (recommended for bundled apps): pass the Fabric
  module as the first argument.

    ```ts
    import * as fabric from 'fabric';
    import { ImageEditor } from '@bensitu/image-editor';

    const editor = new ImageEditor(fabric, {
        canvasWidth: 800,
        canvasHeight: 600,
    });
    ```

- **Global form** (UMD `<script>` consumers): omit the first argument; the
  constructor reads `globalThis.fabric`.

    ```html
    <script src="https://cdn.jsdelivr.net/npm/fabric@7/dist/index.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor/dist/umd/image-editor.umd.js"></script>
    <script>
        const editor = new ImageEditor.ImageEditor({
            canvasWidth: 800,
            canvasHeight: 600,
        });
    </script>
    ```

    The UMD global is a namespace object. `ImageEditor.ImageEditor` and
    `ImageEditor.default` both reference the constructor.

If neither form yields a usable Fabric module, the constructor logs a single
descriptive `console.error` and `init()` and `loadImage()` become no-ops that
resolve to `undefined`.

## Quick start

### HTML

```html
<canvas id="canvas"></canvas>

<button id="zoomInButton">Zoom In</button>
<button id="zoomOutButton">Zoom Out</button>
<button id="rotateLeftButton">Rotate Left</button>
<input id="rotateLeftDegreesInput" type="number" value="90" />
<button id="rotateRightButton">Rotate Right</button>
<input id="rotateRightDegreesInput" type="number" value="90" />
<button id="flipHorizontalButton">Flip Horizontal</button>
<button id="flipVerticalButton">Flip Vertical</button>

<label>
    Brightness
    <input id="imageBrightnessInput" type="range" min="-1" max="1" step="0.01" value="0" />
</label>
<label>
    Contrast
    <input id="imageContrastInput" type="range" min="-1" max="1" step="0.01" value="0" />
</label>
<label>
    Saturation
    <input id="imageSaturationInput" type="range" min="-1" max="1" step="0.01" value="0" />
</label>
<label>
    Blur
    <input id="imageBlurInput" type="range" min="0" max="1" step="0.01" value="0" />
</label>
<label>
    Sharpen
    <input id="imageSharpenInput" type="range" min="0" max="1" step="0.01" value="0" />
</label>
<label><input id="imageGrayscaleInput" type="checkbox" /> Grayscale</label>
<label><input id="imageSepiaInput" type="checkbox" /> Sepia</label>
<label><input id="imageVintageInput" type="checkbox" /> Vintage</label>
<button id="applyImageFiltersButton">Apply Filters</button>
<button id="resetImageFiltersButton">Reset Preview</button>
<button id="clearImageFiltersButton">Clear Filters</button>

<button id="createMaskButton">Add Mask</button>
<button id="removeSelectedMaskButton">Remove Mask</button>
<button id="removeAllMasksButton">Remove All Masks</button>
<ul id="maskList"></ul>

<button id="enterTextModeButton">Text</button>
<button id="exitTextModeButton">Exit Text</button>
<input id="textColorInput" type="color" value="#ff0000" />
<input id="textFontSizeInput" type="number" min="8" max="160" value="32" />

<select id="shapeKindSelect">
    <option value="rect">Rectangle</option>
    <option value="line">Line</option>
    <option value="arrow">Arrow</option>
</select>
<input id="shapeStrokeInput" type="color" value="#ff0000" />
<input id="shapeStrokeWidthInput" type="range" min="1" max="24" value="3" />
<button id="createShapeAnnotationButton">Add Shape</button>
<button id="enterShapeModeButton">Shape Mode</button>
<button id="exitShapeModeButton">Exit Shape</button>

<button id="enterDrawModeButton">Draw</button>
<button id="exitDrawModeButton">Exit Draw</button>
<input id="drawColorInput" type="color" value="#ff0000" />
<input id="drawBrushSizeInput" type="range" min="1" max="80" value="8" />
<button id="drawBrushSubModeButton">Brush</button>
<button id="drawEraseSubModeButton">Erase Strokes</button>
<input id="eraserBrushSizeInput" type="range" min="4" max="96" value="18" />

<button id="removeSelectedAnnotationButton">Remove Annotation</button>
<button id="removeAllAnnotationsButton">Remove All Annotations</button>
<button id="deleteSelectedObjectButton">Delete Selected</button>
<button id="bringSelectedObjectForwardButton">Forward</button>
<button id="sendSelectedObjectBackwardButton">Backward</button>
<button id="bringSelectedObjectToFrontButton">Front</button>
<button id="sendSelectedObjectToBackButton">Back</button>
<ul id="annotationList"></ul>

<button id="enterCropModeButton">Crop</button>
<select id="cropAspectRatioSelect">
    <option value="free">Free</option>
    <option value="1:1">1:1</option>
    <option value="3:4">3:4</option>
    <option value="4:3">4:3</option>
    <option value="3:2">3:2</option>
    <option value="2:3">2:3</option>
    <option value="9:16">9:16</option>
    <option value="16:9">16:9</option>
</select>
<button id="applyCropButton">Apply Crop</button>
<button id="cancelCropButton">Cancel Crop</button>

<button id="enterMosaicModeButton">Mosaic</button>
<button id="exitMosaicModeButton">Exit Mosaic</button>
<label>
    Brush size
    <input id="mosaicBrushSizeInput" type="range" min="8" max="160" step="1" value="48" />
</label>
<label>
    Block size
    <input id="mosaicBlockSizeInput" type="range" min="2" max="40" step="1" value="8" />
</label>

<button id="mergeMasksButton">Merge Masks</button>
<button id="mergeAnnotationsButton">Merge Annotations</button>
<button id="downloadImageButton">Download</button>
<button id="undoButton">Undo</button>
<button id="redoButton">Redo</button>
<button id="resetImageTransformButton">Reset</button>

<input id="imageInput" type="file" accept="image/*" />
```

### TypeScript / ESM

```ts
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';
import type { ImageEditorOptions, MaskConfig } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric, {
    canvasWidth: 800,
    canvasHeight: 600,
    backgroundColor: '#ffffff',
    defaultMosaicConfig: {
        brushSize: 48,
        blockSize: 8,
    },
    defaultTextConfig: {
        fill: '#ff0000',
        fontSize: 32,
    },
    defaultDrawConfig: {
        color: '#ff0000',
        brushSize: 8,
    },
    defaultEraserConfig: {
        brushSize: 18,
    },
    defaultShapeConfig: {
        shape: 'rect',
        stroke: '#ff0000',
        strokeWidth: 3,
        fill: 'rgba(255,0,0,0.08)',
    },
} satisfies ImageEditorOptions);

editor.init({
    canvas: 'canvas',
    zoomInButton: 'zoomInButton',
    zoomOutButton: 'zoomOutButton',
    rotateLeftButton: 'rotateLeftButton',
    rotateLeftDegreesInput: 'rotateLeftDegreesInput',
    rotateRightButton: 'rotateRightButton',
    rotateRightDegreesInput: 'rotateRightDegreesInput',
    flipHorizontalButton: 'flipHorizontalButton',
    flipVerticalButton: 'flipVerticalButton',
    createMaskButton: 'createMaskButton',
    removeSelectedMaskButton: 'removeSelectedMaskButton',
    removeAllMasksButton: 'removeAllMasksButton',
    maskList: 'maskList',
    enterCropModeButton: 'enterCropModeButton',
    cropAspectRatioSelect: 'cropAspectRatioSelect',
    applyCropButton: 'applyCropButton',
    cancelCropButton: 'cancelCropButton',
    enterMosaicModeButton: 'enterMosaicModeButton',
    exitMosaicModeButton: 'exitMosaicModeButton',
    mosaicBrushSizeInput: 'mosaicBrushSizeInput',
    mosaicBlockSizeInput: 'mosaicBlockSizeInput',
    enterTextModeButton: 'enterTextModeButton',
    exitTextModeButton: 'exitTextModeButton',
    textColorInput: 'textColorInput',
    textFontSizeInput: 'textFontSizeInput',
    enterDrawModeButton: 'enterDrawModeButton',
    exitDrawModeButton: 'exitDrawModeButton',
    drawColorInput: 'drawColorInput',
    drawBrushSizeInput: 'drawBrushSizeInput',
    removeSelectedAnnotationButton: 'removeSelectedAnnotationButton',
    removeAllAnnotationsButton: 'removeAllAnnotationsButton',
    deleteSelectedObjectButton: 'deleteSelectedObjectButton',
    mergeAnnotationsButton: 'mergeAnnotationsButton',
    bringSelectedObjectForwardButton: 'bringSelectedObjectForwardButton',
    sendSelectedObjectBackwardButton: 'sendSelectedObjectBackwardButton',
    bringSelectedObjectToFrontButton: 'bringSelectedObjectToFrontButton',
    sendSelectedObjectToBackButton: 'sendSelectedObjectToBackButton',
    annotationList: 'annotationList',
    mergeMasksButton: 'mergeMasksButton',
    downloadImageButton: 'downloadImageButton',
    undoButton: 'undoButton',
    redoButton: 'redoButton',
    resetImageTransformButton: 'resetImageTransformButton',
    imageInput: 'imageInput',
});

// Load an image programmatically (base64 data URL).
await editor.loadImage('data:image/jpeg;base64,...');

// Add a rectangular mask, then export the result as base64.
const mask: MaskConfig = { shape: 'rect', width: 120, height: 80, left: '25%', top: '25%' };
editor.createMask(mask);
editor.createTextAnnotation({ text: 'Label', left: 120, top: 80 });
editor.setImageFilterConfig({ brightness: 0.1, contrast: 0.08 });
editor.commitImageFilters();
editor.createShapeAnnotation({ shape: 'arrow', x1: 160, y1: 160, x2: 360, y2: 220 });
editor.enterDrawMode();
editor.setDrawConfig({ color: '#00aaff', brushSize: 10 });
editor.setDrawSubMode('erase');

const dataUrl = await editor.exportImageBase64({ fileType: 'png' });
```

### CommonJS

```js
const fabric = require('fabric');
const { ImageEditor } = require('@bensitu/image-editor');

const editor = new ImageEditor(fabric, { canvasWidth: 800, canvasHeight: 600 });
```

In v2, `require('@bensitu/image-editor')` returns a namespace object with
`ImageEditor`, `default`, and the editor object guards
(`isBaseImageObject`, `isMaskObject`, `isAnnotationObject`,
`isTextAnnotationObject`, `isDrawAnnotationObject`, `isShapeAnnotationObject`,
`isSessionObject`, and `isEditableOverlayObject`); it does not return the
constructor directly.

## Public API

`ImageEditor` is the only public class. The package barrel re-exports it as
both the default export and a named export, alongside the editor object guards
and the documented public types. Internal helpers (animation queue, command, history
manager, controllers, services, managers, utility modules) are intentionally
not exported and may change without notice.

### Object model

Every editor-owned Fabric object carries strict `editorObjectKind` metadata:

| Kind         | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `baseImage`  | The committed image at the bottom of the stack.                          |
| `mask`       | Editable mask overlay with required `maskId`, `maskUid`, and `maskName`. |
| `annotation` | Editable Text, Shape, or Draw overlay. Masks are not annotations.        |
| `session`    | Internal crop labels, mask labels, Mosaic previews, and tool previews.   |

Session objects are never persisted, exported, or user-deletable. Strict type
guards reject legacy mask-like objects that do not carry `editorObjectKind`.

### Constructor

```ts
new ImageEditor(fabric: FabricModule, options?: ImageEditorOptions)
new ImageEditor(options?: ImageEditorOptions)  // UMD: reads globalThis.fabric
```

### Lifecycle

| Method              | Description                                                                                                    |
| ------------------- | -------------------------------------------------------------------------------------------------------------- |
| `init(elementMap?)` | Bind the editor to DOM elements. Pass string IDs, HTMLElement refs, or `null` for unmanaged optional controls. |
| `dispose()`         | Tear down the editor, drain DOM bindings, and dispose the Fabric canvas. Idempotent.                           |
| `disposeAsync()`    | Same teardown as `dispose()`, resolving after Fabric canvas disposal settles. Idempotent.                      |

`dispose()` is synchronous and starts Fabric canvas teardown. If an integration
must immediately create another editor on the same `<canvas>` element, wait for
the next microtask or animation frame before reusing that element, or call
`await disposeAsync()`.

### Image loading

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

`LoadImageOptions` currently includes `preserveScroll?: boolean` for
preserving the container's scroll position across both successful loads and
rollback paths.

File-input loading normalizes supported JPEG EXIF orientation by default, so
phone photos with sideways encoded pixels are displayed upright. Set
`autoOrientImage: false` to preserve the raw encoded orientation. Non-identity
orientations are normalized through a canvas and re-encoded as JPEG; set
`autoOrientImageQuality` to control that JPEG quality independently, or leave it
`null` to use `downsampleQuality`. This applies only to JPEG files loaded
through the file-input path; PNG/WebP files and `loadImage(dataUrl)` use the
existing path, and arbitrary EXIF metadata is not preserved. If the browser
cannot decode the raw JPEG orientation with `createImageBitmap(...,
{ imageOrientation: 'none' })`, auto-orientation is skipped with an `onWarning`
and the original file data is loaded.

Input size guards run before browser image decode. `maxInputBytes` limits the
encoded file size or decoded base64 payload size, and `maxInputPixels` rejects
PNG/JPEG/WebP files whose header dimensions exceed the configured source-pixel
budget when those dimensions can be read cheaply.

### Read-only state

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
`getMasks()`, `getAnnotations()`, and object references inside
`getSelection()` / lifecycle callbacks are different: they return new arrays or
payload objects, but the mask and annotation elements are the live Fabric
objects on the canvas. Treat those objects as read-only from integration code.
Direct mutations such as `mask.set(...)` or `annotation.set(...)` bypass editor
history, metadata synchronization, and change callbacks.

The read-only methods and lifecycle callbacks use these public payload types:

```ts
interface ImageInfo {
    width: number;
    height: number;
    displayWidth: number;
    displayHeight: number;
    scale: number;
    rotation: number;
    canvasWidth: number;
    canvasHeight: number;
}

interface ImageEditorState {
    hasImage: boolean;
    image: ImageInfo | null;
    maskCount: number;
    annotationCount: number;
    currentScale: number;
    currentRotation: number;
    isFlippedHorizontally: boolean;
    isFlippedVertically: boolean;
    isBusy: boolean;
    activeToolMode: EditorToolMode | null;
    isCropMode: boolean;
    isMosaicMode: boolean;
    isTextMode: boolean;
    isShapeMode: boolean;
    isDrawMode: boolean;
    canUndo: boolean;
    canRedo: boolean;
    canvasWidth: number;
    canvasHeight: number;
}

interface ImageEditorSelection {
    selectedMask: MaskObject | null;
    selectedMasks: MaskObject[];
    selectedAnnotation: AnnotationObject | null;
    selectedAnnotations: AnnotationObject[];
    selectedObjectKind: 'mask' | 'annotation' | null;
}

interface ImageEditorCallbackContext {
    operation: ImageEditorOperation;
    isInternalOperation?: boolean;
}
```

`ImageEditorOperation` is the public union of operation names that can trigger
callbacks, such as `'loadImage'`, `'createMask'`, `'undo'`, and `'dispose'`.

Use `defaultLayoutMode` to choose the initial image-load strategy, then call
`setLayoutMode()` when a UI should change how future images are placed:

```ts
const editor = new ImageEditor(fabric, {
    defaultLayoutMode: 'fit',
});

await editor.loadImage(imageA);

// Future loads use cover. The current image is not re-laid out immediately.
editor.setLayoutMode('cover');
await editor.loadImage(imageB);
```

Invalid JavaScript `defaultLayoutMode` values fall back to `'expand'`.
Invalid `setLayoutMode()` calls are ignored and preserve the current mode.

File-input helpers accept JPG, PNG, and WebP files. Export output remains
controlled by the JPEG, PNG, or WebP export options.

### Transforms

| Method                  | Description                                                                                                                        |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------- |
| `scaleImage(factor)`    | Scale to `factor` (clamped to `[minScale, maxScale]`). Non-finite values are no-ops. Animated.                                     |
| `rotateImage(degrees)`  | Rotate to `degrees`. Non-finite values resolve without changing canvas state. Animated.                                            |
| `flipHorizontal()`      | Toggle horizontal flip on the base image only. Masks, annotations, and session overlays are not mirrored. Returns `Promise<void>`. |
| `flipVertical()`        | Toggle vertical flip on the base image only. Masks, annotations, and session overlays are not mirrored. Returns `Promise<void>`.   |
| `resetImageTransform()` | Animate to scale 1, rotation 0, and an unflipped state. Records exactly one history entry covering the entire transform.           |

```ts
await editor.flipHorizontal();
await editor.flipVertical();
```

### Image filters

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

Numeric ranges are `brightness`, `contrast`, and `saturation` from `-1` to
`1`; `blur` and `sharpen` from `0` to `1`. `grayscale`, `sepia`, and `vintage`
are booleans. `vintage` uses Fabric's native Vintage filter when available.
`sharpen` is implemented through a deterministic Fabric convolution kernel.

```ts
editor.setImageFilterConfig({
    brightness: 0.12,
    contrast: 0.08,
    saturation: 0.16,
});

// Preview updates do not push history until committed.
editor.commitImageFilters();

// Reset preview back to the last committed values.
editor.resetImageFilterConfig();

// Clear and commit the cleared state.
editor.clearImageFilters();
```

`saveState()`, `loadFromState()`, undo, and redo restore the editor-level
filter config and the visible Fabric filter projection. A successful
`loadImage()` always starts the new base image with neutral filters.

Export includes visible filters through the normal Fabric render path. When
crop, Mosaic, `mergeMasks()`, or `mergeAnnotations()` replaces the base image,
the current visible filtered result is baked into that operation's output once,
then the new base image starts with neutral filters so the effect is not
applied twice.

### Masks

| Method                     | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `createMask(config?)`      | The single mask-creation entry point. Returns the new `MaskObject` or `null`. |
| `removeSelectedMask()`     | Remove the currently selected mask and push one history entry.                |
| `removeAllMasks(options?)` | Remove every mask. `options.saveHistory` defaults to `true`.                  |

`MaskConfig` supports rect, circle, ellipse, polygon, and a custom
`fabricGenerator`. Falsy values in `styles` (`0`, `false`, `null`, `''`,
`NaN`) are applied verbatim.
Every mask is marked as `editorObjectKind: 'mask'` and includes required
`maskId`, `maskUid`, and `maskName` metadata.

Use `defaultMaskConfig` to define constructor-level defaults for masks created
through either `createMask()` or the built-in `createMaskButton`. Per-call
`createMask(config)` values override `defaultMaskConfig`.

```ts
const editor = new ImageEditor(fabric, {
    defaultMaskConfig: {
        color: 'rgba(255, 0, 0, 0.35)',
        alpha: 0.35,
        styles: {
            stroke: '#ff0000',
            strokeWidth: 2,
            strokeDashArray: [6, 4],
        },
    },
});

editor.createMask(); // Uses defaultMaskConfig.
editor.createMask({ color: 'rgba(0, 128, 255, 0.35)' }); // Per-call override.
```

### Crop

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

When `cropAspectRatioSelect` is bound through `init(elementMap)`, the built-in Crop
button uses the select's current value and changing the select while crop mode
is open calls `setCropAspectRatio()` to resize the active crop rectangle.

```ts
editor.enterCropMode({ aspectRatio: '1:1' });
editor.enterCropMode({ aspectRatio: '16:9' });
editor.setCropAspectRatio('4:3');
editor.enterCropMode({ aspectRatio: { width: 2, height: 1 } });
```

### Mosaic mode

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

`defaultMosaicConfig` initializes the current runtime Mosaic config. Runtime
setters update only the current config and never mutate constructor defaults.
`resetMosaicConfig()` clones the constructor defaults back into the current
config.

```ts
const editor = new ImageEditor(fabric, {
    defaultMosaicConfig: {
        brushSize: 48,
        blockSize: 8,
    },
});

editor.init({
    canvas: 'canvas',
    enterMosaicModeButton: 'enterMosaicModeButton',
    exitMosaicModeButton: 'exitMosaicModeButton',
    mosaicBrushSizeInput: 'mosaicBrushSizeInput',
    mosaicBlockSizeInput: 'mosaicBlockSizeInput',
});

editor.enterMosaicMode();
editor.setMosaicConfig({ brushSize: 64, blockSize: 12 });
editor.resetMosaicConfig();
```

`brushSize` is the circular brush diameter in canvas pixels. `blockSize` is
the source-image pixel block size; larger values produce chunkier pixelation.
Clicking outside the image is a no-op. Each successful Mosaic click bakes the
pixelated region into the base image and creates exactly one undo step. Because
Mosaic edits replace base image pixels rather than adding Fabric overlay
objects, exported images include the Mosaic naturally while the preview circle
is never exported or saved in history.

### Text, Shape, and Draw annotations

Tool modes are mutually exclusive: Crop, Mosaic, Text, Shape, and Draw cannot be
active at the same time. `getEditorState()` reports `activeToolMode` plus
`isCropMode`, `isMosaicMode`, `isTextMode`, `isShapeMode`, and `isDrawMode`.

While Text, Shape, or Draw mode is active, unrelated image operations are blocked:
export, merge, undo/redo, delete, transform, `loadImage`, and `loadFromState`
no-op through the normal guard. Exit the active mode before running those
operations. Text mode still allows `exitTextMode`, `createTextAnnotation`, and
Text config setters; Shape mode still allows `exitShapeMode` and Shape config
setters; Draw mode still allows `exitDrawMode`, Draw config setters, Draw
sub-mode changes, and eraser config setters.

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

```ts
editor.enterTextMode();
editor.setTextConfig({ fill: '#ff0000', fontSize: 32 });
editor.updateSelectedAnnotation({ fill: '#00aaff' });

editor.createShapeAnnotation({ shape: 'rect', left: '18%', top: '18%' });
editor.setShapeConfig({ stroke: '#00aaff', strokeWidth: 4, fill: 'rgba(0,170,255,0.12)' });
editor.enterShapeMode('arrow');

editor.enterDrawMode();
editor.setDrawConfig({ color: '#00aaff', brushSize: 10 });
editor.setDrawSubMode('erase');
editor.setEraserConfig({ brushSize: 24 });
```

Annotations carry `annotationHidden` and `annotationLocked` metadata. Hidden
annotations remain in state and annotation lists, but are not visible or
rendered during export until shown again. Locked annotations are non-interactive
(`selectable`, `evented`, transform controls, movement/scaling/rotation, and
text editability are disabled) and are skipped by selected-annotation
update/delete operations unless an API explicitly opts into forced removal.
Unlocking restores the annotation's intended base interactivity flags, including
non-default `selectable`, `evented`, text `editable`, and `hasControls` values
provided at creation or through supported update paths.

Shape annotations are ordinary annotation overlays, not masks. They are
included in `getAnnotations()`, selection payloads, export, merge, history,
undo/redo, and `saveState()` / `loadFromState()`. Their
`shapeAnnotationKind` metadata is one of `'rect'`, `'line'`, or `'arrow'`.
Interactive Shape mode uses a session-only preview object, so cancelled or
in-progress shapes are not serialized or exported. Calling `enterShapeMode()`
again or changing the persistent `shape` through `setShapeConfig()` switches the
active shape without leaving Shape mode.

The eraser is a Draw sub-mode, not a top-level editor mode. It targets Draw
annotations only and removes intersected Draw strokes as whole annotation
objects. It does not erase base-image pixels, masks, text annotations, shape
annotations, or session previews.

### Layer operations

Editable overlays include masks and annotations. Layer operations keep the
base image below overlays and session objects above overlays.

| Method                         | Description                                       |
| ------------------------------ | ------------------------------------------------- |
| `bringSelectedObjectForward()` | Move selected editable overlays one step up.      |
| `sendSelectedObjectBackward()` | Move selected editable overlays one step down.    |
| `bringSelectedObjectToFront()` | Move selected editable overlays to overlay front. |
| `sendSelectedObjectToBack()`   | Move selected editable overlays to overlay back.  |

### Merge and export

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

```ts
await editor.exportImageBase64({ mergeMasks: true, mergeAnnotations: true });
await editor.exportImageBase64({ mergeMasks: false, mergeAnnotations: true });
await editor.exportImageBase64({ mergeMasks: true, mergeAnnotations: false });
await editor.exportImageBase64({ mergeMasks: false, mergeAnnotations: false });

const dataUrl = await editor.exportImageBase64({ fileType: 'png', exportArea: 'image' });
const file = await editor.exportImageFile({
    fileType: 'webp',
    quality: 0.85,
    fileName: 'edited',
});
await editor.downloadImage({
    fileType: 'png',
    fileName: 'edited',
    mergeMasks: false,
    mergeAnnotations: false,
});
```

`mergeMasks` and `mergeAnnotations` in export options affect the rendered output
only. They do not mutate editor state, remove objects, or push history entries.
State-mutating merge APIs are `mergeMasks()` and `mergeAnnotations()`.
`mergeMasks()` preserves annotations; `mergeAnnotations()` preserves masks.

### Non-destructive overlay persistence

Overlay persistence stores the original image and editable overlays separately.
Applications can keep the image file in object storage, a CDN, or a database,
and store the overlay JSON beside it. Re-open the same image later, import the
overlay JSON, continue editing masks and annotations, and export a final raster
only when needed.

This API is not Fabric.js JSON and is not the editor's `saveState()` snapshot.
It is a stable, versioned wire format with `schema:
'image-editor.overlay-state'`, `version: 1`, `coordinateSpace:
'image-normalized'`, one ordered `overlays[]` array, and optional
`baseImageTransform` metadata. Here `version: 1` means overlay-state schema
version 1, independent from the npm package version. Package v2.x may still use
overlay-state schema version 1.

| Method                                | Description                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `exportOverlayState(options?)`        | Return pure JSON-compatible `OverlayState` for editable overlays only.         |
| `validateOverlayState(input)`         | Validate and normalize unknown overlay JSON without mutating the editor.       |
| `importOverlayState(input, options?)` | Validate, then atomically import overlays. Returns a structured import result. |

```ts
const overlayState = editor.exportOverlayState({
    includeHidden: true,
    includeLocked: true,
    includeMetadata: true,
});

localStorage.setItem('image-123-overlays', JSON.stringify(overlayState));
```

```ts
const parsed = JSON.parse(localStorage.getItem('image-123-overlays') ?? 'null');
const validation = editor.validateOverlayState(parsed);

if (!validation.valid) {
    console.error(validation.errors);
}
```

```ts
await editor.loadImage(originalImageDataUrl);

const result = await editor.importOverlayState(parsed, {
    mode: 'replace',
    idStrategy: 'regenerate',
    saveHistory: true,
});

console.log(result.importedOverlays, result.warnings);
```

`mode: 'replace'` removes existing editable overlays and imports the new
ordered `overlays[]` array as one transaction. `mode: 'append'` keeps existing
overlays and appends imported overlays above them while preserving imported
relative order. Import creates one undoable history entry by default; pass
`saveHistory: false` for silent programmatic restores.

`idStrategy: 'regenerate'` is the default and creates fresh runtime IDs while
returning `regeneratedIds`. `idStrategy: 'preserve'` keeps stable overlay IDs
when they cannot collide; runtime counters remain editor-owned.

Coordinates are original image pixel coordinates normalized to `[0, 1]`.
`{ x: 0.25, y: 0.4 }` means source pixel
`x = 0.25 * naturalWidth`, `y = 0.4 * naturalHeight`, independent of canvas
layout, zoom, scroll, and display scaling. `baseImageTransform` records
base-image `flipX`, `flipY`, and arbitrary-degree `rotation`; transform order
is `flipX`, then `flipY`, then `rotation`, around the original image center.
Overlay `angle` remains local to the overlay. Conceptually, visual rotation is
`baseImageTransform.rotation + overlay.angle`.

Existing interactive `flipHorizontal()` and `flipVertical()` remain
base-image-only: they do not move existing overlays. Overlay persistence handles
that compatibility explicitly by recording the base-image flip state on export
and mapping imported overlay coordinates through the persisted transform.

The exporter excludes transient/session state: selection, hover highlights,
mask labels, crop rectangles, Mosaic previews, active text cursor/editing
state, in-progress Draw strokes, Shape previews, transform handles, and other
session-only objects. Mask style export reads stable normal fields such as
`originalAlpha`, `originalStroke`, and `originalStrokeWidth`, so hover or
selection styling does not leak into persisted JSON.

Validation limits protect browser responsiveness:

| Limit                    | Default  |
| ------------------------ | -------- |
| `maxOverlays`            | `500`    |
| `maxPolygonPoints`       | `1000`   |
| `maxDrawStrokes`         | `500`    |
| `maxDrawPointsPerStroke` | `5000`   |
| `maxDrawTotalPoints`     | `100000` |
| `maxTextLength`          | `10000`  |
| `maxMetadataDepth`       | `4`      |
| `maxMetadataBytes`       | `65536`  |

Raise these through `OverlayValidationOptions` for specialized domains such as
medical imaging, maps, or CAD-like annotation tools. Defaults are conservative
for general-purpose browser UI and accidental or malicious oversized JSON.

Persistent colors are canonical `#RRGGBB` or `#RRGGBBAA`. Import also accepts
common `rgb()` and `rgba()` strings and normalizes them before creating runtime
objects. Overlay-level opacity fields win for object opacity; alpha in
`#RRGGBBAA` belongs to that color channel and is not silently multiplied by
object opacity.

If a text overlay requests a font that the host runtime cannot render, import
still succeeds. The requested `fontFamily` is preserved under `core.font`
metadata and runtime rendering falls back to the editor's configured default
font or the browser's deterministic fallback.

Custom overlays use namespaced `customType` values:
`builtin.<name>`, `app.<name>.<type>`, or `plugin.<name>.<type>`. Unknown
custom overlay types are skipped with warnings instead of crashing import.
Metadata namespaces follow the same collision-avoidance pattern:
`core.*` is reserved, `app.*` belongs to host applications, and `plugin.*`
belongs to plugins.

Future overlay-state schema work is intentionally outside schema version 1:
partial/diff export for collaboration, binary encodings such as CBOR or
MessagePack for very large Draw data, native group overlays, a richer public
custom overlay registry, and domain-specific higher payload limits.

### State and history

| Method                    | Description                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `saveState()`             | Capture a snapshot of the canvas plus editor metadata into the history stack.         |
| `loadFromState(snapshot)` | Restore canvas, masks, and editor metadata from a snapshot. Returns `Promise<void>`.  |
| `undo()`                  | Undo the last state change. Routed through the animation queue. No-op while disposed. |
| `redo()`                  | Redo the next state change. Routed through the animation queue. No-op while disposed. |

`loadFromState()` is designed for snapshots produced by this editor's
`saveState()`. If snapshots come from external storage or user-controlled
input, validate or reject untrusted JSON before passing it to the editor.

## Configuration options

Pass an `ImageEditorOptions` object as the second constructor argument
(or as the only argument when using the UMD global form). Unknown keys are
ignored, unsupported runtime values fall back to documented defaults, and nested
`label` and `crop` objects are deep-merged with the defaults.

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
| `onImageLoadStart`          | `null`            | Called as `(context)` before a valid image load begins.                                                                                                                                                                                                                                       |
| `onImageLoaded`             | `null`            | Called as `(imageInfo, context)` once after a successful `loadImage`. Extra arguments are ignored by existing zero-argument JavaScript handlers.                                                                                                                                              |
| `onImageCleared`            | `null`            | Called as `(previousImage, context)` when a committed image is replaced or cleared.                                                                                                                                                                                                           |
| `onImageChanged`            | `null`            | Called as `(state, context)` with a safe editor state snapshot after visible editor state changes.                                                                                                                                                                                            |
| `onBusyChange`              | `null`            | Called as `(isBusy, context)` only when the public busy state changes.                                                                                                                                                                                                                        |
| `onToolModeChange`          | `null`            | Called as `(activeToolMode, previousToolMode, context)` only when the active tool mode changes.                                                                                                                                                                                               |
| `onHistoryChange`           | `null`            | Called as `({ canUndo, canRedo }, context)` only when undo/redo availability changes.                                                                                                                                                                                                         |
| `onEditorDisposed`          | `null`            | Called as `(context)` once when `dispose()` performs teardown.                                                                                                                                                                                                                                |
| `onMasksChanged`            | `null`            | Called as `(masks, context)` with a shallow copy of current mask objects after the mask collection changes.                                                                                                                                                                                   |
| `onAnnotationsChanged`      | `null`            | Called as `(annotations, context)` with a shallow copy of current annotation objects after the annotation collection changes.                                                                                                                                                                 |
| `onSelectionChange`         | `null`            | Called as `(selection, context)` with selected mask and annotation payload after selection changes.                                                                                                                                                                                           |
| `onError`                   | `null`            | Called as `(error, message)` when the editor reports an error.                                                                                                                                                                                                                                |
| `onWarning`                 | `null`            | Called as `(error, message)` when the editor reports a recoverable warning.                                                                                                                                                                                                                   |
| `label`                     | see source        | `LabelConfig` for selected-mask labels (`getText`, `textOptions`, `create`).                                                                                                                                                                                                                  |
| `crop`                      | see source        | `CropConfig` (`minWidth`, `minHeight`, `padding`, `aspectRatio`, `hideMasksDuringCrop`, `preserveMasksAfterCrop`, `allowRotationOfCropRect`, `exportFileType`, `exportQuality`). `applyCrop()` preserves the current image format by default (`'source'`) and falls back to PNG when unknown. |

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

`maskListOrder` and `annotationListOrder` affect only the sidebar DOM order. They do not change canvas z-order, object IDs, history, or export output. Invalid runtime values fall back to `'front-to-back'`.

`crop.exportFileType` defaults to `'source'`. Supported explicit values are
`'png'`, `'jpeg'`, `'jpg'`, `'webp'`, and full image MIME strings. PNG is
lossless and ignores `crop.exportQuality`; JPEG/WebP use `crop.exportQuality`
when finite, otherwise `downsampleQuality`, otherwise `0.92`. Choose JPEG/WebP
only when smaller intermediate crop output is preferred.

`defaultMosaicConfig.outputFileType` also defaults to `'source'`. Mosaic commits
preserve the current image MIME type when known and fall back to PNG when the
source format cannot be determined. JPEG/WebP commits use
`defaultMosaicConfig.outputQuality` when finite, otherwise `downsampleQuality`.

## Example workflow

1. Construct `ImageEditor` with options and call `init(elementMap)` to wire it up.
2. Load an image via `loadImage(base64)` or the bound file input.
3. Adjust with `scaleImage`, `rotateImage`, `flipHorizontal`, `flipVertical`,
   `resetImageTransform`, image filters, Crop mode, Mosaic mode, Text mode,
   Shape mode, or Draw mode.
4. Add `createMask` and text, shape, or draw annotation calls, then inspect via
   `maskList` and `annotationList`.
5. Use `mergeMasks()` or `mergeAnnotations()` to bake overlays into the image, then
   `exportImageBase64`, `exportImageFile`, or `downloadImage` to produce
   the final output.
6. Call `dispose()` when the editor is unmounted, or `disposeAsync()` if the
   wrapper must await Fabric canvas teardown before immediate remount.

## Building from source

```bash
npm install
npm run build
```

`npm run build` runs `clean → build:esm → build:cjs → build:types →
build:umd` in order, emitting:

- `dist/esm/index.js` (and the rest of the decomposed source tree)
- `dist/cjs/index.cjs`
- `dist/types/index.d.ts`
- `dist/umd/image-editor.umd.js`

`npm test` runs the Node-based unit and property tests under `tests/`.

### Browser tests

```bash
npm run test:e2e
npm run test:e2e:all
npm run test:browser
npm run test:browser:release
npm run test:browser:all
```

`npm run test:e2e` is the fast local E2E check and runs Chromium only.
`npm run test:e2e:all` runs the full Playwright E2E suite in Chromium,
Firefox, and WebKit, matching CI browser coverage. Local developers do not need
system Firefox or Safari installed; Playwright downloads and manages its own
browser binaries. Install the full local browser set when needed with:

```bash
npx playwright install chromium firefox webkit
```

`npm run test:browser` keeps the broader browser suite Chromium-only for local
iteration. `npm run test:browser:release` runs cross-browser E2E plus the
Chromium-only visual suite. `npm run test:browser:all` is kept as an alias for
that release browser matrix.

### Visual regression tests

```bash
npm run test:visual
npm run test:visual:update
```

Visual tests compare deterministic exported-image screenshots. Run
`npm run test:visual:update` after intentional rendering changes, then review
the updated snapshots before committing them. Visual tests are intentionally
Chromium-only unless browser-specific snapshots are added.

For the full local release gate, run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run package:check
npm run release:gate
npm pack --dry-run
npm run release:check
npm run test:e2e:all
npm audit --audit-level=high
```

`npm run release:gate` validates generated artifacts, bundle shape, declaration
output, and package export metadata. Run it only after `npm run build`; the
convenience command `npm run release:check` runs build, package linting, the
release gate, and `npm pack --dry-run` in order.

`npm run ci` combines format, lint, typecheck, tests, and `release:check`.
Playwright visual tests are kept outside the default CI command until they are
stable across supported environments. The test suite also supports a clean
checkout where `dist/` has not been built yet; integration helpers use source
modules until build artifacts exist, while release-gate artifact checks run only
after the build step.

## Browser support

- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

The distributed JavaScript targets ES2019 and modern DOM APIs. Older runtime
targets must be transpiled by the consumer.

## Type declarations

Public types are re-exported from the package root:

```ts
import type {
    ImageEditorOptions,
    ResolvedOptions,
    LabelConfig,
    CropConfig,
    MosaicConfig,
    ResolvedMosaicConfig,
    ImageFilterConfig,
    ResolvedImageFilterConfig,
    LoadImageOptions,
    RemoveAllMasksOptions,
    DefaultMaskConfig,
    MaskConfig,
    MaskObject,
    MaskNumericProp,
    ResolvedMaskConfig,
    ImageMimeType,
    ImageFileType,
    NormalizedImageFormat,
    ExportArea,
    OverlayListOrder,
    CropExportFileType,
    MosaicOutputFileType,
    ImageExportOptions,
    CropAspectRatioPreset,
    CropAspectRatio,
    CropModeOptions,
    TextAnnotationConfig,
    ResolvedTextAnnotationConfig,
    DrawConfig,
    DrawSubMode,
    ResolvedDrawConfig,
    EraserConfig,
    ResolvedEraserConfig,
    ShapeAnnotationKind,
    ShapeAnnotationConfig,
    ResolvedShapeAnnotationConfig,
    OverlayNumericProp,
    AnnotationType,
    AnnotationObject,
    TextAnnotationObject,
    DrawAnnotationObject,
    ShapeAnnotationObject,
    EditorToolMode,
    ImageInfo,
    ImageEditorState,
    ImageEditorSelection,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    ElementTarget,
    ElementMap,
    ElementIdMap,
    ResizeToContainerOptions,
    RelayoutOptions,
    FabricModule,
    ExportOverlayStateOptions,
    ImportOverlayStateOptions,
    ImportOverlayStateResult,
    OverlayState,
    OverlayImageInfo,
    OverlayBaseImageTransform,
    OverlayValidationOptions,
    OverlayValidationResult,
    OverlayValidationError,
    OverlayImportWarning,
    OverlayMetadata,
    SerializedOverlay,
    SerializedMaskOverlay,
    SerializedTextAnnotationOverlay,
    SerializedShapeAnnotationOverlay,
    SerializedDrawAnnotationOverlay,
    SerializedCustomOverlay,
} from '@bensitu/image-editor';
```

## License

MIT © Ben Situ.

Fabric.js is distributed under its own MIT license.
