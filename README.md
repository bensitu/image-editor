# @bensitu/image-editor

[![npm](https://img.shields.io/npm/l/@bensitu/image-editor.svg)](https://github.com/bensitu/image-editor)
[![npm](https://img.shields.io/npm/v/@bensitu/image-editor.svg)](https://www.npmjs.com/package/@bensitu/image-editor)
[![](https://data.jsdelivr.com/v1/package/npm/@bensitu/image-editor/badge)](https://www.jsdelivr.com/package/npm/@bensitu/image-editor)

A lightweight, TypeScript-first canvas image editor built on top of
[Fabric.js](https://fabricjs.com/) v7. `ImageEditor` wraps a Fabric canvas
with image loading, scale and rotation, mask creation, crop, history
(undo/redo), and base64/file export — exposed as a single canonical class
with a stable public surface.

> **v2.0.0 is a behavior-preserving migration.** The v1 deprecated method
> and property aliases have been removed in favor of the canonical names
> documented below. See [`CHANGELOG.md`](./CHANGELOG.md) for the complete
> rename map.

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
- Base64 and `File` exports with PNG/JPEG/WebP support, configurable
  multiplier, and mask compositing

## Requirements

- **Node.js**: `>= 20` for development / building from source
- **Fabric.js**: peer dependency `^7.0.0` (must be installed by the consumer)
- **Browsers**: modern evergreen (Chrome, Firefox, Safari, Edge). The library
  uses ES2022 features and the Fabric v7 promise-based API.

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

<button id="createMaskButton">Add Mask</button>
<button id="removeSelectedMaskButton">Remove Mask</button>
<button id="removeAllMasksButton">Remove All Masks</button>

<button id="enterCropModeButton">Crop</button>
<button id="applyCropButton">Apply Crop</button>
<button id="cancelCropButton">Cancel Crop</button>

<button id="mergeMasksButton">Merge</button>
<button id="downloadImageButton">Download</button>
<button id="undoButton">Undo</button>
<button id="redoButton">Redo</button>
<button id="resetImageTransformButton">Reset</button>

<input id="imageInput" type="file" accept="image/*" />
<ul id="maskList"></ul>
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
} satisfies ImageEditorOptions);

editor.init({
    canvas: 'canvas',
    zoomInButton: 'zoomInButton',
    zoomOutButton: 'zoomOutButton',
    rotateLeftButton: 'rotateLeftButton',
    rotateLeftDegreesInput: 'rotateLeftDegreesInput',
    rotateRightButton: 'rotateRightButton',
    rotateRightDegreesInput: 'rotateRightDegreesInput',
    createMaskButton: 'createMaskButton',
    removeSelectedMaskButton: 'removeSelectedMaskButton',
    removeAllMasksButton: 'removeAllMasksButton',
    enterCropModeButton: 'enterCropModeButton',
    applyCropButton: 'applyCropButton',
    cancelCropButton: 'cancelCropButton',
    mergeMasksButton: 'mergeMasksButton',
    downloadImageButton: 'downloadImageButton',
    undoButton: 'undoButton',
    redoButton: 'redoButton',
    resetImageTransformButton: 'resetImageTransformButton',
    imageInput: 'imageInput',
    maskList: 'maskList',
});

// Load an image programmatically (base64 data URL).
await editor.loadImage('data:image/jpeg;base64,...');

// Add a rectangular mask, then export the result as base64.
const mask: MaskConfig = { shape: 'rect', width: 120, height: 80, left: '25%', top: '25%' };
editor.createMask(mask);

const dataUrl = await editor.exportImageBase64({ fileType: 'png' });
```

### CommonJS

```js
const fabric = require('fabric');
const { ImageEditor } = require('@bensitu/image-editor');

const editor = new ImageEditor(fabric, { canvasWidth: 800, canvasHeight: 600 });
```

In v2, `require('@bensitu/image-editor')` returns a namespace object with
`ImageEditor`, `default`, and `isMaskObject`; it does not return the
constructor directly.

## Public API

`ImageEditor` is the only public class. The package barrel re-exports it as
both the default export and a named export, alongside `isMaskObject` and the
documented public types. Internal helpers (animation queue, command, history
manager, controllers, services, managers, utility modules) are intentionally
not exported and may change without notice.

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

| Method                        | Description                                                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `loadImage(base64, options?)` | Load an image from a `data:image/...` URL. Returns `Promise<void>`. Transactional: any failure restores the prior canvas, scroll, overflow, and snapshot state. |
| `isImageLoaded()`             | Returns `true` if a valid image is currently loaded on the canvas.                                                                                              |
| `isBusy()`                    | Returns `true` while the editor is loading, animating, or in crop mode.                                                                                         |

`LoadImageOptions` currently includes `preserveScroll?: boolean` for
preserving the container's scroll position across both successful loads and
rollback paths.

### Transforms

| Method                  | Description                                                                                         |
| ----------------------- | --------------------------------------------------------------------------------------------------- |
| `scaleImage(factor)`    | Scale to `factor` (clamped to `[minScale, maxScale]`). Animated. Returns `Promise<void>`.           |
| `rotateImage(degrees)`  | Rotate to `degrees`. `NaN` resolves immediately without changing canvas state. Animated.            |
| `resetImageTransform()` | Animate to scale 1 and rotation 0. Records exactly one history entry covering the entire transform. |

### Masks

| Method                     | Description                                                                   |
| -------------------------- | ----------------------------------------------------------------------------- |
| `createMask(config?)`      | The single mask-creation entry point. Returns the new `MaskObject` or `null`. |
| `removeSelectedMask()`     | Remove the currently selected mask and push one history entry.                |
| `removeAllMasks(options?)` | Remove every mask. `options.saveHistory` defaults to `true`.                  |

`MaskConfig` supports rect, circle, ellipse, polygon, and a custom
`fabricGenerator`. Falsy values in `styles` (`0`, `false`, `null`, `''`,
`NaN`) are applied verbatim.

### Crop

| Method            | Description                                                                          |
| ----------------- | ------------------------------------------------------------------------------------ |
| `enterCropMode()` | Add an interactive crop rectangle on top of the image.                               |
| `applyCrop()`     | Apply the current crop region. Atomic: failure rolls back to the pre-crop snapshot.  |
| `cancelCrop()`    | Cancel crop mode and restore the prior canvas state without pushing a history entry. |

### Merge and export

| Method                        | Description                                                                                    |
| ----------------------------- | ---------------------------------------------------------------------------------------------- |
| `mergeMasks()`                | Bake masks into the base image atomically. Returns `Promise<void>`.                            |
| `exportImageBase64(options?)` | Returns `Promise<string>` (data URL). Resolves to `''` with a warning when no image is loaded. |
| `exportImageFile(options?)`   | Returns `Promise<File>`. Rejects when no image is loaded.                                      |
| `downloadImage(fileName?)`    | Triggers a browser download. No-op when no image is loaded.                                    |

`Base64ExportOptions` and `ImageFileExportOptions` accept `fileType`
(`'png' | 'jpeg' | 'jpg' | 'webp'` plus full MIME forms), `quality` (clamped
to `[0, 1]`, ignored for PNG), `multiplier`, and a flag controlling whether
masks are baked in.

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

| Option                     | Default              | Description                                                                                                                                                                                                                                                              |
| -------------------------- | -------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `canvasWidth`              | `800`                | Initial and hidden-container fallback canvas width in pixels.                                                                                                                                                                                                            |
| `canvasHeight`             | `600`                | Initial and hidden-container fallback canvas height in pixels.                                                                                                                                                                                                           |
| `backgroundColor`          | `'transparent'`      | Fabric canvas background color.                                                                                                                                                                                                                                          |
| `animationDuration`        | `300`                | Duration of scale and rotate animations (ms).                                                                                                                                                                                                                            |
| `minScale`                 | `0.1`                | Minimum scale factor.                                                                                                                                                                                                                                                    |
| `maxScale`                 | `5.0`                | Maximum scale factor.                                                                                                                                                                                                                                                    |
| `scaleStep`                | `0.05`               | Scale delta per zoom step.                                                                                                                                                                                                                                               |
| `rotationStep`             | `90`                 | Rotation step in degrees.                                                                                                                                                                                                                                                |
| `expandCanvasToImage`      | `true`               | Grow the canvas to fit the loaded image (lowest layout precedence).                                                                                                                                                                                                      |
| `fitImageToCanvas`         | `false`              | Fit the image inside the visible workspace viewport (highest layout precedence).                                                                                                                                                                                         |
| `coverImageToCanvas`       | `false`              | Scale large images down to cover the visible workspace, cap at native size, and expand overflowing canvas axes so the container can scroll.                                                                                                                              |
| `downsampleOnLoad`         | `true`               | Downsample large images on load.                                                                                                                                                                                                                                         |
| `downsampleMaxWidth`       | `4000`               | Max width before downsampling kicks in.                                                                                                                                                                                                                                  |
| `downsampleMaxHeight`      | `3000`               | Max height before downsampling kicks in.                                                                                                                                                                                                                                 |
| `downsampleQuality`        | `0.92`               | Lossy quality used when downsampling and exporting.                                                                                                                                                                                                                      |
| `preserveSourceFormat`     | `true`               | Preserve PNG/WebP MIME through downsampling unless `downsampleMimeType` is set.                                                                                                                                                                                          |
| `downsampleMimeType`       | `null`               | Explicit downsample MIME type. Overrides `preserveSourceFormat`.                                                                                                                                                                                                         |
| `imageLoadTimeoutMs`       | `30000`              | Maximum duration for both decode and Fabric image creation during `loadImage`.                                                                                                                                                                                           |
| `exportMultiplier`         | `1`                  | Output resolution multiplier.                                                                                                                                                                                                                                            |
| `maxExportPixels`          | `50000000`           | Maximum output pixel count after applying the export multiplier. Invalid values fall back to this default.                                                                                                                                                               |
| `exportImageAreaByDefault` | `true`               | Clip exports to the image bounding box and bake in masks by default.                                                                                                                                                                                                     |
| `defaultMaskWidth`         | `50`                 | Default mask width.                                                                                                                                                                                                                                                      |
| `defaultMaskHeight`        | `80`                 | Default mask height.                                                                                                                                                                                                                                                     |
| `maskRotatable`            | `false`              | Allow masks to be rotated by the user.                                                                                                                                                                                                                                   |
| `maskLabelOnSelect`        | `true`               | Show a label above a selected mask.                                                                                                                                                                                                                                      |
| `maskLabelOffset`          | `3`                  | Pixel offset of the label from the mask's top-left corner.                                                                                                                                                                                                               |
| `maskName`                 | `'mask'`             | Prefix used for auto-generated mask names.                                                                                                                                                                                                                               |
| `groupSelection`           | `false`              | Allow Fabric multi-object group selection on the canvas.                                                                                                                                                                                                                 |
| `showPlaceholder`          | `true`               | Show a placeholder element while no image is loaded.                                                                                                                                                                                                                     |
| `initialImageBase64`       | `null`               | Base64 data URL auto-loaded after construction.                                                                                                                                                                                                                          |
| `defaultDownloadFileName`  | `'edited_image.jpg'` | Default file name used by `downloadImage()`.                                                                                                                                                                                                                             |
| `onImageLoaded`            | `null`               | Called once after a successful `loadImage`. Errors are caught and logged.                                                                                                                                                                                                |
| `onError`                  | `null`               | Called as `(error, message)` when the editor reports an error.                                                                                                                                                                                                           |
| `onWarning`                | `null`               | Called as `(error, message)` when the editor reports a recoverable warning.                                                                                                                                                                                              |
| `label`                    | see source           | `LabelConfig` for selected-mask labels (`getText`, `textOptions`, `create`).                                                                                                                                                                                             |
| `crop`                     | see source           | `CropConfig` (`minWidth`, `minHeight`, `padding`, `hideMasksDuringCrop`, `preserveMasksAfterCrop` (default `false`), `allowRotationOfCropRect`). Rotated crop rectangles are disabled by default; when enabled, export uses the rotated rectangle's axis-aligned bounds. |

## Example workflow

1. Construct `ImageEditor` with options and call `init(idMap)` to wire it up.
2. Load an image via `loadImage(base64)` or the bound file input.
3. Adjust with `scaleImage`, `rotateImage`, `resetImageTransform`, and the
   crop session.
4. Add `createMask` calls and inspect via the `maskList` element.
5. Use `mergeMasks` to bake masks into the image, then
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
    LoadImageOptions,
    RemoveAllMasksOptions,
    MaskConfig,
    MaskObject,
    MaskNumericProp,
    ResolvedMaskConfig,
    ImageMimeType,
    ImageFileType,
    NormalizedImageFormat,
    Base64ExportOptions,
    ImageFileExportOptions,
    ElementIdMap,
    FabricModule,
} from '@bensitu/image-editor';
```

## License

MIT © Ben Situ.

Fabric.js is distributed under its own MIT license.
