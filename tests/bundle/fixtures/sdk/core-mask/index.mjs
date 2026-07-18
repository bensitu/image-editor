import { ImageEditorCore } from '@bensitu/image-editor/core';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

export function createMaskEditor(fabric, coreOptions, pluginOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plan = editor.install([overlayFoundationPlugin(), maskPlugin(pluginOptions)]);
    return { editor, plan };
}
