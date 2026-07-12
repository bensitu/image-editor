# Bundle fixtures

These fixtures measure consumer imports with Rollup. They do not measure files in `dist` directly.

- `full-root` imports the current `ImageEditor` facade from the package root.
- `public-api` retains every package-root export so accidental barrel expansion is visible.
- `plugin-kernel` is added by Phase 1 and resolves an internal-only test alias directly to the emitted kernel entry. It is not an npm subpath export.
- `core-only` imports the Phase 2/3 `ImageEditorCore` entry and must not reach any business Feature.
- `core-transform` adds only the Transform Plugin and must not reach Overlay, Mask, History, Filters, Crop, Mosaic, Annotation, or DOM implementations.
- `core-mask` adds the Overlay Foundation and Mask Plugin without Transform, History, or Annotation.
- `core-transform-mask` adds Transform, Overlay Foundation, and Mask without History or later Features.
- `core-history` adds only the generic Memento-backed History Plugin.

Fabric remains external in every fixture, matching the package peer dependency and release build. Raw size is the generated ESM chunk before minification. Minified, gzip, and brotli sizes are all calculated from the same deterministic minified ESM chunk; compression uses Node's built-in `zlib` implementation.

Run the check after emitting ESM:

```sh
npm run build:esm
npm run check:bundle-size
```

Committed baselines are never overwritten by the default check. A deliberate update uses `--update`:

```sh
node scripts/check-bundle-size.mjs --update after-phase-1
```

The `--package-root` and `--fixtures` options allow the same harness to measure an isolated release worktree without changing the active workspace.
