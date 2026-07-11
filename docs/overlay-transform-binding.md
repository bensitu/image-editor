# Overlay Transform Binding

Overlay transform binding is an opt-in mode that keeps editable overlays aligned
with the same source-image content while the base image is scaled, rotated,
flipped, or reset.

Use the [Integrated Editor demo](integrated-editor.html) to exercise masks,
annotations, zoom, arbitrary-angle rotation, flips, and reset together, with
independent controls for whether Masks and Annotations follow image transforms.

```ts
const editor = new ImageEditor(fabric, {
    bindMasksToImageTransform: true,
    bindAnnotationsToImageTransform: true,
    textAnnotationFlipBehavior: 'preserve-readable',
});
```

All three options preserve existing behavior by default:

- `bindMasksToImageTransform` defaults to `false`.
- `bindAnnotationsToImageTransform` defaults to `false`.
- `textAnnotationFlipBehavior` defaults to `'preserve-readable'` and only
  applies when annotation binding is enabled.

## Semantics

Binding keeps overlay geometry stable in image-local/source-pixel space. After
the image reaches its final snapped transform, the editor calculates the affine
matrix delta between the previous and final base-image matrices and applies it
to the enabled live Fabric objects.

Masks, Shape annotations, and Draw annotations receive the complete transform,
including horizontal and vertical reflection. Text annotation centers also
follow the complete image transform. By default, Text removes reflection from
its local glyph transform so the text is not mirrored. Set
`textAnnotationFlipBehavior: 'mirror'` to mirror Text with the image content.

The implementation updates existing Fabric objects in place. Object identity,
handlers, annotation lock/visibility state, and overlay metadata remain intact.
Mask labels are session objects: they are not transformed as masks and are
repositioned through the existing label synchronization path afterward.

## v1 Interaction Details

- An active Fabric `ActiveSelection` is discarded before bound objects are
  transformed. Automatic selection restoration is not attempted.
- Image animation remains unchanged. Bound overlays snap to their final
  positions after the image animation completes; overlay tweening and temporary
  hiding are not performed.
- Draw `Path` objects use public Fabric transform APIs. Their `path`,
  `pathOffset`, and private Fabric methods are not modified.
- The overlay-state schema and `image-normalized` wire format are unchanged.
  Export/import continues to describe overlays in image-local/source-pixel
  coordinates.
- `crop.preserveMasksAfterCrop` remains an independent crop-coordinate path.
  A mask preserved by crop can participate in later bound image transforms.
