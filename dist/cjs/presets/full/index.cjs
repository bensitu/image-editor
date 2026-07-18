'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var foundations_annotation_index = require('../../foundations/annotation/index.cjs');
var foundations_overlay_index = require('../../foundations/overlay/index.cjs');
var plugins_annotationDraw_index = require('../../plugins/annotation-draw/index.cjs');
var plugins_annotationShape_index = require('../../plugins/annotation-shape/index.cjs');
var plugins_annotationText_index = require('../../plugins/annotation-text/index.cjs');
var plugins_crop_index = require('../../plugins/crop/index.cjs');
var plugins_filters_index = require('../../plugins/filters/index.cjs');
var plugins_history_index = require('../../plugins/history/index.cjs');
var plugins_mask_index = require('../../plugins/mask/index.cjs');
var plugins_mosaic_index = require('../../plugins/mosaic/index.cjs');
var plugins_overlayState_index = require('../../plugins/overlay-state/index.cjs');
var plugins_transform_index = require('../../plugins/transform/index.cjs');
var presetSupport = require('../../chunks/preset-support-BlNeXlGM.cjs');
var core_index = require('../../core/index.cjs');
var pluginPlan = require('../../chunks/plugin-plan-4bgXTnNS.cjs');
require('../../chunks/disposable-Sj4tt6Lk.cjs');
require('../../chunks/plugin-manifest-Cap1WbD8.cjs');
require('../../chunks/plugin-definition-Zpkh5kaP.cjs');
require('../../chunks/core-capabilities-3osq1B3M.cjs');
require('../../chunks/errors-DeAfrgDC.cjs');
require('../../chunks/visible-raster-bake-Ci8VnO_S.cjs');
require('../../chunks/affine-matrix-DRJ0b89x.cjs');
require('../../chunks/plugin-manager-C4krd9Vr.cjs');

function createFullPreset(fabric, options = {}) {
    const editor = new core_index.ImageEditorCore(fabric, options.core);
    const definitions = {
        transform: plugins_transform_index.transformPlugin(options.transform),
        history: plugins_history_index.historyPlugin(options.history),
        overlays: foundations_overlay_index.overlayFoundationPlugin(),
        masks: plugins_mask_index.maskPlugin(options.masks),
        filters: plugins_filters_index.filtersPlugin(options.filters),
        crop: plugins_crop_index.cropPlugin(options.crop),
        mosaic: plugins_mosaic_index.mosaicPlugin(options.mosaic),
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
        masks: presetSupport.createDomBinding(editor, plugins_mask_index.maskPluginRef),
        filters: presetSupport.createDomBinding(editor, plugins_filters_index.filtersPluginRef),
        crop: presetSupport.createDomBinding(editor, plugins_crop_index.cropPluginRef),
        mosaic: presetSupport.createDomBinding(editor, plugins_mosaic_index.mosaicPluginRef),
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

exports.createFullPreset = createFullPreset;
exports.default = createFullPreset;
//# sourceMappingURL=index.cjs.map
