# Bundle fixtures

These fixtures measure consumer imports with Rollup. They do not measure files in `dist` directly.

- `full-root` imports the current `ImageEditor` facade from the package root.
- `public-api` retains every package-root export so accidental barrel expansion is visible.
- `plugin-kernel` resolves an internal-only test alias directly to the emitted kernel entry. It is not an npm subpath export.
- `core-only` imports the `ImageEditorCore` entry and must not reach any business Feature.
- `core-transform` adds only the Transform Plugin and must not reach Overlay, Mask, History, Filters, Crop, Mosaic, Annotation, or DOM implementations.
- `core-mask` adds the Overlay Foundation and Mask Plugin without Transform, History, or Annotation.
- `core-transform-mask` adds Transform, Overlay Foundation, and Mask without History or later Features.
- `core-history` adds only the generic Memento-backed History Plugin.
- `sdk/core-filters` adds only the Filters Plugin to Core and the public SDK runtime.
- `sdk/core-crop` adds the Crop Plugin to Core and the public SDK runtime without Filters.
- `sdk/core-mosaic` adds the Mosaic Plugin to Core and the public SDK runtime without Filters.
- `sdk/core-history-overlay-mask-filters-crop` measures Crop with its optional maintained
  integrations.
- `sdk/core-history-overlay-mask-filters-mosaic` measures Mosaic with its optional maintained
  integrations.

Fabric remains external in every fixture, matching the package peer dependency and release build. Raw size is the generated ESM chunk before minification. Minified, gzip, and brotli sizes are calculated from the same live minified ESM chunk with Node's built-in `zlib` implementation.

Run the Release-profile check after emitting ESM:

```sh
npm run build:esm
npm run check:bundle-size
```

The check measures every fixture once. It enforces public-entry feature isolation and a
57,344-byte maximum gzip size for `platform-anchor`; other reported sizes are diagnostic
and are not pinned to a commit, tool version, hash, or historical baseline.
