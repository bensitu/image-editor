# Overlay State

`@bensitu/image-editor/plugins/overlay-state` persists editable overlays as
renderer-independent JSON. Keep the original image separately, export the
overlay document, and import it after loading that image again.

Overlay State is intentionally different from a full editor Snapshot. A
Snapshot captures editor-owned runtime state for undo, redo, and exact editor
restoration. Overlay State contains portable persistent overlays only; it
excludes selection, handles, labels, previews, active tools, editing cursors,
and in-progress strokes.

## Installation

Overlay State depends on the public Overlay Foundation. Install both before
calling `editor.init()`:

```ts
import * as fabric from 'fabric';
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { overlayStatePlugin } from '@bensitu/image-editor/plugins/overlay-state';

const editor = new ImageEditorCore(fabric);
const [overlays, overlayState] = editor.install([overlayFoundationPlugin(), overlayStatePlugin()]);

await editor.init({ canvas: 'canvas', canvasContainer: 'container' });
await editor.loadImage(imageDataUrl);
```

Official Mask, Text, Shape, and Draw Plugins register their persistence codecs
with the Overlay Foundation. Third-party overlay kinds can register codecs in
the same way.

## Wire format

Every exported document has these fixed identifiers:

```ts
{
    schema: 'image-editor.overlay-state',
    version: 1,
    coordinateSpace: 'image-normalized',
    image: { naturalWidth, naturalHeight, mimeType?, sourceId?, checksum? },
    overlays: [
        {
            id,
            kind,
            codec: { type, version },
            geometry,
            layer,
            hidden,
            locked,
            metadata?,
            data,
        },
    ],
    metadata?,
}
```

`version` is the Overlay State wire version. It is independent from the npm
package version and the Plugin API version.

Coordinates are normalized against the original image dimensions. An x value
of `0.25` denotes one quarter of the natural image width regardless of canvas
layout, display scale, zoom, or current base-image transform. Import maps those
coordinates through the target image geometry.

The payload never contains Fabric objects, Fabric class names, canvas JSON, or
renderer instances.

## Export and validation

```ts
const document = overlayState.exportState({
    includeHidden: true,
    kinds: ['mask', 'annotation:text'],
    metadata: { projectId: 'image-42' },
});

const validation = overlayState.validate(JSON.parse(storedJson));
if (!validation.valid) {
    console.error(validation.errors);
}
```

Export is deterministic for the same image and overlay state. Object keys and
overlay layers use stable ordering, and the returned document is detached from
runtime objects.

`validate()` never mutates the editor. It rejects unknown fields, accessors,
cycles, functions, symbols, non-finite numbers, dangerous object keys, malformed
identifiers, unsupported wire versions, and values beyond configured limits.

`migrate()` validates the input and returns the current document shape. A future
wire adapter can be added without changing `importState()` callers.

## Atomic import

```ts
const result = await overlayState.importState(document, {
    mode: 'replace',
    idConflict: 'regenerate',
    missingKindPolicy: 'error',
});
```

- `mode: 'replace'` removes existing persistent overlays and installs the
  imported document.
- `mode: 'append'` keeps existing overlays and appends imported layers in their
  relative order.
- `idConflict: 'error'` rejects duplicate or occupied persistent IDs.
- `idConflict: 'regenerate'` creates new IDs and returns an immutable `idMap`.
- `missingKindPolicy: 'error'` rejects a missing or incompatible codec.
- `missingKindPolicy: 'skip'` omits those items and increments `skipped`.

Validation, decoding, object creation, layer placement, and replacement form
one Overlay Document Mutation. If any codec or validation step fails, the
previous overlay document is restored and no partial import remains.

When History is installed and enabled, a successful import creates one History
record. Undo and redo operate on the complete imported overlay document. If
History is absent or disabled, the same atomic import succeeds without adding a
record.

## Custom kinds

A persistent third-party Overlay kind supplies `stateCodec` through its public
Overlay kind registration. The codec owns only data for that kind; the Overlay
State Plugin owns the common ID, geometry, layer, visibility, lock, metadata,
validation, and transaction rules.

Use stable namespaced kind and codec identifiers. Changing codec data requires
a new codec version and a compatible decode policy. Import defaults to an error
for an unavailable codec so data is not silently lost.

## Default limits

| Limit                |   Default |
| -------------------- | --------: |
| Payload bytes        | 5,000,000 |
| Nesting depth        |        32 |
| Array length         |   100,000 |
| Overlay count        |       500 |
| Metadata keys        |       256 |
| Metadata depth       |         8 |
| String length        |    10,000 |
| Identifier length    |       128 |
| Codec payload bytes  | 1,000,000 |
| Coordinates          |   200,000 |
| Coordinate magnitude | 1,000,000 |
| Draw points          |   100,000 |
| Path commands        |   100,000 |

Override limits through `overlayStatePlugin({ limits })` or the per-call
validation/import options. Keep host limits bounded when accepting untrusted
JSON.
