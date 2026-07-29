Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: 'Module' } });
const require_core_capabilities = require('../../chunks/core-capabilities-CWXMFfBX.cjs');
const require_core = require('../../chunks/core-D_s-hE8G.cjs');
const require_transform = require('../../chunks/transform-CdFF9FVN.cjs');
const require_history = require('../../chunks/history-Cafg9VrA.cjs');
const require_preset_support = require('../../chunks/preset-support-fdxHrf6c.cjs');

//#region dist/esm/presets/minimal/index.js
function createMinimalPreset(fabric, options = {}) {
	const editor = new require_core.ImageEditorCore(fabric, options.core);
	const transformDefinition = require_transform.transformPlugin(options.transform);
	const historyDefinition = options.history === false || options.history === void 0 ? null : require_history.historyPlugin(options.history);
	const bindings = Object.freeze({
		transform: require_preset_support.createDomBinding(editor, require_transform.transformPluginRef),
		history: historyDefinition ? require_preset_support.createDomBinding(editor, require_history.historyPluginRef) : null
	});
	const domDefinition = require_preset_support.createDomPlugin(options.domControls, bindings);
	if (historyDefinition && domDefinition) {
		const apis = editor.install(require_core_capabilities.composePlugins({
			transform: transformDefinition,
			history: historyDefinition,
			domControls: domDefinition
		}));
		return Object.freeze({
			editor,
			...apis
		});
	}
	if (historyDefinition) {
		const apis = editor.install(require_core_capabilities.composePlugins({
			transform: transformDefinition,
			history: historyDefinition
		}));
		return Object.freeze({
			editor,
			...apis,
			domControls: null
		});
	}
	if (domDefinition) {
		const apis = editor.install(require_core_capabilities.composePlugins({
			transform: transformDefinition,
			domControls: domDefinition
		}));
		return Object.freeze({
			editor,
			...apis,
			history: null
		});
	}
	const apis = editor.install(require_core_capabilities.composePlugins({ transform: transformDefinition }));
	return Object.freeze({
		editor,
		...apis,
		history: null,
		domControls: null
	});
}

//#endregion
exports.createMinimalPreset = createMinimalPreset;
exports.default = createMinimalPreset;
//# sourceMappingURL=index.cjs.map