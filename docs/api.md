# Public API Reference

The current package is a Core Framework with explicit Plugin composition. Core
owns lifecycle, image/layout state, Snapshot transactions, and export. Feature
methods live on the typed APIs returned when Plugins are installed. The package
root and `/core` resolve to the same `ImageEditorCore` class; the root does not
export Features, Presets, DOM Controls, or migration code.

This reference describes the `3.0.0-rc.1` candidate API. It is a breaking major
release and is not a stable published release.

## Formal package entries

Every main-package entry below provides ESM, CommonJS, ESM declarations,
CommonJS declarations, and NodeNext resolution. Fabric stays external.

| Import                                           | Responsibility                                   |
| ------------------------------------------------ | ------------------------------------------------ |
| `@bensitu/image-editor`                          | Core Framework root                              |
| `@bensitu/image-editor/core`                     | Core Framework class and contracts               |
| `@bensitu/image-editor/sdk`                      | Plugin authoring and Capability contracts        |
| `@bensitu/image-editor/testing`                  | Test host and Conformance Kit                    |
| `@bensitu/image-editor/plugins/transform`        | Base-image transforms                            |
| `@bensitu/image-editor/plugins/history`          | Bounded History provider                         |
| `@bensitu/image-editor/plugins/overlay`          | Shared Overlay Foundation                        |
| `@bensitu/image-editor/plugins/mask`             | Editable redaction masks                         |
| `@bensitu/image-editor/plugins/filters`          | Previewed and committed image filters            |
| `@bensitu/image-editor/plugins/crop`             | Transactional crop sessions                      |
| `@bensitu/image-editor/plugins/mosaic`           | Transactional pixelation sessions                |
| `@bensitu/image-editor/plugins/annotation`       | Shared Annotation Foundation                     |
| `@bensitu/image-editor/plugins/annotation-text`  | Text creation/editing                            |
| `@bensitu/image-editor/plugins/annotation-shape` | Rect, line, and arrow annotations                |
| `@bensitu/image-editor/plugins/annotation-draw`  | Freehand Draw and whole-object Eraser            |
| `@bensitu/image-editor/plugins/overlay-state`    | Portable Overlay document wire format            |
| `@bensitu/image-editor/plugins/dom-controls`     | Optional imperative DOM adapter                  |
| `@bensitu/image-editor/presets/minimal`          | Transform with optional History                  |
| `@bensitu/image-editor/presets/redaction`        | Redaction-focused composition                    |
| `@bensitu/image-editor/presets/annotation`       | Annotation-focused composition                   |
| `@bensitu/image-editor/presets/full`             | Every official Feature and both Foundations      |
| `@bensitu/image-editor/migrate-v2`               | Isolated older-Snapshot detection and conversion |

Do not import source paths, `dist` files, controllers, coordinators, registries,
or internal chunks. `@bensitu/image-editor-codemod` is a separate package, not a
main-package subpath.

## Core Framework

```ts
import * as fabric from 'fabric';
import { ImageEditorCore } from '@bensitu/image-editor/core';

const editor = new ImageEditorCore(fabric, {
    defaultLayoutMode: 'fit',
    maxInputBytes: 16 * 1024 * 1024,
    maxInputPixels: 50_000_000,
});
```

The constructor requires the supported Fabric module and optional
`ImageEditorCoreOptions`. Construction and Plugin installation are
DOM-independent. `init({ canvas, canvasContainer, imagePlaceholder? })` binds a
Fabric canvas; all Plugins must be installed first.

Main methods:

