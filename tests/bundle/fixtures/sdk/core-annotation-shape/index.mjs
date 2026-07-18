import { ImageEditorCore } from '@bensitu/image-editor/core';
import { shapeAnnotationPlugin } from '@bensitu/image-editor/plugins/annotation-shape';
import { definePluginRef } from '@bensitu/image-editor/sdk';

export function createShapeAnnotationPackage(fabric, coreOptions, pluginOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plugin = shapeAnnotationPlugin(pluginOptions);
    return { editor, plugin, definePluginRef };
}
