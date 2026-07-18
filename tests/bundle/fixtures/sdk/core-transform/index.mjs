import { ImageEditorCore } from '@bensitu/image-editor/core';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';

export function createTransformEditor(fabric, coreOptions, pluginOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const transform = editor.use(transformPlugin(pluginOptions));
    return { editor, transform };
}
