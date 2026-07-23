# DOM Controls Plugin

`@bensitu/image-editor/plugins/dom-controls` is an optional adapter between DOM
elements and public Plugin APIs. Core, Feature Plugins, Overlay State, Presets,
and framework examples do not require it.

Use it for plain DOM applications that want selector resolution, listeners,
button/input state, list render adapters, guarded keyboard shortcuts, and
centralized asynchronous error routing. React, Vue, and similar frameworks can
usually call the same Plugin APIs directly through their own event systems.

## Configure sections

Each configured section supplies an exact `PluginRef`, a lazy API resolver, and
only the elements that section owns:

```ts
import * as fabric from 'fabric';
import { ImageEditorCore } from '@bensitu/image-editor/core';
import {
    domControlsPlugin,
    type DomPluginBinding,
} from '@bensitu/image-editor/plugins/dom-controls';
import { historyPlugin, historyPluginRef } from '@bensitu/image-editor/plugins/history';
import { transformPlugin, transformPluginRef } from '@bensitu/image-editor/plugins/transform';
import type { PluginRef } from '@bensitu/image-editor/sdk';

const editor = new ImageEditorCore(fabric);

function bind<TApi>(ref: PluginRef<TApi>): DomPluginBinding<TApi> {
    return { ref, resolve: () => editor.requirePlugin(ref) };
}

const [history, transform, controls] = editor.install([
    historyPlugin(),
    transformPlugin({ animationDuration: 0 }),
    domControlsPlugin({
        ownerDocument: document,
        transform: {
            plugin: bind(transformPluginRef),
            scaleInput: '#scale',
            zoomInButton: '#zoom-in',
            zoomOutButton: '#zoom-out',
            resetButton: '#reset-transform',
        },
        history: {
            plugin: bind(historyPluginRef),
            undoButton: '#undo',
            redoButton: '#redo',
        },
        keyboard: {},
        onActionError(event) {
            console.error(event.action, event.error);
        },
    }),
]);

await editor.init({ canvas: 'canvas', canvasContainer: 'container' });
```

Plugin installation verifies every configured `PluginRef` before setup. A section
cannot bind when its exact Feature Plugin is absent or incompatible. Omitted
sections and omitted controls create no listeners.

Available sections are `transform`, `history`, `masks`, `filters`, `crop`,
`mosaic`, `annotations`, `text`, `shape`, and `draw`. They call the documented
methods on their typed APIs; the adapter never guesses methods by string name.

## Element targets and synchronization

Targets accept an element instance or a selector string. Selectors are resolved
only inside the explicit `ownerDocument`. A missing selector, invalid selector,
wrong element kind, duplicate event binding, or element from another document
fails initialization with a configuration error.

The adapter performs initial synchronization after editor initialization. It
also refreshes after committed Core mutations and public status subscriptions.
`controls.refresh()` is available after initialization for application state
that does not expose a status stream. While an asynchronous action is pending,
managed action buttons are disabled. `getStatus()` returns an immutable binding
and busy snapshot.

List and status controls use host render adapters instead of prescribing HTML:

```ts
masks: {
    plugin: bindings.masks,
    list: {
        target: '#mask-list',
        render(target, masks) {
            target.replaceChildren(
                ...masks.map((mask) => {
                    const item = target.ownerDocument.createElement('li');
                    item.textContent = mask.maskName;
                    return item;
                }),
            );
        },
    },
}
```

## Keyboard actions

Keyboard support is enabled only when `keyboard` is provided. The default
action set is:

- `Escape`: cancel an active Text, Shape, Draw, Crop, or Mosaic session from
  configured sections.
- `Delete` or `Backspace`: remove selected unlocked overlays when
  `keyboard.overlays` is configured.
- `Ctrl/Cmd+Z`: undo through a configured History section.
- `Ctrl/Cmd+Shift+Z` or `Ctrl/Cmd+Y`: redo.

Input, textarea, select, and contenteditable targets are ignored unless
`allowInEditable: true` is set. Default browser behavior is prevented only when
an action is available and handled. Locked overlays are never removed.

Set `cancelActiveSession`, `removeSelection`, or `historyActions` to `false` to
disable an action family. `keyboard.target` can scope shortcuts to one element;
otherwise the adapter listens on `ownerDocument`.

## Errors and disposal

DOM event handlers always consume asynchronous rejections. Errors are sent to
`onActionError` when configured and are also recorded through Core diagnostics.
If the error listener itself throws, Core records a warning and cleanup
continues.

The editor owns the adapter lifecycle. Await `disposeAsync()` to remove
listeners and subscriptions in reverse order, release resolved elements, and
make repeated cleanup safe. No event is handled after disposal.

## SSR safety

Importing the entry, its `PluginRef`, or its types does not read browser globals.
The module does not access `window`, `document`, DOM constructors, or custom
elements during evaluation. Configure `ownerDocument` and initialize the editor
only in client code.