| Method                                     | Contract                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------- |
| `use(plugin)`                              | Atomically install one synchronous Plugin and infer its API                     |
| `install(pluginOrPlan)`                    | Atomically install a tuple/plan and preserve result inference                   |
| `getPlugin(ref)` / `requirePlugin(ref)`    | Resolve `TApi \| null` or require `TApi`                                        |
| `init(elements)`                           | Initialize one canvas and run Plugin lifecycle hooks                            |
| `loadImage(source, options?)`              | Transactionally load a PNG/JPEG/WebP data URL                                   |
| `loadImageFile(file, options?)`            | Validate/decode a browser file, including EXIF orientation                      |
| `saveState()`                              | Serialize the current schema `image-editor.state@3`                             |
| `loadFromState(value, options?)`           | Validate then atomically restore; migrations are explicit                       |
| `exportImageBase64(options?)`              | Render isolated PNG/JPEG/WebP output                                            |
| `exportImageFile(options?)`                | Return the same isolated output as a browser `File`                             |
| `getImageInfo()` / `isImageLoaded()`       | Read immutable committed image status                                           |
| `setLayoutMode(mode)`                      | Select `fit`, `cover`, or `expand` for future image loads                       |
| `getLifecycleState()` / `getDiagnostics()` | Read lifecycle and bounded diagnostics                                          |
| `emergencyReset()` / `forceDispose()`      | Explicit recovery for a faulted runtime                                         |
| `disposeAsync()`                           | Authoritative, awaitable release path; rejects with aggregated cleanup failures |
| `dispose()`                                | Deprecated best-effort starter; may return before asynchronous cleanup settles  |

Core rejects operations in invalid lifecycle states. Failed image/State loads
restore the prior document before their promises reject. Snapshot validation
runs before mutation and enforces byte, depth, object-count, string, data-URL,
pixel, dimension, Plugin-payload, metadata, URL, and dangerous-key limits.

Core imports are SSR-safe. Canvas initialization, image decode, and export need
a browser or an explicitly supplied compatible Fabric DOM environment.

## SDK and installation

`definePluginRef<TApi>(id, apiVersion)` creates a typed identity.
`definePlugin()` validates and returns a synchronous Plugin definition; the
public RC contract requires `setupMode: 'sync'`.
`composePlugins()` creates a dependency-aware plan without erasing tuple API
types. Manifests declare implementation version, API version, Core engine range,
required/optional Plugins, required/optional Capabilities, and privileged
permissions.

Setup is transactional. The host resolves dependencies deterministically;
failure disposes earlier registrations in reverse order. Plugin-owned resources
belong in `context.disposables`. Operations coordinate conflict domains and
reentrancy. Tools coordinate exclusive sessions. Committed events run only after
a successful transaction.

See the [Plugin Author Guide](./plugin-author-guide.md) for lifecycle, State
Slices, Overlays, History, geometry/raster authority, errors, and packaging.

## Capabilities

Capabilities are versioned, typed ports—not a service locator for private Core
objects. A provider version must match its token version. Required range failures
abort installation; optional access distinguishes missing from incompatible.

| Token                              | Public authority                                  | Permission when privileged      |
| ---------------------------------- | ------------------------------------------------- | ------------------------------- |
| `CORE_STATUS_CAPABILITY`           | Disposal status                                   | none                            |
| `CORE_DIAGNOSTICS_CAPABILITY`      | Report warnings/errors                            | none                            |
| `CORE_PRESENTATION_CAPABILITY`     | Background and layout policy                      | none                            |
| `FABRIC_RUNTIME_CAPABILITY`        | Supported Fabric module                           | `fabric:objects` where required |
| `CANVAS_READ_CAPABILITY`           | Scoped live-canvas read                           | `fabric:canvas-read`            |
| `BASE_IMAGE_READ_CAPABILITY`       | Read Base Image and immutable geometry info       | none                            |
| `BASE_IMAGE_INFO_CAPABILITY`       | Immutable image/geometry information only         | none                            |
| `IMAGE_RESOURCE_POLICY_CAPABILITY` | Current decode/export resource limits             | none                            |
| `RENDER_REQUEST_CAPABILITY`        | Request render                                    | none                            |
| `CANVAS_RESIZE_CAPABILITY`         | Coordinated canvas resize                         | none                            |
| `RASTER_MUTATION_CAPABILITY`       | Replace Base Image inside a mutation              | `core:raster-mutation`          |
| `SNAPSHOT_REGISTRATION_CAPABILITY` | State Slices and object classification            | none                            |
| `MEMENTO_HISTORY_CAPABILITY`       | Trusted Memento/history-provider integration      | none                            |
| `GEOMETRY_MUTATION_CAPABILITY`     | Geometry participants                             | `core:geometry-participant`     |
| `DOCUMENT_MUTATION_CAPABILITY`     | Atomic document/raster transaction orchestration  | varies by concrete mutation     |
| `EXPORT_CONTRIBUTION_CAPABILITY`   | Isolated export contributor                       | `core:export-contributor`       |
| `VISIBLE_RASTER_BAKE_CAPABILITY`   | Optional visible-filter bake before raster commit | none                            |

