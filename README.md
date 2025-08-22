# ImageEditor
[![npm](https://img.shields.io/npm/l/image-editor.svg)](https://github.com/bensitu/image-editor)

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

## Features

- **Fabric.js-powered canvas** - Built on top of the robust fabric.js library
- **Image scaling** - Configurable min/max limits with smooth animation
- **Image rotation** - Step control and animated transitions
- **Auto-resizing** - Optional canvas resizing to match image or container size
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
<script src="path/to/ImageEditor.js"></script>
<!-- or -->
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor/dist/image-editor.min.js"></script>
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
| `backgroundColor` | `#ffffff` | Canvas background color |
| `animationDuration` | `300` | Animation duration for scale/rotation (ms) |
| `minScale` | `0.1` | Minimum scale factor |
| `maxScale` | `5.0` | Maximum scale factor |
| `scaleStep` | `0.05` | Scale step for zoom buttons |
| `rotationStep` | `90` | Default rotation step in degrees |
| `expandCanvasToImage` | `true` | Expand canvas to image size on load |
| `fitImageToCanvas` | `false` | Fit image to current canvas size |
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

## API Methods

| Method | Description |
|--------|-------------|
| `init(idMap)` | Bind the editor to DOM elements. Pass IDs in an object (optional). |
| `loadImage(base64)` | Load an image from a base64 data string. |
| `scaleImage(factor)` | Scale image to the given factor (relative to base scale). |
| `rotateImage(degrees)` | Rotate image to the given angle in degrees. |
| `reset()` | Reset scale to 1 and rotation to 0. |
| `undo()` | Undo the last state change. |
| `redo()` | Redo the next state change. |
| `addMask(config)` | Add a mask to the canvas. Config can include width, height, color. |
| `removeSelectedMask()` | Remove the currently selected mask. |
| `removeAllMasks()` | Remove all masks from the canvas. |
| `merge()` | Merge masks with the base image in the canvas. |
| `downloadImage()` | Download the merged image as a file. |
| `exportImageFile(options)` | Exports the current canvas (with or without masks) as a `File` object. |

## Example Workflow

1. **Load an image** - Via file input or base64 string
2. **Adjust positioning** - Zoom in/out or rotate as needed
3. **Add masks** - Highlight or cover specific areas (drag, resize)
4. **Merge result** - Create a flattened export (optional)
5. **Download / export** - Save the final image

## Installing

### npm / pnpm / yarn
```bash
npm i image-editor fabric
# or
pnpm add image-editor fabric
# or
yarn add image-editor fabric
```

### Local build
```bash
npm run build
```

### Load UMD js file:
You can download image-editor from the dist folder.

## Browser Support

* Chrome 100+
* Firefox 100+
* Safari 15+
* Edge 100+

The class uses modern DOM & ES2022 features (optional chaining, class, async/await).

If you need IE11 or old mobile Safari you will have to transpile.

## Dependencies

- **fabric.js v5.x** — Must be loaded before ImageEditor

## License

MIT © 2025 Ben Situ

Fabric.js is licensed under its own MIT license.