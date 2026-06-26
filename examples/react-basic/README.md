# React basic example

Minimal Vite + React integration for `@bensitu/image-editor`.

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

- Creates `ImageEditor` after the canvas ref exists.
- Initializes the editor with HTMLElement refs.
- Loads a local PNG, JPEG, or WebP file through `FileReader` and `loadImage()`.
- Syncs host UI through `onImageChanged`, `onToolModeChange`, `onHistoryChange`, and `onSelectionChange`.
- Calls public APIs for masks, crop mode, undo/redo, export, and read-only state snapshots.
- Disposes the editor in the React effect cleanup, including React StrictMode remounts.

The example uses only public package imports. The local package dependency points at the repository root with `"@bensitu/image-editor": "file:../.."`. If you change library source, run `npm run build` at the repository root before rebuilding this example.
