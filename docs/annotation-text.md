# Text Annotation Plugin

The Text Annotation Plugin creates editable Fabric-backed text while exposing only IDs,
configuration, and immutable session status. Install Overlay, Annotation Foundation, and Text in
that order before `editor.init()`.

```ts
import { annotationFoundationPlugin } from '@bensitu/image-editor/plugins/annotation';
import { textAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-text';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

editor.use(overlayFoundationPlugin());
editor.use(annotationFoundationPlugin());
const text = editor.use(
    textAnnotationPlugin({
        fontFamily: 'Inter',
        fontFallbacks: ['Arial', 'sans-serif'],
        fontSize: 24,
    }),
);
```

## Create and update

```ts
const id = await text.create({
    text: 'Review this area',
    left: 80,
    top: 48,
    width: 240,
    fill: '#1d4ed8',
    backgroundColor: 'rgba(219, 234, 254, 0.8)',
    textAlign: 'center',
    name: 'Review caption',
    metadata: { category: 'review' },
});

await text.update(id, {
    text: 'Approved',
    fontWeight: 700,
    opacity: 0.9,
});
```

Creation and changed updates are atomic document mutations. `configure()` changes future defaults
and transform behavior but is not saved in Snapshot or History.

## Editing lifecycle

`beginEditing()` creates a private transient Textbox, hides the committed source temporarily, and
enters the shared Text Tool. Browser keyboard editing operates on that transient object. The
committed Annotation, Snapshot, export, and History remain unchanged until `commitEditing()`.

```ts
await text.beginEditing(id);

// A UI may observe immutable status without receiving a live Fabric object.
const session = text.getEditingSession();

await text.commitEditing(); // one History record if text or style changed
// or
await text.cancelEditing(); // exact original state, zero History records
```

Locked Text cannot enter editing. Starting a conflicting Tool, replacing the image, or disposing
the editor closes the edit session deterministically. For programmatic, headless text changes, use
`update()` instead of an interactive edit session.

## Readable and mirrored reflection

Text can bind to base-image transforms. Binding is off by default. When enabled,
`preserve-readable` follows position, rotation, and scale while removing local reflection from the
glyphs. `mirror` retains the reflected glyph orientation. The default is `preserve-readable`.

```ts
await text.configure({
    bindToImageTransform: true,
    reflectionBehavior: 'preserve-readable',
});

await text.configure({ reflectionBehavior: 'mirror' });
```

The policy applies to horizontal, vertical, double, and mixed transformations and participates in
the same undo/redo geometry transaction as the base-image transform.

## State, export, and limits

Committed Text content, typography, geometry, metadata, hidden/locked state, identity, and layer
are restored through Snapshot and History. The edit preview is excluded from Snapshot, export,
flatten, and History. Visible locked Text is exported; hidden Text is excluded by default.

Text is limited to 20,000 characters. Font fields, font size, width, opacity, coordinates, encoded
object size, metadata, and the total Annotation count are bounded and validated. Non-finite values,
unsafe font strings, unknown configuration fields, and malformed serialized Text are rejected
before document mutation.
