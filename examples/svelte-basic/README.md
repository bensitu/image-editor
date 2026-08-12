# Svelte basic example

Vite + Svelte integration example for `@bensitu/image-editor`.

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

- Creates the Minimal Preset in `onMount` after the canvas binding is available.
- Keeps editor-owned runtime objects outside Svelte's reactive state graph.
- Serializes initialization and disposal through a shared mount coordinator.
- Stores immutable image and History status values in Svelte state runes.
- Calls Transform and History through their typed Plugin APIs.
- Loads local PNG, JPEG, or WebP files and exports the image through Core.
- Releases the mount lease from the lifecycle cleanup callback.

The example uses only public package imports. The local package dependency points
at the repository root with `"@bensitu/image-editor": "file:../.."`. If you
change library source, run `npm run build` at the repository root before
rebuilding this example. See the [Svelte integration guide](../../docs/frameworks/svelte.md).