The Overlay Foundation additionally provides `OVERLAY_CAPABILITY` and
`OVERLAY_REGISTRATION_CAPABILITY`; the Annotation Foundation provides
`ANNOTATION_CAPABILITY` and `ANNOTATION_AUTHORING_CAPABILITY`; History provides
`HISTORY_CAPABILITY`.

The permission model makes authority auditable but does not sandbox third-party
JavaScript. Fabric global mutation must be declared with
`fabric:global-mutation` and weakens the strong multi-instance boundary.

## Testing and Conformance

`@bensitu/image-editor/testing` exports a deterministic Plugin test host,
controlled decoder/Fabric fixtures, `CONFORMANCE_PROFILE`, and assertions for:

- lifecycle order, setup rollback, and registration leaks;
- required/optional Capabilities and permission declarations;
- State round trips, Slice migration, and persistent-kind Codec coverage;
- compound document and Overlay History transactions;
- Base Image, package peer, bundle isolation, and multi-instance boundaries;
- method-level type inference.

`runPluginConformance()` returns a stable report. Required responsibilities may
not be replaced with `NOT_AVAILABLE`. Testing is a separate entry and is not
reachable from normal runtime bundles.

## Official Features

Install dependencies before dependents. Presets encode these orders. Direct
composition should use `editor.install()` with a tuple or `composePlugins()`.

### Transform

`TransformPluginApi` exposes `scale`, `zoomIn`, `zoomOut`, `rotate`,
`flipHorizontal`, `flipVertical`, `resetImageTransform`, and `getState`.
Mutations are geometry-coordinated and produce one History record when History
is enabled. Configuration sets animation duration and scale/rotation steps.

### History

`HistoryPort` exposes `enable({ baseline: 'current' })`, `disable`, `undo`,
`redo`, `clear`, `canUndo`, `canRedo`, `getState`, and `onChange`. Recording is
enabled by default and bounded by `maxSize`. Disabled recording remains
installed; re-enabling captures a non-undoable current baseline. See
[History](./history.md).

### Overlay Foundation

The Foundation owns persistent/transient classification, IDs, selection,
mutation, flattening, geometry/interaction policies, Codecs, and export
renderers. Its runtime API lists immutable classifications but intentionally
uses live Fabric objects inside privileged Plugin contracts. Persistent kinds
must have a versioned Codec. See [Overlay transform binding](./overlay-transform-binding.md).

### Mask

`MaskPluginApi` exposes `create`, `getAll`, `remove`, `removeSelected`,
`removeAll`, and `flatten`. Mask changes use Overlay transactions and History;
labels and selection artifacts are transient. Configuration controls defaults,
labels, rotation, list order, transform binding, and naming.

### Filters

`FiltersPluginApi` exposes `preview`, `commit`, `cancelPreview`, `clear`, `bake`,
`configure`, `getConfiguration`, `getState`, and `subscribe`. Preview is
transient; commit updates a validated State Slice; bake atomically replaces the
Base Image. Supported definitions and ranges are in [Filters](./filters.md).

### Crop

`CropPluginApi` exposes `enter`, `updateRect`, `setAspectRatio`, `apply`,
`cancel`, `getSession`, and `subscribe`. Rectangles use natural image pixels.
Preview is transient; apply is a rollback-safe raster/geometry commit. Overlay
preserve/drop/clip policy and visible-filter bake are explicit. See [Crop](./crop.md).

### Mosaic

