# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.8.1] - 2026-07-08

### Fixed

- Wire v2.8 image filter, Shape annotation, Draw sub-mode, and eraser controls through the `init()` DOM binding path, including public element targets, event handlers, control enablement, and input synchronization.
- Improve Draw eraser hit-testing so eraser strokes delete only Draw annotations whose visible paths are within eraser or stroke proximity, instead of deleting annotations by broad bounding-box overlap.
- Emit `createDrawAnnotation` for newly-created Draw strokes instead of reusing `enterDrawMode`.
- Report missing Fabric image filter constructors through `onWarning` instead of silently dropping requested filter effects.
- Make image-loaded checks rely on editor-owned base image metadata and dimensions rather than `instanceof FabricImage`.

## [2.8.0] - 2026-07-07

### Added

- Add Fabric-backed image adjustment filters for brightness, contrast, saturation, blur, sharpen, grayscale, sepia, and vintage tone.
- Add image filter preview and commit APIs: `setImageFilterConfig()`, `getImageFilterConfig()`, `resetImageFilterConfig()`, `clearImageFilters()`, and `commitImageFilters()`.
- Persist editor-managed image filter config through history and `saveState()` / `loadFromState()`, and include active filters in export rendering.
- Add shape annotations for rectangles, straight lines, and arrows, including `createShapeAnnotation()`, Shape mode, shape config APIs, and the `isShapeAnnotationObject()` guard.
- Add Draw sub-mode erasing with `setDrawSubMode()`, `getDrawSubMode()`, `getEraserConfig()`, `setEraserConfig()`, and `resetEraserConfig()`.

### Changed

- Widen `AnnotationType` to include `'shape'` and `EditorToolMode` to include `'shape'` for downstream exhaustive TypeScript switches.
- Bake the current visible filter result once when crop, Mosaic, mask merge, or annotation merge replaces the base image, then reset the new base image to an unfiltered state.
- Keep the eraser inside Draw mode instead of introducing a separate top-level tool mode.
- Update README and demos with image adjustment, shape annotation, and Draw eraser controls.

### Fixed

- Restore shape annotation metadata, including `shapeAnnotationKind`, across state serialization, history undo/redo, and load-from-state flows.
- Allow Shape mode to switch between rectangle, line, and arrow creation without exiting the active mode.
- Keep shape and eraser preview objects session-only so they are not exported, serialized, selectable as annotations, or left behind after mode exit.
- Limit erasing to intersected Draw annotation strokes as whole objects; base image pixels, masks, text annotations, and shape annotations are preserved.

## [2.7.0] - 2026-07-01

### Added

- Add `autoOrientImageQuality` so EXIF orientation normalization can use a JPEG quality independent from `downsampleQuality`.
- Add `maxExportDimension` to guard browser canvas single-dimension limits during export.
- Add `maxInputBytes` and `maxInputPixels` pre-decode guards for image loading.
- Add `disposeAsync()` for integrations that need to await Fabric canvas teardown before remounting.

### Changed

- Document that `getMasks()` and `getAnnotations()` return shallow array snapshots containing live Fabric object references, and that direct object mutation bypasses editor history and callbacks.
- Re-export `ImageEditor` from the package barrel without a local implementation import, and guard DOM element subtype resolution at runtime for canvas/input/select controls.
- Clarify that `loadFromState()` is intended for snapshots produced by this editor and that untrusted external JSON should be validated before restore.
- Document the synchronous `dispose()` contract for integrations that immediately reuse the same canvas element.
- Disable declaration maps in the published package because only `dist/` is published.
- Remove the unused `@rollup/plugin-commonjs` development dependency.
- Clarify UMD global usage, published browser requirements, and ES2019 output expectations in the README.
- Run Playwright browser integration tests in CI and publish npm artifacts with provenance.
- Align React and Vue example dependencies with the root Vite major version.

### Fixed

