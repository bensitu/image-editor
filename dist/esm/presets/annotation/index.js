import { ImageEditorCore, } from '../../core/index.js';
import { annotationFoundationPlugin, annotationFoundationRef, } from '../../foundations/annotation/index.js';
import { overlayFoundationPlugin, overlayFoundationRef, } from '../../foundations/overlay/index.js';
import { drawAnnotationPlugin, drawAnnotationPluginRef, } from '../../plugins/annotation-draw/index.js';
import { shapeAnnotationPlugin, shapeAnnotationPluginRef, } from '../../plugins/annotation-shape/index.js';
import { textAnnotationPlugin, textAnnotationPluginRef, } from '../../plugins/annotation-text/index.js';
import { historyPlugin, historyPluginRef, } from '../../plugins/history/index.js';
import { overlayStatePlugin, overlayStatePluginRef, } from '../../plugins/overlay-state/index.js';
import { transformPlugin, transformPluginRef, } from '../../plugins/transform/index.js';
import { composePlugins } from '../../sdk/index.js';
import { createDomBinding, createDomPlugin, } from '../preset-support.js';
export function createAnnotationPreset(fabric, options = {}) {
    const editor = new ImageEditorCore(fabric, options.core);
    const definitions = {
        transform: transformPlugin(options.transform),
        history: historyPlugin(options.history),
        overlays: overlayFoundationPlugin(),
        annotations: annotationFoundationPlugin(options.annotations),
        text: textAnnotationPlugin(options.text),
        shape: shapeAnnotationPlugin(options.shape),
        draw: drawAnnotationPlugin(options.draw),
        overlayState: overlayStatePlugin(options.overlayState),
    };
    const bindings = Object.freeze({
        transform: createDomBinding(editor, transformPluginRef),
        history: createDomBinding(editor, historyPluginRef),
        overlays: createDomBinding(editor, overlayFoundationRef),
        annotations: createDomBinding(editor, annotationFoundationRef),
        text: createDomBinding(editor, textAnnotationPluginRef),
        shape: createDomBinding(editor, shapeAnnotationPluginRef),
        draw: createDomBinding(editor, drawAnnotationPluginRef),
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
export default createAnnotationPreset;
//# sourceMappingURL=index.js.map