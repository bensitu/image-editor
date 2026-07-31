# Vue basic example

Vite + Vue integration example for `@bensitu/image-editor`.

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

- Creates the Redaction Preset in `onMounted` after the canvas ref exists and
  retains its Core, Mask, Crop, and History APIs separately.
- Keeps editor-owned runtime objects outside Vue's reactive proxy graph.
- Serializes initialization and disposal through a shared mount coordinator.
- Loads a local PNG, JPEG, or WebP file through `FileReader` and `loadImage()`.
- Reads image state from Core, reads selection-free Mask/Crop state from their
  Plugin APIs, and subscribes to History changes through Plugin options.
- Calls the owning APIs for masks, Crop sessions, undo/redo, and Core export.
- Releases the mount lease in `onBeforeUnmount`, which awaits `disposeAsync()`.

The example uses only public package imports. The local package dependency points
at the repository root with `"@bensitu/image-editor": "file:../.."`. If you
change library source, run `npm run build` at the repository root before
rebuilding this example. See the [Vue integration guide](../../docs/frameworks/vue.md).
