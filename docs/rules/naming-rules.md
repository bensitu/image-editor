# Naming Rules

Naming conventions for the TypeScript codebase.  
Names should describe the current responsibility and domain meaning. Treat the codebase as a new product implementation.

## 1. Core principles

- Use clear, responsibility-based names.
- Prefer full words over unclear abbreviations.
- Keep names consistent with nearby modules.
- Avoid vague names such as `data`, `info`, `obj`, `temp`, `process`, `handle`, `manager`, `helper`, or `utils` when a more precise name exists.
- Do not use version or history terms in active code names:
    - `v2`
    - `v2.9`
    - `v3`
    - `legacy`
    - `compat`
    - `compatibility`
    - `old`
    - `new`
- Keep external naming styles only at external boundaries.

## 2. Case conventions

| Target                         | Convention                 | Example                   |
| ------------------------------ | -------------------------- | ------------------------- |
| Variables and properties       | `camelCase`                | `pluginManifest`          |
| Functions and methods          | `camelCase`                | `installPluginPlan()`     |
| Classes, interfaces, and types | `PascalCase`               | `PluginManifest`          |
| Generic type parameters        | `PascalCase`               | `TApi`, `TOptions`        |
| True global constants          | `UPPER_SNAKE_CASE`         | `MAX_PLUGIN_COUNT`        |
| Files and directories          | `kebab-case`               | `plugin-manifest.ts`      |
| Test files                     | `kebab-case` + test suffix | `plugin-manifest.test.ts` |

Do not prefix interfaces with `I`.

```ts
interface PluginManifest {}
```

Do not add redundant suffixes such as `Type`, `Interface`, or `Alias`.

## 3. Domain object constants

Use `UPPER_SNAKE_CASE` only for fixed global values, limits, and static maps.

```ts
const MAX_PLUGIN_COUNT = 128;
const DEFAULT_SETUP_TIMEOUT_MS = 5_000;
const SUPPORTED_PERMISSIONS = {} as const;
```

Use `camelCase` for immutable domain objects.

```ts
const maskPluginRef = definePluginRef(...);
const overlayCapability = createCapabilityToken(...);
const historyPlugin = definePlugin(...);
```

Do not uppercase every module-level `const`.

## 4. Boolean names

Boolean state should use a positive form.

```ts
isInstalled;
hasProvider;
canInstall;
shouldRollback;
requiresPermission;
supportsPersistence;
```

Configuration objects may use concise positive names when the context is clear.

```ts
{
    enabled: true,
    allowGlobalMutation: false,
}
```

Command methods may use explicit verbs.

```ts
enable();
disable();
cancel();
abort();
```

Avoid double negatives such as `isNotReady` or `disableRollback`.

## 5. Collections and keyed structures

| Structure         | Pattern     | Example              |
| ----------------- | ----------- | -------------------- |
| Array or iterable | plural noun | `plugins`            |
| Record by key     | `xxxByYyy`  | `pluginById`         |
| `Map`             | `xxxMap`    | `capabilityMap`      |
| `Set`             | `xxxSet`    | `installedPluginSet` |
| Count             | `xxxCount`  | `pluginCount`        |
| Index             | `xxxIndex`  | `topologicalIndex`   |

## 6. Function and method verbs

Use verbs that clearly describe behavior.

| Prefix         | Meaning                                | Example                   |
| -------------- | -------------------------------------- | ------------------------- |
| `getXxx`       | Pure read                              | `getPlugin()`             |
| `setXxx`       | Direct replacement                     | `setConfiguration()`      |
| `updateXxx`    | Modify existing state                  | `updatePluginState()`     |
| `createXxx`    | Create a value or object               | `createPluginHost()`      |
| `defineXxx`    | Declare an immutable contract          | `definePlugin()`          |
| `buildXxx`     | Assemble a complex value               | `buildDependencyGraph()`  |
| `resolveXxx`   | Resolve from dependencies or fallbacks | `resolveCapability()`     |
| `validateXxx`  | Validate input                         | `validateManifest()`      |
| `registerXxx`  | Register and return cleanup ownership  | `registerCapability()`    |
| `provideXxx`   | Provide an implementation              | `provideCapability()`     |
| `requireXxx`   | Return a required value or throw       | `requirePlugin()`         |
| `installXxx`   | Install and establish lifecycle        | `installPluginPlan()`     |
| `configureXxx` | Apply validated configuration          | `configurePlugin()`       |
| `composeXxx`   | Combine while preserving members       | `composePlugins()`        |
| `flattenXxx`   | Flatten a nested structure             | `flattenPluginPlan()`     |
| `beginXxx`     | Start a transaction or scope           | `beginSetupTransaction()` |
| `commitXxx`    | Commit a transaction                   | `commitInstallation()`    |
| `rollbackXxx`  | Roll back a transaction                | `rollbackInstallation()`  |
| `disposeXxx`   | Release owned resources                | `disposePluginScope()`    |
| `emitXxx`      | Dispatch an internal event             | `emitPluginInstalled()`   |
| `publishXxx`   | Publish a committed event              | `publishCommittedEvent()` |

