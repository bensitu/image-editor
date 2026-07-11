# @bensitu/image-editor

[![npm](https://img.shields.io/npm/l/@bensitu/image-editor.svg)](https://github.com/bensitu/image-editor)
[![npm](https://img.shields.io/npm/v/@bensitu/image-editor.svg)](https://www.npmjs.com/package/@bensitu/image-editor)
[![](https://data.jsdelivr.com/v1/package/npm/@bensitu/image-editor/badge)](https://www.jsdelivr.com/package/npm/@bensitu/image-editor)

[![ImageEditor demo landing page showing selectable masks, filters, mosaic-style redaction, and annotations](https://raw.githubusercontent.com/bensitu/image-editor/main/docs/assets/demo-screenshot.jpg)](https://bensitu.github.io/image-editor/)

Click the screenshot to open the live demo.

A TypeScript-first image editor built on [Fabric.js](https://fabricjs.com/) v7.
It provides a focused canvas editing API for loading images, transforming the
base image, creating masks and annotations, applying crop and mosaic operations,
maintaining undo/redo history, and exporting edited output as Base64, `File`, or
downloadable image assets.

The package is framework-agnostic and works from plain browser pages, bundled
ESM applications, CommonJS consumers, and UMD/CDN environments. React, Vue,
Next.js, and Nuxt integrations should create and dispose the editor inside
client-side lifecycle hooks.

## Contents

- [Quick Start](#quick-start)
- [Features](#features)
- [Demo and Examples](#demo-and-examples)
- [Documentation](#documentation)
- [Framework Integration](#framework-integration)
- [API Overview](#api-overview)
- [Configuration](#configuration)
- [Requirements](#requirements)
- [Module Formats](#module-formats)
- [Runtime Guarantees](#runtime-guarantees)
- [Development](#development)
- [License](#license)

## Quick Start

### Install

```bash
npm install @bensitu/image-editor fabric
# or
pnpm add @bensitu/image-editor fabric
# or
yarn add @bensitu/image-editor fabric
```

`fabric@>=7.4.0 <8` is a peer dependency. Install it explicitly so the editor
uses the same Fabric version as your application.

### Add Markup

```html
<div id="editorContainer" style="width: 100%; height: 600px">
    <canvas id="canvas"></canvas>
</div>

<button id="zoomInButton">Zoom In</button>
<button id="rotateRightButton">Rotate Right</button>
<button id="enterCropModeButton">Crop</button>
<button id="downloadImageButton">Download</button>
<button id="undoButton">Undo</button>
<button id="redoButton">Redo</button>
<input id="imageInput" type="file" accept="image/*" />
```

### Initialize

```ts
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric, {
    canvasWidth: 800,
    canvasHeight: 600,
    defaultLayoutMode: 'fit',
    backgroundColor: '#ffffff',
});

editor.init({
    canvas: 'canvas',
    canvasContainer: 'editorContainer',
    zoomInButton: 'zoomInButton',
    rotateRightButton: 'rotateRightButton',
    enterCropModeButton: 'enterCropModeButton',
    downloadImageButton: 'downloadImageButton',
    undoButton: 'undoButton',
    redoButton: 'redoButton',
    imageInput: 'imageInput',
});

await editor.loadImage('data:image/jpeg;base64,...');

editor.createMask({ shape: 'rect', width: 120, height: 80, left: '25%', top: '25%' });
editor.createTextAnnotation({ text: 'Label', left: 120, top: 80 });

const dataUrl = await editor.exportImageBase64({ fileType: 'png' });
```

The demo pages show larger DOM maps with image filters, masks, annotations,
crop controls, mosaic controls, lists, and layer actions.

## Features

### Image and Layout

- Load PNG, JPEG, and WebP data URLs or files.
- Normalize supported JPEG EXIF orientation during file-input loading.
- Choose `fit`, `cover`, or `expand` layout strategies.
- Resize to explicit dimensions, hidden-container fallbacks, or current
  container size.
- Downsample large images and guard input size before browser decode.

### Editing Tools

- Scale, rotate, flip, and reset the base image with undoable history.
- Apply Fabric-backed brightness, contrast, saturation, blur, sharpen,
  grayscale, sepia, and vintage filters.
- Create editable rectangle, circle, ellipse, polygon, and custom masks.
- Add Text, Shape, and Draw annotations with update, delete, lock, hide, and
  layer-order APIs.
- Crop with fixed or custom aspect ratios and optional mask preservation.
- Use Mosaic mode to commit circular pixelation strokes into the base image.

### State, Export, and Persistence

- Bounded undo/redo history with serialized transform and history operations.
- Export Base64, browser `File`, or direct downloads as PNG, JPEG, or WebP.
- Choose image-bounds or full-canvas export areas.
- Render masks and annotations independently during export without mutating
  editor state.
- Save/load editor snapshots with `saveState()` and `loadFromState()`.
- Store editable overlays separately from image pixels with overlay-state JSON.

### Integration

- One public `ImageEditor` class exported as both default and named.
- Fabric.js v7 is a peer dependency; the package does not bundle Fabric.
- ESM, CommonJS, UMD, and TypeScript declaration outputs are published.
- DOM binding accepts string IDs, HTMLElement refs, or `null` for unmanaged
  optional controls.
- `dispose()` and `disposeAsync()` support framework lifecycle cleanup.

## Demo and Examples

- [Demo landing page](https://bensitu.github.io/image-editor/)
- [Transform binding demo](docs/transform-binding.html)
- [React basic example](examples/react-basic)
- [Vue basic example](examples/vue-basic)
- [Next.js client-only example](examples/next-client-only)

## Documentation

- [API reference](docs/api.md)
- [Options reference](docs/options.md)
- [Overlay transform binding](docs/overlay-transform-binding.md)
- [Overlay-state persistence](docs/overlay-state.md)
- [Contributing and local checks](docs/contributing.md)
- [Changelog](CHANGELOG.md)

## Framework Integration

The core editor is framework-agnostic and can be mounted with string IDs or
HTMLElement refs. React, Vue, Next.js, Nuxt, and other frameworks should create
and dispose the editor inside client-side lifecycle hooks.

- [React integration](docs/frameworks/react.md)
- [Vue integration](docs/frameworks/vue.md)
- [SSR / Next.js / Nuxt](docs/frameworks/ssr.md)

SSR guidance is strict: runtime imports, `new ImageEditor(...)`, `init()`, image
loading, canvas resizing, and export all require browser DOM/canvas APIs. Type
imports are safe in server code.

## API Overview

`ImageEditor` is the only public class. Public types and editor object guards are
re-exported from the package root.

| Area                  | Core APIs                                                                                                                                             |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| Lifecycle             | `init()`, `dispose()`, `disposeAsync()`                                                                                                               |
| Image and layout      | `loadImage()`, `isImageLoaded()`, `isBusy()`, `isProcessing()`, `setLayoutMode()`, `setCanvasSize()`, `resizeToContainer()`, `relayout()`             |
| State snapshots       | `getEditorState()`, `getImageInfo()`, `getMasks()`, `getAnnotations()`, `getSelection()`, `getActiveToolMode()`                                       |
| Transforms            | `scaleImage()`, `rotateImage()`, `flipHorizontal()`, `flipVertical()`, `resetImageTransform()`                                                        |
| Image filters         | `setImageFilterConfig()`, `getImageFilterConfig()`, `resetImageFilterConfig()`, `clearImageFilters()`, `commitImageFilters()`                         |
| Masks                 | `createMask()`, `removeSelectedMask()`, `removeAllMasks()`                                                                                            |
| Crop                  | `enterCropMode()`, `setCropAspectRatio()`, `applyCrop()`, `cancelCrop()`                                                                              |
| Mosaic                | `enterMosaicMode()`, `exitMosaicMode()`, `getMosaicConfig()`, `setMosaicConfig()`, `resetMosaicConfig()`                                              |
| Text, Shape, Draw     | `enterTextMode()`, `createTextAnnotation()`, `enterShapeMode()`, `createShapeAnnotation()`, `enterDrawMode()`, `setDrawSubMode()`, update/delete APIs |
| Layer operations      | `bringSelectedObjectForward()`, `sendSelectedObjectBackward()`, `bringSelectedObjectToFront()`, `sendSelectedObjectToBack()`                          |
| Export and merge      | `exportImageBase64()`, `exportImageFile()`, `downloadImage()`, `mergeMasks()`, `mergeAnnotations()`                                                   |
| Overlay persistence   | `exportOverlayState()`, `validateOverlayState()`, `importOverlayState()`                                                                              |
| History and snapshots | `saveState()`, `loadFromState()`, `undo()`, `redo()`                                                                                                  |

See [API reference](docs/api.md) for method behavior, state payloads, export
options, object metadata, and guard semantics.

## Configuration

Pass `ImageEditorOptions` to the constructor:

```ts
const editor = new ImageEditor(fabric, {
    canvasWidth: 960,
    canvasHeight: 640,
    defaultLayoutMode: 'fit',
    maxHistorySize: 25,
    exportAreaByDefault: 'image',
    mergeMasksByDefault: true,
    mergeAnnotationsByDefault: true,
    defaultMaskConfig: {
        color: 'rgba(255, 0, 0, 0.35)',
        alpha: 0.35,
        styles: {
            stroke: '#ff0000',
            strokeWidth: 2,
        },
    },
});
```

Common options include canvas sizing, layout mode, downsampling, input/export
limits, history size, default mask/text/draw/shape/mosaic config, export
defaults, DOM list order, and lifecycle callbacks. See
[Options reference](docs/options.md) for the full table.

## Requirements

- **Node.js**: `>= 20` for development and building from source.
- **Fabric.js**: peer dependency `>=7.4.0 <8`.
- **Browsers**: Chrome 100+, Firefox 100+, Safari 15+, Edge 100+.
- **JavaScript target**: distributed files target ES2019 and modern DOM APIs.
- **TypeScript**: strict consumers that compile dependencies with
  `skipLibCheck: false` should include the ES2019 and DOM libraries in
  `tsconfig.json`. Fabric v7.4 declarations also reference `jsdom` types, so
  install `@types/jsdom` when your project type-checks Fabric's declaration
  files.

Older runtime targets must be transpiled by the consumer.

## Module Formats

The package ships one public entry resolved through the `exports` map:

| Consumer                              | Resolves to                    |
| ------------------------------------- | ------------------------------ |
| ESM (`import`)                        | `dist/esm/index.js`            |
| CommonJS (`require`)                  | `dist/cjs/index.cjs`           |
| TypeScript (`types`)                  | `dist/types/index.d.ts`        |
| UMD (`<script>`, `unpkg`, `jsdelivr`) | `dist/umd/image-editor.umd.js` |
| `default` fallback                    | `dist/esm/index.js`            |

The constructor accepts Fabric explicitly in bundled apps:

```ts
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric, options);
```

UMD consumers can load Fabric and the editor as globals:

```html
<script src="https://cdn.jsdelivr.net/npm/fabric@7/dist/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor/dist/umd/image-editor.umd.js"></script>
<script>
    const editor = new ImageEditor.ImageEditor({ canvasWidth: 800, canvasHeight: 600 });
</script>
```

`require('@bensitu/image-editor')` returns a namespace object with `ImageEditor`,
`default`, and editor object guards; it does not return the constructor
directly.

## Runtime Guarantees

- The editor owns the Fabric objects it creates and tags them as base image,
  mask, annotation, or session objects.
- Session objects such as crop rectangles, mask labels, previews, selections,
  and transform handles are excluded from persistence and export.
- Public read methods return safe snapshots where possible. Methods that expose
  Fabric objects, such as `getMasks()`, `getAnnotations()`, selection callbacks,
  and lifecycle callbacks, expose live editor-owned objects. Treat those objects
  as read-only from integration code.
- `loadImage()`, crop, merge, and overlay import are transactional: failures
  restore the previous canvas state where applicable.
- Lifecycle callback exceptions are caught and logged so host callback failures
  do not replace the editor operation.

## Development

```bash
npm install
npm run build
npm test
```

See [Contributing and local checks](docs/contributing.md) for browser tests,
visual tests, release checks, and CI-equivalent commands.

## License

MIT © Ben Situ.

Fabric.js is distributed under its own MIT license.
