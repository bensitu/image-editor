# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
