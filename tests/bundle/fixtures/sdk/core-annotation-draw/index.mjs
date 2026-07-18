import { ImageEditorCore } from '@bensitu/image-editor/core';
import { drawAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-draw';
import { definePluginRef } from '@bensitu/image-editor/sdk';

export function createDrawAnnotationPackage(fabric, coreOptions, pluginOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plugin = drawAnnotationPlugin(pluginOptions);
    return { editor, plugin, definePluginRef };
}
