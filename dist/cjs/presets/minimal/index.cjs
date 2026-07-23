'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

var plugins_history_index = require('../../plugins/history/index.cjs');
var plugins_transform_index = require('../../plugins/transform/index.cjs');
var presetSupport = require('../../chunks/preset-support-BlNeXlGM.cjs');
var core_index = require('../../core/index.cjs');
var pluginPlan = require('../../chunks/plugin-plan-BBOVkUMI.cjs');
require('../../chunks/errors-DeAfrgDC.cjs');
require('../../chunks/plugin-manifest-DNqSyjh2.cjs');
require('../../chunks/plugin-identifier-DPwx4Gkd.cjs');
require('../../chunks/plugin-definition-C87dytjB.cjs');
require('../../chunks/core-capabilities-CWNPa1MZ.cjs');
require('../../chunks/affine-matrix-DRJ0b89x.cjs');
require('../../chunks/plugin-manager-CXW0nIYm.cjs');
require('../../chunks/disposable-pTo80E0l.cjs');
require('../../chunks/image-budget-DZeZeVWW.cjs');

function createMinimalPreset(fabric, options = {}) {
    const editor = new core_index.ImageEditorCore(fabric, options.core);
    const transformDefinition = plugins_transform_index.transformPlugin(options.transform);
    const historyDefinition = options.history === false || options.history === undefined
        ? null
        : plugins_history_index.historyPlugin(options.history);
    const bindings = Object.freeze({
        transform: presetSupport.createDomBinding(editor, plugins_transform_index.transformPluginRef),
        history: historyDefinition ? presetSupport.createDomBinding(editor, plugins_history_index.historyPluginRef) : null,
    });
    const domDefinition = presetSupport.createDomPlugin(options.domControls, bindings);
    if (historyDefinition && domDefinition) {
        const apis = editor.install(pluginPlan.composePlugins({
            transform: transformDefinition,
            history: historyDefinition,
            domControls: domDefinition,
        }));
        return Object.freeze({ editor, ...apis });
    }
    if (historyDefinition) {
        const apis = editor.install(pluginPlan.composePlugins({ transform: transformDefinition, history: historyDefinition }));
        return Object.freeze({ editor, ...apis, domControls: null });
    }
    if (domDefinition) {
        const apis = editor.install(pluginPlan.composePlugins({ transform: transformDefinition, domControls: domDefinition }));
        return Object.freeze({ editor, ...apis, history: null });
    }
    const apis = editor.install(pluginPlan.composePlugins({ transform: transformDefinition }));
    return Object.freeze({
        editor,
        ...apis,
        history: null,
        domControls: null,
    });
}

exports.createMinimalPreset = createMinimalPreset;
exports.default = createMinimalPreset;
//# sourceMappingURL=index.cjs.map
