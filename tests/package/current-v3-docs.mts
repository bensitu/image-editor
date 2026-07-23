import * as fabric from 'fabric';

import { ImageEditorCore } from '@bensitu/image-editor/core';
import { historyPlugin } from '@bensitu/image-editor/plugins/history';
import { maskPlugin } from '@bensitu/image-editor/plugins/mask';
import { overlayFoundationPlugin } from '@bensitu/image-editor/plugins/overlay';
import { transformPlugin } from '@bensitu/image-editor/plugins/transform';
import { createRedactionPreset } from '@bensitu/image-editor/presets/redaction';
import { composePlugins } from '@bensitu/image-editor/sdk';

export function createDocumentedCore(source: string) {
    return new ImageEditorCore(fabric, {
        defaultLayoutMode: 'fit',
        initialImageBase64: source,
        maxInputPixels: 32_000_000,
    });
}

export function createDocumentedPreset() {
    return createRedactionPreset(fabric, {
        core: { canvasWidth: 960, canvasHeight: 640 },
        transform: { animationDuration: 0 },
        history: { maxSize: 25 },
        masks: { defaultWidth: 160, bindToImageTransform: true },
        crop: { paddingPx: 12 },
    });
}

export function createDocumentedComposition() {
    const editor = new ImageEditorCore(fabric, { defaultLayoutMode: 'fit' });
    const apis = editor.install(
        composePlugins({
            transform: transformPlugin({ animationDuration: 0 }),
            history: historyPlugin({ maxSize: 25 }),
            overlays: overlayFoundationPlugin(),
            masks: maskPlugin({ defaultWidth: 160, bindToImageTransform: true }),
        }),
    );
    return { editor, ...apis };
}
