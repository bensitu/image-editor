# Options Reference

ImageEditor 3 separates Core configuration from Feature Plugin configuration.
Pass only `ImageEditorCoreOptions` to `ImageEditorCore`; when using a Preset,
place those options under `core` and configure each Feature in its own
namespace.

```ts
import * as fabric from 'fabric';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';

const kit = createRedactionPreset(fabric, {
    core: {
        canvasWidth: 960,
        canvasHeight: 640,
        defaultLayoutMode: 'fit',
        maxInputPixels: 32_000_000,
    },
    transform: { animationDuration: 0 },
    history: { maxSize: 25 },
    masks: { defaultWidth: 160, bindToImageTransform: true },
    crop: { paddingPx: 12 },
});
```

## Core options

`ImageEditorCoreOptions` is exported by `@bensitu/image-editor/core` and by the
package root.

| Option               |      Default | Normalization and behavior                                                                                                                                                 |
| -------------------- | -----------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canvasWidth`        |        `800` | Initial and hidden-container fallback width. A finite value greater than zero is accepted; otherwise the default is used.                                                  |
| `canvasHeight`       |        `600` | Initial and hidden-container fallback height. A finite value greater than zero is accepted; otherwise the default is used.                                                 |
| `backgroundColor`    |  `'#ffffff'` | Fabric canvas background. `null` or `undefined` uses the default; other strings are preserved.                                                                             |
| `defaultLayoutMode`  |   `'expand'` | Initial image layout. Valid values are `'fit'`, `'cover'`, and `'expand'`; an invalid constructor value uses `'expand'`. Runtime `setLayoutMode()` rejects invalid values. |
| `groupSelection`     |       `true` | Enables Fabric multi-object selection. `null` or `undefined` uses the default.                                                                                             |
| `maxInputBytes`      | `33,554,432` | Maximum encoded file bytes or decoded Data URL bytes. Must be a positive safe integer.                                                                                     |
| `maxInputPixels`     | `67,108,864` | Maximum decoded image pixels. Must be a positive safe integer.                                                                                                             |
| `imageLoadTimeoutMs` |     `30,000` | Decode and Fabric image-creation timeout. Must be a positive safe integer.                                                                                                 |
| `maxExportPixels`    | `67,108,864` | Maximum raster output pixels after the multiplier. Must be a positive safe integer.                                                                                        |
| `maxExportDimension` |     `16,384` | Maximum width or height of an allocated output canvas. Must be a positive safe integer.                                                                                    |
| `exportMultiplier`   |          `1` | Default export scale. A finite value greater than zero is accepted.                                                                                                        |
| `initialImageBase64` |         `''` | Optional PNG, JPEG, or WebP Data URL loaded as part of `init()`.                                                                                                           |
| `onError`            |        unset | Receives contained operation and lifecycle errors as `(error, message)`. A throwing callback is isolated.                                                                  |
| `onWarning`          |        unset | Receives non-fatal diagnostics as `(error, message)`. A throwing callback is isolated.                                                                                     |

Core owns canvas initialization and lifecycle, image loading and resource
policy, layout, snapshot load/save, raster export, and diagnostics. Transform,
history, masks, filters, crop, mosaic, annotations, overlay state, and DOM
bindings are Plugin responsibilities and are intentionally absent from the
Core table.

### Initial image Promise semantics

`initialImageBase64` is loaded inside `init()`. The initialization Promise does
not resolve, and Plugin `onInitialized` hooks do not run, until that image has
loaded successfully. A decode, timeout, or policy failure rejects `init()`,
rolls back initialized resources and Plugins, and leaves the Core retryable.

```ts
import * as fabric from 'fabric';
import { ImageEditorCore } from '@bensitu/image-editor/core';

const editor = new ImageEditorCore(fabric, { initialImageBase64: source });
await editor.init({ canvas: 'canvas', canvasContainer: 'container' });
// The initial image is now loaded and visible.
```

### Shared raster resource policy

The input byte/pixel limits and export dimension/pixel limits form one resource
policy. It is applied before decode when encoded metadata is available and
again before browser canvas allocation. Snapshot restore, Plugin raster
commits, Crop/Mosaic/Filter bakes, and Overlay/Annotation flatten operations use
the same effective limits; they cannot bypass the load/export budget by
constructing state directly.

The single-side limit (`maxExportDimension`) applies even when total pixels are
below `maxExportPixels`, because browser canvases also have independent width
and height constraints.

## Direct Plugin composition

Install Plugins before `init()`. `composePlugins()` preserves named API results
without adding Feature methods to Core.

```ts
import * as fabric from 'fabric';
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';
import { composePlugins } from '@bensitu/image-editor/sdk';

const editor = new ImageEditorCore(fabric, { defaultLayoutMode: 'fit' });
const { transform, history, masks } = editor.install(
    composePlugins({
        transform: transformPlugin({ animationDuration: 0 }),
        history: historyPlugin({ maxSize: 25 }),
        overlays: overlayFoundationPlugin(),
        masks: maskPlugin({ defaultWidth: 160, bindToImageTransform: true }),
    }),
);

await editor.init({ canvas: 'canvas', canvasContainer: 'container' });
await transform.rotate(90);
await masks.create();
await history.undo();
await editor.disposeAsync();
```

## Preset namespaces

Preset options mirror their installed Feature set:

- `core`: `ImageEditorCoreOptions`
- `transform`: `TransformPluginOptions`
- `history`: `HistoryPluginOptions`
- `masks`: `MaskPluginOptions`
- `filters`: `FiltersPluginOptions`
- `crop`: `CropPluginOptions`
- `mosaic`: `MosaicPluginOptions`
- `annotations`: `AnnotationFoundationOptions`
- `text`: `TextAnnotationPluginOptions`
- `shape`: `ShapeAnnotationPluginOptions`
- `draw`: `DrawAnnotationPluginOptions`
- `overlayState`: `OverlayStatePluginOptions`
- `domControls`: an explicit DOM Controls factory

Only namespaces supported by the selected Preset are accepted. See
[Typed Presets](./presets.md) for the Minimal, Redaction, Annotation, and Full
compositions.

## Feature references

- [Transform and Core API](./api.md)
- [History](./history.md)
- [Masks and transform binding](./overlay-transform-binding.md)
- [Filters](./filters.md)
- [Crop](./crop.md)
- [Mosaic](./mosaic.md)
- [Annotations](./annotations.md)
- [Text](./annotation-text.md)
- [Shape](./annotation-shape.md)
- [Draw and Eraser](./annotation-draw.md)
- [Overlay State](./overlay-state.md)
- [DOM Controls](./dom-controls.md)

All public import paths above correspond to `package.json#exports`. For older
flat constructor options and facade methods, use the
[2.x migration guide](./migration-from-v2.md).
