import { ImageEditorCore, } from '../../core/index.js';
import { overlayFoundationPlugin, overlayFoundationRef, } from '../../foundations/overlay/index.js';
import { cropPlugin, cropPluginRef, } from '../../plugins/crop/index.js';
import { filtersPlugin, filtersPluginRef, } from '../../plugins/filters/index.js';
import { historyPlugin, historyPluginRef, } from '../../plugins/history/index.js';
import { maskPlugin, maskPluginRef, } from '../../plugins/mask/index.js';
import { mosaicPlugin, mosaicPluginRef, } from '../../plugins/mosaic/index.js';
import { overlayStatePlugin, overlayStatePluginRef, } from '../../plugins/overlay-state/index.js';
import { transformPlugin, transformPluginRef, } from '../../plugins/transform/index.js';
import { composePlugins } from '../../sdk/index.js';
import { createDomBinding, createDomPlugin, } from '../preset-support.js';
export function createRedactionPreset(fabric, options = {}) {
    const editor = new ImageEditorCore(fabric, options.core);
    const definitions = {
        transform: transformPlugin(options.transform),
        history: historyPlugin(options.history),
        overlays: overlayFoundationPlugin(),
        masks: maskPlugin(options.masks),
        filters: filtersPlugin(options.filters),
        crop: cropPlugin(options.crop),
        mosaic: mosaicPlugin(options.mosaic),
        overlayState: overlayStatePlugin(options.overlayState),
    };
    const bindings = Object.freeze({
        transform: createDomBinding(editor, transformPluginRef),
        history: createDomBinding(editor, historyPluginRef),
        overlays: createDomBinding(editor, overlayFoundationRef),
        masks: createDomBinding(editor, maskPluginRef),
        filters: createDomBinding(editor, filtersPluginRef),
        crop: createDomBinding(editor, cropPluginRef),
        mosaic: createDomBinding(editor, mosaicPluginRef),
        overlayState: createDomBinding(editor, overlayStatePluginRef),
    });
    const domDefinition = createDomPlugin(options.domControls, bindings);
    if (domDefinition) {
        const apis = editor.install(composePlugins({ ...definitions, domControls: domDefinition }));
        return Object.freeze({ editor, ...apis });
    }
    const apis = editor.install(composePlugins(definitions));
    return Object.freeze({ editor, ...apis, domControls: null });
}
export default createRedactionPreset;
//# sourceMappingURL=index.js.map