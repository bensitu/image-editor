# Annotation Foundation

The Annotation Foundation is the shared authority for Text, Shape, and Draw Annotations. It owns
their public descriptors, metadata, visibility, locking, selection, layer operations, state
integration, and flattening. It does not create a concrete Annotation by itself.

Install the Overlay Foundation first, then the Annotation Foundation, and then any concrete
Annotation Plugins. All Plugins must be installed before `editor.init()`.

```ts
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { drawAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-draw';
import { shapeAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-shape';
import { textAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-text';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

const editor = new ImageEditorCore(fabric);
editor.use(overlayFoundationPlugin());
const annotations = editor.use(annotationFoundationPlugin());
const text = editor.use(textAnnotationPlugin());
const shape = editor.use(shapeAnnotationPlugin());
const draw = editor.use(drawAnnotationPlugin());

await editor.init({ canvas: 'canvas' });
await editor.loadImage(source);
```

Installing the Foundation without Text, Shape, or Draw is supported. A missing or incompatible
Overlay dependency rejects installation before Annotation registrations are applied.

## Identity and descriptors

Every persistent Annotation reuses its Overlay persistent ID. There is no second Annotation ID
registry. `list()` and `get()` return immutable descriptors, never live Fabric objects.

```ts
const item = annotations.get(annotationId);
// {
//   id, kind, name, hidden, locked, selected, layerIndex, metadata
// }

const visibleText = annotations.list({ kinds: ['annotation:text'] });
const all = annotations.list({ includeHidden: true, includeLocked: true });
```

Names are trimmed strings of at most 128 characters. Metadata must be a plain, JSON-safe object;
functions, symbols, cycles, dangerous prototype keys, non-finite numbers, and excessive depth or
size are rejected. Returned metadata is an immutable clone.

```ts
await annotations.update(annotationId, {
    name: 'Approved caption',
    metadata: { author: 'Ada', status: 'approved' },
});
```

## Visibility, locking, selection, and layers

A hidden Annotation remains registered and remains in Snapshot and History state, but is not
rendered by normal export or default flattening. It can still be read and updated by ID. A locked
Annotation is visible but cannot be selected or transformed interactively; Text editing is also
disabled. Unlocking restores the interaction policy supplied by its concrete Plugin.

```ts
await annotations.update(annotationId, { hidden: true });
await annotations.update(annotationId, { hidden: false, locked: true });

await annotations.select([firstId, secondId]);
await annotations.clearSelection();
await annotations.bringForward(firstId);
await annotations.sendBackward(firstId);
await annotations.bringToFront(firstId);
await annotations.sendToBack(firstId);
```

Overlay remains the selection and layer authority. Mixed Mask and Annotation selections use the
same generic Overlay ordering; the Annotation API filters only Annotation descriptors.

## Snapshot, export, flatten, and Crop

`editor.saveState()` serializes each Annotation once through its registered Overlay codec.
`editor.loadFromState()` validates all required feature codecs before mutating the document, so a
Snapshot containing an unavailable feature kind is rejected atomically. Tool sessions and previews
are never committed to Snapshot state.

Normal export includes visible Annotations in layer order, includes visible locked objects, and
excludes selection controls and sessions. Export operates on copies and does not change the live
document or History.

```ts
await annotations.flatten({ kinds: ['annotation:text', 'annotation:shape'] });

// Explicitly include hidden matches when that behavior is required.
await annotations.flatten({ includeHidden: true });
```

Flatten delegates to Overlay's raster transaction. It renders only matching Annotations, removes
those matches, preserves non-matching Overlay objects such as Masks, and creates one History record
when History is enabled. Hidden objects are excluded unless `includeHidden: true` is supplied.

Crop discovers Annotations through the generic Overlay registration. Crop does not require or
import any concrete Annotation Plugin. Its `keep`, `discard`, and `transform-intersecting` Overlay
policies therefore apply to Annotation kinds in the same way as other registered Overlay kinds.

## Transactions and History

Create, update, remove, layer, feature edit commit, and flatten operations are Core document
mutations. A changed top-level operation creates one trusted before/after Memento and one History
record when the History Plugin is enabled. No-op updates and previews create no History record. If
History is disabled, committed changes still use Core rollback but add no timeline entry.

`subscribe()` reports immutable Annotation status after committed changes. Runtime configuration
and active Text, Shape, or Draw sessions are not document state.
