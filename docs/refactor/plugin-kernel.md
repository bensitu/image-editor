# Plugin Kernel (Phase 1)

## Status and boundary

The Kernel is implemented under `src/plugin-kernel` because the existing `src/core` tree contains v2.9.0 feature-specific baseline debt. It is renderer-neutral, DOM-neutral, instance-local, and has no import-time registration.

There is deliberately no npm subpath export for the Kernel in Phase 1. `src/index.ts`, package-root declarations, CJS, UMD, and `package.json#exports` remain unchanged. The internal bundle fixture resolves `@bensitu/image-editor/plugin-kernel-internal` only inside the test harness; that specifier is not a consumer contract.

The Kernel does not contain Fabric, Geometry mutation, Memento, Snapshot, History, feature plugins, or runtime hot installation/uninstallation.

## Plugin identity and API lookup

```ts
interface ExampleApi {
    read(): string;
}

const exampleRef = definePluginRef<ExampleApi>('company.example/plugin', '1.0.0');

const plugin: EditorPlugin<ExampleApi> = {
    ref: exampleRef,
    version: '1.2.0',
    setup() {
        return { read: () => 'value' };
    },
};

const manager = new PluginManager();
const installed = await manager.install(plugin);
const optional = manager.get(exampleRef); // ExampleApi | null
const required = manager.require(exampleRef); // ExampleApi
```

`ref.id` is the only plugin ID. `plugin.version` is the implementation version; `ref.apiVersion` is the user-facing API contract version. Both are strict SemVer. Refs are frozen, branded, and carry an invariant phantom API type. `get(ref)` additionally requires the exact installed ref object, preventing a newly fabricated same-string ref from asserting a different API type.

`getById(string)` intentionally returns `unknown | null` for diagnostics. String lookup with a caller-supplied generic is not supported.

Setup must return a non-null object or function API. The Kernel never mutates `ImageEditor.prototype`.

## `PluginRef` versus `CapabilityToken`

| Contract                 | Purpose                                     | Consumer         |
| ------------------------ | ------------------------------------------- | ---------------- |
| `PluginRef<TApi>`        | Query an installed plugin's user-facing API | Host/application |
| `CapabilityToken<TPort>` | Request a minimal integration port          | Plugin setup     |

Both use frozen branded objects, but their brands and phantom types are distinct. A capability token cannot be passed to plugin lookup.

## Capability negotiation

A plugin declares requirements before setup:

```ts
const storageToken = createCapabilityToken<StoragePort>('company.example/storage', '1.4.0');

const consumer: EditorPlugin<ConsumerApi> = {
    ref: consumerRef,
    version: '1.0.0',
    requires: [{ token: storageToken, range: '^1.0.0' }],
    optional: [{ token: telemetryToken, range: '^2.0.0' }],
    setup(context) {
        const storage = context.capabilities.require(storageToken);
        const telemetry = context.capabilities.optional(telemetryToken);
        return createConsumerApi(storage, telemetry);
    },
};
```

All declared requirements are validated and resolved before `setup()` starts. Setup can read only the exact token objects declared by that plugin; undeclared access raises `PluginCapabilityError`.

Required policy:

- Missing provider: installation fails.
- Incompatible provider version: installation fails.
- Provisional/incomplete provider: installation fails.
- Invalid range: installation fails with a structured capability error and cause.

Optional policy:

- Missing provider: `null`, no warning.
- Compatible provider: the Port.
- Incompatible provider: `null` plus `OPTIONAL_CAPABILITY_INCOMPATIBLE` structured warning. The warning identifies consumer, token, requested range, installed version, provider, and that the optional integration was disabled.

Capability versions and ranges use the direct `semver` dependency. Prereleases use node-semver's default policy: stable ranges do not accidentally admit prereleases; a range must explicitly admit the relevant prerelease tuple.

Ordinary capability tokens have one provider. A second provider raises `CapabilityConflictError`; there is no implicit priority or last-write-wins. Repeating the same token, implementation, and provider inside one installation transaction is idempotent. Multi-provider capabilities are not implemented.

## Installation transaction

Every setup registration is enrolled in one `RegistrationScope`:

- capability providers;
- operations;
- tools;
- committed-event listeners;
- plugin-private state;
- custom `Disposable` cleanup;
- composed dependencies that are new to the current parent transaction.

Install sequence:

1. Validate branded ref, IDs, implementation/API SemVer, setup function, and duplicate policy.
2. Validate and resolve required/optional capabilities.
3. Create an open `RegistrationScope` and scoped setup context.
4. Await `setup()`.
5. Validate the returned API.
6. Commit provisional providers and atomically add the installed record.

Failure disposes registrations in reverse registration order, continues after cleanup failures, clears plugin state, and leaves no installed API or partial record. `PluginSetupError.cause` preserves the primary error and `cleanupErrors` preserves all rollback failures. Cleanup warnings do not replace the primary error.

