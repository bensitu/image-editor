Object.defineProperties(exports, { __esModule: { value: true }, [Symbol.toStringTag]: { value: 'Module' } });
const require_core = require("../../chunks/core-DX0eYkdk.cjs");
const require_annotation = require("../../chunks/annotation-98DwQK74.cjs");
const require_overlay = require("../../chunks/overlay--Cp3EtE2.cjs");
const require_annotation_draw = require("../../chunks/annotation-draw-Bd_QuINy.cjs");
const require_annotation_shape = require("../../chunks/annotation-shape-BWRfqj47.cjs");
const require_annotation_text = require("../../chunks/annotation-text-sO8hygua.cjs");
const require_history = require("../../chunks/history-CIsZQ6Kh.cjs");
const require_overlay_state = require("../../chunks/overlay-state-DN_eFPFp.cjs");
const require_transform = require("../../chunks/transform-C94Vwybu.cjs");
const require_core_capabilities = require("../../chunks/core-capabilities-CR9r6Rq6.cjs");
const require_preset_support = require("../../chunks/preset-support-rOszmgYc.cjs");

// dist/esm/presets/annotation/index.js
function createAnnotationPreset(fabric, options = {}) {
	const editor = new require_core.ImageEditorCore(fabric, options.core);
	const definitions = {
		transform: require_transform.transformPlugin(options.transform),
		history: require_history.historyPlugin(options.history),
		overlays: require_overlay.overlayFoundationPlugin(),
		annotations: require_annotation.annotationFoundationPlugin(options.annotations),
		text: require_annotation_text.textAnnotationPlugin(options.text),
		shape: require_annotation_shape.shapeAnnotationPlugin(options.shape),
		draw: require_annotation_draw.drawAnnotationPlugin(options.draw),
		overlayState: require_overlay_state.overlayStatePlugin(options.overlayState)
	};
	const bindings = Object.freeze({
		transform: require_preset_support.createDomBinding(editor, require_transform.transformPluginRef),
		history: require_preset_support.createDomBinding(editor, require_history.historyPluginRef),
		overlays: require_preset_support.createDomBinding(editor, require_overlay.overlayFoundationRef),
		annotations: require_preset_support.createDomBinding(editor, require_annotation.annotationFoundationRef),
		text: require_preset_support.createDomBinding(editor, require_annotation_text.textAnnotationPluginRef),
		shape: require_preset_support.createDomBinding(editor, require_annotation_shape.shapeAnnotationPluginRef),
		draw: require_preset_support.createDomBinding(editor, require_annotation_draw.drawAnnotationPluginRef),
		overlayState: require_preset_support.createDomBinding(editor, require_overlay_state.overlayStatePluginRef)
	});
	const domDefinition = require_preset_support.createDomPlugin(options.domControls, bindings);
	if (domDefinition) {
		const apis = editor.install(require_core_capabilities.composePlugins({
			...definitions,
			domControls: domDefinition
		}));
		return Object.freeze({
			editor,
			...apis
		});
	}
	const apis = editor.install(require_core_capabilities.composePlugins(definitions));
	return Object.freeze({
		editor,
		...apis,
		domControls: null
	});
}

exports.createAnnotationPreset = createAnnotationPreset;
exports.default = createAnnotationPreset;
//# sourceMappingURL=index.cjs.map