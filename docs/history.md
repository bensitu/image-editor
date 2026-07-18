# History recording control

The History Plugin provides bounded undo and redo for committed editor transactions. Install it,
like every Plugin, before calling `editor.init()`. The Plugin cannot be attached after editor
initialization.

```ts
import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';

const editor = new ImageEditorCore(fabric);
const history = editor.use(
    historyPlugin({
        enabled: true,
        maxSize: 50,
    }),
);

await editor.init({ canvas: 'canvas' });
```

`enabled` defaults to `true`. Set it to `false` when an application needs to prepare a document
without making those preparation operations undoable. The Plugin and its API are still fully
installed while recording is disabled.

```ts
const history = editor.use(historyPlugin({ enabled: false }));

await editor.init({ canvas: 'canvas' });
await editor.loadImage(source);
await prepareDocument(editor);

await history.enable({ baseline: 'current' });
```

Enabling captures the current trusted editor Memento as a new, non-undoable baseline. Operations
completed before enabling are not added to History and cannot later be undone. Repeating `enable`
while recording is already enabled is an idempotent no-op: it neither replaces the baseline nor
clears records.

Use `disable()` to stop recording without uninstalling or rebuilding the editor:

```ts
await history.disable();
// Equivalent to:
await history.disable({ clear: true });
```

The default `clear: true` policy removes the undo and redo timeline. With `clear: false`, existing
records remain bounded by `maxSize` and are available only as inactive status information. Undo and
redo remain unavailable, and operations performed while disabled are never recorded. A later
`enable({ baseline: 'current' })` discards the retained timeline before starting a new one, so undo
can never cross a disabled period.

```ts
await history.disable({ clear: false });
console.log(history.length); // Retained record count; records are not actionable.

await history.enable({ baseline: 'current' });
console.log(history.length); // 0
```

`history.getState()` and `history.onChange()` expose `isEnabled`, `canUndo`, `canRedo`, `length`,
and the backward-compatible `size` and `position` fields. Status listeners run after committed
History state changes; a listener failure cannot roll back the document or History state.

Disabling History affects record publication only. Core continues to capture trusted Mementos for
transaction rollback, so a failed Transform, Overlay, Mask, Raster, or Plugin State mutation still
restores the document normally. History disposal occurs with the editor lifecycle; installing a
replacement after initialization is not supported.
