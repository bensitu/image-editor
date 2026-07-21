# Migration from 2.x

The 3.0 candidate is a breaking major release. The former monolithic
`ImageEditor` facade is replaced by `ImageEditorCore`, public Feature Plugins,
and typed Presets. Existing applications can migrate incrementally, but must not
expect old source code or Snapshots to load automatically.

The maintained 2.9 baseline is the published `legacy/v2` branch. See the
[2.x maintenance policy](./v2-maintenance-policy.md).

## Choose a composition

Use a Preset when it matches the product. Use Core + Plugins when bundle size or
custom installation matters.

Before:

```ts
import * as fabric from 'fabric';
import { ImageEditor } from '@bensitu/image-editor';

const editor = new ImageEditor(fabric, {
    canvasWidth: 800,
    canvasHeight: 600,
    animationDuration: 0,
    maxHistorySize: 50,
    defaultMaskWidth: 160,
    defaultMaskHeight: 96,
});

await editor.init({ canvas: 'canvas', canvasContainer: 'container' });
await editor.loadImage(source);
await editor.rotateImage(90);
```

After, with a Preset:

```ts
import * as fabric from 'fabric';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';

const kit = createRedactionPreset(fabric, {
    core: { canvasWidth: 800, canvasHeight: 600 },
    transform: { animationDuration: 0 },
    history: { maxSize: 50 },
    masks: { defaultWidth: 160, defaultHeight: 96 },
});

await kit.editor.init({ canvas: 'canvas', canvasContainer: 'container' });
await kit.editor.loadImage(source);
await kit.transform.rotate(90);
await kit.editor.disposeAsync();
```

After, with direct composition:

```ts
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';

const editor = new ImageEditorCore(fabric, { canvasWidth: 800, canvasHeight: 600 });
const [transform, history] = editor.install([
    transformPlugin({ animationDuration: 0 }),
    historyPlugin({ maxSize: 50 }),
]);

await editor.init({ canvas: 'canvas', canvasContainer: 'container' });
await transform.rotate(90);
await history.undo();
```

All Plugins must be installed before `init()`. Feature APIs are returned by
installation; they are not added as methods on Core.

## Split constructor options

Flat options move to their owning module:

| Older option group                                   | Current owner                          |
| ---------------------------------------------------- | -------------------------------------- |
| canvas/layout, resource limits, export, diagnostics  | `core` / `ImageEditorCoreOptions`      |
| animation, min/max scale, scale and rotation steps   | `transform`                            |
| history enabled/max size/change listener             | `history`                              |
| mask defaults, labels, list order, transform binding | `masks`                                |
| filter count                                         | `filters`                              |
| crop padding/minimums                                | `crop`                                 |
| Mosaic brush/block/output/point limits               | `mosaic`                               |
| annotation defaults                                  | `annotations`, `text`, `shape`, `draw` |

`onError` and `onWarning` remain Core diagnostics. Feature change
callbacks become Plugin subscriptions (`history.onChange`, `filters.subscribe`,
`annotations.subscribe`, and session subscriptions). Image lifecycle and
committed document events are Core/Plugin lifecycle contracts, not a flat list
of facade callbacks.

## DOM ElementMap

Core `init()` accepts only Core-owned elements:

```ts
await editor.init({
    canvas: 'canvas',
    canvasContainer: 'container',
    imagePlaceholder: 'placeholder',
});
```

Button, input, list, and keyboard bindings move to the optional
`@bensitu/image-editor/plugins/dom-controls` entry. Framework applications
should normally call Plugin APIs from their own event handlers. DOM Controls
requires explicit `PluginRef`/resolver bindings, and Presets do not install it
unless a `domControls` factory is supplied.

## Method mapping

| Older facade call                            | Current API                                              |
| -------------------------------------------- | -------------------------------------------------------- |
| `editor.scaleImage(factor)`                  | `transform.scale(factor)`                                |
| `editor.rotateImage(degrees)`                | `transform.rotate(degrees)`                              |
| `editor.flipHorizontal()` / `flipVertical()` | `transform.flipHorizontal()` / `flipVertical()`          |
| `editor.resetImageTransform()`               | `transform.resetImageTransform()`                        |
| `editor.undo()` / `redo()`                   | `history.undo()` / `redo()`                              |
| `editor.createMask(config)`                  | `masks.create(config)`                                   |
| `editor.getMasks()`                          | `masks.getAll()`                                         |
| `editor.removeSelectedMask()`                | `masks.removeSelected()`                                 |
| `editor.removeAllMasks()`                    | `masks.removeAll()`                                      |
| `editor.mergeMasks()`                        | `masks.flatten()`                                        |
| filter preview/commit/reset methods          | `filters.preview/commit/cancelPreview/clear/bake`        |
| Crop mode methods                            | `crop.enter/updateRect/setAspectRatio/apply/cancel`      |
| Mosaic mode and brush methods                | `mosaic.enter/beginStroke/appendStroke/endStroke/commit` |
| annotation list/update/remove/layer methods  | Annotation Foundation API                                |
| Text create/edit methods                     | Text Plugin API                                          |
| Shape create/session methods                 | Shape Plugin API                                         |
| Draw/Eraser mode methods                     | Draw Plugin API                                          |
| overlay-state export/validate/import         | `overlayState.exportState/validate/importState`          |
| `editor.saveState()` / `loadFromState()`     | same Core methods, but current Snapshot schema only      |
| image load/info/export/dispose               | same responsibilities on `kit.editor` / Core             |

