/**
 * Composes the modular UMD plugins used by the Basic Editor demo.
 *
 * @module
 */

(function () {
    'use strict';

    window.ImageEditorDemoPage = Object.freeze({
        id: 'basic',
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
                    filters: plugins.Filters.filtersPlugin(options.filters),
                    crop: plugins.Crop.cropPlugin(options.crop),
                }),
            );

            return Object.freeze({ editor, ...installedPlugins });
        },
    });
})();
