# Plugin Author Guide

Image Editor Plugins are normal npm packages built against the public SDK. A
Plugin defines one typed API, declares all dependencies and privileges before
setup, and owns every registration it creates. The host provides coordination;
it is not a security sandbox for untrusted code.

The v3 RC public SDK supports synchronous Plugin definitions only. Declare
`setupMode: 'sync'`, return the API directly from `setup()`, and place
asynchronous teardown in scoped `Disposable` resources so `disposeAsync()` can
await it.

## Package contract

Publish runtime code and declarations for the environments you support. Keep
both Image Editor and Fabric as peers so an application installs one Core and
one Fabric runtime:

```json
{
    "name": "@example/image-editor-status",
    "version": "1.0.0",
    "type": "module",
    "exports": {
        ".": {
            "types": "./dist/index.d.ts",
            "import": "./dist/index.js"
        }
    },
    "files": ["dist", "README.md", "LICENSE"],
    "sideEffects": false,
    "peerDependencies": {
        "@bensitu/image-editor": "^3.0.0-0",
        "fabric": ">=7.4.0 <8"
    }
}
```

Peers may also be development dependencies for local builds. They must not be
bundled or listed as ordinary runtime dependencies. Test the packed tarball in
an empty consumer and verify `npm ls` resolves each peer once.

Use public imports only:

```ts
import type { CoreEventMap } from '@bensitu/image-editor/core';
import {
    CORE_STATUS_CAPABILITY,
    definePlugin,
    definePluginRef,
    type PluginSetupContext,
    type SynchronousEditorPlugin,
} from '@bensitu/image-editor/sdk';
```

Do not import `src`, `dist` chunks, `core-runtime`, `plugin-kernel`, managers,
controllers, or another Plugin's private files.

## Typed identity and manifest

`PluginRef<TApi>` is the stable relationship between a Plugin identity and its
API. `editor.use(plugin)`, `editor.getPlugin(ref)`, and
`editor.requirePlugin(ref)` infer the API from that reference.

```ts
export interface StatusPluginApi {
    isDisposed(): boolean;
}

export const statusPluginRef = definePluginRef<StatusPluginApi>(
    '@example/image-editor-status',
    '1.0.0',
);

export function statusPlugin(): SynchronousEditorPlugin<StatusPluginApi, CoreEventMap> {
    return definePlugin({
        ref: statusPluginRef,
        manifest: {
            id: statusPluginRef.id,
            version: '1.0.0',
            apiVersion: statusPluginRef.apiVersion,
            engine: '^3.0.0',
            requires: [{ token: CORE_STATUS_CAPABILITY, range: '^1.0.0' }],
        },
        setupMode: 'sync',
        setup(context: PluginSetupContext<CoreEventMap>) {
            const status = context.capabilities.require(CORE_STATUS_CAPABILITY);
            return Object.freeze({ isDisposed: () => status.isDisposed() });
        },
    });
}
```

Manifest `version` identifies the implementation, `apiVersion` identifies the
typed API contract, and `engine` constrains the Core API version. They do not
automatically follow the host npm prerelease number.

Declare direct Plugin dependencies in `requiresPlugins`. Declare required
Capability ranges in `requires` and optional ranges in `optional`. Setup reads
them with `capabilities.require()`, `optional()`, or
`getOptionalStatus()`. A missing required dependency prevents setup; an optional
dependency reports `available`, `missing`, or `incompatible` without guessing a
fallback.

## Setup transaction and ownership

The host validates the complete manifest before setup. Batched installation is
ordered by declared dependencies. If any setup fails, the host disposes earlier
registrations in reverse order and leaves no partial Plugin plan installed.

Add every owned subscription, registration, provider, or cleanup callback to
`context.disposables`. `createDisposable()` adapts a callback when an API does
not already return a `Disposable`. Never retain an unscoped registration.

Lifecycle hooks have distinct responsibilities:

- `setup` creates the API and registrations; synchronous Plugins use
  `setupMode: 'sync'`.
- `onInit` runs after Core canvas initialization.
- `onImageLoaded` and `onImageCleared` synchronize image-specific state.
- `onDispose` releases resources not already represented by the disposable
  scope.

Committed event listeners are post-commit observers, not transaction
participants. The Kernel preserves their registration order and gives each
listener a 5-second internal execution budget. A timeout or rejection produces
a structured warning and later listeners continue; a listener must not use this
channel for required transactional work.

Expose mutable configuration through `ConfigurablePluginApi<T>` conventions:
`configure(patch)` validates and atomically applies a patch, and
`getConfiguration()` returns immutable data. Configuration changes that alter
document state should run through an Operation or document transaction.

## Operations, tools, and sessions

Register each public operation with its ID, mode, conflict domains, and
reentrancy policy. Call it through `context.operations.run()` so Core can reject,
queue, or replace overlapping work and propagate an `AbortSignal`. Do not invent
a second busy flag or transaction registry.

Tools coordinate mutually exclusive modes such as Crop, Mosaic, Shape, or Draw.
A Tool registration owns `enter`, `exit`, and its operation allow-list. A session
keeps previews and pointer state transient; cancel and Tool exit must remove
every preview and handler without committing History or Snapshot state.