Avoid vague names such as `processData()`, `handleData()`, or `manageState()`.

## 7. Architecture role suffixes

Use role suffixes only when they accurately describe the responsibility.

| Suffix        | Responsibility                               |
| ------------- | -------------------------------------------- |
| `Registry`    | Registration, lookup, and conflict detection |
| `Coordinator` | Multi-participant ordering and rollback      |
| `Router`      | Dispatch by type or ownership                |
| `Store`       | State storage and retrieval                  |
| `Controller`  | Behavior boundary for one domain             |
| `Adapter`     | Conversion between two explicit interfaces   |
| `Codec`       | Serialize, validate, and deserialize         |
| `Resolver`    | Resolve from multiple sources                |
| `Validator`   | Centralized validation                       |
| `Reporter`    | Structured diagnostics or errors             |
| `Scope`       | Bounded resource ownership and disposal      |
| `Plan`        | Declarative composition without execution    |
| `Definition`  | Immutable declaration                        |
| `Requirement` | Consumer dependency declaration              |

Do not use `Manager`, `Service`, `Helper`, or `Utils` as generic fallback names.

## 8. Events, callbacks, and errors

```ts
handleUploadChange(); // internal event handler
onImageLoad; // public callback
emitImageLoad(); // internal dispatch
addSelectionChangeListener();
removeSelectionChangeListener();
```

Use:

- `isXxx` for type guards
- `assertXxx` for throwing assertions
- `XxxError` for custom errors

```ts
function isPluginManifest(value: unknown): value is PluginManifest {}
function assertPluginInstalled(value: unknown): asserts value is InstalledPlugin {}
class PluginSetupError extends Error {}
```

## 9. Units and measurements

Include units when a number could be ambiguous.

```ts
timeoutMs;
durationSeconds;
widthPx;
scaleRatio;
rotationDegrees;
pluginCount;
dependencyIndex;
sourceBytes;
decodedPixelCount;
```

## 10. Runtime string identifiers

Plugin, capability, permission, operation, event, and overlay identifiers should use:

```text
namespace:kebab-case
```

Examples:

```text
fabric:canvas-read
core:raster-mutation
editor:document-commit
overlay:selection-change
```

Rules:

- lowercase only;
- use `:` between namespace and name;
- use `kebab-case` inside the name;
- do not include version labels;
- keep API versions in separate fields.

## 11. Files, modules, and tests

Use `kebab-case` for files and directories.

```text
plugin-manifest.ts
dependency-graph.ts
capability-registry.ts
plugin-installation/
```

Avoid vague module names:

```text
utils.ts
helpers.ts
common.ts
misc.ts
```

Prefer responsibility-based names:

```text
manifest-validation.ts
dependency-ordering.ts
capability-versioning.ts
```

Supported test naming patterns:

```text
plugin-manifest.test.ts
plugin-installation.test.mjs
plugin-conformance.spec.ts
plugin-api.test-d.ts
```

Test files should mirror the module or contract they verify.

## 12. External boundaries

External APIs, generated code, JSON contracts, CSS classes, and framework-required names may use external naming styles.

Convert them to internal naming as early as possible.

```ts
interface RawPluginPayload {
    plugin_id: string;
    api_version: string;
}

interface PluginPayload {
    pluginId: string;
    apiVersion: string;
}
```

## 13. Scope

Apply these rules to:

- new files and symbols;
- materially changed files and symbols;
- public APIs;
- tests and examples;
- generated contract identifiers.

Do not perform unrelated repository-wide renaming.

When an existing public name must be retained, document the exception and keep it narrow.
