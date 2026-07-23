# Overlay Transform Binding

Transform binding is an opt-in Plugin policy that keeps editable overlays
aligned with the same source-image content while the base image is scaled,
rotated, flipped, or reset.

Use the [Integrated Editor demo](integrated-editor.html) to exercise masks,
annotations, zoom, arbitrary-angle rotation, flips, and reset together.

```ts
import * as fabric from 'fabric';
import { createFullPreset } from '@bensitu/image-editor/presets/full';

const kit = createFullPreset(fabric, {
    masks: { bindToImageTransform: true },
    text: {
        bindToImageTransform: true,
        reflectionBehavior: 'preserve-readable',
    },
    shape: { bindToImageTransform: true },
    draw: {
        brush: { bindToImageTransform: true },
    },
});

await kit.editor.init({ canvas: 'canvas', canvasContainer: 'container' });
```

Each Feature owns its configuration:

- `masks.bindToImageTransform` defaults to `false`.
- `text.bindToImageTransform`, `shape.bindToImageTransform`, and
  `draw.brush.bindToImageTransform` default to `false`.
- `text.reflectionBehavior` defaults to `'preserve-readable'`; use `'mirror'`
  when text glyphs should reflect with the image.

## Semantics

Binding keeps overlay geometry stable in image-local/source-pixel space. After
the image reaches its final transform, the geometry transaction applies the
base-image affine delta to each enabled persistent overlay.

Masks, Shapes, and Draw paths receive the complete transform, including
horizontal and vertical reflection. Text centers also follow the transform.
With `reflectionBehavior: 'preserve-readable'`, reflected glyphs are corrected
while their position remains bound to image content.

The implementation updates existing Fabric objects in place. Object identity,
handlers, lock/visibility state, and persistent metadata remain intact.
Transient labels and selection controls are rebuilt or repositioned through
their owning Plugin.

## Interaction details

- An active multi-object selection is discarded before bound objects are
  transformed; automatic selection restoration is not attempted.
- Overlay geometry snaps to the committed image transform after its animation;
  overlays are not independently tweened.
- Draw paths use public Fabric transformation APIs. Their path data and private
  Fabric fields are not rewritten.
- Overlay State continues to use image-normalized coordinates.
- Crop overlay-preservation policy is independent. Preserved overlays can
  participate in later bound transforms.
