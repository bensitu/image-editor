import { ImageEditorCore } from '@bensitu/image-editor/core';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';

export function createTransformEditor(fabric, coreOptions, transformOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const transform = editor.use(transformPlugin(transformOptions));
    return { editor, transform };
}
