# Mosaic Plugin

The Mosaic Plugin provides DOM-independent, pixelated brush sessions for `ImageEditorCore`. Install
it before `editor.init()` from its dedicated package entry. The Plugin is not exported from the
package root.

```ts
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { mosaicPlugin } from '@bensitu/image-editor/plugins/mosaic';

const editor = new ImageEditorCore(fabric);
const mosaic = editor.use(
    mosaicPlugin({
        brushSizePx: 24,
        pixelBlockSizePx: 8,
    }),
);

await editor.init({ canvas: 'canvas' });
await editor.loadImage(source);
```

## Coordinates, brushes, and sessions

Brush points use natural image pixels as `{ xPx, yPx }`, independently of canvas zoom, viewport
transforms, and device pixel ratio. A session can contain multiple strokes:

```ts
await mosaic.enter();

await mosaic.beginStroke({ xPx: 40, yPx: 50 });
await mosaic.appendStroke({ xPx: 120, yPx: 90 });
await mosaic.endStroke();

await mosaic.beginStroke({ xPx: 180, yPx: 120 });
await mosaic.appendStroke({ xPx: 240, yPx: 150 });
await mosaic.endStroke();

await mosaic.commit();
```

Points between input samples are interpolated so a fast pointer does not leave gaps. The brush is
circular and pixelates only covered pixels. The transient preview is excluded from Snapshot state,
normal export, History, and committed document events. `cancel()` removes it and restores the exact
committed view.

`getSession()` returns immutable stroke, point, source revision, configuration, and dirty-rectangle
status. `subscribe()` supports UI adapters without introducing a DOM dependency. Starting Crop
through the shared Tool Coordinator closes an active Mosaic session cleanly. A second `enter()`
call rejects and leaves the active session unchanged.

## Dirty rectangles and configuration

Preview updates write only the merged, image-clamped dirty rectangle instead of replacing the full
preview surface after every point. Dirty state remains bounded by the natural image dimensions.
Commit replays the captured strokes against the current transactional source.

The default configuration is a 24-pixel brush, an 8-pixel block, source-format output, quality
`0.92`, and at most 4,096 points. `configure()` changes runtime defaults outside an active session;
each session captures an immutable configuration when it starts.

```ts
await mosaic.configure({ brushSizePx: 32, pixelBlockSizePx: 10 });
await mosaic.enter({ configuration: { maxPointCount: 2_000 } });
```

`brushSizePx` must be from `1` to `4096`, `pixelBlockSizePx` an integer from `1` to `1024`, quality
from `0` to `1`, and `maxPointCount` an integer from `1` to `100000`. Points must be finite and
within the natural image bounds.

## Filters, History, and output

When the Filters Plugin is installed, `bakeVisibleFilters: true` bakes its committed visible result
before the strokes are replayed. The bake joins the Mosaic transaction and creates no nested History
record or committed event.

```ts
await mosaic.commit({
    bakeVisibleFilters: true,
    format: 'jpeg',
    quality: 0.9,
});
```

The default `source` format preserves the source MIME type. `png`, `jpeg`, and `webp` are also
supported. If visible-filter baking is requested without a compatible provider, commit fails
without changing the document.

A changed commit is one atomic raster mutation. With the History Plugin enabled it creates one undo
record and one committed geometry event. With History disabled it creates no record but retains Core
rollback protection. Overlay and Mask identities, selection, and layer order remain unchanged.
Rendering, decoding, Filters, or commit failures restore Base Image, Filters, Overlay state,
selection, and History exactly. A session with no completed strokes is a no-op.

## Security limits and headless use

Mosaic uses the active Core image resource policy for input bytes, pixel counts, export dimensions,
encoded output size, and image decode timeout. `maxPointCount` additionally bounds session work and
memory growth. The Plugin cannot increase or bypass Core limits.

The public API requires no DOM elements and can run headlessly when the supplied Fabric runtime and
Core canvas provide pixel reads, raster encoding, and image decoding.
