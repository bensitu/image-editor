# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-06-06

This release is a behavior-preserving migration of the v1 image editor onto a TypeScript and Fabric.js v7 foundation, published in multiple module formats from a single source tree. On-screen behavior is carried forward from v1.5.2 — sizing, scroll, overflow, rollback, mask metadata, history snapshots, export framing, crop session lifecycle, and dispose ordering all match v1. The only intentional default change is `crop.preserveMasksAfterCrop` (see Changed). The public API is canonical to v2: every v1 alias introduced as deprecated in v1.3.0 has been removed.

### Added

- Publish ESM, CJS (`.cjs`), UMD, and TypeScript declaration files (`.d.ts`) from a single `npm run build`. The `package.json` `exports` map exposes the documented entry points (`import`, `require`, `default`, `types`), and the UMD bundle declares `fabric` as an external global.
- Add `fabric@^7` as a peer dependency. Consumers pass the Fabric module to the editor explicitly through the constructor, with a `globalThis.fabric` fallback for UMD usage.
- Add `setLayoutMode('fit' | 'cover' | 'expand')` as the public way to select the layout strategy for future image loads without exposing internal options.
- Add `maxExportPixels` as a public export-size guard. Invalid values fall back to the default budget, and oversized multiplier exports reject before rendering.

### Changed

- Migrate the runtime source tree to TypeScript and decompose the editor into one module per subsystem under `src/<subsystem>/` (animation, history, image, mask, crop, export, ui, core, fabric, utils). `ImageEditor` remains the only public class and the package facade.
- Upgrade the rendering engine to Fabric.js v7 and use Fabric v7 promise APIs (`FabricImage.fromURL`, `canvas.loadFromJSON`) plus the local Promise wrapper around Fabric v7 animation handles throughout the async control flow for image load, scale, rotate, merge, crop, and export.
- Change `crop.preserveMasksAfterCrop` to default to `false`. v1 defaulted to `true`; callers that relied on the old default must now pass `crop: { preserveMasksAfterCrop: true }` explicitly.
- Change the CommonJS root entry to return the v2 namespace object (`{ ImageEditor, default, isMaskObject }`) instead of returning the constructor function directly.

### Removed

- Remove every v1 alias from runtime, type declarations, demo, and documentation in favor of the canonical v2 names that were introduced alongside the deprecated aliases in v1.3.0:
  - `reset()` → `resetImageTransform()`
  - `addMask()` → `createMask()`
  - `merge()` → `mergeMasks()`
  - `getImageBase64()` → `exportImageBase64()` (and `exportImageFile()` for direct `File` exports)
  - `canvasEl`, `containerEl`, `placeholderEl` public DOM fields → removed; DOM references are now private to the editor and are not part of the public surface.
- Remove deprecated v1 DOM binding keys from the v2 `ElementIdMap`, runtime defaults, demo, and declarations:
  - `imgPlaceholder` → `imagePlaceholder`
  - `scaleRate` → `scalePercentageInput`
  - `rotationLeftInput` → `rotateLeftDegreesInput`
  - `rotationRightInput` → `rotateRightDegreesInput`
  - `rotateLeftBtn` → `rotateLeftButton`
  - `rotateRightBtn` → `rotateRightButton`
  - `addMaskBtn` → `createMaskButton`
  - `removeMaskBtn` → `removeSelectedMaskButton`
  - `removeAllMasksBtn` → `removeAllMasksButton`
  - `mergeBtn` → `mergeMasksButton`
  - `downloadBtn` → `downloadImageButton`
  - `zoomInBtn` → `zoomInButton`
  - `zoomOutBtn` → `zoomOutButton`
  - `resetBtn` → `resetImageTransformButton`
  - `undoBtn` → `undoButton`
  - `redoBtn` → `redoButton`
  - `cropBtn` → `enterCropModeButton`
  - `applyCropBtn` → `applyCropButton`
  - `cancelCropBtn` → `cancelCropButton`
- Remove root-level exports of internal helpers such as `AnimationQueue`, `Command`, `HistoryManager`, subsystem controllers, services, managers, and utility modules. The package root exports only `ImageEditor` (default and named), `isMaskObject`, and the documented public types.

