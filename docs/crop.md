# Crop Plugin

The Crop Plugin provides a DOM-independent crop session for `ImageEditorCore`. Install it before
`editor.init()` through its dedicated package entry. The Plugin is not exported from the package
root.

```ts
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { cropPlugin } from '@bensitu/image-editor/plugins/crop';

const editor = new ImageEditorCore(fabric);
const crop = editor.use(cropPlugin());

await editor.init({ canvas: 'canvas' });
await editor.loadImage(source);
```

## Coordinates and sessions

Crop rectangles use natural image pixels, independently of canvas zoom, viewport transforms, and
device pixel ratio. A rectangle has `leftPx`, `topPx`, `widthPx`, and `heightPx`. Fractional input
is normalized with covering integer bounds so the requested image area is not lost.

```ts
await crop.enter({
    rect: { leftPx: 40, topPx: 20, widthPx: 640, heightPx: 360 },
    aspectRatio: '16:9',
});

await crop.updateRect({ leftPx: 80, topPx: 45, widthPx: 480, heightPx: 270 });
await crop.setAspectRatio({ width: 4, height: 3 });
await crop.apply();
```

Aspect ratios accept `'free'`, `null`, a positive number, a `"width:height"` string, or a positive
`{ width, height }` pair. `cancel()` removes the preview and restores the exact committed view.
Only one Crop session can be active; a second `enter()` call rejects and leaves the current session
unchanged. Starting Mosaic through the shared Tool Coordinator closes an active Crop session
cleanly.

The preview is transient: it is excluded from Snapshot state, normal export, History, and committed
document events. `getSession()` returns an immutable status snapshot, and `subscribe()` can be used
by framework or DOM adapters without making the Plugin depend on the DOM.

## Overlay policy

Crop integrates with the generic Overlay capability when it is installed; Mask is not required.
The default policy keeps participating overlays visible during preview and preserves them when the
crop is applied.

```ts
await crop.enter({
    overlayPolicy: {
        preview: 'hide-participating',
        apply: 'transform-intersecting',
        kinds: ['mask', 'redaction-label'],
    },
});
```

`preview` is either `keep` or `hide-participating`. Temporary hiding does not alter committed
Overlay state or export. `apply` supports:

- `keep`: preserve registered overlays and keep their world geometry aligned with the retained
  image region.
- `discard`: remove participating overlays.
- `transform-intersecting`: preserve intersecting overlays with their retained image region, and
  remove those outside the crop.

Omit `kinds` to apply the policy to every registered Overlay kind. Persistent Overlay identifiers,
selection, and layer ordering are retained for preserved objects. Applications that do not install
the Overlay Foundation can use Crop normally.

## Filters, History, and output

When the Filters Plugin is installed, `bakeVisibleFilters: true` bakes its committed visible result
into the crop before cropping. The bake joins the Crop transaction; it does not create nested
History records or committed events.

```ts
await crop.apply({
    bakeVisibleFilters: true,
    format: 'webp',
    quality: 0.85,
});
```

Without an explicit format, Crop preserves the source MIME type. Explicit `png`, `jpeg`, and `webp`
output is supported; quality must be from `0` to `1`. If visible-filter baking is requested without
a compatible provider, the operation fails without changing the document.

A changed apply is one atomic raster and geometry mutation. With the History Plugin enabled it
creates one undo record and one committed geometry event. With History disabled it creates no
record but retains Core rollback protection. Any rendering, decoding, Overlay, Filters, or commit
failure restores Base Image, Filters, Overlay state, selection, and History exactly.

## Configuration, limits, and headless use

`paddingPx`, `minimumWidthPx`, and `minimumHeightPx` may be supplied to `cropPlugin()`. Rectangles
must be finite, positive, within the natural image bounds, and no smaller than the configured
minimums.

Crop uses the active Core image resource policy for input bytes, pixel counts, export dimensions,
encoded output size, and image decode timeout. The Plugin cannot increase or bypass those limits.
Its API requires no DOM elements and can run headlessly when the supplied Fabric runtime and Core
canvas support raster encoding and image decoding.
