# Typed Presets

Presets are typed Plugin compositions. Each factory creates one
`ImageEditorCore`, installs its PluginPlan before initialization, and returns
the editor plus the original typed Plugin APIs. Presets do not forward Feature
methods and do not call `editor.init()`.

## Profiles

| Entry                                      | Installed APIs                                                            |
| ------------------------------------------ | ------------------------------------------------------------------------- |
| `@bensitu/image-editor/presets/minimal`    | Transform; optional History                                               |
| `@bensitu/image-editor/presets/redaction`  | Transform, History, Overlay, Mask, Filters, Crop, Mosaic, Overlay State   |
| `@bensitu/image-editor/presets/annotation` | Transform, History, Overlay, Annotation, Text, Shape, Draw, Overlay State |
| `@bensitu/image-editor/presets/full`       | Every official Feature Plugin and both Foundations                        |

Redaction does not install Annotation Features. Annotation does not install
Mask, Filters, Crop, or Mosaic. Full installs one Overlay Foundation and one
Annotation Foundation.

## Minimal

History is absent by default and is non-null in the inferred result when
explicitly enabled:

```ts
import * as fabric from 'fabric';
import { createMinimalPreset } from '@bensitu/image-editor/presets/minimal';

const basic = createMinimalPreset(fabric);
basic.history; // null

const preset = createMinimalPreset(fabric, {
    core: { defaultLayoutMode: 'fit' },
    transform: { animationDuration: 0 },
    history: { maxSize: 50 },
});

preset.history.canUndo(); // HistoryPort, not nullable
await preset.editor.init({ canvas: 'canvas', canvasContainer: 'container' });
```

## Feature-focused compositions

Options are grouped by Plugin name. There is no flat editor option map:

```ts
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';

const { editor, transform, history, overlays, masks, filters, crop, mosaic, overlayState } =
    createRedactionPreset(fabric, {
        core: { canvasWidth: 800, canvasHeight: 600 },
        history: { maxSize: 100 },
        masks: { label: false },
        filters: { maxFilterCount: 12 },
        crop: { paddingPx: 8 },
        mosaic: { brushSizePx: 32 },
        overlayState: { limits: { maxOverlays: 750 } },
    });

await editor.init({ canvas: 'canvas', canvasContainer: 'container' });
await masks.create();
await crop.enter();
```

The Annotation Preset returns `annotations`, `text`, `shape`, and `draw` APIs.
The Full Preset returns every API listed in both profiles.

## Optional DOM Controls

Presets do not import the DOM Controls runtime. To include it, pass a typed
factory. The factory receives ready-to-use Plugin bindings, and the resulting
DOM Plugin joins the same atomic PluginPlan:

```ts
import { domControlsPlugin } from '@bensitu/image-editor/plugins/dom-controls';
import { createFullPreset } from '@bensitu/image-editor/presets/full';

const preset = createFullPreset(fabric, {
    domControls: (bindings) =>
        domControlsPlugin({
            ownerDocument: document,
            transform: {
                plugin: bindings.transform,
                zoomInButton: '#zoom-in',
            },
            history: {
                plugin: bindings.history,
                undoButton: '#undo',
                redoButton: '#redo',
            },
            keyboard: { overlays: bindings.overlays },
        }),
});

preset.domControls.refresh(); // inferred as DomControlsPluginApi
```

Without `domControls`, the returned property is `null` and the DOM module is not
included in default Preset bundles.

## Lifecycle ownership

The application owns initialization, image loading, UI state, and disposal:

```ts
const preset = createAnnotationPreset(fabric);
await preset.editor.init({ canvas, canvasContainer: container });

await preset.text.create({ text: 'Review' });
const saved = preset.overlayState.exportState();

await preset.editor.disposeAsync();
```

Create one Preset result per mounted editor. Do not reuse Plugin API objects
with another editor instance.

## Bundle selection

Import a specific Preset subpath. The package root does not export Presets, and
the root bundle remains Core-only. Minimal excludes Overlay editing Features;
Redaction excludes Annotation code; Annotation excludes raster editing
Features; Full contains all official Features. DOM Controls appears only when
the optional factory imports and returns it.
