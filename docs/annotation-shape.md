# Shape Annotation Plugin

The Shape Annotation Plugin supports `rect`, `line`, and `arrow`. Install Overlay, Annotation
Foundation, and Shape in that order before `editor.init()`.

```ts
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { shapeAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-shape';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

editor.use(overlayFoundationPlugin());
editor.use(annotationFoundationPlugin());
const shape = editor.use(shapeAnnotationPlugin({ stroke: '#dc2626', strokeWidth: 3 }));
```

## Direct creation

Shape geometry uses document coordinates. Rectangles use a positive width and height; lines and
arrows use distinct start and end points.

```ts
const rectId = await shape.create({
    geometry: { kind: 'rect', left: 60, top: 40, width: 180, height: 100 },
    fill: 'rgba(254, 226, 226, 0.3)',
    name: 'Review box',
});

const lineId = await shape.create({
    geometry: { kind: 'line', start: { x: 40, y: 160 }, end: { x: 220, y: 120 } },
    strokeDashArray: [8, 4],
});

const arrowId = await shape.create({
    geometry: { kind: 'arrow', start: { x: 80, y: 200 }, end: { x: 260, y: 140 } },
    arrowHeadLength: 18,
});
```

`update()` changes style plus shared name, metadata, hidden, and locked fields. Semantic geometry is
stored by the feature codec so Snapshot and undo/redo restore exact rect bounds or line/arrow
endpoints.

## Transient sessions

Use a session when pointer input needs a latest-wins preview:

```ts
await shape.enter({ kind: 'arrow', stroke: '#059669' });
await shape.updatePreview({
    kind: 'arrow',
    start: { x: 80, y: 80 },
    end: { x: 220, y: 140 },
});

const id = await shape.commit();
// or await shape.cancel();
```

Every preview replacement is transient and excluded from Annotation lists, Snapshot, export,
History, and committed events. `commit()` requires valid, non-degenerate preview geometry and
creates one document mutation. `cancel()` creates no record. Tool switching, image replacement,
and disposal clean the preview.

## Transform, export, and limits

`bindToImageTransform` is false by default. When enabled, Shape objects follow base-image scale,
rotation, reflection, reset, and undo/redo through the shared Overlay geometry participant.

Visible Shapes are exported and can be flattened by `annotation:shape` kind. Hidden Shapes are
excluded by default; locked Shapes remain visible. Crop applies its generic Overlay policy without
importing the Shape Plugin.

Coordinates, minimum geometry, stroke width, dash count and values, arrow-head length, opacity,
style strings, encoded object size, metadata, and Annotation count are bounded. NaN, Infinity,
degenerate lines/arrows, unknown fields, and malformed serialized geometry are rejected before a
transaction changes the document.
