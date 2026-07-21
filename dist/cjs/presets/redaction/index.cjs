'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var foundations_overlay_index = require('../../foundations/overlay/index.cjs');
var plugins_crop_index = require('../../plugins/crop/index.cjs');
var plugins_filters_index = require('../../plugins/filters/index.cjs');
var plugins_history_index = require('../../plugins/history/index.cjs');
var plugins_mask_index = require('../../plugins/mask/index.cjs');
var plugins_mosaic_index = require('../../plugins/mosaic/index.cjs');
var plugins_overlayState_index = require('../../plugins/overlay-state/index.cjs');
var plugins_transform_index = require('../../plugins/transform/index.cjs');
var presetSupport = require('../../chunks/preset-support-BlNeXlGM.cjs');
var core_index = require('../../core/index.cjs');
var pluginPlan = require('../../chunks/plugin-plan-CxkCZnUf.cjs');
require('../../chunks/errors-DeAfrgDC.cjs');
require('../../chunks/disposable-Sj4tt6Lk.cjs');
require('../../chunks/plugin-manifest-BCkXHQr2.cjs');
require('../../chunks/plugin-definition-B3UyurRp.cjs');
require('../../chunks/core-capabilities-ewP5YPVJ.cjs');
require('../../chunks/visible-raster-bake-B7dAdnmC.cjs');
require('../../chunks/safe-object-key-WmIq_B8a.cjs');
require('../../chunks/affine-matrix-DRJ0b89x.cjs');
require('../../chunks/plugin-manager-C-UJ_Yc9.cjs');

function createRedactionPreset(fabric, options = {}) {
    const editor = new core_index.ImageEditorCore(fabric, options.core);
    const definitions = {
        transform: plugins_transform_index.transformPlugin(options.transform),
        history: plugins_history_index.historyPlugin(options.history),
        overlays: foundations_overlay_index.overlayFoundationPlugin(),
        masks: plugins_mask_index.maskPlugin(options.masks),
        filters: plugins_filters_index.filtersPlugin(options.filters),
        crop: plugins_crop_index.cropPlugin(options.crop),
        mosaic: plugins_mosaic_index.mosaicPlugin(options.mosaic),
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

exports.createRedactionPreset = createRedactionPreset;
exports.default = createRedactionPreset;
//# sourceMappingURL=index.cjs.map
