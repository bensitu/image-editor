import { ImageEditorCore } from '@bensitu/image-editor/core';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

import { createBlurRegionPlugin } from '../../../../examples/reference-plugins/blur-region/dist/esm/index.js';

export function createBlurEditor(fabric, rasterize, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plugins = editor.install([
        overlayFoundationPlugin(),
        createBlurRegionPlugin({ rasterize }),
    ]);
    return { editor, plugins };
}
