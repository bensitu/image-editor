import { ImageEditorCore } from '@bensitu/image-editor/core';
import { filtersPlugin } from '@bensitu/image-editor/plugins/filters';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { mosaicPlugin } from '@bensitu/image-editor/plugins/mosaic';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

export function createIntegratedMosaicEditor(fabric, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plugins = editor.install([
        historyPlugin(),
        overlayFoundationPlugin(),
        maskPlugin(),
        filtersPlugin(),
        mosaicPlugin(),
    ]);
    return { editor, plugins };
}