### Security

- Upgrade `@rollup/plugin-terser` to `^1.0.0` so the development build chain resolves `serialize-javascript@7.0.5`, clearing the high-severity npm audit finding from the release verification pass.

### Fixed

- Replace the `setLayoutMode` test's private `editor.options` assertions with black-box load/export behavior checks.
- Loosen the public `FabricModule` type so `new ImageEditor(fabric, options)` type-checks with the standard `import * as fabric from 'fabric'` namespace form.
- Allow integration tests to pass from a clean tree before `dist/` has been built, while still failing when a partial `dist/` directory is present.

## [1.5.2] - 2026-06-04

### Added

- Add `maxHistorySize` as a configurable undo/redo history bound for large image sessions.
- Add regression coverage for crop apply locking, safe user callbacks, transform input validation, DOM disable restoration, placeholder suppression, and low-risk runtime hardening paths.

### Fixed

- Prevent `cancelCrop()` and crop reentry from mutating crop state while `applyCrop()` is in progress.
- Keep successful image loads and mask creation committed when observer callbacks throw, reporting callback failures through warnings instead.
- Fall back safely when label callbacks throw, reject non-finite transform inputs, and validate crop regions before export.
- Keep canvas interaction available in crop mode, restore disabled/aria-disabled/pointer-events state on dispose, and consistently honor `showPlaceholder: false`.
- Normalize invalid numeric runtime options, bound history size, report unsupported file selections once, validate JPEG background colors, reject degenerate polygon masks, and isolate throwing custom mask generators.

## [1.5.1] - 2026-06-02

### Added

- Add a CommonJS package entry so `require('@bensitu/image-editor')` returns the editor constructor while preserving namespace aliases.
- Add regression coverage for v1 DOM binding aliases, optional upload-area bindings, package entry shapes, async initial image failures, busy-state guards, Fit/Cover scroll behavior, merge edge rendering, and crop bounds.
- Add `maxExportPixels` to the TypeScript options surface for export-size safety.

### Changed

- Preserve deprecated v1 DOM binding keys until v2.0.0 while giving canonical keys precedence and warning once per deprecated key per editor instance.
- Treat `uploadArea` as a canonical optional binding with a `null` default, matching runtime behavior and TypeScript declarations.

### Fixed

- Prevent `initialImageBase64` load failures from producing unhandled promise rejections; failures are reported once through `onError`.
- Guard `undo()`, `redo()`, `loadFromState()`, and external `saveState()` calls while crop, load, animation, or another external operation owns the editor.
- Preserve image display bounds across mask merge and undo flows so Fit/Cover images do not shrink unexpectedly.
- Avoid one-pixel right or bottom edge artifacts when merging masks over scaled images.
- Prevent Fit/Cover mask creation and merge operations from adding phantom cross-axis scrollbars when the image still fits the visible canvas.
- Allow the crop rectangle to expand to the full image content bounds while keeping moved or resized crop rectangles clamped inside the image.
- Re-check Fabric availability during `init()`, reject unsupported rotated crop rectangles unless enabled, validate mask creation inputs, cap export pixel counts, normalize layout-mode precedence, and roll back failed load overflow changes.

## [1.5.0] - 2026-05-30

### Added

- Persist Fabric canvas dimensions in editor history snapshots so undo and redo restore layout size after rotate, scale, crop, merge, and mask expansion workflows.
- Add full canonical DOM binding keys for the 1.x line, using semantic names such as `imagePlaceholder`, `scalePercentageInput`, `rotateLeftDegreesInput`, `removeSelectedMaskButton`, `downloadImageButton`, and `enterCropModeButton`.

### Changed

- Keep deprecated DOM binding keys with `*Btn` names as explicit 1.x aliases with one-time migration warnings.
- Update the docs demo and README examples to use canonical DOM binding keys.

### Fixed