Registration methods captured from setup reject after the scope commits, so a plugin cannot silently perform late registration.

## Direct `install` versus composed `ensure`

`manager.install(plugin)` is strict: any direct duplicate ID raises `PluginAlreadyInstalledError`.

`context.ensure(plugin)` is available only inside setup/composition:

- Missing dependency: install it.
- Same exact ref object, API version, and implementation version: reuse its API.
- Any mismatch: raise `PluginVersionMismatchError`.

`composePlugins` installs children in declaration order and requires an explicit `createApi` function, so the composite's returned API shape is visible and typed. If composition fails, every plugin newly installed through that composition—including nested dependencies—is rolled back in reverse order. Plugins that existed before the composition remain installed.

Rollback-only dependency handlers are discarded when the parent commits; normal host disposal is then owned by `PluginManager`, preventing double cleanup.

## Host state and lifecycle

The manager states are:

```text
created -> initializing -> initialized -> disposing -> disposed
```

- Plugins may be installed only in `created`.
- Concurrent top-level installation is rejected.
- `initialize()` is one-shot.
- `notifyImageLoaded` and `notifyImageCleared` require `initialized`.
- New lifecycle calls are rejected while disposing or after disposal.
- Runtime hot install and arbitrary uninstall are not implemented.

Ordering:

| Phase                | Order                                  |
| -------------------- | -------------------------------------- |
| `setup`              | installation order                     |
| `onInit`             | installation order                     |
| `onImageLoaded`      | installation order                     |
| `onImageCleared`     | installation order                     |
| `onDispose`          | reverse installation order             |
| registration cleanup | reverse registration order, per plugin |

An `onInit` failure makes initialization fail atomically: all installed plugins receive reverse-order disposal and every scope is cleaned. Image lifecycle failures identify plugin and phase. Disposal continues after plugin failures, reports them, completes cleanup, and finally raises `PluginAggregateError`. Repeated disposal is idempotent.

Phase 1 uses a standalone `PluginManager` host and contract harness rather than connecting it to the legacy Full Facade. This follows the implementation prompt's permitted low-risk path and avoids changing synchronous `init()`, `dispose()`, `disposeAsync()`, or current business lifecycle behavior.

## Plugin-private runtime state

`context.state` provides `has`, `get`, `set`, `delete`, and `clear` inside the current plugin ID namespace. Other plugins cannot name or access that namespace. State is cleared on failed setup and host disposal.

This store is transient runtime state only:

- it is not Snapshot state;
- it is not a State Slice registry;
- it is not History;
- it is not serialized;
- it does not store host configuration.

State Slice/Memento work remains Phase 2+.

## Operation Registry

Operation IDs are open strings. Definitions have `idle`, `busy`, or `animation` mode and may declare tool IDs. Registration is owner-scoped, rejects duplicate IDs, and returns a Disposable. `begin()` creates one owner-bound active token; reentrant or overlapping starts fail. Disposing a registration clears its active token. There is no Geometry, Memento, History, or rollback behavior in this registry.

## Tool Coordinator

Tool IDs are open strings. At most one tool is active. Entering a new tool awaits exit of the previous tool before entering the next. Failed enter leaves no active tool. Failed exit clears coordinator state, reports the structured error, and aborts the transition. Disposing an active tool registration exits it with `plugin-dispose`; host disposal uses `host-dispose`.

Operation policy is expressed only through operation IDs and `canRunOperation`; the coordinator has no Crop, Mosaic, Text, Draw, or other feature knowledge and stores no feature session.

## Committed EventBus

`CommittedEventBus` exposes `on(...)` and `emitCommitted(...)`. Its name is intentional: it is for already committed observations, logging, statistics, UI mirroring, and external subscription.

Listeners run in stable registration order for deterministic observation, but that order is not a state-consistency contract. Listener failures are isolated, reported through a structured warning, and do not stop remaining listeners. Listener registration is Disposable, and disposal removes all listeners. Emission after disposal fails.

The EventBus has no prepare/commit/rollback API and must not coordinate cross-plugin transactions.

## Errors and warnings

The internal entry exports structured errors for duplicate/missing plugins, invalid definitions, capability failures/conflicts, setup, lifecycle, operation registration/conflicts, tool registration/transitions, version mismatch, disposal state, and aggregated cleanup. Every wrapper retains the original `cause`; setup/lifecycle cleanup errors are retained separately.

Warnings are structured payloads rather than preformatted strings only. Reporter exceptions are isolated and cannot replace the Kernel failure being reported.

## Explicit Phase 1 non-goals

- No Core Memento or rollback service.
- No State Slice/Object Property registry.
- No Geometry Mutation Coordinator or participants.
- No real Transform, Mask, Crop, Mosaic, Filter, History, Annotation, Overlay, DOM, or preset plugin.
- No Snapshot or overlay-state changes.
- No package subpath exports, per-plugin bundles, or independent UMD entries.
- No public `ImageEditor.use()` yet.
