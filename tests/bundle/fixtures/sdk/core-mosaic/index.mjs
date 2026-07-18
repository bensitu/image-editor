import { ImageEditorCore } from '@bensitu/image-editor/core';
import { mosaicPlugin } from '@bensitu/image-editor/plugins/mosaic';
import { definePluginRef } from '@bensitu/image-editor/sdk';

export function createMosaicEditor(fabric, coreOptions, pluginOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const mosaic = editor.use(mosaicPlugin(pluginOptions));
    return { editor, mosaic, definePluginRef };
}
