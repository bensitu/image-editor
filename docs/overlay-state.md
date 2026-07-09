# Overlay State

Non-destructive overlay persistence stores the original image and editable
overlays separately. Applications can keep the image file in object storage, a
CDN, or a database, then store the overlay JSON beside it. Re-open the same
image later, import the overlay JSON, continue editing masks and annotations,
and export a final raster only when needed.

This API is not Fabric.js JSON and is not the editor's `saveState()` snapshot.
It is a stable, versioned wire format with `schema:
'image-editor.overlay-state'`, `version: 1`, `coordinateSpace:
'image-normalized'`, one ordered `overlays[]` array, and optional
`baseImageTransform` metadata. Here `version: 1` means overlay-state schema
version 1, independent from the npm package version. Package v2.x may still use
overlay-state schema version 1.

## Methods

| Method                                | Description                                                                    |
| ------------------------------------- | ------------------------------------------------------------------------------ |
| `exportOverlayState(options?)`        | Return pure JSON-compatible `OverlayState` for editable overlays only.         |
| `validateOverlayState(input)`         | Validate and normalize unknown overlay JSON without mutating the editor.       |
| `importOverlayState(input, options?)` | Validate, then atomically import overlays. Returns a structured import result. |

## Basic Flow

```ts
const overlayState = editor.exportOverlayState({
    includeHidden: true,
    includeLocked: true,
    includeMetadata: true,
});

localStorage.setItem('image-123-overlays', JSON.stringify(overlayState));
```

```ts
const parsed = JSON.parse(localStorage.getItem('image-123-overlays') ?? 'null');
const validation = editor.validateOverlayState(parsed);

if (!validation.valid) {
    console.error(validation.errors);
}
```

```ts
await editor.loadImage(originalImageDataUrl);

const result = await editor.importOverlayState(parsed, {
    mode: 'replace',
    idStrategy: 'regenerate',
    saveHistory: true,
});

console.log(result.importedOverlays, result.warnings);
```

## Import Behavior

`mode: 'replace'` removes existing editable overlays and imports the new
ordered `overlays[]` array as one transaction. `mode: 'append'` keeps existing
overlays and appends imported overlays above them while preserving imported
relative order. Import creates one undoable history entry by default; pass
`saveHistory: false` for silent programmatic restores.

`idStrategy: 'regenerate'` is the default and creates fresh runtime IDs while
returning `regeneratedIds`. `idStrategy: 'preserve'` keeps stable overlay IDs
when they cannot collide; runtime counters remain editor-owned.

## Coordinates and Base Transforms

Coordinates are original image pixel coordinates normalized to `[0, 1]`.
`{ x: 0.25, y: 0.4 }` means source pixel
`x = 0.25 * naturalWidth`, `y = 0.4 * naturalHeight`, independent of canvas
layout, zoom, scroll, and display scaling. `baseImageTransform` records
base-image `flipX`, `flipY`, and arbitrary-degree `rotation`; transform order
is `flipX`, then `flipY`, then `rotation`, around the original image center.
Overlay `angle` remains local to the overlay. Conceptually, visual rotation is
`baseImageTransform.rotation + overlay.angle`.

Existing interactive `flipHorizontal()` and `flipVertical()` remain
base-image-only: they do not move existing overlays. Overlay persistence handles
that compatibility explicitly by recording the base-image flip state on export
and mapping imported overlay coordinates through the persisted transform.

## Excluded Session State

The exporter excludes transient/session state: selection, hover highlights, mask
labels, crop rectangles, Mosaic previews, active text cursor/editing state,
in-progress Draw strokes, Shape previews, transform handles, and other
session-only objects. Mask style export reads stable normal fields such as
`originalAlpha`, `originalStroke`, and `originalStrokeWidth`, so hover or
selection styling does not leak into persisted JSON.

## Validation Limits

Validation limits protect browser responsiveness:

| Limit                    | Default  |
| ------------------------ | -------- |
| `maxOverlays`            | `500`    |
| `maxPolygonPoints`       | `1000`   |
| `maxDrawStrokes`         | `500`    |
| `maxDrawPointsPerStroke` | `5000`   |
| `maxDrawTotalPoints`     | `100000` |
| `maxTextLength`          | `10000`  |
| `maxMetadataDepth`       | `4`      |
| `maxMetadataBytes`       | `65536`  |

Raise these through `OverlayValidationOptions` for specialized domains such as
medical imaging, maps, or CAD-like annotation tools. Defaults are conservative
for general-purpose browser UI and accidental or malicious oversized JSON.

## Colors, Fonts, and Custom Overlays

Persistent colors are canonical `#RRGGBB` or `#RRGGBBAA`. Import also accepts
common `rgb()` and `rgba()` strings and normalizes them before creating runtime
objects. Overlay-level opacity fields win for object opacity; alpha in
`#RRGGBBAA` belongs to that color channel and is not silently multiplied by
object opacity.

If a text overlay requests a font that the host runtime cannot render, import
still succeeds. The requested `fontFamily` is preserved under `core.font`
metadata and runtime rendering falls back to the editor's configured default
font or the browser's deterministic fallback.

Custom overlays use namespaced `customType` values:
`builtin.<name>`, `app.<name>.<type>`, or `plugin.<name>.<type>`. Unknown custom
overlay types are skipped with warnings instead of crashing import. Metadata
namespaces follow the same collision-avoidance pattern: `core.*` is reserved,
`app.*` belongs to host applications, and `plugin.*` belongs to plugins.

Future overlay-state schema work is intentionally outside schema version 1:
partial/diff export for collaboration, binary encodings such as CBOR or
MessagePack for very large Draw data, native group overlays, a richer public
custom overlay registry, and domain-specific higher payload limits.
