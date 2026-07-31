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
- Uses `"use client"` in the component that creates and initializes the Redaction Preset.
- Dynamically imports Fabric and `@bensitu/image-editor/presets/redaction`
  inside `useEffect` so browser-only work starts after mount.
- Loads a local PNG, JPEG, or WebP file through `FileReader` and `loadImage()`.
- Retains Core, Mask, Crop, and History APIs separately and calls the owner of
  each operation directly.
- Reads Core and Plugin state for the host UI and subscribes to History through
  the Plugin's `onChange` option.
- Calls `disposeAsync()` during failed initialization and effect cleanup; a
  setup that finishes after unmount awaits disposal before returning.

The example uses only public package imports. Its isolated local dependency points
at the repository root with `"@bensitu/image-editor": "file:../.."`. If you
change library source, rebuild the root package before reinstalling or rebuilding
this example. See the [SSR integration guide](../../docs/frameworks/ssr.md).
