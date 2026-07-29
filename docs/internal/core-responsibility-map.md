# Core and Plugin Kernel Responsibility Map

This document records the internal ownership boundaries that protect the v3 public contracts. It
describes the implementation at the `3.0.0-rc.1` line; it does not add a public package entry or
change the Snapshot schema.

## ImageEditorCore

| Fields                                                                              | Initialization                                                     | Authorized writers                                                         | Invariants                                                                                        | Primary verification                                                  | Candidate boundary                                  |
| ----------------------------------------------------------------------------------- | ------------------------------------------------------------------ | -------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- | --------------------------------------------------- |
| `fabric`, `options`                                                                 | Constructor input and `resolveOptions()`                           | Immutable after construction                                               | Fabric exposes supported `Canvas` and `FabricImage`; resolved limits remain immutable             | `tests/core/image-editor-core.test.mjs`, type consumers               | None; these are host configuration roots            |
| `canvas`, `canvasElement`, `containerElement`, `placeholderElement`                 | Field defaults; `createCanvas()` binds DOM and Fabric              | `createCanvas()`, `clearRuntimeReferences()`                               | Canvas and bound elements belong to one Core lifecycle and are cleared together                   | Core lifecycle, initialization rollback, and disposal tests           | DOM/Canvas binding service                          |
| `baseImage`, `imageMimeType`, `imageLoaded`, `baseImageScale`                       | Field defaults; image load or state adapter                        | Image load, raster mutation port, state adapter, emergency reset, disposal | A loaded flag implies a live Base Image; MIME and scale describe the current Base Image           | image load, snapshot, raster mutation, export, emergency reset tests  | Image read/decode orchestration                     |
| `layoutMode`, `viewportCache`, `geometryRevision`                                   | Constructor plus deterministic field defaults                      | `setLayoutMode()`, geometry finalization/restore, emergency reset          | Layout values are finite and revision changes only after committed geometry                       | layout, geometry, transform, crop, and mosaic tests                   | Layout/viewport calculation                         |
| `slices`, `objectProperties`, `transientObjects`, `externalObjects`                 | Field initializers or constructor after diagnostics are available  | Registration ports and their owned registries                              | Ownership is scoped; transient/external objects do not enter public Snapshot state                | snapshot, memento, object-property, and plugin cleanup tests          | Registry facade only if ownership stays centralized |
| `history`, `exportContributors`                                                     | Deterministic field initializers                                   | History/export registration ports                                          | One history owner per top-level mutation; export contributors never mutate the live document      | history, export, and operation-concurrency tests                      | Export orchestration                                |
| `mementos`, `snapshots`                                                             | Constructor after the state adapter and registries                 | Their dedicated services                                                   | Restore is transactional; validation, payload limits, alias isolation, and schema remain enforced | snapshot, memento, state-safety, and fault tests                      | Snapshot orchestration, only with schema parity     |
| `documentMutations`, `geometry`                                                     | Constructor after memento/history services                         | Their coordinators and narrow state callbacks                              | Mutations serialize through Operation authority; unrecoverable restore faults the Core            | document mutation, geometry, Core fault, and conformance tests        | Keep coordinators independent from Feature logic    |
| `plugins`, `installationPlan`, `pluginApiHandles`                                   | Plugin Manager at construction; collections use field initializers | install/use, replay, API publication, emergency reset, disposal            | Plugin identity is stable; replay uses canonical definitions; handles are revoked on teardown     | plugin installation, definition lease, emergency reset, and SDK tests | Plugin host facade                                  |
| `lifecycle`, `disposePromise`, `emergencyResetPromise`                              | Deterministic field initializers                                   | lifecycle transitions and idempotent teardown/reset paths                  | Fault/dispose/reset are monotonic and concurrent callers share in-flight work                     | lifecycle, disposal, rollback, and recovery tests                     | Lifecycle coordinator already owns transitions      |
| `loadSequence`, `latestLoadSequence`, `stateLoadSequence`, `initialImageLoadActive` | Deterministic field initializers                                   | image/state load and reset paths                                           | Superseded work cannot publish; initial load diagnostics are not double-reported                  | overlapping load, abort, state load, and recovery tests               | Image load coordinator                              |
| `diagnostics`                                                                       | Deterministic field initializer                                    | `recordDiagnostic()`                                                       | Entries are append-only during a live lifecycle and preserve causes                               | diagnostics and unrecoverable fault tests                             | Diagnostics sink                                    |

## PluginManager

| Fields                                                                                 | Initialization                    | Authorized writers                                    | Invariants                                                                             | Primary verification                                            | Candidate boundary                         |
| -------------------------------------------------------------------------------------- | --------------------------------- | ----------------------------------------------------- | -------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------ |
| `options`                                                                              | Constructor parameter property    | Immutable after construction                          | Warning/error sinks and host capabilities are host-scoped                              | capability and reporting tests                                  | None                                       |
| `capabilityRegistry`, `operationRegistry`, `toolCoordinator`, `eventBus`, `stateStore` | Field initializers or constructor | Their dedicated registries through setup/host facades | Registrations are scoped, collision-safe, and removed on rollback/disposal             | plugin-kernel runtime primitive and registration rollback tests | Existing registry classes are the boundary |
| `installed`, `installationOrder`                                                       | Deterministic field initializers  | successful install, rollback, cleanup                 | Map and order agree; cleanup runs in reverse installation order                        | install, batch, definition lease, lifecycle tests               | Batch installation coordinator             |
| `hostState`, `topLevelInstallActive`, `disposePromise`                                 | Deterministic field initializers  | lifecycle, install, and disposal paths                | Top-level install is non-reentrant; disposal is idempotent; disposed hosts reject work | plugin-manager lifecycle and concurrency tests                  | Lifecycle state machine                    |
| `performInstall`, `rollbackInstalledPlugin`                                            | Type-only `never` declarations    | No runtime writer                                     | Legacy inherited entry points cannot be called from the synchronous manager            | Typecheck and plugin-kernel tests                               | Intentional compile-time sentinels         |

## Completed cohesive extraction

Dependency package metadata is the single low-risk extraction selected for this audit:

- `src/plugin-kernel/official-plugin-package-hints.ts` owns the immutable official
  Plugin-ID-to-package mapping.
- `PluginManager` still owns dependency detection and error construction.
- The metadata module imports no Foundation or Feature implementation, so it cannot create a
  Kernel-to-Feature runtime cycle.
- `tests/plugin-kernel/official-plugin-package-hints.test.mjs` checks every formal official
  `PluginRef`, all `./plugins/*` package exports, actual dependency errors, and the generic
  third-party path.

No second responsibility was extracted. Image decode, layout, export, batch installation, and
Snapshot orchestration remain candidates for separately reviewed changes.

## Field initialization policy

- Deterministic Core and Kernel defaults use field initializers.
- Dependency-ordered services use ordinary typed fields and receive one constructor assignment.
- `declare` remains only for the two `never` compatibility sentinels in `PluginManager`.
- Definite-assignment assertions and TypeScript suppressions are not used.

## Stable boundaries

Any future extraction must preserve all of the following:

- public API and package exports;
- Snapshot schema and validation limits;
- Core lifecycle, fault, reset, and disposal behavior;
- one Document Mutation and Operation authority;
- private mutable Canvas access;
- plugin rollback order, definition leases, and dependency identity;
- Foundation ownership of persistent overlays and annotations.
