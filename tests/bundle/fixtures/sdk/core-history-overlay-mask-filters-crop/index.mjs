import { ImageEditorCore } from '@bensitu/image-editor/core';
import { cropPlugin } from '@bensitu/image-editor/plugins/crop';
import { filtersPlugin } from '@bensitu/image-editor/plugins/filters';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

export function createIntegratedCropEditor(fabric, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plugins = editor.install([
        historyPlugin(),
        overlayFoundationPlugin(),
        maskPlugin(),
        filtersPlugin(),
        cropPlugin(),
    ]);
    return { editor, plugins };
}
