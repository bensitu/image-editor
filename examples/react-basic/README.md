# React basic example

Vite + React integration example for `@bensitu/image-editor`.

## Run

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

## What it demonstrates

- Creates the Minimal Preset after the canvas ref exists and retains its
  `ImageEditorCore`, Transform, and History APIs separately.
- Serializes initialization and disposal across React StrictMode remounts.
- Initializes Core with element refs instead of adding DOM Controls.
- Loads a local PNG, JPEG, or WebP file through `FileReader` and `loadImage()`.
- Reads image state from Core and subscribes to History through the Plugin's
  `onChange` option.
- Calls Transform for zoom, rotation, and reset; calls History for undo/redo;
  and calls Core for export.
- Awaits `disposeAsync()` through the shared mount coordinator during cleanup.

The example uses only public package imports. The local package dependency points
at the repository root with `"@bensitu/image-editor": "file:../.."`. If you
change library source, run `npm run build` at the repository root before
rebuilding this example. See the [React integration guide](../../docs/frameworks/react.md).
