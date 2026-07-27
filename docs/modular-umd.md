# Modular UMD Loading

Modular UMD is the on-demand script-tag distribution for applications that do
not use a JavaScript bundler. It exposes one shared Core runtime and one file for
each official Foundation or Feature Plugin. Plugins remain explicit definitions:
loading a script does not install it or mutate an editor instance.

Modern bundled applications should continue to use the documented ESM package
subpaths. Pages that need every official Feature should normally use the single
Full UMD because loading all modular files can cost more compressed bytes and
more requests.

## Choose one UMD mode

The two browser modes are mutually exclusive:

1. **Full UMD:** Fabric plus `image-editor.full.umd.min.js`, exposed as
   `ImageEditorFull`.
2. **Modular UMD:** Fabric, `image-editor.core.umd.min.js`, and only the selected
   `image-editor.plugin.*.umd.min.js` files, exposed as `ImageEditor` and
   `ImageEditorPlugins`.

Do not load Full UMD together with Core or Plugin UMD files on the same page.
They are separate composition modes, not layers of one runtime.

## File and version rules

Fabric must load first. Core must load before every Plugin, and Foundations must
load before the Features that depend on them. Every Core and Plugin file on a
page must come from the exact same `@bensitu/image-editor` package version.

For example, keep both URLs on `3.0.0-rc.1`:

```text
@bensitu/image-editor@3.0.0-rc.1/dist/umd/image-editor.core.umd.min.js
@bensitu/image-editor@3.0.0-rc.1/dist/umd/plugins/image-editor.plugin.mask.umd.min.js
```

Do not combine `@latest`, an unversioned URL, or a different release with
version-pinned modular files. Pinning one exact version for every URL prevents
runtime identity and API mismatches.

Development files use `.umd.js`; production files use `.umd.min.js`. Each has a
published source map beside it. UMD files are direct distribution paths and do
not add new `package.json` export subpaths.

## Loading order

The authoritative descriptors live in
[`config/bundle/modular-umd.mjs`](../config/bundle/modular-umd.mjs). The
documentation check derives the following block from that registry so a
dependency change cannot silently drift from this table.

<!-- modular-umd-registry:start -->

| Module             | Global                               | Load after                      |
| ------------------ | ------------------------------------ | ------------------------------- |
| `core`             | `ImageEditor`                        | `fabric`                        |
| `overlay`          | `ImageEditorPlugins.Overlay`         | `core`                          |
| `annotation`       | `ImageEditorPlugins.Annotation`      | `core`, `overlay`               |
| `transform`        | `ImageEditorPlugins.Transform`       | `core`                          |
| `history`          | `ImageEditorPlugins.History`         | `core`                          |
| `mask`             | `ImageEditorPlugins.Mask`            | `core`, `overlay`               |
| `filters`          | `ImageEditorPlugins.Filters`         | `core`                          |
| `crop`             | `ImageEditorPlugins.Crop`            | `core`, `overlay`               |
| `mosaic`           | `ImageEditorPlugins.Mosaic`          | `core`                          |
| `annotation-text`  | `ImageEditorPlugins.AnnotationText`  | `core`, `overlay`, `annotation` |
| `annotation-shape` | `ImageEditorPlugins.AnnotationShape` | `core`, `overlay`, `annotation` |
| `annotation-draw`  | `ImageEditorPlugins.AnnotationDraw`  | `core`, `overlay`, `annotation` |
| `overlay-state`    | `ImageEditorPlugins.OverlayState`    | `core`, `overlay`               |
| `dom-controls`     | `ImageEditorPlugins.DomControls`     | `core`                          |

<!-- modular-umd-registry:end -->

`ImageEditor` contains `ImageEditorCore` and the public SDK composition helpers,
including `definePlugin` and `composePlugins`. Plugin files externalize these
shared contracts instead of bundling private copies. Overlay and Annotation are
also shared Foundations, which preserves Plugin references, Capability tokens,
and `instanceof` identity across every selected file.

A missing prerequisite fails during script evaluation instead of creating a
partially usable namespace.

## Core, Transform, and History

This is a minimal editable composition. Replace `VERSION` with one exact package
version in every Image Editor URL.

```html
<script src="https://cdn.jsdelivr.net/npm/fabric@7/dist/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/image-editor.core.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/plugins/image-editor.plugin.transform.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/plugins/image-editor.plugin.history.umd.min.js"></script>

<script>
    (async () => {
        const editor = new ImageEditor.ImageEditorCore(fabric);
        const plugins = editor.install(
            ImageEditor.composePlugins({
                transform: ImageEditorPlugins.Transform.transformPlugin({
                    animationDuration: 0,
                }),
                history: ImageEditorPlugins.History.historyPlugin(),
            }),
        );

        await editor.init({
            canvas: 'editor-canvas',
            canvasContainer: 'canvas-container',
        });

        await plugins.transform.rotate(90);
        if (plugins.history.canUndo()) await plugins.history.undo();
    })().catch(console.error);
</script>
```

## Overlay and Mask

Mask uses the shared Overlay Foundation and therefore loads after it:

```html
<script src="https://cdn.jsdelivr.net/npm/fabric@7/dist/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/image-editor.core.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/plugins/image-editor.plugin.overlay.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/plugins/image-editor.plugin.mask.umd.min.js"></script>

<script>
    const editor = new ImageEditor.ImageEditorCore(fabric);
    const plugins = editor.install(
        ImageEditor.composePlugins({
            overlay: ImageEditorPlugins.Overlay.overlayFoundationPlugin(),
            mask: ImageEditorPlugins.Mask.maskPlugin(),
        }),
    );
</script>
```

Initialize the editor and load an image before calling
`plugins.mask.create(options)`.

## Annotation Text

Annotation Features share both Overlay and Annotation Foundations. Load all
prerequisites before the selected Feature:

```html
<script src="https://cdn.jsdelivr.net/npm/fabric@7/dist/index.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/image-editor.core.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/plugins/image-editor.plugin.overlay.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/plugins/image-editor.plugin.annotation.umd.min.js"></script>
<script src="https://cdn.jsdelivr.net/npm/@bensitu/image-editor@VERSION/dist/umd/plugins/image-editor.plugin.annotation-text.umd.min.js"></script>

<script>
    const editor = new ImageEditor.ImageEditorCore(fabric);
    const plugins = editor.install(
        ImageEditor.composePlugins({
            overlay: ImageEditorPlugins.Overlay.overlayFoundationPlugin(),
            annotation: ImageEditorPlugins.Annotation.annotationFoundationPlugin(),
            text: ImageEditorPlugins.AnnotationText.textAnnotationPlugin(),
        }),
    );
</script>
```

Shape and Draw use the same prerequisite order and replace the final script and
factory with `annotation-shape`/`shapeAnnotationPlugin` or
`annotation-draw`/`drawAnnotationPlugin`.

## Full versus modular size

- Loading a small Feature set can reduce transferred JavaScript with Modular
  UMD.
- Loading every modular file can exceed Full UMD after gzip and creates more
  requests.
- Full-feature pages should prefer Full UMD.
- Bundled applications should prefer ESM package subpaths so their bundler can
  optimize the selected graph.
- Modular UMD primarily supports traditional script tags, no-bundler pages, and
  legacy host integrations that still require UMD.

The enforced gzip-9 baselines and per-module ceilings are recorded in
[`config/bundle/modular-umd-budget.json`](../config/bundle/modular-umd-budget.json).