Crop and Mosaic previews remain transient. Their committed raster output is
represented by the current Base Image. Text, Shape, Draw, Mask, and custom
persistent objects use Overlay/Annotation Codecs rather than facade-owned Fabric
metadata.

## History behavior

History is now an installed provider. It records successful document,
geometry, raster, and Overlay transactions; failed or cancelled work creates no
entry. Disable recording with `await history.disable()`. Re-enable it with
`await history.enable({ baseline: 'current' })`; earlier preparation is not
undoable. There is no fallback hidden history manager when the Plugin is absent.

## Snapshot detection and conversion

Core accepts `image-editor.state@3`. It rejects recognizable unsupported
Snapshot schemas with `SnapshotVersionUnsupportedError` and a migration-entry
hint. It never loads or converts older data silently.

```ts
import {
    detectSnapshotVersion,
    loadV2Snapshot,
    migrateV2Snapshot,
    v2SnapshotMigration,
} from '@bensitu/image-editor/migrate-v2';

const detection = detectSnapshotVersion(olderSnapshot);

if (detection.kind === 'source') {
    const currentSnapshot = migrateV2Snapshot(olderSnapshot);
    await editor.loadFromState(currentSnapshot);
}

// Equivalent public convenience path:
await loadV2Snapshot(editor, olderSnapshot);

// Or use the generic Core hook explicitly:
await editor.loadFromState(olderSnapshot, {
    migrations: [v2SnapshotMigration()],
});
```

Conversion is strict by default. Supported frozen data includes Core image
state, Transform, committed Filters, Masks, Text/Shape/Draw annotations, and
persistent Overlay order/metadata. Enabled/disabled History records, active
selection, active Crop/Mosaic/annotation sessions, previews, labels, controls,
and other transient runtime objects are intentionally not migrated. A committed
Crop or Mosaic is already part of the raster Base Image.

An unsupported persisted field rejects instead of disappearing. Applications
that deliberately accept a lossy conversion must opt in and record warnings:

```ts
import type { SnapshotMigrationWarning } from '@bensitu/image-editor/migrate-v2';

const warnings: SnapshotMigrationWarning[] = [];
const currentSnapshot = migrateV2Snapshot(olderSnapshot, {
    unsupportedFieldPolicy: 'warn-and-skip',
    onWarning: (warning) => warnings.push(warning),
});
```

Input bytes, nesting, object count, canvas dimensions/pixels, URLs, dangerous
keys, and payload shapes are bounded. Conversion is deterministic and does not
mutate its input. Core revalidates the result before any canvas mutation and
rolls back a failed restore.

The migration entry is isolated from root/Core/Plugin/Preset bundles. It imports
no frozen runtime, Fabric constructors, DOM Controls, or Preset composition.

## Codemod workflow

Run the separate package against a clean Git branch:

```bash
npx @bensitu/image-editor-codemod v2-to-v3 src --dry-run --report codemod-report.json
npx @bensitu/image-editor-codemod v2-to-v3 src --diff
npx @bensitu/image-editor-codemod v2-to-v3 src --write --report codemod-report.json
```

`--write` is the default and applies safe edits atomically. `--dry-run` reports
without writing; `--diff` prints changes without writing. Exit code `1` means a
read-only mode found safe changes. Exit code `2` means unresolved manual work
remains. Exit code `64` is invalid CLI usage.

The Codemod handles common static imports, constructor/options splitting,
Core/Full selection, ElementMap extraction, common Transform/History/Mask calls,
Core load/export/dispose calls, and Snapshot load conversion. It deliberately
does not rewrite dynamic imports, aliased/runtime constructors, subclasses,
reflection, spread-heavy options, unsupported callbacks, mixed package
versions, or non-Core DOM maps. Those findings remain unchanged and appear with
file/line/column/code/message in the JSON report.

Review unresolved findings, edit manually, rerun `--dry-run`, and require both
zero unresolved findings and idempotency before merging.

## Framework migration

React, Vue, and client-only SSR integrations should retain the complete Preset
result or individual Plugin API refs in component state/refs. Create one
composition in the client lifecycle, await `init()`, and call
`disposeAsync()` during cleanup. Do not mount DOM Controls merely to bridge
framework events. See [React](./frameworks/react.md), [Vue](./frameworks/vue.md),
and [SSR](./frameworks/ssr.md).

## Bundle and UMD migration

Bundled applications should replace root Feature imports with formal subpaths.
The root stays Core-only; choosing a Preset intentionally includes its Features.
Import `migrate-v2` only in the migration path, and remove it from normal startup
after stored data has been converted.

Script-tag applications replace the old global facade with Fabric plus the one
Full Preset UMD:

```html
<script src="https://cdn.jsdelivr.net/npm/fabric@7/dist/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor/dist/umd/image-editor.full.umd.min.js"></script>
<script>
    (async () => {
        const kit = ImageEditorFull.createFullPreset(fabric, {
            transform: { animationDuration: 0 },
        });
        await kit.editor.init({ canvas: 'canvas', canvasContainer: 'container' });
    })().catch(console.error);
</script>
```

Fabric remains an external global. `ImageEditorFull` exposes the current Full
composition and official factories, not a compatibility facade. DOM Controls is
absent unless passed explicitly. There are no per-Plugin UMD files.

## Unsupported APIs

Private controllers/managers, compatibility modules, direct Canvas mutation,
facade subclasses, reflection over facade methods, implicit Fabric discovery,
and arbitrary old Snapshot shapes have no supported automatic conversion.
Replace them with public Core/SDK/Feature contracts or keep the application on
the maintained 2.9 line while completing manual work.
