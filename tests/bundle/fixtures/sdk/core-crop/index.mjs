import { ImageEditorCore } from '@bensitu/image-editor/core';
import { cropPlugin } from '@bensitu/image-editor/plugins/crop';
import { definePluginRef } from '@bensitu/image-editor/sdk';

export function createCropEditor(fabric, coreOptions, pluginOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const crop = editor.use(cropPlugin(pluginOptions));
    return { editor, crop, definePluginRef };
}
