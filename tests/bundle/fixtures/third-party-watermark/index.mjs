import { ImageEditorCore } from '@bensitu/image-editor/core';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

import { createWatermarkPlugin } from '../../../../examples/reference-plugins/watermark/dist/esm/index.js';

export function createWatermarkEditor(fabric, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plugins = editor.install([overlayFoundationPlugin(), createWatermarkPlugin()]);
    return { editor, plugins };
}
