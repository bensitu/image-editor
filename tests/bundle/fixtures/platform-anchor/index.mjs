import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';
import { definePlugin, definePluginRef } from '@bensitu/image-editor/sdk';

export function createPlatformAnchor(fabric, coreOptions) {
    const editor = new ImageEditorCore(fabric, coreOptions);
    const plugins = editor.install([transformPlugin(), historyPlugin(), overlayFoundationPlugin()]);
    return { editor, plugins, definePlugin, definePluginRef };
}
