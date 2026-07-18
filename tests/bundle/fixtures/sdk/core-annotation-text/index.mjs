import { ImageEditorCore } from '@bensitu/image-editor/core';
import { textAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-text';
import { definePluginRef } from '@bensitu/image-editor/sdk';

export function createTextAnnotationPackage(fabric, coreOptions, pluginOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plugin = textAnnotationPlugin(pluginOptions);
    return { editor, plugin, definePluginRef };
}
