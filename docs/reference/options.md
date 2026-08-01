# Options Reference

The modular architecture separates Core configuration from Feature Plugin configuration.
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

| Option               |         Default | Normalization and behavior                                                                                                                                                 |
| -------------------- | --------------: | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `canvasWidth`        |           `800` | Initial and hidden-container fallback width. A finite value greater than zero is accepted; otherwise the default is used.                                                  |
| `canvasHeight`       |           `600` | Initial and hidden-container fallback height. A finite value greater than zero is accepted; otherwise the default is used.                                                 |
| `backgroundColor`    | `'transparent'` | Fabric canvas background. `null` or `undefined` uses the default; other strings are preserved.                                                                             |
| `defaultLayoutMode`  |      `'expand'` | Initial image layout. Valid values are `'fit'`, `'cover'`, and `'expand'`; an invalid constructor value uses `'expand'`. Runtime `setLayoutMode()` rejects invalid values. |
| `imagePreprocessing` |       see below | Bounded downsampling, JPEG EXIF orientation normalization, and output encoding policy.                                                                                     |
| `groupSelection`     |          `true` | Enables Fabric multi-object selection. `null` or `undefined` uses the default.                                                                                             |
| `maxInputBytes`      |    `33,554,432` | Maximum encoded file bytes or decoded Data URL bytes. Must be a positive safe integer.                                                                                     |
| `maxInputPixels`     |    `67,108,864` | Maximum decoded image pixels. Must be a positive safe integer.                                                                                                             |
| `imageLoadTimeoutMs` |        `30,000` | Decode and Fabric image-creation timeout. Must be a positive safe integer.                                                                                                 |
| `maxExportPixels`    |    `67,108,864` | Maximum raster output pixels after the multiplier. Must be a positive safe integer.                                                                                        |
| `maxExportDimension` |        `16,384` | Maximum width or height of an allocated output canvas. Must be a positive safe integer.                                                                                    |
| `exportMultiplier`   |             `1` | Default export scale. A finite value greater than zero is accepted.                                                                                                        |
| `exportDefaults`     |       see below | Default area, format, quality, multiplier, file name, and contributor options merged into each export call.                                                                |
| `initialImageBase64` |            `''` | Optional PNG, JPEG, or WebP Data URL loaded as part of `init()`.                                                                                                           |
| `onError`            |           unset | Receives contained operation and lifecycle errors as `(error, message)`. A throwing callback is isolated.                                                                  |
| `onWarning`          |           unset | Receives non-fatal diagnostics as `(error, message)`. A throwing callback is isolated.                                                                                     |

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

### Image preprocessing

`imagePreprocessing` supplies constructor defaults, and
`loadImage(source, { preprocessing })` or `loadImageFile(file, { preprocessing })`
can override them for one load.

| Option                     | Default | Behavior                                                                                      |
| -------------------------- | ------: | --------------------------------------------------------------------------------------------- |
| `downsample`               |  `true` | Reduces an image only when an oriented dimension exceeds its configured maximum.              |
| `maxWidth`                 |  `4000` | Maximum oriented width retained by preprocessing.                                             |
| `maxHeight`                |  `3000` | Maximum oriented height retained by preprocessing.                                            |
| `quality`                  |  `0.92` | JPEG/WebP encoding quality from `0` through `1`.                                              |
| `format`                   |  `null` | Explicit `image/jpeg`, `image/png`, or `image/webp` output; `null` uses source-format policy. |
| `preserveSourceFormat`     |  `true` | Keeps the source MIME type when `format` is `null`; `false` uses JPEG.                        |
| `normalizeExifOrientation` |  `true` | Parses JPEG EXIF orientation and rewrites pixels into display orientation.                    |

The input byte and hard raster budgets are checked before allocation. Downsampling
therefore reduces ordinary large images within those safety limits; it does not make
malformed dimensions or pixel bombs acceptable.

### Export defaults

`exportDefaults` accepts the same fields as `CoreExportOptions`: `area`, `format`,
`quality`, `multiplier`, `fileName`, and `contributors`. Per-call values override
constructor defaults. The contributor map is shallow-merged by contributor ID, so a per-call
value replaces that contributor's default option object. Defaults are
`area: 'image'`, `format: 'png'`, `quality: 0.92`, `multiplier: 1`, and
`fileName: 'edited_image'`.

`exportImageFile()` returns a `File` and does not trigger browser navigation or a DOM
download. Hosts can upload, store, inspect, or download that file with their preferred
UI policy; a separate direct-download method is intentionally unnecessary.

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

### Overlay list ordering

`masks.listOrder` controls `masks.getAll()` and Mask change-callback order;
`annotations.listOrder` controls `annotations.list()`. Both accept `front-to-back` (the default,
topmost first) or `back-to-front` (Fabric Canvas bottom-to-top order). These display/API ordering
options do not move Canvas objects or change persistent layer indices.

### Overlay export participation

`masks.exportByDefault` and `annotations.exportByDefault` default to `true`. Set either value to
`false` when the host wants those objects available for editing and state persistence but omitted
from ordinary exports. Explicit `includeKinds` values on an export call override the registered
default, while `excludeKinds` always excludes a matching kind.

```ts
const editor = new ImageEditorCore(fabric, {
    exportDefaults: { fileName: 'reviewed-image', area: 'image' },
});
editor.use(maskPlugin({ exportByDefault: false }));

const file = await editor.exportImageFile({
    contributors: {
        'foundation:overlay': { includeKinds: ['mask:object'] },
    },
});
```

`exportDefaults.area` is the constructor-level export-area policy and
`exportDefaults.fileName` is the default name used by `exportImageFile()`. Separate aliases are not
needed because per-call export values already override these defaults predictably.

## Feature references

- [Transform and Core API](./api.md)
- [History](../plugins/history.md)
- [Masks and transform binding](../plugins/overlay-transform-binding.md)
- [Filters](../plugins/filters.md)
- [Crop](../plugins/crop.md)
- [Mosaic](../plugins/mosaic.md)
- [Annotations](../plugins/annotations.md)
- [Text](../plugins/annotation-text.md)
- [Shape](../plugins/annotation-shape.md)
- [Draw and Eraser](../plugins/annotation-draw.md)
- [Overlay State](../plugins/overlay-state.md)
- [DOM Controls](../plugins/dom-controls.md)

All public import paths above correspond to `package.json#exports`. For Facade
constructor options and methods, use the
[facade migration guide](../guides/migration-from-v2.md).
