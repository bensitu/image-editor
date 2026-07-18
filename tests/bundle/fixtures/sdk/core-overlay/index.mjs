import { ImageEditorCore } from '@bensitu/image-editor/core';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';

export function createOverlayEditor(fabric, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const overlay = editor.use(overlayFoundationPlugin());
    return { editor, overlay };
}
