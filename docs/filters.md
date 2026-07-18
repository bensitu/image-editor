# Filters Plugin

The Filters Plugin provides validated, non-destructive image filters for `ImageEditorCore`.
Install it before `editor.init()` through its dedicated package entry:

```ts
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { filtersPlugin, type FilterDefinition } from '@bensitu/image-editor/plugins/filters';

const editor = new ImageEditorCore(fabric);
const filters = editor.use(filtersPlugin());

await editor.init({ canvas: 'canvas' });
await editor.loadImage(source);
```

The public definition union supports these filter types:

| Type       | Definition                      | Accepted range |
| ---------- | ------------------------------- | -------------- |
| Brightness | `{ type: 'brightness', value }` | `-1` to `1`    |
| Contrast   | `{ type: 'contrast', value }`   | `-1` to `1`    |
| Saturation | `{ type: 'saturation', value }` | `-1` to `1`    |
| Grayscale  | `{ type: 'grayscale' }`         | No value       |
| Sepia      | `{ type: 'sepia' }`             | No value       |
| Vintage    | `{ type: 'vintage' }`           | No value       |
| Blur       | `{ type: 'blur', value }`       | `0` to `1`     |
| Sharpen    | `{ type: 'sharpen', value }`    | `0` to `1`     |

Definitions are strictly validated and normalized into a stable order. Unknown types or keys,
duplicate types, non-finite values, unsupported ranges, and prototype-pollution keys are rejected.
Numeric definitions with a value of zero are neutral and are omitted. Inputs are never mutated.

## Preview and commit

`preview()` displays temporary filter output without changing the committed State Slice, Snapshot,
History, committed document events, or normal export. A newer preview replaces an older pending
preview, so a late result cannot overwrite the latest request.

```ts
const definitions = [
    { type: 'brightness', value: 0.15 },
    { type: 'contrast', value: 0.1 },
] as const satisfies readonly FilterDefinition[];

await filters.preview(definitions);
await filters.commit(); // Commits the active preview.
```

`commit(definitions)` validates and commits explicit definitions without requiring a preview.
`commit()` commits the active preview and throws `FiltersPreviewMissingError` when no preview exists.
`cancelPreview()` restores the exact committed rendering. `clear()` cancels a preview and removes
all committed filters without replacing the Base Image.

Changed commits and clears use one document transaction. With the History Plugin enabled, each
creates one undo record; a no-op creates none. With History disabled, the operation still has Core
rollback protection but creates no History record. Undo and redo restore both definitions and the
rendered result.

## State, Snapshot, and export

`getState()` returns an immutable committed state containing a schema identifier, data version, and
normalized definitions. Fabric objects, live filter instances, configuration, listeners, and
preview data are excluded. Core Snapshots therefore persist committed filters only. Normal missing
Plugin policies apply when a Snapshot containing the Filters Slice is restored without the Plugin.

Normal Core export includes committed filters and excludes preview output. Export works on the
export canvas, leaves the live document unchanged, and creates no History record or committed event.

## Bake

`bake()` explicitly writes the committed result into new Base Image pixels and clears the committed
filter definitions. Ordinary `commit()` remains non-destructive.

```ts
await filters.commit([{ type: 'sepia' }]);
await filters.bake({ format: 'webp', quality: 0.85 });
```

Supported formats are `png`, `jpeg`, and `webp`; quality, when supplied, must be from `0` to `1`.
Bake is one compound raster transaction, preserves Geometry, Overlay, and Mask state, and creates
one History record when recording is enabled. A failed bake rolls the document back.

Bake uses the active Core image policy. Output is checked against `maxInputBytes`, `maxInputPixels`,
`maxExportPixels`, `maxExportDimension`, and `imageLoadTimeoutMs`; the Plugin cannot increase or
bypass those limits.

## Configuration and headless use

`maxFilterCount` defaults to eight and may be lowered to constrain an application further. It cannot
exceed the supported definition count or be lowered below the currently active count.

```ts
const filters = editor.use(filtersPlugin({ maxFilterCount: 4 }));

await filters.configure({ maxFilterCount: 3 });
console.log(filters.getConfiguration());
```

Configuration is runtime policy and is not stored in Snapshots. The Plugin API requires no DOM
elements and can run in a headless environment whenever the supplied Fabric runtime and Core canvas
support image cloning, filter application, and raster encoding.
