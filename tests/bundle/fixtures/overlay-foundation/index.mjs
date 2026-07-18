import { ImageEditorCore } from '@bensitu/image-editor/core';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { definePlugin, definePluginRef } from '@bensitu/image-editor/sdk';

export function createOverlayPlatform(fabric, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const overlay = editor.use(overlayFoundationPlugin());
    return { editor, overlay, definePlugin, definePluginRef };
}
