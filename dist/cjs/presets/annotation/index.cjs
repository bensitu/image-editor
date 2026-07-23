'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var foundations_annotation_index = require('../../foundations/annotation/index.cjs');
var foundations_overlay_index = require('../../foundations/overlay/index.cjs');
var plugins_annotationDraw_index = require('../../plugins/annotation-draw/index.cjs');
var plugins_annotationShape_index = require('../../plugins/annotation-shape/index.cjs');
var plugins_annotationText_index = require('../../plugins/annotation-text/index.cjs');
var plugins_history_index = require('../../plugins/history/index.cjs');
var plugins_overlayState_index = require('../../plugins/overlay-state/index.cjs');
var plugins_transform_index = require('../../plugins/transform/index.cjs');
var presetSupport = require('../../chunks/preset-support-BlNeXlGM.cjs');
var core_index = require('../../core/index.cjs');
var pluginPlan = require('../../chunks/plugin-plan-Cz0Krduf.cjs');
require('../../chunks/plugin-identifier-DWQ7SALj.cjs');
require('../../chunks/disposable-y_ve7ZXe.cjs');
require('../../chunks/plugin-manifest-5BctrtYS.cjs');
require('../../chunks/plugin-definition-DtyrZUJz.cjs');
require('../../chunks/core-capabilities-DryMPZoj.cjs');
require('../../chunks/image-budget-DZeZeVWW.cjs');
require('../../chunks/errors-DeAfrgDC.cjs');
require('../../chunks/safe-fabric-serialization-BWO2g1AV.cjs');
require('../../chunks/affine-matrix-DRJ0b89x.cjs');
require('../../chunks/plugin-manager-CfbKlLDK.cjs');

function createAnnotationPreset(fabric, options = {}) {
    const editor = new core_index.ImageEditorCore(fabric, options.core);
    const definitions = {
        transform: plugins_transform_index.transformPlugin(options.transform),
        history: plugins_history_index.historyPlugin(options.history),
        overlays: foundations_overlay_index.overlayFoundationPlugin(),
        annotations: foundations_annotation_index.annotationFoundationPlugin(options.annotations),
        text: plugins_annotationText_index.textAnnotationPlugin(options.text),
        shape: plugins_annotationShape_index.shapeAnnotationPlugin(options.shape),
        draw: plugins_annotationDraw_index.drawAnnotationPlugin(options.draw),
        overlayState: plugins_overlayState_index.overlayStatePlugin(options.overlayState),
    };
    const bindings = Object.freeze({
        transform: presetSupport.createDomBinding(editor, plugins_transform_index.transformPluginRef),
        history: presetSupport.createDomBinding(editor, plugins_history_index.historyPluginRef),
        overlays: presetSupport.createDomBinding(editor, foundations_overlay_index.overlayFoundationRef),
        annotations: presetSupport.createDomBinding(editor, foundations_annotation_index.annotationFoundationRef),
        text: presetSupport.createDomBinding(editor, plugins_annotationText_index.textAnnotationPluginRef),
        shape: presetSupport.createDomBinding(editor, plugins_annotationShape_index.shapeAnnotationPluginRef),
        draw: presetSupport.createDomBinding(editor, plugins_annotationDraw_index.drawAnnotationPluginRef),
        overlayState: presetSupport.createDomBinding(editor, plugins_overlayState_index.overlayStatePluginRef),
    });
    const domDefinition = presetSupport.createDomPlugin(options.domControls, bindings);
    if (domDefinition) {
        const apis = editor.install(pluginPlan.composePlugins({ ...definitions, domControls: domDefinition }));
        return Object.freeze({ editor, ...apis });
    }
    const apis = editor.install(pluginPlan.composePlugins(definitions));
    return Object.freeze({ editor, ...apis, domControls: null });
}

exports.createAnnotationPreset = createAnnotationPreset;
exports.default = createAnnotationPreset;
//# sourceMappingURL=index.cjs.map
