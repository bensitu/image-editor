# Next.js client-only example

Next.js App Router integration example for `@bensitu/image-editor`.

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

- Keeps `app/page.tsx` as a Server Component that renders a client-only editor component.
- Uses `"use client"` in the component that creates and initializes `ImageEditor`.
- Dynamically imports `fabric` and `@bensitu/image-editor` inside `useEffect` so browser-only work starts after mount.
- Loads a local PNG, JPEG, or WebP file through `FileReader` and `loadImage()`.
- Syncs host UI through `onImageChanged`, `onToolModeChange`, `onHistoryChange`, and `onSelectionChange`.
- Calls public APIs for masks, crop mode, undo/redo, export, and read-only state snapshots.
- Disposes the editor in the effect cleanup.

The example uses only public package imports. The local package dependency points at the repository root with `"@bensitu/image-editor": "file:../.."`. If you change library source, run `npm run build` at the repository root before rebuilding this example.
