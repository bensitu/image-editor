/**
 * Composes the modular UMD foundations and plugins used by the Integrated Editor demo.
 *
 * @module
 */

(function () {
    'use strict';

    window.ImageEditorDemoPage = Object.freeze({
        id: 'integrated-editor',
        createEditor(options) {
            const { ImageEditorCore, composePlugins } = window.ImageEditor || {};
            const plugins = window.ImageEditorPlugins;
            if (typeof ImageEditorCore !== 'function' || typeof composePlugins !== 'function') {
                throw new Error('Image Editor Core UMD is unavailable.');
            }
            if (!window.fabric || !plugins) {
                throw new Error('Fabric or the selected Image Editor Plugin UMDs are unavailable.');
            }

            const editor = new ImageEditorCore(window.fabric, options.core);
            const installedPlugins = editor.install(
                composePlugins({
                    transform: plugins.Transform.transformPlugin(options.transform),
                    history: plugins.History.historyPlugin(options.history),
                    overlays: plugins.Overlay.overlayFoundationPlugin(),
                    masks: plugins.Mask.maskPlugin(options.masks),
                    annotations: plugins.Annotation.annotationFoundationPlugin(options.annotations),
                    text: plugins.AnnotationText.textAnnotationPlugin(options.text),
                    shape: plugins.AnnotationShape.shapeAnnotationPlugin(options.shape),
                    draw: plugins.AnnotationDraw.drawAnnotationPlugin(options.draw),
                }),
            );

            return Object.freeze({ editor, ...installedPlugins });
        },
    });
})();