- Refresh the Mosaic raster cache after a committed stroke so subsequent strokes in the same session use current pixels.
- Rebuild stale Mosaic raster caches when the active base image source changes during an open Mosaic session.
- Release DOM, session, configuration, event, history, and Fabric references from `dispose()` more completely.
- Disable all editor controls after disposal, including controls that were active inside tool modes.
- Match live Fabric objects to serialized canvas JSON by stable editor metadata before falling back to positional matching.
- Include legacy mask angle and scale fields when matching same-position masks during state restore.
- Keep preserved crop masks aligned when the committed cropped image is scaled by the active layout mode.
- Roll back runtime scale and rotation state when Fabric transform animations fail to start or complete.
- Restore the temporary rotation origin after non-dispose animation failures, and still record transform history when post-snap UI sync fails.
- Restore merged-image display geometry even when the inner transactional image load rejects.
- Decode `exportImageFile()` data URLs with a preallocated byte buffer instead of a per-character `Uint8Array.from()` callback.
- Combine JPEG image-area partial-edge sealing and opaque background compositing into one offscreen canvas pass to avoid repeated decode/encode work.
- Route all asynchronous DOM toolbar action failures through `onError`, including image input, transform, and merge controls.
- Isolate throwing `createMask()` numeric resolvers and `fabricGenerator` callbacks through `onWarning` instead of leaking synchronous exceptions.
- Deep-copy and freeze nested `defaultMaskConfig` values, freeze shared element targets and snapshot custom-key lists, and ignore undefined `originalStroke` metadata.
- Normalize crop export format aliases consistently with other export paths.
- Clamp invalid `HistoryManager` sizes to a usable undo stack.
- Allow crop-session state snapshots and preserve operation options through crop, mosaic, and annotation action-access adapters.
- Clamp Fabric animation durations before passing them to Fabric.
- Sanitize exported file basenames before creating `File` or download names.
- Prevent default browser handling for editor-owned Delete, Backspace, and Escape shortcuts.
- Accept supported image data URLs with case-insensitive `data:image/...` schemes.
- Keep Mosaic dragging active when the pointer leaves and re-enters the canvas before mouseup.
- Set newly-loaded base image scale fields absolutely instead of relying on Fabric's multiplicative `scale()` helper.
- Ignore unknown DOM element-map keys at runtime.
- Avoid post-dispose UI refreshes from queued transform finalizers.
- Clamp DOM zoom-step calculations back to a finite fallback and clamp mask-label callback indexes to non-negative values.
- Drop unsafe object-copy keys while normalizing `defaultMaskConfig` and its `styles` object.
- Index `loadFromState()` mask restoration by `maskUid` before falling back to legacy positional matching.
- Suppress public `onSelectionChange` callbacks during export and merge-only active selection teardown/restoration.
- Reject export MIME fallback when the browser returns a different `data:image/...` type than the requested format.
- Skip JPEG EXIF auto-orientation when raw `createImageBitmap` decode is unavailable, avoiding fallback double-rotation risk.
- Guard `OperationGuard.beginBusyOperation()` against reentrant active operations.

## [2.6.0] - 2026-06-28

### Added

- Add public read-only state accessors:
  - `getEditorState(): ImageEditorState`
  - `getImageInfo(): ImageInfo | null`
  - `getMasks(): MaskObject[]`
  - `getSelection(): ImageEditorSelection`
  - `getActiveToolMode(): EditorToolMode | null`
- Add `onToolModeChange(activeToolMode, previousToolMode, context)` for framework integrations that mirror active tool state.
- Add `onHistoryChange({ canUndo, canRedo }, context)` for framework integrations that mirror undo/redo availability.
- Add React, Vue, and Next.js client-only integration examples.
- Add Playwright browser E2E tests for core integration behavior.
- Add Playwright visual regression coverage for export, crop, and Mosaic behavior.
- Add `autoOrientImage` to normalize supported JPEG EXIF orientation during file-input loading.

### Changed

- Align README examples, browser test commands, public TypeScript declarations, generated declaration checks, and changelog notes for the v2.6.0 public API.
- Route recoverable internal restore/rollback warnings through `onWarning` instead of direct `console.warn` calls.
- Clarify `HistoryManager.pushAndTrim()` overflow index handling so future maintenance preserves the current pointer arithmetic.

### Fixed

- Reject `exportImageFile()` before editor initialization with the same clear `ExportNotReadyError` used by `exportImageBase64()`.
- Round DOM zoom step calculations to stable precision so repeated Zoom In/Out button clicks do not accumulate floating-point drift.
- Consolidate `dispose()` runtime cleanup through `EditorRuntime.resetAfterDispose()` so disposed state stays consistent as runtime fields evolve.
- Serialize overlapping `HistoryManager.execute()` calls so command bodies cannot interleave and corrupt history ordering.
- Skip duplicate DOM input application when an `input` event is followed by a `change` event with the same value.

