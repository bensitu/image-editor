# Canvas Interactions Plugin

The `@bensitu/image-editor/plugins/canvas-interactions` entry is an optional
adapter between Fabric canvas pointer events and the public Text, Shape, Draw,
and Mosaic APIs. Feature Plugins continue to own sessions, document mutations,
History, persistence, and image lifecycle cleanup.

Applications that provide their own canvas interaction layer can omit this
Plugin. Importing Core or a Feature Plugin does not install pointer listeners.
DOM Controls is a separate adapter and can be used independently.

## Direct composition

Each configured interaction receives an exact `PluginRef` and a lazy resolver.
The resolver keeps installation dependency-aware and avoids access to private
Feature controllers.

```ts
import * as fabric from 'fabric';
import { ImageEditorCore } from '@bensitu/image-editor/core';
import {
    annotationFoundationPlugin,
    annotationFoundationRef,
} from '@bensitu/image-editor/plugins/annotation';
import {
    drawAnnotationPlugin,
    drawAnnotationPluginRef,
} from '@bensitu/image-editor/plugins/annotation-draw';
import {
    shapeAnnotationPlugin,
    shapeAnnotationPluginRef,
} from '@bensitu/image-editor/plugins/annotation-shape';
import {
    textAnnotationPlugin,
    textAnnotationPluginRef,
} from '@bensitu/image-editor/plugins/annotation-text';
import {
    canvasInteractionsPlugin,
    type CanvasPluginBinding,
} from '@bensitu/image-editor/plugins/canvas-interactions';
import { mosaicPlugin, mosaicPluginRef } from '@bensitu/image-editor/plugins/mosaic';
import {
    overlayFoundationPlugin,
    overlayFoundationRef,
} from '@bensitu/image-editor/plugins/overlay';
import { composePlugins, type PluginRef } from '@bensitu/image-editor/sdk';

const editor = new ImageEditorCore(fabric);

function bind<TApi>(ref: PluginRef<TApi>): CanvasPluginBinding<TApi> {
    return { ref, resolve: () => editor.requirePlugin(ref) };
}

const plugins = editor.install(
    composePlugins({
        overlays: overlayFoundationPlugin(),
        annotations: annotationFoundationPlugin(),
        text: textAnnotationPlugin(),
        shape: shapeAnnotationPlugin(),
        draw: drawAnnotationPlugin(),
        mosaic: mosaicPlugin(),
        canvasInteractions: canvasInteractionsPlugin({
            text: {
                plugin: bind(textAnnotationPluginRef),
                overlays: bind(overlayFoundationRef),
                annotations: bind(annotationFoundationRef),
            },
            shape: {
                plugin: bind(shapeAnnotationPluginRef),
                minimumDragDistance: 2,
                continuous: true,
            },
            draw: { plugin: bind(drawAnnotationPluginRef) },
            mosaic: { plugin: bind(mosaicPluginRef) },
        }),
    }),
);

await editor.init({ canvas: 'canvas', canvasContainer: 'container' });
```

Omit any interaction whose Feature is not part of the application. Plugin
installation validates every configured reference before setup. Factory creation
throws `CanvasInteractionsConfigurationError` when a configured interaction is
missing a required `PluginRef` or resolver.

## Feature behavior

Canvas Interactions responds only while the corresponding Tool is active:

- Text uses a click on blank canvas space to create an Annotation and begin
  editing it. A click on editable Text begins editing that Annotation.
- Shape uses a drag to update the transient preview and commits after the last
  preview update completes. Drags shorter than `minimumDragDistance` cancel the
  Shape session. `continuous: true` re-enters the same Shape session options
  after a successful commit.
- Draw forwards every accepted point in order and ends the stroke only after
  all pending points complete.
- Mosaic maps scene coordinates through the complete Base Image transform to
  natural image pixels. A stroke cannot begin outside the image. Movement
  outside the image is ignored and valid movement resumes after re-entry.

Feature configuration remains on the Feature API. Configure text defaults,
shape style, draw brushes, and Mosaic raster settings before or during their
documented sessions.

## Text policies

Text interaction policies are intentionally small:

| Option              | Default    | Behavior                                                       |
| ------------------- | ---------- | -------------------------------------------------------------- |
| `blankClick`        | `'create'` | Create and edit Text, or use `'ignore'`.                       |
| `existingTextClick` | `'edit'`   | Edit existing Text, or use `'select'`.                         |
| `retargetEditing`   | `'commit'` | Commit the current edit before retargeting, or use `'cancel'`. |

Locked or hidden Text is not an editable target. Classification and selection
use the public Overlay and Annotation APIs; applications do not need Fabric
object metadata.

## Status, cancellation, and errors

```ts
const subscription = plugins.canvasInteractions.subscribe((status) => {
    console.log(status.activeBindingId, status.gestureActive);
});

const status = plugins.canvasInteractions.getStatus();
await plugins.canvasInteractions.cancel();

subscription.dispose();
```

`getStatus()` reports whether the pointer source is bound, whether the Plugin
is disposed, the active interaction binding, and whether a pointer interaction
is in progress. `cancel()` invalidates current local work and releases any
Feature preview or stroke owned by the active binding. It does not replace the
Feature API used to enter, commit, or intentionally close a session.

Use `onInteractionError` to observe a failed claim, move, completion, or
cancellation. Errors also pass through Core diagnostics. Pointer callbacks do
not leave unhandled Promise rejections, and a failed interaction releases its
local ownership so the editor remains usable.

## Coordinates and scheduling

Text, Shape, and Draw capture immutable Fabric scene coordinates when an event
arrives. Mosaic additionally captures natural image coordinates by applying the
inverse Base Image matrix and converting Fabric's center-origin image space to
pixel space. Coordinate snapshots include the current geometry revision so a
gesture cannot continue across an image replacement or geometry change.

Shape preview scheduling retains the running update and the newest pending
update. Draw and Mosaic preserve accepted samples in order. Completion waits
for the appropriate scheduler to flush before calling `commit()` or
`endStroke()`.

## Lifecycle and canvas ownership

The Plugin observes Tool changes synchronously and invalidates local pointer
work when ownership changes. Image load, image clear, state load, disposal,
window blur, pointer cancellation, and release outside the canvas also end
local ownership safely. Asynchronous work checks its interaction identity
before calling a Feature API.

While a Tool is active, the Plugin temporarily leases cursor, selection, and
target-finding properties on the Fabric canvas. A property is restored only
when its current value is still the value owned by the lease, so a later host
change is not overwritten.

The manifest declares `fabric:canvas-read` to bind the live canvas and
`fabric:global-mutation` because these canvas-wide properties are temporarily
changed. All values are released during Tool changes and disposal.

The adapter owns one primary pointer stream at a time. It does not provide
multi-pointer transforms.
