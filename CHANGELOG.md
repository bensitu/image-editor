# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