- Block non-crop programmatic operations while crop mode is active while keeping `applyCrop()` and `cancelCrop()` available.
- Harden reset, image-load rollback, Fabric state restoration, animation queue cancellation, and crop failure paths against partial state updates.
- Clean up mask and crop event handlers on removal and disposal, restore captured canvas `maxWidth`, and tolerate missing drag-and-drop `dataTransfer` in the docs demo.

## [1.4.2] - 2026-05-28

### Added

- Add a public `isBusy()` helper so demo integrations can avoid private loading and crop state.

### Fixed

- Preserve selected mask labels, editable mask styling, and active selection after both merged and plain exports.
- Validate custom `fabricGenerator` results before applying mask setup, returning `null` with a warning instead of throwing a raw TypeError.
- Reject broken restored image elements instead of treating a completed zero-dimension image as ready.
- Clamp the crop rectangle inside the image bounds during move and resize operations.
- Roll back crop state when mask preparation fails before crop export.
- Decode exported files without requiring a global `atob`, and handle more transparent CSS background forms before JPEG compositing.
- Guard invalid downsample dimensions and remove stale load-rollback state captured during image replacement.
- Use a global internal operation token so duplicate module evaluations do not break merge-owned load calls.
- Restore mask-list interaction after canceling crop mode so restored masks can be selected from the list again.
- Keep the docs demo busy-state checks on public API, clear successful Base64 loads, and align follow-up UI refreshes with the configured animation duration.
- Declare Fabric as a dev dependency as well as a peer dependency so local production audits do not treat the test peer install as runtime package surface.

## [1.4.1] - 2026-05-27

### Changed

- Move Node canvas support to a dev-only `canvas` dependency and remove the package-level override so Fabric's optional peer dependency resolution is left to consumers.

### Fixed

- Track image loading as an editor busy state so overlapping loads, transforms, exports, masks, and demo actions cannot mutate canvas state while a load is in progress.
- Make mask merging rollback-safe when the flattened image reload fails, without adding broken history entries.
- Preserve right and bottom image edges when merging masks over images whose displayed bounds end on partial pixels.
- Seal fractional export edge alpha during merge and export, including manual zoom states, so trailing rows or columns keep their own edge colors without resampling the full image.
- Composite genuinely transparent JPEG export areas against an explicit background because JPEG cannot encode alpha.
- Preserve the original container overflow snapshot across failed image-load rollbacks and disposal.
- Treat `null`, `undefined`, and invalid quality values as absent values instead of exporting at quality `0`.
- Harden animation queue cancellation, image readiness listeners, pointer-event restoration, demo optional controls, and async history tests.

## [1.4.0] - 2026-05-24

### Added

- Add transactional image loading, Fabric image creation timeout handling, and broader regression coverage for failed loads, history errors, crop undo, animation disposal, and mask ID restoration.
- Add demo error feedback for failed image loads and direct event binding for the Base64 export action.

### Changed

- Export canvas regions directly through Fabric region export options to reduce peak memory usage and avoid asynchronous exposure of export-only mask styles.
- Run independent esbuild outputs in parallel and include `docs/js/**/*.js` in lint coverage.
- Preserve alpha-capable PNG/WebP formats during downsampling unless an explicit downsample MIME type is configured.
- Preserve developer-defined canvas CSS sizing and reuse the last visible container viewport when layout is temporarily hidden.

### Fixed

- Fix history queue rejection handling, history overflow indexing, and async command execution ordering.
- Fix animation cancellation during disposal and restore rotation origins on animation failure paths.
- Fix `loadImage()` rollback for placeholder visibility, overflow, image state, and canvas state after load failures.
- Fix duplicate mask IDs after merge, undo, and new mask creation.
- Fix shared-parent placeholder layouts, Bootstrap visibility restoration, stale crop handlers, and crop preservation for rotated masks.
- Fix public destructive/export operations so they reject or no-op clearly while animations are running.
- Fix file loading for empty MIME types with image file extensions and reset file inputs after load attempts.
- Fix demo null tolerance, dragleave flicker, release tag checks, mask list selection targeting, and export conversion failures when a 2D context is unavailable.

## [1.3.1] - 2026-05-23

### Changed

- Update build and lint tooling to current esbuild and ESLint flat config versions.

### Fixed

