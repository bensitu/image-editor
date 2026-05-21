# ImageEditor
[![npm](https://img.shields.io/npm/l/image-editor.svg)](https://github.com/bensitu/image-editor)
[![npm](https://img.shields.io/npm/v/@bensitu/image-editor.svg)](https://www.npmjs.com/package/@bensitu/image-editor)
[![](https://data.jsdelivr.com/v1/package/npm/@bensitu/image-editor/badge)](https://www.jsdelivr.com/package/npm/@bensitu/image-editor)

A lightweight JavaScript wrapper around fabric.js that provides comprehensive image editing capabilities including loading, zooming, rotation, and mask management.

## Overview

ImageEditor offers:

- Image loading from base64 or file input
- Zoom in/out and reset scale functionality
- Rotation (with custom degrees or step-based)
- Mask creation, selection, and removal
- Optional mask labels
- Merge/export helpers
- Basic UI element binding

**Note**: This library requires fabric.js v5.x to be loaded before instantiating the editor.

## Demo

[https://bensitu.github.io/image-editor/](https://bensitu.github.io/image-editor/)

## Features

- **Fabric.js-powered canvas** - Built on top of the robust fabric.js library
- **Image scaling** - Configurable min/max limits with smooth animation
- **Image rotation** - Step control and animated transitions
- **Auto-resizing** - Optional canvas resizing to match image or container size
- **Image crop** - Enter a crop mode to crop image
- **Mask management** - Add, remove, remove all, with draggable/resizable masks
- **Mask labels** - Auto-sync with mask movement/scaling
- **Performance optimization** - Downsampling on load to prevent large image performance issues
- **Export & Download** - Base64 output or direct file save support
- **DOM/UI binding** - Easy integration with buttons, inputs, and placeholders

## Installation

Include fabric.js and the ImageEditor class script in your HTML:

```html
<!-- Fabric.js (required) -->
<script src="https://cdn.jsdelivr.net/npm/fabric@5.5.2/dist/fabric.min.js"></script>

<!-- ImageEditor -->
<script src="path/to/dist/image-editor.min.js"></script>
<!-- or -->
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor/dist/image-editor.min.js"></script>
```

For ESM/bundler usage:

```javascript
import ImageEditor, { ImageEditor as NamedImageEditor } from '@bensitu/image-editor';
```

## Quick Start

### HTML Structure

```html
<!-- Canvas -->
<canvas id="fabricCanvas"></canvas>

<!-- Optional Controls -->
<button id="zoomInBtn">Zoom In</button>
<button id="zoomOutBtn">Zoom Out</button>
<button id="rotateLeftBtn">Rotate Left</button>
<input id="rotationLeftInput" type="number" value="90">
<button id="rotateRightBtn">Rotate Right</button>
<input id="rotationRightInput" type="number" value="90">

<button id="addMaskBtn">Add Mask</button>
<button id="removeMaskBtn">Remove Mask</button>

<button id="mergeBtn">Merge</button>
<button id="downloadBtn">Download</button>

<input id="imageInput" type="file" accept="image/*">
```

### JavaScript Implementation

```javascript
// Create instance
const editor = new ImageEditor({
  canvasWidth: 800,
  canvasHeight: 600,
  backgroundColor: '#ffffff',
  initialImageBase64: null // optional
});

// Initialize (binds to DOM elements)
editor.init({
  canvas: 'fabricCanvas',
  zoomInBtn: 'zoomInBtn',
  zoomOutBtn: 'zoomOutBtn',
  rotateLeftBtn: 'rotateLeftBtn',
  rotationLeftInput: 'rotationLeftInput',
  rotateRightBtn: 'rotateRightBtn',
  rotationRightInput: 'rotationRightInput',
  addMaskBtn: 'addMaskBtn',
  mergeBtn: 'mergeBtn',
  downloadBtn: 'downloadBtn',
  imageInput: 'imageInput'
});

// Load an image manually (base64 string)
// editor.loadImage('data:image/jpeg;base64,...');
```

## Configuration Options

When creating the editor instance, you can pass an options object to override defaults:

| Option | Default | Description |
|--------|---------|-------------|
| `canvasWidth` | `800` | Initial canvas width (px) |
| `canvasHeight` | `600` | Initial canvas height (px) |
| `backgroundColor` | `transparent` | Canvas background color |
| `animationDuration` | `300` | Animation duration for scale/rotation (ms) |
| `minScale` | `0.1` | Minimum scale factor |
| `maxScale` | `5.0` | Maximum scale factor |
| `scaleStep` | `0.05` | Scale step for zoom buttons |
| `rotationStep` | `90` | Default rotation step in degrees |
| `expandCanvasToImage` | `true` | Expand canvas to image size on load |
| `fitImageToCanvas` | `false` | Fit image to current canvas size |
| `coverImageToCanvas` | `false` | Fit image to cover canvas (at least one side fits, allowing overflow). |
| `downsampleOnLoad` | `true` | Downsample large images before rendering |
| `downsampleMaxWidth` | `4000` | Max width count before downsampling |
| `downsampleMaxHeight` | `3000` | Max height count before downsampling |
| `downsampleQuality` | `0.92` | JPEG quality when downsampling |
| `exportMultiplier` | `1` | Scale factor for export |
| `exportImageAreaByDefault` | `true` | Export only the image area (clipped to masks) |
| `defaultMaskWidth` | `50` | Default mask width (px) |
| `defaultMaskHeight` | `80` | Default mask height (px) |
| `maskRotatable` | `false` | Whether masks can be rotated |
| `maskLabelOnSelect` | `true` | Show label when mask is selected |
| `maskLabelOffset` | `3` | Offset for mask labels from top-left corner |
| `maskName` | `mask` | Prefix for mask names/labels |
| `showPlaceholder` | `true` | Shows placeholder when no image is loaded |
| `initialImageBase64` | `null` | Base64 string to auto-load as initial image |
| `defaultDownloadFileName` | `edited_image.jpg` | Default file name for downloads |
| `crop.preserveMasksAfterCrop` | `false` | Keep masks that intersect the crop area, shifted into the cropped canvas. Merge masks first if they should be baked into the image pixels. |

## API Methods

| Method | Description |
|--------|-------------|
| `init(idMap)` | Bind the editor to DOM elements. Pass IDs in an object (optional). |
| `loadImage(imageBase64)` | Load an image from a base64 data string. Resolves after the Fabric image is on the canvas. |
| `scaleImage(factor)` | Scale image to the given factor (relative to base scale). |
| `rotateImage(degrees)` | Rotate image to the given angle in degrees. |
| `resetImageTransform()` | Reset scale to 1 and rotation to 0. |
| `undo()` | Undo the last state change. Resolves after the canvas state is restored. |
| `redo()` | Redo the next state change. Resolves after the canvas state is restored. |
| `createMask(config)` | Create a mask on the canvas. Config can include width, height, color. |
| `removeSelectedMask()` | Remove the currently selected mask. |
| `removeAllMasks()` | Remove all masks from the canvas. |
| `enterCropMode()` | Create a resizable/movable selection rect on top of the image. |
| `cancelCrop()` | Cancel crop mode and remove the temporary selection rect. |
| `applyCrop()` | Apply the current crop rectangle in the canvas. |
| `mergeMasks()` | Merge masks with the base image in the canvas. |
| `downloadImage()` | Download the merged image as a file. |
| `exportImageBase64(options)` | Export an image data URL. `fileType` can be `jpeg`, `png`, or `webp`. |
| `exportImageFile(options)` | Exports the current canvas (with or without masks) as a `File` object. `fileType` is exported directly when supported. |

Deprecated aliases are still available for compatibility: `reset()`, `addMask(config)`, `merge()`, and `getImageBase64(options)`.

By default, applying crop removes unmerged masks. Set `crop.preserveMasksAfterCrop` to keep intersecting masks, or use `mergeMasks()` before cropping when masks should become part of the image pixels.

## Example Workflow

1. **Load an image** - Via file input or base64 string
2. **Adjust positioning** - Zoom in/out or rotate as needed
3. **Add masks** - Highlight or cover specific areas (drag, resize)
4. **Merge result** - Create a flattened export (optional)
5. **Download / export** - Save the final image

## Installing

### npm / pnpm / yarn
```bash
npm i @bensitu/image-editor fabric
# or
pnpm add @bensitu/image-editor fabric
# or
yarn add @bensitu/image-editor fabric
```

### Local build
```bash
npm run build
```

### Load UMD js file:
Use `dist/image-editor.js` or `dist/image-editor.min.js` for browser global script usage. Use `dist/image-editor.esm.mjs` or `dist/image-editor.esm.min.mjs` for standards-compliant ESM imports. Matching `.js` ESM builds are also generated for browser and bundler compatibility.

## Browser Support

* Chrome 100+
* Firefox 100+
* Safari 15+
* Edge 100+

The package build targets these modern browsers and uses modern DOM and JavaScript features.

IE11 and old mobile Safari are not supported by the distributed build. If you need them, transpile the package and provide any required DOM or JavaScript polyfills in your application.

## Dependencies

- **fabric.js v5.x** — Must be loaded before ImageEditor

## License

MIT © 2026 Ben Situ

Fabric.js is licensed under its own MIT license.
