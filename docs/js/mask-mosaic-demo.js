/**
 * Composes the modular UMD foundation and plugins used by the Mask and Mosaic demo.
 *
 * @module
 */

(function () {
    'use strict';

    window.ImageEditorDemoPage = Object.freeze({
        id: 'mask-mosaic',
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
                    overlays: plugins.Overlay.overlayFoundationPlugin(),
                    masks: plugins.Mask.maskPlugin(options.masks),
                    mosaic: plugins.Mosaic.mosaicPlugin(options.mosaic),
                }),
            );

            return Object.freeze({ editor, ...installedPlugins });
        },
    });
})();