## [2.5.1] - 2026-06-26

### Added

- Add `isProcessing()` as a focused runtime-state API for checking active async work without treating tool modes as processing.

### Changed

- Limit accepted image load inputs to the browser-supported PNG, JPEG, and WebP formats documented for the editor.
- Start free crop sessions from the padded image area so the initial crop rectangle matches the visible editing region.
- Require DOM-backed canvas creation for resampling instead of falling back to the global document.

### Fixed

- Restore failed image loads from serialized editor state instead of stale Fabric object references, including rollback filtering for session-only objects and a safe reset path when rollback deserialization fails.
- Enforce image-load timeouts as a total deadline and abort Fabric image loading when the deadline expires.
- Reject no-image Base64 exports with `ExportNotReadyError` instead of returning an empty string.
- Reject oversized serialized canvas dimensions before applying them during state restore.
- Report warnings for lifecycle and API diagnostics that previously failed silently, including missing Fabric, repeated initialization, unsupported load inputs, unsupported `defaultMaskConfig` hooks, and fallback image info.
- Preserve keyboard delete/backspace safety for editable controls inside Shadow DOM.
- Validate export background colors with `CSS.supports()` when available.
- Propagate file-input image load failures while still resetting the input value.

## [2.5.0] - 2026-06-25

### Added

- Add HTMLElement/ref-based `init()` targets while preserving existing string ID initialization.
- Add public `setCanvasSize()`, `resizeToContainer()`, and `relayout()` APIs for responsive host layouts.
- Add React, Vue, and SSR integration guides under `docs/frameworks/`.
- Add `maskListOrder` and `annotationListOrder` options so integrators can choose front-to-back or back-to-front sidebar ordering.

### Changed

- Store actual DOM listener elements in `DomBindings` so cleanup detaches from the originally-bound node even if a framework replaces refs.
- Export `ElementTarget`, `ElementMap`, `ResizeToContainerOptions`, and `RelayoutOptions` from the package root.
- Remove unused legacy facade helpers from `ImageEditor`, including stale context-builder wrappers and the old private `getRuntimeOptions()` path; the runtime-owned `EditorRuntime.getRuntimeOptions()` remains the active source for current layout-mode options.
- Remove the unused `ui-state` module and internal `ResolvedElementIdMap` / `resolveElementIds` compatibility aliases after the ref-based element map architecture replaced the old ID-only helper path.
- Update internal merge-layout coverage to exercise the public `mergeMasks()` path instead of reading TypeScript-private facade methods at runtime.
- Clarify test comments so the suite documents library behavior, source modules, package metadata, and build artifacts rather than demo pages or README/docs content.
- Render Mask list and Annotation list in front-to-back order by default so topmost and newly added overlays appear first; set the corresponding list order option to `back-to-front` to retain the previous Fabric object-order display.

### Fixed

- Normalize invalid runtime option values for top-level booleans, strings, downsample MIME, crop aspect ratio, crop booleans, and crop export format so unsupported values fall back to documented defaults.
- Keep Text mode text creation active when clicking over non-text Fabric targets, including existing Draw annotations, so large draw strokes no longer block placing text inside their bounds.
- Preserve Mask list and Annotation list selection highlights after layer-order actions rerender the lists, while keeping omitted list elements as safe no-ops.
- Wrap malformed `loadFromState` snapshot JSON in a semantic `StateRestoreError` for clearer consumer diagnostics.
- Propagate Fabric annotation setter failures instead of falling back to raw property assignment that can bypass Fabric dirty/coordinate updates.
- Prevent `HistoryManager.push()` from appending commands while undo/redo is in flight.
- Resolve Mask list and Annotation list click selection against the current canvas reference so stale list handlers cannot operate on a disposed canvas after reinitialization.

### Documentation

- Link framework integration guides from the README and document ref-based mounting and responsive relayout APIs.
- Document mask and annotation list ordering options and their sidebar-only effect.
- Document the internal Context Bundle pattern used by feature modules.

## [2.4.1] - 2026-06-23

### Fixed

- Preserve annotation base interactivity metadata across creation, update, lock/unlock, save/load, undo/redo, and overlay merge preservation.
- Emit `updateAnnotation` for existing text edits, suppress duplicate text-edit history/callbacks from Fabric `object:modified`, and commit active text editing when exiting Text mode through the public/DOM path.
- Restore hidden export overlays with Fabric's default visible state when their previous `visible` value was `undefined`.

