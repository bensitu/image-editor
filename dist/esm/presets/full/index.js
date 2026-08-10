import { ImageEditorCore, } from '../../core/index.js';
import { annotationFoundationPlugin, annotationFoundationRef, } from '../../foundations/annotation/index.js';
import { overlayFoundationPlugin, overlayFoundationRef, } from '../../foundations/overlay/index.js';
import { drawAnnotationPlugin, drawAnnotationPluginRef, } from '../../plugins/annotation-draw/index.js';
import { shapeAnnotationPlugin, shapeAnnotationPluginRef, } from '../../plugins/annotation-shape/index.js';
import { textAnnotationPlugin, textAnnotationPluginRef, } from '../../plugins/annotation-text/index.js';
import { cropPlugin, cropPluginRef, } from '../../plugins/crop/index.js';
import { filtersPlugin, filtersPluginRef, } from '../../plugins/filters/index.js';
import { historyPlugin, historyPluginRef, } from '../../plugins/history/index.js';
import { maskPlugin, maskPluginRef, } from '../../plugins/mask/index.js';
import { mosaicPlugin, mosaicPluginRef, } from '../../plugins/mosaic/index.js';
import { overlayStatePlugin, overlayStatePluginRef, } from '../../plugins/overlay-state/index.js';
import { transformPlugin, transformPluginRef, } from '../../plugins/transform/index.js';
import { composePlugins } from '../../sdk/index.js';
import { createDomBinding, createCanvasBinding, createCanvasPlugin, createDomPlugin, } from '../preset-support.js';
export function createFullPreset(fabric, options = {}) {
    const editor = new ImageEditorCore(fabric, options.core);
    const definitions = {
        transform: transformPlugin(options.transform),
        history: historyPlugin(options.history),
        overlays: overlayFoundationPlugin(),
        masks: maskPlugin(options.masks),
        filters: filtersPlugin(options.filters),
        crop: cropPlugin(options.crop),
        mosaic: mosaicPlugin(options.mosaic),
        annotations: annotationFoundationPlugin(options.annotations),
        text: textAnnotationPlugin(options.text),
        shape: shapeAnnotationPlugin(options.shape),
        draw: drawAnnotationPlugin(options.draw),
        overlayState: overlayStatePlugin(options.overlayState),
    };
    const domBindings = Object.freeze({
        transform: createDomBinding(editor, transformPluginRef),
        history: createDomBinding(editor, historyPluginRef),
        overlays: createDomBinding(editor, overlayFoundationRef),
        masks: createDomBinding(editor, maskPluginRef),
        filters: createDomBinding(editor, filtersPluginRef),
        crop: createDomBinding(editor, cropPluginRef),
        mosaic: createDomBinding(editor, mosaicPluginRef),
        annotations: createDomBinding(editor, annotationFoundationRef),
        text: createDomBinding(editor, textAnnotationPluginRef),
        shape: createDomBinding(editor, shapeAnnotationPluginRef),
        draw: createDomBinding(editor, drawAnnotationPluginRef),
        overlayState: createDomBinding(editor, overlayStatePluginRef),
    });
    const canvasBindings = Object.freeze({
        overlays: createCanvasBinding(editor, overlayFoundationRef),
        mosaic: createCanvasBinding(editor, mosaicPluginRef),
        annotations: createCanvasBinding(editor, annotationFoundationRef),
        text: createCanvasBinding(editor, textAnnotationPluginRef),
        shape: createCanvasBinding(editor, shapeAnnotationPluginRef),
        draw: createCanvasBinding(editor, drawAnnotationPluginRef),
    });
    const domDefinition = createDomPlugin(options.domControls, domBindings);
    const canvasDefinition = createCanvasPlugin(options.canvasInteractions, canvasBindings);
    if (domDefinition && canvasDefinition) {
        const apis = editor.install(composePlugins({
            ...definitions,
            canvasInteractions: canvasDefinition,
            domControls: domDefinition,
        }));
        return Object.freeze({ editor, ...apis });
    }
    if (canvasDefinition) {
        const apis = editor.install(composePlugins({ ...definitions, canvasInteractions: canvasDefinition }));
        return Object.freeze({ editor, ...apis, domControls: null });
    }
    if (domDefinition) {
        const apis = editor.install(composePlugins({ ...definitions, domControls: domDefinition }));
        return Object.freeze({ editor, ...apis, canvasInteractions: null });
    }
    const apis = editor.install(composePlugins(definitions));
    return Object.freeze({
        editor,
        ...apis,
        domControls: null,
        canvasInteractions: null,
    });
}
export default createFullPreset;
//# sourceMappingURL=index.js.map