The [Blur Region reference Plugin](../examples/reference-plugins/blur-region)
demonstrates a Tool, transient Overlay region, scoped raster transaction,
failure injection, rollback, and one compound History commit.

## State, Snapshot, and History

Register a State Slice through `SNAPSHOT_REGISTRATION_CAPABILITY` when Plugin
state must survive Snapshot or Memento restoration. Each slice has a stable ID
and integer version. Its `validate()` function must treat input as untrusted,
enforce resource limits, reject dangerous keys, and return either a typed value
or a precise failure. Restore receives only validated data.

Use `capturePolicy: 'always'` for small value state. Use `reference` only for a
document-owned object graph whose identity is managed by the corresponding Core
contract. Transient previews are registered with
`registerTransientObject()` and never serialized.

Document mutations and Overlay mutations capture trusted Mementos and route one
commit to an installed History provider. A Plugin must not push an independent
history stack. Failed validation, mutation, synchronization, or commit must
restore the previous state and emit no committed event.

The [Metadata reference Plugin](../examples/reference-plugins/metadata) shows a
validated Slice, explicit slice migration, committed events, and configuration
limits.

## Persistent Overlays and Codecs

A persistent Overlay kind requires one owner, a stable namespaced kind ID, a
stable persistent ID, and a versioned Codec. The Codec serializes renderer state
to plain data, validates before deserialization, and recreates Fabric objects.
Register geometry behavior and export rendering with the same owner. Unknown or
missing Codecs fail safely; never silently drop a persistent object.

Transient kinds use `addTransient()` and are excluded from Snapshot, History,
Overlay State, and normal export. The
[Grid/Guide reference Plugin](../examples/reference-plugins/grid-guide)
demonstrates transient objects and multi-instance cleanup. The
[Watermark reference Plugin](../examples/reference-plugins/watermark)
demonstrates a persistent kind, Codec, geometry participant, export renderer,
and configurable API.

## Geometry, raster, and export authority

Use `GEOMETRY_MUTATION_CAPABILITY` to participate in coordinated base-image
transform or crop geometry. A participant prepares, applies, validates, and
rolls back within the shared transaction; it must not mutate Core geometry from
an unrelated callback.

`RASTER_MUTATION_CAPABILITY` replaces the Base Image only inside an active
document mutation context. Declare `core:raster-mutation`, validate dimensions,
honor cancellation, and provide rollback-safe intermediate resources.

Use `EXPORT_CONTRIBUTION_CAPABILITY` for output that is not already owned by the
Overlay Foundation. Contributors render to the isolated export canvas and must
not mutate the live editor. Declare `core:export-contributor`.

Committed events run only after a successful transaction. Listeners may react
to the immutable descriptor but cannot retroactively veto the commit.

## Permissions and Fabric mutation

Privileged boundaries require matching manifest permissions:

| Permission                  | Authority                                            |
| --------------------------- | ---------------------------------------------------- |
| `fabric:objects`            | Construct or inspect scoped Fabric objects           |
| `fabric:canvas-read`        | Read the live canvas through a declared Capability   |
| `fabric:custom-class`       | Register persistent kinds, Codecs, or renderers      |
| `fabric:global-mutation`    | Intentionally change Fabric globals                  |
| `core:raster-mutation`      | Replace the Base Image inside a coordinated mutation |
| `core:geometry-participant` | Participate in coordinated geometry changes          |
| `core:export-contributor`   | Add an isolated export contributor                   |

Fabric global mutation downgrades the strong multi-instance guarantee. Declare
it, restore the previous global state on disposal, and test two editors. The SDK
permission model is an auditable integration boundary, not process isolation:
install only trusted Plugin code.

## Errors

Use argument errors (`TypeError`, `RangeError`) for invalid public input and
domain-specific errors for recoverable Plugin conditions. Manifest,
dependency, API-version, Capability-version, permission, setup, and batch
rollback failures use the SDK error taxonomy. Report recoverable diagnostics
through `CORE_DIAGNOSTICS_CAPABILITY`; do not swallow a failed transaction or
replace it with a warning.

## Conformance and package isolation

The public testing entry provides deterministic hosts and contract assertions.
Start with the complete, compiling test setup in the
[Plugin package template](../examples/plugin-template), then add
`runPluginConformance()` adapters for every responsibility your Plugin claims.
Run the template proof with:

```bash
npm test
```

Run lifecycle, missing/optional Capability, permission, rollback, leak, state,
Codec, History, transaction, package, bundle, and multi-instance assertions that
apply to the Plugin. `NOT_AVAILABLE` does not satisfy a required assertion.

Build and pack the package, then test ESM, CommonJS when offered, NodeNext types,
behavior, and Conformance from the tarball. Inspect the bundle module graph:
Core and Fabric must remain external, private package paths must be zero, and
source maps must not contain local absolute paths or secrets.

Use the [Plugin package template](../examples/plugin-template) as the smallest
compiling starting point. The four [reference packages](../examples/reference-plugins)
provide independently packable proofs for persistent Overlay, canvas-free
state, transient rendering, and raster mutation responsibilities.