### Documentation

- Clarify Text/Draw tool-mode blocked operations, export-vs-merge state semantics, and `annotationHidden` / `annotationLocked` behavior.

## [2.4.0] - 2026-06-22

### Changed

- Refactor `ImageEditor` around a shared internal runtime plus action/context access adapters, preserving the documented public API and package root surface.
- Extract DOM event actions and editor control snapshot construction into focused UI modules to keep facade wiring smaller.
- Move internal tests to explicit runtime-state helpers and remove temporary facade compatibility accessors for TypeScript-private fields.
- Refresh internal file headers and architecture comments to match the runtime-owned state model.

### Fixed

- Clean up stale import/type drift after the modularization work and keep typecheck/lint passing from source.
- Avoid duplicate download export error reporting while still surfacing DOM-triggered download/undo/redo failures through `onError`.
- Harden export edge sealing, active-object restoration, download link creation, and transparent CSS color parsing against audit-reported edge cases.
- Stop inferring an active mask from a lone visible mask label when capturing history snapshots.

## [2.3.0] - 2026-06-18

### Breaking Changes

- Replace `Base64ExportOptions`, `ImageFileExportOptions`, and `DownloadImageOptions` with the unified `ImageExportOptions` type.
- Remove the `downloadImage(fileName: string)` shorthand. Use `downloadImage({ fileName })` instead.
- Change `downloadImage()` to return `Promise<void>`.
- Change the default download/export filename base from `edited_image.jpg` to `edited_image`; the requested export format now determines the extension.

### Added

- Add base-image-only `flipHorizontal()` and `flipVertical()` APIs, optional `flipHorizontalButton` / `flipVerticalButton` DOM bindings, editor state flags, undo/redo support, and save/load persistence.
- Add crop aspect-ratio locking through `enterCropMode(options?)`, constructor-level `crop.aspectRatio`, and presets for `1:1`, `3:4`, `4:3`, `3:2`, `2:3`, `16:9`, and `9:16`.
- Add `setCropAspectRatio()` and optional `cropAspectRatioSelect` DOM binding so crop ratio controls can resize an active crop rectangle.
- Add custom crop aspect ratios through `{ width, height }`.
- Add regression coverage for unified export options, filename resolution, base-image-only flips, flip history/state persistence, and crop aspect-ratio behavior.

### Changed

- Refactor Base64, `File`, and download exports to resolve options through one shared export path while preserving per-format output and overlay rendering controls.
- Apply `format` as an alias for `fileType` across all export entry points, with `fileType` taking precedence.
- Update the demo and README for asynchronous downloads, unified export options, flip controls, and crop ratio examples.

### Fixed

- Ensure image flip operations do not mirror masks, annotations, or session overlays.
- Ensure `exportImageFile()` and `downloadImage()` append or correct filename extensions from the resolved export format.
- Ensure invalid runtime download options reject clearly instead of being treated as legacy filename shorthand.
- Ensure `loadImage()` rejects unsupported image data URL MIME types, including SVG, before mutating editor state.

## [2.2.0] - 2026-06-15

### Breaking Changes

- Require `editorObjectKind` metadata on every editor-owned Fabric object.
- Make `isMaskObject()` strict: masks now require `editorObjectKind: 'mask'`, `maskId`, `maskUid`, and `maskName`.
- Make `MaskObject.maskUid` required.
- Stop migrating legacy serialized states that do not include `editorObjectKind`.
- Rename export option mergeMask to `mergeMasks`.
- Rename constructor default mergeMaskByDefault to `mergeMasksByDefault`.

### Added

- Add public editor object guards for base images, masks, annotations, text annotations, draw annotations, session objects, and editable overlays.
- Add Text annotations with runtime text config, direct creation, Text mode, editing cleanup, annotation list rendering, hidden/locked state, and update/delete APIs.
- Add Draw mode with runtime brush config and one annotation object per created Fabric path.
- Add `mergeAnnotations()`, annotation callbacks, annotation DOM bindings, keyboard cleanup, selected-object deletion, and layer operation APIs.
- Add centralized layer ordering for base image, editable overlays, and session objects.
- Add shared overlay merge transactions so `mergeMasks()` preserves annotations and `mergeAnnotations()` preserves masks.

