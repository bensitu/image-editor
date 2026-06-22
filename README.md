# @bensitu/image-editor

[![npm](https://img.shields.io/npm/l/@bensitu/image-editor.svg)](https://github.com/bensitu/image-editor)
[![npm](https://img.shields.io/npm/v/@bensitu/image-editor.svg)](https://www.npmjs.com/package/@bensitu/image-editor)
[![](https://data.jsdelivr.com/v1/package/npm/@bensitu/image-editor/badge)](https://www.jsdelivr.com/package/npm/@bensitu/image-editor)

A lightweight, TypeScript-first canvas image editor built on top of
[Fabric.js](https://fabricjs.com/) v7. `ImageEditor` wraps a Fabric canvas
with image loading, scale and rotation, mask creation, Text and Draw
annotations, crop, Mosaic mode, base-image flips, history (undo/redo), layer operations, and
base64/file export — exposed as a single canonical class
with a stable public surface.

## Demo

[https://bensitu.github.io/image-editor/](https://bensitu.github.io/image-editor/)

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
- Mosaic mode with circular brush preview, runtime brush/block controls, and
  one undo step per successful pixelation click
- Unified editor-owned object model for base images, masks, annotations, and
  session overlays
- Text annotations, Draw mode, annotation update/delete APIs, and layer
  operations
- Base64 and `File` exports with PNG/JPEG/WebP support, configurable
  multiplier, independent mask/annotation rendering toggles, and state-mutating
  mask/annotation merge APIs

## Requirements

- **Node.js**: `>= 20` for development / building from source
- **Fabric.js**: peer dependency `^7.0.0` (must be installed by the consumer)
- **Browsers**: modern evergreen (Chrome, Firefox, Safari, Edge). The library
  uses ES2022 features and the Fabric v7 promise-based API.
- **TypeScript**: strict consumers that compile dependencies with
  `skipLibCheck: false` should include the ES2022 library in `tsconfig.json`.
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

`fabric@^7.0.0` is a peer dependency: install it explicitly so the editor
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
        const editor = new ImageEditor({
            canvasWidth: 800,
            canvasHeight: 600,
        });
    </script>
    ```

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

<button id="createMaskButton">Add Mask</button>
<button id="removeSelectedMaskButton">Remove Mask</button>
<button id="removeAllMasksButton">Remove All Masks</button>
<ul id="maskList"></ul>

<button id="enterTextModeButton">Text</button>
<button id="exitTextModeButton">Exit Text</button>
<input id="textColorInput" type="color" value="#ff0000" />
<input id="textFontSizeInput" type="number" min="8" max="160" value="32" />

<button id="enterDrawModeButton">Draw</button>
<button id="exitDrawModeButton">Exit Draw</button>
<input id="drawColorInput" type="color" value="#ff0000" />
<input id="drawBrushSizeInput" type="range" min="1" max="80" value="8" />

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
editor.enterDrawMode();
editor.setDrawConfig({ color: '#00aaff', brushSize: 10 });

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
`isTextAnnotationObject`, `isDrawAnnotationObject`, `isSessionObject`, and
`isEditableOverlayObject`); it does not return the constructor directly.

## Public API

`ImageEditor` is the only public class. The package barrel re-exports it as
both the default export and a named export, alongside the editor object guards
and the documented public types. Internal helpers (animation queue, command, history
manager, controllers, services, managers, utility modules) are intentionally
not exported and may change without notice.

The facade delegates most mutable implementation state through an internal
`EditorRuntime` plus action/context adapters. This does not add any public
entry points; consumers should continue to import from `@bensitu/image-editor`
only.

### Object model

Every editor-owned Fabric object carries strict `editorObjectKind` metadata:

| Kind         | Meaning                                                                  |
| ------------ | ------------------------------------------------------------------------ |
| `baseImage`  | The committed image at the bottom of the stack.                          |
| `mask`       | Editable mask overlay with required `maskId`, `maskUid`, and `maskName`. |
| `annotation` | Editable Text or Draw overlay. Masks are not annotations.                |
| `session`    | Internal crop labels, mask labels, Mosaic previews, and tool previews.   |

Session objects are never persisted, exported, or user-deletable. Strict type
guards reject legacy mask-like objects that do not carry `editorObjectKind`.

### Constructor

```ts
new ImageEditor(fabric: FabricModule, options?: ImageEditorOptions)
new ImageEditor(options?: ImageEditorOptions)  // UMD: reads globalThis.fabric
```

### Lifecycle

| Method         | Description                                                                          |
| -------------- | ------------------------------------------------------------------------------------ |
| `init(idMap?)` | Bind the editor to DOM elements. Pass an `ElementIdMap`; any key may be omitted.     |
| `dispose()`    | Tear down the editor, drain DOM bindings, and dispose the Fabric canvas. Idempotent. |

### Image loading

| Method                        | Description                                                                                                                                                                                           |
| ----------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadImage(base64, options?)` | Load a supported raster image data URL (`png`, `jpeg`, `webp`, `gif`, or `bmp`). Returns `Promise<void>`. Transactional: any failure restores the prior canvas, scroll, overflow, and snapshot state. |
| `isImageLoaded()`             | Returns `true` if a valid image is currently loaded on the canvas.                                                                                                                                    |
| `isBusy()`                    | Returns `true` while the editor is loading, animating, or in Crop, Mosaic, Text, or Draw mode.                                                                                                        |
| `setLayoutMode(mode)`         | Select the layout strategy for future image loads. `mode` is `'fit'`, `'cover'`, or `'expand'`.                                                                                                       |

`LoadImageOptions` currently includes `preserveScroll?: boolean` for
preserving the container's scroll position across both successful loads and
rollback paths.

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

File-input helpers accept JPG, PNG, WebP, GIF, and BMP files. GIF and BMP are
decoded as static raster input for canvas editing; GIF animation and BMP/GIF
source-format preservation are not retained. Export output remains controlled by
the JPEG, PNG, or WebP export options.

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

When `cropAspectRatioSelect` is bound through `init(idMap)`, the built-in Crop
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

### Text and Draw annotations

Tool modes are mutually exclusive: Crop, Mosaic, Text, and Draw cannot be
active at the same time. `getEditorState()` reports `activeToolMode` plus
`isCropMode`, `isMosaicMode`, `isTextMode`, and `isDrawMode`.

While Text or Draw mode is active, unrelated image operations are blocked:
export, merge, undo/redo, delete, transform, `loadImage`, and `loadFromState`
no-op through the normal guard. Exit the active mode before running those
operations. Text mode still allows `exitTextMode`, `createTextAnnotation`, and
Text config setters; Draw mode still allows `exitDrawMode` and Draw config
setters.

| Method                               | Description                                                                |
| ------------------------------------ | -------------------------------------------------------------------------- |
| `getAnnotations()`                   | Return current annotation objects in canvas order. Masks are not included. |
| `enterTextMode()` / `exitTextMode()` | Click empty canvas space to create editable text annotations.              |
| `createTextAnnotation(config?)`      | Create a text annotation directly and return it.                           |
| `getTextConfig()`                    | Return a defensive copy of the current Text config.                        |
| `setTextConfig(config)`              | Patch current Text config without history.                                 |
| `resetTextConfig()`                  | Restore Text config from constructor defaults.                             |
| `setTextColor(color)`                | Convenience setter for text fill color.                                    |
| `setTextFontSize(size)`              | Convenience setter for text font size.                                     |
| `enterDrawMode()` / `exitDrawMode()` | Use Fabric free drawing; each stroke becomes a Draw annotation.            |
| `getDrawConfig()`                    | Return a defensive copy of the current Draw config.                        |
| `setDrawConfig(config)`              | Patch current Draw config without history.                                 |
| `resetDrawConfig()`                  | Restore Draw config from constructor defaults.                             |
| `setDrawColor(color)`                | Convenience setter for brush color.                                        |
| `setDrawBrushSize(size)`             | Convenience setter for brush size.                                         |
| `updateAnnotation(id, config)`       | Update an annotation by id.                                                |
| `updateSelectedAnnotation(config)`   | Update selected annotation objects.                                        |
| `removeSelectedAnnotation()`         | Remove selected unlocked annotations.                                      |
| `removeAllAnnotations(options?)`     | Remove annotations only. Masks are preserved.                              |
| `deleteSelectedObject()`             | Convenience deletion for selected masks and unlocked annotations.          |

```ts
editor.enterTextMode();
editor.setTextConfig({ fill: '#ff0000', fontSize: 32 });
editor.updateSelectedAnnotation({ fill: '#00aaff' });

editor.enterDrawMode();
editor.setDrawConfig({ color: '#00aaff', brushSize: 10 });
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

| Method                        | Description                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `mergeMasks()`                | Bake masks into the base image atomically. Returns `Promise<void>`.                            |
| `mergeAnnotations()`          | Bake annotations into the base image atomically. Returns `Promise<void>`.                      |
| `exportImageBase64(options?)` | Returns `Promise<string>` (data URL). Resolves to `''` with a warning when no image is loaded. |
| `exportImageFile(options?)`   | Returns `Promise<File>`. Rejects when no image is loaded.                                      |
| `downloadImage(options?)`     | Returns `Promise<void>` and triggers a browser download. No-op when no image is loaded.        |

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

### State and history

| Method                    | Description                                                                           |
| ------------------------- | ------------------------------------------------------------------------------------- |
| `saveState()`             | Capture a snapshot of the canvas plus editor metadata into the history stack.         |
| `loadFromState(snapshot)` | Restore canvas, masks, and editor metadata from a snapshot. Returns `Promise<void>`.  |
| `undo()`                  | Undo the last state change. Routed through the animation queue. No-op while disposed. |
| `redo()`                  | Redo the next state change. Routed through the animation queue. No-op while disposed. |

## Configuration options

Pass an `ImageEditorOptions` object as the second constructor argument
(or as the only argument when using the UMD global form). Unknown keys are
ignored; nested `label` and `crop` objects are deep-merged with the defaults.

| Option                      | Default          | Description                                                                                                                                                                                                                                                                                   |
| --------------------------- | ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canvasWidth`               | `800`            | Initial and hidden-container fallback canvas width in pixels.                                                                                                                                                                                                                                 |
| `canvasHeight`              | `600`            | Initial and hidden-container fallback canvas height in pixels.                                                                                                                                                                                                                                |
| `backgroundColor`           | `'transparent'`  | Fabric canvas background color.                                                                                                                                                                                                                                                               |
| `animationDuration`         | `300`            | Duration of scale and rotate animations (ms).                                                                                                                                                                                                                                                 |
| `minScale`                  | `0.1`            | Minimum scale factor.                                                                                                                                                                                                                                                                         |
| `maxScale`                  | `5.0`            | Maximum scale factor.                                                                                                                                                                                                                                                                         |
| `scaleStep`                 | `0.05`           | Scale delta per zoom step.                                                                                                                                                                                                                                                                    |
| `rotationStep`              | `90`             | Rotation step in degrees.                                                                                                                                                                                                                                                                     |
| `defaultLayoutMode`         | `'expand'`       | Initial layout mode for image loads until changed by `setLayoutMode()`. Use `'fit'`, `'cover'`, or `'expand'`. Invalid runtime values fall back to `'expand'`.                                                                                                                                |
| `downsampleOnLoad`          | `true`           | Downsample large images on load.                                                                                                                                                                                                                                                              |
| `downsampleMaxWidth`        | `4000`           | Max width before downsampling kicks in.                                                                                                                                                                                                                                                       |
| `downsampleMaxHeight`       | `3000`           | Max height before downsampling kicks in.                                                                                                                                                                                                                                                      |
| `downsampleQuality`         | `0.92`           | Lossy quality used when downsampling and exporting.                                                                                                                                                                                                                                           |
| `preserveSourceFormat`      | `true`           | Preserve PNG/WebP MIME through downsampling unless `downsampleMimeType` is set.                                                                                                                                                                                                               |
| `downsampleMimeType`        | `null`           | Explicit downsample MIME type. Overrides `preserveSourceFormat`.                                                                                                                                                                                                                              |
| `imageLoadTimeoutMs`        | `30000`          | Maximum duration for both decode and Fabric image creation during `loadImage`.                                                                                                                                                                                                                |
| `exportMultiplier`          | `1`              | Output resolution multiplier.                                                                                                                                                                                                                                                                 |
| `maxExportPixels`           | `50000000`       | Maximum output pixel count after applying the export multiplier. Invalid values fall back to this default.                                                                                                                                                                                    |
| `maxHistorySize`            | `50`             | Maximum undo-history entries. Snapshots may include full image data URLs, so large images can duplicate memory across history entries. Lower this for memory-constrained pages.                                                                                                               |
| `exportAreaByDefault`       | `'image'`        | Default export region for `exportImageBase64`, `exportImageFile`, and `downloadImage`.                                                                                                                                                                                                        |
| `mergeMasksByDefault`       | `true`           | Default mask rendering behavior for `exportImageBase64`, `exportImageFile`, and `downloadImage`.                                                                                                                                                                                              |
| `mergeAnnotationsByDefault` | `true`           | Default annotation rendering behavior for `exportImageBase64`, `exportImageFile`, and `downloadImage`.                                                                                                                                                                                        |
| `defaultMaskWidth`          | `50`             | Default mask width.                                                                                                                                                                                                                                                                           |
| `defaultMaskHeight`         | `80`             | Default mask height.                                                                                                                                                                                                                                                                          |
| `defaultMaskConfig`         | `{}`             | Defaults applied by `createMask()` after `defaultMaskWidth` / `defaultMaskHeight` and before per-call config. Supports `MaskConfig` fields except `onCreate` and `fabricGenerator`.                                                                                                           |
| `defaultMosaicConfig`       | see source       | Defaults used to initialize the current Mosaic tool config. Supports `brushSize`, `blockSize`, preview circle styling, `outputFileType`, and `outputQuality`. Runtime Mosaic setters update the current config only.                                                                          |
| `defaultTextConfig`         | see source       | Defaults used to initialize the current Text annotation config. Runtime Text setters update the current config only.                                                                                                                                                                          |
| `defaultDrawConfig`         | see source       | Defaults used to initialize the current Draw mode config. Runtime Draw setters update the current config only.                                                                                                                                                                                |
| `maskRotatable`             | `false`          | Allow masks to be rotated by the user.                                                                                                                                                                                                                                                        |
| `maskLabelOnSelect`         | `true`           | Show a label above a selected mask.                                                                                                                                                                                                                                                           |
| `maskLabelOffset`           | `3`              | Pixel offset of the label from the mask's top-left corner.                                                                                                                                                                                                                                    |
| `maskName`                  | `'mask'`         | Prefix used for auto-generated mask names.                                                                                                                                                                                                                                                    |
| `textAnnotationName`        | `'text'`         | Prefix used for auto-generated text annotation names.                                                                                                                                                                                                                                         |
| `drawAnnotationName`        | `'draw'`         | Prefix used for auto-generated draw annotation names.                                                                                                                                                                                                                                         |
| `groupSelection`            | `false`          | Allow Fabric multi-object group selection on the canvas.                                                                                                                                                                                                                                      |
| `showPlaceholder`           | `true`           | Show a placeholder element while no image is loaded.                                                                                                                                                                                                                                          |
| `initialImageBase64`        | `null`           | Base64 data URL auto-loaded after construction.                                                                                                                                                                                                                                               |
| `defaultDownloadFileName`   | `'edited_image'` | Default filename base used by `exportImageFile()` and `downloadImage()`. The resolved export format supplies or corrects the extension.                                                                                                                                                       |
| `onImageLoadStart`          | `null`           | Called before a valid image load begins.                                                                                                                                                                                                                                                      |
| `onImageLoaded`             | `null`           | Called as `(info, context)` once after a successful `loadImage`. Extra arguments are ignored by existing zero-argument JavaScript handlers.                                                                                                                                                   |
| `onImageCleared`            | `null`           | Called when a committed image is replaced or cleared.                                                                                                                                                                                                                                         |
| `onImageChanged`            | `null`           | Called with a safe editor state snapshot after visible editor state changes.                                                                                                                                                                                                                  |
| `onBusyChange`              | `null`           | Called only when the public busy state changes.                                                                                                                                                                                                                                               |
| `onEditorDisposed`          | `null`           | Called once when `dispose()` performs teardown.                                                                                                                                                                                                                                               |
| `onMasksChanged`            | `null`           | Called with a shallow copy of current mask objects after the mask collection changes.                                                                                                                                                                                                         |
| `onAnnotationsChanged`      | `null`           | Called with a shallow copy of current annotation objects after the annotation collection changes.                                                                                                                                                                                             |
| `onSelectionChange`         | `null`           | Called with selected object payload after selection changes.                                                                                                                                                                                                                                  |
| `onError`                   | `null`           | Called as `(error, message)` when the editor reports an error.                                                                                                                                                                                                                                |
| `onWarning`                 | `null`           | Called as `(error, message)` when the editor reports a recoverable warning.                                                                                                                                                                                                                   |
| `label`                     | see source       | `LabelConfig` for selected-mask labels (`getText`, `textOptions`, `create`).                                                                                                                                                                                                                  |
| `crop`                      | see source       | `CropConfig` (`minWidth`, `minHeight`, `padding`, `aspectRatio`, `hideMasksDuringCrop`, `preserveMasksAfterCrop`, `allowRotationOfCropRect`, `exportFileType`, `exportQuality`). `applyCrop()` preserves the current image format by default (`'source'`) and falls back to PNG when unknown. |

`crop.exportFileType` defaults to `'source'`. Supported explicit values are
`'png'`, `'jpeg'`, `'jpg'`, `'webp'`, and full image MIME strings. PNG is
lossless and ignores `crop.exportQuality`; JPEG/WebP use `crop.exportQuality`
when finite, otherwise `downsampleQuality`, otherwise `0.92`. Choose JPEG/WebP
only when smaller intermediate crop output is preferred.

`defaultMosaicConfig.outputFileType` also defaults to `'source'`. Mosaic commits
preserve the current image MIME type when known and fall back to PNG when the
source format cannot be determined. JPEG/WebP commits use
`defaultMosaicConfig.outputQuality` when finite, otherwise `downsampleQuality`.

## Breaking changes in v2

- `Base64ExportOptions`, `ImageFileExportOptions`, and `DownloadImageOptions`
  were replaced by `ImageExportOptions`.
- `downloadImage(fileName: string)` was removed. Use
  `downloadImage({ fileName })`.
- `downloadImage()` now returns `Promise<void>`.
- `defaultDownloadFileName` now defaults to `'edited_image'`; export format
  resolution supplies or corrects the final extension.
- All editor-owned Fabric objects now require `editorObjectKind`.
- `isMaskObject()` is strict and rejects legacy objects with only `maskId`.
- `MaskObject.maskUid` is required.
- Serialized states without `editorObjectKind` are not migrated.
- Export option `mergeMask` was removed; use `mergeMasks`.
- Constructor option `mergeMaskByDefault` was removed; use `mergeMasksByDefault`.

## Example workflow

1. Construct `ImageEditor` with options and call `init(idMap)` to wire it up.
2. Load an image via `loadImage(base64)` or the bound file input.
3. Adjust with `scaleImage`, `rotateImage`, `flipHorizontal`, `flipVertical`,
   `resetImageTransform`, Crop mode, Mosaic mode, Text mode, or Draw mode.
4. Add `createMask` and annotation calls, then inspect via `maskList` and
   `annotationList`.
5. Use `mergeMasks()` or `mergeAnnotations()` to bake overlays into the image, then
   `exportImageBase64`, `exportImageFile`, or `downloadImage` to produce
   the final output.
6. Call `dispose()` when the editor is unmounted.

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

For the full local release gate, run:

```bash
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run package:check
npm audit --audit-level=high
npm pack --dry-run
```

`npm run ci` combines format, lint, typecheck, tests, build, and package
linting. The test suite also supports a clean checkout where `dist/` has not
been built yet; integration helpers use source modules until build artifacts
exist, while partial `dist/` trees still fail the artifact checks.

## Browser support

- Chrome 100+
- Firefox 100+
- Safari 15+
- Edge 100+

The library uses modern DOM and ES2022 features (optional chaining, classes,
`async`/`await`, native promises). Older targets must be transpiled by the
consumer.

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
    CropExportFileType,
    MosaicOutputFileType,
    ImageExportOptions,
    CropAspectRatioPreset,
    CropAspectRatio,
    CropModeOptions,
    ImageInfo,
    ImageEditorState,
    ImageEditorSelection,
    ImageEditorCallbackContext,
    ImageEditorOperation,
    ElementIdMap,
    FabricModule,
} from '@bensitu/image-editor';
```

## License

MIT © Ben Situ.

Fabric.js is distributed under its own MIT license.
