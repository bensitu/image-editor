# Draw Annotation Plugin

The Draw Annotation Plugin provides curved freehand paths and a Draw-only Eraser sub-mode. Install
Overlay, Annotation Foundation, and Draw in that order before `editor.init()`.

```ts
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { drawAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-draw';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

editor.use(overlayFoundationPlugin());
editor.use(annotationFoundationPlugin());
const draw = editor.use(
    drawAnnotationPlugin({
        brush: { color: '#ea580c', width: 6, interpolationSpacing: 2 },
        eraser: { radius: 14 },
    }),
);
```

## Brush sessions

Draw points use document coordinates. Input samples are bounded and interpolated, then emitted as
a curved Fabric path with the configured color, width, opacity, line cap, and line join.

```ts
await draw.enter({ subMode: 'brush' });
await draw.beginStroke({ x: 80, y: 120 });
await draw.appendStroke({ x: 140, y: 160 });
await draw.appendStroke({ x: 220, y: 130 });
const annotationId = await draw.endStroke();

await draw.exit();
```

Each completed meaningful brush stroke creates one persistent `annotation:draw` object and one
History record when History is enabled. A one-point stroke, preview, or cancelled stroke creates no
committed state. Multiple strokes remain separate Annotation objects with stable IDs.

`configureBrush()` changes future strokes. Brush configuration cannot change while a stroke is
active. `bindToImageTransform` is false by default; enabling it makes committed paths follow the
shared Overlay geometry transaction.

## Eraser behavior and limitation

Eraser is a sub-mode of the Draw Tool. There is no separate Eraser Plugin, package entry, or
top-level Tool.

```ts
await draw.enter();
await draw.setSubMode('erase');
await draw.beginStroke({ x: 120, y: 140 });
await draw.appendStroke({ x: 180, y: 140 });
await draw.endStroke();
await draw.exit();
```

The current Eraser uses deterministic sampled-path hit testing and removes each whole intersected
Draw Annotation object. It does not split or partially erase a path. This whole-object behavior is
intentional and preserves the established product semantics.

Only visible, unlocked `annotation:draw` objects are targets. Eraser never mutates the Base Image,
Mask, Text, Shape, Crop or Mosaic previews, or third-party Overlay kinds. A stroke that hits no
eligible Draw object is a no-op with zero History records. A changed erase is one document
mutation, is undoable/redoable when History is enabled, and creates no History record when History
is disabled.

## Preview, state, and limits

Brush and Eraser previews are session-only. They are excluded from Annotation lists, Snapshot,
export, flatten, History, and committed events, and are removed on cancel, sub-mode change, Tool
switch, image replacement, exit, or disposal.

Committed paths preserve sampled points, curved path commands, style, identity, metadata,
hidden/locked state, selection, and layer through Snapshot and History. Visible Draw objects export
in layer order and can be flattened by `annotation:draw` kind. Crop integrates through generic
Overlay registration.

Point count, coordinates, interpolation spacing, brush width, Eraser radius, style strings, encoded
path size, metadata, and total Annotation count are bounded. Non-finite points, huge paths, unknown
configuration fields, and malformed serialized commands are rejected before document mutation.