### Changed

- Export options now use independent `mergeMasks` and `mergeAnnotations` flags that affect rendered output only.
- Serializer snapshots now preserve base/mask/annotation metadata, active mask or annotation identity, and filter session objects.
- Update docs demo for Text, Draw, annotation controls, layer controls, export toggles, and merge annotations.

### Fixed

- Update Text and Draw mode style inputs so changing text size or draw brush size while the mode remains active affects the next created annotation without re-entering the mode, and active inputs are not overwritten while the user is typing or dragging.
- Let `downloadImage()` accept `mergeMasks` and `mergeAnnotations` options, and update the docs demo Download button to respect the same export overlay checkboxes as Base64 output.
- Align image-load annotation counter handling with the required `LoadImageContext` contract, including reset and rollback paths.
- Create export offscreen canvases from the Fabric canvas owner document for partial-edge sealing, JPEG compositing, and data URL re-encoding.
- Release the Mosaic raster cache when exiting Mosaic mode.
- Type Mosaic preview dash arrays as readonly and copy them before passing them to Fabric.

## [2.1.0] - 2026-06-12

### Breaking Changes

- Replaced layout boolean options (`expandCanvasToImage`, `fitImageToCanvas`, `coverImageToCanvas`) with `defaultLayoutMode: 'fit' | 'cover' | 'expand'`.
- Runtime layout changes should use `editor.setLayoutMode(mode)`.
- Invalid constructor `defaultLayoutMode` values fall back to `'expand'`.
- Invalid `setLayoutMode(mode)` calls are ignored and preserve the current layout mode.

### Added

- Add complete Mosaic mode with `defaultMosaicConfig`, runtime Mosaic config setters, optional DOM bindings, circular preview cursor, base-image pixel commits, and undo/redo support per successful click.
- Add Mosaic drag painting with live in-canvas preview by caching decoded pixels during a Mosaic session, processing queued pointer points, and committing each completed stroke as one undoable history entry.
- Add pure Mosaic pixelation and coordinate-conversion coverage, including scaled/translated/rotated image mapping.
- Add default mask configuration for new masks.
- Add regression coverage for dispose-aborted Fabric animations, deterministic mask UIDs, strict export data URL decoding, and frozen resolved options.

### Changed

- Rework the v2 demo workspace into a side-toolbar layout, compact icon controls, and a narrower mask list to avoid toolbar overflow.
- Update docs demo with Mosaic controls, examples, and public API documentation.
- Update demo page scripts and merge/isolate the legacy v1 demo page in the docs.

### Fixed

- Preserve requested WebP output for image-area exports after partial transparent edge sealing instead of silently returning PNG.
- Avoid repeated full-image decode/replacement work for every Mosaic pointer point, and stop dropping fast Mosaic clicks while a previous point is still being processed.
- Use the canvas or control `ownerDocument` for downsampling canvases, download anchors, DOM bindings, and mask-list rendering so iframe and multi-document integrations work correctly.
- Reject near-singular Mosaic transform matrices with a practical pixel-scale threshold instead of `Number.EPSILON`.
- Remove duplicate wording from the internal error module comments.
- Make internal merge/crop snapshots fail fast when no canvas is available instead of producing an empty rollback snapshot that `loadFromState()` silently ignores.
- Derive new mask `maskUid` values from the editor-owned `maskId` so identifiers are deterministic across editor instances, test runs, and page reloads.
- Keep internal operation tokens module-local and route composite image loads through a private helper instead of carrying bypass tokens through the public `loadImage()` option shape.
- Let unexpected idle-guard errors propagate while preserving documented no-op behavior for expected busy, crop, animation, and dispose guards.
- Settle Fabric animation promises when `dispose()` aborts an in-flight animation, and drain the animation queue iteratively to avoid recursive promise-chain growth.
- Freeze the top-level resolved options object and keep runtime layout mode in facade state instead of mutating resolved options.
- Settle stale auto-scrollbars after Fit/Cover state restores so crop undo does not leave an extra scrollbar when a restored canvas axis exactly matches the visible viewport.
- Record already-applied history snapshots with `HistoryManager.push()` instead of using a first-call no-op `execute()` latch.
- Remove stale image-load rollback state for container `overflow`, reject whitespace-bearing base64 data URLs during file export, and avoid nondeterministic active-mask fallback when multiple labels are present.

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