- Resolve mask percentage values against the correct canvas axis for positions, sizes, circle radius, and ellipse radii.
- Avoid unnecessary Fabric `set()` calls while serializing mask styles for history snapshots.
- Exclude trailing partial pixels when applying crop regions to prevent possible 1px JPEG edge artifacts.
- Compensate for existing auto scrollbars when measuring the canvas container viewport.
- Use standard DOM visibility state for placeholders instead of relying on Bootstrap utility classes.

## [1.3.0] - 2026-05-22

### Added

- Add preferred public API names while keeping deprecated aliases until `v2.0.0`: `resetImageTransform()`, `createMask()`, `mergeMasks()`, and `exportImageBase64()`.
- Add `exportImageFile()` for direct `File` exports in JPEG, PNG, or WebP.
- Add `LoadImageOptions.preserveScroll` for internal reload flows such as merge.
- Add `imageLoadTimeoutMs` to prevent stalled image decode operations from hanging editor workflows.
- Add GitHub Actions support for manually creating a `vX.X.X` tag and draft GitHub Release from `main`.

### Changed

- `label.getText(mask, creationIndex)` now receives a stable zero-based creation index (`mask.maskId - 1`) instead of a mutable current list position.
- Normalize canvas growth behavior after image load across `expandCanvasToImage`, `fitImageToCanvas`, and `coverImageToCanvas`.
- Refresh the docs demo into a compact tool-style workspace and use Fit Image as the default demo mode.
- Add cache-busted docs asset URLs so browsers do not reuse stale demo CSS or scripts after an update.
- Publish npm packages from the reviewed GitHub Release tarball instead of rebuilding during npm publication.

### Fixed

- Fix Fit Image zoom behavior so zooming after load keeps the image inside resized scrollable canvas bounds instead of visually clipping it.
- Fix Fit Image initial sizing so large demo viewports are not limited by the default configured canvas size.
- Fix non-rect and custom mask behavior so rect, circle, ellipse, polygon, and `fabricGenerator` masks share hover, opacity restore, history, and canvas expansion behavior.
- Fix polygon masks to support both `{ x, y }` and `[x, y]` point formats.
- Fix state restore after merge and undo by persisting editor metadata such as `baseImageScale`, `currentScale`, `currentRotation`, and `maskCounter`.
- Fix demo file input handling so a selected file is loaded once with the current layout options.
- Fix explicit image replacement in cover-canvas mode so scroll position resets, while merge reloads preserve the current scroll position.
- Fix placeholder visibility updates when the placeholder exists but the canvas container reference is unavailable.
- Fix crop resize constraints so `crop.minWidth` and `crop.minHeight` are enforced within the current image bounds.
- Fix image resampling and crop export to fail clearly when a 2D canvas context cannot be created.
- Fix animation queue draining and history queue cleanup to avoid avoidable promise-chain growth.
- Cache scrollbar measurements and avoid temporary overflow mutations while reading viewport size.
- Avoid removing and recreating selected mask labels during `saveState()`.
- Expand the canvas once for grouped mask edits instead of resizing once per mask.

## [1.2.2] - 2026-05-21

### Fixed

- Fix `coverImageToCanvas` sizing so it only shrinks images, keeps real overflow scrollable, and avoids phantom scroll offsets.
- Fix mask control styling after undoing a merge operation.

## [1.2.1] - 2026-05-20

### Added

- Add uncompressed dist builds alongside minified outputs.
- Add Node test coverage for package exports and editor functionality.

### Changed

- Align TypeScript declarations with the implemented public API.

### Fixed

- Fix package entry points and ESM/browser builds.
- Fix async image loading, crop, export, mask state, and state restore behavior.

## [1.2.0] - 2026-02-24

### Added

- Add `coverImageToCanvas` option, allowing overflow so at least one side fits.

## [1.1.2] - 2026-02-19

### Changed

- Change `fitImageToCanvas` image placement from centered to top-left corner.

## [1.1.1] - 2025-08-23

### Added

- Add historical operation logging and support rollback operations.

## [1.0.0] - 2025-08-23

### Added

- Initial release.
