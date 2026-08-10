import { canvasInteractionsPlugin } from '@bensitu/image-editor/plugins/canvas-interactions';
import { createFullPreset } from '@bensitu/image-editor/presets/full';
import { fabric } from 'fabric';

globalThis.__IMAGE_EDITOR_BUNDLE_FIXTURE__ = createFullPreset(fabric, {
    canvasInteractions: (bindings) =>
        canvasInteractionsPlugin({
            shape: { plugin: bindings.shape },
            draw: { plugin: bindings.draw },
            mosaic: { plugin: bindings.mosaic },
        }),
});