`MosaicPluginApi` exposes `enter`, stroke methods, `commit`, `cancel`,
configuration, session status, and subscription. Points use natural image
pixels. Point count and raster output are bounded. Preview is transient and
commit is rollback-safe. See [Mosaic](./mosaic.md).

### Annotation Foundation

The Foundation depends on Overlay and owns annotation descriptors, selection,
metadata, hide/lock, ordering, remove, flatten, and subscriptions. Concrete Text,
Shape, and Draw Plugins register Feature definitions and Codecs. See
[Annotations](./annotations.md).

### Text

`TextAnnotationPluginApi` creates/updates text and owns begin/commit/cancel edit
sessions, configuration, status, and subscriptions. Font fallback and transform
reflection behavior are explicit. See [Text](./annotation-text.md).

### Shape

`ShapeAnnotationPluginApi` creates and updates rectangles, lines, and arrows, or
runs a transient preview session with `enter`, `updatePreview`, `commit`, and
`cancel`. See [Shape](./annotation-shape.md).

### Draw and Eraser

`DrawAnnotationPluginApi` owns brush/eraser sessions, point limits,
configuration, and status. The current Eraser removes whole intersected Draw
objects; it does not split paths. See [Draw/Eraser](./annotation-draw.md).

### Overlay State

`OverlayStatePluginApi` exposes `validate`, `migrate`, `exportState`, and
`importState`. Wire version 1 uses schema `image-editor.overlay-state` and
image-normalized coordinates. Import validates resource limits and Codecs before
an atomic replace/append transaction. It is portable overlay data, not a full
editor Snapshot. See [Overlay State](./overlay-state.md).

### DOM Controls

DOM Controls is an optional adapter. Sections bind exact `PluginRef`/resolver
pairs to selectors or elements; the Plugin owns listeners, guarded keyboard
commands, status renderers, and async error routing. It adds no Feature logic and
is absent from all Presets unless `domControls` is explicitly supplied. See
[DOM Controls](./dom-controls.md).

## Presets

Preset factories create one Core, install a fixed Plugin plan, and return
`{ editor, ...featureApis, domControls }`. They do not initialize the canvas or
forward Feature methods. Minimal, Redaction, Annotation, and Full compositions
are described in [Typed Presets](./presets.md). Optional DOM factories preserve
nullability in the inferred result type.

## Snapshot migration entry

Core accepts explicit generic `SnapshotMigration` handlers through
`loadFromState(..., { migrations })`; it never guesses or automatically converts
an unsupported schema. The isolated migration entry exports:

- `detectSnapshotVersion`;
- `migrateV2Snapshot`;
- `loadV2Snapshot`;
- `v2SnapshotMigration`.

Strict conversion is the default. Unsupported persisted state rejects; lossy
conversion requires `unsupportedFieldPolicy: 'warn-and-skip'` and emits each
warning. Input size/depth/object limits and dangerous-key checks run before
conversion, output is revalidated by Core, and failure leaves the editor
unchanged. See [Migration from 2.x](./migration-from-v2.md).

## Errors and recovery

Core exposes lifecycle, fault, document-mutation, Snapshot validation, and
unsupported-version errors. The SDK exposes manifest, identity, dependency,
engine/API-version, Capability, permission, setup, and batch-install errors.
Features export domain errors from their own entries.

Recoverable public-input errors reject the operation without partial mutation.
An invariant or rollback failure can fault the editor; normal operations then
reject until `emergencyReset`, `forceDispose`, or replacement. Host diagnostic
callbacks are contained and cannot replace the operation result.

## Bundle and environment policy

The root remains Core-only and tree-shakeable. Migration, Testing, Features,
Presets, DOM Controls, and Codemod code are absent unless their entry is
selected. Fabric is a peer/global and is not bundled.

Bundled applications should prefer ESM subpaths. Script-tag applications load
Fabric and `dist/umd/image-editor.full.umd.min.js`, then call
`ImageEditorFull.createFullPreset(fabric, options)`. The Full UMD exposes the
public composition/factories, has no removed monolithic facade, and installs DOM
Controls only through an explicit option.
